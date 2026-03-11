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

export default function Music() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url?: string; jobId?: string; status?: string } | null>(null);
  const [error, setError] = useState('');
  
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [musicCapability, setMusicCapability] = useState<{ supported: boolean; reason?: string; code?: string } | null>(null);

  useEffect(() => {
    fetchModels();
    fetchCapability();
  }, []);

  const fetchModels = async () => {
    try {
      const data = await fetchApiJson<AIModel[]>('/api/ai/models');
      const musicModels = data.filter(m => m.service_type === 'music');
      setModels(musicModels);
      if (musicModels.length > 0) {
        setSelectedModelId(musicModels[0].id);
      }
    } catch (error) {
      console.error('Modeller alınamadı', error);
    }
  };


  // Part 2: music remains capability-gated to avoid fake success behavior.
  const fetchCapability = async () => {
    try {
      const capability = await fetchApiJson<{ supported: boolean; reason?: string; code?: string }>('/api/ai/music/capability');
      setMusicCapability(capability);
    } catch (capError: any) {
      setMusicCapability({ supported: false, reason: capError.message, code: capError.code });
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);

  const handleGenerate = async () => {
    if (!prompt || !selectedModelId || musicCapability?.supported === false) return;
    setLoading(true);
    setError('');
    
    try {
      const data = await fetchApiJson<{ url?: string; jobId?: string; status?: string }>('/api/ai/music', {
        method: 'POST',
        body: JSON.stringify({ prompt, tags: ['Pop', 'Kadın Vokal'], modelId: selectedModelId, clientRequestId: `music_${Date.now()}` }),
      });

      setResult(data);
      if (!data.url && data.status === 'queued') {
        toast('Müzik işi kuyruğa alındı. Job ID: ' + data.jobId, { icon: '⏳' });
      }
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
      title="Müzik" 
      breadcrumb="Ana Sayfa / Müzik" 
      usageCount={7}
      settings={settings}
      recentItems={null}
    >
      <div className="flex flex-col h-full">
        <div className="mb-6 space-y-4">
          <h2 className="text-lg font-semibold text-zinc-900">Müzik Oluşturma</h2>
          
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
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Dil:</label>
              <select className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option>Türkçe</option>
                <option>İngilizce</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex gap-2 mb-2">
              <button className="px-3 py-1 bg-indigo-600 text-white rounded-full text-sm">tür</button>
              <button className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-sm">ruh hali</button>
              <button className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-sm">enstrümanlar</button>
              <button className="px-3 py-1 bg-zinc-100 text-zinc-700 rounded-full text-sm">tema</button>
            </div>
            <div className="flex flex-wrap gap-2">
              {['Pop', 'Klasik', 'Elektronik', 'Rock', 'Akustik', 'Hopp', 'Sine', 'Oyun'].map(tag => (
                <button key={tag} className="px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-lg text-sm transition-colors">
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Süre</label>
            <input type="range" min="1" max="4" defaultValue="1" className="w-full" />
            <div className="flex justify-between text-xs text-zinc-400 mt-1">
              <span>1 min</span>
              <span>2 min</span>
              <span>3 min</span>
              <span>4 min</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Eklentiler</label>
            <div className="flex flex-wrap gap-2">
              {['Kadın Vokal', 'Erkek Vokal', 'Çello', 'Gitar', 'Piyano', 'Hızlı', 'Sakin'].map(tag => (
                <button key={tag} className="px-3 py-1.5 bg-zinc-50 hover:bg-zinc-100 border border-zinc-200 text-zinc-700 rounded-lg text-sm transition-colors">
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Örnek İstasyonlar</label>
            <div className="grid grid-cols-3 gap-4">
              <div className="relative rounded-xl overflow-hidden bg-zinc-800 aspect-video flex items-end p-3">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div className="relative z-10 text-white">
                  <div className="font-medium text-sm">Melodik Pop Love Song</div>
                  <div className="text-xs text-zinc-300">Pop | Kadın Vokal</div>
                </div>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-zinc-800 aspect-video flex items-end p-3">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div className="relative z-10 text-white">
                  <div className="font-medium text-sm">Duygusal Klasik Beste</div>
                  <div className="text-xs text-zinc-300">Klasik | Çello</div>
                </div>
              </div>
              <div className="relative rounded-xl overflow-hidden bg-zinc-800 aspect-video flex items-end p-3">
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent"></div>
                <div className="relative z-10 text-white">
                  <div className="font-medium text-sm">Energik Elektronik Dans</div>
                  <div className="text-xs text-zinc-300">Elektronik | Hızlı</div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {result?.url && (
          <div className="mb-6 p-4 bg-white border border-zinc-200 rounded-xl shadow-sm">
            <h3 className="text-sm font-medium text-zinc-700 mb-2">Üretilen Müzik:</h3>
            <audio src={result.url} controls className="w-full" />
          </div>
        )}

        {result?.jobId && !result?.url && (
          <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl shadow-sm text-amber-800 text-sm">
            Müzik işi kuyruğa alındı. Job ID: <span className="font-mono">{result.jobId}</span>
          </div>
        )}

        {musicCapability?.supported === false && (
          <div className="bg-amber-50 text-amber-700 p-3 rounded-lg text-sm mb-4 border border-amber-200">
            {musicCapability.reason || 'Müzik özelliği henüz hazır değil'} ({musicCapability.code || 'FEATURE_NOT_READY'})
          </div>
        )}

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end mt-auto pt-6">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Müzik oluşturmak için isteminizi yazın...
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Örn: Hareketli bir yaz şarkısı..."
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
            <span className="text-xs text-zinc-500 mb-1 hidden sm:block">= 3 kredi</span>
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt || musicCapability?.supported === false}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
            >
              {loading && <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>}
              <span>Oluştur</span>
              <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full sm:hidden">3 kredi</span>
            </button>
          </div>
        </div>
      </div>
    </AILayout>
  );
}
