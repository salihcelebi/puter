import { useState, useEffect } from 'react';
import AILayout from '../../components/AILayout';
import toast from 'react-hot-toast';
import { fetchApiJson } from '../../lib/apiClient';

interface AIModel {
  id: string;
  provider_name: string;
  model_name: string;
  service_type: string;
  sale_credit_single: number | null;
}

export default function TTS() {
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState('');
  
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [voiceName, setVoiceName] = useState<string>('Kore');

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const data = await fetchApiJson<AIModel[]>('/api/ai/models?feature=tts&sort=price_asc');
      const ttsModels = data.filter(m => m.service_type === 'tts');
      setModels(ttsModels);
      if (ttsModels.length > 0) {
        setSelectedModelId(ttsModels[0].id);
      }
    } catch (error) {
      console.error('Modeller alınamadı', error);
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);

  const handleGenerate = async () => {
    if (!text || !selectedModelId) return;
    setLoading(true);
    setError('');
    
    try {
      // Part 2: switch to voiceName contract and keep response compatibility.
      const data = await fetchApiJson<{ url: string; assetId: string; requestId?: string; modelId?: string }>('/api/ai/tts', {
        method: 'POST',
        body: JSON.stringify({ text, voiceName, modelId: selectedModelId, clientRequestId: `tts_${Date.now()}` }),
      });
      
      setResult(data);
    } catch (err: any) {
      setError(err.message);
      toast.error(err.message);
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
            <span>Tekil Üretim:</span>
            <span className="text-indigo-400 font-medium">{selectedModel.sale_credit_single || '-'} kr</span>
          </div>
        </div>
      )}
    </>
  );

  return (
    <AILayout 
      title="TTS" 
      breadcrumb="Ana Sayfa / TTS" 
      usageCount={60}
      settings={settings}
      recentItems={null}
    >
      <div className="flex flex-col h-full">
        <div className="mb-6 space-y-4">
          <div className="flex gap-2 mb-6">
            <button className="px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg text-sm font-medium">Sesten Yazıya</button>
            <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium">Yazıdan Konuşmaya</button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Model:</label>
              <select 
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {models.map(m => (
                  <option key={m.id} value={m.id}>{m.provider_name} - {m.model_name}</option>
                ))}
              </select>
            </div>
            <div className="row-span-4 border border-zinc-200 rounded-xl p-4 overflow-y-auto max-h-[300px]">
              <div className="relative mb-4">
                <input type="text" placeholder="Ses ara..." className="w-full pl-8 pr-3 py-2 border border-zinc-300 rounded-lg text-sm" />
                <svg className="w-4 h-4 absolute left-2.5 top-3 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              
              <div className="space-y-2">
                {[
                  { name: 'Can', desc: 'Türkçe | Erkek, Rahat', active: true },
                  { name: 'Seda', desc: 'Türkçe | Kadın, Duygulu', active: false },
                  { name: 'Ahmet', desc: 'Türkçe | Erkek, Ciddi', active: false },
                  { name: 'Defne', desc: 'Türkçe | Kadın, Dostça', active: false },
                  { name: 'Emre', desc: 'Türkçe | Erkek, Neşeli', active: false },
                ].map(voice => (
                  <div key={voice.name} className={`flex items-center justify-between p-3 rounded-lg border ${voice.active ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-200 hover:border-zinc-300'}`}>
                    <div className="flex items-center gap-3">
                      <div className="w-6 h-4 bg-red-500 rounded-sm flex items-center justify-center text-[10px] text-white font-bold">TR</div>
                      <div>
                        <div className="font-medium text-sm text-zinc-900">{voice.name}</div>
                        <div className="text-xs text-zinc-500">{voice.desc}</div>
                      </div>
                    </div>
                    <button className="px-3 py-1 bg-indigo-600 text-white text-xs rounded-md hover:bg-indigo-700">Dinle</button>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Dil:</label>
              <select className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option>Türkçe</option>
                <option>İngilizce</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Seslendiren:</label>
              <select className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option>Can (ER, TR)</option>
              </select>
            </div>

            <div>
              <div className="flex justify-between text-sm text-zinc-700 mb-1">
                <span>Ritim:</span>
                <span className="text-zinc-500">Türkçe | Erkek, Rahat</span>
              </div>
              <input type="range" className="w-full" />
            </div>
            
            <div>
              <div className="flex justify-between text-sm text-zinc-700 mb-1">
                <span>Hız (x):</span>
              </div>
              <input type="range" className="w-full" />
            </div>
          </div>
        </div>

        <div className="flex-1 border border-zinc-200 rounded-xl p-4 bg-zinc-50 mb-6 flex flex-col">
          <div className="flex items-center gap-2 mb-2 text-sm font-medium text-zinc-700">
            <input type="radio" defaultChecked className="text-indigo-600 focus:ring-indigo-500" />
            <label>Düz Metin</label>
            <span className="text-xs text-zinc-400 ml-auto">≈ 2.6 saniye &gt; 20 token</span>
          </div>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Metninizi buraya yazın..."
            className="w-full flex-1 p-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none"
          ></textarea>
        </div>

        {result && (
          <div className="mb-6 p-4 bg-white border border-zinc-200 rounded-xl shadow-sm">
            <h3 className="text-sm font-medium text-zinc-700 mb-2">Üretilen Ses:</h3>
            <audio src={result.url} controls className="w-full" />
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Bir TTS işlemi gerçekleştirmek için metni buraya yazın...
            </label>
            <input
              type="text"
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Örn: Merhaba, bugün hava çok güzel..."
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
              disabled={loading || models.length === 0}
            />
          </div>
          <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
            <span className="text-xs text-zinc-500 mb-1 hidden sm:block">
              {selectedModel ? `= ${selectedModel.sale_credit_single || 0} kredi` : 'Model seçin'}
            </span>
            <button
              onClick={handleGenerate}
              disabled={loading || !text || models.length === 0}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
              <span>Oluştur</span>
              <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full sm:hidden">
                {selectedModel ? `${selectedModel.sale_credit_single || 0} kr` : '-'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </AILayout>
  );
}
