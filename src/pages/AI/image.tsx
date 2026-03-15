import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/*
KISA AÇIKLAMA:
Bu React sayfası sadece worker API ile konuşur, modeli tarayıcıda çalıştırmaz.
*/

const WORKER_BASE_URL = 'https://ibb.puter.work';
const DEFAULT_MODEL_ID = 'openai/dall-e-3';
const DEFAULT_RATIO = '1:1';
const DEFAULT_QUALITY = 'standard';
const POLL_INTERVAL_MS = 2500;
const HISTORY_LIMIT = 20;

const RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 Kare' },
  { value: '16:9', label: '16:9 Yatay' },
  { value: '9:16', label: '9:16 Dikey' },
  { value: '4:3', label: '4:3 Klasik' },
  { value: '3:4', label: '3:4 Portre' },
];

const QUALITY_OPTIONS = [
  { value: 'standard', label: 'Standart' },
  { value: 'hd', label: 'HD' },
];

const QUICK_PROMPTS = [
  'Turuncu gözlü sevimli bir kedi, sinematik ışık, ultra detaylı, temiz arka plan',
  'Yağmurlu gece sokakta yürüyen futuristik robot, neon ışıklar, yüksek detay',
  'Dağın tepesinde gün doğumunda ahşap kulübe, gerçekçi, huzurlu atmosfer',
];

function nowMs() {
  return Date.now();
}

function safeText(value, fallback = '') {
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
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  } catch {
    return fallback;
  }
}

function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

function pickJobImages(job, inlinePreview) {
  const bag = [];

  const pushIf = (v) => {
    const clean = safeText(v);
    if (clean && !bag.includes(clean)) bag.push(clean);
  };

  pushIf(job?.outputUrl);
  pushIf(job?.url);

  normalizeArray(job?.outputUrls).forEach(pushIf);
  normalizeArray(job?.urls).forEach(pushIf);

  pushIf(inlinePreview);

  return bag;
}

function formatDateTime(value) {
  const text = safeText(value);
  if (!text) return '-';
  try {
    return new Date(text).toLocaleString('tr-TR');
  } catch {
    return text;
  }
}

function statusLabel(status) {
  const s = safeText(status).toLowerCase();
  if (s === 'queued') return 'Kuyrukta';
  if (s === 'processing') return 'İşleniyor';
  if (s === 'completed') return 'Tamamlandı';
  if (s === 'failed_storage') return 'Depolama Hatası';
  if (s === 'failed') return 'Başarısız';
  if (s === 'cancelled') return 'İptal Edildi';
  return s || 'Bilinmiyor';
}

function statusTone(status) {
  const s = safeText(status).toLowerCase();
  if (s === 'completed') return '#00c2ff';
  if (s === 'processing' || s === 'queued') return '#f59e0b';
  if (s === 'failed_storage' || s === 'failed') return '#ef4444';
  if (s === 'cancelled') return '#94a3b8';
  return '#64748b';
}

async function readJson(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return {
      ok: false,
      code: 'INVALID_JSON_RESPONSE',
      error: {
        message: text || 'Worker JSON dönmedi.',
      },
      data: null,
      meta: null,
      httpStatus: response.status,
    };
  }
}

function normalizeWorkerErrorMessage(payload, response) {
  const message = safeText(payload?.error?.message, '');
  if (message) return message;

  const code = safeText(payload?.code, '');
  if (code === 'PROMPT_REQUIRED') return 'Prompt boş bırakılamaz.';
  if (code === 'NOT_FOUND') return 'Kayıt bulunamadı.';
  if (code === 'IMAGE_NOT_READY') return 'Görsel henüz hazır değil.';
  if (code === 'JOB_ID_REQUIRED') return 'Job kimliği eksik.';
  if (response?.status === 404) return 'Worker rotası bulunamadı.';
  if (response?.status === 429) return 'Çok sık istek atıldı.';
  if (response?.status >= 500) return 'Sunucu tarafında hata oluştu.';
  return 'İstek başarısız oldu.';
}

async function requestWorker(path, options = {}) {
  const retryCount = Math.max(0, Math.min(20, safeNumber(options.retryCount, 2)));
  let response;
  let lastNetworkError = null;

  for (let attempt = 1; attempt <= retryCount + 1; attempt += 1) {
    let timer = null;
    try {
      const controller = new AbortController();
      timer = window.setTimeout(() => controller.abort(), 60000);

      response = await fetch(`${WORKER_BASE_URL}${path}`, {
        method: options.method || 'GET',
        headers: {
          'content-type': 'application/json',
          ...(options.headers || {}),
        },
        credentials: 'include',
        body: options.body ? JSON.stringify(options.body) : undefined,
        signal: controller.signal,
      });

      if (response.status >= 500 && attempt <= retryCount + 1) {
        await new Promise((resolve) => window.setTimeout(resolve, 350 * attempt));
      } else {
        break;
      }
    } catch (error) {
      lastNetworkError = error;
      if (attempt > retryCount) {
        const isAbort = safeText(error?.name).toLowerCase() === 'aborterror';
        throw new Error(
          isAbort
            ? `İstek zaman aşımına uğradı. Worker: ${WORKER_BASE_URL}${path}`
            : `Worker bağlantısı kurulamadı. Ağ/CORS engeli olabilir. Worker: ${WORKER_BASE_URL}${path}`
        );
      }
      await new Promise((resolve) => window.setTimeout(resolve, 350 * attempt));
    } finally {
      if (timer) window.clearTimeout(timer);
    }
  }

  if (!response) {
    throw new Error(lastNetworkError ? 'Worker isteği başarısız oldu.' : 'Worker yanıt üretmedi.');
  }

  const payload = await readJson(response);

  if (!response.ok || payload?.ok === false) {
    const error = new Error(normalizeWorkerErrorMessage(payload, response));
    error.payload = payload;
    error.status = response.status;
    throw error;
  }

  return payload;
}

export default function IDMImagePage() {
  const [workerInfo, setWorkerInfo] = useState(null);
  const [models, setModels] = useState([]);
  const [history, setHistory] = useState([]);
  const [activeJob, setActiveJob] = useState(null);
  const [activeInlinePreview, setActiveInlinePreview] = useState('');
  const [activeImageUrls, setActiveImageUrls] = useState([]);
  const [pageError, setPageError] = useState('');
  const [loadingInfo, setLoadingInfo] = useState(true);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pollRef = useRef(null);

  const [form, setForm] = useState({
    model: DEFAULT_MODEL_ID,
    prompt: '',
    negativePrompt: '',
    ratio: DEFAULT_RATIO,
    quality: DEFAULT_QUALITY,
    style: '',
  });

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const mergeActiveImages = useCallback((job, inlinePreview = '') => {
    const images = pickJobImages(job, inlinePreview);
    setActiveImageUrls(images);
  }, []);

  const loadWorkerInfo = useCallback(async () => {
    const payload = await requestWorker('/');
    setWorkerInfo(payload?.data || null);
  }, []);

  const loadModels = useCallback(async () => {
    const payload = await requestWorker('/models');
    const items = normalizeArray(payload?.data?.items);
    const onlyImageModels = items.filter((item) => safeText(item?.modelId || item?.id) === DEFAULT_MODEL_ID);
    setModels(onlyImageModels.length ? onlyImageModels : items);
  }, []);

  const hydrateHistoryImages = useCallback(async (items) => {
    const next = [];
    for (const item of normalizeArray(items)) {
      let job = item;
      const hasDirectImage =
        safeText(job?.outputUrl) ||
        normalizeArray(job?.outputUrls).length ||
        safeText(job?.url) ||
        normalizeArray(job?.urls).length;

      if (safeText(job?.status).toLowerCase() === 'completed' && !hasDirectImage && safeText(job?.jobId)) {
        try {
          const imagePayload = await requestWorker(`/jobs/image/${encodeURIComponent(job.jobId)}`);
          const freshUrl = safeText(imagePayload?.data?.outputUrl);
          if (freshUrl) {
            job = {
              ...job,
              outputUrl: freshUrl,
              outputUrls: [freshUrl],
              url: freshUrl,
              urls: [freshUrl],
            };
          }
        } catch {
          // Hata olsa bile history kartı çökmemeli.
        }
      }

      next.push(job);
    }
    return next;
  }, []);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const payload = await requestWorker(`/jobs/history?limit=${HISTORY_LIMIT}`);
      const items = normalizeArray(payload?.data?.items);
      const hydrated = await hydrateHistoryImages(items);
      setHistory(hydrated);
    } finally {
      setLoadingHistory(false);
    }
  }, [hydrateHistoryImages]);

  const stopIfTerminal = useCallback((job) => {
    const s = safeText(job?.status).toLowerCase();
    return s === 'completed' || s === 'failed' || s === 'failed_storage' || s === 'cancelled';
  }, []);

  const resolveCompletedImageIfNeeded = useCallback(async (job, inlinePreview = '') => {
    let nextJob = job;

    const currentImages = pickJobImages(job, inlinePreview);
    if (currentImages.length) {
      mergeActiveImages(job, inlinePreview);
      return nextJob;
    }

    if (safeText(job?.status).toLowerCase() === 'completed' && safeText(job?.jobId)) {
      try {
        const imagePayload = await requestWorker(`/jobs/image/${encodeURIComponent(job.jobId)}`);
        const freshUrl = safeText(imagePayload?.data?.outputUrl);
        if (freshUrl) {
          nextJob = {
            ...job,
            outputUrl: freshUrl,
            outputUrls: [freshUrl],
            url: freshUrl,
            urls: [freshUrl],
          };
        }
      } catch {
        // Sessiz fallback.
      }
    }

    mergeActiveImages(nextJob, inlinePreview);
    return nextJob;
  }, [mergeActiveImages]);

  const pollJob = useCallback((jobId) => {
    clearPoll();

    pollRef.current = window.setInterval(async () => {
      try {
        const payload = await requestWorker(`/jobs/status/${encodeURIComponent(jobId)}`);
        const job = payload?.data || null;
        if (!job) return;

        setActiveJob(job);
        mergeActiveImages(job, activeInlinePreview);

        if (stopIfTerminal(job)) {
          clearPoll();
          const resolvedJob = await resolveCompletedImageIfNeeded(job, activeInlinePreview);
          setActiveJob(resolvedJob);
          await loadHistory();
        }
      } catch (error) {
        clearPoll();
        setPageError(error.message || 'Job durumu okunamadı.');
      }
    }, POLL_INTERVAL_MS);
  }, [activeInlinePreview, clearPoll, loadHistory, mergeActiveImages, resolveCompletedImageIfNeeded, stopIfTerminal]);

  const boot = useCallback(async () => {
    setLoadingInfo(true);
    setPageError('');
    try {
      await Promise.all([loadWorkerInfo(), loadModels(), loadHistory()]);
    } catch (error) {
      setPageError(error.message || 'Sayfa başlatılamadı.');
    } finally {
      setLoadingInfo(false);
    }
  }, [loadHistory, loadModels, loadWorkerInfo]);

  useEffect(() => {
    boot();
    return () => clearPoll();
  }, [boot, clearPoll]);

  const handleChange = useCallback((key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleQuickPrompt = useCallback((text) => {
    setForm((prev) => ({ ...prev, prompt: text }));
  }, []);

  const handleSubmit = useCallback(async (event) => {
    event.preventDefault();
    setSubmitting(true);
    setPageError('');
    clearPoll();
    setActiveInlinePreview('');
    setActiveImageUrls([]);

    try {
      const payload = await requestWorker('/generate', {
        method: 'POST',
        body: {
          prompt: form.prompt,
          model: DEFAULT_MODEL_ID,
          modelId: DEFAULT_MODEL_ID,
          ratio: form.ratio,
          quality: form.quality,
          style: form.style,
          negativePrompt: form.negativePrompt,
        },
      });

      const job = payload?.data || null;
      const inlinePreview = safeText(payload?.meta?.inlinePreview);

      setActiveInlinePreview(inlinePreview);
      setActiveJob(job);
      mergeActiveImages(job, inlinePreview);

      const jobId = safeText(job?.jobId);
      if (jobId) {
        if (stopIfTerminal(job)) {
          const resolvedJob = await resolveCompletedImageIfNeeded(job, inlinePreview);
          setActiveJob(resolvedJob);
          await loadHistory();
        } else {
          pollJob(jobId);
        }
      } else {
        await loadHistory();
      }
    } catch (error) {
      const failedJob = error?.payload?.meta?.job || null;
      if (failedJob) {
        setActiveJob(failedJob);
      }
      setPageError(error.message || 'Üretim başlatılamadı.');
    } finally {
      setSubmitting(false);
    }
  }, [clearPoll, form, loadHistory, mergeActiveImages, pollJob, resolveCompletedImageIfNeeded, stopIfTerminal]);

  const handleCancel = useCallback(async () => {
    const jobId = safeText(activeJob?.jobId);
    if (!jobId) return;

    try {
      const payload = await requestWorker('/jobs/cancel', {
        method: 'POST',
        body: { jobId },
      });
      clearPoll();
      setActiveJob(payload?.data || null);
      mergeActiveImages(payload?.data || null, activeInlinePreview);
      await loadHistory();
    } catch (error) {
      setPageError(error.message || 'İptal işlemi başarısız oldu.');
    }
  }, [activeInlinePreview, activeJob, clearPoll, loadHistory, mergeActiveImages]);

  const handleRefreshHistory = useCallback(async () => {
    setPageError('');
    try {
      await loadHistory();
    } catch (error) {
      setPageError(error.message || 'Geçmiş yenilenemedi.');
    }
  }, [loadHistory]);

  const activeStatus = safeText(activeJob?.status).toLowerCase();
  const activeStep = safeText(activeJob?.step, '-');
  const activePrompt = safeText(activeJob?.requestSummary?.promptPreview || activeJob?.requestSummary?.prompt || '');
  const activeProgress = Math.max(0, Math.min(100, Math.floor(safeNumber(activeJob?.progress, 0))));
  const canCancel = activeStatus === 'queued' || activeStatus === 'processing';

  const renderedHistory = useMemo(() => history.slice(0, HISTORY_LIMIT), [history]);

  return (
    <div style={styles.page}>
      <div style={styles.hero}>
        <div>
          <div style={styles.eyebrow}>IMAGE WORKER</div>
          <h1 style={styles.title}>Tek worker üstünden görsel üretim</h1>
          <p style={styles.subtitle}>
            Bu sayfa sadece <code style={styles.code}>{WORKER_BASE_URL}</code> ile konuşur.
            Tek model kullanır. Depolama mantığı me.puter üstündedir.
          </p>
        </div>

        <div style={styles.routeBox}>
          <div style={styles.routeTitle}>Aktif route&apos;lar</div>
          <div style={styles.routeWrap}>
            {['/models', '/generate', '/jobs/status/:id', '/jobs/history', '/jobs/cancel', '/jobs/image/:id'].map((item) => (
              <span key={item} style={styles.routePill}>{item}</span>
            ))}
          </div>
        </div>
      </div>

      {pageError ? (
        <div style={styles.errorBox}>{pageError}</div>
      ) : null}

      <div style={styles.grid}>
        <section style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Üretim ayarları</h2>
          </div>

          <form onSubmit={handleSubmit}>
            <label style={styles.label}>Model</label>
            <select
              value={form.model}
              onChange={(e) => handleChange('model', e.target.value)}
              style={styles.select}
              disabled
            >
              <option value={DEFAULT_MODEL_ID}>OpenAI · DALL-E 3</option>
            </select>

            <label style={styles.label}>Prompt</label>
            <textarea
              value={form.prompt}
              onChange={(e) => handleChange('prompt', e.target.value)}
              placeholder="Örnek: Turuncu bir kedi, sinematik ışık, ultra detay"
              style={styles.textarea}
            />

            <div style={styles.quickWrap}>
              {QUICK_PROMPTS.map((item, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleQuickPrompt(item)}
                  style={styles.quickButton}
                >
                  Hazır Prompt {index + 1}
                </button>
              ))}
            </div>

            <label style={styles.label}>Negatif prompt</label>
            <input
              value={form.negativePrompt}
              onChange={(e) => handleChange('negativePrompt', e.target.value)}
              placeholder="Örnek: blurry, watermark, low quality"
              style={styles.input}
            />

            <div style={styles.twoCol}>
              <div>
                <label style={styles.label}>Oran</label>
                <select
                  value={form.ratio}
                  onChange={(e) => handleChange('ratio', e.target.value)}
                  style={styles.select}
                >
                  {RATIO_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={styles.label}>Kalite</label>
                <select
                  value={form.quality}
                  onChange={(e) => handleChange('quality', e.target.value)}
                  style={styles.select}
                >
                  {QUALITY_OPTIONS.map((item) => (
                    <option key={item.value} value={item.value}>{item.label}</option>
                  ))}
                </select>
              </div>
            </div>

            <label style={styles.label}>Stil notu</label>
            <input
              value={form.style}
              onChange={(e) => handleChange('style', e.target.value)}
              placeholder="Örnek: cinematic, realistic, soft light"
              style={styles.input}
            />

            <div style={styles.actionRow}>
              <button type="submit" disabled={submitting || !safeText(form.prompt)} style={styles.primaryButton}>
                {submitting ? 'Üretiliyor...' : 'Görsel Üret'}
              </button>

              <button type="button" disabled={!canCancel} onClick={handleCancel} style={styles.secondaryButton}>
                İptal
              </button>
            </div>
          </form>
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Aktif job</h2>
            <span style={{ ...styles.statusPill, borderColor: statusTone(activeStatus), color: statusTone(activeStatus) }}>
              {statusLabel(activeStatus || 'idle')}
            </span>
          </div>

          {!activeJob ? (
            <div style={styles.emptyText}>Henüz aktif job yok.</div>
          ) : (
            <>
              <div style={styles.jobMetaGrid}>
                <div>
                  <div style={styles.metaLabel}>JOB ID</div>
                  <div style={styles.metaValue}>{safeText(activeJob?.jobId, '-')}</div>
                </div>

                <div>
                  <div style={styles.metaLabel}>İLERLEME</div>
                  <div style={styles.metaValue}>{activeProgress}%</div>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={styles.metaLabel}>ADIM</div>
                  <div style={styles.stepText}>{activeStep}</div>
                </div>

                <div style={{ gridColumn: '1 / -1' }}>
                  <div style={styles.metaLabel}>PROMPT</div>
                  <div style={styles.metaValue}>{activePrompt || '-'}</div>
                </div>

                <div>
                  <div style={styles.metaLabel}>MODEL</div>
                  <div style={styles.metaValue}>{safeText(activeJob?.model || activeJob?.requestSummary?.model, DEFAULT_MODEL_ID)}</div>
                </div>

                <div>
                  <div style={styles.metaLabel}>BİTTİ</div>
                  <div style={styles.metaValue}>{formatDateTime(activeJob?.finishedAt)}</div>
                </div>
              </div>

              <div style={styles.progressBarOuter}>
                <div style={{ ...styles.progressBarInner, width: `${activeProgress}%` }} />
              </div>

              {activeStatus === 'failed_storage' ? (
                <div style={styles.warnBox}>
                  Görsel üretimi tamamlandı ama kalıcı depolama başarısız oldu.
                  Bu durumda completed görünmez. Bu beklenen koruma davranışıdır.
                </div>
              ) : null}

              {activeStatus === 'failed' ? (
                <div style={styles.warnBox}>
                  İş başarısız oldu. Promptu sadeleştirip tekrar deneyin.
                </div>
              ) : null}

              <div style={styles.previewWrap}>
                {activeImageUrls.length ? (
                  activeImageUrls.map((src, index) => (
                    <img
                      key={`${src}-${index}`}
                      src={src}
                      alt={`Üretilen görsel ${index + 1}`}
                      style={styles.previewImage}
                    />
                  ))
                ) : (
                  <div style={styles.emptyPreview}>Görsel henüz hazır değil. Worker tamamlayınca burada görünür.</div>
                )}
              </div>
            </>
          )}
        </section>

        <section style={styles.panel}>
          <div style={styles.panelHead}>
            <h2 style={styles.panelTitle}>Job geçmişi</h2>
            <button type="button" onClick={handleRefreshHistory} style={styles.secondaryButton}>
              {loadingHistory ? 'Yenileniyor...' : 'Yenile'}
            </button>
          </div>

          {renderedHistory.length === 0 ? (
            <div style={styles.emptyText}>Geçmiş bulunamadı.</div>
          ) : (
            <div style={styles.historyList}>
              {renderedHistory.map((job) => {
                const imgs = pickJobImages(job);
                const firstImage = imgs[0] || '';
                const tone = statusTone(job?.status);

                return (
                  <button
                    key={job.jobId}
                    type="button"
                    onClick={() => {
                      setActiveJob(job);
                      setActiveInlinePreview('');
                      mergeActiveImages(job, '');
                    }}
                    style={{ ...styles.historyCard, borderColor: tone }}
                  >
                    <div style={styles.historyTop}>
                      <div style={styles.historyTitle}>{safeText(job?.requestSummary?.promptPreview, 'İsimsiz job')}</div>
                      <span style={{ ...styles.statusPill, borderColor: tone, color: tone }}>
                        {statusLabel(job?.status)}
                      </span>
                    </div>

                    <div style={styles.historyDate}>{formatDateTime(job?.createdAt)}</div>

                    <div style={styles.historyMetaRow}>
                      <span>{safeText(job?.model, DEFAULT_MODEL_ID)}</span>
                      <span>{Math.max(0, Math.min(100, Math.floor(safeNumber(job?.progress, 0))))}%</span>
                    </div>

                    {firstImage ? (
                      <img src={firstImage} alt="Geçmiş görsel" style={styles.historyThumb} />
                    ) : (
                      <div style={styles.historyNoImage}>Önizleme yok</div>
                    )}
                  </button>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <div style={styles.footerInfo}>
        <div>Worker: {safeText(workerInfo?.worker, 'idm')}</div>
        <div>Sürüm: {safeText(workerInfo?.version, '-')}</div>
        <div>Model: {models[0]?.modelId || DEFAULT_MODEL_ID}</div>
        <div>Zaman: {formatDateTime(new Date().toISOString())}</div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#05060a',
    color: '#f8fafc',
    padding: '24px',
    fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
  },
  hero: {
    display: 'grid',
    gridTemplateColumns: '1.5fr 1fr',
    gap: '20px',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
    padding: '24px',
    background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))',
    marginBottom: '24px',
  },
  eyebrow: {
    fontSize: '12px',
    letterSpacing: '4px',
    color: '#00c2ff',
    marginBottom: '8px',
  },
  title: {
    fontSize: '28px',
    lineHeight: 1.1,
    margin: 0,
    marginBottom: '12px',
  },
  subtitle: {
    fontSize: '16px',
    color: '#cbd5e1',
    margin: 0,
    lineHeight: 1.6,
  },
  code: {
    background: 'rgba(255,255,255,0.08)',
    padding: '2px 8px',
    borderRadius: '8px',
  },
  routeBox: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '20px',
    padding: '18px',
    background: '#020307',
  },
  routeTitle: {
    fontSize: '16px',
    marginBottom: '14px',
  },
  routeWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
  },
  routePill: {
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '999px',
    padding: '8px 12px',
    fontSize: '13px',
    color: '#e2e8f0',
  },
  errorBox: {
    marginBottom: '20px',
    border: '1px solid rgba(239,68,68,0.5)',
    background: 'rgba(239,68,68,0.12)',
    borderRadius: '16px',
    padding: '14px 16px',
    color: '#fecaca',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr 1fr',
    gap: '20px',
    alignItems: 'start',
  },
  panel: {
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '24px',
    padding: '20px',
    background: '#090b12',
  },
  panelHead: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '12px',
    marginBottom: '18px',
  },
  panelTitle: {
    margin: 0,
    fontSize: '18px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    color: '#e2e8f0',
    marginBottom: '8px',
    marginTop: '14px',
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#05060a',
    color: '#fff',
    padding: '12px 14px',
    outline: 'none',
  },
  textarea: {
    width: '100%',
    boxSizing: 'border-box',
    minHeight: '140px',
    resize: 'vertical',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#05060a',
    color: '#fff',
    padding: '12px 14px',
    outline: 'none',
  },
  select: {
    width: '100%',
    boxSizing: 'border-box',
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: '#05060a',
    color: '#fff',
    padding: '12px 14px',
    outline: 'none',
  },
  twoCol: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },
  quickWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '10px',
    marginTop: '12px',
  },
  quickButton: {
    borderRadius: '999px',
    border: '1px solid rgba(0,194,255,0.35)',
    background: 'rgba(0,194,255,0.08)',
    color: '#8ae7ff',
    padding: '9px 12px',
    cursor: 'pointer',
  },
  actionRow: {
    display: 'flex',
    gap: '12px',
    marginTop: '18px',
  },
  primaryButton: {
    borderRadius: '16px',
    border: '1px solid rgba(0,194,255,0.4)',
    background: '#00c2ff',
    color: '#03131a',
    fontWeight: 700,
    padding: '12px 16px',
    cursor: 'pointer',
  },
  secondaryButton: {
    borderRadius: '16px',
    border: '1px solid rgba(255,255,255,0.12)',
    background: 'transparent',
    color: '#fff',
    padding: '12px 16px',
    cursor: 'pointer',
  },
  statusPill: {
    border: '1px solid rgba(255,255,255,0.14)',
    borderRadius: '999px',
    padding: '6px 10px',
    fontSize: '12px',
    letterSpacing: '1px',
    whiteSpace: 'nowrap',
  },
  jobMetaGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '14px',
  },
  metaLabel: {
    fontSize: '12px',
    color: '#94a3b8',
    marginBottom: '6px',
    letterSpacing: '1px',
  },
  metaValue: {
    fontSize: '15px',
    color: '#f8fafc',
    lineHeight: 1.5,
    wordBreak: 'break-word',
  },
  stepText: {
    fontSize: '15px',
    lineHeight: 1.7,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
    color: '#f8fafc',
  },
  progressBarOuter: {
    height: '10px',
    background: 'rgba(255,255,255,0.08)',
    borderRadius: '999px',
    overflow: 'hidden',
    marginTop: '16px',
  },
  progressBarInner: {
    height: '100%',
    background: '#00c2ff',
    borderRadius: '999px',
    transition: 'width 0.25s ease',
  },
  previewWrap: {
    marginTop: '18px',
    display: 'grid',
    gap: '14px',
  },
  previewImage: {
    width: '100%',
    display: 'block',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#020307',
  },
  emptyPreview: {
    minHeight: '260px',
    borderRadius: '18px',
    border: '1px dashed rgba(255,255,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    textAlign: 'center',
    padding: '20px',
    background: '#05060a',
  },
  warnBox: {
    marginTop: '14px',
    border: '1px solid rgba(245,158,11,0.35)',
    background: 'rgba(245,158,11,0.08)',
    color: '#fde68a',
    borderRadius: '16px',
    padding: '12px 14px',
    lineHeight: 1.6,
  },
  emptyText: {
    color: '#94a3b8',
    lineHeight: 1.6,
  },
  historyList: {
    display: 'grid',
    gap: '14px',
  },
  historyCard: {
    textAlign: 'left',
    width: '100%',
    borderRadius: '18px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#071018',
    padding: '14px',
    color: '#fff',
    cursor: 'pointer',
  },
  historyTop: {
    display: 'flex',
    alignItems: 'start',
    justifyContent: 'space-between',
    gap: '10px',
    marginBottom: '8px',
  },
  historyTitle: {
    fontSize: '18px',
    fontWeight: 600,
    lineHeight: 1.35,
  },
  historyDate: {
    color: '#94a3b8',
    fontSize: '14px',
    marginBottom: '10px',
  },
  historyMetaRow: {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '10px',
    color: '#cbd5e1',
    fontSize: '13px',
    marginBottom: '12px',
  },
  historyThumb: {
    width: '100%',
    display: 'block',
    borderRadius: '14px',
    border: '1px solid rgba(255,255,255,0.08)',
    background: '#020307',
  },
  historyNoImage: {
    minHeight: '90px',
    borderRadius: '14px',
    border: '1px dashed rgba(255,255,255,0.12)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#94a3b8',
    background: '#05060a',
  },
  footerInfo: {
    marginTop: '24px',
    display: 'flex',
    flexWrap: 'wrap',
    gap: '16px',
    color: '#94a3b8',
    fontSize: '13px',
  },
};
