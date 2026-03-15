

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
/*
DOSYA: models-worker.js
AMAÇ: EXCEL'DEN ÜRETİLMİŞ MODEL KATALOĞUNU GÜVENLİ JSON API OLARAK SUNMAK.
NOT: BU WORKER TEK GÖREVLİDİR; SADECE MODEL KATALOĞU SERVİSİ VERİR.
NOT: VERİLER /mnt/data/ai-model-catalog.xlsx DOSYASINDAN ÇIKARILMIŞ SNAPSHOT'TIR.
NOT: PREMIUM FİYATLAR GÖSTERİLİR; 1.5X BİLGİSİ RESPONSE İÇİNDE YAZDIRILMAZ.
*/
/*
DOSYA: idm.js
AMAÇ: MODEL KATALOĞU + IMAGE GENERATION + JOB YÖNETİMİ
*/

// ─────────────────── YARDIMCI ARAÇLAR ───────────────────

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function createId(prefix = 'req') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function safeString(value, fallback = '') {
  try {
    if (value === undefined || value === null) return fallback;
    const text = String(value).trim();
    return text || fallback;
  } catch {
    return fallback;
  }
}

function safeNumber(value, fallback = 0) {
  try {
    if (value === undefined || value === null || value === '') return fallback;
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function normalizeNullablePrice(value) {
  try {
    if (value === undefined || value === null || value === '') return null;
    const n = Number(value);
    return Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

function toPositiveInteger(value, fallback) {
  try {
    const n = Number(value);
    return Number.isInteger(n) && n > 0 ? n : fallback;
  } catch {
    return fallback;
  }
}

function clampLimit(value) {
  const parsed = toPositiveInteger(value, DEFAULTS.limit);
  return Math.min(parsed, DEFAULTS.maxLimit);
}

function clampOffset(value) {
  try {
    const n = Number(value);
    if (!Number.isFinite(n) || n < 0) return 0;
    return Math.floor(n);
  } catch {
    return 0;
  }
}

function sanitizeError(error) {
  try {
    const code = safeString(error?.code, 'UNEXPECTED_ERROR');
    const message = safeString(error?.message, 'BEKLENMEYEN HATA OLUŞTU.');
    return { code, message };
  } catch {
    return { code: 'UNEXPECTED_ERROR', message: 'BEKLENMEYEN HATA OLUŞTU.' };
  }
}

// ─────────────────── CORS / HEADER / JSON ───────────────────

function buildCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*';
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-credentials': 'true',
    vary: 'origin',
  };
}

function buildJsonHeaders(request, extra = {}) {
  const cacheControl = extra['cache-control'] || extra['Cache-Control'] || 'no-store';
  return {
    ...buildCorsHeaders(request),
    'content-type': 'application/json; charset=utf-8',
    'cache-control': cacheControl,
    ...extra,
  };
}

function jsonResponse(request, body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: buildJsonHeaders(request, extra),
  });
}

function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}

// ─────────────────── ENVELOPE ───────────────────

const APP_INFO = Object.freeze({
  worker: 'idm',
  version: '2.0.0',
  protocolVersion: '2026-03-15',
  purpose: 'MODEL CATALOG + IMAGE GENERATION API',
  billingMode: 'owner_pays',
  sourceType: 'excel-snapshot',
  supportsCatalog: true,
  supportsImageGeneration: true,
  supportsJobs: true,
});

function createEnvelopeBase(requestId, traceId, startedAt) {
  return {
    worker: APP_INFO.worker,
    version: APP_INFO.version,
    protocolVersion: APP_INFO.protocolVersion,
    billingMode: APP_INFO.billingMode,
    requestId,
    traceId,
    time: nowIso(),
    durationMs: Math.max(0, nowMs() - startedAt),
  };
}

function successEnvelope({ requestId, traceId, startedAt, code = 'OK', data = null, meta = null }) {
  return {
    ok: true,
    code,
    error: null,
    data,
    meta,
    ...createEnvelopeBase(requestId, traceId, startedAt),
  };
}

function errorEnvelope({ requestId, traceId, startedAt, code, message, details = null, status = 400 }) {
  return {
    ok: false,
    code,
    error: {
      type: 'idm.error',
      message,
      details,
      retryable: false,
    },
    data: null,
    meta: null,
    status,
    ...createEnvelopeBase(requestId, traceId, startedAt),
  };
}

// ─────────────────── MODEL KATALOĞU SABİTLERİ ───────────────────

const DEFAULTS = Object.freeze({
  limit: 50,
  maxLimit: 250,
  cacheSeconds: 300,
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
    "company": "Amazon",
    "provider": "Amazon",
    "modelName": "Nova 2 Lite",
    "modelId": "amazon/nova-2-lite-v1",
    "categoryRaw": "LLM / multimodal",
    "badges": ["MULTIMODAL"],
    "parameters": "~12B",
    "speedLabel": "Çok Hızlı",
    "inputPrice": 0.45,
    "outputPrice": 3.75,
    "imagePrice": null,
    "traits": ["2. nesil AWS zekası","Nova ailesinin güncel üyesi","Kurumsal multimodal","Gelişmiş AWS entegrasyonu","Ölçeklenebilir bulut AI"],
    "standoutFeature": "Nova 1'e göre kapsamlı mimari güncellemesi",
    "useCase": "AWS kurumsal AI, yüksek hacim cloud deploy",
    "rivalAdvantage": "Amazon ekosistemine entegrasyonda Bedrock'un en iyi seçeneği",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "amazon","accent": "#ff9900"}
  },
  {
    "company": "Amazon",
    "provider": "Amazon",
    "modelName": "Nova Lite 1.0",
    "modelId": "amazon/nova-lite-v1",
    "categoryRaw": "LLM / multimodal",
    "badges": ["MULTIMODAL"],
    "parameters": "~7B",
    "speedLabel": "Ultra Hızlı",
    "inputPrice": 0.09,
    "outputPrice": 0.36,
    "imagePrice": null,
    "traits": ["AWS ekosistemine native","Bedrock altyapı güvencesi","Kurumsal güvenilirlik","Hızlı multimodal erişim","Bulut entegre zeka"],
    "standoutFeature": "AWS Bedrock native — S3, Lambda, SageMaker entegrasyonu",
    "useCase": "AWS tabanlı AI pipeline, bulut kurumsal uygulamalar",
    "rivalAdvantage": "AWS servisleriyle native entegrasyonda rakipsiz",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "amazon","accent": "#ff9900"}
  },
  {
    "company": "BFL",
    "provider": "BFL",
    "modelName": "Flux Dev",
    "modelId": "bfl/flux-dev",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "12B diffusion",
    "speedLabel": "~4 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.0375,
    "traits": ["Geliştirici öncelikli erişim","Fine-tuning altyapısı","Açık araştırma lisansı","Prototip kalite standardı","Topluluk ekosistemi"],
    "standoutFeature": "Geliştirici ve araştırmacı lisansı ile tam Pro kalite",
    "useCase": "Model fine-tuning, araştırma, uygulama prototipi",
    "rivalAdvantage": "Pro kalitesinde geliştirici dostu fiyat ve lisans",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "bfl","accent": "#ef4444"}
  },
  {
    "company": "BFL",
    "provider": "BFL",
    "modelName": "Flux Pro",
    "modelId": "bfl/flux-pro",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "12B Pro diffusion",
    "speedLabel": "~4 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.075,
    "traits": ["Profesyonel üretim standardı","Fotogerçekçi çıktı","Detay ve kompozisyon dengesi","Yaratıcı direktör onaylı","Güvenilir üretim modeli"],
    "standoutFeature": "FLUX Pro — ticari üretim için standart model",
    "useCase": "İçerik ajansı, e-ticaret, pazarlama görseli",
    "rivalAdvantage": "DALL-E 3'e kıyasla renk ve kompozisyon üstünlüğü",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "bfl","accent": "#ef4444"}
  },
  {
    "company": "BFL",
    "provider": "BFL",
    "modelName": "Flux Pro 1.1 Ultra",
    "modelId": "bfl/flux-pro-1.1-ultra",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "Ultra diffusion",
    "speedLabel": "~6 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.09,
    "traits": ["BFL amiral gemisi kalite","Ultra çözünürlük kapasitesi","Fotogerçekçilik zirvesi","Profesyonel baskı standardı","Premium üretim kalitesi"],
    "standoutFeature": "BFL'nin en yüksek kaliteli production modeli",
    "useCase": "Ticari baskı, reklam kampanyası, billboard",
    "rivalAdvantage": "Adobe Firefly'a karşı maliyet-kalite oranı üstün",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "bfl","accent": "#ef4444"}
  },
  {
    "company": "BFL",
    "provider": "BFL",
    "modelName": "Flux Schnell",
    "modelId": "bfl/flux-schnell",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "12B distilled",
    "speedLabel": "~1 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.0045,
    "traits": ["Yıldırım hızı üretim","Toplu işlem şampiyonu","Minimum gecikme","Distilasyon mucizesi","Ölçek için tasarlandı"],
    "standoutFeature": "Apache 2.0 lisanslı en hızlı açık diffusion modeli",
    "useCase": "Toplu görsel üretim, A/B testi, anlık önizleme",
    "rivalAdvantage": "Lisans ve hız kategorisinde Flux Schnell mutlak lider",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "bfl","accent": "#ef4444"}
  },
  {
    "company": "Black Forest Labs",
    "provider": "Black Forest Labs",
    "modelName": "Flux 1 Dev",
    "modelId": "black-forest-labs/flux-1-dev",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "12B diffusion",
    "speedLabel": "~5 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.0375,
    "traits": ["Geliştirici kitlesi için pro kalite","Ticari kullanım uyumlu","Fine-tuning dostu","Açık araştırma modeli","Topluluk onaylı"],
    "standoutFeature": "Flux 1 Pro kalitesi — geliştirici lisansı ile",
    "useCase": "Uygulama geliştirme, prototipler, özel fine-tune",
    "rivalAdvantage": "Pro'ya yakın kalite %37 daha düşük maliyetle",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "black-forest-labs","accent": "#ef4444"}
  },
  {
    "company": "Black Forest Labs",
    "provider": "Black Forest Labs",
    "modelName": "Flux 1 Schnell",
    "modelId": "black-forest-labs/flux-1-schnell",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "12B distilled",
    "speedLabel": "~1 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.0045,
    "traits": ["Alman hız mühendisliği","Saniyenin altında üretim","Maliyet minimize uzmanı","Yüksek hacim makinesi","Distilled verimlilik"],
    "standoutFeature": "Distilled model — 4 adımlı üretim, 1 saniyenin altında",
    "useCase": "Gerçek zamanlı önizleme, yüksek hacim thumbnail",
    "rivalAdvantage": "Kategorisinde en hızlı ve en ucuz profesyonel diffusion",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "black-forest-labs","accent": "#ef4444"}
  },
  {
    "company": "Black Forest Labs",
    "provider": "Black Forest Labs",
    "modelName": "Flux 1.1 Pro",
    "modelId": "black-forest-labs/flux-1.1-pro",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "12B diffusion",
    "speedLabel": "~4 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.06,
    "traits": ["Profesyonel görsel kalite","Detay sadakati zirvesi","Fotogerçekçilik uzmanı","Yaratıcı direktöre uygun","Sektör onaylı çıktı"],
    "standoutFeature": "FLUX mimarisi — stable diffusion ötesi kalite",
    "useCase": "Ticari görselleştirme, reklam, ürün fotoğrafı",
    "rivalAdvantage": "DALL-E 3 ve Midjourney'e karşı detay doğruluğu üstün",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "black-forest-labs","accent": "#ef4444"}
  },
  {
    "company": "Black Forest Labs",
    "provider": "Black Forest Labs",
    "modelName": "Flux 1.1 Pro Ultra",
    "modelId": "black-forest-labs/flux-1.1-pro-ultra",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "12B diffusion Ultra",
    "speedLabel": "~6 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.09,
    "traits": ["Ultra yüksek çözünürlük","Maksimum detay yoğunluğu","Baskı hazır kalite","Sanatsal mükemmellik","Ultra gerçekçi doku"],
    "standoutFeature": "4K+ çözünürlük desteği — en yüksek kalite modu",
    "useCase": "Baskı medyası, billboard, stüdyo kalitesi içerik",
    "rivalAdvantage": "Midjourney v6.1 Ultra'ya karşı maliyet-kalite oranı",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "black-forest-labs","accent": "#ef4444"}
  },
  {
    "company": "Black Forest Labs",
    "provider": "Black Forest Labs",
    "modelName": "Flux Kontext Max",
    "modelId": "black-forest-labs/flux-kontext-max",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "Kontext diffusion",
    "speedLabel": "~7 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.12,
    "traits": ["Bağlamsal görsel zeka","Referans görsel anlama","Tutarlı stil transferi","Çoklu referans füzyonu","Yaratıcı kontrol zirvesi"],
    "standoutFeature": "Referans görsel ile stil tutarlılığı — sektörde ilk",
    "useCase": "Marka kimliği, ürün varyasyonları, karakter tutarlılığı",
    "rivalAdvantage": "IP-Adapter ve ControlNet'e kıyasla çok daha kolay kullanım",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "black-forest-labs","accent": "#ef4444"}
  },
  {
    "company": "Black Forest Labs",
    "provider": "Black Forest Labs",
    "modelName": "Flux Kontext Pro",
    "modelId": "black-forest-labs/flux-kontext-pro",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "Kontext diffusion Pro",
    "speedLabel": "~5 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.06,
    "traits": ["Pro düzey bağlam anlama","Stil tutarlılığı","Gelişmiş kompozisyon","Uygun fiyatlı Kontext","Marka uyumlu üretim"],
    "standoutFeature": "Kontext Max'ın %50 düşük maliyetli versiyonu",
    "useCase": "İçerik kanalları, sosyal medya şablonları",
    "rivalAdvantage": "Fiyata göre Kontext özelliklerinde maksimum değer",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "black-forest-labs","accent": "#ef4444"}
  },
  {
    "company": "Google",
    "provider": "Google",
    "modelName": "Gemini 3.1 Flash Image",
    "modelId": "google/gemini-3.1-flash-image-preview",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "Diffusion",
    "speedLabel": "~3 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.1005,
    "traits": ["Fotogerçekçi detay","Google mağazası kalitesi","Anlık görsel üretim","Çok dilli prompt desteği","Güvenli içerik filtreleme"],
    "standoutFeature": "Gemini altyapısıyla metin-görsel entegrasyonu",
    "useCase": "Pazarlama görselleri, sosyal medya, e-ticaret",
    "rivalAdvantage": "DALL-E 3'e göre %30 daha hızlı üretim",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "google","accent": "#4285f4"}
  },
  {
    "company": "OpenAI",
    "provider": "OpenAI",
    "modelName": "GPT Image 1",
    "modelId": "openai/gpt-image-1",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "Özel diffusion",
    "speedLabel": "~8 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.0165,
    "traits": ["LLM bağlamlı görsel üretim","Metin anlama üstünlüğü","Prompt sadakati lideri","OpenAI kalite damgası","Native ChatGPT entegrasyonu"],
    "standoutFeature": "GPT'nin metin anlayışı ile görsel üretim füzyonu",
    "useCase": "ChatGPT entegrasyonu, metin-görsel içerik, eğitim",
    "rivalAdvantage": "Prompt takibi doğruluğunda DALL-E 3'ün üstünde",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "openai","accent": "#10a37f"}
  },
  {
    "company": "Recraft",
    "provider": "Recraft",
    "modelName": "Recraft 20B",
    "modelId": "recraft-ai/recraft-20b",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "20B diffusion",
    "speedLabel": "~5 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.06,
    "traits": ["20 milyar parametre görsel güç","Yüksek parametreli yaratıcılık","Detay derinliği uzmanı","Profesyonel görsel standart","Tasarım odaklı AI"],
    "standoutFeature": "20B parametre ile görsel sektörünün en büyük modellerinden",
    "useCase": "Profesyonel yaratıcı stüdyo, reklam, illustrasyon",
    "rivalAdvantage": "Parametre başına görsel kalitede sektör rekoru",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "recraft","accent": "#8b5cf6"}
  },
  {
    "company": "Recraft",
    "provider": "Recraft",
    "modelName": "Recraft V3",
    "modelId": "recraft-ai/recraft-v3",
    "categoryRaw": "Image generation",
    "badges": ["GÖRSEL"],
    "parameters": "Özel vektör+raster",
    "speedLabel": "~4 sn/görsel",
    "inputPrice": null,
    "outputPrice": null,
    "imagePrice": 0.06,
    "traits": ["Vektör tasarım öncüsü","Marka kimliği uyumlu","SVG düzeyinde hassasiyet","Tasarımcı araç seti","Kurumsal görsel standart"],
    "standoutFeature": "SVG + raster hibrit çıktı — tasarımcı için optimize",
    "useCase": "Logo, ikon, kurumsal kimlik, UI asset üretimi",
    "rivalAdvantage": "Midjourney'e karşı vektör çıktı ve logo üretiminde üstün",
    "sourceUrl": "https://developer.puter.com/ai/models/",
    "style": {"brandKey": "recraft","accent": "#8b5cf6"}
  }
];

// ─────────────────── MODEL KATALOĞU FONKSİYONLARI ───────────────────

function deriveSpeedScore(label) {
  const text = safeString(label);
  if (Object.prototype.hasOwnProperty.call(SPEED_SCORE_MAP, text)) {
    return SPEED_SCORE_MAP[text];
  }
  return 50;
}

function normalizeBadges(badges) {
  try {
    const source = Array.isArray(badges) ? badges : [];
    const unique = [];
    for (const badge of source) {
      const clean = safeString(badge).toUpperCase();
      if (clean && !unique.includes(clean)) unique.push(clean);
    }
    return unique;
  } catch {
    return [];
  }
}

function normalizeModel(row, index) {
  try {
    const company = safeString(row.company, 'BİLİNMİYOR');
    const modelName = safeString(row.modelName, 'ADSIZ MODEL');
    const modelId = safeString(row.modelId, `unknown-model-${index + 1}`);
    const provider = safeString(row.provider, company);
    const categoryRaw = safeString(row.categoryRaw, 'GENEL');
    const badges = normalizeBadges(row.badges);
    const parameters = safeString(row.parameters, '-');
    const speedLabel = safeString(row.speedLabel, 'Orta');
    const inputPrice = normalizeNullablePrice(row.inputPrice);
    const outputPrice = normalizeNullablePrice(row.outputPrice);
    const imagePrice = normalizeNullablePrice(row.imagePrice);
    const traits = Array.isArray(row.traits)
      ? row.traits.map((item) => safeString(item)).filter(Boolean).slice(0, 5)
      : [];
    const standoutFeature = safeString(row.standoutFeature);
    const useCase = safeString(row.useCase);
    const rivalAdvantage = safeString(row.rivalAdvantage);
    const sourceUrl = safeString(row.sourceUrl);
    const style = row && typeof row.style === 'object' && row.style ? row.style : {};

    return Object.freeze({
      id: modelId,
      company,
      provider,
      modelName,
      modelId,
      categoryRaw,
      badges,
      parameters,
      speedLabel,
      speedScore: deriveSpeedScore(speedLabel),
      prices: Object.freeze({
        input: inputPrice,
        output: outputPrice,
        image: imagePrice,
      }),
      traits: Object.freeze(traits),
      standoutFeature,
      useCase,
      rivalAdvantage,
      sourceUrl,
      style: Object.freeze({
        brandKey: safeString(style.brandKey, 'generic'),
        accent: safeString(style.accent, '#64748b'),
      }),
    });
  } catch {
    return Object.freeze({
      id: `broken-model-${index + 1}`,
      company: 'BİLİNMİYOR',
      provider: 'BİLİNMİYOR',
      modelName: 'BOZUK KAYIT',
      modelId: `broken-model-${index + 1}`,
      categoryRaw: 'GENEL',
      badges: Object.freeze(['GENEL']),
      parameters: '-',
      speedLabel: 'Orta',
      speedScore: 50,
      prices: Object.freeze({ input: null, output: null, image: null }),
      traits: Object.freeze([]),
      standoutFeature: '',
      useCase: '',
      rivalAdvantage: '',
      sourceUrl: '',
      style: Object.freeze({ brandKey: 'generic', accent: '#64748b' }),
    });
  }
}

const MODEL_CATALOG = Object.freeze(RAW_MODELS.map((row, index) => normalizeModel(row, index)));

function uniqueSortedStrings(values) {
  return [...new Set(values.map((item) => safeString(item)).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'tr'));
}

const MODEL_FACETS = Object.freeze({
  companies: Object.freeze(uniqueSortedStrings(MODEL_CATALOG.map((item) => item.company))),
  badges: Object.freeze(uniqueSortedStrings(MODEL_CATALOG.flatMap((item) => item.badges))),
  categories: Object.freeze(uniqueSortedStrings(MODEL_CATALOG.map((item) => item.categoryRaw))),
});

function queryContains(haystack, needle) {
  return safeString(haystack).toLocaleLowerCase('tr').includes(safeString(needle).toLocaleLowerCase('tr'));
}

function matchesSearch(item, search) {
  if (!safeString(search)) return true;
  const bag = [
    item.company, item.provider, item.modelName, item.modelId, item.categoryRaw,
    ...item.badges, ...item.traits, item.standoutFeature, item.useCase, item.rivalAdvantage,
  ];
  return bag.some((part) => queryContains(part, search));
}

function matchesCompany(item, company) {
  if (!safeString(company)) return true;
  return safeString(item.company).toLocaleLowerCase('tr') === safeString(company).toLocaleLowerCase('tr');
}

function matchesBadge(item, badge) {
  if (!safeString(badge)) return true;
  return item.badges.includes(safeString(badge).toUpperCase());
}

function matchesCategory(item, category) {
  if (!safeString(category)) return true;
  return safeString(item.categoryRaw).toLocaleLowerCase('tr') === safeString(category).toLocaleLowerCase('tr');
}

function sortModels(items, sortKey) {
  const cloned = [...items];
  switch (safeString(sortKey)) {
    case 'name_asc': return cloned.sort((a, b) => a.modelName.localeCompare(b.modelName, 'tr'));
    case 'name_desc': return cloned.sort((a, b) => b.modelName.localeCompare(a.modelName, 'tr'));
    case 'company_asc': return cloned.sort((a, b) => `${a.company} ${a.modelName}`.localeCompare(`${b.company} ${b.modelName}`, 'tr'));
    case 'company_desc': return cloned.sort((a, b) => `${b.company} ${b.modelName}`.localeCompare(`${a.company} ${a.modelName}`, 'tr'));
    case 'input_price_asc': return cloned.sort((a, b) => safeNumber(a.prices.input, Number.MAX_SAFE_INTEGER) - safeNumber(b.prices.input, Number.MAX_SAFE_INTEGER));
    case 'input_price_desc': return cloned.sort((a, b) => safeNumber(b.prices.input, -1) - safeNumber(a.prices.input, -1));
    case 'output_price_asc': return cloned.sort((a, b) => safeNumber(a.prices.output, Number.MAX_SAFE_INTEGER) - safeNumber(b.prices.output, Number.MAX_SAFE_INTEGER));
    case 'output_price_desc': return cloned.sort((a, b) => safeNumber(b.prices.output, -1) - safeNumber(a.prices.output, -1));
    case 'image_price_asc': return cloned.sort((a, b) => safeNumber(a.prices.image, Number.MAX_SAFE_INTEGER) - safeNumber(b.prices.image, Number.MAX_SAFE_INTEGER));
    case 'image_price_desc': return cloned.sort((a, b) => safeNumber(b.prices.image, -1) - safeNumber(a.prices.image, -1));
    case 'speed_desc': return cloned.sort((a, b) => safeNumber(b.speedScore, 0) - safeNumber(a.speedScore, 0));
    case 'speed_asc': return cloned.sort((a, b) => safeNumber(a.speedScore, 0) - safeNumber(b.speedScore, 0));
    default: return cloned.sort((a, b) => `${a.company} ${a.modelName}`.localeCompare(`${b.company} ${b.modelName}`, 'tr'));
  }
}

function mapSortKey(sortKey, feature) {
  const clean = safeString(sortKey, feature === 'image' ? 'price_asc' : 'company_asc');
  if (clean === 'price_asc') return feature === 'image' ? 'image_price_asc' : 'input_price_asc';
  if (clean === 'price_desc') return feature === 'image' ? 'image_price_desc' : 'input_price_desc';
  return clean;
}

function isImageCatalogModel(item) {
  const category = safeString(item.categoryRaw).toLocaleLowerCase('tr');
  const modelId = safeString(item.modelId).toLocaleLowerCase('tr');
  const badges = Array.isArray(item.badges) ? item.badges.join(' ').toLocaleLowerCase('tr') : '';
  return (
    item?.prices?.image != null ||
    category.includes('image') ||
    category.includes('görsel') ||
    badges.includes('görsel') ||
    badges.includes('image') ||
    modelId.includes('flux') ||
    modelId.includes('gpt-image') ||
    modelId.includes('recraft') ||
    modelId.includes('ideogram') ||
    modelId.includes('stable-diffusion')
  );
}

function serializeModelForClient(item) {
  return {
    ...item,
    inputPrice: item?.prices?.input ?? null,
    outputPrice: item?.prices?.output ?? null,
    imagePrice: item?.prices?.image ?? null,
  };
}

function parseQuery(request) {
  const url = new URL(request.url);
  const feature = safeString(url.searchParams.get('feature')).toLocaleLowerCase('tr');
  return {
    search: safeString(url.searchParams.get('search')),
    company: safeString(url.searchParams.get('company')),
    badge: safeString(url.searchParams.get('badge')).toUpperCase(),
    category: safeString(url.searchParams.get('category')),
    sort: mapSortKey(url.searchParams.get('sort'), feature),
    limit: clampLimit(url.searchParams.get('limit')),
    offset: clampOffset(url.searchParams.get('offset')),
    modelId: safeString(url.searchParams.get('modelId')),
    feature,
  };
}

function buildListPayload(query) {
  let items = MODEL_CATALOG.filter((item) =>
    matchesSearch(item, query.search) &&
    matchesCompany(item, query.company) &&
    matchesBadge(item, query.badge) &&
    matchesCategory(item, query.category)
  );

  if (query.feature === 'image') {
    items = items.filter(isImageCatalogModel);
  }

  items = sortModels(items, query.sort);

  if (query.modelId) {
    items = items.filter((item) => item.modelId === query.modelId || item.id === query.modelId);
  }

  const total = items.length;
  const paginated = items.slice(query.offset, query.offset + query.limit).map(serializeModelForClient);

  return {
    items: paginated,
    total,
    limit: query.limit,
    offset: query.offset,
    hasMore: query.offset + query.limit < total,
    facets: MODEL_FACETS,
    source: {
      type: APP_INFO.sourceType,
      totalModels: MODEL_CATALOG.length,
      sourceUrl: MODEL_CATALOG[0]?.sourceUrl || '',
    },
    filters: {
      search: query.search,
      company: query.company,
      badge: query.badge,
      category: query.category,
      sort: query.sort,
      modelId: query.modelId,
      feature: query.feature,
    },
  };
}

// ─────────────────── JOB BELLEK DEPOLAMA ───────────────────

const IMAGE_DEFAULTS = Object.freeze({
  modelId: 'black-forest-labs/flux-1-schnell',
  quality: 'high',
  ratio: '1:1',
  n: 1,
  maxN: 4,
  jobHistoryLimit: 20,
});

const IMAGE_ALLOWED_QUALITIES = new Set(['low', 'medium', 'high']);
const IMAGE_ALLOWED_RATIOS = new Set(['1:1', '16:9', '9:16', '4:5', '3:2', '2:3']);
const JOB_TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const JOB_MEMORY_KEY = '__IDM_JOB_MEMORY__';
const JOB_MEMORY_HISTORY_KEY = '__IDM_JOB_MEMORY_HISTORY__';
const MEMORY_JOBS = globalThis[JOB_MEMORY_KEY] || (globalThis[JOB_MEMORY_KEY] = new Map());
const MEMORY_HISTORY = globalThis[JOB_MEMORY_HISTORY_KEY] || (globalThis[JOB_MEMORY_HISTORY_KEY] = []);

function hasKvNamespace(env) {
  return !!(env && env.IDM_JOBS && typeof env.IDM_JOBS.get === 'function' && typeof env.IDM_JOBS.put === 'function');
}

function jobStorageKey(jobId) {
  return `job:${jobId}`;
}

function historyStorageKey(job) {
  const created = safeString(job?.createdAt, nowIso());
  return `history:${created}:${job.jobId}`;
}

async function saveJob(env, job) {
  const normalized = { ...job, updatedAt: safeString(job.updatedAt, nowIso()) };
  MEMORY_JOBS.set(normalized.jobId, normalized);
  const existingIndex = MEMORY_HISTORY.findIndex((item) => item.jobId === normalized.jobId);
  if (existingIndex >= 0) MEMORY_HISTORY.splice(existingIndex, 1);
  MEMORY_HISTORY.unshift({ jobId: normalized.jobId, createdAt: normalized.createdAt || normalized.updatedAt || nowIso() });
  if (MEMORY_HISTORY.length > 200) MEMORY_HISTORY.splice(200);
  if (hasKvNamespace(env)) {
    const payload = JSON.stringify(normalized);
    await env.IDM_JOBS.put(jobStorageKey(normalized.jobId), payload);
    await env.IDM_JOBS.put(historyStorageKey(normalized), payload);
  }
  return normalized;
}

async function readJob(env, jobId) {
  if (!jobId) return null;
  if (hasKvNamespace(env)) {
    const text = await env.IDM_JOBS.get(jobStorageKey(jobId));
    if (text) {
      const parsed = safeJsonParse(text, null);
      if (parsed && typeof parsed === 'object') {
        MEMORY_JOBS.set(jobId, parsed);
        return parsed;
      }
    }
  }
  return MEMORY_JOBS.get(jobId) || null;
}

async function listJobs(env, limit = IMAGE_DEFAULTS.jobHistoryLimit) {
  const clampedLimit = Math.max(1, Math.min(50, Math.floor(safeNumber(limit, IMAGE_DEFAULTS.jobHistoryLimit) || IMAGE_DEFAULTS.jobHistoryLimit)));
  if (hasKvNamespace(env) && typeof env.IDM_JOBS.list === 'function') {
    const listed = await env.IDM_JOBS.list({ prefix: 'history:', limit: Math.max(clampedLimit * 3, clampedLimit) });
    const jobs = [];
    for (const key of listed.keys || []) {
      const value = await env.IDM_JOBS.get(key.name);
      const parsed = safeJsonParse(value, null);
      if (parsed && typeof parsed === 'object') jobs.push(parsed);
    }
    jobs.sort((a, b) => safeString(b.createdAt).localeCompare(safeString(a.createdAt)));
    return jobs.slice(0, clampedLimit);
  }
  return MEMORY_HISTORY
    .map((item) => MEMORY_JOBS.get(item.jobId))
    .filter(Boolean)
    .sort((a, b) => safeString(b.createdAt).localeCompare(safeString(a.createdAt)))
    .slice(0, clampedLimit);
}

async function updateJob(env, jobId, updater) {
  const current = (await readJob(env, jobId)) || { jobId };
  const next = updater({ ...current });
  return saveJob(env, { ...next, jobId, updatedAt: nowIso() });
}

// ─────────────────── GÖRSEL ÜRETİMİ ───────────────────

function buildPromptPreview(text, max = 140) {
  const clean = safeString(text);
  if (clean.length <= max) return clean;
  return `${clean.slice(0, max - 1)}…`;
}

function normalizeImageRequest(body) {
  const prompt = safeString(body?.prompt);
  if (!prompt) {
    const error = new Error('PROMPT ZORUNLU.');
    error.code = 'PROMPT_REQUIRED';
    throw error;
  }
  const model = safeString(body?.model || body?.modelId, IMAGE_DEFAULTS.modelId);
  const qualityInput = safeString(body?.quality, IMAGE_DEFAULTS.quality).toLowerCase();
  const quality = IMAGE_ALLOWED_QUALITIES.has(qualityInput) ? qualityInput : IMAGE_DEFAULTS.quality;
  const ratioInput = safeString(body?.ratio || body?.size, IMAGE_DEFAULTS.ratio);
  const ratio = IMAGE_ALLOWED_RATIOS.has(ratioInput) ? ratioInput : IMAGE_DEFAULTS.ratio;
  const n = Math.max(1, Math.min(IMAGE_DEFAULTS.maxN, Math.floor(safeNumber(body?.n, IMAGE_DEFAULTS.n) || IMAGE_DEFAULTS.n)));
  const style = safeString(body?.style);
  const negativePrompt = safeString(body?.negativePrompt);
  const clientRequestId = safeString(body?.clientRequestId);
  const responseFormat = safeString(body?.responseFormat, 'url');
  const guidance = safeString(body?.guidance);
  const seed = safeString(body?.seed);
  const metadata = body && typeof body.metadata === 'object' && body.metadata ? body.metadata : {};
  return {
    prompt, model, modelId: model, ratio, size: ratio, quality, style,
    negativePrompt, n, responseFormat, guidance, seed, clientRequestId, metadata,
    attachmentCount: safeNumber(body?.attachmentCount, 0),
  };
}

function buildImageJobRecord(jobId, requestPayload) {
  const createdAt = nowIso();
  return {
    jobId,
    feature: 'image',
    status: 'queued',
    progress: 0,
    step: 'queued',
    queuePosition: null,
    etaMs: null,
    outputUrl: null,
    outputUrls: [],
    url: null,
    urls: [],
    retryable: true,
    cancelRequested: false,
    requestSummary: {
      model: requestPayload.modelId,
      prompt: requestPayload.prompt,
      promptPreview: buildPromptPreview(requestPayload.prompt),
    },
    request: {
      model: requestPayload.model,
      modelId: requestPayload.modelId,
      ratio: requestPayload.ratio,
      size: requestPayload.size,
      quality: requestPayload.quality,
      style: requestPayload.style,
      negativePrompt: requestPayload.negativePrompt,
      n: requestPayload.n,
      responseFormat: requestPayload.responseFormat,
      metadata: requestPayload.metadata,
      clientRequestId: requestPayload.clientRequestId,
      attachmentCount: requestPayload.attachmentCount,
    },
    error: null,
    createdAt,
    updatedAt: createdAt,
    finishedAt: null,
  };
}

function collectStringCandidates(value, bag) {
  if (value == null) return;
  if (typeof value === 'string') {
    const clean = value.trim();
    if (clean) bag.push(clean);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectStringCandidates(item, bag);
    return;
  }
  if (typeof value === 'object') {
    for (const key of ['src', 'url', 'href', 'outputUrl']) {
      if (typeof value[key] === 'string' && value[key].trim()) bag.push(value[key].trim());
    }
    for (const key of ['urls', 'outputUrls', 'images', 'items', 'results', 'data']) {
      if (value[key] != null) collectStringCandidates(value[key], bag);
    }
  }
}

function extractImageUrls(raw) {
  const bag = [];
  collectStringCandidates(raw, bag);
  return [...new Set(bag.filter(Boolean))];
}

function getImageGeneratorCandidates(env) {
  return [
    env?.me?.puter?.ai?.txt2img,
    env?.me?.ai?.txt2img,
    env?.puter?.ai?.txt2img,
    globalThis?.me?.puter?.ai?.txt2img,
    globalThis?.me?.ai?.txt2img,
    globalThis?.puter?.ai?.txt2img,
    globalThis?.Puter?.ai?.txt2img,
  ].filter((candidate) => typeof candidate === 'function');
}

async function runTxt2Img(env, prompt, options) {
  const candidates = getImageGeneratorCandidates(env);
  if (!candidates.length) {
    const error = new Error('WORKER İÇİNDE txt2img FONKSİYONU BULUNAMADI.');
    error.code = 'TXT2IMG_UNAVAILABLE';
    throw error;
  }
  let lastError = null;
  for (const candidate of candidates) {
    try {
      return await candidate(prompt, options);
    } catch (error) {
      lastError = error;
    }
  }
  throw lastError || new Error('txt2img ÇAĞRISI BAŞARISIZ OLDU.');
}

function buildTxt2ImgOptions(job) {
  const request = job.request || {};
  return {
    model: safeString(request.modelId || request.model, IMAGE_DEFAULTS.modelId),
    quality: safeString(request.quality, IMAGE_DEFAULTS.quality),
    ratio: safeString(request.ratio || request.size, IMAGE_DEFAULTS.ratio),
    size: safeString(request.size || request.ratio, IMAGE_DEFAULTS.ratio),
    n: Math.max(1, Math.min(IMAGE_DEFAULTS.maxN, Math.floor(safeNumber(request.n, IMAGE_DEFAULTS.n) || IMAGE_DEFAULTS.n))),
    style: safeString(request.style),
    negativePrompt: safeString(request.negativePrompt),
    responseFormat: 'url',
    metadata: request.metadata || {},
    guidance: safeString(request.guidance),
    seed: safeString(request.seed),
  };
}

async function processImageJob(env, jobId) {
  const initialJob = await readJob(env, jobId);
  if (!initialJob) return;
  if (JOB_TERMINAL_STATUSES.has(initialJob.status)) return;
  if (initialJob.cancelRequested) {
    await updateJob(env, jobId, (job) => ({
      ...job, status: 'cancelled', progress: job.progress || 0,
      step: 'cancelled', finishedAt: nowIso(), error: null,
    }));
    return;
  }

  await updateJob(env, jobId, (job) => ({
    ...job, status: 'processing', progress: Math.max(5, safeNumber(job.progress, 0)),
    step: 'processing', retryable: true, error: null,
  }));

  try {
    const currentJob = await readJob(env, jobId);
    if (!currentJob) return;
    const result = await runTxt2Img(env, currentJob.requestSummary?.prompt || currentJob.request?.prompt || '', buildTxt2ImgOptions(currentJob));
    const urls = extractImageUrls(result);
    if (!urls.length) {
      const error = new Error('GÖRSEL ÜRETİMİ TAMAMLANDI AMA URL ÇIKMADI.');
      error.code = 'IMAGE_URL_MISSING';
      throw error;
    }
    const latestJob = await readJob(env, jobId);
    if (latestJob?.cancelRequested) {
      await updateJob(env, jobId, (job) => ({
        ...job, status: 'cancelled', progress: Math.max(safeNumber(job.progress, 0), 90),
        step: 'cancelled', finishedAt: nowIso(), outputUrl: null, outputUrls: [],
        url: null, urls: [], error: null,
      }));
      return;
    }
    await updateJob(env, jobId, (job) => ({
      ...job, status: 'completed', progress: 100, step: 'completed',
      finishedAt: nowIso(), retryable: false,
      outputUrl: urls[0] || null, outputUrls: urls, url: urls[0] || null, urls, error: null,
    }));
  } catch (error) {
    const safe = sanitizeError(error);
    await updateJob(env, jobId, (job) => ({
      ...job, status: 'failed', progress: Math.max(safeNumber(job.progress, 0), 100),
      step: 'failed', finishedAt: nowIso(), retryable: true,
      error: { message: safe.message || 'GÖRSEL ÜRETİMİ BAŞARISIZ.', retryable: true },
    }));
  }
}

// ─────────────────── REQUEST PARSE ───────────────────

async function parseRequestJson(request) {
  const text = await request.text();
  if (!text.trim()) return {};
  const parsed = safeJsonParse(text, null);
  if (!parsed || typeof parsed !== 'object') {
    const error = new Error('JSON BODY GEÇERSİZ.');
    error.code = 'INVALID_JSON';
    throw error;
  }
  return parsed;
}

// ─────────────────── ROUTE HANDLER'LAR ───────────────────

async function handleOptions(request) {
  return new Response(null, { status: 204, headers: buildCorsHeaders(request) });
}

async function handleRoot(request) {
  const startedAt = nowMs();
  const requestId = createId('info');
  const traceId = createId('trace');
  return jsonResponse(request, successEnvelope({
    requestId, traceId, startedAt, code: 'WORKER_INFO',
    data: {
      worker: APP_INFO.worker,
      version: APP_INFO.version,
      protocolVersion: APP_INFO.protocolVersion,
      purpose: APP_INFO.purpose,
      supportsCatalog: true,
      supportsImageGeneration: true,
      supportsJobs: true,
      routes: ['GET /','GET /health','GET /models','POST /generate','GET /jobs/status/:id','GET /jobs/history','POST /jobs/cancel'],
      supportedQuery: ['search','company','badge','category','sort','limit','offset','modelId','feature'],
    },
    meta: { totalModels: MODEL_CATALOG.length, sourceType: APP_INFO.sourceType },
  }));
}

async function handleHealth(request) {
  const startedAt = nowMs();
  const requestId = createId('health');
  const traceId = createId('trace');
  return jsonResponse(request, successEnvelope({
    requestId, traceId, startedAt, code: 'HEALTH_OK',
    data: {
      status: 'ok', worker: APP_INFO.worker, totalModels: MODEL_CATALOG.length,
      sourceType: APP_INFO.sourceType, supportsImageGeneration: true, supportsJobs: true, time: nowIso(),
    },
  }));
}

async function handleModels(request) {
  const startedAt = nowMs();
  const requestId = createId('models');
  const traceId = createId('trace');
  try {
    const query = parseQuery(request);
    const payload = buildListPayload(query);
    return jsonResponse(request, successEnvelope({
      requestId, traceId, startedAt, code: 'MODELS_OK', data: payload,
      meta: { totalModels: MODEL_CATALOG.length, returnedItems: payload.items.length },
    }), 200, { 'cache-control': `public, max-age=${DEFAULTS.cacheSeconds}` });
  } catch (error) {
    const safe = sanitizeError(error);
    return jsonResponse(request, errorEnvelope({
      requestId, traceId, startedAt, code: safe.code || 'MODELS_FAILED',
      message: safe.message || 'MODEL KATALOĞU İSTEĞİ BAŞARISIZ.', status: 500,
    }), 500);
  }
}

async function handleGenerate(request, env, ctx) {
  const startedAt = nowMs();
  const requestId = createId('generate');
  const traceId = createId('trace');
  try {
    const body = await parseRequestJson(request);
    const imageRequest = normalizeImageRequest(body);
    const jobId = createId('img');
    const job = buildImageJobRecord(jobId, imageRequest);
    await saveJob(env, job);
    ctx.waitUntil(processImageJob(env, jobId));
    return jsonResponse(request, successEnvelope({
      requestId, traceId, startedAt, code: 'IMAGE_JOB_QUEUED',
      data: { jobId, status: 'queued', progress: 0, step: 'queued', modelId: imageRequest.modelId, requestId },
      meta: { feature: 'image' },
    }), 202);
  } catch (error) {
    const safe = sanitizeError(error);
    const status = safe.code === 'PROMPT_REQUIRED' || safe.code === 'INVALID_JSON' ? 400 : 500;
    return jsonResponse(request, errorEnvelope({
      requestId, traceId, startedAt, code: safe.code || 'IMAGE_GENERATE_FAILED',
      message: safe.message || 'GÖRSEL ÜRETİMİ BAŞLATILAMADI.', status,
    }), status);
  }
}

async function handleJobStatus(request, env, jobId) {
  const startedAt = nowMs();
  const requestId = createId('status');
  const traceId = createId('trace');
  try {
    const job = await readJob(env, jobId);
    if (!job) {
      return jsonResponse(request, errorEnvelope({
        requestId, traceId, startedAt, code: 'JOB_NOT_FOUND', message: 'JOB BULUNAMADI.', status: 404,
      }), 404);
    }
    return jsonResponse(request, successEnvelope({
      requestId, traceId, startedAt, code: 'JOB_STATUS_OK', data: job, meta: { feature: 'image' },
    }));
  } catch (error) {
    const safe = sanitizeError(error);
    return jsonResponse(request, errorEnvelope({
      requestId, traceId, startedAt, code: safe.code || 'JOB_STATUS_FAILED',
      message: safe.message || 'JOB DURUMU OKUNAMADI.', status: 500,
    }), 500);
  }
}

async function handleJobHistory(request, env) {
  const startedAt = nowMs();
  const requestId = createId('history');
  const traceId = createId('trace');
  try {
    const url = new URL(request.url);
    const limit = Math.max(1, Math.min(50, Math.floor(safeNumber(url.searchParams.get('limit'), IMAGE_DEFAULTS.jobHistoryLimit) || IMAGE_DEFAULTS.jobHistoryLimit)));
    const items = await listJobs(env, limit);
    return jsonResponse(request, successEnvelope({
      requestId, traceId, startedAt, code: 'JOB_HISTORY_OK',
      data: { items, total: items.length, limit, feature: 'image' },
    }));
  } catch (error) {
    const safe = sanitizeError(error);
    return jsonResponse(request, errorEnvelope({
      requestId, traceId, startedAt, code: safe.code || 'JOB_HISTORY_FAILED',
      message: safe.message || 'JOB GEÇMİŞİ OKUNAMADI.', status: 500,
    }), 500);
  }
}

async function handleJobCancel(request, env) {
  const startedAt = nowMs();
  const requestId = createId('cancel');
  const traceId = createId('trace');
  try {
    const body = await parseRequestJson(request);
    const jobId = safeString(body?.jobId);
    if (!jobId) {
      return jsonResponse(request, errorEnvelope({
        requestId, traceId, startedAt, code: 'JOB_ID_REQUIRED', message: 'jobId ZORUNLU.', status: 400,
      }), 400);
    }
    const current = await readJob(env, jobId);
    if (!current) {
      return jsonResponse(request, errorEnvelope({
        requestId, traceId, startedAt, code: 'JOB_NOT_FOUND', message: 'JOB BULUNAMADI.', status: 404,
      }), 404);
    }
    const job = await updateJob(env, jobId, (jobState) => {
      if (JOB_TERMINAL_STATUSES.has(jobState.status)) return { ...jobState, cancelRequested: true };
      return { ...jobState, cancelRequested: true, status: 'cancelled', step: 'cancelled', finishedAt: nowIso() };
    });
    return jsonResponse(request, successEnvelope({
      requestId, traceId, startedAt, code: 'JOB_CANCELLED', data: job,
    }));
  } catch (error) {
    const safe = sanitizeError(error);
    const status = safe.code === 'INVALID_JSON' ? 400 : 500;
    return jsonResponse(request, errorEnvelope({
      requestId, traceId, startedAt, code: safe.code || 'JOB_CANCEL_FAILED',
      message: safe.message || 'JOB İPTAL EDİLEMEDİ.', status,
    }), status);
  }
}

async function handleNotFound(request) {
  const startedAt = nowMs();
  const requestId = createId('route');
  const traceId = createId('trace');
  return jsonResponse(request, errorEnvelope({
    requestId, traceId, startedAt, code: 'ROUTE_NOT_FOUND', message: 'ROUTE BULUNAMADI.', status: 404,
  }), 404);
}

// ─────────────────── DISPATCHER ───────────────────

async function dispatchRequest(request, env, ctx) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  if (method === 'OPTIONS') return handleOptions(request);
  if (method === 'GET' && pathname === '/') return handleRoot(request);
  if (method === 'GET' && pathname === '/health') return handleHealth(request);
  if (method === 'GET' && pathname === '/models') return handleModels(request);
  if (method === 'POST' && pathname === '/generate') return handleGenerate(request, env, ctx);
  if (method === 'GET' && pathname.startsWith('/jobs/status/')) {
    const jobId = decodeURIComponent(pathname.slice('/jobs/status/'.length));
    return handleJobStatus(request, env, jobId);
  }
  if (method === 'GET' && pathname === '/jobs/history') return handleJobHistory(request, env);
  if (method === 'POST' && pathname === '/jobs/cancel') return handleJobCancel(request, env);
  return handleNotFound(request);
}

// ─────────────────── FETCH ENTRY POINT ───────────────────

addEventListener('fetch', (event) => {
  event.respondWith(handleFetch(event.request, event));
});

async function handleFetch(request, event) {
  const env = {};
  const ctx = {
    waitUntil(promise) {
      if (event && typeof event.waitUntil === 'function') {
        event.waitUntil(promise);
      }
    },
  };
  try {
    return await dispatchRequest(request, env, ctx);
  } catch (error) {
    const startedAt = nowMs();
    const requestId = createId('fatal');
    const traceId = createId('trace');
    const safe = sanitizeError(error);
    return jsonResponse(request, errorEnvelope({
      requestId, traceId, startedAt,
      code: safe.code || 'UNEXPECTED_ERROR',
      message: safe.message || 'BEKLENMEYEN HATA OLUŞTU.',
      status: 500,
    }), 500);
  }
}

