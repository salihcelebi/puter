// idm.js — v18.0.0
// Tek model: DALL-E 3
// Tamamen me.puter yaklaşımı
// Doğru başarı semantiği: completed sadece dosya gerçekten yazıldıysa
// UI fallback: anlık generate cevabında inlinePreview döner; kalıcı gösterim için outputUrl / jobs/image/:id kullanılır

const WORKER_NAME = 'idm';
const WORKER_VERSION = '18.0.0';
const JOB_PREFIX = 'ai_job:';
const MODEL_ID = 'openai/dall-e-3';
const PROVIDER = 'openai-image-generation';
const URL_EXPIRES_MS = 24 * 60 * 60 * 1000; // 24 saat
const HISTORY_LIMIT = 20;
const KV_SAFE_LIMIT = 390000;

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

function corsHeaders() {
  return {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': '*',
    'access-control-allow-methods': 'GET,POST,OPTIONS',
    'access-control-allow-credentials': 'true',
    'vary': 'origin'
  };
}

function jsonResponse(body, status = 200, cacheControl = 'no-store') {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders(),
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
    items: [
      {
        id: MODEL_ID,
        modelId: MODEL_ID,
        provider: 'OpenAI',
        company: 'OpenAI',
        modelName: 'DALL-E 3',
        categoryRaw: 'Image generation',
        badges: ['GÖRSEL'],
        qualityOptions: ['standard', 'hd'],
        ratioOptions: ['1:1', '16:9', '9:16', '4:3', '3:4'],
        traits: ['Tek model', 'me.puter storage', 'kalıcı URL'],
        standoutFeature: 'Sadece kalıcı dosya yazımı başarılıysa completed',
        useCase: 'Tek worker üzerinden güvenli görsel üretim'
      }
    ],
    total: 1,
    limit: 1,
    offset: 0,
    hasMore: false,
    feature: 'image'
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

function baseJobRecord(jobId, prompt, ratio, quality) {
  return {
    jobId,
    feature: 'image',
    status: 'processing',
    progress: 5,
    step: 'İstek alındı',
    retryable: true,
    cancelRequested: false,
    model: MODEL_ID,
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
      model: MODEL_ID,
      promptPreview: prompt.length <= 160 ? prompt : prompt.slice(0, 157) + '...',
      ratio,
      quality
    },
    request: {
      modelId: MODEL_ID,
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

async function persistGeneratedImage(jobId, dataUrl) {
  if (!dataUrl || !dataUrl.startsWith('data:')) {
    throw new Error('Kalıcı dosya yazımı için data URL bekleniyordu');
  }

  const blob = dataUrlToBlob(dataUrl);
  const ext = guessExtensionFromDataUrl(dataUrl);
  const targetPath = buildStoragePath(jobId, ext);
  const fileName = targetPath.split('/').pop();
  const mimeType = blob.type || `image/${ext}`;

  await me.puter.fs.write(targetPath, blob, {
    overwrite: true,
    dedupeName: true,
    createMissingParents: true
  });

  await me.puter.fs.stat(targetPath);

  const readUrl = await me.puter.fs.getReadURL(targetPath, URL_EXPIRES_MS);

  return {
    path: targetPath,
    fileName,
    mimeType,
    readUrl,
    expiresAt: new Date(Date.now() + URL_EXPIRES_MS).toISOString()
  };
}

async function runGeneration(jobId, prompt, ratio, quality) {
  await jobUpdate(jobId, async (j) => ({
    ...j,
    progress: 15,
    step: 'Model hazırlanıyor'
  }));

  const opts = {
    provider: PROVIDER,
    model: 'dall-e-3',
    test_mode: false,
    quality: qualityToDalle3(quality),
    ratio: ratioToSize(ratio)
  };

  await jobUpdate(jobId, async (j) => ({
    ...j,
    progress: 30,
    step: 'AI görsel üretiyor'
  }));

  const imageResult = await withTimeout(me.puter.ai.txt2img(prompt, opts), 45000);
  const src = extractImageSrc(imageResult);

  if (!src) {
    throw new Error('AI sonuç döndürmedi');
  }

  if (!src.startsWith('data:') && /^https?:\/\//i.test(src)) {
    // Nadir durumda doğrudan URL dönerse yine storage canonical olsun diye fetch edip blob’a çevirmek yerine
    // resmi kaynak URL olarak kullanmıyoruz; me.puter standardı için storage şart.
    throw new Error('Beklenmeyen çıktı tipi: data URL bekleniyordu');
  }

  await jobUpdate(jobId, async (j) => ({
    ...j,
    progress: 65,
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

router.options('/*page', async () => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders()
  });
});

router.get('/', async ({ request }) => {
  const t = nowMs();
  const rid = uid('info');
  const trid = uid('trace');
  return jsonResponse(okEnvelope(rid, trid, t, 'WORKER_INFO', {
    worker: WORKER_NAME,
    version: WORKER_VERSION,
    totalModels: 1,
    model: MODEL_ID
  }));
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
  }));
});

router.get('/models', async ({ request }) => {
  const t = nowMs();
  const rid = uid('models');
  const trid = uid('trace');
  return jsonResponse(
    okEnvelope(rid, trid, t, 'MODELS_OK', buildModels()),
    200,
    'public, max-age=300'
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

    if (!prompt) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'PROMPT_REQUIRED', 'Prompt alanı boş bırakılamaz.', [], 400),
        400
      );
    }

    jobId = uid('img');

    const job = baseJobRecord(jobId, prompt, ratio, quality);
    await jobWrite(job);

    try {
      const result = await runGeneration(jobId, prompt, ratio, quality);

      return jsonResponse(okEnvelope(rid, trid, t, 'IMAGE_JOB_COMPLETED', result.job, {
        feature: 'image',
        model: MODEL_ID,
        inlinePreview: result.inlinePreview // UI anlık gösterim için kullanabilir
      }));
    } catch (generationError) {
      const msg = normalizeError(generationError);

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
          'IMAGE_STORAGE_FAILED',
          'Görsel üretimi tamamlandı ancak me.puter depolamaya yazılamadı.',
          [
            'completed durumu verilmedi',
            'Kalıcı URL oluşmadı',
            'Job kaydı failed_storage olarak işaretlendi'
          ],
          500,
          {
            feature: 'image',
            model: MODEL_ID,
            job: failedJob
          }
        ),
        500
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
      500
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
        400
      );
    }

    let job = await jobRead(jobId);
    if (!job) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'NOT_FOUND', 'Job bulunamadı.', [], 404),
        404
      );
    }

    if (job.status === 'completed' && job.storage?.path) {
      job = await ensureFreshReadUrl(job);
    }

    return jsonResponse(okEnvelope(rid, trid, t, 'JOB_STATUS_OK', job, {
      feature: 'image',
      model: MODEL_ID
    }));
  } catch (err) {
    return jsonResponse(
      errEnvelope(rid, trid, t, 'ERR', normalizeError(err), [], 500),
      500
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
      model: MODEL_ID
    }));
  } catch (err) {
    return jsonResponse(
      errEnvelope(rid, trid, t, 'ERR', normalizeError(err), [], 500),
      500
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
        400
      );
    }

    let job = await jobRead(jobId);
    if (!job) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'NOT_FOUND', 'Job bulunamadı.', [], 404),
        404
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
        409
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
      model: MODEL_ID
    }));
  } catch (err) {
    return jsonResponse(
      errEnvelope(rid, trid, t, 'ERR', normalizeError(err), [], 500),
      500
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
        400
      );
    }

    const current = await jobRead(jobId);
    if (!current) {
      return jsonResponse(
        errEnvelope(rid, trid, t, 'NOT_FOUND', 'Job bulunamadı.', [], 404),
        404
      );
    }

    const updated = await jobUpdate(jobId, async (j) => ({
      ...j,
      cancelRequested: true,
      status: j.status === 'processing' ? 'cancelled' : j.status,
      step: j.status === 'processing' ? 'İptal edildi' : j.step,
      finishedAt: j.status === 'processing' ? nowIso() : j.finishedAt
    }));

    return jsonResponse(okEnvelope(rid, trid, t, 'JOB_CANCEL_OK', updated));
  } catch (err) {
    return jsonResponse(
      errEnvelope(rid, trid, t, 'ERR', normalizeError(err), [], 500),
      500
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
