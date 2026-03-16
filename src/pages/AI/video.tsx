import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import AILayout from '../../components/AILayout';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';
import { fetchApiJson } from '../../lib/apiClient';
import { formatCredits, formatUsd, ModelCatalogItem } from '../../lib/aiWorkers';

const MODEL_WORKER_URL = 'https://models-worker.puter.work/models';
const VIDEO_MODEL_SESSION_KEY = 'nisai:selected-video-model';

type VideoLocationState = {
  selectedModel?: ModelCatalogItem;
};

type SortKey = 'price-asc' | 'price-desc' | 'fast' | 'quality' | 'camera' | 'edit' | 'social';
type StyleKey = 'cinematic' | 'social' | 'product' | 'anime' | 'realistic' | 'documentary';
type ModeKey = 'text-video' | 'image-video' | 'video-video';
type DurationKey = '5' | '10' | '15';
type RatioKey = '16:9' | '9:16' | '1:1' | '4:5';
type CameraKey = 'static' | 'dolly' | 'pan' | 'orbit';

type WorkerEnvelope<T> = {
  ok: boolean;
  code: string;
  data: T;
  error?: {
    message?: string;
  } | null;
};

type ModelCatalogPayload = {
  items: ModelCatalogItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
};

type AttachmentItem = {
  id: string;
  name: string;
  file: File;
};

type VideoCard = {
  id: string;
  title: string;
  tags: string[];
  image?: string;
  video?: string;
};

type VideoResultPayload = {
  url?: string;
  urls?: string[];
  videoUrl?: string;
  videoUrls?: string[];
  videos?: Array<{ url?: string; posterUrl?: string; image?: string; thumbnailUrl?: string }>;
  posterUrl?: string;
  image?: string;
  thumbnailUrl?: string;
  assetId?: string;
  requestId?: string;
  modelId?: string;
};

declare global {
  interface Window {
    webkitSpeechRecognition?: any;
    SpeechRecognition?: any;
  }
}

const PAGE_DATA: Record<number, Array<{ image: string; title: string; tags: string[] }>> = {
  1: [
    {
      image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80',
      title: 'Orman içi sinematik yürüyüş',
      tags: ['5 sn', 'Text → Video', 'Runway Gen-4'],
    },
    {
      image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
      title: 'Ürün reklamı yakın plan makro çekim',
      tags: ['10 sn', 'Image → Video', 'Pika 2.2'],
    },
    {
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80',
      title: 'Cyberpunk karakter şehir girişinde',
      tags: ['5 sn', 'Text → Video', 'Luma Ray 2'],
    },
    {
      image: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80',
      title: 'Kısa sosyal medya dikey tanıtım',
      tags: ['9:16', 'Sosyal', 'Pika 2.2'],
    },
  ],
  2: [
    {
      image: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80',
      title: 'Sisli dağ geçidi drone benzeri geçiş',
      tags: ['10 sn', 'Dolly In', 'Runway Gen-4'],
    },
    {
      image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80',
      title: 'Ofis ortamı için kurumsal tanıtım klibi',
      tags: ['Kurumsal', '4:5', 'Luma Ray 2'],
    },
    {
      image: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=1200&q=80',
      title: 'Gün batımı sahil planı orbit kamera',
      tags: ['Orbit', '16:9', 'Runway Gen-4'],
    },
    {
      image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80',
      title: 'Moda çekimi için hızlı sosyal video',
      tags: ['9:16', 'Sosyal', 'Pika 2.2'],
    },
  ],
  3: [
    {
      image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80',
      title: 'Masaüstü ürün tanıtımı video-to-video mock',
      tags: ['Video → Video', 'Ürün', 'Luma Ray 2'],
    },
    {
      image: 'https://images.unsplash.com/photo-1493246318656-5bfd4cfb29b8?auto=format&fit=crop&w=1200&q=80',
      title: 'Fantastik şehirde karakter yürüyüşü',
      tags: ['Anime', '10 sn', 'Runway Gen-4'],
    },
    {
      image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80',
      title: 'Tipografi güçlü lansman video sahnesi',
      tags: ['Tipografi', '5 sn', 'Pika 2.2'],
    },
    {
      image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80',
      title: 'Belgesel stili şehir panoraması',
      tags: ['Belgesel', '16:9', 'Luma Ray 2'],
    },
  ],
  4: [
    {
      image: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1200&q=80',
      title: 'Kış manzarasında sinematik giriş sahnesi',
      tags: ['5 sn', 'Gerçekçi', 'Runway Gen-4'],
    },
    {
      image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80',
      title: 'Müzik videosu için hızlı ritmik kurgu',
      tags: ['Müzik', '9:16', 'Pika 2.2'],
    },
    {
      image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80',
      title: 'Uzay temalı atmosferik açılış sekansı',
      tags: ['Text → Video', '10 sn', 'Luma Ray 2'],
    },
    {
      image: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=80',
      title: 'Sosyal içerik için sokak röportajı intro',
      tags: ['Sosyal', '4:5', 'Pika 2.2'],
    },
  ],
};

const SUGGESTIONS = [
  'Sisli bir ormanda kamera öne doğru kayarken neon ışıklı bir gezgin beliriyor.',
  'Bir ürün reklamı: akıllı saat masanın üstünde dönüyor, sinematik ışık ve makro detaylar.',
  'Dikey sosyal medya videosu: şehirde koşan bir karakter, hızlı kesmeler ve parlak renkler.',
] as const;

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
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

function isVideoModel(model: ModelCatalogItem) {
  const bag = bagOfModel(model);
  return (
    bag.includes('video') ||
    bag.includes('txt2vid') ||
    bag.includes('video generation') ||
    bag.includes('video-to-video') ||
    bag.includes('görüntüden video') ||
    bag.includes('image to video') ||
    bag.includes('runway') ||
    bag.includes('pika') ||
    bag.includes('luma')
  );
}

function pickInitialVideoModel(
  allItems: ModelCatalogItem[],
  initialModelId: string,
  selectedModel?: ModelCatalogItem,
) {
  const filtered = allItems.filter(isVideoModel);

  if (selectedModel && isVideoModel(selectedModel)) {
    const matchFromState = filtered.find((item) => item.modelId === selectedModel.modelId);
    if (matchFromState) return matchFromState;
  }

  if (initialModelId) {
    const matchFromQuery = filtered.find((item) => item.modelId === initialModelId || item.id === initialModelId);
    if (matchFromQuery) return matchFromQuery;
  }

  try {
    const raw = sessionStorage.getItem(VIDEO_MODEL_SESSION_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as ModelCatalogItem;
      const matchFromSession = filtered.find((item) => item.modelId === parsed.modelId);
      if (matchFromSession) return matchFromSession;
    }
  } catch {
    /* ignore */
  }

  return filtered[0] ?? null;
}

function parseParameterScore(model: ModelCatalogItem) {
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

function parsePrice(model: ModelCatalogItem) {
  const firstNumeric = [model.prices.image, model.prices.input, model.prices.output].find((value) => value !== null);
  return firstNumeric ?? null;
}

function sortVideoModels(items: ModelCatalogItem[], sort: SortKey) {
  const cloned = [...items];

  switch (sort) {
    case 'price-asc':
      return cloned.sort((a, b) => (parsePrice(a) ?? Number.MAX_SAFE_INTEGER) - (parsePrice(b) ?? Number.MAX_SAFE_INTEGER));
    case 'price-desc':
      return cloned.sort((a, b) => (parsePrice(b) ?? -1) - (parsePrice(a) ?? -1));
    case 'fast':
      return cloned.sort((a, b) => b.speedScore - a.speedScore);
    case 'quality':
      return cloned.sort((a, b) => {
        const aScore = scoreByKeywords(a, ['4k', 'quality', 'cinematic', 'pro', 'professional', 'detail', 'high fidelity']) + parseParameterScore(a);
        const bScore = scoreByKeywords(b, ['4k', 'quality', 'cinematic', 'pro', 'professional', 'detail', 'high fidelity']) + parseParameterScore(b);
        return bScore - aScore;
      });
    case 'camera':
      return cloned.sort(
        (a, b) =>
          scoreByKeywords(b, ['camera', 'motion', 'dolly', 'pan', 'orbit', 'movement']) -
          scoreByKeywords(a, ['camera', 'motion', 'dolly', 'pan', 'orbit', 'movement']),
      );
    case 'edit':
      return cloned.sort(
        (a, b) =>
          scoreByKeywords(b, ['video-to-video', 'edit', 'source clip', 'reference']) -
          scoreByKeywords(a, ['video-to-video', 'edit', 'source clip', 'reference']),
      );
    case 'social':
      return cloned.sort(
        (a, b) =>
          scoreByKeywords(b, ['social', 'short form', 'vertical', 'reels', 'tiktok']) -
          scoreByKeywords(a, ['social', 'short form', 'vertical', 'reels', 'tiktok']),
      );
    default:
      return cloned;
  }
}

function buildBaseCards(page: number): VideoCard[] {
  const videos = PAGE_DATA[page] || PAGE_DATA[1];
  return videos.map((item, index) => ({
    id: `sample_${page}_${index + 1}`,
    image: item.image,
    title: item.title,
    tags: item.tags,
  }));
}

async function fetchVideoCatalog(): Promise<ModelCatalogPayload> {
  const url = new URL(MODEL_WORKER_URL);
  url.searchParams.set('limit', '250');
  url.searchParams.set('sort', 'company_asc');

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const json = (await response.json()) as WorkerEnvelope<ModelCatalogPayload>;

  if (!response.ok || !json?.ok) {
    throw new Error(json?.error?.message || 'Model kataloğu alınamadı.');
  }

  return json.data;
}

function extractVideoAssets(result: VideoResultPayload | null | undefined) {
  const items: Array<{ video?: string; image?: string }> = [];
  if (!result) return items;

  if (Array.isArray(result.videos)) {
    for (const item of result.videos) {
      items.push({
        video: item?.url?.trim() || undefined,
        image: item?.posterUrl?.trim() || item?.thumbnailUrl?.trim() || item?.image?.trim() || undefined,
      });
    }
  }

  if (Array.isArray(result.videoUrls)) {
    for (const item of result.videoUrls) {
      if (typeof item === 'string' && item.trim()) items.push({ video: item.trim() });
    }
  }

  if (Array.isArray(result.urls)) {
    for (const item of result.urls) {
      if (typeof item === 'string' && item.trim()) items.push({ video: item.trim() });
    }
  }

  if (typeof result.videoUrl === 'string' && result.videoUrl.trim()) {
    items.unshift({ video: result.videoUrl.trim() });
  }

  if (typeof result.url === 'string' && result.url.trim()) {
    items.unshift({ video: result.url.trim() });
  }

  const fallbackPoster = result.posterUrl?.trim() || result.thumbnailUrl?.trim() || result.image?.trim() || undefined;
  if (items.length === 0 && fallbackPoster) {
    items.push({ image: fallbackPoster });
  }

  return items.filter((item) => item.video || item.image);
}

export default function VideoGen() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const locationState = location.state as VideoLocationState;
  const initialModelId = searchParams.get('model') || '';

  const [prompt, setPrompt] = useState('');
  const [attachments, setAttachments] = useState<AttachmentItem[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [loadingCatalog, setLoadingCatalog] = useState(false);
  const [catalogError, setCatalogError] = useState('');
  const [allModels, setAllModels] = useState<ModelCatalogItem[]>([]);
  const [selectedModel, setSelectedModel] = useState<ModelCatalogItem | null>(null);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);

  const [activeSort, setActiveSort] = useState<SortKey>('price-asc');
  const [activeMode, setActiveMode] = useState<ModeKey>('text-video');
  const [activeDuration, setActiveDuration] = useState<DurationKey>('5');
  const [activeRatio, setActiveRatio] = useState<RatioKey>('16:9');
  const [activeCamera, setActiveCamera] = useState<CameraKey>('static');
  const [activeStyle, setActiveStyle] = useState<StyleKey>('cinematic');

  const selectedModelId = selectedModel?.id;
  const rawPrompt = prompt;

  const [currentPage, setCurrentPage] = useState(1);
  const [generatedPages, setGeneratedPages] = useState<Record<number, VideoCard[]>>({});

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

        const payload = await fetchVideoCatalog();
        if (!mounted) return;

        const items = payload.items || [];
        setAllModels(items);

        const initial = pickInitialVideoModel(items, initialModelId, locationState?.selectedModel);
        setSelectedModel(initial);

        if (initial) {
          sessionStorage.setItem(VIDEO_MODEL_SESSION_KEY, JSON.stringify(initial));
        }
      } catch (error) {
        if (!mounted) return;
        setCatalogError(error instanceof Error ? error.message : 'Model kataloğu alınamadı.');
      } finally {
        if (mounted) setLoadingCatalog(false);
      }
    };

    loadCatalog();

    return () => {
      mounted = false;
    };
  }, [initialModelId, locationState?.selectedModel]);

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

  const videoModels = useMemo(() => allModels.filter(isVideoModel), [allModels]);
  const visibleModels = useMemo(() => sortVideoModels(videoModels, activeSort), [videoModels, activeSort]);

  const selectedModelLabel = selectedModel
    ? selectedModel.modelName
    : loadingCatalog
    ? 'Model Seçimi'
    : 'Model Seçimi';

  const videoCards = generatedPages[currentPage] || buildBaseCards(currentPage);

  const ensureAuth = () => {
    if (user) return true;
    navigate('/giris', { replace: true, state: { from: { pathname: '/video' } } });
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
      navigate('/giris', { replace: true, state: { from: { pathname: '/video' } } });
      return;
    }

    if (!prompt || !selectedModelId) return;
    setLoading(true);
    setError('');
    
    try {
      const payload = await fetchApiJson<VideoResultPayload>('/api/ai/video', {
        method: 'POST',
        body: JSON.stringify({
          prompt: rawPrompt,
          modelId: selectedModel.id,
          clientRequestId: createId('video'),
          mode: activeMode,
          duration: Number(activeDuration),
          ratio: activeRatio,
          camera: activeCamera,
          style: activeStyle,
        }),
      });

      const assets = extractVideoAssets(payload);
      if (assets.length === 0) {
        toast.error('Video üretildi ama oynatılabilir çıktı dönmedi.');
        return;
      }

      const nextCards = buildBaseCards(1);
      assets.slice(0, 4).forEach((asset, index) => {
        nextCards[index] = {
          id: createId('generated'),
          title: index === 0 ? 'Yeni oluşturulan video mock çıktısı' : `Üretilen video ${index + 1}`,
          tags: [`${activeDuration} sn`, activeMode === 'text-video' ? 'Text → Video' : activeMode === 'image-video' ? 'Image → Video' : 'Video → Video', selectedModel.modelName],
          image: asset.image,
          video: asset.video,
        };
      });

      setGeneratedPages((prev) => ({
        ...prev,
        1: nextCards,
      }));
      setCurrentPage(1);
      toast.success('Video hazır.');
    } catch (error: any) {
      toast.error(error?.message || 'Video üretimi başarısız oldu.');
    } finally {
      setIsGenerating(false);
    }
  };

  const renderPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(4, page)));
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

        .mode-pills .pill,
        .ratio-pills .pill,
        .duration-pills .pill,
        .sort-pills .pill {
          min-height: 42px;
          padding: 0 18px;
          font-size: 15px;
        }

        .mode-pills .pill.active,
        .ratio-pills .pill.active,
        .duration-pills .pill.active,
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

        .videos {
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

        .card img,
        .card video {
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

        .video-meta {
          position: absolute;
          left: 14px;
          right: 14px;
          bottom: 14px;
          display: flex;
          flex-direction: column;
          gap: 8px;
          color: #ffffff;
        }

        .video-title {
          font-size: 16px;
          font-weight: 700;
          line-height: 1.35;
        }

        .video-tags {
          display: flex;
          gap: 8px;
          flex-wrap: wrap;
        }

        .video-tag {
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
          .videos { grid-template-columns: repeat(2, minmax(0, 1fr)); }
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
          .videos,
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
          .videos { grid-template-columns: 1fr; }
          .toolbar-row,
          .detail-filters { justify-content: flex-start; }
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
            <a href="/gorsel">Görsel Üretim</a>
            <a href="/video" className="active">Video</a>
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
              <div className="toolbar-label">Stiller</div>
              <div className="pill-track" id="styleTrack">
                {[
                  ['cinematic', 'Sinematik'],
                  ['social', 'Sosyal Medya'],
                  ['product', 'Ürün Reklamı'],
                  ['anime', 'Anime'],
                  ['realistic', 'Gerçekçi'],
                  ['documentary', 'Belgesel'],
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

                  {!loadingCatalog && visibleModels.length === 0 && (
                    <button className="model-option active" type="button" disabled>
                      Video modeli bulunamadı
                    </button>
                  )}

                  {!loadingCatalog && visibleModels.map((model) => {
                    const active = selectedModel?.modelId === model.modelId;
                    return (
                      <button
                        key={model.modelId}
                        className={`model-option ${active ? 'active' : ''}`}
                        data-model-label={model.modelName}
                        type="button"
                        onClick={() => {
                          setSelectedModel(model);
                          sessionStorage.setItem(VIDEO_MODEL_SESSION_KEY, JSON.stringify(model));
                          setModelMenuOpen(false);
                          toast.success(`${model.modelName} seçildi.`);
                        }}
                      >
                        <div className="model-option-text">
                          <span className="model-option-name">{model.modelName}</span>
                          <span className="model-option-meta">
                            {model.provider} • {formatCredits(parsePrice(model))} • {formatUsd(parsePrice(model))}
                          </span>
                        </div>
                        <span className="model-option-speed" style={{ color: model.style.accent }}>
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
                  ['camera', 'Kamera Kontrollü'],
                  ['edit', 'Video-to-Video'],
                  ['social', 'Sosyal İçerik'],
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

            <div className="detail-filters">
              <div className="filter-group">
                <div className="mini-label">Mod</div>
                <div className="pill-track mode-pills" id="modeTrack">
                  {[
                    ['text-video', 'Text → Video'],
                    ['image-video', 'Image → Video'],
                    ['video-video', 'Video → Video'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`pill ${activeMode === value ? 'active' : ''}`}
                      data-mode={value}
                      type="button"
                      onClick={() => setActiveMode(value as ModeKey)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <div className="mini-label">Süre</div>
                <div className="pill-track duration-pills" id="durationTrack">
                  {[
                    ['5', '5 sn'],
                    ['10', '10 sn'],
                    ['15', '15 sn'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`pill ${activeDuration === value ? 'active' : ''}`}
                      data-duration={value}
                      type="button"
                      onClick={() => setActiveDuration(value as DurationKey)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <div className="mini-label">Oran</div>
                <div className="pill-track ratio-pills" id="ratioTrack">
                  {[
                    ['16:9', '16:9'],
                    ['9:16', '9:16'],
                    ['1:1', '1:1'],
                    ['4:5', '4:5'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`pill ${activeRatio === value ? 'active' : ''}`}
                      data-ratio={value}
                      type="button"
                      onClick={() => setActiveRatio(value as RatioKey)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="filter-group">
                <div className="mini-label">Kamera</div>
                <div className="pill-track mode-pills" id="cameraTrack">
                  {[
                    ['static', 'Sabit'],
                    ['dolly', 'Dolly In'],
                    ['pan', 'Pan Right'],
                    ['orbit', 'Orbit'],
                  ].map(([value, label]) => (
                    <button
                      key={value}
                      className={`pill ${activeCamera === value ? 'active' : ''}`}
                      data-camera={value}
                      type="button"
                      onClick={() => setActiveCamera(value as CameraKey)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </section>

          <section className="hero">
            <div className="hero-card">
              <div className="prompt-top">
                <div className="composer">
                  <div className="upload-stack">
                    <button className="round-icon" type="button" id="uploadButton" aria-label="Görsel veya video yükle" onClick={() => fileInputRef.current?.click()}>
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
                      placeholder="Video talimatını yaz. Referans görsel, kaynak klip, kamera veya mikrofon kullan."
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

                <button className="generate" id="generateButton" type="button" onClick={handleGenerate} disabled={isGenerating || loadingCatalog || !selectedModel}>
                  {isGenerating ? 'Video Hazırlanıyor' : 'Video Oluştur'}
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path>
                  </svg>
                </button>
              </div>

              <div className="hero-meta">
                <div className="subhint">
                  Odak noktası talimat alanı. Buradan prompt yazabilir, kaynak görsel veya video yükleyebilir, kamerayı kullanabilir, mikrofonla tarif verebilirsin. Video sayfasında ayrıca mod, süre, oran ve kamera hareketi filtreleri hazır gelir.
                  {selectedModel ? ` Seçili model: ${selectedModel.provider} • ${selectedModel.modelName} • ${formatCredits(parsePrice(selectedModel))} • ${formatUsd(parsePrice(selectedModel))}.` : ''}
                  {catalogError ? ` ${catalogError}` : ''}
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

          <section className="videos" id="videoGrid">
            {videoCards.map((item) => (
              <article key={item.id} className="card">
                {item.video ? (
                  <video src={item.video} poster={item.image} muted playsInline autoPlay loop />
                ) : (
                  <img src={item.image} alt={item.title} />
                )}
                <div className="play-badge">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M8 6.5v11l9-5.5-9-5.5Z"></path>
                  </svg>
                </div>
                <div className="card-gradient"></div>
                <div className="video-meta">
                  <div className="video-title">{item.title}</div>
                  <div className="video-tags">
                    {item.tags.map((tag) => (
                      <span key={`${item.id}_${tag}`} className="video-tag">{tag}</span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </section>

          <div className="footer-row">
            <div className="pagination-block">
              <div className="pagination-label">Sayfa Sayısı</div>
              <div className="pagination" id="pagination">
                <button className="page-arrow" data-nav="prev" aria-label="Önceki sayfa" type="button" onClick={() => renderPage(currentPage - 1)}>
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
                    onClick={() => renderPage(page)}
                  >
                    {page}
                  </button>
                ))}
                <button className="page-arrow" data-nav="next" aria-label="Sonraki sayfa" type="button" onClick={() => renderPage(currentPage + 1)}>
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
            accept="image/*,video/*"
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
            accept="image/*,video/*"
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
