import { kv } from '../db/kv.js';
import { fileSystem } from '../db/fs.js';

type AIFeature = 'chat' | 'image' | 'tts' | 'video' | 'photoToVideo';
type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'canceled' | 'not_found';
type LedgerAction = 'reserve' | 'commit' | 'refund' | 'usage';

interface ModelRecord {
  id: string;
  is_active: boolean;
  service_type: string;
  model_name: string;
  sale_credit_input?: number | null;
  sale_credit_output?: number | null;
  sale_credit_single?: number | null;
  raw_cost_input_try?: number | null;
  raw_cost_output_try?: number | null;
  raw_cost_single_try?: number | null;
}

interface OwnerRuntimeCall {
  feature: AIFeature;
  userId: string;
  modelId: string;
  requestId: string;
  clientRequestId: string;
  payload: Record<string, unknown>;
}

interface StoredJob {
  id: string;
  feature: 'video' | 'photoToVideo';
  userId: string;
  requestId: string;
  clientRequestId: string;
  modelId: string;
  status: Exclude<JobStatus, 'not_found'>;
  providerJobId: string;
  sourceAssetId?: string | null;
  outputAssetId?: string | null;
  outputUrl?: string | null;
  errorCode?: string | null;
  errorMessageRedacted?: string | null;
  creditReserved: number;
  creditCommitted: number;
  internalCostTry: number;
  createdAt: string;
  updatedAt: string;
  completedAt?: string | null;
  metadata: Record<string, unknown>;
  usageId?: string;
  reserveLedgerId?: string;
}

interface RuntimeError extends Error {
  code?: string;
}

function fail(message: string, code: string): never {
  throw Object.assign(new Error(message), { code });
}

function createId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function createRequestId(prefix: string) {
  return createId(prefix);
}

function normalizeClientRequestId(clientRequestId?: string) {
  return clientRequestId?.trim() || createRequestId('cli');
}

function toJobFeature(feature: AIFeature): 'video' | 'photoToVideo' {
  return feature === 'photoToVideo' ? 'photoToVideo' : 'video';
}

function acceptedServiceTypes(feature: AIFeature) {
  if (feature === 'chat') return new Set(['llm', 'chat']);
  if (feature === 'image') return new Set(['image']);
  if (feature === 'tts') return new Set(['tts', 'audio']);
  return new Set(['video', 'image_to_video']);
}

function getOwnerRuntimeConfig() {
  return {
    baseUrl: process.env.PUTER_OWNER_AI_BASE_URL,
    token: process.env.PUTER_OWNER_AI_TOKEN,
  };
}

function mapOwnerStatus(status?: string): JobStatus {
  if (!status) return 'processing';
  const normalized = status.toLowerCase();
  if (normalized === 'queued') return 'queued';
  if (normalized === 'processing' || normalized === 'running' || normalized === 'in_progress') return 'processing';
  if (normalized === 'completed' || normalized === 'done' || normalized === 'succeeded' || normalized === 'success') return 'completed';
  if (normalized === 'failed' || normalized === 'error') return 'failed';
  if (normalized === 'canceled' || normalized === 'cancelled') return 'canceled';
  if (normalized === 'not_found') return 'not_found';
  return 'processing';
}

function redactedErrorMessage(input?: unknown) {
  if (!input) return null;
  const msg = String(input).slice(0, 180);
  return msg.replace(/bearer\s+[a-z0-9\-_.]+/gi, 'bearer [redacted]');
}

function parseAssetIdFromUrl(assetUrl?: string) {
  if (!assetUrl) return null;
  const match = assetUrl.match(/\/api\/assets\/([^/?#]+)/);
  return match?.[1] || null;
}

async function callOwnerRuntime<T>(operation: string, payload: unknown): Promise<T> {
  const { baseUrl, token } = getOwnerRuntimeConfig();
  if (!baseUrl || !token) {
    fail('Owner AI runtime kullanılamıyor', 'OWNER_RUNTIME_UNAVAILABLE');
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/${operation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    fail('Owner runtime çağrısı başarısız', 'OWNER_RUNTIME_CALL_FAILED');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof (data as any)?.error === 'string' ? (data as any).error : 'Owner AI runtime hatası';
    const code = typeof (data as any)?.code === 'string' ? (data as any).code : 'OWNER_RUNTIME_CALL_FAILED';
    fail(message, code);
  }

  return data as T;
}

async function resolveModel(feature: AIFeature, modelId?: string): Promise<ModelRecord> {
  const accepted = acceptedServiceTypes(feature);

  if (modelId) {
    const model = (await kv.get(`model:${modelId}`)) as ModelRecord | null;
    if (!model || !model.is_active) fail('Aktif model bulunamadı', 'NO_ACTIVE_MODEL');
    if (!accepted.has(model.service_type)) fail('Model bu özellik için izinli değil', 'MODEL_NOT_ALLOWED');
    return model;
  }

  const candidates = (await kv.list('model:'))
    .map((item) => item.value as ModelRecord)
    .filter((model) => model.is_active && accepted.has(model.service_type));
  if (!candidates.length) fail('Aktif model bulunamadı', 'NO_ACTIVE_MODEL');
  return candidates[0];
}

function estimateBilling(feature: AIFeature, model: ModelRecord, payload: Record<string, unknown>) {
  if (feature === 'chat') {
    const prompt = String(payload.prompt || '');
    const estimatedInputTokens = Math.max(1, prompt.split(/\s+/).filter(Boolean).length * 1.3);
    const estimatedOutputTokens = 220;
    const cost = Math.max(
      1,
      Math.ceil(
        (estimatedInputTokens / 1000) * Number(model.sale_credit_input || 0)
        + (estimatedOutputTokens / 1000) * Number(model.sale_credit_output || 0),
      ),
    );
    const internalCost =
      (estimatedInputTokens / 1000) * Number(model.raw_cost_input_try || 0)
      + (estimatedOutputTokens / 1000) * Number(model.raw_cost_output_try || 0);
    return { cost, internalCost };
  }

  const unitCost = Math.max(1, Number(model.sale_credit_single || 1));
  let cost = unitCost;
  if (feature === 'video' || feature === 'photoToVideo') {
    const duration = Number(payload.duration || 5);
    cost = Math.max(1, Math.ceil(unitCost * (duration / 5)));
  }

  return { cost, internalCost: Number(model.raw_cost_single_try || 0) };
}

async function writeAssetFromBuffer(userId: string, type: 'image' | 'audio' | 'video', buffer: Buffer, ext: string, sourceJobId?: string) {
  const fileName = `${type}_${Date.now()}.${ext}`;
  // Part 3: enforce deterministic output folders for asset persistence.
  const folder = type === 'image' ? 'images' : type === 'audio' ? 'audio' : 'video';
  const filePath = `/users/${userId}/${folder}/${fileName}`;
  await fileSystem.write(filePath, buffer);

  const assetId = createId('ast');
  await kv.set(`assets:${assetId}`, {
    id: assetId,
    kullanici_id: userId,
    userId,
    tur: type,
    dosya_adi: fileName,
    fs_path: filePath,
    created_at: new Date().toISOString(),
    source_job_id: sourceJobId || null,
  });

  return { assetId, url: `/api/assets/${assetId}` };
}

async function writeAsset(userId: string, type: 'image' | 'audio', base64: string, ext: 'png' | 'mp3') {
  return writeAssetFromBuffer(userId, type, Buffer.from(base64, 'base64'), ext);
}

export const aiService = {
  isOwnerRuntimeConfigured() {
    const { baseUrl, token } = getOwnerRuntimeConfig();
    return Boolean(baseUrl && token);
  },

  // Part 4: backend owns model filtering/sorting so pages consume one consistent catalog projection.
  async listVisibleModels(query?: { feature?: string; provider?: string; q?: string; sort?: string }) {
    const models = (await kv.list('model:')).map((m) => m.value).filter((m) => m.is_active);
    let filtered = models;

    const featureMap: Record<string, string[]> = {
      chat: ['chat', 'llm'],
      image: ['image'],
      video: ['video'],
      photoToVideo: ['image_to_video', 'video'],
      tts: ['tts', 'audio'],
      music: ['music'],
    };

    if (query?.feature && featureMap[query.feature]) {
      filtered = filtered.filter((m) => featureMap[query.feature].includes(m.service_type));
      if (query.feature === 'photoToVideo') {
        filtered = filtered.filter((m) => m.service_type === 'image_to_video' || (m.service_type === 'video' && m.metadata_json?.supports_image_conditioning === true));
      }
    }

    if (query?.provider) {
      const provider = query.provider.toLowerCase();
      filtered = filtered.filter((m) => String(m.provider_name || '').toLowerCase().includes(provider));
    }

    if (query?.q) {
      const q = query.q.toLowerCase();
      filtered = filtered.filter((m) => String(m.model_name || '').toLowerCase().includes(q));
    }

    const sort = query?.sort || 'name_asc';
    const priceOf = (m: any) => Number(m.sale_credit_single ?? m.sale_credit_input ?? 0);
    filtered.sort((a, b) => {
      if (sort === 'price_asc') return priceOf(a) - priceOf(b);
      if (sort === 'price_desc') return priceOf(b) - priceOf(a);
      if (sort === 'provider_asc') return String(a.provider_name).localeCompare(String(b.provider_name));
      if (sort === 'provider_desc') return String(b.provider_name).localeCompare(String(a.provider_name));
      if (sort === 'name_desc') return String(b.model_name).localeCompare(String(a.model_name));
      return String(a.model_name).localeCompare(String(b.model_name));
    });

    return filtered.map((m) => ({
      id: m.id,
      provider_name: m.provider_name,
      model_name: m.model_name,
      service_type: m.service_type,
      sale_credit_input: m.sale_credit_input,
      sale_credit_output: m.sale_credit_output,
      sale_credit_single: m.sale_credit_single,
      billing_unit: m.billing_unit || null,
      metadata_json: m.metadata_json,
      display_credit: m.sale_credit_single ?? m.sale_credit_input ?? null,
    }));
  },

  async createLedgerEntry(userId: string, action: LedgerAction, amount: number, description: string, requestId?: string, jobId?: string) {
    const user = await kv.get(`users:${userId}`);
    if (!user) fail('Kullanıcı bulunamadı', 'UNAUTHORIZED');
    const before = Number(user.toplam_kredi || 0) - Number(user.kullanilan_kredi || 0);
    const after = before + amount;
    const ledgerId = createId('ldg');
    const now = new Date().toISOString();
    await kv.set(`creditLedger:${ledgerId}`, {
      id: ledgerId,
      userId,
      kullanici_id: userId,
      requestId: requestId || null,
      jobId: jobId || null,
      action,
      islem_tipi: action === 'reserve' || action === 'commit' ? 'usage' : action,
      miktar: amount,
      onceki_bakiye: before,
      sonraki_bakiye: after,
      aciklama: description,
      created_at: now,
      updated_at: now,
    });
    return ledgerId;
  },

  async reserveCredit(userId: string, amount: number, requestId: string, feature: string, jobId?: string) {
    const user = await kv.get(`users:${userId}`);
    if (!user || Number(user.toplam_kredi || 0) - Number(user.kullanilan_kredi || 0) < amount) {
      fail('Yetersiz kredi', 'INSUFFICIENT_CREDIT');
    }
    user.kullanilan_kredi = Number(user.kullanilan_kredi || 0) + amount;
    await kv.set(`users:${userId}`, user);
    return this.createLedgerEntry(userId, 'reserve', -amount, `${feature} kredi rezervasyonu`, requestId, jobId);
  },

  async commitCredit(userId: string, amount: number, requestId: string, feature: string, jobId?: string) {
    return this.createLedgerEntry(userId, 'commit', 0, `${feature} kredi commit`, requestId, jobId);
  },

  async refundCredit(userId: string, amount: number, requestId: string, feature: string, jobId?: string) {
    const user = await kv.get(`users:${userId}`);
    if (!user) fail('Kullanıcı bulunamadı', 'UNAUTHORIZED');
    user.kullanilan_kredi = Math.max(0, Number(user.kullanilan_kredi || 0) - amount);
    await kv.set(`users:${userId}`, user);
    return this.createLedgerEntry(userId, 'refund', amount, `${feature} kredi iadesi`, requestId, jobId);
  },

  async upsertUsage(args: {
    usageId?: string;
    userId: string;
    feature: string;
    modelId: string;
    requestId: string;
    jobId?: string;
    status: 'queued' | 'processing' | 'completed' | 'failed' | 'canceled' | 'success';
    creditReserved: number;
    creditCommitted: number;
    internalCostTry: number;
    assetId?: string | null;
    errorCode?: string | null;
    details?: Record<string, unknown>;
  }) {
    const usageId = args.usageId || createId('usg');
    const now = new Date().toISOString();
    const prev = (await kv.get(`usage:${usageId}`)) || {};
    const legacyStatus = args.status === 'completed' ? 'success' : args.status === 'failed' ? 'failed' : 'started';

    const usage = {
      ...prev,
      id: usageId,
      userId: args.userId,
      kullanici_id: args.userId,
      feature: args.feature,
      modul: args.feature,
      modelId: args.modelId,
      requestId: args.requestId,
      jobId: args.jobId || null,
      status: args.status,
      durum: legacyStatus,
      creditReserved: args.creditReserved,
      creditCommitted: args.creditCommitted,
      kredi_maliyeti: args.creditCommitted || args.creditReserved,
      internalCostTry: args.internalCostTry,
      ic_maliyet: args.internalCostTry,
      assetId: args.assetId || null,
      errorCode: args.errorCode || null,
      detaylar: {
        ...(prev.detaylar || {}),
        ...(args.details || {}),
        modelId: args.modelId,
      },
      created_at: prev.created_at || now,
      updated_at: now,
    };

    await kv.set(`usage:${usageId}`, usage);
    await kv.set(`userUsage:${args.userId}:${usageId}`, usageId);
    return usageId;
  },

  // Compatibility helper for existing modules.
  async checkAndDeductCredit(userId: string, cost: number, module: string): Promise<boolean> {
    try {
      await this.reserveCredit(userId, cost, createRequestId('req'), module);
      await this.commitCredit(userId, cost, createRequestId('req'), module);
      return true;
    } catch (error: any) {
      if (error.code === 'INSUFFICIENT_CREDIT') return false;
      throw error;
    }
  },

  // Compatibility helper for existing modules.
  async logUsage(userId: string, module: string, cost: number, internalCost: number, status: 'success' | 'failed', details: any) {
    return this.upsertUsage({
      userId,
      feature: module,
      modelId: String(details?.modelId || module),
      requestId: String(details?.requestId || createRequestId('req')),
      jobId: details?.jobId,
      status: status === 'success' ? 'completed' : 'failed',
      creditReserved: cost,
      creditCommitted: status === 'success' ? cost : 0,
      internalCostTry: internalCost,
      assetId: details?.assetId || null,
      errorCode: details?.code || null,
      details,
    });
  },

  async createJobRecord(input: {
    jobId: string;
    feature: 'video' | 'photoToVideo';
    userId: string;
    requestId: string;
    clientRequestId: string;
    modelId: string;
    providerJobId: string;
    sourceAssetId?: string | null;
    creditReserved: number;
    internalCostTry: number;
    metadata?: Record<string, unknown>;
  }) {
    const now = new Date().toISOString();
    const record: StoredJob = {
      id: input.jobId,
      feature: input.feature,
      userId: input.userId,
      requestId: input.requestId,
      clientRequestId: input.clientRequestId,
      modelId: input.modelId,
      status: 'queued',
      providerJobId: input.providerJobId,
      sourceAssetId: input.sourceAssetId || null,
      outputAssetId: null,
      outputUrl: null,
      errorCode: null,
      errorMessageRedacted: null,
      creditReserved: input.creditReserved,
      creditCommitted: 0,
      internalCostTry: input.internalCostTry,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      metadata: input.metadata || {},
    };

    await kv.set(`aiJob:${input.jobId}`, record);
    await kv.set(`userAiJob:${input.userId}:${input.jobId}`, input.jobId);
    await kv.set(`clientJob:${input.userId}:${input.feature}:${input.clientRequestId}`, input.jobId);
    return record;
  },

  async updateJobRecord(jobId: string, patch: Partial<StoredJob>) {
    const current = await this.getStoredJob(jobId);
    if (!current) return null;
    const updated = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    await kv.set(`aiJob:${jobId}`, updated);
    return updated as StoredJob;
  },

  async getStoredJob(jobId: string) {
    return (await kv.get(`aiJob:${jobId}`)) as StoredJob | null;
  },

  async syncJobStatusFromOwnerRuntime(job: StoredJob) {
    try {
      const runtime = await callOwnerRuntime<{
        status?: string;
        outputUrl?: string;
        outputAssetUrl?: string;
        base64Video?: string;
        videoBase64?: string;
        outputBase64?: string;
        error?: string;
        errorCode?: string;
        metadata?: Record<string, unknown>;
      }>('jobs/status', {
        jobId: job.providerJobId,
        feature: job.feature,
      });

      const status = mapOwnerStatus(runtime.status);
      if (status === 'not_found') {
        fail('Owner runtime job bulunamadı', 'OWNER_RUNTIME_JOB_NOT_FOUND');
      }

      return {
        status,
        outputUrl: runtime.outputAssetUrl || runtime.outputUrl || null,
        outputBase64: runtime.outputBase64 || runtime.base64Video || runtime.videoBase64 || null,
        errorCode: runtime.errorCode || null,
        errorMessageRedacted: redactedErrorMessage(runtime.error),
        metadata: runtime.metadata || {},
      };
    } catch (error: any) {
      if (error.code === 'OWNER_RUNTIME_JOB_NOT_FOUND') throw error;
      fail(error.message || 'Job sync başarısız', 'JOB_SYNC_FAILED');
    }
  },

  async finalizeCompletedJob(job: StoredJob, sync: { outputUrl: string | null; outputBase64: string | null; metadata: Record<string, unknown> }) {
    try {
      let output = job.outputUrl || null;
      let outputAssetId = job.outputAssetId || null;

      if (sync.outputBase64) {
        const saved = await writeAssetFromBuffer(job.userId, 'video', Buffer.from(sync.outputBase64, 'base64'), 'mp4', job.id);
        output = saved.url;
        outputAssetId = saved.assetId;
      } else if (sync.outputUrl && sync.outputUrl.startsWith('http')) {
        const response = await fetch(sync.outputUrl);
        if (!response.ok) fail('Output asset indirilemedi', 'ASSET_WRITE_FAILED');
        const buffer = Buffer.from(await response.arrayBuffer());
        const saved = await writeAssetFromBuffer(job.userId, 'video', buffer, 'mp4', job.id);
        output = saved.url;
        outputAssetId = saved.assetId;
      } else if (sync.outputUrl && sync.outputUrl.startsWith('/api/assets/')) {
        outputAssetId = parseAssetIdFromUrl(sync.outputUrl);
        output = sync.outputUrl;
      }

      if (!output) fail('Output asset yazılamadı', 'ASSET_WRITE_FAILED');

      await this.commitCredit(job.userId, job.creditReserved, job.requestId, job.feature, job.id);
      const completedAt = new Date().toISOString();
      const updated = await this.updateJobRecord(job.id, {
        status: 'completed',
        outputUrl: output,
        outputAssetId,
        creditCommitted: job.creditReserved,
        completedAt,
        errorCode: null,
        errorMessageRedacted: null,
        metadata: {
          ...(job.metadata || {}),
          ...(sync.metadata || {}),
        },
      });
      await this.upsertUsage({
        usageId: updated?.usageId,
        userId: job.userId,
        feature: job.feature,
        modelId: job.modelId,
        requestId: job.requestId,
        jobId: job.id,
        status: 'completed',
        creditReserved: job.creditReserved,
        creditCommitted: job.creditReserved,
        internalCostTry: job.internalCostTry,
        assetId: outputAssetId,
        details: { outputUrl: output },
      });
      return updated || job;
    } catch (error: any) {
      if (error.code === 'ASSET_WRITE_FAILED') throw error;
      fail(error.message || 'Job finalize başarısız', 'JOB_FINALIZE_FAILED');
    }

    const completedAt = new Date().toISOString();
    const updated = await this.updateJobRecord(job.id, {
      status: 'failed',
      errorCode: errorCode || 'JOB_FINALIZE_FAILED',
      errorMessageRedacted: errorMessage || 'İş başarısız oldu',
      completedAt,
      creditCommitted: 0,
    });

    await this.upsertUsage({
      usageId: updated?.usageId,
      userId: job.userId,
      feature: job.feature,
      modelId: job.modelId,
      requestId: job.requestId,
      jobId: job.id,
      status: 'failed',
      creditReserved: job.creditReserved,
      creditCommitted: 0,
      internalCostTry: job.internalCostTry,
      errorCode: errorCode || 'JOB_FINALIZE_FAILED',
      details: { error: errorMessage || 'failed' },
    });

    return updated || job;
  },

  async finalizeFailedJob(job: StoredJob, errorCode?: string | null, errorMessage?: string | null) {
    try {
      if (job.creditCommitted === 0) {
        await this.refundCredit(job.userId, job.creditReserved, job.requestId, job.feature, job.id);
      }
    } catch {
      fail('Kredi iadesi başarısız', 'CREDIT_REFUND_FAILED');
    }

    const completedAt = new Date().toISOString();
    const updated = await this.updateJobRecord(job.id, {
      status: 'failed',
      errorCode: errorCode || 'JOB_FINALIZE_FAILED',
      errorMessageRedacted: errorMessage || 'İş başarısız oldu',
      completedAt,
      creditCommitted: 0,
    });

    await this.upsertUsage({
      usageId: updated?.usageId,
      userId: job.userId,
      feature: job.feature,
      modelId: job.modelId,
      requestId: job.requestId,
      jobId: job.id,
      status: 'failed',
      creditReserved: job.creditReserved,
      creditCommitted: 0,
      internalCostTry: job.internalCostTry,
      errorCode: errorCode || 'JOB_FINALIZE_FAILED',
      details: { error: errorMessage || 'failed' },
    });

    return updated || job;
  },


  async createImageSourceAsset(userId: string, base64Image: string) {
    const sanitized = base64Image.replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, '');
    const saved = await writeAssetFromBuffer(userId, 'image', Buffer.from(sanitized, 'base64'), 'png');
    return saved;
  },

  async runFeature(input: {
    feature: AIFeature;
    userId: string;
    modelId?: string;
    clientRequestId?: string;
    payload: Record<string, unknown>;
  }) {
    const model = await resolveModel(input.feature, input.modelId);
    const requestId = createRequestId('req');
    const clientRequestId = normalizeClientRequestId(input.clientRequestId);
    const billing = estimateBilling(input.feature, model, input.payload);

    const runtimeInput: OwnerRuntimeCall = {
      feature: input.feature,
      userId: input.userId,
      modelId: model.id,
      requestId,
      clientRequestId,
      payload: input.payload,
    };

    if (input.feature === 'chat') {
      await this.reserveCredit(input.userId, billing.cost, requestId, 'chat');
      try {
        const runtime = await callOwnerRuntime<{ response?: string; text?: string; meta?: Record<string, unknown> }>('chat', runtimeInput);
        await this.commitCredit(input.userId, billing.cost, requestId, 'chat');
        await this.upsertUsage({
          userId: input.userId,
          feature: 'chat',
          modelId: model.id,
          requestId,
          status: 'completed',
          creditReserved: billing.cost,
          creditCommitted: billing.cost,
          internalCostTry: billing.internalCost,
          details: { clientRequestId },
        });
        return {
          response: runtime.response || runtime.text || '',
          requestId,
          modelId: model.id,
          billing: { creditReserved: billing.cost, creditCommitted: billing.cost, internalCostTry: billing.internalCost },
          meta: runtime.meta || null,
        };
      } catch (error: any) {
        await this.refundCredit(input.userId, billing.cost, requestId, 'chat');
        await this.upsertUsage({
          userId: input.userId,
          feature: 'chat',
          modelId: model.id,
          requestId,
          status: 'failed',
          creditReserved: billing.cost,
          creditCommitted: 0,
          internalCostTry: billing.internalCost,
          errorCode: error.code || 'OWNER_RUNTIME_CALL_FAILED',
          details: { clientRequestId },
        });
        throw error;
      }
    }

    if (input.feature === 'image') {
      await this.reserveCredit(input.userId, billing.cost, requestId, 'image');
      try {
        const runtime = await callOwnerRuntime<{ base64Image?: string; imageBase64?: string; meta?: Record<string, unknown> }>('image', runtimeInput);
        const base64Image = runtime.base64Image || runtime.imageBase64;
        if (!base64Image) fail('Görsel üretilemedi', 'OWNER_RUNTIME_CALL_FAILED');
        const asset = await writeAsset(input.userId, 'image', base64Image, 'png');
        await this.commitCredit(input.userId, billing.cost, requestId, 'image');
        await this.upsertUsage({
        userId: input.userId,
        feature: 'image',
        modelId: model.id,
        requestId,
        status: 'completed',
        creditReserved: billing.cost,
        creditCommitted: billing.cost,
        internalCostTry: billing.internalCost,
        assetId: asset.assetId,
        details: { clientRequestId },
      });
        return {
          ...asset,
          requestId,
          modelId: model.id,
          billing: { creditReserved: billing.cost, creditCommitted: billing.cost, internalCostTry: billing.internalCost },
          meta: runtime.meta || null,
        };
      } catch (error: any) {
        await this.refundCredit(input.userId, billing.cost, requestId, 'image');
        await this.upsertUsage({
          userId: input.userId,
          feature: 'image',
          modelId: model.id,
          requestId,
          status: 'failed',
          creditReserved: billing.cost,
          creditCommitted: 0,
          internalCostTry: billing.internalCost,
          errorCode: error.code || 'OWNER_RUNTIME_CALL_FAILED',
          details: { clientRequestId },
        });
        throw error;
      }
    }

    if (input.feature === 'tts') {
      await this.reserveCredit(input.userId, billing.cost, requestId, 'tts');
      try {
        const runtime = await callOwnerRuntime<{ base64Audio?: string; audioBase64?: string; meta?: Record<string, unknown> }>('tts', runtimeInput);
        const base64Audio = runtime.base64Audio || runtime.audioBase64;
        if (!base64Audio) fail('Ses üretilemedi', 'OWNER_RUNTIME_CALL_FAILED');
        const asset = await writeAsset(input.userId, 'audio', base64Audio, 'mp3');
        await this.commitCredit(input.userId, billing.cost, requestId, 'tts');
        await this.upsertUsage({
        userId: input.userId,
        feature: 'tts',
        modelId: model.id,
        requestId,
        status: 'completed',
        creditReserved: billing.cost,
        creditCommitted: billing.cost,
        internalCostTry: billing.internalCost,
        assetId: asset.assetId,
        details: { clientRequestId },
      });
        return {
          ...asset,
          requestId,
          modelId: model.id,
          billing: { creditReserved: billing.cost, creditCommitted: billing.cost, internalCostTry: billing.internalCost },
          meta: runtime.meta || null,
        };
      } catch (error: any) {
        await this.refundCredit(input.userId, billing.cost, requestId, 'image');
        await this.upsertUsage({
          userId: input.userId,
          feature: 'image',
          modelId: model.id,
          requestId,
          status: 'failed',
          creditReserved: billing.cost,
          creditCommitted: 0,
          internalCostTry: billing.internalCost,
          errorCode: error.code || 'OWNER_RUNTIME_CALL_FAILED',
          details: { clientRequestId },
        });
        throw error;
      }
    }

    const feature = toJobFeature(input.feature);
    const dedupeKey = `clientJob:${input.userId}:${feature}:${clientRequestId}`;
    const existingJobId = await kv.get(dedupeKey);
    if (existingJobId) {
      const existing = await this.getStoredJob(String(existingJobId));
      if (existing) {
        return {
          jobId: existing.id,
          status: existing.status,
          requestId: existing.requestId,
          modelId: existing.modelId,
          sourceAssetId: existing.sourceAssetId || null,
          billing: { creditReserved: existing.creditReserved, creditCommitted: existing.creditCommitted, internalCostTry: existing.internalCostTry },
        };
      }
    }

    const operation = input.feature === 'photoToVideo' ? 'photo-to-video' : 'video';
    const runtime = await callOwnerRuntime<{ jobId?: string; status?: string; providerJobId?: string; meta?: Record<string, unknown> }>(operation, runtimeInput);
    if (!runtime.jobId && !runtime.providerJobId) fail('Video işi başlatılamadı', 'OWNER_RUNTIME_CALL_FAILED');

    const jobId = String(runtime.jobId || runtime.providerJobId);
    const sourceAssetId = parseAssetIdFromUrl(String(input.payload.imageUrl || ''));
    const reserveLedgerId = await this.reserveCredit(input.userId, billing.cost, requestId, feature, jobId);
    const job = await this.createJobRecord({
      jobId,
      feature,
      userId: input.userId,
      requestId,
      clientRequestId,
      modelId: model.id,
      providerJobId: jobId,
      sourceAssetId,
      creditReserved: billing.cost,
      internalCostTry: billing.internalCost,
      metadata: runtime.meta || {},
    });

    const usageId = await this.upsertUsage({
      userId: input.userId,
      feature,
      modelId: model.id,
      requestId,
      jobId,
      status: 'queued',
      creditReserved: billing.cost,
      creditCommitted: 0,
      internalCostTry: billing.internalCost,
      details: { clientRequestId },
    });
    await this.updateJobRecord(jobId, { usageId, reserveLedgerId });

    return {
      jobId,
      status: 'queued',
      requestId,
      modelId: model.id,
      sourceAssetId: sourceAssetId || null,
      billing: { creditReserved: billing.cost, creditCommitted: 0, internalCostTry: billing.internalCost },
      meta: runtime.meta || null,
    };
  },

  // Part 3: sync persisted job state before returning poll response.
  async getJobStatus(userId: string, jobId: string) {
    const job = await this.getStoredJob(jobId);
    if (!job || job.userId !== userId) {
      return { status: 'not_found' as JobStatus, jobId, code: 'JOB_NOT_FOUND' };
    }

    let latest = job;
    if (!['completed', 'failed', 'canceled'].includes(job.status)) {
      try {
        const synced = await this.syncJobStatusFromOwnerRuntime(job);
        if (synced.status === 'completed') {
          latest = await this.finalizeCompletedJob(job, synced);
        } else if (synced.status === 'failed' || synced.status === 'canceled') {
          latest = await this.finalizeFailedJob(job, synced.errorCode, synced.errorMessageRedacted);
          if (synced.status === 'canceled') {
            latest = (await this.updateJobRecord(job.id, { status: 'canceled' })) || latest;
          }
        } else {
          latest = (await this.updateJobRecord(job.id, { status: synced.status })) || latest;
          if (latest.usageId) {
            await this.upsertUsage({
              usageId: latest.usageId,
              userId: latest.userId,
              feature: latest.feature,
              modelId: latest.modelId,
              requestId: latest.requestId,
              jobId: latest.id,
              status: latest.status,
              creditReserved: latest.creditReserved,
              creditCommitted: latest.creditCommitted,
              internalCostTry: latest.internalCostTry,
            });
          }
        }
      } catch (error: any) {
        if (error.code === 'OWNER_RUNTIME_JOB_NOT_FOUND') {
          latest = await this.finalizeFailedJob(job, 'OWNER_RUNTIME_JOB_NOT_FOUND', 'Owner runtime işi bulunamadı');
        } else {
          fail(error.message || 'Job sync hatası', error.code || 'JOB_SYNC_FAILED');
        }
      }
    }

    return {
      jobId: latest.id,
      status: latest.status,
      feature: latest.feature,
      requestId: latest.requestId,
      modelId: latest.modelId,
      assetId: latest.outputAssetId || null,
      outputUrl: latest.outputUrl || null,
      sourceAssetId: latest.sourceAssetId || null,
      errorCode: latest.errorCode || null,
      error: latest.errorMessageRedacted || null,
      billing: {
        creditReserved: latest.creditReserved,
        creditCommitted: latest.creditCommitted,
        internalCostTry: latest.internalCostTry,
      },
      updatedAt: latest.updatedAt,
      completedAt: latest.completedAt || null,
    };
  },
};
