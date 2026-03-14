import { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AILayout from '../../components/AILayout';
import toast from 'react-hot-toast';

const MODEL_WORKER_URL = 'https://models-worker.puter.work/models';
const IMAGE_MODEL_SESSION_KEY = 'nisai:selected-image-model';

type SortKey = 'price-asc' | 'price-desc' | 'fast' | 'quality' | 'photo' | 'type' | 'edit';
type RatioKey = '1:1' | '16:9' | '9:16' | '4:3';
type StyleKey = 'Cizim' | 'Gercekci' | 'Anime' | 'Yagli Boya' | 'Piksel Sanati' | '3D' | 'Antik';

type WorkerEnvelope<T> = {
  ok: boolean;
  code: string;
  data: T;
  error?: {
    message?: string;
  } | null;
};

type ModelCatalogItem = {
  id: string;
  company: string;
  provider: string;
  modelName: string;
  modelId: string;
  categoryRaw: string;
  badges: string[];
  parameters: string;
  speedLabel: string;
  speedScore: number;
  prices: {
    input: number | null;
    output: number | null;
    image: number | null;
  };
  traits: string[];
  standoutFeature: string;
  useCase: string;
  rivalAdvantage: string;
  sourceUrl: string;
  style: {
    brandKey: string;
    accent: string;
  };
};

type ModelCatalogPayload = {
  items: ModelCatalogItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  facets: {
    companies: string[];
    badges: string[];
    categories: string[];
  };
  source: {
    type: string;
    totalModels: number;
    sourceUrl: string;
  };
  filters: {
    search: string;
    company: string;
    badge: string;
    category: string;
    sort: string;
    modelId: string;
  };
};

type AttachmentItem = {
  id: string;
  name: string;
  file: File;
};

type GridCard = {
  id: string;
  src: string;
  alt: string;
  overlay: string;
};

type ImageLocationState = {
  selectedModel?: ModelCatalogItem;
};

type ImageResultPayload = {
  url?: string;
  urls?: string[];
  images?: Array<{ url?: string }>;
  data?: {
    url?: string;
    urls?: string[];
    images?: Array<{ url?: string }>;
  };
  assetId?: string;
  requestId?: string;
  modelId?: string;
  error?: {
    message?: string;
  } | null;
  message?: string;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

const SUGGESTIONS = [
  'Bir dağ köyünü sabahın erken saatlerinde çiz.',
  'Steampunk tarzında bir robot kedi tasarla.',
  "Ortaçağ'da havai savaşçı kadınları hayal et.",
] as const;

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function lower(value: string | null | undefined) {
  return String(value || '').toLocaleLowerCase('tr');
}

function formatCredits(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${value.toLocaleString('tr-TR', { maximumFractionDigits: 4 })} kredi`;
}

function formatUsd(value: number | null) {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `$${value.toLocaleString('en-US', { maximumFractionDigits: 4 })}`;
}

function bagOfModel(model: ModelCatalogItem) {
  return [
    model.company,
    model.provider,
    model.modelName,
    model.modelId,
    model.categoryRaw,
    model.standoutFeature,
    model.useCase,
    model.rivalAdvantage,
    ...(model.badges || []),
    ...(model.traits || []),
  ]
    .join(' ')
    .toLocaleLowerCase('tr');
}

function isImageModel(model: ModelCatalogItem) {
  const category = lower(model.categoryRaw);
  const badges = (model.badges || []).map((item) => lower(item));
  return category.includes('image generation') || badges.includes('görsel') || model.prices.image !== null;
}

function parseModelStrengthScore(model: ModelCatalogItem) {
  const parameters = String(model.parameters || '').replace(/,/g, '.').toUpperCase();
  const match = parameters.match(/(\d+(\.\d+)?)/);
  const base = match ? Number(match[1]) : 0;
  if (!Number.isFinite(base)) return 0;
  if (parameters.includes('T')) return base * 1_000_000;
  if (parameters.includes('B')) return base * 1_000;
  if (parameters.includes('M')) return base;
  return base;
}

function scoreByKeywords(model: ModelCatalogItem, keywords: string[]) {
  const bag = bagOfModel(model);
  return keywords.reduce((sum, keyword) => (bag.includes(keyword) ? sum + 1 : sum), 0);
}

function sortImageModels(items: ModelCatalogItem[], sort: SortKey) {
  const cloned = [...items];

  switch (sort) {
    case 'price-asc':
      return cloned.sort(
        (a, b) => (a.prices.image ?? Number.MAX_SAFE_INTEGER) - (b.prices.image ?? Number.MAX_SAFE_INTEGER),
      );
    case 'price-desc':
      return cloned.sort((a, b) => (b.prices.image ?? -1) - (a.prices.image ?? -1));
    case 'fast':
      return cloned.sort((a, b) => b.speedScore - a.speedScore);
    case 'quality':
      return cloned.sort((a, b) => {
        const aScore = scoreByKeywords(a, ['ultra', '4k', 'yüksek kalite', 'fotogerçek', 'profesyonel', 'detay']) + parseModelStrengthScore(a);
        const bScore = scoreByKeywords(b, ['ultra', '4k', 'yüksek kalite', 'fotogerçek', 'profesyonel', 'detay']) + parseModelStrengthScore(b);
        return bScore - aScore;
      });
    case 'photo':
      return cloned.sort(
        (a, b) =>
          scoreByKeywords(b, ['fotoğraf', 'fotogerçek', 'ürün fotoğrafı', 'gerçekçi']) -
          scoreByKeywords(a, ['fotoğraf', 'fotogerçek', 'ürün fotoğrafı', 'gerçekçi']),
      );
    case 'type':
      return cloned.sort(
        (a, b) =>
          scoreByKeywords(b, ['logo', 'ikon', 'svg', 'tipografi', 'vektör', 'tasarım']) -
          scoreByKeywords(a, ['logo', 'ikon', 'svg', 'tipografi', 'vektör', 'tasarım']),
      );
    case 'edit':
      return cloned.sort(
        (a, b) =>
          scoreByKeywords(b, ['referans', 'stil transferi', 'kontext', 'varyasyon', 'düzenleme']) -
          scoreByKeywords(a, ['referans', 'stil transferi', 'kontext', 'varyasyon', 'düzenleme']),
      );
    default:
      return cloned;
  }
}

function getStoredModelId() {
  try {
    const raw = sessionStorage.getItem(IMAGE_MODEL_SESSION_KEY);
    if (!raw) return '';
    const parsed = JSON.parse(raw) as Partial<ModelCatalogItem> | string;
    if (typeof parsed === 'string') return parsed;
    return String(parsed.modelId || parsed.id || '');
  } catch {
    return '';
  }
}

function setStoredModel(model: ModelCatalogItem | null) {
  if (!model) {
    sessionStorage.removeItem(IMAGE_MODEL_SESSION_KEY);
    return;
  }
  sessionStorage.setItem(IMAGE_MODEL_SESSION_KEY, JSON.stringify(model));
}

function pickInitialImageModel(
  items: ModelCatalogItem[],
  options: {
    stateModelId?: string;
    queryModelId?: string;
  },
) {
  const candidates = [
    options.stateModelId,
    options.queryModelId,
    getStoredModelId(),
  ].filter(Boolean) as string[];

  for (const candidate of candidates) {
    const match = items.find((item) => item.modelId === candidate || item.id === candidate);
    if (match) return match;
  }

  return items[0] ?? null;
}

function buildEmptyCards(page: number, overlay: string): GridCard[] {
  return Array.from({ length: 4 }).map((_, index) => ({
    id: `empty_${page}_${index + 1}`,
    src: '',
    alt: `Bos sonuc ${page}-${index + 1}`,
    overlay,
  }));
}

function extractImageUrls(result: ImageResultPayload | null | undefined) {
  if (!result) return [] as string[];

  const urls = new Set<string>();
  const sources = [result, result.data].filter(Boolean) as Array<ImageResultPayload['data'] | ImageResultPayload>;

  for (const source of sources) {
    if (typeof source?.url === 'string' && source.url.trim()) urls.add(source.url.trim());
    if (Array.isArray(source?.urls)) {
      for (const item of source.urls) {
        if (typeof item === 'string' && item.trim()) urls.add(item.trim());
      }
    }
    if (Array.isArray(source?.images)) {
      for (const item of source.images) {
        if (item && typeof item.url === 'string' && item.url.trim()) urls.add(item.url.trim());
      }
    }
  }

  return [...urls];
}

async function fetchImageModels(): Promise<ModelCatalogItem[]> {
  const attempts = [
    { badge: 'GÖRSEL', category: 'Image generation', sort: 'company_asc' },
    { badge: 'GÖRSEL', sort: 'company_asc' },
    { category: 'Image generation', sort: 'company_asc' },
    { sort: 'company_asc' },
  ];

  let lastError = 'Model kataloğu yüklenemedi.';

  for (const params of attempts) {
    const url = new URL(MODEL_WORKER_URL);
    url.searchParams.set('limit', '250');
    Object.entries(params).forEach(([key, value]) => {
      if (value) url.searchParams.set(key, value);
    });

    try {
      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: { Accept: 'application/json' },
      });
      const json = (await response.json()) as WorkerEnvelope<ModelCatalogPayload>;
      if (!response.ok || !json?.ok) {
        lastError = json?.error?.message || 'Model kataloğu yüklenemedi.';
        continue;
      }

      const filtered = (json.data?.items || []).filter(isImageModel);
      if (filtered.length > 0) return filtered;
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Model kataloğu yüklenemedi.';
    }
  }

  throw new Error(lastError);
}

async function requestImageGeneration(args: {
  prompt: string;
  modelId: string;
  style: StyleKey;
  ratio: RatioKey;
  attachments: AttachmentItem[];
}) {
  const { prompt, modelId, style, ratio, attachments } = args;
  const clientRequestId = createId('image');

  const meta = {
    source: 'ImageGen.tsx',
    page: 'gorsel',
    style,
    ratio,
  };

  let response: Response;

  if (attachments.length > 0) {
    const formData = new FormData();
    formData.append('prompt', prompt);
    formData.append('model', modelId);
    formData.append('modelId', modelId);
    formData.append('clientRequestId', clientRequestId);
    formData.append('style', style);
    formData.append('ratio', ratio);
    formData.append('meta', JSON.stringify(meta));
    attachments.forEach((item) => {
      formData.append('files', item.file, item.name);
    });

    response = await fetch('/api/ai/image', {
      method: 'POST',
      body: formData,
      credentials: 'include',
    });
  } else {
    response = await fetch('/api/ai/image', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        prompt,
        model: modelId,
        modelId,
        clientRequestId,
        style,
        ratio,
        meta,
      }),
    });
  }

  const text = await response.text();
  let json: ImageResultPayload | null = null;

  try {
    json = text ? (JSON.parse(text) as ImageResultPayload) : null;
  } catch {
    json = null;
  }

  if (!response.ok) {
    throw new Error(json?.error?.message || json?.message || text || 'Görsel üretimi başarısız oldu.');
  }

  if (!json) {
    throw new Error('Görsel üretimi boş yanıt döndürdü.');
  }

  return json;
}

export default function ImageGen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  
  const stateModelId = (location.state as ImageLocationState)?.selectedModel?.modelId;
  const queryModelId = searchParams.get('model') || '';

  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [catalog, setCatalog] = useState<ModelCatalogItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelCatalogItem | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  const [activeSort, setActiveSort] = useState<SortKey>('price-asc');
  const [activeStyle, setActiveStyle] = useState<StyleKey>('Gercekci');
  const [activeRatio, setActiveRatio] = useState<RatioKey>('16:9');

  const selectedModelId = selectedModel?.modelId;
  const rawPrompt = prompt;

  const [currentPage, setCurrentPage] = useState(1);
  const [generatedPages, setGeneratedPages] = useState<Record<number, GridCard[]>>({
    1: buildEmptyCards(1, 'Sonuç bekleniyor'),
    2: buildEmptyCards(2, 'Boş'),
    3: buildEmptyCards(3, 'Boş'),
    4: buildEmptyCards(4, 'Boş'),
  });

  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const modelWrapRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      try {
        setLoadingCatalog(true);
        setCatalogError('');
        const items = await fetchImageModels();
        if (!mounted) return;

        const initial = pickInitialImageModel(items, {
          stateModelId,
          queryModelId,
        });

        setCatalog(items);
        setSelectedModel(initial);
        setStoredModel(initial);
      } catch (error) {
        if (!mounted) return;
        setCatalog([]);
        setSelectedModel(null);
        setStoredModel(null);
        setCatalogError(error instanceof Error ? error.message : 'Model kataloğu alınamadı.');
      } finally {
        if (mounted) setLoadingCatalog(false);
      }
    };

    loadCatalog();

    return () => {
      mounted = false;
    };
  }, [queryModelId, stateModelId]);

  useEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) return;
    textarea.style.height = '56px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [prompt]);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!modelWrapRef.current) return;
      if (!modelWrapRef.current.contains(event.target as Node)) {
        setModelMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onerror = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setPrompt(transcript.trim());
    };

    recognitionRef.current = recognition;

    return () => {
      try {
        recognition.stop();
      } catch {
        /* ignore */
      }
      recognitionRef.current = null;
    };
  }, []);

  const visibleModels = useMemo(() => sortImageModels(catalog, activeSort), [catalog, activeSort]);

  const selectedModelLabel = selectedModel
    ? selectedModel.modelName
    : loadingCatalog
    ? 'Model Seçimi'
    : 'Aktif model bulunamadı';

  const selectedPageCards = generatedPages[currentPage] || buildEmptyCards(currentPage, 'Boş');

  const ensureAuth = () => {
    if (user) return true;
    navigate('/giris', { replace: true, state: { from: { pathname: '/gorsel' } } });
    return false;
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  const addFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const next = Array.from(files).map((file) => ({
      id: createId('attachment'),
      name: file.name,
      file,
    }));
    setAttachments((prev) => [...prev, ...next]);
  };

  const handleMicToggle = () => {
    const recognition = recognitionRef.current;
    if (!recognition) {
      toast.error('Tarayıcı mikrofon tanımayı desteklemiyor.');
      return;
    }

    try {
      if (isRecording) recognition.stop();
      else recognition.start();
    } catch {
      setIsRecording(false);
    }
  };

  const handleGenerate = async () => {
    if (!user) {
      navigate('/giris', { replace: true, state: { from: { pathname: '/gorsel' } } });
      return;
    }

    if (!prompt || !selectedModelId) return;
    setLoading(true);
    setError('');
    
    try {
      const payload = await requestImageGeneration({
        prompt: rawPrompt,
        modelId: selectedModel.modelId,
        style: activeStyle,
        ratio: activeRatio,
        attachments,
      });

      const urls = extractImageUrls(payload);
      if (urls.length === 0) {
        throw new Error('Görsel üretildi ancak geçerli bir görsel URL döndürmedi.');
      }

      const cards = buildEmptyCards(1, 'Daha fazla');
      urls.slice(0, 4).forEach((url, index) => {
        cards[index] = {
          id: createId('generated'),
          src: url,
          alt: `Uretilen gorsel ${index + 1}`,
          overlay: index === 0 ? 'Yeni sonuç' : 'Daha fazla',
        };
      });

      setGeneratedPages((prev) => ({
        ...prev,
        1: cards,
      }));
      toast.success('Görsel hazır.');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Görsel üretimi başarısız oldu.';
      setGeneratedPages((prev) => ({
        ...prev,
        1: buildEmptyCards(1, 'Hata'),
      }));
      toast.error(message);
    } finally {
      setIsGenerating(false);
    }
  };

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

        body {
          margin: 0;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: radial-gradient(circle at top, #f7f7f8 0%, #f1f3f5 44%, #edf0f3 100%);
          color: var(--text);
          padding: 20px;
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

        .ratio-pills .pill,
        .sort-pills .pill,
        .page-pills .pill {
          min-height: 42px;
          padding: 0 20px;
          font-size: 15px;
        }

        .ratio-pills .pill.active,
        .page-pills .pill.active,
        .sort-pills .pill.active {
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
        }

        .prompt-top {
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 16px;
          align-items: center;
        }

        .composer {
          min-height: 96px;
          display: flex;
          align-items: flex-start;
          gap: 14px;
          border: 1px solid #d8dce4;
          background: #ffffff;
          border-radius: 24px;
          padding: 14px 14px 12px 16px;
          box-shadow: 0 2px 8px rgba(17, 24, 39, 0.03);
        }

        .upload-stack {
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

        .round-icon.recording {
          background: #fff1f2;
          color: #be123c;
          border-color: #fecdd3;
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

        .attachment-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
          min-height: 10px;
        }

        .attachment-chip {
          min-height: 38px;
          padding: 0 14px;
          border-radius: 999px;
          background: #eef4f2;
          border: 1px solid #d7e7e3;
          color: #48635e;
          font-size: 14px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 10px;
        }

        .chip-close {
          border: none;
          background: transparent;
          color: inherit;
          cursor: pointer;
          font-size: 16px;
          line-height: 1;
          padding: 0;
        }

        .composer-tools {
          display: flex;
          align-items: center;
          gap: 10px;
          padding-top: 4px;
        }

        .generate {
          min-width: 194px;
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
          opacity: 0.6;
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
          min-width: 290px;
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

        .model-select-wrap.open .model-menu {
          display: block;
        }

        .model-option {
          width: 100%;
          min-height: 46px;
          border: none;
          background: transparent;
          border-radius: 14px;
          padding: 0 14px;
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
        .model-option.active {
          background: #f5f8f7;
        }

        .model-option:disabled {
          cursor: default;
          opacity: 0.75;
        }

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

        .model-option-price {
          font-size: 12px;
          font-weight: 800;
          color: #48635e;
          white-space: nowrap;
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

        .suggestion svg {
          color: #b9aaa1;
          flex: 0 0 auto;
        }

        .images {
          padding: 6px 28px 20px;
          display: grid;
          grid-template-columns: repeat(4, minmax(0, 1fr));
          gap: 16px;
        }

        .card {
          position: relative;
          aspect-ratio: 1 / 0.82;
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

        .card.empty {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .card-placeholder {
          padding: 24px;
          text-align: center;
          color: #536072;
          font-size: 15px;
          line-height: 1.5;
          font-weight: 600;
        }

        .card-overlay {
          position: absolute;
          right: 12px;
          bottom: 12px;
          padding: 8px 14px;
          border-radius: 999px;
          background: rgba(255,255,255,0.88);
          color: #505663;
          font-size: 14px;
          font-weight: 600;
          backdrop-filter: blur(8px);
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
        .page-arrow:last-child {
          border-right: none;
        }

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

        .hidden-input {
          display: none;
        }

        @media (max-width: 1280px) {
          .images { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .suggestions { grid-template-columns: 1fr; }
        }

        @media (max-width: 980px) {
          body { padding: 10px; }
          .app { min-height: calc(100vh - 20px); }
          .topbar {
            padding: 16px;
            align-items: flex-start;
            flex-direction: column;
          }
          .nav { gap: 18px; }
          .toolbar,
          .hero,
          .images,
          .footer-row { padding-left: 16px; padding-right: 16px; }
          .prompt-top {
            grid-template-columns: 1fr;
          }
          .generate {
            width: 100%;
          }
          .hero-meta {
            flex-direction: column;
            align-items: flex-start;
          }
        }

        @media (max-width: 760px) {
          .images { grid-template-columns: 1fr; }
          .toolbar-row { justify-content: flex-start; }
          .pagination-block { flex-direction: column; align-items: flex-start; }
          .model-select-wrap,
          .model-select { width: 100%; }
          .model-select { justify-content: center; }
          .composer {
            flex-direction: column;
            align-items: stretch;
          }
          .upload-stack,
          .composer-tools {
            justify-content: flex-start;
          }
        }
      `}</style>

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
              <div className="toolbar-label">Stil</div>
              <div className="pill-track" id="styleTrack">
                {[
                  ['Cizim', 'Çizim'],
                  ['Gercekci', 'Gerçekçi'],
                  ['Anime', 'Anime'],
                  ['Yagli Boya', 'Yağlı Boya'],
                  ['Piksel Sanati', 'Piksel Sanatı'],
                  ['3D', '3D'],
                  ['Antik', 'Antik'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`pill ${activeStyle === value ? 'active' : ''}`}
                    data-style={value}
                    type="button"
                    onClick={() => setActiveStyle(value as StyleKey)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar-row">
              <div ref={modelWrapRef} className={`model-select-wrap ${modelMenuOpen ? 'open' : ''}`} id="modelSelectWrap">
                <button
                  className="model-select"
                  id="modelSelectButton"
                  type="button"
                  aria-expanded={modelMenuOpen}
                  onClick={() => setModelMenuOpen((prev) => !prev)}
                >
                  <span id="modelSelectLabel">{selectedModelLabel}</span>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </button>

                <div className="model-menu" id="modelMenu">
                  {loadingCatalog && (
                    <button className="model-option active" type="button" disabled>
                      Model yükleniyor...
                    </button>
                  )}

                  {!loadingCatalog && catalogError && (
                    <button className="model-option active" type="button" disabled>
                      {catalogError}
                    </button>
                  )}

                  {!loadingCatalog && !catalogError && visibleModels.length === 0 && (
                    <button className="model-option active" type="button" disabled>
                      Aktif image modeli bulunamadı.
                    </button>
                  )}

                  {!loadingCatalog && !catalogError && visibleModels.map((model) => {
                    const active = selectedModel?.modelId === model.modelId;
                    return (
                      <button
                        key={model.modelId}
                        className={`model-option ${active ? 'active' : ''}`}
                        type="button"
                        onClick={() => {
                          setSelectedModel(model);
                          setStoredModel(model);
                          setModelMenuOpen(false);
                          toast.success(`${model.modelName} seçildi.`);
                        }}
                      >
                        <div className="model-option-text">
                          <span className="model-option-name">{model.modelName}</span>
                          <span className="model-option-meta">
                            {model.provider} • {formatCredits(model.prices.image)} • {formatUsd(model.prices.image)}
                          </span>
                        </div>
                        <span className="model-option-price" style={{ color: model.style.accent }}>
                          {model.speedLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="pill-track sort-pills" id="sortTrack">
                {[
                  ['price-asc', 'Fiyat Artan'],
                  ['price-desc', 'Fiyat Azalan'],
                  ['fast', 'En Hızlı'],
                  ['quality', 'En Kaliteli'],
                  ['photo', 'Fotoğraf Odaklı'],
                  ['type', 'Tipografi Güçlü'],
                  ['edit', 'Düzenleme Destekli'],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    className={`pill ${activeSort === value ? 'active' : ''}`}
                    data-sort={value}
                    type="button"
                    onClick={() => setActiveSort(value as SortKey)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="toolbar-row">
              <div className="toolbar-label">Adet</div>
              <div className="pill-track ratio-pills" id="ratioTrack">
                {(['1:1', '16:9', '9:16', '4:3'] as RatioKey[]).map((ratio) => (
                  <button
                    key={ratio}
                    className={`pill ${activeRatio === ratio ? 'active' : ''}`}
                    data-ratio={ratio}
                    type="button"
                    onClick={() => setActiveRatio(ratio)}
                  >
                    {ratio}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="hero">
            <div className="hero-card">
              <div className="prompt-top">
                <div className="composer">
                  <div className="upload-stack">
                    <button className="round-icon" type="button" id="uploadButton" aria-label="Görsel yükle" onClick={() => fileInputRef.current?.click()}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 16V7M12 7l-3 3M12 7l3 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path>
                        <path d="M5 16.5v.5A2 2 0 0 0 7 19h10a2 2 0 0 0 2-2v-.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                      </svg>
                    </button>
                    <button className="round-icon" type="button" id="cameraButton" aria-label="Kamera kullan" onClick={() => cameraInputRef.current?.click()}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M4 8.5A2.5 2.5 0 0 1 6.5 6H9l1.3-1.7c.3-.4.8-.6 1.3-.6h.8c.5 0 1 .2 1.3.6L15 6h2.5A2.5 2.5 0 0 1 20 8.5v8A2.5 2.5 0 0 1 17.5 19h-11A2.5 2.5 0 0 1 4 16.5v-8Z" stroke="currentColor" strokeWidth="1.8"></path>
                        <circle cx="12" cy="12.5" r="3.5" stroke="currentColor" strokeWidth="1.8"></circle>
                      </svg>
                    </button>
                  </div>

                  <div className="composer-main">
                    <textarea
                      ref={promptRef}
                      id="promptInput"
                      rows={1}
                      placeholder="Talimatını yaz. Referans görsel yükle, kamerayı kullan veya mikrofonla anlat."
                      value={prompt}
                      onChange={(event) => setPrompt(event.target.value)}
                    ></textarea>
                    <div className="attachment-row" id="attachmentRow">
                      {attachments.map((item) => (
                        <div key={item.id} className="attachment-chip" data-attachment-id={item.id}>
                          <span>{item.name}</span>
                          <button className="chip-close" type="button" aria-label="Eki kaldır" onClick={() => removeAttachment(item.id)}>
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="composer-tools">
                    <button
                      className={`round-icon ${isRecording ? 'recording' : ''}`}
                      type="button"
                      id="micButton"
                      aria-label="Mikrofon kullan"
                      onClick={handleMicToggle}
                    >
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <path d="M12 15a4 4 0 0 0 4-4V7a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2"></path>
                        <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path>
                      </svg>
                    </button>
                  </div>
                </div>

                <button
                  className="generate"
                  id="generateButton"
                  type="button"
                  onClick={handleGenerate}
                  disabled={isGenerating || loadingCatalog || !selectedModel}
                >
                  {isGenerating ? 'Oluşturuluyor' : 'Oluştur'}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </button>
              </div>

              <div className="hero-meta">
                <div className="subhint">
                  İlk bakışta odak noktası talimat alanı olmalı. Buradan yazabilir, görsel yükleyebilir, kamera kullanabilir ve mikrofonla komut verebilirsin.
                  {selectedModel ? ` Seçili model: ${selectedModel.provider} • ${selectedModel.modelName} • ${formatCredits(selectedModel.prices.image)} • ${formatUsd(selectedModel.prices.image)}.` : ''}
                  {attachments.length > 0 ? ` Ek sayısı: ${attachments.length}.` : ''}
                </div>
              </div>
            </div>

            <div className="suggestions">
              {SUGGESTIONS.map((item) => (
                <button
                  key={item}
                  className="suggestion"
                  data-prompt={item}
                  type="button"
                  onClick={() => {
                    setPrompt(item);
                    promptRef.current?.focus();
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M12 3c3.3 0 6 2.7 6 6 0 2.1-1 3.6-2.2 4.8-.8.8-1.2 1.4-1.3 2.2H9.5c-.1-.8-.5-1.4-1.3-2.2C7 12.6 6 11.1 6 9c0-3.3 2.7-6 6-6Z" stroke="currentColor" strokeWidth="1.8"></path>
                    <path d="M9.5 18h5M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path>
                  </svg>
                  {item}
                </button>
              ))}
            </div>
          </section>

          <section className="images" id="imageGrid">
            {selectedPageCards.map((card) => (
              <div key={card.id} className={`card ${card.src ? '' : 'empty'}`}>
                {card.src ? (
                  <img src={card.src} alt={card.alt} />
                ) : (
                  <div className="card-placeholder">
                    {card.overlay === 'Üretiliyor' ? 'Görsel hazırlanıyor…' : 'Henüz sonuç yok'}
                  </div>
                )}
                <div className="card-overlay">{card.overlay}</div>
              </div>
            ))}
          </section>

          <div className="footer-row">
            <div className="pagination-block">
              <div className="pagination-label">Sayfa Sayısı</div>
              <div className="pagination" id="pagination">
                <button
                  className="page-arrow"
                  data-nav="prev"
                  aria-label="Önceki sayfa"
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M14.5 5.5L8 12l6.5 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </button>
                {[1, 2, 3, 4].map((page) => (
                  <button
                    key={page}
                    className={`page-btn ${currentPage === page ? 'active' : ''}`}
                    data-page={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button
                  className="page-arrow"
                  data-nav="next"
                  aria-label="Sonraki sayfa"
                  type="button"
                  onClick={() => setCurrentPage((prev) => Math.min(4, prev + 1))}
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9.5 5.5L16 12l-6.5 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <input
            ref={fileInputRef}
            className="hidden-input"
            id="fileInput"
            type="file"
            accept="image/*"
            multiple
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
          <input
            ref={cameraInputRef}
            className="hidden-input"
            id="cameraInput"
            type="file"
            accept="image/*"
            capture="environment"
            onChange={(event) => {
              addFiles(event.target.files);
              event.currentTarget.value = '';
            }}
          />
        </main>
      </div>
    </>
  );
}
