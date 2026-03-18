AMG — 30 MADDE + HANGİ FONKSİYONLARDA GERÇEKLEŞİYOR

1. CORS başlıklarını hazırlayıp çapraz istekleri güvenli açar.
   Fonksiyonlar: corsBasliklariniHazirla, jsonBasliklariniHazirla, secenekIsteginiYanitla

2. JSON yanıt omurgasını standartlaştırır.
   Fonksiyonlar: jsonBasliklariniHazirla, basariCevabiUret, hataCevabiUret

3. OPTIONS preflight isteklerini doğrudan cevaplar.
   Fonksiyonlar: secenekIsteginiYanitla
   Rota: router.options('/*yol')

4. Gelen request body içindeki JSON’u güvenli biçimde çözer.
   Fonksiyonlar: govdeyiCozumle

5. Metinleri belirli üst sınıra göre kırpar.
   Fonksiyonlar: metniKirp

6. Sayısal girişleri güvenli alt-üst sınırlar içinde normalize eder.
   Fonksiyonlar: sayiDonustur

7. Zaman damgası ve dakika penceresi üretir.
   Fonksiyonlar: dakikayiDamgala, saniyeDamgasiAl

8. KV ve önbellek için standart anahtar biçimi üretir.
   Fonksiyonlar: anahtariOlustur

9. Uygulama ayarlarını KV’den okur.
   Fonksiyonlar: ayarlariGetir
   Rotalar: /api/durum, /api/ayarlar/getir, /api/ayarlar/kaydet

10. Uygulama ayarlarını KV’ye kaydeder.
    Fonksiyonlar: ayarlariKaydet
    Rota: /api/ayarlar/kaydet

11. Ayarları dış dünyaya güvenli/sade biçimde hazırlar.
    Fonksiyonlar: ayarlariDisariHazirla
    Rotalar: /api/ayarlar/getir, /api/ayarlar/kaydet

12. İstemci kimliğini request, origin veya user bağlamından çıkarır.
    Fonksiyonlar: istemciKimliginiCikar

13. Dakika bazlı istek sınırı uygular.
    Fonksiyonlar: istekSiniriniKontrolEt
    Rotalar: /api/sohbet, /api/sohbet/akis, /api/gorsel

14. Mesaj yapısının dizi/nesne/boşluk tür kontrollerini yapar.
    Fonksiyonlar: diziMi, nesneMi, bosMu

15. Sohbet mesaj rollerini doğrular.
    Fonksiyonlar: rolGecerliMi

16. Mesaj içeriğindeki yazı parçalarını birleştirip düz metin çıkarır.
    Fonksiyonlar: yaziIceriginiTopla

17. Tek tek mesaj içeriklerini doğrular.
    Fonksiyonlar: mesajIceriginiDogrula

18. Sohbet request body’sini bütün olarak doğrular ve normalize eder.
    Fonksiyonlar: sohbetGovdesiniDogrula
    Rotalar: /api/sohbet, /api/sohbet/akis

19. Görsel üretim request body’sini doğrular ve normalize eder.
    Fonksiyonlar: gorselGovdesiniDogrula
    Rota: /api/gorsel

20. Ayar kaydetme gövdesini doğrular.
    Fonksiyonlar: ayarGirdisiniDogrula
    Rota: /api/ayarlar/kaydet

21. Ortak durum yazma gövdesini doğrular.
    Fonksiyonlar: ortakDurumGovdesiniDogrula
    Rota: /api/ortak-durum/yaz

22. Önbellek silme gövdesini doğrular.
    Fonksiyonlar: onbellekSilGovdesiniDogrula
    Rota: /api/onbellek/sil

23. Yönetici anahtarının kurulu olup olmadığını kontrol eder.
    Fonksiyonlar: yoneticiAnahtariVarMi
    Rotalar: /api/durum, /api/ayarlar/kaydet

24. Yönetici yetkisini doğrular.
    Fonksiyonlar: yoneticiYetkisiniDogrula
    Rotalar: /api/ayarlar/kaydet, /api/ortak-durum/yaz, /api/onbellek/sil

25. Ortak durum verisini KV’den okur ve KV’ye yazar.
    Fonksiyonlar: ortakDurumuOku, ortakDurumuYaz
    Rotalar: /api/ortak-durum/oku, /api/ortak-durum/yaz

26. Sohbet isteği için AI chat seçeneklerini hazırlar.
    Fonksiyonlar: sohbetSecenekleriniHazirla

27. AI chat yanıtını düz metne çevirir.
    Fonksiyonlar: sohbetYanitiniMetneDonustur

28. Görsel üretim çıktısını çözümleyip URL/ham veri ayıklar.
    Fonksiyonlar: gorselCiktisiniCozumle

29. Hataları güvenli metne indirger ve güvenli log basar.
    Fonksiyonlar: guvenliHataMesajiAl, guvenliLogYaz

30. AMG’nin asıl işi olan sohbet, akışlı sohbet, SSE, görsel üretimi, önbellek yazımı, durum/model/test endpointlerini yürütür.
    Fonksiyonlar: sseSatiriUret, akisDestegiVarMi, akisYanitiUret, sohbetiCalistir, tumOzetiOlustur
    Rotalar: 
    - /api/sohbet
    - /api/sohbet/akis
    - /api/gorsel
    - /api/durum
    - /api/modeller
    - /api/ayarlar/getir
    - /api/ayarlar/kaydet
    - /api/ortak-durum/oku
    - /api/ortak-durum/yaz
    - /api/onbellek/sil
    - /
    - /tumu
    - /api
    - /api/test/calisiyor
    - /api/test/saglik
    - /api/test/me-puter
    - /api/amac
