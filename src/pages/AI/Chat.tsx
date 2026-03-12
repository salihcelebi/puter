import { useState, useRef, useEffect } from 'react';
import AILayout from '../../components/AILayout';
import toast from 'react-hot-toast';
import { fetchApiJson } from '../../lib/apiClient';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIModel {
  id: string;
  provider_name: string;
  model_name: string;
  service_type: string;
  sale_credit_input: number | null;
  sale_credit_output: number | null;
  sale_credit_single: number | null;
}

export default function Chat() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const data = await fetchApiJson<AIModel[]>('/api/ai/models?feature=chat&sort=name_asc');
        const chatModels = data.filter(m => m.service_type === 'llm' || m.service_type === 'chat');
        setModels(chatModels);
        if (chatModels.length > 0) {
          setSelectedModelId(chatModels[0].id);
        }
    } catch (error) {
      console.error('Modeller alınamadı', error);
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);

  const handleSend = async () => {
    if (!input.trim() || !selectedModelId) return;

    const userMsg: Message = { id: Date.now().toString(), role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      // Part 2: include request ids and tolerate normalized backend response envelope.
      const data = await fetchApiJson<{ response: string; requestId?: string; modelId?: string }>('/api/ai/chat', {
        method: 'POST',
        body: JSON.stringify({
          prompt: input,
          modelId: selectedModelId,
          clientRequestId: `chat_${Date.now()}`
        })
      });

      setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.response }]);
    } catch (error: any) {
      toast.error(`Hata: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const settings = (
    <>
      <div className="flex flex-col gap-2">
        <label className="text-xs text-zinc-400">Model Seçimi</label>
        <select 
          value={selectedModelId}
          onChange={(e) => setSelectedModelId(e.target.value)}
          className="bg-zinc-800 text-white text-sm rounded-lg border border-zinc-700 p-2 focus:outline-none focus:border-indigo-500"
        >
          {models.map(m => (
            <option key={m.id} value={m.id}>{m.provider_name} - {m.model_name}</option>
          ))}
        </select>
      </div>
      {selectedModel && (
        <div className="mt-4 p-3 bg-zinc-800 rounded-lg border border-zinc-700">
          <div className="text-xs text-zinc-400 mb-1">Maliyet (Kredi)</div>
          <div className="flex justify-between text-sm">
            <span>Girdi (1K Token):</span>
            <span className="text-indigo-400 font-medium">{selectedModel.sale_credit_input || '-'} kr</span>
          </div>
          <div className="flex justify-between text-sm mt-1">
            <span>Çıktı (1K Token):</span>
            <span className="text-indigo-400 font-medium">{selectedModel.sale_credit_output || '-'} kr</span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <AILayout 
      title="Sohbet" 
      breadcrumb="Ana Sayfa / Sohbet" 
      usageCount={messages.length > 0 ? Math.floor(messages.length / 2) : 0}
      settings={settings}
      recentItems={null}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 overflow-y-auto mb-4 space-y-4 pr-2">
          {messages.length === 0 ? (
            <div className="h-full flex items-center justify-center text-zinc-400 flex-col">
              <svg className="w-12 h-12 mb-4 text-zinc-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
              <p>Sohbete başlamak için bir mesaj yazın...</p>
            </div>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
                  msg.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-br-sm' 
                    : 'bg-zinc-100 text-zinc-800 rounded-bl-sm border border-zinc-200'
                }`}>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{msg.content}</p>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-zinc-100 rounded-2xl rounded-bl-sm px-4 py-3 border border-zinc-200 flex items-center gap-2">
                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 bg-zinc-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        <div className="relative mt-auto shrink-0">
          <div className="absolute left-2 md:left-3 top-1/2 -translate-y-1/2 flex gap-1 md:gap-2">
            <button className="p-1.5 md:p-2 text-zinc-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
              </svg>
            </button>
            <button className="p-1.5 md:p-2 text-zinc-400 hover:text-indigo-600 transition-colors rounded-full hover:bg-indigo-50">
              <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
            </button>
          </div>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Mesajınızı yazın..."
            className="w-full pl-16 md:pl-24 pr-12 md:pr-14 py-3 md:py-4 text-sm md:text-base bg-white border border-zinc-300 rounded-full focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm"
            disabled={loading || models.length === 0}
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim() || models.length === 0}
            className="absolute right-1.5 md:right-2 top-1/2 -translate-y-1/2 p-2 md:p-2.5 bg-indigo-600 text-white rounded-full hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
        <div className="text-center mt-2 text-xs text-zinc-400">
          {selectedModel ? `Seçili model: ${selectedModel.model_name}` : 'Lütfen bir model seçin'}
        </div>
      </div>
    </AILayout>
  );
}
