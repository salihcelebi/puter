import { kv } from '../db/kv.js';
import { fileSystem } from '../db/fs.js';

type AIFeature = 'chat' | 'image' | 'tts' | 'video' | 'photoToVideo';
type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'not_found';

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
  userId: string;
  feature: 'video' | 'photoToVideo';
  modelId: string;
  status: Exclude<JobStatus, 'not_found'>;
  runtimeJobId: string;
  requestId: string;
  clientRequestId: string;
  outputUrl?: string;
  error?: string;
  updatedAt: string;
  createdAt: string;
}

interface RuntimeError extends Error {
  code?: string;
}

function fail(message: string, code: string): never {
  throw Object.assign(new Error(message), { code });
}

function getOwnerRuntimeConfig() {
  return {
    baseUrl: process.env.PUTER_OWNER_AI_BASE_URL,
    token: process.env.PUTER_OWNER_AI_TOKEN,
  };
}

function createRequestId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizeClientRequestId(clientRequestId?: string) {
  return clientRequestId?.trim() || createRequestId('cli');
}

function acceptedServiceTypes(feature: AIFeature) {
  if (feature === 'chat') return new Set(['llm', 'chat']);
  if (feature === 'image') return new Set(['image']);
  if (feature === 'tts') return new Set(['tts', 'audio']);
  return new Set(['video']);
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
    const message = typeof data?.error === 'string' ? data.error : 'Owner AI runtime hatası';
    const code = typeof data?.code === 'string' ? data.code : 'FEATURE_NOT_READY';
    fail(message, code);
  }

  return data as T;
}

async function resolveModel(feature: AIFeature, modelId?: string): Promise<ModelRecord> {
  const accepted = acceptedServiceTypes(feature);

  if (modelId) {
    const model = await kv.get(`model:${modelId}`);
    if (!model || !model.is_active) {
      fail('Aktif model bulunamadı', 'NO_ACTIVE_MODEL');
    }
    if (!accepted.has(model.service_type)) {
      fail('Model bu özellik için izinli değil', 'MODEL_NOT_ALLOWED');
    }
    return model as ModelRecord;
  }

  const candidates = (await kv.list('model:'))
    .map((item) => item.value as ModelRecord)
    .filter((model) => model.is_active && accepted.has(model.service_type));

  if (!candidates.length) {
    fail('Aktif model bulunamadı', 'NO_ACTIVE_MODEL');
  }

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
        (estimatedInputTokens / 1000) * Number(model.sale_credit_input || 0) +
          (estimatedOutputTokens / 1000) * Number(model.sale_credit_output || 0),
      ),
    );
    const internalCost =
      (estimatedInputTokens / 1000) * Number(model.raw_cost_input_try || 0) +
      (estimatedOutputTokens / 1000) * Number(model.raw_cost_output_try || 0);
    return { cost, internalCost };
  }

  const unitCost = Math.max(1, Number(model.sale_credit_single || 1));
  let cost = unitCost;
  if (feature === 'video' || feature === 'photoToVideo') {
    const duration = Number(payload.duration || 5);
    cost = Math.max(1, Math.ceil(unitCost * (duration / 5)));
  }

  const internalCost = Number(model.raw_cost_single_try || 0);
  return { cost, internalCost };
}

async function writeAsset(userId: string, type: 'image' | 'audio', base64: string, ext: 'png' | 'mp3') {
  const fileName = `${type}_${Date.now()}.${ext}`;
  const folder = type === 'image' ? 'images' : 'audio';
  const filePath = `/users/${userId}/${folder}/${fileName}`;
  await fileSystem.write(filePath, Buffer.from(base64, 'base64'));

  const assetId = `ast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  await kv.set(`assets:${assetId}`, {
    id: assetId,
    kullanici_id: userId,
    tur: type,
    dosya_adi: fileName,
    fs_path: filePath,
    created_at: new Date().toISOString(),
  });

  return { assetId, url: `/api/assets/${assetId}` };
}

export const aiService = {
  isOwnerRuntimeConfigured() {
    const { baseUrl, token } = getOwnerRuntimeConfig();
    return Boolean(baseUrl && token);
  },

  // Part 2: keep provider resolution behind server-owned model allowlist.
  async listVisibleModels() {
    const models = await kv.list('model:');
    return models
      .map((m) => m.value)
      .filter((m) => m.is_active)
      .map((m) => ({
        id: m.id,
        provider_name: m.provider_name,
        model_name: m.model_name,
        service_type: m.service_type,
        sale_credit_input: m.sale_credit_input,
        sale_credit_output: m.sale_credit_output,
        sale_credit_single: m.sale_credit_single,
        metadata_json: m.metadata_json,
      }));
  },

  async checkAndDeductCredit(userId: string, cost: number, module: string): Promise<boolean> {
    const user = await kv.get(`users:${userId}`);
    if (!user || user.toplam_kredi - user.kullanilan_kredi < cost) {
      return false;
    }

    user.kullanilan_kredi += cost;
    await kv.set(`users:${userId}`, user);

    const ledgerId = `ldg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    await kv.set(`creditLedger:${ledgerId}`, {
      id: ledgerId,
      kullanici_id: userId,
      islem_tipi: 'usage',
      miktar: -cost,
      onceki_bakiye: user.toplam_kredi - (user.kullanilan_kredi - cost),
      sonraki_bakiye: user.toplam_kredi - user.kullanilan_kredi,
      aciklama: `${module} kullanımı`,
      created_at: new Date().toISOString(),
    });

    return true;
  },

  async logUsage(userId: string, module: string, cost: number, internalCost: number, status: 'success' | 'failed', details: any) {
    const usageId = `usg_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const log = {
      id: usageId,
      kullanici_id: userId,
      modul: module,
      kredi_maliyeti: cost,
      ic_maliyet: internalCost,
      durum: status,
      detaylar: details,
      created_at: new Date().toISOString(),
    };

    await kv.set(`usage:${usageId}`, log);
    await kv.set(`userUsage:${userId}:${usageId}`, usageId);
    return usageId;
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

    // Part 2: normalize owner-runtime AI response for backward-compatible UI.
    if (input.feature === 'chat') {
      try {
        const runtime = await callOwnerRuntime<{ response?: string; text?: string; meta?: Record<string, unknown> }>('chat', runtimeInput);
        const hasCredit = await this.checkAndDeductCredit(input.userId, billing.cost, 'chat');
        if (!hasCredit) fail('Yetersiz kredi', 'INSUFFICIENT_CREDIT');

        const response = runtime.response || runtime.text || '';
        await this.logUsage(input.userId, 'chat', billing.cost, billing.internalCost, 'success', {
          requestId,
          clientRequestId,
          modelId: model.id,
          feature: 'chat',
        });

        return {
          response,
          requestId,
          modelId: model.id,
          billing: {
            creditCost: billing.cost,
            internalCost: billing.internalCost,
          },
          meta: runtime.meta || null,
        };
      } catch (error: any) {
        await this.logUsage(input.userId, 'chat', billing.cost, billing.internalCost, 'failed', {
          requestId,
          clientRequestId,
          modelId: model.id,
          error: error.message,
          code: (error as RuntimeError).code,
        });
        throw error;
      }
    }

    if (input.feature === 'image') {
      try {
        const runtime = await callOwnerRuntime<{ base64Image?: string; imageBase64?: string; meta?: Record<string, unknown> }>('image', runtimeInput);
        const base64Image = runtime.base64Image || runtime.imageBase64;
        if (!base64Image) fail('Görsel üretilemedi', 'OWNER_RUNTIME_CALL_FAILED');

        const hasCredit = await this.checkAndDeductCredit(input.userId, billing.cost, 'image');
        if (!hasCredit) fail('Yetersiz kredi', 'INSUFFICIENT_CREDIT');

        const asset = await writeAsset(input.userId, 'image', base64Image, 'png');
        await this.logUsage(input.userId, 'image', billing.cost, billing.internalCost, 'success', {
          requestId,
          clientRequestId,
          modelId: model.id,
          assetId: asset.assetId,
          feature: 'image',
        });

        return {
          ...asset,
          requestId,
          modelId: model.id,
          billing: {
            creditCost: billing.cost,
            internalCost: billing.internalCost,
          },
          meta: runtime.meta || null,
        };
      } catch (error: any) {
        await this.logUsage(input.userId, 'image', billing.cost, billing.internalCost, 'failed', {
          requestId,
          clientRequestId,
          modelId: model.id,
          error: error.message,
          code: (error as RuntimeError).code,
        });
        throw error;
      }
    }

    if (input.feature === 'tts') {
      try {
        const runtime = await callOwnerRuntime<{ base64Audio?: string; audioBase64?: string; meta?: Record<string, unknown> }>('tts', runtimeInput);
        const base64Audio = runtime.base64Audio || runtime.audioBase64;
        if (!base64Audio) fail('Ses üretilemedi', 'OWNER_RUNTIME_CALL_FAILED');

        const hasCredit = await this.checkAndDeductCredit(input.userId, billing.cost, 'tts');
        if (!hasCredit) fail('Yetersiz kredi', 'INSUFFICIENT_CREDIT');

        const asset = await writeAsset(input.userId, 'audio', base64Audio, 'mp3');
        await this.logUsage(input.userId, 'tts', billing.cost, billing.internalCost, 'success', {
          requestId,
          clientRequestId,
          modelId: model.id,
          assetId: asset.assetId,
          feature: 'tts',
        });

        return {
          ...asset,
          requestId,
          modelId: model.id,
          billing: {
            creditCost: billing.cost,
            internalCost: billing.internalCost,
          },
          meta: runtime.meta || null,
        };
      } catch (error: any) {
        await this.logUsage(input.userId, 'tts', billing.cost, billing.internalCost, 'failed', {
          requestId,
          clientRequestId,
          modelId: model.id,
          error: error.message,
          code: (error as RuntimeError).code,
        });
        throw error;
      }
    }

    const operation = input.feature === 'photoToVideo' ? 'photo-to-video' : 'video';
    const module = input.feature === 'photoToVideo' ? 'photo_to_video' : 'video';

    try {
      const runtime = await callOwnerRuntime<{ jobId?: string; status?: string; meta?: Record<string, unknown> }>(operation, runtimeInput);
      if (!runtime.jobId) fail('Video işi başlatılamadı', 'OWNER_RUNTIME_CALL_FAILED');

      const hasCredit = await this.checkAndDeductCredit(input.userId, billing.cost, module);
      if (!hasCredit) fail('Yetersiz kredi', 'INSUFFICIENT_CREDIT');

      const now = new Date().toISOString();
      const storedJob: StoredJob = {
        id: runtime.jobId,
        userId: input.userId,
        feature: input.feature,
        modelId: model.id,
        status: 'queued',
        runtimeJobId: runtime.jobId,
        requestId,
        clientRequestId,
        createdAt: now,
        updatedAt: now,
      };
      await kv.set(`aiJob:${runtime.jobId}`, storedJob);

      await this.logUsage(input.userId, module, billing.cost, billing.internalCost, 'success', {
        requestId,
        clientRequestId,
        modelId: model.id,
        jobId: runtime.jobId,
        feature: input.feature,
      });

      return {
        jobId: runtime.jobId,
        status: 'queued',
        requestId,
        modelId: model.id,
        billing: {
          creditCost: billing.cost,
          internalCost: billing.internalCost,
        },
        meta: runtime.meta || null,
      };
    } catch (error: any) {
      await this.logUsage(input.userId, module, billing.cost, billing.internalCost, 'failed', {
        requestId,
        clientRequestId,
        modelId: model.id,
        error: error.message,
        code: (error as RuntimeError).code,
        feature: input.feature,
      });
      throw error;
    }
  },

  // Part 2: keep job polling honest, avoid false-ready media state.
  async getJobStatus(userId: string, jobId: string) {
    const job = await kv.get(`aiJob:${jobId}`) as StoredJob | null;
    if (!job || job.userId !== userId) {
      return {
        status: 'not_found' as JobStatus,
        jobId,
        code: 'JOB_NOT_FOUND',
      };
    }

    try {
      const runtime = await callOwnerRuntime<{ status?: JobStatus; outputUrl?: string; error?: string }>('jobs/status', {
        jobId: job.runtimeJobId,
        feature: job.feature,
      });

      const status = runtime.status || job.status;
      const updatedJob: StoredJob = {
        ...job,
        status: status === 'not_found' ? 'failed' : status,
        outputUrl: runtime.outputUrl || job.outputUrl,
        error: runtime.error || job.error,
        updatedAt: new Date().toISOString(),
      };

      await kv.set(`aiJob:${jobId}`, updatedJob);

      return {
        status,
        jobId,
        requestId: job.requestId,
        modelId: job.modelId,
        outputUrl: updatedJob.outputUrl,
        error: updatedJob.error,
      };
    } catch (error: any) {
      if ((error as RuntimeError).code === 'FEATURE_NOT_READY') {
        return {
          status: job.status,
          jobId,
          requestId: job.requestId,
          modelId: job.modelId,
          outputUrl: job.outputUrl,
          error: job.error,
        };
      }
      throw error;
    }
  },
};
