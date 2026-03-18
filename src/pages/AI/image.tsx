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
const QUICK_PROMPTS = [
  'Sisli İstanbul gecesi, ıslak taş sokaklar, neon yansımalar, sinematik ışık, gerçekçi detay.',
  'Premium ürün çekimi, siyah arka plan, yumuşak stüdyo ışığı, lüks reklam estetiği.',
  'Anime karakter, dinamik poz, güçlü kontrast, ayrıntılı kostüm, poster kalitesi.',
] as const;

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

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return String(value ?? '');
    } catch {
      return '';
    }
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

  const [workerMode, setWorkerMode] = useState<WorkerMode>('amg');
  const [autoFallback, setAutoFallback] = useState(true);

  const [providerFilter, setProviderFilter] = useState('');
  const [modelSearch, setModelSearch] = useState('');
  const [models, setModels] = useState<ModelItem[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState('');

  const [prompt, setPrompt] = useState('');
  const [style, setStyle] = useState('');
  const [referenceImageUrl, setReferenceImageUrl] = useState('');
  const [quality, setQuality] = useState<Quality>('medium');
  const [ratio, setRatio] = useState<RatioKey>('1:1');
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [count, setCount] = useState(1);
  const [testMode, setTestMode] = useState(false);

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

  const selectedModel = useMemo(
    () => models.find((item) => item.kimlik === selectedModelId) || null,
    [models, selectedModelId],
  );

  const providerOptions = useMemo(() => {
    const dynamic = Array.from(new Set(models.map((item) => safeText(item.saglayici)).filter(Boolean)));
    return Array.from(new Set([...DEFAULT_PROVIDER_OPTIONS, ...dynamic]));
  }, [models]);

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

  useEffect(() => () => stopPolling(), [stopPolling]);

  const pushLocalHistory = useCallback((entry: LocalRunRecord) => {
    setLocalHistory((current) => [entry, ...current].slice(0, 12));
  }, []);

  const amgGenerate = useCallback(async () => {
    if (!selectedModel) throw new Error('Model seçmelisin.');
    const payload = {
      prompt: prompt.trim(),
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
      headers: {
        'X-Istemci-Kimligi': clientId,
      },
      body: JSON.stringify(payload),
    });

    const imageUrl = safeText(envelope.veri?.url);
    const images = imageUrl ? [imageUrl] : collectImagesDeep(envelope.veri?.ham);
    if (!images.length) {
      throw new Error('AMG görsel URL döndürmedi.');
    }

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
  }, [clientId, count, prompt, pushLocalHistory, quality, selectedModel, testMode, width, height]);

  const amhGenerate = useCallback(async (fallbackUsed = false) => {
    if (!selectedModel) throw new Error('Model seçmelisin.');

    const correlationId = randomId('corr');
    const body = {
      serviceType: 'IMG',
      hizmetTuru: 'IMG',
      prompt: prompt.trim(),
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
  }, [clientId, count, loadAmhArtifacts, pollAmhJob, prompt, pushLocalHistory, quality, ratio, referenceImageUrl, selectedModel, style, testMode]);

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
    } catch (generateError) {
      setError(extractErrorMessage(generateError, 'Görsel üretimi başlatılamadı.'));
    } finally {
      setSubmitting(false);
    }
  }, [amgGenerate, amhGenerate, autoFallback, loadWorkerHealth, prompt, resetResultState, selectedModel, workerMode]);

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
          --bg: #f4f6f8;
          --panel: #ffffff;
          --line: #e4e7ec;
          --text: #18212f;
          --muted: #667085;
          --brand: #2f6f64;
          --brand-soft: #edf6f3;
          --shadow: 0 18px 44px rgba(15, 23, 42, 0.08);
          --ok: #1d9f64;
          --warn: #b47c12;
          --bad: #c23636;
        }
        * { box-sizing: border-box; }
        body { margin: 0; }
        .shell {
          min-height: 100vh;
          background: radial-gradient(circle at top, #fafbfc 0%, #eef2f6 100%);
          color: var(--text);
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          padding: 24px;
        }
        .app {
          max-width: 1380px;
          margin: 0 auto;
          display: grid;
          gap: 16px;
        }
        .panel {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        .header {
          padding: 22px 24px 18px;
          display: grid;
          gap: 14px;
        }
        .title-row {
          display: flex;
          justify-content: space-between;
          gap: 16px;
          align-items: center;
          flex-wrap: wrap;
        }
        .title {
          font-size: 30px;
          font-weight: 900;
          letter-spacing: -0.02em;
        }
        .subtitle {
          font-size: 15px;
          color: var(--muted);
          line-height: 1.6;
        }
        .badge-row {
          display: flex;
          flex-wrap: wrap;
          gap: 10px;
        }
        .badge {
          min-height: 40px;
          border-radius: 999px;
          padding: 0 14px;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          border: 1px solid var(--line);
          background: #f8fafc;
          font-size: 14px;
          font-weight: 700;
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; }
        .dot.ok { background: var(--ok); }
        .dot.warn { background: var(--warn); }
        .dot.bad { background: var(--bad); }
        .dot.idle { background: #98a2b3; }
        .grid {
          display: grid;
          grid-template-columns: 1.1fr 0.9fr;
          gap: 16px;
        }
        .section {
          padding: 20px 24px 24px;
          display: grid;
          gap: 18px;
        }
        .section-title {
          font-size: 18px;
          font-weight: 800;
        }
        .controls-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .field {
          display: grid;
          gap: 8px;
        }
        .field.full { grid-column: 1 / -1; }
        .label {
          font-size: 13px;
          font-weight: 800;
          letter-spacing: 0.02em;
          color: #344054;
          text-transform: uppercase;
        }
        input, select, textarea {
          width: 100%;
          border-radius: 16px;
          border: 1px solid #d7dde5;
          background: #fff;
          font: inherit;
          color: var(--text);
          padding: 13px 14px;
          outline: none;
        }
        textarea { min-height: 148px; resize: vertical; }
        .chips { display: flex; flex-wrap: wrap; gap: 10px; }
        .chip {
          min-height: 42px;
          border-radius: 999px;
          padding: 0 16px;
          border: 1px solid #d7dde5;
          background: #fff;
          color: #344054;
          font-weight: 700;
          cursor: pointer;
        }
        .chip.active {
          background: linear-gradient(180deg, #458679 0%, #2f6f64 100%);
          color: #fff;
          border-color: #2f6f64;
        }
        .switch-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
        .switch {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #fff;
          font-size: 14px;
          font-weight: 700;
        }
        .switch input { width: auto; margin: 0; }
        .actions {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          align-items: center;
        }
        .primary, .secondary {
          min-height: 52px;
          border-radius: 999px;
          border: 1px solid transparent;
          padding: 0 22px;
          font-size: 16px;
          font-weight: 800;
          cursor: pointer;
        }
        .primary {
          background: linear-gradient(180deg, #458679 0%, #2f6f64 100%);
          color: white;
          box-shadow: 0 14px 30px rgba(47, 111, 100, 0.22);
        }
        .secondary {
          background: white;
          color: #344054;
          border-color: var(--line);
        }
        .primary:disabled, .secondary:disabled { opacity: 0.58; cursor: not-allowed; }
        .hint, .info-box {
          border-radius: 18px;
          border: 1px solid var(--line);
          background: #f8fafc;
          padding: 14px 16px;
          color: #475467;
          font-size: 14px;
          line-height: 1.6;
        }
        .info-box.brand {
          background: var(--brand-soft);
          border-color: #d5e7e2;
          color: #244b44;
        }
        .error-box {
          border-radius: 18px;
          border: 1px solid #fecaca;
          background: #fff1f2;
          color: #9f1239;
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 700;
        }
        .notice-box {
          border-radius: 18px;
          border: 1px solid #cfe7de;
          background: #f0faf6;
          color: #14532d;
          padding: 14px 16px;
          font-size: 14px;
          font-weight: 700;
        }
        .result-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .image-card {
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid var(--line);
          background: #f8fafc;
          min-height: 220px;
        }
        .image-card img {
          display: block;
          width: 100%;
          height: 100%;
          object-fit: cover;
        }
        .result-meta {
          display: grid;
          gap: 10px;
        }
        .meta-list { display: grid; gap: 8px; font-size: 14px; color: #475467; }
        .list {
          display: grid;
          gap: 10px;
          max-height: 420px;
          overflow: auto;
        }
        .list-card {
          border-radius: 18px;
          border: 1px solid var(--line);
          background: #fff;
          padding: 14px 16px;
          display: grid;
          gap: 8px;
        }
        .history-button {
          width: 100%;
          border: none;
          text-align: left;
          cursor: pointer;
        }
        .tiny {
          font-size: 12px;
          color: #667085;
        }
        .mono {
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace;
          word-break: break-word;
        }
        pre {
          margin: 0;
          border-radius: 16px;
          background: #0f172a;
          color: #d5f5e3;
          padding: 14px;
          font-size: 12px;
          overflow: auto;
          max-height: 260px;
        }
        @media (max-width: 1060px) {
          .grid, .result-grid, .controls-grid { grid-template-columns: 1fr; }
        }
        @media (max-width: 720px) {
          .shell { padding: 12px; }
          .header, .section { padding-left: 16px; padding-right: 16px; }
          .title { font-size: 24px; }
        }
      `}</style>

      <div className="shell">
        <div className="app">
          <section className="panel header">
            <div className="title-row">
              <div>
                <div className="title">IMAGE.TSX</div>
                <div className="subtitle">
                  Birincil worker AMG. İkincil/orchestrator worker AMH. Model listesi AMG <span className="mono">GET /api/modeller</span> ile,
                  üretim AMG <span className="mono">POST /api/gorsel</span> ile; orkestrasyon ise AMH <span className="mono">POST /api/calistir</span> ile yürütülür.
                </div>
              </div>
              <div className="badge-row">
                <div className="badge"><span className={`dot ${amgTone}`}></span> AMG · {toneText(amgTone)}</div>
                <div className="badge"><span className={`dot ${amhTone}`}></span> AMH · {toneText(amhTone)}</div>
                <div className="badge"><span className={`dot ${panelTone}`}></span> Panel · {toneText(panelTone)}</div>
              </div>
            </div>
            <div className="tiny">
              AMG durum: {safeText(amgHealth?.durum, '-')} · AMH sağlık puanı: {safeNumber(amhHealth?.saglik?.saglikPuani, 0) || '-'} · Panel aktif iş: {safeNumber(amhPanel?.aktifIsSayisi, 0)}
            </div>
          </section>

          {error ? <div className="error-box">{error}</div> : null}
          {notice ? <div className="notice-box">{notice}</div> : null}

          <div className="grid">
            <section className="panel section">
              <div className="section-title">Üretim Formu</div>

              <div className="field full">
                <div className="label">Prompt</div>
                <textarea
                  placeholder="Ne üretileceğini açık yaz. Stil, ışık, kompozisyon ve kullanım amacı ekle."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <div className="tiny">AMG sınırı {MAX_PROMPT}, AMH IMG sınırı {MAX_AMH_PROMPT} karakter.</div>
              </div>

              <div className="chips">
                {QUICK_PROMPTS.map((item) => (
                  <button key={item} type="button" className="chip" onClick={() => setPrompt(item)}>
                    Hızlı prompt
                  </button>
                ))}
              </div>

              <div className="controls-grid">
                <div className="field">
                  <div className="label">Çalışma modu</div>
                  <div className="chips">
                    <button type="button" className={`chip ${workerMode === 'amg' ? 'active' : ''}`} onClick={() => setWorkerMode('amg')}>
                      AMG birincil
                    </button>
                    <button type="button" className={`chip ${workerMode === 'amh' ? 'active' : ''}`} onClick={() => setWorkerMode('amh')}>
                      AMH orkestra
                    </button>
                  </div>
                </div>

                <div className="field">
                  <div className="label">Sağlayıcı filtresi</div>
                  <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
                    <option value="">Tümü</option>
                    {providerOptions.filter(Boolean).map((provider) => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <div className="label">Model arama</div>
                  <input
                    value={modelSearch}
                    onChange={(event) => setModelSearch(event.target.value)}
                    placeholder="AMG /api/modeller üzerinde ara"
                  />
                </div>

                <div className="field">
                  <div className="label">Model</div>
                  <select
                    value={selectedModelId}
                    onChange={(event) => setSelectedModelId(event.target.value)}
                    disabled={modelsLoading || !models.length}
                  >
                    {!models.length ? <option value="">{modelsLoading ? 'Modeller yükleniyor...' : 'Model bulunamadı'}</option> : null}
                    {models.map((item) => (
                      <option key={item.kimlik} value={item.kimlik}>
                        {item.ad} · {item.saglayici}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <div className="label">Kalite</div>
                  <div className="chips">
                    {QUALITY_OPTIONS.map((item) => (
                      <button key={item} type="button" className={`chip ${quality === item ? 'active' : ''}`} onClick={() => setQuality(item)}>
                        {item}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <div className="label">Oran</div>
                  <div className="chips">
                    {RATIO_OPTIONS.map((item) => (
                      <button
                        key={item.key}
                        type="button"
                        className={`chip ${ratio === item.key ? 'active' : ''}`}
                        onClick={() => {
                          setRatio(item.key);
                          setWidth(item.width);
                          setHeight(item.height);
                        }}
                      >
                        {item.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <div className="label">Genişlik</div>
                  <input
                    type="number"
                    min={256}
                    max={2048}
                    step={1}
                    value={width}
                    onChange={(event) => {
                      const nextWidth = Math.max(256, Math.min(2048, safeNumber(event.target.value, 1024)));
                      setWidth(nextWidth);
                      setRatio(ratioFromSize(nextWidth, height));
                    }}
                  />
                </div>

                <div className="field">
                  <div className="label">Yükseklik</div>
                  <input
                    type="number"
                    min={256}
                    max={2048}
                    step={1}
                    value={height}
                    onChange={(event) => {
                      const nextHeight = Math.max(256, Math.min(2048, safeNumber(event.target.value, 1024)));
                      setHeight(nextHeight);
                      setRatio(ratioFromSize(width, nextHeight));
                    }}
                  />
                </div>

                <div className="field">
                  <div className="label">Adet</div>
                  <input
                    type="number"
                    min={1}
                    max={4}
                    step={1}
                    value={count}
                    onChange={(event) => setCount(Math.max(1, Math.min(4, safeNumber(event.target.value, 1))))}
                  />
                </div>

                <div className="field">
                  <div className="label">Stil (özellikle AMH)</div>
                  <input
                    value={style}
                    onChange={(event) => setStyle(event.target.value)}
                    placeholder="ör. cinematic, anime, photoreal"
                  />
                </div>

                <div className="field full">
                  <div className="label">Referans görsel URL (özellikle AMH)</div>
                  <input
                    value={referenceImageUrl}
                    onChange={(event) => setReferenceImageUrl(event.target.value)}
                    placeholder="https://..."
                  />
                </div>
              </div>

              <div className="switch-row">
                <label className="switch">
                  <input type="checkbox" checked={testMode} onChange={(event) => setTestMode(event.target.checked)} />
                  Test modu
                </label>
                <label className="switch">
                  <input type="checkbox" checked={autoFallback} onChange={(event) => setAutoFallback(event.target.checked)} disabled={workerMode !== 'amg'} />
                  AMG hata verirse AMH fallback
                </label>
              </div>

              <div className="actions">
                <button className="primary" type="button" onClick={() => void handleGenerate()} disabled={submitting || modelsLoading}>
                  {submitting ? 'Çalışıyor...' : workerMode === 'amg' ? 'AMG ile üret' : 'AMH ile üret'}
                </button>
                <button className="secondary" type="button" onClick={() => { resetResultState(); setError(''); setNotice(''); }} disabled={submitting}>
                  Sonucu temizle
                </button>
                <button className="secondary" type="button" onClick={() => { void loadModels(); void loadWorkerHealth(); }} disabled={submitting}>
                  Modelleri ve durumu yenile
                </button>
              </div>

              <div className="info-box brand">
                Sayfa artık AMG için <span className="mono">/api/modeller</span>, <span className="mono">/api/gorsel</span> ve <span className="mono">/api/durum</span> kullanır.
                AMH tarafında ise <span className="mono">/api/calistir</span>, <span className="mono">/api/durum</span>, <span className="mono">/api/panel</span>,
                <span className="mono"> /api/is/:isKimligi</span>, <span className="mono">/gecmis</span>, <span className="mono">/arsiv</span> ve <span className="mono">/izle</span> kullanılır.
              </div>
            </section>

            <section className="panel section">
              <div className="section-title">Aktif Sonuç ve İzleme</div>

              {result ? (
                <>
                  <div className="result-meta">
                    <div className="meta-list">
                      <div><strong>Kaynak:</strong> {result.source}{result.fallbackUsed ? ' · fallback' : ''}</div>
                      <div><strong>Durum:</strong> {result.status}</div>
                      <div><strong>Model:</strong> {result.model}</div>
                      <div><strong>Sağlayıcı:</strong> {result.provider}</div>
                      <div><strong>Mesaj:</strong> {result.message}</div>
                    </div>
                    <div className="hint">{result.prompt}</div>
                  </div>

                  {result.images.length ? (
                    <div className="result-grid">
                      {result.images.map((src) => (
                        <div key={src} className="image-card">
                          <img src={src} alt="Üretilen görsel" />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="info-box">Görsel henüz dönmedi. AMH iş takibi panelini aşağıdan izle.</div>
                  )}
                </>
              ) : (
                <div className="info-box">Henüz aktif sonuç yok.</div>
              )}

              <div className="section-title">AMH iş durumu</div>
              {amhJobId ? (
                <div className="list-card">
                  <div><strong>İş kimliği:</strong> <span className="mono">{amhJobId}</span></div>
                  <div><strong>Durum:</strong> {runStatusText(amhJobStatus?.durum)}</div>
                  <div><strong>Yüzde:</strong> %{safeNumber(amhJobStatus?.yuzde, 0)}</div>
                  <div><strong>Aktif adım:</strong> {safeText(amhJobStatus?.aktifAdim, '-')}</div>
                  <div><strong>Son güncelleme:</strong> {formatDate(amhJobStatus?.sonGuncelleme)}</div>
                  <div className="actions">
                    <button className="secondary" type="button" onClick={() => void loadAmhArtifacts(amhJobId)}>
                      Geçmiş ve arşivi yenile
                    </button>
                    {!isAmhTerminal(amhJobStatus?.durum) ? (
                      <button className="secondary" type="button" onClick={() => void pollAmhJob(amhJobId)}>
                        İzlemeyi sürdür
                      </button>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="info-box">AMH iş kimliği oluşmadıysa şu an AMG sonucu gösteriliyor olabilir.</div>
              )}
            </section>
          </div>

          <div className="grid">
            <section className="panel section">
              <div className="section-title">AMH olay geçmişi</div>
              <div className="list">
                {!amhHistory.length ? (
                  <div className="info-box">Henüz AMH olay geçmişi yok.</div>
                ) : (
                  amhHistory.map((event) => (
                    <div key={safeText(event.olayKimligi, randomId('evt'))} className="list-card">
                      <div><strong>{safeText(event.olay, 'olay')}</strong></div>
                      <div className="tiny">{formatDate(event.zamanDamgasi)}</div>
                      <pre>{JSON.stringify(event.veri, null, 2)}</pre>
                    </div>
                  ))
                )}
              </div>
            </section>

            <section className="panel section">
              <div className="section-title">AMH arşiv özeti</div>
              {amhArchive ? (
                <div className="list-card">
                  <div><strong>Durum:</strong> {safeText(amhArchive.durum, '-')}</div>
                  <div><strong>Başlangıç:</strong> {formatDate(amhArchive.baslangicZamani)}</div>
                  <div><strong>Bitiş:</strong> {formatDate(amhArchive.bitisZamani)}</div>
                  <div><strong>Son mesaj:</strong> {safeText(amhArchive.sonMesaj, '-')}</div>
                  <pre>{JSON.stringify(amhArchive.sonuc, null, 2)}</pre>
                </div>
              ) : (
                <div className="info-box">Arşiv kaydı henüz yok.</div>
              )}
            </section>
          </div>

          <section className="panel section">
            <div className="section-title">Yerel geçmiş</div>
            <div className="list">
              {!localHistory.length ? (
                <div className="info-box">Bu oturumda henüz üretim geçmişi yok.</div>
              ) : (
                localHistory.map((entry) => (
                  <button key={entry.id} type="button" className="list-card history-button" onClick={() => void loadHistoryRecord(entry)}>
                    <div><strong>{entry.source}</strong> · {entry.status}{entry.fallbackUsed ? ' · fallback' : ''}</div>
                    <div className="tiny">{formatDate(entry.at)}</div>
                    <div>{entry.prompt}</div>
                    <div className="tiny">{entry.model} · {entry.provider}</div>
                  </button>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
