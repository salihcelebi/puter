// ════════════════════════════════════════════════════════
// idm.js — v7.0.0
// Puter Serverless Worker — router tabanlı
// KRİTİK DÜZELTME: me parametresi her handler'dan ctx.me olarak alınıyor
// me.puter.ai.txt2img() ve me.puter.kv doğru erişim
// ════════════════════════════════════════════════════════

// ──────────────────────────────────────────────────────
// BÖLÜM 1: YARDIMCI FONKSİYONLAR
// ──────────────────────────────────────────────────────

function nowIso() { return new Date().toISOString(); }
function nowMs() { return Date.now(); }

function createId(prefix) {
  return (prefix || 'id') + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
}

function safeStr(value, fallback) {
  var fb = (typeof fallback === 'string') ? fallback : '';
  try {
    if (value === null || value === undefined) return fb;
    var s = String(value).trim();
    return s || fb;
  } catch (_) { return fb; }
}

function safeNum(value, fallback) {
  var fb = (typeof fallback === 'number') ? fallback : 0;
  try {
    if (value === null || value === undefined || value === '') return fb;
    var n = Number(value);
    return Number.isFinite(n) ? n : fb;
  } catch (_) { return fb; }
}

function nullablePrice(value) {
  try {
    if (value === null || value === undefined || value === '') return null;
    var n = Number(value);
    return Number.isFinite(n) ? n : null;
  } catch (_) { return null; }
}

function clampInt(value, min, max, fallback) {
  try {
    var n = Math.floor(Number(value));
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  } catch (_) { return fallback; }
}

// Herhangi bir hata nesnesinden okunabilir string
function errMsg(err) {
  if (!err) return 'bilinmiyor';
  try {
    if (typeof err === 'string') return err;
    if (typeof err.message === 'string' && err.message) return err.message;
    if (err.error && typeof err.error.message === 'string') return err.error.message;
    if (err.error && typeof err.error === 'string') return err.error;
    var s = JSON.stringify(err);
    if (s && s !== '{}') return s.slice(0, 300);
    return 'Hata nesnesi okunamadı';
  } catch (_) { return 'Hata serialize edilemedi'; }
}

// ──────────────────────────────────────────────────────
// BÖLÜM 2: CORS & HTTP
// ──────────────────────────────────────────────────────

function corsHeaders(request) {
  var origin = '*';
  try { origin = request.headers.get('origin') || '*'; } catch (_) {}
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-credentials': 'true',
    'vary': 'origin',
  };
}

function jsonResp(request, body, status, cacheCtrl) {
  return new Response(JSON.stringify(body, null, 2), {
    status: (typeof status === 'number') ? status : 200,
    headers: Object.assign({}, corsHeaders(request), {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': (typeof cacheCtrl === 'string') ? cacheCtrl : 'no-store',
    }),
  });
}

// ──────────────────────────────────────────────────────
// BÖLÜM 3: ENVELOPE
// ──────────────────────────────────────────────────────

function okEnv(rid, trid, t, code, data, meta) {
  return {
    ok: true, code: code || 'OK', error: null,
    data: (data !== undefined) ? data : null,
    meta: (meta !== undefined) ? meta : null,
    worker: 'idm', version: '7.0.0', protocolVersion: '2026-03-15',
    billingMode: 'owner_pays', requestId: rid, traceId: trid,
    time: nowIso(), durationMs: Math.max(0, nowMs() - t),
  };
}

function errEnv(rid, trid, t, code, message, bullets, httpStatus) {
  var bul = (Array.isArray(bullets) && bullets.length) ? bullets : [
    '1) Hata: ' + (message || 'bilinmiyor') + ' — işlem tamamlanamadı.',
    '2) Kod: ' + (code || 'BILINMIYOR') + ' — detay için worker loglarını inceleyin.',
    '3) Promptu ve model seçimini değiştirerek tekrar deneyin.',
  ];
  return {
    ok: false, code: code || 'ERROR',
    error: { message: message || 'Bilinmeyen hata', bullets: bul, displayDurationMs: 5000, retryable: true },
    data: null, meta: null, worker: 'idm', version: '7.0.0',
    requestId: rid, traceId: trid, time: nowIso(),
    durationMs: Math.max(0, nowMs() - t), httpStatus: httpStatus || 500,
  };
}

// ──────────────────────────────────────────────────────
// BÖLÜM 4: KV DEPOLAMA (me parametre alır)
// ──────────────────────────────────────────────────────

var JOB_PFX = 'ai_job:';
var CANCEL_PFX = 'ai_cancel:';
var TERMINAL = { completed: true, failed: true, cancelled: true };

function jobKey(id) { return JOB_PFX + id; }
function cancelKey(id) { return CANCEL_PFX + id; }

async function kvGet(me, key) {
  try {
    var raw = await me.puter.kv.get(key);
    if (raw === null || raw === undefined) return null;
    if (typeof raw === 'string') { try { return JSON.parse(raw); } catch (_) { return raw; } }
    return raw;
  } catch (err) {
    var e = new Error('KV okuma hatası (' + key + '): ' + errMsg(err));
    e.code = 'KV_READ_ERROR'; throw e;
  }
}

async function kvSet(me, key, value) {
  try {
    await me.puter.kv.set(key, typeof value === 'string' ? value : JSON.stringify(value));
    return true;
  } catch (err) {
    var e = new Error('KV yazma hatası (' + key + '): ' + errMsg(err));
    e.code = 'KV_WRITE_ERROR'; throw e;
  }
}

async function kvListKeys(me, prefix) {
  try {
    if (typeof me.puter.kv.list === 'function') {
      var r = await me.puter.kv.list(prefix);
      if (Array.isArray(r)) return r.map(function(i) { return typeof i === 'string' ? i : (i && i.key) || null; }).filter(Boolean);
    }
    return [];
  } catch (_) { return []; }
}

async function saveJob(me, job) {
  var j = Object.assign({}, job, { updatedAt: nowIso() });
  try { await kvSet(me, jobKey(j.jobId), j); } catch (_) {}
  return j;
}

async function readJob(me, jobId) {
  try { return await kvGet(me, jobKey(safeStr(jobId))); } catch (_) { return null; }
}

async function updateJob(me, jobId, fn) {
  var cur = (await readJob(me, jobId)) || { jobId: jobId };
  var next = fn(Object.assign({}, cur));
  return saveJob(me, Object.assign({}, next, { jobId: jobId }));
}

async function listJobs(me, limit) {
  var n = clampInt(limit, 1, 50, 20);
  try {
    var keys = await kvListKeys(me, JOB_PFX);
    var jobs = [];
    for (var i = 0; i < keys.length; i++) {
      try { var j = await kvGet(me, keys[i]); if (j && j.jobId) jobs.push(j); } catch (_) {}
    }
    jobs.sort(function(a, b) { return safeStr(b.updatedAt || b.createdAt).localeCompare(safeStr(a.updatedAt || a.createdAt)); });
    return jobs.slice(0, n);
  } catch (_) { return []; }
}

// ──────────────────────────────────────────────────────
// BÖLÜM 5: GÖRSEL ÜRETİMİ
// ──────────────────────────────────────────────────────

var IMAGE_DEFAULTS = { modelId: 'openai/gpt-image-1', quality: 'low', ratio: '1:1' };
var ALLOWED_QUALITIES = { low: true, medium: true, high: true };
var ALLOWED_RATIOS = { '1:1': true, '16:9': true, '9:16': true, '4:3': true, '3:4': true };

// Bizim modelId → Puter'ın beklediği provider + model
function mapModel(modelId) {
  var s = safeStr(modelId, '').toLowerCase();
  if (s.includes('gpt-image-1.5'))  return { provider: 'openai-image-generation', model: 'gpt-image-1.5' };
  if (s.includes('gpt-image-1'))    return { provider: 'openai-image-generation', model: 'gpt-image-1' };
  if (s.includes('dall-e-3'))       return { provider: 'openai-image-generation', model: 'dall-e-3' };
  if (s.includes('flux-schnell') || s.includes('flux-1-schnell')) return { provider: 'together', model: 'black-forest-labs/FLUX.1-schnell' };
  if (s.includes('flux-dev')    || s.includes('flux-1-dev'))      return { provider: 'together', model: 'black-forest-labs/FLUX.1-dev' };
  if (s.includes('flux-1.1-pro') || s.includes('flux-pro'))       return { provider: 'together', model: 'black-forest-labs/FLUX.1.1-pro' };
  if (s.includes('flux'))           return { provider: 'together', model: 'black-forest-labs/FLUX.1-schnell' };
  if (s.includes('recraft'))        return { provider: 'together', model: 'recraft-ai/recraftv3' };
  if (s.includes('gemini') && s.includes('image')) return { provider: 'gemini', model: 'gemini-2.5-flash-image-preview' };
  if (s.includes('grok'))           return { provider: 'xai', model: 'grok-2-image' };
  return { provider: 'openai-image-generation', model: 'gpt-image-1' };
}

// ratio → {w, h}
function ratioWH(r) {
  var m = { '1:1':{w:1024,h:1024}, '16:9':{w:1792,h:1024}, '9:16':{w:1024,h:1792}, '4:3':{w:1024,h:768}, '3:4':{w:768,h:1024} };
  return m[r] || { w: 1024, h: 1024 };
}

// Puter result → URL
function pickUrl(result) {
  if (!result) return null;
  if (typeof result === 'string' && result.trim()) return result.trim();
  if (typeof result === 'object' && !Array.isArray(result)) {
    for (var k of ['src','url','href','dataUrl','data_url']) {
      if (typeof result[k] === 'string' && result[k].trim()) return result[k].trim();
    }
    if (result.data) return pickUrl(result.data);
  }
  if (Array.isArray(result) && result.length > 0) return pickUrl(result[0]);
  return null;
}

// data URL → Puter FS → kalıcı URL
async function persistUrl(me, dataUrl, jobId) {
  try {
    var path = '/idm_images/img_' + jobId + '_' + Date.now() + '.png';
    var resp = await fetch(dataUrl);
    var blob = await resp.blob();
    var fsItem = await me.puter.fs.write(path, blob, { createMissingParents: true, overwrite: true });
    if (typeof me.puter.fs.getReadURL === 'function') {
      var u = await me.puter.fs.getReadURL(path);
      if (typeof u === 'string' && u.trim()) return u.trim();
    }
    if (fsItem && typeof fsItem.getReadURL === 'function') {
      var u2 = await fsItem.getReadURL();
      if (typeof u2 === 'string' && u2.trim()) return u2.trim();
    }
    return dataUrl;
  } catch (_) { return dataUrl; }
}

// Ana üretim — me ctx'ten gelir
async function doGenerate(me, req) {
  // me kontrol
  if (!me || !me.puter) {
    var e1 = new Error('me.puter erişilemiyor — worker context hatası.');
    e1.code = 'ME_PUTER_UNAVAILABLE';
    e1.bullets = [
      '1) me.puter nesnesi handler\'da mevcut değil veya undefined olarak geldi.',
      '2) Worker\'ın Puter platformunda doğru publish edilmediği anlaşılıyor.',
      '3) Worker\'ı Puter dashboard\'dan sil, yeniden oluştur ve publish et.',
    ];
    throw e1;
  }
  if (typeof me.puter.ai.txt2img !== 'function') {
    var e2 = new Error('me.puter.ai.txt2img mevcut değil.');
    e2.code = 'TXT2IMG_UNAVAILABLE';
    e2.bullets = [
      '1) me.puter.ai.txt2img fonksiyonu bu worker context\'inde tanımlanmamış.',
      '2) Puter AI servisi aktif değil veya worker izinleri eksik olabilir.',
      '3) Worker\'ı yeniden publish edin; sorun devam ederse Puter support ile iletişime geçin.',
    ];
    throw e2;
  }

  var mapped = mapModel(req.modelId);
  var size = ratioWH(req.ratio);
  var opts = { provider: mapped.provider, model: mapped.model, test_mode: false };

  // Provider'a özel parametreler
  if (mapped.provider === 'openai-image-generation') {
    opts.quality = safeStr(req.quality, 'low');
    opts.ratio = size;
  } else if (mapped.provider === 'together') {
    opts.width = size.w;
    opts.height = size.h;
    opts.steps = 20;
    opts.n = 1;
    if (req.negativePrompt) opts.negative_prompt = req.negativePrompt;
  } else if (mapped.provider === 'gemini') {
    opts.ratio = { w: 1024, h: 1024 };
  }
  // xAI: sadece prompt

  var result;
  try {
    result = await me.puter.ai.txt2img(req.prompt, opts);
  } catch (err) {
    var msg = errMsg(err);
    var e3 = new Error('me.puter.ai.txt2img çağrısı başarısız: ' + msg);
    e3.code = safeStr(err && err.code, 'TXT2IMG_CALL_FAILED');
    e3.bullets = [
      '1) me.puter.ai.txt2img("' + req.prompt.slice(0, 50) + '", opts) hata fırlattı.',
      '2) Hata: ' + msg + ' — provider: ' + mapped.provider + ', model: ' + mapped.model,
      '3) GPT Image 1 modelini seçip tekrar deneyin; promptu kısaltmayı da deneyin.',
    ];
    throw e3;
  }

  var rawUrl = pickUrl(result);
  if (!rawUrl) {
    var rs = '';
    try { rs = JSON.stringify(result); } catch (_) { rs = typeof result; }
    var e4 = new Error('Görsel üretildi fakat URL alınamadı. Sonuç: ' + rs.slice(0, 200));
    e4.code = 'IMAGE_URL_MISSING';
    e4.bullets = [
      '1) me.puter.ai.txt2img() çağrısı tamamlandı fakat URL içeren .src/.url alanı bulunamadı.',
      '2) Dönen sonuç tipi: ' + typeof result + ' — Puter API çıktı formatı değişmiş olabilir.',
      '3) Farklı model (örn: GPT Image 1) ile tekrar deneyin.',
    ];
    throw e4;
  }

  // data URL ise FS'e kaydet
  if (rawUrl.startsWith('data:')) {
    rawUrl = await persistUrl(me, rawUrl, createId('fs'));
  }

  return rawUrl;
}

function buildJobRecord(jobId, req) {
  var now = nowIso();
  return {
    jobId: jobId, feature: 'image', status: 'queued', progress: 0, step: 'queued',
    outputUrl: null, outputUrls: [], url: null, urls: [], retryable: true, cancelRequested: false,
    requestSummary: { model: req.modelId, prompt: req.prompt, promptPreview: req.prompt.length <= 140 ? req.prompt : req.prompt.slice(0,139)+'…' },
    request: { model: req.model, modelId: req.modelId, ratio: req.ratio, quality: req.quality, style: req.style, negativePrompt: req.negativePrompt },
    error: null, createdAt: now, updatedAt: now, finishedAt: null,
  };
}

// ──────────────────────────────────────────────────────
// BÖLÜM 6: MODEL KATALOĞU
// ──────────────────────────────────────────────────────

var CATALOG_DEFAULTS = { limit: 50, maxLimit: 250, cacheSeconds: 300 };
var SPEED_MAP = { 'Ultra Hızlı':94,'Çok Hızlı':88,'Hızlı':78,'Orta':58,'~1 sn/görsel':92,'~3 sn/görsel':78,'~4 sn/görsel':70,'~5 sn/görsel':62,'~6 sn/görsel':56,'~7 sn/görsel':50,'~8 sn/görsel':44 };

var RAW_MODELS = [
  {company:'OpenAI',provider:'OpenAI',modelName:'GPT Image 1',modelId:'openai/gpt-image-1',speedLabel:'~8 sn/görsel',imagePrice:0.0165,traits:['LLM bağlamlı','Metin anlama','Prompt sadakati','OpenAI kalite','ChatGPT entegre'],standoutFeature:'GPT metin anlayışı ile görsel füzyon',useCase:'ChatGPT entegrasyonu, içerik',style:{brandKey:'openai',accent:'#10a37f'}},
  {company:'OpenAI',provider:'OpenAI',modelName:'DALL-E 3',modelId:'openai/dall-e-3',speedLabel:'~6 sn/görsel',imagePrice:0.04,traits:['Yüksek prompt uyum','Detaylı çıktı','Güçlü stil kontrolü','OpenAI güvencesi','Geniş kullanım'],standoutFeature:'DALL-E serisinin doruk modeli',useCase:'Reklam, içerik, pazarlama',style:{brandKey:'openai',accent:'#10a37f'}},
  {company:'BFL',provider:'BFL',modelName:'Flux Schnell',modelId:'bfl/flux-schnell',speedLabel:'~1 sn/görsel',imagePrice:0.0045,traits:['Yıldırım hızı','Toplu üretim','Minimum gecikme','Distilasyon','Ölçek için'],standoutFeature:'En hızlı açık diffusion',useCase:'Toplu görsel, A/B testi',style:{brandKey:'bfl',accent:'#ef4444'}},
  {company:'BFL',provider:'BFL',modelName:'Flux Pro',modelId:'bfl/flux-pro',speedLabel:'~4 sn/görsel',imagePrice:0.075,traits:['Profesyonel','Fotogerçekçi','Detay kalite','Yaratıcı standart','Güvenilir'],standoutFeature:'Ticari üretim standart modeli',useCase:'İçerik ajansı, e-ticaret',style:{brandKey:'bfl',accent:'#ef4444'}},
  {company:'BFL',provider:'BFL',modelName:'Flux Dev',modelId:'bfl/flux-dev',speedLabel:'~4 sn/görsel',imagePrice:0.0375,traits:['Geliştirici lisansı','Fine-tuning','Açık araştırma','Prototip','Topluluk'],standoutFeature:'Geliştirici lisansı Pro kalite',useCase:'Fine-tuning, araştırma',style:{brandKey:'bfl',accent:'#ef4444'}},
  {company:'BFL',provider:'BFL',modelName:'Flux Pro 1.1 Ultra',modelId:'bfl/flux-pro-1.1-ultra',speedLabel:'~6 sn/görsel',imagePrice:0.09,traits:['Amiral gemisi','Ultra çözünürlük','Fotogerçekçilik','Baskı standart','Premium'],standoutFeature:'BFL en yüksek kalite',useCase:'Ticari baskı, reklam',style:{brandKey:'bfl',accent:'#ef4444'}},
  {company:'Black Forest Labs',provider:'Black Forest Labs',modelName:'Flux 1 Schnell',modelId:'black-forest-labs/flux-1-schnell',speedLabel:'~1 sn/görsel',imagePrice:0.0045,traits:['Alman mühendislik','1 sn altı','Maliyet minimize','Yüksek hacim','Distilled'],standoutFeature:'4 adımda 1 sn altı üretim',useCase:'Gerçek zamanlı önizleme',style:{brandKey:'black-forest-labs',accent:'#ef4444'}},
  {company:'Black Forest Labs',provider:'Black Forest Labs',modelName:'Flux 1 Dev',modelId:'black-forest-labs/flux-1-dev',speedLabel:'~5 sn/görsel',imagePrice:0.0375,traits:['Pro kalite','Ticari uyumlu','Fine-tune','Açık model','Topluluk'],standoutFeature:'Pro kalite geliştirici lisansı',useCase:'Uygulama, prototip',style:{brandKey:'black-forest-labs',accent:'#ef4444'}},
  {company:'Black Forest Labs',provider:'Black Forest Labs',modelName:'Flux 1.1 Pro',modelId:'black-forest-labs/flux-1.1-pro',speedLabel:'~4 sn/görsel',imagePrice:0.06,traits:['Profesyonel','Detay sadakati','Fotogerçekçi','Yaratıcı','Sektör onaylı'],standoutFeature:'Stable diffusion ötesi kalite',useCase:'Ticari görselleştirme',style:{brandKey:'black-forest-labs',accent:'#ef4444'}},
  {company:'Black Forest Labs',provider:'Black Forest Labs',modelName:'Flux Kontext Pro',modelId:'black-forest-labs/flux-kontext-pro',speedLabel:'~5 sn/görsel',imagePrice:0.06,traits:['Bağlam anlama','Stil tutarlılığı','Kompozisyon','Marka uyumlu','Kontext'],standoutFeature:'Kontext Max yarı fiyatı',useCase:'İçerik kanalları',style:{brandKey:'black-forest-labs',accent:'#ef4444'}},
  {company:'Google',provider:'Google',modelName:'Gemini Flash Image',modelId:'google/gemini-3.1-flash-image-preview',speedLabel:'~3 sn/görsel',imagePrice:0.1005,traits:['Fotogerçekçi','Google kalite','Anlık üretim','Çok dilli','Güvenli içerik'],standoutFeature:'Gemini altyapısı metin-görsel',useCase:'Pazarlama, sosyal medya',style:{brandKey:'google',accent:'#4285f4'}},
  {company:'Recraft',provider:'Recraft',modelName:'Recraft V3',modelId:'recraft-ai/recraft-v3',speedLabel:'~4 sn/görsel',imagePrice:0.06,traits:['Vektör tasarım','Marka kimliği','SVG hassasiyet','Tasarımcı araç','Kurumsal'],standoutFeature:'SVG raster hibrit çıktı',useCase:'Logo, ikon, kimlik',style:{brandKey:'recraft',accent:'#8b5cf6'}},
  {company:'Recraft',provider:'Recraft',modelName:'Recraft 20B',modelId:'recraft-ai/recraft-20b',speedLabel:'~5 sn/görsel',imagePrice:0.06,traits:['20B parametre','Yüksek parametre','Detay derinliği','Profesyonel','Tasarım odaklı'],standoutFeature:'20B parametre sektör büyüklerinden',useCase:'Stüdyo, reklam',style:{brandKey:'recraft',accent:'#8b5cf6'}},
];

function normModel(row, i) {
  try {
    var id = safeStr(row.modelId, 'unknown-'+i);
    var co = safeStr(row.company, '?');
    var sl = safeStr(row.speedLabel, 'Orta');
    var st = (row.style && typeof row.style === 'object') ? row.style : {};
    return {
      id:id, company:co, provider:safeStr(row.provider,co), modelName:safeStr(row.modelName,'ADSIZ'), modelId:id,
      categoryRaw:'Image generation', badges:['GÖRSEL'],
      speedLabel:sl, speedScore:SPEED_MAP[sl]||50,
      imagePrice:nullablePrice(row.imagePrice), inputPrice:null, outputPrice:null,
      traits:Array.isArray(row.traits)?row.traits.map(function(t){return safeStr(t,'');}).filter(Boolean).slice(0,5):[],
      standoutFeature:safeStr(row.standoutFeature,''), useCase:safeStr(row.useCase,''),
      style:{brandKey:safeStr(st.brandKey,'generic'),accent:safeStr(st.accent,'#64748b')},
    };
  } catch (_) {
    return {id:'broken-'+i,company:'?',provider:'?',modelName:'BOZUK',modelId:'broken-'+i,categoryRaw:'Image generation',badges:[],speedLabel:'Orta',speedScore:50,imagePrice:null,inputPrice:null,outputPrice:null,traits:[],standoutFeature:'',useCase:'',style:{brandKey:'generic',accent:'#64748b'}};
  }
}

var MODEL_CATALOG = RAW_MODELS.map(function(r,i){return normModel(r,i);});

function buildModels(request) {
  var url = new URL(request.url);
  var search = safeStr(url.searchParams.get('search'),'').toLowerCase();
  var sort = safeStr(url.searchParams.get('sort'),'image_price_asc');
  if (sort === 'price_asc') sort = 'image_price_asc';
  if (sort === 'price_desc') sort = 'image_price_desc';
  var limit = clampInt(url.searchParams.get('limit'), 1, CATALOG_DEFAULTS.maxLimit, CATALOG_DEFAULTS.limit);
  var offset = clampInt(url.searchParams.get('offset'), 0, 100000, 0);
  var items = MODEL_CATALOG.slice();
  if (search) items = items.filter(function(m){ return [m.company,m.provider,m.modelName,m.modelId].concat(m.traits).some(function(f){return safeStr(f,'').toLowerCase().includes(search);}); });
  items.sort(function(a,b){
    if (sort==='name_asc') return safeStr(a.modelName).localeCompare(safeStr(b.modelName),'tr');
    if (sort==='name_desc') return safeStr(b.modelName).localeCompare(safeStr(a.modelName),'tr');
    if (sort==='image_price_asc') return safeNum(a.imagePrice,1e9)-safeNum(b.imagePrice,1e9);
    if (sort==='image_price_desc') return safeNum(b.imagePrice,-1)-safeNum(a.imagePrice,-1);
    if (sort==='speed_desc') return safeNum(b.speedScore,0)-safeNum(a.speedScore,0);
    return safeStr(a.company+' '+a.modelName).localeCompare(safeStr(b.company+' '+b.modelName),'tr');
  });
  var total = items.length;
  return {items:items.slice(offset,offset+limit),total:total,limit:limit,offset:offset,hasMore:offset+limit<total,feature:'image'};
}

// ──────────────────────────────────────────────────────
// BÖLÜM 7: ROUTE'LAR
// KRİTİK: me her handler'da ctx.me olarak alınıyor
// ──────────────────────────────────────────────────────

router.options('/*page', function(ctx) {
  return new Response(null, { status: 204, headers: corsHeaders(ctx.request) });
});

router.get('/', async function(ctx) {
  var t = nowMs(), rid = createId('info'), trid = createId('t');
  return jsonResp(ctx.request, okEnv(rid, trid, t, 'WORKER_INFO', {
    worker:'idm', version:'7.0.0', totalModels:MODEL_CATALOG.length,
    routes:['GET /','GET /health','GET /models','POST /generate','GET /jobs/status/:id','GET /jobs/history','POST /jobs/cancel'],
  }));
});

router.get('/health', async function(ctx) {
  var request = ctx.request, me = ctx.me;
  var t = nowMs(), rid = createId('h'), trid = createId('t');
  var aiOk = false;
  try { aiOk = !!(me && me.puter && me.puter.ai && typeof me.puter.ai.txt2img === 'function'); } catch (_) {}
  return jsonResp(request, okEnv(rid, trid, t, 'HEALTH_OK', { status:'ok', worker:'idm', version:'7.0.0', totalModels:MODEL_CATALOG.length, aiAvailable:aiOk, meAvailable:!!(me && me.puter), time:nowIso() }));
});

router.get('/models', async function(ctx) {
  var request = ctx.request;
  var t = nowMs(), rid = createId('m'), trid = createId('t');
  try {
    var p = buildModels(request);
    return jsonResp(request, okEnv(rid, trid, t, 'MODELS_OK', p, { returnedItems:p.items.length }), 200, 'public, max-age='+CATALOG_DEFAULTS.cacheSeconds);
  } catch (err) {
    var msg = errMsg(err);
    return jsonResp(request, errEnv(rid, trid, t, 'MODELS_FAILED', msg, ['1) Model kataloğu oluşturulurken hata: '+msg,'2) Model verisi parse edilemedi.','3) Sayfayı yenileyip tekrar deneyin.'], 500), 500);
  }
});

router.post('/generate', async function(ctx) {
  var request = ctx.request;
  var me = ctx.me; // ← Puter worker context — me.puter.ai buradan gelir
  var t = nowMs(), rid = createId('g'), trid = createId('t');
  var jobId = null, reqData = null;

  try {
    // Body parse
    var body = {};
    try { body = await request.json(); }
    catch (_) {
      return jsonResp(request, errEnv(rid, trid, t, 'INVALID_JSON', 'İstek gövdesi JSON formatında değil.', ['1) POST /generate gövdesi JSON parse edilemedi.','2) Content-Type: application/json header ekleyin.','3) Gövdedeki JSON sözdizimini kontrol edin.'], 400), 400);
    }

    // Prompt
    var prompt = safeStr(body && body.prompt, '');
    if (!prompt) {
      return jsonResp(request, errEnv(rid, trid, t, 'PROMPT_REQUIRED', 'Prompt zorunludur.', ['1) Prompt alanı boş — görsel üretmek için metin zorunludur.','2) Sol paneldeki Prompt alanına açıklayıcı metin yazın.','3) Örnek: "Gece yağmurunda neon ışıklı şehir, sinematik"'], 400), 400);
    }

    // Parametreler
    var modelId = safeStr((body.model || body.modelId), IMAGE_DEFAULTS.modelId);
    var quality = safeStr(body.quality, IMAGE_DEFAULTS.quality).toLowerCase();
    if (!ALLOWED_QUALITIES[quality]) quality = IMAGE_DEFAULTS.quality;
    var ratio = safeStr((body.ratio || body.size), IMAGE_DEFAULTS.ratio);
    if (!ALLOWED_RATIOS[ratio]) ratio = IMAGE_DEFAULTS.ratio;

    reqData = { prompt:prompt, model:modelId, modelId:modelId, ratio:ratio, quality:quality, style:safeStr(body.style,''), negativePrompt:safeStr(body.negativePrompt,'') };

    // Job kaydet
    jobId = createId('img');
    await saveJob(me, buildJobRecord(jobId, reqData));
    try { await updateJob(me, jobId, function(j){ return Object.assign({},j,{status:'processing',progress:10,step:'processing'}); }); } catch (_) {}

    // Üret
    var finalUrl = null, genErr = null;
    try { finalUrl = await doGenerate(me, reqData); }
    catch (err) { genErr = err; }

    if (genErr) {
      var em = errMsg(genErr);
      var eb = Array.isArray(genErr.bullets) ? genErr.bullets : ['1) Görsel üretim API hatası: '+em,'2) Model: '+modelId+' — parametre veya provider uyumsuzluğu.','3) GPT Image 1 modelini seçip tekrar deneyin.'];
      try { await updateJob(me, jobId, function(j){ return Object.assign({},j,{status:'failed',progress:100,step:'failed',finishedAt:nowIso(),error:{message:em,retryable:true}}); }); } catch (_) {}
      return jsonResp(request, {
        ok:false, code:safeStr(genErr.code,'GENERATE_FAILED'),
        error:{message:em,bullets:eb,displayDurationMs:5000,retryable:true},
        data:{jobId:jobId,status:'failed',progress:100,step:'failed',modelId:modelId,requestId:rid,outputUrl:null,outputUrls:[],error:{message:em}},
        meta:{feature:'image'}, worker:'idm', version:'7.0.0',
        requestId:rid, traceId:trid, time:nowIso(), durationMs:Math.max(0,nowMs()-t),
      }, 200);
    }

    var urls = finalUrl ? [finalUrl] : [];
    try { await updateJob(me, jobId, function(j){ return Object.assign({},j,{status:'completed',progress:100,step:'completed',finishedAt:nowIso(),retryable:false,outputUrl:urls[0]||null,outputUrls:urls,url:urls[0]||null,urls:urls,error:null}); }); } catch (_) {}

    return jsonResp(request, okEnv(rid, trid, t, 'IMAGE_JOB_COMPLETED', {
      jobId:jobId, status:'completed', progress:100, step:'completed',
      modelId:modelId, requestId:rid,
      outputUrl:urls[0]||null, outputUrls:urls, url:urls[0]||null, urls:urls, error:null,
    }, {feature:'image'}));

  } catch (err) {
    var m2 = errMsg(err);
    var b2 = Array.isArray(err.bullets) ? err.bullets : ['1) /generate beklenmeyen hata: '+m2,'2) Kod: '+safeStr(err.code,'UNEXPECTED'),'3) Promptu ve modeli değiştirip tekrar deneyin.'];
    return jsonResp(request, {
      ok:false, code:safeStr(err.code,'UNEXPECTED_ERROR'),
      error:{message:m2,bullets:b2,displayDurationMs:5000,retryable:true},
      data:jobId?{jobId:jobId,status:'failed',progress:0,step:'failed',modelId:reqData?reqData.modelId:null,requestId:rid,outputUrl:null,outputUrls:[],error:{message:m2}}:null,
      meta:{feature:'image'}, worker:'idm', version:'7.0.0',
      requestId:rid, traceId:trid, time:nowIso(), durationMs:Math.max(0,nowMs()-t),
    }, 500);
  }
});

router.get('/jobs/status/:id', async function(ctx) {
  var request = ctx.request, me = ctx.me, params = ctx.params;
  var t = nowMs(), rid = createId('s'), trid = createId('t');
  try {
    var jobId = safeStr(params && params.id, '');
    if (!jobId) return jsonResp(request, errEnv(rid,trid,t,'JOB_ID_REQUIRED','jobId eksik.',['1) URL\'de :id parametresi bulunamadı.','2) /jobs/status/JOB_ID formatını kontrol edin.','3) Geçerli bir jobId ile tekrar deneyin.'],400),400);
    var job = await readJob(me, jobId);
    if (!job) return jsonResp(request, errEnv(rid,trid,t,'JOB_NOT_FOUND','Job bulunamadı: '+jobId,['1) '+jobId+' ID\'li job KV\'de bulunamadı.','2) Worker yeniden başlatıldığında KV verileri kalıcıdır, ancak eski job silinmiş olabilir.','3) Yeni üretim başlatın.'],404),404);
    return jsonResp(request, okEnv(rid,trid,t,'JOB_STATUS_OK',job,{feature:'image'}));
  } catch (err) {
    var m = errMsg(err);
    return jsonResp(request, errEnv(rid,trid,t,safeStr(err.code,'STATUS_ERROR'),m,['1) /jobs/status hatası: '+m,'2) KV okuma başarısız.','3) Birkaç sn bekleyip tekrar deneyin.'],500),500);
  }
});

router.get('/jobs/history', async function(ctx) {
  var request = ctx.request, me = ctx.me;
  var t = nowMs(), rid = createId('h'), trid = createId('t');
  try {
    var url = new URL(request.url);
    var limit = clampInt(url.searchParams.get('limit'),1,50,20);
    var items = await listJobs(me, limit);
    return jsonResp(request, okEnv(rid,trid,t,'JOB_HISTORY_OK',{items:items,total:items.length,limit:limit,feature:'image'}));
  } catch (err) {
    var m = errMsg(err);
    return jsonResp(request, errEnv(rid,trid,t,safeStr(err.code,'HISTORY_ERROR'),m,['1) /jobs/history hatası: '+m,'2) KV listesi okunamadı.','3) Sayfa yenilendiğinde otomatik güncellenecek.'],500),500);
  }
});

router.post('/jobs/cancel', async function(ctx) {
  var request = ctx.request, me = ctx.me;
  var t = nowMs(), rid = createId('c'), trid = createId('t');
  try {
    var body = {}; try { body = await request.json(); } catch (_) {}
    var jobId = safeStr(body && body.jobId, '');
    if (!jobId) return jsonResp(request, errEnv(rid,trid,t,'JOB_ID_REQUIRED','jobId zorunlu.',['1) İptal isteğinde jobId gövdede bulunamadı.','2) {"jobId":"..."} formatını kontrol edin.','3) jobId boş olmamalı.'],400),400);
    var cur = await readJob(me, jobId);
    if (!cur) return jsonResp(request, errEnv(rid,trid,t,'JOB_NOT_FOUND','İptal edilecek job yok.',['1) '+jobId+' KV\'de bulunamadı.','2) Job zaten tamamlanmış veya silinmiş.','3) Geçmişi yenileyin.'],404),404);
    try { await kvSet(me, cancelKey(jobId), {jobId:jobId,requestedAt:nowIso()}); } catch (_) {}
    var job = await updateJob(me, jobId, function(j){ var p={cancelRequested:true}; if(!TERMINAL[j.status]){p.status='cancelled';p.step='cancelled';p.finishedAt=nowIso();} return Object.assign({},j,p); });
    return jsonResp(request, okEnv(rid,trid,t,'JOB_CANCELLED',job));
  } catch (err) {
    var m = errMsg(err);
    return jsonResp(request, errEnv(rid,trid,t,safeStr(err.code,'CANCEL_ERROR'),m,['1) /jobs/cancel hatası: '+m,'2) KV yazma başarısız.','3) Sayfayı yenileyip tekrar deneyin.'],500),500);
  }
});
