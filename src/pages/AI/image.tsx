import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

type WorkerEnvelope<T> = {
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
  style?: {
    accent?: string;
    brandKey?: string;
  };
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
  negativePrompt?: string;
  n?: number;
  responseFormat?: string;
  metadata?: Record<string, JsonValue>;
  clientRequestId?: string;
  attachmentCount?: number;
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
  retryable?: boolean;
  cancelRequested?: boolean;
  requestSummary?: {
    model?: string;
    prompt?: string;
    promptPreview?: string;
  };
  request?: JobRequest;
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
  requestId?: string;
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
const DEFAULT_MODEL_ID = 'black-forest-labs/flux-1-schnell';

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
    badges.includes('image') ||
    modelId.includes('flux') ||
    modelId.includes('gpt-image') ||
    modelId.includes('recraft') ||
    modelId.includes('ideogram') ||
    modelId.includes('stable-diffusion')
  );
}

function pickJobImages(job: JobRecord | null): string[] {
  if (!job) return [];
  const items = [
    ...(Array.isArray(job.outputUrls) ? job.outputUrls : []),
    ...(Array.isArray(job.urls) ? job.urls : []),
    job.outputUrl,
    job.url,
  ];
  return Array.from(new Set(items.filter((item): item is string => typeof item === 'string' && item.trim() !== '')));
}

function formatDateTime(value?: string | null): string {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('tr-TR', {
    dateStyle: 'short',
    timeStyle: 'short',
  }).format(date);
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
  const parsed = text ? JSON.parse(text) : {};
  return parsed as WorkerEnvelope<T> | T;
}

async function requestWorker<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${WORKER_BASE_URL}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  });

  const body = await readJson<T>(response);
  const envelope = body as WorkerEnvelope<T>;

  if (!response.ok || (typeof envelope?.ok === 'boolean' && !envelope.ok)) {
    const message = envelope?.error?.message || `İstek başarısız oldu (${response.status}).`;
    throw new Error(message);
  }

  if (typeof envelope?.ok === 'boolean') {
    return (envelope.data as T) ?? ({} as T);
  }

  return body as T;
}

function styles() {
  return {
    page: {
      minHeight: '100%',
      background: '#ffffff',
      color: '#101828',
      padding: '24px',
      fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    } as React.CSSProperties,
    shell: {
      maxWidth: '1280px',
      margin: '0 auto',
      display: 'grid',
      gap: '20px',
    } as React.CSSProperties,
    hero: {
      border: '1px solid #eaecf0',
      borderRadius: '20px',
      background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
      padding: '24px',
      boxShadow: '0 8px 24px rgba(16, 24, 40, 0.06)',
    } as React.CSSProperties,
    h1: {
      margin: 0,
      fontSize: '28px',
      lineHeight: 1.2,
      fontWeight: 800,
      letterSpacing: '-0.02em',
    } as React.CSSProperties,
    muted: {
      margin: '8px 0 0',
      color: '#475467',
      fontSize: '14px',
      lineHeight: 1.6,
    } as React.CSSProperties,
    badgeRow: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
      marginTop: '16px',
    } as React.CSSProperties,
    badge: {
      display: 'inline-flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 12px',
      borderRadius: '999px',
      background: '#ffffff',
      border: '1px solid #d0d5dd',
      fontSize: '13px',
      color: '#344054',
    } as React.CSSProperties,
    grid: {
      display: 'grid',
      gridTemplateColumns: 'minmax(0, 1.15fr) minmax(320px, 0.85fr)',
      gap: '20px',
      alignItems: 'start',
    } as React.CSSProperties,
    card: {
      border: '1px solid #eaecf0',
      borderRadius: '20px',
      background: '#ffffff',
      boxShadow: '0 8px 24px rgba(16, 24, 40, 0.04)',
      overflow: 'hidden',
    } as React.CSSProperties,
    cardBody: {
      padding: '20px',
      display: 'grid',
      gap: '16px',
    } as React.CSSProperties,
    sectionTitle: {
      margin: 0,
      fontSize: '18px',
      lineHeight: 1.3,
      fontWeight: 700,
    } as React.CSSProperties,
    formGrid: {
      display: 'grid',
      gap: '14px',
    } as React.CSSProperties,
    row2: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '12px',
    } as React.CSSProperties,
    row3: {
      display: 'grid',
      gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
      gap: '12px',
    } as React.CSSProperties,
    labelWrap: {
      display: 'grid',
      gap: '8px',
    } as React.CSSProperties,
    label: {
      fontSize: '13px',
      fontWeight: 600,
      color: '#344054',
    } as React.CSSProperties,
    input: {
      width: '100%',
      minHeight: '44px',
      borderRadius: '12px',
      border: '1px solid #d0d5dd',
      padding: '12px 14px',
      outline: 'none',
      fontSize: '14px',
      background: '#ffffff',
      boxSizing: 'border-box',
    } as React.CSSProperties,
    textarea: {
      width: '100%',
      minHeight: '132px',
      borderRadius: '14px',
      border: '1px solid #d0d5dd',
      padding: '14px',
      outline: 'none',
      fontSize: '14px',
      resize: 'vertical',
      boxSizing: 'border-box',
      lineHeight: 1.5,
    } as React.CSSProperties,
    actions: {
      display: 'flex',
      gap: '10px',
      flexWrap: 'wrap',
    } as React.CSSProperties,
    primaryButton: {
      border: 'none',
      borderRadius: '12px',
      padding: '12px 16px',
      background: '#111827',
      color: '#ffffff',
      fontSize: '14px',
      fontWeight: 700,
      cursor: 'pointer',
    } as React.CSSProperties,
    secondaryButton: {
      borderRadius: '12px',
      padding: '12px 16px',
      border: '1px solid #d0d5dd',
      background: '#ffffff',
      color: '#344054',
      fontSize: '14px',
      fontWeight: 600,
      cursor: 'pointer',
    } as React.CSSProperties,
    errorBox: {
      border: '1px solid #fecdca',
      background: '#fef3f2',
      color: '#b42318',
      borderRadius: '12px',
      padding: '12px 14px',
      fontSize: '14px',
      lineHeight: 1.5,
    } as React.CSSProperties,
    panelGrid: {
      display: 'grid',
      gap: '14px',
    } as React.CSSProperties,
    statusGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
      gap: '12px',
    } as React.CSSProperties,
    metricCard: {
      borderRadius: '14px',
      border: '1px solid #eaecf0',
      background: '#f8fafc',
      padding: '14px',
      display: 'grid',
      gap: '6px',
    } as React.CSSProperties,
    metricLabel: {
      margin: 0,
      color: '#667085',
      fontSize: '12px',
      fontWeight: 600,
      textTransform: 'uppercase',
      letterSpacing: '0.04em',
    } as React.CSSProperties,
    metricValue: {
      margin: 0,
      color: '#101828',
      fontSize: '15px',
      fontWeight: 700,
      overflowWrap: 'anywhere',
    } as React.CSSProperties,
    progressWrap: {
      display: 'grid',
      gap: '8px',
    } as React.CSSProperties,
    progressBar: {
      width: '100%',
      height: '10px',
      borderRadius: '999px',
      background: '#eaecf0',
      overflow: 'hidden',
    } as React.CSSProperties,
    progressFill: {
      height: '100%',
      borderRadius: '999px',
      background: 'linear-gradient(90deg, #2563eb 0%, #7c3aed 100%)',
      transition: 'width 240ms ease',
    } as React.CSSProperties,
    imageGrid: {
      display: 'grid',
      gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
      gap: '14px',
    } as React.CSSProperties,
    imageCard: {
      borderRadius: '18px',
      border: '1px solid #eaecf0',
      overflow: 'hidden',
      background: '#ffffff',
      boxShadow: '0 8px 20px rgba(16, 24, 40, 0.06)',
    } as React.CSSProperties,
    image: {
      display: 'block',
      width: '100%',
      aspectRatio: '1 / 1',
      objectFit: 'cover',
      background: '#f2f4f7',
    } as React.CSSProperties,
    imageMeta: {
      padding: '12px',
      display: 'grid',
      gap: '8px',
    } as React.CSSProperties,
    historyList: {
      display: 'grid',
      gap: '12px',
    } as React.CSSProperties,
    historyItem: {
      border: '1px solid #eaecf0',
      borderRadius: '16px',
      padding: '14px',
      display: 'grid',
      gap: '10px',
      background: '#ffffff',
    } as React.CSSProperties,
    historyHeader: {
      display: 'flex',
      justifyContent: 'space-between',
      gap: '12px',
      alignItems: 'center',
      flexWrap: 'wrap',
    } as React.CSSProperties,
    tiny: {
      margin: 0,
      color: '#667085',
      fontSize: '12px',
      lineHeight: 1.5,
    } as React.CSSProperties,
    promptPreview: {
      margin: 0,
      color: '#101828',
      fontSize: '14px',
      lineHeight: 1.6,
      overflowWrap: 'anywhere',
    } as React.CSSProperties,
    empty: {
      border: '1px dashed #d0d5dd',
      borderRadius: '16px',
      padding: '18px',
      color: '#667085',
      fontSize: '14px',
      background: '#fafafa',
    } as React.CSSProperties,
  };
}

export default function Image(): JSX.Element {
  const ui = useMemo(styles, []);
  const pollTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState('');

  const [currentJob, setCurrentJob] = useState<JobRecord | null>(null);
  const [history, setHistory] = useState<JobRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSubmittedForm, setLastSubmittedForm] = useState<FormState | null>(null);

  const imageModels = useMemo(() => {
    const filtered = models.filter(isImageModel);
    return filtered.sort((a, b) => {
      const aPreferred = normalizeText(a.modelId || a.id) === DEFAULT_MODEL_ID ? -1 : 0;
      const bPreferred = normalizeText(b.modelId || b.id) === DEFAULT_MODEL_ID ? -1 : 0;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return normalizeText(a.modelName || a.modelId).localeCompare(normalizeText(b.modelName || b.modelId), 'tr');
    });
  }, [models]);

  const activeImages = useMemo(() => pickJobImages(currentJob), [currentJob]);
  const canCancel = currentJob != null && !TERMINAL_STATUSES.has(normalizeText(currentJob.status));
  const canRetry = currentJob != null && currentJob.status === 'failed' && Boolean(lastSubmittedForm || currentJob.requestSummary?.prompt);

  const currentModel = useMemo(() => {
    return imageModels.find((item) => normalizeText(item.modelId || item.id) === form.modelId) || null;
  }, [imageModels, form.modelId]);

  const applyFormPatch = useCallback((patch: Partial<FormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const loadHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const payload = await requestWorker<HistoryPayload>(`/jobs/history?feature=image&limit=${HISTORY_LIMIT}`);
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (mountedRef.current) setHistory(items);
    } catch (historyError) {
      if (mountedRef.current) {
        console.error(historyError);
      }
    } finally {
      if (mountedRef.current) setHistoryLoading(false);
    }
  }, []);

  const pollJob = useCallback(async (jobId: string) => {
    clearPollTimer();

    try {
      const job = await requestWorker<JobRecord>(`/jobs/status/${encodeURIComponent(jobId)}`);
      if (!mountedRef.current) return;
      setCurrentJob(job);

      if (TERMINAL_STATUSES.has(normalizeText(job.status))) {
        setSubmitting(false);
        void loadHistory();
        return;
      }

      pollTimerRef.current = window.setTimeout(() => {
        void pollJob(jobId);
      }, POLL_INTERVAL_MS);
    } catch (pollError) {
      if (!mountedRef.current) return;
      setSubmitting(false);
      setError(pollError instanceof Error ? pollError.message : 'İş durumu alınamadı.');
    }
  }, [clearPollTimer, loadHistory]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setModelsError('');

    try {
      const payload = await requestWorker<ModelsPayload>('/models?limit=250&sort=price_asc');
      const items = Array.isArray(payload.items) ? payload.items : [];
      if (!mountedRef.current) return;

      setModels(items);

      const filtered = items.filter(isImageModel);
      const hasSelectedModel = filtered.some((item) => normalizeText(item.modelId || item.id) === form.modelId);
      if (!hasSelectedModel && filtered.length > 0) {
        const fallback = filtered.find((item) => normalizeText(item.modelId || item.id) === DEFAULT_MODEL_ID) || filtered[0];
        setForm((prev) => ({ ...prev, modelId: normalizeText(fallback.modelId || fallback.id) }));
      }
    } catch (modelsLoadError) {
      if (!mountedRef.current) return;
      setModelsError(modelsLoadError instanceof Error ? modelsLoadError.message : 'Modeller alınamadı.');
    } finally {
      if (mountedRef.current) setModelsLoading(false);
    }
  }, [form.modelId]);

  useEffect(() => {
    mountedRef.current = true;
    void loadModels();
    void loadHistory();

    return () => {
      mountedRef.current = false;
      clearPollTimer();
    };
  }, [clearPollTimer, loadHistory, loadModels]);

  const submit = useCallback(async (sourceForm?: FormState) => {
    const nextForm = sourceForm || form;
    const trimmedPrompt = nextForm.prompt.trim();

    if (!trimmedPrompt) {
      setError('Lütfen bir prompt gir.');
      return;
    }

    if (!nextForm.modelId) {
      setError('Lütfen bir model seç.');
      return;
    }

    setSubmitting(true);
    setError('');
    clearPollTimer();

    try {
      const payload = await requestWorker<GeneratePayload>('/generate', {
        method: 'POST',
        body: JSON.stringify({
          prompt: trimmedPrompt,
          modelId: nextForm.modelId,
          model: nextForm.modelId,
          ratio: nextForm.ratio,
          quality: nextForm.quality,
          style: nextForm.style.trim() || undefined,
          negativePrompt: nextForm.negativePrompt.trim() || undefined,
          n: clamp(nextForm.n, 1, 8),
          responseFormat: 'url',
          guidance: nextForm.guidance.trim() === '' ? undefined : Number(nextForm.guidance),
          seed: nextForm.seed.trim() === '' ? undefined : Number(nextForm.seed),
          metadata: {
            surface: 'image.tsx',
            workerBaseUrl: WORKER_BASE_URL,
          },
        }),
      });

      const jobId = normalizeText(payload.jobId);
      if (!jobId) {
        throw new Error('Worker jobId dönmedi.');
      }

      const immediateJob: JobRecord = {
        jobId,
        status: normalizeText(payload.status, 'queued'),
        progress: normalizeNumber(payload.progress, 0),
        step: normalizeText(payload.step, 'queued'),
        url: payload.url || payload.outputUrl || null,
        urls: Array.isArray(payload.urls) ? payload.urls : payload.outputUrls || [],
        outputUrl: payload.outputUrl || payload.url || null,
        outputUrls: Array.isArray(payload.outputUrls) ? payload.outputUrls : payload.urls || [],
        requestSummary: {
          model: nextForm.modelId,
          prompt: trimmedPrompt,
          promptPreview: trimmedPrompt.slice(0, 160),
        },
        request: {
          model: nextForm.modelId,
          modelId: nextForm.modelId,
          ratio: nextForm.ratio,
          quality: nextForm.quality,
          style: nextForm.style,
          negativePrompt: nextForm.negativePrompt,
          n: nextForm.n,
        },
      };

      setCurrentJob(immediateJob);
      setLastSubmittedForm({ ...nextForm, prompt: trimmedPrompt });
      void loadHistory();
      void pollJob(jobId);
    } catch (submitError) {
      setSubmitting(false);
      setError(submitError instanceof Error ? submitError.message : 'Üretim başlatılamadı.');
    }
  }, [clearPollTimer, form, loadHistory, pollJob]);

  const cancelJob = useCallback(async () => {
    if (!currentJob?.jobId) return;
    setError('');

    try {
      const cancelled = await requestWorker<JobRecord>('/jobs/cancel', {
        method: 'POST',
        body: JSON.stringify({ jobId: currentJob.jobId }),
      });
      clearPollTimer();
      if (!mountedRef.current) return;
      setCurrentJob(cancelled);
      setSubmitting(false);
      void loadHistory();
    } catch (cancelError) {
      if (!mountedRef.current) return;
      setError(cancelError instanceof Error ? cancelError.message : 'İş iptal edilemedi.');
    }
  }, [clearPollTimer, currentJob?.jobId, loadHistory]);

  const retryLast = useCallback(async () => {
    const source = lastSubmittedForm || (currentJob ? {
      prompt: normalizeText(currentJob.requestSummary?.prompt),
      negativePrompt: normalizeText(currentJob.request?.negativePrompt),
      style: normalizeText(currentJob.request?.style),
      ratio: normalizeText(currentJob.request?.ratio, '1:1'),
      quality: normalizeText(currentJob.request?.quality, 'high'),
      modelId: normalizeText(currentJob.request?.modelId || currentJob.request?.model, DEFAULT_MODEL_ID),
      n: clamp(normalizeNumber(currentJob.request?.n, 1), 1, 8),
      guidance: '',
      seed: '',
    } : null);

    if (!source) {
      setError('Tekrar denenecek bir iş bulunamadı.');
      return;
    }

    setForm(source);
    await submit(source);
  }, [currentJob, lastSubmittedForm, submit]);

  const openHistoryItem = useCallback((job: JobRecord) => {
    clearPollTimer();
    setCurrentJob(job);
    setError('');

    const modelId = normalizeText(job.request?.modelId || job.request?.model, DEFAULT_MODEL_ID);
    const prompt = normalizeText(job.requestSummary?.prompt || job.requestSummary?.promptPreview);
    setForm((prev) => ({
      ...prev,
      prompt: prompt || prev.prompt,
      negativePrompt: normalizeText(job.request?.negativePrompt),
      style: normalizeText(job.request?.style),
      ratio: normalizeText(job.request?.ratio, prev.ratio),
      quality: normalizeText(job.request?.quality, prev.quality),
      modelId: modelId || prev.modelId,
      n: clamp(normalizeNumber(job.request?.n, prev.n), 1, 8),
    }));

    if (!TERMINAL_STATUSES.has(normalizeText(job.status))) {
      setSubmitting(true);
      void pollJob(job.jobId);
    } else {
      setSubmitting(false);
    }
  }, [clearPollTimer, pollJob]);

  const currentStatusTone = statusTone(currentJob?.status);

  return (
    <div style={ui.page}>
      <div style={ui.shell}>
        <section style={ui.hero}>
          <h1 style={ui.h1}>Görsel Üretim</h1>
          <p style={ui.muted}>
            Bu sayfa doğrudan <strong>{WORKER_BASE_URL}</strong> ile konuşur. Puter giriş ekranı açmaz; tüm üretim,
            durum takibi, iptal ve model listeleme tek worker üstünden yürür.
          </p>
          <div style={ui.badgeRow}>
            <span style={ui.badge}>Worker: {WORKER_BASE_URL}</span>
            <span style={ui.badge}>Uçlar: /models · /generate · /jobs/status/:id · /jobs/history · /jobs/cancel</span>
            <span style={ui.badge}>Mod: me.puter uyumlu fetch akışı</span>
          </div>
        </section>

        <div style={ui.grid}>
          <section style={ui.card}>
            <div style={ui.cardBody}>
              <h2 style={ui.sectionTitle}>Yeni üretim</h2>

              <div style={ui.formGrid}>
                <label style={ui.labelWrap}>
                  <span style={ui.label}>Prompt</span>
                  <textarea
                    style={ui.textarea}
                    value={form.prompt}
                    onChange={(event) => applyFormPatch({ prompt: event.target.value })}
                    placeholder="Örnek: Sisli İstanbul gecesinde neon ışıklı siberpunk tramvay, sinematik kadraj, yüksek detay"
                  />
                </label>

                <label style={ui.labelWrap}>
                  <span style={ui.label}>Negatif prompt</span>
                  <textarea
                    style={{ ...ui.textarea, minHeight: '90px' }}
                    value={form.negativePrompt}
                    onChange={(event) => applyFormPatch({ negativePrompt: event.target.value })}
                    placeholder="Örnek: bulanık, düşük kalite, deforme yüz, ekstra kol"
                  />
                </label>

                <div style={ui.row2}>
                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Model</span>
                    <select
                      style={ui.input}
                      value={form.modelId}
                      onChange={(event) => applyFormPatch({ modelId: event.target.value })}
                      disabled={modelsLoading}
                    >
                      {modelsLoading && <option value="">Modeller yükleniyor...</option>}
                      {!modelsLoading && imageModels.length === 0 && <option value="">Görsel modeli bulunamadı</option>}
                      {imageModels.map((model) => {
                        const modelId = normalizeText(model.modelId || model.id);
                        return (
                          <option key={modelId} value={modelId}>
                            {model.modelName || modelId} {model.company ? `· ${model.company}` : ''}
                          </option>
                        );
                      })}
                    </select>
                    {modelsError && <span style={{ ...ui.tiny, color: '#b42318' }}>{modelsError}</span>}
                  </label>

                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Stil notu</span>
                    <input
                      style={ui.input}
                      value={form.style}
                      onChange={(event) => applyFormPatch({ style: event.target.value })}
                      placeholder="Örnek: steampunk, cinematic, illustration"
                    />
                  </label>
                </div>

                <div style={ui.row3}>
                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Oran</span>
                    <select
                      style={ui.input}
                      value={form.ratio}
                      onChange={(event) => applyFormPatch({ ratio: event.target.value })}
                    >
                      {RATIO_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Kalite</span>
                    <select
                      style={ui.input}
                      value={form.quality}
                      onChange={(event) => applyFormPatch({ quality: event.target.value })}
                    >
                      {QUALITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Adet</span>
                    <input
                      style={ui.input}
                      type="number"
                      min={1}
                      max={8}
                      value={form.n}
                      onChange={(event) => applyFormPatch({ n: clamp(normalizeNumber(event.target.value, 1), 1, 8) })}
                    />
                  </label>
                </div>

                <div style={ui.row2}>
                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Guidance</span>
                    <input
                      style={ui.input}
                      inputMode="decimal"
                      value={form.guidance}
                      onChange={(event) => applyFormPatch({ guidance: event.target.value })}
                      placeholder="Boş bırakılabilir"
                    />
                  </label>

                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Seed</span>
                    <input
                      style={ui.input}
                      inputMode="numeric"
                      value={form.seed}
                      onChange={(event) => applyFormPatch({ seed: event.target.value })}
                      placeholder="Boş bırakılabilir"
                    />
                  </label>
                </div>

                {currentModel && (
                  <div style={{ ...ui.metricCard, background: '#faf5ff', borderColor: '#e9d7fe' }}>
                    <p style={ui.metricLabel}>Seçili model özeti</p>
                    <p style={ui.metricValue}>{currentModel.modelName || currentModel.modelId}</p>
                    <p style={ui.tiny}>
                      {currentModel.company || currentModel.provider || 'Sağlayıcı bilinmiyor'}
                      {currentModel.speedLabel ? ` · ${currentModel.speedLabel}` : ''}
                      {typeof currentModel.imagePrice === 'number' ? ` · Görsel fiyatı: ${currentModel.imagePrice}` : ''}
                    </p>
                    {currentModel.standoutFeature && <p style={ui.tiny}>{currentModel.standoutFeature}</p>}
                  </div>
                )}

                {error && <div style={ui.errorBox}>{error}</div>}

                <div style={ui.actions}>
                  <button
                    type="button"
                    style={{
                      ...ui.primaryButton,
                      opacity: submitting ? 0.75 : 1,
                      cursor: submitting ? 'wait' : 'pointer',
                    }}
                    onClick={() => void submit()}
                    disabled={submitting}
                  >
                    {submitting ? 'Üretim sürüyor...' : 'Görsel üret'}
                  </button>

                  <button
                    type="button"
                    style={ui.secondaryButton}
                    onClick={() => {
                      setForm(initialFormState());
                      setError('');
                    }}
                  >
                    Formu temizle
                  </button>

                  <button
                    type="button"
                    style={{
                      ...ui.secondaryButton,
                      opacity: canCancel ? 1 : 0.55,
                      cursor: canCancel ? 'pointer' : 'not-allowed',
                    }}
                    onClick={() => void cancelJob()}
                    disabled={!canCancel}
                  >
                    İptal et
                  </button>

                  <button
                    type="button"
                    style={{
                      ...ui.secondaryButton,
                      opacity: canRetry ? 1 : 0.55,
                      cursor: canRetry ? 'pointer' : 'not-allowed',
                    }}
                    onClick={() => void retryLast()}
                    disabled={!canRetry}
                  >
                    Tekrar dene
                  </button>
                </div>
              </div>
            </div>
          </section>

          <aside style={ui.panelGrid}>
            <section style={ui.card}>
              <div style={ui.cardBody}>
                <div style={ui.historyHeader}>
                  <h2 style={ui.sectionTitle}>Üretim durumu</h2>
                  <span
                    style={{
                      ...ui.badge,
                      background: currentStatusTone.bg,
                      color: currentStatusTone.fg,
                      borderColor: currentStatusTone.border,
                    }}
                  >
                    {statusLabel(currentJob?.status)}
                  </span>
                </div>

                <div style={ui.statusGrid}>
                  <div style={ui.metricCard}>
                    <p style={ui.metricLabel}>Job ID</p>
                    <p style={ui.metricValue}>{currentJob?.jobId || '—'}</p>
                  </div>
                  <div style={ui.metricCard}>
                    <p style={ui.metricLabel}>Adım</p>
                    <p style={ui.metricValue}>{currentJob?.step || '—'}</p>
                  </div>
                  <div style={ui.metricCard}>
                    <p style={ui.metricLabel}>Sıra</p>
                    <p style={ui.metricValue}>
                      {currentJob?.queuePosition == null ? '—' : String(currentJob.queuePosition)}
                    </p>
                  </div>
                  <div style={ui.metricCard}>
                    <p style={ui.metricLabel}>Tahmini süre</p>
                    <p style={ui.metricValue}>{formatEta(currentJob?.etaMs)}</p>
                  </div>
                </div>

                <div style={ui.progressWrap}>
                  <div style={ui.historyHeader}>
                    <p style={ui.metricLabel}>İlerleme</p>
                    <p style={ui.metricValue}>%{clamp(normalizeNumber(currentJob?.progress, 0), 0, 100)}</p>
                  </div>
                  <div style={ui.progressBar}>
                    <div
                      style={{
                        ...ui.progressFill,
                        width: `${clamp(normalizeNumber(currentJob?.progress, 0), 0, 100)}%`,
                      }}
                    />
                  </div>
                </div>

                {currentJob?.error?.message && <div style={ui.errorBox}>{currentJob.error.message}</div>}

                <div style={ui.metricCard}>
                  <p style={ui.metricLabel}>Son güncelleme</p>
                  <p style={ui.metricValue}>{formatDateTime(currentJob?.updatedAt || currentJob?.createdAt)}</p>
                  <p style={ui.tiny}>
                    Oluşturulma: {formatDateTime(currentJob?.createdAt)}
                    {currentJob?.finishedAt ? ` · Bitiş: ${formatDateTime(currentJob.finishedAt)}` : ''}
                  </p>
                </div>
              </div>
            </section>

            <section style={ui.card}>
              <div style={ui.cardBody}>
                <div style={ui.historyHeader}>
                  <h2 style={ui.sectionTitle}>Son işler</h2>
                  <button type="button" style={ui.secondaryButton} onClick={() => void loadHistory()}>
                    Yenile
                  </button>
                </div>

                {historyLoading && history.length === 0 ? (
                  <div style={ui.empty}>Geçmiş yükleniyor...</div>
                ) : history.length === 0 ? (
                  <div style={ui.empty}>Henüz kayıt yok.</div>
                ) : (
                  <div style={ui.historyList}>
                    {history.map((job) => {
                      const tone = statusTone(job.status);
                      return (
                        <button
                          key={job.jobId}
                          type="button"
                          style={{
                            ...ui.historyItem,
                            textAlign: 'left',
                            cursor: 'pointer',
                          }}
                          onClick={() => openHistoryItem(job)}
                        >
                          <div style={ui.historyHeader}>
                            <span
                              style={{
                                ...ui.badge,
                                background: tone.bg,
                                color: tone.fg,
                                borderColor: tone.border,
                              }}
                            >
                              {statusLabel(job.status)}
                            </span>
                            <span style={ui.tiny}>{formatDateTime(job.createdAt)}</span>
                          </div>
                          <p style={ui.promptPreview}>{job.requestSummary?.promptPreview || job.requestSummary?.prompt || 'Prompt yok'}</p>
                          <p style={ui.tiny}>
                            {job.requestSummary?.model || job.request?.modelId || job.request?.model || 'Model bilinmiyor'}
                          </p>
                          {job.error?.message && <p style={{ ...ui.tiny, color: '#b42318' }}>{job.error.message}</p>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </aside>
        </div>

        <section style={ui.card}>
          <div style={ui.cardBody}>
            <div style={ui.historyHeader}>
              <h2 style={ui.sectionTitle}>Üretilen görseller</h2>
              {activeImages.length > 0 && currentJob?.jobId && <span style={ui.badge}>Job: {currentJob.jobId}</span>}
            </div>

            {activeImages.length === 0 ? (
              <div style={ui.empty}>
                Üretim tamamlandığında görseller burada görünür. Geçmişten bir kayıt seçersen eski çıktıları da aynı alanda açabilirsin.
              </div>
            ) : (
              <div style={ui.imageGrid}>
                {activeImages.map((imageUrl, index) => (
                  <article key={`${imageUrl}-${index}`} style={ui.imageCard}>
                    <img
                      src={imageUrl}
                      alt={`Üretilen görsel ${index + 1}`}
                      style={ui.image}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                    <div style={ui.imageMeta}>
                      <p style={ui.metricValue}>Görsel {index + 1}</p>
                      <a href={imageUrl} target="_blank" rel="noreferrer" style={{ ...ui.tiny, color: '#175cd3' }}>
                        Yeni sekmede aç
                      </a>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
