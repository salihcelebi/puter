AMH — 30 MADDE + HANGİ FONKSİYONLARDA GERÇEKLEŞİYOR

1. CORS ve JSON response omurgasını kurar.
   Fonksiyonlar: corsBasliklariniHazirla, jsonBasliklariniHazirla, yanitDondur, basariCevabiUret, hataCevabiUret, secenekIsteginiYanitla

2. Gelen request body JSON’unu güvenli çözer.
   Fonksiyonlar: govdeyiCozumle

3. Temel tür yardımcılarını sağlar.
   Fonksiyonlar: nesneMi, diziMi

4. Metin ve sayı normalizasyonu yapar.
   Fonksiyonlar: metniKirp, sayiDonustur, metniDiziyeCevir

5. Veri kopyalama ve zaman/anahtar yardımcılarını sağlar.
   Fonksiyonlar: kopyaOlustur, simdiIso, sayiDamgasiAl, anahtarBirlestir, dakikaPenceresiDamgasiAl, saniyeDamgasiAl

6. Çalışan me.puter bağlamını resolve eder.
   Fonksiyonlar: calisanMePuteriniAl

7. Güvenli log üretir.
   Fonksiyonlar: guvenliLogYaz

8. KV/depo anahtarlarını üretir.
   Fonksiyonlar: depoAnahtariUret

9. KV/depo üzerinden veri okuma, yazma ve silme yapar.
   Fonksiyonlar: depodanOku, depoyaYaz, depodanSil

10. me.puter içindeki derin metodlara erişir ve çağırır.
    Fonksiyonlar: mePuterMetodunuAl, mePuterMetodunuCalistir

11. Hizmet türüne göre tahmini maliyet hesaplar.
    Fonksiyonlar: tahminiMaliyetHesapla

12. Skorlama ve benzersiz imza üretimi yapar.
    Fonksiyonlar: agirlikliSkorHesapla, benzersizImzaUret

13. Tüm sistem için standart cevap gövdesi oluşturur.
    Fonksiyonlar: standartCevapGovdesiOlustur

14. Olay kimliği ve korelasyon üretir.
    Fonksiyonlar: olayKimligiUret

15. İstek bağlamını; iş kimliği, zaman, meta ve izleme bilgileriyle hazırlar.
    Fonksiyonlar: istekBaglaminiHazirla

16. Gelen girdiden hangi hizmet türünün istendiğini çözer.
    Fonksiyonlar: hizmetTurunuCozumle

17. Girdiyi hizmet türüne göre güvenli biçimde doğrular.
    Fonksiyonlar: guvenliGirdiDogrula

18. Varsayılan ayar + kullanıcı tercihi + güvenlik kısıtı birleşiminden etkin ayar üretir.
    Fonksiyonlar: etkinAyariOlustur

19. Hata tipini sınıflandırır.
    Fonksiyonlar: hataSinifiniBelirle

20. Kullanıcı/panel/geliştirici düzeyine göre güvenli hata özeti üretir.
    Fonksiyonlar: guvenliHataOzetiUret

21. Yeniden deneme gerekip gerekmediğine karar verir.
    Fonksiyonlar: yenidenDenemeKarariniVer

22. İşlem metaverisini hazırlar.
    Fonksiyonlar: islemMetaverisiniHazirla

23. Seçilen hizmetin yetkinliğini/erişimini kontrol eder.
    Fonksiyonlar: hizmetYetkinliginiKontrolEt

24. Sonucun kalitesini puanlar.
    Fonksiyonlar: sonucKalitesiniPuanla

25. Hizmete özel filtre ve kısıtları uygular.
    Fonksiyonlar: hizmeteOzelFiltreleriUygula

26. Normalize girdiyi sağlayıcı isteği gövdesine çevirir.
    Fonksiyonlar: saglayiciIstekGovdesiHazirla

27. Sağlayıcıdan gelen ham yanıtı ortak sisteme çevirir.
    Fonksiyonlar: saglayiciYanitiCozumle

28. Asıl AI işlerini tek tek yürütür.
    Fonksiyonlar:
    - sohbetApiCagrisiniYurut
    - gorselApiCagrisiniYurut
    - videoApiCagrisiniYurut
    - seslendirmeApiCagrisiniYurut
    - ocrApiCagrisiniYurut
    - pdfApiCagrisiniYurut
    - derinAramaApiCagrisiniYurut

29. Orkestrasyon, sağlayıcı seçimi, fallback, bütçe, timeout, çok adımlı akış ve sonuç birleştirmeyi yönetir.
    Fonksiyonlar:
    - uygunIsciyiSec
    - saglayiciOnceliginiBelirle
    - fallbackZinciriniKur
    - maliyetButcesiniYonet
    - zamanAsimiPolitikasiniUygula
    - cokAdimliAkisiYonet
    - sonucBirlestiriciyiCalistir
    - iptalVeDuraklatmaKarariniVer
    - orkestrayiBaslat
    - tumSistemiKoordineEt

30. İş kaydı, geçmiş, arşiv, izleme, sağlık, teşhis, sağlayıcı testi, KV testi, fallback testi, gecikme analizi, raporlama ve kök/panel endpointlerini üretir.
    Fonksiyonlar:
    - isKaydiBaslat
    - isDurumunuGuncelle
    - isGecmisineKaydet
    - isDurumuOzetiUret
    - kuyruktaBekleyenIsiIzle
    - gecmisVeSonucArsiviniHazirla
    - sistemSaglikTaramasiYap
    - hizmetBazliTeshisYap
    - saglayiciErisimTestiYap
    - kvVeDurumDeposuTestiYap
    - fallbackMekanizmasiniSinamaYap
    - gecikmeVeSureAnaliziYap
    - maliyetSapmasiniAnalizEt
    - tanisalRaporUret
    - panelIcinKisaDurumHazirla
    - aiaiSinifGorevOzetiniOlustur
    - kokEndpointAiaiTumuCevabiniUret
    - kokEndpointiTumuGibiCalistir
    - ispatOzetiHazirla
    Rotalar:
    - /
    - /tumu
    - /api/durum
    - /api/panel
    - /api/is/:isKimligi
    - /api/is/:isKimligi/gecmis
    - /api/is/:isKimligi/arsiv
    - /api/is/:isKimligi/izle
    - /api/calistir
    - /api/teshis
    - /api/teshis/:hizmetTuru
    - /api/saglayici/:hizmetTuru/:saglayici
    - /api/ispat/ozet
