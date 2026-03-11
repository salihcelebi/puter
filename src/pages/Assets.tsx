import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Search, Filter, Download, Trash2, Edit2, Play, Image as ImageIcon, Video, Music, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

interface Asset {
  id: string;
  tur: 'image' | 'video' | 'audio' | 'chat';
  dosya_adi: string;
  fs_path: string;
  created_at: string;
  source_job_id?: string | null;
}

export default function Assets() {
  const [assets, setAssets] = useState<Asset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'image' | 'video' | 'audio' | 'chat'>('all');
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchAssets();
  }, []);

  const fetchAssets = async () => {
    try {
      const response = await fetch('/api/user/assets');
      if (response.ok) {
        const data = await response.json();
        setAssets(data);
      } else {
        toast.error('Varlıklar yüklenemedi');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bu varlığı silmek istediğinize emin misiniz?')) return;
    
    try {
      const response = await fetch(`/api/user/assets/${id}`, { method: 'DELETE' });
      if (response.ok) {
        toast.success('Varlık silindi');
        setAssets(assets.filter(a => a.id !== id));
      } else {
        toast.error('Silme işlemi başarısız');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  const handleDownload = async (id: string, fileName: string) => {
    try {
      const response = await fetch(`/api/user/assets/${id}/download`);
      if (response.ok) {
        // Part 3: download real binary asset stream from backend.
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        link.remove();
        window.URL.revokeObjectURL(url);
        toast.success('İndirme başlatıldı');
      } else {
        toast.error('İndirme başarısız');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    }
  };

  const filteredAssets = assets.filter(asset => {
    if (filter !== 'all' && asset.tur !== filter) return false;
    if (search && !asset.dosya_adi.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <ImageIcon className="w-8 h-8 text-blue-500" />;
      case 'video': return <Video className="w-8 h-8 text-purple-500" />;
      case 'audio': return <Music className="w-8 h-8 text-emerald-500" />;
      case 'chat': return <MessageSquare className="w-8 h-8 text-zinc-500" />;
      default: return <ImageIcon className="w-8 h-8 text-zinc-500" />;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Varlıklar</h1>
          <p className="text-zinc-500">Ürettiğiniz tüm içerikler burada listelenir.</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-400" />
          <input
            type="text"
            placeholder="Dosya adı ile ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-2 sm:pb-0">
          {(['all', 'image', 'video', 'audio', 'chat'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={`px-4 py-2 rounded-xl whitespace-nowrap transition-colors ${
                filter === t 
                  ? 'bg-black text-white' 
                  : 'bg-white border border-zinc-200 text-zinc-600 hover:bg-zinc-50'
              }`}
            >
              {t === 'all' ? 'Tümü' : t === 'image' ? 'Görseller' : t === 'video' ? 'Videolar' : t === 'audio' ? 'Sesler' : 'Sohbetler'}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : filteredAssets.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200">
          <p className="text-zinc-500">Henüz bir varlık bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredAssets.map((asset) => (
            <div key={asset.id} className="bg-white rounded-2xl border border-zinc-200 overflow-hidden group hover:shadow-md transition-shadow">
              <div className="aspect-video bg-zinc-100 flex items-center justify-center relative">
                {getIcon(asset.tur)}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button 
                    onClick={() => handleDownload(asset.id, asset.dosya_adi)}
                    className="p-2 bg-white rounded-full hover:scale-105 transition-transform" 
                    title="İndir"
                  >
                    <Download className="w-4 h-4 text-black" />
                  </button>
                  <button 
                    onClick={() => handleDelete(asset.id)}
                    className="p-2 bg-white rounded-full hover:scale-105 transition-transform" 
                    title="Sil"
                  >
                    <Trash2 className="w-4 h-4 text-red-500" />
                  </button>
                </div>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-medium text-zinc-900 truncate" title={asset.dosya_adi}>
                    {asset.dosya_adi}
                  </h3>
                  <button className="text-zinc-400 hover:text-black">
                    <Edit2 className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex justify-between items-center text-xs text-zinc-500">
                  <span className="capitalize">{asset.tur}</span>
                  <span>{format(new Date(asset.created_at), 'd MMM yyyy', { locale: tr })}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
