import { useState, useEffect } from 'react';
import { Search, Filter, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

interface LogEntry {
  id: string;
  type: 'usage' | 'error';
  kullanici_id?: string;
  modul?: string;
  islem_tipi?: string;
  durum?: string;
  kredi_maliyeti?: number;
  ic_maliyet?: number;
  hata_mesaji?: string;
  kategori?: string;
  source?: string;
  message?: string;
  created_at: string;
}

export default function AdminLogs() {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'usage' | 'error'>('all');

  useEffect(() => {
    fetchLogs();
  }, []);

  const fetchLogs = async () => {
    try {
      const res = await fetch('/api/admin/logs');
      if (!res.ok) throw new Error('Loglar alınamadı');
      const data = await res.json();
      setLogs(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredLogs = logs.filter(log => {
    const matchesSearch = 
      (log.kullanici_id && log.kullanici_id.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.modul && log.modul.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.message && log.message.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (log.hata_mesaji && log.hata_mesaji.toLowerCase().includes(searchTerm.toLowerCase()));
      
    const matchesType = filterType === 'all' || log.type === filterType;
    
    return matchesSearch && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-900">Sistem Logları</h1>
        <div className="flex space-x-4">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
            <input
              type="text"
              placeholder="Kullanıcı ID, modül, mesaj..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
            />
          </div>
          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-4 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
          >
            <option value="all">Tüm Loglar</option>
            <option value="usage">Kullanım Logları</option>
            <option value="error">Hata Logları</option>
          </select>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-medium">Tür</th>
                <th className="px-6 py-4 font-medium">Tarih</th>
                <th className="px-6 py-4 font-medium">Kullanıcı ID</th>
                <th className="px-6 py-4 font-medium">Detay / Modül</th>
                <th className="px-6 py-4 font-medium">Durum / Mesaj</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Yükleniyor...</td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-zinc-500">Log bulunamadı.</td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      {log.type === 'error' ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-700">
                          Hata
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700">
                          Kullanım
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                      {new Date(log.created_at).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                      {log.kullanici_id || '-'}
                    </td>
                    <td className="px-6 py-4">
                      {log.type === 'usage' ? (
                        <div>
                          <div className="font-medium text-zinc-900">{log.modul}</div>
                          <div className="text-xs text-zinc-500">Maliyet: {log.kredi_maliyeti} Kredi (İç: ₺{log.ic_maliyet})</div>
                        </div>
                      ) : (
                        <div>
                          <div className="font-medium text-zinc-900">{log.kategori || 'Genel Hata'}</div>
                          <div className="text-xs text-zinc-500">{log.source}</div>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      {log.type === 'usage' ? (
                        <div className="flex items-center">
                          {log.durum === 'completed' ? (
                            <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                          ) : log.durum === 'failed' ? (
                            <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                          ) : (
                            <Clock className="w-4 h-4 text-orange-500 mr-2" />
                          )}
                          <span className={
                            log.durum === 'completed' ? 'text-emerald-700' :
                            log.durum === 'failed' ? 'text-red-700' : 'text-orange-700'
                          }>
                            {log.durum === 'completed' ? 'Başarılı' : log.durum === 'failed' ? 'Başarısız' : 'Bekliyor'}
                          </span>
                          {log.hata_mesaji && <span className="ml-2 text-xs text-red-500 truncate max-w-xs">{log.hata_mesaji}</span>}
                        </div>
                      ) : (
                        <div className="text-red-600 text-sm truncate max-w-md" title={log.message}>
                          {log.message}
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
