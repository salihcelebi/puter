// ===============================
// src/pages/AI/Chat.tsx
// Bu ekran, seçilen modeli worker chat endpoint’ine bağlar ve stream destekler.
// ===============================
import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import AIStudioHeader from '../../components/AIStudioHeader';
import {
  fetchChatModelById,
  formatCredits,
  formatUsd,
  ModelCatalogItem,
  sendChatWorker,
  streamChatWorker,
  ChatWorkerMessage,
  ChatStreamChunkPayload,
  ChatStreamDonePayload,
} from '../../lib/aiWorkers';

const CHAT_MODEL_SESSION_KEY = 'nisai:selected-chat-model';

type UIMessage = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  pending?: boolean;
  error?: boolean;
};

type ChatLocationState = {
  selectedModel?: ModelCatalogItem;
};

const PROMPT_SUGGESTIONS = [
  'Bu model için kısa bir ürün stratejisi çıkar.',
  'Verilen metni 5 maddede özetle.',
  'Bir toplantı notunu eylem planına çevir.',
];

function createMessageId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeConversation(messages: UIMessage[]): ChatWorkerMessage[] {
  return messages
    .filter((message) => Boolean(message.content.trim()))
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as ChatLocationState | null;

  const sessionModel = useMemo(() => {
    try {
      const raw = sessionStorage.getItem(CHAT_MODEL_SESSION_KEY);
      return raw ? (JSON.parse(raw) as ModelCatalogItem) : null;
    } catch {
      return null;
    }
  }, []);

  const initialModel = locationState?.selectedModel ?? sessionModel ?? null;
  const initialModelId = searchParams.get('model') || initialModel?.modelId || '';

  const [selectedModel, setSelectedModel] = useState<ModelCatalogItem | null>(initialModel);
  const [loadingModel, setLoadingModel] = useState(!initialModel && Boolean(initialModelId));
  const [modelError, setModelError] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streamMode, setStreamMode] = useState(true);
  const [sending, setSending] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'ready' | 'streaming' | 'done' | 'error'>('idle');

  const abortRef = useRef<AbortController | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    if (!selectedModel && !initialModelId) {
      setLoadingModel(false);
      return;
    }

    if (selectedModel && selectedModel.modelId === initialModelId) {
      sessionStorage.setItem(CHAT_MODEL_SESSION_KEY, JSON.stringify(selectedModel));
      return;
    }

    let mounted = true;

    const loadModel = async () => {
      try {
        setLoadingModel(true);
        setModelError('');

        const model = await fetchChatModelById(initialModelId);

        if (!mounted) return;

        if (!model) {
          setModelError('Seçilen model bulunamadı. Lütfen katalogdan yeniden seçim yap.');
          setSelectedModel(null);
          return;
        }

        setSelectedModel(model);
        sessionStorage.setItem(CHAT_MODEL_SESSION_KEY, JSON.stringify(model));
      } catch (error) {
        if (!mounted) return;
        setModelError(error instanceof Error ? error.message : 'Model bilgisi çözümlenemedi.');
      } finally {
        if (mounted) setLoadingModel(false);
      }
    };

    loadModel();

    return () => {
      mounted = false;
    };
  }, [initialModelId, selectedModel]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const usageCount = Math.floor(messages.filter((message) => message.role === 'user').length);

  const updateAssistantMessage = (assistantId: string, updater: (prev: UIMessage) => UIMessage) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== assistantId) return message;
        return updater(message);
      }),
    );
  };

  const handleStop = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setStreamStatus('idle');
    setMessages((prev) =>
      prev.map((message) =>
        message.pending
          ? {
              ...message,
              pending: false,
            }
          : message,
      ),
    );
  };

  const handleSend = async () => {
    if (!user) {
      navigate('/giris', { replace: true, state: { from: { pathname: '/sohbet/konus' } } });
      return;
    }

    const trimmed = draft.trim();
    if (!trimmed || sending || !selectedModel) return;

    const userMessage: UIMessage = {
      id: createMessageId('user'),
      role: 'user',
      content: trimmed,
    };

    const assistantMessageId = createMessageId('assistant');
    const assistantPlaceholder: UIMessage = {
      id: assistantMessageId,
      role: 'assistant',
      content: '',
      pending: true,
    };

    const nextConversation = normalizeConversation([...messages, userMessage]);

    setMessages((prev) => [...prev, userMessage, assistantPlaceholder]);
    setDraft('');
    setSending(true);
    setStreamStatus(streamMode ? 'ready' : 'idle');

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      if (streamMode) {
        await streamChatWorker(
          {
            model: selectedModel.modelId,
            stream: true,
            messages: nextConversation,
            temperature: 0.7,
            maxTokens: 1200,
            meta: {
              source: 'chat.tsx',
              page: 'sohbet/konus',
            },
          },
          {
            signal: controller.signal,
            onReady: () => {
              setStreamStatus('ready');
            },
            onChunk: (payload: ChatStreamChunkPayload) => {
              setStreamStatus('streaming');
              updateAssistantMessage(assistantMessageId, (prev) => ({
                ...prev,
                content: `${prev.content}${payload.deltaText || ''}`,
                pending: true,
              }));
            },
            onDone: (payload: ChatStreamDonePayload) => {
              setStreamStatus('done');
              updateAssistantMessage(assistantMessageId, (prev) => ({
                ...prev,
                content: payload.outputText || prev.content,
                pending: false,
              }));
            },
            onError: (error) => {
              setStreamStatus('error');
              updateAssistantMessage(assistantMessageId, (prev) => ({
                ...prev,
                pending: false,
                error: true,
                content: prev.content || error.message,
              }));
            },
          },
        );
      } else {
        const result = await sendChatWorker({
          model: selectedModel.modelId,
          stream: false,
          messages: nextConversation,
          temperature: 0.7,
          maxTokens: 1200,
          meta: {
            source: 'chat.tsx',
            page: 'sohbet/konus',
          },
        });

        updateAssistantMessage(assistantMessageId, (prev) => ({
          ...prev,
          content: result.outputText || 'Yanıt boş geldi.',
          pending: false,
        }));
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        updateAssistantMessage(assistantMessageId, (prev) => ({
          ...prev,
          pending: false,
          content: prev.content || 'İstek durduruldu.',
        }));
      } else {
        const message = error instanceof Error ? error.message : 'Sohbet isteği başarısız oldu.';
        setStreamStatus('error');
        updateAssistantMessage(assistantMessageId, () => ({
          id: assistantMessageId,
          role: 'assistant',
          content: message,
          pending: false,
          error: true,
        }));
        toast.error(message);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const canSend = Boolean(draft.trim()) && Boolean(selectedModel) && !sending;

  return (
    <div className="mx-auto flex max-w-[1440px] flex-col gap-6">
      <AIStudioHeader />

      <div className="grid gap-6 xl:grid-cols-[1.55fr_0.85fr]">
        <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#05070f] text-white">
          <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/5 px-5 py-5 md:px-7">
            <div>
              <button
                onClick={() => navigate('/sohbet')}
                className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs font-bold uppercase tracking-[0.18em] text-zinc-300 hover:text-white"
              >
                ← Kataloğa dön
              </button>
              <div className="text-[11px] font-bold uppercase tracking-[0.24em] text-zinc-500">Seçili model</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight">
                {loadingModel ? 'Model yükleniyor…' : selectedModel ? selectedModel.modelName : 'Model seçilmedi'}
              </h1>
              <p className="mt-2 text-sm text-zinc-400">
                {selectedModel ? `${selectedModel.company} • ${selectedModel.categoryRaw}` : modelError || 'Sohbet açmak için katalogdan model seç.'}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStreamMode(true)}
                className={[
                  'rounded-full border px-4 py-2 text-sm font-semibold transition',
                  streamMode
                    ? 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300'
                    : 'border-white/10 bg-white/[0.03] text-zinc-300',
                ].join(' ')}
              >
                Stream
              </button>
              <button
                onClick={() => setStreamMode(false)}
                className={[
                  'rounded-full border px-4 py-2 text-sm font-semibold transition',
                  !streamMode
                    ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-300'
                    : 'border-white/10 bg-white/[0.03] text-zinc-300',
                ].join(' ')}
              >
                Normal
              </button>
              {sending && (
                <button
                  onClick={handleStop}
                  className="rounded-full border border-red-400/20 bg-red-400/10 px-4 py-2 text-sm font-semibold text-red-300"
                >
                  Durdur
                </button>
              )}
            </div>
          </div>

          <div className="flex min-h-[680px] flex-col px-5 py-5 md:px-7">
            <div className="mb-5 flex flex-wrap gap-2">
              {PROMPT_SUGGESTIONS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => setDraft(prompt)}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1.5 text-xs text-zinc-300 hover:text-white"
                >
                  {prompt}
                </button>
              ))}
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto pr-2">
              {!loadingModel && !selectedModel && (
                <div className="rounded-[24px] border border-white/10 bg-white/[0.03] p-8 text-center">
                  <div className="text-xl font-bold">Önce bir model seç</div>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">{modelError || 'Katalog ekranına dönerek sohbet modeli seç.'}</p>
                </div>
              )}

              {messages.length === 0 && selectedModel && (
                <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.03] p-8 text-center">
                  <div className="text-xl font-bold">Sohbet hazır</div>
                  <p className="mt-3 text-sm leading-7 text-zinc-400">
                    Mesajın worker contract’a `messages + model + stream` mantığıyla gönderilir.
                  </p>
                </div>
              )}

              {messages.map((message) => (
                <div key={message.id} className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={[
                      'max-w-[88%] rounded-[24px] px-5 py-4 text-sm leading-7 shadow-sm',
                      message.role === 'user'
                        ? 'bg-emerald-500 text-[#04110d]'
                        : message.error
                        ? 'border border-red-400/20 bg-red-400/10 text-red-100'
                        : 'border border-white/10 bg-white/[0.04] text-zinc-100',
                    ].join(' ')}
                  >
                    <div className="mb-2 text-[11px] font-bold uppercase tracking-[0.18em] opacity-70">
                      {message.role === 'user' ? 'Kullanıcı' : 'Asistan'}
                    </div>
                    <div className="whitespace-pre-wrap">{message.content || (message.pending ? 'Yanıt hazırlanıyor…' : '')}</div>
                    {message.pending && (
                      <div className="mt-3 flex items-center gap-2 text-xs text-zinc-400">
                        <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-300" />
                        {streamMode ? 'Akış sürüyor' : 'Yanıt bekleniyor'}
                      </div>
                    )}
                  </div>
                </div>
              ))}

              <div ref={bottomRef} />
            </div>

            <div className="mt-5 rounded-[28px] border border-white/10 bg-white/[0.03] p-3">
              <textarea
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' && !event.shiftKey) {
                    event.preventDefault();
                    if (canSend) handleSend();
                  }
                }}
                placeholder={selectedModel ? 'Mesajını yaz. Enter gönderir, Shift+Enter alt satır açar.' : 'Önce katalogdan model seç.'}
                disabled={!selectedModel || loadingModel}
                className="min-h-[120px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-7 text-white outline-none placeholder:text-zinc-500"
              />

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-white/5 px-3 pt-3">
                <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                  <span>Mesaj sayısı: {usageCount}</span>
                  <span>Akış: {streamMode ? streamStatus : 'kapalı'}</span>
                </div>

                <button
                  onClick={handleSend}
                  disabled={!canSend}
                  className="rounded-full border border-emerald-400/20 bg-emerald-400/10 px-5 py-2.5 text-sm font-semibold text-emerald-300 transition hover:bg-emerald-400/15 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Gönder
                </button>
              </div>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#05070f] text-white">
            <div className="border-b border-white/5 px-5 py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              Model detayı
            </div>
            <div className="p-5">
              {selectedModel ? (
                <>
                  <div className="text-[11px] font-bold uppercase tracking-[0.22em]" style={{ color: selectedModel.style.accent }}>
                    {selectedModel.company}
                  </div>
                  <div className="mt-2 text-2xl font-black tracking-tight">{selectedModel.modelName}</div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedModel.badges.map((badge) => (
                      <span
                        key={badge}
                        className="rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-[0.18em]"
                        style={{ borderColor: `${selectedModel.style.accent}40`, color: selectedModel.style.accent }}
                      >
                        {badge}
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Girdi</div>
                      <div className="mt-2 text-lg font-black">{formatCredits(selectedModel.prices.input)}</div>
                      <div className="mt-1 text-xs text-zinc-400">{formatUsd(selectedModel.prices.input)}</div>
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                      <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-zinc-500">Çıktı</div>
                      <div className="mt-2 text-lg font-black">{formatCredits(selectedModel.prices.output)}</div>
                      <div className="mt-1 text-xs text-zinc-400">{formatUsd(selectedModel.prices.output)}</div>
                    </div>
                  </div>

                  <div className="mt-5 space-y-4 text-sm leading-7 text-zinc-300">
                    <div>
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Öne çıkan</div>
                      <p>{selectedModel.standoutFeature}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Kullanım</div>
                      <p>{selectedModel.useCase}</p>
                    </div>
                    <div>
                      <div className="mb-1 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">Avantaj</div>
                      <p>{selectedModel.rivalAdvantage}</p>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-sm leading-7 text-zinc-400">Model bilgisi yüklenmedi.</div>
              )}
            </div>
          </div>

          <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#05070f] text-white">
            <div className="border-b border-white/5 px-5 py-4 text-[11px] font-bold uppercase tracking-[0.22em] text-zinc-500">
              Durum paneli
            </div>
            <div className="space-y-3 p-5 text-sm">
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-zinc-400">Stream modu</span>
                <span className={streamMode ? 'text-emerald-300' : 'text-zinc-300'}>
                  {streamMode ? 'Açık' : 'Kapalı'}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-zinc-400">Akış durumu</span>
                <span
                  className={
                    streamStatus === 'error'
                      ? 'text-red-300'
                      : streamStatus === 'streaming'
                      ? 'text-cyan-300'
                      : streamStatus === 'done'
                      ? 'text-emerald-300'
                      : 'text-zinc-300'
                  }
                >
                  {streamStatus}
                </span>
              </div>
              <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                <span className="text-zinc-400">Toplam tur</span>
                <span className="text-zinc-200">{usageCount}</span>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
