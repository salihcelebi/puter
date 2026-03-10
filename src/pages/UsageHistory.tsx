import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Activity, CheckCircle2, XCircle, Clock, Image as ImageIcon, Video, Music, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';

interface UsageLog {
  id: string;
  modul: string;
  kredi_maliyeti: number;
  durum: 'success' | 'failed' | 'started';
  detaylar: any;
  created_at: string;
}

export default function UsageHistory() {
  const [logs, setLogs] = useState<UsageLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/user/usage');
      if (response.ok) {
        const data = await response.json();
        setLogs(data);
      } else {
        toast.error('Kullanım geçmişi yüklenemedi');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (module: string) => {
    switch (module) {
      case 'image': return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case 'video': return <Video className="w-5 h-5 text-purple-500" />;
      case 'tts': return <Music className="w-5 h-5 text-emerald-500" />;
      case 'chat': return <MessageSquare className="w-5 h-5 text-zinc-500" />;
      default: return <Activity className="w-5 h-5 text-zinc-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'failed': return <XCircle className="w-5 h-5 text-red-500" />;
      case 'started': return <Clock className="w-5 h-5 text-blue-500" />;
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Kullanım Geçmişi</h1>
        <p className="text-zinc-500">Yaptığınız tüm işlemler ve harcanan krediler.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : logs.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200">
          <p className="text-zinc-500">Henüz bir kullanım geçmişi bulunmuyor.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-sm font-medium text-zinc-500">
                  <th className="p-4">Tarih</th>
                  <th className="p-4">Modül</th>
                  <th className="p-4">Detay</th>
                  <th className="p-4">Durum</th>
                  <th className="p-4 text-right">Kredi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4 text-sm text-zinc-600 whitespace-nowrap">
                      {format(new Date(log.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getIcon(log.modul)}
                        <span className="font-medium text-zinc-900 capitalize">{log.modul}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-zinc-500 max-w-xs truncate" title={log.detaylar?.prompt || log.detaylar?.text || '-'}>
                      {log.detaylar?.prompt || log.detaylar?.text || '-'}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1.5">
                        {getStatusIcon(log.durum)}
                        <span className={`text-sm capitalize ${
                          log.durum === 'success' ? 'text-emerald-600' :
                          log.durum === 'failed' ? 'text-red-600' : 'text-blue-600'
                        }`}>
                          {log.durum === 'success' ? 'Başarılı' : log.durum === 'failed' ? 'Hata' : 'Bekliyor'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        -{log.kredi_maliyeti}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
