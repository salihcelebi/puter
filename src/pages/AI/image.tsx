import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";

const DEFAULT_ANO_URL = "https://ano.puter.work";
const DEFAULT_BABO_URL = "https://babo.puter.work";
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

function readStoredWorkerUrl(key: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return safeText(value, fallback);
  } catch {
    return fallback;
  }
}

function storeWorkerUrl(key: string, value: string) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, safeText(value));
  } catch {}
}

function normalizeCatalogModel(raw: any): CatalogModel | null {
  const id = safeText(raw?.id || raw?.kimlik);
  const name = safeText(raw?.name || raw?.ad || id);
  if (!id || !name) return null;
  const provider = safeText(raw?.provider || raw?.saglayici);
  const aliases = ensureArray<string>(raw?.aliases || raw?.takmaAdlar).map((item) => safeText(item)).filter(Boolean);
  const input = ensureArray<string>(raw?.modalities?.input);
  const output = ensureArray<string>(raw?.modalities?.output);
  return {
    puterId: safeText(raw?.puterId),
    id,
    name,
    provider,
    aliases,
    modalities: { input, output },
    context: raw?.context ?? raw?.baglam ?? null,
    max_tokens: raw?.max_tokens ?? raw?.azamiToken ?? null,
    tool_call: typeof raw?.tool_call === "boolean" ? raw.tool_call : undefined,
    open_weights: typeof raw?.open_weights === "boolean" ? raw.open_weights : undefined,
    knowledge: safeText(raw?.knowledge),
    release_date: safeText(raw?.release_date),
    costs_currency: safeText(raw?.costs_currency),
    input_cost_key: safeText(raw?.input_cost_key),
    output_cost_key: safeText(raw?.output_cost_key),
    costs: raw?.costs && typeof raw.costs === "object" ? raw.costs : undefined
  };
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

type FilterGroupKey = "identity" | "capability" | "performance" | "cost" | "time" | "behavior";
type FilterMode = "all" | "yes" | "no";
type TierMode = "all" | "fast" | "balanced" | "deep";
type PriceMode = "all" | "free" | "cheap" | "mid" | "premium";
type DateMode = "all" | "new" | "recent" | "older";
type QualityMode = "all" | "quick" | "balanced" | "premium";

type FilterState = {
  provider: string;
  modelName: string;
  alias: string;
  imageInput: FilterMode;
  multimodal: FilterMode;
  speed: TierMode;
  inputPrice: PriceMode;
  outputPrice: PriceMode;
  freeOnly: FilterMode;
  releaseDate: DateMode;
  openWeights: FilterMode;
  recommended: FilterMode;
  qualityLevel: QualityMode;
};

type FilterDefinition = {
  key: keyof FilterState;
  label: string;
  group: FilterGroupKey;
  order: number;
  visibility: "always" | "imageInputOnly";
  advanced: boolean;
  dependency: keyof FilterState | null;
  help: string;
  control: "text" | "select";
  options?: { value: string; label: string }[];
};

type FilterChecklistStep = {
  group: FilterGroupKey;
  label: string;
  count: number;
  activeCount: number;
};

type FilterReason = {
  key: keyof FilterState;
  label: string;
  before: number;
  after: number;
  removed: number;
  valueText: string;
};

type ModelFacets = {
  hasImageInput: boolean;
  isMultimodal: boolean;
  speed: Exclude<TierMode, "all">;
  inputPrice: PriceMode | "unknown";
  outputPrice: PriceMode | "unknown";
  isFree: boolean;
  releaseDate: DateMode | "unknown";
  openWeights: boolean;
  recommended: boolean;
  qualityLevel: Exclude<QualityMode, "all">;
};

const FILTER_GROUP_ORDER: FilterGroupKey[] = ["identity", "capability", "performance", "cost", "time", "behavior"];
const FILTER_GROUP_LABELS: Record<FilterGroupKey, string> = {
  identity: "1. Kimlik",
  capability: "2. Girdi yeteneği",
  performance: "3. Performans",
  cost: "4. Maliyet",
  time: "5. Zaman",
  behavior: "6. Davranış"
};

const DEFAULT_FILTERS: FilterState = {
  provider: "",
  modelName: "",
  alias: "",
  imageInput: "all",
  multimodal: "all",
  speed: "all",
  inputPrice: "all",
  outputPrice: "all",
  freeOnly: "all",
  releaseDate: "all",
  openWeights: "all",
  recommended: "all",
  qualityLevel: "all"
};

const FILTER_DEFINITIONS: FilterDefinition[] = [
  { key: "provider", label: "Sağlayıcı", group: "identity", order: 10, visibility: "always", advanced: false, dependency: null, help: "Önce sağlayıcıyı gör, istersen listeyi tek sağlayıcıya indir.", control: "select" },
  { key: "modelName", label: "Model Adı", group: "identity", order: 20, visibility: "always", advanced: false, dependency: null, help: "Model adında geçen kelimeye göre daraltır.", control: "text" },
  { key: "alias", label: "Takma Ad", group: "identity", order: 30, visibility: "always", advanced: true, dependency: null, help: "Takma ad veya kısa model adıyla arama yapar.", control: "text" },
  { key: "imageInput", label: "Görsel Girdisi", group: "capability", order: 40, visibility: "always", advanced: true, dependency: null, help: "Modelin görsel girdi kabul edip etmediğini seçersin.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "yes", label: "Evet" },
    { value: "no", label: "Hayır" }
  ] },
  { key: "multimodal", label: "Çoklu Modlu", group: "capability", order: 50, visibility: "imageInputOnly", advanced: true, dependency: "imageInput", help: "Görsel girdiyi destekleyenler içinden çoklu modlu modelleri ayırır.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "yes", label: "Evet" },
    { value: "no", label: "Hayır" }
  ] },
  { key: "speed", label: "Hız", group: "performance", order: 60, visibility: "always", advanced: true, dependency: null, help: "Ad ve model ipuçlarına göre hızlı, dengeli veya derin sınıfı gösterir.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "fast", label: "Hızlı" },
    { value: "balanced", label: "Dengeli" },
    { value: "deep", label: "Derin" }
  ] },
  { key: "qualityLevel", label: "Kalite Seviyesi", group: "performance", order: 70, visibility: "always", advanced: true, dependency: null, help: "Modeli hızlı, dengeli veya premium kalite sınıfında görmeni sağlar.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "quick", label: "Hızlı kalite" },
    { value: "balanced", label: "Dengeli kalite" },
    { value: "premium", label: "Premium kalite" }
  ] },
  { key: "inputPrice", label: "Giriş Fiyatı", group: "cost", order: 80, visibility: "always", advanced: true, dependency: null, help: "Giriş maliyetini kaba seviyelerde daraltır.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "free", label: "Ücretsiz" },
    { value: "cheap", label: "Düşük" },
    { value: "mid", label: "Orta" },
    { value: "premium", label: "Yüksek" }
  ] },
  { key: "outputPrice", label: "Çıkış Fiyatı", group: "cost", order: 90, visibility: "always", advanced: true, dependency: null, help: "Çıkış maliyetini kaba seviyelerde daraltır.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "free", label: "Ücretsiz" },
    { value: "cheap", label: "Düşük" },
    { value: "mid", label: "Orta" },
    { value: "premium", label: "Yüksek" }
  ] },
  { key: "freeOnly", label: "Ücretsiz Mi", group: "cost", order: 100, visibility: "always", advanced: true, dependency: null, help: "Hem giriş hem çıkış maliyeti sıfır olanları ayırır.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "yes", label: "Evet" },
    { value: "no", label: "Hayır" }
  ] },
  { key: "releaseDate", label: "Yayın Tarihi", group: "time", order: 110, visibility: "always", advanced: true, dependency: null, help: "Yeni, son dönem veya eski modelleri ayrı görürsün.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "new", label: "Yeni" },
    { value: "recent", label: "Son dönem" },
    { value: "older", label: "Eski" }
  ] },
  { key: "openWeights", label: "Açık Ağırlık", group: "behavior", order: 120, visibility: "always", advanced: true, dependency: null, help: "Açık ağırlıklı modelleri ayrı gösterir.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "yes", label: "Evet" },
    { value: "no", label: "Hayır" }
  ] },
  { key: "recommended", label: "Önerilen", group: "behavior", order: 130, visibility: "always", advanced: true, dependency: null, help: "Görsel üretim için öneri işareti taşıyan adayları öne çıkarır.", control: "select", options: [
    { value: "all", label: "Fark etmez" },
    { value: "yes", label: "Evet" },
    { value: "no", label: "Hayır" }
  ] }
];

function getModelCost(model: CatalogModel, kind: "input" | "output") {
  const key = kind === "input" ? safeText(model.input_cost_key) : safeText(model.output_cost_key);
  const record = model.costs && typeof model.costs === "object" ? model.costs : null;
  if (!record) return null;
  const directKey = key && typeof record[key] !== "undefined" ? record[key] : (typeof record[kind] !== "undefined" ? record[kind] : null);
  const value = Number(directKey);
  return Number.isFinite(value) ? value : null;
}

function detectSpeedTier(model: CatalogModel): Exclude<TierMode, "all"> {
  const haystack = [model.id, model.name, model.puterId, ...(model.aliases || [])].join(" ").toLowerCase();
  if (/(flash|turbo|nano|mini|lite|fast|swift)/.test(haystack)) return "fast";
  if (/(pro|max|ultra|quality|hq|studio)/.test(haystack)) return "deep";
  return "balanced";
}

function detectQualityLevel(model: CatalogModel): Exclude<QualityMode, "all"> {
  const haystack = [model.id, model.name, model.puterId, ...(model.aliases || [])].join(" ").toLowerCase();
  if (/(flash|turbo|nano|mini|lite|fast)/.test(haystack)) return "quick";
  if (/(pro|max|ultra|hq|studio|quality)/.test(haystack)) return "premium";
  return "balanced";
}

function detectPriceTier(value: number | null): PriceMode | "unknown" {
  if (value == null) return "unknown";
  if (value <= 0) return "free";
  if (value <= 0.01) return "cheap";
  if (value <= 0.05) return "mid";
  return "premium";
}

function detectReleaseBucket(value: unknown): DateMode | "unknown" {
  const text = safeText(value);
  if (!text) return "unknown";
  const date = new Date(text);
  if (Number.isNaN(date.getTime())) return "unknown";
  const diffDays = (Date.now() - date.getTime()) / 86400000;
  if (diffDays <= 180) return "new";
  if (diffDays <= 540) return "recent";
  return "older";
}

function detectRecommended(model: CatalogModel) {
  const haystack = [model.id, model.name, model.puterId, ...(model.aliases || [])].join(" ").toLowerCase();
  return /(image|flux|recraft|dall|diffusion|imagen|ideogram|kandinsky|sdxl)/.test(haystack);
}

function deriveModelFacets(model: CatalogModel): ModelFacets {
  const input = ensureArray<string>(model.modalities?.input).map((item) => safeText(item).toLowerCase()).filter(Boolean);
  const output = ensureArray<string>(model.modalities?.output).map((item) => safeText(item).toLowerCase()).filter(Boolean);
  const hasImageInput = input.includes("image");
  const modalityPool = new Set([...input, ...output]);
  const isMultimodal = modalityPool.size > 2 || hasImageInput || input.some((item) => item !== "text") || output.some((item) => item !== "text" && item !== "image");
  const inputCost = getModelCost(model, "input");
  const outputCost = getModelCost(model, "output");
  return {
    hasImageInput,
    isMultimodal,
    speed: detectSpeedTier(model),
    inputPrice: detectPriceTier(inputCost),
    outputPrice: detectPriceTier(outputCost),
    isFree: (inputCost ?? 0) <= 0 && (outputCost ?? 0) <= 0,
    releaseDate: detectReleaseBucket(model.release_date || model.knowledge),
    openWeights: Boolean(model.open_weights),
    recommended: detectRecommended(model),
    qualityLevel: detectQualityLevel(model)
  };
}

function isFilterVisible(def: FilterDefinition, filters: FilterState) {
  if (def.visibility === "always") return true;
  return filters.imageInput === "yes";
}

function isFilterActive(key: keyof FilterState, value: FilterState[keyof FilterState]) {
  if (["provider", "modelName", "alias"].includes(String(key))) {
    return safeText(value) !== "";
  }
  return safeText(value) !== "all";
}

function getFilterValueText(key: keyof FilterState, filters: FilterState) {
  const value = filters[key];
  if (typeof value !== "string") return "-";
  if (value === "") return "-";
  const def = FILTER_DEFINITIONS.find((item) => item.key === key);
  const option = def?.options?.find((item) => item.value === value);
  return option?.label || value;
}

function modelMatchesFilter(model: CatalogModel, filters: FilterState, def: FilterDefinition) {
  const facets = deriveModelFacets(model);
  const providerText = safeText(model.provider).toLowerCase();
  const nameText = safeText(model.name).toLowerCase();
  const aliasPool = ensureArray<string>(model.aliases).map((item) => safeText(item).toLowerCase()).join(" ");
  switch (def.key) {
    case "provider":
      return !filters.provider || providerText === filters.provider.toLowerCase();
    case "modelName":
      return !filters.modelName.trim() || nameText.includes(filters.modelName.trim().toLowerCase());
    case "alias":
      return !filters.alias.trim() || aliasPool.includes(filters.alias.trim().toLowerCase());
    case "imageInput":
      return filters.imageInput === "all" || (filters.imageInput === "yes" ? facets.hasImageInput : !facets.hasImageInput);
    case "multimodal":
      return filters.multimodal === "all" || (filters.multimodal === "yes" ? facets.isMultimodal : !facets.isMultimodal);
    case "speed":
      return filters.speed === "all" || facets.speed === filters.speed;
    case "inputPrice":
      return filters.inputPrice === "all" || facets.inputPrice === filters.inputPrice;
    case "outputPrice":
      return filters.outputPrice === "all" || facets.outputPrice === filters.outputPrice;
    case "freeOnly":
      return filters.freeOnly === "all" || (filters.freeOnly === "yes" ? facets.isFree : !facets.isFree);
    case "releaseDate":
      return filters.releaseDate === "all" || facets.releaseDate === filters.releaseDate;
    case "openWeights":
      return filters.openWeights === "all" || (filters.openWeights === "yes" ? facets.openWeights : !facets.openWeights);
    case "recommended":
      return filters.recommended === "all" || (filters.recommended === "yes" ? facets.recommended : !facets.recommended);
    case "qualityLevel":
      return filters.qualityLevel === "all" || facets.qualityLevel === filters.qualityLevel;
    default:
      return true;
  }
}

function buildFilterView(models: CatalogModel[], filters: FilterState) {
  let current = [...models];
  const reasons: FilterReason[] = [];
  const checklist: FilterChecklistStep[] = [];

  for (const group of FILTER_GROUP_ORDER) {
    const defs = FILTER_DEFINITIONS
      .filter((item) => item.group === group)
      .filter((item) => isFilterVisible(item, filters))
      .sort((a, b) => a.order - b.order);
    const activeDefs = defs.filter((item) => isFilterActive(item.key, filters[item.key]));

    for (const def of activeDefs) {
      const before = current.length;
      const next = current.filter((model) => modelMatchesFilter(model, filters, def));
      reasons.push({
        key: def.key,
        label: def.label,
        before,
        after: next.length,
        removed: Math.max(0, before - next.length),
        valueText: getFilterValueText(def.key, filters)
      });
      current = next;
    }

    checklist.push({
      group,
      label: FILTER_GROUP_LABELS[group],
      count: current.length,
      activeCount: activeDefs.length
    });
  }

  return { models: current, reasons, checklist };
}

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

  const [anoBaseUrl, setAnoBaseUrl] = useState(() => readStoredWorkerUrl("image.tsx.anoBaseUrl", DEFAULT_ANO_URL));
  const [baboBaseUrl, setBaboBaseUrl] = useState(() => readStoredWorkerUrl("image.tsx.baboBaseUrl", DEFAULT_BABO_URL));
  const [workerMode, setWorkerMode] = useState<"ano" | "babo">("ano");
  const [autoFallback, setAutoFallback] = useState(true);
  const [operation, setOperation] = useState<"TXT2IMG" | "IMG2IMG">("TXT2IMG");
  // Filtre sözleşmesini tek merkezde tutuyoruz; UI ve eleme mantığı aynı kaynaktan beslenir.
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
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

  const providerOptions = useMemo(() => {
    return Array.from(new Set(models.map((item) => safeText(item.provider)).filter(Boolean))).sort((a, b) => a.localeCompare(b, "tr"));
  }, [models]);

  // Katalog tam kalır; filtreleme yalnız ekrandaki görünümü daraltır.
  const filterView = useMemo(() => buildFilterView(models, filters), [models, filters]);
  const filteredModels = filterView.models;
  const activeFilterCount = useMemo(() => filterView.reasons.length, [filterView.reasons.length]);

  const selectedModel = useMemo(
    () => filteredModels.find((item) => item.id === selectedModelId) || null,
    [filteredModels, selectedModelId]
  );

  const anoTone = healthToneFromStatus(anoHealth?.durum, null);
  const baboTone = healthToneFromStatus(baboHealth?.durum, safeNumber(baboHealth?.saglikPuani, NaN));
  const panelTone = healthToneFromStatus(baboPanel?.durum, safeNumber(baboPanel?.genelSaglikPuani, NaN));

  const setFilterValue = useCallback(<K extends keyof FilterState>(key: K, value: FilterState[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  }, []);

  const resetAdvancedFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  useEffect(() => {
    storeWorkerUrl("image.tsx.anoBaseUrl", anoBaseUrl);
  }, [anoBaseUrl]);

  useEffect(() => {
    storeWorkerUrl("image.tsx.baboBaseUrl", baboBaseUrl);
  }, [baboBaseUrl]);


  useEffect(() => {
    if (filters.imageInput === "yes") return;
    if (filters.multimodal !== "all") {
      setFilters((current) => ({ ...current, multimodal: "all" }));
    }
  }, [filters.imageInput, filters.multimodal]);

  useEffect(() => {
    setSelectedModelId((current) => (current && filteredModels.some((item) => item.id === current) ? current : safeText(filteredModels[0]?.id)));
  }, [filteredModels]);

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
    setNotice("");
    try {
      const params = new URLSearchParams();
      params.set("output", "image");
      params.set("limit", "500");
      const envelope = await requestAno(anoBaseUrl, `/api/modeller?${params.toString()}`);
      const nextModels = ensureArray<any>((envelope.veri as any)?.modeller)
        .map((item) => normalizeCatalogModel(item))
        .filter(Boolean) as CatalogModel[];
      const providerCount = new Set(nextModels.map((item) => safeText(item.provider)).filter(Boolean)).size;
      setModels(nextModels);
      if (nextModels.length > 0) {
        setNotice(`Model kataloğu başarıyla alındı. ${nextModels.length} model ve ${providerCount} sağlayıcı hazır. Önce listeyi gör, sonra istersen gelişmiş filtrelerle kademeli daralt.`);
      } else {
        setNotice("Model kataloğu isteği tamamlandı ama görünür katalog boş geldi. Bu durumda sorun filtrede değil, doğrudan katalog verisindedir.");
      }
    } catch (loadError) {
      setModels([]);
      setSelectedModelId("");
      const reason = extractErrorMessage(loadError, "Model listesi alınamadı.");
      setError(`Model kataloğu alınamadı. Sebep: ${reason}`);
      setNotice("Model sağlayıcıları ve modelleri bu denemede yüklenemedi. Hata nedeni yukarıda açıkça gösteriliyor.");
    } finally {
      setModelsLoading(false);
    }
  }, [anoBaseUrl]);

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

  const visibleFilterDefinitions = useMemo(() => {
    return FILTER_GROUP_ORDER.map((group) => ({
      group,
      label: FILTER_GROUP_LABELS[group],
      filters: FILTER_DEFINITIONS.filter((item) => item.group === group)
        .filter((item) => isFilterVisible(item, filters))
        .sort((a, b) => a.order - b.order)
    })).filter((item) => item.filters.length > 0);
  }, [filters]);

  const filterSummaryText = useMemo(() => {
    if (!models.length) {
      return "Katalog boşsa önce worker’dan model verisinin gelip gelmediğini kontrol et. Filtreler boş katalog üretemez; yalnız görünümü daraltır.";
    }
    if (!activeFilterCount) {
      return `Şu an ${models.length} modelin tamamını görüyorsun. Sağlayıcı ve model listesi önce açık bırakıldı; daraltma sonraki aşamaya bırakıldı.`;
    }
    if (!filteredModels.length) {
      return "Katalog başarıyla geldi fakat aktif filtrelerin birleşimi görünür listeyi sıfıra indirdi. Aşağıdaki eleme özeti, listenin hangi checklist adımında daraldığını açıkça gösterir.";
    }
    return `${filteredModels.length} model görünür durumda. Bu liste ${activeFilterCount} aktif filtre ve ${filterView.checklist.length} checklist adımıyla kademeli daraltıldı.`;
  }, [activeFilterCount, filterView.checklist.length, filteredModels.length, models.length]);

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
        .filter-stage-grid {
          display: grid;
          gap: 12px;
        }
        .filter-stage-card {
          border-radius: 18px;
          border: 1px solid var(--line);
          background: #fbfcfd;
          padding: 14px;
          display: grid;
          gap: 12px;
        }
        .stage-title {
          font-size: 14px;
          font-weight: 800;
          color: #344054;
        }
        .stage-fields {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .checklist-grid {
          display: grid;
          grid-template-columns: repeat(3, minmax(0, 1fr));
          gap: 10px;
        }
        .checklist-card {
          border-radius: 16px;
          border: 1px solid var(--line);
          background: #fff;
          padding: 12px 14px;
          display: grid;
          gap: 4px;
        }
        .compact-actions .secondary { min-height: 44px; }
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
          .grid, .result-grid, .controls-grid, .stage-fields, .checklist-grid { grid-template-columns: 1fr; }
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

                <div className="field full">
                  <div className="label">Gelişmiş filtreler</div>
                  <div className="info-box">
                    <strong>Filtreleme mantığı:</strong> önce kimlik, sonra girdi yeteneği, ardından performans, maliyet, zaman ve davranış adımları uygulanır.
                    Kullanılan filtreler katalog verisini silmez; yalnız ekrandaki görünür listeyi daraltır.
                  </div>
                  <div className="filter-stage-grid">
                    {visibleFilterDefinitions.map((groupItem) => (
                      <div key={groupItem.group} className="filter-stage-card">
                        <div className="stage-title">{groupItem.label}</div>
                        <div className="stage-fields">
                          {groupItem.filters.map((definition) => {
                            const disabled = definition.key === "multimodal" && filters.imageInput !== "yes";
                            return (
                              <div key={definition.key} className="field">
                                <div className="label">{definition.label}</div>
                                {definition.control === "text" ? (
                                  <input
                                    value={String(filters[definition.key] || "")}
                                    onChange={(event) => setFilterValue(definition.key, event.target.value as any)}
                                    placeholder={definition.label === "Model Adı" ? "ör. gpt-image" : "takma ad ile ara"}
                                  />
                                ) : (
                                  <select
                                    value={String(filters[definition.key] || "all")}
                                    onChange={(event) => setFilterValue(definition.key, event.target.value as any)}
                                    disabled={disabled}
                                  >
                                    {definition.key === "provider" ? <option value="">Tümü</option> : null}
                                    {definition.key === "provider"
                                      ? providerOptions.map((provider) => <option key={provider} value={provider}>{provider}</option>)
                                      : definition.options?.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                                  </select>
                                )}
                                <div className="tiny">{disabled ? "Bu filtreyi açmak için önce Görsel Girdisi = Evet seç." : definition.help}</div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="actions compact-actions">
                    <button type="button" className="secondary" onClick={resetAdvancedFilters}>Filtreleri sıfırla</button>
                  </div>
                  <div className="info-box brand">
                    <strong>Checklist özeti:</strong> {filterSummaryText}
                  </div>
                  <div className="checklist-grid">
                    {filterView.checklist.map((step) => (
                      <div key={step.group} className="checklist-card">
                        <strong>{step.label}</strong>
                        <div className="tiny">Aktif filtre: {step.activeCount}</div>
                        <div className="tiny">Kalan model: {step.count}</div>
                      </div>
                    ))}
                  </div>
                  {activeFilterCount ? (
                    <div className="list-card">
                      <div className="section-title" style={{ fontSize: 16 }}>Eleme özeti</div>
                      <div className="meta-list">
                        {filterView.reasons.map((reason) => (
                          <div key={String(reason.key)}>
                            <strong>{reason.label}:</strong> {reason.valueText} seçildi; {reason.before} modelden {reason.after} model kaldı, {reason.removed} model bu adımda elendi.
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="field full">
                  <div className="label">Model</div>
                  <select value={selectedModelId} onChange={(event) => setSelectedModelId(event.target.value)} disabled={modelsLoading || !filteredModels.length}>
                    {!filteredModels.length ? <option value="">{modelsLoading ? "Modeller yükleniyor..." : "Filtre sonrası görünür model yok"}</option> : null}
                    {filteredModels.map((item) => (
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
