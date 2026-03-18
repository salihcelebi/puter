// ===============================
// src/lib/aiWorkers.ts
// AMG/AMH adapter katmanı: Chat sayfası worker detaylarını bilmeden çalışır.
// ===============================

export const AMG_ENDPOINTS = Object.freeze({
  modeller: '/api/modeller',
  sohbet: '/api/sohbet',
  sohbetAkis: '/api/sohbet/akis',
  gorsel: '/api/gorsel',
});

export const AMH_ENDPOINT = '/api/calistir';
export const CREDIT_RATE = 200;

export type WorkerEnvelope<T> = {
  ok: boolean;
  code?: string;
  data?: T;
  veri?: T;
  error?: {
    type?: string;
    message?: string;
    details?: unknown;
    retryable?: boolean;
  } | string | null;
  hata?: {
    mesaj?: string;
    detay?: unknown;
  } | string | null;
  meta?: unknown;
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

export interface ImageResultPayload {
  url: string;
  assetId?: string;
  requestId?: string;
  modelId?: string;
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

function envelopeErrorMessage(parsed: any) {
  return (
    parsed?.error?.message ||
    parsed?.error ||
    parsed?.hata?.mesaj ||
    parsed?.hata ||
    'Worker isteği başarısız oldu.'
  );
}

async function readJson(response: Response) {
  const raw = await response.text();
  if (!raw.trim()) {
    throw buildWorkerError('Worker boş yanıt döndü.');
  }

  try {
    return JSON.parse(raw) as Record<string, any>;
  } catch {
    throw buildWorkerError('Worker geçerli JSON döndürmedi.');
  }
}

function unwrapData<T>(parsed: any): T {
  // Bu adapter, AMG/AMH response zarfındaki data/veri farkını tek noktada normalize eder.
  const payload = parsed?.veri ?? parsed?.data;
  return payload as T;
}

function assertOk(response: Response, parsed: any) {
  const ok = parsed?.ok !== false;
  if (!response.ok || !ok) {
    throw buildWorkerError(envelopeErrorMessage(parsed));
  }
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

function mapChatPayload(payload: ChatRequestPayload) {
  return {
    model: payload.model,
    messages: payload.messages,
    prompt: payload.prompt,
    stream: Boolean(payload.stream),
    temperature: payload.temperature,
    maxTokens: payload.maxTokens,
    // Bu adapter, temperature/maxTokens => sicaklik/azamiToken eşlemesini görünür kılar.
    sicaklik: payload.temperature,
    azamiToken: payload.maxTokens,
    tools: payload.tools,
    meta: payload.meta,
  };
}

function normalizeChatResult(parsed: any, fallbackModel: string): ChatResultPayload {
  const data = unwrapData<any>(parsed) || {};
  const outputText =
    data?.outputText ||
    data?.ciktiMetni ||
    data?.text ||
    data?.cevap ||
    data?.result ||
    '';

  const rawMessages = (data?.messages || data?.mesajlar || []) as ChatWorkerMessage[];

  return {
    type: 'chat.result',
    model: data?.model || fallbackModel,
    stream: false,
    outputText,
    messages: Array.isArray(rawMessages) ? rawMessages : [],
    toolCalls: Array.isArray(data?.toolCalls) ? data.toolCalls : [],
    raw: data,
  };
}

export async function fetchModelCatalog(query: ModelCatalogQuery = {}): Promise<ModelCatalogPayload> {
  const qs = toQueryString(query);
  const url = qs ? `${AMG_ENDPOINTS.modeller}?${qs}` : AMG_ENDPOINTS.modeller;
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
    },
  });

  const parsed = await readJson(response);
  assertOk(response, parsed);
  return unwrapData<ModelCatalogPayload>(parsed);
}

export async function fetchChatModelById(modelId: string): Promise<ModelCatalogItem | null> {
  const payload = await fetchModelCatalog({
    modelId,
    limit: 1,
  });

  return payload.items[0] ?? null;
}

export async function sendChatWorker(payload: ChatRequestPayload): Promise<ChatResultPayload> {
  const mapped = mapChatPayload(payload);

  // Bu katman chat için önce AMG sözleşmesini dener, başarısız olursa AMH orkestrasyonuna düşer.
  const primary = await fetch(AMG_ENDPOINTS.sohbet, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(mapped),
  });

  const parsedPrimary = await readJson(primary);
  if (primary.ok && parsedPrimary?.ok !== false) {
    return normalizeChatResult(parsedPrimary, payload.model);
  }

  const fallback = await fetch(AMH_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      serviceType: 'CHAT',
      hizmetTuru: 'CHAT',
      ...mapped,
    }),
  });

  const parsedFallback = await readJson(fallback);
  assertOk(fallback, parsedFallback);
  return normalizeChatResult(parsedFallback, payload.model);
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
  const response = await fetch(AMG_ENDPOINTS.sohbetAkis, {
    method: 'POST',
    headers: {
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      ...mapChatPayload(payload),
      stream: true,
    }),
    signal: handlers.signal,
  });

  if (!response.ok || !response.body) {
    const fallbackResult = await sendChatWorker({ ...payload, stream: false });
    handlers.onReady?.({ type: 'chat.stream.ready', model: fallbackResult.model, stream: true });
    handlers.onChunk?.({
      type: 'chat.stream.chunk',
      chunkIndex: 0,
      deltaText: fallbackResult.outputText,
      toolCalls: fallbackResult.toolCalls,
      raw: fallbackResult.raw,
    });
    handlers.onDone?.({
      type: 'chat.stream.done',
      model: fallbackResult.model,
      stream: true,
      outputText: fallbackResult.outputText,
      chunkCount: 1,
    });
    return;
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

    if (parsed.ok === false) {
      handlers.onError?.(buildWorkerError(envelopeErrorMessage(parsed)));
      return;
    }

    const data = unwrapData<any>(parsed) || {};
    // Bu mapping, hazir/parca/bitti eventlerinin ready/chunk/done ile eşlenmesini tek noktada çözer.
    if (frame.event === 'hazir' || frame.event === 'ready') {
      handlers.onReady?.({
        type: 'chat.stream.ready',
        model: data?.model || payload.model,
        stream: true,
      });
      return;
    }

    if (frame.event === 'parca' || frame.event === 'chunk') {
      handlers.onChunk?.({
        type: 'chat.stream.chunk',
        chunkIndex: Number(data?.chunkIndex ?? data?.parcaIndex ?? 0),
        deltaText: String(data?.deltaText ?? data?.parcaMetni ?? data?.text ?? ''),
        toolCalls: Array.isArray(data?.toolCalls) ? data.toolCalls : [],
        raw: data,
      });
      return;
    }

    if (frame.event === 'bitti' || frame.event === 'done') {
      handlers.onDone?.({
        type: 'chat.stream.done',
        model: data?.model || payload.model,
        stream: true,
        outputText: String(data?.outputText ?? data?.ciktiMetni ?? data?.text ?? ''),
        chunkCount: Number(data?.chunkCount ?? data?.parcaSayisi ?? 0),
      });
      return;
    }

    if (frame.event === 'hata' || frame.event === 'error' || frame.event === 'warning') {
      handlers.onError?.(buildWorkerError(envelopeErrorMessage(parsed)));
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

export async function generateImageWorker(payload: {
  prompt: string;
  modelId?: string;
  clientRequestId?: string;
}): Promise<ImageResultPayload> {
  const primary = await fetch(AMG_ENDPOINTS.gorsel, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const parsedPrimary = await readJson(primary);
  if (primary.ok && parsedPrimary?.ok !== false) {
    const data = unwrapData<any>(parsedPrimary) || {};
    return {
      url: data?.url || data?.imageUrl || '',
      assetId: data?.assetId,
      requestId: data?.requestId,
      modelId: data?.modelId || payload.modelId,
    };
  }

  const fallback = await fetch(AMH_ENDPOINT, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      serviceType: 'IMG',
      hizmetTuru: 'IMG',
      ...payload,
    }),
  });

  const parsedFallback = await readJson(fallback);
  assertOk(fallback, parsedFallback);
  const data = unwrapData<any>(parsedFallback) || {};

  return {
    url: data?.url || data?.imageUrl || '',
    assetId: data?.assetId,
    requestId: data?.requestId,
    modelId: data?.modelId || payload.modelId,
  };
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
