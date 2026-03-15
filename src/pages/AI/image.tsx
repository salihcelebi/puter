import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

type WorkerEnvelope<T = unknown> = {
  ok?: boolean;
  code?: string;
  data?: T;
  error?: {
    message?: string;
    retryable?: boolean;
    details?: JsonValue;
  } | null;
  meta?: Record<string, JsonValue> | null;
  status?: number;
  requestId?: string;
  traceId?: string;
};

type ModelItem = {
  id?: string;
  modelId?: string;
  modelName?: string;
  company?: string;
  provider?: string;
  categoryRaw?: string;
  badges?: string[];
  imagePrice?: number | null;
  speedLabel?: string;
  standoutFeature?: string;
  useCase?: string;
};

type ModelsPayload = {
  items?: ModelItem[];
  total?: number;
};

type JobRequest = {
  model?: string;
  modelId?: string;
  provider?: string;
  ratio?: string;
  size?: string;
  quality?: string;
  style?: string;
  prompt?: string;
  negativePrompt?: string;
  n?: number;
  guidance?: number;
  seed?: number;
};

type JobRecord = {
  jobId: string;
  feature?: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled' | string;
  progress?: number;
  step?: string;
  queuePosition?: number | null;
  etaMs?: number | null;
  outputUrl?: string | null;
  outputUrls?: string[];
  url?: string | null;
  urls?: string[];
  request?: JobRequest;
  requestSummary?: {
    model?: string;
    prompt?: string;
    promptPreview?: string;
  };
  error?: {
    message?: string;
    retryable?: boolean;
  } | null;
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
};

type HistoryPayload = {
  items?: JobRecord[];
  total?: number;
  limit?: number;
  feature?: string;
};

type GeneratePayload = {
  jobId?: string;
  status?: string;
  progress?: number;
  step?: string;
  url?: string | null;
  urls?: string[];
  outputUrl?: string | null;
  outputUrls?: string[];
  modelId?: string;
  provider?: string;
};

type WorkerInfoPayload = {
  worker?: string;
  version?: string;
  protocolVersion?: string;
  purpose?: string;
  routes?: string[];
  supportedQuery?: string[];
};

type FormState = {
  prompt: string;
  negativePrompt: string;
  style: string;
  ratio: string;
  quality: string;
  modelId: string;
  n: number;
  guidance: string;
  seed: string;
};

const WORKER_BASE_URL = 'https://idm.puter.work';
const HISTORY_LIMIT = 5;
const POLL_INTERVAL_MS = 1800;
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const DEFAULT_MODEL_ID = 'openai/gpt-image-1';

const RATIO_OPTIONS = [
  { value: '1:1', label: '1:1 Kare' },
  { value: '16:9', label: '16:9 Yatay' },
  { value: '9:16', label: '9:16 Dikey' },
  { value: '4:5', label: '4:5 Portre' },
  { value: '3:2', label: '3:2 Fotoğraf' },
  { value: '2:3', label: '2:3 Dikey Fotoğraf' },
];

const QUALITY_OPTIONS = [
  { value: 'high', label: 'Yüksek' },
  { value: 'medium', label: 'Orta' },
  { value: 'low', label: 'Düşük' },
];

const QUICK_PROMPTS = [
  'Gün doğumunda Kapadokya üzerinde süzülen sıcak hava balonları, sinematik geniş açı, ultra detaylı',
  'İstanbul sokaklarında yağmurlu gecede neon yansımalar, cyberpunk atmosfer, yüksek kontrast',
  'Minimal İskandinav salon tasarımı, doğal ışık, dergi çekimi kalitesi, fotogerçekçi',
];

const initialFormState = (): FormState => ({
  prompt: '',
  negativePrompt: '',
  style: '',
  ratio: '1:1',
  quality: 'high',
  modelId: DEFAULT_MODEL_ID,
  n: 1,
  guidance: '',
  seed: '',
});

function normalizeText(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeNumber(value: unknown, fallback = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function isImageModel(model: ModelItem): boolean {
  const badges = Array.isArray(model.badges) ? model.badges.join(' ').toLowerCase() : '';
  const category = normalizeText(model.categoryRaw).toLowerCase();
  const modelId = normalizeText(model.modelId || model.id).toLowerCase();
  return (
    model.imagePrice != null ||
    category.includes('image') ||
    category.includes('görsel') ||
    badges.includes('image') ||
    badges.includes('görsel') ||
    modelId.includes('image') ||
    modelId.includes('flux') ||
    modelId.includes('recraft') ||
    modelId.includes('ideogram') ||
    modelId.includes('stable-diffusion')
  );
}

function pickJobImages(job: Partial<JobRecord | GeneratePayload> | null): string[] {
  if (!job) return [];
  const items = [
    ...(Array.isArray(job.outputUrls) ? job.outputUrls : []),
    ...(Array.isArray(job.urls) ? job.urls : []),
    typeof job.outputUrl === 'string' ? job.outputUrl : null,
    typeof job.url === 'string' ? job.url : null,
  ];
  return Array.from(new Set(items.filter((item): item is string => typeof item === 'string' && item.trim() !== '')));
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', { dateStyle: 'short', timeStyle: 'short' }).format(date);
}

function formatEta(etaMs?: number | null): string {
  if (!etaMs || etaMs <= 0) return '—';
  const totalSeconds = Math.round(etaMs / 1000);
  if (totalSeconds < 60) return `${totalSeconds} sn`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes} dk ${seconds} sn`;
}

function statusLabel(status?: string): string {
  switch (status) {
    case 'queued':
      return 'Sırada';
    case 'processing':
      return 'İşleniyor';
    case 'completed':
      return 'Tamamlandı';
    case 'failed':
      return 'Başarısız';
    case 'cancelled':
      return 'İptal edildi';
    default:
      return status || '—';
  }
}

function statusTone(status?: string): { bg: string; fg: string; border: string } {
  switch (status) {
    case 'completed':
      return { bg: '#ecfdf3', fg: '#027a48', border: '#a6f4c5' };
    case 'failed':
      return { bg: '#fef3f2', fg: '#b42318', border: '#fecdca' };
    case 'cancelled':
      return { bg: '#f4f4f5', fg: '#3f3f46', border: '#d4d4d8' };
    case 'processing':
      return { bg: '#eff8ff', fg: '#175cd3', border: '#b2ddff' };
    default:
      return { bg: '#f8f9fc', fg: '#344054', border: '#d0d5dd' };
  }
}

async function readJson<T>(response: Response): Promise<WorkerEnvelope<T> | T> {
  const text = await response.text();
  if (!text.trim()) return {} as WorkerEnvelope<T>;
  try {
    return JSON.parse(text) as WorkerEnvelope<T> | T;
  } catch {
    return {
      ok: false,
      error: { message: `Worker JSON dönmedi: ${text.slice(0, 180)}` },
    } as WorkerEnvelope<T>;
  }
}

function normalizeWorkerErrorMessage(message: string, status: number): string {
  const lower = message.toLowerCase();
  if (lower.includes("reading 'puter'") || (lower.includes('undefined') && lower.includes('puter'))) {
    return 'Worker oturum doğrulaması başarısız. Lütfen yeniden giriş yapıp tekrar dene.';
  }
  if (lower.includes('failed to fetch')) {
    return 'Worker ağına erişilemedi. Lütfen bağlantını kontrol edip tekrar dene.';
  }
  if (status === 404) {
    return 'Worker route bulunamadı. idm.puter.work tarafında eksik endpoint var.';
  }
  if (status === 405) {
    return 'Worker isteği kabul etmedi. HTTP method sözleşmesi uyuşmuyor.';
  }
  if (status === 429) {
    return 'Worker şu anda yoğun. Birkaç saniye sonra tekrar dene.';
  }
  return message;
}

async function requestWorker<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${WORKER_BASE_URL}${path}`, {
    ...init,
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const body = await readJson<T>(response);
  const envelope = body as WorkerEnvelope<T>;
  if (!response.ok || (typeof envelope?.ok === 'boolean' && !envelope.ok)) {
    const rawMessage = envelope?.error?.message || `İstek başarısız oldu (${response.status}).`;
    throw new Error(normalizeWorkerErrorMessage(rawMessage, response.status));
  }

  if (typeof envelope?.ok === 'boolean') {
    return (envelope.data as T) ?? ({} as T);
  }

  return body as T;
}

function resolveProvider(model: ModelItem | undefined, fallbackModelId: string): string {
  if (!model) {
    const inferred = normalizeText(fallbackModelId).split('/')[0];
    return inferred || 'Bilinmiyor';
  }
  return normalizeText(model.provider) || normalizeText(model.company) || normalizeText(model.modelId || model.id).split('/')[0] || 'Bilinmiyor';
}

function getModelLabel(model: ModelItem): string {
  return normalizeText(model.modelName) || normalizeText(model.modelId || model.id) || 'Adsız model';
}

function mapGenerateToImmediateJob(payload: GeneratePayload, form: FormState): JobRecord {
  const jobId = normalizeText(payload.jobId);
  if (!jobId) throw new Error('Worker jobId dönmedi.');
  return {
    jobId,
    status: normalizeText(payload.status, 'queued'),
    progress: clamp(normalizeNumber(payload.progress, 0), 0, 100),
    step: normalizeText(payload.step, 'İş kuyruğa alındı'),
    outputUrl: normalizeText(payload.outputUrl) || normalizeText(payload.url) || null,
    outputUrls: pickJobImages(payload),
    request: {
      modelId: form.modelId,
      ratio: form.ratio,
      quality: form.quality,
      style: form.style,
      prompt: form.prompt,
      negativePrompt: form.negativePrompt,
      n: form.n,
      guidance: form.guidance ? Number(form.guidance) : undefined,
      seed: form.seed ? Number(form.seed) : undefined,
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

export default function ImagePage(): React.JSX.Element {
  const [form, setForm] = useState<FormState>(initialFormState);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [error, setError] = useState('');
  const [workerInfo, setWorkerInfo] = useState<WorkerInfoPayload | null>(null);
  const [currentJob, setCurrentJob] = useState<JobRecord | null>(null);
  const [history, setHistory] = useState<JobRecord[]>([]);
  const [images, setImages] = useState<string[]>([]);
  const pollTimeoutRef = useRef<number | null>(null);

  const selectedModel = useMemo(
    () => models.find((model) => normalizeText(model.modelId || model.id) === form.modelId),
    [models, form.modelId],
  );

  const selectedProvider = useMemo(
    () => resolveProvider(selectedModel, form.modelId),
    [selectedModel, form.modelId],
  );

  const clearPoll = useCallback(() => {
    if (pollTimeoutRef.current != null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }, []);

  const loadWorkerInfo = useCallback(async () => {
    try {
      const info = await requestWorker<WorkerInfoPayload>('/');
      setWorkerInfo(info);
    } catch {
      setWorkerInfo({
        worker: 'idm.puter.work',
        routes: ['GET /models', 'POST /generate', 'GET /jobs/status/:id', 'GET /jobs/history', 'POST /jobs/cancel'],
      });
    }
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setError('');
    try {
      const payload = await requestWorker<ModelsPayload>('/models?feature=image&sort=price_asc&limit=250');
      const items = Array.isArray(payload.items) ? payload.items.filter(isImageModel) : [];
      setModels(items);
      if (items.length > 0) {
        const hasSelected = items.some((item) => normalizeText(item.modelId || item.id) === form.modelId);
        if (!hasSelected) {
          const fallbackModelId = normalizeText(items[0].modelId || items[0].id, DEFAULT_MODEL_ID);
          setForm((prev) => ({ ...prev, modelId: fallbackModelId }));
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Modeller yüklenemedi.');
      setModels([]);
    } finally {
      setModelsLoading(false);
    }
  }, [form.modelId]);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    setError('');
    try {
      const payload = await requestWorker<HistoryPayload>(`/jobs/history?feature=image&limit=${HISTORY_LIMIT}`);
      const items = Array.isArray(payload.items) ? payload.items : [];
      setHistory(items);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Geçmiş yüklenemedi.');
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  const syncImagesFromJob = useCallback((job: JobRecord | null) => {
    const picked = pickJobImages(job);
    if (picked.length > 0) setImages(picked);
  }, []);

  const pollJob = useCallback(
    async (jobId: string) => {
      clearPoll();
      try {
        const job = await requestWorker<JobRecord>(`/jobs/status/${encodeURIComponent(jobId)}`);
        setCurrentJob(job);
        syncImagesFromJob(job);
        if (TERMINAL_STATUSES.has(normalizeText(job.status))) {
          await loadHistory();
          return;
        }
        pollTimeoutRef.current = window.setTimeout(() => {
          void pollJob(jobId);
        }, POLL_INTERVAL_MS);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'İş durumu okunamadı.');
      }
    },
    [clearPoll, loadHistory, syncImagesFromJob],
  );

  useEffect(() => {
    void loadWorkerInfo();
    void loadModels();
    void loadHistory();
    return () => clearPoll();
  }, [clearPoll, loadHistory, loadModels, loadWorkerInfo]);

  const handleChange = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSubmit = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (!form.prompt.trim()) {
        setError('Lütfen bir prompt gir.');
        return;
      }

      setSubmitting(true);
      setError('');
      setImages([]);
      clearPoll();

      try {
        const requestBody: JobRequest = {
          model: form.modelId,
          modelId: form.modelId,
          provider: selectedProvider,
          ratio: form.ratio,
          quality: form.quality,
          style: form.style.trim() || undefined,
          prompt: form.prompt.trim(),
          negativePrompt: form.negativePrompt.trim() || undefined,
          n: clamp(form.n, 1, 4),
          guidance: form.guidance.trim() ? Number(form.guidance) : undefined,
          seed: form.seed.trim() ? Number(form.seed) : undefined,
        };

        const payload = await requestWorker<GeneratePayload>('/generate', {
          method: 'POST',
          body: JSON.stringify(requestBody),
        });

        const immediateJob = mapGenerateToImmediateJob(payload, form);
        setCurrentJob(immediateJob);
        syncImagesFromJob(immediateJob);
        await loadHistory();
        if (!TERMINAL_STATUSES.has(immediateJob.status)) {
          void pollJob(immediateJob.jobId);
        }
      } catch (err) {
        setCurrentJob(null);
        setError(err instanceof Error ? err.message : 'Görsel üretimi başlatılamadı.');
      } finally {
        setSubmitting(false);
      }
    },
    [clearPoll, form, loadHistory, pollJob, selectedProvider, syncImagesFromJob],
  );

  const handleCancel = useCallback(async () => {
    if (!currentJob?.jobId) return;
    setCancelLoading(true);
    setError('');
    try {
      await requestWorker<{ ok?: boolean }>('/jobs/cancel', {
        method: 'POST',
        body: JSON.stringify({ jobId: currentJob.jobId }),
      });
      await pollJob(currentJob.jobId);
      await loadHistory();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'İptal isteği gönderilemedi.');
    } finally {
      setCancelLoading(false);
    }
  }, [currentJob?.jobId, loadHistory, pollJob]);

  const handlePickHistory = useCallback(
    (job: JobRecord) => {
      setCurrentJob(job);
      syncImagesFromJob(job);
      setError('');
      if (!TERMINAL_STATUSES.has(job.status)) {
        void pollJob(job.jobId);
      } else {
        clearPoll();
      }
    },
    [clearPoll, pollJob, syncImagesFromJob],
  );

  const handleReset = useCallback(() => {
    clearPoll();
    setForm(initialFormState());
    setCurrentJob(null);
    setImages([]);
    setError('');
  }, [clearPoll]);

  const currentTone = statusTone(currentJob?.status);
  const routes = workerInfo?.routes?.length
    ? workerInfo.routes
    : ['GET /models', 'POST /generate', 'GET /jobs/status/:id', 'GET /jobs/history', 'POST /jobs/cancel'];

  return (
    <div style={{ background: '#f6f7fb', minHeight: '100%', padding: 24 }}>
      <div style={{ maxWidth: 1220, margin: '0 auto', display: 'grid', gap: 20 }}>
        <section
          style={{
            background: '#ffffff',
            border: '1px solid #e6e8ef',
            borderRadius: 20,
            padding: 24,
            boxShadow: '0 8px 30px rgba(16, 24, 40, 0.05)',
          }}
        >
          <div style={{ display: 'grid', gap: 12 }}>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#6941c6', background: '#f4f3ff', border: '1px solid #d9d6fe', borderRadius: 999, padding: '6px 10px' }}>
                Görsel Üretim
              </span>
              <span style={{ fontSize: 12, color: '#475467' }}>Worker: {WORKER_BASE_URL}</span>
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.2, color: '#101828' }}>AI Görsel Üretim</h1>
              <p style={{ margin: '10px 0 0', color: '#475467', lineHeight: 1.6 }}>
                Bu sayfa doğrudan <strong>{WORKER_BASE_URL}</strong> ile konuşur. Puter giriş ekranı açmaz; tüm üretim,
                durum takibi, iptal ve model listeleme tek worker üstünden yürür.
              </p>
            </div>
            <div style={{ display: 'grid', gap: 8 }}>
              <div style={{ color: '#344054', fontSize: 14 }}><strong>Worker:</strong> {WORKER_BASE_URL}</div>
              <div style={{ color: '#344054', fontSize: 14 }}>
                <strong>Uçlar:</strong> /models · /generate · /jobs/status/:id · /jobs/history · /jobs/cancel
              </div>
              <div style={{ color: '#344054', fontSize: 14 }}><strong>Mod:</strong> me.puter uyumlu fetch akışı</div>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {routes.map((route) => (
                <span
                  key={route}
                  style={{
                    borderRadius: 999,
                    border: '1px solid #d0d5dd',
                    padding: '6px 10px',
                    fontSize: 12,
                    color: '#344054',
                    background: '#fff',
                  }}
                >
                  {route.replace(/^GET\s+/i, '').replace(/^POST\s+/i, '')}
                </span>
              ))}
            </div>
          </div>
        </section>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(360px, 1.1fr) minmax(320px, 0.9fr)', gap: 20 }}>
          <section
            style={{
              background: '#ffffff',
              border: '1px solid #e6e8ef',
              borderRadius: 20,
              padding: 24,
              boxShadow: '0 8px 30px rgba(16, 24, 40, 0.05)',
            }}
          >
            <form onSubmit={handleSubmit} style={{ display: 'grid', gap: 16 }}>
              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ fontWeight: 600, color: '#344054' }} htmlFor="prompt">Prompt</label>
                <textarea
                  id="prompt"
                  value={form.prompt}
                  onChange={(e) => handleChange('prompt', e.target.value)}
                  placeholder="Nasıl bir görsel üretmek istediğini yaz"
                  rows={5}
                  style={{ width: '100%', resize: 'vertical', borderRadius: 12, border: '1px solid #d0d5dd', padding: 14, font: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gap: 8 }}>
                <label style={{ fontWeight: 600, color: '#344054' }} htmlFor="negativePrompt">Negatif prompt</label>
                <textarea
                  id="negativePrompt"
                  value={form.negativePrompt}
                  onChange={(e) => handleChange('negativePrompt', e.target.value)}
                  placeholder="İstenmeyen öğeleri yazabilirsin"
                  rows={3}
                  style={{ width: '100%', resize: 'vertical', borderRadius: 12, border: '1px solid #d0d5dd', padding: 14, font: 'inherit' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
                <Field label="Model">
                  <select
                    value={form.modelId}
                    onChange={(e) => handleChange('modelId', e.target.value)}
                    style={inputStyle}
                    disabled={modelsLoading}
                  >
                    {models.length === 0 && <option value={form.modelId}>{modelsLoading ? 'Yükleniyor...' : form.modelId}</option>}
                    {models.map((model) => {
                      const value = normalizeText(model.modelId || model.id);
                      return (
                        <option key={value} value={value}>
                          {getModelLabel(model)}
                        </option>
                      );
                    })}
                  </select>
                </Field>
                <Field label="Stil notu">
                  <input value={form.style} onChange={(e) => handleChange('style', e.target.value)} placeholder="Örnek: steampunk, cinematic, illustration" style={inputStyle} />
                </Field>
                <Field label="Oran">
                  <select value={form.ratio} onChange={(e) => handleChange('ratio', e.target.value)} style={inputStyle}>
                    {RATIO_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Kalite">
                  <select value={form.quality} onChange={(e) => handleChange('quality', e.target.value)} style={inputStyle}>
                    {QUALITY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>{option.label}</option>
                    ))}
                  </select>
                </Field>
                <Field label="Adet">
                  <input type="number" min={1} max={4} value={form.n} onChange={(e) => handleChange('n', clamp(Number(e.target.value) || 1, 1, 4))} style={inputStyle} />
                </Field>
                <Field label="Guidance">
                  <input value={form.guidance} onChange={(e) => handleChange('guidance', e.target.value)} placeholder="Boş bırakılabilir" style={inputStyle} />
                </Field>
                <Field label="Seed">
                  <input value={form.seed} onChange={(e) => handleChange('seed', e.target.value)} placeholder="Boş bırakılabilir" style={inputStyle} />
                </Field>
              </div>

              <div style={{ borderRadius: 16, border: '1px solid #d9d6fe', background: '#f9f5ff', padding: 16, display: 'grid', gap: 8 }}>
                <strong style={{ color: '#53389e' }}>Seçili model özeti</strong>
                <div style={{ color: '#475467', fontSize: 14 }}>
                  <strong>Sağlayıcı:</strong> {selectedProvider}
                </div>
                <div style={{ color: '#475467', fontSize: 14 }}>
                  <strong>Model:</strong> {selectedModel ? getModelLabel(selectedModel) : form.modelId}
                </div>
                <div style={{ color: '#475467', fontSize: 14 }}>
                  <strong>Hız:</strong> {normalizeText(selectedModel?.speedLabel, 'Bilinmiyor')}
                </div>
                <div style={{ color: '#475467', fontSize: 14 }}>
                  <strong>Öne çıkan:</strong> {normalizeText(selectedModel?.standoutFeature, '—')}
                </div>
              </div>

              {error ? (
                <div style={{ borderRadius: 14, border: '1px solid #fecdca', background: '#fef3f2', color: '#b42318', padding: 14 }}>{error}</div>
              ) : null}

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                <button type="submit" disabled={submitting || modelsLoading} style={primaryButtonStyle}>
                  {submitting ? 'Üretiliyor...' : 'Görsel üret'}
                </button>
                <button type="button" onClick={handleReset} style={secondaryButtonStyle}>Formu temizle</button>
                <button type="button" onClick={() => void loadHistory()} disabled={historyLoading} style={secondaryButtonStyle}>
                  {historyLoading ? 'Yükleniyor...' : 'Geçmişi yenile'}
                </button>
                <button type="button" onClick={handleCancel} disabled={!currentJob?.jobId || cancelLoading || TERMINAL_STATUSES.has(currentJob?.status || '')} style={secondaryButtonStyle}>
                  {cancelLoading ? 'İptal ediliyor...' : 'İptal et'}
                </button>
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {QUICK_PROMPTS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => handleChange('prompt', item)}
                    style={{ ...secondaryButtonStyle, padding: '8px 12px', fontSize: 12 }}
                  >
                    Hazır prompt
                  </button>
                ))}
              </div>
            </form>
          </section>

          <section style={{ display: 'grid', gap: 20 }}>
            <Panel title="Aktif iş">
              {currentJob ? (
                <div style={{ display: 'grid', gap: 14 }}>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
                    <span style={{ borderRadius: 999, border: `1px solid ${currentTone.border}`, color: currentTone.fg, background: currentTone.bg, padding: '6px 10px', fontSize: 12, fontWeight: 700 }}>
                      {statusLabel(currentJob.status)}
                    </span>
                    <span style={{ color: '#475467', fontSize: 13 }}>jobId: {currentJob.jobId}</span>
                  </div>
                  <MetaRow label="Adım" value={currentJob.step || '—'} />
                  <MetaRow label="İlerleme" value={`%${clamp(normalizeNumber(currentJob.progress, 0), 0, 100)}`} />
                  <MetaRow label="ETA" value={formatEta(currentJob.etaMs)} />
                  <MetaRow label="Oluşturuldu" value={formatDateTime(currentJob.createdAt)} />
                  <MetaRow label="Güncellendi" value={formatDateTime(currentJob.updatedAt)} />
                  {currentJob.error?.message ? <div style={{ color: '#b42318', fontSize: 14 }}>{currentJob.error.message}</div> : null}
                </div>
              ) : (
                <div style={{ color: '#667085' }}>Henüz çalışan iş yok.</div>
              )}
            </Panel>

            <Panel title="Sonuç görselleri">
              {images.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
                  {images.map((src) => (
                    <a key={src} href={src} target="_blank" rel="noreferrer" style={{ textDecoration: 'none' }}>
                      <img src={src} alt="Üretilen görsel" style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 16, border: '1px solid #e4e7ec', display: 'block' }} />
                    </a>
                  ))}
                </div>
              ) : (
                <div style={{ color: '#667085' }}>Tamamlanan işte görsel oluştuğunda burada görünür.</div>
              )}
            </Panel>

            <Panel title="Geçmiş işler">
              {history.length > 0 ? (
                <div style={{ display: 'grid', gap: 10 }}>
                  {history.map((job) => {
                    const tone = statusTone(job.status);
                    return (
                      <button
                        key={job.jobId}
                        type="button"
                        onClick={() => handlePickHistory(job)}
                        style={{
                          textAlign: 'left',
                          borderRadius: 16,
                          border: '1px solid #e4e7ec',
                          background: '#fff',
                          padding: 14,
                          display: 'grid',
                          gap: 8,
                          cursor: 'pointer',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                          <div style={{ fontWeight: 700, color: '#101828' }}>{job.requestSummary?.promptPreview || job.request?.prompt || 'İsimsiz iş'}</div>
                          <span style={{ borderRadius: 999, border: `1px solid ${tone.border}`, color: tone.fg, background: tone.bg, padding: '4px 8px', fontSize: 12, fontWeight: 700 }}>
                            {statusLabel(job.status)}
                          </span>
                        </div>
                        <div style={{ fontSize: 13, color: '#475467' }}>jobId: {job.jobId}</div>
                        <div style={{ fontSize: 13, color: '#475467' }}>{formatDateTime(job.updatedAt || job.createdAt)}</div>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div style={{ color: '#667085' }}>{historyLoading ? 'Geçmiş yükleniyor...' : 'Henüz geçmiş iş bulunmuyor.'}</div>
              )}
            </Panel>
          </section>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <label style={{ display: 'grid', gap: 8 }}>
      <span style={{ fontWeight: 600, color: '#344054' }}>{label}</span>
      {children}
    </label>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }): React.JSX.Element {
  return (
    <section
      style={{
        background: '#ffffff',
        border: '1px solid #e6e8ef',
        borderRadius: 20,
        padding: 20,
        boxShadow: '0 8px 30px rgba(16, 24, 40, 0.05)',
      }}
    >
      <div style={{ display: 'grid', gap: 14 }}>
        <h2 style={{ margin: 0, fontSize: 18, color: '#101828' }}>{title}</h2>
        {children}
      </div>
    </section>
  );
}

function MetaRow({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
      <span style={{ color: '#475467' }}>{label}</span>
      <span style={{ color: '#101828', fontWeight: 600, textAlign: 'right' }}>{value}</span>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: '100%',
  borderRadius: 12,
  border: '1px solid #d0d5dd',
  padding: '12px 14px',
  font: 'inherit',
  background: '#fff',
};

const primaryButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid #101828',
  background: '#101828',
  color: '#fff',
  padding: '12px 16px',
  fontWeight: 700,
  cursor: 'pointer',
};

const secondaryButtonStyle: React.CSSProperties = {
  borderRadius: 12,
  border: '1px solid #d0d5dd',
  background: '#fff',
  color: '#344054',
  padding: '12px 16px',
  fontWeight: 600,
  cursor: 'pointer',
};
