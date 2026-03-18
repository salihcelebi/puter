import React, { useCallback, useEffect, useMemo, useState } from "react";

const DEFAULT_ANO_BASE_URL = "https://turk.puter.site/workers/all/ano.js";
const QUALITY_OPTIONS = ["low", "medium", "high"];
const COUNT_OPTIONS = [1, 2, 3, 4];
const RATIO_OPTIONS = [
  { key: "1:1", width: 1024, height: 1024 },
  { key: "16:9", width: 1600, height: 900 },
  { key: "9:16", width: 900, height: 1600 },
  { key: "4:5", width: 1200, height: 1500 }
];
const QUICK_PROMPTS = [
  "Sisli İstanbul gecesi, ıslak taş sokaklar, neon yansımalar, sinematik ışık, gerçekçi detay.",
  "Premium ürün çekimi, siyah arka plan, yumuşak stüdyo ışığı, lüks reklam estetiği.",
  "Anime karakter, dinamik poz, güçlü kontrast, ayrıntılı kostüm, poster kalitesi."
];

function safeText(value, fallback = "") {
  const text = String(value ?? "").trim();
  return text || fallback;
}

function safeNumber(value, fallback) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

function ensureArray(value) {
  return Array.isArray(value) ? value : [];
}

function buildUrl(baseUrl, path) {
  const base = safeText(baseUrl, DEFAULT_ANO_BASE_URL).replace(/\/+$/, "");
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
  } catch {
    return String(value);
  }
}

function createId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}

function readStoredBaseUrl() {
  if (typeof window === "undefined") return DEFAULT_ANO_BASE_URL;
  try {
    return safeText(window.localStorage.getItem("image.tsx.anoBaseUrl"), DEFAULT_ANO_BASE_URL);
  } catch {
    return DEFAULT_ANO_BASE_URL;
  }
}

function readStoredClientId() {
  if (typeof window === "undefined") return "image-tsx";
  try {
    const current = safeText(window.localStorage.getItem("image.tsx.clientId"));
    if (current) return current;
    const next = createId("imgui");
    window.localStorage.setItem("image.tsx.clientId", next);
    return next;
  } catch {
    return createId("imgui");
  }
}

function ratioFromSize(width, height) {
  const exact = RATIO_OPTIONS.find((item) => item.width === width && item.height === height);
  return exact ? exact.key : "1:1";
}

function sizeFromRatio(ratioKey) {
  const exact = RATIO_OPTIONS.find((item) => item.key === ratioKey) || RATIO_OPTIONS[0];
  return { width: exact.width, height: exact.height };
}

function collectImageUrls(value, bag = new Set()) {
  if (typeof value === "string") {
    const text = value.trim();
    if (/^https?:\/\//i.test(text) || text.startsWith("data:image/") || text.startsWith("blob:")) {
      bag.add(text);
    }
    return [...bag];
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectImageUrls(item, bag));
    return [...bag];
  }
  if (value && typeof value === "object") {
    ["url", "src", "image_url"].forEach((key) => {
      if (value[key] != null) collectImageUrls(value[key], bag);
    });
    ["images", "gorseller", "ham", "sonuc", "cikti", "veri"].forEach((key) => {
      if (value[key] != null) collectImageUrls(value[key], bag);
    });
  }
  return [...bag];
}

function parseAnoError(payload, fallback) {
  if (payload && typeof payload === "object") {
    if (typeof payload.hata === "string" && payload.hata.trim()) return payload.hata.trim();
    if (payload.hata && typeof payload.hata === "object" && typeof payload.hata.mesaj === "string") {
      return safeText(payload.hata.mesaj, fallback);
    }
  }
  return fallback;
}

async function parseJsonResponse(response) {
  const text = await response.text();
  const contentType = String(response.headers.get("content-type") || "").toLowerCase();

  if (/<!doctype|<html/i.test(text)) {
    throw new Error("Beklenmeyen HTML yanıtı alındı. Worker URL veya yönlendirme yanlış olabilir.");
  }

  if (!contentType.includes("application/json")) {
    throw new Error("JSON beklenirken farklı içerik tipi döndü.");
  }

  try {
    return JSON.parse(text);
  } catch {
    throw new Error("Worker geçerli JSON döndürmedi.");
  }
}

async function requestAno(baseUrl, path, init = {}, timeoutMs = 45000) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(buildUrl(baseUrl, path), {
      ...init,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...(init.headers || {})
      }
    });

    const payload = await parseJsonResponse(response);
    if (!response.ok || payload?.ok === false) {
      throw new Error(parseAnoError(payload, `İstek başarısız oldu (${response.status}).`));
    }
    return payload;
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error("İstek zaman aşımına uğradı.");
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

function HealthBadge({ title, value, tone }) {
  return (
    <div className={`badge ${tone}`}>
      <span className="dot" />
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

export default function ImagePage() {
  const clientId = useMemo(() => readStoredClientId(), []);
  const [anoBaseUrl, setAnoBaseUrl] = useState(() => readStoredBaseUrl());
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(false);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [models, setModels] = useState([]);
  const [providerFilter, setProviderFilter] = useState("");
  const [modelSearch, setModelSearch] = useState("");
  const [selectedModelId, setSelectedModelId] = useState("");
  const [prompt, setPrompt] = useState("");
  const [quality, setQuality] = useState("medium");
  const [ratio, setRatio] = useState("1:1");
  const [width, setWidth] = useState(1024);
  const [height, setHeight] = useState(1024);
  const [count, setCount] = useState(1);
  const [testMode, setTestMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [result, setResult] = useState(null);
  const [history, setHistory] = useState([]);

  const selectedModel = useMemo(() => models.find((item) => item.kimlik === selectedModelId) || null, [models, selectedModelId]);
  const providerOptions = useMemo(() => ["", ...Array.from(new Set(models.map((item) => safeText(item.saglayici)).filter(Boolean)))], [models]);

  const healthTone = useMemo(() => {
    const status = safeText(health?.durum).toLowerCase();
    if (!status) return "idle";
    if (status === "hazir") return "ok";
    return "warn";
  }, [health]);

  const persistBaseUrl = useCallback((nextValue) => {
    setAnoBaseUrl(nextValue);
    try {
      window.localStorage.setItem("image.tsx.anoBaseUrl", nextValue);
    } catch {
      /* noop */
    }
  }, []);

  const loadHealth = useCallback(async () => {
    setHealthLoading(true);
    try {
      const envelope = await requestAno(anoBaseUrl, "/api/durum", { method: "GET" }, 30000);
      setHealth(envelope.veri || null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Durum bilgisi alınamadı.");
    } finally {
      setHealthLoading(false);
    }
  }, [anoBaseUrl]);

  const loadModels = useCallback(async () => {
    setModelsLoading(true);
    try {
      const params = new URLSearchParams();
      if (providerFilter) params.set("saglayici", providerFilter);
      if (safeText(modelSearch)) params.set("ara", modelSearch.trim());
      params.set("sinir", "200");

      const envelope = await requestAno(anoBaseUrl, `/api/modeller?${params.toString()}`, { method: "GET" }, 30000);
      const nextModels = ensureArray(envelope?.veri?.modeller).filter((item) => safeText(item?.kimlik));
      setModels(nextModels);
      setSelectedModelId((current) => current && nextModels.some((item) => item.kimlik === current) ? current : safeText(nextModels[0]?.kimlik));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Model listesi alınamadı.");
    } finally {
      setModelsLoading(false);
    }
  }, [anoBaseUrl, modelSearch, providerFilter]);

  useEffect(() => {
    void loadHealth();
  }, [loadHealth]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void loadModels();
    }, 220);
    return () => window.clearTimeout(timer);
  }, [loadModels]);

  const pushHistory = useCallback((entry) => {
    setHistory((current) => [entry, ...current].slice(0, 12));
  }, []);

  const applyRatio = useCallback((ratioKey) => {
    setRatio(ratioKey);
    const nextSize = sizeFromRatio(ratioKey);
    setWidth(nextSize.width);
    setHeight(nextSize.height);
  }, []);

  const handleGenerate = useCallback(async () => {
    const trimmedPrompt = prompt.trim();
    setError("");
    setNotice("");

    if (!trimmedPrompt) {
      setError("Prompt zorunlu.");
      return;
    }
    if (trimmedPrompt.length > 2000) {
      setError("ANO worker prompt alanında en fazla 2000 karakter kabul eder.");
      return;
    }
    if (!selectedModel) {
      setError("Model seçmelisin.");
      return;
    }

    setSubmitting(true);

    try {
      const payload = {
        prompt: trimmedPrompt,
        model: selectedModel.kimlik,
        kalite: quality,
        genislik: width,
        yukseklik: height,
        adet: count,
        testModu: testMode,
        istemciKimligi: clientId
      };

      const envelope = await requestAno(
        anoBaseUrl,
        "/api/gorsel",
        {
          method: "POST",
          headers: { "X-Istemci-Kimligi": clientId },
          body: JSON.stringify(payload)
        },
        60000
      );

      const directUrl = safeText(envelope?.veri?.url);
      const images = directUrl ? [directUrl] : collectImageUrls(envelope?.veri?.ham);
      if (!images.length) {
        throw new Error("ANO worker görsel URL döndürmedi.");
      }

      const nextResult = {
        id: createId("run"),
        source: "ANO",
        status: "Tamamlandı",
        prompt: trimmedPrompt,
        images,
        model: safeText(envelope?.veri?.model, selectedModel.ad),
        provider: safeText(selectedModel.saglayici, "-"),
        raw: envelope?.veri || null,
        at: new Date().toISOString()
      };

      setResult(nextResult);
      pushHistory(nextResult);
      setNotice("İstek ano.js ile başarıyla tamamlandı.");
      void loadHealth();
    } catch (generateError) {
      setError(generateError instanceof Error ? generateError.message : "Görsel üretimi başarısız oldu.");
    } finally {
      setSubmitting(false);
    }
  }, [anoBaseUrl, clientId, count, height, loadHealth, prompt, pushHistory, quality, selectedModel, testMode, width]);

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
          --idle: #98a2b3;
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
        .app { max-width: 1320px; margin: 0 auto; display: grid; gap: 16px; }
        .panel {
          background: var(--panel);
          border: 1px solid var(--line);
          border-radius: 24px;
          box-shadow: var(--shadow);
          overflow: hidden;
        }
        .header, .section { padding: 22px 24px; display: grid; gap: 16px; }
        .title-row { display: flex; justify-content: space-between; gap: 16px; align-items: center; flex-wrap: wrap; }
        .title { font-size: 30px; font-weight: 900; letter-spacing: -0.02em; }
        .subtitle { font-size: 15px; color: var(--muted); line-height: 1.65; }
        .badge-row { display: flex; flex-wrap: wrap; gap: 10px; }
        .badge {
          min-height: 40px; border-radius: 999px; padding: 0 14px; display: inline-flex; align-items: center; gap: 10px;
          border: 1px solid var(--line); background: #f8fafc; font-size: 14px; font-weight: 700;
        }
        .dot { width: 10px; height: 10px; border-radius: 50%; background: var(--idle); }
        .badge.ok .dot { background: var(--ok); }
        .badge.warn .dot { background: var(--warn); }
        .badge.bad .dot { background: var(--bad); }
        .badge.idle .dot { background: var(--idle); }
        .grid { display: grid; grid-template-columns: 1.08fr 0.92fr; gap: 16px; }
        .section-title { font-size: 18px; font-weight: 800; }
        .controls-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .field { display: grid; gap: 8px; }
        .field.full { grid-column: 1 / -1; }
        .label { font-size: 13px; font-weight: 800; letter-spacing: 0.02em; color: #344054; text-transform: uppercase; }
        input, select, textarea {
          width: 100%; border-radius: 16px; border: 1px solid #d7dde5; background: #fff; font: inherit; color: var(--text); padding: 13px 14px; outline: none;
        }
        textarea { min-height: 148px; resize: vertical; }
        .chips { display: flex; flex-wrap: wrap; gap: 10px; }
        .chip {
          min-height: 42px; border-radius: 999px; padding: 0 16px; border: 1px solid #d7dde5; background: #fff; color: #344054; font-weight: 700; cursor: pointer;
        }
        .switch { display: inline-flex; align-items: center; gap: 8px; padding: 10px 14px; border-radius: 999px; border: 1px solid var(--line); background: #fff; font-size: 14px; font-weight: 700; }
        .switch input { width: auto; margin: 0; }
        .actions { display: flex; flex-wrap: wrap; gap: 12px; align-items: center; }
        .primary, .secondary {
          min-height: 52px; border-radius: 999px; border: 1px solid transparent; padding: 0 22px; font-size: 16px; font-weight: 800; cursor: pointer;
        }
        .primary { background: linear-gradient(180deg, #458679 0%, #2f6f64 100%); color: white; }
        .secondary { background: white; color: #344054; border-color: var(--line); }
        .primary:disabled, .secondary:disabled { opacity: 0.58; cursor: not-allowed; }
        .hint, .info-box {
          border-radius: 18px; border: 1px solid var(--line); background: #f8fafc; padding: 14px 16px; color: #475467; font-size: 14px; line-height: 1.6;
        }
        .info-box.brand { background: var(--brand-soft); border-color: #d5e7e2; color: #244b44; }
        .error-box {
          border-radius: 18px; border: 1px solid #fecaca; background: #fff1f2; color: #9f1239; padding: 14px 16px; font-size: 14px; font-weight: 700;
        }
        .notice-box {
          border-radius: 18px; border: 1px solid #cfe7de; background: #f0faf6; color: #14532d; padding: 14px 16px; font-size: 14px; font-weight: 700;
        }
        .result-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
        .image-card { border-radius: 20px; overflow: hidden; border: 1px solid var(--line); background: #f8fafc; min-height: 220px; }
        .image-card img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .result-meta { display: grid; gap: 10px; }
        .meta-list { display: grid; gap: 8px; font-size: 14px; color: #475467; }
        .list { display: grid; gap: 10px; max-height: 420px; overflow: auto; }
        .list-card { border-radius: 18px; border: 1px solid var(--line); background: #fff; padding: 14px 16px; display: grid; gap: 8px; }
        .history-button { width: 100%; border: none; text-align: left; cursor: pointer; }
        .tiny { font-size: 12px; color: #667085; }
        .mono { font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', monospace; word-break: break-word; }
        pre { margin: 0; border-radius: 16px; background: #0f172a; color: #d5f5e3; padding: 14px; font-size: 12px; overflow: auto; max-height: 260px; }
        @media (max-width: 1060px) { .grid, .result-grid, .controls-grid { grid-template-columns: 1fr; } }
        @media (max-width: 720px) { .shell { padding: 12px; } .header, .section { padding-left: 16px; padding-right: 16px; } .title { font-size: 24px; } }
      `}</style>

      <div className="shell">
        <div className="app">
          <section className="panel header">
            <div className="title-row">
              <div>
                <div className="title">IMAGE.TSX · ANO UYUMLU</div>
                <div className="subtitle">
                  Bu sürüm yalnızca <span className="mono">ano.js</span> uçlarına göre çalışır:
                  {' '}<span className="mono">GET /api/durum</span>, <span className="mono">GET /api/modeller</span>, <span className="mono">POST /api/gorsel</span>.
                </div>
              </div>
              <div className="badge-row">
                <HealthBadge title="Worker" value={safeText(health?.servis, healthLoading ? "Yükleniyor" : "-")} tone={healthTone} />
                <HealthBadge title="Durum" value={safeText(health?.durum, healthLoading ? "Kontrol" : "-")} tone={healthTone} />
                <HealthBadge title="İstemci" value={clientId.slice(0, 14)} tone="idle" />
              </div>
            </div>
          </section>

          <div className="grid">
            <section className="panel section">
              <div className="section-title">İstek Ayarları</div>

              <div className="controls-grid">
                <div className="field full">
                  <div className="label">ANO Worker URL</div>
                  <input value={anoBaseUrl} onChange={(event) => persistBaseUrl(event.target.value)} placeholder={DEFAULT_ANO_BASE_URL} />
                </div>

                <div className="field">
                  <div className="label">Sağlayıcı filtresi</div>
                  <select value={providerFilter} onChange={(event) => setProviderFilter(event.target.value)}>
                    {providerOptions.map((option) => (
                      <option key={option || "all"} value={option}>{option || "Tümü"}</option>
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
                    {!models.length ? <option value="">Model yok</option> : null}
                    {models.map((model) => (
                      <option key={model.kimlik} value={model.kimlik}>
                        {safeText(model.ad, model.kimlik)}{model.saglayici ? ` · ${model.saglayici}` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="field full">
                  <div className="label">Prompt</div>
                  <textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={2000} placeholder="Görsel tarifini yaz..." />
                </div>
              </div>

              <div className="chips">
                {QUICK_PROMPTS.map((item) => (
                  <button key={item} type="button" className="chip" onClick={() => setPrompt(item)}>Hazır prompt</button>
                ))}
              </div>

              <div className="controls-grid">
                <div className="field">
                  <div className="label">Kalite</div>
                  <select value={quality} onChange={(event) => setQuality(event.target.value)}>
                    {QUALITY_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>

                <div className="field">
                  <div className="label">Oran</div>
                  <select value={ratio} onChange={(event) => applyRatio(event.target.value)}>
                    {RATIO_OPTIONS.map((item) => <option key={item.key} value={item.key}>{item.key}</option>)}
                  </select>
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
                      const next = Math.max(256, Math.min(2048, safeNumber(event.target.value, 1024)));
                      setWidth(next);
                      setRatio(ratioFromSize(next, height));
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
                      const next = Math.max(256, Math.min(2048, safeNumber(event.target.value, 1024)));
                      setHeight(next);
                      setRatio(ratioFromSize(width, next));
                    }}
                  />
                </div>

                <div className="field">
                  <div className="label">Adet</div>
                  <select value={count} onChange={(event) => setCount(safeNumber(event.target.value, 1))}>
                    {COUNT_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </div>
              </div>

              <label className="switch">
                <input type="checkbox" checked={testMode} onChange={(event) => setTestMode(event.target.checked)} />
                Test modu
              </label>

              <div className="actions">
                <button className="primary" type="button" onClick={() => void handleGenerate()} disabled={submitting || modelsLoading}>
                  {submitting ? "Üretiliyor..." : "ANO ile üret"}
                </button>
                <button className="secondary" type="button" onClick={() => { setResult(null); setError(""); setNotice(""); }} disabled={submitting}>
                  Sonucu temizle
                </button>
                <button className="secondary" type="button" onClick={() => { void loadModels(); void loadHealth(); }} disabled={submitting}>
                  Modelleri ve durumu yenile
                </button>
              </div>

              <div className="info-box brand">
                Gönderilen gövde ano.js ile birebir uyumludur: <span className="mono">prompt</span>, <span className="mono">model</span>, <span className="mono">kalite</span>, <span className="mono">genislik</span>, <span className="mono">yukseklik</span>, <span className="mono">adet</span>, <span className="mono">testModu</span>, <span className="mono">istemciKimligi</span>. Header olarak da <span className="mono">X-Istemci-Kimligi</span> gönderilir.
              </div>

              {error ? <div className="error-box">{error}</div> : null}
              {notice ? <div className="notice-box">{notice}</div> : null}
            </section>

            <section className="panel section">
              <div className="section-title">Aktif Sonuç</div>
              {result ? (
                <>
                  <div className="result-meta">
                    <div className="meta-list">
                      <div><strong>Kaynak:</strong> {result.source}</div>
                      <div><strong>Durum:</strong> {result.status}</div>
                      <div><strong>Model:</strong> {result.model}</div>
                      <div><strong>Sağlayıcı:</strong> {result.provider}</div>
                      <div><strong>Zaman:</strong> {formatDate(result.at)}</div>
                    </div>
                    <div className="hint">{result.prompt}</div>
                  </div>

                  <div className="result-grid">
                    {result.images.map((src) => (
                      <div key={src} className="image-card">
                        <img src={src} alt="Üretilen görsel" />
                      </div>
                    ))}
                  </div>

                  <pre>{JSON.stringify(result.raw, null, 2)}</pre>
                </>
              ) : (
                <div className="info-box">Henüz aktif sonuç yok.</div>
              )}
            </section>
          </div>

          <section className="panel section">
            <div className="section-title">Yerel Geçmiş</div>
            <div className="list">
              {!history.length ? (
                <div className="info-box">Bu oturumda henüz üretim geçmişi yok.</div>
              ) : (
                history.map((entry) => (
                  <button key={entry.id} type="button" className="list-card history-button" onClick={() => { setResult(entry); setError(""); setNotice("Geçmiş kayıt açıldı."); }}>
                    <div><strong>{entry.source}</strong> · {entry.status}</div>
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
