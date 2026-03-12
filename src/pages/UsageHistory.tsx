import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { Activity, CheckCircle2, XCircle, Clock, Image as ImageIcon, Video, Music, MessageSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { fetchApiJson } from '../lib/apiClient';

interface UsageLog {
  id: string;
  modul: string;
  kredi_maliyeti: number;
  durum: 'success' | 'failed' | 'started' | 'completed';
  status?: 'queued' | 'processing' | 'completed' | 'failed' | 'canceled';
  jobId?: string | null;
  requestId?: string;
  assetId?: string | null;
  creditReserved?: number;
  creditCommitted?: number;
  errorCode?: string | null;
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
      const data = await fetchApiJson<any[]>('/api/user/usage');
      setLogs(data);
    } catch (error) {
      toast.error('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (module: string) => {
    switch (module) {
      case 'image': return <ImageIcon className="w-5 h-5 text-blue-500" />;
      case 'video':
      case 'photoToVideo': return <Video className="w-5 h-5 text-purple-500" />;
      case 'tts': return <Music className="w-5 h-5 text-emerald-500" />;
      case 'chat': return <MessageSquare className="w-5 h-5 text-zinc-500" />;
      default: return <Activity className="w-5 h-5 text-zinc-500" />;
    }
  };

  const getStatusIcon = (status: string) => {
    if (status === 'completed' || status === 'success') return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
    if (status === 'failed' || status === 'canceled') return <XCircle className="w-5 h-5 text-red-500" />;
    return <Clock className="w-5 h-5 text-blue-500" />;
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
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
                  <th className="p-4">Job / Request</th>
                  <th className="p-4">Durum</th>
                  <th className="p-4 text-right">Reserve/Commit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {logs.map((log) => {
                  const status = log.status || log.durum;
                  return (
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
                      <td className="p-4 text-xs text-zinc-500">
                        <div>Job: {log.jobId || '-'}</div>
                        <div>Req: {log.requestId || '-'}</div>
                        <div>Asset: {log.assetId || '-'}</div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1.5">
                          {getStatusIcon(status)}
                          <span className={`text-sm capitalize ${
                            status === 'completed' || status === 'success' ? 'text-emerald-600' :
                            status === 'failed' || status === 'canceled' ? 'text-red-600' : 'text-blue-600'
                          }`}>
                            {status}
                          </span>
                        </div>
                        {log.errorCode ? <div className="text-xs text-red-500">{log.errorCode}</div> : null}
                      </td>
                      <td className="p-4 text-right text-xs">
                        <div>R: {log.creditReserved ?? log.kredi_maliyeti ?? 0}</div>
                        <div>C: {log.creditCommitted ?? 0}</div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
