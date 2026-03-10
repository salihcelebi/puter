import type {
  CurrencyCode,
  FetchLike,
  ParsedPriceHit,
  PricingRecord,
  PricingSourcePage,
  ScrapeOptions,
  ScrapeResult,
  ServiceType,
} from "../store/models";

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<\/(p|div|section|article|li|br|h1|h2|h3|h4|h5|h6)>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{2,}/g, "\n")
    .trim();
}

function titleFromHtml(html: string, fallbackUrl: string): string {
  const h1 = html.match(/<h1[^>]*>(.*?)<\/h1>/i);
  if (h1?.[1]) return stripTags(h1[1]).trim();

  const title = html.match(/<title[^>]*>(.*?)<\/title>/i);
  if (title?.[1]) {
    return stripTags(title[1]).replace(/\s*\|\s*Puter.*$/i, "").trim();
  }

  const slug = fallbackUrl.replace(/\/+$/, "").split("/").pop() || "unknown-model";
  return decodeURIComponent(slug).replace(/-/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

function inferProvider(url: string, text: string): string {
  const lower = `${url} ${text}`.toLowerCase();
  const map: Record<string, string> = {
    "/openai/": "OpenAI",
    "/anthropic/": "Anthropic",
    "/google/": "Google",
    "/xai/": "xAI",
    "/mistral/": "Mistral",
    "/amazon/": "Amazon",
    "/deepseek/": "DeepSeek",
    "/meta/": "Meta",
    "/elevenlabs/": "ElevenLabs",
    "/together/": "Together",
    "/pixverse/": "PixVerse",
    "/vidu/": "Vidu",
    "/stepfun/": "StepFun",
    "/minimax/": "MiniMax",
  };

  for (const [needle, name] of Object.entries(map)) {
    if (lower.includes(needle)) return name;
  }

  const providerWords = [
    "openai",
    "anthropic",
    "google",
    "xai",
    "mistral",
    "amazon",
    "deepseek",
    "meta",
    "elevenlabs",
    "together",
    "pixverse",
    "vidu",
    "stepfun",
    "minimax",
  ];

  const found = providerWords.find(p => lower.includes(p));
  if (!found) return "Puter";

  return found === "xai"
    ? "xAI"
    : found === "stepfun"
      ? "StepFun"
      : found === "minimax"
        ? "MiniMax"
        : found.charAt(0).toUpperCase() + found.slice(1);
}

function inferServiceType(text: string, url: string): ServiceType {
  const lower = `${text} ${url}`.toLowerCase();

  if (lower.includes("speech-to-text") || lower.includes("transcription")) return "Audio";
  if (lower.includes("text-to-speech")) return "Audio";
  if (lower.includes("speech-to-speech")) return "Audio";
  if (lower.includes("ocr")) return "OCR";
  if (lower.includes("video")) return "Video";
  if (lower.includes("image")) return "Image";
  if (lower.includes("audio") || lower.includes("voice")) return "Audio";
  
  // Default to LLM / chat instead of OCR
  return "LLM / chat";
}

function normalizeAmount(amountStr: string): number {
  return Number(String(amountStr).replace(/,/g, "").trim());
}

function findPriceHits(text: string): ParsedPriceHit[] {
  const hits: ParsedPriceHit[] = [];

  const pushUnique = (hit: ParsedPriceHit) => {
    const exists = hits.some(
      x => x.kind === hit.kind && x.amount === hit.amount && x.currency === hit.currency && x.unit === hit.unit
    );
    if (!exists) hits.push(hit);
  };

  const tokenInputPatterns = [
    /\$?\s*(\d+(?:\.\d+)?)\s*\/\s*1m\s*input\s*tokens?/gi,
    /input\s*tokens?\s*[:\-]?\s*\$?\s*(\d+(?:\.\d+)?)/gi,
  ];

  const tokenOutputPatterns = [
    /\$?\s*(\d+(?:\.\d+)?)\s*\/\s*1m\s*output\s*tokens?/gi,
    /output\s*tokens?\s*[:\-]?\s*\$?\s*(\d+(?:\.\d+)?)/gi,
  ];

  const imagePatterns = [/\$?\s*(\d+(?:\.\d+)?)\s*\/\s*image\b/gi, /\$?\s*(\d+(?:\.\d+)?)\s*per\s*image\b/gi];
  const videoPatterns = [/\$?\s*(\d+(?:\.\d+)?)\s*\/\s*video\b/gi, /\$?\s*(\d+(?:\.\d+)?)\s*per\s*video\b/gi];
  const secondPatterns = [/\$?\s*(\d+(?:\.\d+)?)\s*\/\s*second\b/gi, /\$?\s*(\d+(?:\.\d+)?)\s*per\s*second\b/gi];
  const creditPatterns = [
    /(\d+(?:\.\d+)?)\s*credits?\s*\/\s*video/gi,
    /(\d+(?:\.\d+)?)\s*credits?\s*per\s*video/gi,
    /(\d+(?:\.\d+)?)\s*credits?\b/gi,
  ];

  for (const re of tokenInputPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      pushUnique({ kind: "input", amount: normalizeAmount(m[1]), currency: "USD", unit: "1M_INPUT_TOKENS", note: "Birim: 1M input token" });
    }
  }

  for (const re of tokenOutputPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      pushUnique({ kind: "output", amount: normalizeAmount(m[1]), currency: "USD", unit: "1M_OUTPUT_TOKENS", note: "Birim: 1M output token" });
    }
  }

  for (const re of imagePatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      pushUnique({ kind: "image", amount: normalizeAmount(m[1]), currency: "USD", unit: "PER_IMAGE", note: "Birim: gorsel basina" });
    }
  }

  for (const re of videoPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      pushUnique({ kind: "video", amount: normalizeAmount(m[1]), currency: "USD", unit: "PER_VIDEO", note: "Birim: video basina" });
    }
  }

  for (const re of secondPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      pushUnique({ kind: "second", amount: normalizeAmount(m[1]), currency: "USD", unit: "PER_SECOND", note: "Birim: saniye basina" });
    }
  }

  for (const re of creditPatterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      pushUnique({ kind: "credits", amount: normalizeAmount(m[1]), currency: "USD", unit: "CREDITS", note: "Kredi bazli fiyat" });
    }
  }

  return hits;
}

function buildRecordBase(page: PricingSourcePage, nowIso: string): Partial<PricingRecord> {
  const provider = inferProvider(page.url, page.text);
  const model_name = page.title;
  const slug = page.url.replace(/\/+$/, "").split("/").pop() || "unknown";
  const model_id = `${provider.toLowerCase()}/${slug}`;
  
  return {
    provider,
    model_name,
    model_id,
    service_type: inferServiceType(page.text, page.url),
    source_url: page.url,
    notes: "Official Puter source",
  };
}

function pageToRecords(page: PricingSourcePage, nowIso: string): PricingRecord[] {
  const base = buildRecordBase(page, nowIso) as PricingRecord;
  const hits = findPriceHits(page.text);

  const input = hits.find(x => x.kind === "input");
  const output = hits.find(x => x.kind === "output");
  const image = hits.find(x => x.kind === "image");
  const video = hits.find(x => x.kind === "video");
  const second = hits.find(x => x.kind === "second");
  const credits = hits.find(x => x.kind === "credits");

  const row: PricingRecord = {
    ...base,
    input_usd_per_1m_tokens: input?.amount ?? null,
    output_usd_per_1m_tokens: output?.amount ?? null,
    usd_per_image: image?.amount ?? null,
    price_display: "",
  };

  const displays: string[] = [];
  if (input) displays.push(`$${input.amount}/M input`);
  if (output) displays.push(`$${output.amount}/M output`);
  if (image) displays.push(`$${image.amount}/image`);
  if (video) displays.push(`$${video.amount}/video`);
  if (second) displays.push(`$${second.amount}/second`);
  if (credits) displays.push(`${credits.amount} credits`);

  row.price_display = displays.join(" | ") || "No explicit price found";

  return [row];
}

function dedupeRows(rows: PricingRecord[]): PricingRecord[] {
  const map = new Map<string, PricingRecord>();

  for (const row of rows) {
    const key = `${row.provider}::${row.model_id}`;
    const prev = map.get(key);

    if (!prev) {
      map.set(key, row);
      continue;
    }

    const merged = { ...prev };
    if (row.input_usd_per_1m_tokens !== null) merged.input_usd_per_1m_tokens = row.input_usd_per_1m_tokens;
    if (row.output_usd_per_1m_tokens !== null) merged.output_usd_per_1m_tokens = row.output_usd_per_1m_tokens;
    if (row.usd_per_image !== null) merged.usd_per_image = row.usd_per_image;
    
    if (row.price_display !== "No explicit price found") {
      merged.price_display = prev.price_display === "No explicit price found" 
        ? row.price_display 
        : `${prev.price_display} | ${row.price_display}`;
    }

    map.set(key, merged);
  }

  return [...map.values()].sort((a, b) => {
    const p = a.provider.localeCompare(b.provider, "tr");
    if (p !== 0) return p;
    return a.model_name.localeCompare(b.model_name, "tr");
  });
}

function extractLinksFromModelsIndex(indexHtml: string, modelsIndexUrl: string, allowedHost: string): string[] {
  const urls = new Set<string>();
  const re = /href="(\/ai\/[^"#?]+\/)"/gi;
  let m: RegExpExecArray | null;

  while ((m = re.exec(indexHtml)) !== null) {
    const full = new URL(m[1], modelsIndexUrl).toString();
    if (new URL(full).host !== allowedHost) continue;
    urls.add(full);
  }

  return [...urls];
}

async function fetchHtml(fetchFn: FetchLike, url: string): Promise<string> {
  const res = await fetchFn(url, {
    headers: {
      "user-agent": "Mozilla/5.0 PuterPricingSync/1.0",
      accept: "text/html,application/xhtml+xml",
    },
  });

  if (!res.ok) {
    throw new Error(`Sayfa alinamadi: ${res.status} -> ${url}`);
  }

  return await res.text();
}

async function fetchPage(fetchFn: FetchLike, url: string): Promise<PricingSourcePage> {
  const html = await fetchHtml(fetchFn, url);
  return {
    url,
    title: titleFromHtml(html, url),
    html,
    text: stripTags(html),
  };
}

export async function scrapeOfficialPuterPricing(fetchFn: FetchLike, options: ScrapeOptions): Promise<ScrapeResult> {
  const nowIso = (options.now || new Date()).toISOString();
  const maxPages = options.maxPages ?? 200;
  const includeIndexPage = options.includeIndexPage ?? true;
  const allowedHost = options.allowedHost || new URL(options.modelsIndexUrl).host;

  const indexHtml = await fetchHtml(fetchFn, options.modelsIndexUrl);
  const linkedUrls = extractLinksFromModelsIndex(indexHtml, options.modelsIndexUrl, allowedHost);

  const urls = [...(includeIndexPage ? [options.modelsIndexUrl] : []), ...linkedUrls].slice(0, maxPages);

  const pages: PricingSourcePage[] = [];
  for (const url of urls) {
    try {
      pages.push(await fetchPage(fetchFn, url));
    } catch (err) {
      const message = err instanceof Error ? err.message : "Bilinmeyen hata";
      pages.push({
        url,
        title: titleFromHtml("", url),
        html: "",
        text: message,
      });
    }
  }

  const rows = dedupeRows(pages.flatMap(page => pageToRecords(page, nowIso)));

  return {
    updated_at: nowIso,
    rows,
    pages_scanned: pages.length,
    urls_scanned: urls,
  };
}
