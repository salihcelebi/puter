import { useEffect, useMemo, useState, type ReactNode } from 'react';
import toast from 'react-hot-toast';

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
  updatedBy?: string;
  lastSavedDiff?: Array<{ alan: string; once: string; sonra: string }>;
};

type ConfigMap = Record<PageId, PageConfig>;

type TestResult = {
  pageId: PageId;
  checkedAt: string;
  healthy: boolean;
  summary: string;
  suggestion: string;
  checks: Array<{ label: string; ok: boolean; detail: string }>;
};

type Diagnostics = {
  sessionStatus: 'Hazır' | 'Sorunlu' | 'Bilinmiyor';
  lastTestStatus: 'Başarılı' | 'Başarısız' | 'Bilinmiyor';
  reservationCount: number | string;
  adminCostCount: number | string;
  updatedAt?: string;
  updatedBy?: string;
};

type TestMap = Partial<Record<PageId, TestResult>>;
type DiagnosticsMap = Partial<Record<PageId, Diagnostics>>;

type AddWorkerDraft = {
  sinif: WorkerClassId;
  ad: string;
  url: string;
  aciklama: string;
  gorevler: [string, string, string, string, string];
  destekledigiSayfalar: PageId[];
  varsayilanYap: boolean;
  hemenSec: boolean;
};

const SAYFA_META: Record<PageId, { ozellik: string; kisa: string; aciklama: string }> = {
  'image.tsx': {
    ozellik: 'Görsel Üretim',
    kisa: 'Resim üretim akışı',
    aciklama: 'image.tsx sayfasının hangi worker sınıfları ile çalışacağını yönetir.',
  },
  'chat.tsx': {
    ozellik: 'Sohbet',
    kisa: 'Sohbet ve metin akışı',
    aciklama: 'chat.tsx sayfasının hangi worker sınıfları ile çalışacağını yönetir.',
  },
  'video.tsx': {
    ozellik: 'Video',
    kisa: 'Video üretim akışı',
    aciklama: 'video.tsx sayfasının hangi worker sınıfları ile çalışacağını yönetir.',
  },
  'tts.tsx': {
    ozellik: 'Seslendirme',
    kisa: 'Metinden ses akışı',
    aciklama: 'tts.tsx sayfasının hangi worker sınıfları ile çalışacağını yönetir.',
  },
  'ocr.tsx': {
    ozellik: 'OCR',
    kisa: 'Görselden yazı okuma',
    aciklama: 'ocr.tsx sayfasının hangi worker sınıfları ile çalışacağını yönetir.',
  },
};

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
    baslik: 'SINIF 1 = API ÇAĞIRAN İŞÇİLER',
    alt: '( CHAT , IMG, VIDEO , TTS MODELLERİ ) işi yapanlar',
    renk: 'border-blue-200 bg-blue-50',
    digerButonRenk: 'bg-blue-600 hover:bg-blue-700',
  },
  model: {
    baslik: 'SINIF 2 = MODEL ÇEKEN İŞÇİLER',
    alt: '( CHAT , IMG, VIDEO , TTS , OCR ) seçenekleri getirenler',
    renk: 'border-emerald-200 bg-emerald-50',
    digerButonRenk: 'bg-emerald-600 hover:bg-emerald-700',
  },
  orchestrator: {
    baslik: 'SINIF 3 = ORKESTRA ŞEFİ',
    alt: 'effective-config ( ETKİN AYAR ) / orchestration ( YÖNLENDİRME DÜZENİ ) / nereye gidileceğine karar verenler',
    renk: 'border-violet-200 bg-violet-50',
    digerButonRenk: 'bg-violet-600 hover:bg-violet-700',
  },
  job: {
    baslik: 'SINIF 4 = İŞ TAKİP UZMANI',
    alt: 'job-status ( İŞ DURUMU ) / history ( GEÇMİŞ ) / işin ne durumda olduğunu takip edenler',
    renk: 'border-amber-200 bg-amber-50',
    digerButonRenk: 'bg-amber-600 hover:bg-amber-700',
  },
  test: {
    baslik: 'SINIF 5 = TEST DEDEKTİFİ',
    alt: 'test / diagnostics ( TEŞHİS ) / sistemde sorun var mı diye kontrol edenler',
    renk: 'border-rose-200 bg-rose-50',
    digerButonRenk: 'bg-rose-600 hover:bg-rose-700',
  },
};

const DEFAULT_WORKERS: WorkerMap = {
  api: [
    {
      id: 'image-api-cagrisi',
      ad: 'image-api-cagrisi',
      url: 'https://image-api-cagrisix.puter.work',
      aciklama: 'Image isteklerini gerçekten yapan ana worker.',
      gorevler: ['RESİM İSTEĞİ', 'İŞİ BAŞLATIR', 'İSTEK GÖNDERİR', 'SONUÇ ALIR', 'HATA YAKALAR'],
      sinif: 'api',
      destekledigiSayfalar: ['image.tsx'],
      varsayilanSayfalar: ['image.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'api-cagrilari',
      ad: 'api-cagrilari',
      url: 'https://apicagrilarix.puter.work',
      aciklama: 'Chat, resim, video, TTS, OCR, deepsearch ve agent isteklerini başlatan genel worker.',
      gorevler: ['GENEL İSTEK', 'ÇOKLU SERVİS', 'İŞİ BAŞLATIR', 'YÖNLENDİRİR', 'HATA YAKALAR'],
      sinif: 'api',
      destekledigiSayfalar: ['image.tsx', 'chat.tsx', 'video.tsx', 'tts.tsx', 'ocr.tsx'],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'chat-api-cagrisi',
      ad: 'chat-api-cagrisi',
      url: 'https://chat-api-cagrisix.puter.work',
      aciklama: 'Chat isteklerini gerçekten yapan ana worker.',
      gorevler: ['CHAT İSTEĞİ', 'İŞİ BAŞLATIR', 'YANIT ÜRETİR', 'SONUÇ ALIR', 'HATA YAKALAR'],
      sinif: 'api',
      destekledigiSayfalar: ['chat.tsx'],
      varsayilanSayfalar: ['chat.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'video-api-cagrisi',
      ad: 'video-api-cagrisi',
      url: 'https://video-api-cagrisix.puter.work',
      aciklama: 'Video isteklerini gerçekten yapan ana worker.',
      gorevler: ['VİDEO İSTEĞİ', 'İŞİ BAŞLATIR', 'KUYRUK AÇAR', 'SONUÇ ALIR', 'HATA YAKALAR'],
      sinif: 'api',
      destekledigiSayfalar: ['video.tsx'],
      varsayilanSayfalar: ['video.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'tts-api-cagrisi',
      ad: 'tts-api-cagrisi',
      url: 'https://tts-api-cagrisix.puter.work',
      aciklama: 'TTS isteklerini gerçekten yapan ana worker.',
      gorevler: ['TTS İSTEĞİ', 'İŞİ BAŞLATIR', 'SES ÜRETİR', 'SONUÇ ALIR', 'HATA YAKALAR'],
      sinif: 'api',
      destekledigiSayfalar: ['tts.tsx'],
      varsayilanSayfalar: ['tts.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'ocr-api-cagrisi',
      ad: 'ocr-api-cagrisi',
      url: 'https://ocr-api-cagrisix.puter.work',
      aciklama: 'OCR isteklerini gerçekten yapan ana worker.',
      gorevler: ['OCR İSTEĞİ', 'İŞİ BAŞLATIR', 'YAZI OKUR', 'SONUÇ ALIR', 'HATA YAKALAR'],
      sinif: 'api',
      destekledigiSayfalar: ['ocr.tsx'],
      varsayilanSayfalar: ['ocr.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  model: [
    {
      id: 'resim-model-kaynagi',
      ad: 'resim-model-kaynagi',
      url: 'https://resimmodelx.puter.work',
      aciklama: 'Image için model listesini getirir.',
      gorevler: ['RESİM MODELLERİ', 'LİSTE GETİRİR', 'JSON DÖNDÜRÜR', 'SAĞLIK KONTROL', 'SEÇENEK SUNAR'],
      sinif: 'model',
      destekledigiSayfalar: ['image.tsx'],
      varsayilanSayfalar: ['image.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'chat-model-kaynagi',
      ad: 'chat-model-kaynagi',
      url: 'https://chatmodelx.puter.work',
      aciklama: 'Chat için model listesini getirir.',
      gorevler: ['CHAT MODELLERİ', 'LİSTE GETİRİR', 'JSON DÖNDÜRÜR', 'SAĞLIK KONTROL', 'SEÇENEK SUNAR'],
      sinif: 'model',
      destekledigiSayfalar: ['chat.tsx'],
      varsayilanSayfalar: ['chat.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'video-model-kaynagi',
      ad: 'video-model-kaynagi',
      url: 'https://videomodelx.puter.work',
      aciklama: 'Video için model listesini getirir.',
      gorevler: ['VİDEO MODELLERİ', 'LİSTE GETİRİR', 'JSON DÖNDÜRÜR', 'SAĞLIK KONTROL', 'SEÇENEK SUNAR'],
      sinif: 'model',
      destekledigiSayfalar: ['video.tsx'],
      varsayilanSayfalar: ['video.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'tts-model-kaynagi',
      ad: 'tts-model-kaynagi',
      url: 'https://ttsmodelx.puter.work',
      aciklama: 'TTS için model listesini getirir.',
      gorevler: ['TTS MODELLERİ', 'LİSTE GETİRİR', 'JSON DÖNDÜRÜR', 'SAĞLIK KONTROL', 'SEÇENEK SUNAR'],
      sinif: 'model',
      destekledigiSayfalar: ['tts.tsx'],
      varsayilanSayfalar: ['tts.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'ocr-model-kaynagi',
      ad: 'ocr-model-kaynagi',
      url: 'https://ocrmodelx.puter.work',
      aciklama: 'OCR için model listesini getirir.',
      gorevler: ['OCR MODELLERİ', 'LİSTE GETİRİR', 'JSON DÖNDÜRÜR', 'SAĞLIK KONTROL', 'SEÇENEK SUNAR'],
      sinif: 'model',
      destekledigiSayfalar: ['ocr.tsx'],
      varsayilanSayfalar: ['ocr.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'ortak-model-onbellegi',
      ad: 'ortak-model-onbellegi',
      url: 'https://ortakmodelx.puter.work',
      aciklama: 'Paylaşılan model listesini önbellekten hızlı vermek için kullanılır.',
      gorevler: ['ORTAK ÖNBELLEK', 'PAYLAŞILAN LİSTE', 'HIZLI ERİŞİM', 'YÜK AZALTIR', 'TEKRAR AZALTIR'],
      sinif: 'model',
      destekledigiSayfalar: ['image.tsx', 'chat.tsx', 'video.tsx', 'tts.tsx', 'ocr.tsx'],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  orchestrator: [
    {
      id: 'image-orkestra-sefi',
      ad: 'image-orkestra-sefi',
      url: 'https://is-durumu.puter.work/orchestrate/image',
      aciklama: 'Image için etkin ayar (ETKİN AYAR) ve yönlendirme düzeni (YÖNLENDİRME DÜZENİ) kararlarını verir.',
      gorevler: ['YOL SEÇER', 'KARAR VERİR', 'AKIŞ YÖNETİR', 'FALLBACK SEÇER', 'HEDEF BELİRLER'],
      sinif: 'orchestrator',
      destekledigiSayfalar: ['image.tsx'],
      varsayilanSayfalar: ['image.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'chat-orkestra-sefi',
      ad: 'chat-orkestra-sefi',
      url: 'https://is-durumu.puter.work/orchestrate/chat',
      aciklama: 'Chat için etkin ayar (ETKİN AYAR) ve yönlendirme düzeni (YÖNLENDİRME DÜZENİ) kararlarını verir.',
      gorevler: ['YOL SEÇER', 'KARAR VERİR', 'AKIŞ YÖNETİR', 'FALLBACK SEÇER', 'HEDEF BELİRLER'],
      sinif: 'orchestrator',
      destekledigiSayfalar: ['chat.tsx'],
      varsayilanSayfalar: ['chat.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'video-orkestra-sefi',
      ad: 'video-orkestra-sefi',
      url: 'https://is-durumu.puter.work/orchestrate/video',
      aciklama: 'Video için etkin ayar (ETKİN AYAR) ve yönlendirme düzeni (YÖNLENDİRME DÜZENİ) kararlarını verir.',
      gorevler: ['YOL SEÇER', 'KARAR VERİR', 'AKIŞ YÖNETİR', 'FALLBACK SEÇER', 'HEDEF BELİRLER'],
      sinif: 'orchestrator',
      destekledigiSayfalar: ['video.tsx'],
      varsayilanSayfalar: ['video.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'tts-orkestra-sefi',
      ad: 'tts-orkestra-sefi',
      url: 'https://is-durumu.puter.work/orchestrate/tts',
      aciklama: 'TTS için etkin ayar (ETKİN AYAR) ve yönlendirme düzeni (YÖNLENDİRME DÜZENİ) kararlarını verir.',
      gorevler: ['YOL SEÇER', 'KARAR VERİR', 'AKIŞ YÖNETİR', 'FALLBACK SEÇER', 'HEDEF BELİRLER'],
      sinif: 'orchestrator',
      destekledigiSayfalar: ['tts.tsx'],
      varsayilanSayfalar: ['tts.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'ocr-orkestra-sefi',
      ad: 'ocr-orkestra-sefi',
      url: 'https://is-durumu.puter.work/orchestrate/ocr',
      aciklama: 'OCR için etkin ayar (ETKİN AYAR) ve yönlendirme düzeni (YÖNLENDİRME DÜZENİ) kararlarını verir.',
      gorevler: ['YOL SEÇER', 'KARAR VERİR', 'AKIŞ YÖNETİR', 'FALLBACK SEÇER', 'HEDEF BELİRLER'],
      sinif: 'orchestrator',
      destekledigiSayfalar: ['ocr.tsx'],
      varsayilanSayfalar: ['ocr.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'genel-orkestra-sefi',
      ad: 'genel-orkestra-sefi',
      url: 'https://is-durumu.puter.work/orchestrate/router',
      aciklama: 'Birden fazla worker varsa genel yönlendirme kararlarını verir.',
      gorevler: ['GENEL KARAR', 'AKIŞ BÖLER', 'HEDEF SEÇER', 'FALLBACK KURAR', 'TRAFİK YÖNETİR'],
      sinif: 'orchestrator',
      destekledigiSayfalar: ['image.tsx', 'chat.tsx', 'video.tsx', 'tts.tsx', 'ocr.tsx'],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  job: [
    {
      id: 'image-is-takibi',
      ad: 'image-is-takibi',
      url: 'https://is-durumu.puter.work/jobs/image',
      aciklama: 'Image işleri için durum ve geçmiş takibi yapar.',
      gorevler: ['DURUM İZLER', 'GEÇMİŞ TUTAR', 'İŞ SAYAR', 'SONUÇ YAZAR', 'SÜREÇ GÖSTERİR'],
      sinif: 'job',
      destekledigiSayfalar: ['image.tsx'],
      varsayilanSayfalar: ['image.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'chat-is-takibi',
      ad: 'chat-is-takibi',
      url: 'https://is-durumu.puter.work/jobs/chat',
      aciklama: 'Chat işleri için durum ve geçmiş takibi yapar.',
      gorevler: ['DURUM İZLER', 'GEÇMİŞ TUTAR', 'İŞ SAYAR', 'SONUÇ YAZAR', 'SÜREÇ GÖSTERİR'],
      sinif: 'job',
      destekledigiSayfalar: ['chat.tsx'],
      varsayilanSayfalar: ['chat.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'video-is-takibi',
      ad: 'video-is-takibi',
      url: 'https://is-durumu.puter.work/jobs/video',
      aciklama: 'Video işleri için durum ve geçmiş takibi yapar.',
      gorevler: ['DURUM İZLER', 'GEÇMİŞ TUTAR', 'İŞ SAYAR', 'SONUÇ YAZAR', 'SÜREÇ GÖSTERİR'],
      sinif: 'job',
      destekledigiSayfalar: ['video.tsx'],
      varsayilanSayfalar: ['video.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'tts-is-takibi',
      ad: 'tts-is-takibi',
      url: 'https://is-durumu.puter.work/jobs/tts',
      aciklama: 'TTS işleri için durum ve geçmiş takibi yapar.',
      gorevler: ['DURUM İZLER', 'GEÇMİŞ TUTAR', 'İŞ SAYAR', 'SONUÇ YAZAR', 'SÜREÇ GÖSTERİR'],
      sinif: 'job',
      destekledigiSayfalar: ['tts.tsx'],
      varsayilanSayfalar: ['tts.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'ocr-is-takibi',
      ad: 'ocr-is-takibi',
      url: 'https://is-durumu.puter.work/jobs/ocr',
      aciklama: 'OCR işleri için durum ve geçmiş takibi yapar.',
      gorevler: ['DURUM İZLER', 'GEÇMİŞ TUTAR', 'İŞ SAYAR', 'SONUÇ YAZAR', 'SÜREÇ GÖSTERİR'],
      sinif: 'job',
      destekledigiSayfalar: ['ocr.tsx'],
      varsayilanSayfalar: ['ocr.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'genel-is-gecmisi',
      ad: 'genel-is-gecmisi',
      url: 'https://is-durumu.puter.work/history',
      aciklama: 'Tüm sayfalar için ortak iş geçmişi ve kayıt takibi yapar.',
      gorevler: ['ORTAK GEÇMİŞ', 'KAYIT TUTAR', 'İŞ ARŞİVİ', 'AKIŞ İZLER', 'RAPOR GÖSTERİR'],
      sinif: 'job',
      destekledigiSayfalar: ['image.tsx', 'chat.tsx', 'video.tsx', 'tts.tsx', 'ocr.tsx'],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
  test: [
    {
      id: 'image-teshis-kontrolu',
      ad: 'image-teshis-kontrolu',
      url: 'https://is-durumu.puter.work/diagnostics/image',
      aciklama: 'Image worker test ve tanı kontrolünü yapar.',
      gorevler: ['TEST ÇALIŞTIRIR', 'TEŞHİS YAPAR', 'JSON KONTROL', 'HATA BULUR', 'SONUÇ YAZAR'],
      sinif: 'test',
      destekledigiSayfalar: ['image.tsx'],
      varsayilanSayfalar: ['image.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'chat-teshis-kontrolu',
      ad: 'chat-teshis-kontrolu',
      url: 'https://is-durumu.puter.work/diagnostics/chat',
      aciklama: 'Chat worker test ve tanı kontrolünü yapar.',
      gorevler: ['TEST ÇALIŞTIRIR', 'TEŞHİS YAPAR', 'JSON KONTROL', 'HATA BULUR', 'SONUÇ YAZAR'],
      sinif: 'test',
      destekledigiSayfalar: ['chat.tsx'],
      varsayilanSayfalar: ['chat.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'video-teshis-kontrolu',
      ad: 'video-teshis-kontrolu',
      url: 'https://is-durumu.puter.work/diagnostics/video',
      aciklama: 'Video worker test ve tanı kontrolünü yapar.',
      gorevler: ['TEST ÇALIŞTIRIR', 'TEŞHİS YAPAR', 'JSON KONTROL', 'HATA BULUR', 'SONUÇ YAZAR'],
      sinif: 'test',
      destekledigiSayfalar: ['video.tsx'],
      varsayilanSayfalar: ['video.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'tts-teshis-kontrolu',
      ad: 'tts-teshis-kontrolu',
      url: 'https://is-durumu.puter.work/diagnostics/tts',
      aciklama: 'TTS worker test ve tanı kontrolünü yapar.',
      gorevler: ['TEST ÇALIŞTIRIR', 'TEŞHİS YAPAR', 'JSON KONTROL', 'HATA BULUR', 'SONUÇ YAZAR'],
      sinif: 'test',
      destekledigiSayfalar: ['tts.tsx'],
      varsayilanSayfalar: ['tts.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'ocr-teshis-kontrolu',
      ad: 'ocr-teshis-kontrolu',
      url: 'https://is-durumu.puter.work/diagnostics/ocr',
      aciklama: 'OCR worker test ve tanı kontrolünü yapar.',
      gorevler: ['TEST ÇALIŞTIRIR', 'TEŞHİS YAPAR', 'JSON KONTROL', 'HATA BULUR', 'SONUÇ YAZAR'],
      sinif: 'test',
      destekledigiSayfalar: ['ocr.tsx'],
      varsayilanSayfalar: ['ocr.tsx'],
      durum: 'Hazır',
      sonTestSonucu: 'Henüz test edilmedi',
    },
    {
      id: 'derin-saglik-kontrolu',
      ad: 'derin-saglik-kontrolu',
      url: 'https://is-durumu.puter.work/diagnostics/deep',
      aciklama: 'Daha derin sistem sağlığı ve bağlantı kontrolü yapar.',
      gorevler: ['DERİN TARAMA', 'SAĞLIK ÖLÇER', 'BAĞLANTI KONTROL', 'SORUN BULUR', 'RAPOR ÜRETİR'],
      sinif: 'test',
      destekledigiSayfalar: ['image.tsx', 'chat.tsx', 'video.tsx', 'tts.tsx', 'ocr.tsx'],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    },
  ],
};

const DEFAULT_CONFIGS: ConfigMap = {
  'image.tsx': {
    sayfaId: 'image.tsx',
    baslik: 'image.tsx',
    aciklama: SAYFA_META['image.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['image-api-cagrisi'],
      model: ['resim-model-kaynagi'],
      orchestrator: ['image-orkestra-sefi'],
      job: ['image-is-takibi'],
      test: ['image-teshis-kontrolu'],
    },
    customModelUrl: 'https://resimmodelx.puter.work',
    rawCodeUrl: 'https://turk.puter.site/workers/modeller/im.js',
    editCodeUrl: 'https://github.com/salihcelebi/puter/edit/main/worker/modeller/im.js',
    forceKaydetAcik: false,
  },
  'chat.tsx': {
    sayfaId: 'chat.tsx',
    baslik: 'chat.tsx',
    aciklama: SAYFA_META['chat.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['chat-api-cagrisi'],
      model: ['chat-model-kaynagi'],
      orchestrator: ['chat-orkestra-sefi'],
      job: ['chat-is-takibi'],
      test: ['chat-teshis-kontrolu'],
    },
    customModelUrl: 'https://chatmodelx.puter.work',
    rawCodeUrl: '',
    editCodeUrl: '',
    forceKaydetAcik: false,
  },
  'video.tsx': {
    sayfaId: 'video.tsx',
    baslik: 'video.tsx',
    aciklama: SAYFA_META['video.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['video-api-cagrisi'],
      model: ['video-model-kaynagi'],
      orchestrator: ['video-orkestra-sefi'],
      job: ['video-is-takibi'],
      test: ['video-teshis-kontrolu'],
    },
    customModelUrl: 'https://videomodelx.puter.work',
    rawCodeUrl: '',
    editCodeUrl: '',
    forceKaydetAcik: false,
  },
  'tts.tsx': {
    sayfaId: 'tts.tsx',
    baslik: 'tts.tsx',
    aciklama: SAYFA_META['tts.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['tts-api-cagrisi'],
      model: ['tts-model-kaynagi'],
      orchestrator: ['tts-orkestra-sefi'],
      job: ['tts-is-takibi'],
      test: ['tts-teshis-kontrolu'],
    },
    customModelUrl: 'https://ttsmodelx.puter.work',
    rawCodeUrl: '',
    editCodeUrl: '',
    forceKaydetAcik: false,
  },
  'ocr.tsx': {
    sayfaId: 'ocr.tsx',
    baslik: 'ocr.tsx',
    aciklama: SAYFA_META['ocr.tsx'].aciklama,
    secilenWorkerlar: {
      api: ['ocr-api-cagrisi'],
      model: ['ocr-model-kaynagi'],
      orchestrator: ['ocr-orkestra-sefi'],
      job: ['ocr-is-takibi'],
      test: ['ocr-teshis-kontrolu'],
    },
    customModelUrl: 'https://ocrmodelx.puter.work',
    rawCodeUrl: '',
    editCodeUrl: '',
    forceKaydetAcik: false,
  },
};

function cx(...parts: Array<string | false | undefined>) {
  return parts.filter(Boolean).join(' ');
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

function slugify(text: string) {
  return text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9çğıöşü]+/gi, '-')
    .replace(/(^-|-$)/g, '');
}

function isHttpsUrl(value?: string) {
  if (!value) return false;
  try {
    const u = new URL(value);
    return u.protocol === 'https:';
  } catch {
    return false;
  }
}

function formatDate(value?: string) {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('tr-TR');
}

async function safeJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  const text = await res.text();
  const contentType = res.headers.get('content-type') || '';

  if (/<!doctype|<html/i.test(text)) throw new Error('Sunucu JSON yerine HTML döndü.');
  if (!contentType.includes('application/json')) throw new Error('JSON içerik tipi bekleniyordu.');

  let data: any = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Geçersiz JSON yanıtı.');
  }

  if (!res.ok) throw new Error(data?.error || 'İstek başarısız oldu.');
  return data as T;
}

function getDefaultWorkersForPage(pageId: PageId, workers: WorkerMap, sinif: WorkerClassId) {
  return workers[sinif].filter((item) => (item.varsayilanSayfalar || []).includes(pageId));
}

function getPageRelevantWorkers(pageId: PageId, workers: WorkerMap, sinif: WorkerClassId) {
  return workers[sinif].filter((item) => item.destekledigiSayfalar.includes(pageId));
}

function getPageOtherWorkers(pageId: PageId, workers: WorkerMap, sinif: WorkerClassId) {
  return workers[sinif].filter((item) => !item.destekledigiSayfalar.includes(pageId));
}

function evaluateCompatibility(pageId: PageId, config: PageConfig, workers: WorkerMap) {
  const uyumsuzlar: Array<{ sinif: WorkerClassId; workerId: string; worker?: WorkerItem }> = [];
  const eksikSiniflar: WorkerClassId[] = [];

  CLASS_IDS.forEach((sinif) => {
    const selected = config.secilenWorkerlar[sinif] || [];
    if (selected.length === 0) eksikSiniflar.push(sinif);

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

function computeDiff(before: PageConfig, after: PageConfig) {
  const result: Array<{ alan: string; once: string; sonra: string }> = [];
  (['customModelUrl', 'rawCodeUrl', 'editCodeUrl', 'forceKaydetAcik'] as const).forEach((alan) => {
    const once = String(before[alan] ?? '');
    const sonra = String(after[alan] ?? '');
    if (once !== sonra) result.push({ alan, once, sonra });
  });

  CLASS_IDS.forEach((sinif) => {
    const once = (before.secilenWorkerlar[sinif] || []).join(', ');
    const sonra = (after.secilenWorkerlar[sinif] || []).join(', ');
    if (once !== sonra) result.push({ alan: `${sinif} seçimleri`, once, sonra });
  });

  return result;
}

function createUniqueWorkerId(workers: WorkerMap, sinif: WorkerClassId, ad: string) {
  const base = slugify(ad);
  const ids = new Set(workers[sinif].map((w) => w.id));
  if (!ids.has(base)) return base;
  let i = 2;
  while (ids.has(`${base}-${i}`)) i += 1;
  return `${base}-${i}`;
}

function SectionCard({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cx('rounded-3xl border border-zinc-200 bg-white p-5 shadow-sm', className)}>
      <div className="flex flex-col gap-3 border-b border-zinc-100 pb-4 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-zinc-950">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-zinc-500">{subtitle}</p> : null}
        </div>
        {right}
      </div>
      <div className="pt-4">{children}</div>
    </section>
  );
}

function StatCard({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
      <div className="text-xs font-medium text-zinc-500">{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-950">{value}</div>
      {hint ? <div className="mt-2 text-xs text-zinc-500">{hint}</div> : null}
    </div>
  );
}

function Badge({ children, tone = 'neutral' }: { children: ReactNode; tone?: 'neutral' | 'success' | 'warn' | 'danger' }) {
  const cls =
    tone === 'success'
      ? 'bg-emerald-100 text-emerald-700'
      : tone === 'warn'
      ? 'bg-amber-100 text-amber-700'
      : tone === 'danger'
      ? 'bg-red-100 text-red-700'
      : 'bg-zinc-100 text-zinc-700';

  return <span className={cx('inline-flex rounded-full px-2.5 py-1 text-xs font-medium', cls)}>{children}</span>;
}

function LinkField({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  placeholder: string;
  onChange: (v: string) => void;
}) {
  const invalid = value ? !isHttpsUrl(value) : false;

  const copy = async () => {
    if (!value) return toast.error('Önce bir bağlantı girmeniz gerekiyor.');
    await navigator.clipboard.writeText(value);
    toast.success('Bağlantı kopyalandı.');
  };

  const validate = () => {
    if (!value) return toast.error('Önce bir bağlantı girmeniz gerekiyor.');
    if (!isHttpsUrl(value)) return toast.error('Bu alana geçerli https adresi girmeniz gerekiyor.');
    toast.success('Bağlantı biçimi geçerli görünüyor.');
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-4">
      <label className="block text-sm font-medium text-zinc-900">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cx('mt-2 w-full rounded-xl border p-3 text-sm', invalid ? 'border-red-300 bg-red-50' : 'border-zinc-200')}
      />
      <p className="mt-2 text-xs text-zinc-500">Bu alan boş olabilir. Doluysa geçerli https adresi olmalıdır.</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={copy} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium">
          Kopyala
        </button>
        <a
          href={value && isHttpsUrl(value) ? value : '#'}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => {
            if (!value || !isHttpsUrl(value)) {
              e.preventDefault();
              toast.error('Önce geçerli bir https adresi girmeniz gerekiyor.');
            }
          }}
          className={cx(
            'rounded-lg px-3 py-1.5 text-xs font-medium',
            value && isHttpsUrl(value) ? 'bg-zinc-100 text-zinc-900' : 'cursor-not-allowed bg-zinc-50 text-zinc-400'
          )}
        >
          Yeni sekmede aç
        </a>
        <button type="button" onClick={validate} className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium">
          Doğrula
        </button>
      </div>
    </div>
  );
}

function WorkerCard({
  worker,
  checked,
  onToggle,
}: {
  worker: WorkerItem;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <label className={cx('block rounded-2xl border bg-white p-4 transition', checked ? 'border-black shadow-sm' : 'border-zinc-200')}>
      <div className="flex items-start gap-3">
        <input type="checkbox" checked={checked} onChange={onToggle} className="mt-1 h-4 w-4 rounded border-zinc-300" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-sm font-semibold text-zinc-950">{worker.ad}</div>
            {(worker.varsayilanSayfalar || []).length > 0 ? <Badge tone="success">Varsayılan</Badge> : null}
            <Badge tone={worker.durum === 'Hazır' ? 'success' : worker.durum === 'Sorunlu' ? 'danger' : 'neutral'}>{worker.durum || 'Bilinmiyor'}</Badge>
          </div>

          <div className="mt-2 text-sm text-zinc-700">{worker.aciklama}</div>

          <div className="mt-3 break-all text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">URL:</span> {worker.url}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">Desteklediği sayfalar:</span> {worker.destekledigiSayfalar.join(', ')}
          </div>
          <div className="mt-1 text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">En son test sonucu:</span> {worker.sonTestSonucu || 'Henüz test edilmedi'}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {worker.gorevler.map((gorev) => (
              <span key={gorev} className="rounded-full bg-zinc-900 px-3 py-1 text-xs font-medium text-white">
                {gorev}
              </span>
            ))}
          </div>
        </div>
      </div>
    </label>
  );
}

function WorkerClassSection({
  sinif,
  pageId,
  workers,
  selectedIds,
  showOthers,
  setShowOthers,
  onToggle,
  onOpenAdd,
}: {
  sinif: WorkerClassId;
  pageId: PageId;
  workers: WorkerMap;
  selectedIds: string[];
  showOthers: boolean;
  setShowOthers: (v: boolean) => void;
  onToggle: (workerId: string) => void;
  onOpenAdd: (sinif: WorkerClassId) => void;
}) {
  const ilgili = getPageRelevantWorkers(pageId, workers, sinif);
  const diger = getPageOtherWorkers(pageId, workers, sinif);
  const meta = SINIF_META[sinif];

  return (
    <SectionCard
      title={meta.baslik}
      subtitle={meta.alt}
      right={
        <button
          type="button"
          onClick={() => onOpenAdd(sinif)}
          className="rounded-xl bg-white px-3 py-2 text-sm font-medium text-zinc-900 ring-1 ring-zinc-200"
        >
          + Yeni worker ekle
        </button>
      }
      className={meta.renk}
    >
      <div className="space-y-3">
        {ilgili.map((worker) => (
          <WorkerCard key={worker.id} worker={worker} checked={selectedIds.includes(worker.id)} onToggle={() => onToggle(worker.id)} />
        ))}

        {diger.length > 0 ? (
          <div className="pt-2">
            <button
              type="button"
              onClick={() => setShowOthers(!showOthers)}
              className={cx('rounded-2xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition', meta.digerButonRenk)}
            >
              {showOthers ? '[ DİĞER WORKERLARI GİZLE ]' : '[ DİĞER WORKERLAR ]'}
            </button>
          </div>
        ) : null}

        {showOthers ? (
          <div className="space-y-3 pt-3">
            {diger.map((worker) => (
              <WorkerCard key={worker.id} worker={worker} checked={selectedIds.includes(worker.id)} onToggle={() => onToggle(worker.id)} />
            ))}
          </div>
        ) : null}
      </div>
    </SectionCard>
  );
}

function AddWorkerModal({
  open,
  draft,
  setDraft,
  currentPageId,
  onClose,
  onSubmit,
}: {
  open: boolean;
  draft: AddWorkerDraft;
  setDraft: (v: AddWorkerDraft) => void;
  currentPageId: PageId | null;
  onClose: () => void;
  onSubmit: () => void;
}) {
  if (!open || !currentPageId) return null;

  const updateGorev = (index: number, value: string) => {
    const next = [...draft.gorevler] as [string, string, string, string, string];
    next[index] = value;
    setDraft({ ...draft, gorevler: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-zinc-950">Yeni worker ekle</h3>
            <p className="mt-1 text-sm text-zinc-500">Acemi kullanıcı için basit form. Yeni worker ekleyebilir, sonra tekrar düzenleyebilirsin.</p>
          </div>
          <button onClick={onClose} type="button" className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium">
            Kapat
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-900">Sınıf</label>
            <input value={SINIF_META[draft.sinif].baslik} readOnly className="mt-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-sm" />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-900">Worker adı</label>
            <input
              value={draft.ad}
              onChange={(e) => setDraft({ ...draft, ad: e.target.value })}
              className="mt-2 w-full rounded-xl border border-zinc-200 p-3 text-sm"
              placeholder="Örnek: image-yedek-api"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-900">Worker URL</label>
            <input
              value={draft.url}
              onChange={(e) => setDraft({ ...draft, url: e.target.value })}
              className="mt-2 w-full rounded-xl border border-zinc-200 p-3 text-sm"
              placeholder="https://..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-900">Worker açıklaması</label>
            <input
              value={draft.aciklama}
              onChange={(e) => setDraft({ ...draft, aciklama: e.target.value })}
              className="mt-2 w-full rounded-xl border border-zinc-200 p-3 text-sm"
              placeholder="Örnek: Image için ek yedek API worker."
            />
          </div>

          <div className="md:col-span-2">
            <div className="text-sm font-medium text-zinc-900">5 kısa görev</div>
            <div className="mt-2 grid gap-3 md:grid-cols-5">
              {draft.gorevler.map((g, i) => (
                <input
                  key={i}
                  value={g}
                  onChange={(e) => updateGorev(i, e.target.value.toUpperCase())}
                  className="rounded-xl border border-zinc-200 p-3 text-sm"
                  placeholder={`Görev ${i + 1}`}
                />
              ))}
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="text-sm font-medium text-zinc-900">Desteklediği sayfalar</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {PAGE_IDS.map((pageId) => {
                const checked = draft.destekledigiSayfalar.includes(pageId);
                return (
                  <label key={pageId} className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? draft.destekledigiSayfalar.filter((x) => x !== pageId)
                          : [...draft.destekledigiSayfalar, pageId];
                        setDraft({ ...draft, destekledigiSayfalar: next });
                      }}
                    />
                    <span className="text-sm">{pageId}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div className="md:col-span-2 grid gap-2">
            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3">
              <input type="checkbox" checked={draft.varsayilanYap} onChange={(e) => setDraft({ ...draft, varsayilanYap: e.target.checked })} />
              <span className="text-sm">Bu worker’ı seçili sayfa için varsayılan yap</span>
            </label>
            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3">
              <input type="checkbox" checked={draft.hemenSec} onChange={(e) => setDraft({ ...draft, hemenSec: e.target.checked })} />
              <span className="text-sm">Eklenince seçili sayfada hemen işaretle</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button onClick={onClose} type="button" className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium">
            Vazgeç
          </button>
          <button onClick={onSubmit} type="button" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
            Worker’ı ekle
          </button>
        </div>
      </div>
    </div>
  );
}

function EditWorkerModal({
  open,
  worker,
  currentPageId,
  onClose,
  onSave,
  onDelete,
}: {
  open: boolean;
  worker: WorkerItem | null;
  currentPageId: PageId | null;
  onClose: () => void;
  onSave: (worker: WorkerItem, varsayilan: boolean) => void;
  onDelete: (worker: WorkerItem) => void;
}) {
  const [local, setLocal] = useState<WorkerItem | null>(worker);
  const [varsayilan, setVarsayilan] = useState(false);

  useEffect(() => {
    setLocal(worker ? deepClone(worker) : null);
    setVarsayilan(Boolean(worker && currentPageId && (worker.varsayilanSayfalar || []).includes(currentPageId)));
  }, [worker, currentPageId]);

  if (!open || !local || !currentPageId) return null;

  const updateGorev = (index: number, value: string) => {
    const next = [...local.gorevler] as [string, string, string, string, string];
    next[index] = value;
    setLocal({ ...local, gorevler: next });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-zinc-950">Worker düzenle</h3>
            <p className="mt-1 text-sm text-zinc-500">Mevcut en ufak şeyi bile revize etmek için bu pencereyi kullan.</p>
          </div>
          <button onClick={onClose} type="button" className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium">
            Kapat
          </button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-900">Worker adı</label>
            <input value={local.ad} onChange={(e) => setLocal({ ...local, ad: e.target.value })} className="mt-2 w-full rounded-xl border border-zinc-200 p-3 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-900">Worker URL</label>
            <input value={local.url} onChange={(e) => setLocal({ ...local, url: e.target.value })} className="mt-2 w-full rounded-xl border border-zinc-200 p-3 text-sm" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-zinc-900">Açıklama</label>
            <input value={local.aciklama} onChange={(e) => setLocal({ ...local, aciklama: e.target.value })} className="mt-2 w-full rounded-xl border border-zinc-200 p-3 text-sm" />
          </div>
          <div className="md:col-span-2">
            <div className="text-sm font-medium text-zinc-900">5 kısa görev</div>
            <div className="mt-2 grid gap-3 md:grid-cols-5">
              {local.gorevler.map((g, i) => (
                <input
                  key={i}
                  value={g}
                  onChange={(e) => updateGorev(i, e.target.value.toUpperCase())}
                  className="rounded-xl border border-zinc-200 p-3 text-sm"
                />
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-sm font-medium text-zinc-900">Desteklediği sayfalar</div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              {PAGE_IDS.map((pageId) => {
                const checked = local.destekledigiSayfalar.includes(pageId);
                return (
                  <label key={pageId} className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => {
                        const next = checked
                          ? local.destekledigiSayfalar.filter((x) => x !== pageId)
                          : [...local.destekledigiSayfalar, pageId];
                        setLocal({ ...local, destekledigiSayfalar: next });
                      }}
                    />
                    <span className="text-sm">{pageId}</span>
                  </label>
                );
              })}
            </div>
          </div>
          <div className="md:col-span-2">
            <label className="flex items-center gap-2 rounded-xl border border-zinc-200 p-3">
              <input type="checkbox" checked={varsayilan} onChange={(e) => setVarsayilan(e.target.checked)} />
              <span className="text-sm">Bu worker’ı seçili sayfa için varsayılan yap</span>
            </label>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap justify-between gap-2">
          <button onClick={() => onDelete(local)} type="button" className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
            Worker’ı sil
          </button>
          <div className="flex gap-2">
            <button onClick={onClose} type="button" className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium">
              Vazgeç
            </button>
            <button onClick={() => onSave(local, varsayilan)} type="button" className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
              Değişiklikleri kaydet
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResetDialog({
  open,
  pageId,
  step,
  summary,
  loading,
  onClose,
  onStart,
  onConfirm,
}: {
  open: boolean;
  pageId: PageId | null;
  step: 1 | 2 | 3;
  summary: string[];
  loading: boolean;
  onClose: () => void;
  onStart: () => void;
  onConfirm: () => void;
}) {
  if (!open || !pageId) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-xl font-semibold text-zinc-950">Güvenli sıfırlama</h3>
            <p className="mt-1 text-sm text-zinc-500">Şifre tarayıcıda tutulmaz. Reset isteği backend’e gider ve onay token’ı backend üretir.</p>
          </div>
          <button onClick={onClose} className="rounded-xl bg-zinc-100 px-3 py-2 text-sm font-medium">
            Kapat
          </button>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-3">
          {[1, 2, 3].map((n) => (
            <div key={n} className={cx('rounded-2xl border p-4', step === n ? 'border-black bg-zinc-950 text-white' : 'border-zinc-200 bg-white')}>
              <div className="text-xs font-semibold uppercase">Aşama {n}</div>
              <div className="mt-1 text-sm font-semibold">
                {n === 1 ? 'Ne sıfırlanacak?' : n === 2 ? 'Bu 5 değişiklik yapılacak' : 'Evet, sıfırla'}
              </div>
            </div>
          ))}
        </div>

        {step === 1 ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
              <li>5 sınıftaki worker seçimleri varsayılana dönecek.</li>
              <li>Özel model adresi varsayılana dönecek.</li>
              <li>Raw bağlantısı varsayılana dönecek.</li>
              <li>Düzenleme bağlantısı varsayılana dönecek.</li>
              <li>Force kaydet tercihi kapanacak.</li>
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium">
                Hayır
              </button>
              <button onClick={onStart} disabled={loading} className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                {loading ? 'Hazırlanıyor...' : 'Devam et'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div className="mt-6 rounded-2xl border border-zinc-200 bg-zinc-50 p-5">
            <ul className="list-disc space-y-2 pl-5 text-sm text-zinc-700">
              {summary.map((s) => (
                <li key={s}>{s}</li>
              ))}
            </ul>
            <div className="mt-5 flex justify-end gap-2">
              <button onClick={onClose} className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium">
                Hayır
              </button>
              <button onClick={onConfirm} disabled={loading} className="rounded-xl bg-red-600 px-4 py-2 text-sm font-medium text-white">
                {loading ? 'Sıfırlanıyor...' : 'Evet, sıfırla'}
              </button>
            </div>
          </div>
        ) : null}

        {step === 3 ? <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm">Sıfırlama tamamlandı.</div> : null}
      </div>
    </div>
  );
}

export default function AdminWorkersSec() {
  const [configs, setConfigs] = useState<ConfigMap>(deepClone(DEFAULT_CONFIGS));
  const [originalConfigs, setOriginalConfigs] = useState<ConfigMap>(deepClone(DEFAULT_CONFIGS));
  const [workers, setWorkers] = useState<WorkerMap>(deepClone(DEFAULT_WORKERS));

  const [selectedPageId, setSelectedPageId] = useState<PageId | null>(null);
  const [tests, setTests] = useState<TestMap>({});
  const [diagnostics, setDiagnostics] = useState<DiagnosticsMap>({});

  const [loading, setLoading] = useState({
    load: false,
    save: false,
    forceSave: false,
    test: false,
    diagnostics: false,
    resetStart: false,
    resetConfirm: false,
  });

  const [errorCard, setErrorCard] = useState<{ title: string; detail: string; action: string } | null>(null);
  const [showOthers, setShowOthers] = useState<Record<WorkerClassId, boolean>>({
    api: false,
    model: false,
    orchestrator: false,
    job: false,
    test: false,
  });

  const [addOpen, setAddOpen] = useState(false);
  const [addDraft, setAddDraft] = useState<AddWorkerDraft>({
    sinif: 'api',
    ad: '',
    url: '',
    aciklama: '',
    gorevler: ['', '', '', '', ''],
    destekledigiSayfalar: [],
    varsayilanYap: false,
    hemenSec: true,
  });

  const [editOpen, setEditOpen] = useState(false);
  const [editingWorker, setEditingWorker] = useState<WorkerItem | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetStep, setResetStep] = useState<1 | 2 | 3>(1);
  const [resetSummary, setResetSummary] = useState<string[]>([]);
  const [approvalToken, setApprovalToken] = useState('');

  const currentConfig = selectedPageId ? configs[selectedPageId] : null;
  const currentOriginal = selectedPageId ? originalConfigs[selectedPageId] : null;
  const currentTest = selectedPageId ? tests[selectedPageId] : undefined;
  const currentDiag = selectedPageId ? diagnostics[selectedPageId] : undefined;

  const compatibility = useMemo(() => {
    if (!selectedPageId || !currentConfig) return { uyumsuzlar: [], eksikSiniflar: [], hasHardWarning: false, hasSoftWarning: false };
    return evaluateCompatibility(selectedPageId, currentConfig, workers);
  }, [selectedPageId, currentConfig, workers]);

  const selectedCount = useMemo(() => {
    if (!currentConfig) return 0;
    return CLASS_IDS.reduce((sum, sinif) => sum + (currentConfig.secilenWorkerlar[sinif]?.length || 0), 0);
  }, [currentConfig]);

  const boot = async () => {
    try {
      setLoading((p) => ({ ...p, load: true }));
      const data = await safeJson<any>('/api/admin/workers-config');

      if (data?.configs) {
        setConfigs({ ...deepClone(DEFAULT_CONFIGS), ...data.configs });
        setOriginalConfigs({ ...deepClone(DEFAULT_CONFIGS), ...data.configs });
      }

      if (data?.workers) {
        setWorkers(data.workers);
      }
    } catch {
      // local fallback
    } finally {
      setLoading((p) => ({ ...p, load: false }));
    }
  };

  useEffect(() => {
    boot();
  }, []);

  useEffect(() => {
    if (!selectedPageId) return;

    const loadDiag = async () => {
      try {
        setLoading((p) => ({ ...p, diagnostics: true }));
        const data = await safeJson<Diagnostics>(`/api/admin/workers/diagnostics?pageId=${encodeURIComponent(selectedPageId)}`);
        setDiagnostics((prev) => ({ ...prev, [selectedPageId]: data }));
      } catch {
        setDiagnostics((prev) => ({
          ...prev,
          [selectedPageId]: {
            sessionStatus: 'Bilinmiyor',
            lastTestStatus: 'Bilinmiyor',
            reservationCount: '-',
            adminCostCount: '-',
          },
        }));
      } finally {
        setLoading((p) => ({ ...p, diagnostics: false }));
      }
    };

    loadDiag();
  }, [selectedPageId]);

  const patchConfig = (patch: Partial<PageConfig>) => {
    if (!selectedPageId) return;
    setConfigs((prev) => ({
      ...prev,
      [selectedPageId]: {
        ...prev[selectedPageId],
        ...patch,
      },
    }));
  };

  const toggleWorker = (sinif: WorkerClassId, workerId: string) => {
    if (!selectedPageId || !currentConfig) return;
    const selected = currentConfig.secilenWorkerlar[sinif] || [];
    const exists = selected.includes(workerId);
    const next = exists ? selected.filter((x) => x !== workerId) : [...selected, workerId];

    patchConfig({
      secilenWorkerlar: {
        ...currentConfig.secilenWorkerlar,
        [sinif]: next,
      },
    });
  };

  const openAddWorker = (sinif: WorkerClassId) => {
    if (!selectedPageId) return;
    setAddDraft({
      sinif,
      ad: '',
      url: '',
      aciklama: '',
      gorevler: ['', '', '', '', ''],
      destekledigiSayfalar: [selectedPageId],
      varsayilanYap: false,
      hemenSec: true,
    });
    setAddOpen(true);
  };

  const submitAddWorker = () => {
    if (!selectedPageId) return;
    if (!addDraft.ad.trim()) return toast.error('Worker adı gerekli.');
    if (!addDraft.aciklama.trim()) return toast.error('Worker açıklaması gerekli.');
    if (!isHttpsUrl(addDraft.url)) return toast.error('Geçerli https adresi girmeniz gerekiyor.');
    if (addDraft.destekledigiSayfalar.length === 0) return toast.error('En az bir desteklenen sayfa seçmeniz gerekiyor.');
    if (addDraft.gorevler.some((g) => !g.trim())) return toast.error('5 görevin tamamını doldurmanız gerekiyor.');

    const id = createUniqueWorkerId(workers, addDraft.sinif, addDraft.ad);
    const newWorker: WorkerItem = {
      id,
      ad: addDraft.ad.trim(),
      url: addDraft.url.trim(),
      aciklama: addDraft.aciklama.trim(),
      gorevler: addDraft.gorevler.map((g) => g.trim().toUpperCase()) as [string, string, string, string, string],
      sinif: addDraft.sinif,
      destekledigiSayfalar: addDraft.destekledigiSayfalar,
      varsayilanSayfalar: addDraft.varsayilanYap ? [selectedPageId] : [],
      durum: 'Bilinmiyor',
      sonTestSonucu: 'Henüz test edilmedi',
    };

    setWorkers((prev) => ({
      ...prev,
      [addDraft.sinif]: [...prev[addDraft.sinif], newWorker],
    }));

    if (addDraft.hemenSec && currentConfig) {
      const selected = currentConfig.secilenWorkerlar[addDraft.sinif] || [];
      patchConfig({
        secilenWorkerlar: {
          ...currentConfig.secilenWorkerlar,
          [addDraft.sinif]: [...selected, newWorker.id],
        },
      });
    }

    setAddOpen(false);
    toast.success('Yeni worker eklendi.');
  };

  const openEditWorker = (worker: WorkerItem) => {
    setEditingWorker(worker);
    setEditOpen(true);
  };

  const saveEditedWorker = (edited: WorkerItem, varsayilan: boolean) => {
    if (!selectedPageId) return;
    if (!edited.ad.trim()) return toast.error('Worker adı gerekli.');
    if (!edited.aciklama.trim()) return toast.error('Açıklama gerekli.');
    if (!isHttpsUrl(edited.url)) return toast.error('Geçerli https adresi girmeniz gerekiyor.');
    if (edited.destekledigiSayfalar.length === 0) return toast.error('En az bir desteklenen sayfa seçmeniz gerekiyor.');
    if (edited.gorevler.some((g) => !g.trim())) return toast.error('5 görevin tamamını doldurmanız gerekiyor.');

    const nextEdited = {
      ...edited,
      gorevler: edited.gorevler.map((g) => g.trim().toUpperCase()) as [string, string, string, string, string],
      varsayilanSayfalar: varsayilan
        ? Array.from(new Set([...(edited.varsayilanSayfalar || []).filter((x) => x !== selectedPageId), selectedPageId]))
        : (edited.varsayilanSayfalar || []).filter((x) => x !== selectedPageId),
    };

    setWorkers((prev) => ({
      ...prev,
      [edited.sinif]: prev[edited.sinif].map((w) => (w.id === edited.id ? nextEdited : w)),
    }));

    setEditOpen(false);
    setEditingWorker(null);
    toast.success('Worker güncellendi.');
  };

  const deleteWorker = (worker: WorkerItem) => {
    if (!selectedPageId || !currentConfig) return;

    setWorkers((prev) => ({
      ...prev,
      [worker.sinif]: prev[worker.sinif].filter((w) => w.id !== worker.id),
    }));

    patchConfig({
      secilenWorkerlar: {
        ...currentConfig.secilenWorkerlar,
        [worker.sinif]: (currentConfig.secilenWorkerlar[worker.sinif] || []).filter((id) => id !== worker.id),
      },
    });

    setEditOpen(false);
    setEditingWorker(null);
    toast.success('Worker silindi.');
  };

  const validateBeforeSave = (force = false) => {
    if (!selectedPageId || !currentConfig) return 'Önce bir sayfa seçmeniz gerekiyor.';
    if (currentConfig.customModelUrl && !isHttpsUrl(currentConfig.customModelUrl)) return 'Özel model adresi için geçerli https adresi girmeniz gerekiyor.';
    if (currentConfig.rawCodeUrl && !isHttpsUrl(currentConfig.rawCodeUrl)) return 'Raw bağlantısı için geçerli https adresi girmeniz gerekiyor.';
    if (currentConfig.editCodeUrl && !isHttpsUrl(currentConfig.editCodeUrl)) return 'Düzenleme bağlantısı için geçerli https adresi girmeniz gerekiyor.';
    if (compatibility.hasHardWarning && !force && !currentConfig.forceKaydetAcik) {
      return 'Uyumsuz worker seçimi var. İstersen force kaydet kullanabilirsin.';
    }
    return '';
  };

  const saveConfig = async (force = false) => {
    if (!selectedPageId || !currentConfig || !currentOriginal) return;

    const err = validateBeforeSave(force);
    if (err) {
      setErrorCard({
        title: 'Kaydetmeden önce düzeltmeniz gereken bir durum var.',
        detail: err,
        action: 'Uyarıyı düzeltin ya da bilinçli olarak force kaydet kullanın.',
      });
      return toast.error(err);
    }

    const actionKey = force ? 'forceSave' : 'save';

    try {
      setLoading((p) => ({ ...p, [actionKey]: true }));
      setErrorCard(null);

      const finalConfig = { ...currentConfig, forceKaydetAcik: force || currentConfig.forceKaydetAcik };

      await safeJson('/api/admin/workers-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          version: 'workers-center-v3',
          pageId: selectedPageId,
          forceSave: force,
          configs: {
            ...configs,
            [selectedPageId]: finalConfig,
          },
          workers,
        }),
      });

      const diff = computeDiff(currentOriginal, finalConfig);

      setConfigs((prev) => ({
        ...prev,
        [selectedPageId]: {
          ...finalConfig,
          updatedAt: new Date().toISOString(),
          updatedBy: 'salih celebi',
          lastSavedDiff: diff,
        },
      }));

      setOriginalConfigs((prev) => ({
        ...prev,
        [selectedPageId]: {
          ...finalConfig,
          updatedAt: new Date().toISOString(),
          updatedBy: 'salih celebi',
          lastSavedDiff: diff,
        },
      }));

      toast.success(force ? 'Force kayıt tamamlandı.' : 'Ayarlar kaydedildi.');
    } catch (e: any) {
      setErrorCard({
        title: force ? 'Force kayıt başarısız oldu.' : 'Kaydetme başarısız oldu.',
        detail: e.message || 'Beklenmeyen bir hata oluştu.',
        action: 'Bağlantıları ve backend endpointini kontrol edin.',
      });
      toast.error(e.message || 'Kaydetme başarısız.');
    } finally {
      setLoading((p) => ({ ...p, [actionKey]: false }));
    }
  };

  const runTest = async () => {
    if (!selectedPageId || !currentConfig) return;

    try {
      setLoading((p) => ({ ...p, test: true }));
      const data = await safeJson<TestResult>('/api/admin/workers/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pageId: selectedPageId,
          config: currentConfig,
          workers,
        }),
      });

      setTests((prev) => ({ ...prev, [selectedPageId]: data }));
      toast.success(data.healthy ? 'Test başarılı.' : 'Test tamamlandı, düzeltmen gereken noktalar var.');
    } catch (e: any) {
      setTests((prev) => ({
        ...prev,
        [selectedPageId]: {
          pageId: selectedPageId,
          checkedAt: new Date().toISOString(),
          healthy: false,
          summary: 'Test tamamlanamadı.',
          suggestion: 'Worker URL ve test endpointini kontrol et.',
          checks: [
            { label: 'Worker URL erişilebilir mi', ok: false, detail: 'Kontrol yapılamadı.' },
            { label: 'Model URL erişilebilir mi', ok: false, detail: 'Kontrol yapılamadı.' },
            { label: 'JSON dönüyor mu', ok: false, detail: 'Kontrol yapılamadı.' },
            { label: 'HTML fallback var mı', ok: false, detail: 'Kontrol yapılamadı.' },
          ],
        },
      }));
      toast.error(e.message || 'Test başarısız.');
    } finally {
      setLoading((p) => ({ ...p, test: false }));
    }
  };

  const refreshDiagnostics = async () => {
    if (!selectedPageId) return;
    try {
      setLoading((p) => ({ ...p, diagnostics: true }));
      const data = await safeJson<Diagnostics>(`/api/admin/workers/diagnostics?pageId=${encodeURIComponent(selectedPageId)}`);
      setDiagnostics((prev) => ({ ...prev, [selectedPageId]: data }));
      toast.success('Tanı bilgileri güncellendi.');
    } catch (e: any) {
      toast.error(e.message || 'Tanı alınamadı.');
    } finally {
      setLoading((p) => ({ ...p, diagnostics: false }));
    }
  };

  const loadDefaultsForSelectedPage = () => {
    if (!selectedPageId) return;
    setConfigs((prev) => ({ ...prev, [selectedPageId]: deepClone(DEFAULT_CONFIGS[selectedPageId]) }));
    toast.success(`${selectedPageId} için varsayılan ayarlar yüklendi.`);
  };

  const openReset = () => {
    if (!selectedPageId) return;
    setResetOpen(true);
    setResetStep(1);
    setResetSummary([]);
    setApprovalToken('');
  };

  const startReset = async () => {
    if (!selectedPageId) return;
    try {
      setLoading((p) => ({ ...p, resetStart: true }));
      const data = await safeJson<{ approvalToken: string; summary?: string[] }>('/api/admin/workers/reset/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: selectedPageId }),
      });

      setApprovalToken(data.approvalToken);
      setResetSummary(
        data.summary || [
          '5 sınıftaki worker seçimleri varsayılana dönecek.',
          'Özel model adresi varsayılana dönecek.',
          'Raw bağlantısı varsayılana dönecek.',
          'Düzenleme bağlantısı varsayılana dönecek.',
          'Force kaydet tercihi kapanacak.',
        ]
      );
      setResetStep(2);
    } catch (e: any) {
      toast.error(e.message || 'Sıfırlama başlatılamadı.');
    } finally {
      setLoading((p) => ({ ...p, resetStart: false }));
    }
  };

  const confirmReset = async () => {
    if (!selectedPageId || !approvalToken) return;
    try {
      setLoading((p) => ({ ...p, resetConfirm: true }));
      await safeJson('/api/admin/workers/reset/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageId: selectedPageId, approvalToken }),
      });

      setConfigs((prev) => ({
        ...prev,
        [selectedPageId]: {
          ...deepClone(DEFAULT_CONFIGS[selectedPageId]),
          updatedAt: new Date().toISOString(),
          updatedBy: 'salih celebi',
        },
      }));

      setOriginalConfigs((prev) => ({
        ...prev,
        [selectedPageId]: {
          ...deepClone(DEFAULT_CONFIGS[selectedPageId]),
          updatedAt: new Date().toISOString(),
          updatedBy: 'salih celebi',
        },
      }));

      setResetStep(3);
      setTimeout(() => {
        setResetOpen(false);
        setResetStep(1);
      }, 700);
      toast.success('Sayfa varsayılan ayarlarına döndü.');
    } catch (e: any) {
      toast.error(e.message || 'Sıfırlama başarısız.');
    } finally {
      setLoading((p) => ({ ...p, resetConfirm: false }));
    }
  };

  return (
    <div className="min-h-screen bg-zinc-100 text-zinc-900">
      <header className="border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto max-w-[1700px] px-4 py-5 md:px-6">
          <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Workers Yönetimi</h1>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-zinc-600">
                Önce soldan bir sayfa seçilir. Sonra yalnızca o sayfanın ilgili workerları görünür. Acemi kullanıcı isterse yeni worker ekler,
                mevcut workerın en küçük detayını bile düzenler, test eder, kaydeder veya force kaydeder.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 md:w-[480px]">
              <StatCard label="Bu ekran ne yapar?" value="Sayfa seç → worker yönet" />
              <StatCard label="Acemi dostu mu?" value="Evet, önce ilgili workerlar görünür" />
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1700px] gap-6 px-4 py-6 md:px-6">
        <aside className="sticky top-6 h-[calc(100vh-8rem)] w-full max-w-[320px] self-start rounded-3xl border border-zinc-200 bg-white p-4 shadow-sm">
          <div className="border-b border-zinc-100 pb-4">
            <div className="text-sm font-semibold text-zinc-950">Sayfalar</div>
            <div className="mt-1 text-sm text-zinc-500">Önce buradan bir sayfa seç. Ayarlar başta görünmez.</div>
          </div>

          <div className="mt-4 space-y-3">
            {PAGE_IDS.map((pageId) => {
              const cfg = configs[pageId];
              const selected = CLASS_IDS.reduce((sum, sinif) => sum + (cfg.secilenWorkerlar[sinif]?.length || 0), 0);
              const active = selectedPageId === pageId;

              return (
                <button
                  key={pageId}
                  type="button"
                  onClick={() => {
                    setSelectedPageId(pageId);
                    setErrorCard(null);
                    setShowOthers({ api: false, model: false, orchestrator: false, job: false, test: false });
                  }}
                  className={cx(
                    'w-full rounded-2xl border p-4 text-left transition',
                    active ? 'border-black bg-zinc-950 text-white' : 'border-zinc-200 bg-white hover:border-zinc-300'
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className={cx('text-sm font-semibold', active ? 'text-white' : 'text-zinc-950')}>{pageId}</div>
                      <div className={cx('mt-1 text-xs', active ? 'text-zinc-300' : 'text-zinc-500')}>{SAYFA_META[pageId].kisa}</div>
                    </div>
                    <Badge tone={active ? 'success' : 'neutral'}>{SAYFA_META[pageId].ozellik}</Badge>
                  </div>
                  <div className={cx('mt-3 text-xs', active ? 'text-zinc-300' : 'text-zinc-500')}>5 sınıf • {selected} seçim</div>
                </button>
              );
            })}
          </div>
        </aside>

        <main className="min-w-0 flex-1">
          {!selectedPageId || !currentConfig ? (
            <SectionCard title="Önce soldan bir sayfa seç" subtitle="Ayarlar hemen görünmez. Bu panel sayfa seçildikten sonra açılır.">
              <div className="grid gap-4 md:grid-cols-3">
                <StatCard label="Adım 1" value="Sayfa seç" hint="image.tsx veya başka bir sayfa seç." />
                <StatCard label="Adım 2" value="İlgili workerları gör" hint="Önce sadece ilgili workerlar görünür." />
                <StatCard label="Adım 3" value="İstersen diğerlerini aç" hint="DİĞER WORKERLAR butonu ile alakasızları da görebilirsin." />
              </div>
            </SectionCard>
          ) : (
            <div className="space-y-6">
              <SectionCard
                title={`${selectedPageId} — ${SAYFA_META[selectedPageId].ozellik}`}
                subtitle={currentConfig.aciklama}
                right={
                  <div className="flex flex-wrap gap-2">
                    <Badge tone="neutral">{selectedCount} worker seçili</Badge>
                    <Badge tone={compatibility.hasHardWarning ? 'warn' : 'success'}>
                      {compatibility.hasHardWarning ? 'Uyum uyarısı var' : 'Uyum iyi görünüyor'}
                    </Badge>
                  </div>
                }
              >
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <StatCard label="Seçili sayfa" value={selectedPageId} hint="Ayarlar sadece bu sayfa için açık." />
                  <StatCard label="Force kayıt" value={currentConfig.forceKaydetAcik ? 'Açık' : 'Kapalı'} hint="Uyumsuz worker seçimi varsa yine de kaydetmeyi açar." />
                  <StatCard label="Son değiştiren" value={currentConfig.updatedBy || '-'} hint={`Son değişiklik: ${formatDate(currentConfig.updatedAt)}`} />
                  <StatCard label="Son test" value={currentTest?.healthy ? 'Başarılı' : currentTest ? 'Başarısız' : 'Henüz çalıştırılmadı'} hint={currentTest ? formatDate(currentTest.checkedAt) : 'Test Et düğmesi ile çalıştırılır.'} />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button onClick={runTest} disabled={loading.test} className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white">
                    {loading.test ? 'Test ediliyor...' : 'Test Et'}
                  </button>
                  <button
                    onClick={refreshDiagnostics}
                    disabled={loading.diagnostics}
                    className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900"
                  >
                    {loading.diagnostics ? 'Tanı yenileniyor...' : 'Tanı'}
                  </button>
                  <button onClick={() => saveConfig(false)} disabled={loading.save} className="rounded-xl bg-black px-4 py-2 text-sm font-medium text-white">
                    {loading.save ? 'Kaydediliyor...' : 'Kaydet'}
                  </button>
                  <button
                    onClick={() => saveConfig(true)}
                    disabled={loading.forceSave}
                    className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white"
                  >
                    {loading.forceSave ? 'Force kaydediliyor...' : 'Force ile Kaydet'}
                  </button>
                  <button onClick={loadDefaultsForSelectedPage} className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900">
                    Varsayılanı Yükle
                  </button>
                  <button onClick={openReset} className="rounded-xl bg-red-50 px-4 py-2 text-sm font-medium text-red-700">
                    Güvenli Sıfırla
                  </button>
                </div>
              </SectionCard>

              {errorCard ? (
                <SectionCard title={errorCard.title} subtitle={errorCard.action} className="border-red-200 bg-red-50">
                  <div className="text-sm text-zinc-700">{errorCard.detail}</div>
                </SectionCard>
              ) : null}

              <SectionCard title="Canlı Önizleme" subtitle="Bu kartta sayfanın şu anda hangi workerlarla çalışacağı tek bakışta görünür.">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {CLASS_IDS.map((sinif) => (
                    <StatCard
                      key={sinif}
                      label={SINIF_META[sinif].baslik}
                      value={(currentConfig.secilenWorkerlar[sinif] || []).join(', ') || '-'}
                      hint={SINIF_META[sinif].alt}
                    />
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Varsayılan Workerlar" subtitle="Bu sayfa için sistemin önerdiği varsayılan seçimler.">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
                  {CLASS_IDS.map((sinif) => (
                    <StatCard
                      key={sinif}
                      label={SINIF_META[sinif].baslik}
                      value={getDefaultWorkersForPage(selectedPageId, workers, sinif).map((w) => w.ad).join(', ') || '-'}
                    />
                  ))}
                </div>
              </SectionCard>

              {CLASS_IDS.map((sinif) => (
                <div key={sinif}>
                  <WorkerClassSection
                    sinif={sinif}
                    pageId={selectedPageId}
                    workers={workers}
                    selectedIds={currentConfig.secilenWorkerlar[sinif] || []}
                    showOthers={showOthers[sinif]}
                    setShowOthers={(v) => setShowOthers((prev) => ({ ...prev, [sinif]: v }))}
                    onToggle={(workerId) => toggleWorker(sinif, workerId)}
                    onOpenAdd={openAddWorker}
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {[...getPageRelevantWorkers(selectedPageId, workers, sinif), ...(showOthers[sinif] ? getPageOtherWorkers(selectedPageId, workers, sinif) : [])].map((worker) => (
                      <button
                        key={`${sinif}-${worker.id}-edit`}
                        type="button"
                        onClick={() => openEditWorker(worker)}
                        className="rounded-lg bg-zinc-100 px-3 py-1.5 text-xs font-medium text-zinc-800"
                      >
                        {worker.ad} düzenle
                      </button>
                    ))}
                  </div>
                </div>
              ))}

              <SectionCard
                title="Sayfa Uyum Uzmanı"
                subtitle="Yanlış ve saçma worker seçilirse uyarı verir. İstersen force ile yine de kayıt yapabilirsin."
                right={
                  <label className="flex items-center gap-2 rounded-xl bg-zinc-100 px-3 py-2 text-sm">
                    <input type="checkbox" checked={currentConfig.forceKaydetAcik} onChange={(e) => patchConfig({ forceKaydetAcik: e.target.checked })} />
                    Force kaydetmeye izin ver
                  </label>
                }
              >
                <div className="grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-sm font-semibold text-zinc-950">Uyumluluk özeti</div>
                    <div className="mt-3 space-y-2 text-sm text-zinc-700">
                      <div>
                        <strong>Uyumsuz worker:</strong> {compatibility.uyumsuzlar.length > 0 ? compatibility.uyumsuzlar.length : 'Yok'}
                      </div>
                      <div>
                        <strong>Eksik sınıf:</strong>{' '}
                        {compatibility.eksikSiniflar.length > 0 ? compatibility.eksikSiniflar.map((s) => SINIF_META[s].baslik).join(', ') : 'Yok'}
                      </div>
                    </div>
                  </div>

                  <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="text-sm font-semibold text-zinc-950">Ne yapmalısın?</div>
                    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-zinc-700">
                      {compatibility.uyumsuzlar.length > 0 ? (
                        compatibility.uyumsuzlar.map((u) => (
                          <li key={`${u.sinif}-${u.workerId}`}>
                            <strong>{u.worker?.ad || u.workerId}</strong> worker’ı bu sayfaya doğal uyumlu görünmüyor.
                          </li>
                        ))
                      ) : (
                        <li>Şu anda kritik uyum uyarısı görünmüyor.</li>
                      )}
                    </ul>

                    <div className="mt-4 flex flex-wrap gap-2">
                      <button
                        onClick={() => saveConfig(true)}
                        disabled={loading.forceSave}
                        className="rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white"
                      >
                        {loading.forceSave ? 'Force kaydediliyor...' : 'Force ile Kaydet'}
                      </button>
                      <button onClick={loadDefaultsForSelectedPage} className="rounded-xl bg-zinc-100 px-4 py-2 text-sm font-medium text-zinc-900">
                        Önerilen varsayılana dön
                      </button>
                    </div>
                  </div>
                </div>
              </SectionCard>

              <SectionCard title="Test Sonuç Paneli" subtitle="Test sonucu toastta kaybolmaz. Burada kalıcı görünür.">
                {!currentTest ? (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">
                    Bu sayfa için test henüz çalıştırılmadı. Test Et düğmesine basınca worker URL, model URL, JSON ve HTML fallback kontrol edilir.
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone={currentTest.healthy ? 'success' : 'danger'}>{currentTest.healthy ? 'Başarılı' : 'Başarısız'}</Badge>
                      <span className="text-sm text-zinc-500">Son kontrol: {formatDate(currentTest.checkedAt)}</span>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                      {currentTest.checks.map((c) => (
                        <StatCard key={c.label} label={c.label} value={c.ok ? 'Evet' : 'Hayır'} hint={c.detail} />
                      ))}
                    </div>
                    <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                      <div className="text-sm font-semibold text-zinc-950">Türkçe açıklama</div>
                      <div className="mt-2 text-sm text-zinc-700">{currentTest.summary}</div>
                      <div className="mt-4 text-sm font-semibold text-zinc-950">Ne yapmalıyım?</div>
                      <div className="mt-2 text-sm text-zinc-700">{currentTest.suggestion}</div>
                    </div>
                  </div>
                )}
              </SectionCard>

              <SectionCard title="Tanı Özeti" subtitle="Ham log yerine kullanıcı dostu özet gösterilir.">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
                  <StatCard label="Servis oturumu" value={currentDiag?.sessionStatus || 'Bilinmiyor'} />
                  <StatCard label="Son test" value={currentDiag?.lastTestStatus || 'Bilinmiyor'} />
                  <StatCard label="Rezervasyon sayısı" value={currentDiag?.reservationCount ?? '-'} />
                  <StatCard label="Admin maliyet kaydı" value={currentDiag?.adminCostCount ?? '-'} />
                  <StatCard label="Son güncelleme" value={formatDate(currentDiag?.updatedAt)} />
                  <StatCard label="Son kaydeden kullanıcı" value={currentDiag?.updatedBy || '-'} />
                </div>
              </SectionCard>

              <SectionCard title="Gelişmiş Bağlantılar" subtitle="İstersen bunları da revize edip düzenleyebilirsin.">
                <div className="grid gap-4 xl:grid-cols-3">
                  <LinkField label="Özel Model Adresi" value={currentConfig.customModelUrl} onChange={(v) => patchConfig({ customModelUrl: v })} placeholder="https://..." />
                  <LinkField label="Raw ( kodun düz metin hali )" value={currentConfig.rawCodeUrl} onChange={(v) => patchConfig({ rawCodeUrl: v })} placeholder="https://..." />
                  <LinkField label="Düzenleme bağlantısı" value={currentConfig.editCodeUrl} onChange={(v) => patchConfig({ editCodeUrl: v })} placeholder="https://..." />
                </div>
              </SectionCard>

              <SectionCard title="Son kayıt özeti" subtitle="En son işlemde neyin değiştiği burada görünür.">
                {currentConfig.lastSavedDiff && currentConfig.lastSavedDiff.length > 0 ? (
                  <div className="space-y-3">
                    {currentConfig.lastSavedDiff.map((item, i) => (
                      <div key={`${item.alan}-${i}`} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                        <div className="text-sm font-semibold text-zinc-950">{item.alan}</div>
                        <div className="mt-3 grid gap-2 md:grid-cols-2">
                          <div className="text-sm text-zinc-700">
                            <span className="font-medium text-zinc-900">Önceki değer:</span> {item.once || '-'}
                          </div>
                          <div className="text-sm text-zinc-700">
                            <span className="font-medium text-zinc-900">Yeni değer:</span> {item.sonra || '-'}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-4 text-sm text-zinc-600">Henüz kayıt özeti yok.</div>
                )}
              </SectionCard>

              <SectionCard title="Nasıl çalışır?" subtitle="Kullanım kılavuzu doğrudan sayfanın içindedir.">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-7">
                  {[
                    'Sayfa seç',
                    'İlgili workerları gör',
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
                </div>
              </SectionCard>
            </div>
          )}
        </main>
      </div>

      <footer className="border-t border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-[1700px] flex-col gap-2 px-4 py-4 text-sm text-zinc-600 md:flex-row md:items-center md:justify-between md:px-6">
          <div>
            {selectedPageId ? (
              <>
                Son sayfa: <strong className="text-zinc-900">{selectedPageId}</strong>
              </>
            ) : (
              'Henüz sayfa seçilmedi.'
            )}
          </div>
          <div>
            Son değiştiren: <strong className="text-zinc-900">{selectedPageId ? configs[selectedPageId].updatedBy || '-' : '-'}</strong>
          </div>
          <div>
            Son test:{' '}
            <strong className="text-zinc-900">{selectedPageId && tests[selectedPageId] ? (tests[selectedPageId]?.healthy ? 'Başarılı' : 'Başarısız') : '-'}</strong>
          </div>
        </div>
      </footer>

      <AddWorkerModal open={addOpen} draft={addDraft} setDraft={setAddDraft} currentPageId={selectedPageId} onClose={() => setAddOpen(false)} onSubmit={submitAddWorker} />

      <EditWorkerModal
        open={editOpen}
        worker={editingWorker}
        currentPageId={selectedPageId}
        onClose={() => {
          setEditOpen(false);
          setEditingWorker(null);
        }}
        onSave={saveEditedWorker}
        onDelete={deleteWorker}
      />

      <ResetDialog
        open={resetOpen}
        pageId={selectedPageId}
        step={resetStep}
        summary={resetSummary}
        loading={loading.resetStart || loading.resetConfirm}
        onClose={() => setResetOpen(false)}
        onStart={startReset}
        onConfirm={confirmReset}
      />
    </div>
  );
}
