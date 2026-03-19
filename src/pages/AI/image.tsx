import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_ANO_URL = "https://turk.puter.site/workers/all/ano.js";
const DEFAULT_BABO_URL = "https://turk.puter.site/workers/all/babo.js";
const POLL_MS = 2000;
const MAX_ANO_PROMPT = 2000;
const MAX_BABO_PROMPT = 2500;
const QUALITY_OPTIONS = ["low", "medium", "high"];
const RATIO_OPTIONS = [
  { key: "1:1", label: "1:1", width: 1024, height: 1024 },
  { key: "16:9", label: "16:9", width: 1600, height: 900 },
  { key: "9:16", label: "9:16", width: 900, height: 1600 },
  { key: "4:5", label: "4:5", width: 1200, height: 1500 }
];
const QUICK_PROMPTS = [
  "Sisli İstanbul gecesi, ıslak taş sokaklar, neon yansımalar, sinematik ışık, gerçekçi detay.",
  "Premium ürün çekimi, siyah arka plan, yumuşak stüdyo ışığı, lüks reklam estetiği.",
  "Anime karakter, dinamik poz, güçlü kontrast, ayrıntılı kostüm, poster kalitesi."
];

function buildUrl(base: string, path: string) {
  const safeBase = String(base || "").trim().replace(/\/$/, "");
  const safePath = path.startsWith("/") ? path : `/${path}`;
  return `${safeBase}${safePath}`;
}

function safeText(value: unknown, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeNumber(value: unknown, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function ensureArray<T = unknown>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function formatDate(value: unknown) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(String(value)));
  } catch {
    return String(value);
  }
}

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value ?? "");
  }
}

function randomId(prefix: string) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function getClientId() {
  if (typeof window === "undefined") return "image-tsx";
  try {
    const existing = window.localStorage.getItem("image.tsx.clientId");
    if (existing) return existing;
    const next = randomId("imgui");
    window.localStorage.setItem("image.tsx.clientId", next);
    return next;
  } catch {
    return randomId("imgui");
  }
}

function ratioFromSize(width: number, height: number) {
  const exact = RATIO_OPTIONS.find((item) => item.width === width && item.height === height);
  return exact?.key || "1:1";
}

function resolveSizeFromRatio(ratio: string) {
  return RATIO_OPTIONS.find((item) => item.key === ratio) || RATIO_OPTIONS[0];
}

function isHttpAsset(value: unknown) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return /^https?:\/\//i.test(text) || text.startsWith("data:image/") || text.startsWith("blob:");
}

function collectImagesDeep(value: unknown, collector = new Set<string>()) {
  if (isHttpAsset(value)) {
    collector.add(String(value));
    return [...collector];
  }

  if (Array.isArray(value)) {
    value.forEach((item) => collectImagesDeep(item, collector));
    return [...collector];
  }

  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    ["url", "src", "image_url"].forEach((key) => {
      if (isHttpAsset(record[key])) collector.add(String(record[key]));
    });
    ["urls", "images", "gorseller", "sonuc", "ham", "cikti", "result"].forEach((key) => {
      if (record[key] != null) collectImagesDeep(record[key], collector);
    });
  }

  return [...collector];
}

function healthToneFromStatus(status: unknown, score?: number | null) {
  const text = safeText(status).toLowerCase();
  if (typeof score === "number") {
    if (score >= 85) return "ok";
    if (score >= 60) return "warn";
    return "bad";
  }
  if (["hazir", "ok", "iyi"].includes(text)) return "ok";
  if (["uyari", "izlenmeli"].includes(text)) return "warn";
  if (text) return "bad";
  return "idle";
}

function toneText(tone: string) {
  if (tone === "ok") return "Çevrimiçi";
  if (tone === "warn") return "Uyarı";
  if (tone === "bad") return "Sorun";
  return "Kontrol ediliyor";
}

function runStatusText(status: unknown) {
  const value = safeText(status).toLowerCase();
  if (["tamamlandi", "completed"].includes(value)) return "Tamamlandı";
  if (["hazirlaniyor"].includes(value)) return "Hazırlanıyor";
  if (["isleniyor", "running", "processing"].includes(value)) return "İşleniyor";
  if (["yeniden_denemede"].includes(value)) return "Yeniden deneniyor";
  if (["basarisiz", "failed"].includes(value)) return "Başarısız";
  if (["duraklatildi", "cancelled"].includes(value)) return "Duraklatıldı";
  if (["queued", "kuyrukta"].includes(value)) return "Sırada";
  return safeText(status, "Bilinmiyor");
}

function isBaboTerminal(status: unknown) {
  const value = safeText(status).toLowerCase();
  return ["tamamlandi", "basarisiz", "duraklatildi", "completed", "failed", "cancelled"].includes(value);
}

function extractErrorMessage(error: unknown, fallback: string) {
  if (error instanceof DOMException && error.name === "AbortError") {
    return "İstek zaman aşımına uğradı.";
  }
  if (error instanceof Error) {
    return safeText(error.message, fallback);
  }
  return fallback;
}

async function parseJsonResponse(response: Response) {
  const text = await response.text();
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  const preview = text.slice(0, 180).replace(/\s+/g, " ").trim();

  if (/<!doctype|<html/i.test(text)) {
    throw new Error(`Beklenmeyen HTML yanıtı alındı. Worker URL veya endpoint yönlendirmesini kontrol et. Önizleme: ${preview || "(boş)"}`);
  }

  if (!contentType.includes("application/json")) {
    throw new Error(`JSON beklenirken farklı içerik tipi döndü: ${contentType || "(yok)"}. Önizleme: ${preview || "(boş)"}`);
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Worker geçerli JSON döndürmedi. Önizleme: ${preview || "(boş)"}`);
  }
}

async function requestAno(baseUrl: string, path: string, init?: RequestInit) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(buildUrl(baseUrl, path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    });
    const payload = await parseJsonResponse(response);
    if (!response.ok || payload.ok === false) {
      throw new Error(safeText(payload.hata, `ANO isteği başarısız oldu (${response.status}).`));
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

async function requestBabo(baseUrl: string, path: string, init?: RequestInit, timeoutMs = 90000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(buildUrl(baseUrl, path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...(init?.headers || {})
      }
    });
    const payload = await parseJsonResponse(response);
    if (!response.ok || payload.ok === false) {
      throw new Error(safeText(payload.hata?.mesaj, `BABO isteği başarısız oldu (${response.status}).`));
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}

type CatalogModel = {
  puterId?: string;
  id: string;
  name: string;
  provider?: string;
  aliases?: string[];
  modalities?: { input?: string[]; output?: string[] };
  context?: number | null;
  max_tokens?: number | null;
  tool_call?: boolean;
  open_weights?: boolean;
  knowledge?: string;
  release_date?: string;
  costs_currency?: string;
  input_cost_key?: string;
  output_cost_key?: string;
  costs?: Record<string, unknown>;
};

type ResultState = {
  source: "ANO" | "BABO";
  serviceType: "TXT2IMG" | "IMG2IMG";
  status: string;
  message: string;
  images: string[];
  model: string;
  provider: string;
  prompt: string;
  fallbackUsed?: boolean;
  raw?: unknown;
};

export default function ImagePage() {
  const clientId = useMemo(() => getClientId(), []);
  const pollRef = useRef<number | null>(null);

  const [anoBaseUrl, setAnoBaseUrl] = useState(DEFAULT_ANO_URL);
  const [baboBaseUrl, setBaboBaseUrl] = useState(DEFAULT_BABO_URL);
  const [workerMode, setWorkerMode] = useState<"ano" | "babo">("ano");
  const [autoFallback, setAutoFallback] = useState(true);
  const [operation, setOperation] = useState<"TXT2IMG" | "IMG2IMG">("TXT2IMG");
  const [providerFilter, setProviderFilter] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [models, setModels] = useState<CatalogModel[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [maskImageUrl, setMaskImageUrl] = useState("");
  const [quality, setQuality] = useState("medium");
  const [ratio, setRatio] = useState("1:1");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [count, setCount] = useState(1);
  const [testMode, setTestMode] = useState(false);
  const [timeoutMs, setTimeoutMs] = useState(60000);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [anoHealth, setAnoHealth] = useState<Record<string, unknown> | null>(null);
  const [baboHealth, setBaboHealth] = useState<Record<string, unknown> | null>(null);
  const [baboPanel, setBaboPanel] = useState<Record<string, unknown> | null>(null);
  const [anoServices, setAnoServices] = useState<any[]>([]);
  const [result, setResult] = useState<ResultState | null>(null);
  const [localHistory, setLocalHistory] = useState<any[]>([]);
  const [baboJobId, setBaboJobId] = useState("");
  const [baboJobStatus, setBaboJobStatus] = useState<Record<string, unknown> | null>(null);
  const [baboHistory, setBaboHistory] = useState<any[]>([]);
  const [baboArchive, setBaboArchive] = useState<Record<string, unknown> | null>(null);
  const [baboRunPayload, setBaboRunPayload] = useState<Record<string, unknown> | null>(null);
  const [baboDiagnosis, setBaboDiagnosis] = useState<Record<string, unknown> | null>(null);

  const selectedModel = useMemo(
    () => models.find((item) => item.id === selectedModelId) || null,
    [models, selectedModelId]
  );

  const providerOptions = useMemo(() => {
    return Array.from(new Set(models.map((item) => safeText(item.provider)).filter(Boolean)));
  }, [models]);

  const anoTone = healthToneFromStatus(anoHealth?.durum, null);
  const baboTone = healthToneFromStatus(baboHealth?.durum, safeNumber(baboHealth?.saglikPuani, NaN));
  const panelTone = healthToneFromStatus(baboPanel?.durum, safeNumber(baboPanel?.genelSaglikPuani, NaN));

  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const resetResultState = useCallback(() => {
    stopPolling();
    setResult(null);
    setBaboJobId("");
    setBaboJobStatus(null);
    setBaboHistory([]);
    setBaboArchive(null);
    setBaboRunPayload(null);
    setBaboDiagnosis(null);
  }, [stopPolling]);

  const pushLocalHistory = useCallback((entry: any) => {
    setLocalHistory((current) => [entry, ...current].slice(0, 12));
  }, []);

  const loadWorkerHealth = useCallback(async () => {
    try {
      const [ano, babo, panel, services] = await Promise.all([
        requestAno(anoBaseUrl, "/api/durum"),
        requestBabo(baboBaseUrl, "/api/durum"),
        requestBabo(baboBaseUrl, "/api/panel"),
        requestAno(anoBaseUrl, "/api/hizmetler")
      ]);
      setAnoHealth((ano.veri as any) || null);
      setBaboHealth((babo.veri as any) || null);
      setBaboPanel((panel.veri as any) || null);
      setAnoServices(ensureArray((services.veri as any)?.hizmetler));
    } catch (loadError) {
      console.error(loadError);
    }
  }, [anoBaseUrl, baboBaseUrl]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (providerFilter) params.set("provider", providerFilter);
      if (modelSearch.trim()) params.set("q", modelSearch.trim());
      params.set("output", "image");
      params.set("limit", "500");
      const envelope = await requestAno(anoBaseUrl, `/api/modeller?${params.toString()}`);
      const nextModels = ensureArray<CatalogModel>((envelope.veri as any)?.modeller).filter((item) => safeText(item.id) && safeText(item.name));
      setModels(nextModels);
      setSelectedModelId((current) => (current && nextModels.some((item) => item.id === current) ? current : safeText(nextModels[0]?.id)));
    } catch (loadError) {
      setModels([]);
      setSelectedModelId("");
      setError(extractErrorMessage(loadError, "Model listesi alınamadı."));
    } finally {
      setModelsLoading(false);
    }
  }, [anoBaseUrl, modelSearch, providerFilter]);

  const loadBaboArtifacts = useCallback(async (jobId: string) => {
    if (!jobId) return;
    try {
      const [statusEnvelope, historyEnvelope, archiveEnvelope, panelEnvelope] = await Promise.all([
        requestBabo(baboBaseUrl, `/api/is/${encodeURIComponent(jobId)}`),
        requestBabo(baboBaseUrl, `/api/is/${encodeURIComponent(jobId)}/gecmis`),
        requestBabo(baboBaseUrl, `/api/is/${encodeURIComponent(jobId)}/arsiv`),
        requestBabo(baboBaseUrl, "/api/panel")
      ]);
      setBaboJobStatus((statusEnvelope.veri as any) || null);
      setBaboHistory(ensureArray((historyEnvelope.veri as any)?.gecmis));
      setBaboArchive(((archiveEnvelope.veri as any)?.arsiv as any) || null);
      setBaboPanel((panelEnvelope.veri as any) || null);

      const archiveImages = collectImagesDeep((archiveEnvelope.veri as any)?.arsiv?.sonuc);
      if (archiveImages.length) {
        setResult((current) => ({
          source: "BABO",
          serviceType: operation,
          status: runStatusText((statusEnvelope.veri as any)?.durum),
          message: safeText((archiveEnvelope.veri as any)?.arsiv?.sonMesaj, current?.message || "BABO işi güncellendi."),
          images: archiveImages,
          model: safeText((baboRunPayload as any)?.etkinAyar?.model, current?.model || safeText(selectedModel?.name, "-")),
          provider: safeText((baboRunPayload as any)?.etkinAyar?.saglayici, current?.provider || safeText(selectedModel?.provider, "-")),
          prompt: prompt.trim(),
          fallbackUsed: current?.fallbackUsed,
          raw: (archiveEnvelope.veri as any)?.arsiv
        }));
      }
    } catch (artifactError) {
      console.error(artifactError);
    }
  }, [baboBaseUrl, baboRunPayload, operation, prompt, selectedModel]);

  const pollBaboJob = useCallback(async (jobId: string) => {
    stopPolling();
    if (!jobId) return;

    try {
      const envelope = await requestBabo(baboBaseUrl, `/api/is/${encodeURIComponent(jobId)}/izle`);
      const payload = (envelope.veri as any) || null;
      setBaboJobStatus(payload);
      setResult((current) => {
        if (!current || current.source !== "BABO") return current;
        return {
          ...current,
          status: runStatusText(payload?.durum),
          message: safeText(payload?.aktifAdim, current.message || "BABO işi sürüyor.")
        };
      });

      if (!payload || isBaboTerminal(payload.durum) || safeNumber(payload.yuzde, 0) >= 100) {
        await loadBaboArtifacts(jobId);
        setSubmitting(false);
        return;
      }

      pollRef.current = window.setTimeout(() => {
        void pollBaboJob(jobId);
      }, POLL_MS);
    } catch (pollError) {
      setSubmitting(false);
      setError(extractErrorMessage(pollError, "BABO iş durumu alınamadı."));
    }
  }, [baboBaseUrl, loadBaboArtifacts, stopPolling]);

  const generateAno = useCallback(async () => {
    if (!selectedModel) throw new Error("Model seçmelisin.");

    if (operation === "IMG2IMG") {
      const sourceImage = safeText(referenceImageUrl);
      if (!sourceImage) throw new Error("IMG2IMG için referans görsel zorunlu.");
      const payload = {
        prompt: prompt.trim(),
        sourceImage,
        maskImage: safeText(maskImageUrl),
        model: selectedModel.id,
        provider: safeText(selectedModel.provider),
        kalite: quality,
        adet: count,
        n: count,
        testModu: testMode,
        test_mode: testMode,
        istemciKimligi: clientId
      };
      const envelope = await requestAno(anoBaseUrl, "/api/gorsel/duzenle", {
        method: "POST",
        headers: { "X-Istemci-Kimligi": clientId },
        body: JSON.stringify(payload)
      });
      const images = collectImagesDeep((envelope.veri as any)?.ham || (envelope.veri as any)?.urls || (envelope.veri as any)?.url || envelope.veri);
      if (!images.length) throw new Error("ANO IMG2IMG görsel URL döndürmedi.");
      const nextResult: ResultState = {
        source: "ANO",
        serviceType: "IMG2IMG",
        status: "Tamamlandı",
        message: "ANO doğrudan IMG2IMG üretimi tamamladı.",
        images,
        model: safeText((envelope.veri as any)?.model, selectedModel.name),
        provider: safeText((envelope.veri as any)?.provider, selectedModel.provider || "-"),
        prompt: prompt.trim(),
        raw: envelope.veri
      };
      setResult(nextResult);
      pushLocalHistory({ id: randomId("run"), at: new Date().toISOString(), ...nextResult });
      return;
    }

    const payload = {
      prompt: prompt.trim(),
      model: selectedModel.id,
      provider: safeText(selectedModel.provider),
      kalite: quality,
      genislik: width,
      yukseklik: height,
      adet: count,
      n: count,
      testModu: testMode,
      test_mode: testMode,
      istemciKimligi: clientId
    };
    const envelope = await requestAno(anoBaseUrl, "/api/gorsel", {
      method: "POST",
      headers: { "X-Istemci-Kimligi": clientId },
      body: JSON.stringify(payload)
    });
    const imageUrl = safeText((envelope.veri as any)?.url);
    const images = imageUrl ? [imageUrl] : collectImagesDeep((envelope.veri as any)?.ham);
    if (!images.length) throw new Error("ANO görsel URL döndürmedi.");

    const nextResult: ResultState = {
      source: "ANO",
      serviceType: "TXT2IMG",
      status: "Tamamlandı",
      message: "ANO doğrudan TXT2IMG üretimi tamamladı.",
      images,
      model: safeText((envelope.veri as any)?.model, selectedModel.name),
      provider: safeText((envelope.veri as any)?.provider, selectedModel.provider || "-"),
      prompt: prompt.trim(),
      raw: envelope.veri
    };
    setResult(nextResult);
    pushLocalHistory({ id: randomId("run"), at: new Date().toISOString(), ...nextResult });
  }, [anoBaseUrl, clientId, count, maskImageUrl, operation, prompt, pushLocalHistory, quality, referenceImageUrl, selectedModel, testMode, width, height]);

  const generateBabo = useCallback(async (fallbackUsed = false) => {
    if (!selectedModel) throw new Error("Model seçmelisin.");
    const correlationId = randomId("corr");
    const serviceType = operation;
    const body: Record<string, unknown> = {
      serviceType,
      hizmetTuru: serviceType,
      prompt: prompt.trim(),
      model: selectedModel.id,
      provider: safeText(selectedModel.provider),
      saglayici: safeText(selectedModel.provider),
      kalite: quality,
      quality,
      oran: ratio,
      width,
      height,
      adet: count,
      n: count,
      testModu: testMode,
      test_mode: testMode,
      kullaniciKimligi: clientId,
      istemciKimligi: clientId,
      timeoutMs
    };

    if (operation === "IMG2IMG") {
      const sourceImage = safeText(referenceImageUrl);
      if (!sourceImage) throw new Error("BABO IMG2IMG için referans görsel zorunlu.");
      body.input_image = sourceImage;
      body.referansGorsel = sourceImage;
      body.imageUrl = sourceImage;
      if (safeText(maskImageUrl)) {
        body.mask_image_url = safeText(maskImageUrl);
        body.maskImageUrl = safeText(maskImageUrl);
      }
    }

    const envelope = await requestBabo(baboBaseUrl, "/api/calistir", {
      method: "POST",
      headers: {
        "X-Istemci-Kimligi": clientId,
        "X-Korelasyon-Anahtari": correlationId,
        "X-Saglayici": safeText(selectedModel.provider),
        "X-Kalite-Seviyesi": quality,
        "X-Timeout-Ms": String(timeoutMs)
      },
      body: JSON.stringify(body)
    }, Math.max(90000, timeoutMs + 15000));

    const payload = (envelope.veri as any) || null;
    const nextJobId = safeText(payload?.baglam?.isKimligi || (envelope.meta as any)?.isKimligi);
    const images = collectImagesDeep(payload?.sonuc);
    setBaboRunPayload(payload);
    setBaboJobId(nextJobId);
    setBaboJobStatus({
      isKimligi: nextJobId,
      durum: images.length ? "tamamlandi" : "isleniyor",
      yuzde: images.length ? 100 : 20,
      aktifAdim: images.length ? "tamamlandı" : "işleniyor",
      sonGuncelleme: new Date().toISOString(),
      tahminiBitis: null,
      sonHata: null
    });

    setResult({
      source: "BABO",
      serviceType,
      status: images.length ? "Tamamlandı" : "İşleniyor",
      message: images.length ? `BABO ${serviceType} orkestrasyonunu tamamladı.` : "BABO işi başlatıldı ve izleniyor.",
      images,
      model: safeText(payload?.etkinAyar?.model, selectedModel.name),
      provider: safeText(payload?.etkinAyar?.saglayici, selectedModel.provider || "-"),
      prompt: prompt.trim(),
      fallbackUsed,
      raw: payload
    });

    if (nextJobId) {
      pushLocalHistory({
        id: nextJobId,
        at: new Date().toISOString(),
        source: "BABO",
        serviceType,
        status: images.length ? "Tamamlandı" : "İşleniyor",
        prompt: prompt.trim(),
        images,
        model: safeText(payload?.etkinAyar?.model, selectedModel.name),
        provider: safeText(payload?.etkinAyar?.saglayici, selectedModel.provider || "-"),
        fallbackUsed
      });
      await loadBaboArtifacts(nextJobId);
      if (!images.length) {
        await pollBaboJob(nextJobId);
      }
    }
  }, [baboBaseUrl, clientId, count, loadBaboArtifacts, maskImageUrl, operation, pollBaboJob, prompt, pushLocalHistory, quality, ratio, referenceImageUrl, selectedModel, testMode, timeoutMs, width, height]);

  const runDiagnosis = useCallback(async () => {
    if (!selectedModel) {
      setError("Teşhis için önce model seçmelisin.");
      return;
    }
    setError("");
    try {
      const serviceType = operation;
      const payload: Record<string, unknown> = {
        serviceType,
        hizmetTuru: serviceType,
        prompt: prompt.trim() || "teşhis",
        model: selectedModel.id,
        provider: safeText(selectedModel.provider),
        kalite: quality,
        oran: ratio,
        width,
        height,
        adet: count,
        n: count,
        timeoutMs,
        kullaniciKimligi: clientId
      };
      if (operation === "IMG2IMG" && safeText(referenceImageUrl)) {
        payload.input_image = safeText(referenceImageUrl);
      }
      const envelope = await requestBabo(baboBaseUrl, "/api/teshis", {
        method: "POST",
        headers: {
          "X-Istemci-Kimligi": clientId,
          "X-Saglayici": safeText(selectedModel.provider),
          "X-Kalite-Seviyesi": quality,
          "X-Timeout-Ms": String(timeoutMs)
        },
        body: JSON.stringify(payload)
      });
      setBaboDiagnosis((envelope.veri as any) || null);
      setNotice("BABO teşhis raporu yenilendi.");
    } catch (diagError) {
      setError(extractErrorMessage(diagError, "BABO teşhis raporu alınamadı."));
    }
  }, [baboBaseUrl, clientId, count, operation, prompt, quality, ratio, referenceImageUrl, selectedModel, timeoutMs, width, height]);

  const handleGenerate = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    setError("");
    setNotice("");

    if (!trimmedPrompt) {
      setError("Prompt zorunlu.");
      return;
    }

    if (operation === "IMG2IMG" && !safeText(referenceImageUrl)) {
      setError("IMG2IMG için referans görsel URL zorunlu.");
      return;
    }

    if (trimmedPrompt.length > MAX_BABO_PROMPT) {
      setError(`Prompt ${MAX_BABO_PROMPT} karakteri aşamaz.`);
      return;
    }

    if (!selectedModel) {
      setError("Model seçmelisin.");
      return;
    }

    resetResultState();
    setSubmitting(true);

    try {
      if (workerMode === "ano") {
        try {
          if (trimmedPrompt.length > MAX_ANO_PROMPT) {
            throw new Error(`ANO prompt sınırı ${MAX_ANO_PROMPT} karakter. BABO fallback kullanılacak.`);
          }
          await generateAno();
          setNotice(`Birincil worker ANO kullanıldı (${operation}).`);
        } catch (anoError) {
          if (!autoFallback) throw anoError;
          setNotice(`ANO hata verdi, BABO fallback devreye alındı: ${extractErrorMessage(anoError, "ANO başarısız oldu.")}`);
          await generateBabo(true);
        }
      } else {
        await generateBabo(false);
        setNotice(`BABO orkestrasyon akışı kullanıldı (${operation}).`);
      }
      await loadWorkerHealth();
    } catch (generateError) {
      setError(extractErrorMessage(generateError, "Görsel üretimi başlatılamadı."));
    } finally {
      setSubmitting(false);
    }
  }, [autoFallback, generateAno, generateBabo, loadWorkerHealth, operation, prompt, referenceImageUrl, resetResultState, selectedModel, workerMode]);

  const loadHistoryRecord = useCallback(async (entry: any) => {
    setError("");
    setNotice("");
    setResult({
      source: entry.source,
      serviceType: entry.serviceType,
      status: entry.status,
      message: "Geçmiş kayıt açıldı.",
      images: entry.images,
      model: entry.model,
      provider: entry.provider,
      prompt: entry.prompt,
      fallbackUsed: entry.fallbackUsed,
      raw: entry.raw
    });
    if (entry.source === "BABO") {
      setBaboJobId(entry.id);
      await loadBaboArtifacts(entry.id);
    } else {
      setBaboJobId("");
      setBaboJobStatus(null);
      setBaboHistory([]);
      setBaboArchive(null);
      setBaboRunPayload(null);
    }
  }, [loadBaboArtifacts]);

  useEffect(() => {
    void loadWorkerHealth();
  }, [loadWorkerHealth]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadModels();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [loadModels]);

  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  useEffect(() => {
    const next = resolveSizeFromRatio(ratio);
    setWidth(next.width);
    setHeight(next.height);
  }, [ratio]);

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
          grid-template-columns: 1.08fr 0.92fr;
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
        .field { display: grid; gap: 8px; }
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
        .result-meta { display: grid; gap: 10px; }
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
          background: transparent;
          padding: 0;
        }
        .tiny { font-size: 12px; color: #667085; }
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
                  ANO hızlı ve doğrudan servis katmanı; BABO ise karar, takip ve orkestrasyon katmanı.
                  Bu ekran yalnız görsel akışını açar ama sözleşme olarak ANO <span className="mono">/api/modeller</span>,
                  <span className="mono"> /api/gorsel</span>, <span className="mono">/api/gorsel/duzenle</span> ve BABO
                  <span className="mono"> /api/calistir</span>, <span className="mono">/api/is/:id*</span>, <span className="mono">/api/panel</span>
                  yollarına birebir bağlıdır.
                </div>
              </div>
              <div className="badge-row">
                <div className="badge"><span className={`dot ${anoTone}`} /> ANO · {toneText(anoTone)}</div>
                <div className="badge"><span className={`dot ${baboTone}`} /> BABO · {toneText(baboTone)}</div>
                <div className="badge"><span className={`dot ${panelTone}`} /> Panel · {toneText(panelTone)}</div>
              </div>
            </div>
            <div className="tiny">
              ANO durum: {safeText(anoHealth?.durum, "-")} · BABO sağlık puanı: {safeNumber(baboHealth?.saglikPuani, 0) || "-"} · Panel aktif iş: {safeNumber(baboPanel?.aktifIsSayisi, 0)}
            </div>
            {error ? <div className="error-box">{error}</div> : null}
            {notice ? <div className="notice-box">{notice}</div> : null}
          </section>

          <div className="grid">
            <section className="panel section">
              <div className="section-title">Üretim Formu</div>

              <div className="controls-grid">
                <div className="field full">
                  <div className="label">ANO Worker URL</div>
                  <input value={anoBaseUrl} onChange={(event) => setAnoBaseUrl(event.target.value)} placeholder={DEFAULT_ANO_URL} />
                </div>
                <div className="field full">
                  <div className="label">BABO Worker URL</div>
                  <input value={baboBaseUrl} onChange={(event) => setBaboBaseUrl(event.target.value)} placeholder={DEFAULT_BABO_URL} />
                </div>
              </div>

              <div className="field full">
                <div className="label">Prompt</div>
                <textarea
                  placeholder="Ne üretileceğini açık yaz. Stil, ışık, kompozisyon ve kullanım amacını ekle."
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                />
                <div className="tiny">ANO sınırı {MAX_ANO_PROMPT}, BABO sınırı {MAX_BABO_PROMPT} karakter.</div>
              </div>

              <div className="chips">
                {QUICK_PROMPTS.map((item, index) => (
                  <button key={`${index}-${item}`} type="button" className="chip" onClick={() => setPrompt(item)}>
                    Hazır prompt
                  </button>
                ))}
              </div>

              <div className="controls-grid">
                <div className="field">
                  <div className="label">Çalışma modu</div>
                  <div className="chips">
                    <button type="button" className={`chip ${workerMode === "ano" ? "active" : ""}`} onClick={() => setWorkerMode("ano")}>ANO birincil</button>
                    <button type="button" className={`chip ${workerMode === "babo" ? "active" : ""}`} onClick={() => setWorkerMode("babo")}>BABO orkestra</button>
                  </div>
                </div>

                <div className="field">
                  <div className="label">İşlem türü</div>
                  <div className="chips">
                    <button type="button" className={`chip ${operation === "TXT2IMG" ? "active" : ""}`} onClick={() => setOperation("TXT2IMG")}>TXT2IMG</button>
                    <button type="button" className={`chip ${operation === "IMG2IMG" ? "active" : ""}`} onClick={() => setOperation("IMG2IMG")}>IMG2IMG</button>
                  </div>
                </div>

                <div className="field">
                  <div className="label">Sağlayıcı filtresi</div>
                  <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
                    <option value="">Tümü</option>
                    {providerOptions.map((provider) => (
                      <option key={provider} value={provider}>{provider}</option>
                    ))}
                  </select>
                </div>

                <div className="field">
                  <div className="label">Model ara</div>
                  <input value={modelSearch} onChange={(event) => setModelSearch(event.target.value)} placeholder="ör. gpt-image" />
                </div>

                <div className="field full">
                  <div className="label">Model</div>
                  <select value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)} disabled={modelsLoading || !models.length}>
                    {!models.length ? <option value="">{modelsLoading ? "Modeller yükleniyor..." : "Model yok"}</option> : null}
                    {models.map((item) => (
                      <option key={item.id} value={item.id}>{item.name} · {safeText(item.provider, "-")}</option>
                    ))}
                  </select>
                  {selectedModel ? (
                    <div className="tiny">
                      {safeText(selectedModel.puterId, selectedModel.id)} · çıktı: {ensureArray(selectedModel.modalities?.output).join(", ") || "-"} · bağlam: {selectedModel.context ?? "-"}
                    </div>
                  ) : null}
                </div>

                <div className="field">
                  <div className="label">Kalite</div>
                  <div className="chips">
                    {QUALITY_OPTIONS.map((item) => (
                      <button key={item} type="button" className={`chip ${quality === item ? "active" : ""}`} onClick={() => setQuality(item)}>{item}</button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <div className="label">Oran</div>
                  <div className="chips">
                    {RATIO_OPTIONS.map((item) => (
                      <button key={item.key} type="button" className={`chip ${ratio === item.key ? "active" : ""}`} onClick={() => setRatio(item.key)}>{item.label}</button>
                    ))}
                  </div>
                </div>

                <div className="field">
                  <div className="label">Genişlik</div>
                  <input type="number" min={256} max={4096} step={1} value={width} onChange={(event) => {
                    const nextWidth = Math.max(256, Math.min(4096, safeNumber(event.target.value, 1024)));
                    setWidth(nextWidth);
                    setRatio(ratioFromSize(nextWidth, height));
                  }} />
                </div>

                <div className="field">
                  <div className="label">Yükseklik</div>
                  <input type="number" min={256} max={4096} step={1} value={height} onChange={(event) => {
                    const nextHeight = Math.max(256, Math.min(4096, safeNumber(event.target.value, 1024)));
                    setHeight(nextHeight);
                    setRatio(ratioFromSize(width, nextHeight));
                  }} />
                </div>

                <div className="field">
                  <div className="label">Adet</div>
                  <input type="number" min={1} max={4} step={1} value={count} onChange={(event) => setCount(Math.max(1, Math.min(4, safeNumber(event.target.value, 1))))} />
                </div>

                <div className="field">
                  <div className="label">BABO timeout (ms)</div>
                  <input type="number" min={1000} max={300000} step={1000} value={timeoutMs} onChange={(event) => setTimeoutMs(Math.max(1000, Math.min(300000, safeNumber(event.target.value, 60000))))} />
                </div>

                <div className="field full">
                  <div className="label">Referans görsel URL</div>
                  <input value={referenceImageUrl} onChange={(event) => setReferenceImageUrl(event.target.value)} placeholder="IMG2IMG için zorunlu. https://..." />
                </div>

                <div className="field full">
                  <div className="label">Maske görsel URL</div>
                  <input value={maskImageUrl} onChange={(event) => setMaskImageUrl(event.target.value)} placeholder="İsteğe bağlı maske URL" />
                </div>
              </div>

              <div className="switch-row">
                <label className="switch">
                  <input type="checkbox" checked={testMode} onChange={(event) => setTestMode(event.target.checked)} />
                  Test modu
                </label>
                <label className="switch">
                  <input type="checkbox" checked={autoFallback} onChange={(event) => setAutoFallback(event.target.checked)} />
                  ANO hata verirse BABO fallback
                </label>
              </div>

              <div className="actions">
                <button className="primary" type="button" onClick={() => void handleGenerate()} disabled={submitting || !selectedModel}>
                  {submitting ? "Çalışıyor..." : workerMode === "ano" ? "ANO ile üret" : "BABO ile çalıştır"}
                </button>
                <button className="secondary" type="button" onClick={() => { setError(""); setNotice(""); resetResultState(); }}>
                  Sonucu temizle
                </button>
                <button className="secondary" type="button" onClick={() => { void loadModels(); void loadWorkerHealth(); }}>
                  Modelleri ve durumu yenile
                </button>
                <button className="secondary" type="button" onClick={() => void runDiagnosis()} disabled={!selectedModel}>
                  BABO teşhis
                </button>
              </div>

              <div className="info-box brand">
                ANO hızlı yol ve sade JSON döner. BABO aynı hizmeti daha akıllı yürütür; timeout, retry, fallback, iş kimliği,
                panel, geçmiş ve arşiv bilgisi taşır. Bu yüzden varsayılan kısa yol ANO, kontrollü yol BABO’dur.
              </div>

              <div className="hint">
                Model kataloğu ANO <span className="mono">GET /api/modeller?output=image&amp;limit=500</span> üstünden gelir.
                TXT2IMG için ANO <span className="mono">POST /api/gorsel</span>, IMG2IMG için ANO <span className="mono">POST /api/gorsel/duzenle</span> kullanılır.
                BABO her iki durumda da <span className="mono">POST /api/calistir</span> ile çalışır ve hizmet tipi olarak
                <span className="mono"> {operation} </span> gönderilir.
              </div>
            </section>

            <section className="panel section">
              <div className="section-title">Aktif Sonuç</div>
              {result ? (
                <>
                  <div className="list-card result-meta">
                    <div><strong>Kaynak:</strong> {result.source} · {result.serviceType}{result.fallbackUsed ? " · fallback" : ""}</div>
                    <div><strong>Durum:</strong> {result.status}</div>
                    <div><strong>Model:</strong> {result.model}</div>
                    <div><strong>Sağlayıcı:</strong> {result.provider}</div>
                    <div><strong>Mesaj:</strong> {result.message}</div>
                  </div>
                  <div className="hint">{result.prompt}</div>
                  {result.images.length ? (
                    <div className="result-grid">
                      {result.images.map((src) => (
                        <div key={src} className="image-card"><img src={src} alt="Üretilen görsel" /></div>
                      ))}
                    </div>
                  ) : (
                    <div className="info-box">Görsel henüz dönmedi. BABO iş takibi panelini aşağıdan izle.</div>
                  )}
                </>
              ) : (
                <div className="info-box">Henüz aktif sonuç yok.</div>
              )}

              <div className="section-title">BABO iş durumu</div>
              {baboJobId ? (
                <div className="list-card">
                  <div><strong>İş kimliği:</strong> <span className="mono">{baboJobId}</span></div>
                  <div><strong>Durum:</strong> {runStatusText(baboJobStatus?.durum)}</div>
                  <div><strong>Yüzde:</strong> %{safeNumber(baboJobStatus?.yuzde, 0)}</div>
                  <div><strong>Aktif adım:</strong> {safeText(baboJobStatus?.aktifAdim, "-")}</div>
                  <div><strong>Son güncelleme:</strong> {formatDate(baboJobStatus?.sonGuncelleme)}</div>
                  <div><strong>Tahmini bitiş:</strong> {formatDate(baboJobStatus?.tahminiBitis)}</div>
                  <div><strong>Son hata:</strong> {safeText((baboJobStatus as any)?.sonHata?.mesaj || (baboJobStatus as any)?.sonHata, "-")}</div>
                  <div className="actions">
                    <button className="secondary" type="button" onClick={() => void loadBaboArtifacts(baboJobId)}>Geçmiş ve arşivi yenile</button>
                    {!isBaboTerminal(baboJobStatus?.durum) ? <button className="secondary" type="button" onClick={() => void pollBaboJob(baboJobId)}>Canlı izle</button> : null}
                  </div>
                </div>
              ) : (
                <div className="info-box">Aktif BABO işi yok.</div>
              )}

              <div className="section-title">BABO panel özeti</div>
              <div className="list-card">
                <div><strong>Aktif iş:</strong> {safeNumber(baboPanel?.aktifIsSayisi, 0)}</div>
                <div><strong>Genel sağlık puanı:</strong> {safeNumber(baboPanel?.genelSaglikPuani, 0)}</div>
                <div><strong>Durum:</strong> {safeText(baboPanel?.durum, "-")}</div>
                <div><strong>Son hata:</strong> {safeText((baboPanel as any)?.sonHata?.mesaj || (baboPanel as any)?.sonHata, "-")}</div>
              </div>
            </section>
          </div>

          <div className="grid">
            <section className="panel section">
              <div className="section-title">Yerel geçmiş</div>
              {localHistory.length ? (
                <div className="list">
                  {localHistory.map((entry) => (
                    <button key={entry.id} className="list-card history-button" type="button" onClick={() => void loadHistoryRecord(entry)}>
                      <div><strong>{entry.source}</strong> · {entry.serviceType} · {entry.status}</div>
                      <div className="tiny">{formatDate(entry.at)} · {safeText(entry.model, "-")} · {safeText(entry.provider, "-")}</div>
                      <div className="tiny">{safeText(entry.prompt, "-")}</div>
                    </button>
                  ))}
                </div>
              ) : <div className="info-box">Yerel geçmiş boş.</div>}

              <div className="section-title">ANO hizmet özeti</div>
              {anoServices.length ? (
                <div className="list">
                  {anoServices.map((service) => (
                    <div key={service.kod} className="list-card">
                      <div><strong>{safeText(service.kod)}</strong> · {safeText(service.puter, "-")}</div>
                      <div className="tiny">Route: <span className="mono">{safeText(service.route, "-")}</span> · Doğrudan: {service.dogrudan ? "evet" : "hayır"}</div>
                    </div>
                  ))}
                </div>
              ) : <div className="info-box">ANO hizmet listesi henüz yüklenmedi.</div>}
            </section>

            <section className="panel section">
              <div className="section-title">BABO geçmişi</div>
              {baboHistory.length ? (
                <div className="list">
                  {baboHistory.map((entry) => (
                    <div key={safeText(entry.olayKimligi, randomId("evt"))} className="list-card">
                      <div><strong>{safeText(entry.olay, "olay")}</strong></div>
                      <div className="tiny">{formatDate(entry.zamanDamgasi)}</div>
                      <pre>{prettyJson(entry.veri)}</pre>
                    </div>
                  ))}
                </div>
              ) : <div className="info-box">BABO geçmişi boş.</div>}

              <div className="section-title">BABO arşiv / teşhis / ham çıktı</div>
              <div className="list">
                <div className="list-card">
                  <div><strong>Arşiv</strong></div>
                  <pre>{prettyJson(baboArchive)}</pre>
                </div>
                <div className="list-card">
                  <div><strong>Teşhis</strong></div>
                  <pre>{prettyJson(baboDiagnosis)}</pre>
                </div>
                <div className="list-card">
                  <div><strong>Aktif sonuç ham verisi</strong></div>
                  <pre>{prettyJson(result?.raw)}</pre>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
