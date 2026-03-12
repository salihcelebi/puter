import { getPricingSettings } from '../db/fiyatlandirma/fiyatlandirma.js';

function resolveCreditPerUsd() {
  const raw = getPricingSettings() as any;
  const value = Number(raw?.creditPerUsd);
  return Number.isFinite(value) && value > 0 ? value : 100;
}

export function calculateCreditFromUsd(usd: number | null, marginMultiplier = 1) {
  if (usd === null || usd === undefined) return null;
  const creditPerUsd = resolveCreditPerUsd();
  return Math.ceil(Number(usd) * Number(marginMultiplier || 1) * creditPerUsd);
}

export function calculateSaleCredits(inputUsd: number | null, outputUsd: number | null, singleUsd: number | null, marginMultiplier = 1) {
  return {
    sale_credit_input: calculateCreditFromUsd(inputUsd, marginMultiplier),
    sale_credit_output: calculateCreditFromUsd(outputUsd, marginMultiplier),
    sale_credit_single: calculateCreditFromUsd(singleUsd, marginMultiplier),
  };
}
