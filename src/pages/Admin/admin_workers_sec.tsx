// ==============================
// 1) PAGE_IDS / PageId tanımlarının hemen altına bunları ekle
// ==============================

const AMG_WORKER_URL = 'https://amg.puter.work'; // AMG worker URL farklıysa sadece bu satırı değiştir.
const ALL_APICALL_ORKESTRA_URL = 'https://all-apicall-orkestra-isdurumu-teshis.puter.work';
const DIGER1_WORKER_URL = 'https://diger1.puter.work';
const DIGER2_WORKER_URL = 'https://diger2.puter.work';
const DIGER3_WORKER_URL = 'https://diger3.puter.work';
const TUM_SAYFALAR = [...PAGE_IDS] as PageId[];
const ZORUNLU_SINIFLAR: WorkerClassId[] = ['api', 'model'];


// ==============================
// 2) SAYFA_META bloğunu bununla değiştir
// ==============================

const SAYFA_META: Record<PageId, { ozellik: string; kisa: string; aciklama: string }> = {
  'image.tsx': {
    ozellik: 'Görsel Üretim',
    kisa: 'AMG + all-apicall varsayılan',
    aciklama: 'image.tsx sayfası varsayılan olarak AMG çekirdeği ve all-apicall orkestrasyon workerı ile çalışır.',
  },
  'chat.tsx': {
    ozellik: 'Sohbet',
    kisa: 'AMG + all-apicall varsayılan',
    aciklama: 'chat.tsx sayfası varsayılan olarak AMG çekirdeği ve all-apicall orkestrasyon workerı ile çalışır.',
  },
  'video.tsx': {
    ozellik: 'Video',
    kisa: 'AMG + all-apicall varsayılan',
    aciklama: 'video.tsx sayfası varsayılan olarak AMG çekirdeği ve all-apicall orkestrasyon workerı ile çalışır.',
  },
  'tts.tsx': {
    ozellik: 'Seslendirme',
    kisa: 'AMG + all-apicall varsayılan',
    aciklama: 'tts.tsx sayfası varsayılan olarak AMG çekirdeği ve all-apicall orkestrasyon workerı ile çalışır.',
  },
  'ocr.tsx': {
    ozellik: 'OCR',
    kisa: 'AMG + all-apicall varsayılan',
    aciklama: 'ocr.tsx sayfası varsayılan olarak AMG çekirdeği ve all-apicall orkestrasyon workerı ile çalışır.',
  },
};


// ==============================
// 3) SINIF_META bloğunu bununla değiştir
// ==============================

const SINIF_META: Record<
  WorkerClassId,
  {
    baslik: string;
    alt: string;
    renk: string;
    digerButonRenk: string;
  }
> = {
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


// ==============================
// 4) DEFAULT_WORKERS bloğunu bununla değiştir
// ==============================

const DEFAULT_WORKERS: WorkerMap = {
  api: [
    {
      id: 'amg-cekirdegi',
      ad: 'amg.js',
      url: AMG_WORKER_URL,
      aciklama: 'AMG çekirdeği. Her hizmet türü ve tüm sayfalarda varsayılan çalışır. Model çağrıları ve amg içindeki tüm çekirdek özellikleri taşır.',
      gorevler: ['AMG ÇEKİRDEĞİ', 'MODEL ÇAĞIRIR', 'SERVİS AÇAR', 'ÖZELLİK TAŞIR', 'TEMEL KATMAN'],
      sinif: 'api',
      destekledigiSayfalar: TUM_SAYFALAR,
      varsayilanSayfalar: TUM_SAYFALAR,
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  model: [
    {
      id: 'all-apicall-orkestra-isdurumu-teshis',
      ad: 'all-apicall-orkestra-isdurumu-teshis.js',
      url: ALL_APICALL_ORKESTRA_URL,
      aciklama:
        'Tüm API çağrıları, orkestrasyon, iş durumu takibi, test ve teşhis akışlarını taşıyan ana worker. 50 maddelik sınıf 2 mantığı burada toplanır ve her sayfada varsayılan çalışır.',
      gorevler: ['TÜM API', 'ORKESTRA', 'İŞ DURUMU', 'TEST', 'TEŞHİS'],
      sinif: 'model',
      destekledigiSayfalar: TUM_SAYFALAR,
      varsayilanSayfalar: TUM_SAYFALAR,
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  orchestrator: [
    {
      id: 'diger-1-merkezi',
      ad: 'diger1-merkezi',
      url: DIGER1_WORKER_URL,
      aciklama: 'İleride yeni worker açılırsa kullanılacak ek sınıf alanı. Şu an varsayılan değildir.',
      gorevler: ['GELECEK ALANI', 'EK SINIF', 'BOŞ ALAN', 'GENİŞLER', 'YER TUTUCU'],
      sinif: 'orchestrator',
      destekledigiSayfalar: TUM_SAYFALAR,
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  job: [
    {
      id: 'diger-2-merkezi',
      ad: 'diger2-merkezi',
      url: DIGER2_WORKER_URL,
      aciklama: 'İleride yeni worker açılırsa kullanılacak ek sınıf alanı. Şu an varsayılan değildir.',
      gorevler: ['GELECEK ALANI', 'EK SINIF', 'BOŞ ALAN', 'GENİŞLER', 'YER TUTUCU'],
      sinif: 'job',
      destekledigiSayfalar: TUM_SAYFALAR,
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  test: [
    {
      id: 'diger-3-merkezi',
      ad: 'diger3-merkezi',
      url: DIGER3_WORKER_URL,
      aciklama: 'İleride yeni worker açılırsa kullanılacak ek sınıf alanı. Şu an varsayılan değildir.',
      gorevler: ['GELECEK ALANI', 'EK SINIF', 'BOŞ ALAN', 'GENİŞLER', 'YER TUTUCU'],
      sinif: 'test',
      destekledigiSayfalar: TUM_SAYFALAR,
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
};


// ==============================
// 5) DEFAULT_CONFIGS bloğunu bununla değiştir
// ==============================

const DEFAULT_CONFIGS: ConfigMap = {
  'image.tsx': {
    sayfaId: 'image.tsx',
    baslik: 'image.tsx',
    aciklama: SAYFA_META['image.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['amg-cekirdegi'],
      model: ['all-apicall-orkestra-isdurumu-teshis'],
      orchestrator: [],
      job: [],
      test: [],
    },
    customModelUrl: AMG_WORKER_URL,
    rawCodeUrl: 'https://turk.puter.site/workers/modeller/im.js',
    editCodeUrl: 'https://github.com/salihcelebi/puter/edit/main/worker/modeller/im.js',
    forceKaydetAcik: false,
  },
  'chat.tsx': {
    sayfaId: 'chat.tsx',
    baslik: 'chat.tsx',
    aciklama: SAYFA_META['chat.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['amg-cekirdegi'],
      model: ['all-apicall-orkestra-isdurumu-teshis'],
      orchestrator: [],
      job: [],
      test: [],
    },
    customModelUrl: AMG_WORKER_URL,
    rawCodeUrl: '',
    editCodeUrl: '',
    forceKaydetAcik: false,
  },
  'video.tsx': {
    sayfaId: 'video.tsx',
    baslik: 'video.tsx',
    aciklama: SAYFA_META['video.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['amg-cekirdegi'],
      model: ['all-apicall-orkestra-isdurumu-teshis'],
      orchestrator: [],
      job: [],
      test: [],
    },
    customModelUrl: AMG_WORKER_URL,
    rawCodeUrl: '',
    editCodeUrl: '',
    forceKaydetAcik: false,
  },
  'tts.tsx': {
    sayfaId: 'tts.tsx',
    baslik: 'tts.tsx',
    aciklama: SAYFA_META['tts.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['amg-cekirdegi'],
      model: ['all-apicall-orkestra-isdurumu-teshis'],
      orchestrator: [],
      job: [],
      test: [],
    },
    customModelUrl: AMG_WORKER_URL,
    rawCodeUrl: '',
    editCodeUrl: '',
    forceKaydetAcik: false,
  },
  'ocr.tsx': {
    sayfaId: 'ocr.tsx',
    baslik: 'ocr.tsx',
    aciklama: SAYFA_META['ocr.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['amg-cekirdegi'],
      model: ['all-apicall-orkestra-isdurumu-teshis'],
      orchestrator: [],
      job: [],
      test: [],
    },
    customModelUrl: AMG_WORKER_URL,
    rawCodeUrl: '',
    editCodeUrl: '',
    forceKaydetAcik: false,
  },
};


// ==============================
// 6) evaluateCompatibility fonksiyonunu bununla değiştir
// ==============================

function evaluateCompatibility(pageId: PageId, config: PageConfig, workers: WorkerMap) {
  const uyumsuzlar: Array<{ sinif: WorkerClassId; workerId: string; worker?: WorkerItem }> = [];
  const eksikSiniflar: WorkerClassId[] = [];

  CLASS_IDS.forEach((sinif) => {
    const selected = config.secilenWorkerlar[sinif] || [];

    if (ZORUNLU_SINIFLAR.includes(sinif) && selected.length === 0) {
      eksikSiniflar.push(sinif);
    }

    selected.forEach((workerId) => {
      const worker = workers[sinif].find((w) => w.id === workerId);
      if (!worker || !worker.destekledigiSayfalar.includes(pageId)) {
        uyumsuzlar.push({ sinif, workerId, worker });
      }
    });
  });

  return {
    uyumsuzlar,
    eksikSiniflar,
    hasHardWarning: uyumsuzlar.length > 0,
    hasSoftWarning: eksikSiniflar.length > 0,
  };
}


// ==============================
// 7) Header içindeki açıklama paragrafını bununla değiştir
// ==============================

<p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">
  Önce soldan bir sayfa seçilir. Sonra yalnızca o sayfanın ilgili workerları görünür. Yeni düzende her sayfada varsayılan olarak iki ana worker gelir:
  Sınıf 1 = AMG çekirdeği, Sınıf 2 = all-apicall orkestrasyon çekirdeği. Sınıf 3, 4 ve 5 ise gelecekte açılacak ek workerlar için diğer alanlar olarak bırakılır.
</p>


// ==============================
// 8) Sidebar kartlarındaki “5 sınıf” yazısını bununla değiştir
// ==============================

<div className={cx('mt-3 text-xs', active ? 'text-zinc-300' : 'text-zinc-500')}>
  2 varsayılan + 3 diğer • {selected} seçim
</div>


// ==============================
// 9) Sayfa seçilmediğinde görünen ilk StatCard üçlüsünü bununla değiştir
// ==============================

<div className="grid gap-4 md:grid-cols-3">
  <StatCard label="Adım 1" value="Sayfa seç" hint="image.tsx veya başka bir sayfa seç." />
  <StatCard label="Adım 2" value="2 ana sınıf otomatik gelir" hint="AMG ve all-apicall varsayılan görünür." />
  <StatCard label="Adım 3" value="İstersen diğerlerini aç" hint="DİĞER WORKERLAR butonu ile ek sınıfları da görebilirsin." />
</div>


// ==============================
// 10) ResetDialog içindeki ilk aşama madde listesini bununla değiştir
// ==============================

<ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
  <li>Sınıf 1 seçimi varsayılan AMG workerına dönecek.</li>
  <li>Sınıf 2 seçimi varsayılan all-apicall workerına dönecek.</li>
  <li>Sınıf 3, Sınıf 4 ve Sınıf 5 seçimleri boş hale dönecek.</li>
  <li>Özel model adresi varsayılana dönecek.</li>
  <li>Raw ve düzenleme bağlantıları kayıtlı varsayılan değerine dönecek.</li>
  <li>Force kaydet tercihi kapanacak.</li>
</ul>


// ==============================
// 11) startReset içindeki fallback summary dizisini bununla değiştir
// ==============================

setResetSummary(
  data.summary || [
    'Sınıf 1 seçimi varsayılan AMG workerına dönecek.',
    'Sınıf 2 seçimi varsayılan all-apicall workerına dönecek.',
    'Sınıf 3, Sınıf 4 ve Sınıf 5 seçimleri boş hale dönecek.',
    'Özel model adresi varsayılana dönecek.',
    'Raw ve düzenleme bağlantıları kayıtlı varsayılan değerine dönecek.',
    'Force kaydet tercihi kapanacak.',
  ]
);


// ==============================
// 12) “Nasıl çalışır?” kartındaki adım listesini bununla değiştir
// ==============================

{[
  'Sayfa seç',
  'İlk 2 varsayılan sınıfı kontrol et',
  'İstersen DİĞER WORKERLAR aç',
  'Yeni worker ekle',
  'Mevcut workerı düzenle',
  'Test et',
  'Kaydet veya force kaydet',
].map((text, i) => (
  <div key={text} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
    <div className="text-xs font-semibold uppercase text-indigo-600">Adım {i + 1}</div>
    <div className="mt-1 text-sm font-semibold text-zinc-950">{text}</div>
  </div>
))}


// ==============================
// 13) İstersen bu küçük metni de güncelle
// “Sayfalar” panel açıklamasını bununla değiştir
// ==============================

<div className="mt-1 text-sm text-zinc-500">
  Önce buradan bir sayfa seç. Seçince ilk 2 sınıf varsayılan görünür, diğer 3 sınıf isteğe bağlı açılır.
</div>
