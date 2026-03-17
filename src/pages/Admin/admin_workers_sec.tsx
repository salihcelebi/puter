import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';

const FEATURES = ['image', 'chat', 'video', 'tts', 'ocr'] as const;

type Feature = typeof FEATURES[number];

export default function AdminWorkersSec() {
  const [config, setConfig] = useState<Record<string, any>>({});
  const [selectedFeature, setSelectedFeature] = useState<Feature>('image');
  const [saving, setSaving] = useState(false);
  const [diagnostics, setDiagnostics] = useState<any>(null);

  const load = async () => {
    const res = await fetch('/api/admin/workers-config');
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Config alınamadı');
    setConfig(data || {});
  };

  const loadDiagnostics = async () => {
    const res = await fetch('/api/admin/workers/diagnostics');
    const data = await res.json();
    if (res.ok) setDiagnostics(data);
  };

  useEffect(() => {
    load().catch((e) => toast.error(e.message));
    loadDiagnostics().catch(() => undefined);
  }, []);

  const current = config[selectedFeature] || {};

  const patchCurrent = (patch: Record<string, any>) => {
    setConfig((prev) => ({ ...prev, [selectedFeature]: { ...(prev[selectedFeature] || {}), ...patch } }));
  };

  const save = async () => {
    try {
      setSaving(true);
      const res = await fetch('/api/admin/workers-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ [selectedFeature]: current }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Kaydetme başarısız');
      toast.success('Workers config kaydedildi');
      await load();
      await loadDiagnostics();
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    patchCurrent({ useDefault: true, customWorkerUrl: '', customModelUrl: '' });
  };

  const test = async () => {
    const res = await fetch('/api/admin/workers/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ feature: selectedFeature }),
    });
    const data = await res.json();
    if (!res.ok) return toast.error(data.error || 'Test başarısız');
    toast.success(data.healthy ? 'Worker testi başarılı' : 'Worker testi başarısız');
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-zinc-900">Workers</h1>
        <p className="text-sm text-zinc-500">Feature → Page → Worker → Model source orkestrasyonu</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {FEATURES.map((f) => (
          <button key={f} onClick={() => setSelectedFeature(f)} className={`px-3 py-2 rounded-lg border ${selectedFeature === f ? 'bg-black text-white border-black' : 'bg-white border-zinc-200 text-zinc-700'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">Current Effective Page
            <input className="w-full mt-1 border rounded-lg p-2" value={current.selectedPage || ''} onChange={(e) => patchCurrent({ selectedPage: e.target.value })} />
          </label>
          <label className="text-sm">Compatible Page List (virgül)
            <input className="w-full mt-1 border rounded-lg p-2" value={(current.compatiblePages || []).join(',')} onChange={(e) => patchCurrent({ compatiblePages: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          </label>
          <label className="text-sm">Primary Worker
            <input className="w-full mt-1 border rounded-lg p-2" value={current.primaryWorkerKey || ''} onChange={(e) => patchCurrent({ primaryWorkerKey: e.target.value })} />
          </label>
          <label className="text-sm">Fallback Workers (virgül)
            <input className="w-full mt-1 border rounded-lg p-2" value={(current.fallbackWorkerKeys || []).join(',')} onChange={(e) => patchCurrent({ fallbackWorkerKeys: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
          </label>
          <label className="text-sm">Model Source
            <input className="w-full mt-1 border rounded-lg p-2" value={current.modelSourceKey || ''} onChange={(e) => patchCurrent({ modelSourceKey: e.target.value })} />
          </label>
          <label className="text-sm">Custom Worker URL
            <input className="w-full mt-1 border rounded-lg p-2" value={current.customWorkerUrl || ''} onChange={(e) => patchCurrent({ customWorkerUrl: e.target.value })} />
          </label>
          <label className="text-sm">Custom Model URL
            <input className="w-full mt-1 border rounded-lg p-2" value={current.customModelUrl || ''} onChange={(e) => patchCurrent({ customModelUrl: e.target.value })} />
          </label>
          <label className="text-sm">Short Description
            <input className="w-full mt-1 border rounded-lg p-2" value={current.shortDescription || ''} onChange={(e) => patchCurrent({ shortDescription: e.target.value })} />
          </label>
        </div>

        <div className="flex items-center gap-2">
          <input id="useDefault" type="checkbox" checked={Boolean(current.useDefault)} onChange={(e) => patchCurrent({ useDefault: e.target.checked })} />
          <label htmlFor="useDefault" className="text-sm">Default/Custom Toggle (useDefault)</label>
        </div>

        <div className="flex gap-2 flex-wrap">
          <button onClick={save} disabled={saving} className="px-3 py-2 rounded-lg bg-black text-white">{saving ? 'Kaydediliyor...' : 'Save'}</button>
          <button onClick={reset} className="px-3 py-2 rounded-lg bg-zinc-200">Reset</button>
          <button onClick={test} className="px-3 py-2 rounded-lg bg-indigo-600 text-white">Test</button>
          <button onClick={loadDiagnostics} className="px-3 py-2 rounded-lg bg-zinc-200">Diagnostics</button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-xl p-4 text-sm">
        <div><strong>Session:</strong> {diagnostics?.session?.status || '-'}</div>
        <div><strong>Reservation Count:</strong> {diagnostics?.reservationCount ?? '-'}</div>
        <div><strong>Admin Cost Count:</strong> {diagnostics?.adminCostCount ?? '-'}</div>
      </div>
    </div>
  );
}
