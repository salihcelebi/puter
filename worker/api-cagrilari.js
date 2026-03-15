/*
█████████████████████████████████████████████
1) BU DOSYA, TOLERANSLI AI GATEWAY WORKER'IDIR.
2) APP_INFO İÇİNDE worker: "api-cagrilari", version: "2.0.0" VE purpose: "Toleranslı AI gateway worker" TANIMLANMIŞTIR.
3) DOSYANIN AÇIK HEDEFİ, FRONTEND FARKLI FIELD ADLARI GÖNDERSE BİLE İSTEĞİ NORMALE ÇEKMEKTİR.
4) CHAT, IMAGE, TTS, VIDEO VE PHOTO-TO-VIDEO UÇLARI İÇİN TEK BİR GATEWAY DAVRANIŞI SUNAR.
5) DEFAULTS NESNESİ, chatModel, videoProvider, videoModel, videoSeconds VE MAX UZUNLUKLAR GİBİ TEMEL AYARLARI BARINDIRIR.
6) corsHeaders(), JSON CONTENT-TYPE VE CORS BAŞLIKLARINI BİRLİKTE ÜRETİR.
7) ok() VE fail() YARDIMCILARI, TÜM BAŞARILI VE BAŞARISIZ YANITLARI TUTARLI JSON ZARFIYLA DÖNER.
8) safeReadBody(), application/json OLMASA BİLE TEXT BODY'Yİ OKUYUP MÜMKÜNSE JSON'A ÇEVİRMEYE ÇALIŞIR.
9) mergeQueryIntoBody(), QUERY PARAMETRELERİNİ BODY İLE BİRLEŞTİREREK ESNEK İSTEK KABULÜ SAĞLAR.
10) normalizePrompt(), prompt, text, message, content, query, input, description, betimleme GİBİ ÇOK SAYIDA ALIAS'I TEK PROMPT'A DÖNÜŞTÜRÜR.
11) normalizeText(), TTS VE METİN TABANLI İSTEKLER İÇİN BENZER ALIAS NORMALİZASYONU YAPAR.
12) normalizeImageUrl() VE normalizeImageBase64(), imageUrl / image_url / photoUrl / url GİBİ DAĞINIK ALAN ADLARINI TEKLEŞTİRİR.
13) normalizeChatPayload(), CHAT İSTEĞİ İÇİN MODEL, TEMPERATURE, MAX TOKENS VE TOOLS GİBİ DEĞERLERİ DERLER.
14) normalizeImagePayload(), PROMPT, MODEL, QUALITY, RATIO, BOYUT, NEGATIVE PROMPT, INPUT IMAGE, MASK VE TEST MODE GİBİ ALANLARI TOPLAR.
15) normalizeTtsPayload(), TEXT, PROVIDER, MODEL, VOICE, ENGINE VE LANGUAGE BİLGİLERİNİ DÜZENLER.
16) normalizeVideoPayload(), duration / seconds / length KARMAŞASINI TOPARLAYIP TEK seconds ALANINA ÇEVİRİR.
17) normalizePhotoToVideoPayload(), PROMPT VE imageUrl BAŞTA OLMAK ÜZERE FOTOĞRAFTAN VİDEO İSTEĞİNİ YAPISAL HALE GETİRİR.
18) toPositiveNumber() VE toOptionalPositiveNumber(), SAYI ALANLARININ STRING GELMESİ GİBİ HATALARI YUMUŞATIR.
19) clampText(), METİNİ TRAŞLAYIP UZUNLUK SINIRINI KORUR.
20) sanitizeError(), HATA MESAJLARINDAN BEARER TOKEN BENZERİ HASSAS BİLGİLERİ TEMİZLEMEYE ÇALIŞIR.
21) getPuterContext(), user.puter VARSA ONU, YOKSA me.puter BAĞLAMINI KULLANARAK USER_PAYS / OWNER_PAYS MİMARİSİNE UYUM SAĞLAR.
22) getBillingMode(), USER_PAYS İLE OWNER_PAYS MODLARINI AYIRT EDER.
23) validateChatPayload() GİBİ KONTROLLER, BOŞ PROMPT GİBİ HATALARDA TEKNİK PATLAMA YERİNE AÇIK KODLU HATA DÖNMEYİ AMAÇLAR.
24) DOSYANIN AÇILIŞ YORUMUNDA 10'DAN FAZLA ÖNGÖRÜLEN HATA SENARYOSU AÇIKÇA SAYILMIŞTIR; BU DA DOSYANIN “SERT DOĞRULAYICI DEĞİL, TOLERANSLI GEÇİT” OLDUĞUNU GÖSTERİR.
25) KISACA: BU DOSYA, DAĞINIK VE HATALI İSTEMCİ İSTEKLERİNİ NORMALİZE EDİP CHAT / IMAGE / TTS / VIDEO AKIŞLARINA GÜVENLİ ŞEKİLDE AKTARAN MERKEZİ AI GATEWAY WORKER'IDIR.
█████████████████████████████████████████████
*/

const APP_INFO = {
  worker: "api-cagrilari",
  version: "2.0.0",
  purpose: "Toleranslı AI gateway worker",
};

const DEFAULTS = {
  chatModel: "gpt-5-nano",
  imageProvider: undefined,
  imageModel: undefined,
  ttsProvider: undefined,
  ttsModel: undefined,
  videoProvider: "openai",
  videoModel: "sora-2",
  videoSeconds: 4,
  maxPromptLength: 12000,
  maxTextLength: 12000,
};

function nowIso() {
  return new Date().toISOString();
}

function createId(prefix = "id") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function corsHeaders(request) {
  const origin = request.headers.get("origin") || "*";
  return {
    "access-control-allow-origin": origin,
    "access-control-allow-headers": "*",
    "access-control-allow-methods": "GET,POST,OPTIONS",
    "access-control-allow-credentials": "true",
    "content-type": "application/json; charset=utf-8",
  };
}

function json(request, data, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: corsHeaders(request),
  });
}

function ok(request, payload, extra = {}) {
  return json(request, { ok: true, ...extra, ...payload }, 200);
}

function fail(request, code, message, status = 400, details = undefined) {
  return json(
    request,
    {
      ok: false,
      code,
      error: message,
      details: details || null,
      time: nowIso(),
    },
    status
  );
}

function firstNonEmptyString(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function pickString(obj, keys) {
  if (!obj || typeof obj !== "object") return "";
  for (const key of keys) {
    const value = obj[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
}

function pickAny(obj, keys) {
  if (!obj || typeof obj !== "object") return undefined;
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) {
      return obj[key];
    }
  }
  return undefined;
}

function toPositiveNumber(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function toOptionalPositiveNumber(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function clampText(text, maxLen) {
  if (typeof text !== "string") return "";
  return text.trim().slice(0, maxLen);
}

function sanitizeError(error) {
  const message =
    error?.message && typeof error.message === "string"
      ? error.message
      : "İşlem sırasında beklenmeyen bir hata oluştu.";

  return {
    message: message.replace(/bearer\s+[a-z0-9\-_.]+/gi, "bearer [redacted]"),
    stack: undefined,
    code: error?.code || null,
  };
}

function getPuterContext(user) {
  return user?.puter || me.puter;
}

function getBillingMode(user) {
  return user?.puter ? "user_pays" : "owner_pays";
}

async function safeReadBody(request) {
  const contentType = request.headers.get("content-type") || "";
  const cloned = request.clone();

  if (contentType.includes("application/json")) {
    const parsed = await cloned.json().catch(() => null);
    if (parsed && typeof parsed === "object") {
      return parsed;
    }
  }

  if (
    contentType.includes("text/plain") ||
    contentType.includes("application/x-www-form-urlencoded") ||
    !contentType
  ) {
    const rawText = await cloned.text().catch(() => "");
    if (rawText && rawText.trim()) {
      try {
        const maybeJson = JSON.parse(rawText);
        if (maybeJson && typeof maybeJson === "object") {
          return maybeJson;
        }
      } catch {
        return { prompt: rawText.trim(), text: rawText.trim() };
      }
    }
  }

  const fallbackText = await request.clone().text().catch(() => "");
  if (fallbackText && fallbackText.trim()) {
    return { prompt: fallbackText.trim(), text: fallbackText.trim() };
  }

  return {};
}

function mergeQueryIntoBody(request, body) {
  const url = new URL(request.url);
  const merged = { ...(body || {}) };

  for (const [key, value] of url.searchParams.entries()) {
    if (merged[key] === undefined) {
      merged[key] = value;
    }
  }

  return merged;
}

function normalizePrompt(body) {
  return clampText(
    firstNonEmptyString(
      pickString(body, ["prompt", "text", "message", "content", "query", "input"]),
      pickString(body, ["description", "desc", "betimleme", "istem", "mesaj", "soru"])
    ),
    DEFAULTS.maxPromptLength
  );
}

function normalizeText(body) {
  return clampText(
    firstNonEmptyString(
      pickString(body, ["text", "prompt", "message", "content", "input"]),
      pickString(body, ["metin", "yazi", "mesaj", "icerik"])
    ),
    DEFAULTS.maxTextLength
  );
}

function normalizeImageUrl(body) {
  return firstNonEmptyString(
    pickString(body, [
      "imageUrl",
      "image_url",
      "sourceImageUrl",
      "source_image_url",
      "photoUrl",
      "photo_url",
      "url",
    ])
  );
}

function normalizeImageBase64(body) {
  return firstNonEmptyString(
    pickString(body, [
      "image_base64",
      "imageBase64",
      "input_image",
      "inputImage",
      "base64Image",
      "base64_image",
    ])
  );
}

function normalizeChatPayload(body) {
  const prompt = normalizePrompt(body);

  return {
    prompt,
    model: firstNonEmptyString(body.model, body.modelId, DEFAULTS.chatModel) || DEFAULTS.chatModel,
    temperature: body.temperature,
    max_tokens: body.max_tokens ?? body.maxTokens,
    tools: body.tools,
  };
}

function normalizeImagePayload(body) {
  const prompt = normalizePrompt(body);

  return {
    prompt,
    provider: body.provider ?? DEFAULTS.imageProvider,
    model: body.model ?? DEFAULTS.imageModel,
    quality: body.quality,
    ratio: body.ratio,
    width: toOptionalPositiveNumber(body.width),
    height: toOptionalPositiveNumber(body.height),
    aspect_ratio: body.aspect_ratio ?? body.aspectRatio,
    steps: toOptionalPositiveNumber(body.steps),
    seed: body.seed,
    negative_prompt: body.negative_prompt ?? body.negativePrompt,
    n: toOptionalPositiveNumber(body.n),
    image_url: body.image_url ?? body.imageUrl,
    image_base64: body.image_base64 ?? body.imageBase64,
    input_image: normalizeImageBase64(body) || body.input_image,
    input_image_mime_type: body.input_image_mime_type ?? body.inputImageMimeType,
    mask_image_url: body.mask_image_url ?? body.maskImageUrl,
    mask_image_base64: body.mask_image_base64 ?? body.maskImageBase64,
    test_mode: Boolean(body.test_mode ?? body.testMode ?? false),
  };
}

function normalizeTtsPayload(body) {
  const text = normalizeText(body);

  return {
    text,
    provider: body.provider ?? DEFAULTS.ttsProvider,
    model: body.model ?? DEFAULTS.ttsModel,
    voice: body.voice,
    engine: body.engine,
    language: body.language,
  };
}

function normalizeVideoPayload(body) {
  const prompt = normalizePrompt(body);

  return {
    prompt,
    provider: body.provider || DEFAULTS.videoProvider,
    model: body.model || DEFAULTS.videoModel,
    seconds: toPositiveNumber(body.seconds ?? body.duration ?? body.length, DEFAULTS.videoSeconds),
    size: body.size,
    resolution: body.resolution,
    test_mode: Boolean(body.test_mode ?? body.testMode ?? false),
  };
}

function normalizePhotoToVideoPayload(body) {
  const prompt = normalizePrompt(body);
  const imageUrl = normalizeImageUrl(body);

  return {
    prompt,
    imageUrl,
    provider: body.provider || "together",
    model: body.model,
    seconds: toPositiveNumber(body.seconds ?? body.duration ?? body.length, DEFAULTS.videoSeconds),
    width: toOptionalPositiveNumber(body.width),
    height: toOptionalPositiveNumber(body.height),
    fps: toOptionalPositiveNumber(body.fps),
    steps: toOptionalPositiveNumber(body.steps),
    guidance_scale: body.guidance_scale ?? body.guidanceScale,
    seed: body.seed,
    output_format: body.output_format ?? body.outputFormat,
    output_quality: body.output_quality ?? body.outputQuality,
    negative_prompt: body.negative_prompt ?? body.negativePrompt,
    metadata: typeof body.metadata === "object" && body.metadata ? body.metadata : {},
  };
}

function validateChatPayload(request, payload) {
  if (!payload.prompt) {
    return fail(
      request,
      "CHAT_PROMPT_REQUIRED",
      "Sohbet isteği için prompt boş görünüyor. Frontend prompt/text/message/content alanlarından en az birini dolu göndermeli.",
      400,
      { acceptedFields: ["prompt", "text", "message", "content", "query", "input"] }
    );
  }
  return null;
}

function validateImagePayload(request, payload) {
  if (!payload.prompt) {
    return fail(
      request,
      "IMAGE_PROMPT_REQUIRED",
      "Görsel üretimi için prompt boş görünüyor. prompt/text/message/betimleme alanlarından biri dolu olmalı.",
      400,
      { acceptedFields: ["prompt", "text", "message", "content", "description", "betimleme"] }
    );
  }
  return null;
}

function validateTtsPayload(request, payload) {
  if (!payload.text) {
    return fail(
      request,
      "TTS_TEXT_REQUIRED",
      "Ses üretimi için metin boş görünüyor. text/prompt/message/content alanlarından biri dolu olmalı.",
      400,
      { acceptedFields: ["text", "prompt", "message", "content", "input"] }
    );
  }
  return null;
}

function validateVideoPayload(request, payload) {
  if (!payload.prompt) {
    return fail(
      request,
      "VIDEO_PROMPT_REQUIRED",
      "Video üretimi için prompt boş görünüyor. prompt/text/message/betimleme alanlarından biri dolu olmalı.",
      400,
      { acceptedFields: ["prompt", "text", "message", "content", "description", "betimleme"] }
    );
  }
  return null;
}

function validatePhotoToVideoPayload(request, payload) {
  if (!payload.prompt) {
    return fail(
      request,
      "PHOTO_TO_VIDEO_PROMPT_REQUIRED",
      "Fotoğraftan video için prompt boş görünüyor.",
      400,
      { acceptedFields: ["prompt", "text", "message", "content", "description", "betimleme"] }
    );
  }

  if (!payload.imageUrl) {
    return fail(
      request,
      "PHOTO_TO_VIDEO_IMAGE_REQUIRED",
      "Fotoğraftan video için imageUrl eksik görünüyor. imageUrl/sourceImageUrl/photoUrl alanlarından biri dolu olmalı.",
      400,
      { acceptedFields: ["imageUrl", "image_url", "sourceImageUrl", "photoUrl", "url"] }
    );
  }

  return null;
}

function extractChatText(result) {
  if (!result) return "";
  if (typeof result === "string") return result;
  if (typeof result?.text === "string") return result.text;
  if (typeof result?.response === "string") return result.response;
  if (typeof result?.message?.content === "string") return result.message.content;

  if (Array.isArray(result?.message?.content)) {
    return result.message.content
      .map((part) => {
        if (typeof part === "string") return part;
        if (typeof part?.text === "string") return part.text;
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }

  try {
    return JSON.stringify(result);
  } catch {
    return String(result);
  }
}

function extractMediaUrl(media) {
  if (!media) return null;
  if (typeof media === "string") return media;
  if (typeof media?.src === "string" && media.src) return media.src;
  if (typeof media?.currentSrc === "string" && media.currentSrc) return media.currentSrc;
  if (typeof media?.url === "string" && media.url) return media.url;
  if (typeof media?.href === "string" && media.href) return media.href;
  return null;
}

router.options("/*page", ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: corsHeaders(request),
  });
});

router.get("/", async ({ request, user }) => {
  return ok(
    request,
    {
      worker: APP_INFO.worker,
      version: APP_INFO.version,
      purpose: APP_INFO.purpose,
      billingMode: getBillingMode(user),
      routes: [
        "POST /chat",
        "POST /image",
        "POST /tts",
        "POST /video",
        "POST /photo-to-video",
        "POST /photoToVideo",
      ],
    }
  );
});

router.get("/health", async ({ request, user }) => {
  return ok(request, {
    worker: APP_INFO.worker,
    version: APP_INFO.version,
    time: nowIso(),
    billingMode: getBillingMode(user),
  });
});

router.post("/chat", async ({ request, user }) => {
  try {
    const rawBody = mergeQueryIntoBody(request, await safeReadBody(request));
    const payload = normalizeChatPayload(rawBody);
    const validation = validateChatPayload(request, payload);
    if (validation) return validation;

    const puterCtx = getPuterContext(user);
    const result = await puterCtx.ai.chat(payload.prompt, {
      model: payload.model,
      stream: false,
      temperature: payload.temperature,
      max_tokens: payload.max_tokens,
      tools: payload.tools,
    });

    return ok(request, {
      feature: "chat",
      requestId: createId("req"),
      model: payload.model,
      text: extractChatText(result),
      raw: result,
    });
  } catch (error) {
    const safe = sanitizeError(error);
    return fail(
      request,
      safe.code || "CHAT_FAILED",
      safe.message || "Sohbet işlemi başarısız oldu.",
      500
    );
  }
});

router.post("/image", async ({ request, user }) => {
  try {
    const rawBody = mergeQueryIntoBody(request, await safeReadBody(request));
    const payload = normalizeImagePayload(rawBody);
    const validation = validateImagePayload(request, payload);
    if (validation) return validation;

    const puterCtx = getPuterContext(user);
    const image = await puterCtx.ai.txt2img(payload);

    return ok(request, {
      feature: "image",
      requestId: createId("req"),
      imageUrl: extractMediaUrl(image),
      raw: {
        hasSrc: Boolean(image?.src),
        hasCurrentSrc: Boolean(image?.currentSrc),
      },
    });
  } catch (error) {
    const safe = sanitizeError(error);
    return fail(
      request,
      safe.code || "IMAGE_FAILED",
      safe.message || "Görsel üretimi başarısız oldu.",
      500
    );
  }
});

router.post("/tts", async ({ request, user }) => {
  try {
    const rawBody = mergeQueryIntoBody(request, await safeReadBody(request));
    const payload = normalizeTtsPayload(rawBody);
    const validation = validateTtsPayload(request, payload);
    if (validation) return validation;

    const puterCtx = getPuterContext(user);
    const audio = await puterCtx.ai.txt2speech(payload.text, {
      provider: payload.provider,
      model: payload.model,
      voice: payload.voice,
      engine: payload.engine,
      language: payload.language,
    });

    return ok(request, {
      feature: "tts",
      requestId: createId("req"),
      audioUrl: extractMediaUrl(audio),
      raw: {
        hasSrc: Boolean(audio?.src),
        hasCurrentSrc: Boolean(audio?.currentSrc),
      },
    });
  } catch (error) {
    const safe = sanitizeError(error);
    return fail(
      request,
      safe.code || "TTS_FAILED",
      safe.message || "Ses üretimi başarısız oldu.",
      500
    );
  }
});

router.post("/video", async ({ request, user }) => {
  try {
    const rawBody = mergeQueryIntoBody(request, await safeReadBody(request));
    const payload = normalizeVideoPayload(rawBody);
    const validation = validateVideoPayload(request, payload);
    if (validation) return validation;

    const puterCtx = getPuterContext(user);
    const video = await puterCtx.ai.txt2vid({
      prompt: payload.prompt,
      provider: payload.provider,
      model: payload.model,
      seconds: payload.seconds,
      size: payload.size,
      resolution: payload.resolution,
      test_mode: payload.test_mode,
    });

    return ok(request, {
      feature: "video",
      requestId: createId("req"),
      outputUrl: extractMediaUrl(video),
      status: "completed",
    });
  } catch (error) {
    const safe = sanitizeError(error);
    return fail(
      request,
      safe.code || "VIDEO_FAILED",
      safe.message || "Video üretimi başarısız oldu.",
      500
    );
  }
});

async function handlePhotoToVideo({ request, user }) {
  try {
    const rawBody = mergeQueryIntoBody(request, await safeReadBody(request));
    const payload = normalizePhotoToVideoPayload(rawBody);
    const validation = validatePhotoToVideoPayload(request, payload);
    if (validation) return validation;

    const puterCtx = getPuterContext(user);

    const options = {
      prompt: payload.prompt,
      provider: payload.provider,
      model: payload.model,
      seconds: payload.seconds,
      width: payload.width,
      height: payload.height,
      fps: payload.fps,
      steps: payload.steps,
      guidance_scale: payload.guidance_scale,
      seed: payload.seed,
      output_format: payload.output_format,
      output_quality: payload.output_quality,
      negative_prompt: payload.negative_prompt,
      metadata: {
        mode: "photo-to-video",
        sourceImageUrl: payload.imageUrl,
        ...(payload.metadata || {}),
      },
      frame_images: [
        {
          input_image: payload.imageUrl,
          frame: 0,
        },
      ],
    };

    const video = await puterCtx.ai.txt2vid(options);

    return ok(request, {
      feature: "photoToVideo",
      requestId: createId("req"),
      outputUrl: extractMediaUrl(video),
      status: "completed",
    });
  } catch (error) {
    const safe = sanitizeError(error);
    return fail(
      request,
      safe.code || "PHOTO_TO_VIDEO_FAILED",
      safe.message || "Fotoğraftan video üretimi başarısız oldu.",
      500
    );
  }
}

router.post("/photo-to-video", handlePhotoToVideo);
router.post("/photoToVideo", handlePhotoToVideo);
