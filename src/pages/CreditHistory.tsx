import React, { useState, useEffect } from 'react';
import { format } from 'date-fns';
import { tr } from 'date-fns/locale';
import { ArrowUpRight, ArrowDownRight, CreditCard, Activity } from 'lucide-react';
import toast from 'react-hot-toast';

interface LedgerEntry {
  id: string;
  islem_tipi: 'topup' | 'usage' | 'refund' | 'adjustment';
  miktar: number;
  onceki_bakiye: number;
  sonraki_bakiye: number;
  aciklama: string;
  created_at: string;
}

export default function CreditHistory() {
  const [ledger, setLedger] = useState<LedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCredits();
  }, []);

  const fetchCredits = async () => {
    try {
      const response = await fetch('/api/user/credits');
      if (response.ok) {
        const data = await response.json();
        setLedger(data);
      } else {
        toast.error('Kredi geçmişi yüklenemedi');
      }
    } catch (error) {
      toast.error('Bir hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'topup': return <ArrowUpRight className="w-5 h-5 text-emerald-500" />;
      case 'usage': return <ArrowDownRight className="w-5 h-5 text-red-500" />;
      case 'refund': return <ArrowUpRight className="w-5 h-5 text-blue-500" />;
      default: return <Activity className="w-5 h-5 text-zinc-500" />;
    }
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-900">Kredi Geçmişi</h1>
        <p className="text-zinc-500">Hesabınıza eklenen ve harcanan tüm krediler.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-black"></div>
        </div>
      ) : ledger.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-2xl border border-zinc-200">
          <p className="text-zinc-500">Henüz bir kredi hareketi bulunmuyor.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200 text-sm font-medium text-zinc-500">
                  <th className="p-4">Tarih</th>
                  <th className="p-4">İşlem</th>
                  <th className="p-4">Açıklama</th>
                  <th className="p-4 text-right">Miktar</th>
                  <th className="p-4 text-right">Bakiye</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {ledger.map((entry) => (
                  <tr key={entry.id} className="hover:bg-zinc-50 transition-colors">
                    <td className="p-4 text-sm text-zinc-600 whitespace-nowrap">
                      {format(new Date(entry.created_at), 'd MMM yyyy HH:mm', { locale: tr })}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        {getIcon(entry.islem_tipi)}
                        <span className="font-medium text-zinc-900 capitalize">
                          {entry.islem_tipi === 'topup' ? 'Yükleme' : 
                           entry.islem_tipi === 'usage' ? 'Kullanım' : 
                           entry.islem_tipi === 'refund' ? 'İade' : 'Düzeltme'}
                        </span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-zinc-500 max-w-xs truncate" title={entry.aciklama}>
                      {entry.aciklama}
                    </td>
                    <td className="p-4 text-right">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        entry.miktar > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                      }`}>
                        {entry.miktar > 0 ? '+' : ''}{entry.miktar}
                      </span>
                    </td>
                    <td className="p-4 text-right font-medium text-zinc-900">
                      {entry.sonraki_bakiye}
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
