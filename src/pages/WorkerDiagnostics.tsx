import { useState } from 'react';
import {
  puterHazirMi,
  workersExecHazirMi,
  tumWorkerTestleriniCalistir,
} from '../lib/workerDiagnostics';
import { Activity, Play, CheckCircle, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

type TestStatus = 'idle' | 'running' | 'done' | 'error';

export default function WorkerDiagnostics() {
  const [status, setStatus] = useState<TestStatus>('idle');
  const [rapor, setRapor] = useState<Record<string, unknown> | null>(null);
  const [hata, setHata] = useState<string | null>(null);

  const puterYuklu = puterHazirMi();
  const execHazir = workersExecHazirMi();

  async function testleriCalistir() {
    setStatus('running');
    setRapor(null);
    setHata(null);

    try {
      const sonuc = await tumWorkerTestleriniCalistir();
      setRapor(sonuc as Record<string, unknown>);
      setStatus('done');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Bilinmeyen hata oluştu.';
      setHata(message);
      setStatus('error');
    }
  }

  const genelDurum = rapor?.genelDurum as string | undefined;

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="flex items-center gap-3 mb-6">
        <Activity className="w-7 h-7 text-blue-500" />
        <h1 className="text-2xl font-bold text-white">Worker Diagnostics</h1>
      </div>

      {/* Puter SDK Durum Kartları */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <div className={`rounded-lg p-4 border ${puterYuklu ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            {puterYuklu ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
            <span className="font-semibold text-white">Puter SDK</span>
          </div>
          <p className={`text-sm ${puterYuklu ? 'text-green-300' : 'text-red-300'}`}>
            {puterYuklu ? 'window.puter yüklü' : 'window.puter bulunamadı!'}
          </p>
        </div>

        <div className={`rounded-lg p-4 border ${execHazir ? 'border-green-600 bg-green-900/20' : 'border-red-600 bg-red-900/20'}`}>
          <div className="flex items-center gap-2 mb-1">
            {execHazir ? <CheckCircle className="w-5 h-5 text-green-400" /> : <XCircle className="w-5 h-5 text-red-400" />}
            <span className="font-semibold text-white">Workers Exec</span>
          </div>
          <p className={`text-sm ${execHazir ? 'text-green-300' : 'text-red-300'}`}>
            {execHazir ? 'puter.workers.exec hazır' : 'puter.workers.exec erişilemez!'}
          </p>
        </div>
      </div>

      {/* Puter yüklü değilse uyarı */}
      {!puterYuklu && (
        <div className="rounded-lg border border-red-500 bg-red-900/30 p-4 mb-6">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-6 h-6 text-red-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold text-red-300 mb-1">Puter Script Yüklenmemiş!</p>
              <p className="text-sm text-red-200">
                <code className="bg-red-800/50 px-1.5 py-0.5 rounded text-xs">&lt;script src="https://js.puter.com/v2/"&gt;</code> etiketinin{' '}
                <code className="bg-red-800/50 px-1.5 py-0.5 rounded text-xs">index.html</code> dosyasında yüklü olduğundan emin olun.
                Bu script olmadan worker testleri çalışmaz.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Test Başlat Butonu */}
      <button
        onClick={testleriCalistir}
        disabled={status === 'running'}
        className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium transition-colors bg-blue-600 hover:bg-blue-700 text-white disabled:opacity-50 disabled:cursor-not-allowed mb-6"
      >
        {status === 'running' ? (
          <>
            <Loader2 className="w-5 h-5 animate-spin" />
            Testler çalışıyor…
          </>
        ) : (
          <>
            <Play className="w-5 h-5" />
            Tüm Worker Testlerini Çalıştır
          </>
        )}
      </button>

      {/* Hata mesajı */}
      {hata && (
        <div className="rounded-lg border border-red-500 bg-red-900/30 p-4 mb-6">
          <div className="flex items-start gap-2">
            <XCircle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
            <p className="text-red-300 text-sm">{hata}</p>
          </div>
        </div>
      )}

      {/* Sonuç */}
      {rapor && (
        <div className="space-y-4">
          {/* Genel Durum Özeti */}
          <div className={`rounded-lg p-4 border ${
            genelDurum === 'passed'
              ? 'border-green-600 bg-green-900/20'
              : genelDurum === 'failed'
                ? 'border-red-600 bg-red-900/20'
                : 'border-yellow-600 bg-yellow-900/20'
          }`}>
            <div className="flex items-center gap-2">
              {genelDurum === 'passed' ? (
                <CheckCircle className="w-5 h-5 text-green-400" />
              ) : genelDurum === 'failed' ? (
                <XCircle className="w-5 h-5 text-red-400" />
              ) : (
                <AlertTriangle className="w-5 h-5 text-yellow-400" />
              )}
              <span className="font-semibold text-white">
                Genel Durum: <span className="uppercase">{genelDurum}</span>
              </span>
            </div>
            {rapor.hata && (
              <p className="text-sm text-red-300 mt-2">{String(rapor.hata)}</p>
            )}
            <p className="text-xs text-gray-400 mt-1">Zaman: {String(rapor.zaman)}</p>
          </div>

          {/* JSON Detay */}
          <div className="rounded-lg border border-gray-700 bg-gray-900/60 p-4">
            <h2 className="text-sm font-semibold text-gray-300 mb-2">Test Raporu (JSON)</h2>
            <pre className="text-xs text-gray-300 overflow-auto max-h-96 whitespace-pre-wrap break-words">
              {JSON.stringify(rapor, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}
