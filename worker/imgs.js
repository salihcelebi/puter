// imgs.js — v19.0.0
// me.puter owner-pays image worker
// Model catalog source: https://models-worker.puter.work/models
// Storage strategy: try multiple candidate folders in order, use first successful real path

const WORKER_NAME = 'imgs';
const WORKER_VERSION = '19.2.0';
const STORAGE_CACHE_KEY = 'imgs:storage:working_root';
const JOB_PREFIX = 'ai_job:';
const HISTORY_LIMIT = 20;
const KV_SAFE_LIMIT = 390000;
const URL_EXPIRES_MS = 24 * 60 * 60 * 1000;
const POLL_INTERVAL_HINT_MS = 1800;
const PROVIDER = 'openai-image-generation';
const MAX_GENERATION_ATTEMPTS = 20;
const MODELS_WORKER_URL = 'https://models-worker.puter.work/models?limit=250';
const MODELS_CACHE_TTL_MS = 5 * 60 * 1000;
const DEFAULT_IMAGE_MODEL = 'openai/gpt-image-1';
const STORAGE_ROOT_CANDIDATES = Object.freeze([
  '/nisanil/Desktop/turk/img/idm_images',
  'Desktop/turk/img/idm_images',
  'turk/img/idm_images',
  'img/idm_images',
  'idm_images'
]);

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
    return s && s !== '{}' ? s.slice(0, 800) : 'Hata okunamadı';
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
    'vary': 'origin'
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

function qualityToImageQuality(quality) {
  const q = ss(quality, 'standard').toLowerCase();
  return q === 'hd' ? 'hd' : 'standard';
}

function ratioToSize(ratio) {
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

function extractImageSrc(result) {
  if (!result) return null;
  if (typeof result === 'string') return result.trim();
  if (typeof result.src === 'string') return result.src.trim();
  if (typeof result?.image?.src === 'string') return result.image.src.trim();
  return null;
}

function normalizeCatalogEntry(item) {
  const modelId = ss(item?.modelId || item?.id);
  if (!modelId) return null;
  return {
    ...item,
    id: ss(item?.id, modelId),
    modelId,
    modelName: ss(item?.modelName, modelId.split('/')[1] || modelId),
    provider: ss(item?.provider || item?.company, modelId.split('/')[0] || 'unknown'),
    company: ss(item?.company || item?.provider, item?.provider || 'unknown'),
    categoryRaw: ss(item?.categoryRaw, ''),
    badges: Array.isArray(item?.badges) ? item.badges : []
  };
}

function isImageCatalogModel(item) {
  return ss(item?.categoryRaw).toLowerCase() === 'image generation';
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
  return items.find((item) => ss(item?.modelId) === wanted || ss(item?.id) === wanted) || items[0] || null;
}

function buildPromptText(prompt, negativePrompt) {
  const cleanPrompt = ss(prompt, '');
  const cleanNegative = ss(negativePrompt, '');
  if (!cleanNegative) return cleanPrompt;
  return `${cleanPrompt}\n\nAvoid / Negative prompt: ${cleanNegative}`;
}

function buildGenerationAttemptPlans(ratio, quality, style) {
  const normalizedRatio = ss(ratio, '1:1');
  const requestedQuality = qualityToImageQuality(quality);
  const requestedStyle = ss(style, '').toLowerCase();

  const ratioCandidates = [normalizedRatio, '1:1', '16:9', '9:16', '4:5', '3:4'];
  const qualityCandidates = [requestedQuality, 'standard', 'hd'];
  const styleCandidates = [requestedStyle, 'vivid', 'natural', ''];
  const plans = [];

  for (const r of ratioCandidates) {
    for (const q of qualityCandidates) {
      for (const s of styleCandidates) {
        if (plans.length >= MAX_GENERATION_ATTEMPTS) break;
        const opts = {
          provider: PROVIDER,
          test_mode: false,
          quality: q,
          ratio: ratioToSize(r)
        };
        if (s) opts.style = s;
        plans.push({
          index: plans.length + 1,
          ratio: r,
          quality: q,
          style: s || '-',
          timeoutMs: 25000 + (plans.length * 1500),
          opts
        });
      }
      if (plans.length >= MAX_GENERATION_ATTEMPTS) break;
    }
    if (plans.length >= MAX_GENERATION_ATTEMPTS) break;
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

async function getStorageRootCandidates() {
  const seen = new Set();
  const list = [];
  const cached = await getCachedStorageRoot();
  const all = cached ? [cached, ...STORAGE_ROOT_CANDIDATES] : STORAGE_ROOT_CANDIDATES;
  for (const item of all) {
    const normalized = ss(item);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    list.push(normalized);
  }
  return list;
}



function makeEvent(type, message, extra = null) {
  return {
    time: nowIso(),
    type: ss(type, 'info'),
    message: ss(message, ''),
    extra: extra || null
  };
}

function pushJobEvent(job, type, message, extra = null) {
  const list = Array.isArray(job?.events) ? job.events.slice(-39) : [];
  list.push(makeEvent(type, message, extra));
  return list;
}

function attachBullets(error, bullets) {
  try {
    error.bullets = Array.isArray(bullets) ? bullets : [];
  } catch (_) {}
  return error;
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



async function getCachedStorageRoot() {
  try {
    const raw = await me.puter.kv.get(STORAGE_CACHE_KEY);
    if (!raw) return '';
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        return ss(parsed?.root || parsed?.path || parsed, '');
      } catch (_) {
        return ss(raw, '');
      }
    }
    return ss(raw?.root || raw?.path, '');
  } catch (_) {
    return '';
  }
}

async function setCachedStorageRoot(root) {
  const value = ss(root, '');
  if (!value) return;
  try {
    await me.puter.kv.set(STORAGE_CACHE_KEY, JSON.stringify({ root: value, savedAt: nowIso() }));
  } catch (_) {}
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
  if (src && src.startsWith('data:')) return dataUrlToBlob(src);
  if (src && /^https?:\/\//i.test(src)) {
    const response = await withTimeout(fetch(src), 20000);
    if (!response.ok) throw new Error(`Uzak görsel indirilemedi (HTTP ${response.status})`);
    const blob = await response.blob();
    if (!blob || !blob.size) throw new Error('Uzak görsel boş döndü');
    return blob;
  }
  throw new Error('Geçersiz görsel kaynağı');
}

async function tryWriteToStorageCandidate(root, relativePath, blob) {
  const attemptedPath = joinFsPath(root, relativePath);
  const writeResult = await me.puter.fs.write(attemptedPath, blob, {
    overwrite: true,
    createMissingParents: true,
    dedupeName: false
  });
  const resolvedPath = ss(writeResult?.path || writeResult?.item?.path || attemptedPath, attemptedPath);
  let statOk = false;
  let statInfo = null;
  try {
    statInfo = await me.puter.fs.stat(resolvedPath);
    statOk = true;
  } catch (statError) {
    try {
      statInfo = await me.puter.fs.stat(attemptedPath);
      statOk = true;
    } catch (_) {
      throw attachBullets(new Error(`Dosya yazıldı gibi göründü ama doğrulanamadı: ${normalizeError(statError)}`), [
        `attemptedPath=${attemptedPath}`,
        `resolvedPath=${resolvedPath}`,
        'write başarılı, stat başarısız'
      ]);
    }
  }
  const finalPath = statOk ? ss(statInfo?.path || resolvedPath, resolvedPath) : resolvedPath;
  const readUrl = await me.puter.fs.getReadURL(finalPath, URL_EXPIRES_MS);
  return {
    attemptedPath,
    resolvedPath: finalPath,
    readUrl,
    root,
    statInfo
  };
}

async function persistGeneratedImage(jobId, source) {
  const blob = await sourceToBlob(source);
  const ext = source && source.startsWith('data:')
    ? guessExtensionFromDataUrl(source)
    : guessExtensionFromMime(blob.type || 'image/png');
  const mimeType = blob.type || `image/${ext}`;
  const relativePath = buildRelativeAssetPath(jobId, ext);
  const attempts = [];
  const roots = await getStorageRootCandidates();

  await jobUpdate(jobId, async (job) => ({
    ...job,
    progress: 74,
    step: 'Depolama klasörleri hazırlanıyor',
    events: pushJobEvent(job, 'storage', 'Depolama root adayları hazırlandı', { roots })
  }));

  for (const root of roots) {
    const attemptedPath = joinFsPath(root, relativePath);
    try {
      await jobUpdate(jobId, async (job) => ({
        ...job,
        progress: 78,
        step: `Depolamaya yazılıyor: ${root}`,
        storage: {
          ...(job.storage || {}),
          attemptedPath,
          storageRoot: root
        },
        events: pushJobEvent(job, 'storage_attempt', 'Depolama yolu deneniyor', { root, attemptedPath })
      }));

      try {
        const dirOnly = attemptedPath.split('/').slice(0, -1).join('/');
        if (dirOnly) {
          await me.puter.fs.mkdir(dirOnly, { createMissingParents: true, dedupeName: false });
        }
      } catch (_) {}

      const stored = await tryWriteToStorageCandidate(root, relativePath, blob);
      const fileName = stored.resolvedPath.split('/').pop();
      await setCachedStorageRoot(root);
      await jobUpdate(jobId, async (job) => ({
        ...job,
        progress: 92,
        step: 'Depolama doğrulandı',
        storage: {
          ...(job.storage || {}),
          path: stored.resolvedPath,
          attemptedPath: stored.attemptedPath,
          storageRoot: root,
          verified: true,
          mimeType,
          fileName
        },
        events: pushJobEvent(job, 'storage_success', 'Depolama başarılı', {
          root,
          attemptedPath: stored.attemptedPath,
          resolvedPath: stored.resolvedPath
        })
      }));
      return {
        path: stored.resolvedPath,
        attemptedPath: stored.attemptedPath,
        storageRoot: root,
        fileName,
        mimeType,
        readUrl: stored.readUrl,
        expiresAt: new Date(nowMs() + URL_EXPIRES_MS).toISOString(),
        triedRoots: attempts.map((item) => item.root)
      };
    } catch (error) {
      const normalized = normalizeError(error);
      attempts.push({ root, error: normalized, attemptedPath });
      await jobUpdate(jobId, async (job) => ({
        ...job,
        progress: 80,
        step: `Depolama yolu başarısız: ${root}`,
        events: pushJobEvent(job, 'storage_error', 'Depolama yolu başarısız oldu', {
          root,
          attemptedPath,
          error: normalized
        })
      }));
    }
  }

  const bullets = attempts.map((item, index) => `${index + 1}. ${item.root} → ${item.error}`);
  throw attachBullets(new Error('Görsel üretildi ancak me.puter depolama klasörlerinin hiçbirine yazılamadı.'), bullets);
}

function baseJobRecord(jobId, prompt, negativePrompt, ratio, quality, style, model) {
  return {
    jobId,
    feature: 'image',
    status: 'processing',
    progress: 5,
    step: 'İstek alındı',
    retryable: true,
    cancelRequested: false,
    model: model?.modelId || DEFAULT_IMAGE_MODEL,
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
      model: model?.modelId || DEFAULT_IMAGE_MODEL,
      promptPreview: prompt.length <= 160 ? prompt : `${prompt.slice(0, 157)}...`,
      ratio,
      quality,
      style: style || '-',
      negativePromptPreview: negativePrompt ? (negativePrompt.length <= 120 ? negativePrompt : `${negativePrompt.slice(0, 117)}...`) : ''
    },
    request: {
      modelId: model?.modelId || DEFAULT_IMAGE_MODEL,
      ratio,
      quality,
      style,
      negativePrompt,
      n: 1
    },
    error: null,
    events: [makeEvent('info', 'İş oluşturuldu')],
    createdAt: nowIso(),
    updatedAt: nowIso(),
    finishedAt: null
  };
}

async function runGeneration(jobId, prompt, negativePrompt, ratio, quality, style, model) {
  const finalPrompt = buildPromptText(prompt, negativePrompt);
  await jobUpdate(jobId, async (job) => ({
    ...job,
    progress: 12,
    step: 'Model hazırlanıyor',
    events: pushJobEvent(job, 'info', 'Model ve üretim planı hazırlanıyor')
  }));

  const plans = buildGenerationAttemptPlans(ratio, quality, style);
  const attemptErrors = [];
  let src = null;

  for (const plan of plans) {
    const progress = Math.min(60, 18 + Math.floor((plan.index / plans.length) * 42));
    await jobUpdate(jobId, async (job) => ({
      ...job,
      progress,
      step: `AI görsel üretiyor (deneme ${plan.index}/${plans.length})`,
      events: pushJobEvent(job, 'ai_attempt', 'AI üretim denemesi başladı', { attempt: plan.index, total: plans.length, ratio: plan.ratio, quality: plan.quality, style: plan.style })
    }));

    try {
      const imageResult = await withTimeout(me.puter.ai.txt2img(finalPrompt, { ...plan.opts, model: model?.modelId || DEFAULT_IMAGE_MODEL }), plan.timeoutMs);
      src = extractImageSrc(imageResult);
      if (!src) throw new Error('AI boş sonuç döndürdü');
      break;
    } catch (error) {
      attemptErrors.push(`Deneme ${plan.index}: ${normalizeError(error)}`);
    }
  }

  if (!src) {
    const err = new Error(`Görsel üretimi ${plans.length} farklı denemeye rağmen tamamlanamadı.`);
    throw attachBullets(err, attemptErrors.slice(0, 10));
  }

  await jobUpdate(jobId, async (job) => ({
    ...job,
    progress: 72,
    step: 'Görsel depolamaya yazılıyor',
    events: pushJobEvent(job, 'storage', 'Görsel üretildi, depolama aşamasına geçildi')
  }));

  const stored = await persistGeneratedImage(jobId, src);

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
    error: null,
    events: pushJobEvent(job, 'done', 'İş başarıyla tamamlandı', { storagePath: stored.path, storageRoot: stored.storageRoot })
  }));

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
      storageCandidates: await getStorageRootCandidates(),
      cachedStorageRoot: await getCachedStorageRoot()
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
    modelSource: MODELS_WORKER_URL,
    cachedStorageRoot: await getCachedStorageRoot()
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
    const ratio = ss(body?.ratio || body?.size, '1:1');
    const quality = qualityToImageQuality(body?.quality || 'standard');
    const style = ss(body?.style, '');
    if (!prompt) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'PROMPT_REQUIRED', 'Prompt alanı boş bırakılamaz.', [], 400), 400, 'no-store', request);
    }

    const catalog = await getImageCatalog(false);
    const requestedModel = ss(body?.modelId || body?.model);
    const model = findRequestedModel(catalog.items, requestedModel);
    if (!model) {
      return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'MODEL_NOT_FOUND', 'Kullanılabilir görsel modeli bulunamadı.', [], 400), 400, 'no-store', request);
    }

    jobId = uid('img');
    await jobWrite(baseJobRecord(jobId, prompt, negativePrompt, ratio, quality, style, model));

    try {
      const result = await runGeneration(jobId, prompt, negativePrompt, ratio, quality, style, model);
      return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'IMAGE_JOB_COMPLETED', result.job, {
        feature: 'image',
        model: model.modelId,
        modelsSource: catalog.source,
        inlinePreview: result.inlinePreview
      }), 200, 'no-store', request);
    } catch (generationError) {
      const bullets = Array.isArray(generationError?.bullets) ? generationError.bullets : [];
      await jobUpdate(jobId, async (job) => ({
        ...job,
        status: 'failed_storage',
        progress: 100,
        step: 'Görsel üretildi ancak depolama başarısız oldu',
        finishedAt: nowIso(),
        error: {
          message: normalizeError(generationError),
          retryable: true,
          bullets
        },
        events: pushJobEvent(job, 'failed', 'Depolama başarısız oldu', { bullets })
      }));
      const failedJob = await jobRead(jobId);
      return jsonResponse(
        errEnvelope(requestId, traceId, startedAt, 'IMAGE_STORAGE_FAILED', 'Görsel üretimi tamamlandı ancak me.puter depolamaya yazılamadı.', bullets, 500, {
          feature: 'image',
          job: failedJob,
          modelsSource: catalog.source,
          storageStrategy: 'PATH_POOL + mkdir + createMissingParents + realPath + stat + getReadURL + KV cache'
        }),
        500,
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
          error: { message, retryable: true },
          events: pushJobEvent(job, 'failed', 'Ana çöküş', { error: message })
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
      status: job.status === 'processing' ? 'cancelled' : job.status,
      step: job.status === 'processing' ? 'İptal edildi' : job.step,
      finishedAt: job.status === 'processing' ? nowIso() : job.finishedAt
    }));
    return jsonResponse(okEnvelope(requestId, traceId, startedAt, 'JOB_CANCEL_OK', updated), 200, 'no-store', request);
  } catch (error) {
    return jsonResponse(errEnvelope(requestId, traceId, startedAt, 'ERR', normalizeError(error), [], 500), 500, 'no-store', request);
  }
});
