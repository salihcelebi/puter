/*
DOSYA: video.js
AMAÇ: ME.PUTER ODAKLI, OWNER-PAYS, TEK GÖREVLİ, GÜVENLİ VIDEO GENERATION WORKER.
NOT: BU WORKER SADECE VİDEO ÜRETİMİ İÇİNDİR; CHAT/IMAGE/TTS BU DOSYAYA EKLENMEMELİDİR.
NOT: MODEL KATALOĞU KAYNAĞI models-worker.js'TİR. BU DOSYA KATALOG DEĞİL, ÜRETİM KATMANIDIR.
NOT: FRONTEND MODELİ STATE/SESSION'DA TUTABİLİR; WORKER HER ZAMAN GELEN `model` VEYA `modelId` ALANINA GÖRE ÇALIŞIR.
*/

const APP_INFO = Object.freeze({
  worker: "video",
  version: "1.0.0",
  protocolVersion: "2026-03-13",
  runtime: "puter-worker",
  billingMode: "owner_pays",
  purpose: "ME.PUTER VIDEO GENERATION GATEWAY",
});

const DEFAULTS = Object.freeze({
  model: "luma/ray-2",
  mode: "text-video",
  duration: 5,
  ratio: "16:9",
  quality: "high",
  fps: 24,
  timeoutMs: 240000,
  maxPromptLength: 6000,
  maxNegativePromptLength: 3000,
  maxAttachments: 4,
  maxAttachmentBytes: 100 * 1024 * 1024,
  maxTotalAttachmentBytes: 300 * 1024 * 1024,
  retryCount: 1,
  retryBaseDelayMs: 700,
  rateLimitWindowMs: 60 * 1000,
  rateLimitMaxRequests: 12,
  cacheTtlMs: 2 * 60 * 1000,
  idempotencyTtlMs: 10 * 60 * 1000,
  jobTtlMs: 60 * 60 * 1000,
  allowStream: true,
  allowWebhook: true,
  maintenanceMode: false,
  allowedOrigins: ["*"],
  allowedResponseFormats: ["url", "base64", "binary"],
  allowedRatios: ["16:9", "9:16", "1:1", "4:5", "5:4", "4:3", "3:4"],
  allowedQualities: ["low", "medium", "high", "ultra"],
  allowedModes: ["text-video", "image-video", "video-video"],
  allowedDurations: [5, 10, 15],
  allowedCameraMotions: ["static", "dolly", "pan", "orbit"],
  allowedMimeTypes: [
    "image/png",
    "image/jpeg",
    "image/jpg",
    "image/webp",
    "image/gif",
    "video/mp4",
    "video/webm",
    "video/quicktime",
    "video/x-m4v",
  ],
});

const ALLOWED_METHODS = "GET,POST,OPTIONS";
const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
const SSE_CONTENT_TYPE = "text/event-stream; charset=utf-8";
const REQUEST_TYPE_GENERATE = "video.generate";
const RESPONSE_TYPE_OK = "video.result";
const RESPONSE_TYPE_STREAM_READY = "video.stream.ready";
const RESPONSE_TYPE_STREAM_PROGRESS = "video.stream.progress";
const RESPONSE_TYPE_STREAM_RESULT = "video.stream.result";
const RESPONSE_TYPE_ERROR = "video.error";

const SECRET_PATTERNS = [
  /bearer\s+[a-z0-9\-._~+/]+=*/gi,
  /\bsk-[a-z0-9]{10,}\b/gi,
  /\bpk-[a-z0-9]{10,}\b/gi,
  /\b[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}\b/g,
  /"authorization"\s*:\s*"[^"]+"/gi,
  /"cookie"\s*:\s*"[^"]+"/gi,
];

const CIRCUIT_STATE = {
  failures: 0,
  openedAt: 0,
  threshold: 4,
  coolDownMs: 30000,
};

const REQUEST_CACHE = new Map();
const IDEMPOTENCY_CACHE = new Map();
const JOB_STORE = new Map();
const RATE_LIMIT_STORE = new Map();

function nowIso() {
  return new Date().toISOString();
}

function nowMs() {
  return Date.now();
}

function createId(prefix = "req") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function safeNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function toPositiveInteger(value, fallback) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : fallback;
}

function toBoolean(value, fallback = false) {
  if (typeof value === "boolean") return value;
  if (typeof value === "string") {
    const lowered = value.trim().toLowerCase();
    if (["true", "1", "yes", "evet"].includes(lowered)) return true;
    if (["false", "0", "no", "hayir", "hayır"].includes(lowered)) return false;
  }
  return fallback;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function safeStringify(value) {
  try {
    return JSON.stringify(value);
  } catch {
    return '"[UNSERIALIZABLE]"';
  }
}

function sanitizeText(text) {
  try {
    if (typeof text !== "string") return "";
    let output = text;
    for (const pattern of SECRET_PATTERNS) {
      output = output.replace(pattern, "[REDACTED]");
    }
    return output;
  } catch {
    return "[UNSANITIZABLE_TEXT]";
  }
}

function sanitizeError(error) {
  try {
    const message =
      error && typeof error.message === "string"
        ? sanitizeText(error.message)
        : "BEKLENMEYEN HATA OLUŞTU.";
    const code =
      error && typeof error.code === "string" && error.code.trim()
        ? error.code.trim()
        : "UNEXPECTED_ERROR";
    const retryable = Boolean(error && error.retryable === true);
    return { code, message, retryable };
  } catch {
    return {
      code: "UNEXPECTED_ERROR",
      message: "BEKLENMEYEN HATA OLUŞTU.",
      retryable: false,
    };
  }
}

function normalizeWhitespace(text) {
  if (typeof text !== "string") return "";
  return text.replace(/[\u0000-\u001F\u007F]/g, " ").replace(/\s+/g, " ").trim();
}

function clampText(text, maxLen) {
  if (typeof text !== "string") return "";
  return normalizeWhitespace(text).slice(0, maxLen);
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickString(obj, keys) {
  if (!isPlainObject(obj)) return "";
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function pickAny(obj, keys) {
  if (!isPlainObject(obj)) return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key];
  }
  return undefined;
}

function hashKey(input) {
  const text = typeof input === "string" ? input : safeStringify(input);
  let hash = 2166136261;
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  return `h_${(hash >>> 0).toString(36)}`;
}

function cleanupExpiredMaps() {
  const now = nowMs();
  for (const [key, value] of REQUEST_CACHE.entries()) {
    if (!value || value.expiresAt <= now) REQUEST_CACHE.delete(key);
  }
  for (const [key, value] of IDEMPOTENCY_CACHE.entries()) {
    if (!value || value.expiresAt <= now) IDEMPOTENCY_CACHE.delete(key);
  }
  for (const [key, value] of JOB_STORE.entries()) {
    if (!value || value.expiresAt <= now) JOB_STORE.delete(key);
  }
  for (const [key, value] of RATE_LIMIT_STORE.entries()) {
    if (!value || value.resetAt <= now) RATE_LIMIT_STORE.delete(key);
  }
}

function createBaseEnvelope(requestId, traceId, startedAt) {
  return {
    worker: APP_INFO.worker,
    version: APP_INFO.version,
    protocolVersion: APP_INFO.protocolVersion,
    billingMode: APP_INFO.billingMode,
    requestId,
    traceId,
    time: nowIso(),
    durationMs: Math.max(0, nowMs() - startedAt),
  };
}

function successEnvelope({ requestId, traceId, startedAt, code = "OK", data = null, meta = null }) {
  return {
    ok: true,
    code,
    error: null,
    data,
    meta,
    ...createBaseEnvelope(requestId, traceId, startedAt),
  };
}

function errorEnvelope({ requestId, traceId, startedAt, code = "BAD_REQUEST", message = "İSTEK BAŞARISIZ.", details = null, status = 400, retryable = false }) {
  return {
    ok: false,
    status,
    code,
    error: {
      type: RESPONSE_TYPE_ERROR,
      message,
      details,
      retryable,
    },
    data: null,
    meta: null,
    ...createBaseEnvelope(requestId, traceId, startedAt),
  };
}

function isOriginAllowed(origin) {
  if (!origin) return true;
  if (DEFAULTS.allowedOrigins.includes("*")) return true;
  return DEFAULTS.allowedOrigins.includes(origin);
}

function buildCorsHeaders(request) {
  const origin = request.headers.get("origin") || "*";
  const allowOrigin = isOriginAllowed(origin) ? origin : DEFAULTS.allowedOrigins[0] || "null";
  return {
    "access-control-allow-origin": allowOrigin,
    "access-control-allow-headers": "*",
    "access-control-allow-methods": ALLOWED_METHODS,
    "access-control-allow-credentials": "true",
    vary: "origin",
  };
}

function buildJsonHeaders(request, extraHeaders = {}) {
  return {
    ...buildCorsHeaders(request),
    "content-type": JSON_CONTENT_TYPE,
    ...extraHeaders,
  };
}

function buildSseHeaders(request, extraHeaders = {}) {
  return {
    ...buildCorsHeaders(request),
    "content-type": SSE_CONTENT_TYPE,
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no",
    ...extraHeaders,
  };
}

function jsonResponse(request, body, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: buildJsonHeaders(request, extraHeaders),
  });
}

function toSseFrame(eventName, payload) {
  return `event: ${eventName}\ndata: ${safeStringify(payload)}\n\n`;
}

async function safeReadText(request) {
  try {
    return await request.clone().text();
  } catch {
    return "";
  }
}

async function safeReadJson(request) {
  try {
    return await request.clone().json();
  } catch {
    return null;
  }
}

async function safeReadFormData(request) {
  try {
    return await request.clone().formData();
  } catch {
    return null;
  }
}

function parseFormEncoded(rawText) {
  try {
    const params = new URLSearchParams(rawText || "");
    const obj = {};
    for (const [key, value] of params.entries()) obj[key] = value;
    return obj;
  } catch {
    return null;
  }
}

function mergeQueryIntoBody(request, body) {
  try {
    const url = new URL(request.url);
    const merged = isPlainObject(body) ? { ...body } : {};
    for (const [key, value] of url.searchParams.entries()) {
      if (merged[key] === undefined) merged[key] = value;
    }
    return merged;
  } catch {
    return isPlainObject(body) ? { ...body } : {};
  }
}

function getMergedInput(body) {
  try {
    const root = isPlainObject(body) ? body : {};
    const payload = isPlainObject(root.payload) ? root.payload : {};
    const data = isPlainObject(root.data) ? root.data : {};
    return { ...root, ...data, ...payload };
  } catch {
    return {};
  }
}

function inferAttachmentKind(key, type, name) {
  const bag = `${key} ${type} ${name}`.toLowerCase();
  if (bag.includes("mask")) return "mask";
  if (bag.includes("video") || type.startsWith("video/")) return "source-video";
  if (bag.includes("image") || bag.includes("reference") || bag.includes("ref") || bag.includes("source")) return "reference-image";
  return "reference-image";
}

function extractFilesFromFormData(formData) {
  const files = [];
  if (!formData) return files;

  for (const [key, value] of formData.entries()) {
    const isBlob = typeof Blob !== "undefined" && value instanceof Blob;
    if (!isBlob) continue;
    const maybeFile = value;
    const type = typeof maybeFile.type === "string" ? maybeFile.type : "application/octet-stream";
    const name = typeof maybeFile.name === "string" && maybeFile.name ? maybeFile.name : `${key}.bin`;
    const size = Number.isFinite(maybeFile.size) ? maybeFile.size : 0;
    files.push({ key, file: maybeFile, name, type, size, kind: inferAttachmentKind(key, type, name) });
  }

  return files;
}

async function safeReadBody(request) {
  const contentType = (request.headers.get("content-type") || "").toLowerCase();

  if (contentType.includes("application/json")) {
    const parsedJson = await safeReadJson(request);
    if (isPlainObject(parsedJson) || Array.isArray(parsedJson)) {
      return { body: parsedJson, files: [] };
    }
  }

  if (contentType.includes("multipart/form-data")) {
    const formData = await safeReadFormData(request);
    if (formData) {
      const body = {};
      for (const [key, value] of formData.entries()) {
        const isBlob = typeof Blob !== "undefined" && value instanceof Blob;
        if (!isBlob) body[key] = value;
      }
      return { body, files: extractFilesFromFormData(formData) };
    }
  }

  const rawText = await safeReadText(request);
  if (!rawText || !rawText.trim()) return { body: {}, files: [] };

  try {
    const parsed = JSON.parse(rawText);
    if (isPlainObject(parsed) || Array.isArray(parsed)) return { body: parsed, files: [] };
  } catch {}

  if (contentType.includes("application/x-www-form-urlencoded")) {
    const formData = parseFormEncoded(rawText);
    if (isPlainObject(formData)) return { body: formData, files: [] };
  }

  return { body: { prompt: rawText.trim(), text: rawText.trim() }, files: [] };
}

function normalizeResponseFormat(value) {
  const format = String(value || "url").trim().toLowerCase();
  return DEFAULTS.allowedResponseFormats.includes(format) ? format : "url";
}

function normalizeQuality(value) {
  const quality = String(value || DEFAULTS.quality).trim().toLowerCase();
  return DEFAULTS.allowedQualities.includes(quality) ? quality : DEFAULTS.quality;
}

function normalizeRatio(value) {
  const ratio = String(value || DEFAULTS.ratio).trim();
  return DEFAULTS.allowedRatios.includes(ratio) ? ratio : DEFAULTS.ratio;
}

function normalizeMode(value) {
  const mode = String(value || DEFAULTS.mode).trim().toLowerCase();
  return DEFAULTS.allowedModes.includes(mode) ? mode : DEFAULTS.mode;
}

function normalizeDuration(value) {
  const duration = toPositiveInteger(value, DEFAULTS.duration);
  return DEFAULTS.allowedDurations.includes(duration) ? duration : DEFAULTS.duration;
}

function normalizeCameraMotion(value) {
  const motion = String(value || "static").trim().toLowerCase();
  return DEFAULTS.allowedCameraMotions.includes(motion) ? motion : "static";
}

function normalizeStyle(value) {
  return clampText(String(value || ""), 120);
}

function normalizeAttachments(files, input) {
  const explicitAttachments = Array.isArray(input.attachments) ? input.attachments : [];
  const normalized = [];
  let totalBytes = 0;

  for (const fileInfo of files.slice(0, DEFAULTS.maxAttachments)) {
    const size = toPositiveInteger(fileInfo.size, 0);
    totalBytes += size;
    normalized.push({
      key: fileInfo.key,
      name: fileInfo.name,
      type: fileInfo.type,
      size,
      kind: fileInfo.kind,
      file: fileInfo.file,
    });
  }

  for (const item of explicitAttachments.slice(0, DEFAULTS.maxAttachments - normalized.length)) {
    if (!isPlainObject(item)) continue;
    const name = clampText(String(item.name || item.filename || "attachment"), 180);
    const type = clampText(String(item.type || item.mimeType || "application/octet-stream"), 120);
    const size = toPositiveInteger(item.size, 0);
    totalBytes += size;
    normalized.push({
      key: clampText(String(item.key || item.field || "attachment"), 80),
      name,
      type,
      size,
      kind: inferAttachmentKind(item.key || item.field || name, type, name),
      file: item.file || item.blob || null,
      url: typeof item.url === "string" ? item.url.trim() : "",
      base64: typeof item.base64 === "string" ? item.base64.trim() : "",
    });
  }

  return { items: normalized.slice(0, DEFAULTS.maxAttachments), totalBytes };
}

function normalizeVideoRequest(request, rawBody, formFiles) {
  const startedAt = nowMs();
  const traceId = createId("trace");
  const body = mergeQueryIntoBody(request, rawBody);
  const input = getMergedInput(body);

  const prompt = clampText(
    firstNonEmptyString(
      pickString(input, ["prompt", "text", "message", "content", "query", "input"]),
      pickString(input, ["mesaj", "soru", "metin", "talimat"])
    ),
    DEFAULTS.maxPromptLength
  );

  const negativePrompt = clampText(
    firstNonEmptyString(
      pickString(input, ["negativePrompt", "negative_prompt", "negative", "exclude"]),
      pickString(input, ["negatifPrompt", "negatif"])
    ),
    DEFAULTS.maxNegativePromptLength
  );

  const mode = normalizeMode(firstNonEmptyString(input.mode, input.generationMode, DEFAULTS.mode));
  const ratio = normalizeRatio(firstNonEmptyString(input.ratio, input.aspectRatio, input.aspect_ratio, DEFAULTS.ratio));
  const duration = normalizeDuration(input.duration ?? input.seconds ?? input.lengthSeconds);
  const quality = normalizeQuality(firstNonEmptyString(input.quality, input.qualityLevel, DEFAULTS.quality));
  const style = normalizeStyle(firstNonEmptyString(input.style, input.stylePreset, input.style_preset));
  const cameraMotion = normalizeCameraMotion(firstNonEmptyString(input.cameraMotion, input.camera, input.camera_move, "static"));
  const responseFormat = normalizeResponseFormat(firstNonEmptyString(input.responseFormat, input.response_format, "url"));
  const stream = DEFAULTS.allowStream && toBoolean(pickAny(input, ["stream", "isStream"]), false);
  const testMode = toBoolean(pickAny(input, ["testMode", "test_mode", "dryRun"]), false);
  const seed = pickAny(input, ["seed"]);
  const guidance = safeNumber(pickAny(input, ["guidance", "guidanceScale", "guidance_scale", "cfgScale"]), undefined);
  const webhookUrl = firstNonEmptyString(input.webhookUrl, input.webhook, input.callbackUrl, input.callback);
  const idempotencyKey = firstNonEmptyString(input.idempotencyKey, input.idempotency, request.headers.get("idempotency-key"), "");
  const requestId = firstNonEmptyString(input.requestId, input.clientRequestId, idempotencyKey, createId("video"));
  const timeoutMs = toPositiveInteger(input.timeoutMs ?? input.timeout_ms, DEFAULTS.timeoutMs);
  const model = firstNonEmptyString(input.model, input.modelId, DEFAULTS.model);
  const attachments = normalizeAttachments(formFiles, input);

  return {
    traceId,
    requestId,
    startedAt,
    type: REQUEST_TYPE_GENERATE,
    version: firstNonEmptyString(input.version, APP_INFO.protocolVersion) || APP_INFO.protocolVersion,
    timestamp: firstNonEmptyString(input.timestamp, nowIso()) || nowIso(),
    model,
    prompt,
    negativePrompt,
    mode,
    duration,
    ratio,
    quality,
    style,
    cameraMotion,
    seed: seed !== undefined && seed !== null && String(seed).trim() ? Number(seed) : undefined,
    guidance: Number.isFinite(guidance) ? guidance : undefined,
    responseFormat,
    stream,
    testMode,
    timeoutMs,
    attachments: attachments.items,
    totalAttachmentBytes: attachments.totalBytes,
    webhookUrl,
    idempotencyKey,
    metadata: isPlainObject(input.meta) ? input.meta : isPlainObject(input.metadata) ? input.metadata : {},
    rawInput: input,
  };
}

function containsUnsafeContent(text) {
  const bag = String(text || "").toLowerCase();
  const blockedPatterns = [/child\s+sexual/i, /minor\s+sexual/i, /csam/i, /bestiality/i, /rape/i];
  return blockedPatterns.some((pattern) => pattern.test(bag));
}

function validateOrigin(request) {
  const origin = request.headers.get("origin") || "";
  if (!isOriginAllowed(origin)) {
    return { ok: false, code: "ORIGIN_NOT_ALLOWED", message: "BU ORIGIN İÇİN ERİŞİM İZNİ YOK.", status: 403, details: { origin } };
  }
  return { ok: true };
}

function validateRateLimit(request) {
  const ip = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for") || "unknown";
  const origin = request.headers.get("origin") || "unknown";
  const key = `${ip}::${origin}`;
  const now = nowMs();
  const current = RATE_LIMIT_STORE.get(key);

  if (!current || current.resetAt <= now) {
    RATE_LIMIT_STORE.set(key, { count: 1, resetAt: now + DEFAULTS.rateLimitWindowMs });
    return { ok: true };
  }

  current.count += 1;
  RATE_LIMIT_STORE.set(key, current);

  if (current.count > DEFAULTS.rateLimitMaxRequests) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      message: "ÇOK FAZLA İSTEK GÖNDERİLDİ. LÜTFEN BİRAZ BEKLEYİN.",
      status: 429,
      details: { resetAt: new Date(current.resetAt).toISOString() },
      retryable: true,
    };
  }

  return { ok: true };
}

function validateVideoRequest(normalized) {
  const problems = [];

  if (DEFAULTS.maintenanceMode) {
    return { ok: false, code: "MAINTENANCE_MODE", message: "SERVİS GEÇİCİ OLARAK BAKIM MODUNDA.", status: 503, details: null, retryable: true };
  }

  if (!normalized.requestId) problems.push("REQUEST ID ÜRETİLEMEDİ.");
  if (!normalized.model) problems.push("AKTİF MODEL BULUNAMADI.");
  if (!normalized.prompt) problems.push("PROMPT ALANI BOŞ.");
  if (!DEFAULTS.allowedModes.includes(normalized.mode)) problems.push("MOD GEÇERSİZ.");
  if (!DEFAULTS.allowedRatios.includes(normalized.ratio)) problems.push("RATIO GEÇERSİZ.");
  if (!DEFAULTS.allowedQualities.includes(normalized.quality)) problems.push("QUALITY GEÇERSİZ.");
  if (!DEFAULTS.allowedDurations.includes(normalized.duration)) problems.push("SÜRE GEÇERSİZ.");
  if (!DEFAULTS.allowedCameraMotions.includes(normalized.cameraMotion)) problems.push("KAMERA HAREKETİ GEÇERSİZ.");
  if (!DEFAULTS.allowedResponseFormats.includes(normalized.responseFormat)) problems.push("RESPONSE FORMAT GEÇERSİZ.");
  if (!Number.isInteger(normalized.timeoutMs) || normalized.timeoutMs <= 0) problems.push("TIMEOUT GEÇERSİZ.");
  if (normalized.totalAttachmentBytes > DEFAULTS.maxTotalAttachmentBytes) problems.push("TOPLAM DOSYA BOYUTU SINIRI AŞILDI.");
  if (containsUnsafeContent(normalized.prompt) || containsUnsafeContent(normalized.negativePrompt)) {
    problems.push("POLICY KONTROLÜNE TAKILAN İÇERİK TESPİT EDİLDİ.");
  }

  const hasReferenceImage = normalized.attachments.some((item) => item.kind === "reference-image");
  const hasSourceVideo = normalized.attachments.some((item) => item.kind === "source-video");

  if (normalized.mode === "image-video" && !hasReferenceImage) {
    problems.push("IMAGE → VIDEO MODU İÇİN REFERANS GÖRSEL GEREKLİ.");
  }
  if (normalized.mode === "video-video" && !hasSourceVideo) {
    problems.push("VIDEO → VIDEO MODU İÇİN KAYNAK VİDEO GEREKLİ.");
  }

  for (const item of normalized.attachments) {
    if (item.size > DEFAULTS.maxAttachmentBytes) problems.push(`${item.name} DOSYASI ÇOK BÜYÜK.`);
    if (item.type && !DEFAULTS.allowedMimeTypes.includes(item.type.toLowerCase())) {
      problems.push(`${item.name} DOSYA TİPİ DESTEKLENMİYOR.`);
    }
  }

  if (problems.length > 0) {
    const code = !normalized.model
      ? "NO_ACTIVE_MODEL"
      : !normalized.prompt
      ? "EMPTY_PROMPT"
      : normalized.attachments.some((item) => item.type && !DEFAULTS.allowedMimeTypes.includes(item.type.toLowerCase()))
      ? "INVALID_ATTACHMENT"
      : "INVALID_VIDEO_REQUEST";

    return {
      ok: false,
      code,
      message:
        code === "NO_ACTIVE_MODEL"
          ? "Aktif model bulunamadı"
          : code === "EMPTY_PROMPT"
          ? "Prompt alanı boş olamaz"
          : code === "INVALID_ATTACHMENT"
          ? "Dosya türü veya boyutu geçersiz"
          : "VIDEO İSTEĞİ GEÇERSİZ.",
      status: 400,
      details: {
        problems,
        acceptedFields: [
          "prompt",
          "model",
          "modelId",
          "mode",
          "duration",
          "ratio",
          "quality",
          "style",
          "cameraMotion",
          "seed",
          "negativePrompt",
          "guidance",
          "attachments",
          "responseFormat",
          "stream",
          "testMode",
          "meta",
        ],
      },
      retryable: false,
    };
  }

  return { ok: true };
}

function checkCircuitBreaker() {
  const now = nowMs();
  if (CIRCUIT_STATE.openedAt > 0 && now - CIRCUIT_STATE.openedAt < CIRCUIT_STATE.coolDownMs) {
    return { ok: false, code: "CIRCUIT_OPEN", message: "SAĞLAYICI GEÇİCİ OLARAK DEVRE DIŞI. LÜTFEN DAHA SONRA TEKRAR DENEYİN.", status: 503, retryable: true, details: { openedAt: new Date(CIRCUIT_STATE.openedAt).toISOString() } };
  }
  return { ok: true };
}

function recordProviderFailure() {
  CIRCUIT_STATE.failures += 1;
  if (CIRCUIT_STATE.failures >= CIRCUIT_STATE.threshold) {
    CIRCUIT_STATE.openedAt = nowMs();
  }
}

function resetCircuitBreaker() {
  CIRCUIT_STATE.failures = 0;
  CIRCUIT_STATE.openedAt = 0;
}

function putStructuredLog(level, traceId, data) {
  try {
    const safeData = sanitizeText(safeStringify(data));
    console[level](`[VIDEO_WORKER] trace=${traceId} ${safeData}`);
  } catch {}
}

function buildPromptPayload(normalized) {
  const parts = [normalized.prompt];
  parts.push(`Mode: ${normalized.mode}`);
  parts.push(`Duration: ${normalized.duration}s`);
  parts.push(`Aspect ratio: ${normalized.ratio}`);
  parts.push(`Camera motion: ${normalized.cameraMotion}`);
  if (normalized.style) parts.push(`Style: ${normalized.style}`);
  if (normalized.negativePrompt) parts.push(`Negative prompt: ${normalized.negativePrompt}`);
  return parts.filter(Boolean).join("\n");
}

function buildProviderOptions(normalized) {
  const options = {
    model: normalized.model,
    duration: normalized.duration,
    quality: normalized.quality,
    aspect_ratio: normalized.ratio,
    mode: normalized.mode,
    testMode: normalized.testMode,
    camera_motion: normalized.cameraMotion,
    fps: DEFAULTS.fps,
  };

  if (normalized.seed !== undefined) options.seed = normalized.seed;
  if (normalized.guidance !== undefined) options.guidance_scale = normalized.guidance;
  if (normalized.responseFormat) options.response_format = normalized.responseFormat;
  if (normalized.negativePrompt) options.negative_prompt = normalized.negativePrompt;
  if (normalized.style) options.style = normalized.style;

  const referenceImages = normalized.attachments.filter((item) => item.kind === "reference-image");
  const sourceVideos = normalized.attachments.filter((item) => item.kind === "source-video");
  const maskFile = normalized.attachments.find((item) => item.kind === "mask");

  if (referenceImages.length > 0) {
    options.reference_images = referenceImages.map((item) => item.file || item.url || item.base64).filter(Boolean);
  }
  if (sourceVideos.length > 0) {
    options.source_videos = sourceVideos.map((item) => item.file || item.url || item.base64).filter(Boolean);
  }
  if (maskFile) {
    options.mask = maskFile.file || maskFile.url || maskFile.base64;
  }

  return options;
}

function resolveVideoApi() {
  const candidates = [
    globalThis?.me?.puter?.ai?.txt2vid,
    globalThis?.puter?.ai?.txt2vid,
    globalThis?.me?.puter?.ai?.video,
    globalThis?.puter?.ai?.video,
    globalThis?.me?.puter?.ai?.vid,
    globalThis?.puter?.ai?.vid,
  ].filter(Boolean);

  const fn = candidates.find((item) => typeof item === "function");
  if (!fn) {
    const error = new Error("VIDEO API BULUNAMADI.");
    error.code = "VIDEO_PROVIDER_NOT_AVAILABLE";
    throw error;
  }
  return fn;
}

function withTimeout(promise, timeoutMs, timeoutCode = "VIDEO_TIMEOUT", timeoutMessage = "VIDEO İŞLEMİ ZAMAN AŞIMINA UĞRADI.") {
  let timer = null;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error(timeoutMessage);
      error.code = timeoutCode;
      error.retryable = true;
      reject(error);
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

async function retryableCall(fn, attempts, traceId) {
  let lastError = null;

  for (let attempt = 0; attempt <= attempts; attempt += 1) {
    try {
      return await fn(attempt);
    } catch (error) {
      lastError = error;
      const safe = sanitizeError(error);
      putStructuredLog("warn", traceId, { code: safe.code, message: safe.message, retryable: safe.retryable, attempt });
      if (attempt >= attempts || safe.retryable === false) throw error;
      await sleep(DEFAULTS.retryBaseDelayMs * (attempt + 1));
    }
  }

  throw lastError;
}

function normalizeGeneratedVideo(value, index, responseFormat) {
  if (typeof value === "string") {
    if (value.startsWith("http://") || value.startsWith("https://")) {
      return { index, format: "url", url: value, base64: null, binary: null, mimeType: "video/mp4", fileName: `video_${index + 1}.mp4`, posterUrl: null };
    }
    if (value.startsWith("data:")) {
      return { index, format: "base64", url: null, base64: value, binary: null, mimeType: value.slice(5, value.indexOf(";")) || "video/mp4", fileName: `video_${index + 1}.txt`, posterUrl: null };
    }
  }

  if (typeof Blob !== "undefined" && value instanceof Blob) {
    return { index, format: responseFormat === "binary" ? "binary" : "base64", url: null, base64: null, binary: value, mimeType: value.type || "application/octet-stream", fileName: `video_${index + 1}`, posterUrl: null };
  }

  if (isPlainObject(value)) {
    const url = firstNonEmptyString(value.url, value.src, value.videoUrl, value.video, value.output);
    const base64 = firstNonEmptyString(value.base64, value.dataUrl, value.data_url);
    const posterUrl = firstNonEmptyString(value.posterUrl, value.poster, value.thumbnail, value.thumbnailUrl, value.previewImage);
    if (url) {
      return { index, format: "url", url, base64: null, binary: null, mimeType: value.mimeType || "video/mp4", fileName: value.fileName || `video_${index + 1}.mp4`, posterUrl: posterUrl || null };
    }
    if (base64) {
      return { index, format: "base64", url: null, base64, binary: null, mimeType: value.mimeType || "video/mp4", fileName: value.fileName || `video_${index + 1}.txt`, posterUrl: posterUrl || null };
    }
  }

  return { index, format: responseFormat, url: null, base64: null, binary: null, mimeType: null, fileName: `video_${index + 1}`, posterUrl: null };
}

async function blobToBase64(blob) {
  const arrayBuffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const encoded = btoa(binary);
  const mime = blob.type || "application/octet-stream";
  return `data:${mime};base64,${encoded}`;
}

async function normalizeProviderResult(rawResult, normalized) {
  const rawItems = Array.isArray(rawResult)
    ? rawResult
    : Array.isArray(rawResult?.videos)
    ? rawResult.videos
    : Array.isArray(rawResult?.data)
    ? rawResult.data
    : [rawResult];

  const videos = [];
  for (let i = 0; i < rawItems.length; i += 1) {
    const item = normalizeGeneratedVideo(rawItems[i], i, normalized.responseFormat);
    if (item.binary && normalized.responseFormat === "base64") {
      item.base64 = await blobToBase64(item.binary);
      item.binary = null;
      item.format = "base64";
    }
    videos.push(item);
  }

  return {
    type: RESPONSE_TYPE_OK,
    model: normalized.model,
    prompt: normalized.prompt,
    mode: normalized.mode,
    duration: normalized.duration,
    ratio: normalized.ratio,
    quality: normalized.quality,
    count: videos.length,
    videos,
    raw: rawResult ?? null,
  };
}

function buildUsageMetrics(normalized, result, startedAt) {
  return {
    model: normalized.model,
    mode: normalized.mode,
    duration: normalized.duration,
    ratio: normalized.ratio,
    quality: normalized.quality,
    countProduced: result?.videos?.length || 0,
    durationMs: Math.max(0, nowMs() - startedAt),
    attachments: normalized.attachments.length,
  };
}

function getCacheKey(normalized) {
  return hashKey({
    model: normalized.model,
    prompt: normalized.prompt,
    negativePrompt: normalized.negativePrompt,
    mode: normalized.mode,
    duration: normalized.duration,
    ratio: normalized.ratio,
    quality: normalized.quality,
    style: normalized.style,
    cameraMotion: normalized.cameraMotion,
    seed: normalized.seed,
    guidance: normalized.guidance,
    attachmentNames: normalized.attachments.map((item) => `${item.name}:${item.size}:${item.kind}`),
  });
}

function getCachedResponse(key) {
  const found = REQUEST_CACHE.get(key);
  if (!found) return null;
  if (found.expiresAt <= nowMs()) {
    REQUEST_CACHE.delete(key);
    return null;
  }
  return found.value;
}

function setCachedResponse(key, value) {
  REQUEST_CACHE.set(key, { value, expiresAt: nowMs() + DEFAULTS.cacheTtlMs });
}

function getIdempotentResponse(key) {
  if (!key) return null;
  const found = IDEMPOTENCY_CACHE.get(key);
  if (!found) return null;
  if (found.expiresAt <= nowMs()) {
    IDEMPOTENCY_CACHE.delete(key);
    return null;
  }
  return found.value;
}

function setIdempotentResponse(key, value) {
  if (!key) return;
  IDEMPOTENCY_CACHE.set(key, { value, expiresAt: nowMs() + DEFAULTS.idempotencyTtlMs });
}

function setJobState(jobId, state) {
  JOB_STORE.set(jobId, { ...state, updatedAt: nowIso(), expiresAt: nowMs() + DEFAULTS.jobTtlMs });
}

async function maybeSendWebhook(normalized, payload) {
  if (!DEFAULTS.allowWebhook || !normalized.webhookUrl) return;
  try {
    await fetch(normalized.webhookUrl, {
      method: "POST",
      headers: { "content-type": JSON_CONTENT_TYPE },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    putStructuredLog("warn", normalized.traceId, { code: "WEBHOOK_FAILED", message: sanitizeError(error).message, webhookUrl: normalized.webhookUrl });
  }
}

async function executeGenerate(normalized) {
  const videoApi = resolveVideoApi();
  const promptPayload = buildPromptPayload(normalized);
  const providerOptions = buildProviderOptions(normalized);
  return retryableCall(async () => withTimeout(videoApi(promptPayload, providerOptions), normalized.timeoutMs), DEFAULTS.retryCount, normalized.traceId);
}

async function handleGenerateRequest(request) {
  cleanupExpiredMaps();

  const raw = await safeReadBody(request);
  const normalized = normalizeVideoRequest(request, raw.body, raw.files);
  const jobId = createId("job");

  const originCheck = validateOrigin(request);
  if (!originCheck.ok) {
    return jsonResponse(request, errorEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: originCheck.code, message: originCheck.message, details: originCheck.details, status: originCheck.status, retryable: false }), originCheck.status);
  }

  const rateCheck = validateRateLimit(request);
  if (!rateCheck.ok) {
    return jsonResponse(request, errorEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: rateCheck.code, message: rateCheck.message, details: rateCheck.details, status: rateCheck.status, retryable: true }), rateCheck.status);
  }

  const circuitCheck = checkCircuitBreaker();
  if (!circuitCheck.ok) {
    return jsonResponse(request, errorEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: circuitCheck.code, message: circuitCheck.message, details: circuitCheck.details, status: circuitCheck.status, retryable: true }), circuitCheck.status);
  }

  const validation = validateVideoRequest(normalized);
  if (!validation.ok) {
    return jsonResponse(request, errorEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: validation.code, message: validation.message, details: validation.details, status: validation.status, retryable: validation.retryable }), validation.status);
  }

  const idempotent = getIdempotentResponse(normalized.idempotencyKey);
  if (idempotent) return jsonResponse(request, idempotent, 200, { "x-idempotent-replay": "true" });

  const cacheKey = getCacheKey(normalized);
  const cached = getCachedResponse(cacheKey);
  if (cached) return jsonResponse(request, cached, 200, { "x-cache-hit": "true" });

  if (normalized.testMode) {
    const fakePayload = successEnvelope({
      requestId: normalized.requestId,
      traceId: normalized.traceId,
      startedAt: normalized.startedAt,
      code: "TEST_MODE",
      data: {
        type: RESPONSE_TYPE_OK,
        model: normalized.model,
        prompt: normalized.prompt,
        mode: normalized.mode,
        duration: normalized.duration,
        ratio: normalized.ratio,
        quality: normalized.quality,
        count: 1,
        videos: [{
          index: 0,
          format: "url",
          url: "https://samplelib.com/lib/preview/mp4/sample-5s.mp4",
          base64: null,
          binary: null,
          mimeType: "video/mp4",
          fileName: "test_video_1.mp4",
          posterUrl: null,
        }],
        raw: null,
      },
      meta: { jobId, status: "done", metrics: buildUsageMetrics(normalized, { videos: [{}] }, normalized.startedAt) },
    });
    setIdempotentResponse(normalized.idempotencyKey, fakePayload);
    setCachedResponse(cacheKey, fakePayload);
    return jsonResponse(request, fakePayload, 200);
  }

  if (normalized.stream) {
    const encoder = new TextEncoder();
    return new Response(new ReadableStream({
      async start(controller) {
        const write = (eventName, payload) => {
          try { controller.enqueue(encoder.encode(toSseFrame(eventName, payload))); } catch {}
        };
        const close = () => { try { controller.close(); } catch {} };

        try {
          setJobState(jobId, { requestId: normalized.requestId, traceId: normalized.traceId, status: "queued", model: normalized.model });

          write("ready", successEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: "STREAM_READY", data: { type: RESPONSE_TYPE_STREAM_READY, jobId, model: normalized.model, status: "queued" }, meta: null }));
          write("progress", successEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: "STREAM_PROGRESS", data: { type: RESPONSE_TYPE_STREAM_PROGRESS, jobId, status: "processing", progress: 0.35, message: "VİDEO ÜRETİMİ BAŞLATILDI." }, meta: null }));

          setJobState(jobId, { requestId: normalized.requestId, traceId: normalized.traceId, status: "processing", model: normalized.model });

          const rawResult = await executeGenerate(normalized);
          resetCircuitBreaker();
          const normalizedResult = await normalizeProviderResult(rawResult, normalized);
          const responseBody = successEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: "GENERATED", data: { ...normalizedResult, type: RESPONSE_TYPE_STREAM_RESULT }, meta: { jobId, status: "done", metrics: buildUsageMetrics(normalized, normalizedResult, normalized.startedAt) } });

          setCachedResponse(cacheKey, responseBody);
          setIdempotentResponse(normalized.idempotencyKey, responseBody);
          setJobState(jobId, { requestId: normalized.requestId, traceId: normalized.traceId, status: "done", model: normalized.model, result: responseBody });
          await maybeSendWebhook(normalized, responseBody);

          write("result", responseBody);
          close();
        } catch (error) {
          recordProviderFailure();
          const safe = sanitizeError(error);
          const errorBody = errorEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: safe.code, message: safe.message, details: { jobId }, status: 500, retryable: safe.retryable });
          setJobState(jobId, { requestId: normalized.requestId, traceId: normalized.traceId, status: "error", model: normalized.model, result: errorBody });
          write("error", errorBody);
          close();
        }
      },
    }), { status: 200, headers: buildSseHeaders(request) });
  }

  try {
    setJobState(jobId, { requestId: normalized.requestId, traceId: normalized.traceId, status: "queued", model: normalized.model });
    putStructuredLog("info", normalized.traceId, { event: "generate.start", requestId: normalized.requestId, jobId, model: normalized.model, mode: normalized.mode, duration: normalized.duration, ratio: normalized.ratio, quality: normalized.quality, attachmentCount: normalized.attachments.length });

    const rawResult = await executeGenerate(normalized);
    resetCircuitBreaker();
    const normalizedResult = await normalizeProviderResult(rawResult, normalized);
    const responseBody = successEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: "GENERATED", data: normalizedResult, meta: { jobId, status: "done", metrics: buildUsageMetrics(normalized, normalizedResult, normalized.startedAt) } });

    setCachedResponse(cacheKey, responseBody);
    setIdempotentResponse(normalized.idempotencyKey, responseBody);
    setJobState(jobId, { requestId: normalized.requestId, traceId: normalized.traceId, status: "done", model: normalized.model, result: responseBody });
    await maybeSendWebhook(normalized, responseBody);

    putStructuredLog("info", normalized.traceId, { event: "generate.done", requestId: normalized.requestId, jobId, videoCount: normalizedResult.videos.length });
    return jsonResponse(request, responseBody, 200);
  } catch (error) {
    recordProviderFailure();
    const safe = sanitizeError(error);
    const errorBody = errorEnvelope({ requestId: normalized.requestId, traceId: normalized.traceId, startedAt: normalized.startedAt, code: safe.code, message: safe.message, details: { jobId }, status: 500, retryable: safe.retryable });

    setJobState(jobId, { requestId: normalized.requestId, traceId: normalized.traceId, status: "error", model: normalized.model, result: errorBody });
    putStructuredLog("error", normalized.traceId, { event: "generate.error", requestId: normalized.requestId, jobId, code: safe.code, message: safe.message });
    return jsonResponse(request, errorBody, 500);
  }
}

async function handleInfo(request) {
  const startedAt = nowMs();
  const requestId = createId("info");
  const traceId = createId("trace");
  return jsonResponse(request, successEnvelope({ requestId, traceId, startedAt, code: "WORKER_INFO", data: { worker: APP_INFO.worker, version: APP_INFO.version, protocolVersion: APP_INFO.protocolVersion, billingMode: APP_INFO.billingMode, routes: ["GET /", "GET /health", "GET /jobs/:id", "POST /generate"], notes: ["BU WORKER SADECE VIDEO GENERATION İÇİNDİR.", "MODELS-WORKER KATALOG KAYNAĞIDIR; BU DOSYA ÜRETİM KATMANIDIR.", "MODEL ALANI `model` OLARAK GÖNDERİLMELİDİR. `modelId` GERİYE DÖNÜK UYUMLULUK İÇİN KABUL EDİLİR.", "OWNER-PAYS MANTIĞIYLA ME.PUTER ÜZERİNDEN ÇALIŞIR."] }, meta: null }), 200);
}

async function handleHealth(request) {
  const startedAt = nowMs();
  const requestId = createId("health");
  const traceId = createId("trace");

  const providerAvailable = (() => {
    try {
      resolveVideoApi();
      return true;
    } catch {
      return false;
    }
  })();

  return jsonResponse(request, successEnvelope({ requestId, traceId, startedAt, code: "HEALTHY", data: { ok: true, maintenanceMode: DEFAULTS.maintenanceMode, providerAvailable, circuitOpen: checkCircuitBreaker().ok === false }, meta: null }), providerAvailable ? 200 : 503);
}

async function handleJobStatus(request, jobId) {
  const startedAt = nowMs();
  const requestId = createId("job");
  const traceId = createId("trace");
  const job = JOB_STORE.get(jobId);

  if (!job) {
    return jsonResponse(request, errorEnvelope({ requestId, traceId, startedAt, code: "JOB_NOT_FOUND", message: "JOB BULUNAMADI.", details: { jobId }, status: 404, retryable: false }), 404);
  }

  return jsonResponse(request, successEnvelope({ requestId, traceId, startedAt, code: "JOB_STATUS", data: { jobId, status: job.status, model: job.model, updatedAt: job.updatedAt, result: job.result || null }, meta: null }), 200);
}

function notFound(request) {
  const startedAt = nowMs();
  const requestId = createId("nf");
  const traceId = createId("trace");
  return jsonResponse(request, errorEnvelope({ requestId, traceId, startedAt, code: "NOT_FOUND", message: "ROUTE BULUNAMADI.", details: { routes: ["GET /", "GET /health", "GET /jobs/:id", "POST /generate"] }, status: 404, retryable: false }), 404);
}

async function routeRequest(request) {
  const url = new URL(request.url);
  const pathname = url.pathname.replace(/\/+$/, "") || "/";

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: buildCorsHeaders(request) });
  }

  if (request.method === "GET" && pathname === "/") return handleInfo(request);
  if (request.method === "GET" && pathname === "/health") return handleHealth(request);
  if (request.method === "POST" && pathname === "/generate") return handleGenerateRequest(request);

  const jobMatch = pathname.match(/^\/jobs\/([^/]+)$/);
  if (request.method === "GET" && jobMatch) return handleJobStatus(request, jobMatch[1]);

  return notFound(request);
}

addEventListener("fetch", (event) => {
  event.respondWith((async () => {
    try {
      return await routeRequest(event.request);
    } catch (error) {
      const startedAt = nowMs();
      const requestId = createId("fatal");
      const traceId = createId("trace");
      const safe = sanitizeError(error);
      return jsonResponse(event.request, errorEnvelope({ requestId, traceId, startedAt, code: safe.code, message: safe.message, details: null, status: 500, retryable: safe.retryable }), 500);
    }
  })());
});

/*
FRONTEND CONTRACT NOTLARI

1. MODEL GÖNDERİMİ:
   - ANA ALAN: `model`
   - DEĞER: SEÇİLİ MODELİN `modelId` DEĞERİ
   - GERİYE DÖNÜK UYUMLULUK İÇİN `modelId` DE GÖNDERİLEBİLİR

2. ANA UÇ:
   - POST /generate

3. KABUL EDİLEN TEMEL ALANLAR:
   {
     model: "luma/ray-2",
     prompt: "sinematik şehir introsu",
     mode: "text-video",
     duration: 5,
     ratio: "16:9",
     quality: "high",
     style: "cinematic",
     cameraMotion: "dolly",
     negativePrompt: "blurry, low quality",
     guidance: 7,
     seed: 42,
     responseFormat: "url",
     stream: false,
     testMode: false,
     meta: {...}
   }

4. DOSYA YÜKLEME:
   - multipart/form-data desteklenir
   - reference / source / ref / image anahtarları REFERANS GÖRSEL olarak yorumlanır
   - video anahtarı KAYNAK VİDEO olarak yorumlanır
   - mask anahtarı MASK olarak yorumlanır

5. BAŞARILI YANIT OKUMA:
   - json.ok === true
   - json.data.videos dizisini oku
   - her kayıt içinde url / base64 / binary / posterUrl olabilir

6. HATA OKUMA:
   - json.ok === false
   - json.error.message alanını göster
   - fallback olarak json.code göster

7. STREAM MODU:
   - ready
   - progress
   - result
   - error
*/
