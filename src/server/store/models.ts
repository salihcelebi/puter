export type CurrencyCode = "USD" | "TRY" | "EUR" | string;

export type ServiceType =
  | "LLM / chat"
  | "Image"
  | "Video"
  | "Audio"
  | "OCR"
  | "Unknown";

export interface PricingRecord {
  service_type: ServiceType;
  provider: string;
  model_name: string;
  model_id: string;
  price_display: string;
  input_usd_per_1m_tokens: number | null;
  output_usd_per_1m_tokens: number | null;
  usd_per_image: number | null;
  source_url: string;
  notes: string;
}

export interface PricingCatalog {
  updated_at: string | null;
  rows: PricingRecord[];
}

export interface PricingSourcePage {
  url: string;
  title: string;
  html: string;
  text: string;
}

export interface ParsedPriceHit {
  kind: "input" | "output" | "image" | "video" | "second" | "credits";
  amount: number;
  currency: CurrencyCode;
  unit: string;
  note: string;
}

export interface ScrapeOptions {
  modelsIndexUrl: string;
  allowedHost?: string;
  maxPages?: number;
  includeIndexPage?: boolean;
  now?: Date;
}

export interface ScrapeResult {
  updated_at: string;
  rows: PricingRecord[];
  pages_scanned: number;
  urls_scanned: string[];
}

export interface FxRateMap {
  base: CurrencyCode;
  timestamp: string;
  rates: Record<string, number>;
}

export interface FetchLike {
  (input: string, init?: RequestInit): Promise<Response>;
}

export interface KvAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
}

export interface SyncOptions extends ScrapeOptions {
  fetchFn: FetchLike;
  kv: KvAdapter;
  catalogKey?: string;
  fxKey?: string;
}

export interface SyncResult {
  ok: true;
  updated_at: string;
  count: number;
  rows: PricingRecord[];
  pages_scanned: number;
  urls_scanned: string[];
}

export interface AdminRequestGuardInput {
  providedSecret: string | null;
  expectedSecret: string;
}
