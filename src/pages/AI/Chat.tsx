import { useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import toast from 'react-hot-toast';
import { fetchApiJson } from '../../lib/apiClient';
import {
  fetchModelCatalog,
  ModelCatalogItem,
  ChatWorkerMessage,
  sendChatWorker,
  streamChatWorker,
  ChatStreamChunkPayload,
  ChatStreamDonePayload,
} from '../../lib/aiWorkers';

const CHAT_MODEL_SESSION_KEY = 'nisai:selected-chat-model';

type UIMessage = {
  id: string;
  role: 'user' | 'assistant';
  label: string;
  content: string;
  pending?: boolean;
  error?: boolean;
  kind?: 'text' | 'image';
  imageUrl?: string;
};

type ChatLocationState = {
  selectedModel?: ModelCatalogItem;
};

type ImageResponse = {
  url: string;
  assetId: string;
  requestId?: string;
  modelId?: string;
};

type SpeechRecognitionInstance = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onstart: null | (() => void);
  onend: null | (() => void);
  onerror: null | (() => void);
  onresult: null | ((event: any) => void);
  start: () => void;
  stop: () => void;
};

function createMessageId(prefix: string) {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(text: string) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatContent(text: string) {
  const escaped = escapeHtml(String(text || '').trim());
  if (!escaped) return '';

  const blocks = escaped.split(/\n\n+/);

  return blocks
    .map((block) => {
      const lines = block.split('\n').filter(Boolean);
      const bulletLines = lines.filter((line) => /^•\s/.test(line));

      if (bulletLines.length === lines.length && bulletLines.length > 0) {
        return `<ul>${bulletLines.map((line) => `<li>${line.replace(/^•\s/, '')}</li>`).join('')}</ul>`;
      }

      return `<div>${block.replace(/\n/g, '<br>')}</div>`;
    })
    .join('');
}

function normalizeConversation(messages: UIMessage[]): ChatWorkerMessage[] {
  return messages
    .filter((message) => message.kind !== 'image')
    .filter((message) => Boolean(message.content.trim()))
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
}

function isChatModel(model: ModelCatalogItem) {
  const bag = [
    model.categoryRaw,
    model.provider,
    model.company,
    model.modelName,
    model.modelId,
    model.standoutFeature,
    model.useCase,
    model.rivalAdvantage,
    ...(model.badges || []),
    ...(model.traits || []),
  ]
    .join(' ')
    .toLocaleLowerCase('tr');

  return (
    !bag.includes('image generation') &&
    !bag.includes('txt2img') &&
    !bag.includes('görsel üretim') &&
    (bag.includes('chat') ||
      bag.includes('llm') ||
      bag.includes('assistant') ||
      model.prices.input !== null ||
      model.prices.output !== null)
  );
}

function isImageModel(model: ModelCatalogItem) {
  const bag = [
    model.categoryRaw,
    model.provider,
    model.company,
    model.modelName,
    model.modelId,
    model.standoutFeature,
    model.useCase,
    model.rivalAdvantage,
    ...(model.badges || []),
    ...(model.traits || []),
  ]
    .join(' ')
    .toLocaleLowerCase('tr');

  return (
    model.prices.image !== null ||
    bag.includes('image') ||
    bag.includes('txt2img') ||
    bag.includes('görsel') ||
    bag.includes('image generation')
  );
}

function getInitialSessionModel() {
  try {
    const raw = sessionStorage.getItem(CHAT_MODEL_SESSION_KEY);
    return raw ? (JSON.parse(raw) as ModelCatalogItem) : null;
  } catch {
    return null;
  }
}

function getSpeechRecognitionCtor() {
  if (typeof window === 'undefined') return null;
  const win = window as any;
  return win.SpeechRecognition || win.webkitSpeechRecognition || null;
}

function BackArrowIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M14.5 5.5L8 12l6.5 6.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function DotsIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <circle cx="5" cy="12" r="2" />
      <circle cx="12" cy="12" r="2" />
      <circle cx="19" cy="12" r="2" />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M12 15a4 4 0 0 0 4-4V7a4 4 0 1 0-8 0v4a4 4 0 0 0 4 4Z" stroke="currentColor" strokeWidth="2" />
      <path d="M5 11a7 7 0 0 0 14 0M12 18v3M8.5 21h7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ImageIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="5" width="16" height="14" rx="3" stroke="currentColor" strokeWidth="2" />
      <circle cx="9" cy="10" r="1.6" fill="currentColor" />
      <path
        d="M7 16l3.2-3.2a1.4 1.4 0 0 1 2 0l1.4 1.4a1.4 1.4 0 0 0 2 0L17 13l3 3"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SpeakIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M5 14h3l5 4V6l-5 4H5v4Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M16 9a4 4 0 0 1 0 6M18 7a7 7 0 0 1 0 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M4 12h14" stroke="white" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M12 5l7 7-7 7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function StopSquareIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="currentColor" aria-hidden="true">
      <rect x="2" y="2" width="10" height="10" rx="2" />
    </svg>
  );
}

function ModelPickerPopover({
  open,
  models,
  selectedModelId,
  onSelect,
}: {
  open: boolean;
  models: ModelCatalogItem[];
  selectedModelId?: string;
  onSelect: (model: ModelCatalogItem) => void;
}) {
  const providers = useMemo(() => {
    const groups = new Map<string, ModelCatalogItem[]>();

    for (const model of models) {
      const key = model.provider || model.company || 'Diğer';
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(model);
    }

    return Array.from(groups.entries())
      .map(([provider, items]) => ({
        provider,
        items: [...items].sort((a, b) => a.modelName.localeCompare(b.modelName, 'tr')),
      }))
      .sort((a, b) => a.provider.localeCompare(b.provider, 'tr'));
  }, [models]);

  const [activeProvider, setActiveProvider] = useState<string>(providers[0]?.provider || '');

  useEffect(() => {
    if (!providers.some((group) => group.provider === activeProvider)) {
      setActiveProvider(providers[0]?.provider || '');
    }
  }, [providers, activeProvider]);

  const activeGroup = providers.find((group) => group.provider === activeProvider) || providers[0];

  if (!open) return null;

  return (
    <div className="model-picker-popover" role="dialog" aria-label="Model değiştir">
      <div className="model-picker-columns">
        <div className="model-picker-sidebar">
          <div className="model-picker-title">Sağlayıcılar</div>
          <div className="model-provider-list">
            {providers.map((group) => (
              <button
                key={group.provider}
                type="button"
                onMouseEnter={() => setActiveProvider(group.provider)}
                onFocus={() => setActiveProvider(group.provider)}
                onClick={() => setActiveProvider(group.provider)}
                className={`model-provider-item ${group.provider === activeProvider ? 'active' : ''}`}
              >
                <span>{group.provider}</span>
                <span className="model-provider-count">{group.items.length}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="model-picker-main">
          <div className="model-picker-title">{activeGroup ? `${activeGroup.provider} modelleri` : 'Modeller'}</div>
          <div className="model-picker-models">
            {activeGroup?.items.map((model) => (
              <button
                key={model.modelId}
                type="button"
                onClick={() => onSelect(model)}
                className={`model-select-card ${selectedModelId === model.modelId ? 'active' : ''}`}
              >
                <div className="model-select-card-top">
                  <div className="model-select-name">{model.modelName}</div>
                  <div className="model-select-badge">{model.categoryRaw || 'CHAT'}</div>
                </div>
                <div className="model-select-id">{model.modelId}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Chat() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const locationState = location.state as ChatLocationState | null;

  const initialSessionModel = useMemo(() => getInitialSessionModel(), []);
  const initialModelId =
    searchParams.get('model') ||
    locationState?.selectedModel?.modelId ||
    initialSessionModel?.modelId ||
    '';

  const [selectedModel, setSelectedModel] = useState<ModelCatalogItem | null>(locationState?.selectedModel ?? initialSessionModel ?? null);
  const [chatModels, setChatModels] = useState<ModelCatalogItem[]>([]);
  const [imageModels, setImageModels] = useState<ModelCatalogItem[]>([]);
  const [loadingModel, setLoadingModel] = useState(true);
  const [modelError, setModelError] = useState('');
  const [messages, setMessages] = useState<UIMessage[]>([]);
  const [draft, setDraft] = useState('');
  const [streamMode, setStreamMode] = useState(true);
  const [sending, setSending] = useState(false);
  const [imageGenerating, setImageGenerating] = useState(false);
  const [streamStatus, setStreamStatus] = useState<'idle' | 'ready' | 'streaming' | 'done' | 'error'>('idle');
  const [showModelPicker, setShowModelPicker] = useState(false);
  const [lastAssistantText, setLastAssistantText] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const modelPickerRef = useRef<HTMLDivElement | null>(null);
  const bottomRef = useRef<HTMLDivElement | null>(null);
  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    let mounted = true;

    const loadCatalog = async () => {
      try {
        setLoadingModel(true);
        setModelError('');

        const payload = await fetchModelCatalog({
          badge: 'CHAT',
          limit: 250,
          sort: 'company_asc',
        });

        if (!mounted) return;

        const loadedChatModels = payload.items.filter(isChatModel);
        const loadedImageModels = payload.items.filter(isImageModel);

        setChatModels(loadedChatModels);
        setImageModels(loadedImageModels);

        const nextSelected =
          loadedChatModels.find((item) => item.modelId === initialModelId) ||
          loadedChatModels.find((item) => item.modelId === selectedModel?.modelId) ||
          loadedChatModels[0] ||
          null;

        setSelectedModel(nextSelected);

        if (nextSelected) {
          sessionStorage.setItem(CHAT_MODEL_SESSION_KEY, JSON.stringify(nextSelected));
        } else {
          setModelError('Seçilen model bulunamadı. Lütfen katalogdan yeniden seçim yap.');
        }
      } catch (error) {
        if (!mounted) return;
        setModelError(error instanceof Error ? error.message : 'Model bilgisi çözümlenemedi.');
      } finally {
        if (mounted) setLoadingModel(false);
      }
    };

    loadCatalog();

    return () => {
      mounted = false;
    };
  }, [initialModelId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  useEffect(() => {
    const textarea = promptRef.current;
    if (!textarea) return;
    textarea.style.height = '34px';
    textarea.style.height = `${Math.min(textarea.scrollHeight, 220)}px`;
  }, [draft]);

  useEffect(() => {
    const ctor = getSpeechRecognitionCtor();
    if (!ctor) return;

    const recognition = new ctor() as SpeechRecognitionInstance;
    recognition.lang = 'tr-TR';
    recognition.continuous = false;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognition.onerror = () => {
      setIsRecording(false);
    };

    recognition.onresult = (event: any) => {
      let transcript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        transcript += event.results[i][0].transcript;
      }
      setDraft(transcript.trim());
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.stop();
      recognitionRef.current = null;
    };
  }, []);

  useEffect(() => {
    const handleOutside = (event: MouseEvent) => {
      if (!modelPickerRef.current) return;
      if (!modelPickerRef.current.contains(event.target as Node)) {
        setShowModelPicker(false);
      }
    };

    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
    };
  }, []);

  const shouldHideModelPanel = messages.some((message) => message.role === 'user');

  const selectedImageModel = useMemo(() => {
    return imageModels[0] ?? null;
  }, [imageModels]);

  const updateAssistantMessage = (assistantId: string, updater: (prev: UIMessage) => UIMessage) => {
    setMessages((prev) =>
      prev.map((message) => {
        if (message.id !== assistantId) return message;
        return updater(message);
      }),
    );
  };

  const stopStreaming = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSending(false);
    setImageGenerating(false);
    setStreamStatus('idle');

    setMessages((prev) =>
      prev.map((message) =>
        message.pending
          ? {
              ...message,
              pending: false,
              content: message.content || 'İstek durduruldu.',
            }
          : message,
      ),
    );
  };

  const ensureAuth = () => {
    if (user) return true;
    navigate('/giris', { replace: true, state: { from: { pathname: '/sohbet/konus' } } });
    return false;
  };

  const handleSelectModel = (model: ModelCatalogItem) => {
    setSelectedModel(model);
    sessionStorage.setItem(CHAT_MODEL_SESSION_KEY, JSON.stringify(model));
    setShowModelPicker(false);
    toast.success(`${model.modelName} seçildi.`);
  };

  const toggleMic = () => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    if (isRecording) recognition.stop();
    else recognition.start();
  };

  const insertImageCommand = () => {
    setDraft((prev) => {
      const trimmed = prev.trim();
      if (/^\/görsel\b/i.test(trimmed)) return prev;
      return trimmed ? `/görsel ${trimmed}` : '/görsel ';
    });

    setTimeout(() => {
      const textarea = promptRef.current;
      if (!textarea) return;
      textarea.focus();
      const end = textarea.value.length;
      textarea.setSelectionRange(end, end);
    }, 0);
  };

  const speakLastAssistantText = () => {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) return;
    if (!lastAssistantText) return;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(lastAssistantText);
    utterance.lang = 'tr-TR';
    utterance.rate = 1;
    utterance.pitch = 1;
    window.speechSynthesis.speak(utterance);
  };

  const handleImageCommand = async (rawValue: string) => {
    if (!ensureAuth()) return;
    if (!selectedImageModel) {
      toast.error('Görsel modeli bulunamadı.');
      return;
    }

    const prompt = rawValue.replace(/^\/görsel\s*/i, '').trim();
    if (!prompt) return;
    if (imageGenerating) return;

    const userMessage: UIMessage = {
      id: createMessageId('user'),
      role: 'user',
      label: 'Kullanıcı sorusu',
      content: rawValue,
      kind: 'text',
    };

    const assistantId = createMessageId('assistant');
    const placeholder: UIMessage = {
      id: assistantId,
      role: 'assistant',
      label: 'Seçili model cevabı',
      content: 'Görsel hazırlanıyor...',
      kind: 'image',
      pending: true,
    };

    setMessages((prev) => [...prev, userMessage, placeholder]);
    setDraft('');
    setImageGenerating(true);

    try {
      const result = await fetchApiJson<ImageResponse>('/api/ai/image', {
        method: 'POST',
        body: JSON.stringify({
          prompt,
          modelId: selectedImageModel.id,
          clientRequestId: `image_${Date.now()}`,
        }),
      });

      setLastAssistantText('Görsel üretimi tamamlandı.');

      updateAssistantMessage(assistantId, (prev) => ({
        ...prev,
        pending: false,
        content: prompt,
        imageUrl: result.url,
        kind: 'image',
      }));
    } catch (error: any) {
      const message = error?.message || 'Görsel üretimi başarısız oldu.';
      updateAssistantMessage(assistantId, (prev) => ({
        ...prev,
        pending: false,
        error: true,
        kind: 'text',
        content: message,
      }));
      toast.error(message);
    } finally {
      setImageGenerating(false);
    }
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
      label: 'Kullanıcı sorusu',
      content: value,
      kind: 'text',
    };

    const assistantMessageId = createMessageId('assistant');
    const assistantPlaceholder: UIMessage = {
      id: assistantMessageId,
      role: 'assistant',
      label: 'Seçili model cevabı',
      content: '',
      pending: true,
      kind: 'text',
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
              setLastAssistantText(payload.outputText || '');
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

        setLastAssistantText(result.outputText || '');
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
          label: 'Seçili model cevabı',
          content: message,
          pending: false,
          error: true,
          kind: 'text',
        }));
        toast.error(message);
      }
    } finally {
      setSending(false);
      abortRef.current = null;
    }
  };

  const canSend = Boolean(draft.trim()) && Boolean(selectedModel) && !sending && !imageGenerating;

  return (
    <>
      <style>{`
        :root {
          --bg: #f3f4f6;
          --panel: #ffffff;
          --line: #e5e7eb;
          --line-soft: #eceef2;
          --text: #202123;
          --muted: #6b7280;
          --muted-2: #8b919b;
          --green: #10a37f;
          --green-soft: #e7f7f2;
          --chip: #f3f4f6;
          --user-bubble: #eef7f3;
          --assistant-bubble: #ffffff;
          --shadow: 0 12px 32px rgba(17, 24, 39, 0.05);
        }

        * { box-sizing: border-box; }
        html, body { height: 100%; }

        .chat-page-shell {
          margin: 0;
          min-height: 100vh;
          font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
          background: radial-gradient(circle at top, #f7f7f8 0%, #f1f3f5 45%, #eef0f2 100%);
          color: var(--text);
          padding: 22px;
        }

        .chat-app {
          max-width: 1340px;
          height: calc(100vh - 44px);
          min-height: 860px;
          margin: 0 auto;
          background: var(--panel);
          border: 1px solid #e8eaee;
          border-radius: 22px;
          box-shadow: var(--shadow);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        .topbar {
          height: 74px;
          border-bottom: 1px solid var(--line);
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 0 22px 0 24px;
          background: rgba(255,255,255,0.94);
          flex-shrink: 0;
        }

        .brand {
          font-size: 28px;
          font-weight: 900;
          letter-spacing: 0.2px;
          color: #1f2937;
          min-width: 150px;
        }

        .nav {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: flex-start;
          gap: 28px;
          padding-left: 8px;
        }

        .nav a {
          position: relative;
          text-decoration: none;
          color: #3b4452;
          font-size: 18px;
          font-weight: 500;
          padding: 24px 0 22px;
        }

        .nav a.active {
          font-weight: 700;
          color: #202123;
        }

        .nav a.active::after {
          content: "";
          position: absolute;
          left: 0;
          right: 0;
          bottom: -1px;
          height: 4px;
          border-radius: 999px 999px 0 0;
          background: rgba(16, 163, 127, 0.85);
        }

        .top-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .ghost-button {
          height: 40px;
          padding: 0 16px;
          border-radius: 999px;
          border: 1px solid var(--line);
          background: #f8f9fb;
          color: #4b5563;
          font-size: 15px;
          font-weight: 600;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
        }

        .ghost-button svg { flex: 0 0 auto; }

        .stop-top { display: none; }

        .stop-top.active {
          display: inline-flex;
          color: #b42318;
          background: #fff1f2;
          border-color: #fecdd3;
        }

        .content {
          display: flex;
          flex-direction: column;
          min-height: 0;
          flex: 1;
          background: linear-gradient(180deg, #f9fafb 0%, #f7f7f8 100%);
        }

        .back-row {
          padding: 18px 22px;
          border-bottom: 1px solid var(--line-soft);
          background: rgba(255,255,255,0.42);
          flex-shrink: 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          position: relative;
        }

        .back-actions {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          width: 100%;
        }

        .primary-button {
          height: 46px;
          padding: 0 20px;
          border-radius: 999px;
          border: 1px solid #bfe8da;
          background: linear-gradient(180deg, #15b38b 0%, #10a37f 100%);
          color: #ffffff;
          font-size: 15px;
          font-weight: 800;
          display: inline-flex;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          box-shadow: 0 10px 24px rgba(16, 163, 127, 0.18);
          white-space: nowrap;
        }

        .primary-button:hover {
          filter: brightness(0.98);
        }

        .page-body {
          flex: 1;
          min-height: 0;
          display: flex;
          flex-direction: column;
        }

        .model-card {
          margin: 14px 22px 0;
          border: 1px solid var(--line);
          border-radius: 28px;
          background: linear-gradient(180deg, #ffffff 0%, #fbfbfc 100%);
          padding: 22px 24px;
          box-shadow: 0 6px 14px rgba(17, 24, 39, 0.02);
          flex-shrink: 0;
        }

        .eyebrow {
          font-size: 17px;
          line-height: 1.3;
          font-weight: 700;
          color: #404854;
          margin-bottom: 16px;
        }

        .model-box-row {
          display: flex;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 16px;
        }

        .model-info-box {
          min-height: 52px;
          padding: 14px 18px;
          border-radius: 18px;
          border: 1px solid #e5e7eb;
          background: #f8fafc;
          color: #1f2937;
          display: inline-flex;
          align-items: center;
          font-weight: 700;
          letter-spacing: -0.01em;
          box-shadow: inset 0 1px 0 rgba(255,255,255,0.85);
        }

        .model-info-box.provider,
        .model-info-box.category {
          font-size: 16px;
          text-transform: uppercase;
          letter-spacing: 0.08em;
        }

        .model-info-box.name {
          font-size: 24px;
          font-weight: 600;
          text-transform: none;
          letter-spacing: -0.02em;
        }

        .detail-stack {
          display: grid;
          gap: 12px;
        }

        .detail-card {
          border: 1px solid #e8eaee;
          border-radius: 20px;
          background: #ffffff;
          padding: 16px 18px;
        }

        .detail-title {
          font-size: 13px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b7280;
          margin-bottom: 8px;
        }

        .detail-text {
          font-size: 17px;
          line-height: 1.55;
          color: #202123;
        }

        .messages {
          flex: 1;
          min-height: 0;
          overflow-y: auto;
          padding: 14px 22px 18px;
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        .message-row { display: flex; }
        .message-row.user { justify-content: flex-end; }
        .message-row.assistant { justify-content: flex-start; }

        .message-bubble {
          max-width: min(980px, 78%);
          border-radius: 26px;
          border: 1px solid var(--line);
          background: var(--assistant-bubble);
          padding: 18px 22px;
          box-shadow: 0 3px 8px rgba(17, 24, 39, 0.02);
        }

        .message-row.user .message-bubble {
          background: var(--user-bubble);
          border-color: #dcefe8;
        }

        .message-label {
          font-size: 14px;
          font-weight: 700;
          color: #4a7f76;
          margin-bottom: 10px;
        }

        .message-row.user .message-label { color: #3f675e; }

        .message-content {
          font-size: 18px;
          line-height: 1.6;
          color: #262b33;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .message-content ul {
          margin: 10px 0 0 18px;
          padding: 0;
        }

        .message-content li + li { margin-top: 8px; }

        .typing {
          display: inline-flex;
          align-items: center;
          gap: 7px;
          padding-top: 2px;
        }

        .typing span {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #7c8797;
          animation: pulse 1.15s infinite ease-in-out;
        }

        .typing span:nth-child(2) { animation-delay: 0.15s; }
        .typing span:nth-child(3) { animation-delay: 0.3s; }

        @keyframes pulse {
          0%, 80%, 100% { opacity: 0.32; transform: scale(0.84); }
          40% { opacity: 1; transform: scale(1); }
        }

        .composer-shell {
          border-top: 1px solid var(--line);
          background: rgba(255,255,255,0.88);
          padding: 12px 18px 14px;
          flex-shrink: 0;
        }

        .hint {
          color: #6b7280;
          font-size: 15px;
          line-height: 1.45;
          padding: 0 6px 10px;
        }

        .composer {
          display: flex;
          align-items: flex-end;
          gap: 10px;
          border: 1px solid #d8dce4;
          background: #ffffff;
          border-radius: 28px;
          padding: 10px 12px 10px 14px;
          box-shadow: 0 2px 8px rgba(17, 24, 39, 0.03);
        }

        .composer textarea {
          flex: 1;
          border: none;
          outline: none;
          resize: none;
          background: transparent;
          color: var(--text);
          font: inherit;
          font-size: 18px;
          line-height: 1.5;
          min-height: 34px;
          max-height: 220px;
          padding: 8px 2px 6px;
        }

        .composer textarea::placeholder { color: #8b919b; }

        .composer-actions {
          display: flex;
          align-items: center;
          gap: 8px;
          padding-bottom: 2px;
        }

        .icon-button,
        .send-button,
        .stop-button {
          width: 46px;
          height: 46px;
          border-radius: 50%;
          border: 1px solid transparent;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: 0.18s ease;
          flex: 0 0 auto;
        }

        .icon-button {
          background: #f4f5f7;
          border-color: #e5e7eb;
          color: #4b5563;
        }

        .icon-button:hover { background: #eef1f4; }

        .icon-button.recording {
          background: #fff1f2;
          border-color: #fecdd3;
          color: #be123c;
        }

        .send-button {
          background: var(--green);
          color: white;
          width: 56px;
          height: 56px;
          box-shadow: 0 10px 22px rgba(16, 163, 127, 0.22);
        }

        .send-button:hover {
          transform: translateY(-1px);
          box-shadow: 0 12px 26px rgba(16, 163, 127, 0.26);
        }

        .send-button:disabled {
          opacity: 0.45;
          cursor: not-allowed;
          transform: none;
          box-shadow: none;
        }

        .stop-button {
          display: none;
          background: #ffffff;
          color: #111827;
          border-color: #d8dce4;
          position: relative;
        }

        .stop-button.active { display: inline-flex; }

        .stop-button::before {
          content: "";
          width: 14px;
          height: 14px;
          background: #111827;
          border-radius: 4px;
          display: block;
        }

        .image-card {
          width: 100%;
          max-width: 560px;
          border-radius: 20px;
          overflow: hidden;
          border: 1px solid #d8e8e1;
          background: linear-gradient(135deg, #dff8ef 0%, #f4fbf8 48%, #e6f0ff 100%);
          padding: 18px;
        }

        .image-preview {
          aspect-ratio: 16 / 10;
          border-radius: 16px;
          background:
            radial-gradient(circle at 22% 24%, rgba(16,163,127,0.24), transparent 28%),
            radial-gradient(circle at 74% 30%, rgba(99,102,241,0.18), transparent 26%),
            linear-gradient(135deg, rgba(255,255,255,0.96), rgba(239,244,247,0.94));
          border: 1px solid rgba(255,255,255,0.8);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #40615a;
          font-size: 16px;
          font-weight: 600;
          text-align: center;
          padding: 18px;
          overflow: hidden;
        }

        .image-preview img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          border-radius: 12px;
        }

        .image-caption {
          margin-top: 12px;
          font-size: 15px;
          line-height: 1.5;
          color: #49615c;
        }

        .model-picker-anchor {
          position: absolute;
          right: 22px;
          top: calc(100% + 8px);
          z-index: 30;
        }

        .model-picker-popover {
          width: 720px;
          max-width: calc(100vw - 64px);
          background: #ffffff;
          border: 1px solid #e6e9ef;
          border-radius: 22px;
          box-shadow: 0 24px 60px rgba(17, 24, 39, 0.12);
          overflow: hidden;
        }

        .model-picker-columns {
          display: grid;
          grid-template-columns: 220px minmax(0, 1fr);
          min-height: 340px;
        }

        .model-picker-sidebar {
          border-right: 1px solid #eceef2;
          background: #fafbfc;
          padding: 16px;
        }

        .model-picker-main {
          padding: 16px;
          background: #ffffff;
        }

        .model-picker-title {
          font-size: 12px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          color: #6b7280;
          margin-bottom: 12px;
        }

        .model-provider-list,
        .model-picker-models {
          display: grid;
          gap: 8px;
        }

        .model-provider-item {
          width: 100%;
          min-height: 46px;
          border: 1px solid transparent;
          background: transparent;
          border-radius: 14px;
          padding: 0 14px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 10px;
          color: #364152;
          font-size: 15px;
          font-weight: 700;
          cursor: pointer;
        }

        .model-provider-item:hover,
        .model-provider-item.active {
          background: #f5f7fa;
          border-color: #e7eaf0;
        }

        .model-provider-count {
          color: #8b919b;
          font-size: 12px;
          font-weight: 800;
        }

        .model-select-card {
          width: 100%;
          border: 1px solid #e8eaee;
          background: #ffffff;
          border-radius: 18px;
          padding: 14px 16px;
          text-align: left;
          cursor: pointer;
        }

        .model-select-card:hover,
        .model-select-card.active {
          border-color: #bfe8da;
          background: #f8fcfa;
        }

        .model-select-card-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 6px;
        }

        .model-select-name {
          color: #202123;
          font-size: 16px;
          font-weight: 700;
        }

        .model-select-badge {
          border-radius: 999px;
          border: 1px solid #e5e7eb;
          background: #f8f9fb;
          color: #6b7280;
          font-size: 11px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          padding: 6px 10px;
          white-space: nowrap;
        }

        .model-select-id {
          color: #8b919b;
          font-size: 13px;
          word-break: break-all;
        }

        @media (max-width: 1100px) {
          .message-bubble { max-width: 88%; }
          .nav { gap: 18px; }
          .nav a { font-size: 17px; }
        }

        @media (max-width: 820px) {
          .chat-page-shell { padding: 10px; }
          .chat-app {
            height: calc(100vh - 20px);
            min-height: auto;
            border-radius: 16px;
          }
          .topbar {
            height: auto;
            padding: 14px;
            gap: 14px;
            align-items: flex-start;
            flex-direction: column;
          }
          .nav {
            flex-wrap: wrap;
            gap: 16px;
            padding-left: 0;
          }
          .top-actions {
            width: 100%;
            justify-content: flex-end;
          }
          .back-row,
          .back-actions {
            flex-direction: column;
            align-items: stretch;
          }
          .primary-button,
          .ghost-button {
            justify-content: center;
          }
          .model-card,
          .messages,
          .back-row,
          .composer-shell {
            margin-left: 0;
            margin-right: 0;
            padding-left: 14px;
            padding-right: 14px;
          }
          .message-bubble { max-width: 100%; }
          .composer textarea { font-size: 16px; }
          .model-picker-anchor {
            position: static;
            width: 100%;
          }
          .model-picker-popover {
            width: 100%;
            max-width: 100%;
          }
          .model-picker-columns {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      <div className="chat-page-shell">
        <div className="chat-app">
          <header className="topbar">
            <div className="brand">NISAI</div>

            <nav className="nav" aria-label="Ana menü">
              <a href="/sohbet" className="active">Sohbet</a>
              <a href="/gorsel">Görsel Üretim</a>
              <a href="/video">Video</a>
              <a href="/tts">Ses (TTS)</a>
              <a href="/ai-katalog">Ai Katalog</a>
              <a href="/blog">Blog</a>
            </nav>

            <div className="top-actions">
              <button
                className={`ghost-button stop-top ${sending || imageGenerating ? 'active' : ''}`}
                type="button"
                aria-label="Yanıtı durdur"
                onClick={stopStreaming}
              >
                <StopSquareIcon />
                Durdur
              </button>

              <button className="ghost-button" type="button" aria-label="Diğer seçenekler">
                <DotsIcon />
              </button>
            </div>
          </header>

          <div className="content">
            <div className="back-row">
              <div className="back-actions">
                <button className="ghost-button" type="button" onClick={() => navigate('/sohbet')}>
                  <BackArrowIcon />
                  Kataloğa dön
                </button>

                <button className="primary-button" type="button" onClick={() => setShowModelPicker((prev) => !prev)}>
                  Model değiştir
                  <ChevronRightIcon />
                </button>
              </div>

              <div ref={modelPickerRef} className="model-picker-anchor">
                <ModelPickerPopover
                  open={showModelPicker}
                  models={chatModels}
                  selectedModelId={selectedModel?.modelId}
                  onSelect={handleSelectModel}
                />
              </div>
            </div>

            <div className="page-body">
              {!shouldHideModelPanel && (
                <section id="modelCard" className="model-card">
                  <div className="eyebrow">Seçili model</div>

                  <div className="model-box-row">
                    <div className="model-info-box provider">
                      {loadingModel ? 'Yükleniyor' : selectedModel?.provider || selectedModel?.company || '-'}
                    </div>
                    <div className="model-info-box name">
                      {loadingModel ? 'Model yükleniyor…' : selectedModel?.modelName || 'Model seçilmedi'}
                    </div>
                    <div className="model-info-box category">
                      {loadingModel ? 'CHAT' : selectedModel?.categoryRaw || 'CHAT'}
                    </div>
                  </div>

                  <div className="detail-stack">
                    <div className="detail-card">
                      <div className="detail-title">Öne çıkan</div>
                      <div className="detail-text">
                        {loadingModel ? 'Yükleniyor…' : selectedModel?.standoutFeature || modelError || 'Detay yok'}
                      </div>
                    </div>
                    <div className="detail-card">
                      <div className="detail-title">Kullanım</div>
                      <div className="detail-text">
                        {loadingModel ? 'Yükleniyor…' : selectedModel?.useCase || 'Detay yok'}
                      </div>
                    </div>
                    <div className="detail-card">
                      <div className="detail-title">Avantaj</div>
                      <div className="detail-text">
                        {loadingModel ? 'Yükleniyor…' : selectedModel?.rivalAdvantage || 'Detay yok'}
                      </div>
                    </div>
                  </div>
                </section>
              )}

              <main id="messages" className="messages" aria-live="polite">
                {messages.map((message) => (
                  <div key={message.id} className={`message-row ${message.role}`}>
                    <div className="message-bubble">
                      <div className="message-label">{message.label}</div>

                      {message.kind === 'image' ? (
                        <div className="image-card">
                          <div className="image-preview">
                            {message.imageUrl ? (
                              <img src={message.imageUrl} alt={message.content || 'Generated image'} />
                            ) : (
                              <div>
                                Görsel önizleme alanı
                                <br />
                                {message.content}
                              </div>
                            )}
                          </div>
                          <div className="image-caption">
                            {message.imageUrl
                              ? message.content
                              : '/görsel komutu algılandı. Bu alan, görsel üretim sonucunun yerleşeceği tasarım önizlemesidir.'}
                          </div>
                        </div>
                      ) : (
                        <div
                          className="message-content"
                          dangerouslySetInnerHTML={{
                            __html:
                              message.pending && !message.content
                                ? '<div class="typing"><span></span><span></span><span></span></div>'
                                : formatContent(message.content),
                          }}
                        />
                      )}
                    </div>
                  </div>
                ))}

                <div ref={bottomRef} />
              </main>
            </div>

            <section className="composer-shell">
              <div className="hint">
                Sohbet etmek için yaz gönder. Görsel oluşturmak için <strong>/görsel</strong> yaz sonra talimatını yaz.
              </div>

              <div className="composer">
                <textarea
                  id="promptInput"
                  ref={promptRef}
                  rows={1}
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && !event.shiftKey) {
                      event.preventDefault();
                      if (canSend) {
                        handleSend();
                      }
                    }
                  }}
                  placeholder="Mesajını yaz..."
                />

                <div className="composer-actions">
                  <button
                    id="micButton"
                    className={`icon-button ${isRecording ? 'recording' : ''}`}
                    type="button"
                    aria-label="Mikrofon ile konuş"
                    onClick={toggleMic}
                  >
                    <MicIcon />
                  </button>

                  <button
                    id="imageButton"
                    className="icon-button"
                    type="button"
                    aria-label="Görsel oluşturma komutu ekle"
                    onClick={insertImageCommand}
                  >
                    <ImageIcon />
                  </button>

                  <button
                    id="speakButton"
                    className="icon-button"
                    type="button"
                    aria-label="Son yanıtı sesli oku"
                    onClick={speakLastAssistantText}
                  >
                    <SpeakIcon />
                  </button>

                  <button
                    id="stopButton"
                    className={`stop-button ${sending || imageGenerating ? 'active' : ''}`}
                    type="button"
                    aria-label="Yanıtı durdur"
                    onClick={stopStreaming}
                  />

                  <button
                    id="sendButton"
                    className="send-button"
                    type="button"
                    aria-label="Gönder"
                    onClick={handleSend}
                    disabled={!canSend}
                  >
                    <SendIcon />
                  </button>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
