/*
DOSYA: models-worker.js
AMAÇ: YALNIZCA 4 RESMİ IMAGE MODELİNİ GÜVENLİ JSON API OLARAK SUNMAK.
NOT: BU WORKER TEK GÖREVLİDİR; SADECE MODEL KATALOĞU SERVİSİ VERİR.
NOT: BU SÜRÜMDE SADECE 4 IMAGE MODEL KALIR.
*/

const APP_INFO = Object.freeze({
  worker: 'models-catalog',
  version: '1.2.0',
  protocolVersion: '2026-03-16',
  purpose: 'MODEL CATALOG API',
  billingMode: 'owner_pays',
  sourceType: 'curated-static-4-images',
});

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
    company: 'Black Forest Labs',
    provider: 'together',
    providerLabel: 'Together',
    displayName: 'Flux 1 Schnell',
    profileKey: 'image.together.flux_schnell',
    rankTag: 'EN UCUZ',
    modelName: 'Flux 1 Schnell',
    modelId: 'black-forest-labs/flux.1-schnell',
    categoryRaw: 'Image generation',
    badges: ['GÖRSEL'],
    parameters: '12B distilled',
    releaseDate: '2026-03-16',
    speedLabel: '~1 sn/görsel',
    inputPrice: null,
    outputPrice: null,
    imagePrice: 0.0045,
    traits: [
      'En düşük maliyet',
      'Çok hızlı üretim',
      'Yüksek hacim için uygun',
      'Preview ve toplu iş için ideal',
      'Together image profiline uygun'
    ],
    standoutFeature: 'Seçili 4 model içinde en ucuz image modeli.',
    useCase: 'Toplu görsel üretim, hızlı önizleme, maliyet hassas akışlar',
    rivalAdvantage: 'Aynı seçim seti içinde maliyet lideri.',
    sourceUrl: 'https://developer.puter.com/ai/models/',
    tagUi: { text: 'en ucuz', bg: '#000000', fg: '#ffffff', rounded: '9999px' },
    template: {
      prompt: 'zorunlu metin alanı',
      provider: 'together',
      model: 'black-forest-labs/flux.1-schnell',
      test_mode: false,
      ratio: { w: 1024, h: 1024 },
    },
    profile: {
      provider: 'together',
      model: 'black-forest-labs/flux.1-schnell',
      prompt: 'zorunlu metin alanı',
      test_mode: 'true | false',
      ratio: { w: 1024, h: 1024 },
      response_format: 'url | b64_json',
    },
    override: {
      model: 'black-forest-labs/flux.1-schnell',
      width: true,
      height: true,
      aspect_ratio: true,
      steps: true,
      seed: true,
      negative_prompt: true,
      n: true,
      image_url: true,
      image_base64: true,
      mask_image_url: true,
      mask_image_base64: true,
      prompt_strength: true,
      disable_safety_checker: true,
      response_format: true,
    },
    style: { brandKey: 'black-forest-labs', accent: '#ef4444' },
  },
  {
    company: 'Google',
    provider: 'gemini',
    providerLabel: 'Gemini',
    displayName: 'Imagen 4.0 Ultra',
    profileKey: 'image.gemini.imagen_ultra',
    rankTag: 'EN KALITELI',
    modelName: 'Imagen 4.0 Ultra',
    modelId: 'google/imagen-4.0-ultra',
    categoryRaw: 'Image generation',
    badges: ['GÖRSEL'],
    parameters: 'Ultra image model',
    releaseDate: '2026-03-16',
    speedLabel: '~6 sn/görsel',
    inputPrice: null,
    outputPrice: null,
    imagePrice: 0.12,
    traits: [
      'Kalite odaklı çıktı',
      'Yüksek detay',
      'Premium render kalitesi',
      'Gemini image profiline uyumlu',
      'Sunum ve reklam kalitesi'
    ],
    standoutFeature: 'Seçili 4 model içinde kalite öncelikli image modeli.',
    useCase: 'Premium kampanya görselleri, ürün görselleri, detay yoğun işler',
    rivalAdvantage: 'Aynı seçim seti içinde kalite lideri.',
    sourceUrl: 'https://developer.puter.com/ai/models/',
    tagUi: { text: 'en kaliteli', bg: '#000000', fg: '#ffffff', rounded: '9999px' },
    template: {
      prompt: 'zorunlu metin alanı',
      provider: 'gemini',
      model: 'google/imagen-4.0-ultra',
      test_mode: false,
      ratio: { w: 1024, h: 1024 },
    },
    profile: {
      provider: 'gemini',
      model: 'google/imagen-4.0-ultra',
      prompt: 'zorunlu metin alanı',
      test_mode: 'true | false',
      ratio: { w: 1024, h: 1024 },
      response_format: 'url',
    },
    override: {
      model: 'google/imagen-4.0-ultra',
      width: true,
      height: true,
      aspect_ratio: true,
      steps: true,
      seed: true,
      negative_prompt: true,
      n: true,
      image_url: true,
      image_base64: true,
      mask_image_url: true,
      mask_image_base64: true,
      prompt_strength: true,
      disable_safety_checker: true,
      response_format: true,
    },
    style: { brandKey: 'google', accent: '#4285f4' },
  },
  {
    company: 'Google',
    provider: 'gemini',
    providerLabel: 'Gemini',
    displayName: 'Gemini 3.1 Flash Image Preview',
    profileKey: 'image.gemini.flash_image_preview',
    rankTag: 'EN GUNCEL',
    modelName: 'Gemini 3.1 Flash Image Preview',
    modelId: 'google/gemini-3.1-flash-image-preview',
    categoryRaw: 'Image generation',
    badges: ['GÖRSEL'],
    parameters: 'Diffusion + Gemini image preview',
    releaseDate: '2026-03-16',
    speedLabel: '~3 sn/görsel',
    inputPrice: null,
    outputPrice: null,
    imagePrice: 0.1005,
    traits: [
      'Güncel image preview modeli',
      'Hızlı üretim',
      'Gemini image akışına uygun',
      'Prompt sadakati iyi',
      'Yeni nesil image yüzeyi'
    ],
    standoutFeature: 'Seçili 4 model içinde en güncel image modeli.',
    useCase: 'Güncel model testleri, hızlı kampanya görselleri, yeni akış doğrulama',
    rivalAdvantage: 'Aynı seçim seti içinde güncellik lideri.',
    sourceUrl: 'https://developer.puter.com/ai/models/',
    tagUi: { text: 'en güncel', bg: '#000000', fg: '#ffffff', rounded: '9999px' },
    template: {
      prompt: 'zorunlu metin alanı',
      provider: 'gemini',
      model: 'google/gemini-3.1-flash-image-preview',
      test_mode: false,
      ratio: { w: 1024, h: 1024 },
    },
    profile: {
      provider: 'gemini',
      model: 'google/gemini-3.1-flash-image-preview',
      prompt: 'zorunlu metin alanı',
      test_mode: 'true | false',
      ratio: { w: 1024, h: 1024 },
      input_image: 'opsiyonel',
      input_image_mime_type: 'opsiyonel',
    },
    override: {
      model: 'google/gemini-3.1-flash-image-preview',
      ratio: true,
      input_image: true,
      input_image_mime_type: true,
    },
    style: { brandKey: 'google', accent: '#4285f4' },
  },
  {
    company: 'Google',
    provider: 'gemini',
    providerLabel: 'Gemini',
    displayName: 'Gemini 3 Pro Image',
    profileKey: 'image.gemini.pro_image',
    rankTag: 'EN PAHALI',
    modelName: 'Gemini 3 Pro Image',
    modelId: 'google/gemini-3-pro-image',
    categoryRaw: 'Image generation',
    badges: ['GÖRSEL'],
    parameters: 'Pro image model',
    releaseDate: '2026-03-16',
    speedLabel: '~7 sn/görsel',
    inputPrice: null,
    outputPrice: null,
    imagePrice: 0.18,
    traits: [
      'Pro seviye model',
      'En yüksek fiyat bandı',
      'Kalite ve maliyet yüksek',
      'Premium kullanım senaryosu',
      'Gemini pro image profiline uygun'
    ],
    standoutFeature: 'Seçili 4 model içinde en pahalı image modeli.',
    useCase: 'Üst segment premium görseller, maliyet ikinci planda kalite işleri',
    rivalAdvantage: 'Aynı seçim seti içinde fiyat lideri.',
    sourceUrl: 'https://developer.puter.com/ai/models/',
    tagUi: { text: 'en pahalı', bg: '#000000', fg: '#ffffff', rounded: '9999px' },
    template: {
      prompt: 'zorunlu metin alanı',
      provider: 'gemini',
      model: 'google/gemini-3-pro-image',
      test_mode: false,
      ratio: { w: 1024, h: 1024 },
    },
    profile: {
      provider: 'gemini',
      model: 'google/gemini-3-pro-image',
      prompt: 'zorunlu metin alanı',
      test_mode: 'true | false',
      ratio: { w: 1024, h: 1024 },
      input_image: 'opsiyonel',
      input_image_mime_type: 'opsiyonel',
    },
    override: {
      model: 'google/gemini-3-pro-image',
      ratio: true,
      input_image: true,
      input_image_mime_type: true,
    },
    style: { brandKey: 'google', accent: '#4285f4' },
  },
];

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

function buildCorsHeaders(request) {
  const origin = request.headers.get('origin') || '*';
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,OPTIONS',
    'access-control-allow-credentials': 'true',
    vary: 'origin',
  };
}

function buildJsonHeaders(request, extra = {}) {
  return {
    ...buildCorsHeaders(request),
    'content-type': 'application/json; charset=utf-8',
    'cache-control': `public, max-age=${DEFAULTS.cacheSeconds}`,
    ...extra,
  };
}

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
      type: 'models.error',
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

function jsonResponse(request, body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: buildJsonHeaders(request, extra),
  });
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
    const providerLabel = safeString(row.providerLabel, provider);
    const displayName = safeString(row.displayName, `${company} · ${modelName}`);
    const profileKey = safeString(row.profileKey);
    const rankTag = safeString(row.rankTag);
    const releaseDate = safeString(row.releaseDate);
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
    const tagUi = row && typeof row.tagUi === 'object' && row.tagUi ? row.tagUi : {};
    const template = row && typeof row.template === 'object' && row.template ? row.template : null;
    const profile = row && typeof row.profile === 'object' && row.profile ? row.profile : null;
    const override = row && typeof row.override === 'object' && row.override ? row.override : null;

    return Object.freeze({
      id: modelId,
      company,
      provider,
      providerLabel,
      displayName,
      profileKey,
      rankTag,
      modelName,
      modelId,
      categoryRaw,
      badges,
      parameters,
      releaseDate,
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
      tagUi: Object.freeze({
        text: safeString(tagUi.text, safeString(rankTag).toUpperCase()),
        bg: safeString(tagUi.bg, '#000000'),
        fg: safeString(tagUi.fg, '#ffffff'),
        rounded: safeString(tagUi.rounded, '9999px'),
      }),
      template: template ? Object.freeze(template) : null,
      profile: profile ? Object.freeze(profile) : null,
      override: override ? Object.freeze(override) : null,
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
      providerLabel: 'BİLİNMİYOR',
      displayName: 'BOZUK KAYIT',
      profileKey: '',
      rankTag: '',
      modelName: 'BOZUK KAYIT',
      modelId: `broken-model-${index + 1}`,
      categoryRaw: 'GENEL',
      badges: Object.freeze(['GENEL']),
      parameters: '-',
      releaseDate: '',
      speedLabel: 'Orta',
      speedScore: 50,
      prices: Object.freeze({ input: null, output: null, image: null }),
      traits: Object.freeze([]),
      standoutFeature: '',
      useCase: '',
      rivalAdvantage: '',
      sourceUrl: '',
      tagUi: Object.freeze({ text: '', bg: '#000000', fg: '#ffffff', rounded: '9999px' }),
      template: null,
      profile: null,
      override: null,
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
    item.company,
    item.provider,
    item.modelName,
    item.modelId,
    item.categoryRaw,
    ...item.badges,
    ...item.traits,
    item.standoutFeature,
    item.useCase,
    item.rivalAdvantage,
  ];
  return bag.some((part) => queryContains(part, search));
}

function matchesCompany(item, company) {
  if (!safeString(company)) return true;
  return safeString(item.company).toLocaleLowerCase('tr') === safeString(company).toLocaleLowerCase('tr');
}

function matchesBadge(item, badge) {
  if (!safeString(badge)) return true;
  const normalizedBadge = safeString(badge).toUpperCase();
  return item.badges.includes(normalizedBadge);
}

function matchesCategory(item, category) {
  if (!safeString(category)) return true;
  return safeString(item.categoryRaw).toLocaleLowerCase('tr') === safeString(category).toLocaleLowerCase('tr');
}

function sortModels(items, sortKey) {
  const cloned = [...items];
  switch (safeString(sortKey)) {
    case 'name_asc':
      return cloned.sort((a, b) => a.modelName.localeCompare(b.modelName, 'tr'));
    case 'name_desc':
      return cloned.sort((a, b) => b.modelName.localeCompare(a.modelName, 'tr'));
    case 'company_asc':
      return cloned.sort((a, b) => `${a.company} ${a.modelName}`.localeCompare(`${b.company} ${b.modelName}`, 'tr'));
    case 'company_desc':
      return cloned.sort((a, b) => `${b.company} ${b.modelName}`.localeCompare(`${a.company} ${a.modelName}`, 'tr'));
    case 'input_price_asc':
      return cloned.sort((a, b) => safeNumber(a.prices.input, Number.MAX_SAFE_INTEGER) - safeNumber(b.prices.input, Number.MAX_SAFE_INTEGER));
    case 'input_price_desc':
      return cloned.sort((a, b) => safeNumber(b.prices.input, -1) - safeNumber(a.prices.input, -1));
    case 'output_price_asc':
      return cloned.sort((a, b) => safeNumber(a.prices.output, Number.MAX_SAFE_INTEGER) - safeNumber(b.prices.output, Number.MAX_SAFE_INTEGER));
    case 'output_price_desc':
      return cloned.sort((a, b) => safeNumber(b.prices.output, -1) - safeNumber(a.prices.output, -1));
    case 'image_price_asc':
      return cloned.sort((a, b) => safeNumber(a.prices.image, Number.MAX_SAFE_INTEGER) - safeNumber(b.prices.image, Number.MAX_SAFE_INTEGER));
    case 'image_price_desc':
      return cloned.sort((a, b) => safeNumber(b.prices.image, -1) - safeNumber(a.prices.image, -1));
    case 'speed_desc':
      return cloned.sort((a, b) => safeNumber(b.speedScore, 0) - safeNumber(a.speedScore, 0));
    case 'speed_asc':
      return cloned.sort((a, b) => safeNumber(a.speedScore, 0) - safeNumber(b.speedScore, 0));
    default:
      return cloned.sort((a, b) => `${a.company} ${a.modelName}`.localeCompare(`${b.company} ${b.modelName}`, 'tr'));
  }
}

function parseQuery(request) {
  const url = new URL(request.url);
  return {
    search: safeString(url.searchParams.get('search')),
    company: safeString(url.searchParams.get('company')),
    badge: safeString(url.searchParams.get('badge')).toUpperCase(),
    category: safeString(url.searchParams.get('category')),
    sort: safeString(url.searchParams.get('sort'), 'company_asc'),
    limit: clampLimit(url.searchParams.get('limit')),
    offset: clampOffset(url.searchParams.get('offset')),
    modelId: safeString(url.searchParams.get('modelId')),
  };
}

function buildListPayload(query) {
  let items = MODEL_CATALOG.filter((item) =>
    matchesSearch(item, query.search) &&
    matchesCompany(item, query.company) &&
    matchesBadge(item, query.badge) &&
    matchesCategory(item, query.category)
  );

  items = sortModels(items, query.sort);

  if (query.modelId) {
    items = items.filter((item) => item.modelId === query.modelId || item.id === query.modelId);
  }

  const total = items.length;
  const paginated = items.slice(query.offset, query.offset + query.limit);

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
    },
  };
}

router.options('/*page', ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: buildCorsHeaders(request),
  });
});

router.get('/', async ({ request }) => {
  const startedAt = nowMs();
  const requestId = createId('info');
  const traceId = createId('trace');

  try {
    return jsonResponse(
      request,
      successEnvelope({
        requestId,
        traceId,
        startedAt,
        code: 'WORKER_INFO',
        data: {
          worker: APP_INFO.worker,
          version: APP_INFO.version,
          protocolVersion: APP_INFO.protocolVersion,
          purpose: APP_INFO.purpose,
          routes: [
            'GET /',
            'GET /health',
            'GET /models',
          ],
          supportedQuery: [
            'search',
            'company',
            'badge',
            'category',
            'sort',
            'limit',
            'offset',
            'modelId',
          ],
        },
        meta: {
          totalModels: MODEL_CATALOG.length,
          sourceType: APP_INFO.sourceType,
        },
      })
    );
  } catch (error) {
    const safe = sanitizeError(error);
    return jsonResponse(
      request,
      errorEnvelope({
        requestId,
        traceId,
        startedAt,
        code: safe.code || 'WORKER_INFO_FAILED',
        message: safe.message || 'WORKER BİLGİSİ OLUŞTURULAMADI.',
        status: 500,
      }),
      500
    );
  }
});

router.get('/health', async ({ request }) => {
  const startedAt = nowMs();
  const requestId = createId('health');
  const traceId = createId('trace');

  try {
    return jsonResponse(
      request,
      successEnvelope({
        requestId,
        traceId,
        startedAt,
        code: 'HEALTH_OK',
        data: {
          status: 'ok',
          worker: APP_INFO.worker,
          totalModels: MODEL_CATALOG.length,
          sourceType: APP_INFO.sourceType,
          time: nowIso(),
        },
      })
    );
  } catch (error) {
    const safe = sanitizeError(error);
    return jsonResponse(
      request,
      errorEnvelope({
        requestId,
        traceId,
        startedAt,
        code: safe.code || 'HEALTH_FAILED',
        message: safe.message || 'HEALTH CEVABI OLUŞTURULAMADI.',
        status: 500,
      }),
      500
    );
  }
});

router.get('/models', async ({ request }) => {
  const startedAt = nowMs();
  const requestId = createId('models');
  const traceId = createId('trace');

  try {
    let query;
    try {
      query = parseQuery(request);
    } catch (parseError) {
      const safeParseError = sanitizeError(parseError);
      return jsonResponse(
        request,
        errorEnvelope({
          requestId,
          traceId,
          startedAt,
          code: safeParseError.code || 'QUERY_PARSE_FAILED',
          message: safeParseError.message || 'QUERY PARAMETRELERİ OKUNAMADI.',
          status: 400,
        }),
        400
      );
    }

    let payload;
    try {
      payload = buildListPayload(query);
    } catch (payloadError) {
      const safePayloadError = sanitizeError(payloadError);
      return jsonResponse(
        request,
        errorEnvelope({
          requestId,
          traceId,
          startedAt,
          code: safePayloadError.code || 'CATALOG_BUILD_FAILED',
          message: safePayloadError.message || 'MODEL KATALOĞU OLUŞTURULAMADI.',
          details: { filters: query },
          status: 500,
        }),
        500
      );
    }

    return jsonResponse(
      request,
      successEnvelope({
        requestId,
        traceId,
        startedAt,
        code: 'MODELS_OK',
        data: payload,
        meta: {
          totalModels: MODEL_CATALOG.length,
          returnedItems: payload.items.length,
        },
      })
    );
  } catch (error) {
    const safe = sanitizeError(error);
    return jsonResponse(
      request,
      errorEnvelope({
        requestId,
        traceId,
        startedAt,
        code: safe.code || 'MODELS_FAILED',
        message: safe.message || 'MODEL KATALOĞU İSTEĞİ BAŞARISIZ.',
        status: 500,
      }),
      500
    );
  }
});
