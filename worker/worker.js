const ADMIN_SECRET = "Sal!hc3l38!";
const STORE_KEY = "puter_pricing_latest_v3";
const FETCH_CONCURRENCY = 6;

router.get("/", async () => {
  return {
    ok: true,
    message: "Puter pricing worker ayakta.",
    endpoints: ["/api/prices", "/api/refresh"]
  };
});

router.get("/api/prices", async () => {
  try {
    const raw = await me.puter.kv.get(STORE_KEY);
    if (!raw) {
      return {
        updated_at: null,
        count: 0,
        rows: []
      };
    }

    let parsed;
    try {
      parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    } catch {
      parsed = { updated_at: null, rows: [] };
    }

    return {
      updated_at: parsed.updated_at || null,
      count: Array.isArray(parsed.rows) ? parsed.rows.length : 0,
      rows: Array.isArray(parsed.rows) ? parsed.rows : []
    };
  } catch (err) {
    return {
      error: err?.message || "GET /api/prices hatası"
    };
  }
});

router.post("/api/refresh", async ({ request }) => {
  try {
    const secret =
      request?.headers?.get("x-admin-secret") ||
      request?.headers?.get("X-Admin-Secret") ||
      "";

    if (secret !== ADMIN_SECRET) {
      return {
        error: "Yetkisiz işlem"
      };
    }

    const modelUrls = await discoverModelUrls();
    const rows = await scrapeAllModels(modelUrls);
    const deduped = dedupeRows(rows);

    const payload = {
      updated_at: new Date().toISOString(),
      count: deduped.length,
      rows: deduped
    };

    await me.puter.kv.set(STORE_KEY, JSON.stringify(payload));

    return {
      ok: true,
      updated_at: payload.updated_at,
      count: deduped.length
    };
  } catch (err) {
    return {
      error: err?.message || "POST /api/refresh hatası"
    };
  }
});

async function discoverModelUrls() {
  const candidates = new Set();

  const sources = [
    "https://developer.puter.com/sitemap.xml",
    "https://developer.puter.com/ai"
  ];

  for (const source of sources) {
    try {
      const res = await fetch(source, {
        headers: { "user-agent": "Mozilla/5.0 PricingBot/1.0" }
      });
      if (!res.ok) continue;

      const text = await res.text();

      for (const match of text.matchAll(/https:\/\/developer\.puter\.com\/ai\/[A-Za-z0-9._\-]+\/[A-Za-z0-9._\-:]+/g)) {
        candidates.add(match[0]);
      }

      for (const match of text.matchAll(/href=["'](\/ai\/[A-Za-z0-9._\-]+\/[A-Za-z0-9._\-:]+)["']/g)) {
        candidates.add(`https://developer.puter.com${match[1]}`);
      }
    } catch (_) {}
  }

  const out = [...candidates]
    .filter(url => !url.endsWith("/ai"))
    .filter(url => !/\/ai\/?$/.test(url))
    .sort((a, b) => a.localeCompare(b));

  if (out.length) return out;

  return [
    "https://developer.puter.com/ai/openai/gpt-4o",
    "https://developer.puter.com/ai/openai/gpt-image-1",
    "https://developer.puter.com/ai/google/imagen-4.0-fast",
    "https://developer.puter.com/ai/google/veo-3.0",
    "https://developer.puter.com/ai/anthropic/claude-sonnet-4"
  ];
}

async function scrapeAllModels(urls) {
  const results = [];
  const queue = [...urls];

  const workers = Array.from({ length: FETCH_CONCURRENCY }, async () => {
    while (queue.length) {
      const nextUrl = queue.shift();
      if (!nextUrl) break;

      try {
        const row = await scrapeOneModel(nextUrl);
        if (row) results.push(row);
      } catch (error) {
        results.push(makeErrorRow(nextUrl, error));
      }
    }
  });

  await Promise.all(workers);
  return results;
}

async function scrapeOneModel(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "Mozilla/5.0 PricingBot/1.0" }
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}`);
  }

  const html = await res.text();
  const pageText = htmlToText(html);
  const flat = flattenText(pageText);
  const cardText = cropToModelCard(pageText);
  const flatCard = flattenText(cardText);

  const provider = inferProviderFromUrl(url);
  const modelId = inferModelIdFromUrl(url);
  const modelName = firstNonEmpty(extractTitle(html), inferModelNameFromUrl(url));
  const serviceType = inferServiceType(url, flatCard);

  const releaseDate = extractFieldValue(cardText, ["Release Date", "Released"]);
  const contextWindow = extractFieldValue(cardText, ["Context Window", "Context"]);
  const maxOutput = extractFieldValue(cardText, ["Max Output", "Output Tokens", "Max Tokens"]);

  const inputPriceText =
    extractLabeledPrice(flatCard, ["Input Cost", "Input", "Input/M Tokens"]) ||
    extractTokenSidePrice(flatCard, "input");

  const outputPriceText =
    extractLabeledPrice(flatCard, ["Output Cost", "Output", "Output/M Tokens"]) ||
    extractTokenSidePrice(flatCard, "output");

  const imagePriceText = extractImagePrice(flatCard);
  const videoPriceText = extractVideoPrice(flatCard);

  const imageConfig = extractFieldValue(flatCard, ["Configuration", "Resolution", "Image Resolution"]);
  const duration = extractFieldValue(flatCard, ["Duration", "Video Duration"]);
  const resolution = extractFieldValue(flatCard, ["Resolution", "Output Resolution"]);
  const creditsHint = extractCredits(flatCard);

  return normalizeRow({
    provider,
    model_name: modelName,
    model_id: modelId,
    service_type: serviceType,
    input_price: moneyFromValue(inputPriceText),
    output_price: moneyFromValue(outputPriceText),
    image_price: moneyFromValue(imagePriceText),
    video_price: moneyFromValue(videoPriceText),
    context_window: normalizeLooseValue(contextWindow),
    max_output: normalizeLooseValue(maxOutput),
    release_date: normalizeLooseValue(releaseDate),
    source_url: url,
    price_note: buildNotes({
      serviceType,
      inputPriceText,
      outputPriceText,
      imagePriceText,
      videoPriceText,
      imageConfig,
      duration,
      resolution,
      creditsHint,
      fallbackText: flat
    }),
    currency: "USD",
    updated_at: new Date().toISOString()
  });
}

function inferServiceType(url, text) {
  const source = `${url} ${text}`.toLowerCase();

  if (
    /\bcost\s+per\s+image\b/.test(source) ||
    /\bprice\s+per\s+image\b/.test(source) ||
    /\bper\s+generation\b/.test(source) ||
    /\bimage generation\b/.test(source) ||
    /\b1mp\b/.test(source) ||
    /\bimagen\b/.test(source) ||
    /\bgpt-image\b/.test(source)
  ) {
    return "image";
  }

  if (
    /\bcost\s+per\s+video\b/.test(source) ||
    /\bprice\s+per\s+video\b/.test(source) ||
    /\bper\s+video\b/.test(source) ||
    /\bvideo generation\b/.test(source) ||
    /\bduration\b/.test(source) ||
    /\btxt2vid\b/.test(source) ||
    /\bveo\b/.test(source) ||
    /\bkling\b/.test(source) ||
    /\bhailuo\b/.test(source)
  ) {
    return "video";
  }

  return "llm";
}

function extractImagePrice(text) {
  const patterns = [
    /\bCost\s+Per\s+Image\s+\$([0-9]+(?:[.,][0-9]+)?)\b/i,
    /\bPrice\s+Per\s+Image\s+\$([0-9]+(?:[.,][0-9]+)?)\b/i,
    /\$([0-9]+(?:[.,][0-9]+)?)\s+per\s+generation\b/i,
    /\$([0-9]+(?:[.,][0-9]+)?)\s+per\s+image\b/i
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match) return `$${match[1]}`;
  }

  return null;
}

function extractVideoPrice(text) {
  const patterns = [
    /\bCost\s+Per\s+Video\s+\$([0-9]+(?:[.,][0-9]+)?)\b/i,
    /\bPrice\s+Per\s+Video\s+\$([0-9]+(?:[.,][0-9]+)?)\b/i,
    /\$([0-9]+(?:[.,][0-9]+)?)\s+per\s+video\b/i,
    /\bCost\s+Per\s+Request\s+\$([0-9]+(?:[.,][0-9]+)?)\b/i
  ];

  for (const re of patterns) {
    const match = text.match(re);
    if (match) return `$${match[1]}`;
  }

  return null;
}

function extractLabeledPrice(text, labels) {
  for (const label of labels) {
    const escaped = escapeRegex(label);
    const re = new RegExp(`${escaped}\\s*[:\\-]?\\s*(\\$\\s*[0-9]+(?:[.,][0-9]+)?)`, "i");
    const match = text.match(re);
    if (match) return match[1];
  }
  return null;
}

function extractTokenSidePrice(text, side) {
  const map = {
    input: /\b(?:input(?:\s+cost)?|input\/m(?:illion)?\s+tokens?)\b[^$]{0,30}(\$\s*[0-9]+(?:[.,][0-9]+)?)/i,
    output: /\b(?:output(?:\s+cost)?|output\/m(?:illion)?\s+tokens?)\b[^$]{0,30}(\$\s*[0-9]+(?:[.,][0-9]+)?)/i
  };
  const match = text.match(map[side]);
  return match ? match[1] : null;
}

function extractFieldValue(text, labels) {
  for (const label of labels) {
    const escaped = escapeRegex(label);
    const re = new RegExp(`${escaped}\\s*[:\\-]?\\s*([^\\n]+)`, "i");
    const match = text.match(re);
    if (match) {
      const value = match[1]
        .replace(/\s{2,}/g, " ")
        .replace(/\b(?:Model Card|API Usage Example|Get started with Puter\.js)\b.*$/i, "")
        .trim();
      if (value) return value;
    }
  }
  return null;
}

function extractCredits(text) {
  const match = text.match(/\b([0-9]+(?:[.,][0-9]+)?)\s+credits?\b/i);
  return match ? `${match[1]} credits` : null;
}

function buildNotes({
  serviceType,
  inputPriceText,
  outputPriceText,
  imagePriceText,
  videoPriceText,
  imageConfig,
  duration,
  resolution,
  creditsHint,
  fallbackText
}) {
  const notes = [];

  if (serviceType === "llm") {
    if (inputPriceText) notes.push(`Input: ${normalizeInline(inputPriceText)}`);
    if (outputPriceText) notes.push(`Output: ${normalizeInline(outputPriceText)}`);
  }

  if (serviceType === "image") {
    if (imagePriceText) notes.push(`Image: ${normalizeInline(imagePriceText)}`);
    if (imageConfig) notes.push(`Config: ${normalizeInline(imageConfig)}`);
  }

  if (serviceType === "video") {
    if (videoPriceText) {
      notes.push(`Video: ${normalizeInline(videoPriceText)}`);
    } else {
      notes.push("Video fiyatı sabit dolar etiketiyle bulunamadı");
      notes.push("Model + duration + resolution bazlı değişken olabilir");
    }
    if (duration) notes.push(`Duration: ${normalizeInline(duration)}`);
    if (resolution) notes.push(`Resolution: ${normalizeInline(resolution)}`);
    if (creditsHint) notes.push(`Credits: ${normalizeInline(creditsHint)}`);
  }

  if (!notes.length) {
    const hint = fallbackText.slice(0, 180).trim();
    if (hint) notes.push(hint);
  }

  return notes.join(" | ") || null;
}

function cropToModelCard(text) {
  let out = String(text || "");
  const start = out.search(/\bModel Card\b/i);
  if (start >= 0) out = out.slice(start);

  const stops = [
    /\bAPI Usage Example\b/i,
    /\bGet started with Puter\.js\b/i,
    /\bFrequently Asked Questions\b/i
  ];

  for (const stop of stops) {
    const idx = out.search(stop);
    if (idx >= 0) out = out.slice(0, idx);
  }

  return out.trim();
}

function htmlToText(html) {
  return String(html || "")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|li|ul|ol|h1|h2|h3|h4|h5|h6|tr|table|header|footer|main)>/gi, "\n")
    .replace(/<(td|th)[^>]*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x27;/g, "'")
    .replace(/&#x2F;/g, "/")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function flattenText(text) {
  return String(text || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/\n+/g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function extractTitle(html) {
  const h1 = String(html || "").match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  if (h1) return cleanInlineText(h1[1]);

  const title = String(html || "").match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (title) {
    return cleanInlineText(title[1]).replace(/\s*\|\s*Puter.*$/i, "").trim();
  }

  return "";
}

function cleanInlineText(s) {
  return String(s || "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t\n\r]+/g, " ")
    .trim();
}

function normalizeInline(s) {
  return String(s || "").replace(/\s{2,}/g, " ").trim();
}

function inferProviderFromUrl(url) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  return humanizeSlug(parts[1] || "puter");
}

function inferModelIdFromUrl(url) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  return parts.length >= 3 ? `${parts[1]}/${parts[2]}` : parts[parts.length - 1] || "unknown-model";
}

function inferModelNameFromUrl(url) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  return humanizeSlug(parts[parts.length - 1] || "unknown-model");
}

function humanizeSlug(slug) {
  return String(slug || "")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function normalizeLooseValue(value) {
  const v = String(value || "").trim();
  return v || null;
}

function moneyFromValue(value) {
  if (!value) return null;
  const match = String(value).match(/\$\s*([0-9]+(?:[.,][0-9]+)?)/);
  if (!match) return null;
  const num = Number(String(match[1]).replace(/,/g, "."));
  return Number.isFinite(num) ? num : null;
}

function firstNonEmpty(...values) {
  for (const value of values) {
    if (value !== null && value !== undefined && String(value).trim() !== "") return value;
  }
  return null;
}

function normalizeRow(row) {
  const modelName = row?.model_name || row?.model || null;
  const modelId = row?.model_id || null;
  return {
    service_type: row?.service_type || "llm",
    provider: row?.provider || null,
    model_name: modelName,
    model: modelName,
    model_id: modelId,
    input_price: numberOrNull(row?.input_price),
    output_price: numberOrNull(row?.output_price),
    image_price: numberOrNull(row?.image_price),
    video_price: numberOrNull(row?.video_price),
    context_window: row?.context_window || null,
    max_output: row?.max_output || null,
    release_date: row?.release_date || null,
    source_url: row?.source_url || null,
    price_note: row?.price_note || null,
    currency: row?.currency || "USD",
    updated_at: row?.updated_at || null
  };
}

function numberOrNull(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function dedupeRows(rows) {
  const map = new Map();

  for (const raw of rows) {
    const row = normalizeRow(raw);
    const key = `${row.model_id || row.model || "unknown"}::${row.service_type || "llm"}`;
    const prev = map.get(key);

    if (!prev || scoreRow(row) > scoreRow(prev)) {
      map.set(key, row);
    }
  }

  return [...map.values()].sort((a, b) => {
    const p = String(a.provider || "").localeCompare(String(b.provider || ""));
    if (p !== 0) return p;
    return String(a.model || "").localeCompare(String(b.model || ""));
  });
}

function scoreRow(row) {
  let score = 0;
  if (row.input_price !== null) score += 4;
  if (row.output_price !== null) score += 4;
  if (row.image_price !== null) score += 4;
  if (row.video_price !== null) score += 4;
  if (row.release_date) score += 1;
  if (row.context_window) score += 1;
  if (row.max_output) score += 1;
  if (row.price_note) score += 1;
  return score;
}

function makeErrorRow(url, reason) {
  return normalizeRow({
    provider: inferProviderFromUrl(url),
    service_type: "llm",
    model_name: inferModelNameFromUrl(url),
    model_id: inferModelIdFromUrl(url),
    input_price: null,
    output_price: null,
    image_price: null,
    video_price: null,
    source_url: url,
    price_note: `Sayfa okunamadı: ${reason?.message || "bilinmeyen hata"}`,
    currency: "USD",
    updated_at: new Date().toISOString()
  });
}

function escapeRegex(s) {
  return String(s || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}