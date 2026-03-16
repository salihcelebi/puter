import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'failed_storage';
type EventStatus = 'started' | 'success' | 'failed' | 'progress' | string;

type WorkerErrorShape = {
  message?: string;
  bullets?: string[];
  retryable?: boolean;
};

type WorkerEnvelope<T> = {
  ok: boolean;
  code: string;
  data: T;
  error?: WorkerErrorShape | null;
  meta?: Record<string, unknown> | null;
  worker?: string;
  version?: string;
  requestId?: string;
  traceId?: string;
  time?: string;
  durationMs?: number;
};

type WorkerEvent = {
  stage?: string;
  status?: EventStatus;
  title?: string;
  successMessage?: string;
  errorMessage?: string;
  timestamp?: string;
  details?: Record<string, unknown> | null;
  relatedPath?: string | null;
  relatedModel?: string | null;
  attemptNo?: number | null;
};

type ModelItem = {
  id?: string;
  modelId?: string;
  modelName?: string;
  provider?: string;
  company?: string;
  categoryRaw?: string;
  badges?: string[];
  imagePrice?: number | null;
  pricing?: { usdPerImage?: number | null };
  speedLabel?: string;
  standoutFeature?: string;
  useCase?: string;
  traits?: string[];
  style?: { accent?: string; brandKey?: string };
  [key: string]: unknown;
};

type ModelsPayload = {
  items?: ModelItem[];
  total?: number;
  source?: string;
  feature?: string;
};

type JobRecord = {
  jobId: string;
  status: JobStatus;
  progress?: number;
  step?: string;
  outputUrl?: string | null;
  outputUrls?: string[];
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
  requestSummary?: {
    model?: string;
    promptPreview?: string;
    ratio?: string;
    quality?: string;
    style?: string;
    negativePromptPreview?: string;
  };
  request?: {
    modelId?: string;
    ratio?: string;
    quality?: string;
    style?: string;
    negativePrompt?: string;
    n?: number;
  };
  storage?: {
    path?: string | null;
    attemptedPath?: string | null;
    storageRoot?: string | null;
    mimeType?: string | null;
    fileName?: string | null;
    verified?: boolean;
  };
  error?: WorkerErrorShape | null;
  lastEvent?: WorkerEvent | null;
  events?: WorkerEvent[];
};

type HistoryPayload = {
  items?: JobRecord[];
  total?: number;
  limit?: number;
  feature?: string;
};

type WorkerRequestFailure = {
  message: string;
  envelope?: WorkerEnvelope<unknown> | null;
  status?: number;
};

const MODELS_BASE_URL = 'https://models-worker.puter.work';
const IMGS_BASE_URL = 'https://imgs.puter.work';
const POLL_MS = 1800;
const TERMINAL = new Set<JobStatus>(['completed', 'failed', 'cancelled', 'failed_storage']);
const RATIO_OPTIONS = ['1:1', '16:9', '9:16', '4:5', '3:4', '3:2', '2:3'];
const QUALITY_OPTIONS = ['standard', 'hd'];
const STYLE_OPTIONS = ['', 'vivid', 'natural', 'photorealistic', 'illustration', 'cinematic', 'anime'];

const PROMPT_PRESETS = [
  {
    label: 'Sinematik İstanbul',
    prompt:
      'Sisli İstanbul sokaklarında yağmur sonrası gece sahnesi, neon yansımalar, sinematik ışık, detaylı mimari, yüksek atmosfer, gerçekçi kompozisyon',
    negativePrompt:
      'bulanık, düşük çözünürlük, bozuk anatomi, yazı, watermark, ekstra uzuv, kötü perspektif',
    ratio: '16:9',
    quality: 'hd',
    style: 'cinematic',
  },
  {
    label: 'Lüks Ürün Çekimi',
    prompt:
      'Mat siyah arka planda premium akıllı saat ürün fotoğrafı, stüdyo ışığı, yansıma kontrollü, ultra net detay, reklam kalitesi',
    negativePrompt:
      'kirli yüzey, düşük kalite, aşırı parlama, deforme ürün, yazı, logo hatası, watermark',
    ratio: '1:1',
    quality: 'hd',
    style: 'photorealistic',
  },
  {
    label: 'Anime Kahraman',
    prompt:
      'Rüzgarlı tepede duran genç anime kahraman, dramatik gökyüzü, güçlü poz, detaylı kostüm, enerjik ışık çizgileri, yüksek kalite illüstrasyon',
    negativePrompt:
      'gerçekçi yüz, düşük detay, bulanık çizim, kötü eller, ekstra parmak, yazı, watermark',
    ratio: '4:5',
    quality: 'hd',
    style: 'anime',
  },
];

function buildUrl(base: string, path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function modelKey(model: ModelItem): string {
  return String(model.modelId || model.id || '').trim();
}

function modelLabel(model: ModelItem): string {
  const provider = String(model.provider || model.company || 'Model');
  const name = String(model.modelName || model.modelId || model.id || 'Bilinmeyen model');
  return `${provider} · ${name}`;
}

function isImageModel(model: ModelItem): boolean {
  return String(model.categoryRaw || '').trim().toLowerCase() === 'image generation';
}

function pickImages(job: JobRecord | null): string[] {
  if (!job) return [];
  const raw = [
    ...(Array.isArray(job.outputUrls) ? job.outputUrls : []),
    ...(job.outputUrl ? [job.outputUrl] : []),
  ].filter(Boolean) as string[];
  return [...new Set(raw)];
}

function formatDate(value?: string | null): string {
  if (!value) return '-';
  try {
    return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
  } catch {
    return value;
  }
}

function statusText(status?: JobStatus): string {
  switch (status) {
    case 'queued':
      return 'Sırada';
    case 'processing':
      return 'Üretiliyor';
    case 'completed':
      return 'Tamamlandı';
    case 'failed':
      return 'Başarısız';
    case 'failed_storage':
      return 'Depolama hatası';
    case 'cancelled':
      return 'İptal edildi';
    default:
      return 'Bilinmiyor';
  }
}

function statusBadgeClass(status?: JobStatus): string {
  switch (status) {
    case 'completed':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'processing':
    case 'queued':
      return 'border-blue-200 bg-blue-50 text-blue-700';
    case 'failed':
    case 'failed_storage':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'cancelled':
      return 'border-amber-200 bg-amber-50 text-amber-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function eventStatusClass(status?: EventStatus): string {
  switch (status) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700';
    case 'failed':
      return 'border-red-200 bg-red-50 text-red-700';
    case 'started':
      return 'border-sky-200 bg-sky-50 text-sky-700';
    case 'progress':
      return 'border-violet-200 bg-violet-50 text-violet-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function normalizeText(value: unknown, fallback = ''): string {
  if (value == null) return fallback;
  const text = String(value).trim();
  return text || fallback;
}

function getEventMessage(event?: WorkerEvent | null): string {
  if (!event) return 'Henüz olay kaydı yok.';
  const detailsMessage = normalizeText((event.details as Record<string, unknown> | null)?.eventMessage, '');
  if (detailsMessage) return detailsMessage;
  if (event.status === 'failed') return normalizeText(event.errorMessage, 'Aşama başarısız oldu.');
  if (event.status === 'success') return normalizeText(event.successMessage, 'Aşama tamamlandı.');
  return normalizeText(event.title, 'Olay kaydı üretildi.');
}

function clampProgress(value?: number): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function dedupeEvents(job: JobRecord | null): WorkerEvent[] {
  if (!job) return [];
  const source = Array.isArray(job.events) ? job.events : [];
  const map = new Map<string, WorkerEvent>();
  for (const event of source) {
    const key = [
      normalizeText(event.timestamp, ''),
      normalizeText(event.stage, ''),
      normalizeText(event.status, ''),
      String(event.attemptNo ?? ''),
      normalizeText(event.relatedPath, ''),
      normalizeText(event.relatedModel, ''),
    ].join('|');
    if (!map.has(key)) map.set(key, event);
  }
  const events = [...map.values()];
  events.sort((a, b) => {
    const left = new Date(normalizeText(a.timestamp, '1970-01-01T00:00:00.000Z')).getTime();
    const right = new Date(normalizeText(b.timestamp, '1970-01-01T00:00:00.000Z')).getTime();
    return right - left;
  });
  return events;
}

function detailsToRows(details?: Record<string, unknown> | null): Array<{ key: string; value: string }> {
  if (!details || typeof details !== 'object') return [];
  return Object.entries(details)
    .filter(([key, value]) => key !== 'eventMessage' && value !== undefined && value !== null && value !== '')
    .map(([key, value]) => {
      let text = '';
      if (Array.isArray(value)) text = value.join(', ');
      else if (typeof value === 'object') text = JSON.stringify(value);
      else text = String(value);
      return { key, value: text };
    });
}

async function readEnvelope<T>(response: Response): Promise<WorkerEnvelope<T>> {
  const text = await response.text();
  if (!text.trim()) {
    throw { message: 'Worker boş cevap döndürdü.' } as WorkerRequestFailure;
  }
  try {
    return JSON.parse(text) as WorkerEnvelope<T>;
  } catch {
    throw { message: 'Worker geçerli JSON döndürmedi.' } as WorkerRequestFailure;
  }
}

async function requestJson<T>(base: string, path: string, init?: RequestInit, retry = 1): Promise<WorkerEnvelope<T>> {
  let lastError: WorkerRequestFailure = { message: 'İstek başarısız oldu.' };

  for (let attempt = 0; attempt <= retry; attempt += 1) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 60000);

    try {
      const response = await fetch(buildUrl(base, path), {
        ...init,
        signal: controller.signal,
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          ...(init?.headers || {}),
        },
      });

      window.clearTimeout(timer);
      const payload = await readEnvelope<T>(response);

      if (!response.ok || payload.ok === false) {
        throw {
          message: payload.error?.message || `İstek başarısız oldu (${response.status}).`,
          envelope: payload as WorkerEnvelope<unknown>,
          status: response.status,
        } as WorkerRequestFailure;
      }

      return payload;
    } catch (error) {
      window.clearTimeout(timer);

      if (error instanceof DOMException && error.name === 'AbortError') {
        lastError = { message: 'İstek zaman aşımına uğradı.' };
      } else if (typeof error === 'object' && error && 'message' in error) {
        lastError = error as WorkerRequestFailure;
      } else if (error instanceof Error) {
        lastError = { message: error.message || 'İstek başarısız oldu.' };
      } else {
        lastError = { message: 'İstek başarısız oldu.' };
      }

      if (attempt === retry) break;
      await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
    }
  }

  throw lastError;
}

export default function ImagePage(): JSX.Element {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsSource, setModelsSource] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [ratio, setRatio] = useState('1:1');
  const [quality, setQuality] = useState('standard');
  const [style, setStyle] = useState('');
  const [count, setCount] = useState(1);

  const [activeJob, setActiveJob] = useState<JobRecord | null>(null);
  const [history, setHistory] = useState<JobRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [pageError, setPageError] = useState('');
  const [workerInfo, setWorkerInfo] = useState('');
  const [showTechDetails, setShowTechDetails] = useState(true);
  const [expandedEvents, setExpandedEvents] = useState<Record<string, boolean>>({});

  const pollRef = useRef<number | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => modelKey(item) === selectedModelId) || null,
    [models, selectedModelId],
  );

  const activeImages = useMemo(() => pickImages(activeJob), [activeJob]);
  const activeEvents = useMemo(() => dedupeEvents(activeJob), [activeJob]);
  const progressValue = useMemo(() => clampProgress(activeJob?.progress), [activeJob?.progress]);
  const latestErrorBullets = useMemo(() => {
    if (!activeJob?.error?.bullets?.length) return [];
    return activeJob.error.bullets.filter(Boolean);
  }, [activeJob?.error?.bullets]);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const toggleEvent = useCallback((key: string) => {
    setExpandedEvents((current) => ({ ...current, [key]: !current[key] }));
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setPageError('');
    try {
      const envelope = await requestJson<ModelsPayload>(MODELS_BASE_URL, '/models?limit=250', undefined, 1);
      const items = (Array.isArray(envelope.data?.items) ? envelope.data.items : []).filter(isImageModel);
      setModels(items);
      setModelsSource(`${MODELS_BASE_URL}/models`);
      setSelectedModelId((current) => current || modelKey(items[0]) || '');
      if (!items.length) {
        setPageError('models-worker içinde görsel modeli bulunamadı.');
      }
    } catch (error) {
      const failure = error as WorkerRequestFailure;
      setPageError(failure.message || 'Modeller alınamadı.');
    } finally {
      setModelsLoading(false);
    }
  }, []);

  const loadWorkerInfo = useCallback(async () => {
    try {
      const envelope = await requestJson<{ worker?: string; version?: string; modelsSource?: string }>(IMGS_BASE_URL, '/', undefined, 0);
      const info = envelope.data || {};
      setWorkerInfo(`${info.worker || 'imgs'} · v${info.version || '-'}`);
    } catch {
      setWorkerInfo('imgs worker');
    }
  }, []);

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const envelope = await requestJson<HistoryPayload>(IMGS_BASE_URL, '/jobs/history?limit=12', undefined, 0);
      setHistory(Array.isArray(envelope.data?.items) ? envelope.data.items : []);
    } catch {
      // geçmiş listesi kritik değil
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const ensureImageUrl = useCallback(async (job: JobRecord): Promise<JobRecord> => {
    if (!job.jobId || pickImages(job).length > 0) return job;
    try {
      const envelope = await requestJson<{
        outputUrl?: string | null;
        storagePath?: string | null;
        outputUrlExpiresAt?: string | null;
        storageRoot?: string | null;
        attemptedPath?: string | null;
        mimeType?: string | null;
        fileName?: string | null;
      }>(IMGS_BASE_URL, `/jobs/image/${encodeURIComponent(job.jobId)}`, undefined, 0);

      const outputUrl = envelope.data?.outputUrl || null;
      if (!outputUrl) return job;

      return {
        ...job,
        outputUrl,
        outputUrls: [outputUrl],
        storage: {
          ...(job.storage || {}),
          path: envelope.data?.storagePath || job.storage?.path || null,
          storageRoot: envelope.data?.storageRoot || job.storage?.storageRoot || null,
          attemptedPath: envelope.data?.attemptedPath || job.storage?.attemptedPath || null,
          mimeType: envelope.data?.mimeType || job.storage?.mimeType || null,
          fileName: envelope.data?.fileName || job.storage?.fileName || null,
          verified: true,
        },
      };
    } catch {
      return job;
    }
  }, []);

  const pollJob = useCallback(async (jobId: string) => {
    stopPolling();
    try {
      const envelope = await requestJson<JobRecord>(IMGS_BASE_URL, `/jobs/status/${encodeURIComponent(jobId)}`, undefined, 1);
      let nextJob = envelope.data;
      if (nextJob.status === 'completed') {
        nextJob = await ensureImageUrl(nextJob);
      }

      setActiveJob(nextJob);

      if (TERMINAL.has(nextJob.status)) {
        setSubmitting(false);
        await refreshHistory();
        return;
      }

      pollRef.current = window.setTimeout(() => {
        void pollJob(jobId);
      }, POLL_MS);
    } catch (error) {
      const failure = error as WorkerRequestFailure;
      setSubmitting(false);
      setPageError(failure.message || 'Job durumu alınamadı.');
    }
  }, [ensureImageUrl, refreshHistory, stopPolling]);

  useEffect(() => {
    void loadWorkerInfo();
    void loadModels();
    void refreshHistory();
    return () => stopPolling();
  }, [loadModels, loadWorkerInfo, refreshHistory, stopPolling]);

  const applyPreset = useCallback((preset: (typeof PROMPT_PRESETS)[number]) => {
    setPrompt(preset.prompt);
    setNegativePrompt(preset.negativePrompt);
    setRatio(preset.ratio);
    setQuality(preset.quality);
    setStyle(preset.style);
  }, []);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setPageError('Prompt zorunlu.');
      return;
    }
    if (!selectedModelId) {
      setPageError('Model seçmelisin.');
      return;
    }

    stopPolling();
    setSubmitting(true);
    setPageError('');
    setActiveJob(null);

    try {
      const envelope = await requestJson<JobRecord>(
        IMGS_BASE_URL,
        '/generate',
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: prompt.trim(),
            negativePrompt: negativePrompt.trim(),
            modelId: selectedModelId,
            model: selectedModelId,
            ratio,
            quality,
            style,
            n: Math.max(1, Math.min(1, count)),
            responseFormat: 'url',
            metadata: {
              page: 'src/pages/AI/image.tsx',
              modelsSource: `${MODELS_BASE_URL}/models`,
              worker: IMGS_BASE_URL,
            },
          }),
        },
        1,
      );

      let nextJob = envelope.data;
      const inlinePreview = typeof envelope.meta?.inlinePreview === 'string' ? envelope.meta.inlinePreview : null;

      if (inlinePreview && pickImages(nextJob).length === 0) {
        nextJob = { ...nextJob, outputUrl: inlinePreview, outputUrls: [inlinePreview] };
      }

      setActiveJob(nextJob);

      if (!nextJob.jobId) {
        throw { message: 'Worker jobId döndürmedi.' } as WorkerRequestFailure;
      }

      await refreshHistory();

      if (TERMINAL.has(nextJob.status)) {
        setSubmitting(false);
        return;
      }

      await pollJob(nextJob.jobId);
    } catch (error) {
      const failure = error as WorkerRequestFailure;
      const failedEnvelope = failure.envelope as WorkerEnvelope<unknown> | undefined;
      const failedJob = (failedEnvelope?.meta?.job as JobRecord | undefined) || null;

      if (failedJob) {
        setActiveJob(failedJob);
      } else if (failedEnvelope?.meta?.lastEvent || failedEnvelope?.error) {
        setActiveJob((current) => ({
          ...(current || {
            jobId: 'no-job',
            status: 'failed_storage',
          }),
          status: 'failed_storage',
          progress: current?.progress ?? 100,
          step: failure.message || 'İş başarısız oldu',
          error: failedEnvelope.error || { message: failure.message || 'İş başarısız oldu.' },
          lastEvent: (failedEnvelope.meta?.lastEvent as WorkerEvent | undefined) || current?.lastEvent || null,
        }));
      }

      setSubmitting(false);
      setPageError(failure.message || 'Görsel üretimi başlatılamadı.');
      await refreshHistory();
    }
  }, [count, negativePrompt, pollJob, prompt, quality, ratio, refreshHistory, selectedModelId, stopPolling, style]);

  const handleCancel = useCallback(async () => {
    if (!activeJob?.jobId || TERMINAL.has(activeJob.status)) return;
    try {
      const envelope = await requestJson<JobRecord>(
        IMGS_BASE_URL,
        '/jobs/cancel',
        {
          method: 'POST',
          body: JSON.stringify({ jobId: activeJob.jobId }),
        },
        0,
      );
      stopPolling();
      setSubmitting(false);
      setActiveJob(envelope.data);
      await refreshHistory();
    } catch (error) {
      const failure = error as WorkerRequestFailure;
      setPageError(failure.message || 'İptal işlemi başarısız oldu.');
    }
  }, [activeJob, refreshHistory, stopPolling]);

  const openHistoryJob = useCallback(async (jobId: string) => {
    setPageError('');
    stopPolling();
    try {
      const envelope = await requestJson<JobRecord>(IMGS_BASE_URL, `/jobs/status/${encodeURIComponent(jobId)}`, undefined, 0);
      let nextJob = envelope.data;
      if (nextJob.status === 'completed') {
        nextJob = await ensureImageUrl(nextJob);
      }
      setActiveJob(nextJob);
      if (!TERMINAL.has(nextJob.status)) {
        setSubmitting(true);
        await pollJob(jobId);
      } else {
        setSubmitting(false);
      }
    } catch (error) {
      const failure = error as WorkerRequestFailure;
      setPageError(failure.message || 'Geçmiş kaydı açılamadı.');
    }
  }, [ensureImageUrl, pollJob, stopPolling]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Görsel Üretim</h1>
            <p className="mt-2 text-sm text-slate-300">
              Model kaynağı: <strong>{MODELS_BASE_URL}</strong> · Üretim worker: <strong>{IMGS_BASE_URL}</strong>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Worker: {workerInfo || 'yükleniyor'} · Katalog: {modelsSource || 'yükleniyor'}
            </p>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
            <div>Seçili model: {selectedModel ? modelLabel(selectedModel) : 'yok'}</div>
            <div className="mt-1 text-xs text-slate-400">
              Fiyat: {selectedModel?.pricing?.usdPerImage ?? selectedModel?.imagePrice ?? '-'} USD / görsel
            </div>
            <div className="mt-1 text-xs text-slate-500">Kategori: {selectedModel?.categoryRaw || '-'}</div>
          </div>
        </div>
      </div>

      {pageError ? (
        <div className="rounded-2xl border border-red-700 bg-red-950/70 px-4 py-3 text-sm text-red-100">
          {pageError}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.02fr,0.98fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Üretim ayarları</h2>

          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-semibold text-slate-900">Hazır promptlar</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PROMPT_PRESETS.map((preset) => (
                <button
                  key={preset.label}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-500 hover:text-slate-900"
                >
                  {preset.label}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-4 grid gap-4">
            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Prompt</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
                placeholder="Örn: sisli İstanbul sokaklarında neon ışıklı sinematik gece sahnesi"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Negatif prompt</span>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={3}
                className="rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
                placeholder="İstenmeyen detaylar"
              />
            </label>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Model</span>
                <select
                  value={selectedModelId}
                  onChange={(e) => setSelectedModelId(e.target.value)}
                  className="rounded-2xl border border-slate-300 px-4 py-3"
                  disabled={modelsLoading}
                >
                  {models.map((item) => (
                    <option key={modelKey(item)} value={modelKey(item)}>
                      {modelLabel(item)}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Oran</span>
                <select value={ratio} onChange={(e) => setRatio(e.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3">
                  {RATIO_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Kalite</span>
                <select value={quality} onChange={(e) => setQuality(e.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3">
                  {QUALITY_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Stil</span>
                <select value={style} onChange={(e) => setStyle(e.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3">
                  {STYLE_OPTIONS.map((item) => (
                    <option key={item} value={item}>
                      {item || 'Varsayılan'}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="grid gap-2 md:max-w-xs">
              <span className="text-sm font-medium text-slate-700">Adet</span>
              <input
                type="number"
                min={1}
                max={1}
                step={1}
                value={count}
                onChange={(e) => setCount(Math.max(1, Math.min(1, Number(e.target.value) || 1)))}
                className="rounded-2xl border border-slate-300 px-4 py-3"
              />
            </label>

            {selectedModel ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="font-semibold text-slate-900">Model özeti</div>
                <div className="mt-2">{selectedModel.standoutFeature || selectedModel.useCase || 'Özel bilgi yok.'}</div>
                {selectedModel.speedLabel ? <div className="mt-2 text-xs text-slate-500">Hız: {selectedModel.speedLabel}</div> : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={submitting || modelsLoading}
                className="rounded-2xl bg-slate-900 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Üretiliyor...' : 'Görsel üret'}
              </button>

              <button
                type="button"
                onClick={() => void handleCancel()}
                disabled={!activeJob || TERMINAL.has(activeJob.status) || !submitting}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                İptal et
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold text-slate-900">Aktif iş</h2>
            <button
              type="button"
              onClick={() => setShowTechDetails((current) => !current)}
              className="rounded-2xl border border-slate-300 px-3 py-2 text-xs font-medium text-slate-700"
            >
              {showTechDetails ? 'Teknik detayları gizle' : 'Teknik detayları göster'}
            </button>
          </div>

          {activeJob ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <span className={`rounded-full border px-3 py-1 font-medium ${statusBadgeClass(activeJob.status)}`}>
                    {statusText(activeJob.status)}
                  </span>
                  <span className="text-slate-500">Job: {activeJob.jobId}</span>
                </div>

                <div className="mt-4 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-slate-900 transition-all duration-500"
                    style={{ width: `${progressValue}%` }}
                  />
                </div>

                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{activeJob.step || getEventMessage(activeJob.lastEvent)}</span>
                  <span>%{progressValue}</span>
                </div>

                {activeJob.lastEvent ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${eventStatusClass(activeJob.lastEvent.status)}`}>
                        {normalizeText(activeJob.lastEvent.status, 'event')}
                      </span>
                      <span className="text-sm font-semibold text-slate-900">
                        {normalizeText(activeJob.lastEvent.title, normalizeText(activeJob.lastEvent.stage, 'Son olay'))}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-slate-700">{getEventMessage(activeJob.lastEvent)}</div>
                    <div className="mt-2 text-xs text-slate-500">
                      {formatDate(activeJob.lastEvent.timestamp)}{' '}
                      {activeJob.lastEvent.attemptNo ? `· deneme ${activeJob.lastEvent.attemptNo}` : ''}
                    </div>
                  </div>
                ) : null}
              </div>

              {activeJob.error?.message ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div className="font-semibold">Hata özeti</div>
                  <div className="mt-2">{activeJob.error.message}</div>
                  {latestErrorBullets.length > 0 ? (
                    <div className="mt-3 space-y-1 text-xs">
                      {latestErrorBullets.map((bullet) => (
                        <div key={bullet}>• {bullet}</div>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activeImages.length > 0 ? (
                <div className="grid gap-4">
                  {activeImages.map((src) => (
                    <img key={src} src={src} alt="Üretilen görsel" className="w-full rounded-2xl border border-slate-200 object-cover shadow-sm" />
                  ))}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
                  Görsel hazır olduğunda burada görünecek.
                </div>
              )}

              <div className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div className="text-sm font-semibold text-slate-900">Worker olay akışı</div>
                  <div className="text-xs text-slate-500">{activeEvents.length} olay</div>
                </div>

                {activeEvents.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                    Worker event listesi henüz gelmedi.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {activeEvents.map((event, index) => {
                      const rows = detailsToRows(event.details);
                      const eventKey = [
                        normalizeText(event.timestamp, ''),
                        normalizeText(event.stage, ''),
                        normalizeText(event.status, ''),
                        String(event.attemptNo ?? ''),
                        String(index),
                      ].join('|');
                      const expanded = !!expandedEvents[eventKey];

                      return (
                        <div key={eventKey} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`rounded-full border px-2.5 py-1 text-xs font-medium ${eventStatusClass(event.status)}`}>
                                  {normalizeText(event.status, 'event')}
                                </span>
                                <span className="text-sm font-semibold text-slate-900">
                                  {normalizeText(event.title, normalizeText(event.stage, 'Olay'))}
                                </span>
                                {event.attemptNo ? (
                                  <span className="rounded-full border border-slate-300 bg-white px-2 py-0.5 text-[11px] text-slate-600">
                                    deneme {event.attemptNo}
                                  </span>
                                ) : null}
                              </div>

                              <div className="mt-2 text-sm text-slate-700">{getEventMessage(event)}</div>

                              <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                                <span>Tarih: {formatDate(event.timestamp)}</span>
                                {event.relatedModel ? <span>Model: {event.relatedModel}</span> : null}
                                {event.relatedPath ? <span>Path: {event.relatedPath}</span> : null}
                                {event.stage ? <span>Stage: {event.stage}</span> : null}
                              </div>
                            </div>

                            {showTechDetails && rows.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => toggleEvent(eventKey)}
                                className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700"
                              >
                                {expanded ? 'Detayları gizle' : 'Detayları aç'}
                              </button>
                            ) : null}
                          </div>

                          {showTechDetails && expanded && rows.length > 0 ? (
                            <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-3">
                              <div className="grid gap-2 sm:grid-cols-2">
                                {rows.map((row) => (
                                  <div key={`${eventKey}-${row.key}`} className="rounded-xl border border-slate-100 bg-slate-50 p-2">
                                    <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{row.key}</div>
                                    <div className="mt-1 break-all text-xs text-slate-700">{row.value}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {showTechDetails ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <div className="font-semibold text-slate-800">Teknik özet</div>
                  <div className="mt-2 grid gap-1">
                    <div>jobId: {activeJob.jobId}</div>
                    <div>status: {activeJob.status}</div>
                    <div>progress: {progressValue}</div>
                    <div>createdAt: {formatDate(activeJob.createdAt)}</div>
                    <div>updatedAt: {formatDate(activeJob.updatedAt)}</div>
                    <div>finishedAt: {formatDate(activeJob.finishedAt)}</div>
                    <div>model: {activeJob.requestSummary?.model || activeJob.request?.modelId || '-'}</div>
                    <div>ratio: {activeJob.requestSummary?.ratio || activeJob.request?.ratio || '-'}</div>
                    <div>quality: {activeJob.requestSummary?.quality || activeJob.request?.quality || '-'}</div>
                    <div>style: {activeJob.requestSummary?.style || activeJob.request?.style || '-'}</div>
                    <div>storage.path: {activeJob.storage?.path || '-'}</div>
                    <div>storage.root: {activeJob.storage?.storageRoot || '-'}</div>
                    <div>storage.attemptedPath: {activeJob.storage?.attemptedPath || '-'}</div>
                    <div>storage.fileName: {activeJob.storage?.fileName || '-'}</div>
                    <div>storage.mimeType: {activeJob.storage?.mimeType || '-'}</div>
                    <div>storage.verified: {String(activeJob.storage?.verified ?? false)}</div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="mt-4 rounded-2xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500">
              Henüz aktif iş yok.
            </div>
          )}
        </section>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-slate-900">Geçmiş</h2>
          <button
            type="button"
            onClick={() => void refreshHistory()}
            className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
          >
            Yenile
          </button>
        </div>

        <div className="mt-4 grid gap-3">
          {loadingHistory ? (
            <div className="text-sm text-slate-500">Geçmiş yükleniyor...</div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Henüz kayıt yok.</div>
          ) : (
            history.map((item) => (
              <button
                key={item.jobId}
                type="button"
                onClick={() => void openHistoryJob(item.jobId)}
                className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-400 hover:bg-white"
              >
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusBadgeClass(item.status)}`}>
                    {statusText(item.status)}
                  </span>
                  <span className="text-xs text-slate-500">{formatDate(item.updatedAt || item.createdAt)}</span>
                </div>

                <div className="text-sm text-slate-700">{item.requestSummary?.promptPreview || 'Prompt kaydı yok'}</div>
                <div className="text-xs text-slate-500">{item.requestSummary?.model || item.request?.modelId || '-'}</div>

                {item.lastEvent ? (
                  <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600">
                    {getEventMessage(item.lastEvent)}
                  </div>
                ) : null}
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}
