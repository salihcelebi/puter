import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
const ANO_BASE_URL = "https://turk.puter.site/workers/all/ano.js";
const BABO_BASE_URL = "https://turk.puter.site/workers/all/babo.js";
const POLL_MS = 2e3;
const MAX_ANO_PROMPT = 2e3;
const MAX_BABO_PROMPT = 2500;
const DEFAULT_BABO_TIMEOUT_MS = 6e4;
const QUALITY_OPTIONS = ["low", "medium", "high"];
const RATIO_OPTIONS = [
  { key: "1:1", label: "1:1", width: 1024, height: 1024 },
  { key: "16:9", label: "16:9", width: 1600, height: 900 },
  { key: "9:16", label: "9:16", width: 900, height: 1600 },
  { key: "4:5", label: "4:5", width: 1200, height: 1500 }
];
const DEFAULT_PROVIDER_OPTIONS = ["", "openai-image-generation", "together", "gemini", "xai"];
const QUICK_PROMPTS = [
  "Sisli \u0130stanbul gecesi, \u0131slak ta\u015F sokaklar, neon yans\u0131malar, sinematik \u0131\u015F\u0131k, ger\xE7ek\xE7i detay.",
  "Premium \xFCr\xFCn \xE7ekimi, siyah arka plan, yumu\u015Fak st\xFCdyo \u0131\u015F\u0131\u011F\u0131, l\xFCks reklam esteti\u011Fi.",
  "Anime karakter, dinamik poz, g\xFC\xE7l\xFC kontrast, ayr\u0131nt\u0131l\u0131 kost\xFCm, poster kalitesi."
];
function buildUrl(base, path) {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}
function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}
function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}
function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}
function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return value;
  }
}
function prettyJson(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    try {
      return String(value ?? "");
    } catch {
      return "";
    }
  }
}
function randomId(prefix) {
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
function ratioFromSize(width, height) {
  const label = `${Math.max(1, width)}:${Math.max(1, height)}`;
  const exact = RATIO_OPTIONS.find((item) => item.width === width && item.height === height);
  if (exact) return exact.key;
  if (label === "1024:1024") return "1:1";
  return "1:1";
}
function ratioLabel(ratio) {
  return ratio;
}
function resolveSizeFromRatio(ratio) {
  const found = RATIO_OPTIONS.find((item) => item.key === ratio) || RATIO_OPTIONS[0];
  return { width: found.width, height: found.height };
}
function isHttpImage(value) {
  if (typeof value !== "string") return false;
  const text = value.trim();
  return /^https?:\/\//i.test(text) || text.startsWith("data:image/") || text.startsWith("blob:");
}
function collectImagesDeep(value, collector = /* @__PURE__ */ new Set()) {
  if (isHttpImage(value)) {
    collector.add(value);
    return [...collector];
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImagesDeep(item, collector));
    return [...collector];
  }
  if (value && typeof value === "object") {
    const record = value;
    ["url", "src", "image_url"].forEach((key) => {
      if (isHttpImage(record[key])) collector.add(record[key]);
    });
    ["images", "gorseller", "parcaliSonuclar", "cikti", "sonuc", "ham"].forEach((key) => {
      if (record[key] != null) collectImagesDeep(record[key], collector);
    });
  }
  return [...collector];
}
function healthToneFromStatus(status, score) {
  const text = safeText(status).toLowerCase();
  if (typeof score === "number") {
    if (score >= 85) return "ok";
    if (score >= 60) return "warn";
    return "bad";
  }
  if (text === "hazir" || text === "ok" || text === "iyi") return "ok";
  if (text === "uyari" || text === "izlenmeli") return "warn";
  if (text) return "bad";
  return "idle";
}
function toneText(tone) {
  if (tone === "ok") return "\xC7evrimi\xE7i";
  if (tone === "warn") return "Uyar\u0131";
  if (tone === "bad") return "Sorun";
  return "Kontrol ediliyor";
}
function runStatusText(status) {
  const value = safeText(status).toLowerCase();
  if (["tamamlandi", "completed"].includes(value)) return "Tamamland\u0131";
  if (["hazirlaniyor"].includes(value)) return "Haz\u0131rlan\u0131yor";
  if (["isleniyor", "running", "processing"].includes(value)) return "\u0130\u015Fleniyor";
  if (["yeniden_denemede"].includes(value)) return "Yeniden deneniyor";
  if (["basarisiz", "failed"].includes(value)) return "Ba\u015Far\u0131s\u0131z";
  if (["duraklatildi", "cancelled"].includes(value)) return "Duraklat\u0131ld\u0131";
  if (["queued", "kuyrukta"].includes(value)) return "S\u0131rada";
  return safeText(status, "Bilinmiyor");
}
function isBaboTerminal(status) {
  const value = safeText(status).toLowerCase();
  return ["tamamlandi", "basarisiz", "duraklatildi", "completed", "failed", "cancelled"].includes(value);
}
function extractErrorMessage(error, fallback) {
  if (error instanceof DOMException && error.name === "AbortError") return "\u0130stek zaman a\u015F\u0131m\u0131na u\u011Frad\u0131.";
  if (error instanceof Error) return safeText(error.message, fallback);
  return fallback;
}
async function parseJsonResponse(response) {
  const text = await response.text();
  const contentType = response.headers.get("content-type") || "";
  if (/<!doctype|<html/i.test(text)) {
    throw new Error("Beklenmeyen HTML yan\u0131t\u0131 al\u0131nd\u0131. Worker URL veya endpoint y\xF6nlendirmesini kontrol et.");
  }
  if (!contentType.toLowerCase().includes("application/json")) {
    throw new Error("JSON beklenirken farkl\u0131 i\xE7erik tipi d\xF6nd\xFC.");
  }
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Worker ge\xE7erli JSON d\xF6nd\xFCrmedi.");
  }
}
async function requestAno(path, init) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 45e3);
  try {
    const response = await fetch(buildUrl(ANO_BASE_URL, path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers || {}
      }
    });
    const payload = await parseJsonResponse(response);
    if (!response.ok || payload.ok === false) {
      throw new Error(safeText(payload.hata, `ANO iste\u011Fi ba\u015Far\u0131s\u0131z oldu (${response.status}).`));
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}
async function requestBabo(path, init) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 9e4);
  try {
    const response = await fetch(buildUrl(BABO_BASE_URL, path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        ...init?.headers || {}
      }
    });
    const payload = await parseJsonResponse(response);
    if (!response.ok || payload.ok === false) {
      throw new Error(safeText(payload.hata?.mesaj, `BABO iste\u011Fi ba\u015Far\u0131s\u0131z oldu (${response.status}).`));
    }
    return payload;
  } finally {
    window.clearTimeout(timer);
  }
}
function ImagePage() {
  const clientId = useMemo(() => getClientId(), []);
  const pollRef = useRef(null);
  const [workerMode, setWorkerMode] = useState("ano");
  const [autoFallback, setAutoFallback] = useState(true);
  const [providerFilter, setProviderFilter] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [models, setModels] = useState([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [style, setStyle] = useState("");
  const [referenceImageUrl, setReferenceImageUrl] = useState("");
  const [quality, setQuality] = useState("medium");
  const [ratio, setRatio] = useState("1:1");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [count, setCount] = useState(1);
  const [testMode, setTestMode] = useState(false);
  const [baboTimeoutMs, setBaboTimeoutMs] = useState(DEFAULT_BABO_TIMEOUT_MS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [anoHealth, setAnoHealth] = useState(null);
  const [baboHealth, setBaboHealth] = useState(null);
  const [baboPanel, setBaboPanel] = useState(null);
  const [result, setResult] = useState(null);
  const [localHistory, setLocalHistory] = useState([]);
  const [baboJobId, setBaboJobId] = useState("");
  const [baboJobStatus, setBaboJobStatus] = useState(null);
  const [baboHistory, setBaboHistory] = useState([]);
  const [baboArchive, setBaboArchive] = useState(null);
  const [baboRunPayload, setBaboRunPayload] = useState(null);
  const selectedModel = useMemo(
    () => models.find((item) => item.kimlik === selectedModelId) || null,
    [models, selectedModelId]
  );
  const providerOptions = useMemo(() => {
    const dynamic = Array.from(new Set(models.map((item) => safeText(item.saglayici)).filter(Boolean)));
    return Array.from(/* @__PURE__ */ new Set([...DEFAULT_PROVIDER_OPTIONS, ...dynamic]));
  }, [models]);
  const anoTone = healthToneFromStatus(anoHealth?.durum ?? anoHealth?.servis ?? null, null);
  const baboTone = healthToneFromStatus(baboHealth?.durum ?? null, baboHealth?.saglik?.saglikPuani ?? null);
  const panelTone = healthToneFromStatus(baboPanel?.durum ?? null, baboPanel?.genelSaglikPuani ?? null);
  const stopPolling = useCallback(() => {
    if (pollRef.current != null) {
      window.clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);
  const loadWorkerHealth = useCallback(async () => {
    try {
      const [anoDurum, baboDurum, panel] = await Promise.all([
        requestAno("/api/durum"),
        requestBabo("/api/durum"),
        requestBabo("/api/panel")
      ]);
      setAnoHealth(anoDurum.veri || null);
      setBaboHealth(baboDurum.veri || null);
      setBaboPanel(panel.veri || null);
    } catch (loadError) {
      console.error(loadError);
    }
  }, []);
  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const params = new URLSearchParams();
      if (providerFilter) params.set("saglayici", providerFilter);
      if (modelSearch.trim()) params.set("ara", modelSearch.trim());
      params.set("sinir", "200");
      const envelope = await requestAno(`/api/modeller?${params.toString()}`);
      const nextModels = ensureArray(envelope.veri?.modeller).filter((item) => safeText(item.kimlik) && safeText(item.ad));
      setModels(nextModels);
      setSelectedModelId((current) => current && nextModels.some((item) => item.kimlik === current) ? current : safeText(nextModels[0]?.kimlik));
    } catch (loadError) {
      setError(extractErrorMessage(loadError, "Model listesi al\u0131namad\u0131."));
    } finally {
      setModelsLoading(false);
    }
  }, [modelSearch, providerFilter]);
  const loadBaboArtifacts = useCallback(async (jobId) => {
    if (!jobId) return;
    try {
      const [statusEnvelope, historyEnvelope, archiveEnvelope, panelEnvelope] = await Promise.all([
        requestBabo(`/api/is/${encodeURIComponent(jobId)}`),
        requestBabo(`/api/is/${encodeURIComponent(jobId)}/gecmis`),
        requestBabo(`/api/is/${encodeURIComponent(jobId)}/arsiv`),
        requestBabo("/api/panel")
      ]);
      setBaboJobStatus(statusEnvelope.veri || null);
      setBaboHistory(ensureArray(historyEnvelope.veri?.gecmis));
      setBaboArchive(archiveEnvelope.veri?.arsiv || null);
      setBaboPanel(panelEnvelope.veri || null);
      const archiveImages = collectImagesDeep(archiveEnvelope.veri?.arsiv?.sonuc);
      if (archiveImages.length) {
        setResult((current) => ({
          source: "BABO",
          status: runStatusText(statusEnvelope.veri?.durum),
          message: safeText(archiveEnvelope.veri?.arsiv?.sonMesaj, current?.message || "BABO i\u015Fi g\xFCncellendi."),
          images: archiveImages,
          model: safeText(baboRunPayload?.etkinAyar?.model, current?.model || safeText(selectedModel?.ad, "-")),
          provider: safeText(baboRunPayload?.etkinAyar?.saglayici, current?.provider || safeText(selectedModel?.saglayici, "-")),
          prompt,
          fallbackUsed: current?.fallbackUsed,
          raw: archiveEnvelope.veri?.arsiv,
          meta: current?.meta || null,
          settings: baboRunPayload?.etkinAyar || current?.settings || null,
          orchestration: baboRunPayload?.orkestra || current?.orchestration || null,
          correlationId: current?.correlationId || null,
          timeoutMs: current?.timeoutMs || null,
          job: statusEnvelope.veri || current?.job || null,
          panel: panelEnvelope.veri || current?.panel || null
        }));
      }
    } catch (artifactError) {
      console.error(artifactError);
    }
  }, [baboRunPayload, prompt, selectedModel]);
  const pollBaboJob = useCallback(async (jobId) => {
    stopPolling();
    if (!jobId) return;
    try {
      const envelope = await requestBabo(`/api/is/${encodeURIComponent(jobId)}/izle`);
      const payload = envelope.veri || null;
      setBaboJobStatus(payload);
      setResult((current) => {
        if (!current || current.source !== "BABO") return current;
        return {
          ...current,
          status: runStatusText(payload?.durum),
          message: safeText(payload?.aktifAdim, current.message || "BABO i\u015Fi s\xFCr\xFCyor."),
          job: payload || current.job || null
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
      setError(extractErrorMessage(pollError, "BABO i\u015F durumu al\u0131namad\u0131."));
    }
  }, [loadBaboArtifacts, stopPolling]);
  const resetResultState = useCallback(() => {
    stopPolling();
    setResult(null);
    setBaboJobId("");
    setBaboJobStatus(null);
    setBaboHistory([]);
    setBaboArchive(null);
    setBaboRunPayload(null);
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
  const pushLocalHistory = useCallback((entry) => {
    setLocalHistory((current) => [entry, ...current].slice(0, 12));
  }, []);
  const anoGenerate = useCallback(async () => {
    if (!selectedModel) throw new Error("Model se\xE7melisin.");
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
      istemciKimligi: clientId
    };
    const envelope = await requestAno("/api/gorsel", {
      method: "POST",
      headers: {
        "X-Istemci-Kimligi": clientId
      },
      body: JSON.stringify(payload)
    });
    const imageUrl = safeText(envelope.veri?.url);
    const images = imageUrl ? [imageUrl] : collectImagesDeep(envelope.veri?.ham);
    if (!images.length) {
      throw new Error("ANO g\xF6rsel URL d\xF6nd\xFCrmedi.");
    }
    const nextResult = {
      source: "ANO",
      status: "Tamamland\u0131",
      message: "ANO do\u011Frudan \xFCretimi tamamlad\u0131.",
      images,
      model: safeText(envelope.veri?.model, selectedModel.ad),
      provider: safeText(selectedModel.saglayici, "-"),
      prompt: prompt.trim(),
      raw: envelope.veri,
      meta: null,
      settings: null,
      orchestration: null,
      correlationId: null,
      timeoutMs: null,
      job: null
    };
    setResult(nextResult);
    pushLocalHistory({
      id: randomId("run"),
      source: "ANO",
      status: nextResult.status,
      prompt: nextResult.prompt,
      images: nextResult.images,
      model: nextResult.model,
      provider: nextResult.provider,
      at: (/* @__PURE__ */ new Date()).toISOString()
    });
  }, [clientId, count, prompt, pushLocalHistory, quality, selectedModel, testMode, width, height]);
  const baboGenerate = useCallback(async (fallbackUsed = false) => {
    if (!selectedModel) throw new Error("Model se\xE7melisin.");
    const correlationId = randomId("corr");
    const body = {
      serviceType: "IMG",
      hizmetTuru: "IMG",
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
      timeoutMs: safeNumber(baboTimeoutMs, DEFAULT_BABO_TIMEOUT_MS),
      kullaniciKimligi: clientId
    };
    const envelope = await requestBabo("/api/calistir", {
      method: "POST",
      headers: {
        "X-Istemci-Kimligi": clientId,
        "X-Korelasyon-Anahtari": correlationId,
        "X-Saglayici": safeText(selectedModel.saglayici),
        "X-Kalite-Seviyesi": quality,
        "X-Timeout-Ms": String(safeNumber(baboTimeoutMs, DEFAULT_BABO_TIMEOUT_MS))
      },
      body: JSON.stringify(body)
    });
    const payload = envelope.veri || null;
    const nextJobId = safeText(payload?.baglam?.isKimligi || envelope.meta?.isKimligi);
    const images = collectImagesDeep(payload?.sonuc);
    setBaboRunPayload(payload);
    setBaboJobId(nextJobId);
    setBaboJobStatus({
      isKimligi: nextJobId,
      durum: images.length ? "tamamlandi" : "isleniyor",
      yuzde: images.length ? 100 : 20,
      aktifAdim: images.length ? "tamamland\u0131" : "i\u015Fleniyor",
      sonGuncelleme: (/* @__PURE__ */ new Date()).toISOString()
    });
    setResult({
      source: "BABO",
      status: images.length ? "Tamamland\u0131" : "\u0130\u015Fleniyor",
      message: images.length ? "BABO orkestra \xFCretimi tamamlad\u0131." : "BABO i\u015Fi ba\u015Flat\u0131ld\u0131 ve izleniyor.",
      images,
      model: safeText(payload?.etkinAyar?.model, selectedModel.ad),
      provider: safeText(payload?.etkinAyar?.saglayici, selectedModel.saglayici),
      prompt: prompt.trim(),
      fallbackUsed,
      raw: payload,
      meta: envelope.meta || null,
      settings: payload?.etkinAyar || null,
      orchestration: payload?.orkestra || null,
      correlationId: correlationId,
      timeoutMs: safeNumber(baboTimeoutMs, DEFAULT_BABO_TIMEOUT_MS),
      job: payload?.baglam || null
    });
    if (nextJobId) {
      pushLocalHistory({
        id: nextJobId,
        source: "BABO",
        status: images.length ? "Tamamland\u0131" : "\u0130\u015Fleniyor",
        prompt: prompt.trim(),
        images,
        model: safeText(payload?.etkinAyar?.model, selectedModel.ad),
        provider: safeText(payload?.etkinAyar?.saglayici, selectedModel.saglayici),
        at: (/* @__PURE__ */ new Date()).toISOString(),
        fallbackUsed
      });
      await loadBaboArtifacts(nextJobId);
      if (!images.length) {
        await pollBaboJob(nextJobId);
      }
    }
  }, [baboTimeoutMs, clientId, count, loadBaboArtifacts, pollBaboJob, prompt, pushLocalHistory, quality, ratio, referenceImageUrl, selectedModel, style, testMode]);
  const handleGenerate = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    setError("");
    setNotice("");
    if (!trimmedPrompt) {
      setError("Prompt zorunlu.");
      return;
    }
    if (trimmedPrompt.length > MAX_BABO_PROMPT) {
      setError(`Prompt ${MAX_BABO_PROMPT} karakteri a\u015Famaz.`);
      return;
    }
    if (!selectedModel) {
      setError("Model se\xE7melisin.");
      return;
    }
    resetResultState();
    setSubmitting(true);
    try {
      if (workerMode === "ano") {
        try {
          if (trimmedPrompt.length > MAX_ANO_PROMPT) {
            throw new Error(`ANO prompt s\u0131n\u0131r\u0131 ${MAX_ANO_PROMPT} karakter. BABO fallback kullan\u0131lacak.`);
          }
          await anoGenerate();
          setNotice("Birincil worker ANO kullan\u0131ld\u0131.");
        } catch (amgError) {
          if (!autoFallback) throw amgError;
          setNotice(`ANO hata verdi, BABO fallback devreye al\u0131nd\u0131: ${extractErrorMessage(amgError, "ANO ba\u015Far\u0131s\u0131z oldu.")}`);
          await baboGenerate(true);
        }
      } else {
        await baboGenerate(false);
        setNotice("BABO orkestrasyon ak\u0131\u015F\u0131 kullan\u0131ld\u0131.");
      }
      await loadWorkerHealth();
    } catch (generateError) {
      setError(extractErrorMessage(generateError, "G\xF6rsel \xFCretimi ba\u015Flat\u0131lamad\u0131."));
    } finally {
      setSubmitting(false);
    }
  }, [anoGenerate, baboGenerate, autoFallback, loadWorkerHealth, prompt, resetResultState, selectedModel, workerMode]);
  const loadHistoryRecord = useCallback(async (entry) => {
    setError("");
    setNotice("");
    setResult({
      source: entry.source,
      status: entry.status,
      message: "Ge\xE7mi\u015F kay\u0131t a\xE7\u0131ld\u0131.",
      images: entry.images,
      model: entry.model,
      provider: entry.provider,
      prompt: entry.prompt,
      fallbackUsed: entry.fallbackUsed,
      meta: null,
      settings: null,
      orchestration: null,
      correlationId: null,
      timeoutMs: null,
      job: null
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
  return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("style", null, `
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
      `), /* @__PURE__ */ React.createElement("div", { className: "shell" }, /* @__PURE__ */ React.createElement("div", { className: "app" }, /* @__PURE__ */ React.createElement("section", { className: "panel header" }, /* @__PURE__ */ React.createElement("div", { className: "title-row" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("div", { className: "title" }, "IMAGE.TSX"), /* @__PURE__ */ React.createElement("div", { className: "subtitle" }, "Birincil worker ANO. \u0130kincil/orchestrator worker BABO. Model listesi ANO ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "GET /api/modeller"), " ile, \xFCretim ANO ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "POST /api/gorsel"), " ile; orkestrasyon ise BABO ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "POST /api/calistir"), " ile y\xFCr\xFCt\xFCl\xFCr.")), /* @__PURE__ */ React.createElement("div", { className: "badge-row" }, /* @__PURE__ */ React.createElement("div", { className: "badge" }, /* @__PURE__ */ React.createElement("span", { className: `dot ${anoTone}` }), " ANO \xB7 ", toneText(anoTone)), /* @__PURE__ */ React.createElement("div", { className: "badge" }, /* @__PURE__ */ React.createElement("span", { className: `dot ${baboTone}` }), " BABO \xB7 ", toneText(baboTone)), /* @__PURE__ */ React.createElement("div", { className: "badge" }, /* @__PURE__ */ React.createElement("span", { className: `dot ${panelTone}` }), " Panel \xB7 ", toneText(panelTone)))), /* @__PURE__ */ React.createElement("div", { className: "tiny" }, "ANO durum: ", safeText(anoHealth?.durum, "-"), " \xB7 BABO sa\u011Fl\u0131k puan\u0131: ", safeNumber(baboHealth?.saglik?.saglikPuani, 0) || "-", " \xB7 Panel aktif i\u015F: ", safeNumber(baboPanel?.aktifIsSayisi, 0))), error ? /* @__PURE__ */ React.createElement("div", { className: "error-box" }, error) : null, notice ? /* @__PURE__ */ React.createElement("div", { className: "notice-box" }, notice) : null, /* @__PURE__ */ React.createElement("div", { className: "grid" }, /* @__PURE__ */ React.createElement("section", { className: "panel section" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "\xDCretim Formu"), /* @__PURE__ */ React.createElement("div", { className: "field full" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Prompt"), /* @__PURE__ */ React.createElement(
    "textarea",
    {
      placeholder: "Ne \xFCretilece\u011Fini a\xE7\u0131k yaz. Stil, \u0131\u015F\u0131k, kompozisyon ve kullan\u0131m amac\u0131 ekle.",
      value: prompt,
      onChange: (event) => setPrompt(event.target.value)
    }
  ), /* @__PURE__ */ React.createElement("div", { className: "tiny" }, "ANO s\u0131n\u0131r\u0131 ", MAX_ANO_PROMPT, ", BABO IMG s\u0131n\u0131r\u0131 ", MAX_BABO_PROMPT, " karakter.")), /* @__PURE__ */ React.createElement("div", { className: "chips" }, QUICK_PROMPTS.map((item) => /* @__PURE__ */ React.createElement("button", { key: item, type: "button", className: "chip", onClick: () => setPrompt(item) }, "H\u0131zl\u0131 prompt"))), /* @__PURE__ */ React.createElement("div", { className: "controls-grid" }, /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "\xC7al\u0131\u015Fma modu"), /* @__PURE__ */ React.createElement("div", { className: "chips" }, /* @__PURE__ */ React.createElement("button", { type: "button", className: `chip ${workerMode === "ano" ? "active" : ""}`, onClick: () => setWorkerMode("ano") }, "ANO birincil"), /* @__PURE__ */ React.createElement("button", { type: "button", className: `chip ${workerMode === "babo" ? "active" : ""}`, onClick: () => setWorkerMode("babo") }, "BABO orkestra"))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Sa\u011Flay\u0131c\u0131 filtresi"), /* @__PURE__ */ React.createElement("select", { value: providerFilter, onChange: (event) => setProviderFilter(event.target.value) }, /* @__PURE__ */ React.createElement("option", { value: "" }, "T\xFCm\xFC"), providerOptions.filter(Boolean).map((provider) => /* @__PURE__ */ React.createElement("option", { key: provider, value: provider }, provider)))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Model arama"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: modelSearch,
      onChange: (event) => setModelSearch(event.target.value),
      placeholder: "ANO /api/modeller \xFCzerinde ara"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Model"), /* @__PURE__ */ React.createElement(
    "select",
    {
      value: selectedModelId,
      onChange: (event) => setSelectedModelId(event.target.value),
      disabled: modelsLoading || !models.length
    },
    !models.length ? /* @__PURE__ */ React.createElement("option", { value: "" }, modelsLoading ? "Modeller y\xFCkleniyor..." : "Model bulunamad\u0131") : null,
    models.map((item) => /* @__PURE__ */ React.createElement("option", { key: item.kimlik, value: item.kimlik }, item.ad, " \xB7 ", item.saglayici))
  )), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Kalite"), /* @__PURE__ */ React.createElement("div", { className: "chips" }, QUALITY_OPTIONS.map((item) => /* @__PURE__ */ React.createElement("button", { key: item, type: "button", className: `chip ${quality === item ? "active" : ""}`, onClick: () => setQuality(item) }, item)))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Oran"), /* @__PURE__ */ React.createElement("div", { className: "chips" }, RATIO_OPTIONS.map((item) => /* @__PURE__ */ React.createElement(
    "button",
    {
      key: item.key,
      type: "button",
      className: `chip ${ratio === item.key ? "active" : ""}`,
      onClick: () => {
        setRatio(item.key);
        setWidth(item.width);
        setHeight(item.height);
      }
    },
    item.label
  )))), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Geni\u015Flik"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      min: 256,
      max: 2048,
      step: 1,
      value: width,
      onChange: (event) => {
        const nextWidth = Math.max(256, Math.min(2048, safeNumber(event.target.value, 1024)));
        setWidth(nextWidth);
        setRatio(ratioFromSize(nextWidth, height));
      }
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Y\xFCkseklik"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      min: 256,
      max: 2048,
      step: 1,
      value: height,
      onChange: (event) => {
        const nextHeight = Math.max(256, Math.min(2048, safeNumber(event.target.value, 1024)));
        setHeight(nextHeight);
        setRatio(ratioFromSize(width, nextHeight));
      }
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Adet"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      min: 1,
      max: 4,
      step: 1,
      value: count,
      onChange: (event) => setCount(Math.max(1, Math.min(4, safeNumber(event.target.value, 1))))
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Stil (BABO normalize eder; provider etkisi s\u0131n\u0131rl\u0131 olabilir)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: style,
      onChange: (event) => setStyle(event.target.value),
      placeholder: "\xF6r. cinematic, anime, photoreal"
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "field full" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "Referans g\xF6rsel URL (BABO request alan\u0131)"), /* @__PURE__ */ React.createElement(
    "input",
    {
      value: referenceImageUrl,
      onChange: (event) => setReferenceImageUrl(event.target.value),
      placeholder: "https://..."
    }
  )), /* @__PURE__ */ React.createElement("div", { className: "field" }, /* @__PURE__ */ React.createElement("div", { className: "label" }, "BABO timeout ms"), /* @__PURE__ */ React.createElement(
    "input",
    {
      type: "number",
      min: 1000,
      max: 300000,
      step: 1000,
      value: baboTimeoutMs,
      onChange: (event) => setBaboTimeoutMs(Math.max(1000, Math.min(3e5, safeNumber(event.target.value, DEFAULT_BABO_TIMEOUT_MS))))
    }
  ))), /* @__PURE__ */ React.createElement("div", { className: "switch-row" }, /* @__PURE__ */ React.createElement("label", { className: "switch" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: testMode, onChange: (event) => setTestMode(event.target.checked) }), "Test modu"), /* @__PURE__ */ React.createElement("label", { className: "switch" }, /* @__PURE__ */ React.createElement("input", { type: "checkbox", checked: autoFallback, onChange: (event) => setAutoFallback(event.target.checked), disabled: workerMode !== "ano" }), "ANO hata verirse BABO fallback")), /* @__PURE__ */ React.createElement("div", { className: "actions" }, /* @__PURE__ */ React.createElement("button", { className: "primary", type: "button", onClick: () => void handleGenerate(), disabled: submitting || modelsLoading }, submitting ? "\xC7al\u0131\u015F\u0131yor..." : workerMode === "ano" ? "ANO ile \xFCret" : "BABO ile \xFCret"), /* @__PURE__ */ React.createElement("button", { className: "secondary", type: "button", onClick: () => {
    resetResultState();
    setError("");
    setNotice("");
  }, disabled: submitting }, "Sonucu temizle"), /* @__PURE__ */ React.createElement("button", { className: "secondary", type: "button", onClick: () => {
    void loadModels();
    void loadWorkerHealth();
  }, disabled: submitting }, "Modelleri ve durumu yenile")), /* @__PURE__ */ React.createElement("div", { className: "info-box brand" }, "Sayfa art\u0131k ANO i\xE7in ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "/api/modeller"), ", ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "/api/gorsel"), " ve ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "/api/durum"), " kullan\u0131r. BABO taraf\u0131nda ise ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "/api/calistir"), ", ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "/api/durum"), ", ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "/api/panel"), ",", /* @__PURE__ */ React.createElement("span", { className: "mono" }, " /api/is/:isKimligi"), ", ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "/gecmis"), ", ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "/arsiv"), " ve ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "/izle"), " kullan\u0131l\u0131r. BABO iste\u011Finde ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "X-Korelasyon-Anahtari"), " ve ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, "X-Timeout-Ms"), " da ta\u015F\u0131n\u0131r.")), /* @__PURE__ */ React.createElement("section", { className: "panel section" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "Aktif Sonu\xE7 ve \u0130zleme"), result ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { className: "result-meta" }, /* @__PURE__ */ React.createElement("div", { className: "meta-list" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Kaynak:"), " ", result.source, result.fallbackUsed ? " \xB7 fallback" : ""), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Durum:"), " ", result.status), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Model:"), " ", result.model), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Sa\u011Flay\u0131c\u0131:"), " ", result.provider), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Mesaj:"), " ", result.message), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "\u0130\u015F kimli\u011Fi:"), " ", safeText(result.job?.isKimligi || result.meta?.isKimligi, "-")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Korelasyon:"), " ", safeText(result.correlationId || result.job?.korelasyonAnahtari, "-")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "S\xFCre:"), " ", result.meta?.sureMs != null ? `${result.meta?.sureMs} ms` : "-"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Maliyet:"), " ", result.meta?.maliyet != null ? result.meta?.maliyet : "-"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Timeout:"), " ", result.timeoutMs != null ? `${result.timeoutMs} ms` : "-"), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Fallback zinciri:"), " ", ensureArray(result.orchestration?.fallbackZinciri).join(" -> ") || "-")), /* @__PURE__ */ React.createElement("div", { className: "hint" }, result.prompt)), result.images.length ? /* @__PURE__ */ React.createElement("div", { className: "result-grid" }, result.images.map((src) => /* @__PURE__ */ React.createElement("div", { key: src, className: "image-card" }, /* @__PURE__ */ React.createElement("img", { src, alt: "\xDCretilen g\xF6rsel" })))) : /* @__PURE__ */ React.createElement("div", { className: "info-box" }, "G\xF6rsel hen\xFCz d\xF6nmedi. BABO i\u015F takibi panelini a\u015Fa\u011F\u0131dan izle.")) : /* @__PURE__ */ React.createElement("div", { className: "info-box" }, "Hen\xFCz aktif sonu\xE7 yok."), /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "BABO i\u015F durumu"), baboJobId ? /* @__PURE__ */ React.createElement("div", { className: "list-card" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "\u0130\u015F kimli\u011Fi:"), " ", /* @__PURE__ */ React.createElement("span", { className: "mono" }, baboJobId)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Durum:"), " ", runStatusText(baboJobStatus?.durum)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Y\xFCzde:"), " %", safeNumber(baboJobStatus?.yuzde, 0)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Aktif ad\u0131m:"), " ", safeText(baboJobStatus?.aktifAdim, "-")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Son g\xFCncelleme:"), " ", formatDate(baboJobStatus?.sonGuncelleme)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Son hata:"), " ", safeText(baboJobStatus?.sonHata?.mesaj || baboJobStatus?.sonHata, "-")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Tahmini biti\u015F:"), " ", formatDate(baboJobStatus?.tahminiBitis)), /* @__PURE__ */ React.createElement("div", { className: "actions" }, /* @__PURE__ */ React.createElement("button", { className: "secondary", type: "button", onClick: () => void loadBaboArtifacts(baboJobId) }, "Ge\xE7mi\u015F ve ar\u015Fivi yenile"), !isBaboTerminal(baboJobStatus?.durum) ? /* @__PURE__ */ React.createElement("button", { className: "secondary", type: "button", onClick: () => void pollBaboJob(baboJobId) }, "\u0130zlemeyi s\xFCrd\xFCr") : null)) : /* @__PURE__ */ React.createElement("div", { className: "info-box" }, "BABO i\u015F kimli\u011Fi olu\u015Fmad\u0131ysa \u015Fu an ANO sonucu g\xF6steriliyor olabilir."))), /* @__PURE__ */ React.createElement("div", { className: "grid" }, /* @__PURE__ */ React.createElement("section", { className: "panel section" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "BABO olay ge\xE7mi\u015Fi"), /* @__PURE__ */ React.createElement("div", { className: "list" }, !baboHistory.length ? /* @__PURE__ */ React.createElement("div", { className: "info-box" }, "Hen\xFCz BABO olay ge\xE7mi\u015Fi yok.") : baboHistory.map((event) => /* @__PURE__ */ React.createElement("div", { key: safeText(event.olayKimligi, randomId("evt")), className: "list-card" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, safeText(event.olay, "olay"))), /* @__PURE__ */ React.createElement("div", { className: "tiny" }, formatDate(event.zamanDamgasi)), /* @__PURE__ */ React.createElement("pre", null, JSON.stringify(event.veri, null, 2)))))), /* @__PURE__ */ React.createElement("section", { className: "panel section" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "BABO ar\u015Fiv \xF6zeti"), baboArchive ? /* @__PURE__ */ React.createElement("div", { className: "list-card" }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Durum:"), " ", safeText(baboArchive.durum, "-")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Ba\u015Flang\u0131\xE7:"), " ", formatDate(baboArchive.baslangicZamani)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Biti\u015F:"), " ", formatDate(baboArchive.bitisZamani)), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Son mesaj:"), " ", safeText(baboArchive.sonMesaj, "-")), /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, "Hizmet t\xFCr\xFC:"), " ", safeText(baboArchive.hizmetTuru, "-")), /* @__PURE__ */ React.createElement("pre", null, JSON.stringify(baboArchive.sonuc, null, 2))) : /* @__PURE__ */ React.createElement("div", { className: "info-box" }, "Ar\u015Fiv kayd\u0131 hen\xFCz yok."))), /* @__PURE__ */ React.createElement("section", { className: "panel section" }, /* @__PURE__ */ React.createElement("div", { className: "section-title" }, "Yerel ge\xE7mi\u015F"), /* @__PURE__ */ React.createElement("div", { className: "list" }, !localHistory.length ? /* @__PURE__ */ React.createElement("div", { className: "info-box" }, "Bu oturumda hen\xFCz \xFCretim ge\xE7mi\u015Fi yok.") : localHistory.map((entry) => /* @__PURE__ */ React.createElement("button", { key: entry.id, type: "button", className: "list-card history-button", onClick: () => void loadHistoryRecord(entry) }, /* @__PURE__ */ React.createElement("div", null, /* @__PURE__ */ React.createElement("strong", null, entry.source), " \xB7 ", entry.status, entry.fallbackUsed ? " \xB7 fallback" : ""), /* @__PURE__ */ React.createElement("div", { className: "tiny" }, formatDate(entry.at)), /* @__PURE__ */ React.createElement("div", null, entry.prompt), /* @__PURE__ */ React.createElement("div", { className: "tiny" }, entry.model, " \xB7 ", entry.provider))))))));
}
export {
  ImagePage as default
};
