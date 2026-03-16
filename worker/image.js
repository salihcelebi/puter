// imgs.js — v20.0.0
// me.puter owner-pays image worker
// Model catalog source: https://models-worker.puter.work/models
// Storage strategy: try multiple candidate folders in order, use first successful real path

const WORKER_NAME = 'imgs';
const WORKER_VERSION = '20.0.0';
const JOB_PREFIX = 'ai_job:';
const HISTORY_LIMIT = 20;
const KV_SAFE_LIMIT = 390000;
const URL_EXPIRES_MS = 24 * 60 * 60 * 1000;
const POLL_INTERVAL_HINT_MS = 1800;
const MAX_GENERATION_ATTEMPTS = 4;
const MODELS_WORKER_URL = 'https://models-worker.puter.work/models?limit=250';
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_IMAGE_MODEL = 'openai/gpt-image-1';
const DEFAULT_PROVIDER = 'openai-image-generation';
const STORAGE_ROOT_CANDIDATES = Object.freeze([
  '/nisanil/Desktop/turk/img/idm_images',
  'Desktop/turk/img/idm_images',
  'turk/img/idm_images',
  'img/idm_images',
  'idm_images'
]);
const ALLOWED_IMAGE_PROVIDERS = new Set(['openai-image-generation', 'together', 'gemini', 'xai']);

let modelsCache = {
  fetchedAt: 0,
  source: 'empty',
  items: []
};

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function uid(prefix) {
  return `${prefix || 'id'}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function ss(v, fb = '') {
  try {
    if (v == null) return fb;
    const s = String(v).trim();
    return s || fb;
  } catch (_) {
    return fb;
  }
}

function ci(v, min, max, fb) {
  try {
    const n = Math.floor(Number(v));
    if (!Number.isFinite(n)) return fb;
    return Math.max(min, Math.min(max, n));
  } catch (_) {
    return fb;
  }
}

function clamp(v, min, max) {
  return Math.max(min, Math.min(max, v));
}

function normalizeError(err) {
  if (!err) return 'Bilinmeyen hata';
  try {
    if (typeof err === 'string') return err;
    if (err.message) return String(err.message);
    const s = JSON.stringify(err);
    return s && s !== '{}' ? s.slice(0, 1200) : 'Hata okunamadı';
  } catch (_) {
    return 'Hata serileştirilemedi';
  }
}

function corsHeaders(request) {
  const origin = ss(request?.headers?.get('origin'), '*');
  return {
    'access-control-allow-origin': origin,
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-credentials': origin === '*' ? 'false' : 'true',
    vary: 'origin'
  };
}

function jsonResponse(body, status = 200, cacheControl = 'no-store', request = null) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders(request),
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl
    }
  });
}

function okEnvelope(requestId, traceId, startedAtMs, code, data = null, meta = null) {
  return {
    ok: true,
    code,
    error: null,
    data,
    meta,
    worker: WORKER_NAME,
    version: WORKER_VERSION,
    requestId,
    traceId,
    time: nowIso(),
    durationMs: Math.max(0, nowMs() - startedAtMs)
  };
}

function errEnvelope(requestId, traceId, startedAtMs, code, message, bullets = [], httpStatus = 500, meta = null) {
  return {
    ok: false,
    code,
    error: {
      message,
      bullets,
      retryable: httpStatus >= 500
    },
    data: null,
    meta,
    worker: WORKER_NAME,
    version: WORKER_VERSION,
    requestId,
    traceId,
    time: nowIso(),
    durationMs: Math.max(0, nowMs() - startedAtMs),
    httpStatus
  };
}

function sanitizePathPart(value, fallback = 'item') {
  const raw = ss(value, fallback);
  const cleaned = raw
    .normalize('NFKD')
    .replace(/[^\w.-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return cleaned || fallback;
}

function trimSlashes(value) {
  return ss(value).replace(/^\/+|\/+$/g, '');
}

function joinFsPath(root, relativePart) {
  const left = ss(root);
  const right = trimSlashes(relativePart);
  if (!left) return right;
  if (!right) return left;
  if (left.endsWith('/')) return `${left}${right}`;
  return `${left}/${right}`;
}

function normalizeProviderRegistry(rawProvider, rawModel) {
  const provider = ss(rawProvider).toLowerCase();
  const model = ss(rawModel).toLowerCase();
  if (ALLOWED_IMAGE_PROVIDERS.has(provider)) return provider;
  if (model.startsWith('openai/')) return 'openai-image-generation';
  if (model.startsWith('xai/') || model.includes('grok')) return 'xai';
  if (model.startsWith('google/gemini')) return 'gemini';
  if (
    model.startsWith('black-forest-labs/') ||
    model.includes('flux') ||
    model.includes('imagen') ||
    model.startsWith('ideogram/') ||
    model.startsWith('recraft/')
  ) {
    return 'together';
  }
  return DEFAULT_PROVIDER;
}

function normalizeQuality(quality) {
  const q = ss(quality, 'medium').toLowerCase();
  if (q === 'hd') return 'high';
  if (q === 'standard') return 'medium';
  if (q === 'low' || q === 'medium' || q === 'high') return q;
  return 'medium';
}

function ratioToSize(ratio) {
  if (ratio && typeof ratio === 'object' && Number.isFinite(ratio.w) && Number.isFinite(ratio.h)) {
    return { w: clamp(Math.floor(Number(ratio.w)), 256, 4096), h: clamp(Math.floor(Number(ratio.h)), 256, 4096) };
  }
  const map = {
    '1:1': { w: 1024, h: 1024 },
    '16:9': { w: 1792, h: 1024 },
    '9:16': { w: 1024, h: 1792 },
    '4:5': { w: 1024, h: 1280 },
    '5:4': { w: 1280, h: 1024 },
    '4:3': { w: 1024, h: 768 },
    '3:4': { w: 768, h: 1024 },
    '3:2': { w: 1536, h: 1024 },
    '2:3': { w: 1024, h: 1536 }
  };
  return map[ss(ratio, '1:1')] || map['1:1'];
}

function ratioToAspectRatio(ratio) {
  const normalized = ss(ratio, '1:1');
  if (/^\d+:\d+$/.test(normalized)) return normalized;
  const size = ratioToSize(ratio);
  return `${size.w}:${size.h}`;
}

function extractImageSrc(result) {
  if (!result) return null;
  if (typeof result === 'string') return result.trim();
  if (typeof result.src === 'string') return result.src.trim();
  if (typeof result?.image?.src === 'string') return result.image.src.trim();
  return null;
}

function normalizeCatalogEntry(item) {
  const model = ss(item?.model || item?.modelId || item?.id);
  if (!model) return null;
  const provider = normalizeProviderRegistry(item?.provider, model);
  const displayName = ss(item?.displayName, ss(item?.modelName, model));
  return {
    ...item,
    id: ss(item?.id, model),
    modelId: ss(item?.modelId, model),
    model,
    displayName,
    modelName: ss(item?.modelName, displayName),
    provider,
    company: ss(item?.company || item?.providerLabel || item?.provider, provider),
    providerLabel: ss(item?.providerLabel || item?.company || item?.provider, provider),
    categoryRaw: ss(item?.categoryRaw, ''),
    badges: Array.isArray(item?.badges) ? item.badges : [],
    template: item?.template && typeof item.template === 'object' ? item.template : null,
    profile: item?.profile && typeof item.profile === 'object' ? item.profile : null,
    override: item?.override && typeof item.override === 'object' ? item.override : null,
    tagUi: item?.tagUi && typeof item.tagUi === 'object' ? item.tagUi : null,
    pricing: item?.pricing && typeof item.pricing === 'object' ? item.pricing : null,
    prices: item?.prices && typeof item.prices === 'object' ? item.prices : null
  };
}

function isImageCatalogModel(item) {
  const category = ss(item?.categoryRaw || item?.category).toLowerCase();
  return category === 'image generation' || category === 'image';
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) return {};
  return JSON.parse(text);
}

async function fetchModelsFromWorker() {
  const response = await fetch(MODELS_WORKER_URL, {
    method: 'GET',
    headers: {
      accept: 'application/json, text/plain;q=0.5, */*;q=0.1'
    }
  });
  if (!response.ok) {
    throw new Error(`models-worker alınamadı (${response.status})`);
  }
  const payload = await readJsonResponse(response);
  const items = Array.isArray(payload?.data?.items)
    ? payload.data.items
    : Array.isArray(payload?.items)
      ? payload.items
      : [];
  const filtered = items
    .filter(isImageCatalogModel)
    .map(normalizeCatalogEntry)
    .filter(Boolean);
  if (!filtered.length) {
    throw new Error('Image generation modelleri models-worker içinde bulunamadı');
  }
  return {
    items: filtered,
    source: payload?.data?.source || payload?.meta?.source || 'models-worker:/models'
  };
}

async function getImageCatalog(forceRefresh = false) {
  const now = nowMs();
  if (!forceRefresh && Array.isArray(modelsCache.items) && modelsCache.items.length && (now - modelsCache.fetchedAt) < MODELS_CACHE_TTL_MS) {
    return modelsCache;
  }
  const result = await fetchModelsFromWorker();
  modelsCache = {
    fetchedAt: now,
    source: result.source,
    items: result.items
  };
  return modelsCache;
}

async function buildModelsPayload() {
  const catalog = await getImageCatalog(false);
  return {
    items: catalog.items,
    total: catalog.items.length,
    limit: catalog.items.length,
    offset: 0,
    hasMore: false,
    feature: 'image',
    source: catalog.source
  };
}

function findRequestedModel(items, requestedModel) {
  const wanted = ss(requestedModel);
  if (!wanted) return items[0] || null;
  return items.find((item) => {
    return wanted === ss(item?.model) || wanted === ss(item?.modelId) || wanted === ss(item?.id);
  }) || null;
}

function buildPromptText(prompt, negativePrompt, provider) {
  const cleanPrompt = ss(prompt, '');
  const cleanNegative = ss(negativePrompt, '');
  if (!cleanNegative) return cleanPrompt;
  if (provider === 'together') return cleanPrompt;
  return `${cleanPrompt}\n\nAvoid / Negative prompt: ${cleanNegative}`;
}

function makeStageError(stage, code, message, bullets = [], retryable = true, httpStatus = 500) {
  const err = new Error(message);
  err.stage = stage;
  err.code = code;
  err.bullets = Array.isArray(bullets) ? bullets : [];
  err.retryable = retryable;
  err.httpStatus = httpStatus;
  return err;
}

function buildProviderBaseOptions(model, body) {
  const provider = normalizeProviderRegistry(model?.provider, model?.model);
  const modelId = ss(model?.model || model?.modelId, DEFAULT_IMAGE_MODEL);
  const base = {
    provider,
    model: modelId,
    test_mode: Boolean(body?.test_mode === true)
  };
  return base;
}

function buildOpenAiImageOptions(model, body) {
  const base = buildProviderBaseOptions(model, body);
  const size = ratioToSize(body?.ratio || '1:1');
  base.quality = normalizeQuality(body?.quality);
  base.ratio = size;
  return base;
}

function buildTogetherImageOptions(model, body) {
  const base = buildProviderBaseOptions(model, body);
  const size = ratioToSize(body?.ratio || '1:1');
  base.width = size.w;
  base.height = size.h;
  base.aspect_ratio = ratioToAspectRatio(body?.ratio || '1:1');
  if (ss(body?.negativePrompt)) base.negative_prompt = ss(body?.negativePrompt);
  base.n = ci(body?.n, 1, 4, 1);
  if (body?.responseFormat) base.response_format = ss(body.responseFormat);
  if (body?.steps != null) base.steps = ci(body.steps, 1, 50, 28);
  if (body?.seed != null) base.seed = ci(body.seed, 0, 2147483647, 1);
  if (body?.image_url) base.image_url = ss(body.image_url);
  if (body?.image_base64) base.image_base64 = ss(body.image_base64);
  if (body?.mask_image_url) base.mask_image_url = ss(body.mask_image_url);
  if (body?.mask_image_base64) base.mask_image_base64 = ss(body.mask_image_base64);
  if (body?.prompt_strength != null) base.prompt_strength = Number(body.prompt_strength);
  if (body?.disable_safety_checker === true) base.disable_safety_checker = true;
  return base;
}

function buildGeminiImageOptions(model, body) {
  const base = buildProviderBaseOptions(model, body);
  base.ratio = ratioToSize(body?.ratio || '1:1');
  if (body?.input_image) base.input_image = body.input_image;
  if (body?.input_image_mime_type) base.input_image_mime_type = ss(body.input_image_mime_type);
  return base;
}

function buildXaiImageOptions(model, body) {
  const base = buildProviderBaseOptions(model, body);
  return base;
}

function buildProviderSpecificOptions(model, body) {
  const provider = normalizeProviderRegistry(model?.provider, model?.model);
  if (!ALLOWED_IMAGE_PROVIDERS.has(provider)) {
    throw makeStageError('generation', 'PROVIDER_INVALID', `Desteklenmeyen image provider: ${provider}`, [`model=${ss(model?.model)}`], false, 400);
  }
  if (provider === 'openai-image-generation') return buildOpenAiImageOptions(model, body);
  if (provider === 'together') return buildTogetherImageOptions(model, body);
  if (provider === 'gemini') return buildGeminiImageOptions(model, body);
  if (provider === 'xai') return buildXaiImageOptions(model, body);
  throw makeStageError('generation', 'PROVIDER_INVALID', `Provider profili bulunamadı: ${provider}`, [`model=${ss(model?.model)}`], false, 400);
}

function buildGenerationAttemptPlans(model, body) {
  const provider = normalizeProviderRegistry(model?.provider, model?.model);
  const plans = [];
  const requestedRatio = body?.ratio || '1:1';
  const requestedQuality = body?.quality || 'medium';
  const fallbackRatios = [requestedRatio, '1:1'];
  const fallbackQualities = [requestedQuality, 'medium', 'high', 'low'];

  if (provider === 'openai-image-generation') {
    for (const q of fallbackQualities) {
      for (const r of fallbackRatios) {
        const draftBody = { ...body, quality: q, ratio: r };
        plans.push({
          index: plans.length + 1,
          timeoutMs: 26000 + plans.length * 2500,
          prompt: buildPromptText(body?.prompt, body?.negativePrompt, provider),
          options: buildProviderSpecificOptions(model, draftBody)
        });
        if (plans.length >= MAX_GENERATION_ATTEMPTS) return plans;
      }
    }
  } else if (provider === 'together') {
    const togetherBodies = [
      { ...body },
      { ...body, ratio: requestedRatio || '1:1' },
      { ...body, ratio: '1:1' }
    ];
    for (const draftBody of togetherBodies) {
      plans.push({
        index: plans.length + 1,
        timeoutMs: 28000 + plans.length * 3000,
        prompt: buildPromptText(body?.prompt, body?.negativePrompt, provider),
        options: buildProviderSpecificOptions(model, draftBody)
      });
      if (plans.length >= MAX_GENERATION_ATTEMPTS) return plans;
    }
  } else if (provider === 'gemini') {
    const geminiBodies = [
      { ...body },
      { ...body, ratio: '1:1' }
    ];
    for (const draftBody of geminiBodies) {
      plans.push({
        index: plans.length + 1,
        timeoutMs: 30000 + plans.length * 3500,
        prompt: buildPromptText(body?.prompt, body?.negativePrompt, provider),
        options: buildProviderSpecificOptions(model, draftBody)
      });
      if (plans.length >= MAX_GENERATION_ATTEMPTS) return plans;
    }
  } else {
    plans.push({
      index: 1,
      timeoutMs: 26000,
      prompt: buildPromptText(body?.prompt, body?.negativePrompt, provider),
      options: buildProviderSpecificOptions(model, body)
    });
  }
  return plans;
}

function dataUrlToBlob(dataUrl) {
  const match = /^data:([^;,]+)?(;base64)?,(.*)$/i.exec(dataUrl || '');
  if (!match) throw new Error('Geçersiz data URL');
  const mime = match[1] || 'application/octet-stream';
  const isBase64 = !!match[2];
  const dataPart = match[3] || '';
  let bytes;
  if (isBase64) {
    const binary = atob(dataPart);
    bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  } else {
    const text = decodeURIComponent(dataPart);
    bytes = new TextEncoder().encode(text);
  }
  return new Blob([bytes], { type: mime });
}

function guessExtensionFromMime(mimeType) {
  const mime = ss(mimeType, 'image/png').toLowerCase();
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'png';
}

function guessExtensionFromDataUrl(dataUrl) {
  const m = /^data:([^;,]+)/i.exec(dataUrl || '');
  const mime = (m && m[1]) ? m[1].toLowerCase() : 'image/png';
  return guessExtensionFromMime(mime);
}

function buildRelativeAssetPath(jobId, ext) {
  const d = new Date();
  const yyyy = String(d.getUTCFullYear());
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const safeJobId = sanitizePathPart(jobId, 'job');
  return `${yyyy}/${mm}/${dd}/${safeJobId}.${ext}`;
}

function getStorageRootCandidates() {
  const seen = new Set();
  const list = [];
  for (const item of STORAGE_ROOT_CANDIDATES) {
    const normalized = ss(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    list.push(normalized);
  }
  return list;
}

function attachBullets(error, bullets) {
  try {
    error.bullets = Array.isArray(bullets) ? bullets : [];
  } catch (_) {}
  return error;
}


function storageLogLine(jobId, inputPath, resolvedPath, writeOk, statOk, readUrlOk, failCode) {
  return [
    'STORAGE_STEP',
    ss(jobId, '-'),
    ss(inputPath, '-'),
    ss(resolvedPath, '-'),
    writeOk ? 'true' : 'false',
    statOk ? 'true' : 'false',
    readUrlOk ? 'true' : 'false',
    ss(failCode, 'OK')
  ].join(', ');
}

function storageStepMeta(jobId, inputPath, resolvedPath = '', writeOk = false, statOk = false, readUrlOk = false, failCode = 'OK', extraBullets = []) {
  const line = storageLogLine(jobId, inputPath, resolvedPath, writeOk, statOk, readUrlOk, failCode);
  console.log(line);
  return {
    line,
    bullets: [
      line,
      ...((Array.isArray(extraBullets) ? extraBullets : []).filter(Boolean))
    ]
  };
}

function normalizeBase64ToBlob(base64Value, mimeType = 'image/png') {
  const cleaned = ss(base64Value).replace(/^data:[^,]+,/, '').replace(/\s+/g, '');
  if (!cleaned) throw new Error('Boş base64 veri');
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mimeType });
}

function getStorageFailCode(error) {
  const code = ss(error?.code);
  if (code) return code;
  return 'STORAGE_FAILED';
}

async function mkdirIfPossible(path) {
  try {
    if (typeof me?.puter?.fs?.mkdir !== 'function') return false;
    await me.puter.fs.mkdir(path, { recursive: true });
    return true;
  } catch (_) {
    return false;
  }
}


async function withTimeout(promise, ms) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Zaman aşımı (${ms} ms)`)), ms);
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    clearTimeout(timer);
  }
}

async function kvGet(key) {
  const raw = await me.puter.kv.get(key);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

function slimJobForKv(job) {
  const j = JSON.parse(JSON.stringify(job));
  delete j.inlinePreview;
  delete j.rawDataUrl;
  if (j.step && j.step.length > 2000) j.step = j.step.slice(0, 2000);
  if (j.error?.message && j.error.message.length > 1200) j.error.message = j.error.message.slice(0, 1200);
  let str = JSON.stringify(j);
  if (str.length <= KV_SAFE_LIMIT) return j;
  if (j.requestSummary) j.requestSummary.promptPreview = '';
  str = JSON.stringify(j);
  if (str.length <= KV_SAFE_LIMIT) return j;
  delete j.outputUrls;
  str = JSON.stringify(j);
  if (str.length <= KV_SAFE_LIMIT) return j;
  delete j.request;
  str = JSON.stringify(j);
  if (str.length <= KV_SAFE_LIMIT) return j;
  return {
    jobId: j.jobId,
    feature: j.feature,
    status: j.status,
    progress: j.progress,
    step: j.step || 'Kısaltılmış kayıt',
    retryable: j.retryable,
    cancelRequested: j.cancelRequested,
    model: j.model,
    modelInfo: j.modelInfo,
    storage: j.storage,
    outputUrl: j.outputUrl,
    outputUrlExpiresAt: j.outputUrlExpiresAt,
    requestSummary: j.requestSummary,
    error: j.error,
    createdAt: j.createdAt,
    updatedAt: j.updatedAt,
    finishedAt: j.finishedAt
  };
}

async function kvSet(key, value) {
  const payload = JSON.stringify(slimJobForKv(value));
  await me.puter.kv.set(key, payload);
}

async function kvList(prefix) {
  try {
    const res = await me.puter.kv.list(prefix);
    const arr = Array.isArray(res) ? res : (Array.isArray(res?.keys) ? res.keys : []);
    return arr.map((item) => typeof item === 'string' ? item : item?.key).filter(Boolean);
  } catch (_) {
    return [];
  }
}

async function jobRead(jobId) {
  return kvGet(JOB_PREFIX + jobId);
}

async function jobWrite(job) {
  const next = { ...job, updatedAt: nowIso() };
  await kvSet(JOB_PREFIX + next.jobId, next);
  return next;
}

async function jobUpdate(jobId, updater) {
  const current = (await jobRead(jobId)) || { jobId };
  const next = await updater({ ...current });
  return jobWrite(next);
}

async function listJobs(limit = HISTORY_LIMIT) {
  const keys = await kvList(JOB_PREFIX);
  const jobs = [];
  for (const key of keys) {
    try {
      const item = await kvGet(key);
      if (item?.jobId) jobs.push(item);
    } catch (_) {}
  }
  jobs.sort((a, b) => ss(b.updatedAt || b.createdAt).localeCompare(ss(a.updatedAt || a.createdAt)));
  return jobs.slice(0, ci(limit, 1, 50, HISTORY_LIMIT));
}

async function ensureFreshReadUrl(job) {
  if (!job?.storage?.path) return job;
  const now = nowMs();
  const exp = job.outputUrlExpiresAt ? Date.parse(job.outputUrlExpiresAt) : 0;
  if (job.outputUrl && exp && (exp - now > 5 * 60 * 1000)) return job;
  try {
    const freshUrl = await me.puter.fs.getReadURL(job.storage.path, URL_EXPIRES_MS);
    job.outputUrl = freshUrl;
    job.outputUrls = freshUrl ? [freshUrl] : [];
    job.outputUrlExpiresAt = new Date(now + URL_EXPIRES_MS).toISOString();
    await jobWrite(job);
  } catch (_) {}
  return job;
}

async function sourceToBlob(src) {
  if (src instanceof Blob) {
    if (!src.size) throw new Error('Blob boş döndü');
    return src;
  }
  if (src instanceof Uint8Array) {
    if (!src.byteLength) throw new Error('Uint8Array boş döndü');
    return new Blob([src], { type: 'image/png' });
  }
  if (src instanceof ArrayBuffer) {
    if (!src.byteLength) throw new Error('ArrayBuffer boş döndü');
    return new Blob([src], { type: 'image/png' });
  }
  if (typeof src === 'object' && src?.base64) {
    return normalizeBase64ToBlob(src.base64, ss(src.mimeType, 'image/png'));
  }
  if (typeof src === 'string' && src.startsWith('data:')) return dataUrlToBlob(src);
  if (typeof src === 'string' && /^https?:\/\//i.test(src)) {
    const response = await withTimeout(fetch(src), 20000);
    if (!response.ok) throw new Error(`Uzak görsel indirilemedi (HTTP ${response.status})`);
    const blob = await response.blob();
    if (!blob || !blob.size) throw new Error('Uzak görsel boş döndü');
    return blob;
  }
  if (typeof src === 'string' && /^[A-Za-z0-9+/=\s]+$/.test(src) && src.length > 64) {
    return normalizeBase64ToBlob(src, 'image/png');
  }
  throw new Error('Geçersiz görsel kaynağı');
}

async function tryWriteToStorageCandidate(jobId, root, relativePath, blob) {
  const attemptedPath = joinFsPath(root, relativePath);
  const parentPath = attemptedPath.split('/').slice(0, -1).join('/');
  let writeResult = null;
  let resolvedPath = attemptedPath;
  let statInfo = null;
  let readUrl = null;
  let writeOk = false;
  let statOk = false;
  let readUrlOk = false;

  await mkdirIfPossible(parentPath);

  try {
    writeResult = await me.puter.fs.write(attemptedPath, blob, {
      overwrite: true,
      createMissingParents: true,
      dedupeName: false
    });
    resolvedPath = ss(writeResult?.path || writeResult?.item?.path || attemptedPath, attemptedPath);
    writeOk = true;
  } catch (writeError) {
    const meta = storageStepMeta(jobId, attemptedPath, resolvedPath, writeOk, statOk, readUrlOk, 'WRITE_FAIL', [
      `root=${root}`,
      normalizeError(writeError)
    ]);
    throw makeStageError('storage', 'WRITE_FAIL', `Dosya yazılamadı: ${normalizeError(writeError)}`, meta.bullets, true, 500);
  }

  try {
    statInfo = await me.puter.fs.stat(resolvedPath);
    statOk = true;
  } catch (statError) {
    try {
      statInfo = await me.puter.fs.stat(attemptedPath);
      statOk = true;
      resolvedPath = ss(statInfo?.path || resolvedPath, resolvedPath);
    } catch (fallbackStatError) {
      const meta = storageStepMeta(jobId, attemptedPath, resolvedPath, writeOk, statOk, readUrlOk, 'STAT_FAIL', [
        `root=${root}`,
        `primaryStat=${normalizeError(statError)}`,
        `fallbackStat=${normalizeError(fallbackStatError)}`
      ]);
      throw makeStageError('storage', 'STAT_FAIL', `Dosya doğrulanamadı: ${normalizeError(statError)}`, meta.bullets, true, 500);
    }
  }

  const finalPath = ss(statInfo?.path || resolvedPath, resolvedPath);

  try {
    readUrl = await me.puter.fs.getReadURL(finalPath, URL_EXPIRES_MS);
    readUrlOk = Boolean(readUrl);
    if (!readUrlOk) throw new Error('Boş read URL');
  } catch (readUrlError) {
    const meta = storageStepMeta(jobId, attemptedPath, finalPath, writeOk, statOk, readUrlOk, 'READ_URL_FAIL', [
      `root=${root}`,
      normalizeError(readUrlError)
    ]);
    throw makeStageError('storage', 'READ_URL_FAIL', `Okuma URL alınamadı: ${normalizeError(readUrlError)}`, meta.bullets, true, 500);
  }

  const meta = storageStepMeta(jobId, attemptedPath, finalPath, writeOk, statOk, readUrlOk, 'OK', [`root=${root}`]);
  return {
    attemptedPath,
    resolvedPath: finalPath,
    readUrl,
    root,
    statInfo,
    logLine: meta.line
  };
}

async function persistGeneratedImage(jobId, source) {
  const blob = await sourceToBlob(source);
  const ext = typeof source === 'string' && source.startsWith('data:')
    ? guessExtensionFromDataUrl(source)
    : guessExtensionFromMime(blob.type || 'image/png');
  const mimeType = blob.type || `image/${ext}`;
  const relativePath = buildRelativeAssetPath(jobId, ext);
  const attempts = [];

  for (const root of getStorageRootCandidates()) {
    try {
      const stored = await tryWriteToStorageCandidate(jobId, root, relativePath, blob);
      const fileName = stored.resolvedPath.split('/').pop();
      return {
        path: stored.resolvedPath,
        attemptedPath: stored.attemptedPath,
        storageRoot: root,
        fileName,
        mimeType,
        readUrl: stored.readUrl,
        expiresAt: new Date(nowMs() + URL_EXPIRES_MS).toISOString(),
        triedRoots: attempts.map((item) => item.root),
        logLine: stored.logLine
      };
    } catch (error) {
      attempts.push({ root, error: normalizeError(error), code: getStorageFailCode(error) });
    }
  }

  const bullets = attempts.map((item, index) => `${index + 1}. ${item.root} → [${item.code}] ${item.error}`);
  const lastCode = attempts.length ? attempts[attempts.length - 1].code : 'STORAGE_FAILED';
  const err = makeStageError('storage', lastCode, 'Görsel üretildi ancak me.puter depolama klasörlerinin hiçbirine yazılamadı.', bullets, true, 500);
  throw err;
}

function baseJobRecord(jobId, prompt, negativePrompt, ratio, quality, style, model) {
  return {
    jobId,
    feature: 'image',
    status: 'queued',
    progress: 5,
    step: 'İstek alındı',
    retryable: true,
    cancelRequested: false,
    model: model?.model || model?.modelId || DEFAULT_IMAGE_MODEL,
    modelInfo: model || null,
    storage: {
      path: null,
      attemptedPath: null,
      storageRoot: null,
      verified: false,
      mimeType: null,
      fileName: null
    },
    outputUrl: null,
    outputUrlExpiresAt: null,
    outputUrls: [],
    requestSummary: {
      model: model?.model || model?.modelId || DEFAULT_IMAGE_MODEL,
      promptPreview: prompt.length <= 160 ? prompt : `${prompt.slice(0, 157)}...`,
      ratio: ss(ratio, '1:1'),
      quality: ss(quality, ''),
      style: style || '-',
      negativePromptPreview: negativePrompt ? (negativePrompt.length <= 120 ? negativePrompt : `${negativePrompt.slice(0, 117)}...`) : ''
    },
    request: {
      modelId: model?.model || model?.modelId || DEFAULT_IMAGE_MODEL,
      provider: normalizeProviderRegistry(model?.provider, model?.model || model?.modelId),
      ratio: ss(ratio, '1:1'),
      quality: ss(quality, ''),
      style: ss(style, ''),
      negativePrompt: ss(negativePrompt, ''),
      n: 1
    },
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    finishedAt: null
  };
}

async function runGeneration(jobId, prompt, negativePrompt, ratio, quality, style, model, body = {}) {
  const provider = normalizeProviderRegistry(model?.provider, model?.model || model?.modelId);
  const requestedBody = {
    ...body,
    prompt,
    negativePrompt,
    ratio,
    quality,
    style,
    n: ci(body?.n, 1, 4, 1)
  };

  await jobUpdate(jobId, async (job) => ({
    ...job,
    status: 'running',
    progress: 12,
    step: `Model hazırlanıyor (${provider})`
  }));

  const plans = buildGenerationAttemptPlans(model, requestedBody);
  const attemptErrors = [];
  let src = null;

  for (const plan of plans) {
    const currentJob = await jobRead(jobId);
    if (currentJob?.cancelRequested) {
      throw makeStageError('generation', 'JOB_CANCELLED', 'İş kullanıcı tarafından iptal edildi.', [], false, 409);
    }
    const progress = Math.min(64, 18 + Math.floor((plan.index / Math.max(1, plans.length)) * 42));
    await jobUpdate(jobId, async (job) => ({
      ...job,
      status: 'running',
      progress,
      step: `AI görsel üretiyor (deneme ${plan.index}/${plans.length})`
    }));

    try {
      const imageResult = await withTimeout(me.puter.ai.txt2img(plan.prompt, plan.options), plan.timeoutMs);
      src = extractImageSrc(imageResult);
      if (!src) {
        throw new Error('AI sonuç döndürdü ancak görsel kaynağı bulunamadı');
      }
      break;
    } catch (error) {
      const message = normalizeError(error);
      attemptErrors.push(`Deneme ${plan.index}: ${message}`);
      if (/field_invalid|model is invalid|valid model name/i.test(message)) {
        throw makeStageError(
          'generation',
          'MODEL_INVALID',
          'Seçilen model Puter image registry içinde bulunamadı veya provider ile eşleşmedi.',
          [`requestedModel=${ss(model?.model || model?.modelId)}`, `provider=${provider}`, message],
          false,
          400
        );
      }
    }
  }

  if (!src) {
    throw makeStageError(
      'generation',
      'GENERATION_FAILED',
      `Görsel üretimi ${plans.length} denemeye rağmen tamamlanamadı.`,
      attemptErrors.slice(0, 10),
      true,
      500
    );
  }

  await jobUpdate(jobId, async (job) => ({
    ...job,
    status: 'storing',
    progress: 72,
    step: 'Görsel depolamaya yazılıyor'
  }));

  const stored = await persistGeneratedImage(jobId, src);

  try {
    await jobUpdate(jobId, async (job) => ({
      ...job,
      status: 'completed',
      progress: 100,
      step: 'Tamamlandı',
      finishedAt: nowIso(),
      storage: {
        path: stored.path,
        attemptedPath: stored.attemptedPath,
        storageRoot: stored.storageRoot,
        verified: true,
        mimeType: stored.mimeType,
        fileName: stored.fileName
      },
      outputUrl: stored.readUrl,
      outputUrls: stored.readUrl ? [stored.readUrl] : [],
      outputUrlExpiresAt: stored.expiresAt,
      error: null
    }));
  } catch (kvError) {
    throw makeStageError('storage', 'KV_FAIL', `KV tamamlandı kaydı yazılamadı: ${normalizeError(kvError)}`, [
      ss(stored?.logLine),
      `storagePath=${ss(stored?.path)}`,
      normalizeError(kvError)
    ], true, 500);
  }

  return {
    job: await jobRead(jobId),
    inlinePreview: src
  };
}

router.options('/*page', async ({ request }) => {
  return new Response(null, { status: 204, headers: corsHeaders(request) });
});

router.get('/', async ({ request }) => {
  const startedAt = nowMs();
  const requestId = uid('info');
  const traceId = uid('trace');
  try {
    const catalog = await getImageCatalog(false);
    return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'WORKER_INFO', {
      worker: WORKER_NAME,
      version: WORKER_VERSION,
      totalModels: catalog.items.length,
      modelsSource: catalog.source,
      pollIntervalMs: POLL_INTERVAL_HINT_MS,
      storageCandidates: getStorageRootCandidates()
    }), 200, 'no-store', request);
  } catch (error) {
    return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'WORKER_INFO_FAILED', normalizeError(error), [], 500), 500, 'no-store', request);
  }
});

router.get('/health', async ({ request }) => {
  const startedAt = nowMs();
  const requestId = uid('health');
  const traceId = uid('trace');
  return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'HEALTH_OK', {
    status: 'ok',
    worker: WORKER_NAME,
    version: WORKER_VERSION,
    storageMode: 'me.puter.fs',
    modelSource: MODELS_WORKER_URL
  }), 200, 'no-store', request);
});

router.get('/models', async ({ request }) => {
  const startedAt = nowMs();
  const requestId = uid('models');
  const traceId = uid('trace');
  try {
    return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'MODELS_OK', await buildModelsPayload()), 200, 'public, max-age=300', request);
  } catch (error) {
    return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'MODELS_FAILED', normalizeError(error), [], 500), 500, 'no-store', request);
  }
});

router.post('/generate', async ({ request }) => {
  const startedAt = nowMs();
  const requestId = uid('gen');
  const traceId = uid('trace');
  let jobId = null;
  try {
    const body = await request.json();
    const prompt = ss(body?.prompt);
    const negativePrompt = ss(body?.negativePrompt);
    const ratio = body?.ratio || '1:1';
    const quality = ss(body?.quality || 'medium', 'medium');
    const style = ss(body?.style, '');
    if (!prompt) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'PROMPT_REQUIRED', 'Prompt alanı boş bırakılamaz.', [], 400), 400, 'no-store', request);
    }

    const catalog = await getImageCatalog(false);
    const requestedModel = ss(body?.modelId || body?.model);
    const model = findRequestedModel(catalog.items, requestedModel);
    if (!model) {
      return jsonResponse(
        errEnvelope(requestId, traceId, startedAt, 'MODEL_INVALID', 'Seçilen model Puter image registry içinde bulunamadı.', [
          `requestedModel=${requestedModel || '-'}`,
          `modelsSource=${catalog.source}`
        ], 400),
        400,
        'no-store',
        request
      );
    }

    const provider = normalizeProviderRegistry(model.provider, model.model || model.modelId);
    if (!ALLOWED_IMAGE_PROVIDERS.has(provider)) {
      return jsonResponse(
        errEnvelope(requestId, traceId, startedAt, 'PROVIDER_INVALID', 'Seçilen model için image provider profili bulunamadı.', [
          `requestedModel=${ss(model.model || model.modelId)}`,
          `provider=${provider}`
        ], 400),
        400,
        'no-store',
        request
      );
    }

    jobId = uid('img');
    await jobWrite(baseJobRecord(jobId, prompt, negativePrompt, ratio, quality, style, model));

    try {
      const result = await runGeneration(jobId, prompt, negativePrompt, ratio, quality, style, model, body);
      return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'IMAGE_JOB_COMPLETED', result.job, {
        feature: 'image',
        model: model.model || model.modelId,
        provider,
        modelsSource: catalog.source,
        inlinePreview: result.inlinePreview
      }), 200, 'no-store', request);
    } catch (generationError) {
      const bullets = Array.isArray(generationError?.bullets) ? generationError.bullets : [];
      const stage = ss(generationError?.stage, 'generation');
      const code = ss(generationError?.code, stage === 'storage' ? 'STORAGE_FAILED' : 'GENERATION_FAILED');
      const httpStatus = ci(generationError?.httpStatus, 400, 599, stage === 'storage' ? 500 : 500);
      const failedStatus = code === 'JOB_CANCELLED' ? 'cancelled' : stage === 'storage' ? 'failed_storage' : 'failed';
      const failedStep = code === 'JOB_CANCELLED'
        ? 'İş iptal edildi'
        : stage === 'storage'
          ? 'Görsel üretildi ancak depolama başarısız oldu'
          : 'Görsel üretimi başarısız oldu';

      await jobUpdate(jobId, async (job) => ({
        ...job,
        status: failedStatus,
        progress: 100,
        step: failedStep,
        finishedAt: nowIso(),
        error: {
          message: normalizeError(generationError),
          retryable: httpStatus >= 500,
          bullets
        }
      }));
      const failedJob = await jobRead(jobId);
      const publicMessage = code === 'MODEL_INVALID'
        ? 'Seçilen model Puter image registry içinde bulunamadı.'
        : code === 'JOB_CANCELLED'
          ? 'İş kullanıcı tarafından iptal edildi.'
          : stage === 'storage'
            ? 'Görsel üretimi tamamlandı ancak me.puter depolamaya yazılamadı.'
            : 'Görsel üretimi tamamlanamadı.';
      return jsonResponse(
        errEnvelope(requestId, traceId, startedAt, code, publicMessage, bullets, httpStatus, {
          feature: 'image',
          stage,
          job: failedJob,
          provider,
          modelsSource: catalog.source
        }),
        httpStatus,
        'no-store',
        request
      );
    }
  } catch (error) {
    const message = normalizeError(error);
    if (jobId) {
      try {
        await jobUpdate(jobId, async (job) => ({
          ...job,
          status: 'failed',
          progress: 100,
          step: 'Ana çöküş',
          finishedAt: nowIso(),
          error: { message, retryable: true }
        }));
      } catch (_) {}
    }
    return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'ERR', `Ana çöküş: ${message}`, [], 500), 500, 'no-store', request);
  }
});

router.get('/jobs/status/:id', async ({ request, params }) => {
  const startedAt = nowMs();
  const requestId = uid('status');
  const traceId = uid('trace');
  try {
    const jobId = ss(params?.id);
    if (!jobId) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'JOB_ID_REQUIRED', 'jobId eksik.', [], 400), 400, 'no-store', request);
    }
    let job = await jobRead(jobId);
    if (!job) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'NOT_FOUND', 'Job bulunamadı.', [], 404), 404, 'no-store', request);
    }
    if (job.status === 'completed' && job.storage?.path) {
      job = await ensureFreshReadUrl(job);
    }
    return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'JOB_STATUS_OK', job, { feature: 'image' }), 200, 'no-store', request);
  } catch (error) {
    return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'ERR', normalizeError(error), [], 500), 500, 'no-store', request);
  }
});

router.get('/jobs/history', async ({ request }) => {
  const startedAt = nowMs();
  const requestId = uid('history');
  const traceId = uid('trace');
  try {
    const items = await listJobs(HISTORY_LIMIT);
    const hydrated = [];
    for (let job of items) {
      if (job.status === 'completed' && job.storage?.path) {
        job = await ensureFreshReadUrl(job);
      }
      hydrated.push(job);
    }
    return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'JOB_HISTORY_OK', {
      items: hydrated,
      total: hydrated.length,
      limit: HISTORY_LIMIT,
      feature: 'image'
    }), 200, 'no-store', request);
  } catch (error) {
    return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'ERR', normalizeError(error), [], 500), 500, 'no-store', request);
  }
});

router.get('/jobs/image/:id', async ({ request, params }) => {
  const startedAt = nowMs();
  const requestId = uid('image');
  const traceId = uid('trace');
  try {
    const jobId = ss(params?.id);
    if (!jobId) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'JOB_ID_REQUIRED', 'jobId eksik.', [], 400), 400, 'no-store', request);
    }
    let job = await jobRead(jobId);
    if (!job) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'NOT_FOUND', 'Job bulunamadı.', [], 404), 404, 'no-store', request);
    }
    if (job.status !== 'completed' || !job.storage?.path) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'IMAGE_NOT_READY', 'Görsel henüz kalıcı olarak hazır değil.', [], 409), 409, 'no-store', request);
    }
    job = await ensureFreshReadUrl(job);
    return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'JOB_IMAGE_URL_OK', {
      jobId: job.jobId,
      storagePath: job.storage.path,
      outputUrl: job.outputUrl,
      outputUrlExpiresAt: job.outputUrlExpiresAt,
      mimeType: job.storage.mimeType,
      fileName: job.storage.fileName,
      storageRoot: job.storage.storageRoot,
      attemptedPath: job.storage.attemptedPath
    }, { feature: 'image' }), 200, 'no-store', request);
  } catch (error) {
    return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'ERR', normalizeError(error), [], 500), 500, 'no-store', request);
  }
});

router.post('/jobs/cancel', async ({ request }) => {
  const startedAt = nowMs();
  const requestId = uid('cancel');
  const traceId = uid('trace');
  try {
    const body = await request.json();
    const jobId = ss(body?.jobId);
    if (!jobId) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'JOB_ID_REQUIRED', 'jobId eksik.', [], 400), 400, 'no-store', request);
    }
    const current = await jobRead(jobId);
    if (!current) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'NOT_FOUND', 'Job bulunamadı.', [], 404), 404, 'no-store', request);
    }
    const updated = await jobUpdate(jobId, async (job) => ({
      ...job,
      cancelRequested: true,
      status: ['queued', 'running', 'storing', 'processing'].includes(job.status) ? 'cancelled' : job.status,
      step: ['queued', 'running', 'storing', 'processing'].includes(job.status) ? 'İptal edildi' : job.step,
      finishedAt: ['queued', 'running', 'storing', 'processing'].includes(job.status) ? nowIso() : job.finishedAt
    }));
    return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'JOB_CANCEL_OK', updated), 200, 'no-store', request);
  } catch (error) {
    return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'ERR', normalizeError(error), [], 500), 500, 'no-store', request);
  }
});
