import type { CurrencyCode, FetchLike, FxRateMap, KvAdapter } from "../store/models";

const DEFAULT_FX_KEY = "puter_fx_rates_v1";
const FRANKFURTER_BASE = "https://api.frankfurter.app/latest?from=USD";

function roundMoney(value: number, digits = 6): number {
  return Number(value.toFixed(digits));
}

export function normalizeCurrency(input?: string | null): CurrencyCode {
  const value = String(input || "USD").trim().toUpperCase();
  if (!value) return "USD";
  return value;
}

export async function fetchUsdFxRates(fetchFn: FetchLike): Promise<FxRateMap> {
  const res = await fetchFn(FRANKFURTER_BASE, {
    headers: {
      accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error(`FX API hatasi: ${res.status}`);
  }

  const data = (await res.json()) as {
    amount?: number;
    base?: string;
    date?: string;
    rates?: Record<string, number>;
  };

  const rates = {
    USD: 1,
    ...(data.rates || {}),
  };

  return {
    base: "USD",
    timestamp: data.date ? new Date(`${data.date}T00:00:00Z`).toISOString() : new Date().toISOString(),
    rates,
  };
}

export async function getCachedFxRates(kv: KvAdapter, key = DEFAULT_FX_KEY): Promise<FxRateMap | null> {
  const raw = await kv.get(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as FxRateMap;
  } catch {
    return null;
  }
}

export async function saveFxRates(kv: KvAdapter, rates: FxRateMap, key = DEFAULT_FX_KEY): Promise<void> {
  await kv.set(key, JSON.stringify(rates));
}

export async function getOrRefreshFxRates(fetchFn: FetchLike, kv: KvAdapter, key = DEFAULT_FX_KEY): Promise<FxRateMap> {
  const cached = await getCachedFxRates(kv, key);
  if (cached?.rates?.USD) return cached;

  const fresh = await fetchUsdFxRates(fetchFn);
  await saveFxRates(kv, fresh, key);
  return fresh;
}

export function convertFromUsd(
  usdAmount: number | null,
  targetCurrency: CurrencyCode,
  rates: FxRateMap | null
): number | null {
  if (usdAmount === null) return null;
  const target = normalizeCurrency(targetCurrency);
  if (target === "USD") return roundMoney(usdAmount, 6);
  if (!rates?.rates?.[target]) return null;
  return roundMoney(usdAmount * rates.rates[target], 6);
}
