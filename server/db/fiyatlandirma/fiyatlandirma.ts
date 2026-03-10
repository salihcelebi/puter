import { kv } from '../kv';

const PRICING_KEY = 'settings:pricing';

export interface PricingSettings {
  creditPerUsd: number;
  updatedAt: string;
  updatedBy: string;
}

const DEFAULT_PRICING: PricingSettings = {
  creditPerUsd: 100, // Varsayılan olarak 1 USD = 100 kredi
  updatedAt: new Date().toISOString(),
  updatedBy: 'system'
};

export function getPricingSettings(): PricingSettings {
  const settings = kv.get<PricingSettings>(PRICING_KEY);
  if (!settings) {
    // Eğer henüz ayar yoksa varsayılanı dön ve kaydet
    kv.set(PRICING_KEY, DEFAULT_PRICING);
    return DEFAULT_PRICING;
  }
  return settings;
}

export function updatePricingSettings(creditPerUsd: number, updatedBy: string): PricingSettings {
  const newSettings: PricingSettings = {
    creditPerUsd,
    updatedAt: new Date().toISOString(),
    updatedBy
  };
  kv.set(PRICING_KEY, newSettings);
  return newSettings;
}
