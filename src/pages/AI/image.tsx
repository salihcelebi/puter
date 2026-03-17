import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type JobStatus = 'queued' | 'running' | 'storing' | 'processing' | 'completed' | 'failed' | 'cancelled' | 'failed_storage';
type ProviderRegistry = 'openai-image-generation' | 'together' | 'gemini' | 'xai';

type WorkerEnvelope<T> = {
  ok: boolean;
  code: string;
  data: T;
  error?: { message?: string; bullets?: string[]; retryable?: boolean } | null;
  meta?: Record<string, unknown> | null;
};

type WorkerFailure = Error & { envelope?: WorkerEnvelope<unknown>; statusCode?: number };

type TagUi = {
  text?: string;
  bg?: string;
  fg?: string;
  rounded?: string;
};

type TemplateRecord = Record<string, unknown> | null;
type ProfileRecord = Record<string, unknown> | null;
type OverrideRecord = Record<string, unknown> | null;

type JobEvent = {
  at?: string;
  functionName?: string;
  title?: string;
  status?: string;
  message?: string;
  code?: string;
  stage?: string;
  line?: string;
  details?: string[];
  summary?: string;
};

type RawModelItem = {
  id?: string;
  modelId?: string;
  modelName?: string;
  provider?: string;
  providerLabel?: string;
  company?: string;
  displayName?: string;
  categoryRaw?: string;
  badges?: string[];
  imagePrice?: number | null;
  prices?: { image?: number | null; usdPerImage?: number | null };
  speedLabel?: string;
  standoutFeature?: string;
  useCase?: string;
  traits?: string[];
  style?: { accent?: string; brandKey?: string };
  tagUi?: TagUi;
  template?: TemplateRecord;
  profile?: ProfileRecord;
  override?: OverrideRecord;
  [key: string]: unknown;
};

type ModelItem = RawModelItem & {
  displayName: string;
  provider: ProviderRegistry;
  model: string;
  providerLabel: string;
  imagePriceUsd: number | null;
  template: TemplateRecord;
  profile: ProfileRecord;
  override: OverrideRecord;
  tagUi: Required<TagUi>;
};

type ModelsPayload = {
  items?: RawModelItem[];
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
    displayName?: string;
    provider?: string;
    promptPreview?: string;
    ratio?: string;
    quality?: string;
    style?: string;
    negativePromptPreview?: string;
  };
  request?: {
    modelId?: string;
    displayName?: string;
    provider?: string;
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
  storageLogs?: string[];
  events?: JobEvent[];
  error?: {
    message?: string;
    bullets?: string[];
    retryable?: boolean;
  } | null;
};

type HistoryPayload = {
  items?: JobRecord[];
  total?: number;
  limit?: number;
  feature?: string;
};

type RatioObject = { w: number; h: number };

const DEFAULT_MODEL_SOURCE_URL = 'https://im.puter.work/models';
const DEFAULT_IMAGE_WORKER_URL = 'https://im.puter.work';
const POLL_MS = 1800;
const TERMINAL = new Set<JobStatus>(['completed', 'failed', 'cancelled', 'failed_storage']);
const DEFAULT_RATIO: RatioObject = { w: 1024, h: 1024 };
const DEFAULT_QUALITY = 'medium';
const DEFAULT_STYLE = '';
const QUALITY_OPTIONS = ['high', 'medium', 'low'];
const STYLE_OPTIONS = ['', 'vivid', 'natural', 'photorealistic', 'illustration', 'cinematic', 'anime'];
const QUICK_PROMPTS = [
  'Sisli İstanbul sokaklarında yağmur sonrası gece sahnesi, neon yansımalar, sinematik ışık, detaylı mimari, yüksek atmosfer, gerçekçi kompozisyon',
  'Lüks ürün çekimi, yumuşak stüdyo ışığı, siyah arka plan, premium ambalaj, ultra net detay, reklam kalitesi',
  'Anime kahraman, güçlü poz, dinamik saç, parlayan gözler, yüksek kontrast, detaylı kostüm, etkileyici arka plan',
];

function buildUrl(base: string, path: string): string {
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function safeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function safePrice(value: unknown): number | null {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
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
    case 'queued': return 'Sırada';
    case 'running': return 'Çalışıyor';
    case 'storing': return 'Depolanıyor';
    case 'processing': return 'Üretiliyor';
    case 'completed': return 'Tamamlandı';
    case 'failed': return 'Başarısız';
    case 'failed_storage': return 'Depolama hatası';
    case 'cancelled': return 'İptal edildi';
    default: return 'Bilinmiyor';
  }
}

function workerErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'İstek zaman aşımına uğradı.';
  if (error instanceof Error) return error.message || fallback;
  return fallback;
}

function isImageModel(model: RawModelItem): boolean {
  return safeText(model.categoryRaw).toLowerCase() === 'image generation';
}

function normalizeProviderRegistry(rawProvider: unknown, rawModel: unknown): ProviderRegistry {
  const providerText = safeText(rawProvider).toLowerCase();
  const modelText = safeText(rawModel).toLowerCase();

  if (providerText === 'openai-image-generation') return 'openai-image-generation';
  if (providerText === 'together') return 'together';
  if (providerText === 'gemini') return 'gemini';
  if (providerText === 'xai') return 'xai';

  if (modelText.startsWith('openai/')) return 'openai-image-generation';
  if (modelText.startsWith('google/gemini') || modelText.startsWith('google/imagen')) return 'gemini';
  if (modelText.startsWith('black-forest-labs/') || modelText.startsWith('recraft/') || modelText.includes('flux')) return 'together';
  if (modelText.startsWith('xai/') || modelText.includes('grok')) return 'xai';

  return 'openai-image-generation';
}

function buildTemplate(provider: ProviderRegistry, model: string): Record<string, unknown> {
  return {
    prompt: 'zorunlu metin alanı',
    provider,
    model,
    test_mode: false,
    quality: provider === 'openai-image-generation' ? 'medium' : undefined,
    ratio: { ...DEFAULT_RATIO },
  };
}

function buildProfile(provider: ProviderRegistry, model: string): Record<string, unknown> {
  if (model === 'black-forest-labs/flux.1-schnell') {
    return {
      provider: 'together',
      model,
      prompt: 'zorunlu metin alanı',
      test_mode: 'true | false',
      ratio: { ...DEFAULT_RATIO },
      response_format: 'url | b64_json',
    };
  }
  if (model === 'google/imagen-4.0-ultra') {
    return {
      provider: 'gemini',
      model,
      prompt: 'zorunlu metin alanı',
      test_mode: 'true | false',
      ratio: { ...DEFAULT_RATIO },
      response_format: 'url',
    };
  }
  if (model === 'google/gemini-3.1-flash-image-preview' || model === 'google/gemini-3-pro-image') {
    return {
      provider: 'gemini',
      model,
      prompt: 'zorunlu metin alanı',
      test_mode: 'true | false',
      ratio: { ...DEFAULT_RATIO },
      input_image: 'opsiyonel',
      input_image_mime_type: 'opsiyonel',
    };
  }
  return {
    provider,
    model,
    prompt: 'zorunlu metin alanı',
    test_mode: 'true | false',
    ratio: { ...DEFAULT_RATIO },
  };
}

function buildOverride(provider: ProviderRegistry, model: string): Record<string, unknown> {
  if (model === 'black-forest-labs/flux.1-schnell' || model === 'google/imagen-4.0-ultra') {
    return {
      model,
      width: true,
      height: true,
      aspect_ratio: true,
      steps: true,
      seed: true,
      negative_prompt: true,
      n: true,
      image_url: true,
      image_base64: true,
      mask_image_url: true,
      mask_image_base64: true,
      prompt_strength: true,
      disable_safety_checker: true,
      response_format: true,
    };
  }
  if (model === 'google/gemini-3.1-flash-image-preview' || model === 'google/gemini-3-pro-image') {
    return {
      model,
      ratio: true,
      input_image: true,
      input_image_mime_type: true,
    };
  }
  return { provider, model };
}

function normalizeTagUi(raw: TagUi | undefined, rankText: string): Required<TagUi> {
  return {
    text: safeText(raw?.text, safeText(rankText, 'MODEL')),
    bg: safeText(raw?.bg, '#000000'),
    fg: safeText(raw?.fg, '#ffffff'),
    rounded: safeText(raw?.rounded, '9999px'),
  };
}

function normalizeModelFromWorker(raw: RawModelItem): ModelItem {
  const model = safeText(raw.model || raw.modelId || raw.id);
  const provider = normalizeProviderRegistry(raw.provider, model);
  const displayName = safeText(raw.displayName, `${safeText(raw.providerLabel || raw.company || raw.provider, 'Model')} · ${safeText(raw.modelName || model, model)}`);
  const providerLabel = safeText(raw.providerLabel, safeText(raw.company || raw.provider, provider));
  const imagePriceUsd = safePrice(raw.prices?.image ?? raw.prices?.usdPerImage ?? raw.imagePrice);
  const rankText = safeText((raw as { rankTag?: string }).rankTag);

  return {
    ...raw,
    displayName,
    provider,
    providerLabel,
    model,
    imagePriceUsd,
    template: raw.template ?? buildTemplate(provider, model),
    profile: raw.profile ?? buildProfile(provider, model),
    override: raw.override ?? buildOverride(provider, model),
    tagUi: normalizeTagUi(raw.tagUi, rankText),
  };
}

function modelKey(model: ModelItem): string {
  return safeText(model.model);
}

function modelLabel(model: ModelItem): string {
  return safeText(model.displayName, `${model.providerLabel} · ${safeText(model.modelName, model.model)}`);
}

function pickImages(job: JobRecord | null): string[] {
  if (!job) return [];
  const raw = [
    ...normalizeArray<string>(job.outputUrls),
    ...(job.outputUrl ? [job.outputUrl] : []),
  ].filter(Boolean);
  return [...new Set(raw)];
}

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return '{}';
  }
}

function ratioLabelFromObject(ratio: RatioObject): string {
  return `${Math.max(1, ratio.w)}:${Math.max(1, ratio.h)}`;
}

async function readEnvelope<T>(response: Response): Promise<WorkerEnvelope<T>> {
  const text = await response.text();
  if (!text.trim()) {
    throw new Error('Worker boş cevap döndürdü.');
  }
  try {
    return JSON.parse(text) as WorkerEnvelope<T>;
  } catch {
    throw new Error('Worker geçerli JSON döndürmedi.');
  }
}

function workerFailureFromEnvelope<T>(payload: WorkerEnvelope<T>, statusCode: number): WorkerFailure {
  const error = new Error(payload.error?.message || `İstek başarısız oldu (${statusCode}).`) as WorkerFailure;
  error.envelope = payload as WorkerEnvelope<unknown>;
  error.statusCode = statusCode;
  return error;
}

function eventStatusBadge(status?: string): string {
  if (status === 'success') return 'Başarılı';
  if (status === 'error') return 'Hata';
  return safeText(status, 'Olay');
}

function collectFailureBullets(error: unknown): string[] {
  const workerError = error as WorkerFailure;
  return normalizeArray<string>(workerError?.envelope?.error?.bullets);
}

async function requestJson<T>(base: string, path: string, init?: RequestInit, retry = 1): Promise<WorkerEnvelope<T>> {
  let lastError: unknown = null;
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

      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (/<!doctype|<html/i.test(text)) {
        throw new Error('Beklenmeyen HTML yanıtı alındı. Worker veya endpoint yönlendirmesini kontrol edin.');
      }
      if (!contentType.includes('application/json')) {
        throw new Error('JSON beklenirken farklı içerik tipi döndü.');
      }

      let payload: WorkerEnvelope<T>;
      try {
        payload = text ? JSON.parse(text) as WorkerEnvelope<T> : ({ ok: false, code: 'EMPTY_BODY', data: null as unknown as T });
      } catch {
        throw new Error('Worker geçerli JSON döndürmedi.');
      }

      if (!response.ok || payload.ok === false) {
        throw workerFailureFromEnvelope(payload, response.status);
      }
      return payload;
    } catch (error) {
      window.clearTimeout(timer);
      lastError = error;
      if (attempt === retry) break;
      await new Promise((resolve) => window.setTimeout(resolve, 700 * (attempt + 1)));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('İstek başarısız oldu.');
}

export default function ImagePage(): JSX.Element {
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsSource, setModelsSource] = useState('');
  const [modelsLoading, setModelsLoading] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [selectedModelId, setSelectedModelId] = useState('');
  const [ratioObject, setRatioObject] = useState<RatioObject>(DEFAULT_RATIO);
  const [quality, setQuality] = useState(DEFAULT_QUALITY);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [testMode, setTestMode] = useState(false);
  const [count, setCount] = useState(1);
  const [activeJob, setActiveJob] = useState<JobRecord | null>(null);
  const [history, setHistory] = useState<JobRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [errorBullets, setErrorBullets] = useState<string[]>([]);
  const [workerInfo, setWorkerInfo] = useState('');
  const [effectiveConfig, setEffectiveConfig] = useState<any>(null);
  const [modelSourceUrl, setModelSourceUrl] = useState<string>(DEFAULT_MODEL_SOURCE_URL);
  const [imageWorkerUrl, setImageWorkerUrl] = useState<string>(DEFAULT_IMAGE_WORKER_URL);

  const pollRef = useRef<number | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => modelKey(item) === selectedModelId) || null,
    [models, selectedModelId],
  );
  const activeImages = useMemo(() => pickImages(activeJob), [activeJob]);
  const selectedModelCore = useMemo(
    () => selectedModel ? ({ displayName: selectedModel.displayName, provider: selectedModel.provider, model: selectedModel.model }) : null,
    [selectedModel],
  );
  const activeEvents = useMemo(() => normalizeArray<JobEvent>(activeJob?.events), [activeJob]);
  const activeStorageLogs = useMemo(() => normalizeArray<string>(activeJob?.storageLogs), [activeJob]);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);


  const loadEffectiveConfig = useCallback(async () => {
    try {
      const response = await fetch('/api/ai/effective-config/image');
      const text = await response.text();
      const contentType = response.headers.get('content-type') || '';
      if (/<!doctype|<html/i.test(text)) throw new Error('Effective config isteği HTML döndü.');
      if (!contentType.includes('application/json')) throw new Error('Effective config JSON değil.');
      const payload = JSON.parse(text);
      const cfg = payload?.config || null;
      setEffectiveConfig(cfg);
      const resolvedModelSource = String(cfg?.customModelUrl || cfg?.customWorkerUrl || DEFAULT_MODEL_SOURCE_URL);
      const resolvedWorkerUrl = String(cfg?.customWorkerUrl || DEFAULT_IMAGE_WORKER_URL);
      setModelSourceUrl(resolvedModelSource);
      setImageWorkerUrl(resolvedWorkerUrl);
    } catch (error) {
      setModelSourceUrl(DEFAULT_MODEL_SOURCE_URL);
      setImageWorkerUrl(DEFAULT_IMAGE_WORKER_URL);
    }
  }, []);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setError('');
    setErrorBullets([]);
    try {
      const envelope = await requestJson<ModelsPayload>(modelSourceUrl.replace(/\/models\/?$/, ''), '/models?limit=250', undefined, 1);
      const items = normalizeArray<RawModelItem>(envelope.data?.items)
        .filter(isImageModel)
        .map(normalizeModelFromWorker);
      setModels(items);
      setModelsSource(modelSourceUrl);
      setSelectedModelId((current) => current || modelKey(items[0]) || '');
      if (!items.length) {
        setError('Seçilen model kaynağında görsel modeli bulunamadı.');
      }
    } catch (requestError) {
      setError(workerErrorMessage(requestError, 'Modeller alınamadı.'));
      setErrorBullets(collectFailureBullets(requestError));
    } finally {
      setModelsLoading(false);
    }
  }, [modelSourceUrl]);

  const loadWorkerInfo = useCallback(async () => {
    try {
      const envelope = await requestJson<{ worker?: string; version?: string; modelsSource?: string; maxGenerationAttempts?: number }>(imageWorkerUrl, '/', undefined, 0);
      const info = envelope.data || {};
      setWorkerInfo(`${info.worker || 'im'} · v${info.version || '-'} · deneme=${String(info.maxGenerationAttempts ?? '-')}`);
    } catch {
      setWorkerInfo('im worker');
    }
  }, [imageWorkerUrl]);

  const refreshHistory = useCallback(async () => {
    setLoadingHistory(true);
    try {
      const envelope = await requestJson<HistoryPayload>(imageWorkerUrl, '/jobs/history?limit=12', undefined, 0);
      setHistory(Array.isArray(envelope.data?.items) ? envelope.data.items : []);
    } catch (requestError) {
      console.error(requestError);
    } finally {
      setLoadingHistory(false);
    }
  }, [imageWorkerUrl]);

  const ensureImageUrl = useCallback(async (job: JobRecord): Promise<JobRecord> => {
    if (!job.jobId || pickImages(job).length > 0) return job;
    try {
      const envelope = await requestJson<{ outputUrl?: string | null; storageLogs?: string[] }>(imageWorkerUrl, `/jobs/image/${encodeURIComponent(job.jobId)}`, undefined, 0);
      const outputUrl = envelope.data?.outputUrl || null;
      return {
        ...job,
        outputUrl,
        outputUrls: outputUrl ? [outputUrl] : job.outputUrls,
        storageLogs: normalizeArray<string>(envelope.data?.storageLogs).length ? normalizeArray<string>(envelope.data?.storageLogs) : job.storageLogs,
      };
    } catch {
      return job;
    }
  }, [imageWorkerUrl]);

  const pollJob = useCallback(async (jobId: string) => {
    stopPolling();
    try {
      const envelope = await requestJson<JobRecord>(imageWorkerUrl, `/jobs/status/${encodeURIComponent(jobId)}`, undefined, 1);
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
    } catch (requestError) {
      const workerError = requestError as WorkerFailure;
      const failedJob = (workerError?.envelope?.meta as { job?: JobRecord } | undefined)?.job;
      if (failedJob) setActiveJob(failedJob);
      setSubmitting(false);
      setError(workerErrorMessage(requestError, 'Job durumu alınamadı.'));
      setErrorBullets(collectFailureBullets(requestError));
    }
  }, [ensureImageUrl, refreshHistory, stopPolling]);

  useEffect(() => {
    void loadEffectiveConfig().then(() => {
      void loadWorkerInfo();
      void loadModels();
      void refreshHistory();
    });
    return () => stopPolling();
  }, [loadEffectiveConfig, loadModels, loadWorkerInfo, refreshHistory, stopPolling]);

  useEffect(() => {
    if (!selectedModel) return;
    const profile = (selectedModel.profile || {}) as Record<string, unknown>;
    const template = (selectedModel.template || {}) as Record<string, unknown>;
    const ratioCandidate = profile.ratio || template.ratio;
    if (ratioCandidate && typeof ratioCandidate === 'object' && ratioCandidate !== null) {
      const nextRatio = {
        w: Math.max(1, safeNumber((ratioCandidate as RatioObject).w, DEFAULT_RATIO.w)),
        h: Math.max(1, safeNumber((ratioCandidate as RatioObject).h, DEFAULT_RATIO.h)),
      };
      setRatioObject(nextRatio);
    }
    const qualityCandidate = safeText(profile.quality || template.quality || DEFAULT_QUALITY, DEFAULT_QUALITY);
    if (qualityCandidate) {
      setQuality(qualityCandidate);
    }
  }, [selectedModel]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError('Prompt zorunlu.');
      return;
    }
    if (!selectedModel || !selectedModelCore) {
      setError('Model seçmelisin.');
      return;
    }
    stopPolling();
    setSubmitting(true);
    setError('');
    setErrorBullets([]);
    setActiveJob(null);

    try {
      const envelope = await requestJson<JobRecord>(
        imageWorkerUrl,
        '/generate',
        {
          method: 'POST',
          body: JSON.stringify({
            prompt: prompt.trim(),
            negativePrompt: negativePrompt.trim(),
            displayName: selectedModelCore.displayName,
            provider: selectedModelCore.provider,
            model: selectedModelCore.model,
            modelId: selectedModelCore.model,
            selectedModel: selectedModelCore,
            template: selectedModel.template,
            profile: selectedModel.profile,
            override: selectedModel.override,
            ratio: ratioLabelFromObject(ratioObject),
            ratioObject,
            quality,
            style,
            test_mode: testMode,
            n: Math.max(1, Math.min(1, count)),
            responseFormat: 'url',
            metadata: {
              page: 'src/pages/AI/image.tsx',
              modelsSource: modelSourceUrl,
              worker: imageWorkerUrl,
              selectedModelSourceKey: effectiveConfig?.modelSourceKey || 'im',
              selectedModelSourceUrl: modelSourceUrl,
              selectedImageWorkerUrl: imageWorkerUrl,
              tagUi: selectedModel.tagUi,
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
        throw new Error('Worker jobId döndürmedi.');
      }

      await refreshHistory();
      if (TERMINAL.has(nextJob.status)) {
        setSubmitting(false);
        return;
      }
      await pollJob(nextJob.jobId);
    } catch (requestError) {
      const workerError = requestError as WorkerFailure;
      const failedJob = (workerError?.envelope?.meta as { job?: JobRecord } | undefined)?.job;
      if (failedJob) setActiveJob(failedJob);
      setSubmitting(false);
      setError(workerErrorMessage(requestError, 'Görsel üretimi başlatılamadı.'));
      setErrorBullets(collectFailureBullets(requestError));
    }
  }, [count, negativePrompt, pollJob, prompt, quality, ratioObject, refreshHistory, selectedModel, selectedModelCore, stopPolling, style, testMode, imageWorkerUrl, modelSourceUrl, effectiveConfig]);

  const handleCancel = useCallback(async () => {
    if (!activeJob?.jobId || TERMINAL.has(activeJob.status)) return;
    try {
      const envelope = await requestJson<JobRecord>(imageWorkerUrl, '/jobs/cancel', {
        method: 'POST',
        body: JSON.stringify({ jobId: activeJob.jobId }),
      }, 0);
      setActiveJob(envelope.data);
      setError('');
      setErrorBullets([]);
      await refreshHistory();
      void pollJob(activeJob.jobId);
    } catch (requestError) {
      setError(workerErrorMessage(requestError, 'İptal işlemi başarısız oldu.'));
      setErrorBullets(collectFailureBullets(requestError));
    }
  }, [activeJob, refreshHistory, pollJob]);

  const openHistoryJob = useCallback(async (jobId: string) => {
    setError('');
    setErrorBullets([]);
    stopPolling();
    try {
      const envelope = await requestJson<JobRecord>(imageWorkerUrl, `/jobs/status/${encodeURIComponent(jobId)}`, undefined, 0);
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
    } catch (requestError) {
      setError(workerErrorMessage(requestError, 'Geçmiş kaydı açılamadı.'));
      setErrorBullets(collectFailureBullets(requestError));
    }
  }, [ensureImageUrl, pollJob, stopPolling]);

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-6">
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 text-slate-100 shadow-2xl">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold">Görsel Üretim</h1>
            <p className="mt-2 text-sm text-slate-300">
              Model kaynağı: <strong>{modelSourceUrl}</strong> · Üretim worker: <strong>{imageWorkerUrl}</strong>
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Worker: {workerInfo || 'yükleniyor'} · Katalog: {modelsSource || 'yükleniyor'}
            </p>
          </div>
          <div className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-3 text-sm text-slate-200">
            <div>Seçili model: {selectedModel ? selectedModel.displayName : 'yok'}</div>
            <div className="mt-1 text-xs text-slate-400">
              Fiyat: {selectedModel?.imagePriceUsd ?? '-'} USD / görsel
            </div>
            <div className="mt-1 text-xs text-slate-500">Kategori: {selectedModel?.categoryRaw || '-'}</div>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-700 bg-red-950/70 px-4 py-3 text-sm text-red-100">
          <div>{error}</div>
          {errorBullets.length > 0 ? (
            <div className="mt-2 space-y-1 text-xs">
              {errorBullets.map((bullet) => <div key={bullet}>• {bullet}</div>)}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1.1fr,0.9fr]">
        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Üretim ayarları</h2>
          <div className="mt-4 grid gap-4">
            <div className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Hazır promptlar</span>
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => setPrompt(item)}
                    className="rounded-2xl border border-slate-300 bg-white px-3 py-2 text-xs font-medium text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
                  >
                    {item.length > 26 ? `${item.slice(0, 26)}...` : item}
                  </button>
                ))}
              </div>
            </div>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Prompt (zorunlu metin alanı)</span>
              <textarea
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={6}
                className="rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
                placeholder="Örn: sisli İstanbul sokaklarında neon ışıklı sinematik gece sahnesi"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-sm font-medium text-slate-700">Negatif prompt (opsiyonel)</span>
              <textarea
                value={negativePrompt}
                onChange={(e) => setNegativePrompt(e.target.value)}
                rows={3}
                className="rounded-2xl border border-slate-300 px-4 py-3 outline-none ring-0 focus:border-slate-500"
                placeholder="İstenmeyen detaylar"
              />
            </label>

            <div className="grid gap-3">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-700">Modeller</span>
                <span className="text-xs text-slate-500">Worker’dan gelen modeller burada görünür.</span>
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {models.map((item) => {
                  const selected = modelKey(item) === selectedModelId;
                  return (
                    <button
                      key={modelKey(item)}
                      type="button"
                      onClick={() => setSelectedModelId(modelKey(item))}
                      className={`rounded-2xl border p-4 text-left transition ${selected ? 'border-slate-900 bg-slate-50 shadow-sm' : 'border-slate-200 bg-white hover:border-slate-400'}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-slate-900">{item.displayName}</div>
                          <div className="mt-1 text-xs text-slate-500">{item.model}</div>
                        </div>
                        <span
                          className="inline-flex items-center px-3 py-1 text-[11px] font-semibold"
                          style={{
                            backgroundColor: item.tagUi.bg,
                            color: item.tagUi.fg,
                            borderRadius: item.tagUi.rounded,
                          }}
                        >
                          {item.tagUi.text}
                        </span>
                      </div>
                      <div className="mt-3 space-y-1 text-xs text-slate-600">
                        <div>Provider: {item.provider}</div>
                        <div>Fiyat: {item.imagePriceUsd ?? '-'} USD / görsel</div>
                        <div>Hız: {item.speedLabel || '-'}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Test modu (opsiyonel)</span>
                <label className="inline-flex items-center gap-3 rounded-2xl border border-slate-300 px-4 py-3 text-sm text-slate-700">
                  <input type="checkbox" checked={testMode} onChange={(e) => setTestMode(e.target.checked)} />
                  <span>{testMode ? 'true' : 'false'}</span>
                </label>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Kalite (opsiyonel)</span>
                <select value={quality} onChange={(e) => setQuality(e.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3">
                  {QUALITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Oran nesnesi (opsiyonel) · w</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={ratioObject.w}
                  onChange={(e) => setRatioObject((current) => ({ ...current, w: Math.max(1, Number(e.target.value) || 1) }))}
                  className="rounded-2xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Oran nesnesi (opsiyonel) · h</span>
                <input
                  type="number"
                  min={1}
                  step={1}
                  value={ratioObject.h}
                  onChange={(e) => setRatioObject((current) => ({ ...current, h: Math.max(1, Number(e.target.value) || 1) }))}
                  className="rounded-2xl border border-slate-300 px-4 py-3"
                />
              </label>

              <label className="grid gap-2">
                <span className="text-sm font-medium text-slate-700">Stil (opsiyonel)</span>
                <select value={style} onChange={(e) => setStyle(e.target.value)} className="rounded-2xl border border-slate-300 px-4 py-3">
                  {STYLE_OPTIONS.map((item) => <option key={item} value={item}>{item || 'Varsayılan'}</option>)}
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
              <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="font-semibold text-slate-900">Model özeti</div>
                  <span
                    className="inline-flex items-center px-3 py-1 text-[11px] font-semibold"
                    style={{
                      backgroundColor: selectedModel.tagUi.bg,
                      color: selectedModel.tagUi.fg,
                      borderRadius: selectedModel.tagUi.rounded,
                    }}
                  >
                    {selectedModel.tagUi.text}
                  </span>
                </div>
                <div>{selectedModel.standoutFeature || selectedModel.useCase || 'Özel bilgi yok.'}</div>
                <div className="grid gap-2 text-xs text-slate-600 md:grid-cols-2">
                  <div><strong>displayName:</strong> {selectedModel.displayName}</div>
                  <div><strong>provider:</strong> {selectedModel.provider}</div>
                  <div><strong>model:</strong> {selectedModel.model}</div>
                  <div><strong>tagUi:</strong> {selectedModel.tagUi.text}</div>
                </div>
                <div className="grid gap-3 md:grid-cols-3">
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">template</div>
                    <pre className="max-h-64 overflow-auto p-4 text-xs text-slate-800">{prettyJson(selectedModel.template)}</pre>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">profile</div>
                    <pre className="max-h-64 overflow-auto p-4 text-xs text-slate-800">{prettyJson(selectedModel.profile)}</pre>
                  </div>
                  <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <div className="border-b border-slate-200 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">override</div>
                    <pre className="max-h-64 overflow-auto p-4 text-xs text-slate-800">{prettyJson(selectedModel.override)}</pre>
                  </div>
                </div>
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
                disabled={!activeJob || TERMINAL.has(activeJob.status)}
                className="rounded-2xl border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                İptal et
              </button>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-semibold text-slate-900">Aktif iş</h2>
          {activeJob ? (
            <div className="mt-4 space-y-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <span className="font-medium text-slate-700">Durum: {statusText(activeJob.status)}</span>
                  <span className="text-slate-500">Job: {activeJob.jobId}</span>
                </div>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-slate-900 transition-all duration-500" style={{ width: `${Math.max(0, Math.min(100, activeJob.progress || 0))}%` }} />
                </div>
                <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                  <span>{activeJob.step || 'Bekleniyor'}</span>
                  <span>%{Math.max(0, Math.min(100, activeJob.progress || 0))}</span>
                </div>
              </div>

              {activeJob.error?.message ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                  <div>{activeJob.error.message}</div>
                  {Array.isArray(activeJob.error.bullets) && activeJob.error.bullets.length > 0 ? (
                    <div className="mt-3 space-y-1 text-xs">
                      {activeJob.error.bullets.map((bullet) => <div key={bullet}>• {bullet}</div>)}
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

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Aşama günlüğü</div>
                <div className="mt-3 space-y-3">
                  {activeEvents.length === 0 ? (
                    <div className="text-xs text-slate-500">Henüz olay kaydı yok.</div>
                  ) : activeEvents.map((event, index) => (
                    <div key={`${event.at || 'event'}_${index}`} className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="text-xs font-semibold text-slate-900">{event.title || event.functionName || 'Olay'}</div>
                        <div className="flex items-center gap-2">
                          <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${event.status === 'error' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'}`}>
                            {eventStatusBadge(event.status)}
                          </span>
                          <span className="text-[10px] text-slate-400">{formatDate(event.at)}</span>
                        </div>
                      </div>
                      <div className="mt-2 text-xs text-slate-700">{event.summary || event.message || '-'}</div>
                      {event.code ? <div className="mt-2 text-[11px] text-slate-500">Kod: {event.code}</div> : null}
                      {normalizeArray<string>(event.details).length > 0 ? (
                        <div className="mt-2 space-y-1 text-[11px] text-slate-500">
                          {normalizeArray<string>(event.details).map((detail) => <div key={detail}>• {detail}</div>)}
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-sm font-semibold text-slate-900">Storage step log</div>
                <div className="mt-3 space-y-2">
                  {activeStorageLogs.length === 0 ? (
                    <div className="text-xs text-slate-500">Henüz storage log kaydı yok.</div>
                  ) : activeStorageLogs.map((line, index) => (
                    <pre key={`${line}_${index}`} className="overflow-x-auto rounded-xl bg-slate-950 p-3 text-[11px] text-emerald-300">{line}</pre>
                  ))}
                </div>
              </div>

              {activeJob.storage?.path ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-xs text-slate-600">
                  <div>Storage path: {activeJob.storage.path}</div>
                  {activeJob.storage.storageRoot ? <div>Storage root: {activeJob.storage.storageRoot}</div> : null}
                  {activeJob.storage.attemptedPath ? <div>Attempted path: {activeJob.storage.attemptedPath}</div> : null}
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
          <button type="button" onClick={() => void refreshHistory()} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700">
            Yenile
          </button>
        </div>
        <div className="mt-4 grid gap-3">
          {loadingHistory ? (
            <div className="text-sm text-slate-500">Geçmiş yükleniyor...</div>
          ) : history.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">Henüz kayıt yok.</div>
          ) : history.map((item) => (
            <button
              key={item.jobId}
              type="button"
              onClick={() => void openHistoryJob(item.jobId)}
              className="grid gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-slate-400 hover:bg-white"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-800">{statusText(item.status)}</span>
                <span className="text-xs text-slate-500">{formatDate(item.updatedAt || item.createdAt)}</span>
              </div>
              <div className="text-sm text-slate-700">{item.requestSummary?.promptPreview || 'Prompt kaydı yok'}</div>
              <div className="text-xs text-slate-500">{item.requestSummary?.displayName || item.requestSummary?.model || item.request?.modelId || '-'}</div>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

/* YÖNETİCİ BU SAYFADA GÖRÜNEN OPSİYONEL ALANLARI TÜRKÇE OLARAK İLERİDE GÖSTERMEK İSTEDİĞİ ZAMAN AŞAĞIDAKİ SAYFA ÜZERİNDEN BUNLARI AYARLAYABİLMELİDİR: src/pages/Admin/Model-Gizle-Goster.tsx */
