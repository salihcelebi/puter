// idm.js — v18.0.0
// Tek model: DALL-E 3
// Tamamen me.puter yaklaşımı
// Doğru başarı semantiği: completed sadece dosya gerçekten yazıldıysa
// UI fallback: anlık generate cevabında inlinePreview döner; kalıcı gösterim için outputUrl / jobs/image/:id kullanılır

const WORKER_NAME = 'imgs';
const WORKER_VERSION = '18.0.4';
const JOB_PREFIX = 'ai_job:';
const PROVIDER = 'openai-image-generation';
const MAX_GENERATION_ATTEMPTS = 20;
const URL_EXPIRES_MS = 24 * 60 * 60 * 1000; // 24 saat
const HISTORY_LIMIT = 20;
const KV_SAFE_LIMIT = 390000;

const IMAGE_MODEL_IDS = [
  'openai/gpt-image-1',
  'google/gemini-3.1-flash-image-preview',
  'black-forest-labs/flux-1.1-pro',
  'black-forest-labs/flux-1.1-pro-ultra',
  'black-forest-labs/flux-kontext-max',
  'black-forest-labs/flux-kontext-pro',
  'black-forest-labs/flux-1-dev',
  'black-forest-labs/flux-1-schnell',
  'recraft-ai/recraft-v3',
  'recraft-ai/recraft-20b',
  'bfl/flux-pro-1.1-ultra',
  'bfl/flux-pro',
  'bfl/flux-dev',
  'bfl/flux-schnell'
];
const DEFAULT_IMAGE_MODEL = 'openai/gpt-image-1';

// 20 TASARIM KARARI
// 01) Tek model sabit
// 02) me.puter.ai kullan
// 03) me.puter.fs kullan
// 04) me.puter.kv sadece metadata için kullan
// 05) completed = storage gerçekten başarılı
// 06) failed_storage = AI üretildi ama depolanamadı
// 07) relative path kullan
// 08) createMissingParents kullan
// 09) dedupeName kullan
// 10) Blob ile yaz
// 11) stat ile doğrula
// 12) getReadURL ile UI URL üret
// 13) outputUrl süreliyse gerektiğinde yenile
// 14) history/status içinde taze URL üretmeyi dene
// 15) dev base64 KV'ye yazma
// 16) generate anlık cevabında inlinePreview ver
// 17) jobs/image/:id ile UI’ye taze URL sağla
// 18) tek hata dili: Türkçe
// 19) tek response format
// 20) yanlış FS stratejilerini tamamen kaldır

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

function normalizeError(err) {
  if (!err) return 'Bilinmeyen hata';
  try {
    if (typeof err === 'string') return err;
    if (err.message) return String(err.message);
    const s = JSON.stringify(err);
    return s && s !== '{}' ? s.slice(0, 600) : 'Hata okunamadı';
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

function buildModels() {
  return {
    items: IMAGE_MODEL_IDS.map((modelId) => ({
      id: modelId,
      modelId,
      provider: modelId.split('/')[0],
      modelName: modelId.split('/')[1],
      categoryRaw: 'Image generation',
      badges: ['GÖRSEL']
    })),
    total: IMAGE_MODEL_IDS.length,
    limit: IMAGE_MODEL_IDS.length,
    offset: 0,
    hasMore: false,
    feature: 'image',
    source: 'seed-image-catalog'
  };
}

function ratioToSize(ratio) {
  const map = {
    '1:1': { w: 1024, h: 1024 },
    '16:9': { w: 1792, h: 1024 },
    '9:16': { w: 1024, h: 1792 },
    '4:3': { w: 1024, h: 768 },
    '3:4': { w: 768, h: 1024 }
  };
  return map[ratio] || map['1:1'];
}

function qualityToDalle3(quality) {
  const q = ss(quality, 'standard').toLowerCase();
  return q === 'hd' ? 'hd' : 'standard';
}

function extractImageSrc(result) {
  if (!result) return null;
  if (typeof result === 'string') return result.trim();
  if (typeof result.src === 'string') return result.src.trim();
  if (typeof result?.image?.src === 'string') return result.image.src.trim();
  return null;
}

function buildGenerationAttemptPlans(ratio, quality, style) {
  const normalizedRatio = ss(ratio, '1:1');
  const requestedQuality = qualityToDalle3(quality);
  const requestedStyle = ss(style, '').toLowerCase();

  const ratioCandidates = [normalizedRatio, '1:1', '16:9', '9:16', '4:3'];
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
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
  } else {
    const text = decodeURIComponent(dataPart);
    bytes = new TextEncoder().encode(text);
  }

  return new Blob([bytes], { type: mime });
}

function guessExtensionFromDataUrl(dataUrl) {
  const m = /^data:([^;,]+)/i.exec(dataUrl || '');
  const mime = (m && m[1]) ? m[1].toLowerCase() : 'image/png';
  if (mime.includes('png')) return 'png';
  if (mime.includes('jpeg') || mime.includes('jpg')) return 'jpg';
  if (mime.includes('webp')) return 'webp';
  return 'png';
}

function buildStoragePath(jobId, ext) {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `idm-images/${yyyy}/${mm}/${dd}/${jobId}.${ext}`;
}

function baseJobRecord(jobId, prompt, ratio, quality, modelId) {
  return {
    jobId,
    feature: 'image',
    status: 'processing',
    progress: 5,
    step: 'İstek alındı',
    retryable: true,
    cancelRequested: false,
    model: modelId || DEFAULT_IMAGE_MODEL,
    storage: {
      path: null,
      verified: false,
      mimeType: null,
      fileName: null
    },
    outputUrl: null,
    outputUrlExpiresAt: null,
    outputUrls: [],
    requestSummary: {
      model: modelId || DEFAULT_IMAGE_MODEL,
      promptPreview: prompt.length <= 160 ? prompt : prompt.slice(0, 157) + '...',
      ratio,
      quality
    },
    request: {
      modelId: modelId || DEFAULT_IMAGE_MODEL,
      ratio,
      quality
    },
    error: null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
    finishedAt: null
  };
}

function slimJobForKv(job) {
  const j = JSON.parse(JSON.stringify(job));

  // Büyük veri saklamıyoruz.
  delete j.inlinePreview;
  delete j.rawDataUrl;

  // Güvenlik için step ve hata mesajlarını kıs.
  if (j.step && j.step.length > 2000) {
    j.step = j.step.slice(0, 2000);
  }
  if (j.error && j.error.message && j.error.message.length > 700) {
    j.error.message = j.error.message.slice(0, 700);
  }

  // Boyut aşımı olursa kademeli küçült.
  let str = JSON.stringify(j);
  if (str.length <= KV_SAFE_LIMIT) return j;

  if (j.requestSummary) {
    j.requestSummary.promptPreview = '';
  }
  str = JSON.stringify(j);
  if (str.length <= KV_SAFE_LIMIT) return j;

  delete j.outputUrls;
  str = JSON.stringify(j);
  if (str.length <= KV_SAFE_LIMIT) return j;

  if (j.outputUrl && j.outputUrl.length > 180) {
    j.outputUrl = j.outputUrl.slice(0, 180);
  }
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

async function kvGet(key) {
  const raw = await me.puter.kv.get(key);
  if (!raw) return null;
  return typeof raw === 'string' ? JSON.parse(raw) : raw;
}

async function kvSet(key, value) {
  const safe = slimJobForKv(value);
  const payload = JSON.stringify(safe);
  await me.puter.kv.set(key, payload);
}

async function kvList(prefix) {
  try {
    const res = await me.puter.kv.list(prefix);
    const arr = Array.isArray(res) ? res : (Array.isArray(res?.keys) ? res.keys : []);
    return arr
      .map(item => typeof item === 'string' ? item : item?.key)
      .filter(Boolean);
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
      const j = await kvGet(key);
      if (j && j.jobId) jobs.push(j);
    } catch (_) {}
  }
  jobs.sort((a, b) => ss(b.updatedAt || b.createdAt).localeCompare(ss(a.updatedAt || a.createdAt)));
  return jobs.slice(0, ci(limit, 1, 50, HISTORY_LIMIT));
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

async function ensureFreshReadUrl(job) {
  if (!job?.storage?.path) return job;

  const now = Date.now();
  const exp = job.outputUrlExpiresAt ? Date.parse(job.outputUrlExpiresAt) : 0;
  const stillValid = job.outputUrl && exp && (exp - now > 5 * 60 * 1000);

  if (stillValid) return job;

  try {
    const freshUrl = await me.puter.fs.getReadURL(job.storage.path, URL_EXPIRES_MS);
    job.outputUrl = freshUrl;
    job.outputUrls = freshUrl ? [freshUrl] : [];
    job.outputUrlExpiresAt = new Date(now + URL_EXPIRES_MS).toISOString();
    await jobWrite(job);
    return job;
  } catch (e) {
    // URL yenilenemezse mevcut job kaydını bozma.
    return job;
  }
}


// TÜRKÇE NOT: Storage zincirinin her adımını tek satırda raporlamak için zorunlu özet log yardımcı fonksiyonu.
function logStorageStep({ jobId, inputPath, resolvedPath, writeOk, statOk, readUrlOk, failCode }) {
  console.log(`STORAGE_STEP jobId=${ss(jobId,'-')} inputPath=${ss(inputPath,'-')} resolvedPath=${ss(resolvedPath,'-')} writeOk=${writeOk ? 'true' : 'false'} statOk=${statOk ? 'true' : 'false'} readUrlOk=${readUrlOk ? 'true' : 'false'} failCode=${ss(failCode,'-')}`);
}

async function sourceToBlob(src) {
  if (src && src.startsWith('data:')) {
    return dataUrlToBlob(src);
  }

  if (src && /^https?:\/\//i.test(src)) {
    const response = await withTimeout(fetch(src), 20000);
    if (!response.ok) {
      throw new Error(`Uzak görsel indirilemedi (HTTP ${response.status})`);
    }
    const blob = await response.blob();
    if (!blob || !blob.size) {
      throw new Error('Uzak görsel boş döndü');
    }
    return blob;
  }

  throw new Error('Geçersiz görsel kaynağı');
}

async function persistGeneratedImage(jobId, source) {
  // TÜRKÇE NOT: Storage zincirinde path sapmasını önlemek için path havuzu ve adım-adım doğrulama kullanılır.
  const blob = await sourceToBlob(source);
  const ext = source && source.startsWith('data:')
    ? guessExtensionFromDataUrl(source)
    : (blob.type || '').includes('jpeg') ? 'jpg' : (blob.type || '').includes('webp') ? 'webp' : 'png';
  const inputPath = buildStoragePath(jobId, ext);
  const pathPool = [inputPath];

  let resolvedPath = inputPath;
  let writeOk = false;
  let statOk = false;
  let readUrlOk = false;
  let failCode = null;

  try {
    try {
      const writeResult = await me.puter.fs.write(inputPath, blob, {
        overwrite: true,
        dedupeName: true,
        createMissingParents: true
      });
      writeOk = true;

      const candidatePath = ss(writeResult?.path || writeResult?.realPath || writeResult?.resolvedPath || writeResult, '');
      if (candidatePath && !pathPool.includes(candidatePath)) pathPool.unshift(candidatePath);
    } catch (e) {
      failCode = 'WRITE_FAIL';
      throw new Error(`FS write başarısız: ${normalizeError(e)}`);
    }

    try {
      for (const candidate of pathPool) {
        try {
          await me.puter.fs.stat(candidate);
          resolvedPath = candidate;
          statOk = true;
          break;
        } catch (_) {}
      }
      if (!statOk) throw new Error(`FS stat başarısız. Path havuzu: ${pathPool.join(', ')}`);
    } catch (e) {
      failCode = 'STAT_FAIL';
      throw new Error(normalizeError(e));
    }

    let readUrl = '';
    try {
      readUrl = await me.puter.fs.getReadURL(resolvedPath, URL_EXPIRES_MS);
      readUrlOk = !!ss(readUrl, '');
      if (!readUrlOk) throw new Error('FS read URL boş döndü');
    } catch (e) {
      failCode = 'READ_URL_FAIL';
      throw new Error(`FS read URL başarısız: ${normalizeError(e)}`);
    }

    logStorageStep({ jobId, inputPath, resolvedPath, writeOk, statOk, readUrlOk, failCode: failCode || 'NONE' });

    const fileName = resolvedPath.split('/').pop();
    const mimeType = blob.type || `image/${ext}`;

    return {
      path: resolvedPath,
      fileName,
      mimeType,
      readUrl,
      expiresAt: new Date(Date.now() + URL_EXPIRES_MS).toISOString()
    };
  } catch (e) {
    logStorageStep({ jobId, inputPath, resolvedPath, writeOk, statOk, readUrlOk, failCode: failCode || 'STORAGE_FAIL' });
    throw e;
  }
}

async function runGeneration(jobId, prompt, ratio, quality, style, modelId) {
  await jobUpdate(jobId, async (j) => ({
    ...j,
    progress: 15,
    step: 'Model hazırlanıyor'
  }));

  const plans = buildGenerationAttemptPlans(ratio, quality, style);
  const attemptErrors = [];
  let src = null;

  for (const plan of plans) {
    const progress = Math.min(60, 20 + Math.floor((plan.index / plans.length) * 40));
    await jobUpdate(jobId, async (j) => ({
      ...j,
      progress,
      step: `AI görsel üretiyor (deneme ${plan.index}/${plans.length})`
    }));

    try {
      const imageResult = await withTimeout(me.puter.ai.txt2img(prompt, { ...plan.opts, model: modelId || DEFAULT_IMAGE_MODEL }), plan.timeoutMs);
      src = extractImageSrc(imageResult);
      if (!src) {
        throw new Error('AI boş sonuç döndürdü');
      }
      break;
    } catch (e) {
      attemptErrors.push(`Deneme ${plan.index}: ${normalizeError(e)}`);
    }
  }

  if (!src) {
    const finalError = new Error(`Görsel üretimi ${plans.length} farklı alternatif denemeye rağmen tamamlanamadı.`);
    finalError.attemptBullets = attemptErrors.slice(0, 10);
    throw finalError;
  }

  await jobUpdate(jobId, async (j) => ({
    ...j,
    progress: 70,
    step: 'Görsel me.puter depolamaya yazılıyor'
  }));

  const persisted = await persistGeneratedImage(jobId, src);

  await jobUpdate(jobId, async (j) => ({
    ...j,
    status: 'completed',
    progress: 100,
    step: 'Tamamlandı',
    finishedAt: nowIso(),
    storage: {
      path: persisted.path,
      verified: true,
      mimeType: persisted.mimeType,
      fileName: persisted.fileName
    },
    outputUrl: persisted.readUrl,
    outputUrls: persisted.readUrl ? [persisted.readUrl] : [],
    outputUrlExpiresAt: persisted.expiresAt,
    error: null
  }));

  const finalJob = await jobRead(jobId);

  // KV’ye base64 yazmıyoruz; sadece anlık cevap için dönüyoruz.
  return {
    job: finalJob,
    inlinePreview: src
  };
}

router.options('/*page', async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request)
  });
});

router.get('/', async ({ request }) => {
  const t = nowMs();
  const rid = uid('info');
  const trid = uid('trace');
  return jsonResponse(okEnvelope(rid, trid, t, 'WORKER_INFO', {
    worker: WORKER_NAME,
    version: WORKER_VERSION,
    totalModels: IMAGE_MODEL_IDS.length,
    model: DEFAULT_IMAGE_MODEL
  }), 200, 'no-store', request);
});

router.get('/health', async ({ request }) => {
  const t = nowMs();
  const rid = uid('health');
  const trid = uid('trace');
  return jsonResponse(okEnvelope(rid, trid, t, 'HEALTH_OK', {
    status: 'ok',
    worker: WORKER_NAME,
    version: WORKER_VERSION,
    storageMode: 'me.puter'
  }), 200, 'no-store', request);
});

router.get('/models', async ({ request }) => {
  const t = nowMs();
  const rid = uid('models');
  const trid = uid('trace');
  return jsonResponse(
    okEnvelope(rid, trid, t, 'MODELS_OK', buildModels()),
    200,
    'public, max-age=300',
    request
  );
});

router.post('/generate', async ({ request }) => {
  const t = nowMs();
  const rid = uid('gen');
  const trid = uid('trace');
  let jobId = null;

  try {
    const body = await request.json();
    const prompt = ss(body?.prompt, '');
    const ratio = ss(body?.ratio || body?.size, '1:1');
    const quality = qualityToDalle3(body?.quality || 'standard');
    const style = ss(body?.style, '');
    const requestedModel = ss(body?.modelId || body?.model, DEFAULT_IMAGE_MODEL);
    const modelId = IMAGE_MODEL_IDS.includes(requestedModel) ? requestedModel : DEFAULT_IMAGE_MODEL;

    if (!prompt) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'PROMPT_REQUIRED', 'Prompt alanı boş bırakılamaz.', [], 400),
        400,
        'no-store',
        request
      );
    }

    jobId = uid('img');

    const job = baseJobRecord(jobId, prompt, ratio, quality, modelId);
    await jobWrite(job);

    try {
      const result = await runGeneration(jobId, prompt, ratio, quality, style, modelId);

      return jsonResponse(okEnvelope(rid, trid, t, 'IMAGE_JOB_COMPLETED', result.job, {
        feature: 'image',
        model: modelId || DEFAULT_IMAGE_MODEL,
        inlinePreview: result.inlinePreview // UI anlık gösterim için kullanabilir
      }), 200, 'no-store', request);
    } catch (generationError) {
      const msg = normalizeError(generationError);
      const extraBullets = Array.isArray(generationError?.attemptBullets)
        ? generationError.attemptBullets
        : [];

      // AI üretimi olmuş olabilir ama storage patlamış olabilir.
      // Bu durumda completed YOK; ayrı hata durumu var.
      await jobUpdate(jobId, async (j) => ({
        ...j,
        status: 'failed_storage',
        progress: 100,
        step: 'Görsel üretildi ancak depolama başarısız oldu',
        finishedAt: nowIso(),
        error: {
          message: msg,
          retryable: true
        }
      }));

      const failedJob = await jobRead(jobId);

      return jsonResponse(
        errEnvelope(
          rid,
          trid,
          t,
          'STORAGE_FAIL',
          'Görsel üretimi tamamlandı ancak me.puter depolamaya yazılamadı.',
          [
            'completed durumu verilmedi',
            'Kalıcı URL oluşmadı',
            'Job kaydı failed_storage olarak işaretlendi',
            ...extraBullets
          ],
          500,
          {
            feature: 'image',
              job: failedJob
          }
        ),
        500,
        'no-store',
        request
      );
    }
  } catch (err) {
    const msg = normalizeError(err);

    if (jobId) {
      try {
        await jobUpdate(jobId, async (j) => ({
          ...j,
          status: 'failed',
          progress: 100,
          step: 'Ana çöküş',
          finishedAt: nowIso(),
          error: {
            message: msg,
            retryable: true
          }
        }));
      } catch (_) {}
    }

    return jsonResponse(
      errEnvelope(rid, trid, t, 'ERR', `Ana çöküş: ${msg}`, [], 500),
      500,
      'no-store',
      request
    );
  }
});

router.get('/jobs/status/:id', async ({ request, params }) => {
  const t = nowMs();
  const rid = uid('status');
  const trid = uid('trace');

  try {
    const jobId = ss(params?.id, '');
    if (!jobId) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'JOB_ID_REQUIRED', 'jobId eksik.', [], 400),
        400,
        'no-store',
        request
      );
    }

    let job = await jobRead(jobId);
    if (!job) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'NOT_FOUND', 'Job bulunamadı.', [], 404),
        404,
        'no-store',
        request
      );
    }

    if (job.status === 'completed' && job.storage?.path) {
      job = await ensureFreshReadUrl(job);
    }

    return jsonResponse(okEnvelope(rid, trid, t, 'JOB_STATUS_OK', job, {
      feature: 'image',
      model: DEFAULT_IMAGE_MODEL
    }), 200, 'no-store', request);
  } catch (err) {
    return jsonResponse(
      errEnvelope(rid, trid, t, 'ERR', normalizeError(err), [], 500),
      500,
      'no-store',
      request
    );
  }
});

router.get('/jobs/history', async ({ request }) => {
  const t = nowMs();
  const rid = uid('history');
  const trid = uid('trace');

  try {
    const items = await listJobs(HISTORY_LIMIT);
    const hydrated = [];

    for (let job of items) {
      if (job.status === 'completed' && job.storage?.path) {
        job = await ensureFreshReadUrl(job);
      }
      hydrated.push(job);
    }

    return jsonResponse(okEnvelope(rid, trid, t, 'JOB_HISTORY_OK', {
      items: hydrated,
      total: hydrated.length,
      limit: HISTORY_LIMIT,
      feature: 'image',
      model: DEFAULT_IMAGE_MODEL
    }), 200, 'no-store', request);
  } catch (err) {
    return jsonResponse(
      errEnvelope(rid, trid, t, 'ERR', normalizeError(err), [], 500),
      500,
      'no-store',
      request
    );
  }
});

router.get('/jobs/image/:id', async ({ request, params }) => {
  const t = nowMs();
  const rid = uid('image');
  const trid = uid('trace');

  try {
    const jobId = ss(params?.id, '');
    if (!jobId) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'JOB_ID_REQUIRED', 'jobId eksik.', [], 400),
        400,
        'no-store',
        request
      );
    }

    let job = await jobRead(jobId);
    if (!job) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'NOT_FOUND', 'Job bulunamadı.', [], 404),
        404,
        'no-store',
        request
      );
    }

    if (job.status !== 'completed' || !job.storage?.path) {
      return jsonResponse(
        errEnvelope(
          rid,
          trid,
          t,
          'IMAGE_NOT_READY',
          'Görsel henüz kalıcı olarak hazır değil.',
          [
            'Job completed değilse resim endpoint’i URL üretemez',
            'Kalıcı storage path yoksa UI outputUrl beklememeli'
          ],
          409
        ),
        409,
        'no-store',
        request
      );
    }

    job = await ensureFreshReadUrl(job);

    return jsonResponse(okEnvelope(rid, trid, t, 'JOB_IMAGE_URL_OK', {
      jobId: job.jobId,
      storagePath: job.storage.path,
      outputUrl: job.outputUrl,
      outputUrlExpiresAt: job.outputUrlExpiresAt,
      mimeType: job.storage.mimeType,
      fileName: job.storage.fileName
    }, {
      feature: 'image',
      model: DEFAULT_IMAGE_MODEL
    }), 200, 'no-store', request);
  } catch (err) {
    return jsonResponse(
      errEnvelope(rid, trid, t, 'ERR', normalizeError(err), [], 500),
      500,
      'no-store',
      request
    );
  }
});

router.post('/jobs/cancel', async ({ request }) => {
  const t = nowMs();
  const rid = uid('cancel');
  const trid = uid('trace');

  try {
    const body = await request.json();
    const jobId = ss(body?.jobId, '');

    if (!jobId) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'JOB_ID_REQUIRED', 'jobId eksik.', [], 400),
        400,
        'no-store',
        request
      );
    }

    const current = await jobRead(jobId);
    if (!current) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'NOT_FOUND', 'Job bulunamadı.', [], 404),
        404,
        'no-store',
        request
      );
    }

    const updated = await jobUpdate(jobId, async (j) => ({
      ...j,
      cancelRequested: true,
      status: j.status === 'processing' ? 'cancelled' : j.status,
      step: j.status === 'processing' ? 'İptal edildi' : j.step,
      finishedAt: j.status === 'processing' ? nowIso() : j.finishedAt
    }));

    return jsonResponse(okEnvelope(rid, trid, t, 'JOB_CANCEL_OK', updated), 200, 'no-store', request);
  } catch (err) {
    return jsonResponse(
      errEnvelope(rid, trid, t, 'ERR', normalizeError(err), [], 500),
      500,
      'no-store',
      request
    );
  }
});

/*
UI ENTEGRASYON KURALI

1) POST /generate
   - Başarılıysa:
     response.data.outputUrl varsa bunu hemen göster
     response.meta.inlinePreview varsa bunu da ilk anlık önizleme için kullan
   - Başarısızsa:
     response.meta.job.status === "failed_storage" ise "kalıcı depolama başarısız" mesajı göster

2) GET /jobs/status/:id
   - data.outputUrl varsa:
     <img src="{data.outputUrl}" />
   - yoksa:
     "Görsel hazır değil"

3) GET /jobs/image/:id
   - outputUrl süresi dolduysa UI bu endpoint’ten taze URL alır

ÖRNEK FRONTEND MANTIĞI

const statusRes = await fetch(`${WORKER}/jobs/status/${jobId}`).then(r => r.json());
const imgSrc = statusRes?.data?.outputUrl || null;
if (imgSrc) imageEl.src = imgSrc;

SENİN ESKİ BUG’IN NEDENİ:
- storage başarısızken status=completed veriliyordu
- outputUrl null kalıyordu
- UI completed görüp resim bekliyordu ama URL yoktu

BU SÜRÜMDE:
- completed yalnızca storage tamamlanınca verilir
- outputUrl her completed job’da vardır
- gerekiyorsa /jobs/image/:id taze URL üretir
*/
