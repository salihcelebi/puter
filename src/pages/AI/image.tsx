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
  routes?: string[];
  worker?: string;
  version?: string;
};

type WorkerInfoPayload = {
  worker?: string;
  version?: string;
  protocolVersion?: string;
  purpose?: string;
  routes?: string[];
  supportedQuery?: string[];
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
  id?: string;
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
  error?: {
    message?: string;
  } | null;
  job?: {
    jobId?: string;
    id?: string;
    status?: string;
  } | null;
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

type WorkerRequestResult<T> = {
  status: number;
  body: WorkerEnvelope<T> | T;
};

const WORKER_BASE_URL = 'https://idm.puter.work';
const HISTORY_LIMIT = 5;
const POLL_INTERVAL_MS = 1800;
const REQUEST_TIMEOUT_MS = 25000;
const TERMINAL_STATUSES = new Set(['completed', 'failed', 'cancelled']);
const DEFAULT_MODEL_ID = 'black-forest-labs/flux-1-schnell';
const LOCAL_JOB_PREFIX = 'local_';

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

function toTitleCase(value: string): string {
  return value
    .split(/[-_\s/]+/)
    .filter(Boolean)
    .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function deriveProviderFromModelId(modelId?: string, company?: string): string {
  const companyText = normalizeText(company);
  if (companyText) return companyText;
  const rawModelId = normalizeText(modelId);
  if (!rawModelId.includes('/')) return rawModelId ? toTitleCase(rawModelId) : 'Bilinmiyor';
  return toTitleCase(rawModelId.split('/')[0]);
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.trim() !== '');
}

function uniqueStrings(values: string[]): string[] {
  return Array.from(new Set(values.filter((item) => item.trim() !== '')));
}

function normalizeModel(raw: unknown): ModelItem | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const modelId = normalizeText(source.modelId || source.id);
  const company = normalizeText(source.company);
  const provider = normalizeText(source.provider) || deriveProviderFromModelId(modelId, company);
  const modelName = normalizeText(source.modelName) || modelId || 'Adsız model';

  return {
    id: normalizeText(source.id) || modelId,
    modelId,
    modelName,
    company,
    provider,
    categoryRaw: normalizeText(source.categoryRaw),
    badges: ensureStringArray(source.badges),
    imagePrice: source.imagePrice == null ? null : normalizeNumber(source.imagePrice, 0),
    speedLabel: normalizeText(source.speedLabel),
    standoutFeature: normalizeText(source.standoutFeature),
    useCase: normalizeText(source.useCase),
    style: typeof source.style === 'object' && source.style ? {
      accent: normalizeText((source.style as Record<string, unknown>).accent),
      brandKey: normalizeText((source.style as Record<string, unknown>).brandKey),
    } : undefined,
  };
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
    modelId.includes('flux') ||
    modelId.includes('gpt-image') ||
    modelId.includes('recraft') ||
    modelId.includes('ideogram') ||
    modelId.includes('stable-diffusion')
  );
}

function normalizeModelList(payload: unknown): ModelItem[] {
  const candidates: unknown[] =
    Array.isArray(payload)
      ? payload
      : Array.isArray((payload as ModelsPayload | undefined)?.items)
        ? ((payload as ModelsPayload).items as unknown[])
        : Array.isArray((payload as { models?: unknown[] } | undefined)?.models)
          ? (((payload as { models?: unknown[] }).models) as unknown[])
          : [];

  return candidates
    .map(normalizeModel)
    .filter((item): item is ModelItem => item !== null)
    .filter((item: ModelItem) => Boolean(normalizeText(item.modelId || item.id)));
}

function extractImageUrls(value: unknown): string[] {
  if (!value) return [];
  if (typeof value === 'string') return value.trim() ? [value] : [];
  if (Array.isArray(value)) {
    return uniqueStrings(
      value.flatMap((entry) => {
        if (typeof entry === 'string') return entry;
        if (entry && typeof entry === 'object') {
          const record = entry as Record<string, unknown>;
          return [
            normalizeText(record.url),
            normalizeText(record.outputUrl),
            normalizeText(record.src),
            normalizeText(record.href),
          ].filter(Boolean);
        }
        return [] as string[];
      }),
    );
  }
  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    return uniqueStrings([
      normalizeText(record.url),
      normalizeText(record.outputUrl),
      ...extractImageUrls(record.urls),
      ...extractImageUrls(record.outputUrls),
      ...extractImageUrls(record.images),
      ...extractImageUrls(record.outputs),
      ...extractImageUrls(record.results),
      ...extractImageUrls(record.data),
    ]);
  }
  return [];
}

function pickJobImages(job: JobRecord | null): string[] {
  if (!job) return [];
  return uniqueStrings([
    ...ensureStringArray(job.outputUrls),
    ...ensureStringArray(job.urls),
    normalizeText(job.outputUrl),
    normalizeText(job.url),
  ]);
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
  if (!text.trim()) return {} as WorkerEnvelope<T>;

  try {
    return JSON.parse(text) as WorkerEnvelope<T> | T;
  } catch {
    return {
      ok: false,
      error: {
        message: `Worker JSON dönmedi: ${text.slice(0, 180)}`,
      },
    } as WorkerEnvelope<T>;
  }
}

function isEnvelope<T>(body: WorkerEnvelope<T> | T): body is WorkerEnvelope<T> {
  return Boolean(body) && typeof body === 'object' && ('ok' in (body as object) || 'data' in (body as object) || 'error' in (body as object));
}

function normalizeWorkerErrorMessage(message: string, status: number): string {
  const lower = message.toLowerCase();
  if (
    lower.includes("reading 'puter'") ||
    lower.includes('reading "puter"') ||
    (lower.includes('undefined') && lower.includes('puter'))
  ) {
    return 'Worker oturum doğrulaması başarısız. Lütfen yeniden giriş yapıp tekrar dene.';
  }
  if (lower.includes('failed to fetch') || lower.includes('networkerror')) {
    return 'Worker ağına erişilemedi. Lütfen bağlantını kontrol edip tekrar dene.';
  }
  if (status === 404) {
    return 'Worker bu uç için 404 döndü. Canlı worker sözleşmesi güncel değil veya ilgili uç devrede değil.';
  }
  if (status === 405) {
    return 'Worker bu istek yöntemini kabul etmedi. İstek sözleşmesi ile worker uygulaması uyuşmuyor.';
  }
  return message || `İstek başarısız oldu (${status}).`;
}

async function requestWorkerRaw<T>(path: string, init?: RequestInit): Promise<WorkerRequestResult<T>> {
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const method = normalizeText(init?.method, 'GET').toUpperCase();
  const hasBody = typeof init?.body !== 'undefined' && init?.body !== null;
  const baseHeaders: Record<string, string> = { Accept: 'application/json' };

  if (hasBody && !(init?.body instanceof FormData)) {
    baseHeaders['Content-Type'] = 'application/json';
  }

  try {
    const response = await fetch(`${WORKER_BASE_URL}${path}`, {
      ...init,
      method,
      credentials: 'include',
      mode: 'cors',
      signal: controller.signal,
      headers: {
        ...baseHeaders,
        ...(init?.headers || {}),
      },
    });

    const body = await readJson<T>(response);
    return { status: response.status, body };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('Worker zaman aşımına uğradı. Lütfen tekrar dene.');
    }
    if (error instanceof TypeError) {
      throw new Error('Worker ağına erişilemedi. CORS, preflight veya ağ bağlantısı başarısız oldu.');
    }
    throw error;
  } finally {
    window.clearTimeout(timeoutId);
  }
}

async function requestWorker<T>(path: string, init?: RequestInit): Promise<T> {
  const { status, body } = await requestWorkerRaw<T>(path, init);
  const envelope = isEnvelope<T>(body) ? body : null;

  if (status >= 400 || (typeof envelope?.ok === 'boolean' && !envelope.ok)) {
    const rawMessage = normalizeText(envelope?.error?.message) || `İstek başarısız oldu (${status}).`;
    const message = normalizeWorkerErrorMessage(rawMessage, status);
    throw new Error(message);
  }

  if (envelope && 'data' in envelope && typeof envelope.data !== 'undefined') {
    return envelope.data as T;
  }

  return body as T;
}

function normalizeJobRecord(raw: unknown): JobRecord | null {
  if (!raw || typeof raw !== 'object') return null;
  const source = raw as Record<string, unknown>;
  const nestedJob = source.job && typeof source.job === 'object' ? (source.job as Record<string, unknown>) : null;
  const jobId = normalizeText(source.jobId) || normalizeText(source.id) || normalizeText(source.requestId) || normalizeText(nestedJob?.jobId) || normalizeText(nestedJob?.id);
  const urls = uniqueStrings([
    ...extractImageUrls(source.outputUrls),
    ...extractImageUrls(source.urls),
    ...extractImageUrls(source.images),
    ...extractImageUrls(source.outputs),
    ...extractImageUrls(source.results),
    normalizeText(source.outputUrl),
    normalizeText(source.url),
  ]);
  const status = normalizeText(source.status) || normalizeText(nestedJob?.status) || (urls.length > 0 ? 'completed' : 'queued');
  const modelId = normalizeText(source.modelId) || normalizeText(source.model) || normalizeText((source.request as Record<string, unknown> | undefined)?.modelId) || normalizeText((source.request as Record<string, unknown> | undefined)?.model);
  const prompt = normalizeText((source.requestSummary as Record<string, unknown> | undefined)?.prompt) || normalizeText((source.requestSummary as Record<string, unknown> | undefined)?.promptPreview) || normalizeText((source.request as Record<string, unknown> | undefined)?.prompt);

  if (!jobId && urls.length === 0) return null;

  return {
    jobId: jobId || `${LOCAL_JOB_PREFIX}${Date.now()}`,
    feature: normalizeText(source.feature, 'image'),
    status,
    progress: clamp(normalizeNumber(source.progress, status === 'completed' ? 100 : 0), 0, 100),
    step: normalizeText(source.step, status),
    queuePosition: source.queuePosition == null ? null : normalizeNumber(source.queuePosition, 0),
    etaMs: source.etaMs == null ? null : normalizeNumber(source.etaMs, 0),
    outputUrl: urls[0] || null,
    outputUrls: urls,
    url: urls[0] || null,
    urls,
    retryable: Boolean(source.retryable),
    cancelRequested: Boolean(source.cancelRequested),
    requestSummary: {
      model: modelId,
      prompt,
      promptPreview: prompt ? prompt.slice(0, 160) : '',
    },
    request: {
      model: modelId,
      modelId,
      provider: normalizeText((source.request as Record<string, unknown> | undefined)?.provider),
      ratio: normalizeText((source.request as Record<string, unknown> | undefined)?.ratio),
      size: normalizeText((source.request as Record<string, unknown> | undefined)?.size),
      quality: normalizeText((source.request as Record<string, unknown> | undefined)?.quality),
      style: normalizeText((source.request as Record<string, unknown> | undefined)?.style),
      negativePrompt: normalizeText((source.request as Record<string, unknown> | undefined)?.negativePrompt),
      n: normalizeNumber((source.request as Record<string, unknown> | undefined)?.n, 1),
    },
    error: source.error && typeof source.error === 'object' ? {
      message: normalizeText((source.error as Record<string, unknown>).message),
      retryable: Boolean((source.error as Record<string, unknown>).retryable),
    } : null,
    createdAt: normalizeText(source.createdAt),
    updatedAt: normalizeText(source.updatedAt),
    finishedAt: normalizeText(source.finishedAt) || null,
  };
}

function normalizeHistoryItems(payload: unknown): JobRecord[] {
  const source = payload as Record<string, unknown> | null;
  const candidates =
    Array.isArray(payload)
      ? payload
      : Array.isArray(source?.items)
        ? source?.items
        : Array.isArray(source?.jobs)
          ? source?.jobs
          : Array.isArray(source?.history)
            ? source?.history
            : [];

  return (candidates as unknown[])
    .map(normalizeJobRecord)
    .filter((job): job is JobRecord => Boolean(job));
}

function normalizeGenerateResult(payload: unknown, fallbackForm: FormState, prompt: string): JobRecord | null {
  const normalized = normalizeJobRecord(payload);
  if (!normalized) return null;

  const modelId = normalizeText(normalized.request?.modelId || normalized.request?.model, fallbackForm.modelId);
  const urls = pickJobImages(normalized);
  const finalStatus = normalizeText(normalized.status) || (urls.length > 0 ? 'completed' : 'queued');
  const finalJobId = normalizeText(normalized.jobId) || `${LOCAL_JOB_PREFIX}${Date.now()}`;

  return {
    ...normalized,
    jobId: finalJobId,
    status: finalStatus,
    progress: clamp(normalizeNumber(normalized.progress, finalStatus === 'completed' ? 100 : 0), 0, 100),
    step: normalizeText(normalized.step, finalStatus),
    outputUrl: urls[0] || null,
    outputUrls: urls,
    url: urls[0] || null,
    urls,
    requestSummary: {
      model: modelId,
      prompt,
      promptPreview: prompt.slice(0, 160),
    },
    request: {
      ...normalized.request,
      model: modelId,
      modelId,
      ratio: normalizeText(normalized.request?.ratio, fallbackForm.ratio),
      quality: normalizeText(normalized.request?.quality, fallbackForm.quality),
      style: normalizeText(normalized.request?.style, fallbackForm.style),
      negativePrompt: normalizeText(normalized.request?.negativePrompt, fallbackForm.negativePrompt),
      n: clamp(normalizeNumber(normalized.request?.n, fallbackForm.n), 1, 8),
    },
  };
}

function isLocalOnlyJob(jobId: string): boolean {
  return jobId.startsWith(LOCAL_JOB_PREFIX);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
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
    infoBox: {
      border: '1px solid #bfd9ff',
      background: '#eff8ff',
      color: '#1849a9',
      borderRadius: '12px',
      padding: '12px 14px',
      fontSize: '14px',
      lineHeight: 1.5,
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
      cursor: 'pointer',
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

export default function Image(): React.ReactElement {
  const ui = useMemo(styles, []);
  const pollTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const [form, setForm] = useState<FormState>(initialFormState);
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(true);
  const [modelsError, setModelsError] = useState('');

  const [workerInfo, setWorkerInfo] = useState<WorkerInfoPayload | null>(null);
  const [workerInfoError, setWorkerInfoError] = useState('');

  const [currentJob, setCurrentJob] = useState<JobRecord | null>(null);
  const [history, setHistory] = useState<JobRecord[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [error, setError] = useState('');
  const [lastSubmittedForm, setLastSubmittedForm] = useState<FormState | null>(null);

  const imageModels = useMemo(() => {
    const filtered = models.filter(isImageModel);
    return filtered.sort((a: ModelItem, b: ModelItem) => {
      const aPreferred = normalizeText(a.modelId || a.id) === DEFAULT_MODEL_ID ? -1 : 0;
      const bPreferred = normalizeText(b.modelId || b.id) === DEFAULT_MODEL_ID ? -1 : 0;
      if (aPreferred !== bPreferred) return aPreferred - bPreferred;
      return normalizeText(a.modelName || a.modelId).localeCompare(normalizeText(b.modelName || b.modelId), 'tr');
    });
  }, [models]);

  const activeImages = useMemo(() => pickJobImages(currentJob), [currentJob]);
  const canCancel = currentJob != null && !TERMINAL_STATUSES.has(normalizeText(currentJob.status)) && !isLocalOnlyJob(currentJob.jobId);
  const canRetry = currentJob != null && currentJob.status === 'failed' && Boolean(lastSubmittedForm || currentJob.requestSummary?.prompt);
  const declaredRoutes = ensureStringArray(workerInfo?.routes);
  const declaredRouteLabel = declaredRoutes.length > 0 ? declaredRoutes.join(' · ') : '/models · /generate · /jobs/status/:id · /jobs/history · /jobs/cancel';
  const workerContractWarning = useMemo(() => {
    if (declaredRoutes.length === 0) return '';
    const normalizedRoutes = declaredRoutes.map((route) => route.toLowerCase());
    const announcesGenerate = normalizedRoutes.some((route) => route.includes('/generate'));
    const announcesStatus = normalizedRoutes.some((route) => route.includes('/jobs/status'));
    if (!announcesGenerate || !announcesStatus) {
      return 'Canlı worker kök bilgisinde üretim ve job uçları ilan edilmiyor. Sayfa bu yüzden cevapları toleranslı parse ediyor ve eksik jobId durumunda history kurtarma akışına düşüyor.';
    }
    return '';
  }, [declaredRoutes]);

  const currentModel = useMemo(() => {
    return imageModels.find((item: ModelItem) => normalizeText(item.modelId || item.id) === form.modelId) || null;
  }, [imageModels, form.modelId]);

  const currentModelProvider = useMemo(() => {
    return currentModel ? normalizeText(currentModel.provider) || normalizeText(currentModel.company) || deriveProviderFromModelId(currentModel.modelId || currentModel.id, currentModel.company) : '—';
  }, [currentModel]);

  const applyFormPatch = useCallback((patch: Partial<FormState>) => {
    setForm((prev: FormState) => ({ ...prev, ...patch }));
  }, []);

  const clearPollTimer = useCallback(() => {
    if (pollTimerRef.current != null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const probeWorker = useCallback(async () => {
    setWorkerInfoError('');
    try {
      const payload = await requestWorker<WorkerInfoPayload>('/');
      if (!mountedRef.current) return;
      setWorkerInfo(payload);
    } catch (probeError) {
      if (!mountedRef.current) return;
      setWorkerInfoError(probeError instanceof Error ? probeError.message : 'Worker bilgisi okunamadı.');
    }
  }, []);

  const loadHistory = useCallback(async (): Promise<JobRecord[]> => {
    setHistoryLoading(true);
    try {
      const payload = await requestWorker<HistoryPayload>(`/jobs/history?feature=image&limit=${HISTORY_LIMIT}`);
      const items = normalizeHistoryItems(payload);
      if (mountedRef.current) setHistory(items);
      return items;
    } catch (historyError) {
      if (mountedRef.current) {
        console.error(historyError);
      }
      return [];
    } finally {
      if (mountedRef.current) setHistoryLoading(false);
    }
  }, []);

  const pollJob = useCallback(async (jobId: string) => {
    if (!jobId || isLocalOnlyJob(jobId)) {
      setSubmitting(false);
      return;
    }

    clearPollTimer();

    try {
      const payload = await requestWorker<JobRecord>(`/jobs/status/${encodeURIComponent(jobId)}`);
      const job = normalizeJobRecord(payload);
      if (!job) {
        throw new Error('Worker job durumu beklenmeyen biçimde döndü.');
      }

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
      const payload = await requestWorker<ModelsPayload>('/models?feature=image&limit=250&sort=price_asc');
      const items = normalizeModelList(payload);

      if (!mountedRef.current) return;

      setModels(items);

      const filtered = items.filter(isImageModel);
      const hasSelectedModel = filtered.some((item: ModelItem) => normalizeText(item.modelId || item.id) === form.modelId);

      if (!hasSelectedModel && filtered.length > 0) {
        const fallback = filtered.find((item: ModelItem) => normalizeText(item.modelId || item.id) === DEFAULT_MODEL_ID) || filtered[0];
        setForm((prev: FormState) => ({ ...prev, modelId: normalizeText(fallback.modelId || fallback.id) }));
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
    void probeWorker();
    void loadModels();
    void loadHistory();

    return () => {
      mountedRef.current = false;
      clearPollTimer();
    };
  }, [clearPollTimer, loadHistory, loadModels, probeWorker]);

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
      const requestBody = {
        prompt: trimmedPrompt,
        modelId: nextForm.modelId,
        model: nextForm.modelId,
        provider: deriveProviderFromModelId(nextForm.modelId, currentModel?.company),
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
          providerHint: deriveProviderFromModelId(nextForm.modelId, currentModel?.company),
        },
      };

      const { body } = await requestWorkerRaw<GeneratePayload>('/generate', {
        method: 'POST',
        body: JSON.stringify(requestBody),
      });

      const rawPayload = isEnvelope<GeneratePayload>(body) && typeof body.data !== 'undefined' ? body.data : body;
      let immediateJob = normalizeGenerateResult(rawPayload, nextForm, trimmedPrompt);

      if (!immediateJob || (!immediateJob.jobId && pickJobImages(immediateJob).length === 0)) {
        const message = isEnvelope<GeneratePayload>(body) ? normalizeText(body.error?.message) : '';
        if (message) {
          throw new Error(normalizeWorkerErrorMessage(message, 200));
        }
      }

      if (!immediateJob) {
        await sleep(700);
        const recentHistory = await loadHistory();
        const matched = recentHistory.find((item: JobRecord) => {
          const samePrompt = normalizeText(item.requestSummary?.prompt || item.requestSummary?.promptPreview) === trimmedPrompt;
          const sameModel = normalizeText(item.request?.modelId || item.request?.model) === nextForm.modelId;
          return samePrompt || sameModel;
        }) || recentHistory[0];

        if (matched) {
          immediateJob = {
            ...matched,
            requestSummary: {
              model: nextForm.modelId,
              prompt: trimmedPrompt,
              promptPreview: trimmedPrompt.slice(0, 160),
            },
            request: {
              ...matched.request,
              model: nextForm.modelId,
              modelId: nextForm.modelId,
              provider: deriveProviderFromModelId(nextForm.modelId, currentModel?.company),
              ratio: nextForm.ratio,
              quality: nextForm.quality,
              style: nextForm.style,
              negativePrompt: nextForm.negativePrompt,
              n: nextForm.n,
            },
          };
        }
      }

      if (!immediateJob) {
        throw new Error('Worker yanıt verdi ama üretim kimliği veya çıktı URL’si bulunamadı. Worker sözleşmesini doğrula.');
      }

      if (!mountedRef.current) return;

      setCurrentJob(immediateJob);
      setLastSubmittedForm({ ...nextForm, prompt: trimmedPrompt });

      if (TERMINAL_STATUSES.has(normalizeText(immediateJob.status)) || isLocalOnlyJob(immediateJob.jobId)) {
        setSubmitting(false);
        void loadHistory();
        return;
      }

      void pollJob(immediateJob.jobId);
    } catch (submitError) {
      setSubmitting(false);
      setError(submitError instanceof Error ? submitError.message : 'Üretim başlatılamadı.');
    }
  }, [clearPollTimer, currentModel?.company, form, loadHistory, pollJob]);

  const cancelJob = useCallback(async () => {
    if (!currentJob?.jobId || isLocalOnlyJob(currentJob.jobId)) return;

    setError('');

    try {
      const cancelled = await requestWorker<JobRecord>('/jobs/cancel', {
        method: 'POST',
        body: JSON.stringify({ jobId: currentJob.jobId }),
      });
      const normalized = normalizeJobRecord(cancelled);
      if (!normalized) {
        throw new Error('İptal cevabı beklenmeyen biçimde döndü.');
      }

      clearPollTimer();
      if (!mountedRef.current) return;
      setCurrentJob(normalized);
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

    setForm((prev: FormState) => ({
      ...prev,
      prompt: prompt || prev.prompt,
      negativePrompt: normalizeText(job.request?.negativePrompt),
      style: normalizeText(job.request?.style),
      ratio: normalizeText(job.request?.ratio, prev.ratio),
      quality: normalizeText(job.request?.quality, prev.quality),
      modelId: modelId || prev.modelId,
      n: clamp(normalizeNumber(job.request?.n, prev.n), 1, 8),
    }));

    if (!TERMINAL_STATUSES.has(normalizeText(job.status)) && !isLocalOnlyJob(job.jobId)) {
      setSubmitting(true);
      void pollJob(job.jobId);
    } else {
      setSubmitting(false);
    }
  }, [clearPollTimer, pollJob]);

  const resetForm = useCallback(() => {
    setForm(initialFormState());
    setError('');
  }, []);

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
            <span style={ui.badge}>Uçlar: {declaredRouteLabel}</span>
            <span style={ui.badge}>Mod: me.puter uyumlu fetch akışı</span>
          </div>
          {workerInfoError && <div style={{ ...ui.errorBox, marginTop: '14px' }}>{workerInfoError}</div>}
          {workerContractWarning && <div style={{ ...ui.infoBox, marginTop: '14px' }}>{workerContractWarning}</div>}
        </section>

        <div style={ui.grid}>
          <section style={ui.card}>
            <div style={ui.cardBody}>
              <h2 style={ui.sectionTitle}>Yeni üretim</h2>

              <div style={ui.formGrid}>
                <label style={ui.labelWrap}>
                  <span style={ui.label}>Prompt</span>
                  <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                    {QUICK_PROMPTS.map((quickPrompt, idx) => (
                      <button
                        key={quickPrompt}
                        type="button"
                        style={{ ...ui.secondaryButton, padding: '8px 10px', fontSize: '12px' }}
                        onClick={() => applyFormPatch({ prompt: quickPrompt })}
                      >
                        Hazır Prompt {idx + 1}
                      </button>
                    ))}
                  </div>
                  <textarea
                    style={ui.textarea}
                    value={form.prompt}
                    onChange={(event: any) => applyFormPatch({ prompt: event.target.value })}
                    placeholder="Örnek: Sisli İstanbul gecesinde neon ışıklı siberpunk tramvay, sinematik kadraj, yüksek detay"
                  />
                </label>

                <label style={ui.labelWrap}>
                  <span style={ui.label}>Negatif prompt</span>
                  <textarea
                    style={{ ...ui.textarea, minHeight: '90px' }}
                    value={form.negativePrompt}
                    onChange={(event: any) => applyFormPatch({ negativePrompt: event.target.value })}
                    placeholder="Örnek: bulanık, düşük kalite, deforme yüz, ekstra kol"
                  />
                </label>

                <div style={ui.row2}>
                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Model</span>
                    <select
                      style={ui.input}
                      value={form.modelId}
                      onChange={(event: any) => applyFormPatch({ modelId: event.target.value })}
                      disabled={modelsLoading}
                    >
                      {modelsLoading && <option value="">Modeller yükleniyor...</option>}
                      {!modelsLoading && imageModels.length === 0 && <option value="">Görsel modeli bulunamadı</option>}
                      {imageModels.map((model: ModelItem) => {
                        const modelId = normalizeText(model.modelId || model.id);
                        const provider = normalizeText(model.provider) || normalizeText(model.company) || deriveProviderFromModelId(modelId, model.company);
                        return (
                          <option key={modelId} value={modelId}>
                            {model.modelName || modelId} {provider ? `· ${provider}` : ''}
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
                      onChange={(event: any) => applyFormPatch({ style: event.target.value })}
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
                      onChange={(event: any) => applyFormPatch({ ratio: event.target.value })}
                    >
                      {RATIO_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                  </label>

                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Kalite</span>
                    <select
                      style={ui.input}
                      value={form.quality}
                      onChange={(event: any) => applyFormPatch({ quality: event.target.value })}
                    >
                      {QUALITY_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
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
                      onChange={(event: any) => applyFormPatch({ n: clamp(normalizeNumber(event.target.value, 1), 1, 8) })}
                    />
                  </label>
                </div>

                <div style={ui.row2}>
                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Guidance</span>
                    <input
                      style={ui.input}
                      value={form.guidance}
                      onChange={(event: any) => applyFormPatch({ guidance: event.target.value })}
                      placeholder="Boş bırakılabilir"
                    />
                  </label>

                  <label style={ui.labelWrap}>
                    <span style={ui.label}>Seed</span>
                    <input
                      style={ui.input}
                      value={form.seed}
                      onChange={(event: any) => applyFormPatch({ seed: event.target.value })}
                      placeholder="Boş bırakılabilir"
                    />
                  </label>
                </div>

                <div style={ui.metricCard}>
                  <p style={ui.metricLabel}>Seçili model özeti</p>
                  <p style={ui.metricValue}>{currentModel?.modelName || 'Model seçilmedi'}</p>
                  <p style={ui.tiny}>Sağlayıcı: {currentModelProvider}</p>
                  <p style={ui.tiny}>Model ID: {currentModel?.modelId || currentModel?.id || form.modelId || '—'}</p>
                  <p style={ui.tiny}>Hız: {currentModel?.speedLabel || '—'} · Fiyat: {currentModel?.imagePrice != null ? `$${currentModel.imagePrice}` : '—'}</p>
                </div>

                {error && <div style={ui.errorBox}>{error}</div>}

                <div style={ui.actions}>
                  <button type="button" style={ui.primaryButton} onClick={() => void submit()} disabled={submitting || modelsLoading}>
                    {submitting ? 'Üretiliyor...' : 'Görsel üret'}
                  </button>
                  <button type="button" style={ui.secondaryButton} onClick={resetForm} disabled={submitting}>
                    Formu temizle
                  </button>
                  <button type="button" style={ui.secondaryButton} onClick={() => void cancelJob()} disabled={!canCancel}>
                    İptal et
                  </button>
                  <button type="button" style={ui.secondaryButton} onClick={() => void retryLast()} disabled={!canRetry}>
                    Tekrar dene
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section style={ui.panelGrid}>
            <section style={ui.card}>
              <div style={ui.cardBody}>
                <h2 style={ui.sectionTitle}>Durum</h2>
                <div style={{ ...ui.badge, background: currentStatusTone.bg, color: currentStatusTone.fg, borderColor: currentStatusTone.border }}>
                  {statusLabel(currentJob?.status)}
                </div>

                <div style={ui.progressWrap}>
                  <div style={ui.progressBar}>
                    <div style={{ ...ui.progressFill, width: `${clamp(normalizeNumber(currentJob?.progress, 0), 0, 100)}%` }} />
                  </div>
                  <p style={ui.tiny}>Adım: {currentJob?.step || '—'} · İlerleme: {clamp(normalizeNumber(currentJob?.progress, 0), 0, 100)}%</p>
                </div>

                <div style={ui.statusGrid}>
                  <div style={ui.metricCard}>
                    <p style={ui.metricLabel}>Job ID</p>
                    <p style={ui.metricValue}>{currentJob?.jobId || '—'}</p>
                  </div>
                  <div style={ui.metricCard}>
                    <p style={ui.metricLabel}>ETA</p>
                    <p style={ui.metricValue}>{formatEta(currentJob?.etaMs)}</p>
                  </div>
                  <div style={ui.metricCard}>
                    <p style={ui.metricLabel}>Model</p>
                    <p style={ui.metricValue}>{currentJob?.requestSummary?.model || form.modelId || '—'}</p>
                  </div>
                  <div style={ui.metricCard}>
                    <p style={ui.metricLabel}>Zaman</p>
                    <p style={ui.metricValue}>{formatDateTime(currentJob?.updatedAt || currentJob?.createdAt)}</p>
                  </div>
                </div>

                {currentJob?.error?.message && <div style={ui.errorBox}>{currentJob.error.message}</div>}
              </div>
            </section>

            <section style={ui.card}>
              <div style={ui.cardBody}>
                <h2 style={ui.sectionTitle}>Çıktılar</h2>
                {activeImages.length === 0 ? (
                  <div style={ui.empty}>Henüz görsel yok. Üretim tamamlandığında burada görünecek.</div>
                ) : (
                  <div style={ui.imageGrid}>
                    {activeImages.map((imageUrl: string) => (
                      <div key={imageUrl} style={ui.imageCard}>
                        <img src={imageUrl} alt="Üretilen görsel" style={ui.image} />
                        <div style={ui.imageMeta}>
                          <a href={imageUrl} target="_blank" rel="noreferrer" style={{ color: '#175cd3', textDecoration: 'none', fontWeight: 600 }}>
                            Görseli aç
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section style={ui.card}>
              <div style={ui.cardBody}>
                <h2 style={ui.sectionTitle}>Geçmiş</h2>
                {historyLoading && <div style={ui.empty}>Geçmiş yükleniyor...</div>}
                {!historyLoading && history.length === 0 && (
                  <div style={ui.empty}>Henüz geçmiş kayıt yok veya worker history ucu veri döndürmedi.</div>
                )}
                {!historyLoading && history.length > 0 && (
                  <div style={ui.historyList}>
                    {history.map((job: JobRecord) => {
                      const tone = statusTone(job.status);
                      return (
                        <button key={job.jobId} type="button" style={ui.historyItem} onClick={() => openHistoryItem(job)}>
                          <div style={ui.historyHeader}>
                            <strong style={{ color: '#101828', textAlign: 'left' }}>{job.requestSummary?.model || job.request?.modelId || 'Model yok'}</strong>
                            <span style={{ ...ui.badge, background: tone.bg, color: tone.fg, borderColor: tone.border }}>
                              {statusLabel(job.status)}
                            </span>
                          </div>
                          <p style={{ ...ui.promptPreview, textAlign: 'left' }}>{job.requestSummary?.promptPreview || job.requestSummary?.prompt || 'Prompt yok'}</p>
                          <p style={{ ...ui.tiny, textAlign: 'left' }}>{formatDateTime(job.updatedAt || job.createdAt)} · {job.jobId}</p>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>
          </section>
        </div>
      </div>
    </div>
  );
}
