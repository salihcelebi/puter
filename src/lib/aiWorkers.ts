// ===============================
// src/lib/aiWorkers.ts
// Bu yardımcı katman, katalog ve chat worker sözleşmesini tek yerde toplar.
// ===============================
export const CHAT_WORKER_URL = 'https://chat.puter.work/chat';
export const MODEL_WORKER_URL = 'https://models-worker.puter.work/models';
export const CREDIT_RATE = 200;

export type WorkerEnvelope<T> = {
  ok: boolean;
  code: string;
  data: T;
  error?: {
    type?: string;
    message?: string;
    details?: unknown;
    retryable?: boolean;
  } | null;
  meta?: unknown;
  requestId?: string;
  traceId?: string;
};

export type CatalogSortKey =
  | 'name_asc'
  | 'name_desc'
  | 'company_asc'
  | 'company_desc'
  | 'input_price_asc'
  | 'input_price_desc'
  | 'output_price_asc'
  | 'output_price_desc'
  | 'image_price_asc'
  | 'image_price_desc'
  | 'speed_desc'
  | 'speed_asc';

export interface ModelCatalogItem {
  id: string;
  company: string;
  provider: string;
  modelName: string;
  modelId: string;
  categoryRaw: string;
  badges: string[];
  parameters: string;
  speedLabel: string;
  speedScore: number;
  prices: {
    input: number | null;
    output: number | null;
    image: number | null;
  };
  traits: string[];
  standoutFeature: string;
  useCase: string;
  rivalAdvantage: string;
  sourceUrl: string;
  style: {
    brandKey: string;
    accent: string;
  };
}

export interface ModelCatalogPayload {
  items: ModelCatalogItem[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  facets: {
    companies: string[];
    badges: string[];
    categories: string[];
  };
  source: {
    type: string;
    totalModels: number;
    sourceUrl: string;
  };
  filters: {
    search: string;
    company: string;
    badge: string;
    category: string;
    sort: CatalogSortKey;
    modelId: string;
  };
}

export interface ModelCatalogQuery {
  search?: string;
  company?: string;
  badge?: string;
  category?: string;
  sort?: CatalogSortKey;
  limit?: number;
  offset?: number;
  modelId?: string;
}

export interface ChatWorkerMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequestPayload {
  model: string;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
  tools?: unknown[];
  messages?: ChatWorkerMessage[];
  prompt?: string;
  meta?: Record<string, unknown>;
}

export interface ChatResultPayload {
  type: 'chat.result';
  model: string;
  stream: false;
  outputText: string;
  messages: ChatWorkerMessage[];
  toolCalls: unknown[];
  raw: unknown;
}

export interface ChatStreamReadyPayload {
  type: 'chat.stream.ready';
  model: string;
  stream: true;
}

export interface ChatStreamChunkPayload {
  type: 'chat.stream.chunk';
  chunkIndex: number;
  deltaText: string;
  toolCalls: unknown[];
  raw: unknown;
}

export interface ChatStreamDonePayload {
  type: 'chat.stream.done';
  model: string;
  stream: true;
  outputText: string;
  chunkCount: number;
}

type SseHandlers = {
  signal?: AbortSignal;
  onReady?: (payload: ChatStreamReadyPayload) => void;
  onChunk?: (payload: ChatStreamChunkPayload) => void;
  onDone?: (payload: ChatStreamDonePayload) => void;
  onError?: (error: Error) => void;
};

function buildWorkerError(message: string) {
  return new Error(message || 'Worker isteği başarısız oldu.');
}

async function readJsonResponse<T>(response: Response): Promise<WorkerEnvelope<T>> {
  const raw = await response.text();

  if (!raw.trim()) {
    throw buildWorkerError('Worker boş yanıt döndü.');
  }

  let parsed: WorkerEnvelope<T>;
  try {
    parsed = JSON.parse(raw) as WorkerEnvelope<T>;
  } catch {
    throw buildWorkerError('Worker geçerli JSON döndürmedi.');
  }

  if (!response.ok || !parsed.ok) {
    throw buildWorkerError(parsed?.error?.message || 'Worker isteği başarısız oldu.');
  }

  return parsed;
}

function toQueryString(params: ModelCatalogQuery) {
  const search = new URLSearchParams();

  if (params.search) search.set('search', params.search);
  if (params.company) search.set('company', params.company);
  if (params.badge) search.set('badge', params.badge);
  if (params.category) search.set('category', params.category);
  if (params.sort) search.set('sort', params.sort);
  if (typeof params.limit === 'number') search.set('limit', String(params.limit));
  if (typeof params.offset === 'number') search.set('offset', String(params.offset));
  if (params.modelId) search.set('modelId', params.modelId);

  return search.toString();
}

export async function fetchModelCatalog(query: ModelCatalogQuery = {}): Promise<ModelCatalogPayload> {
  const qs = toQueryString(query);
  const url = qs ? `${MODEL_WORKER_URL}?${qs}` : MODEL_WORKER_URL;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const parsed = await readJsonResponse<ModelCatalogPayload>(response);
  return parsed.data;
}

export async function fetchChatModelById(modelId: string): Promise<ModelCatalogItem | null> {
  const payload = await fetchModelCatalog({
    modelId,
    limit: 1,
  });

  return payload.items[0] ?? null;
}

export async function sendChatWorker(payload: ChatRequestPayload): Promise<ChatResultPayload> {
  const response = await fetch(CHAT_WORKER_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const parsed = await readJsonResponse<ChatResultPayload>(response);
  return parsed.data;
}

type ParsedSseFrame = {
  event: string;
  data: string;
};

function parseSseFrame(frame: string): ParsedSseFrame | null {
  const trimmed = frame.trim();
  if (!trimmed) return null;

  const lines = trimmed.split('\n');
  let event = 'message';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice('event:'.length).trim();
      continue;
    }
    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trim());
    }
  }

  return {
    event,
    data: dataLines.join('\n'),
  };
}

export async function streamChatWorker(payload: ChatRequestPayload, handlers: SseHandlers): Promise<void> {
  const response = await fetch(CHAT_WORKER_URL, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...payload,
      stream: true,
    }),
    signal: handlers.signal,
  });

  if (!response.ok) {
    const parsed = await readJsonResponse<unknown>(response);
    throw buildWorkerError(parsed.error?.message || 'Stream başlatılamadı.');
  }

  if (!response.body) {
    throw buildWorkerError('Stream gövdesi alınamadı.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  const handleParsedFrame = (frame: ParsedSseFrame | null) => {
    if (!frame?.data) return;

    let parsed: WorkerEnvelope<any>;
    try {
      parsed = JSON.parse(frame.data) as WorkerEnvelope<any>;
    } catch {
      return;
    }

    if (!parsed.ok) {
      handlers.onError?.(buildWorkerError(parsed.error?.message || 'Stream sırasında hata oluştu.'));
      return;
    }

    if (frame.event === 'ready') {
      handlers.onReady?.(parsed.data as ChatStreamReadyPayload);
      return;
    }

    if (frame.event === 'chunk') {
      handlers.onChunk?.(parsed.data as ChatStreamChunkPayload);
      return;
    }

    if (frame.event === 'done') {
      handlers.onDone?.(parsed.data as ChatStreamDonePayload);
      return;
    }

    if (frame.event === 'error' || frame.event === 'warning') {
      handlers.onError?.(buildWorkerError(parsed.error?.message || 'Stream sırasında hata oluştu.'));
    }
  };

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    while (buffer.includes('\n\n')) {
      const boundary = buffer.indexOf('\n\n');
      const rawFrame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      handleParsedFrame(parseSseFrame(rawFrame));
    }
  }

  if (buffer.trim()) {
    handleParsedFrame(parseSseFrame(buffer));
  }
}

export function priceToCredits(price: number | null) {
  if (price === null || Number.isNaN(price)) return null;
  return Math.round(price * CREDIT_RATE);
}

export function formatUsd(value: number | null) {
  if (value === null || Number.isNaN(value)) return '-';
  return `$${value.toFixed(value >= 10 ? 2 : 3)}`;
}

export function formatCredits(value: number | null) {
  const credits = priceToCredits(value);
  return credits === null ? '-' : `${credits} kr`;
}

export function summarizeModel(model: ModelCatalogItem) {
  return `${model.company} • ${model.modelName}`;
}

