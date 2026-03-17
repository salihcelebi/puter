import { useState, useEffect, useMemo } from 'react';
import { Search, Shield, ShieldOff, Plus, Minus, X } from 'lucide-react';
import toast from 'react-hot-toast';

type UserRole = 'admin' | 'user';

type PermissionMap = Record<string, boolean>;

interface User {
  id: string;
  email: string;
  kullanici_adi?: string;
  gorunen_ad?: string;
  aktif_mi: boolean;
  rol: UserRole;
  toplam_kredi: number;
  kullanilan_kredi: number;
  olusturma_tarihi: string;
  permissions?: PermissionMap;
  permission_summary?: string | null;
  is_system_user?: boolean;
}

const AI_PERMISSIONS = ['use_chat', 'use_image', 'use_video', 'use_photo_to_video', 'use_tts', 'use_music'];
const ADMIN_PERMISSIONS = ['access_admin', 'manage_users', 'manage_credits', 'manage_billing'];

const defaultPermissionMap = (): PermissionMap => {
  const map: PermissionMap = {};
  [...AI_PERMISSIONS, ...ADMIN_PERMISSIONS].forEach((key) => { map[key] = false; });
  return map;
};

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [activeFilter, setActiveFilter] = useState<'all' | 'admins' | 'users' | 'active' | 'passive' | 'permissionDenied'>('all');
  const [savingAccess, setSavingAccess] = useState(false);
  const [editorRole, setEditorRole] = useState<UserRole>('user');
  const [editorPermissions, setEditorPermissions] = useState<PermissionMap>(defaultPermissionMap());
  const [editorCredit, setEditorCredit] = useState(0);
  const [editorNote, setEditorNote] = useState('');

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    const merged = {
      ...defaultPermissionMap(),
      ...(selectedUser.permissions || {}),
    };
    setEditorPermissions(merged);
    setEditorRole((selectedUser.rol || 'user') as UserRole);
    setEditorCredit(Number(selectedUser.toplam_kredi || 0));
    setEditorNote('');
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Kullanıcılar alınamadı');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
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

      setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, aktif_mi: !currentStatus } : u));
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
        body: JSON.stringify({ amount: Number(creditAmount), action, reason: creditReason || 'Admin işlemi' })
      });

      if (!res.ok) throw new Error('Kredi işlemi başarısız');

      const data = await res.json();
      setUsers((prev) => prev.map((u) => u.id === selectedUser.id ? { ...u, toplam_kredi: data.newBalance } : u));
      toast.success('Kredi işlemi başarılı');
      setCreditAmount('');
      setCreditReason('');
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.message);
    }
  };

  const applyPreset = (type: 'all_on' | 'all_off' | 'me_puter' | 'default') => {
    const next = defaultPermissionMap();
    if (type === 'all_on') {
      [...AI_PERMISSIONS, ...ADMIN_PERMISSIONS].forEach((key) => { next[key] = true; });
    }
    if (type === 'me_puter') {
      AI_PERMISSIONS.forEach((key) => { next[key] = true; });
    }
    if (type === 'default') {
      if (editorRole === 'admin') {
        [...AI_PERMISSIONS, ...ADMIN_PERMISSIONS].forEach((key) => { next[key] = true; });
      }
    }
    setEditorPermissions(next);
  };

  const handleSaveAccess = async () => {
    if (!selectedUser) return;
    if (selectedUser.is_system_user && selectedUser.rol === 'admin' && editorRole === 'user') {
      toast.error('Sistem admin kullanıcısı user rolüne düşürülemez');
      return;
    }

    const diffRole = selectedUser.rol !== editorRole;
    const diffCredit = Number(selectedUser.toplam_kredi || 0) !== Number(editorCredit);
    const diffPermissions = JSON.stringify(selectedUser.permissions || {}) !== JSON.stringify(editorPermissions);

    const diffText = [
      diffRole ? `Rol: ${selectedUser.rol} → ${editorRole}` : null,
      diffCredit ? `Kredi: ${selectedUser.toplam_kredi} → ${editorCredit}` : null,
      diffPermissions ? 'İzinler güncellenecek' : null,
    ].filter(Boolean).join('\n');

    if (!diffText) {
      toast('Değişiklik yok');
      return;
    }

    if (!window.confirm(`Aşağıdaki değişiklikler uygulanacak:\n\n${diffText}\n\nOnaylıyor musunuz?`)) {
      return;
    }

    try {
      setSavingAccess(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}/access`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rol: editorRole,
          permissions: editorPermissions,
          toplam_kredi: editorCredit,
          muhasebe_notu: editorNote,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kaydetme başarısız');
      toast.success('Rol/izin/kredi güncellendi');
      await fetchUsers();
      setSelectedUser((prev) => prev ? { ...prev, ...data.user } : prev);
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setSavingAccess(false);
    }
  };

  const handleBulkApply = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Toplu işlem ${selectedIds.size} kullanıcıya uygulanacak. Onaylıyor musunuz?`)) return;

    try {
      const res = await fetch('/api/admin/users/bulk-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userIds: Array.from(selectedIds),
          rol: editorRole,
          permissions: editorPermissions,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Toplu işlem başarısız');
      const skipped = (data.results || []).filter((r: any) => r.status !== 'updated').length;
      toast.success(`Toplu işlem tamamlandı. Güncellenen: ${selectedIds.size - skipped}, Atlanan: ${skipped}`);
      await fetchUsers();
    } catch (error: any) {
      toast.error(error.message || 'Toplu işlem başarısız');
    }
  };

  const filteredUsers = useMemo(() => users.filter((u) => {
    const haystack = `${(u.email || '').toLowerCase()} ${(u.kullanici_adi || '').toLowerCase()} ${(u.gorunen_ad || '').toLowerCase()}`;
    if (searchTerm && !haystack.includes(searchTerm.toLowerCase())) return false;
    if (activeFilter === 'admins' && u.rol !== 'admin') return false;
    if (activeFilter === 'users' && u.rol !== 'user') return false;
    if (activeFilter === 'active' && !u.aktif_mi) return false;
    if (activeFilter === 'passive' && u.aktif_mi) return false;
    if (activeFilter === 'permissionDenied' && !Object.values(u.permissions || {}).some(Boolean)) return false;
    return true;
  }), [users, searchTerm, activeFilter]);

  const togglePermission = (key: string) => {
    setEditorPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center gap-4 flex-wrap">
        <h1 className="text-2xl font-bold text-zinc-900">Kullanıcı Yönetimi</h1>
        <div className="relative w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
          <input
            type="text"
            placeholder="E-posta / kullanıcı adı..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-white border border-zinc-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-black"
          />
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {[['all', 'Tümü'], ['admins', 'Sadece adminler'], ['users', 'Sadece userlar'], ['active', 'Sadece aktif'], ['passive', 'Sadece pasif'], ['permissionDenied', 'Sadece permission denied yaşayanlar']].map(([key, label]) => (
          <button
            key={key}
            onClick={() => setActiveFilter(key as any)}
            className={`px-3 py-2 rounded-lg border text-sm ${activeFilter === key ? 'bg-black text-white border-black' : 'bg-white border-zinc-200 text-zinc-700'}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="flex gap-2 items-center">
        <button onClick={handleBulkApply} disabled={selectedIds.size === 0} className="px-3 py-2 rounded-lg bg-indigo-600 text-white disabled:opacity-50">Seçililere Toplu Uygula</button>
        <span className="text-sm text-zinc-500">Seçili kullanıcı: {selectedIds.size}</span>
      </div>

      <div className="bg-white rounded-xl border border-zinc-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 border-b border-zinc-200 text-zinc-500">
              <tr>
                <th className="px-3 py-4 font-medium"><input type="checkbox" checked={filteredUsers.length > 0 && selectedIds.size === filteredUsers.length} onChange={(e) => setSelectedIds(e.target.checked ? new Set(filteredUsers.map((u) => u.id)) : new Set())} /></th>
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
                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">Yükleniyor...</td></tr>
              ) : filteredUsers.length === 0 ? (
                <tr><td colSpan={7} className="px-6 py-8 text-center text-zinc-500">Kullanıcı bulunamadı.</td></tr>
              ) : (
                filteredUsers.map((user) => (
                  <tr key={user.id} className="hover:bg-zinc-50 cursor-pointer" onClick={() => setSelectedUser(user)}>
                    <td className="px-3 py-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedIds.has(user.id)} onChange={(e) => {
                        const next = new Set(selectedIds);
                        if (e.target.checked) next.add(user.id); else next.delete(user.id);
                        setSelectedIds(next);
                      }} />
                    </td>
                    <td className="px-6 py-4">
                      <div className="font-medium text-zinc-900">{user.gorunen_ad || user.kullanici_adi || user.email}</div>
                      <div className="text-zinc-500">{user.email}</div>
                      <div className="text-xs text-zinc-400 mt-1">{user.permission_summary || 'Yetki özeti yok'}{user.is_system_user ? ' • sistem kullanıcısı' : ''}</div>
                    </td>
                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.rol === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-zinc-100 text-zinc-700'}`}>{user.rol}</span></td>
                    <td className="px-6 py-4"><div className="font-medium text-zinc-900">{user.toplam_kredi} Kredi</div><div className="text-zinc-500">{user.kullanilan_kredi} Harcanan</div></td>
                    <td className="px-6 py-4 text-zinc-500">{new Date(user.olusturma_tarihi).toLocaleDateString('tr-TR')}</td>
                    <td className="px-6 py-4"><span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${user.aktif_mi ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>{user.aktif_mi ? 'Aktif' : 'Pasif'}</span></td>
                    <td className="px-6 py-4 text-right space-x-2" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => setSelectedUser(user)} className="p-2 text-zinc-400 hover:text-black hover:bg-zinc-100 rounded-lg" title="Detay Paneli"><Plus className="w-4 h-4" /></button>
                      <button onClick={() => toggleUserStatus(user.id, user.aktif_mi)} className={`p-2 rounded-lg ${user.aktif_mi ? 'text-red-400 hover:text-red-600 hover:bg-red-50' : 'text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50'}`} title={user.aktif_mi ? 'Pasife Al' : 'Aktifleştir'}>
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

      {selectedUser && (
        <div className="fixed inset-0 z-50 bg-black/30" onClick={() => setSelectedUser(null)}>
          <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white shadow-2xl p-6 overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">Kullanıcı Detayı</h2>
              <button onClick={() => setSelectedUser(null)} className="p-2 rounded-lg hover:bg-zinc-100"><X className="w-4 h-4" /></button>
            </div>

            <div className="mb-4 text-sm text-zinc-600">
              <div><strong>Owner Kaynağı:</strong> me.puter</div>
              <div><strong>Kullanıcı Kredisi:</strong> {editorCredit}</div>
              <div><strong>Son Kredi Düşümü:</strong> {Math.max(0, Number(selectedUser.kullanilan_kredi || 0))}</div>
              <div><strong>İç Maliyet:</strong> kullanım kayıtlarından hesaplanır</div>
            </div>

            <label className="block text-sm font-semibold mb-2">Rol Atama</label>
            <div className="grid grid-cols-2 gap-3 mb-4">
              <button onClick={() => setEditorRole('user')} className={`py-3 rounded-xl border text-base font-semibold ${editorRole === 'user' ? 'bg-black text-white border-black' : 'bg-white border-zinc-200'}`}>User</button>
              <button onClick={() => setEditorRole('admin')} className={`py-3 rounded-xl border text-base font-semibold ${editorRole === 'admin' ? 'bg-black text-white border-black' : 'bg-white border-zinc-200'}`}>Admin</button>
            </div>

            <div className="grid grid-cols-2 gap-2 mb-4">
              <button onClick={() => applyPreset('all_on')} className="px-2 py-2 bg-zinc-900 text-white rounded-lg text-sm">Hepsini Aç</button>
              <button onClick={() => applyPreset('all_off')} className="px-2 py-2 bg-zinc-200 rounded-lg text-sm">Hepsini Kapat</button>
              <button onClick={() => applyPreset('me_puter')} className="px-2 py-2 bg-indigo-600 text-white rounded-lg text-sm">Sadece me.puter İzinleri</button>
              <button onClick={() => applyPreset('default')} className="px-2 py-2 bg-zinc-200 rounded-lg text-sm">Varsayılana Dön</button>
            </div>

            <h3 className="font-semibold mb-2">AI İzinleri</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {AI_PERMISSIONS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(editorPermissions[key])} onChange={() => togglePermission(key)} /> {key}</label>
              ))}
            </div>

            <h3 className="font-semibold mb-2">Yönetim İzinleri</h3>
            <div className="grid grid-cols-2 gap-2 mb-4">
              {ADMIN_PERMISSIONS.map((key) => (
                <label key={key} className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(editorPermissions[key])} onChange={() => togglePermission(key)} /> {key}</label>
              ))}
            </div>

            <label className="block text-sm font-medium mb-1">Muhasebe Notu</label>
            <textarea value={editorNote} onChange={(e) => setEditorNote(e.target.value)} className="w-full border rounded-lg p-2 mb-3" rows={3} placeholder="Owner maliyeti vs kullanıcı kredi düşümü notu" />

            <label className="block text-sm font-medium mb-1">Kredi (Kullanıcı Kredisi)</label>
            <input type="number" value={editorCredit} onChange={(e) => setEditorCredit(Number(e.target.value || 0))} className="w-full border rounded-lg p-2 mb-3" />

            <label className="block text-sm font-medium mb-1">Hızlı Kredi İşlemi</label>
            <div className="flex gap-2 mb-4">
              <input type="number" value={creditAmount} onChange={(e) => setCreditAmount(e.target.value)} className="flex-1 border rounded-lg p-2" placeholder="Miktar" />
              <input type="text" value={creditReason} onChange={(e) => setCreditReason(e.target.value)} className="flex-1 border rounded-lg p-2" placeholder="Açıklama" />
              <button onClick={() => handleCreditAction('add')} className="px-3 bg-black text-white rounded-lg"><Plus className="w-4 h-4" /></button>
              <button onClick={() => handleCreditAction('remove')} className="px-3 bg-red-600 text-white rounded-lg"><Minus className="w-4 h-4" /></button>
            </div>

            <button onClick={handleSaveAccess} disabled={savingAccess} className="w-full py-3 rounded-xl bg-black text-white disabled:opacity-50">{savingAccess ? 'Kaydediliyor...' : 'Değişiklikleri Kaydet'}</button>
          </div>
        </div>
      )}
    </div>
  );
}
