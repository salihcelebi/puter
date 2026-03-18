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
  model?: string;
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
const QUALITY_OPTIONS = ['high', 'medium', 'low'] as const;
const STYLE_OPTIONS = ['', 'vivid', 'natural', 'photorealistic', 'illustration', 'cinematic', 'anime'] as const;

const QUICK_PROMPTS = [
  'Sisli İstanbul sokaklarında yağmur sonrası gece sahnesi, neon yansımalar, sinematik ışık, detaylı mimari, yüksek atmosfer, gerçekçi kompozisyon',
  'Lüks ürün çekimi, yumuşak stüdyo ışığı, siyah arka plan, premium ambalaj, ultra net detay, reklam kalitesi',
  'Anime kahraman, güçlü poz, dinamik saç, parlayan gözler, yüksek kontrast, detaylı kostüm, etkileyici arka plan',
] as const;

const PAGE_DATA: Record<number, Array<{ image: string; title: string; tags: string[] }>> = {
  1: [
    {
      image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
      title: 'Sinematik gece kompozisyonu',
      tags: ['1 görsel', 'Prompt', 'OpenAI'],
    },
    {
      image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      title: 'Ürün reklamı premium mock',
      tags: ['Reklam', 'Makro', 'Together'],
    },
    {
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
      title: 'Cyberpunk karakter portresi',
      tags: ['Anime', 'Poster', 'Gemini'],
    },
    {
      image: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80',
      title: 'Dikey sosyal medya kapak görseli',
      tags: ['9:16', 'Sosyal', 'xAI'],
    },
  ],
  2: [
    {
      image: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80',
      title: 'Dağ manzarası reklam afişi',
      tags: ['Doğa', 'Poster', 'OpenAI'],
    },
    {
      image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
      title: 'Kurumsal tanıtım hero görseli',
      tags: ['Kurumsal', '4:5', 'Gemini'],
    },
    {
      image: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=1200&q=80',
      title: 'Gün batımı editorial kare',
      tags: ['16:9', 'Editorial', 'Together'],
    },
    {
      image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80',
      title: 'Moda çekimi sosyal görseli',
      tags: ['Sosyal', '4:5', 'OpenAI'],
    },
  ],
  3: [
    {
      image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
      title: 'Masaüstü ürün mock sahnesi',
      tags: ['Ürün', 'Minimal', 'Together'],
    },
    {
      image: 'https://images.unsplash.com/photo-1493246318656-5bfd4cfb29b8?auto=format&fit=crop&w=1200&q=80',
      title: 'Fantastik şehir illüstrasyonu',
      tags: ['Anime', 'Konsept', 'Gemini'],
    },
    {
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
      title: 'Tipografi güçlü lansman kapağı',
      tags: ['Tipografi', 'Poster', 'OpenAI'],
    },
    {
      image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
      title: 'Belgesel stil şehir karesi',
      tags: ['Belgesel', 'Gerçekçi', 'xAI'],
    },
  ],
  4: [
    {
      image: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1200&q=80',
      title: 'Kış manzarası sinematik key art',
      tags: ['Sinematik', 'Doğa', 'OpenAI'],
    },
    {
      image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
      title: 'Müzik lansman kapak sahnesi',
      tags: ['Müzik', 'Poster', 'Gemini'],
    },
    {
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      title: 'Uzay temalı atmosferik art',
      tags: ['Konsept', '10/10', 'Together'],
    },
    {
      image: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=80',
      title: 'Sosyal içerik kapak düzeni',
      tags: ['Sosyal', '4:5', 'xAI'],
    },
  ],
};

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

function pickImages(job: JobRecord | null): string[] {
  if (!job) return [];
  const raw = [...normalizeArray<string>(job.outputUrls), ...(job.outputUrl ? [job.outputUrl] : [])].filter(Boolean);
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
        payload = text ? (JSON.parse(text) as WorkerEnvelope<T>) : ({ ok: false, code: 'EMPTY_BODY', data: null as unknown as T });
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

  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const modelWrapRef = useRef<HTMLDivElement | null>(null);
  const pollRef = useRef<number | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => modelKey(item) === selectedModelId) || null,
    [models, selectedModelId],
  );

  const activeImages = useMemo(() => pickImages(activeJob), [activeJob]);
  const activeEvents = useMemo(() => normalizeArray<JobEvent>(activeJob?.events), [activeJob]);
  const activeStorageLogs = useMemo(() => normalizeArray<string>(activeJob?.storageLogs), [activeJob]);

  const selectedModelCore = useMemo(
    () => (selectedModel ? ({ displayName: selectedModel.displayName, provider: selectedModel.provider, model: selectedModel.model }) : null),
    [selectedModel],
  );

  const previewCards = useMemo(() => {
    const base = PAGE_DATA[currentPage] || PAGE_DATA[1];
    if (activeImages.length === 0 || currentPage !== 1) return base;
    const mapped = [...base];
    activeImages.slice(0, 4).forEach((src, index) => {
      mapped[index] = {
        image: src,
        title: index === 0 ? 'Yeni oluşturulan görsel' : `Üretilen görsel ${index + 1}`,
        tags: [
          ratioLabelFromObject(ratioObject),
          quality,
          selectedModel?.providerLabel || selectedModel?.provider || 'Model',
        ],
      };
    });
    return mapped;
  }, [activeImages, currentPage, quality, ratioObject, selectedModel]);

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
    } catch {
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
      const items = normalizeArray<RawModelItem>(envelope.data?.items).filter(isImageModel).map(normalizeModelFromWorker);
      setModels(items);
      setModelsSource(modelSourceUrl);
      setSelectedModelId((current) => current || modelKey(items[0]) || '');
      if (!items.length) setError('Seçilen model kaynağında görsel modeli bulunamadı.');
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

  const ensureImageUrl = useCallback(
    async (job: JobRecord): Promise<JobRecord> => {
      if (!job.jobId || pickImages(job).length > 0) return job;
      try {
        const envelope = await requestJson<{ outputUrl?: string | null; storageLogs?: string[] }>(
          imageWorkerUrl,
          `/jobs/image/${encodeURIComponent(job.jobId)}`,
          undefined,
          0,
        );
        const outputUrl = envelope.data?.outputUrl || null;
        return {
          ...job,
          outputUrl,
          outputUrls: outputUrl ? [outputUrl] : job.outputUrls,
          storageLogs: normalizeArray<string>(envelope.data?.storageLogs).length
            ? normalizeArray<string>(envelope.data?.storageLogs)
            : job.storageLogs,
        };
      } catch {
        return job;
      }
    },
    [imageWorkerUrl],
  );

  const pollJob = useCallback(
    async (jobId: string) => {
      stopPolling();
      try {
        const envelope = await requestJson<JobRecord>(imageWorkerUrl, `/jobs/status/${encodeURIComponent(jobId)}`, undefined, 1);
        let nextJob = envelope.data;
        if (nextJob.status === 'completed') nextJob = await ensureImageUrl(nextJob);
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
    },
    [ensureImageUrl, imageWorkerUrl, refreshHistory, stopPolling],
  );

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
    if (qualityCandidate) setQuality(qualityCandidate);
  }, [selectedModel]);

  useEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) return;
    textarea.style.height = '56px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [prompt, negativePrompt]);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!modelWrapRef.current) return;
      if (!modelWrapRef.current.contains(event.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

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

      if (!nextJob.jobId) throw new Error('Worker jobId döndürmedi.');

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
  }, [
    count,
    effectiveConfig,
    imageWorkerUrl,
    modelSourceUrl,
    negativePrompt,
    pollJob,
    prompt,
    quality,
    ratioObject,
    refreshHistory,
    selectedModel,
    selectedModelCore,
    stopPolling,
    style,
    testMode,
  ]);

  const handleCancel = useCallback(async () => {
    if (!activeJob?.jobId || TERMINAL.has(activeJob.status)) return;
    try {
      const envelope = await requestJson<JobRecord>(
        imageWorkerUrl,
        '/jobs/cancel',
        {
          method: 'POST',
          body: JSON.stringify({ jobId: activeJob.jobId }),
        },
        0,
      );
      setActiveJob(envelope.data);
      setError('');
      setErrorBullets([]);
      await refreshHistory();
      void pollJob(activeJob.jobId);
    } catch (requestError) {
      setError(workerErrorMessage(requestError, 'İptal işlemi başarısız oldu.'));
      setErrorBullets(collectFailureBullets(requestError));
    }
  }, [activeJob, imageWorkerUrl, pollJob, refreshHistory]);

  const openHistoryJob = useCallback(
    async (jobId: string) => {
      setError('');
      setErrorBullets([]);
      stopPolling();
      try {
        const envelope = await requestJson<JobRecord>(imageWorkerUrl, `/jobs/status/${encodeURIComponent(jobId)}`, undefined, 0);
        let nextJob = envelope.data;
        if (nextJob.status === 'completed') nextJob = await ensureImageUrl(nextJob);
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
    },
    [ensureImageUrl, imageWorkerUrl, pollJob, stopPolling],
  );

  return (
    <>
      <style>{`
        :root {
          --panel: #ffffff;
          --line: #e6e8ed;
          --line-soft: #edf0f4;
          --text: #202123;
          --muted: #6b7280;
          --muted-2: #8a909c;
          --green: #5c8f88;
          --green-dark: #4f827b;
          --green-soft: #eef6f4;
          --chip: #f3f4f7;
          --shadow: 0 12px 32px rgba(15, 23, 42, 0.05);
          --shadow-soft: 0 6px 18px rgba(15, 23, 42, 0.04);
        }

        * { box-sizing: border-box; }
        html, body { height: 100%; }

        .app-shell {
          margin: 0;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: radial-gradient(circle at top, #f7f7f8 0%, #f1f3f5 44%, #edf0f3 100%);
          color: var(--text);
          padding: 20px;
          min-height: 100vh;
        }

        .app {
          max-width: 1380px;
          min-height: calc(100vh - 40px);
          margin: 0 auto;
          background: var(--panel);
          border: 1px solid #e8eaee;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: var(--shadow);
          display: flex;
          flex-direction: column;
        }

        .topbar {
          min-height: 80px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 28px;
          background: rgba(255,255,255,0.95);
          gap: 20px;
        }

        .brand {
          font-size: 28px;
          font-weight: 900;
          letter-spacing: 0.2px;
          color: #1f2937;
          min-width: 160px;
        }

        .nav {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 28px;
          padding-left: 8px;
          flex-wrap: wrap;
        }

        .nav a {
          position: relative;
          text-decoration: none;
          color: #3b4452;
          font-size: 18px;
          font-weight: 500;
          padding: 25px 0 23px;
        }

        .nav a.active {
          font-weight: 700;
          color: #202123;
        }

        .nav a.active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 4px;
          border-radius: 999px 999px 0 0;
          background: rgba(92, 143, 136, 0.92);
        }

        .top-right {
          display: flex;
          align-items: center;
          gap: 14px;
          margin-left: auto;
        }

        .status {
          height: 40px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #f8f9fb;
          color: #4b5563;
          font-size: 15px;
          font-weight: 600;
          padding: 0 16px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          white-space: nowrap;
        }

        .status::before {
          content: "";
          width: 10px;
          height: 10px;
          border-radius: 50%;
          background: #9ab8b2;
          box-shadow: 0 0 0 3px rgba(154, 184, 178, 0.15);
        }

        .icon-ghost {
          width: 40px;
          height: 40px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #f8f9fb;
          color: #6b7280;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
        }

        .page {
          display: flex;
          flex-direction: column;
          min-height: 0;
          flex: 1;
          background: linear-gradient(180deg, #f9fafb 0%, #f7f7f8 100%);
        }

        .toolbar {
          border-bottom: 1px solid var(--line-soft);
          padding: 14px 28px 16px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          background: rgba(255,255,255,0.42);
        }

        .toolbar-row {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 18px;
          flex-wrap: wrap;
        }

        .toolbar-label {
          font-size: 18px;
          font-weight: 700;
          color: #202123;
          white-space: nowrap;
        }

        .pill-track {
          display: inline-flex;
          align-items: center;
          gap: 0;
          background: #f2f4f7;
          border: 1px solid #e5e7eb;
          border-radius: 999px;
          overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.7);
          flex-wrap: wrap;
        }

        .pill {
          min-height: 46px;
          padding: 0 22px;
          border: none;
          background: transparent;
          color: #3d4653;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          border-right: 1px solid #e5e7eb;
          white-space: nowrap;
        }

        .pill:last-child { border-right: none; }

        .pill.active {
          background: rgba(92, 143, 136, 0.13);
          color: var(--green-dark);
          font-weight: 700;
        }

        .mode-pills .pill,
        .ratio-pills .pill,
        .duration-pills .pill,
        .sort-pills .pill,
        .quality-pills .pill {
          min-height: 42px;
          padding: 0 18px;
          font-size: 15px;
        }

        .mode-pills .pill.active,
        .ratio-pills .pill.active,
        .duration-pills .pill.active,
        .sort-pills .pill.active,
        .quality-pills .pill.active {
          background: linear-gradient(180deg, #7ea9a3 0%, #5c8f88 100%);
          color: #ffffff;
        }

        .hero {
          padding: 20px 28px 10px;
          display: flex;
          flex-direction: column;
          gap: 14px;
        }

        .hero-card {
          border: 1px solid #dbe0e8;
          background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
          border-radius: 28px;
          padding: 18px 18px 16px;
          box-shadow: 0 10px 24px rgba(17, 24, 39, 0.04);
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .prompt-top {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: center;
        }

        .composer {
          min-height: 110px;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          border: 1px solid #d8dce4;
          background: #ffffff;
          border-radius: 24px;
          padding: 14px 14px 12px 16px;
          box-shadow: 0 2px 8px rgba(17, 24, 39, 0.03);
        }

        .composer-main {
          flex: 1;
          display: flex;
          flex-direction: column;
          gap: 10px;
          min-width: 0;
        }

        .composer textarea {
          width: 100%;
          resize: none;
          border: none;
          background: transparent;
          outline: none;
          font: inherit;
          font-size: 21px;
          line-height: 1.5;
          color: var(--text);
          min-height: 56px;
          max-height: 220px;
          padding: 4px 0;
        }

        .composer textarea::placeholder {
          color: #7f8795;
        }

        .mini-field {
          width: 100%;
          resize: none;
          border: 1px solid #e1e5ea;
          background: #f8fafc;
          outline: none;
          font: inherit;
          font-size: 14px;
          line-height: 1.5;
          color: var(--text);
          min-height: 56px;
          border-radius: 18px;
          padding: 12px 14px;
        }

        .mini-field::placeholder {
          color: #8b919b;
        }

        .composer-tools {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-top: 4px;
        }

        .round-icon {
          width: 46px;
          height: 46px;
          border-radius: 999px;
          border: 1px solid #e0e3e8;
          background: #f7f8fa;
          color: #8b919b;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          flex: 0 0 auto;
        }

        .generate {
          min-width: 200px;
          min-height: 64px;
          padding: 0 24px;
          border-radius: 999px;
          border: 1px solid #9ab8b2;
          background: linear-gradient(180deg, #6d9b95 0%, #5c8f88 100%);
          color: #ffffff;
          font-size: 20px;
          font-weight: 800;
          box-shadow: 0 14px 30px rgba(92, 143, 136, 0.2);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          cursor: pointer;
          white-space: nowrap;
        }

        .generate:disabled {
          opacity: 0.65;
          cursor: not-allowed;
        }

        .cancel-btn {
          min-width: 160px;
          min-height: 54px;
          padding: 0 20px;
          border-radius: 999px;
          border: 1px solid #d1d5db;
          background: #ffffff;
          color: #1f2937;
          font-size: 16px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          white-space: nowrap;
        }

        .cancel-btn:disabled {
          opacity: 0.55;
          cursor: not-allowed;
        }

        .hero-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .subhint {
          color: #555d6b;
          font-size: 16px;
          line-height: 1.5;
        }

        .model-select-wrap {
          position: relative;
          display: inline-flex;
          align-items: center;
        }

        .model-select {
          min-height: 54px;
          padding: 0 18px 0 20px;
          border: 1px solid #9ab8b2;
          background: linear-gradient(180deg, #6d9b95 0%, #5c8f88 100%);
          color: #ffffff;
          font-size: 17px;
          font-weight: 800;
          border-radius: 18px;
          display: inline-flex;
          align-items: center;
          gap: 12px;
          box-shadow: 0 14px 30px rgba(92, 143, 136, 0.2);
          cursor: pointer;
          white-space: nowrap;
        }

        .model-menu {
          position: absolute;
          top: calc(100% + 10px);
          right: 0;
          min-width: 320px;
          max-height: 340px;
          overflow-y: auto;
          border-radius: 18px;
          border: 1px solid #dfe5ea;
          background: #ffffff;
          box-shadow: 0 20px 42px rgba(15, 23, 42, 0.12);
          padding: 10px;
          display: none;
          z-index: 30;
        }

        .model-select-wrap.open .model-menu { display: block; }

        .model-option {
          width: 100%;
          min-height: 52px;
          border: none;
          background: transparent;
          border-radius: 14px;
          padding: 10px 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          text-align: left;
          cursor: pointer;
          font-size: 15px;
          font-weight: 700;
          color: #1f2937;
        }

        .model-option:hover,
        .model-option.active { background: #f5f8f7; }

        .model-option-text {
          display: flex;
          flex-direction: column;
          gap: 3px;
          min-width: 0;
        }

        .model-option-name {
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .model-option-meta {
          font-size: 12px;
          font-weight: 600;
          color: #6b7280;
        }

        .model-option-speed {
          font-size: 12px;
          font-weight: 800;
          color: #48635e;
          white-space: nowrap;
        }

        .detail-filters {
          display: flex;
          flex-wrap: wrap;
          gap: 12px 14px;
          align-items: center;
          justify-content: center;
        }

        .filter-group {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          flex-wrap: wrap;
        }

        .mini-label {
          font-size: 15px;
          font-weight: 700;
          color: #2a2f39;
          white-space: nowrap;
        }

        .error-box {
          margin: 0 28px;
          border: 1px solid #fca5a5;
          background: #fff1f2;
          color: #991b1b;
          border-radius: 18px;
          padding: 14px 16px;
        }

        .error-bullets {
          margin-top: 8px;
          font-size: 12px;
          display: grid;
          gap: 4px;
        }

        .suggestions {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 14px;
        }

        .suggestion {
          min-height: 58px;
          border-radius: 22px;
          border: 1px solid #e6e8ed;
          background: linear-gradient(180deg, #fafafa 0%, #f3f3f5 100%);
          box-shadow: var(--shadow-soft);
          padding: 0 18px;
          display: flex;
          align-items: center;
          gap: 12px;
          color: #303643;
          font-size: 16px;
          font-weight: 500;
          cursor: pointer;
          text-align: left;
        }

        .media-grid {
          padding: 6px 28px 20px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .card {
          position: relative;
          aspect-ratio: 16 / 11;
          border-radius: 18px;
          overflow: hidden;
          box-shadow: var(--shadow-soft);
          background: linear-gradient(135deg, #dfe6ea, #c7d2db);
        }

        .card img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }

        .card-gradient {
          position: absolute;
          inset: auto 0 0 0;
          height: 52%;
          background: linear-gradient(180deg, rgba(0,0,0,0) 0%, rgba(16,24,40,0.68) 100%);
        }

        .play-badge {
          position: absolute;
          left: 14px;
          top: 14px;
          width: 44px;
          height: 44px;
          border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.5);
          background: rgba(255,255,255,0.18);
          backdrop-filter: blur(10px);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          color: #ffffff;
        }

        .media-meta {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #ffffff;
        }

        .media-title {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.35;
        }

        .media-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .media-tag {
          min-height: 28px;
          padding: 0 10px;
          border-radius: 999px;
          background: rgba(255,255,255,0.18);
          border: 1px solid rgba(255,255,255,0.22);
          backdrop-filter: blur(8px);
          font-size: 12px;
          font-weight: 700;
          display: inline-flex;
          align-items: center;
        }

        .details-grid {
          padding: 0 28px 22px;
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 16px;
        }

        .detail-panel {
          border: 1px solid #e5e7eb;
          background: #ffffff;
          border-radius: 22px;
          box-shadow: var(--shadow-soft);
          padding: 18px;
        }

        .detail-title {
          font-size: 18px;
          font-weight: 800;
          color: #1f2937;
          margin-bottom: 12px;
        }

        .progress-box {
          border: 1px solid #e5e7eb;
          background: #f8fafc;
          border-radius: 18px;
          padding: 14px;
        }

        .progress-bar {
          margin-top: 10px;
          height: 10px;
          border-radius: 999px;
          background: #e5e7eb;
          overflow: hidden;
        }

        .progress-bar > div {
          height: 100%;
          border-radius: 999px;
          background: linear-gradient(180deg, #7ea9a3 0%, #5c8f88 100%);
          transition: width .35s ease;
        }

        .log-list {
          display: grid;
          gap: 10px;
        }

        .log-card {
          border: 1px solid #e5e7eb;
          background: #f8fafc;
          border-radius: 16px;
          padding: 12px;
        }

        .storage-line {
          background: #0f172a;
          color: #86efac;
          border-radius: 14px;
          padding: 10px 12px;
          overflow-x: auto;
          font-size: 11px;
        }

        .json-box {
          border: 1px solid #e5e7eb;
          background: #f8fafc;
          border-radius: 18px;
          overflow: hidden;
        }

        .json-head {
          border-bottom: 1px solid #e5e7eb;
          padding: 10px 14px;
          font-size: 11px;
          font-weight: 800;
          color: #6b7280;
          text-transform: uppercase;
          letter-spacing: .08em;
        }

        .json-box pre {
          margin: 0;
          padding: 14px;
          font-size: 11px;
          color: #0f172a;
          max-height: 240px;
          overflow: auto;
        }

        .footer-row {
          padding: 0 28px 22px;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .pagination-block {
          display: inline-flex;
          align-items: center;
          gap: 14px;
        }

        .pagination-label {
          font-size: 18px;
          font-weight: 700;
          color: #2a2f39;
          white-space: nowrap;
        }

        .pagination {
          display: inline-flex;
          align-items: center;
          border: 1px solid #e5e7eb;
          background: #f3f4f7;
          border-radius: 22px;
          overflow: hidden;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.65);
        }

        .page-btn,
        .page-arrow {
          min-width: 56px;
          height: 52px;
          border: none;
          background: transparent;
          color: #475163;
          font-size: 20px;
          font-weight: 600;
          cursor: pointer;
          border-right: 1px solid #e5e7eb;
        }

        .page-btn:last-child,
        .page-arrow:last-child { border-right: none; }

        .page-btn.active {
          background: linear-gradient(180deg, #7ea9a3 0%, #5c8f88 100%);
          color: #ffffff;
          font-weight: 800;
          min-width: 52px;
          border-radius: 14px;
          margin: 5px;
          height: 42px;
          border-right: none;
        }

        @media (max-width: 1280px) {
          .media-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .suggestions { grid-template-columns: 1fr; }
          .details-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 980px) {
          .app-shell { padding: 10px; }
          .app { min-height: calc(100vh - 20px); }
          .topbar {
            padding: 16px;
            align-items: flex-start;
            flex-direction: column;
          }
          .nav { gap: 18px; }
          .toolbar, .hero, .media-grid, .footer-row, .details-grid { padding-left: 16px; padding-right: 16px; }
          .prompt-top { grid-template-columns: 1fr; }
          .hero-meta { flex-direction: column; align-items: flex-start; }
          .generate, .cancel-btn { width: 100%; }
        }

        @media (max-width: 760px) {
          .media-grid { grid-template-columns: 1fr; }
          .toolbar-row, .detail-filters { justify-content: flex-start; }
          .pagination-block { flex-direction: column; align-items: flex-start; }
          .model-select-wrap, .model-select { width: 100%; }
          .model-select { justify-content: center; }
          .composer { flex-direction: column; align-items: stretch; }
          .composer-tools { justify-content: flex-start; flex-wrap: wrap; }
        }
      `}</style>

      <div className="app-shell">
        <div className="app">
          <header className="topbar">
            <div className="brand">NISAI</div>

            <nav className="nav" aria-label="Ana menü">
              <a href="/sohbet">Sohbet</a>
              <a href="/gorsel" className="active">Görsel Üretim</a>
              <a href="/video">Video</a>
              <a href="/tts">Ses (TTS)</a>
              <a href="/ai-katalog">Ai Katalog</a>
              <a href="/blog">Blog</a>
            </nav>

            <div className="top-right">
              <div className="status">Sistem çevrimiçi</div>
              <button className="icon-ghost" aria-label="Diğer seçenekler" type="button">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <circle cx="5" cy="12" r="2"></circle>
                  <circle cx="12" cy="12" r="2"></circle>
                  <circle cx="19" cy="12" r="2"></circle>
                </svg>
              </button>
            </div>
          </header>

          <main className="page">
            <section className="toolbar">
              <div className="toolbar-row">
                <div className="toolbar-label">Kalite</div>
                <div className="pill-track quality-pills">
                  {QUALITY_OPTIONS.map((item) => (
                    <button
                      key={item}
                      type="button"
                      className={`pill ${quality === item ? 'active' : ''}`}
                      onClick={() => setQuality(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>

              <div className="toolbar-row">
                <div ref={modelWrapRef} className={`model-select-wrap ${modelMenuOpen ? 'open' : ''}`}>
                  <button
                    className="model-select"
                    type="button"
                    aria-expanded={modelMenuOpen}
                    onClick={() => setModelMenuOpen((prev) => !prev)}
                  >
                    <span>{selectedModel ? selectedModel.displayName : modelsLoading ? 'Model yükleniyor' : 'Model seçimi'}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </button>

                  <div className="model-menu">
                    {modelsLoading && (
                      <button className="model-option active" type="button" disabled>
                        Model yükleniyor...
                      </button>
                    )}

                    {!modelsLoading && models.length === 0 && (
                      <button className="model-option active" type="button" disabled>
                        Görsel modeli bulunamadı
                      </button>
                    )}

                    {!modelsLoading &&
                      models.map((item) => {
                        const active = modelKey(item) === selectedModelId;
                        return (
                          <button
                            key={modelKey(item)}
                            className={`model-option ${active ? 'active' : ''}`}
                            type="button"
                            onClick={() => {
                              setSelectedModelId(modelKey(item));
                              setModelMenuOpen(false);
                            }}
                          >
                            <div className="model-option-text">
                              <span className="model-option-name">{item.displayName}</span>
                              <span className="model-option-meta">
                                {item.provider} • {item.imagePriceUsd ?? '-'} USD / görsel
                              </span>
                            </div>
                            <span className="model-option-speed" style={{ color: item.style?.accent || '#48635e' }}>
                              {item.speedLabel || item.providerLabel}
                            </span>
                          </button>
                        );
                      })}
                  </div>
                </div>

                <div className="pill-track sort-pills">
                  {STYLE_OPTIONS.map((item) => (
                    <button
                      key={item || 'default-style'}
                      type="button"
                      className={`pill ${style === item ? 'active' : ''}`}
                      onClick={() => setStyle(item)}
                    >
                      {item || 'Varsayılan'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="detail-filters">
                <div className="filter-group">
                  <div className="mini-label">Oran</div>
                  <div className="pill-track ratio-pills">
                    {[
                      { label: '1:1', w: 1024, h: 1024 },
                      { label: '16:9', w: 1600, h: 900 },
                      { label: '9:16', w: 900, h: 1600 },
                      { label: '4:5', w: 1200, h: 1500 },
                    ].map((item) => (
                      <button
                        key={item.label}
                        type="button"
                        className={`pill ${ratioObject.w === item.w && ratioObject.h === item.h ? 'active' : ''}`}
                        onClick={() => setRatioObject({ w: item.w, h: item.h })}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="filter-group">
                  <div className="mini-label">Test Modu</div>
                  <div className="pill-track mode-pills">
                    <button type="button" className={`pill ${!testMode ? 'active' : ''}`} onClick={() => setTestMode(false)}>
                      Kapalı
                    </button>
                    <button type="button" className={`pill ${testMode ? 'active' : ''}`} onClick={() => setTestMode(true)}>
                      Açık
                    </button>
                  </div>
                </div>

                <div className="filter-group">
                  <div className="mini-label">Adet</div>
                  <div className="pill-track duration-pills">
                    <button type="button" className="pill active">
                      {Math.max(1, Math.min(1, count))} görsel
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {error ? (
              <div className="error-box">
                <div>{error}</div>
                {errorBullets.length > 0 && (
                  <div className="error-bullets">
                    {errorBullets.map((bullet) => (
                      <div key={bullet}>• {bullet}</div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}

            <section className="hero">
              <div className="hero-card">
                <div className="prompt-top">
                  <div className="composer">
                    <div className="composer-main">
                      <textarea
                        ref={promptRef}
                        rows={1}
                        placeholder="Görsel talimatını yaz. Stil, kalite, oran ve negatif prompt ile sonucu yönlendir."
                        value={prompt}
                        onChange={(e) => setPrompt(e.target.value)}
                      />
                      <textarea
                        className="mini-field"
                        rows={2}
                        placeholder="Negatif prompt (opsiyonel)"
                        value={negativePrompt}
                        onChange={(e) => setNegativePrompt(e.target.value)}
                      />
                    </div>

                    <div className="composer-tools">
                      <button className="round-icon" type="button" aria-label="Bilgi">
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"></circle>
                          <path d="M12 10v5M12 7.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                        </svg>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 12 }}>
                    <button className="generate" type="button" onClick={() => void handleGenerate()} disabled={submitting || modelsLoading}>
                      {submitting ? 'Görsel Hazırlanıyor' : 'Görsel Oluştur'}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
                      </svg>
                    </button>

                    <button
                      className="cancel-btn"
                      type="button"
                      onClick={() => void handleCancel()}
                      disabled={!activeJob || TERMINAL.has(activeJob.status)}
                    >
                      İptal Et
                    </button>
                  </div>
                </div>

                <div className="hero-meta">
                  <div className="subhint">
                    Model kaynağı: <strong>{modelSourceUrl}</strong> · Üretim worker: <strong>{imageWorkerUrl}</strong>. Worker: {workerInfo || 'yükleniyor'} · Katalog: {modelsSource || 'yükleniyor'}.
                    {selectedModel ? ` Seçili model: ${selectedModel.displayName} · ${selectedModel.provider} · ${selectedModel.imagePriceUsd ?? '-'} USD / görsel.` : ''}
                  </div>
                </div>
              </div>

              <div className="suggestions">
                {QUICK_PROMPTS.map((item) => (
                  <button key={item} className="suggestion" type="button" onClick={() => setPrompt(item)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M12 3c3.3 0 6 2.7 6 6 0 2.1-1 3.6-2.2 4.8-.8.8-1.2 1.4-1.3 2.2H9.5c-.1-.8-.5-1.4-1.3-2.2C7 12.6 6 11.1 6 9c0-3.3 2.7-6 6-6Z" stroke="currentColor" strokeWidth="1.8"></path>
                      <path d="M9.5 18h5M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
                    </svg>
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="media-grid">
              {previewCards.map((item, index) => (
                <article key={`${item.title}_${index}`} className="card">
                  <img src={item.image} alt={item.title} />
                  <div className="play-badge">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M8 6.5v11l9-5.5-9-5.5Z"></path>
                    </svg>
                  </div>
                  <div className="card-gradient"></div>
                  <div className="media-meta">
                    <div className="media-title">{item.title}</div>
                    <div className="media-tags">
                      {item.tags.map((tag) => (
                        <span key={`${item.title}_${tag}`} className="media-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </article>
              ))}
            </section>

            <section className="details-grid">
              <div className="detail-panel">
                <div className="detail-title">Aktif İş</div>

                {activeJob ? (
                  <div style={{ display: 'grid', gap: 14 }}>
                    <div className="progress-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14 }}>
                        <span><strong>Durum:</strong> {statusText(activeJob.status)}</span>
                        <span style={{ color: '#64748b' }}>Job: {activeJob.jobId}</span>
                      </div>
                      <div className="progress-bar">
                        <div style={{ width: `${Math.max(0, Math.min(100, activeJob.progress || 0))}%` }} />
                      </div>
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                        <span>{activeJob.step || 'Bekleniyor'}</span>
                        <span>%{Math.max(0, Math.min(100, activeJob.progress || 0))}</span>
                      </div>
                    </div>

                    {activeJob.error?.message ? (
                      <div className="error-box" style={{ margin: 0 }}>
                        <div>{activeJob.error.message}</div>
                        {Array.isArray(activeJob.error.bullets) && activeJob.error.bullets.length > 0 && (
                          <div className="error-bullets">
                            {activeJob.error.bullets.map((bullet) => (
                              <div key={bullet}>• {bullet}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ) : null}

                    {activeImages.length > 0 ? (
                      <div style={{ display: 'grid', gap: 12 }}>
                        {activeImages.map((src) => (
                          <img
                            key={src}
                            src={src}
                            alt="Üretilen görsel"
                            style={{ width: '100%', borderRadius: 18, border: '1px solid #e5e7eb', display: 'block' }}
                          />
                        ))}
                      </div>
                    ) : (
                      <div className="progress-box" style={{ textAlign: 'center', color: '#64748b' }}>
                        Görsel hazır olduğunda burada görünecek.
                      </div>
                    )}

                    {activeJob.storage?.path ? (
                      <div className="progress-box" style={{ fontSize: 12, color: '#64748b' }}>
                        <div>Storage path: {activeJob.storage.path}</div>
                        {activeJob.storage.storageRoot ? <div>Storage root: {activeJob.storage.storageRoot}</div> : null}
                        {activeJob.storage.attemptedPath ? <div>Attempted path: {activeJob.storage.attemptedPath}</div> : null}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="progress-box" style={{ textAlign: 'center', color: '#64748b' }}>
                    Henüz aktif iş yok.
                  </div>
                )}
              </div>

              <div className="detail-panel">
                <div className="detail-title">Model ve Log Detayı</div>

                {selectedModel ? (
                  <div style={{ display: 'grid', gap: 12 }}>
                    <div className="progress-box" style={{ fontSize: 14 }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 10 }}>
                        <strong>{selectedModel.displayName}</strong>
                        <span
                          style={{
                            backgroundColor: selectedModel.tagUi.bg,
                            color: selectedModel.tagUi.fg,
                            borderRadius: selectedModel.tagUi.rounded,
                            padding: '4px 10px',
                            fontSize: 11,
                            fontWeight: 700,
                          }}
                        >
                          {selectedModel.tagUi.text}
                        </span>
                      </div>
                      <div style={{ color: '#64748b', fontSize: 13 }}>
                        {selectedModel.standoutFeature || selectedModel.useCase || 'Özel bilgi yok.'}
                      </div>
                    </div>

                    <div className="json-box">
                      <div className="json-head">template</div>
                      <pre>{prettyJson(selectedModel.template)}</pre>
                    </div>

                    <div className="json-box">
                      <div className="json-head">profile</div>
                      <pre>{prettyJson(selectedModel.profile)}</pre>
                    </div>

                    <div className="json-box">
                      <div className="json-head">override</div>
                      <pre>{prettyJson(selectedModel.override)}</pre>
                    </div>
                  </div>
                ) : (
                  <div className="progress-box" style={{ textAlign: 'center', color: '#64748b' }}>
                    Model seçildiğinde detay burada görünür.
                  </div>
                )}
              </div>
            </section>

            <section className="details-grid" style={{ paddingTop: 0 }}>
              <div className="detail-panel">
                <div className="detail-title">Aşama Günlüğü</div>
                <div className="log-list">
                  {activeEvents.length === 0 ? (
                    <div className="progress-box" style={{ color: '#64748b' }}>Henüz olay kaydı yok.</div>
                  ) : (
                    activeEvents.map((event, index) => (
                      <div key={`${event.at || 'event'}_${index}`} className="log-card">
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#111827' }}>
                            {event.title || event.functionName || 'Olay'}
                          </div>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span
                              style={{
                                borderRadius: 999,
                                padding: '4px 8px',
                                fontSize: 10,
                                fontWeight: 700,
                                background: event.status === 'error' ? '#fee2e2' : '#dcfce7',
                                color: event.status === 'error' ? '#b91c1c' : '#15803d',
                              }}
                            >
                              {eventStatusBadge(event.status)}
                            </span>
                            <span style={{ fontSize: 10, color: '#94a3b8' }}>{formatDate(event.at)}</span>
                          </div>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 12, color: '#475569' }}>
                          {event.summary || event.message || '-'}
                        </div>
                        {event.code ? <div style={{ marginTop: 6, fontSize: 11, color: '#64748b' }}>Kod: {event.code}</div> : null}
                        {normalizeArray<string>(event.details).length > 0 && (
                          <div style={{ marginTop: 8, display: 'grid', gap: 4, fontSize: 11, color: '#64748b' }}>
                            {normalizeArray<string>(event.details).map((detail) => (
                              <div key={detail}>• {detail}</div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="detail-panel">
                <div className="detail-title">Storage Step Log</div>
                <div className="log-list">
                  {activeStorageLogs.length === 0 ? (
                    <div className="progress-box" style={{ color: '#64748b' }}>Henüz storage log kaydı yok.</div>
                  ) : (
                    activeStorageLogs.map((line, index) => (
                      <pre key={`${line}_${index}`} className="storage-line">{line}</pre>
                    ))
                  )}
                </div>
              </div>
            </section>

            <section className="details-grid" style={{ paddingTop: 0 }}>
              <div className="detail-panel" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
                  <div className="detail-title" style={{ marginBottom: 0 }}>Geçmiş</div>
                  <button type="button" className="cancel-btn" style={{ minHeight: 46, minWidth: 120 }} onClick={() => void refreshHistory()}>
                    Yenile
                  </button>
                </div>

                <div className="log-list">
                  {loadingHistory ? (
                    <div className="progress-box" style={{ color: '#64748b' }}>Geçmiş yükleniyor...</div>
                  ) : history.length === 0 ? (
                    <div className="progress-box" style={{ color: '#64748b' }}>Henüz kayıt yok.</div>
                  ) : (
                    history.map((item) => (
                      <button
                        key={item.jobId}
                        type="button"
                        onClick={() => void openHistoryJob(item.jobId)}
                        className="log-card"
                        style={{ textAlign: 'left', cursor: 'pointer' }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                          <span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{statusText(item.status)}</span>
                          <span style={{ fontSize: 12, color: '#64748b' }}>{formatDate(item.updatedAt || item.createdAt)}</span>
                        </div>
                        <div style={{ marginTop: 8, fontSize: 13, color: '#334155' }}>
                          {item.requestSummary?.promptPreview || 'Prompt kaydı yok'}
                        </div>
                        <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                          {item.requestSummary?.displayName || item.requestSummary?.model || item.request?.modelId || '-'}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              </div>
            </section>

            <div className="footer-row">
              <div className="pagination-block">
                <div className="pagination-label">Sayfa Sayısı</div>
                <div className="pagination">
                  <button className="page-arrow" type="button" aria-label="Önceki sayfa" onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M14.5 5.5L8 12l6.5 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </button>

                  {[1, 2, 3, 4].map((page) => (
                    <button
                      key={page}
                      className={`page-btn ${currentPage === page ? 'active' : ''}`}
                      type="button"
                      onClick={() => setCurrentPage(page)}
                    >
                      {page}
                    </button>
                  ))}

                  <button className="page-arrow" type="button" aria-label="Sonraki sayfa" onClick={() => setCurrentPage((p) => Math.min(4, p + 1))}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                      <path d="M9.5 5.5L16 12l-6.5 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
