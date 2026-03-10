import { useState, useEffect } from 'react';
import { Search, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';

interface Payment {
  id: string;
  kullanici_id: string;
  saglayici: string;
  tutar_tl: number;
  kredi_miktari: number;
  durum: string;
  referans?: string;
  created_at: string;
}

export default function AdminPayments() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      const res = await fetch('/api/admin/payments');
      if (!res.ok) throw new Error('Ödemeler alınamadı');
      const data = await res.json();
      setPayments(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const filteredPayments = payments.filter(p => 
    p.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (p.kullanici_id && p.kullanici_id.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-900">Ödeme Yönetimi</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="İşlem ID veya Kullanıcı ID..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-medium">İşlem ID / Referans</th>
                <th className="px-6 py-4 font-medium">Tarih</th>
                <th className="px-6 py-4 font-medium">Kullanıcı ID</th>
                <th className="px-6 py-4 font-medium">Tutar / Kredi</th>
                <th className="px-6 py-4 font-medium">Sağlayıcı</th>
                <th className="px-6 py-4 font-medium">Durum</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Yükleniyor...</td>
                </tr>
              ) : filteredPayments.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Ödeme bulunamadı.</td>
                </tr>
              ) : (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <div className="font-mono text-xs text-zinc-900">{payment.id}</div>
                      {payment.referans && <div className="text-xs text-zinc-500">Ref: {payment.referans}</div>}
                    </td>
                    <td className="px-6 py-4 text-zinc-500 whitespace-nowrap">
                      {new Date(payment.created_at).toLocaleString('tr-TR')}
                    </td>
                    <td className="px-6 py-4 font-mono text-xs text-zinc-500">
                      {payment.kullanici_id}
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900">₺{payment.tutar_tl}</div>
                      <div className="text-xs text-emerald-600">+{payment.kredi_miktari} Kredi</div>
                    </td>
                    <td className="px-6 py-4 text-zinc-500 capitalize">
                      {payment.saglayici}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        {payment.durum === 'success' ? (
                          <CheckCircle className="w-4 h-4 text-emerald-500 mr-2" />
                        ) : payment.durum === 'failed' ? (
                          <AlertCircle className="w-4 h-4 text-red-500 mr-2" />
                        ) : (
                          <Clock className="w-4 h-4 text-orange-500 mr-2" />
                        )}
                        <span className={
                          payment.durum === 'success' ? 'text-emerald-700' :
                          payment.durum === 'failed' ? 'text-red-700' : 'text-orange-700'
                        }>
                          {payment.durum === 'success' ? 'Başarılı' : payment.durum === 'failed' ? 'Başarısız' : 'Bekliyor'}
                        </span>
                      </div>
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
