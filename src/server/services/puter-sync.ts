import type {
  AdminRequestGuardInput,
  PricingCatalog,
  PricingRecord,
  SyncOptions,
  SyncResult,
} from "../store/models";
import { scrapeOfficialPuterPricing } from "./pricing";
import { getOrRefreshFxRates, convertFromUsd } from "./fx-rate";

const DEFAULT_CATALOG_KEY = "puter_pricing_catalog_v1";
const DEFAULT_FX_KEY = "puter_fx_rates_v1";

export function assertAdminSecret(input: AdminRequestGuardInput): void {
  if (!input.expectedSecret) {
    throw new Error("Beklenen secret bos olamaz.");
  }
  if (!input.providedSecret || input.providedSecret !== input.expectedSecret) {
    throw new Error("Yetkisiz istek.");
  }
}

export async function readCatalog(
  kv: SyncOptions["kv"],
  catalogKey = DEFAULT_CATALOG_KEY
): Promise<PricingCatalog> {
  const raw = await kv.get(catalogKey);
  if (!raw) {
    return {
      updated_at: null,
      rows: [],
    };
  }

  try {
    return JSON.parse(raw) as PricingCatalog;
  } catch {
    return {
      updated_at: null,
      rows: [],
    };
  }
}

export async function writeCatalog(
  kv: SyncOptions["kv"],
  catalog: PricingCatalog,
  catalogKey = DEFAULT_CATALOG_KEY
): Promise<void> {
  await kv.set(catalogKey, JSON.stringify(catalog));
}

export async function refreshOfficialPuterCatalog(options: SyncOptions): Promise<SyncResult> {
  const catalogKey = options.catalogKey || DEFAULT_CATALOG_KEY;
  const fxKey = options.fxKey || DEFAULT_FX_KEY;

  const scraped = await scrapeOfficialPuterPricing(options.fetchFn, {
    modelsIndexUrl: options.modelsIndexUrl,
    allowedHost: options.allowedHost,
    maxPages: options.maxPages,
    includeIndexPage: options.includeIndexPage,
    now: options.now,
  });

  await getOrRefreshFxRates(options.fetchFn, options.kv, fxKey);

  const catalog: PricingCatalog = {
    updated_at: scraped.updated_at,
    rows: scraped.rows,
  };

  await writeCatalog(options.kv, catalog, catalogKey);

  return {
    ok: true,
    updated_at: scraped.updated_at,
    count: scraped.rows.length,
    rows: scraped.rows,
    pages_scanned: scraped.pages_scanned,
    urls_scanned: scraped.urls_scanned,
  };
}

export async function getCatalogWithTryPrices(
  kv: SyncOptions["kv"],
  targetCurrency: "TRY" | "USD" = "TRY",
  catalogKey = DEFAULT_CATALOG_KEY,
  fxKey = DEFAULT_FX_KEY
): Promise<PricingRecord[]> {
  const catalog = await readCatalog(kv, catalogKey);
  return catalog.rows;
}
