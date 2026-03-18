function corsBasliklariniHazirla(request) {
  var origin = '';

  try {
    origin = request && request.headers ? request.headers.get('origin') || '' : '';
  } catch (hata) {
    origin = '';
  }

  return {
    'Access-Control-Allow-Origin': origin || '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Istemci-Kimligi, X-Yonetici-Anahtari',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Credentials': origin ? 'true' : 'false',
    'Vary': 'Origin'
  };
}

function jsonBasliklariniHazirla(request, ekBasliklar) {
  var basliklar = Object.assign({}, corsBasliklariniHazirla(request), {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
  });

  if (ekBasliklar && typeof ekBasliklar === 'object') {
    Object.assign(basliklar, ekBasliklar);
  }

  return basliklar;
}

function basariCevabiUret(request, veri, durumKodu) {
  return new Response(JSON.stringify({ ok: true, veri: veri, hata: null }), {
    status: durumKodu || 200,
    headers: jsonBasliklariniHazirla(request)
  });
}

function hataCevabiUret(request, durumKodu, hataMesaji, ekVeri) {
  return new Response(JSON.stringify({
    ok: false,
    veri: ekVeri || null,
    hata: hataMesaji || 'Beklenmeyen bir hata oluştu.'
  }), {
    status: durumKodu || 500,
    headers: jsonBasliklariniHazirla(request)
  });
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
    icerikTuru = request.headers.get('content-type') || '';
  } catch (hata) {
    icerikTuru = '';
  }

  if (icerikTuru.toLowerCase().indexOf('application/json') === -1) {
    return {};
  }

  try {
    return await request.json();
  } catch (hata) {
    return null;
  }
}

function metniKirp(metin, azamiUzunluk) {
  var duzMetin = String(metin == null ? '' : metin);
  if (duzMetin.length <= azamiUzunluk) {
    return duzMetin;
  }
  return duzMetin.slice(0, azamiUzunluk);
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

function dakikayiDamgala() {
  return Math.floor(Date.now() / 60000);
}

function saniyeDamgasiAl() {
  return Math.floor(Date.now() / 1000);
}

function anahtariOlustur(alan, kimlik) {
  var sol = String(alan || '').trim();
  var sag = String(kimlik || '').trim();
  return sol + ':' + sag;
}

async function ayarlariGetir(me) {
  var ayarlar = await me.puter.kv.get('uygulama:ayarlar');
  if (!ayarlar || typeof ayarlar !== 'object') {
    return {};
  }
  return ayarlar;
}

async function ayarlariKaydet(me, ayarlar) {
  await me.puter.kv.set('uygulama:ayarlar', ayarlar || {});
  return true;
}

function ayarlariDisariHazirla(ayarlar) {
  var kopya = Object.assign({}, ayarlar || {});
  delete kopya.gizliYoneticiAnahtari;
  return kopya;
}

function istemciKimliginiCikar(request, user) {
  var kimlik = '';

  try {
    kimlik = request.headers.get('x-istemci-kimligi') || '';
  } catch (hata) {
    kimlik = '';
  }

  if (!kimlik) {
    try {
      kimlik = request.headers.get('origin') || '';
    } catch (hata2) {
      kimlik = '';
    }
  }

  if (!kimlik && user && typeof user === 'object') {
    kimlik = user.id || user.uuid || user.username || user.email || '';
  }

  if (!kimlik) {
    kimlik = 'genel';
  }

  return String(kimlik).slice(0, 160);
}

async function istekSiniriniKontrolEt(me, istemciKimligi, dakikaBasinaSinir) {
  var zamanDamgasi = dakikayiDamgala();
  var anahtar = anahtariOlustur('oran', istemciKimligi + ':' + zamanDamgasi);
  var mevcut = await me.puter.kv.get(anahtar);
  var yeniDeger = sayiDonustur(mevcut, 0, 0, 100000) + 1;

  await me.puter.kv.set(anahtar, yeniDeger, saniyeDamgasiAl() + 120);

  if (yeniDeger > dakikaBasinaSinir) {
    return {
      uygun: false,
      hata: 'İstek sınırı aşıldı. Lütfen kısa süre sonra tekrar dene.'
    };
  }

  return {
    uygun: true,
    sayi: yeniDeger
  };
}

function diziMi(deger) {
  return Array.isArray(deger);
}

function nesneMi(deger) {
  return !!deger && typeof deger === 'object' && !Array.isArray(deger);
}

function bosMu(deger) {
  return String(deger == null ? '' : deger).trim() === '';
}

function rolGecerliMi(rol) {
  return rol === 'system' || rol === 'assistant' || rol === 'user' || rol === 'tool';
}

function yaziIceriginiTopla(icerik) {
  if (typeof icerik === 'string') {
    return icerik;
  }

  if (!Array.isArray(icerik)) {
    return '';
  }

  var birlesik = [];
  var i = 0;

  for (i = 0; i < icerik.length; i += 1) {
    var oge = icerik[i] || {};
    if (oge.type === 'text' && typeof oge.text === 'string') {
      birlesik.push(oge.text);
    }
  }

  return birlesik.join('\n');
}

function mesajIceriginiDogrula(icerik) {
  if (typeof icerik === 'string') {
    if (bosMu(icerik)) {
      return { uygun: false, hata: 'Mesaj içeriği boş olamaz.' };
    }

    if (icerik.length > 12000) {
      return { uygun: false, hata: 'Tek bir mesaj 12.000 karakteri aşamaz.' };
    }

    return { uygun: true, deger: icerik, metinUzunlugu: icerik.length };
  }

  if (!Array.isArray(icerik)) {
    return { uygun: false, hata: 'Mesaj içeriği string veya içerik dizisi olmalıdır.' };
  }

  if (!icerik.length) {
    return { uygun: false, hata: 'Mesaj içerik dizisi boş olamaz.' };
  }

  var duzeltilmis = [];
  var metinUzunlugu = 0;
  var i = 0;

  for (i = 0; i < icerik.length; i += 1) {
    var oge = icerik[i];

    if (!nesneMi(oge)) {
      return { uygun: false, hata: 'Mesaj içerik öğeleri nesne olmalıdır.' };
    }

    if (oge.type === 'text') {
      if (bosMu(oge.text)) {
        return { uygun: false, hata: 'Metin içerik öğesi boş olamaz.' };
      }

      if (String(oge.text).length > 12000) {
        return { uygun: false, hata: 'Tek bir metin içerik öğesi 12.000 karakteri aşamaz.' };
      }

      metinUzunlugu += String(oge.text).length;
      duzeltilmis.push({ type: 'text', text: String(oge.text) });
      continue;
    }

    if (oge.type === 'file') {
      if (bosMu(oge.puter_path)) {
        return { uygun: false, hata: 'Dosya içerik öğesinde puter_path zorunludur.' };
      }

      duzeltilmis.push({ type: 'file', puter_path: String(oge.puter_path) });
      continue;
    }

    return { uygun: false, hata: 'Yalnızca text ve file içerik tipleri desteklenir.' };
  }

  if (metinUzunlugu > 16000) {
    return { uygun: false, hata: 'Bir mesajdaki toplam metin uzunluğu 16.000 karakteri aşamaz.' };
  }

  return { uygun: true, deger: duzeltilmis, metinUzunlugu: metinUzunlugu };
}

function sohbetGovdesiniDogrula(govde) {
  if (!nesneMi(govde)) {
    return { uygun: false, hata: 'İstek gövdesi geçerli JSON nesnesi olmalıdır.' };
  }

  var model = String(govde.model || '').trim();
  var mesajlar = govde.mesajlar;
  var prompt = typeof govde.prompt === 'string' ? govde.prompt.trim() : '';
  var duzeltilmisMesajlar = [];
  var toplamUzunluk = 0;
  var i = 0;

  if (!model) {
    return { uygun: false, hata: 'model alanı zorunludur.' };
  }

  if (!diziMi(mesajlar)) {
    if (!prompt) {
      return { uygun: false, hata: 'mesajlar dizisi veya prompt zorunludur.' };
    }
    mesajlar = [{ role: 'user', content: prompt }];
  }

  if (!mesajlar.length) {
    return { uygun: false, hata: 'mesajlar boş olamaz.' };
  }

  if (mesajlar.length > 40) {
    return { uygun: false, hata: 'En fazla 40 mesaj gönderilebilir.' };
  }

  for (i = 0; i < mesajlar.length; i += 1) {
    var mesaj = mesajlar[i];

    if (!nesneMi(mesaj)) {
      return { uygun: false, hata: 'Her mesaj bir nesne olmalıdır.' };
    }

    var rol = String(mesaj.role || '').trim();
    if (!rolGecerliMi(rol)) {
      return { uygun: false, hata: 'Geçersiz mesaj rolü kullanıldı.' };
    }

    var icerikDogrulama = mesajIceriginiDogrula(mesaj.content);
    if (!icerikDogrulama.uygun) {
      return icerikDogrulama;
    }

    toplamUzunluk += icerikDogrulama.metinUzunlugu;
    duzeltilmisMesajlar.push({ role: rol, content: icerikDogrulama.deger });
  }

  if (toplamUzunluk > 30000) {
    return { uygun: false, hata: 'Toplam mesaj uzunluğu 30.000 karakteri aşamaz.' };
  }

  return {
    uygun: true,
    veri: {
      model: model,
      mesajlar: duzeltilmisMesajlar,
      sicaklik: sayiDonustur(govde.sicaklik, 0.7, 0, 2),
      azamiToken: sayiDonustur(govde.azamiToken || govde.max_tokens, 1200, 1, 4000),
      dusunmeSeviyesi: String(govde.dusunmeSeviyesi || '').trim(),
      metinKisalikSeviyesi: String(govde.metinKisalikSeviyesi || '').trim(),
      webArama: Boolean(govde.webArama),
      istemciKimligi: String(govde.istemciKimligi || '').trim(),
      toplamUzunluk: toplamUzunluk
    }
  };
}

function gorselGovdesiniDogrula(govde) {
  if (!nesneMi(govde)) {
    return { uygun: false, hata: 'İstek gövdesi geçerli JSON nesnesi olmalıdır.' };
  }

  var prompt = String(govde.prompt || '').trim();
  var model = String(govde.model || govde.modelId || '').trim();

  if (!prompt) {
    return { uygun: false, hata: 'prompt zorunludur.' };
  }

  if (prompt.length > 2000) {
    return { uygun: false, hata: 'Görsel promptu 2.000 karakteri aşamaz.' };
  }

  return {
    uygun: true,
    veri: {
      prompt: prompt,
      model: model,
      kalite: String(govde.kalite || 'low').trim(),
      genislik: sayiDonustur(govde.genislik, 1024, 256, 2048),
      yukseklik: sayiDonustur(govde.yukseklik, 1024, 256, 2048),
      adet: sayiDonustur(govde.adet || govde.n, 1, 1, 4),
      testModu: Boolean(govde.testModu || govde.test_mode),
      istemciKimligi: String(govde.istemciKimligi || '').trim()
    }
  };
}

function ayarGirdisiniDogrula(govde) {
  if (!nesneMi(govde)) {
    return { uygun: false, hata: 'İstek gövdesi geçerli JSON nesnesi olmalıdır.' };
  }

  var ayarlar = nesneMi(govde.ayarlar) ? govde.ayarlar : {};
  var yeniYoneticiAnahtari = String(govde.yeniYoneticiAnahtari || '').trim();
  var yoneticiAnahtari = String(govde.yoneticiAnahtari || '').trim();

  if (Object.keys(ayarlar).length === 0 && !yeniYoneticiAnahtari) {
    return { uygun: false, hata: 'Kaydedilecek bir ayar veya yeni yönetici anahtarı gönderilmelidir.' };
  }

  return {
    uygun: true,
    veri: {
      ayarlar: ayarlar,
      yoneticiAnahtari: yoneticiAnahtari,
      yeniYoneticiAnahtari: yeniYoneticiAnahtari
    }
  };
}

function ortakDurumGovdesiniDogrula(govde) {
  if (!nesneMi(govde)) {
    return { uygun: false, hata: 'İstek gövdesi geçerli JSON nesnesi olmalıdır.' };
  }

  if (!nesneMi(govde.durum) && !diziMi(govde.durum) && typeof govde.durum !== 'string' && typeof govde.durum !== 'number' && typeof govde.durum !== 'boolean') {
    return { uygun: false, hata: 'durum alanı zorunludur.' };
  }

  return {
    uygun: true,
    veri: {
      durum: govde.durum,
      yoneticiAnahtari: String(govde.yoneticiAnahtari || '').trim()
    }
  };
}

function onbellekSilGovdesiniDogrula(govde) {
  if (!nesneMi(govde)) {
    return { uygun: false, hata: 'İstek gövdesi geçerli JSON nesnesi olmalıdır.' };
  }

  var anahtar = String(govde.anahtar || '').trim();
  if (!anahtar) {
    return { uygun: false, hata: 'anahtar zorunludur.' };
  }

  if (anahtar.indexOf('onbellek:') !== 0) {
    return { uygun: false, hata: 'Yalnızca onbellek: önekiyle başlayan anahtarlar silinebilir.' };
  }

  return {
    uygun: true,
    veri: {
      anahtar: anahtar,
      yoneticiAnahtari: String(govde.yoneticiAnahtari || '').trim()
    }
  };
}

function yoneticiAnahtariVarMi(ayarlar) {
  return !!String((ayarlar || {}).gizliYoneticiAnahtari || '').trim();
}

async function yoneticiYetkisiniDogrula(me, verilenAnahtar) {
  var ayarlar = await ayarlariGetir(me);
  var beklenen = String(ayarlar.gizliYoneticiAnahtari || '').trim();
  var gelen = String(verilenAnahtar || '').trim();

  if (!beklenen) {
    return { uygun: false, hata: 'Yönetici anahtarı henüz kurulmamış.' };
  }

  if (!gelen || gelen !== beklenen) {
    return { uygun: false, hata: 'Yönetici anahtarı doğrulanamadı.' };
  }

  return { uygun: true, ayarlar: ayarlar };
}

async function ortakDurumuOku(me) {
  var durum = await me.puter.kv.get('ortakveri:durum');
  if (durum == null) {
    return null;
  }
  return durum;
}

async function ortakDurumuYaz(me, durum) {
  await me.puter.kv.set('ortakveri:durum', durum);
  return true;
}

function sohbetSecenekleriniHazirla(sohbetVerisi, akisModu) {
  var secenekler = {
    model: sohbetVerisi.model,
    stream: Boolean(akisModu),
    max_tokens: sohbetVerisi.azamiToken,
    temperature: sohbetVerisi.sicaklik
  };

  if (sohbetVerisi.dusunmeSeviyesi) {
    secenekler.reasoning_effort = sohbetVerisi.dusunmeSeviyesi;
  }

  if (sohbetVerisi.metinKisalikSeviyesi) {
    secenekler.text_verbosity = sohbetVerisi.metinKisalikSeviyesi;
  }

  if (sohbetVerisi.webArama) {
    secenekler.tools = [{ type: 'web_search' }];
  }

  return secenekler;
}

function sohbetYanitiniMetneDonustur(yanit) {
  if (typeof yanit === 'string') {
    return yanit;
  }

  if (yanit && yanit.message && typeof yanit.message.content === 'string') {
    return yanit.message.content;
  }

  if (yanit && typeof yanit.content === 'string') {
    return yanit.content;
  }

  return '';
}

function gorselCiktisiniCozumle(cikti) {
  if (typeof cikti === 'string') {
    return { url: cikti, ham: cikti };
  }

  if (cikti && typeof cikti === 'object') {
    if (typeof cikti.url === 'string') {
      return { url: cikti.url, ham: cikti };
    }
    if (typeof cikti.src === 'string') {
      return { url: cikti.src, ham: cikti };
    }
    if (typeof cikti.image_url === 'string') {
      return { url: cikti.image_url, ham: cikti };
    }
  }

  return { url: '', ham: cikti };
}

function guvenliHataMesajiAl(hata) {
  if (!hata) {
    return 'Beklenmeyen bir hata oluştu.';
  }

  if (typeof hata === 'string') {
    return metniKirp(hata, 500);
  }

  if (typeof hata.message === 'string') {
    return metniKirp(hata.message, 500);
  }

  return 'Beklenmeyen bir hata oluştu.';
}

function guvenliLogYaz(baslik, veri) {
  try {
    console.log('[AMG]', baslik, veri);
  } catch (hata) {
  }
}

function sseSatiriUret(olay, veri) {
  return 'event: ' + olay + '\n' + 'data: ' + JSON.stringify(veri) + '\n\n';
}

function akisDestegiVarMi() {
  return typeof ReadableStream !== 'undefined' && typeof TextEncoder !== 'undefined';
}

async function akisYanitiUret(request, akisUretici) {
  if (!akisDestegiVarMi()) {
    var butunMetin = await akisUretici(false);
    return basariCevabiUret(request, {
      akisaUygunOrtam: false,
      metin: butunMetin
    });
  }

  var kodlayici = new TextEncoder();

  var akim = new ReadableStream({
    async start(denetleyici) {
      try {
        denetleyici.enqueue(kodlayici.encode(sseSatiriUret('hazir', { ok: true, veri: { durum: 'hazir' }, hata: null })));

        var sonuc = await akisUretici(true, function (olay, veri) {
          denetleyici.enqueue(kodlayici.encode(sseSatiriUret(olay, veri)));
        });

        denetleyici.enqueue(kodlayici.encode(sseSatiriUret('bitti', { ok: true, veri: { metin: sonuc || '' }, hata: null })));
        denetleyici.close();
      } catch (hata) {
        denetleyici.enqueue(kodlayici.encode(sseSatiriUret('hata', { ok: false, veri: null, hata: guvenliHataMesajiAl(hata) })));
        denetleyici.close();
      }
    }
  });

  return new Response(akim, {
    status: 200,
    headers: Object.assign({}, corsBasliklariniHazirla(request), {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive'
    })
  });
}

async function sohbetiCalistir(me, sohbetVerisi, akisModu, parcayiYolla) {
  var secenekler = sohbetSecenekleriniHazirla(sohbetVerisi, akisModu);

  if (!akisModu) {
    var yanit = await me.puter.ai.chat(sohbetVerisi.mesajlar, secenekler);
    return sohbetYanitiniMetneDonustur(yanit);
  }

  var akis = await me.puter.ai.chat(sohbetVerisi.mesajlar, secenekler);
  var tumMetin = '';

  for await (var parca of akis) {
    if (parca && typeof parca.text === 'string' && parca.text) {
      tumMetin += parca.text;
      if (typeof parcayiYolla === 'function') {
        parcayiYolla('parca', { ok: true, veri: { metin: parca.text }, hata: null });
      }
      continue;
    }

    if (parca && parca.type === 'tool_use' && typeof parcayiYolla === 'function') {
      parcayiYolla('arac', {
        ok: true,
        veri: {
          ad: String(parca.name || ''),
          girdi: parca.input || null
        },
        hata: null
      });
    }
  }

  return tumMetin;
}

router.options('/*yol', async function ({ request }) {
  return secenekIsteginiYanitla(request);
});

router.get('/api/durum', async function ({ request, me }) {
  try {
    var ayarlar = await ayarlariGetir(me);
    var ortakDurum = await ortakDurumuOku(me);

    return basariCevabiUret(request, {
      servis: 'amg',
      durum: 'hazir',
      mePuterOdakli: true,
      yoneticiKurulu: yoneticiAnahtariVarMi(ayarlar),
      ortakDurumVar: ortakDurum != null,
      zaman: new Date().toISOString()
    });
  } catch (hata) {
    guvenliLogYaz('durum-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.get('/api/modeller', async function ({ request, me }) {
  try {
    var url = new URL(request.url);
    var saglayici = String(url.searchParams.get('saglayici') || '').trim();
    var ara = String(url.searchParams.get('ara') || '').trim().toLowerCase();
    var sinir = sayiDonustur(url.searchParams.get('sinir'), 150, 1, 500);
    var hamModeller = await me.puter.ai.listModels(saglayici || null);
    var modeller = Array.isArray(hamModeller) ? hamModeller : [];

    var duzeltilmis = modeller.map(function (model) {
      return {
        kimlik: model.id || '',
        ad: model.name || model.id || '',
        saglayici: model.provider || '',
        baglam: model.context || null,
        azamiToken: model.max_tokens || null,
        maliyet: model.cost || null,
        takmaAdlar: Array.isArray(model.aliases) ? model.aliases : []
      };
    });

    if (ara) {
      duzeltilmis = duzeltilmis.filter(function (model) {
        var havuz = [model.kimlik, model.ad, model.saglayici].concat(model.takmaAdlar || []).join(' ').toLowerCase();
        return havuz.indexOf(ara) !== -1;
      });
    }

    duzeltilmis = duzeltilmis.slice(0, sinir);

    return basariCevabiUret(request, {
      toplam: duzeltilmis.length,
      modeller: duzeltilmis
    });
  } catch (hata) {
    guvenliLogYaz('model-listesi-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.post('/api/sohbet', async function ({ request, me, user }) {
  try {
    var govde = await govdeyiCozumle(request);
    if (govde === null) {
      return hataCevabiUret(request, 400, 'Geçersiz JSON gövdesi.');
    }

    var dogrulama = sohbetGovdesiniDogrula(govde);
    if (!dogrulama.uygun) {
      return hataCevabiUret(request, 400, dogrulama.hata);
    }

    var sohbetVerisi = dogrulama.veri;
    var istemciKimligi = sohbetVerisi.istemciKimligi || istemciKimliginiCikar(request, user);
    var oranKontrolu = await istekSiniriniKontrolEt(me, istemciKimligi, 12);

    if (!oranKontrolu.uygun) {
      return hataCevabiUret(request, 429, oranKontrolu.hata);
    }

    var metin = await sohbetiCalistir(me, sohbetVerisi, false);
    var onbellekAnahtari = anahtariOlustur('onbellek', 'sohbet:' + Date.now());

    await me.puter.kv.set(onbellekAnahtari, {
      model: sohbetVerisi.model,
      istemciKimligi: istemciKimligi,
      soru: yaziIceriginiTopla(sohbetVerisi.mesajlar[sohbetVerisi.mesajlar.length - 1].content),
      cevap: metniKirp(metin, 12000),
      zaman: new Date().toISOString()
    }, saniyeDamgasiAl() + 3600);

    return basariCevabiUret(request, {
      model: sohbetVerisi.model,
      metin: metin,
      oranSayisi: oranKontrolu.sayi,
      onbellekAnahtari: onbellekAnahtari
    });
  } catch (hata) {
    guvenliLogYaz('sohbet-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.post('/api/sohbet/akis', async function ({ request, me, user }) {
  try {
    var govde = await govdeyiCozumle(request);
    if (govde === null) {
      return hataCevabiUret(request, 400, 'Geçersiz JSON gövdesi.');
    }

    var dogrulama = sohbetGovdesiniDogrula(govde);
    if (!dogrulama.uygun) {
      return hataCevabiUret(request, 400, dogrulama.hata);
    }

    var sohbetVerisi = dogrulama.veri;
    var istemciKimligi = sohbetVerisi.istemciKimligi || istemciKimliginiCikar(request, user);
    var oranKontrolu = await istekSiniriniKontrolEt(me, istemciKimligi, 8);

    if (!oranKontrolu.uygun) {
      return hataCevabiUret(request, 429, oranKontrolu.hata);
    }

    return await akisYanitiUret(request, async function (gercekAkis, olayYayimla) {
      var metin = await sohbetiCalistir(me, sohbetVerisi, gercekAkis, olayYayimla);
      var onbellekAnahtari = anahtariOlustur('onbellek', 'akis:' + Date.now());

      await me.puter.kv.set(onbellekAnahtari, {
        model: sohbetVerisi.model,
        istemciKimligi: istemciKimligi,
        cevap: metniKirp(metin, 12000),
        zaman: new Date().toISOString()
      }, saniyeDamgasiAl() + 3600);

      return metin;
    });
  } catch (hata) {
    guvenliLogYaz('sohbet-akis-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.post('/api/gorsel', async function ({ request, me, user }) {
  try {
    var govde = await govdeyiCozumle(request);
    if (govde === null) {
      return hataCevabiUret(request, 400, 'Geçersiz JSON gövdesi.');
    }

    var dogrulama = gorselGovdesiniDogrula(govde);
    if (!dogrulama.uygun) {
      return hataCevabiUret(request, 400, dogrulama.hata);
    }

    var gorselVerisi = dogrulama.veri;
    var istemciKimligi = gorselVerisi.istemciKimligi || istemciKimliginiCikar(request, user);
    var oranKontrolu = await istekSiniriniKontrolEt(me, istemciKimligi, 4);

    if (!oranKontrolu.uygun) {
      return hataCevabiUret(request, 429, oranKontrolu.hata);
    }

    var secenekler = {
      prompt: gorselVerisi.prompt,
      test_mode: gorselVerisi.testModu,
      quality: gorselVerisi.kalite,
      width: gorselVerisi.genislik,
      height: gorselVerisi.yukseklik,
      n: gorselVerisi.adet
    };

    if (gorselVerisi.model) {
      secenekler.model = gorselVerisi.model;
    }

    var gorselSonucu = await me.puter.ai.txt2img(secenekler);
    var cozumlenmis = gorselCiktisiniCozumle(gorselSonucu);

    await me.puter.kv.set(anahtariOlustur('onbellek', 'gorsel:' + Date.now()), {
      model: gorselVerisi.model || 'varsayilan',
      istemciKimligi: istemciKimligi,
      prompt: metniKirp(gorselVerisi.prompt, 500),
      url: cozumlenmis.url || '',
      zaman: new Date().toISOString()
    }, saniyeDamgasiAl() + 3600);

    return basariCevabiUret(request, {
      model: gorselVerisi.model || null,
      prompt: gorselVerisi.prompt,
      url: cozumlenmis.url,
      ham: cozumlenmis.ham
    });
  } catch (hata) {
    guvenliLogYaz('gorsel-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.get('/api/ayarlar/getir', async function ({ request, me }) {
  try {
    var ayarlar = await ayarlariGetir(me);
    return basariCevabiUret(request, ayarlariDisariHazirla(ayarlar));
  } catch (hata) {
    guvenliLogYaz('ayar-getir-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.post('/api/ayarlar/kaydet', async function ({ request, me }) {
  try {
    var govde = await govdeyiCozumle(request);
    if (govde === null) {
      return hataCevabiUret(request, 400, 'Geçersiz JSON gövdesi.');
    }

    var dogrulama = ayarGirdisiniDogrula(govde);
    if (!dogrulama.uygun) {
      return hataCevabiUret(request, 400, dogrulama.hata);
    }

    var ayarVerisi = dogrulama.veri;
    var mevcutAyarlar = await ayarlariGetir(me);
    var kurulumVar = yoneticiAnahtariVarMi(mevcutAyarlar);

    if (kurulumVar) {
      var yetki = await yoneticiYetkisiniDogrula(me, ayarVerisi.yoneticiAnahtari);
      if (!yetki.uygun) {
        return hataCevabiUret(request, 403, yetki.hata);
      }
    } else {
      if (!ayarVerisi.yeniYoneticiAnahtari || ayarVerisi.yeniYoneticiAnahtari.length < 16) {
        return hataCevabiUret(request, 400, 'İlk kurulum için en az 16 karakterlik yeniYoneticiAnahtari zorunludur.');
      }
    }

    var yeniAyarlar = Object.assign({}, mevcutAyarlar, ayarVerisi.ayarlar);

    if (ayarVerisi.yeniYoneticiAnahtari) {
      yeniAyarlar.gizliYoneticiAnahtari = ayarVerisi.yeniYoneticiAnahtari;
    }

    await ayarlariKaydet(me, yeniAyarlar);

    return basariCevabiUret(request, {
      mesaj: 'Ayarlar kaydedildi.',
      ayarlar: ayarlariDisariHazirla(yeniAyarlar)
    });
  } catch (hata) {
    guvenliLogYaz('ayar-kaydet-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.get('/api/ortak-durum/oku', async function ({ request, me }) {
  try {
    var durum = await ortakDurumuOku(me);
    return basariCevabiUret(request, { durum: durum });
  } catch (hata) {
    guvenliLogYaz('ortak-durum-oku-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.post('/api/ortak-durum/yaz', async function ({ request, me }) {
  try {
    var govde = await govdeyiCozumle(request);
    if (govde === null) {
      return hataCevabiUret(request, 400, 'Geçersiz JSON gövdesi.');
    }

    var dogrulama = ortakDurumGovdesiniDogrula(govde);
    if (!dogrulama.uygun) {
      return hataCevabiUret(request, 400, dogrulama.hata);
    }

    var yetki = await yoneticiYetkisiniDogrula(me, dogrulama.veri.yoneticiAnahtari);
    if (!yetki.uygun) {
      return hataCevabiUret(request, 403, yetki.hata);
    }

    await ortakDurumuYaz(me, dogrulama.veri.durum);

    return basariCevabiUret(request, {
      mesaj: 'Ortak durum güncellendi.',
      durum: dogrulama.veri.durum
    });
  } catch (hata) {
    guvenliLogYaz('ortak-durum-yaz-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});
router.post('/api/onbellek/sil', async function ({ request, me }) {
  try {
    var govde = await govdeyiCozumle(request);
    if (govde === null) {
      return hataCevabiUret(request, 400, 'Geçersiz JSON gövdesi.');
    }

    var dogrulama = onbellekSilGovdesiniDogrula(govde);
    if (!dogrulama.uygun) {
      return hataCevabiUret(request, 400, dogrulama.hata);
    }

    var yetki = await yoneticiYetkisiniDogrula(me, dogrulama.veri.yoneticiAnahtari);
    if (!yetki.uygun) {
      return hataCevabiUret(request, 403, yetki.hata);
    }

    await me.puter.kv.del(dogrulama.veri.anahtar);

    return basariCevabiUret(request, {
      mesaj: 'Önbellek kaydı silindi.',
      anahtar: dogrulama.veri.anahtar
    });
  } catch (hata) {
    guvenliLogYaz('onbellek-sil-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});
function tumOzetiOlustur(me) {
  var kullanilabilirMePuter =
    (me && me.puter) ||
    (globalThis.me && globalThis.me.puter) ||
    null;

  var amacMaddeleri = [
    '1. Ortak uygulama ayarlarini merkezi olarak sunmak.',
    '2. me.puter uzerinden ortak veriyi guvenli sekilde yonetmek.',
    '3. Ortak anahtar-deger verilerini depolamak ve okumak.',
    '4. Uygulama seviyesinde onbellek kullanmak.',
    '5. Gerektiginde onbellek kayitlarini temizlemek.',
    '6. Yonetici kontrollu islemleri tek merkezde toplamak.',
    '7. Frontend icin duzenli JSON cevaplari saglamak.',
    '8. Uygulama durumunu tek endpointten gostermek.',
    '9. Calisma testi icin hizli kontrol endpointleri sunmak.',
    '10. Saglik kontrolu ile runtime durumunu gostermek.',
    '11. me.puter kaynaklarina dayali servis mantigini calistirmak.',
    '12. Uygulama sahibinin hesabiyla ortak operasyonlari yurutmek.',
    '13. Ortak ayarlarin istemciler tarafindan okunabilmesini saglamak.',
    '14. Gerekli oldugunda yonetici anahtari ile korumali islem yapmak.',
    '15. Tutarli hata cevabi uretmek.',
    '16. Tutarli basari cevabi uretmek.',
    '17. Hassas olmayan guvenli log kayitlari olusturmak.',
    '18. Ortak veri yapisini daginiklik olmadan tek workerda toplamak.',
    '19. Test, durum ve amac endpointleri ile debug surecini kolaylastirmak.',
    '20. AMS sisteminin Puter Worker katmanini merkezi servis noktasi olarak calistirmak.'
  ];

  var tanimliYollar = [
    '/',
    '/tumu',
    '/api',
    '/api/test/calisiyor',
    '/api/test/saglik',
    '/api/test/me-puter',
    '/api/amac'
  ];

  var tanimliFonksiyonlar = [
    'tumOzetiOlustur',
    'govdeyiCozumle',
    'hataCevabiUret',
    'basariCevabiUret',
    'guvenliLogYaz',
    'guvenliHataMesajiAl',
    'onbellekSilGovdesiniDogrula',
    'yoneticiYetkisiniDogrula'
  ];

  var handlerUzerindenMeVarMi = !!(me && me.puter);
  var globalUzerindenMeVarMi = !!(globalThis.me && globalThis.me.puter);

  var mePuterKaynakTuru = 'yok';
  if (handlerUzerindenMeVarMi) {
    mePuterKaynakTuru = 'handler-uzerinden';
  } else if (globalUzerindenMeVarMi) {
    mePuterKaynakTuru = 'global-uzerinden';
  }

  return {
    mesaj: 'AMS Puter Worker toplu ozeti.',
    worker: 'ams',
    durum: 'ok',
    zamanDamgasi: new Date().toISOString(),
    yollar: tanimliYollar,
    amac: {
      baslik: 'AMS Puter Worker amaci',
      maddeSayisi: amacMaddeleri.length,
      maddeler: amacMaddeleri
    },
    mePuter: {
      varMi: !!kullanilabilirMePuter,
      kaynakTuru: mePuterKaynakTuru,
      kvVarMi: !!(kullanilabilirMePuter && kullanilabilirMePuter.kv),
      kvMetotlari: {
        get: !!(kullanilabilirMePuter && kullanilabilirMePuter.kv && typeof kullanilabilirMePuter.kv.get === 'function'),
        set: !!(kullanilabilirMePuter && kullanilabilirMePuter.kv && typeof kullanilabilirMePuter.kv.set === 'function'),
        del: !!(kullanilabilirMePuter && kullanilabilirMePuter.kv && typeof kullanilabilirMePuter.kv.del === 'function')
      }
    },
    fonksiyonlar: {
      not: 'Bu liste fonksiyonlari calistirmaz; sadece tanitici JSON ozetidir.',
      sayi: tanimliFonksiyonlar.length,
      maddeler: tanimliFonksiyonlar
    }
  };
}

router.get('/', async function ({ request, me }) {
  try {
    return basariCevabiUret(request, tumOzetiOlustur(me));
  } catch (hata) {
    guvenliLogYaz('kok-endpoint-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.get('/tumu', async function ({ request, me }) {
  try {
    return basariCevabiUret(request, tumOzetiOlustur(me));
  } catch (hata) {
    guvenliLogYaz('tumu-endpoint-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.get('/api', async function ({ request, me }) {
  try {
    return basariCevabiUret(request, {
      mesaj: 'AMS API erisilebilir.',
      durum: 'ok',
      onerilenTestYollari: [
        '/',
        '/tumu',
        '/api/test/calisiyor',
        '/api/test/saglik',
        '/api/test/me-puter',
        '/api/amac'
      ],
      ozet: tumOzetiOlustur(me)
    });
  } catch (hata) {
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.get('/api/test/calisiyor', async function ({ request }) {
  try {
    return basariCevabiUret(request, {
      calisiyor: true,
      durum: 'ok',
      mesaj: 'Worker istek aliyor ve cevap uretiyor.'
    });
  } catch (hata) {
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.get('/api/test/saglik', async function ({ request, me }) {
  try {
    var handlerMeVarMi = !!me;
    var handlerMePuterVarMi = !!(me && me.puter);
    var globalMeVarMi = !!globalThis.me;
    var globalMePuterVarMi = !!(globalThis.me && globalThis.me.puter);

    var kullanilabilirMePuter =
      (me && me.puter) ||
      (globalThis.me && globalThis.me.puter) ||
      null;

    var kvNesnesiVarMi = !!(kullanilabilirMePuter && kullanilabilirMePuter.kv);

    var kvTemelMetotlari = {
      get: !!(kullanilabilirMePuter && kullanilabilirMePuter.kv && typeof kullanilabilirMePuter.kv.get === 'function'),
      set: !!(kullanilabilirMePuter && kullanilabilirMePuter.kv && typeof kullanilabilirMePuter.kv.set === 'function'),
      del: !!(kullanilabilirMePuter && kullanilabilirMePuter.kv && typeof kullanilabilirMePuter.kv.del === 'function')
    };

    var mePuterDurumu = 'yok';
    if (handlerMePuterVarMi) {
      mePuterDurumu = 'handler-uzerinden';
    } else if (globalMePuterVarMi) {
      mePuterDurumu = 'global-uzerinden';
    }

    return basariCevabiUret(request, {
      worker: 'ams',
      durum: kvNesnesiVarMi ? 'ok' : 'uyari',
      mesaj: kvNesnesiVarMi
        ? 'me.puter baglami bulundu ve kv erisimi tanimli.'
        : 'Worker calisiyor ancak me.puter veya kv erisimi bu endpointte gorunmuyor.',
      zamanDamgasi: new Date().toISOString(),
      kontroller: {
        router: true,
        cevapUretimi: true,
        handlerMe: handlerMeVarMi,
        handlerMePuter: handlerMePuterVarMi,
        globalMe: globalMeVarMi,
        globalMePuter: globalMePuterVarMi,
        mePuter: !!kullanilabilirMePuter,
        kvErisimiTanimli: kvNesnesiVarMi,
        mePuterKaynakTuru: mePuterDurumu,
        kvTemelMetotlari: kvTemelMetotlari
      },
      yorum: {
        beklenenHedef: 'Bu worker me.puter ile calisacagi icin ideal durumda mePuter ve kvErisimiTanimli true olmalidir.',
        anlami: kvNesnesiVarMi
          ? 'Saglik testi me.puter tabanli calisma icin olumlu gorunuyor.'
          : 'Kod ayakta, fakat me.puter baglami bu testte bulunamadi veya kv nesnesi erisilebilir degil.'
      }
    });
  } catch (hata) {
    guvenliLogYaz('gelismis-saglik-testi-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.get('/api/test/me-puter', async function ({ request, me }) {
  var denemeAnahtari = 'ams:test:meputer:kontrol';
  var denemeDegeri = 'ok-' + Date.now();

  try {
    var kullanilabilirMePuter =
      (me && me.puter) ||
      (globalThis.me && globalThis.me.puter) ||
      null;

    if (!kullanilabilirMePuter) {
      return hataCevabiUret(request, 500, 'me.puter baglami yok.');
    }

    if (!kullanilabilirMePuter.kv) {
      return hataCevabiUret(request, 500, 'me.puter.kv erisimi yok.');
    }

    if (typeof kullanilabilirMePuter.kv.set !== 'function') {
      return hataCevabiUret(request, 500, 'me.puter.kv.set fonksiyonu tanimli degil.');
    }

    if (typeof kullanilabilirMePuter.kv.get !== 'function') {
      return hataCevabiUret(request, 500, 'me.puter.kv.get fonksiyonu tanimli degil.');
    }

    if (typeof kullanilabilirMePuter.kv.del !== 'function') {
      return hataCevabiUret(request, 500, 'me.puter.kv.del fonksiyonu tanimli degil.');
    }

    await kullanilabilirMePuter.kv.set(denemeAnahtari, denemeDegeri);
    var okunanDeger = await kullanilabilirMePuter.kv.get(denemeAnahtari);
    await kullanilabilirMePuter.kv.del(denemeAnahtari);

    var yazmaOkumaBasarili = String(okunanDeger) === String(denemeDegeri);

    if (!yazmaOkumaBasarili) {
      return hataCevabiUret(request, 500, 'me.puter.kv yazma-okuma testi beklenen sonucu vermedi.');
    }

    return basariCevabiUret(request, {
      durum: 'ok',
      mesaj: 'me.puter ve kv erisimi dogrulandi. Yazma, okuma ve silme testi basarili.',
      mePuter: true,
      kvErisimiTanimli: true,
      kvGercekTest: {
        yazma: true,
        okuma: true,
        silme: true,
        sonuc: 'basarili'
      },
      deneme: {
        anahtar: denemeAnahtari,
        yazilanDeger: denemeDegeri,
        okunanDeger: okunanDeger
      },
      zamanDamgasi: new Date().toISOString()
    });
  } catch (hata) {
    guvenliLogYaz('gelismis-me-puter-testi-hatasi', guvenliHataMesajiAl(hata));

    try {
      var temizlemeIcinMePuter =
        (me && me.puter) ||
        (globalThis.me && globalThis.me.puter) ||
        null;

      if (
        temizlemeIcinMePuter &&
        temizlemeIcinMePuter.kv &&
        typeof temizlemeIcinMePuter.kv.del === 'function' 
      ) {
        await temizlemeIcinMePuter.kv.del(denemeAnahtari);
      }
    } catch (temizlemeHatasi) {
      guvenliLogYaz('gelismis-me-puter-testi-temizleme-hatasi', guvenliHataMesajiAl(temizlemeHatasi));
    }

    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});

router.get('/api/amac', async function ({ request }) {
  try {
    return basariCevabiUret(request, {
      baslik: 'AMS Puter Worker amaci',
      maddeSayisi: 20,
      maddeler: [
        '1. Ortak uygulama ayarlarini merkezi olarak sunmak.',
        '2. me.puter uzerinden ortak veriyi guvenli sekilde yonetmek.',
        '3. Ortak anahtar-deger verilerini depolamak ve okumak.',
        '4. Uygulama seviyesinde onbellek kullanmak.',
        '5. Gerektiginde onbellek kayitlarini temizlemek.',
        '6. Yonetici kontrollu islemleri tek merkezde toplamak.',
        '7. Frontend icin duzenli JSON cevaplari saglamak.',
        '8. Uygulama durumunu tek endpointten gostermek.',
        '9. Calisma testi icin hizli kontrol endpointleri sunmak.',
        '10. Saglik kontrolu ile runtime durumunu gostermek.',
        '11. me.puter kaynaklarina dayali servis mantigini calistirmak.',
        '12. Uygulama sahibinin hesabiyla ortak operasyonlari yurutmek.',
        '13. Ortak ayarlarin istemciler tarafindan okunabilmesini saglamak.',
        '14. Gerekli oldugunda yonetici anahtari ile korumali islem yapmak.',
        '15. Tutarli hata cevabi uretmek.',
        '16. Tutarli basari cevabi uretmek.',
        '17. Hassas olmayan guvenli log kayitlari olusturmak.',
        '18. Ortak veri yapisini daginiklik olmadan tek workerda toplamak.',
        '19. Test, durum ve amac endpointleri ile debug surecini kolaylastirmak.',
        '20. AMS sisteminin Puter Worker katmanini merkezi servis noktasi olarak calistirmak.'
      ]
    });
  } catch (hata) {
    guvenliLogYaz('amac-endpoint-hatasi', guvenliHataMesajiAl(hata));
    return hataCevabiUret(request, 500, guvenliHataMesajiAl(hata));
  }
});
