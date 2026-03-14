// src/pages/AI/image1.tsx
// Bu dosya generate, polling, cancel, retry, timeout ve geçmiş mantığını tek hookta toplar.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const IMAGE_WORKER_ENDPOINT = 'https://image.puter.work/generate';
const JOB_STATUS_BASE_URL = 'https://is-durumu.puter.work';
const HISTORY_STORAGE_KEY = 'nisai:image-job-history:v1';
const DEFAULT_POLL_INTERVAL_MS = 1500;
const DEFAULT_CREATE_TIMEOUT_MS = 30000;
const DEFAULT_HARD_TIMEOUT_MS = 120000;
const MAX_HISTORY_ITEMS = 20;

export type ImageJobStatus =
  | 'idle'
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'not_found';

export type ImageAttachmentInput = {
  name: string;
  file: File;
  fieldName?: string;
};

export type ImageJobInput = {
  prompt: string;
  model: string;
  modelId?: string;
  ratio?: string;
  size?: string;
  quality?: string;
  n?: number;
  style?: string;
  seed?: number | null;
  negativePrompt?: string;
  guidance?: number | null;
  responseFormat?: 'url' | 'base64' | 'binary';
  timeoutMs?: number;
  stream?: boolean;
  testMode?: boolean;
  metadata?: Record<string, unknown>;
  attachments?: ImageAttachmentInput[];
  clientRequestId?: string;
};

export type ImageHistoryItem = {
  jobId: string | null;
  status: ImageJobStatus;
  createdAt: string;
  model: string;
  promptPreview: string;
  firstImageUrl: string | null;
  resultUrls: string[];
  errorMessage: string | null;
};

type ImageJobRecord = {
  jobId?: string;
  status?: ImageJobStatus;
  feature?: string;
  progress?: number;
  step?: string;
  queuePosition?: number | null;
  etaMs?: number | null;
  outputUrl?: string | null;
  outputUrls?: string[];
  url?: string;
  urls?: string[];
  images?: Array<{ url?: string }>;
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
    details?: unknown;
  } | null;
  retryable?: boolean;
  cancelRequested?: boolean;
  requestSummary?: {
    model?: string;
    prompt?: string;
    promptPreview?: string;
  };
  createdAt?: string;
  updatedAt?: string;
  finishedAt?: string | null;
  job?: Record<string, unknown>;
};

type WorkerEnvelope<T> = {
  ok?: boolean;
  code?: string;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    retryable?: boolean;
    details?: unknown;
  } | null;
  status?: number;
};

type UseImageJobOptions = {
  pollIntervalMs?: number;
  hardTimeoutMs?: number;
  createTimeoutMs?: number;
  statusBaseUrl?: string;
  generateEndpoint?: string;
};

type UseImageJobReturn = {
  isGenerating: boolean;
  currentJobId: string | null;
  jobStatus: ImageJobStatus;
  progress: number;
  step: string;
  queuePosition: number | null;
  etaMs: number | null;
  resultUrls: string[];
  errorMessage: string;
  retryable: boolean;
  cancelRequested: boolean;
  history: ImageHistoryItem[];
  cancelSupported: boolean;
  startJob: (input: ImageJobInput) => Promise<void>;
  pollJob: (jobId: string) => Promise<void>;
  cancelJob: (jobId?: string) => Promise<void>;
  retryLastJob: () => Promise<void>;
  loadHistory: () => Promise<void>;
  clearError: () => void;
  resetJobState: () => void;
};

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function safeNumber(value: unknown, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function clampProgress(value: unknown, fallback = 0) {
  const n = safeNumber(value, fallback);
  return Math.max(0, Math.min(100, Math.round(n)));
}

function safeString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function getErrorMessage(error: unknown, fallback = 'Beklenmeyen hata oluştu.') {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === 'string' && error.trim()) return error.trim();
  return fallback;
}

function normalizeUrls(payload: unknown): string[] {
  const out = new Set<string>();

  const visit = (value: unknown) => {
    if (!value) return;

    if (typeof value === 'string' && value.trim()) {
      const trimmed = value.trim();
      if (trimmed.startsWith('http://') || trimmed.startsWith('https://') || trimmed.startsWith('data:')) {
        out.add(trimmed);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }

    if (typeof value === 'object') {
      const item = value as Record<string, unknown>;
      visit(item.url);
      visit(item.urls);
      visit(item.outputUrl);
      visit(item.outputUrls);
      visit(item.image);
      visit(item.images);
      visit(item.data);
    }
  };

  visit(payload);
  return [...out];
}

function readLocalHistory(): ImageHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalHistory(items: ImageHistoryItem[]) {
  try {
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(items.slice(0, MAX_HISTORY_ITEMS)));
  } catch {
    // ignore
  }
}

function pushLocalHistory(item: ImageHistoryItem) {
  const current = readLocalHistory();
  const next = [item, ...current.filter((x) => !(x.jobId && x.jobId === item.jobId))].slice(0, MAX_HISTORY_ITEMS);
  writeLocalHistory(next);
  return next;
}

function buildHistoryItem(args: {
  jobId: string | null;
  status: ImageJobStatus;
  input: ImageJobInput | null;
  resultUrls: string[];
  errorMessage: string | null;
}): ImageHistoryItem {
  return {
    jobId: args.jobId,
    status: args.status,
    createdAt: new Date().toISOString(),
    model: args.input?.model || args.input?.modelId || '',
    promptPreview: safeString(args.input?.prompt || '').slice(0, 160),
    firstImageUrl: args.resultUrls[0] || null,
    resultUrls: args.resultUrls,
    errorMessage: args.errorMessage,
  };
}

function extractJobPayload(raw: unknown): ImageJobRecord {
  if (!raw || typeof raw !== 'object') return {};
  const root = raw as Record<string, unknown>;

  if (root.data && typeof root.data === 'object') {
    const data = root.data as Record<string, unknown>;
    if (data.job && typeof data.job === 'object') {
      return { ...(data.job as ImageJobRecord), ...(data as ImageJobRecord) };
    }
    return data as ImageJobRecord;
  }

  if (root.job && typeof root.job === 'object') {
    return { ...(root.job as ImageJobRecord), ...(root as ImageJobRecord) };
  }

  return root as ImageJobRecord;
}

async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  timeoutMs = DEFAULT_CREATE_TIMEOUT_MS,
): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(input, {
      ...init,
      signal: controller.signal,
    });

    const contentType = (response.headers.get('content-type') || '').toLowerCase();
    const rawText = await response.text();
    const trimmed = rawText.trim();

    if (!contentType.includes('application/json')) {
      if (trimmed.startsWith('<')) {
        throw new Error('Servis JSON yerine HTML döndürdü.');
      }
      throw new Error(trimmed || 'Servis JSON olmayan yanıt döndürdü.');
    }

    let json: T;
    try {
      json = JSON.parse(rawText) as T;
    } catch {
      throw new Error('Servis bozuk JSON döndürdü.');
    }

    if (!response.ok) {
      const maybeEnvelope = json as unknown as WorkerEnvelope<unknown>;
      throw new Error(maybeEnvelope?.error?.message || trimmed || `HTTP ${response.status}`);
    }

    return json;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error('İstek zaman aşımına uğradı.');
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function buildFormData(input: ImageJobInput) {
  const formData = new FormData();

  formData.set('prompt', input.prompt.trim());
  formData.set('model', input.model);
  formData.set('modelId', input.modelId || input.model);
  formData.set('ratio', input.ratio || '1:1');
  formData.set('quality', input.quality || 'high');
  formData.set('n', String(input.n || 4));
  formData.set('responseFormat', input.responseFormat || 'url');
  formData.set('clientRequestId', input.clientRequestId || createId('image'));
  formData.set('mode', 'async');
  formData.set('async', 'true');
  formData.set('returnJob', 'true');

  if (input.size) formData.set('size', input.size);
  if (input.style) formData.set('style', input.style);
  if (typeof input.seed === 'number') formData.set('seed', String(input.seed));
  if (typeof input.guidance === 'number') formData.set('guidance', String(input.guidance));
  if (input.negativePrompt) formData.set('negativePrompt', input.negativePrompt);
  if (typeof input.timeoutMs === 'number') formData.set('timeoutMs', String(input.timeoutMs));
  if (typeof input.stream === 'boolean') formData.set('stream', String(input.stream));
  if (typeof input.testMode === 'boolean') formData.set('testMode', String(input.testMode));

  formData.set(
    'metadata',
    JSON.stringify({
      page: 'imagegen',
      source: 'frontend',
      ...(input.metadata || {}),
    }),
  );

  (input.attachments || []).forEach((attachment, index) => {
    const fieldName = attachment.fieldName || (index === 0 ? 'reference' : `attachment_${index}`);
    formData.append(fieldName, attachment.file, attachment.name);
  });

  return formData;
}

export function useImageGenerationJob(options: UseImageJobOptions = {}): UseImageJobReturn {
  const pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const hardTimeoutMs = options.hardTimeoutMs ?? DEFAULT_HARD_TIMEOUT_MS;
  const createTimeoutMs = options.createTimeoutMs ?? DEFAULT_CREATE_TIMEOUT_MS;
  const statusBaseUrl = options.statusBaseUrl ?? JOB_STATUS_BASE_URL;
  const generateEndpoint = options.generateEndpoint ?? IMAGE_WORKER_ENDPOINT;

  const [isGenerating, setIsGenerating] = useState(false);
  const [currentJobId, setCurrentJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<ImageJobStatus>('idle');
  const [progress, setProgress] = useState(0);
  const [step, setStep] = useState('');
  const [queuePosition, setQueuePosition] = useState<number | null>(null);
  const [etaMs, setEtaMs] = useState<number | null>(null);
  const [resultUrls, setResultUrls] = useState<string[]>([]);
  const [errorMessage, setErrorMessage] = useState('');
  const [retryable, setRetryable] = useState(false);
  const [cancelRequested, setCancelRequested] = useState(false);
  const [history, setHistory] = useState<ImageHistoryItem[]>(() => readLocalHistory());
  const [cancelSupported, setCancelSupported] = useState(true);

  const pollTimerRef = useRef<number | null>(null);
  const hardTimeoutRef = useRef<number | null>(null);
  const lastInputRef = useRef<ImageJobInput | null>(null);
  const activePollJobIdRef = useRef<string | null>(null);

  const clearTimers = useCallback(() => {
    if (pollTimerRef.current) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
    if (hardTimeoutRef.current) {
      window.clearTimeout(hardTimeoutRef.current);
      hardTimeoutRef.current = null;
    }
  }, []);

  const clearError = useCallback(() => {
    setErrorMessage('');
  }, []);

  const resetJobState = useCallback(() => {
    clearTimers();
    setIsGenerating(false);
    setCurrentJobId(null);
    setJobStatus('idle');
    setProgress(0);
    setStep('');
    setQueuePosition(null);
    setEtaMs(null);
    setResultUrls([]);
    setErrorMessage('');
    setRetryable(false);
    setCancelRequested(false);
    activePollJobIdRef.current = null;
  }, [clearTimers]);

  const appendHistory = useCallback((item: ImageHistoryItem) => {
    const next = pushLocalHistory(item);
    setHistory(next);
  }, []);

  const loadHistory = useCallback(async () => {
    try {
      const url = new URL('/jobs/history', statusBaseUrl);
      url.searchParams.set('feature', 'image');
      url.searchParams.set('limit', String(MAX_HISTORY_ITEMS));

      const response = await fetch(url.toString(), { method: 'GET' });
      if (!response.ok) {
        setHistory(readLocalHistory());
        return;
      }

      const json = await response.json();
      const items = Array.isArray(json?.items)
        ? json.items.map((item: any) => ({
            jobId: item.jobId || null,
            status: (item.status || 'idle') as ImageJobStatus,
            createdAt: item.createdAt || new Date().toISOString(),
            model: item.requestSummary?.model || '',
            promptPreview: item.requestSummary?.promptPreview || item.requestSummary?.prompt || '',
            firstImageUrl: item.outputUrls?.[0] || item.outputUrl || null,
            resultUrls: Array.isArray(item.outputUrls) ? item.outputUrls : item.outputUrl ? [item.outputUrl] : [],
            errorMessage: item.error?.message || null,
          }))
        : readLocalHistory();

      setHistory(items);
    } catch {
      setHistory(readLocalHistory());
    }
  }, [statusBaseUrl]);

  const applyJobPayload = useCallback((payload: ImageJobRecord) => {
    const resolvedStatus = (payload.status || 'idle') as ImageJobStatus;
    const urls = normalizeUrls(payload);

    setCurrentJobId(payload.jobId || null);
    setJobStatus(resolvedStatus);
    setProgress(
      resolvedStatus === 'completed'
        ? 100
        : clampProgress(payload.progress, resolvedStatus === 'processing' ? 15 : 0),
    );
    setStep(safeString(payload.step, resolvedStatus));
    setQueuePosition(
      payload.queuePosition === null || payload.queuePosition === undefined
        ? null
        : safeNumber(payload.queuePosition, null as unknown as number),
    );
    setEtaMs(
      payload.etaMs === null || payload.etaMs === undefined
        ? null
        : safeNumber(payload.etaMs, null as unknown as number),
    );
    setResultUrls(urls);
    setRetryable(Boolean(payload.retryable || payload.error?.retryable));
    setCancelRequested(Boolean(payload.cancelRequested));
    setErrorMessage(payload.error?.message || '');
    setIsGenerating(resolvedStatus === 'queued' || resolvedStatus === 'processing');
  }, []);

  const finalizeTerminalState = useCallback(
    (status: ImageJobStatus, payload?: ImageJobRecord, customError?: string | null) => {
      clearTimers();
      const urls = normalizeUrls(payload || {});
      setIsGenerating(false);
      setJobStatus(status);
      if (status === 'completed') setProgress(100);

      const historyItem = buildHistoryItem({
        jobId: payload?.jobId || currentJobId,
        status,
        input: lastInputRef.current,
        resultUrls: urls.length > 0 ? urls : resultUrls,
        errorMessage: customError ?? payload?.error?.message ?? (errorMessage || null),
      });

      appendHistory(historyItem);
    },
    [appendHistory, clearTimers, currentJobId, errorMessage, resultUrls],
  );

  const pollJob = useCallback(
    async (jobId: string) => {
      if (!jobId.trim()) return;

      clearTimers();
      activePollJobIdRef.current = jobId;
      setCurrentJobId(jobId);
      setIsGenerating(true);

      const hardStop = window.setTimeout(() => {
        setIsGenerating(false);
        setJobStatus('failed');
        setRetryable(true);
        setErrorMessage('İş zaman aşımına uğradı.');
        finalizeTerminalState('failed', { jobId, status: 'failed', error: { message: 'İş zaman aşımına uğradı.', retryable: true } }, 'İş zaman aşımına uğradı.');
      }, hardTimeoutMs);

      hardTimeoutRef.current = hardStop;

      const tick = async () => {
        try {
          const url = new URL(`/jobs/status/${encodeURIComponent(jobId)}`, statusBaseUrl);
          const json = await fetchJson<WorkerEnvelope<ImageJobRecord> | ImageJobRecord>(
            url.toString(),
            { method: 'GET', headers: { Accept: 'application/json' } },
            Math.min(pollIntervalMs + 5000, 10000),
          );

          const payload = extractJobPayload(json);
          const status = (payload.status || 'idle') as ImageJobStatus;

          applyJobPayload({ ...payload, jobId });

          if (status === 'completed') {
            finalizeTerminalState('completed', { ...payload, jobId, status: 'completed' });
            return;
          }

          if (status === 'failed') {
            finalizeTerminalState('failed', { ...payload, jobId, status: 'failed' });
            return;
          }

          if (status === 'cancelled') {
            finalizeTerminalState('cancelled', { ...payload, jobId, status: 'cancelled' });
            return;
          }

          pollTimerRef.current = window.setTimeout(tick, pollIntervalMs);
        } catch (error) {
          setIsGenerating(false);
          setJobStatus('failed');
          setRetryable(true);
          setErrorMessage(getErrorMessage(error, 'Job durumu alınamadı.'));
          finalizeTerminalState(
            'failed',
            {
              jobId,
              status: 'failed',
              error: {
                message: getErrorMessage(error, 'Job durumu alınamadı.'),
                retryable: true,
              },
            },
            getErrorMessage(error, 'Job durumu alınamadı.'),
          );
        }
      };

      await tick();
    },
    [applyJobPayload, clearTimers, finalizeTerminalState, hardTimeoutMs, pollIntervalMs, statusBaseUrl],
  );

  const startJob = useCallback(
    async (input: ImageJobInput) => {
      const trimmedPrompt = safeString(input.prompt);
      if (!trimmedPrompt) {
        throw new Error('Talimat alanı boş olamaz.');
      }

      clearTimers();
      clearError();
      lastInputRef.current = input;
      setResultUrls([]);
      setCurrentJobId(null);
      setJobStatus('queued');
      setProgress(0);
      setStep('queued');
      setQueuePosition(null);
      setEtaMs(null);
      setRetryable(false);
      setCancelRequested(false);
      setIsGenerating(true);

      try {
        const formData = buildFormData(input);
        const json = await fetchJson<WorkerEnvelope<ImageJobRecord> | ImageJobRecord>(
          generateEndpoint,
          {
            method: 'POST',
            body: formData,
          },
          Math.min(input.timeoutMs || createTimeoutMs, createTimeoutMs),
        );

        const payload = extractJobPayload(json);
        const maybeJobId = safeString(payload.jobId);
        const immediateUrls = normalizeUrls(payload);

        if (maybeJobId) {
          applyJobPayload({
            ...payload,
            jobId: maybeJobId,
            status: (payload.status || 'queued') as ImageJobStatus,
          });
          await pollJob(maybeJobId);
          return;
        }

        if (immediateUrls.length > 0) {
          setCurrentJobId(null);
          setJobStatus('completed');
          setProgress(100);
          setStep('completed');
          setResultUrls(immediateUrls);
          setIsGenerating(false);
          appendHistory(
            buildHistoryItem({
              jobId: null,
              status: 'completed',
              input,
              resultUrls: immediateUrls,
              errorMessage: null,
            }),
          );
          return;
        }

        throw new Error('Servis ne jobId ne de kullanılabilir görsel URL döndürdü.');
      } catch (error) {
        setIsGenerating(false);
        setJobStatus('failed');
        setRetryable(true);
        setErrorMessage(getErrorMessage(error, 'Görsel üretme işlemi başarısız oldu.'));
        appendHistory(
          buildHistoryItem({
            jobId: null,
            status: 'failed',
            input,
            resultUrls: [],
            errorMessage: getErrorMessage(error, 'Görsel üretme işlemi başarısız oldu.'),
          }),
        );
        throw error;
      }
    },
    [appendHistory, applyJobPayload, clearError, clearTimers, createTimeoutMs, generateEndpoint, pollJob],
  );

  const cancelJob = useCallback(
    async (jobId?: string) => {
      const targetJobId = safeString(jobId || currentJobId || '');
      if (!targetJobId) {
        throw new Error('İptal edilecek jobId bulunamadı.');
      }

      try {
        const json = await fetchJson<WorkerEnvelope<Record<string, unknown>> | Record<string, unknown>>(
          `${statusBaseUrl}/jobs/cancel`,
          {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ jobId: targetJobId }),
          },
          10000,
        );

        const maybeEnvelope = json as WorkerEnvelope<Record<string, unknown>>;
        const error = maybeEnvelope?.error?.message;

        if (error && /kurulmadı|desteklenmiyor|not supported|501/i.test(error)) {
          setCancelSupported(false);
          setErrorMessage('Backend tarafında gerçek cancel henüz aktif değil.');
          return;
        }

        setCancelRequested(true);
        setStep('cancel_requested');
      } catch (error) {
        const message = getErrorMessage(error, 'İptal isteği gönderilemedi.');
        if (/501|desteklenmiyor|kurulmadı/i.test(message)) {
          setCancelSupported(false);
          setErrorMessage('Backend tarafında gerçek cancel henüz aktif değil.');
          return;
        }
        setErrorMessage(message);
        throw error;
      }
    },
    [currentJobId, statusBaseUrl],
  );

  const retryLastJob = useCallback(async () => {
    if (!lastInputRef.current) {
      throw new Error('Tekrar denenecek son istek bulunamadı.');
    }
    await startJob(lastInputRef.current);
  }, [startJob]);

  useEffect(() => {
    return () => {
      clearTimers();
    };
  }, [clearTimers]);

  const value = useMemo<UseImageJobReturn>(
    () => ({
      isGenerating,
      currentJobId,
      jobStatus,
      progress,
      step,
      queuePosition,
      etaMs,
      resultUrls,
      errorMessage,
      retryable,
      cancelRequested,
      history,
      cancelSupported,
      startJob,
      pollJob,
      cancelJob,
      retryLastJob,
      loadHistory,
      clearError,
      resetJobState,
    }),
    [
      isGenerating,
      currentJobId,
      jobStatus,
      progress,
      step,
      queuePosition,
      etaMs,
      resultUrls,
      errorMessage,
      retryable,
      cancelRequested,
      history,
      cancelSupported,
      startJob,
      pollJob,
      cancelJob,
      retryLastJob,
      loadHistory,
      clearError,
      resetJobState,
    ],
  );

  return value;
}

export default useImageGenerationJob;

/*
IMAGEGEN.TSX İÇİNE EKLENECEK KULLANIM ÖZETİ

1) import:
import useImageGenerationJob from './image1';

2) component içinde:
const {
  isGenerating,
  currentJobId,
  jobStatus,
  progress,
  step,
  queuePosition,
  etaMs,
  resultUrls,
  errorMessage,
  retryable,
  history,
  startJob,
  cancelJob,
  retryLastJob,
  loadHistory,
  clearError,
} = useImageGenerationJob();

3) mevcut handleGenerate yerine:
await startJob({
  prompt,
  model: selectedModel.modelId,
  modelId: selectedModel.modelId,
  ratio: activeRatio,
  quality: 'high',
  n: 4,
  style: activeStyle,
  timeoutMs: 120000,
  metadata: {
    page: 'imagegen',
    source: 'frontend',
    selectedProvider: selectedModel.provider,
  },
  attachments: attachments.map((item, index) => ({
    name: item.name,
    file: item.file,
    fieldName: index === 0 ? 'reference' : `attachment_${index}`,
  })),
});

4) resultUrls değişince mevcut generatedPages yapına bas:
useEffect(() => {
  if (resultUrls.length === 0) return;
  const nextCards = buildBaseCards(1);
  resultUrls.slice(0, 4).forEach((url, index) => {
    nextCards[index] = {
      id: createId('generated'),
      src: url,
      alt: `Uretilen gorsel ${index + 1}`,
      overlay: index === 0 ? 'Yeni sonuç' : 'Daha fazla',
    };
  });
  setGeneratedPages((prev) => ({ ...prev, 1: nextCards }));
  setCurrentPage(1);
}, [resultUrls]);

5) UI'de göster:
- jobStatus
- progress
- step
- queuePosition
- currentJobId
- errorMessage
- retry button
- cancel button
- history list
*/
