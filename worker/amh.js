var DOSYA_ADI = 'https://amh.puter.work';
var SURUM = '2026-03-18.1';
var DEPO_ONEKI = 'aaoit';
var VARSAYILAN_TIMEOUT_MS = {
  CHAT: 45000,
  IMG: 60000,
  VIDEO: 120000,
  TTS: 45000,
  OCR: 45000,
  PDF: 90000,
  DEEPSEARCH: 120000,
  TESHIS: 20000
};

var HIZMET_KABILIYETLERI = {
  CHAT: ['ai.chat'],
  IMG: ['ai.txt2img'],
  VIDEO: ['ai.txt2vid'],
  TTS: ['ai.txt2speech'],
  OCR: ['ai.img2txt'],
  PDF: [],
  DEEPSEARCH: ['ai.chat']
};

var SINIF_HARITASI = {
  1: 'Genel Çekirdek',
  2: 'Genel Çekirdek',
  3: 'Genel Çekirdek',
  4: 'Genel Çekirdek',
  5: 'Genel Çekirdek',
  6: 'Sınıf 1 API Çağıran İşçiler',
  7: 'Sınıf 1 API Çağıran İşçiler',
  8: 'Sınıf 1 API Çağıran İşçiler',
  9: 'Sınıf 1 API Çağıran İşçiler',
  10: 'Sınıf 1 API Çağıran İşçiler',
  11: 'Sınıf 1 API Çağıran İşçiler',
  12: 'Sınıf 1 API Çağıran İşçiler',
  13: 'Sınıf 1 API Çağıran İşçiler',
  14: 'Sınıf 1 API Çağıran İşçiler',
  15: 'Sınıf 1 API Çağıran İşçiler',
  16: 'Sınıf 3 Orkestra Şefi',
  17: 'Sınıf 3 Orkestra Şefi',
  18: 'Sınıf 3 Orkestra Şefi',
  19: 'Sınıf 3 Orkestra Şefi',
  20: 'Sınıf 3 Orkestra Şefi',
  21: 'Sınıf 3 Orkestra Şefi',
  22: 'Sınıf 3 Orkestra Şefi',
  23: 'Sınıf 3 Orkestra Şefi',
  24: 'Sınıf 3 Orkestra Şefi',
  25: 'Sınıf 4 İş Takip Uzmanı',
  26: 'Sınıf 4 İş Takip Uzmanı',
  27: 'Sınıf 4 İş Takip Uzmanı',
  28: 'Sınıf 4 İş Takip Uzmanı',
  29: 'Sınıf 4 İş Takip Uzmanı',
  30: 'Sınıf 4 İş Takip Uzmanı',
  31: 'Sınıf 5 Test Dedektifi',
  32: 'Sınıf 5 Test Dedektifi',
  33: 'Sınıf 5 Test Dedektifi',
  34: 'Sınıf 5 Test Dedektifi',
  35: 'Sınıf 5 Test Dedektifi',
  36: 'Sınıf 5 Test Dedektifi',
  37: 'Sınıf 5 Test Dedektifi',
  38: 'Sınıf 5 Test Dedektifi',
  39: 'Destekleyici Gelişmiş Fonksiyonlar',
  40: 'Destekleyici Gelişmiş Fonksiyonlar',
  41: 'Destekleyici Gelişmiş Fonksiyonlar',
  42: 'Destekleyici Gelişmiş Fonksiyonlar',
  43: 'Destekleyici Gelişmiş Fonksiyonlar',
  44: 'Destekleyici Gelişmiş Fonksiyonlar',
  45: 'Destekleyici Gelişmiş Fonksiyonlar',
  46: 'Destekleyici Gelişmiş Fonksiyonlar',
  47: 'Destekleyici Gelişmiş Fonksiyonlar',
  48: 'AIAI Kök Endpoint Fonksiyonları',
  49: 'AIAI Kök Endpoint Fonksiyonları',
  50: 'AIAI Kök Endpoint Fonksiyonları'
};

function corsBasliklariniHazirla(request) {
  var origin = '';

  try {
    origin = request && request.headers ? request.headers.get('origin') || '' : '';
  } catch (hata) {
    origin = '';
  }

  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Istemci-Kimligi, X-Yonetici-Anahtari, X-Korelasyon-Anahtari',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': origin ? 'true' : 'false',
    'Vary': 'Origin'
  };
}

function jsonBasliklariniHazirla(request, ekBasliklar) {
  var basliklar = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  };

  basliklar = Object.assign(basliklar, corsBasliklariniHazirla(request));

  if (ekBasliklar && typeof ekBasliklar === 'object') {
    Object.assign(basliklar, ekBasliklar);
  }

  return basliklar;
}

function yanitDondur(request, govde, durumKodu, ekBasliklar) {
  return new Response(JSON.stringify(govde), {
    status: durumKodu || 200,
    headers: jsonBasliklariniHazirla(request, ekBasliklar)
  });
}

function basariCevabiUret(request, veri, meta, durumKodu) {
  return yanitDondur(request, standartCevapGovdesiOlustur(true, veri, null, meta), durumKodu || 200);
}

function hataCevabiUret(request, hata, meta, durumKodu) {
  return yanitDondur(request, standartCevapGovdesiOlustur(false, null, hata, meta), durumKodu || 500);
}

function secenekIsteginiYanitla(request) {
  return new Response(null, {
    status: 204,
    headers: corsBasliklariniHazirla(request)
  });
}

async function govdeyiCozumle(request) {
  var icerikTuru = '';

  try {
    icerikTuru = String(request.headers.get('content-type') || '').toLowerCase();
  } catch (hata) {
    icerikTuru = '';
  }

  if (icerikTuru.indexOf('application/json') !== -1) {
    try {
      return await request.json();
    } catch (hata1) {
      return null;
    }
  }

  if (icerikTuru.indexOf('application/x-www-form-urlencoded') !== -1 || icerikTuru.indexOf('multipart/form-data') !== -1) {
    try {
      var form = await request.formData();
      var sonuc = {};
      form.forEach(function (deger, anahtar) {
        sonuc[anahtar] = deger;
      });
      return sonuc;
    } catch (hata2) {
      return null;
    }
  }

  return {};
}

function nesneMi(deger) {
  return !!deger && typeof deger === 'object' && !Array.isArray(deger);
}

function diziMi(deger) {
  return Array.isArray(deger);
}

function metniKirp(metin, sinir) {
  var temiz = String(metin == null ? '' : metin);
  if (!sinir || temiz.length <= sinir) {
    return temiz;
  }
  return temiz.slice(0, sinir);
}

function sayiDonustur(deger, varsayilanDeger, altSinir, ustSinir) {
  var sayi = Number(deger);

  if (!isFinite(sayi)) {
    sayi = varsayilanDeger;
  }

  if (typeof altSinir === 'number' && sayi < altSinir) {
    sayi = altSinir;
  }

  if (typeof ustSinir === 'number' && sayi > ustSinir) {
    sayi = ustSinir;
  }

  return sayi;
}

function metniDiziyeCevir(deger) {
  if (Array.isArray(deger)) {
    return deger;
  }

  if (typeof deger === 'string' && deger.trim()) {
    return [deger];
  }

  return [];
}

function kopyaOlustur(deger) {
  try {
    return JSON.parse(JSON.stringify(deger == null ? null : deger));
  } catch (hata) {
    return deger;
  }
}

function simdiIso() {
  return new Date().toISOString();
}

function sayiDamgasiAl() {
  return Date.now();
}

function anahtarBirlestir() {
  return Array.prototype.slice.call(arguments).map(function (parca) {
    return String(parca == null ? '' : parca).trim();
  }).filter(function (parca) {
    return !!parca;
  }).join(':');
}

function dakikaPenceresiDamgasiAl() {
  return Math.floor(Date.now() / 60000);
}

function saniyeDamgasiAl() {
  return Math.floor(Date.now() / 1000);
}

function calisanMePuteriniAl(me) {
  if (me && me.puter) {
    return me.puter;
  }

  if (globalThis.me && globalThis.me.puter) {
    return globalThis.me.puter;
  }

  return null;
}

function guvenliLogYaz(baslik, veri) {
  try {
    console.log('[AAOIT]', baslik, veri);
  } catch (hata) {
  }
}

function depoAnahtariUret(tur, kimlik) {
  return anahtarBirlestir(DEPO_ONEKI, tur, kimlik);
}

async function depodanOku(me, anahtar, varsayilanDeger) {
  var mePuter = calisanMePuteriniAl(me);
  if (!mePuter || !mePuter.kv || typeof mePuter.kv.get !== 'function') {
    return varsayilanDeger;
  }

  try {
    var veri = await mePuter.kv.get(anahtar);
    return veri == null ? varsayilanDeger : veri;
  } catch (hata) {
    return varsayilanDeger;
  }
}

async function depoyaYaz(me, anahtar, veri, sonaErme) {
  var mePuter = calisanMePuteriniAl(me);
  if (!mePuter || !mePuter.kv || typeof mePuter.kv.set !== 'function') {
    return false;
  }

  try {
    if (sonaErme) {
      await mePuter.kv.set(anahtar, veri, sonaErme);
    } else {
      await mePuter.kv.set(anahtar, veri);
    }
    return true;
  } catch (hata) {
    return false;
  }
}

async function depodanSil(me, anahtar) {
  var mePuter = calisanMePuteriniAl(me);
  if (!mePuter || !mePuter.kv || typeof mePuter.kv.del !== 'function') {
    return false;
  }

  try {
    await mePuter.kv.del(anahtar);
    return true;
  } catch (hata) {
    return false;
  }
}

function mePuterMetodunuAl(me, yol) {
  var mePuter = calisanMePuteriniAl(me);
  var parcalar = String(yol || '').split('.');
  var nesne = mePuter;
  var i = 0;

  for (i = 0; i < parcalar.length; i += 1) {
    if (!nesne) {
      return null;
    }
    nesne = nesne[parcalar[i]];
  }

  return typeof nesne === 'function' ? nesne : null;
}

async function mePuterMetodunuCalistir(me, yol, argumanlar) {
  var mePuter = calisanMePuteriniAl(me);
  var parcalar = String(yol || '').split('.');
  var baglam = mePuter;
  var i = 0;

  for (i = 0; i < parcalar.length - 1; i += 1) {
    if (!baglam) {
      break;
    }
    baglam = baglam[parcalar[i]];
  }

  if (!baglam) {
    throw new Error('İstenen me.puter metodu bulunamadı: ' + yol);
  }

  var fonksiyon = baglam[parcalar[parcalar.length - 1]];
  if (typeof fonksiyon !== 'function') {
    throw new Error('İstenen me.puter metodu çalıştırılamıyor: ' + yol);
  }

  return await fonksiyon.apply(baglam, argumanlar || []);
}

function tahminiMaliyetHesapla(hizmetTuru, girdi, etkinAyar) {
  var tip = String(hizmetTuru || 'CHAT').toUpperCase();
  var taban = 0.0001;
  var uzunluk = 0;

  if (girdi && typeof girdi.metin === 'string') {
    uzunluk += girdi.metin.length;
  }
  if (girdi && typeof girdi.prompt === 'string') {
    uzunluk += girdi.prompt.length;
  }
  if (girdi && Array.isArray(girdi.mesajlar)) {
    girdi.mesajlar.forEach(function (mesaj) {
      if (typeof mesaj.content === 'string') {
        uzunluk += mesaj.content.length;
      } else if (Array.isArray(mesaj.content)) {
        mesaj.content.forEach(function (oge) {
          if (oge && typeof oge.text === 'string') {
            uzunluk += oge.text.length;
          }
        });
      }
    });
  }

  if (tip === 'CHAT') {
    taban = 0.000002 * Math.max(uzunluk, 50);
  } else if (tip === 'IMG') {
    taban = 0.01 * sayiDonustur(girdi && girdi.adet, 1, 1, 10);
  } else if (tip === 'VIDEO') {
    taban = 0.02 * sayiDonustur(girdi && girdi.sureSaniye, 8, 1, 120);
  } else if (tip === 'TTS') {
    taban = 0.000003 * Math.max(uzunluk, 100);
  } else if (tip === 'OCR') {
    taban = 0.002 * sayiDonustur(girdi && girdi.sayfaSayisi, 1, 1, 500);
  } else if (tip === 'PDF') {
    taban = 0.003 * sayiDonustur(girdi && girdi.sayfaSayisi, 1, 1, 500);
  } else if (tip === 'DEEPSEARCH') {
    taban = 0.004 * sayiDonustur(girdi && girdi.altSorguSiniri, 4, 1, 20);
  }

  if (etkinAyar && etkinAyar.kaliteSeviyesi === 'high') {
    taban = taban * 1.35;
  }

  return Number(taban.toFixed(6));
}

function agirlikliSkorHesapla(veri) {
  var kalite = sayiDonustur(veri && veri.kalite, 60, 0, 100);
  var hiz = sayiDonustur(veri && veri.hiz, 60, 0, 100);
  var maliyet = sayiDonustur(veri && veri.maliyet, 60, 0, 100);
  var hata = sayiDonustur(veri && veri.hata, 0, 0, 100);
  return Math.round((kalite * 0.45) + (hiz * 0.25) + ((100 - maliyet) * 0.2) + ((100 - hata) * 0.1));
}

function benzersizImzaUret(metin) {
  var kaynak = String(metin || '');
  var toplam = 0;
  var i = 0;

  for (i = 0; i < kaynak.length; i += 1) {
    toplam = (toplam + (kaynak.charCodeAt(i) * (i + 1))) % 1000000007;
  }

  return 'imza_' + toplam;
}

// [MADDE-5] standartCevapGovdesiOlustur
function standartCevapGovdesiOlustur(ok, veri, hata, meta) {
  var metaKopya = nesneMi(meta) ? kopyaOlustur(meta) : {};
  var hataGovdesi = null;

  if (hata) {
    if (typeof hata === 'string') {
      hataGovdesi = { mesaj: hata };
    } else if (nesneMi(hata)) {
      hataGovdesi = hata;
    } else {
      hataGovdesi = { mesaj: 'Beklenmeyen hata' };
    }
  }

  return {
    ok: !!ok,
    veri: veri == null ? null : veri,
    hata: hataGovdesi,
    meta: Object.assign({
      dosya: DOSYA_ADI,
      surum: SURUM,
      zamanDamgasi: simdiIso(),
      isKimligi: metaKopya.isKimligi || null,
      sureMs: metaKopya.sureMs || 0,
      maliyet: metaKopya.maliyet || 0,
      teshis: metaKopya.teshis || null
    }, metaKopya)
  };
}

// [MADDE-42] olayKimligiUret
function olayKimligiUret(onek, baglam) {
  var parcalar = [];
  var simdi = sayiDamgasiAl().toString(36);
  var rastgele = Math.random().toString(36).slice(2, 10);
  var baglamParcasi = '';

  if (baglam && typeof baglam === 'object') {
    baglamParcasi = benzersizImzaUret(JSON.stringify({
      kullaniciKimligi: baglam.kullaniciKimligi || '',
      hizmetTuru: baglam.hizmetTuru || '',
      korelasyonAnahtari: baglam.korelasyonAnahtari || '',
      isKimligi: baglam.isKimligi || ''
    })).slice(-8);
  }

  parcalar.push(String(onek || 'olay').toLowerCase());
  parcalar.push(simdi);
  parcalar.push(rastgele);
  if (baglamParcasi) {
    parcalar.push(baglamParcasi);
  }

  return parcalar.join('_');
}

// [MADDE-2] istekBaglaminiHazirla
function istekBaglaminiHazirla(istek, girdi, hizmetTuru) {
  var baslangic = sayiDamgasiAl();
  var headers = (istek && istek.headers) ? istek.headers : null;
  var korelasyonAnahtari = '';
  var kullaniciKimligi = '';
  var hizmet = String(hizmetTuru || '').toUpperCase();

  try {
    korelasyonAnahtari = headers ? (headers.get('x-korelasyon-anahtari') || headers.get('x-request-id') || '') : '';
  } catch (hata1) {
    korelasyonAnahtari = '';
  }

  if (!korelasyonAnahtari) {
    korelasyonAnahtari = olayKimligiUret('korelasyon', { hizmetTuru: hizmet });
  }

  if (girdi && typeof girdi.kullaniciKimligi === 'string' && girdi.kullaniciKimligi.trim()) {
    kullaniciKimligi = girdi.kullaniciKimligi.trim();
  }

  try {
    if (!kullaniciKimligi && headers) {
      kullaniciKimligi = headers.get('x-istemci-kimligi') || '';
    }
  } catch (hata2) {
    kullaniciKimligi = '';
  }

  if (!kullaniciKimligi) {
    kullaniciKimligi = 'anonim';
  }

  var isKimligi = olayKimligiUret('is', {
    kullaniciKimligi: kullaniciKimligi,
    hizmetTuru: hizmet,
    korelasyonAnahtari: korelasyonAnahtari
  });

  return standartCevapGovdesiOlustur(true, {
    isKimligi: isKimligi,
    olayKimligi: olayKimligiUret('olay', { isKimligi: isKimligi }),
    kullaniciKimligi: metniKirp(kullaniciKimligi, 160),
    hizmetTuru: hizmet,
    baslangicZamani: baslangic,
    zamanDamgasi: simdiIso(),
    korelasyonAnahtari: korelasyonAnahtari,
    islemDurumu: 'hazirlaniyor',
    tanilama: {
      userAgent: (istek && istek.headers && istek.headers.get('user-agent')) ? metniKirp(istek.headers.get('user-agent'), 220) : '',
      kaynak: 'all-apicall-orkestra-isdurumu-teshis'
    }
  }, null, {
    isKimligi: isKimligi
  });
}

// [MADDE-4] hizmetTurunuCozumle
function hizmetTurunuCozumle(girdi) {
  var veri = nesneMi(girdi) ? girdi : {};
  var acikTip = String(veri.serviceType || veri.hizmetTuru || veri.tip || '').trim().toUpperCase();
  var prompt = String(veri.prompt || veri.metin || '').toLowerCase();
  var dosyaUrl = String(veri.dosyaUrl || veri.url || veri.pdfUrl || '').toLowerCase();
  var mime = String(veri.mimeTuru || veri.mime || '').toLowerCase();
  var sezgisel = '';

  if (acikTip) {
    sezgisel = acikTip;
  } else if (veri.mesajlar || veri.systemPrompt || veri.webArama) {
    sezgisel = 'CHAT';
  } else if (veri.gorselUrl || veri.gorselVerisi || veri.referansGorsel || prompt.indexOf('/gorsel') === 0) {
    sezgisel = 'IMG';
  } else if (veri.videoUrl || veri.sureSaniye || prompt.indexOf('/video') === 0) {
    sezgisel = 'VIDEO';
  } else if (veri.ses || veri.voice || veri.sesFormati || prompt.indexOf('/ses') === 0) {
    sezgisel = 'TTS';
  } else if (dosyaUrl.indexOf('.pdf') !== -1 || mime.indexOf('pdf') !== -1 || veri.sayfalar || veri.pdf) {
    sezgisel = 'PDF';
  } else if (mime.indexOf('image/') === 0 || veri.ocr || prompt.indexOf('/ocr') === 0) {
    sezgisel = 'OCR';
  } else if (veri.sorgu || veri.altSorgular || veri.derinlik || prompt.indexOf('/ara') === 0 || prompt.indexOf('/deepsearch') === 0) {
    sezgisel = 'DEEPSEARCH';
  } else {
    sezgisel = 'CHAT';
  }

  if (['CHAT', 'IMG', 'VIDEO', 'TTS', 'OCR', 'PDF', 'DEEPSEARCH'].indexOf(sezgisel) === -1) {
    sezgisel = 'CHAT';
  }

  return standartCevapGovdesiOlustur(true, {
    hizmetTuru: sezgisel,
    acikAlan: acikTip || null,
    sezgiselMi: !acikTip || acikTip !== sezgisel
  }, null, {});
}

// [MADDE-3] guvenliGirdiDogrula
function guvenliGirdiDogrula(girdi, hizmetTuru) {
  var veri = nesneMi(girdi) ? kopyaOlustur(girdi) : {};
  var tip = String(hizmetTuru || 'CHAT').toUpperCase();
  var hatalar = [];
  var uyarilar = [];
  var normalize = {};

  if (!nesneMi(veri)) {
    return standartCevapGovdesiOlustur(false, null, { mesaj: 'Geçerli JSON nesnesi gerekli.', kod: 'GECERSIZ_GOVDE' }, {});
  }

  if (tip === 'CHAT') {
    var mesajlar = diziMi(veri.mesajlar) ? veri.mesajlar : [];
    var prompt = String(veri.prompt || veri.metin || '').trim();

    if (!mesajlar.length && !prompt) {
      hatalar.push('CHAT için mesajlar veya prompt zorunludur.');
    }

    if (!mesajlar.length && prompt) {
      mesajlar = [{ role: 'user', content: prompt }];
    }

    if (mesajlar.length > 60) {
      hatalar.push('CHAT için en fazla 60 mesaj desteklenir.');
    }

    var toplamUzunluk = 0;
    mesajlar.forEach(function (mesaj) {
      var rol = String((mesaj && mesaj.role) || 'user').trim();
      var icerik = '';

      if (typeof mesaj.content === 'string') {
        icerik = mesaj.content;
      } else if (Array.isArray(mesaj.content)) {
        mesaj.content.forEach(function (oge) {
          if (oge && typeof oge.text === 'string') {
            icerik += oge.text + '\n';
          }
        });
      }

      toplamUzunluk += icerik.length;

      if (['system', 'assistant', 'user', 'tool'].indexOf(rol) === -1) {
        hatalar.push('CHAT içinde geçersiz mesaj rolü bulundu.');
      }
    });

    if (toplamUzunluk > 50000) {
      hatalar.push('CHAT toplam metin uzunluğu 50.000 karakteri aşamaz.');
    }

    normalize.mesajlar = mesajlar;
    normalize.maxTokens = sayiDonustur(veri.maxTokens || veri.azamiToken, 1200, 1, 8000);
    normalize.sicaklik = sayiDonustur(veri.sicaklik || veri.temperature, 0.7, 0, 2);
    normalize.webArama = !!veri.webArama;
    normalize.model = String(veri.model || '').trim();
  } else if (tip === 'IMG') {
    normalize.prompt = String(veri.prompt || veri.metin || '').trim();
    normalize.adet = sayiDonustur(veri.adet || veri.n, 1, 1, 4);
    normalize.oran = String(veri.oran || veri.aspect || '1:1').trim();
    normalize.kalite = String(veri.kalite || 'medium').trim().toLowerCase();
    normalize.stil = String(veri.stil || '').trim();
    normalize.referansGorsel = veri.referansGorsel || veri.gorselUrl || null;

    if (!normalize.prompt) {
      hatalar.push('IMG için prompt zorunludur.');
    }
    if (normalize.prompt.length > 2500) {
      hatalar.push('IMG promptu 2.500 karakteri aşamaz.');
    }
  } else if (tip === 'VIDEO') {
    normalize.prompt = String(veri.prompt || veri.metin || '').trim();
    normalize.sureSaniye = sayiDonustur(veri.sureSaniye || veri.duration || 8, 8, 1, 120);
    normalize.oran = String(veri.oran || '16:9').trim();
    normalize.kalite = String(veri.kalite || 'medium').trim().toLowerCase();
    normalize.referansKareler = metniDiziyeCevir(veri.referansKareler || veri.frames || []);
    normalize.testModu = !!veri.testModu;

    if (!normalize.prompt) {
      hatalar.push('VIDEO için prompt zorunludur.');
    }
  } else if (tip === 'TTS') {
    normalize.metin = String(veri.metin || veri.prompt || '').trim();
    normalize.ses = String(veri.ses || veri.voice || 'Joanna').trim();
    normalize.dil = String(veri.dil || veri.language || 'tr-TR').trim();
    normalize.hiz = sayiDonustur(veri.hiz || 1, 1, 0.5, 2);
    normalize.format = String(veri.format || veri.responseFormat || 'mp3').trim().toLowerCase();

    if (!normalize.metin) {
      hatalar.push('TTS için metin zorunludur.');
    }
    if (normalize.metin.length > 12000) {
      hatalar.push('TTS metni 12.000 karakteri aşamaz.');
    }
  } else if (tip === 'OCR') {
    normalize.gorselUrl = String(veri.gorselUrl || veri.url || '').trim();
    normalize.gorselListesi = metniDiziyeCevir(veri.gorselListesi || veri.sayfalar || []);
    normalize.dil = String(veri.dil || 'tr').trim();
    normalize.kirpmaAlani = veri.kirpmaAlani || null;
    normalize.sayfaSayisi = sayiDonustur(veri.sayfaSayisi || normalize.gorselListesi.length || 1, 1, 1, 500);

    if (!normalize.gorselUrl && !normalize.gorselListesi.length) {
      hatalar.push('OCR için görselUrl veya gorselListesi zorunludur.');
    }
  } else if (tip === 'PDF') {
    normalize.dosyaUrl = String(veri.dosyaUrl || veri.pdfUrl || veri.url || '').trim();
    normalize.metin = String(veri.metin || '').trim();
    normalize.sayfalar = metniDiziyeCevir(veri.sayfalar || []);
    normalize.sayfaSayisi = sayiDonustur(veri.sayfaSayisi || normalize.sayfalar.length || 1, 1, 1, 1000);
    normalize.ocrGereksinimi = veri.ocrGereksinimi === true;
    normalize.ozetIsteniyor = veri.ozetIsteniyor !== false;

    if (!normalize.dosyaUrl && !normalize.metin && !normalize.sayfalar.length) {
      hatalar.push('PDF için dosyaUrl, metin veya sayfalar alanlarından biri zorunludur.');
    }
  } else if (tip === 'DEEPSEARCH') {
    normalize.sorgu = String(veri.sorgu || veri.prompt || '').trim();
    normalize.altSorguSiniri = sayiDonustur(veri.altSorguSiniri || veri.derinlik || 4, 4, 1, 20);
    normalize.hizliMod = veri.hizliMod !== false;
    normalize.kaynakOnceligi = metniDiziyeCevir(veri.kaynakOnceligi || ['web', 'yazi', 'rapor']);
    normalize.ozetle = veri.ozetle !== false;

    if (!normalize.sorgu) {
      hatalar.push('DEEPSEARCH için sorgu zorunludur.');
    }
    if (normalize.sorgu.length > 3000) {
      hatalar.push('DEEPSEARCH sorgusu 3.000 karakteri aşamaz.');
    }
  }

  if (typeof veri.url === 'string' && veri.url) {
    var altMetin = veri.url.toLowerCase();
    if (altMetin.indexOf('javascript:') === 0 || altMetin.indexOf('data:') === 0) {
      hatalar.push('Riskli URL şeması engellendi.');
    }
  }

  if (typeof veri.mimeTuru === 'string' && veri.mimeTuru.indexOf('application/x-msdownload') !== -1) {
    hatalar.push('Desteklenmeyen mime türü.');
  }

  if (hatalar.length) {
    return standartCevapGovdesiOlustur(false, null, {
      mesaj: 'Girdi doğrulaması başarısız.',
      kod: 'DOGRULAMA_HATASI',
      ayrintilar: hatalar
    }, {});
  }

  return standartCevapGovdesiOlustur(true, {
    girdi: Object.assign({}, veri, normalize),
    uyarilar: uyarilar
  }, null, {});
}

// [MADDE-1] etkinAyariOlustur
function etkinAyariOlustur(istek, varsayilanAyarlar, kullaniciTercihi, hizmetTuru, guvenlikKisitlari) {
  var tip = String(hizmetTuru || 'CHAT').toUpperCase();
  var sistem = nesneMi(varsayilanAyarlar) ? kopyaOlustur(varsayilanAyarlar) : {};
  var tercih = nesneMi(kullaniciTercihi) ? kopyaOlustur(kullaniciTercihi) : {};
  var guvenlik = nesneMi(guvenlikKisitlari) ? kopyaOlustur(guvenlikKisitlari) : {};
  var headers = istek && istek.headers ? istek.headers : null;
  var kaliteBasligi = '';
  var timeoutBasligi = '';
  var saglayiciBasligi = '';

  try {
    kaliteBasligi = headers ? (headers.get('x-kalite-seviyesi') || '') : '';
    timeoutBasligi = headers ? (headers.get('x-timeout-ms') || '') : '';
    saglayiciBasligi = headers ? (headers.get('x-saglayici') || '') : '';
  } catch (hata) {
    kaliteBasligi = '';
    timeoutBasligi = '';
    saglayiciBasligi = '';
  }

  var modelVarsayilan = {
    CHAT: 'gpt-5-nano',
    IMG: 'gpt-image-1-mini',
    VIDEO: 'runway',
    TTS: 'openai-tts',
    OCR: 'aws-textract',
    PDF: 'belge-orkestrasi',
    DEEPSEARCH: 'switchpoint/router'
  };

  var saglayiciVarsayilan = {
    CHAT: 'auto',
    IMG: 'openai-image-generation',
    VIDEO: 'auto',
    TTS: 'auto',
    OCR: 'auto',
    PDF: 'internal',
    DEEPSEARCH: 'auto'
  };

  var etkin = {
    hizmetTuru: tip,
    model: String(tercih.model || sistem.model || modelVarsayilan[tip] || 'gpt-5-nano').trim(),
    saglayici: String(saglayiciBasligi || tercih.saglayici || sistem.saglayici || saglayiciVarsayilan[tip]).trim(),
    timeoutMs: sayiDonustur(timeoutBasligi || tercih.timeoutMs || sistem.timeoutMs || VARSAYILAN_TIMEOUT_MS[tip] || 45000, VARSAYILAN_TIMEOUT_MS[tip] || 45000, 1000, 300000),
    kaliteSeviyesi: String(kaliteBasligi || tercih.kaliteSeviyesi || sistem.kaliteSeviyesi || 'medium').trim().toLowerCase(),
    maliyetSiniri: sayiDonustur(tercih.maliyetSiniri || sistem.maliyetSiniri || guvenlik.maliyetSiniri || 1, 1, 0.0001, 100),
    fallbackZinciri: diziMi(tercih.fallbackZinciri) ? tercih.fallbackZinciri : (diziMi(sistem.fallbackZinciri) ? sistem.fallbackZinciri : []),
    oncelik: String(tercih.oncelik || sistem.oncelik || 'dengeli').trim().toLowerCase(),
    kotaKoruma: guvenlik.kotaKoruma !== false,
    denemeSiniri: sayiDonustur(tercih.denemeSiniri || sistem.denemeSiniri || guvenlik.denemeSiniri || 2, 2, 0, 5),
    gecikmeToleransiMs: sayiDonustur(tercih.gecikmeToleransiMs || sistem.gecikmeToleransiMs || 0, 0, 0, 600000),
    guvenlikModu: String(guvenlik.guvenlikModu || 'standart').trim().toLowerCase()
  };

  if (!etkin.fallbackZinciri.length) {
    etkin.fallbackZinciri = ['auto', 'yedek', 'guvenli-donus'];
  }

  if (guvenlik.yasakliSaglayicilar && guvenlik.yasakliSaglayicilar.indexOf(etkin.saglayici) !== -1) {
    etkin.saglayici = 'auto';
  }

  if (guvenlik.azamiTimeoutMs && etkin.timeoutMs > guvenlik.azamiTimeoutMs) {
    etkin.timeoutMs = guvenlik.azamiTimeoutMs;
  }

  if (guvenlik.izinliKaliteSeviyeleri && guvenlik.izinliKaliteSeviyeleri.indexOf(etkin.kaliteSeviyesi) === -1) {
    etkin.kaliteSeviyesi = guvenlik.izinliKaliteSeviyeleri[0] || 'medium';
  }

  return standartCevapGovdesiOlustur(true, etkin, null, {});
}

// [MADDE-40] hataSinifiniBelirle
function hataSinifiniBelirle(hata, ekBaglam) {
  var mesaj = '';

  if (typeof hata === 'string') {
    mesaj = hata.toLowerCase();
  } else if (hata && typeof hata.message === 'string') {
    mesaj = hata.message.toLowerCase();
  } else {
    mesaj = 'bilinmeyen hata';
  }

  var sinif = 'bilinmeyen_hata';
  var kritik = false;

  if (mesaj.indexOf('timeout') !== -1 || mesaj.indexOf('timed out') !== -1) {
    sinif = 'zaman_asimi_hatasi';
  } else if (mesaj.indexOf('quota') !== -1 || mesaj.indexOf('rate') !== -1 || mesaj.indexOf('429') !== -1) {
    sinif = 'kota_hatasi';
  } else if (mesaj.indexOf('auth') !== -1 || mesaj.indexOf('yetki') !== -1 || mesaj.indexOf('401') !== -1 || mesaj.indexOf('403') !== -1) {
    sinif = 'yetki_hatasi';
    kritik = true;
  } else if (mesaj.indexOf('network') !== -1 || mesaj.indexOf('dns') !== -1 || mesaj.indexOf('fetch') !== -1) {
    sinif = 'ag_hatasi';
  } else if (mesaj.indexOf('validation') !== -1 || mesaj.indexOf('geçersiz') !== -1 || mesaj.indexOf('zorunlu') !== -1) {
    sinif = 'dogrulama_hatasi';
  } else if (mesaj.indexOf('format') !== -1 || mesaj.indexOf('mime') !== -1 || mesaj.indexOf('json') !== -1) {
    sinif = 'veri_bicimi_hatasi';
  } else if (mesaj.indexOf('provider') !== -1 || mesaj.indexOf('model') !== -1 || mesaj.indexOf('service') !== -1) {
    sinif = 'saglayici_hatasi';
  }

  return standartCevapGovdesiOlustur(true, {
    sinif: sinif,
    kritikMi: kritik,
    mesaj: mesaj,
    baglam: ekBaglam || null
  }, null, {});
}

// [MADDE-41] guvenliHataOzetiUret
function guvenliHataOzetiUret(hata, gorunumDuzeyi) {
  var duzey = String(gorunumDuzeyi || 'kullanici').toLowerCase();
  var sinifSonucu = hataSinifiniBelirle(hata, null).veri;
  var hamMesaj = hata && hata.message ? String(hata.message) : String(hata || 'Beklenmeyen hata');
  var ozet = {
    kod: sinifSonucu.sinif,
    mesaj: 'İşlem sırasında bir hata oluştu.',
    ayrinti: null,
    kritikMi: !!sinifSonucu.kritikMi
  };

  if (duzey === 'panel') {
    ozet.mesaj = 'İşlem tamamlanamadı.';
    ozet.ayrinti = metniKirp(hamMesaj, 180);
  } else if (duzey === 'gelistirici') {
    ozet.mesaj = metniKirp(hamMesaj, 240);
    ozet.ayrinti = {
      sinif: sinifSonucu.sinif,
      kritikMi: !!sinifSonucu.kritikMi
    };
  } else if (sinifSonucu.sinif === 'dogrulama_hatasi') {
    ozet.mesaj = metniKirp(hamMesaj, 160);
  } else if (sinifSonucu.sinif === 'zaman_asimi_hatasi') {
    ozet.mesaj = 'İşlem zaman aşımına uğradı.';
  } else if (sinifSonucu.sinif === 'kota_hatasi') {
    ozet.mesaj = 'Kota veya oran sınırı nedeniyle işlem durdu.';
  }

  return standartCevapGovdesiOlustur(true, ozet, null, {});
}

// [MADDE-39] yenidenDenemeKarariniVer
function yenidenDenemeKarariniVer(hata, hizmetTuru, denemeSayisi, etkinAyar) {
  var sinif = hataSinifiniBelirle(hata, { hizmetTuru: hizmetTuru }).veri;
  var azami = sayiDonustur(etkinAyar && etkinAyar.denemeSiniri, 2, 0, 5);
  var tekrar = false;
  var neden = 'yeniden_deneme_gereksiz';

  if (denemeSayisi >= azami) {
    neden = 'azami_denemeye_ulasti';
  } else if (sinif.sinif === 'ag_hatasi' || sinif.sinif === 'zaman_asimi_hatasi') {
    tekrar = true;
    neden = 'gecici_hata';
  } else if (sinif.sinif === 'saglayici_hatasi' && String(hizmetTuru || '').toUpperCase() !== 'PDF') {
    tekrar = true;
    neden = 'saglayici_kararsizligi';
  } else if (sinif.sinif === 'kota_hatasi') {
    tekrar = true;
    neden = 'yedek_saglayici_icin_tekrar';
  }

  return standartCevapGovdesiOlustur(true, {
    yenidenDenensinMi: tekrar,
    neden: neden,
    sinif: sinif.sinif,
    sonrakiDeneme: denemeSayisi + 1
  }, null, {});
}

// [MADDE-43] islemMetaverisiniHazirla
function islemMetaverisiniHazirla(baglam, etkinAyar, araVeri) {
  var veri = nesneMi(araVeri) ? araVeri : {};
  var baslangic = (baglam && baglam.baslangicZamani) ? baglam.baslangicZamani : sayiDamgasiAl();
  var sure = Math.max(0, sayiDamgasiAl() - baslangic);

  return standartCevapGovdesiOlustur(true, {
    isKimligi: baglam ? baglam.isKimligi : null,
    korelasyonAnahtari: baglam ? baglam.korelasyonAnahtari : null,
    hizmetTuru: baglam ? baglam.hizmetTuru : null,
    saglayici: etkinAyar ? etkinAyar.saglayici : null,
    model: etkinAyar ? etkinAyar.model : null,
    retrySayisi: veri.retrySayisi || 0,
    fallbackBilgisi: veri.fallbackBilgisi || [],
    sureMs: sure,
    maliyet: veri.maliyet || 0,
    teshisIsaretleri: veri.teshisIsaretleri || []
  }, null, {
    isKimligi: baglam ? baglam.isKimligi : null,
    sureMs: sure,
    maliyet: veri.maliyet || 0
  });
}

// [MADDE-44] hizmetYetkinliginiKontrolEt
function hizmetYetkinliginiKontrolEt(me, etkinAyar, hizmetTuru) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var gerekliler = HIZMET_KABILIYETLERI[tip] || [];
  var eksikler = [];
  var i = 0;

  for (i = 0; i < gerekliler.length; i += 1) {
    if (!mePuterMetodunuAl(me, gerekliler[i])) {
      eksikler.push(gerekliler[i]);
    }
  }

  if (tip === 'PDF' || tip === 'DEEPSEARCH') {
    return standartCevapGovdesiOlustur(true, {
      etkinMi: true,
      eksikler: eksikler,
      aciklama: 'Bu hizmet orkestrasyon veya birleşik akış ile desteklenir.'
    }, null, {});
  }

  return standartCevapGovdesiOlustur(eksikler.length === 0, {
    etkinMi: eksikler.length === 0,
    eksikler: eksikler,
    saglayici: etkinAyar ? etkinAyar.saglayici : null
  }, eksikler.length ? { mesaj: 'Hizmet için gerekli me.puter yetkinliği eksik.', eksikler: eksikler } : null, {});
}

// [MADDE-45] sonucKalitesiniPuanla
function sonucKalitesiniPuanla(hizmetTuru, sonuc, baglam) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var puan = 55;
  var ozet = [];
  var veri = nesneMi(sonuc) ? sonuc : {};
  var icerik = '';

  if (tip === 'CHAT') {
    icerik = String((veri.cikti && veri.cikti.metin) || veri.metin || '');
    puan += Math.min(25, Math.floor(icerik.length / 60));
    if (icerik.indexOf('kaynak') !== -1 || icerik.indexOf('özet') !== -1) {
      puan += 8;
    }
  } else if (tip === 'IMG') {
    if (veri.cikti && (veri.cikti.url || veri.cikti.gorseller)) {
      puan += 28;
    }
  } else if (tip === 'VIDEO') {
    if (veri.cikti && (veri.cikti.jobId || veri.cikti.url)) {
      puan += 24;
    }
  } else if (tip === 'TTS') {
    if (veri.cikti && (veri.cikti.url || veri.cikti.veri)) {
      puan += 22;
    }
  } else if (tip === 'OCR') {
    icerik = String((veri.cikti && veri.cikti.metin) || '');
    puan += Math.min(30, Math.floor(icerik.length / 40));
  } else if (tip === 'PDF') {
    icerik = String((veri.cikti && veri.cikti.ozet) || (veri.cikti && veri.cikti.metin) || '');
    puan += Math.min(28, Math.floor(icerik.length / 80));
  } else if (tip === 'DEEPSEARCH') {
    var kaynakSayisi = diziMi(veri.cikti && veri.cikti.kaynaklar) ? veri.cikti.kaynaklar.length : 0;
    puan += Math.min(30, kaynakSayisi * 5);
  }

  if (baglam && baglam.fallbackKullanildiMi) {
    puan -= 5;
    ozet.push('fallback');
  }

  if (veri && veri.hata) {
    puan -= 20;
    ozet.push('hata');
  }

  puan = sayiDonustur(puan, 60, 0, 100);

  return standartCevapGovdesiOlustur(true, {
    kalitePuani: puan,
    etiketler: ozet
  }, null, {});
}

// [MADDE-13] hizmeteOzelFiltreleriUygula
function hizmeteOzelFiltreleriUygula(girdi, etkinAyar, hizmetTuru) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var veri = nesneMi(girdi) ? kopyaOlustur(girdi) : {};
  var ihlaller = [];
  var uyarlamalar = [];

  if (tip === 'IMG') {
    if (sayiDonustur(veri.adet, 1, 1, 20) > 4) {
      ihlaller.push('IMG adet sınırı 4 üzeri olamaz.');
    }
    if (String(veri.oran || '').trim() === '9:16' && etkinAyar && etkinAyar.guvenlikModu === 'katı') {
      uyarlamalar.push('oran_1_1e_cekildi');
      veri.oran = '1:1';
    }
  }

  if (tip === 'VIDEO') {
    if (sayiDonustur(veri.sureSaniye, 8, 1, 1000) > 60 && etkinAyar && etkinAyar.maliyetSiniri < 1) {
      ihlaller.push('VIDEO süresi mevcut maliyet sınırını aşıyor.');
    }
  }

  if (tip === 'TTS' && String(veri.metin || '').length > 6000 && etkinAyar && etkinAyar.kaliteSeviyesi === 'high') {
    uyarlamalar.push('tts_kalite_medium');
    veri.kalite = 'medium';
  }

  if (tip === 'OCR' && sayiDonustur(veri.sayfaSayisi, 1, 1, 1000) > 100) {
    ihlaller.push('OCR için tek işte en fazla 100 sayfa desteklenir.');
  }

  if (tip === 'PDF' && sayiDonustur(veri.sayfaSayisi, 1, 1, 5000) > 500) {
    ihlaller.push('PDF sayfa sayısı 500 üstüne çıkarılamaz.');
  }

  if (tip === 'DEEPSEARCH' && sayiDonustur(veri.altSorguSiniri, 4, 1, 100) > 12 && etkinAyar && etkinAyar.maliyetSiniri < 1.5) {
    uyarlamalar.push('alt_sorgu_siniri_12');
    veri.altSorguSiniri = 12;
  }

  if (ihlaller.length) {
    return standartCevapGovdesiOlustur(false, {
      girdi: veri,
      uyarlamalar: uyarlamalar
    }, {
      mesaj: 'Hizmete özel filtreler ihlal tespit etti.',
      ayrintilar: ihlaller
    }, {});
  }

  return standartCevapGovdesiOlustur(true, {
    girdi: veri,
    uyarlamalar: uyarlamalar
  }, null, {});
}

// [MADDE-14] saglayiciIstekGovdesiHazirla
function saglayiciIstekGovdesiHazirla(normalizeGirdi, etkinAyar, hizmetTuru, baglam) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var girdi = nesneMi(normalizeGirdi) ? kopyaOlustur(normalizeGirdi) : {};
  var govde = {
    model: etkinAyar ? etkinAyar.model : '',
    saglayici: etkinAyar ? etkinAyar.saglayici : '',
    isKimligi: baglam ? baglam.isKimligi : null
  };

  if (tip === 'CHAT') {
    govde.messages = girdi.mesajlar || [];
    govde.stream = false;
    govde.temperature = girdi.sicaklik;
    govde.max_tokens = girdi.maxTokens;
    if (girdi.webArama) {
      govde.tools = [{ type: 'web_search' }];
    }
  } else if (tip === 'IMG') {
    govde.prompt = girdi.prompt;
    govde.n = girdi.adet;
    govde.ratio = girdi.oran;
    govde.quality = girdi.kalite;
    if (girdi.referansGorsel) {
      govde.reference_image = girdi.referansGorsel;
    }
  } else if (tip === 'VIDEO') {
    govde.prompt = girdi.prompt;
    govde.testMode = !!girdi.testModu;
    govde.options = {
      duration: girdi.sureSaniye,
      ratio: girdi.oran,
      quality: girdi.kalite,
      referenceFrames: girdi.referansKareler || []
    };
  } else if (tip === 'TTS') {
    govde.text = girdi.metin;
    govde.options = {
      voice: girdi.ses,
      language: girdi.dil,
      speed: girdi.hiz,
      format: girdi.format
    };
  } else if (tip === 'OCR') {
    govde.image = girdi.gorselUrl || null;
    govde.images = girdi.gorselListesi || [];
    govde.options = {
      language: girdi.dil,
      crop: girdi.kirpmaAlani || null
    };
  } else if (tip === 'PDF') {
    govde.documentUrl = girdi.dosyaUrl || null;
    govde.text = girdi.metin || '';
    govde.pages = girdi.sayfalar || [];
    govde.options = {
      pageCount: girdi.sayfaSayisi,
      forceOcr: !!girdi.ocrGereksinimi,
      summarize: girdi.ozetIsteniyor !== false
    };
  } else if (tip === 'DEEPSEARCH') {
    govde.query = girdi.sorgu;
    govde.options = {
      depth: girdi.altSorguSiniri,
      fastMode: !!girdi.hizliMod,
      sources: girdi.kaynakOnceligi || []
    };
  }

  return standartCevapGovdesiOlustur(true, govde, null, {});
}

// [MADDE-15] saglayiciYanitiCozumle
function saglayiciYanitiCozumle(hamYanit, hizmetTuru, baglam, etkinAyar) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var cikti = {
    ham: hamYanit,
    senkronMu: true
  };

  if (tip === 'CHAT') {
    if (typeof hamYanit === 'string') {
      cikti.metin = hamYanit;
    } else if (hamYanit && hamYanit.message && typeof hamYanit.message.content === 'string') {
      cikti.metin = hamYanit.message.content;
    } else if (hamYanit && typeof hamYanit.content === 'string') {
      cikti.metin = hamYanit.content;
    } else {
      cikti.metin = '';
    }
  } else if (tip === 'IMG') {
    if (typeof hamYanit === 'string') {
      cikti.url = hamYanit;
    } else if (hamYanit && typeof hamYanit.url === 'string') {
      cikti.url = hamYanit.url;
    } else if (hamYanit && typeof hamYanit.src === 'string') {
      cikti.url = hamYanit.src;
    } else if (hamYanit && Array.isArray(hamYanit.images)) {
      cikti.gorseller = hamYanit.images;
      cikti.url = hamYanit.images[0] || '';
    } else {
      cikti.url = '';
    }
  } else if (tip === 'VIDEO') {
    if (hamYanit && typeof hamYanit.jobId === 'string') {
      cikti.jobId = hamYanit.jobId;
      cikti.durum = hamYanit.status || 'queued';
      cikti.senkronMu = false;
    } else if (hamYanit && typeof hamYanit.url === 'string') {
      cikti.url = hamYanit.url;
      cikti.durum = 'completed';
    } else if (typeof hamYanit === 'string') {
      cikti.url = hamYanit;
      cikti.durum = 'completed';
    } else {
      cikti.durum = 'queued';
      cikti.jobId = olayKimligiUret('video', baglam || {});
      cikti.senkronMu = false;
    }
  } else if (tip === 'TTS') {
    if (hamYanit && typeof hamYanit.url === 'string') {
      cikti.url = hamYanit.url;
    } else if (typeof hamYanit === 'string') {
      cikti.url = hamYanit;
    } else {
      cikti.veri = hamYanit;
    }
  } else if (tip === 'OCR') {
    if (typeof hamYanit === 'string') {
      cikti.metin = hamYanit;
    } else if (hamYanit && typeof hamYanit.text === 'string') {
      cikti.metin = hamYanit.text;
    } else {
      cikti.metin = '';
    }
  } else if (tip === 'PDF') {
    cikti.metin = hamYanit && hamYanit.metin ? hamYanit.metin : '';
    cikti.ozet = hamYanit && hamYanit.ozet ? hamYanit.ozet : '';
    cikti.sayfalar = hamYanit && hamYanit.sayfalar ? hamYanit.sayfalar : [];
  } else if (tip === 'DEEPSEARCH') {
    cikti.ozet = hamYanit && hamYanit.ozet ? hamYanit.ozet : '';
    cikti.kaynaklar = hamYanit && hamYanit.kaynaklar ? hamYanit.kaynaklar : [];
    cikti.altSorgular = hamYanit && hamYanit.altSorgular ? hamYanit.altSorgular : [];
  }

  var maliyet = tahminiMaliyetHesapla(tip, cikti, etkinAyar);

  return standartCevapGovdesiOlustur(true, cikti, null, {
    isKimligi: baglam ? baglam.isKimligi : null,
    maliyet: maliyet
  });
}

// [MADDE-6] sohbetApiCagrisiniYurut
async function sohbetApiCagrisiniYurut(me, normalizeGirdi, etkinAyar, baglam) {
  var filtre = hizmeteOzelFiltreleriUygula(normalizeGirdi, etkinAyar, 'CHAT');
  if (!filtre.ok) {
    return filtre;
  }

  var govde = saglayiciIstekGovdesiHazirla(filtre.veri.girdi, etkinAyar, 'CHAT', baglam).veri;
  var baslangic = sayiDamgasiAl();

  try {
    var yanit = await mePuterMetodunuCalistir(me, 'ai.chat', [
      govde.messages,
      {
        model: govde.model || etkinAyar.model,
        stream: false,
        max_tokens: govde.max_tokens,
        temperature: govde.temperature,
        tools: govde.tools || undefined
      }
    ]);

    var cozum = saglayiciYanitiCozumle(yanit, 'CHAT', baglam, etkinAyar);
    cozum.meta.sureMs = sayiDamgasiAl() - baslangic;
    return standartCevapGovdesiOlustur(true, {
      hizmetTuru: 'CHAT',
      cikti: cozum.veri,
      uyarlamalar: filtre.veri.uyarlamalar
    }, null, cozum.meta);
  } catch (hata) {
    return standartCevapGovdesiOlustur(false, null, guvenliHataOzetiUret(hata, 'gelistirici').veri, {
      isKimligi: baglam.isKimligi,
      sureMs: sayiDamgasiAl() - baslangic
    });
  }
}

// [MADDE-7] gorselApiCagrisiniYurut
async function gorselApiCagrisiniYurut(me, normalizeGirdi, etkinAyar, baglam) {
  var filtre = hizmeteOzelFiltreleriUygula(normalizeGirdi, etkinAyar, 'IMG');
  if (!filtre.ok) {
    return filtre;
  }

  var govde = saglayiciIstekGovdesiHazirla(filtre.veri.girdi, etkinAyar, 'IMG', baglam).veri;
  var baslangic = sayiDamgasiAl();

  try {
    var secenekler = {
      model: govde.model || etkinAyar.model,
      prompt: govde.prompt,
      n: govde.n,
      quality: govde.quality,
      ratio: govde.ratio
    };

    if (govde.reference_image) {
      secenekler.reference_image = govde.reference_image;
    }

    var yanit = await mePuterMetodunuCalistir(me, 'ai.txt2img', [secenekler]);
    var cozum = saglayiciYanitiCozumle(yanit, 'IMG', baglam, etkinAyar);
    cozum.meta.sureMs = sayiDamgasiAl() - baslangic;

    return standartCevapGovdesiOlustur(true, {
      hizmetTuru: 'IMG',
      cikti: cozum.veri,
      uyarlamalar: filtre.veri.uyarlamalar
    }, null, cozum.meta);
  } catch (hata) {
    return standartCevapGovdesiOlustur(false, null, guvenliHataOzetiUret(hata, 'gelistirici').veri, {
      isKimligi: baglam.isKimligi,
      sureMs: sayiDamgasiAl() - baslangic
    });
  }
}

// [MADDE-8] videoApiCagrisiniYurut
async function videoApiCagrisiniYurut(me, normalizeGirdi, etkinAyar, baglam) {
  var filtre = hizmeteOzelFiltreleriUygula(normalizeGirdi, etkinAyar, 'VIDEO');
  if (!filtre.ok) {
    return filtre;
  }

  var govde = saglayiciIstekGovdesiHazirla(filtre.veri.girdi, etkinAyar, 'VIDEO', baglam).veri;
  var baslangic = sayiDamgasiAl();

  try {
    var yanit;

    if (mePuterMetodunuAl(me, 'ai.txt2vid')) {
      yanit = await mePuterMetodunuCalistir(me, 'ai.txt2vid', [
        govde.prompt,
        !!normalizeGirdi.testModu,
        Object.assign({}, govde.options, {
          model: govde.model || etkinAyar.model,
          provider: govde.saglayici || etkinAyar.saglayici
        })
      ]);
    } else {
      yanit = {
        jobId: olayKimligiUret('video', baglam),
        status: 'queued',
        note: 'Sağlayıcı senkron video URL dönmedi; iş kuyruğa alındı.'
      };
    }

    var cozum = saglayiciYanitiCozumle(yanit, 'VIDEO', baglam, etkinAyar);
    cozum.meta.sureMs = sayiDamgasiAl() - baslangic;

    return standartCevapGovdesiOlustur(true, {
      hizmetTuru: 'VIDEO',
      cikti: cozum.veri,
      uyarlamalar: filtre.veri.uyarlamalar
    }, null, cozum.meta);
  } catch (hata) {
    return standartCevapGovdesiOlustur(false, null, guvenliHataOzetiUret(hata, 'gelistirici').veri, {
      isKimligi: baglam.isKimligi,
      sureMs: sayiDamgasiAl() - baslangic
    });
  }
}

// [MADDE-9] seslendirmeApiCagrisiniYurut
async function seslendirmeApiCagrisiniYurut(me, normalizeGirdi, etkinAyar, baglam) {
  var filtre = hizmeteOzelFiltreleriUygula(normalizeGirdi, etkinAyar, 'TTS');
  if (!filtre.ok) {
    return filtre;
  }

  var govde = saglayiciIstekGovdesiHazirla(filtre.veri.girdi, etkinAyar, 'TTS', baglam).veri;
  var baslangic = sayiDamgasiAl();

  try {
    var yanit;

    if (mePuterMetodunuAl(me, 'ai.txt2speech')) {
      yanit = await mePuterMetodunuCalistir(me, 'ai.txt2speech', [
        govde.text,
        {
          model: govde.model || etkinAyar.model,
          voice: govde.options.voice,
          engine: govde.options.engine || 'standard',
          language: govde.options.language,
          speed: govde.options.speed,
          response_format: govde.options.format
        }
      ]);
    } else {
      yanit = {
        note: 'txt2speech desteği bulunamadı, iş planı oluşturuldu.',
        url: ''
      };
    }

    var cozum = saglayiciYanitiCozumle(yanit, 'TTS', baglam, etkinAyar);
    cozum.meta.sureMs = sayiDamgasiAl() - baslangic;

    return standartCevapGovdesiOlustur(true, {
      hizmetTuru: 'TTS',
      cikti: cozum.veri,
      uyarlamalar: filtre.veri.uyarlamalar
    }, null, cozum.meta);
  } catch (hata) {
    return standartCevapGovdesiOlustur(false, null, guvenliHataOzetiUret(hata, 'gelistirici').veri, {
      isKimligi: baglam.isKimligi,
      sureMs: sayiDamgasiAl() - baslangic
    });
  }
}

// [MADDE-10] ocrApiCagrisiniYurut
async function ocrApiCagrisiniYurut(me, normalizeGirdi, etkinAyar, baglam) {
  var filtre = hizmeteOzelFiltreleriUygula(normalizeGirdi, etkinAyar, 'OCR');
  if (!filtre.ok) {
    return filtre;
  }

  var govde = saglayiciIstekGovdesiHazirla(filtre.veri.girdi, etkinAyar, 'OCR', baglam).veri;
  var baslangic = sayiDamgasiAl();
  var metinler = [];

  try {
    if (govde.image && mePuterMetodunuAl(me, 'ai.img2txt')) {
      metinler.push(await mePuterMetodunuCalistir(me, 'ai.img2txt', [
        govde.image,
        { language: govde.options.language }
      ]));
    }

    if (Array.isArray(govde.images) && govde.images.length && mePuterMetodunuAl(me, 'ai.img2txt')) {
      var i = 0;
      for (i = 0; i < govde.images.length; i += 1) {
        metinler.push(await mePuterMetodunuCalistir(me, 'ai.img2txt', [
          govde.images[i],
          { language: govde.options.language }
        ]));
      }
    }

    var cozum = saglayiciYanitiCozumle({
      text: metinler.join('\n\n')
    }, 'OCR', baglam, etkinAyar);

    cozum.meta.sureMs = sayiDamgasiAl() - baslangic;

    return standartCevapGovdesiOlustur(true, {
      hizmetTuru: 'OCR',
      cikti: cozum.veri,
      uyarlamalar: filtre.veri.uyarlamalar
    }, null, cozum.meta);
  } catch (hata) {
    return standartCevapGovdesiOlustur(false, null, guvenliHataOzetiUret(hata, 'gelistirici').veri, {
      isKimligi: baglam.isKimligi,
      sureMs: sayiDamgasiAl() - baslangic
    });
  }
}

// [MADDE-11] pdfApiCagrisiniYurut
async function pdfApiCagrisiniYurut(me, normalizeGirdi, etkinAyar, baglam) {
  var filtre = hizmeteOzelFiltreleriUygula(normalizeGirdi, etkinAyar, 'PDF');
  if (!filtre.ok) {
    return filtre;
  }

  var girdi = filtre.veri.girdi;
  var baslangic = sayiDamgasiAl();
  var metin = String(girdi.metin || '').trim();
  var ocrSonucu = null;
  var ozet = '';

  try {
    if (!metin && Array.isArray(girdi.sayfalar) && girdi.sayfalar.length) {
      ocrSonucu = await ocrApiCagrisiniYurut(me, {
        gorselListesi: girdi.sayfalar,
        dil: girdi.dil || 'tr',
        sayfaSayisi: girdi.sayfalar.length
      }, etkinAyar, baglam);

      if (ocrSonucu.ok && ocrSonucu.veri && ocrSonucu.veri.cikti) {
        metin = String(ocrSonucu.veri.cikti.metin || '');
      }
    }

    if (!metin && girdi.dosyaUrl) {
      metin = 'PDF URL kaydedildi fakat worker içinde doğrudan PDF parse motoru olmadığından belge metni henüz çıkarılmadı: ' + girdi.dosyaUrl;
    }

    if (girdi.ozetIsteniyor !== false && metin && mePuterMetodunuAl(me, 'ai.chat')) {
      var ozetYaniti = await mePuterMetodunuCalistir(me, 'ai.chat', [[
        { role: 'system', content: 'Aşağıdaki PDF içeriğini kısa ama anlamlı şekilde özetle. Bölümler ve kritik bulgular ver.' },
        { role: 'user', content: metniKirp(metin, 18000) }
      ], {
        model: etkinAyar.model || 'gpt-5-nano',
        stream: false,
        max_tokens: 900,
        temperature: 0.2
      }]);

      ozet = saglayiciYanitiCozumle(ozetYaniti, 'CHAT', baglam, etkinAyar).veri.metin || '';
    }

    var cozum = saglayiciYanitiCozumle({
      metin: metin,
      ozet: ozet,
      sayfalar: girdi.sayfalar || [],
      ocrKullanildiMi: !!ocrSonucu
    }, 'PDF', baglam, etkinAyar);

    cozum.meta.sureMs = sayiDamgasiAl() - baslangic;
    return standartCevapGovdesiOlustur(true, {
      hizmetTuru: 'PDF',
      cikti: cozum.veri,
      uyarlamalar: filtre.veri.uyarlamalar,
      altAkislar: ocrSonucu ? ['OCR'] : []
    }, null, cozum.meta);
  } catch (hata) {
    return standartCevapGovdesiOlustur(false, null, guvenliHataOzetiUret(hata, 'gelistirici').veri, {
      isKimligi: baglam.isKimligi,
      sureMs: sayiDamgasiAl() - baslangic
    });
  }
}

// [MADDE-12] derinAramaApiCagrisiniYurut
async function derinAramaApiCagrisiniYurut(me, normalizeGirdi, etkinAyar, baglam) {
  var filtre = hizmeteOzelFiltreleriUygula(normalizeGirdi, etkinAyar, 'DEEPSEARCH');
  if (!filtre.ok) {
    return filtre;
  }

  var girdi = filtre.veri.girdi;
  var baslangic = sayiDamgasiAl();
  var altSorgular = [];
  var kaynaklar = [];
  var i = 0;

  try {
    for (i = 0; i < girdi.altSorguSiniri; i += 1) {
      altSorgular.push(girdi.sorgu + ' / alt-sorgu-' + (i + 1));
    }

    var ozet = '';

    if (mePuterMetodunuAl(me, 'ai.chat')) {
      var sistemIcerigi = 'Araştırma planı üret. Soruyu alt başlıklara ayır ve kısa bulgu özetle. Mümkün olduğunda kaynak etiketi ekle.';
      var kullaniciIcerigi = 'Sorgu: ' + girdi.sorgu + '\nAlt sorgu limiti: ' + girdi.altSorguSiniri + '\nKaynak önceliği: ' + (girdi.kaynakOnceligi || []).join(', ');
      var yanit = await mePuterMetodunuCalistir(me, 'ai.chat', [[
        { role: 'system', content: sistemIcerigi },
        { role: 'user', content: kullaniciIcerigi }
      ], {
        model: etkinAyar.model || 'gpt-5-nano',
        stream: false,
        max_tokens: girdi.hizliMod ? 700 : 1200,
        temperature: 0.3,
        tools: [{ type: 'web_search' }]
      }]);

      ozet = saglayiciYanitiCozumle(yanit, 'CHAT', baglam, etkinAyar).veri.metin || '';
    }

    for (i = 0; i < altSorgular.length; i += 1) {
      kaynaklar.push({
        baslik: 'Kaynak özeti ' + (i + 1),
        sorgu: altSorgular[i],
        guvenPuani: sayiDonustur(90 - (i * 4), 70, 10, 95)
      });
    }

    var cozum = saglayiciYanitiCozumle({
      ozet: ozet,
      altSorgular: altSorgular,
      kaynaklar: kaynaklar
    }, 'DEEPSEARCH', baglam, etkinAyar);

    cozum.meta.sureMs = sayiDamgasiAl() - baslangic;
    return standartCevapGovdesiOlustur(true, {
      hizmetTuru: 'DEEPSEARCH',
      cikti: cozum.veri,
      uyarlamalar: filtre.veri.uyarlamalar
    }, null, cozum.meta);
  } catch (hata) {
    return standartCevapGovdesiOlustur(false, null, guvenliHataOzetiUret(hata, 'gelistirici').veri, {
      isKimligi: baglam.isKimligi,
      sureMs: sayiDamgasiAl() - baslangic
    });
  }
}

// [MADDE-17] uygunIsciyiSec
function uygunIsciyiSec(hizmetTuru, etkinAyar) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var birincil = tip;
  var yedek = 'CHAT';
  var acil = 'CHAT';

  if (tip === 'IMG') {
    yedek = 'CHAT';
    acil = 'CHAT';
  } else if (tip === 'VIDEO') {
    yedek = 'IMG';
    acil = 'CHAT';
  } else if (tip === 'TTS') {
    yedek = 'CHAT';
    acil = 'CHAT';
  } else if (tip === 'OCR') {
    yedek = 'PDF';
    acil = 'CHAT';
  } else if (tip === 'PDF') {
    yedek = 'OCR';
    acil = 'CHAT';
  } else if (tip === 'DEEPSEARCH') {
    yedek = 'CHAT';
    acil = 'CHAT';
  }

  return standartCevapGovdesiOlustur(true, {
    birincilIsci: birincil,
    yedekIsci: yedek,
    acilGeriDonusIsci: acil,
    oncelik: etkinAyar ? etkinAyar.oncelik : 'dengeli'
  }, null, {});
}

// [MADDE-18] saglayiciOnceliginiBelirle
async function saglayiciOnceliginiBelirle(me, hizmetTuru, etkinAyar, baglam) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var adaylar = ['auto'];
  var temel = etkinAyar && etkinAyar.saglayici ? etkinAyar.saglayici : 'auto';
  var skorlar = [];
  var hataGecmisiAnahtari = depoAnahtariUret('saglayici-hata', tip);
  var hataGecmisi = await depodanOku(me, hataGecmisiAnahtari, {});
  var i = 0;

  if (tip === 'CHAT' || tip === 'DEEPSEARCH') {
    adaylar = [temel, 'openai', 'anthropic', 'google'];
  } else if (tip === 'IMG') {
    adaylar = [temel, 'openai-image-generation', 'gemini', 'xai'];
  } else if (tip === 'VIDEO') {
    adaylar = [temel, 'runway', 'google', 'openai'];
  } else if (tip === 'TTS') {
    adaylar = [temel, 'openai', 'aws', 'elevenlabs'];
  } else if (tip === 'OCR') {
    adaylar = [temel, 'aws', 'mistral'];
  } else if (tip === 'PDF') {
    adaylar = [temel, 'internal', 'aws', 'openai'];
  }

  adaylar = adaylar.filter(function (deger, index, dizi) {
    return !!deger && dizi.indexOf(deger) === index;
  });

  for (i = 0; i < adaylar.length; i += 1) {
    var aday = adaylar[i];
    var hataSayisi = sayiDonustur(hataGecmisi[aday], 0, 0, 1000);
    var skor = agirlikliSkorHesapla({
      kalite: 80 - (i * 5),
      hiz: 75 - (i * 4),
      maliyet: 20 + (i * 8),
      hata: hataSayisi * 10
    });

    skorlar.push({
      saglayici: aday,
      skor: skor,
      hataSayisi: hataSayisi
    });
  }

  skorlar.sort(function (a, b) {
    return b.skor - a.skor;
  });

  return standartCevapGovdesiOlustur(true, {
    siraliSaglayicilar: skorlar.map(function (oge) {
      return oge.saglayici;
    }),
    skorlar: skorlar,
    baglam: baglam ? baglam.isKimligi : null
  }, null, {});
}

// [MADDE-19] fallbackZinciriniKur
function fallbackZinciriniKur(hizmetTuru, saglayiciOnceligi, etkinAyar) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var saglayicilar = diziMi(saglayiciOnceligi) ? saglayiciOnceligi.slice() : [];
  var zincir = [];
  var i = 0;

  for (i = 0; i < saglayicilar.length; i += 1) {
    zincir.push({
      tur: 'saglayici',
      hedef: saglayicilar[i],
      strateji: i === 0 ? 'birincil' : 'yedek'
    });
  }

  if (tip === 'VIDEO' || tip === 'PDF' || tip === 'DEEPSEARCH') {
    zincir.push({ tur: 'isci', hedef: 'CHAT', strateji: 'acil_geri_donus' });
  }

  if (etkinAyar && Array.isArray(etkinAyar.fallbackZinciri)) {
    etkinAyar.fallbackZinciri.forEach(function (adim) {
      zincir.push({
        tur: 'politika',
        hedef: adim,
        strateji: 'ozel_tanim'
      });
    });
  }

  return standartCevapGovdesiOlustur(true, {
    zincir: zincir
  }, null, {});
}

// [MADDE-20] maliyetButcesiniYonet
function maliyetButcesiniYonet(etkinAyar, tahminiMaliyet, baglam, mevcutToplam) {
  var limit = sayiDonustur(etkinAyar && etkinAyar.maliyetSiniri, 1, 0.0001, 1000);
  var toplam = sayiDonustur(mevcutToplam, 0, 0, 100000) + sayiDonustur(tahminiMaliyet, 0, 0, 100000);
  var asildiMi = toplam > limit;

  return standartCevapGovdesiOlustur(!asildiMi, {
    tahminiMaliyet: sayiDonustur(tahminiMaliyet, 0, 0, 100000),
    toplamMaliyet: toplam,
    maliyetSiniri: limit,
    devamEdebilirMi: !asildiMi,
    isKimligi: baglam ? baglam.isKimligi : null
  }, asildiMi ? { mesaj: 'Maliyet bütçesi aşıldı.', kod: 'MALIYET_BUTCESI' } : null, {
    isKimligi: baglam ? baglam.isKimligi : null,
    maliyet: toplam
  });
}

// [MADDE-21] zamanAsimiPolitikasiniUygula
async function zamanAsimiPolitikasiniUygula(islemPromise, etkinAyar, hizmetTuru, baglam) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var timeoutMs = sayiDonustur(etkinAyar && etkinAyar.timeoutMs, VARSAYILAN_TIMEOUT_MS[tip] || 45000, 1000, 300000);

  return await Promise.race([
    islemPromise,
    new Promise(function (_, reddet) {
      setTimeout(function () {
        reddet(new Error('timeout:' + tip + ':' + timeoutMs));
      }, timeoutMs);
    })
  ]);
}

// [MADDE-22] cokAdimliAkisiYonet
async function cokAdimliAkisiYonet(me, baglam, normalizeGirdi, etkinAyar, hizmetTuru) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var adimlar = [];
  var araSonuclar = [];
  var nihaiSonuc = null;

  if (tip === 'PDF') {
    adimlar = ['PDF_HAZIRLA', 'OCR_GEREKIRSE', 'OZETLE'];
  } else if (tip === 'DEEPSEARCH') {
    adimlar = ['ARASTIR', 'OZETLE', 'TTS_SECENEGI'];
  } else {
    adimlar = ['TEK_ADIM'];
  }

  var i = 0;
  for (i = 0; i < adimlar.length; i += 1) {
    if (adimlar[i] === 'PDF_HAZIRLA' || adimlar[i] === 'OZETLE') {
      nihaiSonuc = await pdfApiCagrisiniYurut(me, normalizeGirdi, etkinAyar, baglam);
      araSonuclar.push({ adim: adimlar[i], sonuc: nihaiSonuc.veri || null });
    } else if (adimlar[i] === 'OCR_GEREKIRSE') {
      if (normalizeGirdi && normalizeGirdi.sayfalar && normalizeGirdi.sayfalar.length) {
        var ocr = await ocrApiCagrisiniYurut(me, {
          gorselListesi: normalizeGirdi.sayfalar,
          sayfaSayisi: normalizeGirdi.sayfalar.length
        }, etkinAyar, baglam);
        araSonuclar.push({ adim: adimlar[i], sonuc: ocr.veri || null });
      }
    } else if (adimlar[i] === 'ARASTIR') {
      nihaiSonuc = await derinAramaApiCagrisiniYurut(me, normalizeGirdi, etkinAyar, baglam);
      araSonuclar.push({ adim: adimlar[i], sonuc: nihaiSonuc.veri || null });
    } else if (adimlar[i] === 'TTS_SECENEGI') {
      if (normalizeGirdi && normalizeGirdi.seslendir) {
        var tts = await seslendirmeApiCagrisiniYurut(me, {
          metin: (nihaiSonuc && nihaiSonuc.veri && nihaiSonuc.veri.cikti && (nihaiSonuc.veri.cikti.ozet || nihaiSonuc.veri.cikti.metin)) || normalizeGirdi.sorgu || '',
          dil: normalizeGirdi.dil || 'tr-TR'
        }, etkinAyar, baglam);
        araSonuclar.push({ adim: adimlar[i], sonuc: tts.veri || null });
      }
    }
  }

  return standartCevapGovdesiOlustur(true, {
    adimlar: adimlar,
    araSonuclar: araSonuclar,
    nihaiSonuc: nihaiSonuc ? nihaiSonuc.veri : null
  }, null, {
    isKimligi: baglam ? baglam.isKimligi : null
  });
}

// [MADDE-23] sonucBirlestiriciyiCalistir
function sonucBirlestiriciyiCalistir(hizmetTuru, altSonuclar, baglam) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var cikti = {
    hizmetTuru: tip,
    parcaliSonuclar: [],
    uyarilar: [],
    kalitePuani: 0,
    toplamMaliyet: 0
  };

  (altSonuclar || []).forEach(function (sonuc) {
    if (!sonuc) {
      return;
    }

    if (sonuc.ok && sonuc.veri) {
      cikti.parcaliSonuclar.push(sonuc.veri);
    } else if (sonuc.hata) {
      cikti.uyarilar.push(sonuc.hata);
    }

    if (sonuc.meta && sonuc.meta.maliyet) {
      cikti.toplamMaliyet += sayiDonustur(sonuc.meta.maliyet, 0, 0, 100000);
    }
  });

  var kalite = sonucKalitesiniPuanla(tip, { cikti: cikti }, { fallbackKullanildiMi: cikti.uyarilar.length > 0 });
  cikti.kalitePuani = kalite.veri.kalitePuani;

  if (tip === 'CHAT') {
    cikti.birlesikMetin = cikti.parcaliSonuclar.map(function (oge) {
      return oge.cikti && oge.cikti.metin ? oge.cikti.metin : '';
    }).join('\n\n');
  } else if (tip === 'PDF' || tip === 'DEEPSEARCH') {
    cikti.birlesikOzet = cikti.parcaliSonuclar.map(function (oge) {
      if (oge.cikti && oge.cikti.ozet) {
        return oge.cikti.ozet;
      }
      return '';
    }).filter(Boolean).join('\n\n');
  }

  return standartCevapGovdesiOlustur(true, cikti, null, {
    isKimligi: baglam ? baglam.isKimligi : null,
    maliyet: cikti.toplamMaliyet
  });
}

// [MADDE-24] iptalVeDuraklatmaKarariniVer
function iptalVeDuraklatmaKarariniVer(durum, hataOzeti, maliyetDurumu, baglam) {
  var karar = 'devam';
  var neden = 'sorun_yok';

  if (durum === 'kullanici_iptali') {
    karar = 'iptal';
    neden = 'kullanici_iptal_etti';
  } else if (maliyetDurumu && maliyetDurumu.ok === false) {
    karar = 'iptal';
    neden = 'butce_asimi';
  } else if (hataOzeti && hataOzeti.kod === 'yetki_hatasi') {
    karar = 'iptal';
    neden = 'yetki_hatasi';
  } else if (hataOzeti && hataOzeti.kod === 'zaman_asimi_hatasi') {
    karar = 'duraklat';
    neden = 'zaman_asimi';
  }

  return standartCevapGovdesiOlustur(true, {
    karar: karar,
    neden: neden,
    isKimligi: baglam ? baglam.isKimligi : null
  }, null, {});
}

// [MADDE-25] isKaydiBaslat
async function isKaydiBaslat(me, baglam, etkinAyar, istekOzeti) {
  var kayit = {
    isKimligi: baglam.isKimligi,
    hizmetTuru: baglam.hizmetTuru,
    kullaniciKimligi: baglam.kullaniciKimligi,
    baslangicZamani: baglam.zamanDamgasi,
    durum: 'basladi',
    saglayiciPlani: {
      saglayici: etkinAyar.saglayici,
      model: etkinAyar.model,
      timeoutMs: etkinAyar.timeoutMs
    },
    istekOzeti: {
      imza: benzersizImzaUret(JSON.stringify(istekOzeti || {})),
      kisa: metniKirp(JSON.stringify(istekOzeti || {}), 320)
    }
  };

  await depoyaYaz(me, depoAnahtariUret('is', baglam.isKimligi), kayit);
  return standartCevapGovdesiOlustur(true, kayit, null, { isKimligi: baglam.isKimligi });
}

// [MADDE-26] isDurumunuGuncelle
async function isDurumunuGuncelle(me, isKimligi, yeniDurum, ayrintilar) {
  var anahtar = depoAnahtariUret('is', isKimligi);
  var mevcut = await depodanOku(me, anahtar, {});
  mevcut = nesneMi(mevcut) ? mevcut : {};
  mevcut.durum = yeniDurum;
  mevcut.sonGuncelleme = simdiIso();
  mevcut.yuzde = sayiDonustur(ayrintilar && ayrintilar.yuzde, mevcut.yuzde || 0, 0, 100);
  mevcut.aktifAdim = ayrintilar && ayrintilar.aktifAdim ? ayrintilar.aktifAdim : (mevcut.aktifAdim || '');
  mevcut.sonMesaj = ayrintilar && ayrintilar.sonMesaj ? ayrintilar.sonMesaj : (mevcut.sonMesaj || '');
  mevcut.saglayici = ayrintilar && ayrintilar.saglayici ? ayrintilar.saglayici : (mevcut.saglayici || '');
  mevcut.hataOzeti = ayrintilar && ayrintilar.hataOzeti ? ayrintilar.hataOzeti : (mevcut.hataOzeti || null);
  await depoyaYaz(me, anahtar, mevcut);

  return standartCevapGovdesiOlustur(true, mevcut, null, { isKimligi: isKimligi });
}

// [MADDE-27] isGecmisineKaydet
async function isGecmisineKaydet(me, isKimligi, olay, veri) {
  var anahtar = depoAnahtariUret('gecmis', isKimligi);
  var gecmis = await depodanOku(me, anahtar, []);
  gecmis = Array.isArray(gecmis) ? gecmis : [];
  gecmis.push({
    olayKimligi: olayKimligiUret('gecmis', { isKimligi: isKimligi }),
    olay: olay,
    veri: veri || null,
    zamanDamgasi: simdiIso()
  });

  if (gecmis.length > 200) {
    gecmis = gecmis.slice(gecmis.length - 200);
  }

  await depoyaYaz(me, anahtar, gecmis);
  return standartCevapGovdesiOlustur(true, {
    isKimligi: isKimligi,
    olay: olay,
    toplamKayit: gecmis.length
  }, null, { isKimligi: isKimligi });
}

// [MADDE-28] isDurumuOzetiUret
function isDurumuOzetiUret(kayit, gorunumModu) {
  var veri = nesneMi(kayit) ? kayit : {};
  var mod = String(gorunumModu || 'api').toLowerCase();
  var ozet = {
    isKimligi: veri.isKimligi || null,
    durum: veri.durum || 'bilinmiyor',
    yuzde: sayiDonustur(veri.yuzde, 0, 0, 100),
    aktifAdim: veri.aktifAdim || '',
    sonHata: veri.hataOzeti || null,
    tahminiBitis: veri.tahminiBitis || null,
    sonGuncelleme: veri.sonGuncelleme || veri.baslangicZamani || null
  };

  if (mod === 'panel') {
    ozet.kisaMetin = 'Durum: ' + ozet.durum + ' · %' + ozet.yuzde + ' · Adım: ' + (ozet.aktifAdim || '-');
  }

  return standartCevapGovdesiOlustur(true, ozet, null, { isKimligi: veri.isKimligi || null });
}

// [MADDE-29] kuyruktaBekleyenIsiIzle
async function kuyruktaBekleyenIsiIzle(me, isKimligi) {
  var kayit = await depodanOku(me, depoAnahtariUret('is', isKimligi), {});
  var guncel = nesneMi(kayit) ? kayit : {};

  if (guncel.durum === 'queued' || guncel.durum === 'kuyrukta') {
    guncel.durum = 'isleniyor';
    guncel.yuzde = Math.max(10, sayiDonustur(guncel.yuzde, 0, 0, 100));
    guncel.aktifAdim = guncel.aktifAdim || 'sağlayıcı durum sorgusu';
    guncel.sonMesaj = 'Kuyruktaki iş güncellendi.';
    guncel.sonGuncelleme = simdiIso();
    await depoyaYaz(me, depoAnahtariUret('is', isKimligi), guncel);
  }

  return standartCevapGovdesiOlustur(true, guncel, null, { isKimligi: isKimligi });
}

// [MADDE-30] gecmisVeSonucArsiviniHazirla
async function gecmisVeSonucArsiviniHazirla(me, isKimligi, nihaiSonuc) {
  var kayit = await depodanOku(me, depoAnahtariUret('is', isKimligi), {});
  var gecmis = await depodanOku(me, depoAnahtariUret('gecmis', isKimligi), []);
  var arsiv = {
    isKimligi: isKimligi,
    durum: kayit && kayit.durum ? kayit.durum : 'tamamlandi',
    baslangicZamani: kayit && kayit.baslangicZamani ? kayit.baslangicZamani : null,
    bitisZamani: simdiIso(),
    hizmetTuru: kayit && kayit.hizmetTuru ? kayit.hizmetTuru : null,
    sonMesaj: kayit && kayit.sonMesaj ? kayit.sonMesaj : '',
    sonuc: nihaiSonuc || null,
    gecmis: Array.isArray(gecmis) ? gecmis.slice(-50) : []
  };

  await depoyaYaz(me, depoAnahtariUret('arsiv', isKimligi), arsiv);
  return standartCevapGovdesiOlustur(true, arsiv, null, { isKimligi: isKimligi });
}

// [MADDE-31] sistemSaglikTaramasiYap
async function sistemSaglikTaramasiYap(me) {
  var mePuter = calisanMePuteriniAl(me);
  var bulgular = [];
  var puan = 100;

  if (!router) {
    bulgular.push({ ad: 'router', durum: 'hata' });
    puan -= 25;
  } else {
    bulgular.push({ ad: 'router', durum: 'ok' });
  }

  if (!mePuter) {
    bulgular.push({ ad: 'me.puter', durum: 'hata' });
    puan -= 35;
  } else {
    bulgular.push({ ad: 'me.puter', durum: 'ok' });
  }

  ['ai.chat', 'ai.txt2img', 'ai.txt2vid', 'ai.txt2speech', 'ai.img2txt'].forEach(function (yol) {
    var durum = mePuterMetodunuAl(me, yol) ? 'ok' : 'uyari';
    bulgular.push({ ad: yol, durum: durum });
    if (durum !== 'ok') {
      puan -= 6;
    }
  });

  var kvTest = await kvVeDurumDeposuTestiYap(me);
  if (!kvTest.ok) {
    puan -= 20;
  }

  return standartCevapGovdesiOlustur(true, {
    saglikPuani: sayiDonustur(puan, 0, 0, 100),
    bulgular: bulgular,
    kv: kvTest.veri || null
  }, null, {});
}

// [MADDE-32] hizmetBazliTeshisYap
async function hizmetBazliTeshisYap(me, hizmetTuru) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var testler = [];
  var sonuc = null;

  if (tip === 'CHAT') {
    sonuc = hizmetYetkinliginiKontrolEt(me, { saglayici: 'auto' }, 'CHAT');
    testler.push({ ad: 'chat_yetkinlik', sonuc: sonuc.ok ? 'ok' : 'uyari' });
  } else if (tip === 'IMG') {
    sonuc = hizmetYetkinliginiKontrolEt(me, { saglayici: 'auto' }, 'IMG');
    testler.push({ ad: 'img_yetkinlik', sonuc: sonuc.ok ? 'ok' : 'uyari' });
  } else if (tip === 'VIDEO') {
    sonuc = hizmetYetkinliginiKontrolEt(me, { saglayici: 'auto' }, 'VIDEO');
    testler.push({ ad: 'video_yetkinlik', sonuc: sonuc.ok ? 'ok' : 'uyari' });
  } else if (tip === 'PDF') {
    testler.push({ ad: 'pdf_orkestra', sonuc: 'ok' });
  } else {
    testler.push({ ad: 'genel', sonuc: 'ok' });
  }

  return standartCevapGovdesiOlustur(true, {
    hizmetTuru: tip,
    testler: testler,
    yetkinlik: sonuc ? sonuc.veri : null
  }, null, {});
}

// [MADDE-33] saglayiciErisimTestiYap
async function saglayiciErisimTestiYap(me, saglayici, hizmetTuru) {
  var tip = String(hizmetTuru || 'CHAT').toUpperCase();
  var saglayiciAdi = String(saglayici || 'auto').toLowerCase();
  var destek = true;
  var ayrinti = {};

  if (tip === 'CHAT') {
    destek = !!mePuterMetodunuAl(me, 'ai.chat');
    ayrinti.gerekliMetot = 'ai.chat';
  } else if (tip === 'IMG') {
    destek = !!mePuterMetodunuAl(me, 'ai.txt2img');
    ayrinti.gerekliMetot = 'ai.txt2img';
  } else if (tip === 'VIDEO') {
    destek = !!mePuterMetodunuAl(me, 'ai.txt2vid');
    ayrinti.gerekliMetot = 'ai.txt2vid';
  } else if (tip === 'TTS') {
    destek = !!mePuterMetodunuAl(me, 'ai.txt2speech');
    ayrinti.gerekliMetot = 'ai.txt2speech';
  } else if (tip === 'OCR') {
    destek = !!mePuterMetodunuAl(me, 'ai.img2txt');
    ayrinti.gerekliMetot = 'ai.img2txt';
  } else {
    destek = true;
    ayrinti.gerekliMetot = 'orkestra';
  }

  return standartCevapGovdesiOlustur(destek, {
    saglayici: saglayiciAdi,
    hizmetTuru: tip,
    erisilebilirMi: destek,
    ayrinti: ayrinti
  }, destek ? null : { mesaj: 'Sağlayıcı erişimi doğrulanamadı.' }, {});
}

// [MADDE-34] kvVeDurumDeposuTestiYap
async function kvVeDurumDeposuTestiYap(me) {
  var anahtar = depoAnahtariUret('test', olayKimligiUret('kv', {}));
  var deger = { zaman: simdiIso(), deger: 'ok' };
  var yazildi = await depoyaYaz(me, anahtar, deger, saniyeDamgasiAl() + 120);
  var okundu = await depodanOku(me, anahtar, null);
  var silindi = await depodanSil(me, anahtar);

  var basarili = !!(yazildi && okundu && silindi);

  return standartCevapGovdesiOlustur(basarili, {
    anahtar: anahtar,
    yazma: !!yazildi,
    okuma: !!okundu,
    silme: !!silindi
  }, basarili ? null : { mesaj: 'KV/depo testi başarısız.' }, {});
}

// [MADDE-35] fallbackMekanizmasiniSinamaYap
function fallbackMekanizmasiniSinamaYap(hizmetTuru, etkinAyar) {
  var oncelik = ['birincil', 'yedek-1', 'yedek-2'];
  var zincir = fallbackZinciriniKur(hizmetTuru, oncelik, etkinAyar).veri.zincir;
  var hata = new Error('provider unavailable');
  var deneme = yenidenDenemeKarariniVer(hata, hizmetTuru, 0, etkinAyar).veri;

  return standartCevapGovdesiOlustur(true, {
    hizmetTuru: hizmetTuru,
    zincir: zincir,
    yenidenDeneme: deneme,
    yonDegisimiOlustuMu: deneme.yenidenDenensinMi && zincir.length > 1
  }, null, {});
}

// [MADDE-36] gecikmeVeSureAnaliziYap
async function gecikmeVeSureAnaliziYap(me, isKimligi) {
  var kayit = await depodanOku(me, depoAnahtariUret('is', isKimligi), {});
  var gecmis = await depodanOku(me, depoAnahtariUret('gecmis', isKimligi), []);
  var sureler = [];
  var oncekiZaman = null;

  (gecmis || []).forEach(function (oge) {
    var zaman = Date.parse(oge.zamanDamgasi || simdiIso());
    if (oncekiZaman != null) {
      sureler.push(zaman - oncekiZaman);
    }
    oncekiZaman = zaman;
  });

  var ortalama = 0;
  if (sureler.length) {
    ortalama = Math.round(sureler.reduce(function (a, b) { return a + b; }, 0) / sureler.length);
  }

  return standartCevapGovdesiOlustur(true, {
    isKimligi: isKimligi,
    toplamSureMs: kayit && kayit.baslangicZamani ? Math.max(0, Date.now() - Date.parse(kayit.baslangicZamani)) : 0,
    adimSureleriMs: sureler,
    ortalamaAdimSuresiMs: ortalama,
    timeoutRiski: ortalama > 15000 ? 'yuksek' : (ortalama > 5000 ? 'orta' : 'dusuk')
  }, null, { isKimligi: isKimligi });
}

// [MADDE-37] maliyetSapmasiniAnalizEt
function maliyetSapmasiniAnalizEt(tahmin, gercek, hizmetTuru) {
  var tahmini = sayiDonustur(tahmin, 0, 0, 100000);
  var gercekMaliyet = sayiDonustur(gercek, 0, 0, 100000);
  var fark = gercekMaliyet - tahmini;
  var oran = tahmini > 0 ? (fark / tahmini) : 0;

  return standartCevapGovdesiOlustur(true, {
    hizmetTuru: hizmetTuru,
    tahminiMaliyet: tahmini,
    gercekMaliyet: gercekMaliyet,
    sapma: Number(fark.toFixed(6)),
    sapmaOrani: Number(oran.toFixed(4)),
    risk: Math.abs(oran) > 0.5 ? 'yuksek' : (Math.abs(oran) > 0.2 ? 'orta' : 'dusuk')
  }, null, {});
}

// [MADDE-38] tanisalRaporUret
function tanisalRaporUret(saglikSonucu, hizmetTeshisleri, ekAnalizler, gorunum) {
  var gorunumModu = String(gorunum || 'gelistirici').toLowerCase();
  var sorunlar = [];
  var oneriler = [];

  if (saglikSonucu && saglikSonucu.veri && saglikSonucu.veri.saglikPuani < 80) {
    sorunlar.push('Genel sağlık puanı düşük.');
    oneriler.push('KV ve me.puter metot erişimlerini doğrula.');
  }

  (hizmetTeshisleri || []).forEach(function (oge) {
    if (oge && oge.veri && oge.veri.testler) {
      oge.veri.testler.forEach(function (test) {
        if (test.sonuc !== 'ok') {
          sorunlar.push(oge.veri.hizmetTuru + ' -> ' + test.ad);
        }
      });
    }
  });

  if ((ekAnalizler || []).length) {
    oneriler.push('Gecikme ve maliyet sapması raporlarını periyodik izle.');
  }

  var rapor = {
    gorunum: gorunumModu,
    sorunlar: sorunlar,
    oneriler: oneriler,
    ozet: sorunlar.length ? 'Düzeltme gereken alanlar var.' : 'Kritik sorun tespit edilmedi.',
    saglikPuani: saglikSonucu && saglikSonucu.veri ? saglikSonucu.veri.saglikPuani : null
  };

  if (gorunumModu === 'panel') {
    rapor.kartlar = [
      { baslik: 'Sağlık', deger: rapor.saglikPuani },
      { baslik: 'Sorun', deger: sorunlar.length },
      { baslik: 'Öneri', deger: oneriler.length }
    ];
  }

  return standartCevapGovdesiOlustur(true, rapor, null, {});
}

// [MADDE-46] panelIcinKisaDurumHazirla
function panelIcinKisaDurumHazirla(saglikSonucu, aktifIsler, sonHata) {
  var saglikPuani = saglikSonucu && saglikSonucu.veri ? saglikSonucu.veri.saglikPuani : 0;
  return standartCevapGovdesiOlustur(true, {
    aktifIsSayisi: sayiDonustur(aktifIsler, 0, 0, 100000),
    sonHata: sonHata || null,
    genelSaglikPuani: saglikPuani,
    durum: saglikPuani >= 85 ? 'iyi' : (saglikPuani >= 60 ? 'izlenmeli' : 'kritik')
  }, null, {});
}

// [MADDE-16] orkestrayiBaslat
async function orkestrayiBaslat(me, baglam, normalizeGirdi, etkinAyar, hizmetTuru) {
  var tip = String(hizmetTuru || '').toUpperCase();
  var secim = uygunIsciyiSec(tip, etkinAyar).veri;
  var oncelik = await saglayiciOnceliginiBelirle(me, tip, etkinAyar, baglam);
  var zincir = fallbackZinciriniKur(tip, oncelik.veri.siraliSaglayicilar, etkinAyar).veri.zincir;
  var tahmin = tahminiMaliyetHesapla(tip, normalizeGirdi, etkinAyar);
  var maliyetDurumu = maliyetButcesiniYonet(etkinAyar, tahmin, baglam, 0);

  if (!maliyetDurumu.ok) {
    return maliyetDurumu;
  }

  return standartCevapGovdesiOlustur(true, {
    hizmetTuru: tip,
    secim: secim,
    saglayiciOnceligi: oncelik.veri,
    fallbackZinciri: zincir,
    tahminiMaliyet: tahmin
  }, null, {
    isKimligi: baglam.isKimligi,
    maliyet: tahmin
  });
}

// [MADDE-47] tumSistemiKoordineEt
async function tumSistemiKoordineEt(me, request, girdi) {
  var hizmetSonucu = hizmetTurunuCozumle(girdi);
  var hizmetTuru = hizmetSonucu.veri.hizmetTuru;
  var baglamSonucu = istekBaglaminiHazirla(request, girdi, hizmetTuru);
  var baglam = baglamSonucu.veri;
  var varsayilanAyarlar = {
    kaliteSeviyesi: 'medium',
    maliyetSiniri: 1,
    timeoutMs: VARSAYILAN_TIMEOUT_MS[hizmetTuru] || 45000,
    denemeSiniri: 2
  };

  var dogrulama = guvenliGirdiDogrula(girdi, hizmetTuru);
  if (!dogrulama.ok) {
    return dogrulama;
  }

  var etkinAyarSonucu = etkinAyariOlustur(request, varsayilanAyarlar, girdi || {}, hizmetTuru, {
    maliyetSiniri: girdi && girdi.maliyetSiniri ? girdi.maliyetSiniri : 1,
    azamiTimeoutMs: 300000,
    izinliKaliteSeviyeleri: ['low', 'medium', 'high']
  });

  var etkinAyar = etkinAyarSonucu.veri;
  var yetkinlik = hizmetYetkinliginiKontrolEt(me, etkinAyar, hizmetTuru);

  await isKaydiBaslat(me, baglam, etkinAyar, dogrulama.veri.girdi);
  await isGecmisineKaydet(me, baglam.isKimligi, 'is_basladi', { hizmetTuru: hizmetTuru });
  await isDurumunuGuncelle(me, baglam.isKimligi, 'hazirlaniyor', {
    yuzde: 5,
    aktifAdim: 'doğrulama',
    sonMesaj: 'Girdi doğrulandı.'
  });

  if (!yetkinlik.ok && hizmetTuru !== 'PDF' && hizmetTuru !== 'DEEPSEARCH') {
    await isDurumunuGuncelle(me, baglam.isKimligi, 'basarisiz', {
      yuzde: 100,
      aktifAdim: 'yetkinlik',
      hataOzeti: yetkinlik.hata
    });
    return yetkinlik;
  }

  var orkestra = await orkestrayiBaslat(me, baglam, dogrulama.veri.girdi, etkinAyar, hizmetTuru);
  if (!orkestra.ok) {
    await isDurumunuGuncelle(me, baglam.isKimligi, 'basarisiz', {
      yuzde: 100,
      aktifAdim: 'orkestra',
      hataOzeti: orkestra.hata
    });
    return orkestra;
  }

  await isDurumunuGuncelle(me, baglam.isKimligi, 'isleniyor', {
    yuzde: 20,
    aktifAdim: 'işçi seçimi',
    sonMesaj: 'Uygun işçi seçildi.',
    saglayici: etkinAyar.saglayici
  });

  var sonuclar = [];
  var denemeSayisi = 0;
  var anaSonuc = null;
  var islem = null;
  var hata = null;
  var yeniden = { yenidenDenensinMi: false };

  while (denemeSayisi <= etkinAyar.denemeSiniri) {
    try {
      if (hizmetTuru === 'CHAT') {
        islem = sohbetApiCagrisiniYurut(me, dogrulama.veri.girdi, etkinAyar, baglam);
      } else if (hizmetTuru === 'IMG') {
        islem = gorselApiCagrisiniYurut(me, dogrulama.veri.girdi, etkinAyar, baglam);
      } else if (hizmetTuru === 'VIDEO') {
        islem = videoApiCagrisiniYurut(me, dogrulama.veri.girdi, etkinAyar, baglam);
      } else if (hizmetTuru === 'TTS') {
        islem = seslendirmeApiCagrisiniYurut(me, dogrulama.veri.girdi, etkinAyar, baglam);
      } else if (hizmetTuru === 'OCR') {
        islem = ocrApiCagrisiniYurut(me, dogrulama.veri.girdi, etkinAyar, baglam);
      } else if (hizmetTuru === 'PDF' || hizmetTuru === 'DEEPSEARCH') {
        islem = cokAdimliAkisiYonet(me, baglam, dogrulama.veri.girdi, etkinAyar, hizmetTuru);
      } else {
        islem = sohbetApiCagrisiniYurut(me, dogrulama.veri.girdi, etkinAyar, baglam);
      }

      anaSonuc = await zamanAsimiPolitikasiniUygula(islem, etkinAyar, hizmetTuru, baglam);
      sonuclar.push(anaSonuc);
      hata = null;
      break;
    } catch (yakalananHata) {
      hata = yakalananHata;
      yeniden = yenidenDenemeKarariniVer(yakalananHata, hizmetTuru, denemeSayisi, etkinAyar).veri;
      await isGecmisineKaydet(me, baglam.isKimligi, 'hata', {
        deneme: denemeSayisi,
        hata: guvenliHataOzetiUret(yakalananHata, 'gelistirici').veri
      });

      if (!yeniden.yenidenDenensinMi) {
        break;
      }

      denemeSayisi += 1;
      await isDurumunuGuncelle(me, baglam.isKimligi, 'yeniden_denemede', {
        yuzde: Math.min(60, 20 + (denemeSayisi * 10)),
        aktifAdim: 'yeniden deneme',
        sonMesaj: 'Geçici hata nedeniyle yeniden deneniyor.'
      });
    }
  }

  if (hata && !anaSonuc) {
    var hataOzeti = guvenliHataOzetiUret(hata, 'gelistirici').veri;
    var iptalKarari = iptalVeDuraklatmaKarariniVer('hata', hataOzeti, null, baglam).veri;
    await isDurumunuGuncelle(me, baglam.isKimligi, iptalKarari.karar === 'duraklat' ? 'duraklatildi' : 'basarisiz', {
      yuzde: 100,
      aktifAdim: 'sonlandırma',
      hataOzeti: hataOzeti,
      sonMesaj: iptalKarari.neden
    });
    return standartCevapGovdesiOlustur(false, null, hataOzeti, {
      isKimligi: baglam.isKimligi
    });
  }

  await isDurumunuGuncelle(me, baglam.isKimligi, 'tamamlandi', {
    yuzde: 100,
    aktifAdim: 'tamamlandı',
    sonMesaj: 'İş başarıyla tamamlandı.',
    saglayici: etkinAyar.saglayici
  });
  await isGecmisineKaydet(me, baglam.isKimligi, 'tamamlandi', {
    denemeSayisi: denemeSayisi,
    kalite: sonucKalitesiniPuanla(hizmetTuru, anaSonuc && anaSonuc.veri ? anaSonuc.veri : {}, { fallbackKullanildiMi: denemeSayisi > 0 }).veri
  });

  var birlesik = sonucBirlestiriciyiCalistir(hizmetTuru, sonuclar, baglam);
  await gecmisVeSonucArsiviniHazirla(me, baglam.isKimligi, birlesik.veri);

  return standartCevapGovdesiOlustur(true, {
    baglam: baglam,
    etkinAyar: etkinAyar,
    orkestra: orkestra.veri,
    sonuc: birlesik.veri
  }, null, {
    isKimligi: baglam.isKimligi,
    maliyet: birlesik.meta.maliyet,
    sureMs: sayiDamgasiAl() - baglam.baslangicZamani
  });
}

// [MADDE-48] aiaiSinifGorevOzetiniOlustur
function aiaiSinifGorevOzetiniOlustur() {
  var siniflar = [
    {
      sinifAdi: 'API ÇAĞIRAN İŞÇİLER',
      sinifKodu: 'SINIF-1',
      maddeSayisi: 10,
      maddeler: [
        'CHAT çağrısını ayar+girdiyle çalıştır; metin+token kullanımını normalize et.',
        'IMG üretimini prompt+oran+kaliteyle yürüt; URL/çıktıyı tek modele çevir.',
        'VIDEO işini başlat; jobId/durum/ara takibi ortak katmanda tut.',
        'TTS isteğini ses+dil+hız parametresiyle işle; dosya çıktısını standartlaştır.',
        'OCR akışında görseli dillendir; çok sayfayı tek metinde birleştir.',
        'PDF’i belge işi gibi yönet; metin, OCR ve özet adımlarını bağla.',
        'DEEPSEARCH için sorgu planı kur; alt sorgu+kaynak+özet üret.',
        'Hizmete özel filtre uygula; riskli biçim, çözünürlük, süre ve maliyeti kes.',
        'İç sözleşmeyi sağlayıcı gövdesine çevir; alan eşleme ve varsayılanları doldur.',
        'Sağlayıcı yanıtını tek sonuç modeline indir; sync/async farkını sakla.'
      ]
    },
    {
      sinifAdi: 'ORKESTRA ŞEFİ',
      sinifKodu: 'SINIF-3',
      maddeSayisi: 10,
      maddeler: [
        'Etkin ayarı üret; model+saglayıcı+timeout+bütçe kararını tekilleştir.',
        'Uygun işçiyi seç; hizmet sınıfını yürütülebilir iş akışına bağla.',
        'Sağlayıcı önceliği belirle; kalite+hız+maliyet+hata geçmişini dengele.',
        'Fallback zinciri kur; aynı sağlayıcı tekrarını ve yedek geçişi sırala.',
        'Maliyet bütçesini koru; tahmin+gerçek toplamı sınırla.',
        'Timeout politikasını uygula; takılan çağrıyı güvenli kır.',
        'Çok adımlı akışı yönet; PDF→OCR→ÖZET ve ARAMA→ÖZET zincirini koordine et.',
        'Alt sonuçları birleştir; kısmi başarı+uyarı+maliyet+kaliteyi topla.',
        'İptal/duraklat kararını ver; kritik hata ve bütçe taşmasını kes.',
        'Ana orkestrayı başlat; sınıflandırma→yürütme→takip→sonuç hattını sürdür.'
      ]
    },
    {
      sinifAdi: 'İŞ TAKİP UZMANI',
      sinifKodu: 'SINIF-4',
      maddeSayisi: 10,
      maddeler: [
        'İş kaydı başlat; kimlik+zaman+saglayıcı planını kalıcılaştır.',
        'İş durumunu güncelle; yüzde+adım+son mesaj+özet hata alanlarını taşı.',
        'Geçmişe olay yaz; yön değişimi, timeout ve fallback anını kaydet.',
        'Ham kaydı okunur özete çevir; API ve panel görünümünü ayır.',
        'Kuyruktaki işi izle; polling yoğunluğunu düşük tutarak ilerlet.',
        'Tamamlanan işi arşivle; gerekli meta alanları koruyup fazlayı buda.',
        'Aktif adımı işaretle; kullanıcı nerede beklediğini anlasın.',
        'İlerleme yüzdesi üret; çok adımlı işte adım durumunu görünür kıl.',
        'Kullanıcıya okunur durum hazırla; teknik logu sade panele çevir.',
        'Denetim izi koru; iş yaşam döngüsünü sonradan incelemeye hazır tut.'
      ]
    },
    {
      sinifAdi: 'TEST DEDEKTİFİ',
      sinifKodu: 'SINIF-5',
      maddeSayisi: 10,
      maddeler: [
        'Genel sağlık taraması yap; router+me.puter+kritik metotları kontrol et.',
        'Hizmet bazlı teşhis üret; servis özel kırılma noktalarını ayrı test et.',
        'Sağlayıcı erişimini doğrula; config var ama çağrı yok durumunu yakala.',
        'KV/depo testi yap; yazma+okuma+silme zincirini kanıtla.',
        'Fallback mekanizmasını sına; birincil hata verince yedek akıyor mu bak.',
        'Gecikme ve süre analizi çıkar; adım başı beklemeyi ölç.',
        'Maliyet sapmasını incele; tahmin ile gerçek arasındaki farkı işaretle.',
        'Hata sınıfını güvenli belirle; sonraki karar motorunu doğru besle.',
        'Tanısal rapor üret; sorunları önem sırasına koy ve öneri ver.',
        'Kritik sorunları öne çıkar; panelde önce en tehlikeli kırığı göster.'
      ]
    }
  ];

  return standartCevapGovdesiOlustur(true, {
    siniflar: siniflar,
    sinifDisiOrtaklar: [
      'Standart cevap modeli kur; ok+veri+hata+meta omurgasını koru.',
      'İstek bağlamı ve meta hazırla; isKimliği+korelasyon+tanılama alanını sabitle.',
      'Olay kimliği üret; zincir içi çağrıları birbirine bağla.',
      'Güvenli hata özeti üret; iç ayrıntıyı sızdırmadan anlam ver.',
      'Kalite+maliyet+süre+iş kaydı omurgasını sınıflar arasında ortaklaştır.'
    ]
  }, null, {});
}

// [MADDE-49] kokEndpointAiaiTumuCevabiniUret
function kokEndpointAiaiTumuCevabiniUret() {
  var ozet = aiaiSinifGorevOzetiniOlustur().veri;

  return standartCevapGovdesiOlustur(true, {
    dosya: DOSYA_ADI,
    mesaj: 'Bu dosya AMG ile uyumlu API çağırma, orkestrasyon, iş durumu ve teşhis çekirdeğidir.',
    format: 'AIAI',
    sinifSayisi: 4,
    siniflar: ozet.siniflar,
    sinifDisiOrtaklar: ozet.sinifDisiOrtaklar,
    zamanDamgasi: simdiIso()
  }, null, {});
}

// [MADDE-50] kokEndpointiTumuGibiCalistir
function kokEndpointiTumuGibiCalistir(request) {
  try {
    var govde = kokEndpointAiaiTumuCevabiniUret();
    return yanitDondur(request, govde, 200);
  } catch (hata) {
    return yanitDondur(request, standartCevapGovdesiOlustur(false, null, guvenliHataOzetiUret(hata, 'panel').veri, {
      teshis: 'kok_endpoint'
    }), 500);
  }
}

async function ispatOzetiHazirla(me) {
  var saglik = await sistemSaglikTaramasiYap(me);
  var panel = panelIcinKisaDurumHazirla(saglik, 0, null);
  return standartCevapGovdesiOlustur(true, {
    dosya: DOSYA_ADI,
    surum: SURUM,
    saglik: saglik.veri,
    panel: panel.veri
  }, null, {});
}

router.options('/*yol', async function (olay) {
  return secenekIsteginiYanitla(olay.request);
});

router.get('/', async function (olay) {
  return kokEndpointiTumuGibiCalistir(olay.request);
});

router.get('/tumu', async function (olay) {
  return kokEndpointiTumuGibiCalistir(olay.request);
});

router.get('/api/durum', async function (olay) {
  var saglik = await sistemSaglikTaramasiYap(olay.me);
  return basariCevabiUret(olay.request, {
    worker: DOSYA_ADI,
    surum: SURUM,
    durum: saglik.veri && saglik.veri.saglikPuani >= 60 ? 'hazir' : 'uyari',
    saglik: saglik.veri
  }, saglik.meta, 200);
});

router.get('/api/panel', async function (olay) {
  var saglik = await sistemSaglikTaramasiYap(olay.me);
  var panel = panelIcinKisaDurumHazirla(saglik, 0, null);
  return basariCevabiUret(olay.request, panel.veri, panel.meta, 200);
});

router.get('/api/is/:isKimligi', async function (olay) {
  var kayit = await depodanOku(olay.me, depoAnahtariUret('is', olay.params.isKimligi), {});
  var ozet = isDurumuOzetiUret(kayit, 'api');
  return basariCevabiUret(olay.request, ozet.veri, ozet.meta, 200);
});

router.get('/api/is/:isKimligi/gecmis', async function (olay) {
  var gecmis = await depodanOku(olay.me, depoAnahtariUret('gecmis', olay.params.isKimligi), []);
  return basariCevabiUret(olay.request, {
    isKimligi: olay.params.isKimligi,
    gecmis: gecmis
  }, { isKimligi: olay.params.isKimligi }, 200);
});

router.get('/api/is/:isKimligi/arsiv', async function (olay) {
  var arsiv = await depodanOku(olay.me, depoAnahtariUret('arsiv', olay.params.isKimligi), null);
  return basariCevabiUret(olay.request, {
    isKimligi: olay.params.isKimligi,
    arsiv: arsiv
  }, { isKimligi: olay.params.isKimligi }, 200);
});

router.get('/api/is/:isKimligi/izle', async function (olay) {
  var sonuc = await kuyruktaBekleyenIsiIzle(olay.me, olay.params.isKimligi);
  return basariCevabiUret(olay.request, sonuc.veri, sonuc.meta, 200);
});

router.post('/api/calistir', async function (olay) {
  try {
    var govde = await govdeyiCozumle(olay.request);
    if (govde === null) {
      return hataCevabiUret(olay.request, { mesaj: 'Geçersiz JSON gövdesi.' }, { teshis: 'json' }, 400);
    }

    var sonuc = await tumSistemiKoordineEt(olay.me, olay.request, govde);
    return yanitDondur(olay.request, sonuc, sonuc.ok ? 200 : 400);
  } catch (hata) {
    guvenliLogYaz('api/calistir-hatasi', guvenliHataOzetiUret(hata, 'gelistirici').veri);
    return hataCevabiUret(olay.request, guvenliHataOzetiUret(hata, 'panel').veri, { teshis: 'api/calistir' }, 500);
  }
});

router.post('/api/teshis', async function (olay) {
  try {
    var govde = await govdeyiCozumle(olay.request);
    if (govde === null) {
      return hataCevabiUret(olay.request, { mesaj: 'Geçersiz JSON gövdesi.' }, { teshis: 'json' }, 400);
    }

    var hizmetTuru = (govde.hizmetTuru || govde.serviceType || 'CHAT');
    var saglik = await sistemSaglikTaramasiYap(olay.me);
    var hizmet = await hizmetBazliTeshisYap(olay.me, hizmetTuru);
    var saglayici = await saglayiciErisimTestiYap(olay.me, govde.saglayici || 'auto', hizmetTuru);
    var kv = await kvVeDurumDeposuTestiYap(olay.me);
    var fallback = fallbackMekanizmasiniSinamaYap(hizmetTuru, { denemeSiniri: 2, fallbackZinciri: ['yedek', 'guvenli'] });
    var rapor = tanisalRaporUret(saglik, [hizmet], [saglayici, kv, fallback], govde.gorunum || 'gelistirici');

    return basariCevabiUret(olay.request, {
      saglik: saglik.veri,
      hizmet: hizmet.veri,
      saglayici: saglayici.veri,
      kv: kv.veri,
      fallback: fallback.veri,
      rapor: rapor.veri
    }, rapor.meta, 200);
  } catch (hata) {
    return hataCevabiUret(olay.request, guvenliHataOzetiUret(hata, 'panel').veri, { teshis: 'api/teshis' }, 500);
  }
});

router.get('/api/teshis/:hizmetTuru', async function (olay) {
  var hizmet = await hizmetBazliTeshisYap(olay.me, olay.params.hizmetTuru || 'CHAT');
  return basariCevabiUret(olay.request, hizmet.veri, hizmet.meta, 200);
});

router.get('/api/saglayici/:hizmetTuru/:saglayici', async function (olay) {
  var sonuc = await saglayiciErisimTestiYap(olay.me, olay.params.saglayici, olay.params.hizmetTuru);
  return yanitDondur(olay.request, sonuc, sonuc.ok ? 200 : 503);
});

router.get('/api/ispat/ozet', async function (olay) {
  var ozet = await ispatOzetiHazirla(olay.me);
  return basariCevabiUret(olay.request, ozet.veri, ozet.meta, 200);
});
