import { useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';

const FEATURES = ['image', 'chat', 'video', 'tts', 'ocr'] as const;
type Feature = typeof FEATURES[number];

const MODEL_SOURCE_OPTIONS = ['im', 'chat-core', 'video-core', 'tts-core', 'ocr-core'];
const WORKER_URL_OPTIONS = ['https://im.puter.work', 'https://api-cagrilari.puter.work', 'https://is-durumu.puter.work'];

const IMAGE_DEFAULTS = {
  modelSourceKey: 'im',
  customWorkerUrl: 'https://im.puter.work',
  rawCodeUrl: 'https://turk.puter.site/workers/modeller/im.js',
  editCodeUrl: 'https://github.com/salihcelebi/puter/edit/main/worker/modeller/im.js',
};

async function safeJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';
  if (/<!doctype|<html/i.test(text)) throw new Error('Beklenmeyen HTML yanıtı alındı.');
  if (!contentType.includes('application/json')) throw new Error('JSON içerik tipi bekleniyordu.');
  let data: any = {};
  try { data = text ? JSON.parse(text) : {}; } catch { throw new Error('Geçersiz JSON yanıtı.'); }
  if (!res.ok) throw new Error(data?.error || 'İstek başarısız');
  return data as T;
}

export default function AdminWorkersSec() {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [selectedFeature, setSelectedFeature] = useState<Feature>('image');
  const [saving, setSaving] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetPhase, setResetPhase] = useState<'password' | 'summary'>('password');

  const current = config[selectedFeature] || {};

  const impactSummary = useMemo(() => {
    const defaults = selectedFeature === 'image' ? IMAGE_DEFAULTS : {
      modelSourceKey: current.modelSourceKey || '',
      customWorkerUrl: '',
      rawCodeUrl: '',
      editCodeUrl: '',
    };
    return [
      `Özel worker adresi ${current.customWorkerUrl ? 'silinecek' : 'zaten boş'}.`,
      `Özel model adresi ${current.customModelUrl ? 'silinecek' : 'zaten boş'}.`,
      `Model kaynağı '${current.modelSourceKey || '-'}' değerinden '${defaults.modelSourceKey || '-'}' değerine dönecek.`,
      `Raw/Edit linkleri varsayılan değerlere dönecek.`,
      `Test/diagnostics görünümü yeni varsayılanlara göre güncellenecek.`,
    ];
  }, [current, selectedFeature]);

  const load = async () => {
    const data = await safeJson<Record<string, any>>('/api/admin/workers-config');
    setConfig(data || {});
  };

  const loadDiagnostics = async () => {
    const data = await safeJson<any>('/api/admin/workers/diagnostics');
    setDiagnostics(data);
  };

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
    loadDiagnostics().catch((e) => toast.error(e.message));
  }, []);

  const patchCurrent = (patch: Record<string, any>) => {
    setConfig((prev) => ({ ...prev, [selectedFeature]: { ...(prev[selectedFeature] || {}), ...patch } }));
  };

  const save = async () => {
    try {
      setSaving(true);
      await safeJson('/api/admin/workers-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [selectedFeature]: current }),
      });
      toast.success('Workers ayarları kaydedildi.');
      await load();
      await loadDiagnostics();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runResetFlow = async () => {
    const adminPass = 'Sal!hc3l38!';
    if (resetPhase === 'password') {
      if (resetPassword !== adminPass) {
        toast.error('Şifre doğrulanamadı.');
        return;
      }
      setResetPhase('summary');
      return;
    }

    const defaults = selectedFeature === 'image' ? IMAGE_DEFAULTS : { modelSourceKey: current.modelSourceKey || 'default', customWorkerUrl: '', rawCodeUrl: '', editCodeUrl: '' };
    patchCurrent({
      useDefault: true,
      customWorkerUrl: defaults.customWorkerUrl,
      customModelUrl: '',
      modelSourceKey: defaults.modelSourceKey,
      rawCodeUrl: defaults.rawCodeUrl,
      editCodeUrl: defaults.editCodeUrl,
    });

    try {
      await safeJson('/api/admin/workers-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          [selectedFeature]: {
            useDefault: true,
            customWorkerUrl: defaults.customWorkerUrl,
            customModelUrl: '',
            modelSourceKey: defaults.modelSourceKey,
            rawCodeUrl: defaults.rawCodeUrl,
            editCodeUrl: defaults.editCodeUrl,
          },
        }),
      });
      toast.success('Bölüm güvenli şekilde varsayılanlara döndürüldü.');
      setResetModalOpen(false);
      setResetPassword('');
      setResetPhase('password');
      await load();
      await loadDiagnostics();
    } catch (e: any) {
      toast.error(e.message || 'Reset işlemi başarısız.');
    }
  };

  const test = async () => {
    try {
      const data = await safeJson<any>('/api/admin/workers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: selectedFeature }),
      });
      toast.success(data.healthy ? 'Worker doğrulaması başarılı.' : 'Worker doğrulaması başarısız.');
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Workers Yönetimi</h1>
        <p className="text-sm text-zinc-500">Feature bazlı sayfa/worker/model kaynağı orkestrasyon ayarları.</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FEATURES.map((f) => (
          <button key={f} onClick={() => setSelectedFeature(f)} className={`px-3 py-2 rounded-lg border ${selectedFeature === f ? 'bg-black text-white border-black' : 'bg-white border-zinc-200 text-zinc-700'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-4">
        {/* DELILX: Bu ekran tamamen Türkçeleştirildi; her alan neden gerekli olduğu açıklamasıyla birlikte gelir. */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">Etkin Sayfa
            <input className="w-full mt-1 border rounded-lg p-2" value={current.selectedPage || ''} onChange={(e) => patchCurrent({ selectedPage: e.target.value })} />
            <div className="text-xs text-zinc-500 mt-1">Seçili feature için aktif kullanılan sayfa dosyası.</div>
          </label>

          <label className="text-sm">Uyumlu Sayfalar (virgülle)
            <input className="w-full mt-1 border rounded-lg p-2" value={(current.compatiblePages || []).join(',')} onChange={(e) => patchCurrent({ compatiblePages: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            <div className="text-xs text-zinc-500 mt-1">Bu feature ile teknik olarak uyumlu sayfa listesi.</div>
          </label>

          <label className="text-sm">Ana Worker
            <input className="w-full mt-1 border rounded-lg p-2" value={current.primaryWorkerKey || ''} onChange={(e) => patchCurrent({ primaryWorkerKey: e.target.value })} />
            <div className="text-xs text-zinc-500 mt-1">İlk tercih edilen worker anahtarı.</div>
          </label>

          <label className="text-sm">Yedek Worker’lar (virgülle)
            <input className="w-full mt-1 border rounded-lg p-2" value={(current.fallbackWorkerKeys || []).join(',')} onChange={(e) => patchCurrent({ fallbackWorkerKeys: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
            <div className="text-xs text-zinc-500 mt-1">Ana worker başarısız olursa kullanılacak yedekler.</div>
          </label>

          {/* DELILX: Dropdown + manuel giriş birlikte sunulur; hızlı seçim ve tam URL esnekliği aynı anda korunur. */}
          <label className="text-sm">Model Kaynağı
            <select className="w-full mt-1 border rounded-lg p-2" value={current.modelSourceKey || ''} onChange={(e) => patchCurrent({ modelSourceKey: e.target.value })}>
              <option value="">Seçiniz</option>
              {MODEL_SOURCE_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <input className="w-full mt-1 border rounded-lg p-2" value={current.modelSourceKey || ''} onChange={(e) => patchCurrent({ modelSourceKey: e.target.value })} placeholder="Model kaynağını elle yaz" />
            <div className="text-xs text-zinc-500 mt-1">Dropdown hazır seçenek verir; alttaki alandan serbest düzenleyebilirsiniz.</div>
          </label>

          <label className="text-sm">Worker Servis Adresi
            <select className="w-full mt-1 border rounded-lg p-2" value={current.customWorkerUrl || ''} onChange={(e) => patchCurrent({ customWorkerUrl: e.target.value })}>
              <option value="">Seçiniz</option>
              {WORKER_URL_OPTIONS.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
            </select>
            <input className="w-full mt-1 border rounded-lg p-2" value={current.customWorkerUrl || ''} onChange={(e) => patchCurrent({ customWorkerUrl: e.target.value })} placeholder="https://..." />
            <div className="text-xs text-zinc-500 mt-1">Feature çağrılarında kullanılacak worker servis URL’i.</div>
          </label>

          <label className="text-sm">Özel Model Adresi
            <input className="w-full mt-1 border rounded-lg p-2" value={current.customModelUrl || ''} onChange={(e) => patchCurrent({ customModelUrl: e.target.value })} placeholder="https://..." />
            <div className="text-xs text-zinc-500 mt-1">Model listesinin çekileceği özel URL (varsa).</div>
          </label>

          <label className="text-sm">Kısa Açıklama
            <input className="w-full mt-1 border rounded-lg p-2" value={current.shortDescription || ''} onChange={(e) => patchCurrent({ shortDescription: e.target.value })} />
            <div className="text-xs text-zinc-500 mt-1">Bu feature ayarının ekip içi kısa açıklaması.</div>
          </label>

          {/* DELILX: Raw code alanı adminin kodun metin/raw halini doğrudan görüp doğrulaması için eklendi. */}
          <label className="text-sm">Kodların metin hali / raw hali
            <input className="w-full mt-1 border rounded-lg p-2" value={current.rawCodeUrl || ''} onChange={(e) => patchCurrent({ rawCodeUrl: e.target.value })} placeholder="https://.../im.js" />
            <a className="text-xs text-indigo-600 hover:underline" href={current.rawCodeUrl || '#'} target="_blank" rel="noreferrer">Raw bağlantıyı aç</a>
          </label>

          <label className="text-sm">Düzenleme bağlantısı
            <input className="w-full mt-1 border rounded-lg p-2" value={current.editCodeUrl || ''} onChange={(e) => patchCurrent({ editCodeUrl: e.target.value })} placeholder="https://github.com/..." />
            <a className="text-xs text-indigo-600 hover:underline" href={current.editCodeUrl || '#'} target="_blank" rel="noreferrer">Düzenleme bağlantısını aç</a>
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input id="useDefault" type="checkbox" checked={Boolean(current.useDefault)} onChange={(e) => patchCurrent({ useDefault: e.target.checked })} />
          <label htmlFor="useDefault" className="text-sm">Varsayılan / Özel Kullan</label>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button title="Yaptığınız ayarları kalıcı olarak kaydeder." onClick={save} disabled={saving} className="px-3 py-2 rounded-lg bg-black text-white">{saving ? 'Kaydediliyor...' : 'Kaydet'}</button>
          {/* DELILX: Reset güvenlik akışı şifre doğrulama + 5 madde etkiler + açık onay olmadan yazma yapmaz. */}
          <button title="Bu bölümü güvenli onay akışıyla varsayılanlara döndürür." onClick={() => { setResetModalOpen(true); setResetPhase('password'); }} className="px-3 py-2 rounded-lg bg-zinc-200">Sıfırla</button>
          <button title="Seçili worker ve model kaynağını hızlıca doğrular." onClick={test} className="px-3 py-2 rounded-lg bg-indigo-600 text-white">Test</button>
          <button title="Bağlantı ve oturum durumunu teknik özetle gösterir." onClick={loadDiagnostics} className="px-3 py-2 rounded-lg bg-zinc-200">Tanı</button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 text-sm">
        <div><strong>Servis Oturumu:</strong> {diagnostics?.session?.status || '-'}</div>
        <div><strong>Rezervasyon Sayısı:</strong> {diagnostics?.reservationCount ?? '-'}</div>
        <div><strong>Admin Cost Kaydı:</strong> {diagnostics?.adminCostCount ?? '-'}</div>
      </div>

      {resetModalOpen ? (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-5 w-full max-w-lg">
            <h3 className="text-lg font-semibold">Güvenli Sıfırlama</h3>
            {resetPhase === 'password' ? (
              <>
                <p className="text-sm text-zinc-600 mt-2">Sıfırlama için admin şifresi gerekli.</p>
                <input type="password" className="w-full mt-3 border rounded-lg p-2" value={resetPassword} onChange={(e) => setResetPassword(e.target.value)} placeholder="Admin şifresi" />
                <div className="flex gap-2 mt-4 justify-end">
                  <button className="px-3 py-2 rounded-lg bg-zinc-200" onClick={() => setResetModalOpen(false)}>Vazgeç</button>
                  <button className="px-3 py-2 rounded-lg bg-black text-white" onClick={runResetFlow}>Doğrula</button>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm text-zinc-600 mt-2">Aşağıdaki etkiler uygulanacak:</p>
                <ul className="list-disc pl-5 text-sm mt-2 space-y-1">
                  {impactSummary.map((item) => <li key={item}>{item}</li>)}
                </ul>
                <p className="text-sm mt-3 font-medium">Onaylıyor musunuz?</p>
                <div className="flex gap-2 mt-4 justify-end">
                  <button className="px-3 py-2 rounded-lg bg-zinc-200" onClick={() => setResetModalOpen(false)}>Hayır</button>
                  <button className="px-3 py-2 rounded-lg bg-red-600 text-white" onClick={runResetFlow}>Evet</button>
                </div>
              </>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
