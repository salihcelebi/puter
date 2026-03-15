import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type WorkerEnvelope<T> = {
  ok: boolean;
  code: string;
  data: T;
  error: { message?: string } | null;
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
  error?: {
    message?: string;
    code?: string;
  } | null;
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

const WORKER_BASE_URL = 'https://idm.puter.work';
const POLL_INTERVAL_MS = 1800;
const TERMINAL_STATUSES = new Set<JobStatus>(['completed', 'failed', 'cancelled']);
const RATIO_OPTIONS = ['1:1', '16:9', '9:16', '4:3', '3:4'];
const QUALITY_OPTIONS = ['low', 'medium', 'high'];
const STYLE_OPTIONS = ['', 'photorealistic', 'illustration', 'anime', 'cinematic', 'digital-art'];

function joinUrl(path: string): string {
  return `${WORKER_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

function pickJobImages(job: JobRecord | null): string[] {
  if (!job) return [];
  const candidates = [
    ...(Array.isArray(job.outputUrls) ? job.outputUrls : []),
    ...(Array.isArray(job.urls) ? job.urls : []),
    ...(job.outputUrl ? [job.outputUrl] : []),
    ...(job.url ? [job.url] : []),
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
  return `${value}`;
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('tr-TR', {
      dateStyle: 'short',
      timeStyle: 'medium',
    }).format(new Date(value));
  } catch {
    return value;
  }
}

async function workerRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(joinUrl(path), {
    ...init,
    headers: {
      'content-type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  let payload: WorkerEnvelope<T> | null = null;
  try {
    payload = (await response.json()) as WorkerEnvelope<T>;
  } catch {
    throw new Error('Worker geçerli JSON döndürmedi.');
  }

  if (!response.ok || !payload?.ok) {
    const message = payload?.error?.message || `Worker isteği başarısız oldu (${response.status}).`;
    throw new Error(message);
  }

  return payload.data;
}

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
  const [error, setError] = useState('');
  const pollTimerRef = useRef<number | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => modelKey(item) === selectedModelId) || null,
    [models, selectedModelId]
  );

  const activeImages = useMemo(() => pickJobImages(activeJob), [activeJob]);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const data = await workerRequest<HistoryPayload>('/jobs/history?limit=12');
      setHistory(Array.isArray(data.items) ? data.items : []);
    } catch (err) {
      console.error(err);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setError('');
    try {
      const data = await workerRequest<ModelsPayload>('/models?feature=image&sort=price_asc&limit=100');
      const items = Array.isArray(data.items) ? data.items : [];
      setModels(items);
      setSelectedModelId((current) => current || modelKey(items[0]) || '');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Modeller alınamadı.';
      setError(message);
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const pollJob = useCallback(
    async (jobId: string) => {
      stopPolling();
      try {
        const job = await workerRequest<JobRecord>(`/jobs/status/${encodeURIComponent(jobId)}`);
        setActiveJob(job);
        if (TERMINAL_STATUSES.has(job.status)) {
          setSubmitting(false);
          await refreshHistory();
          return;
        }
        pollTimerRef.current = window.setTimeout(() => {
          void pollJob(jobId);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Job durumu okunamadı.';
        setError(message);
        setSubmitting(false);
      }
    },
    [refreshHistory, stopPolling]
  );

  useEffect(() => {
    void loadModels();
    void refreshHistory();
    return () => stopPolling();
  }, [loadModels, refreshHistory, stopPolling]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Prompt zorunlu.');
      return;
    }
    if (!selectedModelId) {
      setError('Model seçmelisin.');
      return;
    }

    stopPolling();
    setSubmitting(true);
    setError('');
    setActiveJob(null);

    try {
      const payload = await workerRequest<GeneratePayload>('/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: prompt.trim(),
          negativePrompt: negativePrompt.trim(),
          model: selectedModelId,
          quality,
          ratio,
          style,
          n: count,
          responseFormat: 'url',
          metadata: {
            page: 'src/pages/AI/image.tsx',
            source: 'worker-only',
          },
        }),
      });

      if (!payload?.jobId) {
        throw new Error('Worker jobId dönmedi.');
      }

      const optimisticJob: JobRecord = {
        jobId: payload.jobId,
        status: payload.status || 'queued',
        progress: payload.progress ?? 0,
        step: payload.step || 'queued',
        requestSummary: {
          model: payload.modelId || selectedModelId,
          prompt,
          promptPreview: prompt.length > 120 ? `${prompt.slice(0, 119)}…` : prompt,
        },
        request: {
          modelId: selectedModelId,
          ratio,
          quality,
          style,
          negativePrompt,
          n: count,
        },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      setActiveJob(optimisticJob);
      await refreshHistory();
      await pollJob(payload.jobId);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Görsel üretimi başlatılamadı.';
      setError(message);
      setSubmitting(false);
    }
  }, [count, negativePrompt, pollJob, prompt, quality, ratio, refreshHistory, selectedModelId, stopPolling, style]);

  const handleCancel = useCallback(async () => {
    if (!activeJob?.jobId || TERMINAL_STATUSES.has(activeJob.status)) return;
    setError('');
    try {
      const updated = await workerRequest<JobRecord>('/jobs/cancel', {
        method: 'POST',
        body: JSON.stringify({ jobId: activeJob.jobId }),
      });
      stopPolling();
      setSubmitting(false);
      setActiveJob(updated);
      await refreshHistory();
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Job iptal edilemedi.';
      setError(message);
    }
  }, [activeJob, refreshHistory, stopPolling]);

  const openHistoryJob = useCallback(
    async (jobId: string) => {
      setError('');
      stopPolling();
      try {
        const job = await workerRequest<JobRecord>(`/jobs/status/${encodeURIComponent(jobId)}`);
        setActiveJob(job);
        if (!TERMINAL_STATUSES.has(job.status)) {
          setSubmitting(true);
          await pollJob(jobId);
        } else {
          setSubmitting(false);
        }
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Job açılamadı.';
        setError(message);
      }
    },
    [pollJob, stopPolling]
  );

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-6 rounded-3xl border border-neutral-800 bg-neutral-900/80 p-6 shadow-2xl shadow-black/20">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.24em] text-cyan-400">IMAGE WORKER</p>
              <h1 className="text-3xl font-bold tracking-tight">Tek worker üstünden görsel üretim</h1>
              <p className="mt-3 max-w-3xl text-sm text-neutral-300">
                Bu sayfa sadece <code className="rounded bg-neutral-800 px-2 py-1 text-xs">https://idm.puter.work</code> ile konuşur.
                Model listeleme, job başlatma, durum takibi, geçmiş ve iptal akışlarının tamamı aynı worker üstünden yürür.
              </p>
            </div>
            <div className="rounded-2xl border border-neutral-800 bg-neutral-950/80 p-4 text-xs text-neutral-300">
              <div className="mb-2 font-semibold text-neutral-100">Aktif route’lar</div>
              <div className="flex flex-wrap gap-2">
                {['/models', '/generate', '/jobs/status/:id', '/jobs/history', '/jobs/cancel'].map((item) => (
                  <span key={item} className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-rose-700/60 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">{error}</div>
        ) : null}

        <div className="grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)_360px]">
          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Üretim ayarları</h2>
              <button
                type="button"
                onClick={() => {
                  void loadModels();
                }}
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
                    <option key={modelKey(model)} value={modelKey(model)}>
                      {modelLabel(model)}
                    </option>
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
                    {RATIO_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-200">Kalite</label>
                  <select
                    value={quality}
                    onChange={(e) => setQuality(e.target.value)}
                    className="w-full rounded-2xl border border-neutral-700 bg-neutral-950 px-4 py-3 text-sm outline-none transition focus:border-cyan-500"
                  >
                    {QUALITY_OPTIONS.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
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
                    {STYLE_OPTIONS.map((item) => (
                      <option key={item || 'none'} value={item}>
                        {item || 'Varsayılan'}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-2 block text-sm font-medium text-neutral-200">Adet</label>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    value={count}
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
                  onClick={() => {
                    void handleGenerate();
                  }}
                  disabled={submitting || !prompt.trim() || !selectedModelId}
                  className="flex-1 rounded-2xl bg-cyan-500 px-4 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {submitting ? 'Üretim sürüyor...' : 'Üretimi başlat'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    void handleCancel();
                  }}
                  disabled={!activeJob || TERMINAL_STATUSES.has(activeJob.status)}
                  className="rounded-2xl border border-neutral-700 px-4 py-3 text-sm font-semibold text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  İptal et
                </button>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Aktif job</h2>
              {activeJob ? (
                <span className="rounded-full border border-neutral-700 bg-neutral-950 px-3 py-1 text-xs uppercase tracking-[0.18em] text-cyan-300">
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
                      <div className="mt-1 text-sm text-neutral-100">{activeJob.progress ?? 0}%</div>
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
                      {activeJob.requestSummary?.promptPreview || activeJob.requestSummary?.prompt || '-'}
                    </div>
                  </div>
                  <div className="mt-4 h-2 overflow-hidden rounded-full bg-neutral-800">
                    <div
                      className="h-full rounded-full bg-cyan-400 transition-all"
                      style={{ width: `${Math.max(0, Math.min(100, activeJob.progress ?? 0))}%` }}
                    />
                  </div>
                  {activeJob.error?.message ? (
                    <div className="mt-4 rounded-2xl border border-rose-700/50 bg-rose-950/30 px-4 py-3 text-sm text-rose-200">
                      {activeJob.error.message}
                    </div>
                  ) : null}
                </div>

                <div>
                  <div className="mb-3 text-sm font-medium text-neutral-200">Üretilen görseller</div>
                  {activeImages.length ? (
                    <div className="grid gap-4 sm:grid-cols-2">
                      {activeImages.map((url) => (
                        <a
                          key={url}
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          className="group overflow-hidden rounded-3xl border border-neutral-800 bg-neutral-950"
                        >
                          <img src={url} alt="Generated" className="aspect-square w-full object-cover transition duration-300 group-hover:scale-[1.02]" />
                        </a>
                      ))}
                    </div>
                  ) : (
                    <div className="flex min-h-[340px] items-center justify-center rounded-3xl border border-dashed border-neutral-800 bg-neutral-950/60 px-6 text-center text-sm text-neutral-500">
                      {activeJob.status === 'failed'
                        ? 'Job başarısız oldu. Hata mesajını üst blokta kontrol et.'
                        : activeJob.status === 'cancelled'
                          ? 'Job iptal edildi.'
                          : 'Görsel henüz hazır değil. Worker tamamlayınca burada görünecek.'}
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

          <aside className="rounded-3xl border border-neutral-800 bg-neutral-900/80 p-5">
            <div className="mb-5 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Job geçmişi</h2>
              <button
                type="button"
                onClick={() => {
                  void refreshHistory();
                }}
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
                      onClick={() => {
                        void openHistoryJob(job.jobId);
                      }}
                      className={`w-full rounded-2xl border p-4 text-left transition ${
                        isActive
                          ? 'border-cyan-500 bg-cyan-500/10'
                          : 'border-neutral-800 bg-neutral-950/70 hover:border-neutral-700 hover:bg-neutral-950'
                      }`}
                    >
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span className="truncate text-sm font-semibold text-neutral-100">{job.requestSummary?.promptPreview || job.jobId}</span>
                        <span className="rounded-full border border-neutral-700 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-neutral-300">
                          {job.status}
                        </span>
                      </div>
                      <div className="mb-3 text-xs text-neutral-500">{formatDate(job.createdAt)}</div>
                      {previewImages[0] ? (
                        <img src={previewImages[0]} alt="History preview" className="mb-3 aspect-video w-full rounded-2xl object-cover" />
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
