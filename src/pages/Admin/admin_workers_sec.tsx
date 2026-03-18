import React, { useEffect, useMemo, useState } from 'react';
import {
  Cpu,
  Save,
  Edit3,
  Globe,
  Database,
  Settings2,
  Plus,
  Trash2,
  RefreshCw,
  Info,
  X,
  ChevronRight,
  FileCode,
} from 'lucide-react';
import toast, { Toaster } from 'react-hot-toast';

// Bu ekran doğrudan kv.json dosyasına browser'dan yazmaz.
// Bunun yerine /api/admin/workers-config endpointine gider.
// Backend bu veriyi kv.json > items > admin_workers_sec_v2 alanına yazmalıdır.

// --- TİPLER ---
const PAGE_IDS = ['chat.tsx', 'chat1.tsx', 'image.tsx', 'video.tsx', 'tts.tsx', 'ocr.tsx'] as const;
type PageId = typeof PAGE_IDS[number];

const SINIF_KIMLIKLERI = ['api', 'model', 'orkestra', 'is', 'test'] as const;
type SinifId = typeof SINIF_KIMLIKLERI[number];

type DurumTipi = 'Hazır' | 'Sorunlu' | 'Bilinmiyor';
type TestSonucuTipi = 'Başarılı' | 'Başarısız' | 'Henüz test edilmedi';

interface CalisanBirim {
  kimlik: string;
  baslik: string;
  adres: string;
  tanim: string;
  gorevler: [string, string, string, string, string];
  sinif: SinifId;
  aktifSayfalar: PageId[];
  varsayilanSayfalar?: PageId[];
  durum?: DurumTipi;
  sonTestSonucu?: TestSonucuTipi;
}

interface SinifDetay {
  etiket: string;
  altBaslik: string;
  renkSema: string;
  butonRenk: string;
}

type SinifBirimMap = Record<SinifId, CalisanBirim[]>;

type SayfaYapilandirmasi = {
  sayfaId: PageId;
  baslik: string;
  aciklama: string;
  secilenBirimler: Record<SinifId, string[]>;
  customModelUrl: string;
  rawCodeUrl: string;
  editCodeUrl: string;
  forceKaydetAcik: boolean;
  updatedAt?: string;
  updatedBy?: string;
};

type SayfaConfigMap = Record<PageId, SayfaYapilandirmasi>;

type KvKayitSekli = {
  version: string;
  updatedAt: string;
  siniflar: Record<SinifId, SinifDetay>;
  workers: SinifBirimMap;
  configs: SayfaConfigMap;
};

// --- AMG / AMH GÖREV DETAYLARI ---
const DETAYLI_GOREVLER = {
  amg: {
    baslik: 'AMG.JS GÖREVLERİ (10 GÖREV)',
    url: 'https://amg.puter.work/',
    maddeler: [
      'Tüm hizmet türleri için ana çekirdek worker olarak çalışır.',
      'Model çağrı mantığını ortak katmanda toplar.',
      'CHAT, IMG, VIDEO, TTS, OCR, PDF, DEEPSEARCH gibi hizmetlerin temel çalışma omurgasını sağlar.',
      'Hizmet türüne göre uygun model veya model ailesi seçimi için temel zemin oluşturur.',
      'Ortak ayar, varsayılan davranış ve çekirdek servis kurallarını uygular.',
      'Sayfalardan gelen istekleri standart biçime sokup alt katmanlara hazırlar.',
      'AMG içindeki ortak özellikleri tüm sayfalarda tekrar yazmadan kullanılabilir hale getirir.',
      'Model tarafındaki temel yetenekleri tek merkezden yönetir.',
      'Sistemin geri kalan workerları için çekirdek bağımlılık ve ortak servis noktası görevi görür.',
      'Tüm sayfalarda varsayılan kullanılacak birinci ana sınıf worker olarak davranır.',
    ],
    ozet: 'AMG = çekirdek model ve servis yeteneği katmanı',
  },
  amh: {
    baslik: 'AMH.JS GÖREVLERİ (10 GÖREV)',
    url: 'https://amh.puter.work/',
    maddeler: [
      'Tüm API çağrılarını yöneten birleşik worker olarak çalışır.',
      'Orkestrasyon kararlarını verip isteğin hangi akıştan gideceğini belirler.',
      'İş durumu takibini başlatır, günceller ve sonuçlandırır.',
      'İş geçmişini ve süreç kayıtlarını tutar.',
      'Test ve teşhis akışlarını merkezi biçimde yürütür.',
      'Etkin ayar, yönlendirme düzeni, fallback ve çok adımlı akışları koordine eder.',
      'Hizmet bazlı API çağrıları için ortak işçi katmanı sağlar.',
      'Uzun süren işler için durum izleme, kuyruk mantığı ve sonuç takibini yönetir.',
      'Sistem sağlığı, hata türleri, maliyet, süre ve erişim kontrolleri için merkezi denetim noktası olur.',
      'Tüm sayfalarda varsayılan kullanılacak ikinci ana sınıf worker olarak davranır.',
    ],
    ozet: 'AMH = API çağrısı + orkestrasyon + iş durumu + test/teşhis katmanı',
  },
};

// --- SAYFA META ---
const SAYFA_META: Record<PageId, { kisa: string; aciklama: string }> = {
  'chat.tsx': {
    kisa: 'Sohbet',
    aciklama: 'chat.tsx için varsayılan sınıf 1 = AMG ve sınıf 2 = AMH.',
  },
  'chat1.tsx': {
    kisa: 'Sohbet 2',
    aciklama: 'chat1.tsx için varsayılan sınıf 1 = AMG ve sınıf 2 = AMH.',
  },
  'image.tsx': {
    kisa: 'Görsel',
    aciklama: 'image.tsx için varsayılan sınıf 1 = AMG ve sınıf 2 = AMH.',
  },
  'video.tsx': {
    kisa: 'Video',
    aciklama: 'video.tsx için varsayılan sınıf 1 = AMG ve sınıf 2 = AMH.',
  },
  'tts.tsx': {
    kisa: 'Seslendirme',
    aciklama: 'tts.tsx için varsayılan sınıf 1 = AMG ve sınıf 2 = AMH.',
  },
  'ocr.tsx': {
    kisa: 'OCR',
    aciklama: 'ocr.tsx için varsayılan sınıf 1 = AMG ve sınıf 2 = AMH.',
  },
};

// --- VARSAYILAN SINIFLAR ---
const VARSAYILAN_SINIFLAR: Record<SinifId, SinifDetay> = {
  api: {
    etiket: 'SINIF 1 = AMG ÇEKİRDEĞİ',
    altBaslik: 'Her hizmet türü ve tüm sayfalarda varsayılan; model çağrıları ve çekirdek servis omurgası.',
    renkSema: 'border-blue-200 bg-blue-50',
    butonRenk: 'bg-blue-600 hover:bg-blue-700',
  },
  model: {
    etiket: 'SINIF 2 = AMH ORKESTRASYON',
    altBaslik: 'Her hizmet türü ve tüm sayfalarda varsayılan; API yönetimi, iş takibi ve teşhis katmanı.',
    renkSema: 'border-emerald-200 bg-emerald-50',
    butonRenk: 'bg-emerald-600 hover:bg-emerald-700',
  },
  orkestra: {
    etiket: 'SINIF 3 = DİĞER 1',
    altBaslik: 'İleride yeni worker gerekirse kullanılacak rezerv alan.',
    renkSema: 'border-violet-200 bg-violet-50',
    butonRenk: 'bg-violet-600 hover:bg-violet-700',
  },
  is: {
    etiket: 'SINIF 4 = DİĞER 2',
    altBaslik: 'İleride yeni worker gerekirse kullanılacak rezerv alan.',
    renkSema: 'border-amber-200 bg-amber-50',
    butonRenk: 'bg-amber-600 hover:bg-amber-700',
  },
  test: {
    etiket: 'SINIF 5 = DİĞER 3',
    altBaslik: 'İleride yeni worker gerekirse kullanılacak rezerv alan.',
    renkSema: 'border-rose-200 bg-rose-50',
    butonRenk: 'bg-rose-600 hover:bg-rose-700',
  },
};

// --- VARSAYILAN WORKERLAR ---
const VARSAYILAN_BIRIMLER: SinifBirimMap = {
  api: [
    {
      kimlik: 'amg-js',
      baslik: 'amg.js',
      adres: 'https://amg.puter.work/',
      tanim: 'Model çağrıları ve AMG içindeki tüm çekirdek özellikler için ana giriş noktası.',
      gorevler: ['MODEL ÇAĞRI', 'ÇEKİRDEK KURAL', 'SERVİS OMURGA', 'ORTAK AYAR', 'TEMEL KATMAN'],
      sinif: 'api',
      aktifSayfalar: [...PAGE_IDS],
      varsayilanSayfalar: [...PAGE_IDS],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  model: [
    {
      kimlik: 'amh-js',
      baslik: 'amh.js',
      adres: 'https://amh.puter.work/',
      tanim: 'Tüm API çağrıları, orkestrasyon, iş durumu takibi ve teşhis mantığını kapsayan ana worker.',
      gorevler: ['API ÇAĞRI', 'ORKESTRA', 'İŞ DURUMU', 'TEST', 'TEŞHİS'],
      sinif: 'model',
      aktifSayfalar: [...PAGE_IDS],
      varsayilanSayfalar: [...PAGE_IDS],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  orkestra: [
    {
      kimlik: 'diger-1',
      baslik: 'diger1.js',
      adres: 'https://diger1.puter.work/',
      tanim: 'Rezerv alan worker. İleride ek ihtiyaçlar için kullanılabilir.',
      gorevler: ['REZERV ALAN', 'EK WORKER', 'GENİŞLEME', 'İLERİDE', 'OPSİYONEL'],
      sinif: 'orkestra',
      aktifSayfalar: [],
      varsayilanSayfalar: [],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  is: [
    {
      kimlik: 'diger-2',
      baslik: 'diger2.js',
      adres: 'https://diger2.puter.work/',
      tanim: 'Rezerv alan worker. İleride ek ihtiyaçlar için kullanılabilir.',
      gorevler: ['REZERV ALAN', 'EK WORKER', 'GENİŞLEME', 'İLERİDE', 'OPSİYONEL'],
      sinif: 'is',
      aktifSayfalar: [],
      varsayilanSayfalar: [],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  test: [
    {
      kimlik: 'diger-3',
      baslik: 'diger3.js',
      adres: 'https://diger3.puter.work/',
      tanim: 'Rezerv alan worker. İleride ek ihtiyaçlar için kullanılabilir.',
      gorevler: ['REZERV ALAN', 'EK WORKER', 'GENİŞLEME', 'İLERİDE', 'OPSİYONEL'],
      sinif: 'test',
      aktifSayfalar: [],
      varsayilanSayfalar: [],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
};

// --- VARSAYILAN SAYFA CONFIGLERİ ---
function varsayilanSayfaConfigleriniOlustur(): SayfaConfigMap {
  return PAGE_IDS.reduce((acc, sayfaId) => {
    acc[sayfaId] = {
      sayfaId,
      baslik: sayfaId,
      aciklama: SAYFA_META[sayfaId].aciklama,
      secilenBirimler: {
        api: ['amg-js'],
        model: ['amh-js'],
        orkestra: [],
        is: [],
        test: [],
      },
      customModelUrl: 'https://amg.puter.work/',
      rawCodeUrl: '',
      editCodeUrl: '',
      forceKaydetAcik: false,
    };
    return acc;
  }, {} as SayfaConfigMap);
}

const VARSAYILAN_CONFIGLER = varsayilanSayfaConfigleriniOlustur();

// --- YARDIMCILAR ---
function derinKopya<T>(veri: T): T {
  return JSON.parse(JSON.stringify(veri));
}

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü]+/gi, '-')
    .replace(/(^-|-$)/g, '');
}

function gecerliHttpsMi(value?: string) {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:';
  } catch {
    return false;
  }
}

function tarihFormatla(value?: string) {
  if (!value) return '-';
  const tarih = new Date(value);
  if (Number.isNaN(tarih.getTime())) return value;
  return tarih.toLocaleString('tr-TR');
}

function guvenliGorevler(gorevler?: string[]): [string, string, string, string, string] {
  const temiz = (gorevler || []).map((x) => String(x || '').trim().toUpperCase()).slice(0, 5);
  while (temiz.length < 5) temiz.push('');
  return [temiz[0], temiz[1], temiz[2], temiz[3], temiz[4]];
}

function birimKimligiUret(mevcut: SinifBirimMap, sinif: SinifId, baslik: string) {
  const baz = slugify(baslik || 'yeni-worker');
  const tumKimlikler = new Set(Object.values(mevcut).flat().map((x) => x.kimlik));
  if (!tumKimlikler.has(baz)) return baz;
  let i = 2;
  while (tumKimlikler.has(`${baz}-${i}`)) i += 1;
  return `${baz}-${i}`;
}

function ilgiliSinifBirimleriGetir(birimler: SinifBirimMap, sinif: SinifId, sayfaId: PageId) {
  return birimler[sinif].filter((birim) => birim.aktifSayfalar.includes(sayfaId));
}

function eksikZorunluSiniflar(config: SayfaYapilandirmasi) {
  const eksikler: SinifId[] = [];
  if (!config.secilenBirimler.api.length) eksikler.push('api');
  if (!config.secilenBirimler.model.length) eksikler.push('model');
  return eksikler;
}

function kvKayitlariniBirleştir(gelen?: Partial<KvKayitSekli>): KvKayitSekli {
  const varsayilanlar: KvKayitSekli = {
    version: 'admin-workers-sec-v2',
    updatedAt: new Date().toISOString(),
    siniflar: derinKopya(VARSAYILAN_SINIFLAR),
    workers: derinKopya(VARSAYILAN_BIRIMLER),
    configs: derinKopya(VARSAYILAN_CONFIGLER),
  };

  if (!gelen) return varsayilanlar;

  const birlesikWorkers: SinifBirimMap = {
    api: gelen.workers?.api?.length ? gelen.workers.api.map((x) => ({ ...x, gorevler: guvenliGorevler(x.gorevler) })) : varsayilanlar.workers.api,
    model: gelen.workers?.model?.length ? gelen.workers.model.map((x) => ({ ...x, gorevler: guvenliGorevler(x.gorevler) })) : varsayilanlar.workers.model,
    orkestra: gelen.workers?.orkestra ? gelen.workers.orkestra.map((x) => ({ ...x, gorevler: guvenliGorevler(x.gorevler) })) : varsayilanlar.workers.orkestra,
    is: gelen.workers?.is ? gelen.workers.is.map((x) => ({ ...x, gorevler: guvenliGorevler(x.gorevler) })) : varsayilanlar.workers.is,
    test: gelen.workers?.test ? gelen.workers.test.map((x) => ({ ...x, gorevler: guvenliGorevler(x.gorevler) })) : varsayilanlar.workers.test,
  };

  const birlesikConfigs = derinKopya(varsayilanlar.configs);
  PAGE_IDS.forEach((sayfaId) => {
    if (gelen.configs?.[sayfaId]) {
      birlesikConfigs[sayfaId] = {
        ...birlesikConfigs[sayfaId],
        ...gelen.configs[sayfaId],
        secilenBirimler: {
          api: gelen.configs[sayfaId].secilenBirimler?.api || birlesikConfigs[sayfaId].secilenBirimler.api,
          model: gelen.configs[sayfaId].secilenBirimler?.model || birlesikConfigs[sayfaId].secilenBirimler.model,
          orkestra: gelen.configs[sayfaId].secilenBirimler?.orkestra || [],
          is: gelen.configs[sayfaId].secilenBirimler?.is || [],
          test: gelen.configs[sayfaId].secilenBirimler?.test || [],
        },
      };
    }
  });

  return {
    version: gelen.version || varsayilanlar.version,
    updatedAt: gelen.updatedAt || varsayilanlar.updatedAt,
    siniflar: { ...varsayilanlar.siniflar, ...(gelen.siniflar || {}) },
    workers: birlesikWorkers,
    configs: birlesikConfigs,
  };
}

async function jsonIstek<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  let data: any = {};
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error('Sunucu geçerli JSON döndürmedi.');
    }
  }

  if (!response.ok) {
    throw new Error(data?.error || data?.message || 'İstek başarısız oldu.');
  }

  if (text && !contentType.includes('application/json')) {
    throw new Error('Sunucu JSON içerik tipi döndürmedi.');
  }

  return data as T;
}

// --- KÜÇÜK BİLEŞENLER ---
function Rozet({
  children,
  tip = 'normal',
}: {
  children: React.ReactNode;
  tip?: 'normal' | 'hazir' | 'uyari' | 'kritik';
}) {
  const klas =
    tip === 'hazir'
      ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
      : tip === 'uyari'
      ? 'bg-amber-100 text-amber-700 border-amber-200'
      : tip === 'kritik'
      ? 'bg-red-100 text-red-700 border-red-200'
      : 'bg-slate-100 text-slate-700 border-slate-200';

  return <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold ${klas}`}>{children}</span>;
}

function Modal({
  acik,
  title,
  children,
  onKapat,
}: {
  acik: boolean;
  title: string;
  children: React.ReactNode;
  onKapat: () => void;
}) {
  if (!acik) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-3xl bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5">
          <h3 className="text-lg font-black tracking-tight text-slate-900">{title}</h3>
          <button onClick={onKapat} className="rounded-xl p-2 text-slate-400 transition hover:bg-slate-100 hover:text-red-500">
            <X size={22} />
          </button>
        </div>
        <div className="max-h-[80vh] overflow-y-auto p-6">{children}</div>
      </div>
    </div>
  );
}

export default function AdminWorkersSec() {
  const [siniflar, setSiniflar] = useState<Record<SinifId, SinifDetay>>(derinKopya(VARSAYILAN_SINIFLAR));
  const [birimler, setBirimler] = useState<SinifBirimMap>(derinKopya(VARSAYILAN_BIRIMLER));
  const [configler, setConfigler] = useState<SayfaConfigMap>(derinKopya(VARSAYILAN_CONFIGLER));

  const [aktifSayfa, setAktifSayfa] = useState<PageId>('chat.tsx');
  const [yukleniyor, setYukleniyor] = useState(false);
  const [kaydediliyor, setKaydediliyor] = useState(false);

  const [detayModu, setDetayModu] = useState<'amg' | 'amh' | null>(null);
  const [formAcik, setFormAcik] = useState(false);
  const [duzenlenenKimlik, setDuzenlenenKimlik] = useState<string | null>(null);

  const [formVeri, setFormVeri] = useState<CalisanBirim>({
    kimlik: '',
    baslik: '',
    adres: 'https://',
    tanim: '',
    gorevler: ['', '', '', '', ''],
    sinif: 'orkestra',
    aktifSayfalar: [],
    varsayilanSayfalar: [],
    durum: 'Bilinmiyor',
    sonTestSonucu: 'Henüz test edilmedi',
  });

  const aktifConfig = configler[aktifSayfa];

  const aktifSayfaOzeti = useMemo(() => {
    const eksikler = eksikZorunluSiniflar(aktifConfig);
    return {
      secimSayisi: SINIF_KIMLIKLERI.reduce((toplam, sinif) => toplam + (aktifConfig.secilenBirimler[sinif]?.length || 0), 0),
      eksikZorunlu: eksikler,
    };
  }, [aktifConfig]);

  useEffect(() => {
    verileriGetir();
  }, []);

  async function verileriGetir() {
    try {
      setYukleniyor(true);
      const yanit = await jsonIstek<any>('/api/admin/workers-config');
      const kayit = kvKayitlariniBirleştir(yanit?.data || yanit);
      setSiniflar(kayit.siniflar);
      setBirimler(kayit.workers);
      setConfigler(kayit.configs);
      toast.success('Worker yapılandırması yüklendi.');
    } catch {
      const kayit = kvKayitlariniBirleştir();
      setSiniflar(kayit.siniflar);
      setBirimler(kayit.workers);
      setConfigler(kayit.configs);
      toast('Sunucu verisi alınamadı. Varsayılan yapı yüklendi.', { icon: 'ℹ️' });
    } finally {
      setYukleniyor(false);
    }
  }

  async function veritabaninaKaydet() {
    const eksikler = eksikZorunluSiniflar(aktifConfig);
    if (eksikler.length > 0 && !aktifConfig.forceKaydetAcik) {
      toast.error('Sınıf 1 veya Sınıf 2 eksik. İstersen force kaydet aç.');
      return;
    }

    try {
      setKaydediliyor(true);
      const payload: KvKayitSekli = {
        version: 'admin-workers-sec-v2',
        updatedAt: new Date().toISOString(),
        siniflar,
        workers: birimler,
        configs: {
          ...configler,
          [aktifSayfa]: {
            ...aktifConfig,
            updatedAt: new Date().toISOString(),
            updatedBy: 'salih celebi',
          },
        },
      };

      await jsonIstek('/api/admin/workers-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: payload.version,
          storageKey: 'admin_workers_sec_v2',
          data: payload,
        }),
      });

      setConfigler((prev) => ({
        ...prev,
        [aktifSayfa]: {
          ...prev[aktifSayfa],
          updatedAt: new Date().toISOString(),
          updatedBy: 'salih celebi',
        },
      }));

      toast.success('Değişiklikler kv.json yapısına uygun şekilde kaydedildi.');
    } catch (error: any) {
      toast.error(error?.message || 'Kaydetme sırasında hata oluştu.');
    } finally {
      setKaydediliyor(false);
    }
  }

  function birimSeciminiDegistir(sinif: SinifId, workerKimlik: string) {
    const secili = aktifConfig.secilenBirimler[sinif] || [];
    const varMi = secili.includes(workerKimlik);

    setConfigler((prev) => ({
      ...prev,
      [aktifSayfa]: {
        ...prev[aktifSayfa],
        secilenBirimler: {
          ...prev[aktifSayfa].secilenBirimler,
          [sinif]: varMi ? secili.filter((x) => x !== workerKimlik) : [...secili, workerKimlik],
        },
      },
    }));
  }

  function yeniBirimFormunuAc(sinifId: SinifId) {
    setDuzenlenenKimlik(null);
    setFormVeri({
      kimlik: '',
      baslik: '',
      adres: 'https://',
      tanim: '',
      gorevler: ['', '', '', '', ''],
      sinif: sinifId,
      aktifSayfalar: [aktifSayfa],
      varsayilanSayfalar: [],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    });
    setFormAcik(true);
  }

  function duzenlemeFormunuAc(birim: CalisanBirim) {
    setDuzenlenenKimlik(birim.kimlik);
    setFormVeri(derinKopya(birim));
    setFormAcik(true);
  }

  function formKaydet() {
    if (!formVeri.baslik.trim()) {
      toast.error('Worker adı gerekli.');
      return;
    }
    if (!gecerliHttpsMi(formVeri.adres)) {
      toast.error('Geçerli bir https adresi gir.');
      return;
    }
    if (!formVeri.tanim.trim()) {
      toast.error('Açıklama gerekli.');
      return;
    }
    if (formVeri.aktifSayfalar.length === 0) {
      toast.error('En az bir aktif sayfa seç.');
      return;
    }
    if (formVeri.gorevler.some((x) => !x.trim())) {
      toast.error('5 görev alanının tamamını doldur.');
      return;
    }

    const guvenliKayit: CalisanBirim = {
      ...formVeri,
      kimlik: duzenlenenKimlik || birimKimligiUret(birimler, formVeri.sinif, formVeri.baslik),
      gorevler: guvenliGorevler(formVeri.gorevler),
    };

    if (duzenlenenKimlik) {
      setBirimler((prev) => ({
        ...prev,
        [guvenliKayit.sinif]: prev[guvenliKayit.sinif].map((x) => (x.kimlik === guvenliKayit.kimlik ? guvenliKayit : x)),
      }));
      toast.success('Worker güncellendi.');
    } else {
      setBirimler((prev) => ({
        ...prev,
        [guvenliKayit.sinif]: [...prev[guvenliKayit.sinif], guvenliKayit],
      }));
      toast.success('Yeni worker eklendi.');
    }

    setFormAcik(false);
  }

  function birimSil(birim: CalisanBirim) {
    const onay = window.confirm(`${birim.baslik} workerını kaldırmak istediğine emin misin?`);
    if (!onay) return;

    setBirimler((prev) => ({
      ...prev,
      [birim.sinif]: prev[birim.sinif].filter((x) => x.kimlik !== birim.kimlik),
    }));

    setConfigler((prev) => {
      const kopya = derinKopya(prev);
      PAGE_IDS.forEach((sayfaId) => {
        SINIF_KIMLIKLERI.forEach((sinif) => {
          kopya[sayfaId].secilenBirimler[sinif] = kopya[sayfaId].secilenBirimler[sinif].filter((x) => x !== birim.kimlik);
        });
      });
      return kopya;
    });

    toast.success('Worker kaldırıldı.');
  }

  function varsayilanaDon() {
    const onay = window.confirm(`${aktifSayfa} için varsayılan seçime dönmek istiyor musun?`);
    if (!onay) return;

    setConfigler((prev) => ({
      ...prev,
      [aktifSayfa]: derinKopya(VARSAYILAN_CONFIGLER[aktifSayfa]),
    }));

    toast.success(`${aktifSayfa} varsayılan yapıya döndü.`);
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] p-4 text-slate-900 md:p-8">
      <Toaster position="top-right" />

      <Modal acik={detayModu !== null} title={detayModu === 'amg' ? DETAYLI_GOREVLER.amg.baslik : DETAYLI_GOREVLER.amh.baslik} onKapat={() => setDetayModu(null)}>
        {detayModu && (
          <div className="space-y-6">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">URL</div>
              <div className="mt-1 break-all text-sm font-bold text-blue-600">{DETAYLI_GOREVLER[detayModu].url}</div>
            </div>

            <div className="space-y-3">
              {DETAYLI_GOREVLER[detayModu].maddeler.map((madde, i) => (
                <div key={i} className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-6 w-6 items-center justify-center rounded-full border border-blue-100 bg-blue-50 text-[10px] font-black text-blue-600">
                    {i + 1}
                  </span>
                  <p className="text-sm font-semibold leading-relaxed text-slate-700">{madde}</p>
                </div>
              ))}
            </div>

            <div className="rounded-2xl bg-blue-600 p-4 text-white">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-80">Kısa Ayrım</div>
              <p className="mt-1 text-sm font-bold">{DETAYLI_GOREVLER[detayModu].ozet}</p>
            </div>
          </div>
        )}
      </Modal>

      <Modal acik={formAcik} title={duzenlenenKimlik ? 'Worker Düzenle' : 'Yeni Worker Ekle'} onKapat={() => setFormAcik(false)}>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-bold text-slate-900">Worker adı</label>
            <input
              value={formVeri.baslik}
              onChange={(e) => setFormVeri((prev) => ({ ...prev, baslik: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="örnek-worker.js"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900">Worker adresi</label>
            <input
              value={formVeri.adres}
              onChange={(e) => setFormVeri((prev) => ({ ...prev, adres: e.target.value }))}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="https://..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-slate-900">Açıklama</label>
            <textarea
              value={formVeri.tanim}
              onChange={(e) => setFormVeri((prev) => ({ ...prev, tanim: e.target.value }))}
              className="mt-2 h-24 w-full rounded-xl border border-slate-200 p-3 text-sm"
              placeholder="Bu worker ne yapar?"
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900">Sınıf</label>
            <select
              value={formVeri.sinif}
              onChange={(e) => setFormVeri((prev) => ({ ...prev, sinif: e.target.value as SinifId }))}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              {SINIF_KIMLIKLERI.map((sinif) => (
                <option key={sinif} value={sinif}>
                  {siniflar[sinif].etiket}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-bold text-slate-900">Durum</label>
            <select
              value={formVeri.durum || 'Bilinmiyor'}
              onChange={(e) => setFormVeri((prev) => ({ ...prev, durum: e.target.value as DurumTipi }))}
              className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
            >
              <option value="Hazır">Hazır</option>
              <option value="Sorunlu">Sorunlu</option>
              <option value="Bilinmiyor">Bilinmiyor</option>
            </select>
          </div>

          <div className="md:col-span-2">
            <div className="mb-2 text-sm font-bold text-slate-900">5 kısa görev</div>
            <div className="grid gap-3 md:grid-cols-5">
              {formVeri.gorevler.map((gorev, index) => (
                <input
                  key={index}
                  value={gorev}
                  onChange={(e) => {
                    const yeni = [...formVeri.gorevler] as [string, string, string, string, string];
                    yeni[index] = e.target.value.toUpperCase();
                    setFormVeri((prev) => ({ ...prev, gorevler: yeni }));
                  }}
                  className="rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder={`Görev ${index + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="mb-2 text-sm font-bold text-slate-900">Aktif sayfalar</div>
            <div className="grid gap-2 md:grid-cols-3">
              {PAGE_IDS.map((sayfaId) => {
                const secili = formVeri.aktifSayfalar.includes(sayfaId);
                return (
                  <label key={sayfaId} className="flex items-center gap-2 rounded-xl border border-slate-200 p-3 text-sm">
                    <input
                      type="checkbox"
                      checked={secili}
                      onChange={() => {
                        setFormVeri((prev) => ({
                          ...prev,
                          aktifSayfalar: secili ? prev.aktifSayfalar.filter((x) => x !== sayfaId) : [...prev.aktifSayfalar, sayfaId],
                        }));
                      }}
                    />
                    <span>{sayfaId}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2 flex justify-end gap-2 pt-2">
            <button onClick={() => setFormAcik(false)} className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-bold">
              Vazgeç
            </button>
            <button onClick={formKaydet} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-bold text-white">
              {duzenlenenKimlik ? 'Değişikliği Kaydet' : 'Worker Ekle'}
            </button>
          </div>
        </div>
      </Modal>

      <header className="mx-auto mb-8 flex max-w-7xl flex-col items-start justify-between gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center">
        <div className="flex items-center gap-4">
          <div className="rounded-2xl bg-blue-600 p-3 shadow-lg">
            <Cpu className="text-white" size={24} />
          </div>
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight">ADMIN WORKERS YÖNETİMİ</h1>
            <p className="mt-1 flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-slate-400">
              <Database size={14} className="text-blue-500" />
              PERSIST KAYNAĞI: kv.json &gt; items &gt; admin_workers_sec_v2
            </p>
          </div>
        </div>

        <div className="flex w-full gap-2 md:w-auto">
          <button onClick={verileriGetir} disabled={yukleniyor} className="rounded-xl bg-slate-100 p-3 transition hover:bg-slate-200">
            {yukleniyor ? <Settings2 className="animate-spin" size={20} /> : <RefreshCw size={20} />}
          </button>
          <button onClick={varsayilanaDon} className="rounded-xl bg-slate-100 px-4 py-3 text-sm font-black uppercase tracking-wide">
            Varsayılana Dön
          </button>
          <button onClick={veritabaninaKaydet} disabled={kaydediliyor} className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-black uppercase tracking-wide text-white shadow-lg shadow-blue-200 hover:bg-blue-700">
            {kaydediliyor ? <Settings2 className="animate-spin" size={18} /> : <Save size={18} />}
            Kaydet
          </button>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[280px_minmax(0,1fr)]">
        <aside className="space-y-3 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="border-b border-slate-100 pb-3">
            <div className="text-sm font-black uppercase tracking-wide text-slate-900">Sayfalar</div>
            <div className="mt-1 text-xs font-semibold text-slate-500">Her sayfada varsayılan olarak Sınıf 1 = AMG ve Sınıf 2 = AMH gelir.</div>
          </div>

          {PAGE_IDS.map((sayfaId) => {
            const aktif = aktifSayfa === sayfaId;
            const secimSayisi = SINIF_KIMLIKLERI.reduce((toplam, sinif) => toplam + (configler[sayfaId].secilenBirimler[sinif]?.length || 0), 0);

            return (
              <button
                key={sayfaId}
                onClick={() => setAktifSayfa(sayfaId)}
                className={`w-full rounded-2xl border p-4 text-left transition ${
                  aktif ? 'border-black bg-slate-950 text-white' : 'border-slate-200 bg-white hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={`text-sm font-black ${aktif ? 'text-white' : 'text-slate-900'}`}>{sayfaId}</div>
                    <div className={`mt-1 text-xs font-semibold ${aktif ? 'text-slate-300' : 'text-slate-500'}`}>{SAYFA_META[sayfaId].kisa}</div>
                  </div>
                  <Rozet tip={aktif ? 'hazir' : 'normal'}>{secimSayisi} seçim</Rozet>
                </div>
              </button>
            );
          })}
        </aside>

        <section className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex flex-col gap-4 border-b border-slate-100 pb-4 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="text-xl font-black tracking-tight text-slate-900">{aktifSayfa}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-500">{aktifConfig.aciklama}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Rozet tip="normal">{aktifSayfaOzeti.secimSayisi} toplam seçim</Rozet>
                {aktifSayfaOzeti.eksikZorunlu.length > 0 ? (
                  <Rozet tip="uyari">Zorunlu sınıf eksik</Rozet>
                ) : (
                  <Rozet tip="hazir">Zorunlu sınıflar tamam</Rozet>
                )}
              </div>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">Custom Model URL</div>
                <input
                  value={aktifConfig.customModelUrl}
                  onChange={(e) =>
                    setConfigler((prev) => ({
                      ...prev,
                      [aktifSayfa]: { ...prev[aktifSayfa], customModelUrl: e.target.value },
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">Raw Code URL</div>
                <input
                  value={aktifConfig.rawCodeUrl}
                  onChange={(e) =>
                    setConfigler((prev) => ({
                      ...prev,
                      [aktifSayfa]: { ...prev[aktifSayfa], rawCodeUrl: e.target.value },
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">Edit Code URL</div>
                <input
                  value={aktifConfig.editCodeUrl}
                  onChange={(e) =>
                    setConfigler((prev) => ({
                      ...prev,
                      [aktifSayfa]: { ...prev[aktifSayfa], editCodeUrl: e.target.value },
                    }))
                  }
                  className="mt-2 w-full rounded-xl border border-slate-200 p-3 text-sm"
                  placeholder="https://..."
                />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs font-bold text-slate-500">Son kayıt</div>
                <div className="mt-2 text-sm font-bold text-slate-900">{tarihFormatla(aktifConfig.updatedAt)}</div>
                <div className="mt-1 text-xs text-slate-500">{aktifConfig.updatedBy || '-'}</div>
                <label className="mt-3 flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={aktifConfig.forceKaydetAcik}
                    onChange={(e) =>
                      setConfigler((prev) => ({
                        ...prev,
                        [aktifSayfa]: { ...prev[aktifSayfa], forceKaydetAcik: e.target.checked },
                      }))
                    }
                  />
                  Force kaydetmeye izin ver
                </label>
              </div>
            </div>
          </div>

          {SINIF_KIMLIKLERI.map((sinifId) => {
            const sinifDetay = siniflar[sinifId];
            const ilgiliBirimler = ilgiliSinifBirimleriGetir(birimler, sinifId, aktifSayfa);
            const seciliKimlikler = aktifConfig.secilenBirimler[sinifId] || [];

            return (
              <div key={sinifId} className={`overflow-hidden rounded-[2rem] border-2 bg-white/70 shadow-sm ${sinifDetay.renkSema}`}>
                <div className="flex flex-col justify-between gap-4 border-b border-black/5 p-6 md:flex-row md:items-center">
                  <div>
                    <h3 className="text-lg font-black tracking-tight text-slate-900">{sinifDetay.etiket}</h3>
                    <p className="text-sm font-semibold text-slate-500">{sinifDetay.altBaslik}</p>
                  </div>

                  <button
                    onClick={() => yeniBirimFormunuAc(sinifId)}
                    className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-black uppercase tracking-wide text-white transition ${sinifDetay.butonRenk}`}
                  >
                    <Plus size={18} />
                    Yeni Worker
                  </button>
                </div>

                <div className="grid gap-5 p-6">
                  {ilgiliBirimler.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-sm font-semibold text-slate-400">
                      Bu sınıfta {aktifSayfa} için tanımlı worker yok.
                    </div>
                  ) : (
                    ilgiliBirimler.map((birim) => {
                      const secili = seciliKimlikler.includes(birim.kimlik);
                      const amgMi = birim.baslik.toLowerCase() === 'amg.js';
                      const amhMi = birim.baslik.toLowerCase() === 'amh.js';

                      return (
                        <div key={birim.kimlik} className={`rounded-2xl border bg-white p-6 shadow-sm transition ${secili ? 'border-black' : 'border-slate-100'}`}>
                          <div className="mb-5 border-b border-slate-50 pb-4">
                            <div className="mb-3 flex items-center justify-between gap-3">
                              <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                                <FileCode size={14} className="text-blue-500" />
                                KULLANILDIĞI SAYFALAR
                              </span>
                              <Rozet tip={birim.durum === 'Hazır' ? 'hazir' : birim.durum === 'Sorunlu' ? 'kritik' : 'normal'}>{birim.durum || 'Bilinmiyor'}</Rozet>
                            </div>

                            <div className="flex flex-wrap gap-2">
                              {birim.aktifSayfalar.length > 0 ? (
                                birim.aktifSayfalar.map((sayfa) => (
                                  <span key={sayfa} className="rounded-xl border border-blue-100 bg-blue-50 px-3 py-1.5 text-[11px] font-black text-blue-700">
                                    {sayfa}
                                  </span>
                                ))
                              ) : (
                                <span className="text-[11px] font-bold italic text-slate-300">Sayfa tanımı yok.</span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col justify-between gap-6 md:flex-row">
                            <div className="min-w-0 flex-1">
                              <div className="mb-2 flex items-center gap-3">
                                <div className="rounded-lg bg-blue-50 p-2">
                                  <Globe size={18} className="text-blue-600" />
                                </div>
                                <div className="min-w-0">
                                  <h4 className="truncate text-base font-black uppercase tracking-tight text-slate-900">{birim.baslik}</h4>
                                  <p className="break-all text-xs font-bold text-blue-500">{birim.adres}</p>
                                </div>
                              </div>

                              <p className="mb-4 text-sm leading-relaxed text-slate-500">{birim.tanim}</p>

                              <div className="mb-4 flex flex-wrap gap-2">
                                {birim.gorevler.filter(Boolean).map((gorev) => (
                                  <span key={gorev} className="rounded-lg border border-slate-200 bg-slate-100 px-2.5 py-1 text-[10px] font-black uppercase text-slate-600">
                                    {gorev}
                                  </span>
                                ))}
                              </div>

                              <div className="flex flex-wrap items-center gap-2">
                                <label className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-700">
                                  <input type="checkbox" checked={secili} onChange={() => birimSeciminiDegistir(sinifId, birim.kimlik)} />
                                  Bu sayfada kullan
                                </label>

                                {(amgMi || amhMi) && (
                                  <button
                                    onClick={() => setDetayModu(amgMi ? 'amg' : 'amh')}
                                    className="inline-flex items-center gap-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-blue-600 transition hover:bg-blue-100"
                                  >
                                    <Info size={14} />
                                    Özellikler
                                    <ChevronRight size={14} />
                                  </button>
                                )}
                              </div>
                            </div>

                            <div className="flex gap-2 border-l border-slate-50 pl-4 md:flex-col">
                              <button onClick={() => duzenlemeFormunuAc(birim)} className="rounded-xl p-2 text-slate-400 transition hover:bg-blue-50 hover:text-blue-600">
                                <Edit3 size={18} />
                              </button>
                              <button onClick={() => birimSil(birim)} className="rounded-xl p-2 text-slate-400 transition hover:bg-red-50 hover:text-red-600">
                                <Trash2 size={18} />
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}

          <div className="rounded-3xl bg-blue-900 p-6 text-white shadow-lg">
            <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
              <div>
                <h4 className="text-lg font-black">Mimari Durum Özeti</h4>
                <p className="mt-1 text-sm font-semibold text-blue-200">
                  {aktifSayfaOzeti.eksikZorunlu.length > 0
                    ? `Bu sayfada eksik zorunlu sınıf var: ${aktifSayfaOzeti.eksikZorunlu.map((x) => siniflar[x].etiket).join(', ')}`
                    : 'Sınıf 1 = AMG ve Sınıf 2 = AMH bu sayfa için çalışacak şekilde tanımlı.'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Rozet tip={aktifSayfaOzeti.eksikZorunlu.length > 0 ? 'uyari' : 'hazir'}>
                  {aktifSayfaOzeti.eksikZorunlu.length > 0 ? 'Eksik yapı var' : 'Temel yapı tamam'}
                </Rozet>
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
