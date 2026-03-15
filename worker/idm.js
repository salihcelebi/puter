/* 
AMAÇ CÜMLELERİ
1) Bu workerın amacı, image.tsx sayfasının ihtiyaç duyduğu tüm görsel üretim uçlarını tek bir endpoint ailesi altında sunmaktır.
2) Bu worker model kataloğunu, görsel üretim isteğini, iş durumu sorgusunu, geçmişi ve iptali aynı sözleşmede birleştirir.
3) Bu workerın temel hedefi, frontend tarafında "Failed to fetch" ve "Worker jobId dönmedi." gibi sözleşme kırıklarını ortadan kaldırmaktır.
4) Bu worker, cross-origin kullanım için güvenli CORS yanıtları üreterek tarayıcı kaynaklı erişim sorunlarını azaltır.
5) Bu worker, image.tsx tarafındaki tek source of truth beklentisine uyacak şekilde /models, /generate, /jobs/status/:id, /jobs/history ve /jobs/cancel uçlarını sağlar.
6) Bu worker, gerçek upstream üretim motoru yoksa bile iş akışını bozmamak için kontrollü placeholder üretim desteği içerir.
7) Bu worker, model kataloğunu frontend'in beklediği alan adlarıyla döndürerek model seçimi ekranının kararlı açılmasını hedefler.
8) Bu worker, jobId tabanlı akışı zorunlu tutarak frontend'in polling mantığını basitleştirir ve tahmin yürütmesini engeller.
9) Bu worker, minimum bağımlılıkla tek dosya halinde çalışacak şekilde yazılmıştır; import zorunluluğu yoktur.
10) Bu worker, Puter hosting tarzı service-worker söz dizimine uygun olacak şekilde addEventListener('fetch', ...) modeliyle çalışır.
*/

/*
IMAGE SÜRECİ AÇIKLAMALARI
1) Görsel süreci POST /generate ile başlar.
2) İstek içinde prompt zorunludur.
3) Model alanı modelId veya model olarak kabul edilir.
4) İstek alındığında önce bir jobId üretilir.
5) Job ilk aşamada queued durumuna alınır.
6) Ardından kısa bir gecikmeyle processing aşamasına geçirilir.
7) Üretim tamamlandığında status completed olur.
8) Tamamlanan işte outputUrl ve outputUrls alanları doldurulur.
9) Placeholder modda çıktı data:image/svg+xml olarak üretilir.
10) Bu yaklaşım frontend'in gerçek resim URL'si bekleyen akışını bozmaz.
11) Üretim sırasında ratio, quality, style, seed, guidance ve adet bilgileri saklanır.
12) Negatif prompt alanı istek içinde korunur.
*/

/*
İŞ DURUMU SÜRECİ AÇIKLAMALARI
1) İş durumu sorgusu GET /jobs/status/:id ile yapılır.
2) Her iş tekil jobId ile tutulur.
3) İş bulunamazsa 404 ve JOB_NOT_FOUND hatası döner.
4) İş bulunduğunda tam job nesnesi döner.
5) İş durumu queued, processing, completed, failed veya canceled olabilir.
6) Frontend polling mantığı yalnızca jobId üzerinden ilerler.
7) completed olduğunda görsel alanları dolu gelir.
8) canceled olduğunda step alanı iptal bilgisini açıkça yazar.
9) Geçmiş listesi GET /jobs/history ile alınır.
10) History en yeni işi başa alacak şekilde sıralanır.
11) İptal işlemi POST /jobs/cancel ile yapılır.
12) İptal isteğinde jobId zorunludur.
*/

/*
MODEL KATALOĞUNU NASIL ÇEKTİĞİ AÇIKLAMALARI
1) Bu sürümde model kataloğu dosya içindeki RAW_MODELS sabitinden çekilir.
2) Böylece import zorunluluğu olmadan tek dosya halinde çalışır.
3) GET /models çağrısı RAW_MODELS listesini filtreleyip döndürür.
4) feature=image parametresi desteklenir.
5) sort=price_asc parametresi desteklenir.
6) limit parametresi üst sınır ile denetlenir.
7) Dönen model nesneleri image.tsx'in beklediği provider, company, modelId ve badges alanlarını içerir.
8) Katalog verisi JSON zarfı içinde data.items olarak döner.
9) total alanı toplam model sayısını belirtir.
10) İleride istenirse bu sabit, aynı sözleşmeyi koruyarak başka kaynaktan beslenebilir.
11) Bu yaklaşım mevcut frontend ile uyum için en düşük riskli çözümdür.
12) Tek dosya mantığı Puter hosting tarafında modül/import belirsizliğini ortadan kaldırır.
*/

const APP_INFO = Object.freeze({
  worker: 'idm.puter.work',
  version: '3.0.0',
  protocolVersion: '2026-03-15',
  purpose: 'IMAGE WORKER',
  mode: 'single-worker',
  billingMode: 'owner_pays',
  sourceType: 'embedded-catalog',
});

const DEFAULTS = Object.freeze({
  limit: 50,
  maxLimit: 250,
  historyLimit: 20,
  maxHistoryLimit: 100,
  cacheSeconds: 60,
  queueDelayMs: 300,
  renderDelayMs: 900,
});

const SPEED_SCORE_MAP = Object.freeze({
  'Rekor Hız': 100,
  'Gerçek zamanlı': 97,
  'Ultra Hızlı': 94,
  'Çok Hızlı': 88,
  'Hızlı': 78,
  'Orta-Hızlı': 68,
  'Orta': 58,
  'Orta/Derin': 52,
  'Derin': 42,
  'Yavaş/Derin': 34,
  'Derin/Yavaş': 30,
  'Ultra Derin': 24,
  '~1 sn/görsel': 92,
  '~3 sn/görsel': 78,
  '~4 sn/görsel': 70,
  '~5 sn/görsel': 62,
  '~6 sn/görsel': 56,
  '~7 sn/görsel': 50,
  '~8 sn/görsel': 44,
});

const RAW_MODELS = [
  {
    company: 'OpenAI',
    provider: 'openai',
    modelName: 'GPT Image 1',
    modelId: 'openai/gpt-image-1',
    categoryRaw: 'image',
    badges: ['IMAGE'],
    parameters: null,
    speedLabel: 'Orta',
    inputPrice: null,
    outputPrice: null,
    imagePrice: null,
    traits: ['Genel amaçlı görsel üretim'],
  },
  {
    company: 'Black Forest Labs',
    provider: 'black-forest-labs',
    modelName: 'FLUX 1 Schnell',
    modelId: 'black-forest-labs/flux-1-schnell',
    categoryRaw: 'image',
    badges: ['IMAGE', 'FAST'],
    parameters: null,
    speedLabel: 'Hızlı',
    inputPrice: null,
    outputPrice: null,
    imagePrice: null,
    traits: ['Hızlı taslak üretim'],
  },
  {
    company: 'Stability',
    provider: 'stability',
    modelName: 'Stable Image Ultra',
    modelId: 'stability/stable-image-ultra',
    categoryRaw: 'image',
    badges: ['IMAGE'],
    parameters: null,
    speedLabel: 'Orta',
    inputPrice: null,
    outputPrice: null,
    imagePrice: null,
    traits: ['Kalite odaklı üretim'],
  },
];

const TERMINAL_STATUSES = new Set(['completed', 'failed', 'canceled']);
const JOBS = new Map();
const HISTORY = [];

addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request, event));
});

async function handleFetch(request, event) {
  if (request.method === 'OPTIONS') {
    return withCors(request, new Response(null, { status: 204 }));
  }

  const ctx = {
    waitUntil(promise) {
      if (event && typeof event.waitUntil === 'function') {
        event.waitUntil(promise);
      }
    },
  };

  try {
    const response = await dispatchRequest(request, {}, ctx);
    return withCors(request, response);
  } catch (error) {
    const startedAt = nowMs();
    const requestId = createId('fatal');
    const traceId = createId('trace');
    const safe = sanitizeError(error);

    return withCors(
      request,
      jsonResponse(
        request,
        errorEnvelope({
          requestId,
          traceId,
          startedAt,
          code: safe.code || 'UNEXPECTED_ERROR',
          message: safe.message || 'BEKLENMEYEN HATA OLUŞTU.',
          status: safe.status || 500,
        }),
        safe.status || 500
      )
    );
  }
}

async function dispatchRequest(request, env, ctx) {
  const url = new URL(request.url);
  const path = normalizePath(url.pathname);

  if (request.method === 'GET' && path === '/') {
    return jsonResponse(
      request,
      {
        ok: true,
        data: {
          worker: 'https://idm.puter.work',
          purpose: APP_INFO.purpose,
          mode: APP_INFO.mode,
          routes: [
            '/models',
            '/generate',
            '/jobs/status/:id',
            '/jobs/history',
            '/jobs/cancel',
          ],
          notes: [
            'Bu sayfa sadece https://idm.puter.work ile konuşur.',
            'Model listeleme, job başlatma, durum takibi, geçmiş ve iptal aynı worker üstünden yürür.',
          ],
        },
        meta: buildMeta(200),
      },
      200
    );
  }

  if (request.method === 'GET' && path === '/health') {
    return jsonResponse(
      request,
      {
        ok: true,
        data: {
          status: 'ok',
          jobsInMemory: JOBS.size,
          historyInMemory: HISTORY.length,
          now: new Date().toISOString(),
        },
        meta: buildMeta(200),
      },
      200
    );
  }

  if (request.method === 'GET' && path === '/models') {
    return handleModels(request);
  }

  if (request.method === 'POST' && path === '/generate') {
    return handleGenerate(request, ctx);
  }

  if (request.method === 'GET' && path.startsWith('/jobs/status/')) {
    const jobId = decodeURIComponent(path.slice('/jobs/status/'.length));
    return handleJobStatus(request, jobId);
  }

  if (request.method === 'GET' && path === '/jobs/history') {
    return handleJobsHistory(request);
  }

  if (request.method === 'POST' && path === '/jobs/cancel') {
    return handleJobsCancel(request);
  }

  return jsonResponse(
    request,
    errorEnvelope({
      requestId: createId('req'),
      traceId: createId('trace'),
      startedAt: nowMs(),
      code: 'ROUTE_NOT_FOUND',
      message: 'Route bulunamadı.',
      status: 404,
    }),
    404
  );
}

function handleModels(request) {
  const url = new URL(request.url);
  const feature = normalizeText(url.searchParams.get('feature'), 'image');
  const sort = normalizeText(url.searchParams.get('sort'));
  const limit = clamp(parseInteger(url.searchParams.get('limit'), DEFAULTS.limit), 1, DEFAULTS.maxLimit);

  let items = RAW_MODELS
    .map(normalizeModelRecord)
    .filter((item) => {
      if (!feature) return true;
      return normalizeText(item.feature, 'image') === feature;
    });

  if (sort === 'price_asc') {
    items = items
      .slice()
      .sort((a, b) => normalizeNumber(a.imagePrice, Number.MAX_SAFE_INTEGER) - normalizeNumber(b.imagePrice, Number.MAX_SAFE_INTEGER));
  }

  return jsonResponse(
    request,
    {
      ok: true,
      data: {
        items: items.slice(0, limit),
        total: items.length,
      },
      meta: buildMeta(200),
    },
    200
  );
}

async function handleGenerate(request, ctx) {
  const payload = await readJsonBody(request);

  const prompt = normalizeText(payload.prompt);
  const modelId = normalizeText(payload.modelId || payload.model);
  const provider = normalizeText(payload.provider) || modelId.split('/')[0] || 'unknown';

  if (!prompt) {
    return jsonResponse(
      request,
      errorEnvelope({
        requestId: createId('req'),
        traceId: createId('trace'),
        startedAt: nowMs(),
        code: 'PROMPT_REQUIRED',
        message: 'Prompt zorunludur.',
        status: 400,
      }),
      400
    );
  }

  if (!modelId) {
    return jsonResponse(
      request,
      errorEnvelope({
        requestId: createId('req'),
        traceId: createId('trace'),
        startedAt: nowMs(),
        code: 'MODEL_REQUIRED',
        message: 'Model seçimi zorunludur.',
        status: 400,
      }),
      400
    );
  }

  const createdAt = new Date().toISOString();
  const jobId = createId('job');

  const job = {
    jobId,
    status: 'queued',
    progress: 5,
    step: 'İş kuyruğa alındı',
    createdAt,
    updatedAt: createdAt,
    provider,
    modelId,
    model: modelId,
    prompt,
    negativePrompt: normalizeText(payload.negativePrompt),
    ratio: normalizeText(payload.ratio, '1:1'),
    quality: normalizeText(payload.quality, 'medium'),
    style: normalizeText(payload.style),
    n: clamp(parseInteger(payload.n, 1), 1, 4),
    guidance: payload.guidance == null ? null : normalizeNumber(payload.guidance, null),
    seed: payload.seed == null ? null : parseInteger(payload.seed, null),
    outputUrl: null,
    outputUrls: [],
  };

  upsertJob(job);
  ctx.waitUntil(runGeneration(jobId));

  return jsonResponse(
    request,
    {
      ok: true,
      data: {
        jobId: job.jobId,
        status: job.status,
        progress: job.progress,
        step: job.step,
        outputUrl: job.outputUrl,
        outputUrls: job.outputUrls,
      },
      meta: buildMeta(202),
    },
    202
  );
}

function handleJobStatus(request, jobId) {
  const job = JOBS.get(jobId);

  if (!job) {
    return jsonResponse(
      request,
      errorEnvelope({
        requestId: createId('req'),
        traceId: createId('trace'),
        startedAt: nowMs(),
        code: 'JOB_NOT_FOUND',
        message: 'Job bulunamadı.',
        status: 404,
      }),
      404
    );
  }

  return jsonResponse(
    request,
    {
      ok: true,
      data: clone(job),
      meta: buildMeta(200),
    },
    200
  );
}

function handleJobsHistory(request) {
  const url = new URL(request.url);
  const limit = clamp(parseInteger(url.searchParams.get('limit'), DEFAULTS.historyLimit), 1, DEFAULTS.maxHistoryLimit);

  return jsonResponse(
    request,
    {
      ok: true,
      data: {
        items: HISTORY.slice(0, limit).map(clone),
        total: HISTORY.length,
      },
      meta: buildMeta(200),
    },
    200
  );
}

async function handleJobsCancel(request) {
  const payload = await readJsonBody(request);
  const jobId = normalizeText(payload.jobId);

  if (!jobId) {
    return jsonResponse(
      request,
      errorEnvelope({
        requestId: createId('req'),
        traceId: createId('trace'),
        startedAt: nowMs(),
        code: 'JOB_ID_REQUIRED',
        message: 'jobId zorunludur.',
        status: 400,
      }),
      400
    );
  }

  const job = JOBS.get(jobId);

  if (!job) {
    return jsonResponse(
      request,
      errorEnvelope({
        requestId: createId('req'),
        traceId: createId('trace'),
        startedAt: nowMs(),
        code: 'JOB_NOT_FOUND',
        message: 'Job bulunamadı.',
        status: 404,
      }),
      404
    );
  }

  if (!TERMINAL_STATUSES.has(normalizeText(job.status))) {
    job.status = 'canceled';
    job.step = 'İş kullanıcı tarafından iptal edildi';
    job.updatedAt = new Date().toISOString();
    upsertJob(job);
  }

  return jsonResponse(
    request,
    {
      ok: true,
      data: clone(job),
      meta: buildMeta(200),
    },
    200
  );
}

async function runGeneration(jobId) {
  await sleep(DEFAULTS.queueDelayMs);

  const queued = JOBS.get(jobId);
  if (!queued || normalizeText(queued.status) === 'canceled') return;

  queued.status = 'processing';
  queued.progress = 45;
  queued.step = 'Görsel hazırlanıyor';
  queued.updatedAt = new Date().toISOString();
  upsertJob(queued);

  await sleep(DEFAULTS.renderDelayMs);

  const processing = JOBS.get(jobId);
  if (!processing || normalizeText(processing.status) === 'canceled') return;

  const outputs = [];
  for (let index = 0; index < clamp(parseInteger(processing.n, 1), 1, 4); index += 1) {
    outputs.push(
      buildSvgDataUrl({
        prompt: processing.prompt,
        style: processing.style,
        modelId: processing.modelId,
        ratio: processing.ratio,
        jobId: processing.jobId,
        index: index + 1,
      })
    );
  }

  processing.status = 'completed';
  processing.progress = 100;
  processing.step = 'Üretim tamamlandı';
  processing.outputUrl = outputs[0] || null;
  processing.outputUrls = outputs;
  processing.updatedAt = new Date().toISOString();
  upsertJob(processing);
}

function normalizeModelRecord(model) {
  const feature = inferFeature(model.categoryRaw);
  const speedScore = normalizeNumber(SPEED_SCORE_MAP[normalizeText(model.speedLabel)], null);

  return {
    company: normalizeText(model.company),
    provider: normalizeText(model.provider) || normalizeText(model.company).toLowerCase(),
    modelName: normalizeText(model.modelName),
    modelId: normalizeText(model.modelId),
    categoryRaw: normalizeText(model.categoryRaw),
    feature,
    badges: Array.isArray(model.badges) ? model.badges : [],
    parameters: model.parameters ?? null,
    speedLabel: normalizeText(model.speedLabel, 'Bilinmiyor'),
    speedScore,
    inputPrice: normalizeNumber(model.inputPrice, null),
    outputPrice: normalizeNumber(model.outputPrice, null),
    imagePrice: normalizeNumber(model.imagePrice, null),
    traits: Array.isArray(model.traits) ? model.traits : [],
  };
}

function inferFeature(categoryRaw) {
  const raw = normalizeText(categoryRaw).toLowerCase();
  if (raw.includes('image')) return 'image';
  if (raw.includes('video')) return 'video';
  if (raw.includes('audio')) return 'audio';
  return 'text';
}

function errorEnvelope(input) {
  return {
    ok: false,
    error: {
      code: normalizeText(input.code, 'UNEXPECTED_ERROR'),
      message: normalizeText(input.message, 'Beklenmeyen hata oluştu.'),
      status: clamp(parseInteger(input.status, 500), 100, 599),
    },
    meta: {
      requestId: normalizeText(input.requestId),
      traceId: normalizeText(input.traceId),
      startedAt: input.startedAt,
      now: new Date().toISOString(),
      worker: APP_INFO.worker,
      version: APP_INFO.version,
    },
  };
}

function jsonResponse(request, payload, status) {
  return new Response(JSON.stringify(payload, null, 2), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

function buildMeta(status) {
  return {
    status,
    worker: APP_INFO.worker,
    version: APP_INFO.version,
    now: new Date().toISOString(),
  };
}

function withCors(request, response) {
  const headers = new Headers(response.headers || {});
  const cors = buildCorsHeaders(request);
  cors.forEach((value, key) => headers.set(key, value));

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

function buildCorsHeaders(request) {
  const origin = request.headers.get('Origin') || '*';
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Credentials', 'true');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Accept, Content-Type, Authorization, X-Requested-With');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return headers;
}

async function readJsonBody(request) {
  const text = await request.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    const error = new Error('JSON gövdesi çözülemedi.');
    error.code = 'INVALID_JSON';
    error.status = 400;
    throw error;
  }
}

function sanitizeError(error) {
  if (error && typeof error === 'object') {
    return {
      code: normalizeText(error.code, 'UNEXPECTED_ERROR'),
      message: normalizeText(error.message, 'Beklenmeyen hata oluştu.'),
      status: clamp(parseInteger(error.status, 500), 100, 599),
    };
  }

  return {
    code: 'UNEXPECTED_ERROR',
    message: 'Beklenmeyen hata oluştu.',
    status: 500,
  };
}

function normalizePath(pathname) {
  const value = normalizeText(pathname, '/');
  if (value.length > 1 && value.endsWith('/')) {
    return value.slice(0, -1);
  }
  return value;
}

function upsertJob(job) {
  const cloned = clone(job);
  JOBS.set(cloned.jobId, cloned);

  const existingIndex = HISTORY.findIndex((item) => item.jobId === cloned.jobId);
  if (existingIndex >= 0) {
    HISTORY.splice(existingIndex, 1);
  }
  HISTORY.unshift(cloned);

  if (HISTORY.length > DEFAULTS.maxHistoryLimit) {
    HISTORY.length = DEFAULTS.maxHistoryLimit;
  }
}

function buildSvgDataUrl(input) {
  const safePrompt = escapeXml(input.prompt || '');
  const safeStyle = escapeXml(input.style || '-');
  const safeModelId = escapeXml(input.modelId || '-');
  const safeRatio = escapeXml(input.ratio || '1:1');
  const safeJobId = escapeXml(input.jobId || '-');
  const safeIndex = escapeXml(String(input.index || 1));

  const svg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" x2="1" y1="0" y2="1">
      <stop offset="0%" stop-color="#111827"/>
      <stop offset="50%" stop-color="#1f2937"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#g)"/>
  <rect x="48" y="48" width="928" height="928" rx="28" fill="none" stroke="#22d3ee" stroke-width="4"/>
  <text x="80" y="140" fill="#e5e7eb" font-size="42" font-family="Arial, sans-serif">AI IMAGE PLACEHOLDER</text>
  <text x="80" y="220" fill="#93c5fd" font-size="28" font-family="Arial, sans-serif">PROMPT</text>
  <foreignObject x="80" y="240" width="864" height="260">
    <div xmlns="http://www.w3.org/1999/xhtml" style="color:#f9fafb;font-family:Arial,sans-serif;font-size:30px;line-height:1.35;word-break:break-word;">
      ${safePrompt}
    </div>
  </foreignObject>
  <text x="80" y="590" fill="#93c5fd" font-size="28" font-family="Arial, sans-serif">MODEL</text>
  <text x="80" y="632" fill="#f9fafb" font-size="28" font-family="Arial, sans-serif">${safeModelId}</text>
  <text x="80" y="700" fill="#93c5fd" font-size="28" font-family="Arial, sans-serif">STYLE</text>
  <text x="80" y="742" fill="#f9fafb" font-size="28" font-family="Arial, sans-serif">${safeStyle}</text>
  <text x="80" y="810" fill="#93c5fd" font-size="28" font-family="Arial, sans-serif">RATIO</text>
  <text x="80" y="852" fill="#f9fafb" font-size="28" font-family="Arial, sans-serif">${safeRatio}</text>
  <text x="80" y="920" fill="#93c5fd" font-size="28" font-family="Arial, sans-serif">JOB</text>
  <text x="80" y="962" fill="#f9fafb" font-size="22" font-family="Arial, sans-serif">${safeJobId} · ${safeIndex}</text>
</svg>`.trim();

  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}

function createId(prefix) {
  const randomPart = Math.random().toString(36).slice(2, 10);
  const timePart = Date.now().toString(36);
  return `${prefix}_${timePart}_${randomPart}`;
}

function nowMs() {
  return Date.now();
}

function normalizeText(value, fallback = '') {
  if (typeof value === 'string') return value.trim();
  if (value == null) return fallback;
  return String(value).trim();
}

function normalizeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function parseInteger(value, fallback) {
  const num = Number.parseInt(String(value), 10);
  return Number.isFinite(num) ? num : fallback;
}

function clamp(value, min, max) {
  const num = Number(value);
  if (!Number.isFinite(num)) return min;
  return Math.max(min, Math.min(max, num));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function escapeXml(input) {
  return String(input)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
