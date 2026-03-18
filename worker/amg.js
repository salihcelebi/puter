/* AIAI-OZET
KONU=CHATALL_JS_TEK_DOSYA_TUM_FILTRE_VE_MODEL_MIMARISI
DURUM=KOD_VAR
ANA_KARAR=TEK_JS_DOSYA_ICINDE_TUM_AKIS_TOPLANDI
AKIS=canli_model_cekimi -> normalize_etme -> fiyati_tam_olmayanlari_ele -> sayfa_uygunlugu_filtreleme -> admin_filtre_ayarlari_uygulama -> saglayiciya_gore_gruplama -> siralama -> UIya_hazir_veri
KAPSAM=chat + resim + video + ses + tts
FILTRELER=saglayici + model_adi + takma_ad + metin_girdisi + gorsel_girdisi + pdf_girdisi + ses_girdisi + arac_cagirma + akis_yanit + coklu_modlu + baglam_kapasitesi + maksimum_cikti_tokeni + hiz + giris_fiyati + cikis_fiyati + ucretsiz_mi + bilgi_tarihi + yayin_tarihi + acik_agirlik + onerilen + kalite_seviyesi
FIYAT_KARARI=giris_ve_cikis_fiyati_olmayanlar_katalogdan_elensin
YONETIM_KARARI=admin_ayarlari_ile_filtre_kullanimi_gorunurluk_oncelik_zorunluluk_ve_sira_yonetilsin
FONKSIYON_KURALI=tum_fonksiyon_adlari_turkce
*/

const CHATALL_DEPO_ANAHTARI = "chatall_sayfa_filtre_ayarlari";
const VARSAYILAN_SAYFA_TURU = "chat";
const TUM_SAYFA_TURLERI = ["chat", "resim", "video", "ses", "tts"];

const SAYFA_ADLARI = {
  chat: "Chat",
  resim: "Resim",
  video: "Video",
  ses: "Ses",
  tts: "TTS",
};

const GRUP_ADLARI = {
  kimlik: "Kimlik",
  yetkinlik: "Yetkinlik",
  girdi: "Girdi",
  maliyet: "Maliyet",
  performans: "Performans",
  zaman: "Zaman",
  davranis: "Davranis",
  gelismis: "Gelismis",
};

const HIZ_ONCELIK_HARITASI = {
  fastest: 5,
  ultra_fast: 5,
  fast: 4,
  medium: 3,
  normal: 3,
  balanced: 3,
  slow: 2,
  slower: 1,
};

function filtreTanimlariniGetir() {
  return [
    {
      anahtar: "saglayici",
      ad: "Saglayici",
      aciklama: "Modeli veya ureticiyi saglayan kaynak.",
      grup: "kimlik",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: true,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "secim",
    },
    {
      anahtar: "model_adi",
      ad: "Model Adi",
      aciklama: "Model adinda metin aramasi yapar.",
      grup: "kimlik",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: true,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "metin",
    },
    {
      anahtar: "takma_ad",
      ad: "Takma Ad",
      aciklama: "Takma adlar ve kisa isimler icinde arama yapar.",
      grup: "kimlik",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: false,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: true,
      tur: "metin",
    },
    {
      anahtar: "metin_girdisi",
      ad: "Metin Girdisi",
      aciklama: "Metin girisini destekleyen modelleri secer.",
      grup: "girdi",
      desteklenenSayfalar: ["chat", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: true,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "mantiksal",
    },
    {
      anahtar: "gorsel_girdisi",
      ad: "Gorsel Girdisi",
      aciklama: "Gorsel girisini destekleyen modelleri secer.",
      grup: "girdi",
      desteklenenSayfalar: ["chat", "resim", "video"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "mantiksal",
    },
    {
      anahtar: "pdf_girdisi",
      ad: "PDF Girdisi",
      aciklama: "PDF girisini destekleyen modelleri secer.",
      grup: "girdi",
      desteklenenSayfalar: ["chat"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "mantiksal",
    },
    {
      anahtar: "ses_girdisi",
      ad: "Ses Girdisi",
      aciklama: "Ses girisini destekleyen modelleri secer.",
      grup: "girdi",
      desteklenenSayfalar: ["ses", "video"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "mantiksal",
    },
    {
      anahtar: "arac_cagirma",
      ad: "Arac Cagirma",
      aciklama: "Arac cagirmayi destekleyen modelleri secer.",
      grup: "yetkinlik",
      desteklenenSayfalar: ["chat"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: true,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "mantiksal",
    },
    {
      anahtar: "akis_yanit",
      ad: "Akis Yaniti",
      aciklama: "Akis halinde yanit verebilen modelleri secer.",
      grup: "yetkinlik",
      desteklenenSayfalar: ["chat", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: true,
      tur: "mantiksal",
    },
    {
      anahtar: "coklu_modlu",
      ad: "Coklu Modlu",
      aciklama: "Birden fazla girdi turu destekleyen modelleri secer.",
      grup: "yetkinlik",
      desteklenenSayfalar: ["chat", "resim", "video", "ses"],
      varsayilanEtkin: true,
      varsayilanGorunur: false,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: true,
      bagimliliklar: ["gorsel_girdisi"],
      tur: "mantiksal",
    },
    {
      anahtar: "baglam_kapasitesi",
      ad: "Baglam Kapasitesi",
      aciklama: "Baglam kapasitesi araligina gore secim yapar.",
      grup: "performans",
      desteklenenSayfalar: ["chat", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: true,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "sayisal_aralik",
    },
    {
      anahtar: "maksimum_cikti_tokeni",
      ad: "Maksimum Cikti Tokeni",
      aciklama: "Maksimum cikti uzunluguna gore secim yapar.",
      grup: "performans",
      desteklenenSayfalar: ["chat", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: false,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: true,
      tur: "sayisal_aralik",
    },
    {
      anahtar: "hiz",
      ad: "Hiz",
      aciklama: "Hiz etiketine gore modelleri filtreler.",
      grup: "performans",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: true,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "secim",
    },
    {
      anahtar: "giris_fiyati",
      ad: "Giris Fiyati",
      aciklama: "Giris fiyat araligina gore secim yapar.",
      grup: "maliyet",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: true,
      varsayilanZorunlu: true,
      varsayilanGelismis: false,
      tur: "sayisal_aralik",
    },
    {
      anahtar: "cikis_fiyati",
      ad: "Cikis Fiyati",
      aciklama: "Cikis fiyat araligina gore secim yapar.",
      grup: "maliyet",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: true,
      varsayilanZorunlu: true,
      varsayilanGelismis: false,
      tur: "sayisal_aralik",
    },
    {
      anahtar: "ucretsiz_mi",
      ad: "Ucretsiz Mi",
      aciklama: "Ucretsiz veya sifir maliyetli modelleri secer.",
      grup: "maliyet",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: false,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: true,
      bagimliliklar: ["giris_fiyati", "cikis_fiyati"],
      tur: "mantiksal",
    },
    {
      anahtar: "bilgi_tarihi",
      ad: "Bilgi Tarihi",
      aciklama: "Bilgi tarih araligina gore secim yapar.",
      grup: "zaman",
      desteklenenSayfalar: ["chat", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "tarih_aralik",
    },
    {
      anahtar: "yayin_tarihi",
      ad: "Yayin Tarihi",
      aciklama: "Yayin tarih araligina gore secim yapar.",
      grup: "zaman",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: true,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: false,
      tur: "tarih_aralik",
    },
    {
      anahtar: "acik_agirlik",
      ad: "Acik Agirlik",
      aciklama: "Acik agirlik durumuna gore secim yapar.",
      grup: "davranis",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: false,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: true,
      tur: "mantiksal",
    },
    {
      anahtar: "onerilen",
      ad: "Onerilen",
      aciklama: "Onerilen etiketli modelleri secer.",
      grup: "davranis",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: false,
      varsayilanOneCikar: true,
      varsayilanZorunlu: false,
      varsayilanGelismis: true,
      tur: "mantiksal",
    },
    {
      anahtar: "kalite_seviyesi",
      ad: "Kalite Seviyesi",
      aciklama: "Kalite etiketi veya seviyesine gore secim yapar.",
      grup: "performans",
      desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
      varsayilanEtkin: true,
      varsayilanGorunur: false,
      varsayilanOneCikar: false,
      varsayilanZorunlu: false,
      varsayilanGelismis: true,
      tur: "secim",
    },
  ];
}

function sayfayaGoreFiltreleriGetir(sayfaTuru) {
  return filtreTanimlariniGetir().filter((filtre) =>
    filtre.desteklenenSayfalar.includes(sayfaTuru)
  );
}

function varsayilanFiltreAyarlariGetir() {
  const tumAyarlar = {};
  for (const sayfaTuru of TUM_SAYFA_TURLERI) {
    const filtreler = sayfayaGoreFiltreleriGetir(sayfaTuru);
    tumAyarlar[sayfaTuru] = {};
    filtreler.forEach((filtre, sira) => {
      tumAyarlar[sayfaTuru][filtre.anahtar] = {
        etkin: filtre.varsayilanEtkin,
        gorunur: filtre.varsayilanGorunur,
        oneCikar: filtre.varsayilanOneCikar,
        zorunlu: filtre.varsayilanZorunlu,
        gelismis: filtre.varsayilanGelismis,
        sira: sira + 1,
      };
    });
  }
  return tumAyarlar;
}

function hamModelVerisiniGetir() {
  if (!globalThis.puter?.ai?.listModels) {
    throw new Error("puter.ai.listModels() bulunamadi.");
  }
  return globalThis.puter.ai.listModels();
}

function hamSaglayiciVerisiniGetir() {
  if (!globalThis.puter?.ai?.listModelProviders) {
    throw new Error("puter.ai.listModelProviders() bulunamadi.");
  }
  return globalThis.puter.ai.listModelProviders();
}

async function modelleriGetir() {
  return hamModelVerisiniGetir();
}

async function saglayicilariGetir() {
  return hamSaglayiciVerisiniGetir();
}

function guvenliDizi(deger) {
  return Array.isArray(deger) ? deger : [];
}

function guvenliMetin(deger, varsayilan = "") {
  return typeof deger === "string" ? deger : varsayilan;
}

function guvenliSayi(deger, varsayilan = null) {
  if (typeof deger === "number" && Number.isFinite(deger)) return deger;
  if (typeof deger === "string" && deger.trim() !== "") {
    const sayi = Number(deger);
    return Number.isFinite(sayi) ? sayi : varsayilan;
  }
  return varsayilan;
}

function guvenliMantik(deger, varsayilan = false) {
  if (typeof deger === "boolean") return deger;
  if (deger === "true") return true;
  if (deger === "false") return false;
  return varsayilan;
}

function guvenliTarih(deger) {
  const metin = guvenliMetin(deger, "");
  if (!metin) return null;
  const zaman = Date.parse(metin);
  return Number.isNaN(zaman) ? null : new Date(zaman).toISOString().slice(0, 10);
}

function modelKimliginiHazirla(hamModel) {
  const hamId = guvenliMetin(hamModel.id, "");
  const hamPuterId = guvenliMetin(hamModel.puterId, "");
  const saglayici = guvenliMetin(hamModel.provider, "") || puterKimligindenSaglayiciCikar(hamPuterId);
  const modelKimligi = hamId || puterKimligindenModelAdiCikar(hamPuterId);
  return {
    modelKimligi,
    puterKimligi: hamPuterId,
    saglayici,
    gorunenAd:
      guvenliMetin(hamModel.name, "") ||
      modelKimligi ||
      hamPuterId ||
      "Bilinmeyen Model",
  };
}

function puterKimligindenSaglayiciCikar(puterKimligi) {
  if (!puterKimligi) return "";
  const ilkParca = String(puterKimligi).split(":")[0] || "";
  return ilkParca.trim();
}

function puterKimligindenModelAdiCikar(puterKimligi) {
  if (!puterKimligi) return "";
  const ikiNoktaSonrasi = String(puterKimligi).split(":")[1] || "";
  const parcalar = ikiNoktaSonrasi.split("/");
  return parcalar[parcalar.length - 1] || "";
}

function takmaAdlariHazirla(hamModel) {
  const takmaAdlar = guvenliDizi(hamModel.aliases)
    .filter((deger) => typeof deger === "string" && deger.trim() !== "")
    .map((deger) => deger.trim());
  return [...new Set(takmaAdlar)];
}

function modaliteleriHazirla(hamModel) {
  const girisler = guvenliDizi(hamModel?.modalities?.input).map((x) =>
    String(x).toLowerCase()
  );
  const cikislar = guvenliDizi(hamModel?.modalities?.output).map((x) =>
    String(x).toLowerCase()
  );
  return {
    girisler,
    cikislar,
    metinGirdisiVar: girisler.includes("text"),
    gorselGirdisiVar: girisler.includes("image"),
    pdfGirdisiVar: girisler.includes("pdf"),
    sesGirdisiVar:
      girisler.includes("audio") ||
      girisler.includes("speech") ||
      girisler.includes("voice"),
    metinCikisiVar: cikislar.includes("text"),
    gorselCikisiVar: cikislar.includes("image"),
    videoCikisiVar: cikislar.includes("video"),
    sesCikisiVar:
      cikislar.includes("audio") ||
      cikislar.includes("speech") ||
      cikislar.includes("voice"),
    cokluModluMu: girisler.length > 1,
  };
}

function fiyatBilgisiniHazirla(hamModel) {
  const maliyetler = hamModel?.costs || {};
  const paraBirimi = guvenliMetin(hamModel.costs_currency, "");
  const girisAnahtari = guvenliMetin(hamModel.input_cost_key, "input_tokens");
  const cikisAnahtari = guvenliMetin(hamModel.output_cost_key, "output_tokens");
  const girisFiyati = guvenliSayi(maliyetler[girisAnahtari], null);
  const cikisFiyati = guvenliSayi(maliyetler[cikisAnahtari], null);
  const tabanTokenMiktari = guvenliSayi(maliyetler.tokens, null);

  return {
    paraBirimi,
    tabanTokenMiktari,
    girisFiyati,
    cikisFiyati,
    girisAnahtari,
    cikisAnahtari,
    ucretsizMi:
      (girisFiyati === 0 || girisFiyati === null) &&
      (cikisFiyati === 0 || cikisFiyati === null)
        ? girisFiyati === 0 && cikisFiyati === 0
        : false,
    hamMaliyetler: maliyetler,
  };
}

function tarihBilgisiniHazirla(hamModel) {
  return {
    bilgiTarihi:
      guvenliTarih(hamModel.knowledge) ||
      guvenliTarih(hamModel.training_cutoff) ||
      null,
    yayinTarihi: guvenliTarih(hamModel.release_date),
    sonrakisi: guvenliMetin(hamModel.succeeded_by, ""),
  };
}

function baglamBilgisiniHazirla(hamModel) {
  return {
    baglamKapasitesi: guvenliSayi(hamModel.context, null),
    maksimumCiktiTokeni: guvenliSayi(hamModel.max_tokens, null),
  };
}

function hizBilgisiniHazirla(hamModel) {
  const hiz = guvenliMetin(hamModel.qualitative_speed, "").toLowerCase();
  return {
    hiz,
    hizPuani: HIZ_ONCELIK_HARITASI[hiz] || 0,
  };
}

function kaliteBilgisiniHazirla(hamModel) {
  const gorunenAd = guvenliMetin(hamModel.name, "").toLowerCase();
  const modelAdi = guvenliMetin(hamModel.id, "").toLowerCase();
  const tamAd = `${gorunenAd} ${modelAdi}`;
  if (tamAd.includes("opus")) return "ust";
  if (tamAd.includes("sonnet")) return "yuksek";
  if (tamAd.includes("pro")) return "yuksek";
  if (tamAd.includes("haiku")) return "hiz_odakli";
  if (tamAd.includes("mini") || tamAd.includes("nano")) return "ekonomik";
  return "standart";
}

function onerilenMiBelirle(hamModel, normalizeModel) {
  const takmaAdlar = guvenliDizi(hamModel.aliases).join(" ").toLowerCase();
  const ad = `${normalizeModel.gorunenAd} ${normalizeModel.modelKimligi}`.toLowerCase();
  return (
    takmaAdlar.includes("latest") ||
    ad.includes("latest") ||
    ad.includes("sonnet") ||
    ad.includes("pro")
  );
}

function modeliNormalizeEt(hamModel) {
  const kimlik = modelKimliginiHazirla(hamModel);
  const modaliteler = modaliteleriHazirla(hamModel);
  const fiyat = fiyatBilgisiniHazirla(hamModel);
  const tarihler = tarihBilgisiniHazirla(hamModel);
  const baglam = baglamBilgisiniHazirla(hamModel);
  const hiz = hizBilgisiniHazirla(hamModel);

  const normalizeModel = {
    modelKimligi: kimlik.modelKimligi,
    puterKimligi: kimlik.puterKimligi,
    gorunenAd: kimlik.gorunenAd,
    saglayici: kimlik.saglayici,
    takmaAdlar: takmaAdlariHazirla(hamModel),
    acikAgirlik: guvenliMantik(hamModel.open_weights, false),
    aracCagirma: guvenliMantik(hamModel.tool_call, false),
    akisYanit: guvenliMantik(
      hamModel.stream ?? hamModel.streaming ?? false,
      false
    ),
    modaliteler,
    fiyat,
    tarihler,
    baglam,
    hiz,
    bilgiTarihi: tarihler.bilgiTarihi,
    yayinTarihi: tarihler.yayinTarihi,
    baglamKapasitesi: baglam.baglamKapasitesi,
    maksimumCiktiTokeni: baglam.maksimumCiktiTokeni,
    girisFiyati: fiyat.girisFiyati,
    cikisFiyati: fiyat.cikisFiyati,
    ucretsizMi: fiyat.ucretsizMi,
    kaliteSeviyesi: kaliteBilgisiniHazirla(hamModel),
    onerilen: false,
    hamModel,
  };

  normalizeModel.onerilen = onerilenMiBelirle(hamModel, normalizeModel);
  return normalizeModel;
}

function modelleriNormalizeEt(hamModeller) {
  return guvenliDizi(hamModeller).map(modeliNormalizeEt);
}

function saglayiciyiNormalizeEt(hamSaglayici) {
  if (typeof hamSaglayici === "string") {
    return {
      kimlik: hamSaglayici,
      gorunenAd: hamSaglayici,
      izinliSecenekler: [],
      engelliSecenekler: [],
      zorunluSecenekler: [],
      cokluModlu: null,
      araclar: null,
      akis: null,
      hamSaglayici,
    };
  }

  return {
    kimlik:
      guvenliMetin(hamSaglayici.provider, "") ||
      guvenliMetin(hamSaglayici.id, "") ||
      guvenliMetin(hamSaglayici.name, ""),
    gorunenAd:
      guvenliMetin(hamSaglayici.name, "") ||
      guvenliMetin(hamSaglayici.provider, "") ||
      guvenliMetin(hamSaglayici.id, "") ||
      "Bilinmeyen Saglayici",
    izinliSecenekler: guvenliDizi(hamSaglayici.allowedOptions),
    engelliSecenekler: guvenliDizi(hamSaglayici.blockedOptions),
    zorunluSecenekler: guvenliDizi(hamSaglayici.requiredOptions),
    cokluModlu: typeof hamSaglayici.multimodal === "boolean" ? hamSaglayici.multimodal : null,
    araclar: typeof hamSaglayici.tools === "boolean" ? hamSaglayici.tools : null,
    akis: typeof hamSaglayici.stream === "boolean" ? hamSaglayici.stream : null,
    hamSaglayici,
  };
}

function saglayicilariNormalizeEt(hamSaglayicilar) {
  return guvenliDizi(hamSaglayicilar).map(saglayiciyiNormalizeEt);
}

function modelGecerliMi(model) {
  return Boolean(model && model.modelKimligi && model.saglayici);
}

function saglayiciGecerliMi(saglayici) {
  return Boolean(saglayici && saglayici.kimlik);
}

function metinGirdisiVarMi(model) {
  return Boolean(model?.modaliteler?.metinGirdisiVar);
}

function gorselGirdisiVarMi(model) {
  return Boolean(model?.modaliteler?.gorselGirdisiVar);
}

function pdfGirdisiVarMi(model) {
  return Boolean(model?.modaliteler?.pdfGirdisiVar);
}

function sesGirdisiVarMi(model) {
  return Boolean(model?.modaliteler?.sesGirdisiVar);
}

function aracCagirmaVarMi(model) {
  return Boolean(model?.aracCagirma);
}

function akisYanitVarMi(model) {
  return Boolean(model?.akisYanit);
}

function baglamBilgisiVarMi(model) {
  return model?.baglamKapasitesi !== null && model?.baglamKapasitesi !== undefined;
}

function maksimumCiktiBilgisiVarMi(model) {
  return model?.maksimumCiktiTokeni !== null && model?.maksimumCiktiTokeni !== undefined;
}

function girisFiyatiVarMi(model) {
  return model?.girisFiyati !== null && model?.girisFiyati !== undefined;
}

function cikisFiyatiVarMi(model) {
  return model?.cikisFiyati !== null && model?.cikisFiyati !== undefined;
}

function fiyatiTamMi(model) {
  return girisFiyatiVarMi(model) && cikisFiyatiVarMi(model);
}

function ucretsizMi(model) {
  return Boolean(model?.ucretsizMi);
}

function chatIcinUygunMu(model) {
  return (
    modelGecerliMi(model) &&
    metinGirdisiVarMi(model) &&
    Boolean(model?.modaliteler?.metinCikisiVar)
  );
}

function resimIcinUygunMu(model) {
  return (
    modelGecerliMi(model) &&
    (gorselGirdisiVarMi(model) || Boolean(model?.modaliteler?.gorselCikisiVar))
  );
}

function videoIcinUygunMu(model) {
  return (
    modelGecerliMi(model) &&
    (Boolean(model?.modaliteler?.videoCikisiVar) ||
      sesGirdisiVarMi(model) ||
      gorselGirdisiVarMi(model) ||
      metinGirdisiVarMi(model))
  );
}

function sesIcinUygunMu(model) {
  return (
    modelGecerliMi(model) &&
    (sesGirdisiVarMi(model) || Boolean(model?.modaliteler?.sesCikisiVar))
  );
}

function ttsIcinUygunMu(model) {
  return (
    modelGecerliMi(model) &&
    metinGirdisiVarMi(model) &&
    Boolean(model?.modaliteler?.sesCikisiVar)
  );
}

function sayfaTuruneGoreUygunMu(model, sayfaTuru) {
  if (sayfaTuru === "chat") return chatIcinUygunMu(model);
  if (sayfaTuru === "resim") return resimIcinUygunMu(model);
  if (sayfaTuru === "video") return videoIcinUygunMu(model);
  if (sayfaTuru === "ses") return sesIcinUygunMu(model);
  if (sayfaTuru === "tts") return ttsIcinUygunMu(model);
  return false;
}

function filtreAyarlariniGetir() {
  const varsayilan = varsayilanFiltreAyarlariGetir();
  try {
    const kayit = globalThis.localStorage?.getItem(CHATALL_DEPO_ANAHTARI);
    if (!kayit) return varsayilan;
    const cozulmus = JSON.parse(kayit);
    return derinAyarBirlestir(varsayilan, cozulmus);
  } catch {
    return varsayilan;
  }
}

function filtreAyarlariniKaydet(ayarlar) {
  if (!globalThis.localStorage) return ayarlar;
  globalThis.localStorage.setItem(CHATALL_DEPO_ANAHTARI, JSON.stringify(ayarlar));
  return ayarlar;
}

function filtreAyarlariniSifirla() {
  const varsayilan = varsayilanFiltreAyarlariGetir();
  filtreAyarlariniKaydet(varsayilan);
  return varsayilan;
}

function varsayilanAyarlaraDon() {
  return filtreAyarlariniSifirla();
}

function filtreAyarlariniDisaAktar(ayarlar = filtreAyarlariniGetir()) {
  return JSON.stringify(ayarlar, null, 2);
}

function filtreAyarlariniIceAktar(hamMetin) {
  const varsayilan = varsayilanFiltreAyarlariGetir();
  const cozulmus = JSON.parse(String(hamMetin || "{}"));
  const birlesik = derinAyarBirlestir(varsayilan, cozulmus);
  filtreAyarlariniKaydet(birlesik);
  return birlesik;
}

function derinAyarBirlestir(varsayilan, gelen) {
  const sonuc = JSON.parse(JSON.stringify(varsayilan));
  for (const sayfaTuru of Object.keys(sonuc)) {
    if (!gelen?.[sayfaTuru]) continue;
    for (const anahtar of Object.keys(sonuc[sayfaTuru])) {
      if (!gelen[sayfaTuru]?.[anahtar]) continue;
      sonuc[sayfaTuru][anahtar] = {
        ...sonuc[sayfaTuru][anahtar],
        ...gelen[sayfaTuru][anahtar],
      };
    }
  }
  return sonuc;
}

function filtreEtkinMi(ayarlar, sayfaTuru, filtreAnahtari) {
  return Boolean(ayarlar?.[sayfaTuru]?.[filtreAnahtari]?.etkin);
}

function filtreGorunurMu(ayarlar, sayfaTuru, filtreAnahtari) {
  return Boolean(ayarlar?.[sayfaTuru]?.[filtreAnahtari]?.gorunur);
}

function filtreOneCikarilmisMi(ayarlar, sayfaTuru, filtreAnahtari) {
  return Boolean(ayarlar?.[sayfaTuru]?.[filtreAnahtari]?.oneCikar);
}

function filtreZorunluMu(ayarlar, sayfaTuru, filtreAnahtari) {
  return Boolean(ayarlar?.[sayfaTuru]?.[filtreAnahtari]?.zorunlu);
}

function filtreGelismisMi(ayarlar, sayfaTuru, filtreAnahtari) {
  return Boolean(ayarlar?.[sayfaTuru]?.[filtreAnahtari]?.gelismis);
}

function filtreyiEtkinlestir(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "etkin", true);
}

function filtreyiPasiflestir(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "etkin", false);
}

function filtreyiGoster(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "gorunur", true);
}

function filtreyiGizle(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "gorunur", false);
}

function filtreyiOneCikar(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "oneCikar", true);
}

function filtreyiGeriAl(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "oneCikar", false);
}

function filtreyiZorunluYap(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "zorunlu", true);
}

function filtreyiOpsiyonelYap(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "zorunlu", false);
}

function filtreyiGelismisYap(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "gelismis", true);
}

function filtreyiTemelYap(ayarlar, sayfaTuru, filtreAnahtari) {
  return filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, "gelismis", false);
}

function filtreAyarAlaniniGuncelle(ayarlar, sayfaTuru, filtreAnahtari, alan, deger) {
  const yeni = JSON.parse(JSON.stringify(ayarlar));
  if (!yeni?.[sayfaTuru]?.[filtreAnahtari]) return yeni;
  yeni[sayfaTuru][filtreAnahtari][alan] = deger;
  return yeni;
}

function filtreBagimliliklariniKontrolEt(ayarlar, sayfaTuru, filtreAnahtari) {
  const filtre = sayfayaGoreFiltreleriGetir(sayfaTuru).find(
    (x) => x.anahtar === filtreAnahtari
  );
  if (!filtre) return false;
  if (!filtre.bagimliliklar || filtre.bagimliliklar.length === 0) return true;
  return filtre.bagimliliklar.every((bagliAnahtar) =>
    filtreEtkinMi(ayarlar, sayfaTuru, bagliAnahtar)
  );
}

function filtreSirasiniBelirle(ayarlar, sayfaTuru, filtreler) {
  return [...filtreler].sort((a, b) => {
    const aSira = ayarlar?.[sayfaTuru]?.[a.anahtar]?.sira ?? 9999;
    const bSira = ayarlar?.[sayfaTuru]?.[b.anahtar]?.sira ?? 9999;
    return aSira - bSira;
  });
}

function filtreyiYukariTasi(ayarlar, sayfaTuru, filtreAnahtari) {
  const filtreler = filtreSirasiniBelirle(
    ayarlar,
    sayfaTuru,
    sayfayaGoreFiltreleriGetir(sayfaTuru)
  );
  const index = filtreler.findIndex((f) => f.anahtar === filtreAnahtari);
  if (index <= 0) return ayarlar;
  return filtreSiralariniDegistir(
    ayarlar,
    sayfaTuru,
    filtreAnahtari,
    filtreler[index - 1].anahtar
  );
}

function filtreyiAsagiTasi(ayarlar, sayfaTuru, filtreAnahtari) {
  const filtreler = filtreSirasiniBelirle(
    ayarlar,
    sayfaTuru,
    sayfayaGoreFiltreleriGetir(sayfaTuru)
  );
  const index = filtreler.findIndex((f) => f.anahtar === filtreAnahtari);
  if (index < 0 || index >= filtreler.length - 1) return ayarlar;
  return filtreSiralariniDegistir(
    ayarlar,
    sayfaTuru,
    filtreAnahtari,
    filtreler[index + 1].anahtar
  );
}

function filtreSiralariniDegistir(ayarlar, sayfaTuru, birinciAnahtar, ikinciAnahtar) {
  const yeni = JSON.parse(JSON.stringify(ayarlar));
  const birinciSira = yeni?.[sayfaTuru]?.[birinciAnahtar]?.sira;
  const ikinciSira = yeni?.[sayfaTuru]?.[ikinciAnahtar]?.sira;
  if (birinciSira == null || ikinciSira == null) return ayarlar;
  yeni[sayfaTuru][birinciAnahtar].sira = ikinciSira;
  yeni[sayfaTuru][ikinciAnahtar].sira = birinciSira;
  return yeni;
}

function fiyatBilgisiniOku(model) {
  return {
    girisFiyati: model?.girisFiyati ?? null,
    cikisFiyati: model?.cikisFiyati ?? null,
    paraBirimi: model?.fiyat?.paraBirimi ?? "",
    tabanTokenMiktari: model?.fiyat?.tabanTokenMiktari ?? null,
  };
}

function fiyatBilgisiniSayiyaCevir(deger) {
  return guvenliSayi(deger, null);
}

function sayisalAraliktaMi(deger, min, max) {
  if (deger == null) return false;
  if (min != null && deger < min) return false;
  if (max != null && deger > max) return false;
  return true;
}

function tarihAraligindaMi(tarihMetni, baslangic, bitis) {
  const tarih = guvenliTarih(tarihMetni);
  if (!tarih) return false;
  const zaman = Date.parse(tarih);
  const baslangicZamani = baslangic ? Date.parse(baslangic) : null;
  const bitisZamani = bitis ? Date.parse(bitis) : null;
  if (baslangicZamani != null && zaman < baslangicZamani) return false;
  if (bitisZamani != null && zaman > bitisZamani) return false;
  return true;
}

function metinEslesiyorMu(hamMetin, arananMetin) {
  if (!arananMetin) return true;
  const kaynak = String(hamMetin || "").toLocaleLowerCase("tr");
  const hedef = String(arananMetin || "").toLocaleLowerCase("tr");
  return kaynak.includes(hedef);
}

function secimEslesiyorMu(deger, secilenler) {
  if (!Array.isArray(secilenler) || secilenler.length === 0) return true;
  return secilenler.includes(deger);
}

function mantiksalFiltreEslesiyorMu(modelDegeri, beklenenDeger) {
  if (beklenenDeger === undefined || beklenenDeger === null) return true;
  return Boolean(modelDegeri) === Boolean(beklenenDeger);
}

function tekFiltreyiUygula(model, filtreAnahtari, filtreDegeri) {
  if (filtreAnahtari === "saglayici") {
    return secimEslesiyorMu(model.saglayici, filtreDegeri);
  }
  if (filtreAnahtari === "model_adi") {
    return metinEslesiyorMu(model.gorunenAd || model.modelKimligi, filtreDegeri);
  }
  if (filtreAnahtari === "takma_ad") {
    return metinEslesiyorMu(model.takmaAdlar.join(" "), filtreDegeri);
  }
  if (filtreAnahtari === "metin_girdisi") {
    return mantiksalFiltreEslesiyorMu(metinGirdisiVarMi(model), filtreDegeri);
  }
  if (filtreAnahtari === "gorsel_girdisi") {
    return mantiksalFiltreEslesiyorMu(gorselGirdisiVarMi(model), filtreDegeri);
  }
  if (filtreAnahtari === "pdf_girdisi") {
    return mantiksalFiltreEslesiyorMu(pdfGirdisiVarMi(model), filtreDegeri);
  }
  if (filtreAnahtari === "ses_girdisi") {
    return mantiksalFiltreEslesiyorMu(sesGirdisiVarMi(model), filtreDegeri);
  }
  if (filtreAnahtari === "arac_cagirma") {
    return mantiksalFiltreEslesiyorMu(aracCagirmaVarMi(model), filtreDegeri);
  }
  if (filtreAnahtari === "akis_yanit") {
    return mantiksalFiltreEslesiyorMu(akisYanitVarMi(model), filtreDegeri);
  }
  if (filtreAnahtari === "coklu_modlu") {
    return mantiksalFiltreEslesiyorMu(model?.modaliteler?.cokluModluMu, filtreDegeri);
  }
  if (filtreAnahtari === "baglam_kapasitesi") {
    return sayisalAraliktaMi(
      model.baglamKapasitesi,
      filtreDegeri?.min ?? null,
      filtreDegeri?.max ?? null
    );
  }
  if (filtreAnahtari === "maksimum_cikti_tokeni") {
    return sayisalAraliktaMi(
      model.maksimumCiktiTokeni,
      filtreDegeri?.min ?? null,
      filtreDegeri?.max ?? null
    );
  }
  if (filtreAnahtari === "hiz") {
    return secimEslesiyorMu(model?.hiz?.hiz, filtreDegeri);
  }
  if (filtreAnahtari === "giris_fiyati") {
    return sayisalAraliktaMi(
      model.girisFiyati,
      filtreDegeri?.min ?? null,
      filtreDegeri?.max ?? null
    );
  }
  if (filtreAnahtari === "cikis_fiyati") {
    return sayisalAraliktaMi(
      model.cikisFiyati,
      filtreDegeri?.min ?? null,
      filtreDegeri?.max ?? null
    );
  }
  if (filtreAnahtari === "ucretsiz_mi") {
    return mantiksalFiltreEslesiyorMu(ucretsizMi(model), filtreDegeri);
  }
  if (filtreAnahtari === "bilgi_tarihi") {
    return tarihAraligindaMi(
      model.bilgiTarihi,
      filtreDegeri?.baslangic ?? null,
      filtreDegeri?.bitis ?? null
    );
  }
  if (filtreAnahtari === "yayin_tarihi") {
    return tarihAraligindaMi(
      model.yayinTarihi,
      filtreDegeri?.baslangic ?? null,
      filtreDegeri?.bitis ?? null
    );
  }
  if (filtreAnahtari === "acik_agirlik") {
    return mantiksalFiltreEslesiyorMu(model.acikAgirlik, filtreDegeri);
  }
  if (filtreAnahtari === "onerilen") {
    return mantiksalFiltreEslesiyorMu(model.onerilen, filtreDegeri);
  }
  if (filtreAnahtari === "kalite_seviyesi") {
    return secimEslesiyorMu(model.kaliteSeviyesi, filtreDegeri);
  }
  return true;
}

function filtreleriUygula(modeller, uygulananFiltreler = {}, ayarlar = null, sayfaTuru = VARSAYILAN_SAYFA_TURU) {
  const aktifAyarlar = ayarlar || filtreAyarlariniGetir();
  return guvenliDizi(modeller).filter((model) => {
    for (const [filtreAnahtari, filtreDegeri] of Object.entries(uygulananFiltreler || {})) {
      if (!filtreEtkinMi(aktifAyarlar, sayfaTuru, filtreAnahtari)) continue;
      if (!filtreBagimliliklariniKontrolEt(aktifAyarlar, sayfaTuru, filtreAnahtari)) continue;
      if (!tekFiltreyiUygula(model, filtreAnahtari, filtreDegeri)) return false;
    }
    return true;
  });
}

function onceligeGoreSirala(modeller, ayarlar = null, sayfaTuru = VARSAYILAN_SAYFA_TURU) {
  const aktifAyarlar = ayarlar || filtreAyarlariniGetir();
  const oneCikanlar = new Set(
    sayfayaGoreFiltreleriGetir(sayfaTuru)
      .filter((filtre) => filtreOneCikarilmisMi(aktifAyarlar, sayfaTuru, filtre.anahtar))
      .map((filtre) => filtre.anahtar)
  );

  return [...modeller].sort((a, b) => {
    const aPuan = modelOncelikPuaniHesapla(a, oneCikanlar);
    const bPuan = modelOncelikPuaniHesapla(b, oneCikanlar);
    return bPuan - aPuan;
  });
}

function modelOncelikPuaniHesapla(model, oneCikanlar) {
  let puan = 0;
  if (oneCikanlar.has("onerilen") && model.onerilen) puan += 50;
  if (oneCikanlar.has("hiz")) puan += model?.hiz?.hizPuani || 0;
  if (oneCikanlar.has("baglam_kapasitesi")) puan += (model.baglamKapasitesi || 0) / 10000;
  if (oneCikanlar.has("kalite_seviyesi")) {
    if (model.kaliteSeviyesi === "ust") puan += 30;
    if (model.kaliteSeviyesi === "yuksek") puan += 20;
    if (model.kaliteSeviyesi === "standart") puan += 10;
  }
  return puan;
}

function adaGoreSirala(modeller, artan = true) {
  return [...modeller].sort((a, b) => {
    const sonuc = (a.gorunenAd || "").localeCompare(b.gorunenAd || "", "tr");
    return artan ? sonuc : -sonuc;
  });
}

function hizaGoreSirala(modeller, artan = false) {
  return [...modeller].sort((a, b) => {
    const sonuc = (a?.hiz?.hizPuani || 0) - (b?.hiz?.hizPuani || 0);
    return artan ? sonuc : -sonuc;
  });
}

function baglamaGoreSirala(modeller, artan = false) {
  return [...modeller].sort((a, b) => {
    const sonuc = (a.baglamKapasitesi || 0) - (b.baglamKapasitesi || 0);
    return artan ? sonuc : -sonuc;
  });
}

function yayinTarihineGoreSirala(modeller, artan = false) {
  return [...modeller].sort((a, b) => {
    const sonuc = (Date.parse(a.yayinTarihi || "1970-01-01") || 0) - (Date.parse(b.yayinTarihi || "1970-01-01") || 0);
    return artan ? sonuc : -sonuc;
  });
}

function bilgiTarihineGoreSirala(modeller, artan = false) {
  return [...modeller].sort((a, b) => {
    const sonuc = (Date.parse(a.bilgiTarihi || "1970-01-01") || 0) - (Date.parse(b.bilgiTarihi || "1970-01-01") || 0);
    return artan ? sonuc : -sonuc;
  });
}

function fiyataGoreSirala(modeller, alan = "giris", artan = true) {
  const anahtar = alan === "cikis" ? "cikisFiyati" : "girisFiyati";
  return [...modeller].sort((a, b) => {
    const aDeger = a[anahtar] ?? Number.MAX_SAFE_INTEGER;
    const bDeger = b[anahtar] ?? Number.MAX_SAFE_INTEGER;
    const sonuc = aDeger - bDeger;
    return artan ? sonuc : -sonuc;
  });
}

function enUcuzdanPahaliyaSirala(modeller) {
  return fiyataGoreSirala(modeller, "giris", true);
}

function enPahalidanUcuzaSirala(modeller) {
  return fiyataGoreSirala(modeller, "giris", false);
}

function fiyatAraliginaGoreFiltrele(modeller, min = null, max = null, alan = "giris") {
  const anahtar = alan === "cikis" ? "cikisFiyati" : "girisFiyati";
  return guvenliDizi(modeller).filter((model) =>
    sayisalAraliktaMi(model[anahtar], min, max)
  );
}

function saglayiciyaGoreGrupla(modeller) {
  const sonuc = {};
  for (const model of guvenliDizi(modeller)) {
    const anahtar = model.saglayici || "bilinmeyen";
    if (!sonuc[anahtar]) sonuc[anahtar] = [];
    sonuc[anahtar].push(model);
  }
  return sonuc;
}

function grubaGoreToparla(modeller, alan) {
  const sonuc = {};
  for (const model of guvenliDizi(modeller)) {
    const anahtar = model?.[alan] ?? "bilinmeyen";
    if (!sonuc[anahtar]) sonuc[anahtar] = [];
    sonuc[anahtar].push(model);
  }
  return sonuc;
}

function sayfaTuruneGoreGrupla(modeller) {
  const sonuc = {};
  for (const sayfaTuru of TUM_SAYFA_TURLERI) {
    sonuc[sayfaTuru] = guvenliDizi(modeller).filter((model) =>
      sayfaTuruneGoreUygunMu(model, sayfaTuru)
    );
  }
  return sonuc;
}

function onerilenleriAyir(modeller) {
  return {
    onerilenler: guvenliDizi(modeller).filter((model) => model.onerilen),
    digerleri: guvenliDizi(modeller).filter((model) => !model.onerilen),
  };
}

function gelismisleriAyir(ayarlar, sayfaTuru, filtreler = null) {
  const hedefFiltreler = filtreler || sayfayaGoreFiltreleriGetir(sayfaTuru);
  return {
    gelismisler: hedefFiltreler.filter((f) => filtreGelismisMi(ayarlar, sayfaTuru, f.anahtar)),
    temeller: hedefFiltreler.filter((f) => !filtreGelismisMi(ayarlar, sayfaTuru, f.anahtar)),
  };
}

function zorunlulariAyir(ayarlar, sayfaTuru, filtreler = null) {
  const hedefFiltreler = filtreler || sayfayaGoreFiltreleriGetir(sayfaTuru);
  return {
    zorunlular: hedefFiltreler.filter((f) => filtreZorunluMu(ayarlar, sayfaTuru, f.anahtar)),
    opsiyoneller: hedefFiltreler.filter((f) => !filtreZorunluMu(ayarlar, sayfaTuru, f.anahtar)),
  };
}

function gorunurleriAyir(ayarlar, sayfaTuru, filtreler = null) {
  const hedefFiltreler = filtreler || sayfayaGoreFiltreleriGetir(sayfaTuru);
  return {
    gorunenler: hedefFiltreler.filter((f) => filtreGorunurMu(ayarlar, sayfaTuru, f.anahtar)),
    gizlenenler: hedefFiltreler.filter((f) => !filtreGorunurMu(ayarlar, sayfaTuru, f.anahtar)),
  };
}

function modeliSayfaIcinHazirla(model, sayfaTuru) {
  return {
    ...model,
    sayfaTuru,
    sayfaAdi: SAYFA_ADLARI[sayfaTuru],
  };
}

function modelListesiniSayfaIcinHazirla(modeller, sayfaTuru) {
  return guvenliDizi(modeller)
    .filter((model) => sayfaTuruneGoreUygunMu(model, sayfaTuru))
    .map((model) => modeliSayfaIcinHazirla(model, sayfaTuru));
}

function kataloguHazirla(modeller, sayfaTuru, uygulananFiltreler = {}, ayarlar = null) {
  const aktifAyarlar = ayarlar || filtreAyarlariniGetir();
  let liste = modelListesiniSayfaIcinHazirla(modeller, sayfaTuru);
  liste = liste.filter(fiyatiTamMi);
  liste = filtreleriUygula(liste, uygulananFiltreler, aktifAyarlar, sayfaTuru);
  liste = onceligeGoreSirala(liste, aktifAyarlar, sayfaTuru);
  return liste;
}

function chatIcinKatalogHazirla(modeller, uygulananFiltreler = {}, ayarlar = null) {
  return kataloguHazirla(modeller, "chat", uygulananFiltreler, ayarlar);
}

function resimIcinKatalogHazirla(modeller, uygulananFiltreler = {}, ayarlar = null) {
  return kataloguHazirla(modeller, "resim", uygulananFiltreler, ayarlar);
}

function videoIcinKatalogHazirla(modeller, uygulananFiltreler = {}, ayarlar = null) {
  return kataloguHazirla(modeller, "video", uygulananFiltreler, ayarlar);
}

function sesIcinKatalogHazirla(modeller, uygulananFiltreler = {}, ayarlar = null) {
  return kataloguHazirla(modeller, "ses", uygulananFiltreler, ayarlar);
}

function ttsIcinKatalogHazirla(modeller, uygulananFiltreler = {}, ayarlar = null) {
  return kataloguHazirla(modeller, "tts", uygulananFiltreler, ayarlar);
}

function sayfaIcinKatalogHazirla(modeller, sayfaTuru, uygulananFiltreler = {}, ayarlar = null) {
  if (sayfaTuru === "chat") return chatIcinKatalogHazirla(modeller, uygulananFiltreler, ayarlar);
  if (sayfaTuru === "resim") return resimIcinKatalogHazirla(modeller, uygulananFiltreler, ayarlar);
  if (sayfaTuru === "video") return videoIcinKatalogHazirla(modeller, uygulananFiltreler, ayarlar);
  if (sayfaTuru === "ses") return sesIcinKatalogHazirla(modeller, uygulananFiltreler, ayarlar);
  if (sayfaTuru === "tts") return ttsIcinKatalogHazirla(modeller, uygulananFiltreler, ayarlar);
  return [];
}

function ozetSayilariHesapla(modeller, ayarlar, sayfaTuru) {
  const filtreler = sayfayaGoreFiltreleriGetir(sayfaTuru);
  return {
    toplamModel: guvenliDizi(modeller).length,
    saglayiciSayisi: Object.keys(saglayiciyaGoreGrupla(modeller)).length,
    filtreSayisi: filtreler.length,
    etkinFiltreSayisi: filtreler.filter((f) => filtreEtkinMi(ayarlar, sayfaTuru, f.anahtar)).length,
    gorunurFiltreSayisi: filtreler.filter((f) => filtreGorunurMu(ayarlar, sayfaTuru, f.anahtar)).length,
    oneCikanFiltreSayisi: filtreler.filter((f) => filtreOneCikarilmisMi(ayarlar, sayfaTuru, f.anahtar)).length,
    zorunluFiltreSayisi: filtreler.filter((f) => filtreZorunluMu(ayarlar, sayfaTuru, f.anahtar)).length,
    gelismisFiltreSayisi: filtreler.filter((f) => filtreGelismisMi(ayarlar, sayfaTuru, f.anahtar)).length,
  };
}

function filtreArabirimListesiniHazirla(ayarlar, sayfaTuru) {
  const filtreler = filtreSirasiniBelirle(
    ayarlar,
    sayfaTuru,
    sayfayaGoreFiltreleriGetir(sayfaTuru)
  );

  return filtreler.map((filtre) => ({
    ...filtre,
    ayar: ayarlar?.[sayfaTuru]?.[filtre.anahtar] || null,
    bagimliliklarSaglandiMi: filtreBagimliliklariniKontrolEt(
      ayarlar,
      sayfaTuru,
      filtre.anahtar
    ),
  }));
}

function arabirimeHazirVeriOlustur(modeller, saglayicilar, ayarlar, sayfaTuru) {
  const sayfaModelListesi = sayfaIcinKatalogHazirla(modeller, sayfaTuru, {}, ayarlar);
  return {
    sayfaTuru,
    sayfaAdi: SAYFA_ADLARI[sayfaTuru],
    ozet: ozetSayilariHesapla(sayfaModelListesi, ayarlar, sayfaTuru),
    filtreler: filtreArabirimListesiniHazirla(ayarlar, sayfaTuru),
    saglayicilar,
    modeller: sayfaModelListesi,
    saglayiciGruplari: saglayiciyaGoreGrupla(sayfaModelListesi),
  };
}

async function modelKatalogunuHazirla() {
  const [hamModeller, hamSaglayicilar] = await Promise.all([
    modelleriGetir(),
    saglayicilariGetir(),
  ]);

  const modeller = modelleriNormalizeEt(hamModeller)
    .filter(modelGecerliMi)
    .filter(fiyatiTamMi);

  const saglayicilar = saglayicilariNormalizeEt(hamSaglayicilar)
    .filter(saglayiciGecerliMi);

  return {
    modeller,
    saglayicilar,
    ayarlar: filtreAyarlariniGetir(),
  };
}

async function filtrelenmisModelListesiOlustur(sayfaTuru = VARSAYILAN_SAYFA_TURU, uygulananFiltreler = {}) {
  const { modeller, ayarlar } = await modelKatalogunuHazirla();
  return sayfaIcinKatalogHazirla(modeller, sayfaTuru, uygulananFiltreler, ayarlar);
}

async function sayfaIcinHazirModelListesiOlustur(sayfaTuru = VARSAYILAN_SAYFA_TURU, uygulananFiltreler = {}) {
  return filtrelenmisModelListesiOlustur(sayfaTuru, uygulananFiltreler);
}

async function sayfaVerisiniHazirla(sayfaTuru = VARSAYILAN_SAYFA_TURU, uygulananFiltreler = {}) {
  const { modeller, saglayicilar, ayarlar } = await modelKatalogunuHazirla();
  const filtrelenmisModeller = sayfaIcinKatalogHazirla(
    modeller,
    sayfaTuru,
    uygulananFiltreler,
    ayarlar
  );

  return {
    sayfaTuru,
    sayfaAdi: SAYFA_ADLARI[sayfaTuru],
    ayarlar,
    saglayicilar,
    modeller: filtrelenmisModeller,
    saglayiciGruplari: saglayiciyaGoreGrupla(filtrelenmisModeller),
    filtreArabirimi: filtreArabirimListesiniHazirla(ayarlar, sayfaTuru),
    ozet: ozetSayilariHesapla(filtrelenmisModeller, ayarlar, sayfaTuru),
  };
}

function degisiklikYapiciOlustur(ayarlar) {
  return {
    filtreyiEtkinlestir: (sayfaTuru, anahtar) => filtreyiEtkinlestir(ayarlar, sayfaTuru, anahtar),
    filtreyiPasiflestir: (sayfaTuru, anahtar) => filtreyiPasiflestir(ayarlar, sayfaTuru, anahtar),
    filtreyiGoster: (sayfaTuru, anahtar) => filtreyiGoster(ayarlar, sayfaTuru, anahtar),
    filtreyiGizle: (sayfaTuru, anahtar) => filtreyiGizle(ayarlar, sayfaTuru, anahtar),
    filtreyiOneCikar: (sayfaTuru, anahtar) => filtreyiOneCikar(ayarlar, sayfaTuru, anahtar),
    filtreyiGeriAl: (sayfaTuru, anahtar) => filtreyiGeriAl(ayarlar, sayfaTuru, anahtar),
    filtreyiZorunluYap: (sayfaTuru, anahtar) => filtreyiZorunluYap(ayarlar, sayfaTuru, anahtar),
    filtreyiOpsiyonelYap: (sayfaTuru, anahtar) => filtreyiOpsiyonelYap(ayarlar, sayfaTuru, anahtar),
    filtreyiGelismisYap: (sayfaTuru, anahtar) => filtreyiGelismisYap(ayarlar, sayfaTuru, anahtar),
    filtreyiTemelYap: (sayfaTuru, anahtar) => filtreyiTemelYap(ayarlar, sayfaTuru, anahtar),
    filtreyiYukariTasi: (sayfaTuru, anahtar) => filtreyiYukariTasi(ayarlar, sayfaTuru, anahtar),
    filtreyiAsagiTasi: (sayfaTuru, anahtar) => filtreyiAsagiTasi(ayarlar, sayfaTuru, anahtar),
  };
}

const ChatAll = {
  SABITLER: {
    CHATALL_DEPO_ANAHTARI,
    VARSAYILAN_SAYFA_TURU,
    TUM_SAYFA_TURLERI,
    SAYFA_ADLARI,
    GRUP_ADLARI,
  },

  filtreTanimlariniGetir,
  sayfayaGoreFiltreleriGetir,
  varsayilanFiltreAyarlariGetir,

  hamModelVerisiniGetir,
  hamSaglayiciVerisiniGetir,
  modelleriGetir,
  saglayicilariGetir,

  modeliNormalizeEt,
  modelleriNormalizeEt,
  saglayiciyiNormalizeEt,
  saglayicilariNormalizeEt,

  modelGecerliMi,
  saglayiciGecerliMi,
  metinGirdisiVarMi,
  gorselGirdisiVarMi,
  pdfGirdisiVarMi,
  sesGirdisiVarMi,
  aracCagirmaVarMi,
  akisYanitVarMi,
  baglamBilgisiVarMi,
  maksimumCiktiBilgisiVarMi,
  girisFiyatiVarMi,
  cikisFiyatiVarMi,
  fiyatiTamMi,
  ucretsizMi,

  chatIcinUygunMu,
  resimIcinUygunMu,
  videoIcinUygunMu,
  sesIcinUygunMu,
  ttsIcinUygunMu,
  sayfaTuruneGoreUygunMu,

  filtreAyarlariniGetir,
  filtreAyarlariniKaydet,
  filtreAyarlariniSifirla,
  varsayilanAyarlaraDon,
  filtreAyarlariniDisaAktar,
  filtreAyarlariniIceAktar,

  filtreEtkinMi,
  filtreGorunurMu,
  filtreOneCikarilmisMi,
  filtreZorunluMu,
  filtreGelismisMi,
  filtreyiEtkinlestir,
  filtreyiPasiflestir,
  filtreyiGoster,
  filtreyiGizle,
  filtreyiOneCikar,
  filtreyiGeriAl,
  filtreyiZorunluYap,
  filtreyiOpsiyonelYap,
  filtreyiGelismisYap,
  filtreyiTemelYap,
  filtreBagimliliklariniKontrolEt,
  filtreyiYukariTasi,
  filtreyiAsagiTasi,

  fiyatBilgisiniOku,
  fiyatBilgisiniSayiyaCevir,

  tekFiltreyiUygula,
  filtreleriUygula,
  fiyataGoreSirala,
  enUcuzdanPahaliyaSirala,
  enPahalidanUcuzaSirala,
  fiyatAraliginaGoreFiltrele,
  onceligeGoreSirala,
  adaGoreSirala,
  hizaGoreSirala,
  baglamaGoreSirala,
  yayinTarihineGoreSirala,
  bilgiTarihineGoreSirala,

  saglayiciyaGoreGrupla,
  grubaGoreToparla,
  sayfaTuruneGoreGrupla,
  onerilenleriAyir,
  gelismisleriAyir,
  zorunlulariAyir,
  gorunurleriAyir,

  kataloguHazirla,
  chatIcinKatalogHazirla,
  resimIcinKatalogHazirla,
  videoIcinKatalogHazirla,
  sesIcinKatalogHazirla,
  ttsIcinKatalogHazirla,
  sayfaIcinKatalogHazirla,
  arabirimeHazirVeriOlustur,
  modelKatalogunuHazirla,
  filtrelenmisModelListesiOlustur,
  sayfaIcinHazirModelListesiOlustur,
  sayfaVerisiniHazirla,
  degisiklikYapiciOlustur,
};

/* Puter Worker ortaminda import/export ve module.exports kullanilmaz; nesne globalThis uzerinden erisilebilir kalir. */
globalThis.ChatAll = ChatAll;
