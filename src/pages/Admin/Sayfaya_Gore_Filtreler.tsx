import React, { useEffect, useMemo, useState } from "react";

export type SayfaTuru = "chat" | "resim" | "video" | "ses" | "tts";

export type GrupTuru =
  | "kimlik"
  | "yetkinlik"
  | "girdi"
  | "maliyet"
  | "performans"
  | "zaman"
  | "davranis"
  | "gelismis";

export type FiltreTanimi = {
  anahtar: string;
  ad: string;
  aciklama: string;
  grup: GrupTuru;
  varsayilanEtkin: boolean;
  varsayilanGorunur: boolean;
  varsayilanOneCikar: boolean;
  varsayilanZorunlu: boolean;
  varsayilanGelismis: boolean;
  desteklenenSayfalar: SayfaTuru[];
  bagimliliklar?: string[];
};

export type FiltreDurumu = {
  etkin: boolean;
  gorunur: boolean;
  oneCikar: boolean;
  zorunlu: boolean;
  gelismis: boolean;
  sira: number;
};

export type SayfaFiltreAyarlari = Record<string, FiltreDurumu>;
export type TumAyarlar = Record<SayfaTuru, SayfaFiltreAyarlari>;

export const FILTRE_TANIMLARI: FiltreTanimi[] = [
  {
    anahtar: "saglayici",
    ad: "Sağlayıcı",
    aciklama: "Modeli veya üreticiyi sağlayan kaynak.",
    grup: "kimlik",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: true,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
  {
    anahtar: "model_adi",
    ad: "Model Adı",
    aciklama: "Modelin görünen adı.",
    grup: "kimlik",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: true,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
  {
    anahtar: "takma_ad",
    ad: "Takma Ad",
    aciklama: "Alias veya kısa ad ile arama yapılmasını sağlar.",
    grup: "kimlik",
    varsayilanEtkin: true,
    varsayilanGorunur: false,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: true,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
  {
    anahtar: "metin_girdisi",
    ad: "Metin Girdisi",
    aciklama: "Metin girişini destekleyen modelleri filtreler.",
    grup: "girdi",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: true,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "video", "ses", "tts"],
  },
  {
    anahtar: "gorsel_girdisi",
    ad: "Görsel Girdisi",
    aciklama: "Görsel girişini destekleyenleri filtreler.",
    grup: "girdi",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "resim", "video"],
  },
  {
    anahtar: "pdf_girdisi",
    ad: "PDF Girdisi",
    aciklama: "PDF kabul eden modelleri filtreler.",
    grup: "girdi",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat"],
  },
  {
    anahtar: "ses_girdisi",
    ad: "Ses Girdisi",
    aciklama: "Ses dosyası veya konuşma girdisi kabul edenleri filtreler.",
    grup: "girdi",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["ses", "video"],
  },
  {
    anahtar: "arac_cagirma",
    ad: "Araç Çağırma",
    aciklama: "Tool calling özelliği olan modelleri filtreler.",
    grup: "yetkinlik",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: true,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat"],
  },
  {
    anahtar: "akis_yanit",
    ad: "Akış Yanıtı",
    aciklama: "Stream desteği olan modelleri filtreler.",
    grup: "yetkinlik",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: true,
    desteklenenSayfalar: ["chat", "ses", "tts"],
  },
  {
    anahtar: "coklu_modlu",
    ad: "Çoklu Modlu",
    aciklama: "Birden fazla giriş türünü destekleyenleri filtreler.",
    grup: "yetkinlik",
    varsayilanEtkin: true,
    varsayilanGorunur: false,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: true,
    desteklenenSayfalar: ["chat", "resim", "video", "ses"],
    bagimliliklar: ["gorsel_girdisi"],
  },
  {
    anahtar: "baglam_kapasitesi",
    ad: "Bağlam Kapasitesi",
    aciklama: "Context window yani bağlam uzunluğuna göre filtreler.",
    grup: "performans",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: true,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "ses", "tts"],
  },
  {
    anahtar: "maksimum_cikti_tokeni",
    ad: "Maksimum Çıktı Tokeni",
    aciklama: "Maksimum çıktı uzunluğuna göre filtreler.",
    grup: "performans",
    varsayilanEtkin: true,
    varsayilanGorunur: false,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: true,
    desteklenenSayfalar: ["chat", "ses", "tts"],
  },
  {
    anahtar: "hiz",
    ad: "Hız",
    aciklama: "Hız niteliğine göre filtreler.",
    grup: "performans",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: true,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
  {
    anahtar: "giris_fiyati",
    ad: "Giriş Fiyatı",
    aciklama: "Input fiyatına göre filtreler.",
    grup: "maliyet",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: true,
    varsayilanZorunlu: true,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
  {
    anahtar: "cikis_fiyati",
    ad: "Çıkış Fiyatı",
    aciklama: "Output fiyatına göre filtreler.",
    grup: "maliyet",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: true,
    varsayilanZorunlu: true,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
  {
    anahtar: "ucretsiz_mi",
    ad: "Ücretsiz Mi",
    aciklama: "Ücretsiz veya bedelsiz kullanım durumunu filtreler.",
    grup: "maliyet",
    varsayilanEtkin: true,
    varsayilanGorunur: false,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: true,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
    bagimliliklar: ["giris_fiyati", "cikis_fiyati"],
  },
  {
    anahtar: "bilgi_tarihi",
    ad: "Bilgi Tarihi",
    aciklama: "Modelin bilgi kesim tarihine göre filtreler.",
    grup: "zaman",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "ses", "tts"],
  },
  {
    anahtar: "yayin_tarihi",
    ad: "Yayın Tarihi",
    aciklama: "Modelin çıkış tarihine göre filtreler.",
    grup: "zaman",
    varsayilanEtkin: true,
    varsayilanGorunur: true,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: false,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
  {
    anahtar: "acik_agirlik",
    ad: "Açık Ağırlık",
    aciklama: "Open weights durumuna göre filtreler.",
    grup: "davranis",
    varsayilanEtkin: true,
    varsayilanGorunur: false,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: true,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
  {
    anahtar: "onerilen",
    ad: "Önerilen",
    aciklama: "Yönetici tarafından öne çıkarılmış filtreleri işaretler.",
    grup: "davranis",
    varsayilanEtkin: true,
    varsayilanGorunur: false,
    varsayilanOneCikar: true,
    varsayilanZorunlu: false,
    varsayilanGelismis: true,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
  {
    anahtar: "kalite_seviyesi",
    ad: "Kalite Seviyesi",
    aciklama: "Kalite seviyesine göre filtreleme sağlar.",
    grup: "performans",
    varsayilanEtkin: true,
    varsayilanGorunur: false,
    varsayilanOneCikar: false,
    varsayilanZorunlu: false,
    varsayilanGelismis: true,
    desteklenenSayfalar: ["chat", "resim", "video", "ses", "tts"],
  },
];

const SAYFA_ADLARI: Record<SayfaTuru, string> = {
  chat: "Chat",
  resim: "Resim",
  video: "Video",
  ses: "Ses",
  tts: "TTS",
};

const GRUP_ADLARI: Record<GrupTuru, string> = {
  kimlik: "Kimlik",
  yetkinlik: "Yetkinlik",
  girdi: "Girdi",
  maliyet: "Maliyet",
  performans: "Performans",
  zaman: "Zaman",
  davranis: "Davranış",
  gelismis: "Gelişmiş",
};

export function sayfayaGoreFiltreleriGetir(sayfa: SayfaTuru) {
  return FILTRE_TANIMLARI.filter((filtre) =>
    filtre.desteklenenSayfalar.includes(sayfa)
  );
}

export function varsayilanAyarOlustur(): TumAyarlar {
  const sayfalar: SayfaTuru[] = ["chat", "resim", "video", "ses", "tts"];
  const sonuc = {} as TumAyarlar;

  sayfalar.forEach((sayfa) => {
    const filtreler = sayfayaGoreFiltreleriGetir(sayfa);
    const ayarlar: SayfaFiltreAyarlari = {};
    filtreler.forEach((filtre, index) => {
      ayarlar[filtre.anahtar] = {
        etkin: filtre.varsayilanEtkin,
        gorunur: filtre.varsayilanGorunur,
        oneCikar: filtre.varsayilanOneCikar,
        zorunlu: filtre.varsayilanZorunlu,
        gelismis: filtre.varsayilanGelismis,
        sira: index + 1,
      };
    });
    sonuc[sayfa] = ayarlar;
  });

  return sonuc;
}

export function bagimliliklariSagliyorMu(
  filtre: FiltreTanimi,
  ayarlar: SayfaFiltreAyarlari
) {
  if (!filtre.bagimliliklar || filtre.bagimliliklar.length === 0) return true;
  return filtre.bagimliliklar.every(
    (anahtar) => ayarlar[anahtar] && ayarlar[anahtar].etkin
  );
}

function yerDegistir(
  ayarlar: SayfaFiltreAyarlari,
  birinciAnahtar: string,
  ikinciAnahtar: string
): SayfaFiltreAyarlari {
  const kopya = { ...ayarlar };
  const gecici = kopya[birinciAnahtar].sira;
  kopya[birinciAnahtar] = { ...kopya[birinciAnahtar], sira: kopya[ikinciAnahtar].sira };
  kopya[ikinciAnahtar] = { ...kopya[ikinciAnahtar], sira: gecici };
  return kopya;
}

function anahtarIleSirala(
  filtreler: FiltreTanimi[],
  ayarlar: SayfaFiltreAyarlari
) {
  return [...filtreler].sort((a, b) => {
    const aSira = ayarlar[a.anahtar]?.sira ?? 9999;
    const bSira = ayarlar[b.anahtar]?.sira ?? 9999;
    return aSira - bSira;
  });
}

function sayilariHesapla(ayarlar: SayfaFiltreAyarlari) {
  const tum = Object.values(ayarlar);
  return {
    toplam: tum.length,
    etkin: tum.filter((x) => x.etkin).length,
    gorunur: tum.filter((x) => x.gorunur).length,
    oneCikan: tum.filter((x) => x.oneCikar).length,
    zorunlu: tum.filter((x) => x.zorunlu).length,
    gelismis: tum.filter((x) => x.gelismis).length,
  };
}

export default function SayfayaGoreFiltrelerYonetimi() {
  const [seciliSayfa, setSeciliSayfa] = useState<SayfaTuru>("chat");
  const [tumAyarlar, setTumAyarlar] = useState<TumAyarlar>(() => varsayilanAyarOlustur());
  const [aramaMetni, setAramaMetni] = useState("");
  const [yalnizcaEtkinler, setYalnizcaEtkinler] = useState(false);
  const [yalnizcaGorunurler, setYalnizcaGorunurler] = useState(false);
  const [yalnizcaOneCikanlar, setYalnizcaOneCikanlar] = useState(false);
  const [yalnizcaZorunlular, setYalnizcaZorunlular] = useState(false);
  const [yalnizcaGelismisler, setYalnizcaGelismisler] = useState(false);
  const [grupFiltresi, setGrupFiltresi] = useState<GrupTuru | "tum">("tum");
  const [durumaGoreGizle, setDurumaGoreGizle] = useState(true);

  useEffect(() => {
    const kayit = localStorage.getItem("sayfaya_gore_filtre_ayarlari");
    if (kayit) {
      try {
        setTumAyarlar(JSON.parse(kayit));
      } catch {
        // Sessiz geç
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem("sayfaya_gore_filtre_ayarlari", JSON.stringify(tumAyarlar));
  }, [tumAyarlar]);

  const seciliSayfaAyarleri = tumAyarlar[seciliSayfa];
  const seciliSayfaFiltreleri = useMemo(
    () => sayfayaGoreFiltreleriGetir(seciliSayfa),
    [seciliSayfa]
  );

  const gorunenFiltreler = useMemo(() => {
    let liste = anahtarIleSirala(seciliSayfaFiltreleri, seciliSayfaAyarleri);

    if (durumaGoreGizle) {
      liste = liste.filter((filtre) =>
        bagimliliklariSagliyorMu(filtre, seciliSayfaAyarleri)
      );
    }

    if (aramaMetni.trim()) {
      const metin = aramaMetni.toLocaleLowerCase("tr");
      liste = liste.filter(
        (filtre) =>
          filtre.ad.toLocaleLowerCase("tr").includes(metin) ||
          filtre.aciklama.toLocaleLowerCase("tr").includes(metin) ||
          filtre.anahtar.toLocaleLowerCase("tr").includes(metin)
      );
    }

    if (grupFiltresi !== "tum") {
      liste = liste.filter((filtre) => filtre.grup === grupFiltresi);
    }

    if (yalnizcaEtkinler) {
      liste = liste.filter((filtre) => seciliSayfaAyarleri[filtre.anahtar]?.etkin);
    }

    if (yalnizcaGorunurler) {
      liste = liste.filter((filtre) => seciliSayfaAyarleri[filtre.anahtar]?.gorunur);
    }

    if (yalnizcaOneCikanlar) {
      liste = liste.filter((filtre) => seciliSayfaAyarleri[filtre.anahtar]?.oneCikar);
    }

    if (yalnizcaZorunlular) {
      liste = liste.filter((filtre) => seciliSayfaAyarleri[filtre.anahtar]?.zorunlu);
    }

    if (yalnizcaGelismisler) {
      liste = liste.filter((filtre) => seciliSayfaAyarleri[filtre.anahtar]?.gelismis);
    }

    return liste;
  }, [
    seciliSayfaFiltreleri,
    seciliSayfaAyarleri,
    aramaMetni,
    grupFiltresi,
    yalnizcaEtkinler,
    yalnizcaGorunurler,
    yalnizcaOneCikanlar,
    yalnizcaZorunlular,
    yalnizcaGelismisler,
    durumaGoreGizle,
  ]);

  const ozet = useMemo(
    () => sayilariHesapla(seciliSayfaAyarleri),
    [seciliSayfaAyarleri]
  );

  function sayfaAyariGuncelle(
    sayfa: SayfaTuru,
    anahtar: string,
    alan: keyof FiltreDurumu,
    deger: boolean | number
  ) {
    setTumAyarlar((onceki) => ({
      ...onceki,
      [sayfa]: {
        ...onceki[sayfa],
        [anahtar]: {
          ...onceki[sayfa][anahtar],
          [alan]: deger,
        },
      },
    }));
  }

  function tumunuEtkinlestir() {
    setTumAyarlar((onceki) => {
      const kopya = { ...onceki };
      Object.keys(kopya[seciliSayfa]).forEach((anahtar) => {
        kopya[seciliSayfa][anahtar] = {
          ...kopya[seciliSayfa][anahtar],
          etkin: true,
        };
      });
      return kopya;
    });
  }

  function tumunuPasiflestir() {
    setTumAyarlar((onceki) => {
      const kopya = { ...onceki };
      Object.keys(kopya[seciliSayfa]).forEach((anahtar) => {
        kopya[seciliSayfa][anahtar] = {
          ...kopya[seciliSayfa][anahtar],
          etkin: false,
        };
      });
      return kopya;
    });
  }

  function tumunuGorunurYap() {
    setTumAyarlar((onceki) => {
      const kopya = { ...onceki };
      Object.keys(kopya[seciliSayfa]).forEach((anahtar) => {
        kopya[seciliSayfa][anahtar] = {
          ...kopya[seciliSayfa][anahtar],
          gorunur: true,
        };
      });
      return kopya;
    });
  }

  function tumunuGizle() {
    setTumAyarlar((onceki) => {
      const kopya = { ...onceki };
      Object.keys(kopya[seciliSayfa]).forEach((anahtar) => {
        kopya[seciliSayfa][anahtar] = {
          ...kopya[seciliSayfa][anahtar],
          gorunur: false,
        };
      });
      return kopya;
    });
  }

  function varsayilanaDon() {
    setTumAyarlar((onceki) => ({
      ...onceki,
      [seciliSayfa]: varsayilanAyarOlustur()[seciliSayfa],
    }));
  }

  function yukariTasi(anahtar: string) {
    const sirali = anahtarIleSirala(seciliSayfaFiltreleri, seciliSayfaAyarleri);
    const index = sirali.findIndex((x) => x.anahtar === anahtar);
    if (index <= 0) return;
    const ust = sirali[index - 1];
    setTumAyarlar((onceki) => ({
      ...onceki,
      [seciliSayfa]: yerDegistir(onceki[seciliSayfa], anahtar, ust.anahtar),
    }));
  }

  function asagiTasi(anahtar: string) {
    const sirali = anahtarIleSirala(seciliSayfaFiltreleri, seciliSayfaAyarleri);
    const index = sirali.findIndex((x) => x.anahtar === anahtar);
    if (index === -1 || index >= sirali.length - 1) return;
    const alt = sirali[index + 1];
    setTumAyarlar((onceki) => ({
      ...onceki,
      [seciliSayfa]: yerDegistir(onceki[seciliSayfa], anahtar, alt.anahtar),
    }));
  }

  function ayarDisaAktar() {
    const metin = JSON.stringify(tumAyarlar, null, 2);
    navigator.clipboard.writeText(metin);
    alert("Ayarlar panoya kopyalandı.");
  }

  function ayarIceriAktar() {
    const metin = prompt("Yapıştırılacak ayar JSON metnini girin:");
    if (!metin) return;
    try {
      const cozulmus = JSON.parse(metin);
      setTumAyarlar(cozulmus);
      alert("Ayarlar içe aktarıldı.");
    } catch {
      alert("Geçersiz JSON.");
    }
  }

  return (
    <div style={stiller.kapsayici}>
      <div style={stiller.baslikAlani}>
        <div>
          <h1 style={stiller.baslik}>Admin / Sayfaya Göre Filtreler</h1>
          <p style={stiller.altBaslik}>
            Chat, Resim, Video, Ses ve TTS için filtre kullanımı, görünürlük,
            öncelik, sıra ve gelişmiş kontrol yönetimi.
          </p>
        </div>
        <div style={stiller.ustButonlar}>
          <button style={stiller.buton} onClick={ayarDisaAktar}>
            Ayarları Dışa Aktar
          </button>
          <button style={stiller.buton} onClick={ayarIceriAktar}>
            Ayarları İçe Aktar
          </button>
        </div>
      </div>

      <div style={stiller.sekmeSatiri}>
        {(Object.keys(SAYFA_ADLARI) as SayfaTuru[]).map((sayfa) => (
          <button
            key={sayfa}
            onClick={() => setSeciliSayfa(sayfa)}
            style={{
              ...stiller.sekme,
              ...(seciliSayfa === sayfa ? stiller.sekmeSecili : {}),
            }}
          >
            {SAYFA_ADLARI[sayfa]}
          </button>
        ))}
      </div>

      <div style={stiller.ozetSatiri}>
        <Kutu baslik="Toplam" deger={String(ozet.toplam)} />
        <Kutu baslik="Etkin" deger={String(ozet.etkin)} />
        <Kutu baslik="Görünür" deger={String(ozet.gorunur)} />
        <Kutu baslik="Öne Çıkan" deger={String(ozet.oneCikan)} />
        <Kutu baslik="Zorunlu" deger={String(ozet.zorunlu)} />
        <Kutu baslik="Gelişmiş" deger={String(ozet.gelismis)} />
      </div>

      <div style={stiller.kontrolPaneli}>
        <div style={stiller.kontrolGrubu}>
          <input
            value={aramaMetni}
            onChange={(e) => setAramaMetni(e.target.value)}
            placeholder="Filtre ara..."
            style={stiller.giris}
          />
          <select
            value={grupFiltresi}
            onChange={(e) => setGrupFiltresi(e.target.value as GrupTuru | "tum")}
            style={stiller.secim}
          >
            <option value="tum">Tüm Gruplar</option>
            {(Object.keys(GRUP_ADLARI) as GrupTuru[]).map((grup) => (
              <option key={grup} value={grup}>
                {GRUP_ADLARI[grup]}
              </option>
            ))}
          </select>
        </div>

        <div style={stiller.kontrolGrubu}>
          <EtiketliOnayKutusu
            etiket="Yalnızca etkinler"
            secili={yalnizcaEtkinler}
            degistir={setYalnizcaEtkinler}
          />
          <EtiketliOnayKutusu
            etiket="Yalnızca görünürler"
            secili={yalnizcaGorunurler}
            degistir={setYalnizcaGorunurler}
          />
          <EtiketliOnayKutusu
            etiket="Yalnızca öne çıkanlar"
            secili={yalnizcaOneCikanlar}
            degistir={setYalnizcaOneCikanlar}
          />
          <EtiketliOnayKutusu
            etiket="Yalnızca zorunlular"
            secili={yalnizcaZorunlular}
            degistir={setYalnizcaZorunlular}
          />
          <EtiketliOnayKutusu
            etiket="Yalnızca gelişmişler"
            secili={yalnizcaGelismisler}
            degistir={setYalnizcaGelismisler}
          />
          <EtiketliOnayKutusu
            etiket="Bağımlılık dışındakileri gizle"
            secili={durumaGoreGizle}
            degistir={setDurumaGoreGizle}
          />
        </div>

        <div style={stiller.kontrolGrubu}>
          <button style={stiller.buton} onClick={tumunuEtkinlestir}>
            Tümünü Etkinleştir
          </button>
          <button style={stiller.buton} onClick={tumunuPasiflestir}>
            Tümünü Pasifleştir
          </button>
          <button style={stiller.buton} onClick={tumunuGorunurYap}>
            Tümünü Görünür Yap
          </button>
          <button style={stiller.buton} onClick={tumunuGizle}>
            Tümünü Gizle
          </button>
          <button style={stiller.buton} onClick={varsayilanaDon}>
            Varsayılana Dön
          </button>
        </div>
      </div>

      <div style={stiller.listeBaslik}>
        <div style={{ flex: 2 }}>Filtre</div>
        <div style={{ width: 90 }}>Sıra</div>
        <div style={{ width: 90 }}>Etkin</div>
        <div style={{ width: 90 }}>Görünür</div>
        <div style={{ width: 90 }}>Öne Çıkar</div>
        <div style={{ width: 90 }}>Zorunlu</div>
        <div style={{ width: 90 }}>Gelişmiş</div>
        <div style={{ width: 140 }}>Taşı</div>
      </div>

      <div style={stiller.liste}>
        {gorunenFiltreler.map((filtre) => {
          const ayar = seciliSayfaAyarleri[filtre.anahtar];
          const bagimlilikSaglandi = bagimliliklariSagliyorMu(
            filtre,
            seciliSayfaAyarleri
          );

          return (
            <div
              key={filtre.anahtar}
              style={{
                ...stiller.satir,
                opacity: bagimlilikSaglandi ? 1 : 0.55,
              }}
            >
              <div style={{ flex: 2 }}>
                <div style={stiller.filtreAdiSatiri}>
                  <strong>{filtre.ad}</strong>
                  <span style={stiller.rozeti}>{GRUP_ADLARI[filtre.grup]}</span>
                  {filtre.bagimliliklar && filtre.bagimliliklar.length > 0 && (
                    <span style={stiller.uyariRozeti}>
                      Bağımlı: {filtre.bagimliliklar.join(", ")}
                    </span>
                  )}
                </div>
                <div style={stiller.filtreAciklamasi}>{filtre.aciklama}</div>
                <div style={stiller.anahtarMetni}>Anahtar: {filtre.anahtar}</div>
              </div>

              <div style={{ width: 90, textAlign: "center" }}>{ayar.sira}</div>

              <div style={{ width: 90, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={ayar.etkin}
                  onChange={(e) =>
                    sayfaAyariGuncelle(
                      seciliSayfa,
                      filtre.anahtar,
                      "etkin",
                      e.target.checked
                    )
                  }
                />
              </div>

              <div style={{ width: 90, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={ayar.gorunur}
                  onChange={(e) =>
                    sayfaAyariGuncelle(
                      seciliSayfa,
                      filtre.anahtar,
                      "gorunur",
                      e.target.checked
                    )
                  }
                />
              </div>

              <div style={{ width: 90, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={ayar.oneCikar}
                  onChange={(e) =>
                    sayfaAyariGuncelle(
                      seciliSayfa,
                      filtre.anahtar,
                      "oneCikar",
                      e.target.checked
                    )
                  }
                />
              </div>

              <div style={{ width: 90, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={ayar.zorunlu}
                  onChange={(e) =>
                    sayfaAyariGuncelle(
                      seciliSayfa,
                      filtre.anahtar,
                      "zorunlu",
                      e.target.checked
                    )
                  }
                />
              </div>

              <div style={{ width: 90, textAlign: "center" }}>
                <input
                  type="checkbox"
                  checked={ayar.gelismis}
                  onChange={(e) =>
                    sayfaAyariGuncelle(
                      seciliSayfa,
                      filtre.anahtar,
                      "gelismis",
                      e.target.checked
                    )
                  }
                />
              </div>

              <div style={{ width: 140, display: "flex", gap: 8, justifyContent: "center" }}>
                <button
                  style={stiller.kucukButon}
                  onClick={() => yukariTasi(filtre.anahtar)}
                >
                  Yukarı
                </button>
                <button
                  style={stiller.kucukButon}
                  onClick={() => asagiTasi(filtre.anahtar)}
                >
                  Aşağı
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <div style={stiller.altNot}>
        En doğru kullanım: Bu yönetim ekranı admin tarafında bulunur.
        Chat, Resim, Video, Ses ve TTS ekranları ise buradaki ayarları okuyup uygular.
      </div>
    </div>
  );
}

function Kutu({ baslik, deger }: { baslik: string; deger: string }) {
  return (
    <div style={stiller.ozetKutusu}>
      <div style={stiller.ozetBaslik}>{baslik}</div>
      <div style={stiller.ozetDeger}>{deger}</div>
    </div>
  );
}

function EtiketliOnayKutusu({
  etiket,
  secili,
  degistir,
}: {
  etiket: string;
  secili: boolean;
  degistir: (deger: boolean) => void;
}) {
  return (
    <label style={stiller.onayKutusuEtiketi}>
      <input
        type="checkbox"
        checked={secili}
        onChange={(e) => degistir(e.target.checked)}
      />
      <span>{etiket}</span>
    </label>
  );
}

const stiller: Record<string, React.CSSProperties> = {
  kapsayici: {
    padding: 20,
    fontFamily: "Arial, sans-serif",
    color: "#111827",
    background: "#f8fafc",
  },
  baslikAlani: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 16,
    marginBottom: 16,
    flexWrap: "wrap",
  },
  baslik: {
    margin: 0,
    fontSize: 28,
  },
  altBaslik: {
    marginTop: 6,
    color: "#475569",
  },
  ustButonlar: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
  },
  sekmeSatiri: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    marginBottom: 16,
  },
  sekme: {
    padding: "10px 16px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "white",
    cursor: "pointer",
  },
  sekmeSecili: {
    background: "#dbeafe",
    borderColor: "#60a5fa",
    fontWeight: 700,
  },
  ozetSatiri: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
    gap: 12,
    marginBottom: 16,
  },
  ozetKutusu: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 12,
  },
  ozetBaslik: {
    fontSize: 13,
    color: "#64748b",
  },
  ozetDeger: {
    fontSize: 24,
    fontWeight: 700,
  },
  kontrolPaneli: {
    background: "white",
    border: "1px solid #e2e8f0",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    display: "flex",
    flexDirection: "column",
    gap: 12,
  },
  kontrolGrubu: {
    display: "flex",
    gap: 12,
    flexWrap: "wrap",
    alignItems: "center",
  },
  giris: {
    minWidth: 240,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
  },
  secim: {
    minWidth: 180,
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "white",
  },
  buton: {
    padding: "10px 12px",
    borderRadius: 10,
    border: "1px solid #cbd5e1",
    background: "#fff",
    cursor: "pointer",
  },
  kucukButon: {
    padding: "8px 10px",
    borderRadius: 8,
    border: "1px solid #cbd5e1",
    background: "#fff",
    cursor: "pointer",
    fontSize: 12,
  },
  listeBaslik: {
    display: "flex",
    gap: 12,
    padding: "12px 14px",
    background: "#e2e8f0",
    borderRadius: "12px 12px 0 0",
    fontWeight: 700,
    fontSize: 13,
  },
  liste: {
    border: "1px solid #e2e8f0",
    borderTop: "none",
    borderRadius: "0 0 12px 12px",
    overflow: "hidden",
    background: "white",
  },
  satir: {
    display: "flex",
    gap: 12,
    padding: "14px",
    borderBottom: "1px solid #e2e8f0",
    alignItems: "center",
  },
  filtreAdiSatiri: {
    display: "flex",
    gap: 8,
    alignItems: "center",
    flexWrap: "wrap",
    marginBottom: 6,
  },
  filtreAciklamasi: {
    color: "#475569",
    fontSize: 14,
    marginBottom: 4,
  },
  anahtarMetni: {
    color: "#64748b",
    fontSize: 12,
  },
  rozeti: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 8px",
    background: "#eef2ff",
    color: "#3730a3",
    fontSize: 12,
  },
  uyariRozeti: {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 999,
    padding: "4px 8px",
    background: "#fef3c7",
    color: "#92400e",
    fontSize: 12,
  },
  altNot: {
    marginTop: 16,
    color: "#475569",
    fontSize: 14,
  },
  onayKutusuEtiketi: {
    display: "inline-flex",
    alignItems: "center",
    gap: 6,
    fontSize: 14,
  },
};
