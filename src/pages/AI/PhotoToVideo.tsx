import React, { useEffect, useState } from 'react';
import AILayout from '../../components/AILayout';
import toast from 'react-hot-toast';
import { fetchApiJson } from '../../lib/apiClient';

export default function PhotoToVideo() {
  const [prompt, setPrompt] = useState('');
  const [image, setImage] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ url?: string; jobId?: string; status?: string; outputUrl?: string } | null>(null);
  const [error, setError] = useState('');

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImage(e.target.files[0]);
    }
  };


  // Part 2: poll backend job status instead of assuming immediate media readiness.
  useEffect(() => {
    if (!result?.jobId || !result.status || result.status === 'completed' || result.status === 'failed') return;

    const timer = setInterval(async () => {
      try {
        const job = await fetchApiJson<{ status: string; outputUrl?: string; error?: string }>(`/api/ai/jobs/${result.jobId}`);
        if (job.status === 'completed') {
          setResult(prev => ({ ...(prev || {}), status: 'completed', url: job.outputUrl || prev?.url, outputUrl: job.outputUrl }));
          clearInterval(timer);
          return;
        }
        if (job.status === 'failed') {
          setError(job.error || 'Fotoğraftan video işi başarısız oldu');
          setResult(prev => ({ ...(prev || {}), status: 'failed' }));
          clearInterval(timer);
          return;
        }
        setResult(prev => ({ ...(prev || {}), status: job.status }));
      } catch (pollError: any) {
        setError(pollError.message || 'İş durumu alınamadı');
        clearInterval(timer);
      }
    }, 2500);

    return () => clearInterval(timer);
  }, [result?.jobId, result?.status]);

  const handleGenerate = async () => {
    if (!prompt || !image) return;
    setLoading(true);
    setError('');
    
    try {
      const data = await fetchApiJson<{ url?: string; jobId?: string; status?: string; requestId?: string }>('/api/ai/photo-to-video', {
        method: 'POST',
        body: JSON.stringify({ prompt, imageUrl: image.name, clientRequestId: `p2v_${Date.now()}` }),
      });

      setResult(data);
      if (!data.url && data.status === 'queued') {
        toast('Fotoğraftan video işi kuyruğa alındı. Job ID: ' + data.jobId, { icon: '⏳' });
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const settings = (
    <>
      <div className="flex justify-between"><span>Model:</span> <span className="text-white">Sora</span></div>
      <div className="flex justify-between"><span>Lisan:</span> <span className="text-white">Türkçe</span></div>
      <div className="flex justify-between"><span>Temperatur:</span> <span className="text-white">0.7</span></div>
      <div className="flex justify-between"><span>Süre:</span> <span className="text-white">6 saniye</span></div>
    </>
  );

  return (
    <AILayout 
      title="Fotoğraftan Video" 
      breadcrumb="Ana Sayfa / Fotoğraftan Video" 
      usageCount={12}
      settings={settings}
      recentItems={null}
    >
      <div className="flex flex-col h-full">
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Model</label>
              <select className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option>Sora</option>
                <option>Veo</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700 mb-1">Dil</label>
              <select className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500">
                <option>Türkçe</option>
                <option>İngilizce</option>
              </select>
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm text-zinc-500 mb-1">
              <span>0.0 Daha Kesin</span>
              <span>Daha Yaratıcı</span>
            </div>
            <input type="range" min="0" max="100" defaultValue="50" className="w-full" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Ortam</label>
            <div className="flex flex-wrap gap-2">
              {['Doğa', 'Şehir', 'Plaj', 'Dağ', 'Kış', 'Spor', 'Fütüristik'].map(tag => (
                <button key={tag} className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full text-sm transition-colors">
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-2">Eklentiler</label>
            <div className="flex flex-wrap gap-2">
              {['Drift', 'Çizgi Roman', 'Slow Motion', '3D', 'Sinematik', 'Aksiyon'].map(tag => (
                <button key={tag} className="px-3 py-1.5 bg-zinc-100 hover:bg-zinc-200 text-zinc-700 rounded-full text-sm transition-colors">
                  {tag}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-[200px] border-2 border-dashed border-zinc-200 rounded-xl flex items-center justify-center bg-zinc-50 overflow-hidden mb-6 relative">
          {loading ? (
            <div className="flex flex-col items-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600 mb-4"></div>
              <p className="text-zinc-500">Video üretiliyor, bu işlem birkaç dakika sürebilir...</p>
            </div>
          ) : result?.url ? (
            <video src={result.url} controls className="max-w-full max-h-full object-contain" autoPlay loop />
          ) : result?.jobId ? (
            <div className="text-center text-zinc-500">
              Üretim durumu: <span className="font-semibold">{result.status || 'queued'}</span><br />
              Job ID: <span className="font-mono">{result.jobId}</span>
            </div>
          ) : (
            <div className="text-center text-zinc-400 p-6">
              <svg className="mx-auto h-12 w-12 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="mb-4">Başlangıç fotoğrafını buraya sürükleyin veya seçin</p>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" id="image-upload" />
              <label htmlFor="image-upload" className="px-4 py-2 bg-white border border-zinc-300 rounded-lg text-sm font-medium text-zinc-700 hover:bg-zinc-50 cursor-pointer">
                Fotoğraf Seç
              </label>
              {image && <p className="mt-2 text-sm text-indigo-600">{image.name}</p>}
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
              Fotoğrafın nasıl hareket edeceğini yazın...
            </label>
            <input
              type="text"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Örn: Resimdeki araba yavaşça ileri doğru hareket etsin..."
              className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              onKeyDown={(e) => e.key === 'Enter' && handleGenerate()}
            />
          </div>
          <div className="flex flex-col items-start sm:items-end w-full sm:w-auto">
            <span className="text-xs text-zinc-500 mb-1 hidden sm:block">= 15 kredi</span>
            <button
              onClick={handleGenerate}
              disabled={loading || !prompt || !image}
              className="w-full sm:w-auto px-6 py-3 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition-colors flex justify-center items-center gap-2"
            >
              <span>Oluştur</span>
              <span className="text-xs bg-indigo-500 px-2 py-0.5 rounded-full sm:hidden">15 kredi</span>
            </button>
          </div>
        </div>
      </div>
    </AILayout>
  );
}
