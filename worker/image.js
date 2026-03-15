/*
█████████████████████████████████████████████
image.tsx — v2.0.0
Değişiklikler:
1) WorkerEnvelope.error genişletildi — bullets, displayDurationMs, context alanları eklendi
2) workerRequest artık hata detaylarını (bullets) da fırlatıyor
3) handleGenerate: worker zaten completed dönüyorsa poll başlatmıyor, direkt görseli set ediyor
4) Hata gösterimi: bullets varsa madde madde, displayDurationMs ile minimum 5 sn görünür
5) Yeni üretimde önceki hata otomatik temizleniyor
6) İlerleme çubuğu: optimistic olarak zamanla ilerliyor (fake progress), completed'da %100
7) Hata bloğu: her madde ayrı satırda, 5 sn sayacı ile otomatik kararıyor (ama silinmiyor)
█████████████████████████████████████████████
*/
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

// ─────────────────── TİPLER ───────────────────

type WorkerError = {
  message?: string;
  code?: string;
  context?: string;
  bullets?: string[];
  displayDurationMs?: number;
  retryable?: boolean;
  timestamp?: string;
};

type WorkerEnvelope<T> = {
  ok: boolean;
  code: string;
  data: T;
  error: WorkerError | null;
  meta?: unknown;
  requestId?: string;
  traceId?: string;
  time?: string;
  durationMs?: number;
};

type ModelItem = {
  id?: string;
  modelId?: string;
  modelName?: string;
  company?: string;
  provider?: string;
  categoryRaw?: string;
  imagePrice?: number | null;
  inputPrice?: number | null;
  outputPrice?: number | null;
  speedLabel?: string;
  standoutFeature?: string;
  useCase?: string;
  badges?: string[];
};

type ModelsPayload = {
  items: ModelItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type GeneratePayload = {
  jobId: string;
  status: JobStatus;
  progress: number;
  step: string;
  modelId?: string;
  requestId?: string;
  // Worker senkron üretim yapıyorsa bunlar dolu gelir
  outputUrl?: string | null;
  outputUrls?: string[];
  url?: string | null;
  urls?: string[];
  error?: WorkerError | null;
};

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';

type JobRecord = {
  jobId: string;
  feature?: string;
  status: JobStatus;
  progress?: number;
  step?: string;
  outputUrl?: string | null;
  outputUrls?: string[];
  url?: string | null;
  urls?: string[];
  retryable?: boolean;
  cancelRequested?: boolean;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
  error?: WorkerError | null;
  requestSummary?: {
    model?: string;
    prompt?: string;
    promptPreview?: string;
  };
  request?: {
    model?: string;
    modelId?: string;
    ratio?: string;
    size?: string;
    quality?: string;
    style?: string;
    negativePrompt?: string;
    n?: number;
  };
};

type HistoryPayload = {
  items: JobRecord[];
  total: number;
  limit: number;
  feature: string;
};

// Ekranda gösterilecek hata yapısı
type DisplayError = {
  message: string;
  bullets: string[];
  displayDurationMs: number;
  timestamp: number; // Date.now()
};

// ─────────────────── SABİTLER ───────────────────

const WORKER_BASE_URL = 'https://idm.puter.work';
const POLL_INTERVAL_MS = 2000;
const TERMINAL_STATUSES = new Set<JobStatus>(['completed', 'failed', 'cancelled']);
const RATIO_OPTIONS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const QUALITY_OPTIONS = ['low', 'medium', 'high'];
const STYLE_OPTIONS = ['', 'photorealistic', 'illustration', 'anime', 'cinematic', 'digital-art'];
const ERROR_DISPLAY_MS = 5000; // minimum gösterim süresi

// ─────────────────── YARDIMCILAR ───────────────────

function joinUrl(path: string): string {
  return `${WORKER_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function pickJobImages(job: JobRecord | GeneratePayload | null): string[] {
  if (!job) return [];
  const candidates = [
    ...(Array.isArray((job as JobRecord).outputUrls) ? (job as JobRecord).outputUrls! : []),
    ...(Array.isArray((job as JobRecord).urls) ? (job as JobRecord).urls! : []),
    ...((job as JobRecord).outputUrl ? [(job as JobRecord).outputUrl!] : []),
    ...((job as JobRecord).url ? [(job as JobRecord).url!] : []),
  ].filter(Boolean) as string[];
  return [...new Set(candidates)];
}

function modelKey(model: ModelItem): string {
  return model.modelId || model.id || '';
}

function modelLabel(model: ModelItem): string {
  const provider = model.provider || model.company || 'Model';
  const name = model.modelName || model.modelId || model.id || 'Bilinmeyen Model';
  return `${provider} · ${name}`;
}

function formatPrice(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return '-';
  return `$${value}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'medium' }).format(new Date(value));
  } catch {
    return value;
  }
}

// Hata nesnesinden DisplayError üret
function buildDisplayError(err: unknown, fallbackMsg?: string): DisplayError {
  const DEFAULT_MSG = fallbackMsg || 'Görsel üretimi sırasında beklenmeyen bir hata oluştu.';

  if (err && typeof err === 'object') {
    const e = err as Record<string, unknown>;
    const message = typeof e.message === 'string' && e.message.trim() ? e.message.trim() : DEFAULT_MSG;
    const bullets = Array.isArray(e.bullets) && e.bullets.length
      ? (e.bullets as string[])
      : [
          `1) Hata: ${message}`,
          `2) Kod: ${typeof e.code === 'string' ? e.code : 'BILINMIYOR'} — işlem başarısız oldu.`,
          `3) Lütfen prompt ve model seçimini kontrol ederek tekrar deneyin.`,
        ];
    const displayDurationMs = typeof e.displayDurationMs === 'number' ? e.displayDurationMs : ERROR_DISPLAY_MS;
    return { message, bullets, displayDurationMs, timestamp: Date.now() };
  }

  if (typeof err === 'string' && err.trim()) {
    return {
      message: err.trim(),
      bullets: [
        `1) Hata mesajı: ${err.trim()}`,
        `2) İşlem tamamlanamadı — beklenmeyen bir durum meydana geldi.`,
        `3) Prompt ve model seçimini kontrol ederek tekrar deneyin.`,
      ],
      displayDurationMs: ERROR_DISPLAY_MS,
      timestamp: Date.now(),
    };
  }

  return {
    message: DEFAULT_MSG,
    bullets: [
      `1) Hata detayı alınamadı — bilinmeyen bir istisna fırlatıldı.`,
      `2) Worker bağlantısı veya AI servisi geçici olarak erişilemez olabilir.`,
      `3) Birkaç saniye bekleyip tekrar deneyiniz veya farklı model seçiniz.`,
    ],
    displayDurationMs: ERROR_DISPLAY_MS,
    timestamp: Date.now(),
  };
}

// ─────────────────── WORKER REQUEST ───────────────────

// WorkerError fırlatan özel hata sınıfı
class WorkerRequestError extends Error {
  public readonly workerError: WorkerError;
  constructor(workerError: WorkerError) {
    super(workerError.message || 'Worker isteği başarısız.');
    this.name = 'WorkerRequestError';
    this.workerError = workerError;
  }
}

async function workerRequest<T>(path: string, init?: RequestInit): Promise<WorkerEnvelope<T>> {
  let response: Response;
  try {
    response = await fetch(joinUrl(path), {
      ...init,
      headers: { 'content-type': 'application/json', ...(init?.headers || {}) },
    });
  } catch (fetchErr) {
    const e: WorkerError = {
      message: 'Ağ bağlantı hatası — worker\'a ulaşılamadı.',
      code: 'NETWORK_ERROR',
      context: path,
      bullets: [
        `1) fetch() çağrısı başarısız oldu — sunucuya TCP bağlantısı kurulamadı.`,
        `2) İnternet bağlantınızı veya ${WORKER_BASE_URL} adresinin erişilebilir olduğunu kontrol edin.`,
        `3) Birkaç saniye bekleyip "Üretimi başlat" butonuna tekrar tıklayınız.`,
      ],
      displayDurationMs: ERROR_DISPLAY_MS,
      retryable: true,
    };
    throw new WorkerRequestError(e);
  }

  let payload: WorkerEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as WorkerEnvelope<T>;
  } catch {
    const e: WorkerError = {
      message: 'Worker geçerli JSON döndürmedi.',
      code: 'INVALID_JSON_RESPONSE',
      context: path,
      bullets: [
        `1) HTTP ${response.status} geldi fakat yanıt gövdesi JSON formatında değildi.`,
        `2) Worker beklenmedik bir içerik türü veya boş yanıt döndürdü.`,
        `3) Worker deploy durumunu kontrol edin — yeniden deploy gerekebilir.`,
      ],
      displayDurationMs: ERROR_DISPLAY_MS,
      retryable: false,
    };
    throw new WorkerRequestError(e);
  }

  // ok: false durumu — bullets dahil tüm hata bilgisini taşı
  if (!payload?.ok) {
    const workerErr: WorkerError = payload?.error || {
      message: `Worker isteği başarısız (HTTP ${response.status}).`,
      code: payload?.code || 'REQUEST_FAILED',
    };
    throw new WorkerRequestError(workerErr);
  }

  return payload;
}

// ─────────────────── ANA COMPONENT ───────────────────

export default function ImagePage() {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [quality, setQuality] = useState('medium');
  const [style, setStyle] = useState('');
  const [count, setCount] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [history, setHistory] = useState<JobRecord[]>([]);
  const [activeJob, setActiveJob] = useState<JobRecord | null>(null);

  // Hata artık tek string değil, detaylı yapı
  const [displayError, setDisplayError] = useState<DisplayError | null>(null);

  // Fake progress için
  const [fakeProgress, setFakeProgress] = useState(0);
  const fakeProgressRef = useRef<number | null>(null);

  const pollTimerRef = useRef<number | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => modelKey(item) === selectedModelId) || null,
    [models, selectedModelId]
  );

  const activeImages = useMemo(() => pickJobImages(activeJob), [activeJob]);

  // ── Hata göster ────────────────────────────────────
  const showError = useCallback((err: unknown, fallback?: string) => {
    const de = buildDisplayError(err, fallback);
    setDisplayError(de);
  }, []);

  const clearError = useCallback(() => setDisplayError(null), []);

  // ── Fake progress ───────────────────────────────────
  const startFakeProgress = useCallback(() => {
    setFakeProgress(5);
    let current = 5;
    const tick = () => {
      // Maksimum %90'a kadar yavaşlayarak ilerle
      if (current < 90) {
        const step = current < 30 ? 5 : current < 60 ? 3 : current < 80 ? 1 : 0.5;
        current = Math.min(90, current + step);
        setFakeProgress(Math.round(current));
        fakeProgressRef.current = window.setTimeout(tick, 600);
      }
    };
    fakeProgressRef.current = window.setTimeout(tick, 600);
  }, []);

  const stopFakeProgress = useCallback((finalValue: number) => {
    if (fakeProgressRef.current != null) {
      window.clearTimeout(fakeProgressRef.current);
      fakeProgressRef.current = null;
    }
    setFakeProgress(finalValue);
  }, []);

  // ── Polling ─────────────────────────────────────────
  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const env = await workerRequest<HistoryPayload>('/jobs/history?limit=12');
      setHistory(Array.isArray(env.data?.items) ? env.data.items : []);
    } catch (err) {
      console.error('History yüklenemedi:', err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    clearError();
    try {
      const env = await workerRequest<ModelsPayload>('/models?feature=image&sort=price_asc&limit=100');
      const items = Array.isArray(env.data?.items) ? env.data.items : [];
      setModels(items);
      setSelectedModelId((current) => current || modelKey(items[0]) || '');
    } catch (err) {
      showError(err, 'Model listesi yüklenemedi.');
    } finally {
      setModelsLoading(false);
    }
  }, [clearError, showError]);

  const pollJob = useCallback(
    async (jobId: string) => {
      stopPolling();
      try {
        const env = await workerRequest<JobRecord>(`/jobs/status/${encodeURIComponent(jobId)}`);
        const job = env.data;
        setActiveJob(job);
        if (TERMINAL_STATUSES.has(job.status)) {
          stopFakeProgress(job.status === 'completed' ? 100 : fakeProgress);
          setSubmitting(false);
          if (job.status === 'failed' && job.error) {
            showError(job.error, 'Görsel üretimi başarısız oldu.');
          }
          void refreshHistory();
          return;
        }
        pollTimerRef.current = window.setTimeout(() => void pollJob(jobId), POLL_INTERVAL_MS);
      } catch (err) {
        stopFakeProgress(0);
        showError(err, 'Job durumu okunamadı.');
        setSubmitting(false);
      }
    },
    [fakeProgress, refreshHistory, showError, stopFakeProgress, stopPolling]
  );

  useEffect(() => {
    void loadModels();
    void refreshHistory();
    return () => {
      stopPolling();
      if (fakeProgressRef.current != null) window.clearTimeout(fakeProgressRef.current);
    };
  }, [loadModels, refreshHistory, stopPolling]);

  // ── Üretim başlat ────────────────────────────────────
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) { showError({ message: 'Prompt boş bırakılamaz.', code: 'PROMPT_REQUIRED', bullets: ['1) Prompt alanı zorunludur — üretim başlatılamaz.', '2) En az birkaç kelimelik açıklayıcı bir metin giriniz.', '3) Örnek: "Gece yağmurunda neon ışıklı bir şehir manzarası"'] }); return; }
    if (!selectedModelId) { showError({ message: 'Model seçilmedi.', code: 'MODEL_REQUIRED', bullets: ['1) Üretim başlatmak için sol panelden bir model seçmeniz gerekmektedir.', '2) Dropdown listesinden herhangi bir görsel model seçiniz.', '3) Model listesi boşsa "Modelleri yenile" butonuna tıklayınız.'] }); return; }

    stopPolling();
    stopFakeProgress(0);
    clearError();
    setSubmitting(true);
    setActiveJob(null);
    startFakeProgress();

    try {
      const env = await workerRequest<GeneratePayload>('/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim(),
          model: selectedModelId,
          quality, ratio, style, n: count,
          responseFormat: 'url',
          metadata: { page: 'src/pages/AI/image.tsx', source: 'worker-only' },
        }),
      });

      const payload = env.data;

      if (!payload?.jobId) {
        throw new WorkerRequestError({ message: 'Worker jobId döndürmedi.', code: 'NO_JOB_ID', bullets: ['1) Worker POST /generate isteğine jobId içermeyen yanıt döndürdü.', '2) Worker kodu veya deploy durumu hatalı olabilir.', '3) Worker\'ı yeniden deploy edip tekrar deneyiniz.'] });
      }

      // Worker senkron üretim yapıyorsa — completed direkt gelir
      if (payload.status === 'completed' || payload.status === 'failed') {
        stopFakeProgress(payload.status === 'completed' ? 100 : 0);

        const syntheticJob: JobRecord = {
          jobId: payload.jobId,
          status: payload.status,
          progress: payload.status === 'completed' ? 100 : 0,
          step: payload.step || payload.status,
          outputUrl: payload.outputUrl || null,
          outputUrls: Array.isArray(payload.outputUrls) ? payload.outputUrls : [],
          url: payload.url || null,
          urls: Array.isArray(payload.urls) ? payload.urls : [],
          requestSummary: { model: payload.modelId || selectedModelId, prompt, promptPreview: prompt.length > 120 ? `${prompt.slice(0, 119)}…` : prompt },
          request: { modelId: selectedModelId, ratio, quality, style, negativePrompt, n: count },
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          error: payload.error || null,
        };

        setActiveJob(syntheticJob);
        setSubmitting(false);

        if (payload.status === 'failed' && payload.error) {
          showError(payload.error, 'Görsel üretimi başarısız oldu.');
        }

        void refreshHistory();
        return; // poll YOK — zaten bitti
      }

      // Hâlâ queued/processing — optimistic job set et ve poll başlat
      const optimisticJob: JobRecord = {
        jobId: payload.jobId,
        status: payload.status || 'queued',
        progress: payload.progress ?? 0,
        step: payload.step || 'queued',
        requestSummary: { model: payload.modelId || selectedModelId, prompt, promptPreview: prompt.length > 120 ? `${prompt.slice(0, 119)}…` : prompt },
        request: { modelId: selectedModelId, ratio, quality, style, negativePrompt, n: count },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setActiveJob(optimisticJob);
      void refreshHistory();
      void pollJob(payload.jobId);

    } catch (err) {
      stopFakeProgress(0);
      setSubmitting(false);

      if (err instanceof WorkerRequestError) {
        showError(err.workerError, 'Görsel üretimi başlatılamadı.');
      } else {
        showError(err, 'Görsel üretimi başlatılamadı.');
      }
    }
  }, [clearError, count, negativePrompt, pollJob, prompt, quality, ratio, refreshHistory, selectedModelId, showError, startFakeProgress, stopFakeProgress, stopPolling, style]);

  // ── İptal ────────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (!activeJob?.jobId || TERMINAL_STATUSES.has(activeJob.status)) return;
    clearError();
    try {
      const env = await workerRequest<JobRecord>('/jobs/cancel', {
        method: 'POST',
        body: JSON.stringify({ jobId: activeJob.jobId }),
      });
      stopPolling();
      stopFakeProgress(0);
      setSubmitting(false);
      setActiveJob(env.data);
      void refreshHistory();
    } catch (err) {
      showError(err, 'Job iptal edilemedi.');
    }
  }, [activeJob, clearError, refreshHistory, showError, stopFakeProgress, stopPolling]);

  // ── Geçmişten job aç ─────────────────────────────────
  const openHistoryJob = useCallback(
    async (jobId: string) => {
      clearError();
      stopPolling();
      stopFakeProgress(0);
      try {
        const env = await workerRequest<JobRecord>(`/jobs/status/${encodeURIComponent(jobId)}`);
        const job = env.data;
        setActiveJob(job);
        if (!TERMINAL_STATUSES.has(job.status)) {
          setSubmitting(true);
          startFakeProgress();
          void pollJob(jobId);
        } else {
          setSubmitting(false);
          if (job.status === 'failed' && job.error) {
            showError(job.error, 'Bu job başarısız olmuş.');
          }
        }
      } catch (err) {
        showError(err, 'Job açılamadı.');
      }
    },
    [clearError, pollJob, showError, startFakeProgress, stopFakeProgress, stopPolling]
  );

  // ── İlerleme değeri ──────────────────────────────────
  const progressValue = activeJob?.status === 'completed'
    ? 100
    : activeJob?.status === 'failed' || activeJob?.status === 'cancelled'
    ? fakeProgress
    : Math.max(fakeProgress, activeJob?.progress ?? 0);

  // ─────────────────── RENDER ───────────────────

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">

        {/* Başlık */}
        <div className="mb-6 rounded-3xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">IMAGE WORKER</p>
              <h1 className="text-3xl font-bold tracking-tight">Tek worker üstünden görsel üretim</h1>
              <p className="mt-3 max-w-3xl text-sm text-neutral-300">
                Bu sayfa sadece{' '}
                <code className="rounded bg-neutral-800 px-2 py-1 text-xs">https://idm.puter.work</code>{' '}
                ile konuşur. Model listeleme, job başlatma, durum takibi, geçmiş ve iptal akışlarının tamamı aynı worker üstünden yürür.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-xs text-neutral-300">
              <div className="mb-2 font-semibold text-neutral-100">Aktif route'lar</div>
              <div className="flex flex-wrap gap-2">
                {['/models', '/generate', '/jobs/status/:id', '/jobs/history', '/jobs/cancel'].map((item) => (
                  <span key={item} className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1">{item}</span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Hata bloğu — detaylı, minimum 5 sn */}
        {displayError ? (
          <div className="mb-6 rounded-2xl border border-rose-700/60 bg-rose-950/40 px-5 py-4 text-sm text-rose-200">
            <div className="mb-3 flex items-start justify-between gap-4">
              <p className="font-semibold text-rose-100">{displayError.message}</p>
              <button
                type="button"
                onClick={clearError}
                className="shrink-0 rounded-lg border border-rose-700/40 px-2 py-1 text-xs text-rose-400 transition hover:bg-rose-900/40"
              >
                Kapat
              </button>
            </div>
            {displayError.bullets.length > 0 && (
              <ul className="space-y-1.5">
                {displayError.bullets.map((b, i) => (
                  <li key={i} className="leading-relaxed text-rose-300">{b}</li>
                ))}
              </ul>
            )}
          </div>
        ) : null}

        {/* 3 kolon layout */}
        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)_360px]">

          {/* SOL: Üretim ayarları */}
          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Üretim ayarları</h2>
              <button
                type="button"
                onClick={() => void loadModels()}
                className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
              >
                {modelsLoading ? 'Yükleniyor...' : 'Modelleri yenile'}
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-200">Model</label>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none ring-0 transition focus:border-cyan-500"
                >
                  {models.map((model) => (
                    <option key={modelKey(model)} value={modelKey(model)}>{modelLabel(model)}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-200">Prompt</label>
                <textarea
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  placeholder="Örnek: Gece yağmurunda neon ışıkları altında yürüyen siberpunk kedi"
                  rows={5}
                  className="w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-neutral-200">Negatif prompt</label>
                <textarea
                  value={negativePrompt}
                  onChange={(e) => setNegativePrompt(e.target.value)}
                  placeholder="Örnek: blur, watermark, deformed hands"
                  rows={3}
                  className="w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-200">Oran</label>
                  <select
                    value={ratio}
                    onChange={(e) => setRatio(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
                  >
                    {RATIO_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-200">Kalite</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
                  >
                    {QUALITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-200">Stil</label>
                  <select
                    value={style}
                    onChange={(e) => setStyle(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
                  >
                    {STYLE_OPTIONS.map((item) => <option key={item || 'none'} value={item}>{item || 'Varsayılan'}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-200">Adet</label>
                  <input
                    type="number" min={1} max={4} value={count}
                    onChange={(e) => setCount(Math.max(1, Math.min(4, Number(e.target.value) || 1)))}
                    className="w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
                  />
                </div>
              </div>

              {selectedModel ? (
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4 text-sm text-neutral-300">
                  <div className="mb-2 font-semibold text-neutral-100">Seçili model özeti</div>
                  <div className="space-y-2">
                    <div><span className="text-neutral-500">Ad:</span> {modelLabel(selectedModel)}</div>
                    <div><span className="text-neutral-500">Görsel fiyatı:</span> {formatPrice(selectedModel.imagePrice)}</div>
                    <div><span className="text-neutral-500">Hız:</span> {selectedModel.speedLabel || '-'}</div>
                    <div><span className="text-neutral-500">Öne çıkan:</span> {selectedModel.standoutFeature || '-'}</div>
                  </div>
                </div>
              ) : null}

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => void handleGenerate()}
                  disabled={submitting || !prompt.trim() || !selectedModelId}
                  className="flex-1 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Üretim sürüyor...' : 'Üretimi başlat'}
                </button>
                <button
                  type="button"
                  onClick={() => void handleCancel()}
                  disabled={!activeJob || TERMINAL_STATUSES.has(activeJob.status)}
                  className="rounded-2xl border border-neutral-700 px-4 py-3 text-sm font-semibold text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  İptal et
                </button>
              </div>
            </div>
          </section>

          {/* ORTA: Aktif job */}
          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Aktif job</h2>
              {activeJob ? (
                <span className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${
                  activeJob.status === 'completed' ? 'border-emerald-700 text-emerald-300' :
                  activeJob.status === 'failed' ? 'border-rose-700 text-rose-300' :
                  activeJob.status === 'cancelled' ? 'border-neutral-600 text-neutral-400' :
                  'border-neutral-700 text-cyan-300'
                }`}>
                  {activeJob.status}
                </span>
              ) : null}
            </div>

            {activeJob ? (
              <div className="space-y-5">
                <div className="rounded-2xl border border-neutral-800 bg-neutral-950/70 p-4">
                  <div className="grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Job ID</div>
                      <div className="mt-1 break-all text-sm text-neutral-100">{activeJob.jobId}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Adım</div>
                      <div className="mt-1 text-sm text-neutral-100">{activeJob.step || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">İlerleme</div>
                      <div className="mt-1 text-sm text-neutral-100">{progressValue}%</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Model</div>
                      <div className="mt-1 text-sm text-neutral-100">{activeJob.requestSummary?.model || activeJob.request?.modelId || '-'}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Oluşturuldu</div>
                      <div className="mt-1 text-sm text-neutral-100">{formatDate(activeJob.createdAt)}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-neutral-500">Bitti</div>
                      <div className="mt-1 text-sm text-neutral-100">{formatDate(activeJob.finishedAt)}</div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <div className="mb-2 text-xs uppercase tracking-[0.18em] text-neutral-500">Prompt</div>
                    <div className="rounded-2xl border border-neutral-800 bg-neutral-900 px-4 py-3 text-sm text-neutral-200">
                      {activeJob.requestSummary?.promptPreview || activeJob.requestSummary?.prompt || prompt || '-'}
                    </div>
                  </div>

                  {/* İlerleme çubuğu */}
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${
                        activeJob.status === 'completed' ? 'bg-emerald-400' :
                        activeJob.status === 'failed' ? 'bg-rose-500' :
                        'bg-cyan-400'
                      }`}
                      style={{ width: `${Math.max(0, Math.min(100, progressValue))}%` }}
                    />
                  </div>

                  {/* Job seviyesindeki hata — hata bloğundan bağımsız, küçük */}
                  {activeJob.error?.message && activeJob.status === 'failed' ? (
                    <div className="mt-3 rounded-xl border border-rose-800/40 bg-rose-950/20 px-3 py-2 text-xs text-rose-300">
                      {activeJob.error.message}
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="mb-3 text-sm font-medium text-neutral-200">Üretilen görseller</div>
                  {activeImages.length ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {activeImages.map((url) => (
                        <a key={url} href={url} target="_blank" rel="noreferrer"
                          className="group overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950">
                          <img src={url} alt="Generated"
                            className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[340px] items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-950/60 px-6 text-center text-sm text-neutral-500">
                      {activeJob.status === 'failed' ? 'Job başarısız oldu. Yukarıdaki hata bloğunu incele.' :
                       activeJob.status === 'cancelled' ? 'Job iptal edildi.' :
                       submitting ? 'Üretim devam ediyor, lütfen bekle...' :
                       'Görsel henüz hazır değil.'}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[520px] items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-950/60 px-6 text-center text-sm text-neutral-500">
                Henüz aktif job yok. Soldan ayarları seçip üretimi başlat.
              </div>
            )}
          </section>

          {/* SAĞ: Geçmiş */}
          <aside className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Job geçmişi</h2>
              <button
                type="button"
                onClick={() => void refreshHistory()}
                className="rounded-xl border border-neutral-700 px-3 py-2 text-xs font-medium text-neutral-200 transition hover:border-neutral-500 hover:bg-neutral-800"
              >
                {historyLoading ? 'Yenileniyor...' : 'Yenile'}
              </button>
            </div>

            <div className="space-y-3">
              {history.length ? (
                history.map((job) => {
                  const previewImages = pickJobImages(job);
                  const isActive = activeJob?.jobId === job.jobId;
                  return (
                    <button
                      type="button"
                      key={job.jobId}
                      onClick={() => void openHistoryJob(job.jobId)}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isActive ? 'border-cyan-500 bg-cyan-500/10' :
                        'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700 hover:bg-neutral-950'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-neutral-100">
                          {job.requestSummary?.promptPreview || job.jobId}
                        </span>
                        <span className={`rounded-full border px-2 py-1 text-[10px] uppercase tracking-[0.18em] ${
                          job.status === 'completed' ? 'border-emerald-800 text-emerald-400' :
                          job.status === 'failed' ? 'border-rose-800 text-rose-400' :
                          'border-neutral-700 text-neutral-300'
                        }`}>
                          {job.status}
                        </span>
                      </div>
                      <div className="mb-3 text-xs text-neutral-500">{formatDate(job.createdAt)}</div>
                      {previewImages[0] ? (
                        <img src={previewImages[0]} alt="History preview"
                          className="mb-3 aspect-video w-full rounded-2xl object-cover" />
                      ) : null}
                      <div className="flex items-center justify-between text-xs text-neutral-400">
                        <span>{job.requestSummary?.model || job.request?.modelId || '-'}</span>
                        <span>{job.progress ?? 0}%</span>
                      </div>
                    </button>
                  );
                })
              ) : (
                <div className="rounded-2xl border border-dashed border-neutral-800 bg-neutral-950/60 px-4 py-8 text-center text-sm text-neutral-500">
                  Geçmiş boş. İlk üretimden sonra burada görünecek.
                </div>
              )}
            </div>
          </aside>
        </div>
      </div>
    </div>
  );
}
