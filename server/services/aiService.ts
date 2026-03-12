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

function readEnv(...keys: string[]) {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw !== 'string') continue;
    const value = raw.trim().replace(/^['"]|['"]$/g, '');
    if (value) return value;
  }
  return undefined;
}

/* ENV FALLBACK */
function getOwnerRuntimeConfig() {
  return {
    baseUrl:
      readEnv(
        'PUTER_OWNER_AI_BASE_URL',
        'OWNER_RUNTIME_BASE_URL',
        'PUTER_OWNER_RUNTIME_BASE_URL'
      ) || 'https://api.puter.com/ai',
    token:
      readEnv(
        'PUTER_OWNER_AI_TOKEN',
        'OWNER_RUNTIME_TOKEN',
        'PUTER_OWNER_RUNTIME_TOKEN'
      ) || 'me.puter',
  };
}

async function callOwnerRuntime<T>(operation: string, payload: unknown): Promise<T> {
  const { baseUrl, token } = getOwnerRuntimeConfig();

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
    const message =
      typeof (data as any)?.error === 'string'
        ? (data as any).error
        : 'Owner AI runtime hatası';
    const code =
      typeof (data as any)?.code === 'string'
        ? (data as any).code
        : 'OWNER_RUNTIME_CALL_FAILED';
    fail(message, code);
  }

  return data as T;
}

function parseAssetIdFromUrl(assetUrl?: string) {
  if (!assetUrl) return null;
  const match = assetUrl.match(/\/api\/assets\/([^/?#]+)/);
  return match?.[1] || null;
}

async function writeAssetFromBuffer(
  userId: string,
  type: 'image' | 'audio' | 'video',
  buffer: Buffer,
  ext: string,
  sourceJobId?: string
) {
  const fileName = `${type}_${Date.now()}.${ext}`;
  const folder = type === 'image' ? 'images' : type === 'audio' ? 'audio' : 'video';
  const filePath = `/users/${userId}/${folder}/${fileName}`;

  await fileSystem.write(filePath, buffer);

  const assetId = createId('ast');

  await kv.set(`assets:${assetId}`, {
    id: assetId,
    userId,
    tur: type,
    dosya_adi: fileName,
    fs_path: filePath,
    created_at: new Date().toISOString(),
    source_job_id: sourceJobId || null,
  });

  return { assetId, url: `/api/assets/${assetId}` };
}

/* FINALIZE LOCK */
async function acquireJobLock(jobId: string) {
  const key = `joblock:${jobId}`;
  const existing = await kv.get(key);
  if (existing) return false;
  await kv.set(key, true);
  return true;
}

export const aiService = {

  async finalizeCompletedJob(job: StoredJob, sync: any) {

    const lock = await acquireJobLock(job.id);
    if (!lock) return job;

    if (job.creditCommitted > 0) {
      return job;
    }

    let output = job.outputUrl || null;
    let outputAssetId = job.outputAssetId || null;

    if (sync.outputBase64) {
      const saved = await writeAssetFromBuffer(
        job.userId,
        'video',
        Buffer.from(sync.outputBase64, 'base64'),
        'mp4',
        job.id
      );
      output = saved.url;
      outputAssetId = saved.assetId;
    }

    if (!output) {
      fail('Output asset yazılamadı', 'ASSET_WRITE_FAILED');
    }

    await kv.set(`aiJob:${job.id}`, {
      ...job,
      status: 'completed',
      outputUrl: output,
      outputAssetId,
      creditCommitted: job.creditReserved,
      completedAt: new Date().toISOString(),
    });

    return job;
  },

  async runFeature(input: {
    feature: AIFeature;
    userId: string;
    modelId?: string;
    clientRequestId?: string;
    payload: Record<string, unknown>;
  }) {

    const requestId = createRequestId('req');
    const clientRequestId = normalizeClientRequestId(input.clientRequestId);

    const runtimeInput: OwnerRuntimeCall = {
      feature: input.feature,
      userId: input.userId,
      modelId: input.modelId || 'default',
      requestId,
      clientRequestId,
      payload: input.payload,
    };

    if (input.feature === 'image') {

      try {

        const runtime = await callOwnerRuntime<any>('image', runtimeInput);

        const base64Image = runtime.base64Image || runtime.imageBase64;

        if (!base64Image) {
          fail('Görsel üretilemedi', 'OWNER_RUNTIME_CALL_FAILED');
        }

        const asset = await writeAssetFromBuffer(
          input.userId,
          'image',
          Buffer.from(base64Image, 'base64'),
          'png'
        );

        return { ...asset, requestId };

      } catch (error: any) {

        /* BUG FIX */
        await kv.set(`image_error:${requestId}`, {
          feature: 'image',
          userId: input.userId,
          error: error.message,
        });

        throw error;
      }

    }

    if (input.feature === 'chat') {

      const runtime = await callOwnerRuntime<any>('chat', runtimeInput);

      return {
        response: runtime.response || runtime.text || '',
        requestId,
      };

    }

    if (input.feature === 'tts') {

      const runtime = await callOwnerRuntime<any>('tts', runtimeInput);

      const base64Audio = runtime.base64Audio || runtime.audioBase64;

      if (!base64Audio) {
        fail('Ses üretilemedi', 'OWNER_RUNTIME_CALL_FAILED');
      }

      const asset = await writeAssetFromBuffer(
        input.userId,
        'audio',
        Buffer.from(base64Audio, 'base64'),
        'mp3'
      );

      return { ...asset, requestId };

    }

    const runtime = await callOwnerRuntime<any>('video', runtimeInput);

    if (!runtime.jobId && !runtime.providerJobId) {
      fail('Video işi başlatılamadı', 'OWNER_RUNTIME_CALL_FAILED');
    }

    return {
      jobId: runtime.jobId || runtime.providerJobId,
      requestId,
    };

  }

};

