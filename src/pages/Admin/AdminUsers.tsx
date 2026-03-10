import { useState, useEffect } from 'react';
import { Search, Shield, ShieldOff, Plus, Minus } from 'lucide-react';
import toast from 'react-hot-toast';

interface User {
  id: string;
  email: string;
  kullanici_adi: string;
  gorunen_ad: string;
  aktif_mi: boolean;
  rol: string;
  toplam_kredi: number;
  kullanilan_kredi: number;
  olusturma_tarihi: string;
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Kullanıcılar alınamadı');
      const data = await res.json();
      setUsers(data);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif_mi: !currentStatus })
      });
      
      if (!res.ok) throw new Error('Durum güncellenemedi');
      
      setUsers(users.map(u => u.id === userId ? { ...u, aktif_mi: !currentStatus } : u));
      toast.success('Kullanıcı durumu güncellendi');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const handleCreditAction = async (action: 'add' | 'remove') => {
    if (!selectedUser || !creditAmount) return;
    
    try {
      const res = await fetch(`/api/admin/users/${selectedUser.id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(creditAmount),
          action,
          reason: creditReason || 'Admin işlemi'
        })
      });
      
      if (!res.ok) throw new Error('Kredi işlemi başarısız');
      
      const data = await res.json();
      setUsers(users.map(u => u.id === selectedUser.id ? { ...u, toplam_kredi: data.newBalance } : u));
      toast.success('Kredi işlemi başarılı');
      
      setSelectedUser(null);
      setCreditAmount('');
      setCreditReason('');
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.kullanici_adi.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-zinc-900">Kullanıcı Yönetimi</h1>
        <div className="relative w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="E-posta veya kullanıcı adı..."
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
                <th className="px-6 py-4 font-medium">Kullanıcı</th>
                <th className="px-6 py-4 font-medium">Rol</th>
                <th className="px-6 py-4 font-medium">Kredi (Kalan / Harcanan)</th>
                <th className="px-6 py-4 font-medium">Kayıt Tarihi</th>
                <th className="px-6 py-4 font-medium">Durum</th>
                <th className="px-6 py-4 font-medium text-right">İşlemler</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Yükleniyor...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-zinc-500">Kullanıcı bulunamadı.</td>
                </tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50">
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900">{user.gorunen_ad}</div>
                      <div className="text-zinc-500">{user.email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-zinc-100 text-zinc-700'
                      }`}>
                        {user.rol}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900">{user.toplam_kredi} Kredi</div>
                      <div className="text-zinc-500">{user.kullanilan_kredi} Harcanan</div>
                    </td>
                    <td className="px-6 py-4 text-zinc-500">
                      {new Date(user.olusturma_tarihi).toLocaleDateString('tr-TR')}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        user.aktif_mi ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                      }`}>
                        {user.aktif_mi ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right space-x-2">
                      <button
                        onClick={() => setSelectedUser(user)}
                        className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg transition-colors"
                        title="Kredi İşlemleri"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => toggleUserStatus(user.id, user.aktif_mi)}
                        className={`p-2 rounded-lg transition-colors ${
                          user.aktif_mi 
                            ? 'text-red-400 hover:text-red-600 hover:bg-red-50' 
                            : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'
                        }`}
                        title={user.aktif_mi ? 'Pasife Al' : 'Aktifleştir'}
                      >
                        {user.aktif_mi ? <ShieldOff className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Credit Modal */}
      {selectedUser && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-xl font-bold mb-4">Kredi İşlemi: {selectedUser.email}</h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Miktar</label>
                <input
                  type="number"
                  value={creditAmount}
                  onChange={(e) => setCreditAmount(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Örn: 100"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Açıklama (Opsiyonel)</label>
                <input
                  type="text"
                  value={creditReason}
                  onChange={(e) => setCreditReason(e.target.value)}
                  className="w-full px-4 py-2 border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
                  placeholder="Örn: Hediye kredi"
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button
                  onClick={() => handleCreditAction('add')}
                  className="flex-1 bg-black text-white py-2 rounded-lg hover:bg-zinc-800 transition-colors flex items-center justify-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> Ekle
                </button>
                <button
                  onClick={() => handleCreditAction('remove')}
                  className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center"
                >
                  <Minus className="w-4 h-4 mr-2" /> Düş
                </button>
              </div>
              
              <button
                onClick={() => setSelectedUser(null)}
                className="w-full py-2 text-zinc-500 hover:bg-zinc-100 rounded-lg transition-colors mt-2"
              >
                İptal
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
