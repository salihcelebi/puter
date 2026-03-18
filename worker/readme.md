
worker adı:
amg
canlı worker URL’si:
https://amg.puter.work
█████████████████████████████████████████████
worker adı:
amh
canlı worker URL’si:
https://amh.puter.work
█████████████████████████████████████████████

amg ve amh worker’ları Puter hosting üzerinde bulunuyor.
Doğrudan Puter hosting üzerinden okunamayacağı için  herkese açık kamuya açık raw dosyalarına aşağıdaki urllerden  erişililebilir :

https://turk.puter.site/workers/all/amg.js
https://turk.puter.site/workers/all/amh.js
█████████████████████████████████████████████

🔥 AMG + AMH
📌 FORMAT: madde → ilgili rota → ilgili fonksiyon → dosyadaki görev zinciri

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🚀 AMG — 30 MADDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) 🌐 CORS başlıklarını hazırlar
→ Rota: tüm API rotaları + OPTIONS
→ Fonksiyon: corsBasliklariniHazirla
→ Görev zinciri: request gelir → origin okunur → CORS başlıkları üretilir → response’a eklenir

2) 🧾 JSON response standardı kurar
→ Rota: tüm JSON dönen rotalar
→ Fonksiyon: jsonBasliklariniHazirla
→ Görev zinciri: response tipi belirlenir → JSON başlıkları hazırlanır → yanıt tek formatta döner

3) ✋ OPTIONS preflight isteklerini cevaplar
→ Rota: router.options('/*yol')
→ Fonksiyon: secenekIsteginiYanitla
→ Görev zinciri: OPTIONS isteği gelir → CORS/Allow başlıkları eklenir → boş başarılı yanıt döner

4) 📥 Request body içindeki JSON’u çözer
→ Rota: /api/sohbet, /api/sohbet/akis, /api/gorsel, /api/ayarlar/kaydet, /api/ortak-durum/yaz, /api/onbellek/sil
→ Fonksiyon: govdeyiCozumle
→ Görev zinciri: body okunur → JSON parse edilir → hata varsa güvenli hata üretilir → veri sonraki adıma geçer

5) ✂️ Metinleri güvenli boyuta kırpar
→ Rota: doğrulama yapılan tüm gövdeler
→ Fonksiyon: metniKirp
→ Görev zinciri: metin alınır → maksimum sınıra göre kesilir → temizlenmiş veri kullanılır

6) 🔢 Sayısal alanları normalize eder
→ Rota: özellikle /api/gorsel ve sohbet ayarları
→ Fonksiyon: sayiDonustur
→ Görev zinciri: sayı alınır → min/max aralığına zorlanır → geçerli numeric değer döner

7) 🕒 Zaman damgası ve dakika penceresi üretir
→ Rota: rate limit ve kayıt mantığı kullanan rotalar
→ Fonksiyon: dakikayiDamgala, saniyeDamgasiAl
→ Görev zinciri: anlık zaman alınır → dakika/saniye penceresi üretilir → limit/kayıt anahtarında kullanılır

8) 🗝️ KV ve cache için standart anahtar üretir
→ Rota: cache/KV kullanan rotalar
→ Fonksiyon: anahtariOlustur
→ Görev zinciri: prefix alınır → parçalar birleştirilir → standart saklama anahtarı oluşur

9) ⚙️ Uygulama ayarlarını KV’den getirir
→ Rota: /api/durum, /api/ayarlar/getir, /api/ayarlar/kaydet
→ Fonksiyon: ayarlariGetir
→ Görev zinciri: KV anahtarı okunur → varsayılanlarla birleştirilir → aktif ayar nesnesi döner

10) 💾 Uygulama ayarlarını KV’ye kaydeder
→ Rota: /api/ayarlar/kaydet
→ Fonksiyon: ayarlariKaydet
→ Görev zinciri: gelen ayar doğrulanır → KV’ye yazılır → kayıt sonucu döner

11) 🪟 Ayarları dışarı güvenli biçimde hazırlar
→ Rota: /api/ayarlar/getir, /api/ayarlar/kaydet
→ Fonksiyon: ayarlariDisariHazirla
→ Görev zinciri: tam ayar nesnesi alınır → hassas/gereksiz kısımlar ayıklanır → istemciye sade görünüm verilir

12) 🧠 İstemci kimliğini çıkarır
→ Rota: /api/sohbet, /api/sohbet/akis, /api/gorsel
→ Fonksiyon: istemciKimliginiCikar
→ Görev zinciri: header/origin/user kontrol edilir → istemci için ayırt edici anahtar üretilir → limit/cache için kullanılır

13) 🚦 Dakika bazlı rate limit uygular
→ Rota: /api/sohbet, /api/sohbet/akis, /api/gorsel
→ Fonksiyon: istekSiniriniKontrolEt
→ Görev zinciri: istemci kimliği alınır → dakika anahtarı oluşturulur → sayaç okunur/yazılır → limit aşılırsa engellenir

14) 📚 Dizi/nesne/boş veri kontrolleri yapar
→ Rota: tüm doğrulama akışları
→ Fonksiyon: diziMi, nesneMi, bosMu
→ Görev zinciri: veri tipi ölçülür → beklenen yapı mı kontrol edilir → doğrulama kararı verilir

15) 🏷️ Sohbet mesaj rollerini doğrular
→ Rota: /api/sohbet, /api/sohbet/akis
→ Fonksiyon: rolGecerliMi
→ Görev zinciri: her mesaj rolü okunur → izinli rollerle karşılaştırılır → geçersizse hata oluşturulur

16) 📝 Mesaj içeriğinden düz yazıyı toplar
→ Rota: /api/sohbet, /api/sohbet/akis
→ Fonksiyon: yaziIceriginiTopla
→ Görev zinciri: içerik parçaları alınır → text alanları birleştirilir → LLM’e uygun düz metin hazırlanır

17) ✅ Tek tek mesaj içeriğini doğrular
→ Rota: /api/sohbet, /api/sohbet/akis
→ Fonksiyon: mesajIceriginiDogrula
→ Görev zinciri: mesaj alanları okunur → yapı/uzunluk/içerik tipi kontrol edilir → normalize edilmiş mesaj döner

18) 💬 Sohbet request body’sini topluca doğrular
→ Rota: /api/sohbet, /api/sohbet/akis
→ Fonksiyon: sohbetGovdesiniDogrula
→ Görev zinciri: body çözülür → mesajlar ve model kontrol edilir → limitler uygulanır → temiz gövde oluşur

19) 🖼️ Görsel üretim body’sini doğrular
→ Rota: /api/gorsel
→ Fonksiyon: gorselGovdesiniDogrula
→ Görev zinciri: prompt/size/quality/adet okunur → geçerlilik kontrol edilir → normalize üretim isteği oluşur

20) ⚙️ Ayar kaydetme gövdesini doğrular
→ Rota: /api/ayarlar/kaydet
→ Fonksiyon: ayarGirdisiniDogrula
→ Görev zinciri: body alınır → izinli ayar alanları süzülür → kayıt için temiz ayar nesnesi üretilir

21) 🧩 Ortak durum yazma gövdesini doğrular
→ Rota: /api/ortak-durum/yaz
→ Fonksiyon: ortakDurumGovdesiniDogrula
→ Görev zinciri: key/value okunur → tip ve zorunlu alan kontrolü yapılır → yazılabilir veri seti oluşur

22) 🧹 Cache silme gövdesini doğrular
→ Rota: /api/onbellek/sil
→ Fonksiyon: onbellekSilGovdesiniDogrula
→ Görev zinciri: silinecek anahtarlar okunur → format kontrol edilir → silme listesi hazırlanır

23) 🔐 Yönetici anahtarının varlığını kontrol eder
→ Rota: /api/durum, /api/ayarlar/kaydet
→ Fonksiyon: yoneticiAnahtariVarMi
→ Görev zinciri: KV/env kontrol edilir → admin kurulu mu bakılır → rota davranışı buna göre şekillenir

24) 🛡️ Yönetici yetkisini doğrular
→ Rota: /api/ayarlar/kaydet, /api/ortak-durum/yaz, /api/onbellek/sil
→ Fonksiyon: yoneticiYetkisiniDogrula
→ Görev zinciri: istekten admin anahtarı alınır → saklanan anahtarla karşılaştırılır → yetkiliyse işlem devam eder

25) 📦 Ortak durum verisini KV’de okur/yazar
→ Rota: /api/ortak-durum/oku, /api/ortak-durum/yaz
→ Fonksiyon: ortakDurumuOku, ortakDurumuYaz
→ Görev zinciri: key belirlenir → KV oku/yaz çalışır → sonuç JSON olarak döner

26) 🤖 Sohbet için AI seçeneklerini hazırlar
→ Rota: /api/sohbet, /api/sohbet/akis
→ Fonksiyon: sohbetSecenekleriniHazirla
→ Görev zinciri: ayarlar + istek gövdesi alınır → model/seçenekler birleştirilir → Puter chat çağrısına uygun config oluşur

27) 🗨️ AI chat yanıtını düz metne dönüştürür
→ Rota: /api/sohbet
→ Fonksiyon: sohbetYanitiniMetneDonustur
→ Görev zinciri: sağlayıcıdan cevap gelir → içerik katmanları çözülür → kullanıcıya sade metin hazırlanır

28) 🖼️ Görsel çıktısını çözümler
→ Rota: /api/gorsel
→ Fonksiyon: gorselCiktisiniCozumle
→ Görev zinciri: txt2img sonucu alınır → url/base64/ham çıktı ayıklanır → dönecek payload hazırlanır

29) 🚨 Hataları güvenli özetler ve loglar
→ Rota: tüm rota akışları
→ Fonksiyon: guvenliHataMesajiAl, guvenliLogYaz
→ Görev zinciri: hata yakalanır → iç detaylar süzülür → güvenli mesaj loglanır ve istemciye döner

30) 🏁 AMG’nin ana işlerini yürütür: sohbet, akışlı sohbet, SSE, görsel, durum, modeller, testler
→ Rota: /api/sohbet, /api/sohbet/akis, /api/gorsel, /api/durum, /api/modeller, /api/ayarlar/getir, /api/ayarlar/kaydet, /api/ortak-durum/oku, /api/ortak-durum/yaz, /api/onbellek/sil, /, /tumu, /api, /api/test/calisiyor, /api/test/saglik, /api/test/me-puter, /api/amac
→ Fonksiyon: sseSatiriUret, akisDestegiVarMi, akisYanitiUret, sohbetiCalistir, tumOzetiOlustur
→ Görev zinciri: rota tetiklenir → body/ayar/yetki/limit doğrulanır → AI/KV/cache işlemi çalışır → standart sonuç döner
███████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████████
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🧠 AMH — 30 MADDE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1) 🌐 CORS ve JSON response omurgasını kurar
→ Rota: tüm API rotaları + OPTIONS
→ Fonksiyon: corsBasliklariniHazirla, jsonBasliklariniHazirla, yanitDondur, basariCevabiUret, hataCevabiUret, secenekIsteginiYanitla
→ Görev zinciri: istek gelir → başlıklar hazırlanır → standart JSON/hata yapısı üretilir → yanıt döner

2) 📥 Request body JSON’unu güvenli parse eder
→ Rota: /api/calistir ve body kullanan diğer rotalar
→ Fonksiyon: govdeyiCozumle
→ Görev zinciri: body okunur → parse edilir → bozuksa güvenli hata döner → sağlamsa akış sürer

3) 🧱 Temel veri tiplerini doğrular
→ Rota: doğrulama geçen tüm akışlar
→ Fonksiyon: nesneMi, diziMi
→ Görev zinciri: veri tipi ölçülür → uygun yapı mı bakılır → sonraki işleme izin verilir

4) ✂️ Metin/sayı/dizi normalizasyonu yapar
→ Rota: giriş işleyen tüm hizmet akışları
→ Fonksiyon: metniKirp, sayiDonustur, metniDiziyeCevir
→ Görev zinciri: ham girdi alınır → formatlanır → sınırlandırılır → hizmete uygun temiz veri üretilir

5) 🕒 Kopya/zaman/anahtar yardımcılarını sağlar
→ Rota: iş kaydı, KV, izleme kullanan tüm rotalar
→ Fonksiyon: kopyaOlustur, simdiIso, sayiDamgasiAl, anahtarBirlestir, dakikaPenceresiDamgasiAl, saniyeDamgasiAl
→ Görev zinciri: veri kopyalanır → zaman damgası eklenir → kayıt anahtarı oluşturulur

6) 👤 Çalışan me.puter bağlamını resolve eder
→ Rota: AI/metot çağrısı yapan tüm rotalar
→ Fonksiyon: calisanMePuteriniAl
→ Görev zinciri: runtime bağlamı alınır → me.puter erişimi çözülür → alt servislerde kullanılır

7) 📜 Güvenli log üretir
→ Rota: tüm sistem
→ Fonksiyon: guvenliLogYaz
→ Görev zinciri: olay/hata oluşur → log sadeleştirilir → kontrollü biçimde yazılır

8) 🗝️ KV/depo anahtarları üretir
→ Rota: iş kaydı, geçmiş, arşiv, durum
→ Fonksiyon: depoAnahtariUret
→ Görev zinciri: işKimligi/hizmetTuru/prefix alınır → standart KV anahtarı oluşur

9) 💾 KV/depo üzerinde oku-yaz-sil yapar
→ Rota: /api/is/:isKimligi, /api/is/:isKimligi/gecmis, /api/is/:isKimligi/arsiv ve iç akışlar
→ Fonksiyon: depodanOku, depoyaYaz, depodanSil
→ Görev zinciri: anahtar belirlenir → KV işlemi yapılır → sonuç iş akışına döner

10) 🛠️ me.puter içindeki derin metodlara erişir ve çağırır
→ Rota: AI hizmeti tetikleyen tüm akışlar
→ Fonksiyon: mePuterMetodunuAl, mePuterMetodunuCalistir
→ Görev zinciri: metod yolu çözülür → gerçek fonksiyon bulunur → çağrı güvenli biçimde yapılır

11) 💵 Hizmet bazlı tahmini maliyet hesaplar
→ Rota: /api/calistir ve orkestrasyon akışları
→ Fonksiyon: tahminiMaliyetHesapla
→ Görev zinciri: hizmet türü + parametreler okunur → kaba maliyet çıkarılır → bütçe kararında kullanılır

12) 🧮 Skorlama ve benzersiz imza üretir
→ Rota: sağlayıcı seçimi ve sonuç kalite akışları
→ Fonksiyon: agirlikliSkorHesapla, benzersizImzaUret
→ Görev zinciri: metrikler toplanır → skorlanır → iş/çıktı için benzersiz iz üretilir

13) 📦 Standart cevap gövdesi oluşturur
→ Rota: tüm sonuç dönen rotalar
→ Fonksiyon: standartCevapGovdesiOlustur
→ Görev zinciri: sonuç/meta/hata toplanır → tek response şablonuna yerleştirilir → kullanıcıya döner

14) 🆔 Olay kimliği ve korelasyon üretir
→ Rota: /api/calistir ve iş kayıt akışları
→ Fonksiyon: olayKimligiUret
→ Görev zinciri: çağrı başlar → benzersiz olay kimliği oluşturulur → loglar ve işler bu kimlikle bağlanır

15) 🧭 İstek bağlamını hazırlar
→ Rota: /api/calistir
→ Fonksiyon: istekBaglaminiHazirla
→ Görev zinciri: kullanıcı girdisi alınır → işKimliği/zaman/meta üretilir → tüm orkestrasyon buna bağlanır

16) 🔍 Hangi hizmetin istendiğini çözer
→ Rota: /api/calistir
→ Fonksiyon: hizmetTurunuCozumle
→ Görev zinciri: input incelenir → chat/img/video/tts/ocr/pdf/deepsearch ayrımı yapılır → doğru akış seçilir

17) ✅ Girdiyi hizmet türüne göre doğrular
→ Rota: /api/calistir
→ Fonksiyon: guvenliGirdiDogrula
→ Görev zinciri: hizmet türü belirlenir → ilgili alanlar kontrol edilir → temiz ve güvenli input oluşur

18) ⚙️ Etkin ayarı oluşturur
→ Rota: /api/calistir
→ Fonksiyon: etkinAyariOlustur
→ Görev zinciri: varsayılan ayarlar alınır → kullanıcı tercihleri eklenir → güvenlik/kota kısıtları uygulanır

19) 🚨 Hata tipini sınıflandırır
→ Rota: tüm hata yakalanan akışlar
→ Fonksiyon: hataSinifiniBelirle
→ Görev zinciri: hata nesnesi incelenir → timeout/kota/yetki/ağ/doğrulama gibi sınıfa ayrılır → sonraki karar buna göre verilir

20) 🛡️ Güvenli hata özeti üretir
→ Rota: tüm API rotaları
→ Fonksiyon: guvenliHataOzetiUret
→ Görev zinciri: ham hata alınır → kullanıcı/panel/geliştirici seviyesine göre süzülür → uygun hata metni hazırlanır

21) 🔁 Yeniden deneme kararı verir
→ Rota: orkestrasyon ve fallback akışları
→ Fonksiyon: yenidenDenemeKarariniVer
→ Görev zinciri: hata tipi okunur → retry yapılmalı mı karar verilir → fallback veya durdurma seçilir

22) 🧾 İşlem metaverisini hazırlar
→ Rota: /api/calistir ve iş kayıtları
→ Fonksiyon: islemMetaverisiniHazirla
→ Görev zinciri: hizmet/sağlayıcı/model/zaman bilgileri toplanır → iş kaydına eklenir

23) 🔐 Hizmet yetkinliğini kontrol eder
→ Rota: /api/calistir, /api/saglayici/:hizmetTuru/:saglayici
→ Fonksiyon: hizmetYetkinliginiKontrolEt
→ Görev zinciri: istenen hizmet belirlenir → ilgili me.puter kabiliyeti var mı bakılır → uygunsa akış sürer

24) 📊 Sonuç kalitesini puanlar
→ Rota: sonuç üretim akışları ve raporlar
→ Fonksiyon: sonucKalitesiniPuanla
→ Görev zinciri: çıktı alınır → kalite kriterleriyle puanlanır → panel/rapor seçimlerinde kullanılır

25) 🚧 Hizmete özel filtre ve kısıtlar uygular
→ Rota: /api/calistir
→ Fonksiyon: hizmeteOzelFiltreleriUygula
→ Görev zinciri: hizmet türüne özel sınırlar okunur → riskli/pahalı ayarlar daraltılır → güvenli iş paketi oluşur

26) 📤 Sağlayıcıya gidecek istek gövdesini hazırlar
→ Rota: /api/calistir
→ Fonksiyon: saglayiciIstekGovdesiHazirla
→ Görev zinciri: normalize input alınır → sağlayıcının beklediği format üretilir → çağrı hazır hale gelir

27) 📥 Sağlayıcıdan gelen ham yanıtı çözer
→ Rota: /api/calistir
→ Fonksiyon: saglayiciYanitiCozumle
→ Görev zinciri: sağlayıcı cevabı alınır → ortak response modeline dönüştürülür → sistemin geri kalanına uyumlu hale gelir

28) 🤖 Asıl AI hizmetlerini çalıştırır
→ Rota: /api/calistir
→ Fonksiyon: sohbetApiCagrisiniYurut, gorselApiCagrisiniYurut, videoApiCagrisiniYurut, seslendirmeApiCagrisiniYurut, ocrApiCagrisiniYurut, pdfApiCagrisiniYurut, derinAramaApiCagrisiniYurut
→ Görev zinciri: hizmet türü seçilir → ilgili API çağrısı çalışır → çıktı toplanır → normalize edilir

29) 🎛️ Orkestrasyon, sağlayıcı seçimi, timeout, fallback, maliyet ve çok adımlı akışı yönetir
→ Rota: /api/calistir
→ Fonksiyon: uygunIsciyiSec, saglayiciOnceliginiBelirle, fallbackZinciriniKur, maliyetButcesiniYonet, zamanAsimiPolitikasiniUygula, cokAdimliAkisiYonet, sonucBirlestiriciyiCalistir, iptalVeDuraklatmaKarariniVer, orkestrayiBaslat, tumSistemiKoordineEt
→ Görev zinciri: iş tipi anlaşılır → en uygun işçi/sağlayıcı seçilir → bütçe ve timeout uygulanır → hata olursa fallback dener → sonuç birleştirilir

30) 📡 İş kaydı, geçmiş, arşiv, izleme, sağlık, teşhis ve panel endpointlerini yürütür
→ Rota: /, /tumu, /api/durum, /api/panel, /api/is/:isKimligi, /api/is/:isKimligi/gecmis, /api/is/:isKimligi/arsiv, /api/is/:isKimligi/izle, /api/calistir, /api/teshis, /api/teshis/:hizmetTuru, /api/saglayici/:hizmetTuru/:saglayici, /api/ispat/ozet
→ Fonksiyon: isKaydiBaslat, isDurumunuGuncelle, isGecmisineKaydet, isDurumuOzetiUret, kuyruktaBekleyenIsiIzle, gecmisVeSonucArsiviniHazirla, sistemSaglikTaramasiYap, hizmetBazliTeshisYap, saglayiciErisimTestiYap, kvVeDurumDeposuTestiYap, fallbackMekanizmasiniSinamaYap, gecikmeVeSureAnaliziYap, maliyetSapmasiniAnalizEt, tanisalRaporUret, panelIcinKisaDurumHazirla, aiaiSinifGorevOzetiniOlustur, kokEndpointAiaiTumuCevabiniUret, kokEndpointiTumuGibiCalistir, ispatOzetiHazirla
→ Görev zinciri: iş başlatılır → kayıt açılır → durum/geçmiş/arşiv güncellenir → teşhis/sağlık/panel verileri üretilir → üst rotalara servis edilir
```



aaa
