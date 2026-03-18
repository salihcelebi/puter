import React, { useEffect, useMemo, useState } from 'react';
import { Layout, Shield, Cpu, Activity, TestTube, Save, RefreshCw, ExternalLink, Plus, Trash2, Check, AlertTriangle, Info, Search } from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// --- TİP TANIMLAMALARI ---
const PAGE_IDS = ['image.tsx', 'chat.tsx', 'video.tsx', 'tts.tsx', 'ocr.tsx'] as const;
type PageId = typeof PAGE_IDS[number];

const CLASS_IDS = ['api', 'model', 'orchestrator', 'job', 'test'] as const;
type WorkerClassId = typeof CLASS_IDS[number];

type WorkerItem = {
  id: string;
  ad: string;
  url: string;
  aciklama: string;
  gorevler: [string, string, string, string, string];
  sinif: WorkerClassId;
  destekledigiSayfalar: PageId[];
  varsayilanSayfalar?: PageId[];
  durum?: 'Hazır' | 'Sorunlu' | 'Bilinmiyor';
  sonTestSonucu?: 'Başarılı' | 'Başarısız' | 'Henüz test edilmedi';
};

type WorkerMap = Record<WorkerClassId, WorkerItem[]>;

type PageConfig = {
  sayfaId: PageId;
  baslik: string;
  aciklama: string;
  secilenWorkerlar: Record<WorkerClassId, string[]>;
  customModelUrl: string;
  rawCodeUrl: string;
  editCodeUrl: string;
  forceKaydetAcik: boolean;
  updatedAt?: string;
};

// --- SINIF METADATA (REVİZE EDİLEN KISIM) ---
const SINIF_META: Record<WorkerClassId, { baslik: string; alt: string; renk: string; digerButonRenk: string; }> = {
  api: {
    baslik: 'SINIF 1 = AMG ÇEKİRDEĞİ',
    alt: 'Her hizmet türü ve tüm sayfalarda varsayılan; model çağrıları ve amg içindeki tüm çekirdek özellikler için ana worker',
    renk: 'border-blue-200 bg-blue-50',
    digerButonRenk: 'bg-blue-600 hover:bg-blue-700',
  },
  model: {
    baslik: 'SINIF 2 = TÜM API ÇAĞRILARI + ORKESTRA + İŞ DURUMU + TEST + TEŞHİS',
    alt: 'Her hizmet türü ve tüm sayfalarda varsayılan; all-apicall-orkestra-isdurumu-teshis.js mantığını taşıyan ana worker',
    renk: 'border-emerald-200 bg-emerald-50',
    digerButonRenk: 'bg-emerald-600 hover:bg-emerald-700',
  },
  orchestrator: {
    baslik: 'SINIF 3 = DİĞER 1',
    alt: 'İleride yeni worker ihtiyacı doğarsa kullanılacak ek sınıf alanı',
    renk: 'border-violet-200 bg-violet-50',
    digerButonRenk: 'bg-violet-600 hover:bg-violet-700',
  },
  job: {
    baslik: 'SINIF 4 = DİĞER 2',
    alt: 'İleride yeni worker ihtiyacı doğarsa kullanılacak ek sınıf alanı',
    renk: 'border-amber-200 bg-amber-50',
    digerButonRenk: 'bg-amber-600 hover:bg-amber-700',
  },
  test: {
    baslik: 'SINIF 5 = DİĞER 3',
    alt: 'İleride yeni worker ihtiyacı doğarsa kullanılacak ek sınıf alanı',
    renk: 'border-rose-200 bg-rose-50',
    digerButonRenk: 'bg-rose-600 hover:bg-rose-700',
  },
};

// --- VARSAYILAN WORKER VERİLERİ ---
const DEFAULT_WORKERS: WorkerMap = {
  api: [
    {
      id: 'amg-cekirdek-worker',
      ad: 'amg.js',
      url: 'https://amg.puter.work',
      aciklama: 'Model çağrıları ve AMG içindeki tüm çekirdek özellikler için ana worker.',
      gorevler: ['ÇEKİRDEK YÖNETİM', 'MODEL ÇAĞRISI', 'HIZLI YANIT', 'VERİ İŞLEME', 'SİSTEM ENTEGRASYON'],
      sinif: 'api',
      destekledigiSayfalar: [...PAGE_IDS],
      varsayilanSayfalar: [...PAGE_IDS],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    }
  ],
  model: [
    {
      id: 'all-apicall-orkestra-teshis-worker',
      ad: 'all-apicall-orkestra-isdurumu-teshis.js',
      url: 'https://all-apicall-orkestra-isdurumu-teshis.puter.work',
      aciklama: 'Tüm API çağrıları, orkestrasyon, iş durumu takibi ve teşhis mantığını kapsayan ana worker.',
      gorevler: ['API ÇAĞRILARI', 'ORKESTRASYON', 'İŞ DURUMU TAKİBİ', 'SİSTEM TEST', 'TEŞHİS MANTIĞI'],
      sinif: 'model',
      destekledigiSayfalar: [...PAGE_IDS],
      varsayilanSayfalar: [...PAGE_IDS],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    }
  ],
  orchestrator: [], // Rezerv alan
  job: [],          // Rezerv alan
  test: [],         // Rezerv alan
};

// --- ANA BİLEŞEN ---
export default function App() {
  const [configs, setConfigs] = useState<Record<PageId, PageConfig>>(() => {
    const initial: any = {};
    PAGE_IDS.forEach(id => {
      initial[id] = {
        sayfaId: id,
        baslik: id,
        aciklama: `${id} sayfası için worker yapılandırması.`,
        secilenWorkerlar: {
          api: ['amg-cekirdek-worker'],
          model: ['all-apicall-orkestra-teshis-worker'],
          orchestrator: [],
          job: [],
          test: []
        },
        customModelUrl: '',
        rawCodeUrl: '',
        editCodeUrl: '',
        forceKaydetAcik: false
      };
    });
    return initial;
  });

  const [activeTab, setActiveTab] = useState<PageId>('chat.tsx');

  const handleSave = (pageId: PageId) => {
    toast.success(`${pageId} başarıyla kaydedildi!`);
    setConfigs(prev => ({
      ...prev,
      [pageId]: { ...prev[pageId], updatedAt: new Date().toISOString() }
    }));
  };

  return (
    <div className="min-h-screen bg-slate-50 p-4 md:p-8 font-sans text-slate-900">
      <Toaster position="top-right" />
      
      <header className="max-w-6xl mx-auto mb-8">
        <h1 className="text-3xl font-bold text-slate-800 flex items-center gap-3">
          <Cpu className="text-blue-600" size={32} />
          Worker Orkestrasyon Paneli
        </h1>
        <p className="text-slate-500 mt-2">TSX Tabanlı Sınıf Mimarisi Revizyonu</p>
      </header>

      <main className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Sol Menü: Sayfalar */}
        <div className="lg:col-span-1 space-y-2">
          {PAGE_IDS.map((id) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={`w-full text-left px-4 py-3 rounded-lg font-medium transition-all ${
                activeTab === id 
                ? 'bg-blue-600 text-white shadow-md' 
                : 'bg-white text-slate-600 hover:bg-slate-100'
              }`}
            >
              {id}
            </button>
          ))}
        </div>

        {/* Sağ İçerik: Worker Sınıfları */}
        <div className="lg:col-span-3 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Layout size={20} className="text-blue-500" />
                {activeTab} Yapılandırması
              </h2>
              <button 
                onClick={() => handleSave(activeTab)}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg transition-colors shadow-sm"
              >
                <Save size={18} />
                Ayarları Kaydet
              </button>
            </div>

            <div className="space-y-6">
              {CLASS_IDS.map((classId) => {
                const meta = SINIF_META[classId];
                const selectedWorkers = configs[activeTab].secilenWorkerlar[classId];
                const availableWorkers = DEFAULT_WORKERS[classId];

                return (
                  <div key={classId} className={`p-5 rounded-xl border-2 transition-all ${meta.renk}`}>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                      <div>
                        <h3 className="font-bold text-lg text-slate-800">{meta.baslik}</h3>
                        <p className="text-sm text-slate-600 leading-tight">{meta.alt}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {availableWorkers.length > 0 ? (
                        availableWorkers.map((worker) => (
                          <div key={worker.id} className="bg-white p-4 rounded-lg border border-slate-200 shadow-sm flex flex-col gap-2">
                            <div className="flex justify-between items-start">
                              <div>
                                <span className="font-mono text-xs font-bold text-blue-600 uppercase tracking-wider bg-blue-50 px-2 py-0.5 rounded">
                                  {worker.ad}
                                </span>
                                <p className="text-sm font-semibold mt-1">{worker.url}</p>
                              </div>
                              <span className="bg-emerald-100 text-emerald-700 text-xs px-2 py-1 rounded-full font-bold">
                                VARSAYILAN AKTİF
                              </span>
                            </div>
                            <p className="text-xs text-slate-500 italic">{worker.aciklama}</p>
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {worker.gorevler.map((g, idx) => (
                                <span key={idx} className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                                  {g}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="bg-slate-100/50 border border-dashed border-slate-300 p-4 rounded-lg text-center">
                          <p className="text-sm text-slate-400 font-medium italic">Rezerv Alan: Henüz bu sınıf için aktif bir worker tanımlanmadı.</p>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-blue-900 text-white p-6 rounded-xl shadow-lg flex items-center justify-between">
            <div>
              <h4 className="font-bold text-lg">Mimari Durum Raporu</h4>
              <p className="text-blue-200 text-sm">SINIF 1 ve SINIF 2 tüm sayfalarda başarıyla orkestra edildi.</p>
            </div>
            <Activity className="text-blue-400 animate-pulse" size={40} />
          </div>
        </div>
      </main>
    </div>
  );
}
