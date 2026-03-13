import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
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

export default function ImageGen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url: string } | null>(null);
  const [error, setError] = useState('');
  const [models, setModels] = useState<AIModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>('');

  useEffect(() => {
    fetchModels();
  }, []);

  const fetchModels = async () => {
    try {
      const data = await fetchApiJson<AIModel[]>('/api/ai/models?feature=image&sort=price_asc');
      const imageModels = data.filter(m => m.service_type === 'image');
      setModels(imageModels);
      if (imageModels.length > 0) {
        setSelectedModelId(imageModels[0].id);
      }
    } catch (error) {
      console.error('Modeller alınamadı', error);
    }
  };

  const selectedModel = models.find(m => m.id === selectedModelId);

  const handleGenerate = async () => {
    if (!user) {
      navigate('/giris', { replace: true, state: { from: { pathname: '/gorsel' } } });
      return;
    }

    if (!prompt || !selectedModelId) return;
    setLoading(true);
    setError('');
    
    try {
      // Part 2: keep UI backward-compatible while passing normalized request fields.
      const data = await fetchApiJson<{ url: string; assetId: string; requestId?: string; modelId?: string }>('/api/ai/image', {
        method: 'POST',
        body: JSON.stringify({ prompt, modelId: selectedModelId, clientRequestId: `image_${Date.now()}` }),
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
      title="Görsel Oluşturma" 
      breadcrumb="Ana Sayfa / Görsel" 
      usageCount={12}
      settings={settings}
      recentItems={null}
    >
      <div className="flex flex-col h-full">
        <div className="flex-1 min-h-[300px] border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center bg-zinc-50 overflow-hidden mb-6">
          {loading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-zinc-500">Görsel üretiliyor, lütfen bekleyin...</p>
            </div>
          ) : result ? (
            <img src={result.url} alt="Generated" className="max-w-full max-h-full object-contain" />
          ) : (
            <div className="text-center text-zinc-400">
              <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p>Görsel önizlemesi burada görünecek</p>
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
              Betimleme yazarak görsel oluşturma...
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Örn: Uzayda sörf yapan bir astronot..."
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
              disabled={loading || !prompt || models.length === 0}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
            >
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
