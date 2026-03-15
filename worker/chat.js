/*
DOSYA: chat.js
AMAÇ: ME.PUTER ODAKLI, OWNER-PAYS, TEK GÖREVLİ, GÜVENLİ CHAT WORKER.
NOT: BU WORKER FRONTEND'DEN DOĞRUDAN ÇAĞRILIR; PUTER AUTH KULLANICIDA DEĞİL BACKENDDE KALIR.
NOT: BU DOSYA CHAT İÇİN AYRIDIR; IMAGE/TTS/VIDEO/PHOTO-TO-VIDEO BUNUN İÇİNE EKLENMEMELİDİR.
*/
/*
█████████████████████████████████████████████
1) BU DOSYA, ME.PUTER ODAKLI VE OWNER-PAYS MANTIĞIYLA ÇALIŞAN TEK AMAÇLI CHAT WORKER'IDIR.
2) APP_INFO NESNESİNDE worker ADI "chat", billingMode DEĞERİ "owner_pays" VE purpose DEĞERİ "ME.PUTER CHAT GATEWAY" OLARAK TANIMLANMIŞTIR.
3) DOSYANIN TEMEL GÖREVİ, FRONTEND'DEN GELEN CHAT TALEPLERİNİ GÜVENLİ BİR ŞEKİLDE PUTER CHAT RUNTIME'INA AKTARMAKTIR.
4) BU WORKER BİLİNÇLİ OLARAK SADECE CHAT İÇİN AYRILMIŞTIR; IMAGE, TTS, VIDEO VE DİĞER AKIŞLAR BURAYA KARIŞTIRILMAMALIDIR.
5) DOSYA, PROMPT, TEXT, MESSAGE, CONTENT, QUERY, INPUT GİBİ ÇEŞİTLİ GİRDİ ALANLARINI NORMALLEŞTİREREK TEK BİR CHAT İSTEĞİNE DÖNÜŞTÜRÜR.
6) MESSAGES YAPISI DESTEKLENDİĞİ İÇİN TEK MESAJLI SOHBETTEN ÇOK TURLU KONUŞMAYA KADAR FARKLI CHAT SENARYOLARI TAŞINABİLİR.
7) TOOLS VE MODEL SEÇİMİ GİBİ OPSİYONLAR, İLERİ DÜZEY CHAT ÇAĞRILARINI DA BU DOSYA ÜZERİNDEN MÜMKÜN KILAR.
8) STREAM BAYRAĞI DESTEKLENDİĞİ İÇİN WORKER HEM NORMAL JSON YANIT HEM DE SSE TABANLI AKIŞ ÇIKTISI ÜRETEBİLİR.
9) REQUEST_TYPE_STREAM VE STREAM_DONE BENZERİ TİPLER, DOSYANIN PARÇALI YANIT GÖNDERMEK İÇİN AYRI BİR PROTOKOL KURDUĞUNU GÖSTERİR.
10) buildPuterChatOptions() BENZERİ KATMANLAR, NORMALLEŞTİRİLMİŞ GİRDİYİ PUTER CHAT API'SİNİN BEKLEDİĞİ FORMATLA UYUMLU HALE GETİRİR.
11) sanitizeError() TARZI GÜVENLİK KATMANLARI, HATA MESAJLARINDA TOKEN VE BENZERİ HASSAS VERİ SIZMASINI AZALTMAYA YÖNELİKTİR.
12) requestId, traceId VE startedAt GİBİ ALANLAR, HEM DEBUG HEM DE İSTEK TAKİBİ İÇİN KULLANILIR.
13) DOSYA, BAŞARILI VE HATALI YANITLAR İÇİN TUTARLI ENVELOPE YAPISI KULLANIR.
14) STREAM MODUNDA HER PARÇA İÇİN CHUNK INDEX VE BİRİKMİŞ METİN TAKİBİ YAPILDIĞI GÖRÜLÜR.
15) AKIŞ BAŞARISIZ OLURSA STREAM_FAILED BENZERİ AÇIK KODLU HATALAR ÜRETİLİR.
16) OWNER-PAYS YAPISI SAYESİNDE MALİYETİN KULLANICI TARAFINDA DEĞİL SERVİS SAHİBİ BAĞLAMINDA YÖNETİLMESİ HEDEFLENİR.
17) DOSYA, İSTEMCİYİ DOĞRUDAN PUTER'A DEĞİL, KONTROLLÜ BİR GATEWAY KATMANINA BAĞLAR.
18) CORS VE JSON / SSE CONTENT-TYPE YÖNETİMİ, TARAYICI UYUMLULUĞU AÇISINDAN KRİTİK PARÇALARDIR.
19) CHAT GİRİŞLERİNİ TEMİZLEME, KISALTMA VE TÜRE DÖNÜŞTÜRME KATMANLARI BU DOSYAYI TOLERANSLI HALE GETİRİR.
20) YANLIŞ FORMATTA İSTEK GELSE BİLE, DOSYA MÜMKÜN OLDUĞUNCA ONU ÇALIŞABİLİR CHAT FORMATINA ÇEKMEYE ÇALIŞIR.
21) SADECE TEK ENDPOINT GİBİ GÖRÜNSE DE, DOSYA ARKADA NORMALLEŞTİRME + YETKİ BAĞLAMI + STREAM PROTOKOLÜ BİRLİKTE YÜRÜTÜR.
22) CHAT ÇIKTISININ TAMAMLANMIŞ METNİ VE CHUNK SAYISI GİBİ ÖZETLER, İSTEMCİ TARAFI UI İÇİN KULLANIŞLI VERİLER SAĞLAR.
23) BU DOSYA BOZULURSA SADECE BASİT SOHBET DEĞİL, STREAM SOHBET VE TOOL DESTEKLİ CHAT AKIŞLARI DA ETKİLENİR.
24) MİMARİ OLARAK BU DOSYA, “İSTEMCİ İLE PUTER CHAT MOTORU ARASINDAKİ GÜVENLİ TERCÜMAN” GİBİ ÇALIŞIR.
25) KISACA: BU DOSYA, OWNER-PAYS CHAT İSTEKLERİNİ NORMALLEŞTİRİP PUTER RUNTIME'A AKTARAN, GEREKTİĞİNDE STREAM OLARAK GERİ DÖNEN ANA CHAT GATEWAY WORKER'IDIR.
█████████████████████████████████████████████
*/


const APP_INFO = Object.freeze({
    worker: "chat",
    version: "1.0.0",
    protocolVersion: "2026-03-12",
    runtime: "puter-worker",
    billingMode: "owner_pays",
    purpose: "ME.PUTER CHAT GATEWAY",
  });
  
  const DEFAULTS = Object.freeze({
    model: "gpt-5-nano",
    temperature: 0.7,
    maxTokens: 1200,
    timeoutMs: 90000,
    maxPromptLength: 16000,
    maxMessages: 40,
    maxTools: 16,
    allowStream: true,
  });
  
  const ALLOWED_METHODS = "GET,POST,OPTIONS";
  const JSON_CONTENT_TYPE = "application/json; charset=utf-8";
  const SSE_CONTENT_TYPE = "text/event-stream; charset=utf-8";
  const REQUEST_TYPE_CREATE = "chat.create";
  const REQUEST_TYPE_STREAM = "chat.stream";
  const RESPONSE_TYPE_OK = "chat.result";
  const RESPONSE_TYPE_STREAM_READY = "chat.stream.ready";
  const RESPONSE_TYPE_STREAM_CHUNK = "chat.stream.chunk";
  const RESPONSE_TYPE_STREAM_DONE = "chat.stream.done";
  const RESPONSE_TYPE_ERROR = "chat.error";
  
  const SECRET_PATTERNS = [
    /bearer\s+[a-z0-9\-._~+/]+=*/gi,
    /\bsk-[a-z0-9]{10,}\b/gi,
    /\bpk-[a-z0-9]{10,}\b/gi,
    /\b[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{16,}\.[A-Za-z0-9_\-]{16,}\b/g,
    /"authorization"\s*:\s*"[^"]+"/gi,
    /"cookie"\s*:\s*"[^"]+"/gi,
  ];
  
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
    try {
      const n = Number(value);
      return Number.isFinite(n) ? n : fallback;
    } catch {
      return fallback;
    }
  }
  
  function toPositiveInteger(value, fallback) {
    try {
      const n = Number(value);
      return Number.isInteger(n) && n > 0 ? n : fallback;
    } catch {
      return fallback;
    }
  }
  
  function toBoolean(value, fallback = false) {
    try {
      if (typeof value === "boolean") return value;
      if (typeof value === "string") {
        const lowered = value.trim().toLowerCase();
        if (["true", "1", "yes", "evet"].includes(lowered)) return true;
        if (["false", "0", "no", "hayir", "hayır"].includes(lowered)) return false;
      }
      return fallback;
    } catch {
      return fallback;
    }
  }
  
  function clampText(text, maxLen) {
    try {
      if (typeof text !== "string") return "";
      return text.trim().slice(0, maxLen);
    } catch {
      return "";
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
      return {
        code,
        message,
        retryable: false,
      };
    } catch {
      return {
        code: "UNEXPECTED_ERROR",
        message: "BEKLENMEYEN HATA OLUŞTU.",
        retryable: false,
      };
    }
  }
  
  function safeStringify(value) {
    try {
      return JSON.stringify(value);
    } catch {
      return '"[UNSERIALIZABLE]"';
    }
  }
  
  function buildCorsHeaders(request) {
    const origin = request.headers.get("origin") || "*";
    return {
      "access-control-allow-origin": origin,
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
  
  function errorEnvelope({
    requestId,
    traceId,
    startedAt,
    code = "BAD_REQUEST",
    message = "İSTEK BAŞARISIZ.",
    details = null,
    status = 400,
    retryable = false,
  }) {
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
  
  function jsonResponse(request, body, status = 200, extraHeaders = {}) {
    return new Response(JSON.stringify(body, null, 2), {
      status,
      headers: buildJsonHeaders(request, extraHeaders),
    });
  }
  
  function sendJsonSuccess(request, payload, status = 200) {
    return jsonResponse(request, payload, status);
  }
  
  function sendJsonError(request, payload, status = 400) {
    return jsonResponse(request, payload, status);
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
  
  function parseFormEncoded(rawText) {
    try {
      if (!rawText || typeof rawText !== "string") return null;
      const params = new URLSearchParams(rawText);
      const obj = {};
      for (const [key, value] of params.entries()) {
        obj[key] = value;
      }
      return obj;
    } catch {
      return null;
    }
  }
  
  async function safeReadBody(request) {
    try {
      const contentType = (request.headers.get("content-type") || "").toLowerCase();
  
      try {
        if (contentType.includes("application/json")) {
          const parsedJson = await safeReadJson(request);
          if (isPlainObject(parsedJson) || Array.isArray(parsedJson)) {
            return parsedJson;
          }
        }
      } catch {}
  
      try {
        const rawText = await safeReadText(request);
        if (!rawText || !rawText.trim()) {
          return {};
        }
  
        try {
          const parsed = JSON.parse(rawText);
          if (isPlainObject(parsed) || Array.isArray(parsed)) {
            return parsed;
          }
        } catch {}
  
        try {
          if (contentType.includes("application/x-www-form-urlencoded")) {
            const formData = parseFormEncoded(rawText);
            if (isPlainObject(formData)) {
              return formData;
            }
          }
        } catch {}
  
        return {
          prompt: rawText.trim(),
          text: rawText.trim(),
        };
      } catch {}
  
      return {};
    } catch {
      return {};
    }
  }
  
  function mergeQueryIntoBody(request, body) {
    try {
      const url = new URL(request.url);
      const merged = isPlainObject(body) ? { ...body } : {};
      for (const [key, value] of url.searchParams.entries()) {
        if (merged[key] === undefined) {
          merged[key] = value;
        }
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
      return {
        ...root,
        ...data,
        ...payload,
      };
    } catch {
      return {};
    }
  }
  
  function firstNonEmptyString(...values) {
    try {
      for (const value of values) {
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
      return "";
    } catch {
      return "";
    }
  }
  
  function pickString(obj, keys) {
    try {
      if (!isPlainObject(obj)) return "";
      for (const key of keys) {
        const value = obj[key];
        if (typeof value === "string" && value.trim()) {
          return value.trim();
        }
      }
      return "";
    } catch {
      return "";
    }
  }
  
  function pickAny(obj, keys) {
    try {
      if (!isPlainObject(obj)) return undefined;
      for (const key of keys) {
        if (obj[key] !== undefined && obj[key] !== null) {
          return obj[key];
        }
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
  
  function normalizeRole(value) {
    try {
      const role = String(value || "").trim().toLowerCase();
      if (["system", "user", "assistant", "tool"].includes(role)) return role;
      return "";
    } catch {
      return "";
    }
  }
  
  function normalizeMessageContent(value) {
    try {
      if (typeof value === "string") {
        return clampText(value, DEFAULTS.maxPromptLength);
      }
  
      if (Array.isArray(value)) {
        const parts = [];
        for (const item of value) {
          try {
            if (typeof item === "string" && item.trim()) {
              parts.push(item.trim());
              continue;
            }
            if (isPlainObject(item) && typeof item.text === "string" && item.text.trim()) {
              parts.push(item.text.trim());
            }
          } catch {}
        }
        return clampText(parts.join("\n"), DEFAULTS.maxPromptLength);
      }
  
      if (isPlainObject(value) && typeof value.text === "string") {
        return clampText(value.text, DEFAULTS.maxPromptLength);
      }
  
      return "";
    } catch {
      return "";
    }
  }
  
  function normalizeMessages(input) {
    try {
      const messagesInput = Array.isArray(input.messages) ? input.messages : [];
      const normalized = [];
  
      for (const rawMessage of messagesInput.slice(0, DEFAULTS.maxMessages)) {
        try {
          if (!isPlainObject(rawMessage)) continue;
  
          const role = normalizeRole(rawMessage.role);
          const content = normalizeMessageContent(rawMessage.content);
  
          if (!role || !content) continue;
  
          normalized.push({
            role,
            content,
          });
        } catch {}
      }
  
      const systemPrompt = clampText(
        firstNonEmptyString(
          pickString(input, ["system", "systemPrompt", "system_message", "systemMessage"]),
          pickString(input, ["instruction", "instructions"])
        ),
        DEFAULTS.maxPromptLength
      );
  
      if (systemPrompt && normalized.length === 0) {
        normalized.push({
          role: "system",
          content: systemPrompt,
        });
      } else if (systemPrompt && normalized[0]?.role !== "system") {
        normalized.unshift({
          role: "system",
          content: systemPrompt,
        });
      }
  
      const prompt = clampText(
        firstNonEmptyString(
          pickString(input, ["prompt", "text", "message", "content", "query", "input"]),
          pickString(input, ["mesaj", "soru", "metin"])
        ),
        DEFAULTS.maxPromptLength
      );
  
      if (prompt) {
        const hasUserMessage = normalized.some((message) => message.role === "user");
        if (!hasUserMessage) {
          normalized.push({
            role: "user",
            content: prompt,
          });
        }
      }
  
      return normalized;
    } catch {
      return [];
    }
  }
  
  function normalizeTools(input) {
    try {
      const tools = Array.isArray(input.tools) ? input.tools : [];
      const normalized = [];
  
      for (const tool of tools.slice(0, DEFAULTS.maxTools)) {
        try {
          if (!isPlainObject(tool)) continue;
          normalized.push(tool);
        } catch {}
      }
  
      return normalized;
    } catch {
      return [];
    }
  }
  
  function normalizeChatRequest(request, rawBody) {
    const startedAt = nowMs();
    const traceId = createId("trace");
  
    try {
      const body = mergeQueryIntoBody(request, rawBody);
      const input = getMergedInput(body);
      const messages = normalizeMessages(input);
      const tools = normalizeTools(input);
  
      const explicitPrompt = clampText(
        firstNonEmptyString(
          pickString(input, ["prompt", "text", "message", "content", "query", "input"]),
          pickString(input, ["mesaj", "soru", "metin"])
        ),
        DEFAULTS.maxPromptLength
      );
  
      const stream =
        DEFAULTS.allowStream &&
        toBoolean(pickAny(input, ["stream", "isStream", "useStream"]), false);
  
      const requestType = stream ? REQUEST_TYPE_STREAM : REQUEST_TYPE_CREATE;
      const requestId = firstNonEmptyString(
        input.requestId,
        input.clientRequestId,
        input.idempotencyKey,
        input.id,
        createId("chat")
      );
  
      const normalized = {
        traceId,
        requestId,
        startedAt,
        type: firstNonEmptyString(input.type, requestType) || requestType,
        version: firstNonEmptyString(input.version, APP_INFO.protocolVersion) || APP_INFO.protocolVersion,
        timestamp: firstNonEmptyString(input.timestamp, nowIso()) || nowIso(),
        model: firstNonEmptyString(input.model, input.modelId, DEFAULTS.model) || DEFAULTS.model,
        stream,
        temperature: safeNumber(input.temperature, DEFAULTS.temperature),
        maxTokens: toPositiveInteger(input.maxTokens ?? input.max_tokens, DEFAULTS.maxTokens),
        timeoutMs: toPositiveInteger(input.timeoutMs ?? input.timeout_ms, DEFAULTS.timeoutMs),
        tools,
        messages,
        prompt: explicitPrompt,
        metadata: isPlainObject(input.meta)
          ? input.meta
          : isPlainObject(input.metadata)
          ? input.metadata
          : {},
        rawInput: input,
      };
  
      return normalized;
    } catch {
      return {
        traceId,
        requestId: createId("chat"),
        startedAt,
        type: REQUEST_TYPE_CREATE,
        version: APP_INFO.protocolVersion,
        timestamp: nowIso(),
        model: DEFAULTS.model,
        stream: false,
        temperature: DEFAULTS.temperature,
        maxTokens: DEFAULTS.maxTokens,
        timeoutMs: DEFAULTS.timeoutMs,
        tools: [],
        messages: [],
        prompt: "",
        metadata: {},
        rawInput: {},
      };
    }
  }
  
  function validateChatRequest(normalized) {
    try {
      const problems = [];
  
      if (!normalized || !isPlainObject(normalized)) {
        problems.push("İSTEK GÖVDESİ NORMALIZE EDİLEMEDİ.");
      }
  
      if (!normalized.requestId) {
        problems.push("REQUEST ID ÜRETİLEMEDİ.");
      }
  
      if (!normalized.model) {
        problems.push("MODEL ALANI BOŞ.");
      }
  
      if (!Array.isArray(normalized.messages) || normalized.messages.length === 0) {
        problems.push("PROMPT VEYA MESSAGES ZORUNLUDUR.");
      }
  
      if (Array.isArray(normalized.messages) && normalized.messages.length > DEFAULTS.maxMessages) {
        problems.push(`MESSAGES SAYISI ${DEFAULTS.maxMessages} SINIRINI AŞIYOR.`);
      }
  
      if (normalized.tools.length > DEFAULTS.maxTools) {
        problems.push(`TOOLS SAYISI ${DEFAULTS.maxTools} SINIRINI AŞIYOR.`);
      }
  
      if (typeof normalized.temperature !== "number" || Number.isNaN(normalized.temperature)) {
        problems.push("TEMPERATURE GEÇERSİZ.");
      }
  
      if (!Number.isInteger(normalized.maxTokens) || normalized.maxTokens <= 0) {
        problems.push("MAX TOKENS GEÇERSİZ.");
      }
  
      if (!Number.isInteger(normalized.timeoutMs) || normalized.timeoutMs <= 0) {
        problems.push("TIMEOUT GEÇERSİZ.");
      }
  
      if (problems.length > 0) {
        return {
          ok: false,
          code: "INVALID_CHAT_REQUEST",
          message: "CHAT İSTEĞİ GEÇERSİZ.",
          details: {
            problems,
            acceptedFields: [
              "prompt",
              "text",
              "message",
              "content",
              "messages",
              "model",
              "stream",
              "tools",
              "temperature",
              "maxTokens",
              "payload",
              "meta",
            ],
          },
        };
      }
  
      return { ok: true };
    } catch {
      return {
        ok: false,
        code: "INVALID_CHAT_REQUEST",
        message: "CHAT İSTEĞİ DOĞRULANAMADI.",
        details: null,
      };
    }
  }
  
  function buildPuterChatInput(normalized) {
    try {
      const hasOnlySingleUserMessage =
        normalized.messages.length === 1 && normalized.messages[0]?.role === "user";
  
      if (hasOnlySingleUserMessage) {
        return normalized.messages[0].content;
      }
  
      return normalized.messages.map((message) => ({
        role: message.role,
        content: message.content,
      }));
    } catch {
      return normalized.prompt || "";
    }
  }
  
  function buildPuterChatOptions(normalized) {
    try {
      return {
        model: normalized.model,
        stream: normalized.stream,
        temperature: normalized.temperature,
        max_tokens: normalized.maxTokens,
        tools: normalized.tools.length > 0 ? normalized.tools : undefined,
      };
    } catch {
      return {
        model: DEFAULTS.model,
        stream: false,
        temperature: DEFAULTS.temperature,
        max_tokens: DEFAULTS.maxTokens,
      };
    }
  }
  
  function withTimeout(promise, timeoutMs) {
    let timer = null;
  
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => {
        const error = new Error("CHAT İŞLEMİ ZAMAN AŞIMINA UĞRADI.");
        error.code = "CHAT_TIMEOUT";
        reject(error);
      }, timeoutMs);
    });
  
    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timer) clearTimeout(timer);
    });
  }
  
  function extractTextFromUnknown(value) {
    try {
      if (typeof value === "string") {
        return value;
      }
  
      if (isPlainObject(value) && typeof value.text === "string") {
        return value.text;
      }
  
      if (isPlainObject(value) && typeof value.response === "string") {
        return value.response;
      }
  
      if (isPlainObject(value) && isPlainObject(value.message) && typeof value.message.content === "string") {
        return value.message.content;
      }
  
      if (
        isPlainObject(value) &&
        isPlainObject(value.message) &&
        Array.isArray(value.message.content)
      ) {
        return value.message.content
          .map((item) => {
            try {
              if (typeof item === "string") return item;
              if (isPlainObject(item) && typeof item.text === "string") return item.text;
              return "";
            } catch {
              return "";
            }
          })
          .filter(Boolean)
          .join("\n");
      }
  
      return "";
    } catch {
      return "";
    }
  }
  
  function extractToolCalls(value) {
    try {
      if (Array.isArray(value?.tool_calls)) {
        return value.tool_calls;
      }
      if (Array.isArray(value?.toolCalls)) {
        return value.toolCalls;
      }
      if (Array.isArray(value?.message?.tool_calls)) {
        return value.message.tool_calls;
      }
      return [];
    } catch {
      return [];
    }
  }
  
  function normalizeFinalChatResult(result, normalized) {
    try {
      const outputText = clampText(extractTextFromUnknown(result), DEFAULTS.maxPromptLength);
      const toolCalls = extractToolCalls(result);
  
      return {
        type: RESPONSE_TYPE_OK,
        model: normalized.model,
        stream: false,
        outputText,
        messages: [
          {
            role: "assistant",
            content: outputText,
          },
        ],
        toolCalls,
        raw: result ?? null,
      };
    } catch {
      return {
        type: RESPONSE_TYPE_OK,
        model: normalized.model,
        stream: false,
        outputText: "",
        messages: [],
        toolCalls: [],
        raw: null,
      };
    }
  }
  
  function normalizeStreamChunk(chunk, index) {
    try {
      const deltaText = clampText(extractTextFromUnknown(chunk), DEFAULTS.maxPromptLength);
      const toolCalls = extractToolCalls(chunk);
  
      return {
        type: RESPONSE_TYPE_STREAM_CHUNK,
        chunkIndex: index,
        deltaText,
        toolCalls,
        raw: chunk ?? null,
      };
    } catch {
      return {
        type: RESPONSE_TYPE_STREAM_CHUNK,
        chunkIndex: index,
        deltaText: "",
        toolCalls: [],
        raw: null,
      };
    }
  }
  
  function toSseFrame(eventName, payload) {
    const serialized = safeStringify(payload);
    return `event: ${eventName}\ndata: ${serialized}\n\n`;
  }
  
  async function streamChatResponse(request, normalized, streamResult) {
    const encoder = new TextEncoder();
  
    return new Response(
      new ReadableStream({
        async start(controller) {
          let finished = false;
          let fullText = "";
          let chunkIndex = 0;
  
          const closeSafely = () => {
            try {
              if (!finished) {
                finished = true;
                controller.close();
              }
            } catch {}
          };
  
          const writeSafely = (eventName, payload) => {
            try {
              controller.enqueue(encoder.encode(toSseFrame(eventName, payload)));
            } catch {}
          };
  
          try {
            writeSafely(
              "ready",
              successEnvelope({
                requestId: normalized.requestId,
                traceId: normalized.traceId,
                startedAt: normalized.startedAt,
                code: "STREAM_READY",
                data: {
                  type: RESPONSE_TYPE_STREAM_READY,
                  model: normalized.model,
                  stream: true,
                },
                meta: {
                  chunkIndex,
                },
              })
            );
  
            try {
              for await (const chunk of streamResult) {
                try {
                  const normalizedChunk = normalizeStreamChunk(chunk, chunkIndex);
                  fullText += normalizedChunk.deltaText || "";
  
                  writeSafely(
                    "chunk",
                    successEnvelope({
                      requestId: normalized.requestId,
                      traceId: normalized.traceId,
                      startedAt: normalized.startedAt,
                      code: "STREAM_CHUNK",
                      data: normalizedChunk,
                      meta: {
                        chunkIndex,
                      },
                    })
                  );
  
                  chunkIndex += 1;
                } catch (chunkError) {
                  const safeChunkError = sanitizeError(chunkError);
                  writeSafely(
                    "warning",
                    errorEnvelope({
                      requestId: normalized.requestId,
                      traceId: normalized.traceId,
                      startedAt: normalized.startedAt,
                      code: safeChunkError.code || "STREAM_CHUNK_FAILED",
                      message: safeChunkError.message || "STREAM PARÇASI İŞLENEMEDİ.",
                      details: { chunkIndex },
                      status: 500,
                      retryable: false,
                    })
                  );
                }
              }
            } catch (streamLoopError) {
              const safeStreamLoopError = sanitizeError(streamLoopError);
              writeSafely(
                "error",
                errorEnvelope({
                  requestId: normalized.requestId,
                  traceId: normalized.traceId,
                  startedAt: normalized.startedAt,
                  code: safeStreamLoopError.code || "STREAM_FAILED",
                  message: safeStreamLoopError.message || "STREAM AKIŞI BAŞARISIZ.",
                  details: null,
                  status: 500,
                  retryable: false,
                })
              );
              closeSafely();
              return;
            }
  
            writeSafely(
              "done",
              successEnvelope({
                requestId: normalized.requestId,
                traceId: normalized.traceId,
                startedAt: normalized.startedAt,
                code: "STREAM_DONE",
                data: {
                  type: RESPONSE_TYPE_STREAM_DONE,
                  model: normalized.model,
                  stream: true,
                  outputText: fullText,
                  chunkCount: chunkIndex,
                },
                meta: {
                  chunkCount: chunkIndex,
                },
              })
            );
  
            closeSafely();
          } catch (fatalStreamError) {
            const safeFatalStreamError = sanitizeError(fatalStreamError);
            writeSafely(
              "error",
              errorEnvelope({
                requestId: normalized.requestId,
                traceId: normalized.traceId,
                startedAt: normalized.startedAt,
                code: safeFatalStreamError.code || "STREAM_FATAL",
                message: safeFatalStreamError.message || "STREAM BAŞLATILAMADI.",
                details: null,
                status: 500,
                retryable: false,
              })
            );
            closeSafely();
          }
        },
        cancel() {
          return;
        },
      }),
      {
        status: 200,
        headers: buildSseHeaders(request),
      }
    );
  }
  
  async function executeChat(normalized) {
    try {
      const puterInput = buildPuterChatInput(normalized);
      const puterOptions = buildPuterChatOptions(normalized);
  
      try {
        return await withTimeout(me.puter.ai.chat(puterInput, puterOptions), normalized.timeoutMs);
      } catch (chatError) {
        throw chatError;
      }
    } catch (executeError) {
      throw executeError;
    }
  }
  
  router.options("/*page", ({ request }) => {
    return new Response(null, {
      status: 204,
      headers: buildCorsHeaders(request),
    });
  });
  
  router.get("/", async ({ request }) => {
    const startedAt = nowMs();
    const requestId = createId("info");
    const traceId = createId("trace");
  
    return sendJsonSuccess(
      request,
      successEnvelope({
        requestId,
        traceId,
        startedAt,
        code: "WORKER_INFO",
        data: {
          worker: APP_INFO.worker,
          version: APP_INFO.version,
          protocolVersion: APP_INFO.protocolVersion,
          billingMode: APP_INFO.billingMode,
          routes: ["GET /", "GET /health", "POST /chat"],
          notes: [
            "BU WORKER SADECE CHAT İÇİNDİR.",
            "CHAT İŞLEMLERİ ME.PUTER ÜZERİNDEN OWNER-PAYS MANTIĞIYLA ÇALIŞIR.",
            "STREAM VE TOOLS DESTEĞİ AYNI CHAT CONTRACT'I İÇİNDE SUNULUR.",
          ],
        },
        meta: null,
      }),
      200
    );
  });
  
  router.get("/health", async ({ request }) => {
    const startedAt = nowMs();
    const requestId = createId("health");
    const traceId = createId("trace");
  
    return sendJsonSuccess(
      request,
      successEnvelope({
        requestId,
        traceId,
        startedAt,
        code: "HEALTH_OK",
        data: {
          status: "ok",
          worker: APP_INFO.worker,
          version: APP_INFO.version,
          time: nowIso(),
        },
        meta: null,
      }),
      200
    );
  });
  
  router.post("/chat", async ({ request }) => {
    const outerStartedAt = nowMs();
    const outerRequestId = createId("chat");
    const outerTraceId = createId("trace");
  
    try {
      let rawBody = {};
  
      try {
        rawBody = await safeReadBody(request);
      } catch (readBodyError) {
        const safeReadBodyError = sanitizeError(readBodyError);
        return sendJsonError(
          request,
          errorEnvelope({
            requestId: outerRequestId,
            traceId: outerTraceId,
            startedAt: outerStartedAt,
            code: safeReadBodyError.code || "BODY_READ_FAILED",
            message: safeReadBodyError.message || "İSTEK GÖVDESİ OKUNAMADI.",
            details: null,
            status: 400,
            retryable: false,
          }),
          400
        );
      }
  
      let normalized;
  
      try {
        normalized = normalizeChatRequest(request, rawBody);
      } catch (normalizeError) {
        const safeNormalizeError = sanitizeError(normalizeError);
        return sendJsonError(
          request,
          errorEnvelope({
            requestId: outerRequestId,
            traceId: outerTraceId,
            startedAt: outerStartedAt,
            code: safeNormalizeError.code || "NORMALIZE_FAILED",
            message: safeNormalizeError.message || "CHAT İSTEĞİ NORMALIZE EDİLEMEDİ.",
            details: null,
            status: 400,
            retryable: false,
          }),
          400
        );
      }
  
      try {
        const validation = validateChatRequest(normalized);
        if (!validation.ok) {
          return sendJsonError(
            request,
            errorEnvelope({
              requestId: normalized.requestId,
              traceId: normalized.traceId,
              startedAt: normalized.startedAt,
              code: validation.code,
              message: validation.message,
              details: validation.details,
              status: 400,
              retryable: false,
            }),
            400
          );
        }
      } catch (validationError) {
        const safeValidationError = sanitizeError(validationError);
        return sendJsonError(
          request,
          errorEnvelope({
            requestId: normalized.requestId,
            traceId: normalized.traceId,
            startedAt: normalized.startedAt,
            code: safeValidationError.code || "VALIDATION_FAILED",
            message: safeValidationError.message || "CHAT İSTEĞİ DOĞRULANAMADI.",
            details: null,
            status: 400,
            retryable: false,
          }),
          400
        );
      }
  
      let result;
  
      try {
        result = await executeChat(normalized);
      } catch (executeError) {
        const safeExecuteError = sanitizeError(executeError);
        return sendJsonError(
          request,
          errorEnvelope({
            requestId: normalized.requestId,
            traceId: normalized.traceId,
            startedAt: normalized.startedAt,
            code: safeExecuteError.code || "CHAT_EXECUTION_FAILED",
            message: safeExecuteError.message || "CHAT ÇAĞRISI BAŞARISIZ.",
            details: {
              model: normalized.model,
              stream: normalized.stream,
            },
            status: 500,
            retryable: false,
          }),
          500
        );
      }
  
      if (normalized.stream) {
        try {
          return await streamChatResponse(request, normalized, result);
        } catch (streamResponseError) {
          const safeStreamResponseError = sanitizeError(streamResponseError);
          return sendJsonError(
            request,
            errorEnvelope({
              requestId: normalized.requestId,
              traceId: normalized.traceId,
              startedAt: normalized.startedAt,
              code: safeStreamResponseError.code || "STREAM_RESPONSE_FAILED",
              message: safeStreamResponseError.message || "STREAM CEVABI OLUŞTURULAMADI.",
              details: null,
              status: 500,
              retryable: false,
            }),
            500
          );
        }
      }
  
      try {
        const finalResult = normalizeFinalChatResult(result, normalized);
  
        return sendJsonSuccess(
          request,
          successEnvelope({
            requestId: normalized.requestId,
            traceId: normalized.traceId,
            startedAt: normalized.startedAt,
            code: "CHAT_OK",
            data: finalResult,
            meta: {
              model: normalized.model,
              stream: false,
              messageCount: normalized.messages.length,
              toolCount: normalized.tools.length,
            },
          }),
          200
        );
      } catch (finalizeError) {
        const safeFinalizeError = sanitizeError(finalizeError);
        return sendJsonError(
          request,
          errorEnvelope({
            requestId: normalized.requestId,
            traceId: normalized.traceId,
            startedAt: normalized.startedAt,
            code: safeFinalizeError.code || "RESPONSE_BUILD_FAILED",
            message: safeFinalizeError.message || "CHAT CEVABI OLUŞTURULAMADI.",
            details: null,
            status: 500,
            retryable: false,
          }),
          500
        );
      }
    } catch (fatalError) {
      const safeFatalError = sanitizeError(fatalError);
      return sendJsonError(
        request,
        errorEnvelope({
          requestId: outerRequestId,
          traceId: outerTraceId,
          startedAt: outerStartedAt,
          code: safeFatalError.code || "CHAT_FATAL",
          message: safeFatalError.message || "CHAT WORKER KRİTİK HATA VERDİ.",
          details: null,
          status: 500,
          retryable: false,
        }),
        500
      );
    }
  });
  
  /* █████████████████████████████████████████████ */
  
  /*
  CODEX İÇİN SADECE CHAT FRONTEND TALİMATI
  HEPSİNİ DETAYLI UYGULA.
  TÜM KONUŞMA METNİNİ CONVERSATION BÖLÜMÜNDE TÜRKÇE YAZ.
  GEREKİRSE DELILX GİBİ KANITLAYICI YAKLAŞIMLA İLERLE.
  TAHMİN YÜRÜTME.
  ÖNCE KÖK NEDENİ DOĞRULA.
  SONRA EN KÜÇÜK GÜVENLİ DÜZELTMEYİ YAP.
  TEST ETMEDEN BİTTİ DEME.
  
  1. SADECE CHAT SAYFASINA ODAKLAN.
  2. ESKİ `/API/AI/CHAT` HATTINI KALDIR VEYA PASİFLEŞTİR.
  3. CHAT FRONTEND İSTEĞİNİ DOĞRUDAN CHAT WORKER'A YÖNLENDİR.
  4. WORKER URL'İ BU ŞEKİLDE KULLAN:
     `https://chat.puter.work/chat`
     EĞER DEPLOY İSMİ FARKLIYSA SADECE HOST ADINI GÜNCELLE.
  5. FRONTEND ARTIK ŞU REQUEST CONTRACT'I GÖNDERSİN:
  
     {
       "type": "chat.create",
       "id": "CLIENT_TARAFINDA_URETILEN_ID",
       "version": "2026-03-12",
       "timestamp": "ISO_TARIH",
       "payload": {
         "prompt": "KULLANICI_MESAJI",
         "model": "gpt-5-nano",
         "stream": false,
         "temperature": 0.7,
         "maxTokens": 1200
       },
       "meta": {
         "page": "chat",
         "source": "frontend"
       }
     }
  
  6. EĞER STREAM AÇIKSA ŞU CONTRACT'I GÖNDERSİN:
     - `type: "chat.stream"`
     - `payload.stream: true`
     - İSTEK `fetch` İLE AÇILSIN
     - CEVAP `text/event-stream` OLARAK OKUNSUN
     - `ready`, `chunk`, `done`, `error` EVENTLERİ AYRI AYRI YAKALANSIN
  
  7. FRONTEND ARTIK ŞUNLARI VARSAYMASIN:
     - `response.response`
     - `response.text` DOĞRUDAN KÖKTE
     - `response.message` DOĞRUDAN KÖKTE
     DOĞRU OKUMA YOLU ŞUDUR:
     - NON-STREAM İÇİN: `json.data.outputText`
     - STREAM DONE İÇİN: SSE EVENT İÇİNDE `payload.data.outputText`
  
  8. CHAT SAYFASINDA GÖNDER TUŞUNA BASILDIĞINDA ŞU SIRAYI UYGULA:
     - MESAJI TRIM ET
     - BOŞSA İSTEĞİ GÖNDERME
     - GEÇİCİ `requestId` ÜRET
     - KULLANICI MESAJINI HEMEN UI'A EKLE
     - YÜKLENİYOR DURUMU BAŞLAT
     - WORKER'A İSTEĞİ GÖNDER
     - BAŞARILIYSA ASSISTANT MESAJINI `outputText` İLE EKLE
     - HATA VARSA STANDARD ERROR CONTRACT'TAN MESAJ GÖSTER
     - EN SON YÜKLENİYOR DURUMUNU KAPAT
  
  9. HATA OKUMA KURALI:
     - `json.ok === false` İSE
     - HATA MESAJI `json.error.message` ALANINDAN OKUNSUN
     - FALLBACK OLARAK `json.code` GÖSTERİLSİN
     - HAM STACK, TOKEN, COOKIE, RAW SECRET GÖSTERİLMEYECEK
  
  10. CHAT UI İÇİN İKİ AYRI MOD OLUŞTUR:
     - NORMAL MOD: `stream = false`
     - STREAM MOD: `stream = true`
     KULLANICI STREAM İSTEMİYORSA SSE KODU ÇALIŞMASIN.
  
  11. TOOLS DESTEĞİ EKLEMEK İSTERSEN ŞİMDİDEN BODY'DE YER BIRAK:
     - `payload.tools = []`
     AMA İLK AŞAMADA TOOLS UI ZORUNLU DEĞİL.
     ŞİMDİLİK SADECE CONTRACT UYUMLU YER AÇ.
  
  12. `CHAT.TSX` VEYA İLGİLİ SAYFADA ŞU MINIMUM STATE'LERİ KORU:
     - `messages`
     - `input`
     - `isLoading`
     - `error`
     - `isStreaming`
     - `currentRequestId`
  
  13. EĞER STREAM MODU YAPILACAKSA ŞU MANTIĞI UYGULA:
     - `ready` GELİNCE BOŞ ASSISTANT MESAJI OLUŞTUR
     - HER `chunk` EVENTİNDE SON ASSISTANT MESAJININ SONUNA `deltaText` EKLE
     - `done` EVENTİNDE STREAM'İ KAPAT
     - `error` EVENTİNDE HATA GÖSTER VE STREAM'İ KAPAT
  
  14. FRONTEND DOSYASINDA ŞU TÜRLERİ VEYA EŞDEĞERLERİNİ TANIMLA:
     - `ChatWorkerSuccessResponse`
     - `ChatWorkerErrorResponse`
     - `ChatStreamChunkEvent`
     BUNLAR CHAT CONTRACT'INI SABİT TUTAR.
  
  15. NETWORK KATMANINDA AYRI HELPER YAP:
     - `sendChatRequest()`
     - `sendChatStreamRequest()`
     - `parseSseEvent()`
     BÖYLECE SAYFA DOSYASI ŞİŞMEZ.
  
  16. ESKİ BACKEND ENVELOPE'U TAMAMEN TEMİZLE:
     - NESTED `payload` GÖNDERİP DÖNÜŞTE BAŞKA ŞEMA OKUMA YAPMA
     - BU YENİ CHAT WORKER CONTRACT'I TEK KAYNAK OLSUN
  
  17. TEST KURALI:
     - BOŞ INPUT GÖNDERME TESTİ
     - NORMAL CHAT SUCCESS TESTİ
     - NORMAL CHAT ERROR TESTİ
     - STREAM READY TESTİ
     - STREAM CHUNK BİRİKİM TESTİ
     - STREAM DONE TESTİ
     - STREAM ERROR TESTİ
     - UI LOADING RESET TESTİ
  
  18. KABUL KRİTERİ:
     - KULLANICI MESAJI CHAT WORKER'A ULAŞMALI
     - NON-STREAM MODDA `json.data.outputText` UI'DA GÖRÜNMELİ
     - STREAM MODDA `chunk` METİNLERİ UI'DA BİRİKMELİ
     - HATALAR `json.error.message` ÜZERİNDEN GÖSTERİLMELİ
     - ESKİ `/api/ai/chat` BAĞIMLILIĞI KALMAMALI
  
  19. DEĞİŞİKLİK RAPORUNU ŞU SIRAYLA VER:
     1. KISA TEŞHİS
     2. KÖK NEDEN
     3. DEĞİŞEN DOSYALAR
     4. YAPILAN DÜZELTME
     5. TESTLER
     6. SONUÇ
  
  20. GEREKSİZ REFACTOR YAPMA.
  SADECE CHAT HATTINI YENİ CHAT WORKER CONTRACT'INA OTURT.
  IMAGE, TTS, VIDEO, PHOTO-TO-VIDEO DOSYALARINA ŞİMDİ DOKUNMA.
  */
