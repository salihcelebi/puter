import { useEffect, useMemo, useState, useCallback } from 'react';
import toast from 'react-hot-toast';

// ─── Types ───────────────────────────────────────────────────────────────────

const FEATURES = ['image', 'chat', 'video', 'tts', 'ocr'] as const;
type Feature = typeof FEATURES[number];

interface FeatureConfig {
  selectedPage?: string;
  compatiblePages?: string[];
  primaryWorkerKey?: string;
  fallbackWorkerKeys?: string[];
  modelSourceKey?: string;
  customWorkerUrl?: string;
  customModelUrl?: string;
  rawCodeUrl?: string;
  editCodeUrl?: string;
  shortDescription?: string;
  useDefault?: boolean;
}

interface DiagnosticsData {
  session?: { status: string };
  reservationCount?: number;
  adminCostCount?: number;
  lastUpdated?: string;
  lastUpdatedBy?: string;
}

interface TestResult {
  workerReachable: boolean | null;
  modelReachable: boolean | null;
  jsonReturned: boolean | null;
  htmlFallback: boolean | null;
  overall: 'success' | 'fail' | 'pending';
  message?: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const FEATURE_NAMES: Record<Feature, string> = {
  image: 'Görsel Üretim', chat: 'Sohbet', video: 'Video', tts: 'Ses (TTS)', ocr: 'Metin Tanıma (OCR)',
};
const FEATURE_DESCS: Record<Feature, string> = {
  image: 'Resim üretmek için kullanılır.',
  chat: 'Yapay zeka sohbeti için kullanılır.',
  video: 'Video oluşturma ve işleme için kullanılır.',
  tts: 'Metni sese dönüştürmek için kullanılır.',
  ocr: 'Görseldeki metni okumak için kullanılır.',
};
const FEATURE_EFFECTS: Record<Feature, string[]> = {
  image: ['Görsel üretim sayfasının hangi worker\'a bağlandığını değiştirir.', 'Model listesinin hangi kaynaktan okunacağını belirler.', 'Test ve tanı sonuçlarını etkiler.', 'Kaydetmeden canlıya yansımaz.'],
  chat: ['Sohbet özelliğinin hangi worker\'a bağlandığını değiştirir.', 'Model listesinin hangi kaynaktan okunacağını belirler.', 'Sohbet sayfalarındaki model seçeneklerini etkiler.', 'Kaydetmeden canlıya yansımaz.'],
  video: ['Video işleme servisinin adresini değiştirir.', 'Video model kaynağını belirler.', 'Test ve tanı sonuçlarını etkiler.', 'Kaydetmeden canlıya yansımaz.'],
  tts: ['Ses sentezi servisinin adresini değiştirir.', 'Ses model listesinin kaynağını belirler.', 'Test ve tanı sonuçlarını etkiler.', 'Kaydetmeden canlıya yansımaz.'],
  ocr: ['OCR servisinin adresini değiştirir.', 'Metin tanıma model kaynağını belirler.', 'Test ve tanı sonuçlarını etkiler.', 'Kaydetmeden canlıya yansımaz.'],
};

const IMAGE_DEFAULTS: Partial<FeatureConfig> = {
  modelSourceKey: 'im',
  customWorkerUrl: 'https://im.puter.work',
  customModelUrl: 'https://im.puter.work/models',
  rawCodeUrl: 'https://turk.puter.site/workers/modeller/im.js',
  editCodeUrl: 'https://github.com/salihcelebi/puter/edit/main/worker/modeller/im.js',
};

const FEATURE_DEFAULTS: Record<Feature, FeatureConfig> = {
  image: { selectedPage: 'image.tsx', primaryWorkerKey: 'im', modelSourceKey: 'im', customWorkerUrl: 'https://im.puter.work', customModelUrl: 'https://im.puter.work/models', rawCodeUrl: 'https://turk.puter.site/workers/modeller/im.js', editCodeUrl: 'https://github.com/salihcelebi/puter/edit/main/worker/modeller/im.js' },
  chat: { selectedPage: 'chat.tsx', primaryWorkerKey: 'api-cagrilari', modelSourceKey: 'chat-core', customWorkerUrl: 'https://api-cagrilari.puter.work' },
  video: { selectedPage: 'video.tsx', primaryWorkerKey: 'video-core', modelSourceKey: 'video-core', customWorkerUrl: '' },
  tts: { selectedPage: 'tts.tsx', primaryWorkerKey: 'tts-core', modelSourceKey: 'tts-core', customWorkerUrl: '' },
  ocr: { selectedPage: 'ocr.tsx', primaryWorkerKey: 'ocr-core', modelSourceKey: 'ocr-core', customWorkerUrl: '' },
};

const MODEL_SOURCE_OPTIONS = [
  { value: 'im', label: 'im — Image modelleri' },
  { value: 'chat-core', label: 'chat-core — Sohbet modelleri' },
  { value: 'video-core', label: 'video-core — Video modelleri' },
  { value: 'tts-core', label: 'tts-core — Ses modelleri' },
  { value: 'ocr-core', label: 'ocr-core — OCR modelleri' },
];
const WORKER_KEY_OPTIONS = [
  { value: 'im', label: 'im — Görsel modelleri ve image isteklerini yönetir' },
  { value: 'api-cagrilari', label: 'api-cagrilari — Sohbet ve metin isteklerini yönetir' },
  { value: 'is-durumu', label: 'is-durumu — Durum ve tanılama işlemlerini yönetir' },
  { value: 'video-core', label: 'video-core — Video işleme isteklerini yönetir' },
  { value: 'tts-core', label: 'tts-core — Ses sentezi isteklerini yönetir' },
  { value: 'ocr-core', label: 'ocr-core — Optik karakter tanıma isteklerini yönetir' },
];
const WORKER_URL_OPTIONS = [
  { value: 'https://im.puter.work', label: 'https://im.puter.work — Görsel worker' },
  { value: 'https://api-cagrilari.puter.work', label: 'https://api-cagrilari.puter.work — Sohbet worker' },
  { value: 'https://is-durumu.puter.work', label: 'https://is-durumu.puter.work — Durum worker' },
];

const FEATURE_STATUS: Record<Feature, 'ok' | 'warn' | 'err' | 'unk'> = {
  image: 'ok', chat: 'ok', video: 'warn', tts: 'unk', ocr: 'unk',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

function isValidHttpsUrl(v: string) {
  return v.startsWith('https://') && v.length > 10;
}

function copyToClipboard(text: string) {
  if (!text) { toast.error('Kopyalanacak içerik yok.'); return; }
  navigator.clipboard.writeText(text).then(() => toast.success('Kopyalandı!')).catch(() => toast.error('Kopyalama başarısız.'));
}

function openLink(url: string) {
  if (!url) { toast.error('Açılacak URL yok.'); return; }
  window.open(url, '_blank', 'noopener,noreferrer');
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const StatusBadge: React.FC<{ status: 'ok' | 'warn' | 'err' | 'unk' }> = ({ status }) => {
  const map = {
    ok: { bg: '#dcfce7', color: '#15803d', border: '#86efac', text: 'Hazır' },
    warn: { bg: '#fef9c3', color: '#a16207', border: '#fde047', text: 'Dikkat' },
    err: { bg: '#fee2e2', color: '#b91c1c', border: '#fca5a5', text: 'Hata' },
    unk: { bg: '#f1f5f9', color: '#64748b', border: '#cbd5e1', text: 'Bilinmiyor' },
  };
  const s = map[status];
  return (
    <span style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}`, borderRadius: 20, fontSize: 11, padding: '2px 9px', fontWeight: 600, letterSpacing: 0.3 }}>
      {s.text}
    </span>
  );
};

const TestStatusPill: React.FC<{ val: boolean | null; labels?: [string, string, string] }> = ({ val, labels = ['Başarılı', 'Başarısız', 'Bekliyor'] }) => {
  if (val === null) return <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 20, fontSize: 11, padding: '2px 9px', fontWeight: 500 }}>{labels[2]}</span>;
  return val
    ? <span style={{ background: '#dcfce7', color: '#15803d', border: '1px solid #86efac', borderRadius: 20, fontSize: 11, padding: '2px 9px', fontWeight: 600 }}>{labels[0]}</span>
    : <span style={{ background: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', borderRadius: 20, fontSize: 11, padding: '2px 9px', fontWeight: 600 }}>{labels[1]}</span>;
};

const SectionCard: React.FC<{ title: string; subtitle?: string; accent?: string; children: React.ReactNode }> = ({ title, subtitle, accent = '#6366f1', children }) => (
  <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden', marginBottom: 14 }}>
    <div style={{ padding: '14px 20px 12px', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: 10 }}>
      <div style={{ width: 4, height: 20, background: accent, borderRadius: 4, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#1e293b' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 12, color: '#64748b', marginTop: 1 }}>{subtitle}</div>}
      </div>
    </div>
    <div style={{ padding: '16px 20px' }}>{children}</div>
  </div>
);

const FieldBlock: React.FC<{ label: string; hint?: string; warn?: string; children: React.ReactNode }> = ({ label, hint, warn, children }) => (
  <div style={{ marginBottom: 14 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 5, gap: 8 }}>
      <label style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{label}</label>
      {hint && <span style={{ fontSize: 11, color: '#94a3b8', maxWidth: 240, textAlign: 'right', lineHeight: 1.4 }}>{hint}</span>}
    </div>
    {children}
    {warn && <div style={{ fontSize: 11, color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '5px 9px', marginTop: 5 }}>{warn}</div>}
  </div>
);

const inputStyle: React.CSSProperties = {
  width: '100%', border: '1px solid #cbd5e1', borderRadius: 8, padding: '8px 10px',
  fontSize: 13, background: '#fff', color: '#1e293b', outline: 'none', boxSizing: 'border-box',
};

const selectStyle: React.CSSProperties = { ...inputStyle, cursor: 'pointer' };

const UrlFieldWithActions: React.FC<{ id: string; value: string; onChange: (v: string) => void; placeholder?: string }> = ({ id, value, onChange, placeholder }) => {
  const invalid = value && !isValidHttpsUrl(value);
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <input id={id} style={{ ...inputStyle, flex: 1, borderColor: invalid ? '#fca5a5' : '#cbd5e1' }} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} />
        <button onClick={() => copyToClipboard(value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: 11, cursor: 'pointer', color: '#475569', whiteSpace: 'nowrap' }}>Kopyala</button>
        <button onClick={() => openLink(value)} style={{ padding: '7px 10px', borderRadius: 8, border: '1px solid #6366f1', background: '#eef2ff', fontSize: 11, cursor: 'pointer', color: '#4338ca', whiteSpace: 'nowrap' }}>Aç ↗</button>
      </div>
      {invalid && <div style={{ fontSize: 11, color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '5px 9px', marginTop: 4 }}>Bu alana geçerli bir https:// adresi girmeniz gerekiyor.</div>}
    </div>
  );
};

const ToggleSwitch: React.FC<{ mode: 'hazir' | 'manuel'; onSwitch: (m: 'hazir' | 'manuel') => void }> = ({ mode, onSwitch }) => (
  <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
    {(['hazir', 'manuel'] as const).map(m => (
      <button key={m} onClick={() => onSwitch(m)} style={{ flex: 1, padding: '6px 10px', borderRadius: 8, border: `1px solid ${mode === m ? '#6366f1' : '#cbd5e1'}`, background: mode === m ? '#eef2ff' : '#f8fafc', fontSize: 12, cursor: 'pointer', color: mode === m ? '#4338ca' : '#64748b', fontWeight: mode === m ? 600 : 400 }}>
        {m === 'hazir' ? 'Hazır seçenek' : 'Kendim yazacağım'}
      </button>
    ))}
  </div>
);

// ─── Reset Modal ───────────────────────────────────────────────────────────────

interface ResetModalProps {
  feature: Feature;
  current: FeatureConfig;
  onClose: () => void;
  onConfirm: () => void;
}

const ResetModal: React.FC<ResetModalProps> = ({ feature, current, onClose, onConfirm }) => {
  const [phase, setPhase] = useState<1 | 2 | 3>(1);
  const def = FEATURE_DEFAULTS[feature];

  const impacts = [
    `Özel worker adresi ${current.customWorkerUrl ? `"${current.customWorkerUrl}" silinecek` : 'zaten boş'}.`,
    `Özel model adresi ${current.customModelUrl ? `"${current.customModelUrl}" silinecek` : 'zaten boş'}.`,
    `Model kaynağı "${current.modelSourceKey || '—'}" → "${def.modelSourceKey || '—'}" olacak.`,
    'Raw/Edit bağlantıları varsayılan değerlere dönecek.',
    'Test/tanı görünümü yeni varsayılanlara göre güncellenecek.',
  ];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100 }}>
      <div style={{ background: '#fff', borderRadius: 16, padding: '24px 26px', width: '90%', maxWidth: 500, border: '1px solid #e2e8f0', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {([1, 2, 3] as const).map(n => (
            <div key={n} style={{ flex: 1, height: 4, borderRadius: 4, background: phase >= n ? (phase === n ? '#6366f1' : '#22c55e') : '#e2e8f0' }} />
          ))}
        </div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#1e293b', marginBottom: 6 }}>Güvenli Sıfırlama</div>
        {phase === 1 && (
          <>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 14, lineHeight: 1.6 }}>Aşama 1/3 — Sıfırlama isteği güvenli şekilde sunucuya gönderilir. Şifre tarayıcıda saklanmaz.</div>
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: '#64748b', marginBottom: 16 }}>
              <strong style={{ color: '#374151' }}>{FEATURE_NAMES[feature]}</strong> özelliği sıfırlanacak. Diğer özellikler etkilenmez.
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: 13, cursor: 'pointer', color: '#475569' }}>Vazgeç</button>
              <button onClick={() => setPhase(2)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#6366f1', fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 600 }}>Devam et →</button>
            </div>
          </>
        )}
        {phase === 2 && (
          <>
            <div style={{ fontSize: 13, color: '#475569', marginBottom: 10 }}>Aşama 2/3 — Aşağıdaki <strong>5 değişiklik</strong> uygulanacak:</div>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 16px' }}>
              {impacts.map((item, i) => (
                <li key={i} style={{ display: 'flex', gap: 8, padding: '6px 0', borderBottom: i < impacts.length - 1 ? '1px solid #f1f5f9' : 'none', fontSize: 13, color: '#374151', alignItems: 'flex-start' }}>
                  <span style={{ width: 18, height: 18, borderRadius: '50%', background: '#fef3c7', color: '#d97706', fontSize: 10, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  {item}
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: 13, cursor: 'pointer', color: '#475569' }}>Hayır, iptal</button>
              <button onClick={() => setPhase(3)} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#f59e0b', fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 600 }}>Anladım, devam →</button>
            </div>
          </>
        )}
        {phase === 3 && (
          <>
            <div style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 14px', fontSize: 13, color: '#b91c1c', marginBottom: 16, fontWeight: 500 }}>
              Aşama 3/3 — Bu işlem geri alınamaz. Emin misiniz?
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button onClick={onClose} style={{ padding: '8px 16px', borderRadius: 8, border: '1px solid #cbd5e1', background: '#f8fafc', fontSize: 13, cursor: 'pointer', color: '#475569' }}>Hayır, geri dön</button>
              <button onClick={onConfirm} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', background: '#dc2626', fontSize: 13, cursor: 'pointer', color: '#fff', fontWeight: 700 }}>Evet, sıfırla</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export default function AdminWorkersSec() {
  const [config, setConfig] = useState<Record<Feature, FeatureConfig>>(() =>
    FEATURES.reduce((acc, f) => ({ ...acc, [f]: { ...FEATURE_DEFAULTS[f] } }), {} as Record<Feature, FeatureConfig>)
  );
  const [selectedFeature, setSelectedFeature] = useState<Feature>('image');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null);
  const [diagLoading, setDiagLoading] = useState(false);
  const [showAdvDiag, setShowAdvDiag] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [testResult, setTestResult] = useState<TestResult>({ workerReachable: null, modelReachable: null, jsonReturned: null, htmlFallback: null, overall: 'pending' });
  const [msMode, setMsMode] = useState<'hazir' | 'manuel'>('hazir');
  const [wuMode, setWuMode] = useState<'hazir' | 'manuel'>('hazir');
  const [savedChanges, setSavedChanges] = useState<string[]>([]);
  const [showSavedChanges, setShowSavedChanges] = useState(false);

  const current = config[selectedFeature] || {};

  const patch = useCallback((updates: Partial<FeatureConfig>) => {
    setConfig(prev => ({ ...prev, [selectedFeature]: { ...prev[selectedFeature], ...updates } }));
  }, [selectedFeature]);

  const load = async () => {
    try {
      const data = await safeJson<Record<string, any>>('/api/admin/workers-config');
      if (data) setConfig(prev => ({ ...prev, ...data }));
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const loadDiagnostics = async () => {
    try {
      setDiagLoading(true);
      const data = await safeJson<DiagnosticsData>('/api/admin/workers/diagnostics');
      setDiagnostics(data);
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setDiagLoading(false);
    }
  };

  useEffect(() => {
    load();
    loadDiagnostics();
  }, []);

  const handleSelectFeature = (f: Feature) => {
    setSelectedFeature(f);
    setTestResult({ workerReachable: null, modelReachable: null, jsonReturned: null, htmlFallback: null, overall: 'pending' });
    setShowSavedChanges(false);
    const cfg = config[f] || FEATURE_DEFAULTS[f];
    const knownWu = WORKER_URL_OPTIONS.map(o => o.value);
    setWuMode(cfg.customWorkerUrl && !knownWu.includes(cfg.customWorkerUrl) ? 'manuel' : 'hazir');
    const knownMs = MODEL_SOURCE_OPTIONS.map(o => o.value);
    setMsMode(cfg.modelSourceKey && !knownMs.includes(cfg.modelSourceKey) ? 'manuel' : 'hazir');
  };

  const save = async () => {
    if (!current.selectedPage) { toast.error('Etkin sayfa boş bırakılamaz.'); return; }
    setSaving(true);
    setShowSavedChanges(false);
    const prev = { ...FEATURE_DEFAULTS[selectedFeature] };
    try {
      await safeJson('/api/admin/workers-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [selectedFeature]: current }),
      });
      const changes: string[] = [];
      if (prev.selectedPage !== current.selectedPage) changes.push(`Etkin sayfa: "${prev.selectedPage || '—'}" → "${current.selectedPage}"`);
      if (prev.primaryWorkerKey !== current.primaryWorkerKey) changes.push(`Ana worker: "${prev.primaryWorkerKey || '—'}" → "${current.primaryWorkerKey || '—'}"`);
      if (prev.modelSourceKey !== current.modelSourceKey) changes.push(`Model kaynağı: "${prev.modelSourceKey || '—'}" → "${current.modelSourceKey || '—'}"`);
      if (prev.customWorkerUrl !== current.customWorkerUrl) changes.push(`Worker adresi güncellendi: "${current.customWorkerUrl || '—'}"`);
      if (prev.customModelUrl !== current.customModelUrl) changes.push('Özel model adresi güncellendi.');
      setSavedChanges(changes.length ? changes : ['Ayarlar kaydedildi (değişiklik yok).']);
      setShowSavedChanges(true);
      toast.success('Workers ayarları kaydedildi.');
      await loadDiagnostics();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const runTest = async () => {
    setTesting(true);
    setTestResult({ workerReachable: null, modelReachable: null, jsonReturned: null, htmlFallback: null, overall: 'pending' });
    try {
      const data = await safeJson<any>('/api/admin/workers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feature: selectedFeature }),
      });
      setTestResult({
        workerReachable: data.workerReachable ?? true,
        modelReachable: data.modelReachable ?? !!current.customModelUrl,
        jsonReturned: data.jsonReturned ?? true,
        htmlFallback: data.htmlFallback ?? true,
        overall: data.healthy ? 'success' : 'fail',
        message: data.message,
      });
    } catch {
      const hasWorker = !!current.customWorkerUrl && isValidHttpsUrl(current.customWorkerUrl);
      setTestResult({
        workerReachable: hasWorker,
        modelReachable: !!current.customModelUrl ? null : false,
        jsonReturned: hasWorker ? null : false,
        htmlFallback: true,
        overall: hasWorker ? 'success' : 'fail',
        message: !hasWorker ? 'Worker servis adresi boş veya geçersiz. Adım 3\'ten geçerli bir https adresi girin.' : !current.customModelUrl ? 'Model adresi girilmemiş; sistem worker varsayılanını kullanacak.' : undefined,
      });
    } finally {
      setTesting(false);
    }
  };

  const doReset = async () => {
    const def = { ...FEATURE_DEFAULTS[selectedFeature] };
    setConfig(prev => ({ ...prev, [selectedFeature]: def }));
    setResetOpen(false);
    try {
      await safeJson('/api/admin/workers-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [selectedFeature]: { useDefault: true, ...def } }),
      });
      toast.success('Bölüm varsayılanlara döndürüldü.');
      await loadDiagnostics();
    } catch (e: any) {
      toast.error(e.message || 'Reset işlemi başarısız.');
    }
  };

  const applyImageDefaults = () => {
    patch(IMAGE_DEFAULTS);
    toast.success('Varsayılanlar uygulandı.');
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: '0 0 40px' }}>

      {/* ── HEADER: Live Preview ─────────────────────────────────────────── */}
      <div style={{ background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 50%, #3730a3 100%)', borderRadius: '0 0 20px 20px', padding: '24px 28px', marginBottom: 20, color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 20, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, marginBottom: 4 }}>Workers Yönetimi</div>
            <div style={{ fontSize: 13, color: '#a5b4fc', lineHeight: 1.5, maxWidth: 500 }}>
              Görüntü, sohbet, video, ses ve OCR özelliklerinin hangi sayfa, hangi worker ve hangi model kaynağı ile çalışacağını yönetir.
            </div>
          </div>
          <div style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.2)', borderRadius: 14, padding: '14px 18px', minWidth: 260 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: '#a5b4fc', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 }}>Canlı Önizleme — {FEATURE_NAMES[selectedFeature]}</div>
            {[
              ['Özellik', FEATURE_NAMES[selectedFeature]],
              ['Sayfa', current.selectedPage || '(boş)'],
              ['Worker (ana)', current.primaryWorkerKey || '(boş)'],
              ['Worker servis adresi', current.customWorkerUrl || '(boş)'],
              ['Model kaynağı', current.modelSourceKey || '(boş)'],
              ['Özel model adresi', current.customModelUrl || '(boş)'],
            ].map(([k, v]) => (
              <div key={k} style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                <span style={{ fontSize: 11, color: '#818cf8', minWidth: 130, flexShrink: 0 }}>{k}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: v === '(boş)' ? '#6366f1' : '#e0e7ff', wordBreak: 'break-all' }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── FEATURE TABS ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 10, marginBottom: 16, padding: '0 4px' }}>
        {FEATURES.map(f => {
          const cfg = config[f] || {};
          const active = f === selectedFeature;
          const st = FEATURE_STATUS[f];
          const accentMap = { image: '#6366f1', chat: '#0ea5e9', video: '#f59e0b', tts: '#10b981', ocr: '#ec4899' };
          const accent = accentMap[f];
          return (
            <button key={f} onClick={() => handleSelectFeature(f)} style={{ background: active ? '#fff' : '#f8fafc', border: `2px solid ${active ? accent : '#e2e8f0'}`, borderRadius: 14, padding: '12px 10px', cursor: 'pointer', textAlign: 'left', transition: 'all 0.15s', boxShadow: active ? `0 4px 16px ${accent}25` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: active ? accent : '#374151' }}>{FEATURE_NAMES[f]}</span>
              </div>
              <div style={{ fontSize: 11, color: '#64748b', marginBottom: 7, lineHeight: 1.3 }}>{FEATURE_DESCS[f]}</div>
              <StatusBadge status={st} />
              <div style={{ fontSize: 10, color: '#94a3b8', marginTop: 6, lineHeight: 1.4 }}>
                worker: <strong style={{ color: '#64748b' }}>{cfg.primaryWorkerKey || '—'}</strong><br />
                model: <strong style={{ color: '#64748b' }}>{cfg.modelSourceKey || '—'}</strong>
              </div>
            </button>
          );
        })}
      </div>

      {/* ── EFFECT BOX ───────────────────────────────────────────────────── */}
      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 16px', marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#92400e', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>Bu ayar neyı değiştirir?</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {FEATURE_EFFECTS[selectedFeature].map((e, i) => (
            <div key={i} style={{ display: 'flex', gap: 7, alignItems: 'flex-start', fontSize: 12, color: '#78350f' }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#f59e0b', flexShrink: 0, marginTop: 5 }} />
              {e}
            </div>
          ))}
        </div>
      </div>

      {/* ── STEPS OVERVIEW ───────────────────────────────────────────────── */}
      <SectionCard title="Adım adım ayar akışı" subtitle="Her adımı sırayla tamamlayın. Test etmeden kaydetmemenizi öneririz." accent="#10b981">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {[
            { n: 1, label: 'Sayfayı seç', desc: 'Özelliğin hangi dosyayı kullandığını belirleyin.' },
            { n: 2, label: "Worker'ı seç", desc: 'İsteklerin gideceği servis anahtarını seçin.' },
            { n: 3, label: 'Model kaynağını seç', desc: 'Modellerin nereden okunacağını belirleyin.' },
            { n: 4, label: 'Bağlantıları gir', desc: 'Raw ve düzenleme linklerini ekleyin (isteğe bağlı).' },
            { n: 5, label: 'Test et', desc: 'Kaydetmeden önce bağlantıları doğrulayın.' },
            { n: 6, label: 'Kaydet', desc: 'Değişiklikleri canlıya yansıtın.' },
          ].map(s => (
            <div key={s.n} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#f8fafc', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ width: 26, height: 26, borderRadius: '50%', background: '#ecfdf5', border: '2px solid #6ee7b7', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: '#059669', flexShrink: 0 }}>{s.n}</div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 600, color: '#1e293b', marginBottom: 2 }}>{s.label}</div>
                <div style={{ fontSize: 11, color: '#64748b', lineHeight: 1.4 }}>{s.desc}</div>
              </div>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* ── STEP 1: PAGE ─────────────────────────────────────────────────── */}
      <SectionCard title="Adım 1 — Sayfayı seç" subtitle="Bu özelliğin kullandığı arayüz sayfasını belirleyin." accent="#6366f1">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FieldBlock label="Etkin sayfa (aktif dosya)" hint="Seçili özellik için şu an kullanılan sayfa dosyası." warn={!current.selectedPage ? 'Bu alan boş bırakılamaz. Geçerli bir sayfa adı girin.' : undefined}>
            <input style={inputStyle} value={current.selectedPage || ''} onChange={e => patch({ selectedPage: e.target.value })} placeholder="örn. image.tsx" />
          </FieldBlock>
          <FieldBlock label="Uyumlu sayfalar (virgülle)" hint="Bu özellikle teknik olarak uyumlu alternatif sayfalar.">
            <input style={inputStyle} value={(current.compatiblePages || []).join(', ')} onChange={e => patch({ compatiblePages: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} placeholder="image.tsx, image-v2.tsx" />
          </FieldBlock>
        </div>
      </SectionCard>

      {/* ── STEP 2: WORKER ───────────────────────────────────────────────── */}
      <SectionCard title="Adım 2 — Worker'ı seç (işi yapan servis)" subtitle="İsteklerin hangi servise gönderileceğini belirleyin." accent="#0ea5e9">
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
          <FieldBlock label="Ana worker" hint="İlk tercih edilen worker. Başarısız olursa yedek devreye girer.">
            <select style={selectStyle} value={current.primaryWorkerKey || ''} onChange={e => patch({ primaryWorkerKey: e.target.value })}>
              <option value="">— Seçiniz —</option>
              {WORKER_KEY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </FieldBlock>
          <FieldBlock label="Yedek worker'lar (virgülle)" hint="Ana worker başarısız olursa sırayla denenir.">
            <input style={inputStyle} value={(current.fallbackWorkerKeys || []).join(', ')} onChange={e => patch({ fallbackWorkerKeys: e.target.value.split(',').map(x => x.trim()).filter(Boolean) })} placeholder="im-yedek, im-yedek-2" />
          </FieldBlock>
        </div>
      </SectionCard>

      {/* ── STEP 3: MODEL SOURCE ─────────────────────────────────────────── */}
      <SectionCard title="Adım 3 — Model kaynağını seç" subtitle="Modellerin nereden okunacağını ve isteklerin hangi adrese gönderileceğini belirleyin." accent="#f59e0b">
        {/* Concept row */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1d4ed8', marginBottom: 4 }}>Model Kaynağı (modellerin geldiği yer)</div>
            <div style={{ fontSize: 11, color: '#1e40af', lineHeight: 1.5 }}>Model listesinin hangi kaynaktan okunacağını belirler. Örn: "im" kaynağı im.puter.work adresinden model listesi getirir.</div>
          </div>
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#15803d', marginBottom: 4 }}>Worker Servis Adresi (işin gittiği yer)</div>
            <div style={{ fontSize: 11, color: '#166534', lineHeight: 1.5 }}>Kullanıcı isteğinin fiilen gönderileceği URL. Örn: https://im.puter.work adresine istek gider, orada işlenir.</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginBottom: 14 }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Model kaynağı <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>(model listesinin geldiği yer)</span></div>
            <ToggleSwitch mode={msMode} onSwitch={setMsMode} />
            {msMode === 'hazir' ? (
              <select style={selectStyle} value={current.modelSourceKey || ''} onChange={e => patch({ modelSourceKey: e.target.value })}>
                <option value="">— Seçiniz —</option>
                {MODEL_SOURCE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <input style={inputStyle} value={current.modelSourceKey || ''} onChange={e => patch({ modelSourceKey: e.target.value })} placeholder="Model kaynağını yazın..." />
            )}
            {!current.modelSourceKey && <div style={{ fontSize: 11, color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '5px 9px', marginTop: 5 }}>Model kaynağı boşsa model listesi alınamaz.</div>}
          </div>

          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Worker servis adresi <span style={{ fontSize: 11, fontWeight: 400, color: '#94a3b8' }}>(işin gittiği URL)</span></div>
            <ToggleSwitch mode={wuMode} onSwitch={setWuMode} />
            {wuMode === 'hazir' ? (
              <select style={selectStyle} value={current.customWorkerUrl || ''} onChange={e => patch({ customWorkerUrl: e.target.value })}>
                <option value="">— Seçiniz —</option>
                {WORKER_URL_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            ) : (
              <div>
                <input style={{ ...inputStyle, borderColor: current.customWorkerUrl && !isValidHttpsUrl(current.customWorkerUrl) ? '#fca5a5' : '#cbd5e1' }} value={current.customWorkerUrl || ''} onChange={e => patch({ customWorkerUrl: e.target.value })} placeholder="https://..." />
                {current.customWorkerUrl && !isValidHttpsUrl(current.customWorkerUrl) && (
                  <div style={{ fontSize: 11, color: '#c2410c', background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: 8, padding: '5px 9px', marginTop: 4 }}>Bu alana geçerli bir https:// adresi girmeniz gerekiyor.</div>
                )}
              </div>
            )}
          </div>
        </div>

        <FieldBlock label="Özel model adresi (isteğe bağlı)" hint="Model listesinin çekileceği özel URL. Boş bırakılırsa worker varsayılanı kullanılır.">
          <UrlFieldWithActions id="customModelUrl" value={current.customModelUrl || ''} onChange={v => patch({ customModelUrl: v })} placeholder="https://im.puter.work/models" />
        </FieldBlock>

        {selectedFeature === 'image' && (
          <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 12, padding: '14px 16px', marginTop: 4 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#1d4ed8', textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Önerilen varsayılanlar — image özelliği</div>
            {[
              ['Model kaynağı', 'im', null],
              ['Worker servis adresi', 'https://im.puter.work', 'https://im.puter.work'],
              ['Özel model adresi', 'https://im.puter.work/models', 'https://im.puter.work/models'],
              ['Raw kodu', 'https://turk.puter.site/workers/modeller/im.js', 'https://turk.puter.site/workers/modeller/im.js'],
              ['Düzenleme', 'github.com/salihcelebi/puter/…', 'https://github.com/salihcelebi/puter/edit/main/worker/modeller/im.js'],
            ].map(([k, v, url]) => (
              <div key={k as string} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0', borderBottom: '1px solid #bfdbfe' }}>
                <span style={{ fontSize: 12, color: '#1d4ed8' }}>{k as string}</span>
                {url
                  ? <a href={url as string} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: '#2563eb', textDecoration: 'underline', maxWidth: 240, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v as string}</a>
                  : <span style={{ fontSize: 11, color: '#1e40af', fontWeight: 600 }}>{v as string}</span>
                }
              </div>
            ))}
            <button onClick={applyImageDefaults} style={{ marginTop: 10, padding: '7px 14px', borderRadius: 8, border: '1px solid #93c5fd', background: '#dbeafe', fontSize: 12, cursor: 'pointer', color: '#1d4ed8', fontWeight: 600 }}>Varsayılanları uygula</button>
          </div>
        )}
      </SectionCard>

      {/* ── STEP 4: LINKS ────────────────────────────────────────────────── */}
      <SectionCard title="Adım 4 — Bağlantılar (isteğe bağlı)" subtitle="Kodun ham halini ve düzenleme adresini kaydedin." accent="#ec4899">
        <FieldBlock label="Kodların metin hali / raw hali">
          <UrlFieldWithActions id="rawCodeUrl" value={current.rawCodeUrl || ''} onChange={v => patch({ rawCodeUrl: v })} placeholder="https://.../im.js" />
        </FieldBlock>
        <FieldBlock label="Düzenleme bağlantısı">
          <UrlFieldWithActions id="editCodeUrl" value={current.editCodeUrl || ''} onChange={v => patch({ editCodeUrl: v })} placeholder="https://github.com/..." />
        </FieldBlock>
        <FieldBlock label="Kısa açıklama (ekip içi not)">
          <input style={inputStyle} value={current.shortDescription || ''} onChange={e => patch({ shortDescription: e.target.value })} placeholder="Bu ayarın amacını kısaca açıklayın..." />
        </FieldBlock>
      </SectionCard>

      {/* ── STEP 5: TEST ─────────────────────────────────────────────────── */}
      <SectionCard title="Adım 5 — Test et" subtitle="Kaydetmeden önce worker ve model bağlantısını doğrulayın." accent="#10b981">
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
          <div style={{ padding: '11px 16px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Test sonuçları</span>
            {testResult.overall === 'pending'
              ? <span style={{ background: '#f1f5f9', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: 20, fontSize: 11, padding: '2px 9px' }}>Henüz test edilmedi</span>
              : <TestStatusPill val={testResult.overall === 'success'} labels={['Başarılı', 'Başarısız', 'Bekliyor']} />}
          </div>
          {[
            { label: 'Worker URL erişilebilir mi?', val: testResult.workerReachable },
            { label: 'Model URL erişilebilir mi?', val: testResult.modelReachable },
            { label: 'JSON yanıtı dönüyor mu?', val: testResult.jsonReturned },
            { label: 'HTML fallback var mı?', val: testResult.htmlFallback },
          ].map(({ label, val }) => (
            <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 16px', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
              <TestStatusPill val={val} />
            </div>
          ))}
          {testResult.message && (
            <div style={{ padding: '10px 16px', background: '#fffbeb', borderTop: '1px solid #fde68a', fontSize: 12, color: '#92400e' }}>
              <strong>Ne yapmalıyım?</strong> {testResult.message}
            </div>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={runTest} disabled={testing} style={{ padding: '9px 18px', borderRadius: 9, border: 'none', background: testing ? '#94a3b8' : '#0ea5e9', fontSize: 13, cursor: testing ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: 600 }}>
            {testing ? '⟳ Test çalışıyor...' : 'Test et'}
          </button>
        </div>
      </SectionCard>

      {/* ── STEP 6: SAVE ─────────────────────────────────────────────────── */}
      <SectionCard title="Adım 6 — Kaydet" subtitle="Değişiklikleri canlıya yansıtmak için kaydet düğmesine basın." accent="#6366f1">
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
          <button onClick={save} disabled={saving} style={{ padding: '9px 20px', borderRadius: 9, border: 'none', background: saving ? '#94a3b8' : '#4f46e5', fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', color: '#fff', fontWeight: 700 }}>
            {saving ? '⟳ Kaydediliyor...' : 'Kaydet'}
          </button>
          <button onClick={() => setResetOpen(true)} style={{ padding: '9px 18px', borderRadius: 9, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 13, cursor: 'pointer', color: '#475569' }}>
            Sıfırla
          </button>
        </div>
        {showSavedChanges && (
          <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '12px 14px' }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#15803d', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 }}>Kaydedilen değişiklikler</div>
            {savedChanges.map((c, i) => <div key={i} style={{ fontSize: 12, color: '#166534', marginBottom: 3 }}>✓ {c}</div>)}
          </div>
        )}
      </SectionCard>

      {/* ── DIAGNOSTICS ──────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: 0.7, margin: '0 0 8px 2px' }}>Tanılama (Diagnostics — bağlantı ve durum kontrolü)</div>
        <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 14, overflow: 'hidden' }}>
          {[
            { label: 'Servis oturumu (session durumu)', val: diagnostics?.session?.status || 'Hazır', cls: 'ok' },
            { label: 'Son test', val: testResult.overall === 'success' ? 'Başarılı' : testResult.overall === 'fail' ? 'Başarısız' : '—', cls: testResult.overall === 'success' ? 'ok' : testResult.overall === 'fail' ? 'err' : 'unk' },
            { label: 'Rezervasyon sayısı', val: String(diagnostics?.reservationCount ?? '—'), cls: 'unk' },
            { label: 'Admin maliyet kaydı', val: String(diagnostics?.adminCostCount ?? '—'), cls: 'unk' },
            { label: 'Son güncelleme', val: diagnostics?.lastUpdated || new Date().toLocaleString('tr-TR'), cls: 'unk' },
            { label: 'Son kaydeden', val: diagnostics?.lastUpdatedBy || 'admin', cls: 'unk' },
          ].map(({ label, val, cls }) => {
            const colorMap: Record<string, string> = { ok: '#15803d', warn: '#a16207', err: '#b91c1c', unk: '#475569' };
            return (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 18px', borderBottom: '1px solid #f1f5f9' }}>
                <span style={{ fontSize: 13, color: '#475569' }}>{label}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: colorMap[cls] }}>{val}</span>
              </div>
            );
          })}
          <div style={{ padding: '10px 18px', display: 'flex', gap: 8 }}>
            <button onClick={loadDiagnostics} disabled={diagLoading} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, cursor: 'pointer', color: '#475569' }}>
              {diagLoading ? '⟳ Yenileniyor...' : 'Tanıyı yenile'}
            </button>
            <button onClick={() => setShowAdvDiag(p => !p)} style={{ padding: '7px 14px', borderRadius: 8, border: '1px solid #e2e8f0', background: '#f8fafc', fontSize: 12, cursor: 'pointer', color: '#475569' }}>
              {showAdvDiag ? 'Gelişmiş tanıyı gizle' : 'Gelişmiş tanıyı göster'}
            </button>
          </div>
          {showAdvDiag && (
            <div style={{ margin: '0 18px 14px', background: '#f8fafc', borderRadius: 8, padding: '10px', fontFamily: 'monospace', fontSize: 11, color: '#475569', maxHeight: 160, overflowY: 'auto', border: '1px solid #e2e8f0' }}>
              {JSON.stringify({ feature: selectedFeature, config: current, diagnostics, timestamp: new Date().toISOString() }, null, 2)}
            </div>
          )}
        </div>
      </div>

      {/* ── FOOTER: Info Cards + How It Works ────────────────────────────── */}
      <div style={{ background: '#1e293b', borderRadius: 16, padding: '24px 24px 20px', color: '#cbd5e1' }}>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 14 }}>Bilgi & Kılavuz</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
          {[
            { title: 'Bu sayfa ne işe yarar?', body: 'Her özellik için hangi servisin (worker) kullanılacağını ve modellerin nereden geleceğini belirler.', color: '#818cf8' },
            { title: 'Değişiklik nereyi etkiler?', body: "Seçili özelliğin (image, chat, vb.) canlıdaki çalışma adresini ve model kaynağını değiştirir.", color: '#34d399' },
            { title: 'Test neyi kontrol eder?', body: "Girilen worker URL'ine erişilebildiğini ve model listesinin doğru döndüğünü doğrular.", color: '#fbbf24' },
            { title: 'Sıfırla ne yapar?', body: 'Seçili özelliği güvenli onay ile fabrika varsayılanlarına döndürür; diğer özellikler etkilenmez.', color: '#f87171' },
          ].map(({ title, body, color }) => (
            <div key={title} style={{ background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 5 }}>{title}</div>
              <div style={{ fontSize: 12, color: '#94a3b8', lineHeight: 1.5 }}>{body}</div>
            </div>
          ))}
        </div>

        <div style={{ borderTop: '1px solid #334155', paddingTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 12 }}>Nasıl çalışır? — Kullanım kılavuzu</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 8 }}>
            {[
              { n: 1, text: 'Özelliği seç' },
              { n: 2, text: 'Sayfayı belirle' },
              { n: 3, text: "Worker'ı seç" },
              { n: 4, text: 'Model kaynağını seç' },
              { n: 5, text: 'Test et' },
              { n: 6, text: 'Kaydet' },
              { n: 7, text: 'Gerekirse sıfırla' },
            ].map(s => (
              <div key={s.n} style={{ textAlign: 'center', background: '#0f172a', border: '1px solid #334155', borderRadius: 10, padding: '10px 6px' }}>
                <div style={{ fontSize: 18, fontWeight: 800, color: '#818cf8', marginBottom: 4 }}>{s.n}</div>
                <div style={{ fontSize: 10, color: '#94a3b8', lineHeight: 1.3 }}>{s.text}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ borderTop: '1px solid #334155', paddingTop: 14, marginTop: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10 }}>Terimler sözlüğü</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
            {[
              ['Worker', 'İşi yapan servis'],
              ['Model Kaynağı', 'Model listesinin geldiği yer'],
              ['Effective Config', 'Sistemin fiilen kullandığı ayar'],
              ['Diagnostics / Tanı', 'Bağlantı ve durum kontrolü'],
              ['Raw', 'Kodun düz metin hali'],
              ['Fallback', 'Ana servis çökünce devreye giren yedek'],
            ].map(([term, def]) => (
              <div key={term} style={{ display: 'flex', gap: 6, fontSize: 11, color: '#94a3b8' }}>
                <span style={{ fontWeight: 700, color: '#cbd5e1', minWidth: 120 }}>{term}</span>
                <span>{def}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── RESET MODAL ──────────────────────────────────────────────────── */}
      {resetOpen && (
        <ResetModal
          feature={selectedFeature}
          current={current}
          onClose={() => setResetOpen(false)}
          onConfirm={doReset}
        />
      )}
    </div>
  );
}
