// src/pages/Admin/AdminUsers.tsx
// Bu sürüm, kullanıcı yönetimini tek ekranda permission + kredi + teşhis + test merkezi haline getirir.

import { useEffect, useMemo, useState } from 'react';
import {
  Search,
  Shield,
  ShieldOff,
  Plus,
  Minus,
  RefreshCcw,
  Wrench,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Activity,
  FileSearch,
  UserCog,
  ChevronRight,
  KeyRound,
  BadgeCheck,
  Sparkles,
  Loader2,
} from 'lucide-react';
import toast from 'react-hot-toast';

type PermissionKey =
  | 'use_chat'
  | 'use_image'
  | 'use_video'
  | 'use_photo_to_video'
  | 'use_tts'
  | 'use_music'
  | 'manage_users';

type TestType =
  | 'chat'
  | 'image'
  | 'video'
  | 'photo-to-video'
  | 'tts'
  | 'music';

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
  permissions?: Record<string, boolean>;
  permission_summary?: string | null;
  is_system_user?: boolean;
  is_seeded?: boolean;
  is_new_user?: boolean;
  notes?: string | null;
  son_giris_tarihi?: string | null;
  updated_at?: string | null;
}

interface TestResult {
  type: TestType;
  startedAt: string;
  finishedAt: string;
  ok: boolean;
  status: number;
  code: string;
  message: string;
  contentType: string;
  raw: any;
  meaning: string;
}

interface DiagnosisRow {
  label: string;
  value: string;
  durum: 'basarili' | 'uyari' | 'hatali' | 'bilgi';
  aciklama: string;
}

const PERMISSION_KEYS: PermissionKey[] = [
  'use_chat',
  'use_image',
  'use_video',
  'use_photo_to_video',
  'use_tts',
  'use_music',
  'manage_users',
];

const ME_PUTER_KEYS: PermissionKey[] = [
  'use_chat',
  'use_image',
  'use_video',
  'use_photo_to_video',
  'use_tts',
  'use_music',
];

const PERMISSION_LABELS: Record<PermissionKey, string> = {
  use_chat: 'Sohbet',
  use_image: 'Görsel',
  use_video: 'Video',
  use_photo_to_video: 'Fotoğraftan Video',
  use_tts: 'Metinden Ses',
  use_music: 'Müzik',
  manage_users: 'Kullanıcı Yönetimi',
};

const TEST_OPTIONS: Array<{ key: TestType; label: string }> = [
  { key: 'chat', label: 'Sohbet Testi' },
  { key: 'image', label: 'Görsel Testi' },
  { key: 'video', label: 'Video Testi' },
  { key: 'photo-to-video', label: 'Fotoğraftan Video Testi' },
  { key: 'tts', label: 'Metinden Ses Testi' },
  { key: 'music', label: 'Müzik Testi' },
];

const emptyPromptMap: Record<TestType, any> = {
  chat: {
    message: 'Merhaba, kısa bir test yanıtı ver.',
    messages: [{ role: 'user', content: 'Merhaba, kısa bir test yanıtı ver.' }],
  },
  image: {
    prompt: 'Beyaz fonda kırmızı elma',
  },
  video: {
    prompt: 'Masanın üstünde duran kırmızı elma için kısa sinematik video',
  },
  'photo-to-video': {
    prompt: 'Fotoğraftaki nesneye hafif sinematik hareket ver',
    imageUrl: 'https://placehold.co/600x400/png',
  },
  tts: {
    text: 'Bu bir kısa izin testidir.',
  },
  music: {
    prompt: 'Kısa sakin piyano melodisi',
  },
};

function classForStatus(durum: DiagnosisRow['durum']) {
  if (durum === 'basarili') return 'bg-emerald-50 border-emerald-200 text-emerald-700';
  if (durum === 'hatali') return 'bg-red-50 border-red-200 text-red-700';
  if (durum === 'uyari') return 'bg-amber-50 border-amber-200 text-amber-700';
  return 'bg-zinc-50 border-zinc-200 text-zinc-700';
}

function formatDate(value?: string | null) {
  if (!value) return 'Yok';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Geçersiz tarih';
  return date.toLocaleString('tr-TR');
}

function prettifyJson(value: any) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function getSafePermissions(user: User | null) {
  const current = user?.permissions ?? {};
  const normalized: Record<string, boolean> = {};
  Object.entries(current).forEach(([key, value]) => {
    normalized[String(key).trim().toLowerCase()] = Boolean(value);
  });
  return normalized;
}

function buildMeaningFromCode(code: string, status: number) {
  const normalized = String(code || '').toUpperCase();

  if (normalized === 'NO_TOKEN') {
    return 'Oturum bilgisi yok. Sorun izin değil, kimlik doğrulama katmanında.';
  }
  if (normalized === 'INVALID_TOKEN') {
    return 'Token geçersiz veya süresi dolmuş. Sorun izin değil, token doğrulamasında.';
  }
  if (normalized === 'USER_NOT_FOUND') {
    return 'Token çözüldü ama kullanıcı kaydı bulunamadı.';
  }
  if (normalized === 'ACCOUNT_INACTIVE') {
    return 'Kullanıcı pasif durumda olduğu için işlem reddedildi.';
  }
  if (normalized === 'NOT_ADMIN') {
    return 'Bu işlem yönetici ister. Sorun normal kullanıcı yetkisinde.';
  }
  if (normalized === 'PERMISSION_DENIED') {
    return 'İlgili route gerekli permission anahtarını bulamadı veya reddetti.';
  }
  if (normalized === 'ASSET_FORBIDDEN') {
    return 'Sorun yazma izni değil, varlık sahipliği eşleşmiyor.';
  }
  if (normalized === 'OWNER_RUNTIME_CALL_FAILED') {
    return 'Yerel route geçti fakat owner runtime tarafında çağrı başarısız oldu.';
  }
  if (status === 401) {
    return '401 döndü. Önce oturum ve token akışını kontrol et.';
  }
  if (status === 403) {
    return '403 döndü. Permission, rol veya sahiplik problemi olabilir.';
  }
  if (status >= 500) {
    return 'Sunucu hatası var. Route veya servis içinde başka bir kırılma olabilir.';
  }
  return 'Özel bir hata kodu yakalanmadı. Ham cevabı incelemek gerekir.';
}

export default function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);

  const [creditAmount, setCreditAmount] = useState('');
  const [creditReason, setCreditReason] = useState('');

  const [permissionsDraft, setPermissionsDraft] = useState<Record<string, boolean>>({});
  const [jsonDraft, setJsonDraft] = useState('{}');
  const [jsonMode, setJsonMode] = useState(false);

  const [testLoading, setTestLoading] = useState<Record<string, boolean>>({});
  const [lastTest, setLastTest] = useState<TestResult | null>(null);

  const [diagnosisRows, setDiagnosisRows] = useState<DiagnosisRow[]>([]);
  const [diagnosisLoading, setDiagnosisLoading] = useState(false);

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    const safe = getSafePermissions(selectedUser);
    setPermissionsDraft(safe);
    setJsonDraft(prettifyJson(safe));
    setLastTest(null);
    setDiagnosisRows(buildDiagnosis(selectedUser, null));
  }, [selectedUser]);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('Kullanıcılar alınamadı');
      const data = await res.json();
      setUsers(Array.isArray(data) ? data : []);
      if (selectedUser) {
        const fresh = Array.isArray(data) ? data.find((u) => u.id === selectedUser.id) : null;
        if (fresh) setSelectedUser(fresh);
      }
    } catch (error: any) {
      toast.error(error.message || 'Kullanıcılar alınamadı');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return users;

    return users.filter((u) => {
      return [
        u.email,
        u.kullanici_adi,
        u.gorunen_ad,
        u.id,
        u.rol,
        u.permission_summary || '',
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [users, searchTerm]);

  const selectedPermissionSummary = useMemo(() => {
    if (!selectedUser) return { acik: 0, kapali: PERMISSION_KEYS.length };
    const safe = permissionsDraft;
    const acik = PERMISSION_KEYS.filter((key) => Boolean(safe[key])).length;
    return { acik, kapali: PERMISSION_KEYS.length - acik };
  }, [selectedUser, permissionsDraft]);

  function buildDiagnosis(user: User, test: TestResult | null): DiagnosisRow[] {
    const safe = getSafePermissions({ ...user, permissions: permissionsDraft });
    const hasMePuterPermission = ME_PUTER_KEYS.some((key) => safe[key]);
    const allMePuterPermissions = ME_PUTER_KEYS.every((key) => safe[key]);
    const roleAdmin = String(user.rol).toLowerCase() === 'admin';
    const active = Boolean(user.aktif_mi);

    const rows: DiagnosisRow[] = [
      {
        label: 'Kullanıcı Durumu',
        value: active ? 'Aktif' : 'Pasif',
        durum: active ? 'basarili' : 'hatali',
        aciklama: active
          ? 'Kullanıcı aktif durumda.'
          : 'Pasif kullanıcı route aşamasında reddedilebilir.',
      },
      {
        label: 'Rol',
        value: roleAdmin ? 'Admin' : user.rol || 'user',
        durum: roleAdmin ? 'basarili' : 'bilgi',
        aciklama: roleAdmin
          ? 'Admin rolü birçok yönetim işlemini doğal olarak kolaylaştırır.'
          : 'Normal kullanıcıda permission anahtarları daha kritik hale gelir.',
      },
      {
        label: 'me.puter İzinleri',
        value: allMePuterPermissions
          ? 'Tam Açık'
          : hasMePuterPermission
          ? 'Kısmen Açık'
          : 'Kapalı',
        durum: allMePuterPermissions ? 'basarili' : hasMePuterPermission ? 'uyari' : 'hatali',
        aciklama: allMePuterPermissions
          ? 'Sohbet, görsel, video, fotoğraftan video, ses ve müzik izinleri açık.'
          : 'Permission denied hatasında ilk bakılacak yer burasıdır.',
      },
    ];

    if (test) {
      rows.push(
        {
          label: 'Son Test Durumu',
          value: `${test.type} / ${test.status}`,
          durum: test.ok ? 'basarili' : test.status === 403 || test.status === 401 ? 'hatali' : 'uyari',
          aciklama: test.message,
        },
        {
          label: 'Son Test Kodu',
          value: test.code || 'Kod yok',
          durum: test.ok ? 'basarili' : 'uyari',
          aciklama: test.meaning,
        },
        {
          label: 'İçerik Türü',
          value: test.contentType || 'Bilinmiyor',
          durum: 'bilgi',
          aciklama: 'JSON yerine HTML dönüyorsa yanlış route veya fallback ihtimali vardır.',
        }
      );
    } else {
      rows.push({
        label: 'Son Test Durumu',
        value: 'Henüz çalıştırılmadı',
        durum: 'bilgi',
        aciklama: 'Hızlı test butonlarından biriyle anlık teşhis yapılabilir.',
      });
    }

    return rows;
  }

  const refreshSelectedUser = async (userId: string) => {
    const res = await fetch('/api/admin/users');
    if (!res.ok) throw new Error('Kullanıcı yenilenemedi');
    const data = await res.json();
    const list = Array.isArray(data) ? data : [];
    setUsers(list);
    const fresh = list.find((u: User) => u.id === userId);
    if (fresh) {
      setSelectedUser(fresh);
      setPermissionsDraft(getSafePermissions(fresh));
      setJsonDraft(prettifyJson(getSafePermissions(fresh)));
      setDiagnosisRows(buildDiagnosis(fresh, lastTest));
    }
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      setBusy(true);
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aktif_mi: !currentStatus }),
      });

      if (!res.ok) throw new Error('Durum güncellenemedi');

      await fetchUsers();
      if (selectedUser?.id === userId) {
        await refreshSelectedUser(userId);
      }
      toast.success('Kullanıcı durumu güncellendi');
    } catch (error: any) {
      toast.error(error.message || 'Durum güncellenemedi');
    } finally {
      setBusy(false);
    }
  };

  const handleCreditAction = async (action: 'add' | 'remove') => {
    if (!selectedUser || !creditAmount) return;

    try {
      setBusy(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}/credits`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: Number(creditAmount),
          action,
          reason: creditReason || 'Admin işlemi',
        }),
      });

      if (!res.ok) throw new Error('Kredi işlemi başarısız');

      await refreshSelectedUser(selectedUser.id);
      toast.success(action === 'add' ? 'Kredi eklendi' : 'Kredi düşüldü');
      setCreditAmount('');
      setCreditReason('');
    } catch (error: any) {
      toast.error(error.message || 'Kredi işlemi başarısız');
    } finally {
      setBusy(false);
    }
  };

  const handlePermissionToggle = (key: PermissionKey) => {
    setPermissionsDraft((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      setJsonDraft(prettifyJson(next));
      return next;
    });
  };

  const handleJsonApplyToDraft = () => {
    try {
      const parsed = JSON.parse(jsonDraft || '{}');
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('JSON nesne olmalıdır');
      }
      const normalized: Record<string, boolean> = {};
      Object.entries(parsed).forEach(([key, value]) => {
        normalized[String(key).trim().toLowerCase()] = Boolean(value);
      });
      setPermissionsDraft(normalized);
      toast.success('Ham JSON taslağa uygulandı');
    } catch (error: any) {
      toast.error(error.message || 'JSON çözümlenemedi');
    }
  };

  const savePermissionDraft = async () => {
    if (!selectedUser) return;

    try {
      setBusy(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}/permissions`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ permissions: permissionsDraft }),
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || 'İzinler kaydedilemedi');
      }

      await refreshSelectedUser(selectedUser.id);
      toast.success('İzinler kaydedildi');
    } catch (error: any) {
      toast.error(error.message || 'İzinler kaydedilemedi');
    } finally {
      setBusy(false);
    }
  };

  const grantMePuterPermissions = async () => {
    if (!selectedUser) return;

    try {
      setBusy(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}/permissions/me-puter/grant`, {
        method: 'POST',
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || 'me.puter izinleri açılamadı');
      }

      await refreshSelectedUser(selectedUser.id);
      toast.success('me.puter izinleri açıldı');
    } catch (error: any) {
      toast.error(error.message || 'me.puter izinleri açılamadı');
    } finally {
      setBusy(false);
    }
  };

  const revokeMePuterPermissions = async () => {
    if (!selectedUser) return;

    try {
      setBusy(true);
      const res = await fetch(`/api/admin/users/${selectedUser.id}/permissions/me-puter/revoke`, {
        method: 'POST',
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(json?.error || 'me.puter izinleri kapatılamadı');
      }

      await refreshSelectedUser(selectedUser.id);
      toast.success('me.puter izinleri kapatıldı');
    } catch (error: any) {
      toast.error(error.message || 'me.puter izinleri kapatılamadı');
    } finally {
      setBusy(false);
    }
  };

  const runDiagnosis = async () => {
    if (!selectedUser) return;
    setDiagnosisLoading(true);
    try {
      const freshUser = users.find((u) => u.id === selectedUser.id) || selectedUser;
      setDiagnosisRows(buildDiagnosis(freshUser, lastTest));
      toast.success('Teşhis paneli güncellendi');
    } finally {
      setDiagnosisLoading(false);
    }
  };

  const runFeatureTest = async (type: TestType) => {
    if (!selectedUser) return;

    const endpointMap: Record<TestType, string> = {
      chat: '/api/ai/chat',
      image: '/api/ai/image',
      video: '/api/ai/video',
      'photo-to-video': '/api/ai/photo-to-video',
      tts: '/api/ai/tts',
      music: '/api/ai/music',
    };

    try {
      setTestLoading((prev) => ({ ...prev, [type]: true }));
      const startedAt = new Date().toISOString();

      const res = await fetch(endpointMap[type], {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(emptyPromptMap[type]),
      });

      const finishedAt = new Date().toISOString();
      const contentType = res.headers.get('content-type') || '';
      let raw: any = null;

      if (contentType.includes('application/json')) {
        raw = await res.json().catch(() => ({}));
      } else {
        raw = await res.text().catch(() => '');
      }

      const code = raw?.code || '';
      const message =
        raw?.error ||
        raw?.message ||
        (res.ok ? 'Test başarılı' : 'İstek başarısız');
      const meaning = buildMeaningFromCode(code, res.status);

      const result: TestResult = {
        type,
        startedAt,
        finishedAt,
        ok: res.ok,
        status: res.status,
        code,
        message,
        contentType,
        raw,
        meaning,
      };

      setLastTest(result);
      setDiagnosisRows(buildDiagnosis(selectedUser, result));

      if (res.ok) {
        toast.success(`${PERMISSION_LABELS[type === 'photo-to-video' ? 'use_photo_to_video' : (`use_${type}` as PermissionKey)] || type} testi başarılı`);
      } else {
        toast.error(`${type} testi başarısız: ${message}`);
      }
    } catch (error: any) {
      const result: TestResult = {
        type,
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        ok: false,
        status: 0,
        code: 'CLIENT_FETCH_FAILED',
        message: error.message || 'İstek atılamadı',
        contentType: 'client/error',
        raw: { error: error.message || 'İstek atılamadı' },
        meaning: 'İstek tarayıcıdan bile çıkamadı; ağ veya route problemi olabilir.',
      };
      setLastTest(result);
      setDiagnosisRows(buildDiagnosis(selectedUser, result));
      toast.error(error.message || 'Test çalıştırılamadı');
    } finally {
      setTestLoading((prev) => ({ ...prev, [type]: false }));
    }
  };

  const summaryCards = useMemo(() => {
    const total = users.length;
    const aktif = users.filter((u) => u.aktif_mi).length;
    const admin = users.filter((u) => String(u.rol).toLowerCase() === 'admin').length;
    const mePuterFull = users.filter((u) =>
      ME_PUTER_KEYS.every((key) => Boolean((u.permissions || {})[key]))
    ).length;

    return [
      { label: 'Toplam Kullanıcı', value: total },
      { label: 'Aktif Kullanıcı', value: aktif },
      { label: 'Yönetici', value: admin },
      { label: 'Tam me.puter İzinli', value: mePuterFull },
    ];
  }, [users]);

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto">
      <header className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Kullanıcı Yetki ve Teşhis Merkezi</h1>
          <p className="text-zinc-500 mt-1">
            Tek ekrandan kullanıcı durumu, kredi, me.puter izinleri, hızlı testler ve Permission denied teşhisi.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            onClick={fetchUsers}
            className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-zinc-200 rounded-xl text-zinc-700 hover:bg-zinc-50"
          >
            <RefreshCcw size={16} />
            Listeyi Yenile
          </button>
          <button
            onClick={runDiagnosis}
            disabled={!selectedUser || diagnosisLoading}
            className="inline-flex items-center gap-2 px-4 py-2 bg-amber-500 text-white rounded-xl hover:bg-amber-600 disabled:opacity-50"
          >
            {diagnosisLoading ? <Loader2 size={16} className="animate-spin" /> : <FileSearch size={16} />}
            Permission Denied Nedenini Bul
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {summaryCards.map((card) => (
          <div key={card.label} className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-5">
            <div className="text-sm text-zinc-500 mb-1">{card.label}</div>
            <div className="text-3xl font-bold text-zinc-900">{card.value}</div>
          </div>
        ))}
      </section>

      <div className="grid grid-cols-1 2xl:grid-cols-[560px_minmax(0,1fr)] gap-6 items-start">
        <section className="bg-white rounded-2xl border border-zinc-200 shadow-sm overflow-hidden">
          <div className="p-5 border-b border-zinc-200 flex flex-col gap-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-bold text-zinc-900">Kullanıcı Listesi</h2>
                <p className="text-sm text-zinc-500">Bir kullanıcı seç ve sağ panelden her şeyi yönet.</p>
              </div>
              <div className="text-sm text-zinc-500">{filteredUsers.length} sonuç</div>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-400" />
              <input
                type="text"
                placeholder="Ad, e-posta, kullanıcı adı, rol veya kullanıcı id ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
              />
            </div>
          </div>

          <div className="max-h-[900px] overflow-y-auto">
            {loading ? (
              <div className="p-8 text-center text-zinc-500">Yükleniyor...</div>
            ) : filteredUsers.length === 0 ? (
              <div className="p-8 text-center text-zinc-500">Kullanıcı bulunamadı.</div>
            ) : (
              <div className="divide-y divide-zinc-100">
                {filteredUsers.map((user) => {
                  const safe = getSafePermissions(user);
                  const mePuterOpenCount = ME_PUTER_KEYS.filter((key) => safe[key]).length;
                  const isSelected = selectedUser?.id === user.id;

                  return (
                    <button
                      key={user.id}
                      type="button"
                      onClick={() => setSelectedUser(user)}
                      className={`w-full text-left p-4 transition-colors ${
                        isSelected ? 'bg-black text-white' : 'hover:bg-zinc-50'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                            {user.gorunen_ad || user.kullanici_adi || user.email}
                          </div>
                          <div className={`text-sm truncate ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                            {user.email}
                          </div>
                          <div className={`text-xs mt-2 flex flex-wrap gap-2 ${isSelected ? 'text-zinc-300' : 'text-zinc-500'}`}>
                            <span>ID: {user.id}</span>
                            <span>•</span>
                            <span>{user.rol}</span>
                            <span>•</span>
                            <span>{user.aktif_mi ? 'Aktif' : 'Pasif'}</span>
                          </div>
                        </div>

                        <ChevronRight size={18} className={isSelected ? 'text-zinc-300' : 'text-zinc-400'} />
                      </div>

                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <div className={`rounded-xl px-3 py-2 ${isSelected ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                          <div className={`text-[11px] ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>Kredi</div>
                          <div className={`font-semibold ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{user.toplam_kredi}</div>
                        </div>
                        <div className={`rounded-xl px-3 py-2 ${isSelected ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                          <div className={`text-[11px] ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>me.puter</div>
                          <div className={`font-semibold ${isSelected ? 'text-white' : 'text-zinc-900'}`}>{mePuterOpenCount}/6</div>
                        </div>
                        <div className={`rounded-xl px-3 py-2 ${isSelected ? 'bg-zinc-800' : 'bg-zinc-100'}`}>
                          <div className={`text-[11px] ${isSelected ? 'text-zinc-400' : 'text-zinc-500'}`}>Özet</div>
                          <div className={`font-semibold truncate ${isSelected ? 'text-white' : 'text-zinc-900'}`}>
                            {user.permission_summary || 'Yok'}
                          </div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </section>

        <section className="space-y-6">
          {!selectedUser ? (
            <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-10 text-center text-zinc-500">
              Soldan bir kullanıcı seç. Sağ panelde izinler, teşhis, test ve kredi yönetimi açılacak.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6">
                <div className="flex flex-col xl:flex-row xl:items-start justify-between gap-5">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-bold text-zinc-900">
                        {selectedUser.gorunen_ad || selectedUser.kullanici_adi || selectedUser.email}
                      </h2>

                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          selectedUser.aktif_mi ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                        }`}
                      >
                        {selectedUser.aktif_mi ? 'Aktif' : 'Pasif'}
                      </span>

                      <span
                        className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${
                          String(selectedUser.rol).toLowerCase() === 'admin'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-zinc-100 text-zinc-700'
                        }`}
                      >
                        {selectedUser.rol}
                      </span>
                    </div>

                    <div className="mt-3 text-sm text-zinc-500 space-y-1">
                      <div>E-posta: {selectedUser.email}</div>
                      <div>Kullanıcı adı: {selectedUser.kullanici_adi}</div>
                      <div>Kullanıcı ID: {selectedUser.id}</div>
                      <div>Kayıt tarihi: {formatDate(selectedUser.olusturma_tarihi)}</div>
                      <div>Son güncelleme: {formatDate(selectedUser.updated_at)}</div>
                      <div>Son giriş: {formatDate(selectedUser.son_giris_tarihi)}</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 min-w-full xl:min-w-[460px]">
                    <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
                      <div className="text-xs text-zinc-500">Toplam Kredi</div>
                      <div className="text-2xl font-bold text-zinc-900">{selectedUser.toplam_kredi}</div>
                    </div>
                    <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
                      <div className="text-xs text-zinc-500">Harcanan</div>
                      <div className="text-2xl font-bold text-zinc-900">{selectedUser.kullanilan_kredi}</div>
                    </div>
                    <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
                      <div className="text-xs text-zinc-500">Açık İzin</div>
                      <div className="text-2xl font-bold text-zinc-900">{selectedPermissionSummary.acik}</div>
                    </div>
                    <div className="bg-zinc-50 rounded-2xl p-4 border border-zinc-200">
                      <div className="text-xs text-zinc-500">Kapalı İzin</div>
                      <div className="text-2xl font-bold text-zinc-900">{selectedPermissionSummary.kapali}</div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    onClick={() => toggleUserStatus(selectedUser.id, selectedUser.aktif_mi)}
                    disabled={busy}
                    className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-white ${
                      selectedUser.aktif_mi ? 'bg-red-600 hover:bg-red-700' : 'bg-emerald-600 hover:bg-emerald-700'
                    } disabled:opacity-50`}
                  >
                    {selectedUser.aktif_mi ? <ShieldOff size={16} /> : <Shield size={16} />}
                    {selectedUser.aktif_mi ? 'Pasife Al' : 'Aktifleştir'}
                  </button>

                  <button
                    onClick={grantMePuterPermissions}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white hover:bg-zinc-800 disabled:opacity-50"
                  >
                    <Sparkles size={16} />
                    me.puter İzinlerini Aç
                  </button>

                  <button
                    onClick={revokeMePuterPermissions}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-800 hover:bg-zinc-200 disabled:opacity-50"
                  >
                    <ShieldOff size={16} />
                    me.puter İzinlerini Kapat
                  </button>

                  <button
                    onClick={() => refreshSelectedUser(selectedUser.id)}
                    disabled={busy}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
                  >
                    <RefreshCcw size={16} />
                    Kullanıcıyı Yenile
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-bold text-zinc-900">İzin Yönetimi</h3>
                      <p className="text-sm text-zinc-500">Tek tek aç, kapat veya ham JSON ile toplu düzenle.</p>
                    </div>
                    <button
                      onClick={() => setJsonMode((prev) => !prev)}
                      className="px-3 py-2 rounded-xl bg-zinc-100 text-zinc-700 hover:bg-zinc-200 text-sm"
                    >
                      {jsonMode ? 'Kart Görünümüne Dön' : 'Ham JSON Modu'}
                    </button>
                  </div>

                  {!jsonMode ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {PERMISSION_KEYS.map((key) => {
                        const isOpen = Boolean(permissionsDraft[key]);
                        return (
                          <div
                            key={key}
                            className={`rounded-2xl border p-4 transition-colors ${
                              isOpen ? 'border-emerald-200 bg-emerald-50' : 'border-zinc-200 bg-zinc-50'
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="font-semibold text-zinc-900">{PERMISSION_LABELS[key]}</div>
                                <div className="text-xs text-zinc-500 mt-1">Anahtar: {key}</div>
                              </div>

                              <button
                                onClick={() => handlePermissionToggle(key)}
                                className={`w-14 h-8 rounded-full relative transition-colors ${
                                  isOpen ? 'bg-emerald-500' : 'bg-zinc-300'
                                }`}
                              >
                                <span
                                  className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all ${
                                    isOpen ? 'left-7' : 'left-1'
                                  }`}
                                />
                              </button>
                            </div>

                            <div className="mt-3 text-xs font-medium">
                              {isOpen ? (
                                <span className="inline-flex items-center gap-1 text-emerald-700">
                                  <CheckCircle2 size={14} />
                                  Açık
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-zinc-600">
                                  <XCircle size={14} />
                                  Kapalı
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <textarea
                        value={jsonDraft}
                        onChange={(e) => setJsonDraft(e.target.value)}
                        className="w-full min-h-[300px] rounded-2xl border border-zinc-200 bg-zinc-950 text-zinc-100 p-4 font-mono text-sm focus:outline-none focus:ring-2 focus:ring-black"
                        spellCheck={false}
                      />
                      <button
                        onClick={handleJsonApplyToDraft}
                        className="px-4 py-2 rounded-xl bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                      >
                        JSON Taslağını Uygula
                      </button>
                    </div>
                  )}

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={savePermissionDraft}
                      disabled={busy}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-black text-white hover:bg-zinc-800 disabled:opacity-50"
                    >
                      <KeyRound size={16} />
                      İzinleri Kaydet
                    </button>

                    <button
                      onClick={() => {
                        const safe = getSafePermissions(selectedUser);
                        setPermissionsDraft(safe);
                        setJsonDraft(prettifyJson(safe));
                      }}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-zinc-100 text-zinc-800 hover:bg-zinc-200"
                    >
                      <RefreshCcw size={16} />
                      Taslağı Geri Al
                    </button>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">Kredi Yönetimi</h3>
                    <p className="text-sm text-zinc-500">Seçili kullanıcı için kredi ekle veya düş.</p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">Miktar</label>
                      <input
                        type="number"
                        value={creditAmount}
                        onChange={(e) => setCreditAmount(e.target.value)}
                        className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="Örn: 100"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-zinc-700 mb-2">Açıklama</label>
                      <input
                        type="text"
                        value={creditReason}
                        onChange={(e) => setCreditReason(e.target.value)}
                        className="w-full px-4 py-3 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-black"
                        placeholder="Örn: Yönetici müdahalesi"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-3">
                    <button
                      onClick={() => handleCreditAction('add')}
                      disabled={busy || !creditAmount}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      <Plus size={16} />
                      Kredi Ekle
                    </button>
                    <button
                      onClick={() => handleCreditAction('remove')}
                      disabled={busy || !creditAmount}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-red-600 text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      <Minus size={16} />
                      Kredi Düş
                    </button>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-zinc-900">Permission Denied Teşhis Paneli</h3>
                    <p className="text-sm text-zinc-500">Auth, permission, rol ve son test sonucunu tek yerde gör.</p>
                  </div>
                  <button
                    onClick={runDiagnosis}
                    disabled={diagnosisLoading}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                  >
                    {diagnosisLoading ? <Loader2 size={16} className="animate-spin" /> : <Wrench size={16} />}
                    Teşhisi Yenile
                  </button>
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-3">
                  {diagnosisRows.map((row) => (
                    <div key={row.label} className={`rounded-2xl border p-4 ${classForStatus(row.durum)}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">{row.label}</div>
                          <div className="text-xl font-bold mt-1">{row.value}</div>
                          <div className="text-xs mt-2 opacity-90">{row.aciklama}</div>
                        </div>

                        {row.durum === 'basarili' && <BadgeCheck size={18} />}
                        {row.durum === 'hatali' && <XCircle size={18} />}
                        {row.durum === 'uyari' && <AlertTriangle size={18} />}
                        {row.durum === 'bilgi' && <Activity size={18} />}
                      </div>
                    </div>
                  ))}
                </div>

                {lastTest && (
                  <div className="rounded-2xl border border-zinc-200 overflow-hidden">
                    <div className="px-4 py-3 bg-zinc-50 border-b border-zinc-200 flex flex-wrap items-center gap-3 text-sm">
                      <span className="font-semibold text-zinc-900">Son Test:</span>
                      <span className="text-zinc-700">{lastTest.type}</span>
                      <span className="text-zinc-500">•</span>
                      <span className={lastTest.ok ? 'text-emerald-700 font-medium' : 'text-red-700 font-medium'}>
                        {lastTest.ok ? 'Başarılı' : 'Başarısız'}
                      </span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-700">HTTP {lastTest.status}</span>
                      <span className="text-zinc-500">•</span>
                      <span className="text-zinc-700">{lastTest.code || 'Kod yok'}</span>
                    </div>
                    <div className="p-4 space-y-3">
                      <div className="text-sm text-zinc-700">
                        <span className="font-semibold">Anlamı:</span> {lastTest.meaning}
                      </div>
                      <div className="text-sm text-zinc-700">
                        <span className="font-semibold">Mesaj:</span> {lastTest.message}
                      </div>
                      <div className="text-sm text-zinc-700">
                        <span className="font-semibold">İçerik Türü:</span> {lastTest.contentType || 'Yok'}
                      </div>
                      <pre className="bg-zinc-950 text-zinc-100 rounded-2xl p-4 overflow-auto text-xs leading-6">
                        {prettifyJson(lastTest.raw)}
                      </pre>
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
                <div>
                  <h3 className="text-lg font-bold text-zinc-900">Hızlı Testler</h3>
                  <p className="text-sm text-zinc-500">Seçili kullanıcı oturumu üzerinden ilgili AI route’una istek atar.</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {TEST_OPTIONS.map((test) => (
                    <button
                      key={test.key}
                      onClick={() => runFeatureTest(test.key)}
                      disabled={Boolean(testLoading[test.key])}
                      className="flex items-center justify-between gap-3 rounded-2xl border border-zinc-200 p-4 hover:bg-zinc-50 disabled:opacity-50"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-zinc-100 flex items-center justify-center text-zinc-700">
                          <Activity size={18} />
                        </div>
                        <div className="text-left">
                          <div className="font-semibold text-zinc-900">{test.label}</div>
                          <div className="text-xs text-zinc-500">{test.key}</div>
                        </div>
                      </div>

                      {testLoading[test.key] ? <Loader2 size={18} className="animate-spin text-zinc-500" /> : <ChevronRight size={18} className="text-zinc-400" />}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
