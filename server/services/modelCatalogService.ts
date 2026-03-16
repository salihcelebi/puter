import { kv } from '../db/kv.js';
import { MODEL_PRICES, USD_TRY_RATE_KEY, type ModelPrice } from '../db/modeller.js';
import { calculateSaleCredits } from './pricingService.js';

type SortBy = 'name' | 'provider' | 'type' | 'inputCost' | 'outputCost' | 'usage' | 'profit';
type SortDir = 'asc' | 'desc';

export type ModelRecord = {
  id: string;
  provider_name: string;
  model_name: string;
  service_type: string;
  billing_unit: string;
  raw_cost_input_usd: number | null;
  raw_cost_output_usd: number | null;
  raw_cost_single_usd: number | null;
  usd_try_rate: number;
  raw_cost_input_try: number | null;
  raw_cost_output_try: number | null;
  raw_cost_single_try: number | null;
  sale_credit_input: number | null;
  sale_credit_output: number | null;
  sale_credit_single: number | null;
  margin_multiplier: number;
  is_active: boolean;
  is_favorite: boolean;
  metadata_json: any;
  usage_count: number;
  revenue_try: number;
  cost_try: number;
  profit_try: number;
  admin_override_pricing: boolean;
  created_at: string;
  updated_at: string;
  profit_multiplier?: number;
  sale_cost_input_usd?: number | null;
  sale_cost_output_usd?: number | null;
  sale_cost_single_usd?: number | null;
  sale_cost_input_try?: number | null;
  sale_cost_output_try?: number | null;
  sale_cost_single_try?: number | null;
};

function mapServiceType(seedType: string, modelName: string) {
  const rawType = (seedType || '').toLowerCase();
  const name = (modelName || '').toLowerCase();
  if (rawType.includes('image')) return 'image';
  if (rawType.includes('video')) return name.includes('image') || name.includes('photo') ? 'image_to_video' : 'video';
  if (rawType.includes('audio') || rawType.includes('tts') || name.includes('tts') || name.includes('speech')) return 'tts';
  if (rawType.includes('music') || name.includes('music')) return 'music';
  return 'chat';
}

function toNumberOrNull(value: any) {
  return typeof value === 'number' ? value : null;
}

function normalizeModel(model: any): ModelRecord {
  const margin = Number(model.margin_multiplier ?? model.profit_multiplier ?? 1) || 1;
  const usdTry = Number(model.usd_try_rate ?? 0) || 0;
  return {
    id: model.id,
    provider_name: model.provider_name,
    model_name: model.model_name,
    service_type: model.service_type,
    billing_unit: model.billing_unit || '',
    raw_cost_input_usd: toNumberOrNull(model.raw_cost_input_usd),
    raw_cost_output_usd: toNumberOrNull(model.raw_cost_output_usd),
    raw_cost_single_usd: toNumberOrNull(model.raw_cost_single_usd),
    usd_try_rate: usdTry,
    raw_cost_input_try: toNumberOrNull(model.raw_cost_input_try),
    raw_cost_output_try: toNumberOrNull(model.raw_cost_output_try),
    raw_cost_single_try: toNumberOrNull(model.raw_cost_single_try),
    sale_credit_input: toNumberOrNull(model.sale_credit_input),
    sale_credit_output: toNumberOrNull(model.sale_credit_output),
    sale_credit_single: toNumberOrNull(model.sale_credit_single),
    margin_multiplier: margin,
    is_active: model.is_active ?? true,
    is_favorite: model.is_favorite ?? false,
    metadata_json: model.metadata_json || {},
    usage_count: Number(model.usage_count || 0),
    revenue_try: Number(model.revenue_try || 0),
    cost_try: Number(model.cost_try || 0),
    profit_try: Number(model.profit_try || 0),
    admin_override_pricing: Boolean(model.admin_override_pricing),
    created_at: model.created_at || new Date().toISOString(),
    updated_at: model.updated_at || new Date().toISOString(),
    profit_multiplier: margin,
    sale_cost_input_usd: toNumberOrNull(model.sale_cost_input_usd),
    sale_cost_output_usd: toNumberOrNull(model.sale_cost_output_usd),
    sale_cost_single_usd: toNumberOrNull(model.sale_cost_single_usd),
    sale_cost_input_try: toNumberOrNull(model.sale_cost_input_try),
    sale_cost_output_try: toNumberOrNull(model.sale_cost_output_try),
    sale_cost_single_try: toNumberOrNull(model.sale_cost_single_try),
  };
}

function buildSeedRecord(seed: ModelPrice, rate: number, now: string): ModelRecord {
  const isTokens = seed.billingType === 'tokens';
  const inputUsd = isTokens ? (seed.inputUsdPer1M ?? null) : null;
  const outputUsd = isTokens ? (seed.outputUsdPer1M ?? null) : null;
  const singleUsd = isTokens ? null : (seed.usdPerImage ?? null);
  const margin = 1;
  const saleCredits = calculateSaleCredits(inputUsd, outputUsd, singleUsd, margin);

  return normalizeModel({
    id: seed.modelId.replace(/[^a-zA-Z0-9_-]/g, '_'),
    provider_name: seed.provider,
    model_name: seed.modelName,
    service_type: mapServiceType(seed.serviceType, seed.modelName),
    billing_unit: isTokens ? '1M tokens' : '1 image',
    raw_cost_input_usd: inputUsd,
    raw_cost_output_usd: outputUsd,
    raw_cost_single_usd: singleUsd,
    usd_try_rate: rate,
    raw_cost_input_try: inputUsd !== null ? Number((inputUsd * rate).toFixed(4)) : null,
    raw_cost_output_try: outputUsd !== null ? Number((outputUsd * rate).toFixed(4)) : null,
    raw_cost_single_try: singleUsd !== null ? Number((singleUsd * rate).toFixed(4)) : null,
    sale_cost_input_usd: inputUsd !== null ? Number((inputUsd * margin).toFixed(4)) : null,
    sale_cost_output_usd: outputUsd !== null ? Number((outputUsd * margin).toFixed(4)) : null,
    sale_cost_single_usd: singleUsd !== null ? Number((singleUsd * margin).toFixed(4)) : null,
    sale_cost_input_try: inputUsd !== null ? Number((inputUsd * margin * rate).toFixed(4)) : null,
    sale_cost_output_try: outputUsd !== null ? Number((outputUsd * margin * rate).toFixed(4)) : null,
    sale_cost_single_try: singleUsd !== null ? Number((singleUsd * margin * rate).toFixed(4)) : null,
    ...saleCredits,
    margin_multiplier: margin,
    is_active: true,
    is_favorite: false,
    admin_override_pricing: false,
    usage_count: 0,
    revenue_try: 0,
    cost_try: 0,
    profit_try: 0,
    metadata_json: seed,
    created_at: now,
    updated_at: now,
  });
}

function mergeSeed(existing: ModelRecord, seeded: ModelRecord, now: string): ModelRecord {
  const margin = Number(existing.margin_multiplier ?? existing.profit_multiplier ?? 1) || 1;
  const sourceUsdInput = existing.admin_override_pricing ? existing.raw_cost_input_usd : seeded.raw_cost_input_usd;
  const sourceUsdOutput = existing.admin_override_pricing ? existing.raw_cost_output_usd : seeded.raw_cost_output_usd;
  const sourceUsdSingle = existing.admin_override_pricing ? existing.raw_cost_single_usd : seeded.raw_cost_single_usd;
  const saleCredits = calculateSaleCredits(sourceUsdInput, sourceUsdOutput, sourceUsdSingle, margin);

  return normalizeModel({
    ...seeded,
    ...existing,
    provider_name: seeded.provider_name,
    model_name: seeded.model_name,
    service_type: seeded.service_type,
    billing_unit: seeded.billing_unit,
    raw_cost_input_usd: sourceUsdInput,
    raw_cost_output_usd: sourceUsdOutput,
    raw_cost_single_usd: sourceUsdSingle,
    usd_try_rate: seeded.usd_try_rate,
    raw_cost_input_try: sourceUsdInput !== null ? Number((sourceUsdInput * seeded.usd_try_rate).toFixed(4)) : null,
    raw_cost_output_try: sourceUsdOutput !== null ? Number((sourceUsdOutput * seeded.usd_try_rate).toFixed(4)) : null,
    raw_cost_single_try: sourceUsdSingle !== null ? Number((sourceUsdSingle * seeded.usd_try_rate).toFixed(4)) : null,
    sale_cost_input_usd: sourceUsdInput !== null ? Number((sourceUsdInput * margin).toFixed(4)) : null,
    sale_cost_output_usd: sourceUsdOutput !== null ? Number((sourceUsdOutput * margin).toFixed(4)) : null,
    sale_cost_single_usd: sourceUsdSingle !== null ? Number((sourceUsdSingle * margin).toFixed(4)) : null,
    sale_cost_input_try: sourceUsdInput !== null ? Number((sourceUsdInput * margin * seeded.usd_try_rate).toFixed(4)) : null,
    sale_cost_output_try: sourceUsdOutput !== null ? Number((sourceUsdOutput * margin * seeded.usd_try_rate).toFixed(4)) : null,
    sale_cost_single_try: sourceUsdSingle !== null ? Number((sourceUsdSingle * margin * seeded.usd_try_rate).toFixed(4)) : null,
    ...saleCredits,
    margin_multiplier: margin,
    profit_multiplier: margin,
    is_active: existing.is_active ?? true,
    is_favorite: existing.is_favorite ?? false,
    metadata_json: {
      ...(seeded.metadata_json || {}),
      ...(existing.metadata_json || {}),
    },
    usage_count: existing.usage_count ?? 0,
    revenue_try: existing.revenue_try ?? 0,
    cost_try: existing.cost_try ?? 0,
    profit_try: existing.profit_try ?? 0,
    created_at: existing.created_at || now,
    updated_at: now,
  });
}

export const modelCatalogService = {
  // Part 2.5: preserve admin overrides while merging seed catalog.
  async ensureSeedMerged() {
    const rate = (await kv.get(USD_TRY_RATE_KEY)) || 50.0;
    const now = new Date().toISOString();
    const models = await kv.list('model:');
    const map = new Map(models.map((m) => [m.key.replace('model:', ''), normalizeModel(m.value)]));

    for (const seed of MODEL_PRICES) {
      const id = seed.modelId.replace(/[^a-zA-Z0-9_-]/g, '_');
      const seeded = buildSeedRecord(seed, rate, now);
      const existing = map.get(id);
      const merged = existing ? mergeSeed(existing, seeded, now) : seeded;
      await kv.set(`model:${id}`, merged);
      map.set(id, merged);
    }
  },

  async listModels(query: any = {}) {
    await this.ensureSeedMerged();
    const models = (await kv.list('model:')).map((m) => normalizeModel(m.value));
    let rows = models;

    if (query.tab === 'active') rows = rows.filter((m) => m.is_active);
    if (query.tab === 'inactive') rows = rows.filter((m) => !m.is_active);
    if (query.tab === 'favorites') rows = rows.filter((m) => m.is_favorite);

    if (query.provider) rows = rows.filter((m) => m.provider_name.toLowerCase().includes(String(query.provider).toLowerCase()));
    if (query.modelName) rows = rows.filter((m) => m.model_name.toLowerCase().includes(String(query.modelName).toLowerCase()));
    if (query.serviceType) rows = rows.filter((m) => m.service_type === query.serviceType);

    const minIn = query.minInputCost ? Number(query.minInputCost) : null;
    const maxIn = query.maxInputCost ? Number(query.maxInputCost) : null;
    const minOut = query.minOutputCost ? Number(query.minOutputCost) : null;
    const maxOut = query.maxOutputCost ? Number(query.maxOutputCost) : null;
    if (minIn !== null) rows = rows.filter((m) => (m.raw_cost_input_try ?? m.raw_cost_single_try ?? 0) >= minIn);
    if (maxIn !== null) rows = rows.filter((m) => (m.raw_cost_input_try ?? m.raw_cost_single_try ?? 0) <= maxIn);
    if (minOut !== null) rows = rows.filter((m) => (m.raw_cost_output_try ?? 0) >= minOut);
    if (maxOut !== null) rows = rows.filter((m) => (m.raw_cost_output_try ?? 0) <= maxOut);

    const sortBy = (query.sortBy || 'name') as SortBy;
    const sortDir = (query.sortDir || 'asc') as SortDir;
    const sign = sortDir === 'desc' ? -1 : 1;

    rows = rows.sort((a, b) => {
      const by: Record<SortBy, number> = {
        name: a.model_name.localeCompare(b.model_name),
        provider: a.provider_name.localeCompare(b.provider_name),
        type: a.service_type.localeCompare(b.service_type),
        inputCost: (a.raw_cost_input_try ?? a.raw_cost_single_try ?? 0) - (b.raw_cost_input_try ?? b.raw_cost_single_try ?? 0),
        outputCost: (a.raw_cost_output_try ?? 0) - (b.raw_cost_output_try ?? 0),
        usage: (a.usage_count ?? 0) - (b.usage_count ?? 0),
        profit: (a.profit_try ?? 0) - (b.profit_try ?? 0),
      };
      return by[sortBy] * sign;
    });

    return rows;
  },

  async updateModel(id: string, updates: Partial<ModelRecord>) {
    const existing = await kv.get(`model:${id}`);
    if (!existing) return null;
    const now = new Date().toISOString();
    const normalized = normalizeModel(existing);
    const margin = Number(updates.margin_multiplier ?? updates.profit_multiplier ?? normalized.margin_multiplier ?? 1) || 1;

    const merged = normalizeModel({
      ...normalized,
      ...updates,
      margin_multiplier: margin,
      profit_multiplier: margin,
      admin_override_pricing: updates.admin_override_pricing ?? normalized.admin_override_pricing,
      updated_at: now,
    });

    const saleCredits = calculateSaleCredits(merged.raw_cost_input_usd, merged.raw_cost_output_usd, merged.raw_cost_single_usd, margin);
    const finalModel = normalizeModel({
      ...merged,
      ...saleCredits,
      sale_cost_input_usd: merged.raw_cost_input_usd !== null ? Number((merged.raw_cost_input_usd * margin).toFixed(4)) : null,
      sale_cost_output_usd: merged.raw_cost_output_usd !== null ? Number((merged.raw_cost_output_usd * margin).toFixed(4)) : null,
      sale_cost_single_usd: merged.raw_cost_single_usd !== null ? Number((merged.raw_cost_single_usd * margin).toFixed(4)) : null,
      sale_cost_input_try: merged.raw_cost_input_usd !== null ? Number((merged.raw_cost_input_usd * margin * merged.usd_try_rate).toFixed(4)) : null,
      sale_cost_output_try: merged.raw_cost_output_usd !== null ? Number((merged.raw_cost_output_usd * margin * merged.usd_try_rate).toFixed(4)) : null,
      sale_cost_single_try: merged.raw_cost_single_usd !== null ? Number((merged.raw_cost_single_usd * margin * merged.usd_try_rate).toFixed(4)) : null,
    });

    await kv.set(`model:${id}`, finalModel);
    return finalModel;
  },

  async bulkUpdate(ids: string[], updates: Partial<ModelRecord>) {
    const updated: ModelRecord[] = [];
    for (const id of ids) {
      const model = await this.updateModel(id, updates);
      if (model) updated.push(model);
    }
    return updated;
  },

  async getUsageStats() {
    type UsageStat = {
      model_id: string;
      model_name: string;
      provider_name: string;
      service_type: string;
      usage_count: number;
      total_revenue_try: number;
      total_cost_try: number;
      total_profit_try: number;
    };

    const models = await this.listModels();
    const usageLogs = await kv.list('usage:');
    const map = new Map<string, UsageStat>(models.map((m) => [m.id, {
      model_id: m.id,
      model_name: m.model_name,
      provider_name: m.provider_name,
      service_type: m.service_type,
      usage_count: 0,
      total_revenue_try: 0,
      total_cost_try: 0,
      total_profit_try: 0,
    }]));

    for (const u of usageLogs) {
      const d = u.value?.detaylar || {};
      const id = d.modelId;
      if (!id || !map.has(id)) continue;
      const stat = map.get(id) as UsageStat;
      stat.usage_count += 1;
      stat.total_revenue_try += Number(u.value?.kredi_maliyeti || 0);
      stat.total_cost_try += Number(u.value?.ic_maliyet || 0);
      stat.total_profit_try += Number(u.value?.kredi_maliyeti || 0) - Number(u.value?.ic_maliyet || 0);
    }

    return Array.from(map.values()).filter((x) => x.usage_count > 0).sort((a, b) => b.usage_count - a.usage_count);
  },
};
