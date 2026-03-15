/*
█████████████████████████████████████████████
1) BU DOSYA, PROJENİN ANA KEY-VALUE VERİ KATMANIDIR VE ÇOK SAYIDA SUNUCU VERİSİNİN TEK MERKEZDEN YÖNETİLMESİNİ SAĞLAR.
2) DOSYA, NODE FILE SYSTEM ÜZERİNDE ÇALIŞAN KALICI BİR DEPOLAMA ADAPTÖRÜ GİBİ DAVRANIR.
3) getWritableBaseDir VE isServerlessRuntime KULLANIMI SAYESİNDE HEM NORMAL SUNUCUDA HEM SERVERLESS ORTAMDA UYUMLU ÇALIŞIR.
4) KvValue TİPİ, İLİŞKİSİZ GİBİ GÖRÜNEN VERİLERİN AYNI DEPO İÇİNDE GÜVENLİ ŞEKİLDE SAKLANMASINA İZİN VERİR.
5) DOSYA SADECE BASİT ANAHTAR-DEĞER TUTMAZ; AYNI ZAMANDA AI JOB KAYITLARINI DA YAPISAL OLARAK YÖNETİR.
6) AiJobFeature TİPİ, İŞLERİ image, video, photo-to-video, tts, chat VE generic OLARAK SINIFLANDIRIR.
7) AiJobStatus TİPİ, İŞ AKIŞINI queued, processing, completed, failed VE cancelled DURUMLARIYLA TAKİP EDER.
8) JobErrorInfo YAPISI, BİR İŞ HATA VERDİĞİNDE KOD, MESAJ, RETRY BİLGİSİ VE DETAYLARI TUTAR.
9) RequestSummary YAPISI, PROMPT, MODEL VE İSTEK ÖZETİ GİBİ ALANLARLA HAFİF BİR İZ SÜRME KATMANI SAĞLAR.
10) DOSYADA JOB INDEX YAPISI BULUNUR; YANİ SADECE TEK KAYIT DEĞİL, TARİHÇE VE FİLTRELENEBİLİR İNDİSLER DE YÖNETİLİR.
11) kv.json DOSYASI, BU MODÜLÜN DISK ÜZERİNDE KULLANDIĞI FİZİKSEL SNAPSHOT DEPOSUDUR.
12) BU MODÜL, KULLANICI, ASSET, AI JOB VE DİĞER UYGULAMA VERİLERİNİ AYNI SOYUTLAMA ALTINDA TUTMAK İÇİN TASARLANMIŞTIR.
13) list BENZERİ FONKSİYONLAR SAYESİNDE PREFIX TABANLI TARAMA YAPILABİLİR VE BU, ROUTE DOSYALARINDA YOĞUN ŞEKİLDE KULLANILIR.
14) get KULLANIMI, TEK BİR KEY ÜZERİNDEN DOĞRUDAN VERİ OKUMA YAPAR.
15) set TARZI YAZMA AKIŞI, VERİYİ SADECE RAM'DE DEĞİL DISK ÜZERİNDE DE KALICI HALE GETİRMEYİ AMAÇLAR.
16) delete TARZI İŞLEMLER, ANAHTAR BAZLI TEMİZLİK YAPAR VE İLGİLİ İSTATİSTİKLERİ DE ETKİLER.
17) DOSYA İÇİNDE READ / WRITE / DELETE İSTATİSTİĞİ TUTULMASI, VERİTABANI KULLANIMINI GÖZLEMLEMEK İÇİN FAYDALIDIR.
18) JOB ORDER, HISTORY, byFeature, byStatus VE byOwner YAPILARI, AI ÜRETİM SÜRECİNİ RAPORLAMAYA ELVERİŞLİ HALE GETİRİR.
19) BU MODÜLÜN GÜCÜ, AYRI BİR SQL SUNUCUSU OLMADAN UYGULAMANIN İŞ GÖRMESİNİ SAĞLAMASINDADIR.
20) AYNI ZAMANDA BU YAPI, KÜÇÜK VE ORTA ÖLÇEKLİ GELİŞTİRME ORTAMLARINDA DEBUG ETMEYİ KOLAYLAŞTIRIR.
21) AUTH, ADMIN, USER, ASSETS VE AI ROUTE'LARI BU DOSYAYA DOĞRUDAN YA DA DOLAYLI BAĞLIDIR.
22) DOSYA, AI İŞLERİ İÇİN SADECE KAYIT TUTMAZ; DURUM VE SAHİPLİK İNDİSLERİYLE İŞ TAKİBİNİ DE KOLAYLAŞTIRIR.
23) BU YAPI PROJENİN “MERKEZİ SUNUCU HAFIZASI + KALICI SNAPSHOT” MEKANİĞİ GİBİ DÜŞÜNÜLEBİLİR.
24) VERİ KAYBI YAŞANMAMASI İÇİN BU DOSYA, YAZMA SIRASINDA TUTARLILIK SAĞLAMAYA ODAKLANIR.
25) KISACA: BU DOSYA, PROJENİN LOKAL / SERVERLESS UYUMLU, DOSYA TABANLI, İŞ ODAKLI ANA VERİTABANI MOTORUDUR.
█████████████████████████████████████████████
*/


// server/db/kv.ts

import { promises as fs } from 'node:fs';
import path from 'node:path';

import { getWritableBaseDir, isServerlessRuntime } from './runtime.js';

type KvPrimitive = string | number | boolean | null;
export type KvValue =
  | KvPrimitive
  | KvValue[]
  | { [key: string]: KvValue };

export type AiJobFeature =
  | 'image'
  | 'video'
  | 'photo-to-video'
  | 'tts'
  | 'chat'
  | 'generic';

export type AiJobStatus =
  | 'queued'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'cancelled';

export type JobErrorInfo = {
  code?: string;
  message: string;
  retryable?: boolean;
  details?: KvValue | null;
};

export type RequestSummary = {
  prompt?: string;
  promptPreview?: string;
  model?: string;
  modelId?: string;
  ratio?: string;
  size?: string;
  quality?: string;
  n?: number;
  style?: string;
  negativePrompt?: string;
  seed?: number | null;
  guidance?: number | null;
  responseFormat?: string;
  attachmentCount?: number;
  timeoutMs?: number;
  testMode?: boolean;
};

export type AiJobRecord = {
  jobId: string;
  feature: AiJobFeature | string;
  status: AiJobStatus;
  progress: number;
  step: string;
  queuePosition: number | null;
  etaMs: number | null;
  outputUrl: string | null;
  outputUrls: string[];
  output: KvValue | null;
  error: JobErrorInfo | null;
  requestSummary: RequestSummary;
  metadata: Record<string, KvValue>;
  retryable: boolean;
  cancelRequested: boolean;
  cancelReason: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
  expiresAt: string | null;
  ownerId: string | null;
  clientId: string | null;
  requestId: string | null;
  traceId: string | null;
};

type KvItemRecord = {
  key: string;
  value: KvValue;
  createdAt: string;
  updatedAt: string;
  expiresAt: string | null;
  kind: 'generic' | 'job';
};

type KvStats = {
  reads: number;
  writes: number;
  deletes: number;
};

type KvFileSchema = {
  version: number;
  updatedAt: string;
  stats: KvStats;
  items: Record<string, KvItemRecord>;
  jobs: {
    order: string[];
    history: string[];
    byFeature: Record<string, string[]>;
    byStatus: Record<string, string[]>;
    byOwner: Record<string, string[]>;
  };
};

export type ListJobsOptions = {
  feature?: string;
  status?: AiJobStatus | 'all';
  ownerId?: string;
  clientId?: string;
  limit?: number;
  offset?: number;
  newestFirst?: boolean;
};

const KV_JSON_PATH = isServerlessRuntime()
  ? path.join(getWritableBaseDir(), 'data', 'kv.json')
  : path.join(getWritableBaseDir(), '.data', 'kv.json');

export const KV_KEYS = Object.freeze({
  JOB_PREFIX: 'ai_job:',
  CANCEL_PREFIX: 'ai_job_cancel:',
});

const DEFAULT_JOB_TTL_MS = 1000 * 60 * 60 * 24 * 7;
const DEFAULT_HISTORY_LIMIT = 50;

let writeChain: Promise<void> = Promise.resolve();

function nowIso(): string {
  return new Date().toISOString();
}

function toMs(value: string | null | undefined): number {
  if (!value) return 0;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : 0;
}

function clampProgress(value: unknown, fallback = 0): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function toObject(value: unknown): Record<string, KvValue> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, KvValue>;
}

function sanitizeKvValue<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function uniq<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function removeFromArray(items: string[], target: string): string[] {
  return items.filter((item) => item !== target);
}

function ensureArrayBucket(record: Record<string, string[]>, key: string): string[] {
  if (!Array.isArray(record[key])) record[key] = [];
  return record[key];
}

function buildEmptyStore(): KvFileSchema {
  return {
    version: 1,
    updatedAt: nowIso(),
    stats: {
      reads: 0,
      writes: 0,
      deletes: 0,
    },
    items: {},
    jobs: {
      order: [],
      history: [],
      byFeature: {},
      byStatus: {},
      byOwner: {},
    },
  };
}

async function ensureStoreFile(): Promise<void> {
  try {
    await fs.access(KV_JSON_PATH);
  } catch {
    await fs.mkdir(path.dirname(KV_JSON_PATH), { recursive: true });
    await fs.writeFile(KV_JSON_PATH, JSON.stringify(buildEmptyStore(), null, 2), 'utf8');
  }
}

function normalizeStore(input: unknown): KvFileSchema {
  const base = buildEmptyStore();
  const src = toObject(input);

  const items = toObject(src.items);
  const jobs = toObject(src.jobs);
  const stats = toObject(src.stats);

  base.version = typeof src.version === 'number' ? src.version : 1;
  base.updatedAt = typeof src.updatedAt === 'string' && src.updatedAt ? src.updatedAt : nowIso();

  base.stats = {
    reads: Number.isFinite(Number(stats.reads)) ? Number(stats.reads) : 0,
    writes: Number.isFinite(Number(stats.writes)) ? Number(stats.writes) : 0,
    deletes: Number.isFinite(Number(stats.deletes)) ? Number(stats.deletes) : 0,
  };

  for (const [key, rawItem] of Object.entries(items)) {
    const item = toObject(rawItem);
    base.items[key] = {
      key,
      value: (item.value ?? null) as KvValue,
      createdAt: typeof item.createdAt === 'string' && item.createdAt ? item.createdAt : nowIso(),
      updatedAt: typeof item.updatedAt === 'string' && item.updatedAt ? item.updatedAt : nowIso(),
      expiresAt: typeof item.expiresAt === 'string' ? item.expiresAt : null,
      kind: item.kind === 'job' ? 'job' : 'generic',
    };
  }

  base.jobs.order = Array.isArray(jobs.order) ? uniq(jobs.order.map(String)) : [];
  base.jobs.history = Array.isArray(jobs.history) ? uniq(jobs.history.map(String)) : [];

  const byFeature = toObject(jobs.byFeature);
  const byStatus = toObject(jobs.byStatus);
  const byOwner = toObject(jobs.byOwner);

  for (const [key, value] of Object.entries(byFeature)) {
    base.jobs.byFeature[key] = Array.isArray(value) ? uniq(value.map(String)) : [];
  }

  for (const [key, value] of Object.entries(byStatus)) {
    base.jobs.byStatus[key] = Array.isArray(value) ? uniq(value.map(String)) : [];
  }

  for (const [key, value] of Object.entries(byOwner)) {
    base.jobs.byOwner[key] = Array.isArray(value) ? uniq(value.map(String)) : [];
  }

  return base;
}

async function readStore(): Promise<KvFileSchema> {
  await ensureStoreFile();
  const raw = await fs.readFile(KV_JSON_PATH, 'utf8');
  const parsed = raw.trim() ? JSON.parse(raw) : buildEmptyStore();
  const store = normalizeStore(parsed);
  store.stats.reads += 1;
  return store;
}

async function writeStore(store: KvFileSchema): Promise<void> {
  store.updatedAt = nowIso();
  store.stats.writes += 1;

  const payload = JSON.stringify(store, null, 2);
  writeChain = writeChain.then(() => fs.writeFile(KV_JSON_PATH, payload, 'utf8'));
  await writeChain;
}

function isExpired(expiresAt: string | null): boolean {
  return Boolean(expiresAt && toMs(expiresAt) > 0 && toMs(expiresAt) <= Date.now());
}

function makeItemRecord(
  key: string,
  value: KvValue,
  kind: KvItemRecord['kind'] = 'generic',
  ttlMs?: number | null,
): KvItemRecord {
  const now = nowIso();
  const expiresAt =
    typeof ttlMs === 'number' && ttlMs > 0
      ? new Date(Date.now() + ttlMs).toISOString()
      : null;

  return {
    key,
    value: sanitizeKvValue(value),
    createdAt: now,
    updatedAt: now,
    expiresAt,
    kind,
  };
}

function upsertIndex(
  store: KvFileSchema,
  job: AiJobRecord,
  previous?: AiJobRecord | null,
): void {
  const jobKey = getJobKey(job.jobId);

  store.jobs.order = uniq([job.jobId, ...removeFromArray(store.jobs.order, job.jobId)]);
  store.jobs.history = uniq([job.jobId, ...removeFromArray(store.jobs.history, job.jobId)]);

  if (previous) {
    if (previous.feature) {
      store.jobs.byFeature[previous.feature] = removeFromArray(
        ensureArrayBucket(store.jobs.byFeature, previous.feature),
        job.jobId,
      );
    }
    if (previous.status) {
      store.jobs.byStatus[previous.status] = removeFromArray(
        ensureArrayBucket(store.jobs.byStatus, previous.status),
        job.jobId,
      );
    }
    if (previous.ownerId) {
      store.jobs.byOwner[previous.ownerId] = removeFromArray(
        ensureArrayBucket(store.jobs.byOwner, previous.ownerId),
        job.jobId,
      );
    }
  }

  ensureArrayBucket(store.jobs.byFeature, job.feature).unshift(job.jobId);
  ensureArrayBucket(store.jobs.byStatus, job.status).unshift(job.jobId);
  if (job.ownerId) {
    ensureArrayBucket(store.jobs.byOwner, job.ownerId).unshift(job.jobId);
  }

  store.jobs.byFeature[job.feature] = uniq(store.jobs.byFeature[job.feature]);
  store.jobs.byStatus[job.status] = uniq(store.jobs.byStatus[job.status]);
  if (job.ownerId) {
    store.jobs.byOwner[job.ownerId] = uniq(store.jobs.byOwner[job.ownerId]);
  }

  const existing = store.items[jobKey];
  store.items[jobKey] = {
    ...(existing ?? makeItemRecord(jobKey, job as unknown as KvValue, 'job', DEFAULT_JOB_TTL_MS)),
    key: jobKey,
    value: sanitizeKvValue(job as unknown as KvValue),
    updatedAt: nowIso(),
    expiresAt: job.expiresAt ?? existing?.expiresAt ?? new Date(Date.now() + DEFAULT_JOB_TTL_MS).toISOString(),
    kind: 'job',
    createdAt: existing?.createdAt ?? nowIso(),
  };
}

function pruneIndexes(store: KvFileSchema, jobId: string, job?: AiJobRecord | null): void {
  store.jobs.order = removeFromArray(store.jobs.order, jobId);
  store.jobs.history = removeFromArray(store.jobs.history, jobId);

  if (job?.feature) {
    store.jobs.byFeature[job.feature] = removeFromArray(
      ensureArrayBucket(store.jobs.byFeature, job.feature),
      jobId,
    );
  } else {
    for (const feature of Object.keys(store.jobs.byFeature)) {
      store.jobs.byFeature[feature] = removeFromArray(store.jobs.byFeature[feature], jobId);
    }
  }

  if (job?.status) {
    store.jobs.byStatus[job.status] = removeFromArray(
      ensureArrayBucket(store.jobs.byStatus, job.status),
      jobId,
    );
  } else {
    for (const status of Object.keys(store.jobs.byStatus)) {
      store.jobs.byStatus[status] = removeFromArray(store.jobs.byStatus[status], jobId);
    }
  }

  if (job?.ownerId) {
    store.jobs.byOwner[job.ownerId] = removeFromArray(
      ensureArrayBucket(store.jobs.byOwner, job.ownerId),
      jobId,
    );
  } else {
    for (const ownerId of Object.keys(store.jobs.byOwner)) {
      store.jobs.byOwner[ownerId] = removeFromArray(store.jobs.byOwner[ownerId], jobId);
    }
  }
}

function createJobRecord(
  input: Partial<AiJobRecord> & Pick<AiJobRecord, 'jobId'>,
): AiJobRecord {
  const now = nowIso();
  const outputUrls = Array.isArray(input.outputUrls)
    ? input.outputUrls.map(String).filter(Boolean)
    : input.outputUrl
    ? [String(input.outputUrl)]
    : [];

  return {
    jobId: String(input.jobId).trim(),
    feature: (input.feature || 'generic') as AiJobFeature | string,
    status: (input.status || 'queued') as AiJobStatus,
    progress: clampProgress(input.progress, input.status === 'completed' ? 100 : 0),
    step: typeof input.step === 'string' && input.step.trim() ? input.step.trim() : 'queued',
    queuePosition:
      input.queuePosition === null || input.queuePosition === undefined
        ? null
        : Number(input.queuePosition),
    etaMs:
      input.etaMs === null || input.etaMs === undefined
        ? null
        : Number(input.etaMs),
    outputUrl:
      typeof input.outputUrl === 'string' && input.outputUrl.trim()
        ? input.outputUrl.trim()
        : outputUrls[0] || null,
    outputUrls,
    output: (input.output ?? null) as KvValue | null,
    error: input.error
      ? {
          code: input.error.code,
          message: String(input.error.message || 'Bilinmeyen hata'),
          retryable: Boolean(input.error.retryable),
          details: (input.error.details ?? null) as KvValue | null,
        }
      : null,
    requestSummary: sanitizeKvValue(input.requestSummary ?? {}),
    metadata: sanitizeKvValue(input.metadata ?? {}),
    retryable: Boolean(input.retryable),
    cancelRequested: Boolean(input.cancelRequested),
    cancelReason:
      typeof input.cancelReason === 'string' && input.cancelReason.trim()
        ? input.cancelReason.trim()
        : null,
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
    finishedAt: input.finishedAt || null,
    expiresAt:
      input.expiresAt ||
      new Date(Date.now() + DEFAULT_JOB_TTL_MS).toISOString(),
    ownerId:
      typeof input.ownerId === 'string' && input.ownerId.trim()
        ? input.ownerId.trim()
        : null,
    clientId:
      typeof input.clientId === 'string' && input.clientId.trim()
        ? input.clientId.trim()
        : null,
    requestId:
      typeof input.requestId === 'string' && input.requestId.trim()
        ? input.requestId.trim()
        : null,
    traceId:
      typeof input.traceId === 'string' && input.traceId.trim()
        ? input.traceId.trim()
        : null,
  };
}

export function getJobKey(jobId: string): string {
  return `${KV_KEYS.JOB_PREFIX}${String(jobId).trim()}`;
}

export function getCancelKey(jobId: string): string {
  return `${KV_KEYS.CANCEL_PREFIX}${String(jobId).trim()}`;
}

export async function cleanupExpired(): Promise<{ removedKeys: string[]; removedJobs: string[] }> {
  const store = await readStore();
  const removedKeys: string[] = [];
  const removedJobs: string[] = [];

  for (const [key, item] of Object.entries(store.items)) {
    if (!isExpired(item.expiresAt)) continue;

    removedKeys.push(key);

    if (item.kind === 'job' && key.startsWith(KV_KEYS.JOB_PREFIX)) {
      const raw = item.value as AiJobRecord;
      const jobId = raw?.jobId || key.slice(KV_KEYS.JOB_PREFIX.length);
      removedJobs.push(jobId);
      pruneIndexes(store, jobId, raw);
    }

    delete store.items[key];
  }

  if (removedKeys.length > 0) {
    await writeStore(store);
  }

  return { removedKeys, removedJobs };
}

export const kv = {
  async get(key: string): Promise<any | null> {
    await cleanupExpired();
    const store = await readStore();
    const item = store.items[key];
    if (!item) return null;
    if (isExpired(item.expiresAt)) return null;
    return sanitizeKvValue(item.value);
  },

  async getJson<T = KvValue>(key: string): Promise<T | null> {
    return kv.get(key) as Promise<T | null>;
  },

  async set(key: string, value: KvValue, options?: { ttlMs?: number | null; kind?: KvItemRecord['kind'] }): Promise<void> {
    await cleanupExpired();
    const store = await readStore();
    const existing = store.items[key];
    const next = makeItemRecord(key, value, options?.kind ?? existing?.kind ?? 'generic', options?.ttlMs ?? null);

    if (existing) {
      next.createdAt = existing.createdAt;
    }

    store.items[key] = next;
    await writeStore(store);
  },

  async del(key: string): Promise<boolean> {
    await cleanupExpired();
    const store = await readStore();
    const current = store.items[key];
    if (!current) return false;

    if (current.kind === 'job' && key.startsWith(KV_KEYS.JOB_PREFIX)) {
      const raw = current.value as AiJobRecord;
      const jobId = raw?.jobId || key.slice(KV_KEYS.JOB_PREFIX.length);
      pruneIndexes(store, jobId, raw);
    }

    delete store.items[key];
    store.stats.deletes += 1;
    await writeStore(store);
    return true;
  },

  async has(key: string): Promise<boolean> {
    return (await kv.get(key)) !== null;
  },

  async keys(prefix = ''): Promise<string[]> {
    await cleanupExpired();
    const store = await readStore();
    return Object.keys(store.items).filter((key) => key.startsWith(prefix));
  },

  async entries(prefix = ''): Promise<Array<{ key: string; value: KvValue }>> {
    await cleanupExpired();
    const store = await readStore();
    return Object.values(store.items)
      .filter((item) => item.key.startsWith(prefix) && !isExpired(item.expiresAt))
      .map((item) => ({
        key: item.key,
        value: sanitizeKvValue(item.value),
      }));
  },

  async rawStore(): Promise<KvFileSchema> {
    await cleanupExpired();
    return readStore();
  },

  async list(prefix = ''): Promise<Array<{ key: string; value: any }>> {
    await cleanupExpired();
    const store = await readStore();
    return Object.values(store.items)
      .filter((item) => item.key.startsWith(prefix) && !isExpired(item.expiresAt))
      .map((item) => ({
        key: item.key,
        value: sanitizeKvValue(item.value),
      }));
  },

  async delete(key: string): Promise<boolean> {
    return kv.del(key);
  },
};

export async function getJob(jobId: string): Promise<AiJobRecord | null> {
  return kv.getJson<AiJobRecord>(getJobKey(jobId));
}

export async function upsertJob(
  input: Partial<AiJobRecord> & Pick<AiJobRecord, 'jobId'>,
): Promise<AiJobRecord> {
  await cleanupExpired();
  const store = await readStore();
  const previous = store.items[getJobKey(input.jobId)]?.value as AiJobRecord | undefined;
  const next = createJobRecord({
    ...(previous ?? {}),
    ...input,
    jobId: input.jobId,
    updatedAt: nowIso(),
  });

  if (next.status === 'completed') {
    next.progress = 100;
    next.finishedAt = next.finishedAt || nowIso();
    next.step = next.step || 'completed';
  }

  if (next.status === 'failed' || next.status === 'cancelled') {
    next.finishedAt = next.finishedAt || nowIso();
  }

  upsertIndex(store, next, previous ?? null);
  await writeStore(store);
  return next;
}

export async function createJob(
  input: Partial<AiJobRecord> & Pick<AiJobRecord, 'jobId'>,
): Promise<AiJobRecord> {
  const existing = await getJob(input.jobId);
  if (existing) {
    return upsertJob({
      ...existing,
      ...input,
      jobId: input.jobId,
    });
  }

  return upsertJob({
    feature: 'image',
    status: 'queued',
    progress: 0,
    step: 'queued',
    retryable: true,
    ...input,
  });
}

export async function markJobQueued(
  jobId: string,
  patch: Partial<AiJobRecord> = {},
): Promise<AiJobRecord> {
  return upsertJob({
    jobId,
    status: 'queued',
    progress: clampProgress(patch.progress, 0),
    step: patch.step || 'queued',
    ...patch,
  });
}

export async function markJobProcessing(
  jobId: string,
  patch: Partial<AiJobRecord> = {},
): Promise<AiJobRecord> {
  return upsertJob({
    jobId,
    status: 'processing',
    progress: clampProgress(patch.progress, 10),
    step: patch.step || 'processing',
    ...patch,
  });
}

export async function markJobCompleted(
  jobId: string,
  patch: Partial<AiJobRecord> = {},
): Promise<AiJobRecord> {
  const outputUrls = Array.isArray(patch.outputUrls)
    ? patch.outputUrls
    : patch.outputUrl
    ? [patch.outputUrl]
    : undefined;

  return upsertJob({
    jobId,
    status: 'completed',
    progress: 100,
    step: patch.step || 'completed',
    finishedAt: nowIso(),
    outputUrls,
    ...patch,
  });
}

export async function markJobFailed(
  jobId: string,
  error: JobErrorInfo,
  patch: Partial<AiJobRecord> = {},
): Promise<AiJobRecord> {
  return upsertJob({
    jobId,
    status: 'failed',
    step: patch.step || 'failed',
    finishedAt: nowIso(),
    retryable: Boolean(error.retryable),
    error,
    ...patch,
  });
}

export async function requestJobCancel(
  jobId: string,
  reason = 'Kullanıcı iptal istedi.',
): Promise<AiJobRecord | null> {
  const current = await getJob(jobId);
  if (!current) return null;

  await kv.set(
    getCancelKey(jobId),
    {
      jobId,
      requestedAt: nowIso(),
      reason,
    },
    { ttlMs: DEFAULT_JOB_TTL_MS, kind: 'generic' },
  );

  return upsertJob({
    ...current,
    jobId,
    cancelRequested: true,
    cancelReason: reason,
    step: current.status === 'processing' ? 'cancel_requested' : current.step,
    updatedAt: nowIso(),
  });
}

export async function markJobCancelled(
  jobId: string,
  reason = 'İş iptal edildi.',
  patch: Partial<AiJobRecord> = {},
): Promise<AiJobRecord> {
  const current = await getJob(jobId);
  return upsertJob({
    ...(current ?? {}),
    ...patch,
    jobId,
    status: 'cancelled',
    step: patch.step || 'cancelled',
    finishedAt: nowIso(),
    cancelRequested: true,
    cancelReason: reason,
    error:
      patch.error ??
      ({
        code: 'JOB_CANCELLED',
        message: reason,
        retryable: false,
        details: null,
      } as JobErrorInfo),
  });
}

export async function isCancelRequested(jobId: string): Promise<boolean> {
  return kv.has(getCancelKey(jobId));
}

export async function clearCancelRequest(jobId: string): Promise<void> {
  await kv.del(getCancelKey(jobId));
}

export async function listJobs(options: ListJobsOptions = {}): Promise<{
  total: number;
  items: AiJobRecord[];
  limit: number;
  offset: number;
  hasMore: boolean;
}> {
  await cleanupExpired();
  const store = await readStore();

  const limit = Math.max(1, Math.min(200, Number(options.limit ?? DEFAULT_HISTORY_LIMIT)));
  const offset = Math.max(0, Number(options.offset ?? 0));
  const newestFirst = options.newestFirst !== false;

  let ids = [...store.jobs.order];
  if (!newestFirst) ids = ids.reverse();

  const jobs = ids
    .map((jobId) => store.items[getJobKey(jobId)]?.value as AiJobRecord | undefined)
    .filter(Boolean)
    .filter((job) => {
      if (options.feature && job.feature !== options.feature) return false;
      if (options.status && options.status !== 'all' && job.status !== options.status) return false;
      if (options.ownerId && job.ownerId !== options.ownerId) return false;
      if (options.clientId && job.clientId !== options.clientId) return false;
      return true;
    });

  const sliced = jobs.slice(offset, offset + limit);

  return {
    total: jobs.length,
    items: sanitizeKvValue(sliced),
    limit,
    offset,
    hasMore: offset + limit < jobs.length,
  };
}

export async function getJobHistory(options: Omit<ListJobsOptions, 'status'> & { status?: AiJobStatus | 'all' } = {}) {
  return listJobs(options);
}

export async function resetKv(): Promise<void> {
  const empty = buildEmptyStore();
  await writeStore(empty);
}

export default kv;
