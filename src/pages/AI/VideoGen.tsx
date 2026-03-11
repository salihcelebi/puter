import React, { useState, useEffect } from 'react';
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

export default function VideoGen() {
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url?: string; jobId?: string; status?: string } | null>(null);
  const [error, setError] = useState('');
  
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');
  const [duration, setDuration] = useState(5);
  const [aspectRatio, setAspectRatio] = useState('16:9');
  const [estimatedCost, setEstimatedCost] = useState(0);

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const data = await fetchApiJson<AIModel[]>('/api/ai/models');
      const videoModels = data.filter(m => m.service_type === 'video');
      setModels(videoModels);
      if (videoModels.length > 0) {
        setSelectedModelId(videoModels[0].id);
      }
    } catch (error) {
      console.error('Modeller alınamadı', error);
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);

  useEffect(() => {
    if (selectedModel) {
      // Cost calculation: baseCost * (duration / 5)
      const baseCost = selectedModel.sale_credit_single || 0;
      const cost = Math.ceil(baseCost * (duration / 5));
      setEstimatedCost(cost);
    }
  }, [selectedModel, duration]);

  const handleGenerate = async () => {
    if (!prompt || !selectedModelId) return;
    setLoading(true);
    setError('');
    
    try {
      const data = await fetchApiJson<{ url?: string; jobId?: string; status?: string }>('/api/ai/video', {
        method: 'POST',
        body: JSON.stringify({ 
          prompt,
          modelId: selectedModelId,
          duration,
          aspectRatio
        }),
      });

      setResult(data);
      if (!data.url && data.status === 'queued') {
        toast('Video işi kuyruğa alındı. Job ID: ' + data.jobId, { icon: '⏳' });
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
      <div className="flex justify-between"><span>Model:</span> <span className="text-white">{selectedModel?.model_name || '-'}</span></div>
      <div className="flex justify-between"><span>Format:</span> <span className="text-white">{aspectRatio}</span></div>
      <div className="flex justify-between"><span>Süre:</span> <span className="text-white">{duration} sn</span></div>
      <div className="flex justify-between mt-4 pt-4 border-t border-slate-700">
        <span className="text-slate-400">Tahmini Maliyet:</span> 
        <span className="text-emerald-400 font-medium">{estimatedCost} Kredi</span>
      </div>
    </>
  );

  return (
    <AILayout 
      title="Video Oluşturma" 
      breadcrumb="Ana Sayfa / Video" 
      usageCount={15}
      settings={settings}
      recentItems={null}
    >
      <div className="flex flex-col h-full">
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Model</label>
              <select 
                value={selectedModelId}
                onChange={(e) => setSelectedModelId(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {models.map(model => (
                  <option key={model.id} value={model.id}>{model.provider_name} - {model.model_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Format</label>
              <select 
                value={aspectRatio}
                onChange={(e) => setAspectRatio(e.target.value)}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value="16:9">16:9 (Yatay)</option>
                <option value="9:16">9:16 (Dikey)</option>
                <option value="1:1">1:1 (Kare)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Süre</label>
              <select 
                value={duration}
                onChange={(e) => setDuration(Number(e.target.value))}
                className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                <option value={5}>5 Saniye</option>
                <option value={10}>10 Saniye</option>
                <option value={15}>15 Saniye</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Hızlı Etiketler</label>
            <div className="flex flex-wrap gap-2">
              {['Sinematik', 'Drone Çekimi', 'Makro', 'Slow Motion', 'Timelapse', 'Cyberpunk', 'Doğa'].map(tag => (
                <button 
                  key={tag} 
                  onClick={() => setPrompt(prev => prev ? `${prev}, ${tag}` : tag)}
                  className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full text-sm transition-colors"
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-[300px] border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center bg-zinc-50 overflow-hidden mb-6">
          {loading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-zinc-500">Video üretiliyor, bu işlem birkaç dakika sürebilir...</p>
            </div>
          ) : result?.url ? (
            <video src={result.url} controls className="max-w-full max-h-full object-contain" autoPlay loop />
          ) : result?.jobId ? (
            <div className="text-center text-zinc-500">
              Üretim işi kuyruğa alındı. Job ID: <span className="font-mono">{result.jobId}</span>
            </div>
          ) : (
            <div className="text-center text-zinc-400">
              <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              <p>Video önizlemesi burada görünecek</p>
            </div>
          )}
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm mb-4 border border-red-200">
            {error}
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-end">
          <div className="flex-1 w-full">
            <label className="block text-sm font-medium text-zinc-700 mb-2">
              Video oluşturmak için isteminizi yazın...
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Örn: Karlı dağlarda koşan köpekler, sinematik çekim, 4k çözünürlük..."
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 resize-none h-24"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGenerate();
                }
              }}
              disabled={loading || models.length === 0}
            />
          </div>
          <div className="flex flex-col items-start sm:items-end w-full sm:w-auto pb-0 sm:pb-2">
            <span className="text-xs text-zinc-500 mb-1 hidden sm:block">
              {selectedModel ? `= ${estimatedCost} kredi` : 'Model seçin'}
            </span>
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt || models.length === 0}
              className="w-full sm:w-auto px-8 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors h-[46px] flex justify-center items-center gap-2"
            >
              <span>Oluştur</span>
              <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full sm:hidden">
                {selectedModel ? `${estimatedCost} kr` : '-'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </AILayout>
  );
}
