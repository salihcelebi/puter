import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type WorkerMode = 'amg' | 'amh';
type HealthTone = 'ok' | 'warn' | 'bad' | 'idle';
type ProviderRegistry = 'openai-image-generation' | 'together' | 'gemini' | 'xai' | string;
type Quality = 'low' | 'medium' | 'high';
type RatioKey = '1:1' | '16:9' | '9:16' | '4:5';

type AmgEnvelope<T> = {
  ok: boolean;
  veri: T | null;
  hata: string | null;
};

type AmhError = {
  mesaj?: string;
  kod?: string;
  ayrintilar?: string[];
  ayrinti?: unknown;
  kritikMi?: boolean;
};

type AmhEnvelope<T> = {
  ok: boolean;
  veri: T | null;
  hata: AmhError | null;
  meta?: {
    dosya?: string;
    surum?: string;
    zamanDamgasi?: string;
    isKimligi?: string | null;
    sureMs?: number;
    maliyet?: number;
    teshis?: string | null;
    [key: string]: unknown;
  } | null;
};

type ModelItem = {
  kimlik: string;
  ad: string;
  saglayici: ProviderRegistry;
  baglam: number | null;
  azamiToken: number | null;
  maliyet: unknown;
  takmaAdlar: string[];
};

type AmgModelsPayload = {
  toplam?: number;
  modeller?: ModelItem[];
};

type AmgHealthPayload = {
  servis?: string;
  durum?: string;
  mePuterOdakli?: boolean;
  yoneticiKurulu?: boolean;
  ortakDurumVar?: boolean;
  zaman?: string;
};

type AmhHealthPayload = {
  worker?: string;
  surum?: string;
  durum?: string;
  saglik?: {
    saglikPuani?: number;
    bulgular?: Array<{ ad?: string; durum?: string }>;
    kv?: unknown;
  };
};

type AmhPanelPayload = {
  aktifIsSayisi?: number;
  sonHata?: string | null;
  genelSaglikPuani?: number;
  durum?: string;
};

type AmgGeneratePayload = {
  model?: string | null;
  prompt?: string;
  url?: string;
  ham?: unknown;
};

type AmhRunPayload = {
  baglam?: {
    isKimligi?: string;
    olayKimligi?: string;
    kullaniciKimligi?: string;
    hizmetTuru?: string;
    baslangicZamani?: number;
    zamanDamgasi?: string;
    korelasyonAnahtari?: string;
    islemDurumu?: string;
    tanilama?: Record<string, unknown>;
  };
  etkinAyar?: {
    model?: string;
    saglayici?: string;
    timeoutMs?: number;
    kaliteSeviyesi?: string;
    maliyetSiniri?: number;
    denemeSiniri?: number;
    fallbackZinciri?: string[];
    oncelik?: string;
  };
  orkestra?: {
    hizmetTuru?: string;
    secim?: {
      birincilIsci?: string;
      yedekIsci?: string;
      acilGeriDonusIsci?: string;
      oncelik?: string;
    };
    saglayiciOnceligi?: {
      siraliSaglayicilar?: string[];
      skorlar?: Array<{ saglayici?: string; skor?: number; hataSayisi?: number }>;
    };
    fallbackZinciri?: Array<{ tur?: string; hedef?: string; strateji?: string }>;
    tahminiMaliyet?: number;
  };
  sonuc?: {
    hizmetTuru?: string;
    parcaliSonuclar?: Array<{
      hizmetTuru?: string;
      cikti?: {
        url?: string;
        gorseller?: string[];
        images?: string[];
        src?: string;
        image_url?: string;
        ham?: unknown;
        [key: string]: unknown;
      };
      uyarlamalar?: string[];
      [key: string]: unknown;
    }>;
    uyarilar?: unknown[];
    kalitePuani?: number;
    toplamMaliyet?: number;
    birlesikMetin?: string;
    birlesikOzet?: string;
    [key: string]: unknown;
  };
};

type AmhJobStatusPayload = {
  isKimligi?: string | null;
  durum?: string;
  yuzde?: number;
  aktifAdim?: string;
  sonHata?: unknown;
  tahminiBitis?: string | null;
  sonGuncelleme?: string | null;
  kisaMetin?: string;
};

type AmhHistoryEvent = {
  olayKimligi?: string;
  olay?: string;
  veri?: unknown;
  zamanDamgasi?: string;
};

type AmhHistoryPayload = {
  isKimligi?: string;
  gecmis?: AmhHistoryEvent[];
};

type AmhArchivePayload = {
  isKimligi?: string;
  arsiv?: {
    isKimligi?: string;
    durum?: string;
    baslangicZamani?: string | null;
    bitisZamani?: string | null;
    hizmetTuru?: string | null;
    sonMesaj?: string;
    sonuc?: unknown;
    gecmis?: AmhHistoryEvent[];
  } | null;
};

type LocalRunRecord = {
  id: string;
  source: 'AMG' | 'AMH';
  status: string;
  prompt: string;
  images: string[];
  model: string;
  provider: string;
  at: string;
  fallbackUsed?: boolean;
};

type ResultCard = {
  source: 'AMG' | 'AMH';
  status: string;
  message: string;
  images: string[];
  model: string;
  provider: string;
  prompt: string;
  fallbackUsed?: boolean;
  raw?: unknown;
};

type RatioOption = {
  key: RatioKey;
  label: string;
  width: number;
  height: number;
};

type JsonRecord = Record<string, unknown>;

const AMG_BASE_URL = 'https://turk.puter.site/workers/all/amg.js';
const AMH_BASE_URL = 'https://turk.puter.site/workers/all/amh.js';
const POLL_MS = 2000;
const MAX_PROMPT = 2000;
const MAX_AMH_PROMPT = 2500;
const QUALITY_OPTIONS: Quality[] = ['low', 'medium', 'high'];
const RATIO_OPTIONS: RatioOption[] = [
  { key: '1:1', label: '1:1', width: 1024, height: 1024 },
  { key: '16:9', label: '16:9', width: 1600, height: 900 },
  { key: '9:16', label: '9:16', width: 900, height: 1600 },
  { key: '4:5', label: '4:5', width: 1200, height: 1500 },
];
const DEFAULT_PROVIDER_OPTIONS = ['', 'openai-image-generation', 'together', 'gemini', 'xai'];
const STYLE_OPTIONS = ['', 'vivid', 'natural', 'photorealistic', 'illustration', 'cinematic', 'anime'] as const;

const QUICK_PROMPTS = [
  'Sisli İstanbul gecesi, ıslak taş sokaklar, neon yansımalar, sinematik ışık, gerçekçi detay.',
  'Premium ürün çekimi, siyah arka plan, yumuşak stüdyo ışığı, lüks reklam estetiği.',
  'Anime karakter, dinamik poz, güçlü kontrast, ayrıntılı kostüm, poster kalitesi.',
] as const;

const PAGE_DATA: Record<number, Array<{ image: string; title: string; tags: string[] }>> = {
  1: [
    { image: 'https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?auto=format&fit=crop&w=1200&q=80', title: 'Sinematik gece kompozisyonu', tags: ['1 görsel', 'Prompt', 'OpenAI'] },
    { image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80', title: 'Ürün reklamı premium mock', tags: ['Reklam', 'Makro', 'Together'] },
    { image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?auto=format&fit=crop&w=1200&q=80', title: 'Cyberpunk karakter portresi', tags: ['Anime', 'Poster', 'Gemini'] },
    { image: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80', title: 'Dikey sosyal medya kapak görseli', tags: ['9:16', 'Sosyal', 'xAI'] },
  ],
  2: [
    { image: 'https://images.unsplash.com/photo-1493246507139-91e8fad9978e?auto=format&fit=crop&w=1200&q=80', title: 'Dağ manzarası reklam afişi', tags: ['Doğa', 'Poster', 'OpenAI'] },
    { image: 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?auto=format&fit=crop&w=1200&q=80', title: 'Kurumsal tanıtım hero görseli', tags: ['Kurumsal', '4:5', 'Gemini'] },
    { image: 'https://images.unsplash.com/photo-1504198453319-5ce911bafcde?auto=format&fit=crop&w=1200&q=80', title: 'Gün batımı editorial kare', tags: ['16:9', 'Editorial', 'Together'] },
    { image: 'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1200&q=80', title: 'Moda çekimi sosyal görseli', tags: ['Sosyal', '4:5', 'OpenAI'] },
  ],
  3: [
    { image: 'https://images.unsplash.com/photo-1498050108023-c5249f4df085?auto=format&fit=crop&w=1200&q=80', title: 'Masaüstü ürün mock sahnesi', tags: ['Ürün', 'Minimal', 'Together'] },
    { image: 'https://images.unsplash.com/photo-1493246318656-5bfd4cfb29b8?auto=format&fit=crop&w=1200&q=80', title: 'Fantastik şehir illüstrasyonu', tags: ['Anime', 'Konsept', 'Gemini'] },
    { image: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=1200&q=80', title: 'Tipografi güçlü lansman kapağı', tags: ['Tipografi', 'Poster', 'OpenAI'] },
    { image: 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?auto=format&fit=crop&w=1200&q=80', title: 'Belgesel stil şehir karesi', tags: ['Belgesel', 'Gerçekçi', 'xAI'] },
  ],
  4: [
    { image: 'https://images.unsplash.com/photo-1502082553048-f009c37129b9?auto=format&fit=crop&w=1200&q=80', title: 'Kış manzarası sinematik key art', tags: ['Sinematik', 'Doğa', 'OpenAI'] },
    { image: 'https://images.unsplash.com/photo-1460661419201-fd4cecdf8a8b?auto=format&fit=crop&w=1200&q=80', title: 'Müzik lansman kapak sahnesi', tags: ['Müzik', 'Poster', 'Gemini'] },
    { image: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&w=1200&q=80', title: 'Uzay temalı atmosferik art', tags: ['Konsept', '10/10', 'Together'] },
    { image: 'https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=1200&q=80', title: 'Sosyal içerik kapak düzeni', tags: ['Sosyal', '4:5', 'xAI'] },
  ],
};

function buildUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function safeText(value: unknown, fallback = ''): string {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function safeNumber(value: unknown, fallback = 0): number {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function ensureArray<T>(value: unknown): T[] {
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

function randomId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getClientId(): string {
  if (typeof window === 'undefined') return 'image-tsx';
  try {
    const existing = window.localStorage.getItem('image.tsx.clientId');
    if (existing) return existing;
    const next = randomId('imgui');
    window.localStorage.setItem('image.tsx.clientId', next);
    return next;
  } catch {
    return randomId('imgui');
  }
}

function ratioFromSize(width: number, height: number): RatioKey {
  const label = `${Math.max(1, width)}:${Math.max(1, height)}`;
  const exact = RATIO_OPTIONS.find((item) => item.width === width && item.height === height);
  if (exact) return exact.key;
  if (label === '1024:1024') return '1:1';
  return '1:1';
}

function ratioLabel(ratio: RatioKey): string {
  return ratio;
}

function resolveSizeFromRatio(ratio: RatioKey): { width: number; height: number } {
  const found = RATIO_OPTIONS.find((item) => item.key === ratio) || RATIO_OPTIONS[0];
  return { width: found.width, height: found.height };
}

function isHttpImage(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const text = value.trim();
  return /^https?:\/\//i.test(text) || text.startsWith('data:image/') || text.startsWith('blob:');
}

function collectImagesDeep(value: unknown, collector = new Set<string>()): string[] {
  if (isHttpImage(value)) {
    collector.add(value);
    return [...collector];
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImagesDeep(item, collector));
    return [...collector];
  }

  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    ['url', 'src', 'image_url'].forEach((key) => {
      if (isHttpImage(record[key])) collector.add(record[key] as string);
    });
    ['images', 'gorseller', 'parcaliSonuclar', 'cikti', 'sonuc', 'ham'].forEach((key) => {
      if (record[key] != null) collectImagesDeep(record[key], collector);
    });
  }

  return [...collector];
}

function healthToneFromStatus(status?: string | null, score?: number | null): HealthTone {
  const text = safeText(status).toLowerCase();
  if (typeof score === 'number') {
    if (score >= 85) return 'ok';
    if (score >= 60) return 'warn';
    return 'bad';
  }
  if (text === 'hazir' || text === 'ok' || text === 'iyi') return 'ok';
  if (text === 'uyari' || text === 'izlenmeli') return 'warn';
  if (text) return 'bad';
  return 'idle';
}

function toneText(tone: HealthTone): string {
  if (tone === 'ok') return 'Çevrimiçi';
  if (tone === 'warn') return 'Uyarı';
  if (tone === 'bad') return 'Sorun';
  return 'Kontrol ediliyor';
}

function runStatusText(status?: string | null): string {
  const value = safeText(status).toLowerCase();
  if (['tamamlandi', 'completed'].includes(value)) return 'Tamamlandı';
  if (['hazirlaniyor'].includes(value)) return 'Hazırlanıyor';
  if (['isleniyor', 'running', 'processing'].includes(value)) return 'İşleniyor';
  if (['yeniden_denemede'].includes(value)) return 'Yeniden deneniyor';
  if (['basarisiz', 'failed'].includes(value)) return 'Başarısız';
  if (['duraklatildi', 'cancelled'].includes(value)) return 'Duraklatıldı';
  if (['queued', 'kuyrukta'].includes(value)) return 'Sırada';
  return safeText(status, 'Bilinmiyor');
}

function isAmhTerminal(status?: string | null): boolean {
  const value = safeText(status).toLowerCase();
  return ['tamamlandi', 'basarisiz', 'duraklatildi', 'completed', 'failed', 'cancelled'].includes(value);
}

function extractErrorMessage(error: unknown, fallback: string): string {
  if (error instanceof DOMException && error.name === 'AbortError') return 'İstek zaman aşımına uğradı.';
  if (error instanceof Error) return safeText(error.message, fallback);
  return fallback;
}

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  if (/<!doctype|<html/i.test(text)) {
    throw new Error('Beklenmeyen HTML yanıtı alındı. Worker URL veya endpoint yönlendirmesini kontrol et.');
  }

  if (!contentType.toLowerCase().includes('application/json')) {
    throw new Error('JSON beklenirken farklı içerik tipi döndü.');
  }

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error('Worker geçerli JSON döndürmedi.');
  }
}

async function requestAmg<T>(path: string, init?: RequestInit): Promise<AmgEnvelope<T>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(buildUrl(AMG_BASE_URL, path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    const payload = await parseJsonResponse<AmgEnvelope<T>>(response);
    if (!response.ok || payload.ok === false) {
      throw new Error(safeText(payload.hata, `AMG isteği başarısız oldu (${response.status}).`));
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

async function requestAmh<T>(path: string, init?: RequestInit): Promise<AmhEnvelope<T>> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(buildUrl(AMH_BASE_URL, path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(init?.headers || {}),
      },
    });
    const payload = await parseJsonResponse<AmhEnvelope<T>>(response);
    if (!response.ok || payload.ok === false) {
      throw new Error(safeText(payload.hata?.mesaj, `AMH isteği başarısız oldu (${response.status}).`));
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

export default function ImagePage(): JSX.Element {
  const clientId = useMemo(() => getClientId(), []);
  const pollRef = useRef<number | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const modelWrapRef = useRef<HTMLDivElement | null>(null);

  const [workerMode, setWorkerMode] = useState<WorkerMode>('amg');
  const [autoFallback, setAutoFallback] = useState(true);

  const [providerFilter, setProviderFilter] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');

  const [prompt, setPrompt] = useState('');
  const [negativePrompt, setNegativePrompt] = useState('');
  const [style, setStyle] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [quality, setQuality] = useState<Quality>('medium');
  const [ratio, setRatio] = useState<RatioKey>('1:1');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [count, setCount] = useState(1);
  const [testMode, setTestMode] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [amgHealth, setAmgHealth] = useState<AmgHealthPayload | null>(null);
  const [amhHealth, setAmhHealth] = useState<AmhHealthPayload | null>(null);
  const [amhPanel, setAmhPanel] = useState<AmhPanelPayload | null>(null);

  const [result, setResult] = useState<ResultCard | null>(null);
  const [localHistory, setLocalHistory] = useState<LocalRunRecord[]>([]);

  const [amhJobId, setAmhJobId] = useState('');
  const [amhJobStatus, setAmhJobStatus] = useState<AmhJobStatusPayload | null>(null);
  const [amhHistory, setAmhHistory] = useState<AmhHistoryEvent[]>([]);
  const [amhArchive, setAmhArchive] = useState<AmhArchivePayload['arsiv'] | null>(null);
  const [amhRunPayload, setAmhRunPayload] = useState<AmhRunPayload | null>(null);

  const [amgHealthTest, setAmgHealthTest] = useState<JsonRecord | null>(null);
  const [amgSharedState, setAmgSharedState] = useState<JsonRecord | null>(null);
  const [amhDiagnostics, setAmhDiagnostics] = useState<JsonRecord | null>(null);
  const [amhServiceDiagnostics, setAmhServiceDiagnostics] = useState<JsonRecord | null>(null);
  const [amhProviderDiagnostics, setAmhProviderDiagnostics] = useState<JsonRecord | null>(null);
  const [amhProof, setAmhProof] = useState<JsonRecord | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => item.kimlik === selectedModelId) || null,
    [models, selectedModelId],
  );

  const providerOptions = useMemo(() => {
    const dynamic = Array.from(new Set(models.map((item) => safeText(item.saglayici)).filter(Boolean)));
    return Array.from(new Set([...DEFAULT_PROVIDER_OPTIONS, ...dynamic]));
  }, [models]);

  const previewCards = useMemo(() => {
    const base = PAGE_DATA[currentPage] || PAGE_DATA[1];
    if (!result?.images?.length || currentPage !== 1) return base;
    const mapped = [...base];
    result.images.slice(0, 4).forEach((src, index) => {
      mapped[index] = {
        image: src,
        title: index === 0 ? 'Yeni oluşturulan görsel' : `Üretilen görsel ${index + 1}`,
        tags: [ratioLabel(ratio), quality, result.provider || safeText(selectedModel?.saglayici, 'Model')],
      };
    });
    return mapped;
  }, [currentPage, quality, ratio, result, selectedModel]);

  const amgTone = healthToneFromStatus(amgHealth?.durum ?? amgHealth?.servis ?? null, null);
  const amhTone = healthToneFromStatus(amhHealth?.durum ?? null, amhHealth?.saglik?.saglikPuani ?? null);
  const panelTone = healthToneFromStatus(amhPanel?.durum ?? null, amhPanel?.genelSaglikPuani ?? null);

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const loadWorkerHealth = useCallback(async () => {
    try {
      const [amg, amh, panel] = await Promise.all([
        requestAmg<AmgHealthPayload>('/api/durum'),
        requestAmh<AmhHealthPayload>('/api/durum'),
        requestAmh<AmhPanelPayload>('/api/panel'),
      ]);
      setAmgHealth(amg.veri || null);
      setAmhHealth(amh.veri || null);
      setAmhPanel(panel.veri || null);
    } catch (loadError) {
      console.error(loadError);
    }
  }, []);

  const loadDiagnostics = useCallback(async (forcedProvider?: string) => {
    const provider = safeText(forcedProvider || selectedModel?.saglayici || providerFilter || 'auto', 'auto');
    const results = await Promise.allSettled([
      requestAmg<JsonRecord>('/api/test/saglik'),
      requestAmg<JsonRecord>('/api/ortak-durum/oku'),
      requestAmh<JsonRecord>('/api/ispat/ozet'),
      requestAmh<JsonRecord>('/api/teshis/IMG'),
      requestAmh<JsonRecord>(`/api/saglayici/IMG/${encodeURIComponent(provider)}`),
      requestAmh<JsonRecord>('/api/teshis', {
        method: 'POST',
        body: JSON.stringify({ hizmetTuru: 'IMG', saglayici: provider, gorunum: 'panel' }),
      }),
    ]);

    if (results[0].status === 'fulfilled') setAmgHealthTest(results[0].value.veri || null);
    if (results[1].status === 'fulfilled') setAmgSharedState(results[1].value.veri || null);
    if (results[2].status === 'fulfilled') setAmhProof(results[2].value.veri || null);
    if (results[3].status === 'fulfilled') setAmhServiceDiagnostics(results[3].value.veri || null);
    if (results[4].status === 'fulfilled') setAmhProviderDiagnostics(results[4].value.veri || null);
    if (results[5].status === 'fulfilled') setAmhDiagnostics(results[5].value.veri || null);
  }, [providerFilter, selectedModel]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const params = new URLSearchParams();
      if (providerFilter) params.set('saglayici', providerFilter);
      if (modelSearch.trim()) params.set('ara', modelSearch.trim());
      params.set('sinir', '200');
      const envelope = await requestAmg<AmgModelsPayload>(`/api/modeller?${params.toString()}`);
      const nextModels = ensureArray<ModelItem>(envelope.veri?.modeller).filter((item) => safeText(item.kimlik) && safeText(item.ad));
      setModels(nextModels);
      setSelectedModelId((current) => (current && nextModels.some((item) => item.kimlik === current) ? current : safeText(nextModels[0]?.kimlik)));
    } catch (loadError) {
      setError(extractErrorMessage(loadError, 'Model listesi alınamadı.'));
    } finally {
      setModelsLoading(false);
    }
  }, [modelSearch, providerFilter]);

  const loadAmhArtifacts = useCallback(async (jobId: string) => {
    if (!jobId) return;
    try {
      const [statusEnvelope, historyEnvelope, archiveEnvelope, panelEnvelope] = await Promise.all([
        requestAmh<AmhJobStatusPayload>(`/api/is/${encodeURIComponent(jobId)}`),
        requestAmh<AmhHistoryPayload>(`/api/is/${encodeURIComponent(jobId)}/gecmis`),
        requestAmh<AmhArchivePayload>(`/api/is/${encodeURIComponent(jobId)}/arsiv`),
        requestAmh<AmhPanelPayload>('/api/panel'),
      ]);
      setAmhJobStatus(statusEnvelope.veri || null);
      setAmhHistory(ensureArray<AmhHistoryEvent>(historyEnvelope.veri?.gecmis));
      setAmhArchive(archiveEnvelope.veri?.arsiv || null);
      setAmhPanel(panelEnvelope.veri || null);

      const archiveImages = collectImagesDeep(archiveEnvelope.veri?.arsiv?.sonuc);
      if (archiveImages.length) {
        setResult((current) => ({
          source: 'AMH',
          status: runStatusText(statusEnvelope.veri?.durum),
          message: safeText(archiveEnvelope.veri?.arsiv?.sonMesaj, current?.message || 'AMH işi güncellendi.'),
          images: archiveImages,
          model: safeText(amhRunPayload?.etkinAyar?.model, current?.model || safeText(selectedModel?.ad, '-')),
          provider: safeText(amhRunPayload?.etkinAyar?.saglayici, current?.provider || safeText(selectedModel?.saglayici, '-')),
          prompt,
          fallbackUsed: current?.fallbackUsed,
          raw: archiveEnvelope.veri?.arsiv,
        }));
      }
    } catch (artifactError) {
      console.error(artifactError);
    }
  }, [amhRunPayload, prompt, selectedModel]);

  const pollAmhJob = useCallback(async (jobId: string) => {
    stopPolling();
    if (!jobId) return;

    try {
      const envelope = await requestAmh<AmhJobStatusPayload>(`/api/is/${encodeURIComponent(jobId)}/izle`);
      const payload = envelope.veri || null;
      setAmhJobStatus(payload);
      setResult((current) => {
        if (!current || current.source !== 'AMH') return current;
        return {
          ...current,
          status: runStatusText(payload?.durum),
          message: safeText(payload?.aktifAdim, current.message || 'AMH işi sürüyor.'),
        };
      });

      if (!payload || isAmhTerminal(payload.durum) || safeNumber(payload.yuzde, 0) >= 100) {
        await loadAmhArtifacts(jobId);
        setSubmitting(false);
        return;
      }

      pollRef.current = window.setTimeout(() => {
        void pollAmhJob(jobId);
      }, POLL_MS);
    } catch (pollError) {
      setSubmitting(false);
      setError(extractErrorMessage(pollError, 'AMH iş durumu alınamadı.'));
    }
  }, [loadAmhArtifacts, stopPolling]);

  const resetResultState = useCallback(() => {
    stopPolling();
    setResult(null);
    setAmhJobId('');
    setAmhJobStatus(null);
    setAmhHistory([]);
    setAmhArchive(null);
    setAmhRunPayload(null);
  }, [stopPolling]);

  useEffect(() => {
    void loadWorkerHealth();
  }, [loadWorkerHealth]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadModels();
    }, 240);
    return () => window.clearTimeout(timer);
  }, [loadModels]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadDiagnostics();
    }, 320);
    return () => window.clearTimeout(timer);
  }, [loadDiagnostics]);

  useEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) return;
    textarea.style.height = '56px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [negativePrompt, prompt, referenceImageUrl]);

  useEffect(() => {
    const onOutside = (event: MouseEvent) => {
      if (!modelWrapRef.current) return;
      if (!modelWrapRef.current.contains(event.target as Node)) setModelMenuOpen(false);
    };
    document.addEventListener('mousedown', onOutside);
    return () => document.removeEventListener('mousedown', onOutside);
  }, []);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pushLocalHistory = useCallback((entry: LocalRunRecord) => {
    setLocalHistory((current) => [entry, ...current].slice(0, 12));
  }, []);

  const amgGenerate = useCallback(async () => {
    if (!selectedModel) throw new Error('Model seçmelisin.');
    const payload = {
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim(),
      model: selectedModel.kimlik,
      modelId: selectedModel.kimlik,
      kalite: quality,
      genislik: width,
      yukseklik: height,
      adet: count,
      n: count,
      testModu: testMode,
      test_mode: testMode,
      istemciKimligi: clientId,
    };

    const envelope = await requestAmg<AmgGeneratePayload>('/api/gorsel', {
      method: 'POST',
      headers: { 'X-Istemci-Kimligi': clientId },
      body: JSON.stringify(payload),
    });

    const imageUrl = safeText(envelope.veri?.url);
    const images = imageUrl ? [imageUrl] : collectImagesDeep(envelope.veri?.ham);
    if (!images.length) throw new Error('AMG görsel URL döndürmedi.');

    const nextResult: ResultCard = {
      source: 'AMG',
      status: 'Tamamlandı',
      message: 'AMG doğrudan üretimi tamamladı.',
      images,
      model: safeText(envelope.veri?.model, selectedModel.ad),
      provider: safeText(selectedModel.saglayici, '-'),
      prompt: prompt.trim(),
      raw: envelope.veri,
    };

    setResult(nextResult);
    pushLocalHistory({
      id: randomId('run'),
      source: 'AMG',
      status: nextResult.status,
      prompt: nextResult.prompt,
      images: nextResult.images,
      model: nextResult.model,
      provider: nextResult.provider,
      at: new Date().toISOString(),
    });
  }, [clientId, count, negativePrompt, prompt, pushLocalHistory, quality, selectedModel, testMode, width, height]);

  const amhGenerate = useCallback(async (fallbackUsed = false) => {
    if (!selectedModel) throw new Error('Model seçmelisin.');

    const correlationId = randomId('corr');
    const body = {
      serviceType: 'IMG',
      hizmetTuru: 'IMG',
      prompt: prompt.trim(),
      negativePrompt: negativePrompt.trim(),
      model: selectedModel.kimlik,
      saglayici: safeText(selectedModel.saglayici),
      kalite: quality,
      oran: ratioLabel(ratio),
      adet: count,
      n: count,
      stil: style.trim(),
      referansGorsel: safeText(referenceImageUrl) || null,
      testModu: testMode,
      test_mode: testMode,
      kullaniciKimligi: clientId,
    };

    const envelope = await requestAmh<AmhRunPayload>('/api/calistir', {
      method: 'POST',
      headers: {
        'X-Istemci-Kimligi': clientId,
        'X-Korelasyon-Anahtari': correlationId,
        'X-Saglayici': safeText(selectedModel.saglayici),
        'X-Kalite-Seviyesi': quality,
      },
      body: JSON.stringify(body),
    });

    const payload = envelope.veri || null;
    const nextJobId = safeText(payload?.baglam?.isKimligi || envelope.meta?.isKimligi);
    const images = collectImagesDeep(payload?.sonuc);

    setAmhRunPayload(payload);
    setAmhJobId(nextJobId);
    setAmhJobStatus({
      isKimligi: nextJobId,
      durum: images.length ? 'tamamlandi' : 'isleniyor',
      yuzde: images.length ? 100 : 20,
      aktifAdim: images.length ? 'tamamlandı' : 'işleniyor',
      sonGuncelleme: new Date().toISOString(),
    });

    setResult({
      source: 'AMH',
      status: images.length ? 'Tamamlandı' : 'İşleniyor',
      message: images.length ? 'AMH orkestra üretimi tamamladı.' : 'AMH işi başlatıldı ve izleniyor.',
      images,
      model: safeText(payload?.etkinAyar?.model, selectedModel.ad),
      provider: safeText(payload?.etkinAyar?.saglayici, selectedModel.saglayici),
      prompt: prompt.trim(),
      fallbackUsed,
      raw: payload,
    });

    if (nextJobId) {
      pushLocalHistory({
        id: nextJobId,
        source: 'AMH',
        status: images.length ? 'Tamamlandı' : 'İşleniyor',
        prompt: prompt.trim(),
        images,
        model: safeText(payload?.etkinAyar?.model, selectedModel.ad),
        provider: safeText(payload?.etkinAyar?.saglayici, selectedModel.saglayici),
        at: new Date().toISOString(),
        fallbackUsed,
      });
      await loadAmhArtifacts(nextJobId);
      if (!images.length) {
        await pollAmhJob(nextJobId);
      }
    }
  }, [clientId, count, loadAmhArtifacts, negativePrompt, pollAmhJob, prompt, pushLocalHistory, quality, ratio, referenceImageUrl, selectedModel, style, testMode]);

  const handleGenerate = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    setError('');
    setNotice('');

    if (!trimmedPrompt) {
      setError('Prompt zorunlu.');
      return;
    }

    if (trimmedPrompt.length > MAX_AMH_PROMPT) {
      setError(`Prompt ${MAX_AMH_PROMPT} karakteri aşamaz.`);
      return;
    }

    if (!selectedModel) {
      setError('Model seçmelisin.');
      return;
    }

    resetResultState();
    setSubmitting(true);

    try {
      if (workerMode === 'amg') {
        try {
          if (trimmedPrompt.length > MAX_PROMPT) {
            throw new Error(`AMG prompt sınırı ${MAX_PROMPT} karakter. AMH fallback kullanılacak.`);
          }
          await amgGenerate();
          setNotice('Birincil worker AMG kullanıldı.');
        } catch (amgError) {
          if (!autoFallback) throw amgError;
          setNotice(`AMG hata verdi, AMH fallback devreye alındı: ${extractErrorMessage(amgError, 'AMG başarısız oldu.')}`);
          await amhGenerate(true);
        }
      } else {
        await amhGenerate(false);
        setNotice('AMH orkestrasyon akışı kullanıldı.');
      }
      await loadWorkerHealth();
      await loadDiagnostics();
    } catch (generateError) {
      setError(extractErrorMessage(generateError, 'Görsel üretimi başlatılamadı.'));
    } finally {
      setSubmitting(false);
    }
  }, [amgGenerate, amhGenerate, autoFallback, loadDiagnostics, loadWorkerHealth, prompt, resetResultState, selectedModel, workerMode]);

  const loadHistoryRecord = useCallback(async (entry: LocalRunRecord) => {
    setError('');
    setNotice('');
    setResult({
      source: entry.source,
      status: entry.status,
      message: 'Geçmiş kayıt açıldı.',
      images: entry.images,
      model: entry.model,
      provider: entry.provider,
      prompt: entry.prompt,
      fallbackUsed: entry.fallbackUsed,
    });

    if (entry.source === 'AMH') {
      setAmhJobId(entry.id);
      await loadAmhArtifacts(entry.id);
    } else {
      setAmhJobId('');
      setAmhJobStatus(null);
      setAmhHistory([]);
      setAmhArchive(null);
      setAmhRunPayload(null);
    }
  }, [loadAmhArtifacts]);

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
          --warn: #b78328;
          --bad: #bf4a4a;
          --ok: #5c8f88;
          --shadow: 0 12px 32px rgba(15, 23, 42, 0.05);
          --shadow-soft: 0 6px 18px rgba(15, 23, 42, 0.04);
        }

        * { box-sizing: border-box; }
        html, body { height: 100%; }
        body { margin: 0; }

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
          flex-wrap: wrap;
          justify-content: flex-end;
        }

        .status {
          min-height: 40px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #f8f9fb;
          color: #4b5563;
          font-size: 14px;
          font-weight: 700;
          padding: 8px 16px;
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

        .status.ok::before { background: var(--ok); box-shadow: 0 0 0 3px rgba(92, 143, 136, 0.16); }
        .status.warn::before { background: var(--warn); box-shadow: 0 0 0 3px rgba(183, 131, 40, 0.16); }
        .status.bad::before { background: var(--bad); box-shadow: 0 0 0 3px rgba(191, 74, 74, 0.16); }

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
        .quality-pills .pill,
        .worker-pills .pill {
          min-height: 42px;
          padding: 0 18px;
          font-size: 15px;
        }

        .mode-pills .pill.active,
        .ratio-pills .pill.active,
        .duration-pills .pill.active,
        .sort-pills .pill.active,
        .quality-pills .pill.active,
        .worker-pills .pill.active {
          background: linear-gradient(180deg, #7ea9a3 0%, #5c8f88 100%);
          color: #ffffff;
        }

        .toolbar-input,
        .toolbar-select {
          min-height: 42px;
          border-radius: 14px;
          border: 1px solid #dbe0e8;
          background: #ffffff;
          padding: 0 14px;
          color: #202123;
          font-size: 14px;
          min-width: 180px;
          outline: none;
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
          align-items: stretch;
        }

        .composer {
          min-height: 130px;
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

        .composer textarea::placeholder,
        .mini-field::placeholder { color: #7f8795; }

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

        .composer-tools {
          display: flex;
          flex-direction: column;
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
          min-width: 220px;
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

        .generate:disabled,
        .cancel-btn:disabled,
        .ghost-btn:disabled { opacity: 0.65; cursor: not-allowed; }

        .cancel-btn,
        .ghost-btn {
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

        .hero-meta {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          flex-wrap: wrap;
        }

        .subhint {
          color: #555d6b;
          font-size: 15px;
          line-height: 1.6;
        }

        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; word-break: break-word; }

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
          min-width: 360px;
          max-height: 360px;
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

        .error-box,
        .notice-box {
          margin: 0 28px;
          border-radius: 18px;
          padding: 14px 16px;
        }

        .error-box {
          border: 1px solid #fca5a5;
          background: #fff1f2;
          color: #991b1b;
        }

        .notice-box {
          border: 1px solid #bfdbfe;
          background: #eff6ff;
          color: #1d4ed8;
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

        .media-tag,
        .tiny-badge {
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

        .progress-box,
        .info-box,
        .list-card {
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

        .result-grid,
        .result-image-grid {
          display: grid;
          gap: 12px;
          grid-template-columns: repeat(2, minmax(0, 1fr));
        }

        .result-image-grid img,
        .preview-large img {
          width: 100%;
          border-radius: 18px;
          border: 1px solid #e5e7eb;
          display: block;
          object-fit: cover;
        }

        .log-list {
          display: grid;
          gap: 10px;
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

        .json-box pre,
        pre {
          margin: 0;
          padding: 14px;
          font-size: 11px;
          color: #d5f5e3;
          background: #0f172a;
          max-height: 280px;
          overflow: auto;
          border-radius: 0;
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

        .split-stats {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
        }

        .tiny,
        .muted { font-size: 12px; color: #667085; }
        .soft-text { color: #475467; font-size: 14px; line-height: 1.6; }
        .stack { display: grid; gap: 12px; }
        .row-wrap { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }

        @media (max-width: 1280px) {
          .media-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
          .suggestions { grid-template-columns: 1fr; }
          .details-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 980px) {
          .app-shell { padding: 10px; }
          .app { min-height: calc(100vh - 20px); }
          .topbar { padding: 16px; align-items: flex-start; flex-direction: column; }
          .nav { gap: 18px; }
          .toolbar, .hero, .media-grid, .footer-row, .details-grid { padding-left: 16px; padding-right: 16px; }
          .prompt-top { grid-template-columns: 1fr; }
          .hero-meta { flex-direction: column; align-items: flex-start; }
          .generate, .cancel-btn, .ghost-btn { width: 100%; }
        }

        @media (max-width: 760px) {
          .media-grid, .result-grid, .result-image-grid, .split-stats { grid-template-columns: 1fr; }
          .toolbar-row, .detail-filters { justify-content: flex-start; }
          .pagination-block { flex-direction: column; align-items: flex-start; }
          .model-select-wrap, .model-select { width: 100%; }
          .model-select { justify-content: center; }
          .composer { flex-direction: column; align-items: stretch; }
          .composer-tools { justify-content: flex-start; flex-wrap: wrap; flex-direction: row; }
          .toolbar-input, .toolbar-select { width: 100%; min-width: 0; }
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
              <div className={`status ${amgTone}`}>AMG · {toneText(amgTone)}</div>
              <div className={`status ${amhTone}`}>AMH · {toneText(amhTone)}</div>
              <div className={`status ${panelTone}`}>Panel · {toneText(panelTone)}</div>
              <button className="icon-ghost" aria-label="Tanıyı yenile" type="button" onClick={() => void loadDiagnostics()}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><circle cx="5" cy="12" r="2"></circle><circle cx="12" cy="12" r="2"></circle><circle cx="19" cy="12" r="2"></circle></svg>
              </button>
            </div>
          </header>

          <main className="page">
            <section className="toolbar">
              <div className="toolbar-row">
                <div className="toolbar-label">Akış</div>
                <div className="pill-track worker-pills">
                  <button type="button" className={`pill ${workerMode === 'amg' ? 'active' : ''}`} onClick={() => setWorkerMode('amg')}>AMG birincil</button>
                  <button type="button" className={`pill ${workerMode === 'amh' ? 'active' : ''}`} onClick={() => setWorkerMode('amh')}>AMH orkestra</button>
                </div>
                <div className="toolbar-label">Kalite</div>
                <div className="pill-track quality-pills">
                  {QUALITY_OPTIONS.map((item) => (
                    <button key={item} type="button" className={`pill ${quality === item ? 'active' : ''}`} onClick={() => setQuality(item)}>{item}</button>
                  ))}
                </div>
              </div>

              <div className="toolbar-row">
                <div ref={modelWrapRef} className={`model-select-wrap ${modelMenuOpen ? 'open' : ''}`}>
                  <button className="model-select" type="button" aria-expanded={modelMenuOpen} onClick={() => setModelMenuOpen((prev) => !prev)}>
                    <span>{selectedModel ? `${selectedModel.ad} · ${selectedModel.saglayici}` : modelsLoading ? 'Model yükleniyor' : 'Model seçimi'}</span>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                  </button>
                  <div className="model-menu">
                    {modelsLoading && <button className="model-option active" type="button" disabled>Model yükleniyor...</button>}
                    {!modelsLoading && models.length === 0 && <button className="model-option active" type="button" disabled>Görsel modeli bulunamadı</button>}
                    {!modelsLoading && models.map((item) => {
                      const active = item.kimlik === selectedModelId;
                      return (
                        <button key={item.kimlik} className={`model-option ${active ? 'active' : ''}`} type="button" onClick={() => { setSelectedModelId(item.kimlik); setModelMenuOpen(false); }}>
                          <div className="model-option-text">
                            <span className="model-option-name">{item.ad}</span>
                            <span className="model-option-meta">{safeText(item.saglayici, '-')} · bağlam {safeNumber(item.baglam, 0) || '-'}</span>
                          </div>
                          <span className="model-option-speed">{safeText(item.kimlik, 'model')}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="pill-track sort-pills">
                  {STYLE_OPTIONS.map((item) => (
                    <button key={item || 'default-style'} type="button" className={`pill ${style === item ? 'active' : ''}`} onClick={() => setStyle(item)}>
                      {item || 'Varsayılan'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="detail-filters">
                <div className="filter-group">
                  <div className="mini-label">Sağlayıcı</div>
                  <select className="toolbar-select" value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
                    {providerOptions.map((provider) => <option key={provider || 'all'} value={provider}>{provider || 'Tümü'}</option>)}
                  </select>
                </div>
                <div className="filter-group">
                  <div className="mini-label">Model ara</div>
                  <input className="toolbar-input" value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="AMG /api/modeller üzerinde ara" />
                </div>
                <div className="filter-group">
                  <div className="mini-label">Oran</div>
                  <div className="pill-track ratio-pills">
                    {RATIO_OPTIONS.map((item) => (
                      <button key={item.key} type="button" className={`pill ${ratio === item.key ? 'active' : ''}`} onClick={() => { setRatio(item.key); setWidth(item.width); setHeight(item.height); }}>
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="filter-group">
                  <div className="mini-label">Test Modu</div>
                  <div className="pill-track mode-pills">
                    <button type="button" className={`pill ${!testMode ? 'active' : ''}`} onClick={() => setTestMode(false)}>Kapalı</button>
                    <button type="button" className={`pill ${testMode ? 'active' : ''}`} onClick={() => setTestMode(true)}>Açık</button>
                  </div>
                </div>
                <div className="filter-group">
                  <div className="mini-label">Adet</div>
                  <div className="pill-track duration-pills">
                    {[1, 2, 3, 4].map((item) => <button key={item} type="button" className={`pill ${count === item ? 'active' : ''}`} onClick={() => setCount(item)}>{item}</button>)}
                  </div>
                </div>
                <div className="filter-group">
                  <div className="mini-label">Fallback</div>
                  <div className="pill-track mode-pills">
                    <button type="button" className={`pill ${autoFallback ? 'active' : ''}`} onClick={() => setAutoFallback(true)} disabled={workerMode !== 'amg'}>Açık</button>
                    <button type="button" className={`pill ${!autoFallback ? 'active' : ''}`} onClick={() => setAutoFallback(false)} disabled={workerMode !== 'amg'}>Kapalı</button>
                  </div>
                </div>
              </div>
            </section>

            {error ? <div className="error-box"><div>{error}</div></div> : null}
            {notice ? <div className="notice-box"><div>{notice}</div></div> : null}

            <section className="hero">
              <div className="hero-card">
                <div className="prompt-top">
                  <div className="composer">
                    <div className="composer-main">
                      <textarea ref={promptRef} rows={1} placeholder="Görsel talimatını yaz. Stil, kalite, oran ve kullanım amacı ile yönlendir." value={prompt} onChange={(event) => setPrompt(event.target.value)} />
                      <textarea className="mini-field" rows={2} placeholder="Negatif prompt (görünüm korunuyor, worker çekirdeği destekliyorsa kullanılır)" value={negativePrompt} onChange={(event) => setNegativePrompt(event.target.value)} />
                      <textarea className="mini-field" rows={2} placeholder="Referans görsel URL (özellikle AMH referans akışı için)" value={referenceImageUrl} onChange={(event) => setReferenceImageUrl(event.target.value)} />
                    </div>
                    <div className="composer-tools">
                      <button className="round-icon" type="button" aria-label="Durumu yenile" onClick={() => { void loadModels(); void loadWorkerHealth(); void loadDiagnostics(); }}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M20 12a8 8 0 1 1-2.34-5.66" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path><path d="M20 4v6h-6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                      </button>
                      <button className="round-icon" type="button" aria-label="Tanı paneli" onClick={() => void loadDiagnostics()}>
                        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2"></circle><path d="M12 10v5M12 7.5h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"></path></svg>
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: 12 }}>
                    <button className="generate" type="button" onClick={() => void handleGenerate()} disabled={submitting || modelsLoading}>
                      {submitting ? 'Görsel Hazırlanıyor' : workerMode === 'amg' ? 'AMG ile Görsel Oluştur' : 'AMH ile Görsel Oluştur'}
                      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"></path></svg>
                    </button>
                    <button className="cancel-btn" type="button" onClick={() => { resetResultState(); setNotice('Sonuç alanı temizlendi.'); setError(''); }} disabled={submitting}>Sonucu Temizle</button>
                    <button className="ghost-btn" type="button" onClick={() => void loadDiagnostics()} disabled={submitting}>Tanıyı Yenile</button>
                  </div>
                </div>

                <div className="hero-meta">
                  <div className="subhint">
                    AMG <strong className="mono">GET /api/modeller</strong> ile <strong>saglayici</strong>, <strong>ara</strong> ve <strong>sinir</strong> filtrelerini kullanır; üretim <strong className="mono">POST /api/gorsel</strong> ile yürür. AMH tarafında <strong className="mono">POST /api/calistir</strong> ana giriş, iş takibi ise <strong className="mono">/api/panel</strong>, <strong className="mono">/api/is/:isKimligi</strong>, <strong className="mono">/gecmis</strong>, <strong className="mono">/arsiv</strong>, <strong className="mono">/izle</strong> ve tanı için <strong className="mono">/api/teshis</strong> zincirini kullanır.
                  </div>
                  <div className="subhint">
                    İstemci kimliği: <strong className="mono">{clientId}</strong> · AMG durum: <strong>{safeText(amgHealth?.durum, '-')}</strong> · AMH sağlık puanı: <strong>{safeNumber(amhHealth?.saglik?.saglikPuani, 0) || '-'}</strong>
                  </div>
                </div>
              </div>

              <div className="suggestions">
                {QUICK_PROMPTS.map((item) => (
                  <button key={item} className="suggestion" type="button" onClick={() => setPrompt(item)}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M12 3c3.3 0 6 2.7 6 6 0 2.1-1 3.6-2.2 4.8-.8.8-1.2 1.4-1.3 2.2H9.5c-.1-.8-.5-1.4-1.3-2.2C7 12.6 6 11.1 6 9c0-3.3 2.7-6 6-6Z" stroke="currentColor" strokeWidth="1.8"></path><path d="M9.5 18h5M10 21h4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"></path></svg>
                    {item}
                  </button>
                ))}
              </div>
            </section>

            <section className="media-grid">
              {previewCards.map((item, index) => (
                <article key={`${item.title}_${index}`} className="card">
                  <img src={item.image} alt={item.title} />
                  <div className="play-badge"><svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 6.5v11l9-5.5-9-5.5Z"></path></svg></div>
                  <div className="card-gradient"></div>
                  <div className="media-meta">
                    <div className="media-title">{item.title}</div>
                    <div className="media-tags">{item.tags.map((tag) => <span key={`${item.title}_${tag}`} className="media-tag">{tag}</span>)}</div>
                  </div>
                </article>
              ))}
            </section>

            <section className="details-grid">
              <div className="detail-panel">
                <div className="detail-title">Aktif İş ve Görsel Önizleme</div>
                {result ? (
                  <div className="stack">
                    <div className="progress-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, flexWrap: 'wrap' }}>
                        <span><strong>Kaynak:</strong> {result.source}{result.fallbackUsed ? ' · fallback' : ''}</span>
                        <span style={{ color: '#64748b' }}><strong>Durum:</strong> {result.status}</span>
                      </div>
                      {result.source === 'AMH' ? (
                        <>
                          <div className="progress-bar"><div style={{ width: `${Math.max(0, Math.min(100, safeNumber(amhJobStatus?.yuzde, result.images.length ? 100 : 0)))}%` }} /></div>
                          <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                            <span>{safeText(amhJobStatus?.aktifAdim, result.message || 'Bekleniyor')}</span>
                            <span>%{Math.max(0, Math.min(100, safeNumber(amhJobStatus?.yuzde, result.images.length ? 100 : 0)))}</span>
                          </div>
                        </>
                      ) : null}
                    </div>
                    <div className="info-box">
                      <div><strong>Model:</strong> {result.model}</div>
                      <div><strong>Sağlayıcı:</strong> {result.provider}</div>
                      <div><strong>Mesaj:</strong> {result.message}</div>
                      <div className="soft-text" style={{ marginTop: 8 }}>{result.prompt}</div>
                    </div>
                    {result.images.length > 0 ? <div className="result-image-grid">{result.images.map((src) => <img key={src} src={src} alt="Üretilen görsel" />)}</div> : <div className="info-box" style={{ textAlign: 'center', color: '#64748b' }}>Görsel hazır olduğunda burada görünecek.</div>}
                    <div className="json-box"><div className="json-head">Sonuç ham gövdesi</div><pre>{prettyJson(result.raw)}</pre></div>
                  </div>
                ) : <div className="info-box" style={{ textAlign: 'center', color: '#64748b' }}>Henüz aktif iş yok.</div>}
              </div>

              <div className="detail-panel">
                <div className="detail-title">Model, Sağlık ve İstek Omurgası</div>
                {selectedModel ? (
                  <div className="stack">
                    <div className="info-box">
                      <div className="row-wrap">
                        <strong>{selectedModel.ad}</strong>
                        <span className="tiny-badge">{safeText(selectedModel.saglayici, '-')}</span>
                        <span className="tiny-badge">{safeText(selectedModel.kimlik, 'kimlik')}</span>
                      </div>
                      <div className="soft-text" style={{ marginTop: 10 }}>AMG liste filtreleri: sağlayıcı={providerFilter || 'tümü'} · arama={modelSearch || 'yok'} · oran={ratioLabel(ratio)} · boyut={width}x{height} · kalite={quality}</div>
                      <div className="soft-text">Takma adlar: {selectedModel.takmaAdlar?.length ? selectedModel.takmaAdlar.join(', ') : 'yok'}</div>
                      <div className="soft-text">Bağlam: {safeNumber(selectedModel.baglam, 0) || '-'} · Azami token: {safeNumber(selectedModel.azamiToken, 0) || '-'}</div>
                    </div>
                    <div className="split-stats">
                      <div className="list-card"><div><strong>AMG durum</strong></div><div className="tiny">{safeText(amgHealth?.durum, '-')} · ortak durum={String(amgHealth?.ortakDurumVar ?? false)}</div><div className="tiny">sağlık test durumu: {safeText(amgHealthTest?.durum, '-')}</div></div>
                      <div className="list-card"><div><strong>AMH durum</strong></div><div className="tiny">{safeText(amhHealth?.durum, '-')} · puan {safeNumber(amhHealth?.saglik?.saglikPuani, 0) || '-'}</div><div className="tiny">panel aktif iş: {safeNumber(amhPanel?.aktifIsSayisi, 0)}</div></div>
                    </div>
                    <div className="json-box"><div className="json-head">AMG üretim gövdesi</div><pre>{prettyJson({ prompt: prompt.trim(), negativePrompt: negativePrompt.trim(), model: selectedModel.kimlik, kalite: quality, genislik: width, yukseklik: height, adet: count, testModu: testMode, istemciKimligi: clientId })}</pre></div>
                    <div className="json-box"><div className="json-head">AMH çalışma gövdesi</div><pre>{prettyJson({ hizmetTuru: 'IMG', prompt: prompt.trim(), negativePrompt: negativePrompt.trim(), model: selectedModel.kimlik, saglayici: safeText(selectedModel.saglayici), kalite: quality, oran: ratioLabel(ratio), adet: count, stil: style.trim(), referansGorsel: safeText(referenceImageUrl) || null, testModu: testMode, kullaniciKimligi: clientId })}</pre></div>
                  </div>
                ) : <div className="info-box" style={{ textAlign: 'center', color: '#64748b' }}>Model seçildiğinde detay burada görünür.</div>}
              </div>
            </section>

            <section className="details-grid" style={{ paddingTop: 0 }}>
              <div className="detail-panel">
                <div className="detail-title">AMH İş Durumu, Geçmiş ve Arşiv</div>
                <div className="stack">
                  {amhJobId ? (
                    <div className="progress-box">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, fontSize: 14, flexWrap: 'wrap' }}>
                        <span><strong>İş kimliği:</strong> <span className="mono">{amhJobId}</span></span>
                        <span style={{ color: '#64748b' }}>{runStatusText(amhJobStatus?.durum)}</span>
                      </div>
                      <div className="progress-bar"><div style={{ width: `${Math.max(0, Math.min(100, safeNumber(amhJobStatus?.yuzde, 0)))}%` }} /></div>
                      <div style={{ marginTop: 8, display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#64748b' }}>
                        <span>{safeText(amhJobStatus?.aktifAdim, 'Bekleniyor')}</span>
                        <span>%{Math.max(0, Math.min(100, safeNumber(amhJobStatus?.yuzde, 0)))}</span>
                      </div>
                      <div className="row-wrap" style={{ marginTop: 10 }}>
                        <button className="ghost-btn" type="button" onClick={() => void loadAmhArtifacts(amhJobId)}>Geçmiş ve arşivi yenile</button>
                        {!isAmhTerminal(amhJobStatus?.durum) ? <button className="ghost-btn" type="button" onClick={() => void pollAmhJob(amhJobId)}>İzlemeyi sürdür</button> : null}
                      </div>
                    </div>
                  ) : <div className="info-box">AMH iş kimliği oluşmadıysa şu an AMG sonucu gösteriliyor olabilir.</div>}
                  <div className="log-list">
                    {amhHistory.length === 0 ? <div className="info-box">Henüz AMH olay geçmişi yok.</div> : amhHistory.map((event) => (
                      <div key={safeText(event.olayKimligi, randomId('evt'))} className="list-card">
                        <div className="row-wrap" style={{ justifyContent: 'space-between' }}><strong>{safeText(event.olay, 'olay')}</strong><span className="tiny">{formatDate(event.zamanDamgasi)}</span></div>
                        <pre>{prettyJson(event.veri)}</pre>
                      </div>
                    ))}
                  </div>
                  <div className="json-box"><div className="json-head">AMH arşiv özeti</div><pre>{prettyJson(amhArchive)}</pre></div>
                </div>
              </div>

              <div className="detail-panel">
                <div className="detail-title">Ek Tanı Panelleri ve Atlanan Worker Yüzleri</div>
                <div className="stack">
                  <div className="split-stats">
                    <div className="list-card"><div><strong>AMG test/saglik</strong></div><div className="tiny">{safeText(amgHealthTest?.mesaj, safeText(amgHealthTest?.durum, '-'))}</div></div>
                    <div className="list-card"><div><strong>AMG ortak durum</strong></div><div className="tiny">{prettyJson(amgSharedState?.durum).slice(0, 120) || '-'}</div></div>
                  </div>
                  <div className="json-box"><div className="json-head">AMH /api/teshis (IMG)</div><pre>{prettyJson(amhDiagnostics)}</pre></div>
                  <div className="json-box"><div className="json-head">AMH /api/teshis/IMG</div><pre>{prettyJson(amhServiceDiagnostics)}</pre></div>
                  <div className="json-box"><div className="json-head">AMH /api/saglayici/IMG/{encodeURIComponent(safeText(selectedModel?.saglayici, providerFilter || 'auto'))}</div><pre>{prettyJson(amhProviderDiagnostics)}</pre></div>
                  <div className="json-box"><div className="json-head">AMH /api/ispat/ozet</div><pre>{prettyJson(amhProof)}</pre></div>
                </div>
              </div>
            </section>

            <section className="details-grid" style={{ paddingTop: 0 }}>
              <div className="detail-panel" style={{ gridColumn: '1 / -1' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
                  <div className="detail-title" style={{ marginBottom: 0 }}>Yerel Geçmiş</div>
                  <div className="row-wrap">
                    <button type="button" className="ghost-btn" style={{ minHeight: 46, minWidth: 120 }} onClick={() => { void loadModels(); void loadWorkerHealth(); void loadDiagnostics(); }}>Yenile</button>
                    <button type="button" className="ghost-btn" style={{ minHeight: 46, minWidth: 120 }} onClick={() => setLocalHistory([])}>Geçmişi Temizle</button>
                  </div>
                </div>
                <div className="log-list">
                  {localHistory.length === 0 ? <div className="info-box" style={{ color: '#64748b' }}>Bu oturumda henüz üretim geçmişi yok.</div> : localHistory.map((entry) => (
                    <button key={entry.id} type="button" onClick={() => void loadHistoryRecord(entry)} className="list-card" style={{ textAlign: 'left', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}><span style={{ fontSize: 14, fontWeight: 700, color: '#1f2937' }}>{entry.source} · {entry.status}{entry.fallbackUsed ? ' · fallback' : ''}</span><span style={{ fontSize: 12, color: '#64748b' }}>{formatDate(entry.at)}</span></div>
                      <div style={{ marginTop: 8, fontSize: 13, color: '#334155' }}>{entry.prompt}</div>
                      <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>{entry.model} · {entry.provider}</div>
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <div className="footer-row">
              <div className="pagination-block">
                <div className="pagination-label">Sayfa Sayısı</div>
                <div className="pagination">
                  <button className="page-arrow" type="button" aria-label="Önceki sayfa" onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M14.5 5.5L8 12l6.5 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>
                  {[1, 2, 3, 4].map((page) => <button key={page} className={`page-btn ${currentPage === page ? 'active' : ''}`} type="button" onClick={() => setCurrentPage(page)}>{page}</button>)}
                  <button className="page-arrow" type="button" aria-label="Sonraki sayfa" onClick={() => setCurrentPage((page) => Math.min(4, page + 1))}><svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="M9.5 5.5L16 12l-6.5 6.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"></path></svg></button>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    </>
  );
}
