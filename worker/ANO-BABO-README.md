ANO-BABO-README.md
1. AMAÇ
Bu belge, ANO ve BABO worker’larının aynı hizmet evrenini paylaştığı ama aynı rolü oynamadığı birleşik ana sözleşmedir.
Bu belgenin amacı:
görev ve sorumlulukları çakışmasız ayırmak,
çağrı sırasını netleştirmek,
Puter hizmet eşlemelerini tek sözlükte toplamak,
frontend ve diğer worker’ların hangi durumda ANO’ya, hangi durumda BABO’ya gideceğini kesinleştirmektir.
Bu belgeye göre:
ANO = doğrudan servis uygulayıcı katman
BABO = orkestrasyon, karar ve takip katmanı
İkisi de aynı hizmet evrenini bilir.
Bu, ikisinin aynı işi yapacağı anlamına gelmez.
---
2. TEK CÜMLELİK ROLLER
2.1 ANO
ANO = Puter hizmetlerini doğrudan çalıştıran, sade, hızlı ve JSON-only servis worker’ı
2.2 BABO
BABO = aynı hizmet evreni için karar veren, planlayan, izleyen, meta üreten ve iş akışını yöneten orkestrasyon worker’ı
---
3. TEMEL PRENSİP
3.1 Aynı hizmet evreni
ANO ve BABO aşağıdaki ortak hizmet sözlüğünü bilir:
`CHAT`
`MODEL_CATALOG`
`TXT2IMG`
`IMG2IMG`
`TXT2VID`
`IMG2VIDEO`
`TTS`
`STT`
`VOICE`
`OCR`
`PDF`
`WEB_SEARCH`
`DEEPSEARCH`
3.2 Farklı görev modeli
Bu ortak sözlük şu anlama gelir:
ikisi de hangi hizmetin ne olduğunu bilir,
ikisi de aynı girdi tiplerini tanıyabilir,
ikisi de aynı Puter karşılıklarını içte kullanabilir,
ama dış dünyaya aynı biçimde açılmazlar.
3.3 Sert ayrım
ANO, hizmeti doğrudan çalıştırır.
BABO, hizmetin nasıl çalıştırılacağını yönetir.
ANO, hızlı yoldur.
BABO, akıllı yoldur.
---
4. DOĞRU ÇAĞRI HİYERARŞİSİ
4.1 Varsayılan sıra
Basit ve hızlı bir istek varsa önce ANO çağrılır.
Daha kontrollü çalışma gerekiyorsa BABO çağrılır.
BABO, ANO’nun yaptığı doğrudan route işini tekrar etmez.
Frontend rastgele worker seçmez; ihtiyaca göre seçer.
4.2 ANO ne zaman çağrılır?
ANO şu durumlarda birinci tercihtir:
hızlı sonuç isteniyorsa,
doğrudan hizmet çağrısı yeterliyse,
katalog gerekiyorsa,
basit input doğrulama yeterliyse,
iş kimliği, geçmiş, retry, fallback, maliyet takibi gerekmiyorsa.
4.3 BABO ne zaman çağrılır?
BABO şu durumlarda devreye girer:
timeout politikası gerekiyorsa,
retry kararı verilecekse,
fallback zinciri çalışacaksa,
iş kimliği açılacaksa,
geçmiş veya arşiv tutulacaksa,
panel ve izleme verisi gerekiyorsa,
meta ve teşhis görünürlüğü isteniyorsa,
aynı hizmet daha kontrollü ve açıklanabilir biçimde yürütülecekse.
4.4 Yasak çağrı davranışı
BABO, varsayılan kısa yol gibi kullanılmaz.
ANO’nun üstüne binen ikinci bir “doğrudan servis kapısı” kurulmaz.
ANO ve BABO aynı hizmet için aynı route mantığını paylaşmaz.
---
5. GÖREV AYRIMI — ANA TABLO
5.1 ANO’nun sahibi olduğu işler
Model kataloğu
Hizmet listesi
Doğrudan hizmet yürütme
Hizmete özel hafif doğrulama
Puter helper / service eşleme
Hızlı JSON cevap
Temel sağlık ve runtime görünürlüğü
5.2 BABO’nun sahibi olduğu işler
Hizmet türü çözümleme
Etkin ayar üretimi
Timeout politikası
Retry kararı
Fallback zinciri
İş kimliği açma
Geçmiş yazma
Arşiv üretme
Panel üretme
İzleme/polling dostu iş özeti
Meta üretme
Teşhis üretme
Maliyet ve güvenlik kararı
5.3 Kesişmesi yasak olan alanlar
Aşağıdaki işler iki worker’da birden bulunmaz:
ana katalog sahipliği
ana doğrudan servis sahipliği
iş kimliği sahipliği
geçmiş/arşiv sahipliği
retry/fallback kararı
meta sözleşmesi
---
6. RESPONSE SÖZLEŞMESİ — KESİN AYRIM
6.1 ANO response omurgası
ANO her zaman sade cevap verir:
Başarı
```json
{
  "ok": true,
  "veri": {},
  "hata": null
}
```
Hata
```json
{
  "ok": false,
  "veri": null,
  "hata": "..."
}
```
6.2 ANO kuralları
`meta` alanı YOKTUR.
Hata alanı string’dir.
JSON-only davranış korunur.
Sonuç hızlı ve sade kalır.
6.3 BABO response omurgası
BABO her zaman meta’lı cevap verir:
Başarı
```json
{
  "ok": true,
  "veri": {},
  "hata": null,
  "meta": {
    "worker": "BABO",
    "dosya": "babo.js",
    "surum": "1.0.0",
    "zamanDamgasi": "ISO_DATE",
    "isKimligi": null,
    "sureMs": 0,
    "maliyet": 0,
    "teshis": null
  }
}
```
Hata
```json
{
  "ok": false,
  "veri": null,
  "hata": {
    "mesaj": "...",
    "kod": "...",
    "ayrintilar": []
  },
  "meta": {
    "worker": "BABO",
    "dosya": "babo.js",
    "surum": "1.0.0",
    "zamanDamgasi": "ISO_DATE",
    "isKimligi": null,
    "sureMs": 0,
    "maliyet": 0,
    "teshis": null
  }
}
```
6.4 BABO kuralları
`meta` alanı ZORUNLUDUR.
`meta.worker = BABO`
Hata alanı nesnedir.
İş görünürlüğü ve süreç görünürlüğü vardır.
---
7. İSTEK ÇÖZÜMLEME — KESİN AYRIM
7.1 ANO
ANO yalnız JSON gövdeyi esas alır.
Kural
`application/json` dışı tiplerde gövde boş veya geçersiz sayılabilir.
JSON parse bozuksa açık hata döner.
Ağır multipart/form hazırlama ANO’nun işi değildir.
Sebep
ANO sade kalmalıdır.
7.2 BABO
BABO daha esnek gövde kabul eder.
Desteklenebilen tipler
`application/json`
`application/x-www-form-urlencoded`
`multipart/form-data`
Sebep
BABO ağır girdileri ve daha karmaşık iş akışlarını yönetir.
7.3 Sonuç
Basit frontend çağrısı için ANO
Ağır dosya/çok biçimli girdi ve akış için BABO
---
8. ROUTE SAHİPLİĞİ — KESİN AYRIM
8.1 ANO ortak route’ları
`GET /api/durum`
`GET /api/test/saglik`
`GET /api/modeller`
`GET /api/hizmetler`
8.2 ANO hizmet route’ları
`POST /api/chat`
`POST /api/gorsel`
`POST /api/gorsel/duzenle`
`POST /api/video`
`POST /api/video/gorselden`
`POST /api/tts`
`POST /api/voice`
`POST /api/stt`
`POST /api/ocr`
`POST /api/pdf`
`POST /api/deepsearch`
`POST /api/web-search`
8.3 BABO ortak route’ları
`GET /api/durum`
`GET /api/panel`
`POST /api/teshis` (opsiyonel ama önerilir)
8.4 BABO ana route’u
`POST /api/calistir`
8.5 BABO iş takip route’ları
`GET /api/is/:isKimligi`
`GET /api/is/:isKimligi/gecmis`
`GET /api/is/:isKimligi/arsiv`
`GET /api/is/:isKimligi/izle`
8.6 Sert yasaklar
BABO, ANO’nun hizmet route’larını kopyalamaz.
ANO, BABO’nun iş takip route’larını açmaz.
Katalog route’unun sahibi yalnız ANO’dur.
İş kimliği ve arşiv route’larının sahibi yalnız BABO’dur.
---
9. ORTAK HİZMET EVRENİ — PUTER-NATIVE SÖZLÜK
Her iki worker da dış sözleşmede aynı hizmet adlarını kullanır:
`CHAT`
`MODEL_CATALOG`
`TXT2IMG`
`IMG2IMG`
`TXT2VID`
`IMG2VIDEO`
`TTS`
`STT`
`VOICE`
`OCR`
`PDF`
`WEB_SEARCH`
`DEEPSEARCH`
Kural
İç kod başka isim kullansa bile dış sözleşme bu isimlerle konuşur.
Eski veya uydurma hizmet adı bırakılmaz.
ANO ve BABO aynı sözlüğü paylaşır.
---
10. PUTER KARŞILIKLARI — ORTAK HİZMET EŞLEME
10.1 CHAT
Puter karşılığı: `puter.ai.chat()`
ANO rolü: doğrudan chat çağrısı
BABO rolü: model/tool/web/timeout/retry kararını yönetmek
10.2 MODEL_CATALOG
Puter karşılığı: `puter.ai.listModels()`
ANO rolü: katalogu dışarı açmak
BABO rolü: gerekirse iç karar katmanında kullanmak, ama ana katalog route’u açmamak
10.3 TXT2IMG
Puter karşılığı: `puter.ai.txt2img()`
ANO rolü: prompttan doğrudan görsel üretmek
BABO rolü: kalite/sağlayıcı/timeout/fallback planlamak
10.4 IMG2IMG
Puter karşılığı: altyapı destekliyorsa görsel girdili image generation
ANO rolü: basit düzenleme/varyasyon endpoint’i sunmak
BABO rolü: referans görsel, güvenlik, retry ve fallback yönetmek
10.5 TXT2VID
Puter karşılığı: `puter.ai.txt2vid()`
ANO rolü: metinden doğrudan video üretmek
BABO rolü: ağır iş, timeout ve yedek plan kararı vermek
10.6 IMG2VIDEO
Puter karşılığı: altyapı destekliyorsa görselden video üretimi
ANO rolü: basit servis yüzü sunmak
BABO rolü: kaynak, süre, retry, fallback ve risk yönetmek
10.7 TTS
Puter karşılığı: `puter.ai.txt2speech()`
ANO rolü: metni doğrudan sese çevirmek
BABO rolü: kalite, format, süre ve maliyet yönetmek
10.8 STT
Puter karşılığı: `puter.ai.speech2txt()`
ANO rolü: sesi doğrudan metne çevirmek
BABO rolü: uzun ses, format, maliyet ve timeout yönetmek
10.9 VOICE
Puter karşılığı: `puter.ai.speech2speech()`
ANO rolü: doğrudan ses dönüştürme
BABO rolü: güvenlik, kalite ve akış yönetimi
10.10 OCR
Puter karşılığı: `puter.ai.img2txt()`
ANO rolü: sade OCR endpoint’i sunmak
BABO rolü: dosya/sayfa/çok adımlı OCR stratejisi yürütmek
10.11 PDF
Puter karşılığı: OCR + chat tabanlı belge akışı
ANO rolü: temel belge okuma/yorumlama endpoint’i sunmak
BABO rolü: çok adımlı belge akışı, sayfa ve strateji yönetmek
10.12 WEB_SEARCH
Puter karşılığı: `puter.ai.chat()` + web arama tool yapısı
ANO rolü: sade web destekli yanıt döndürmek
BABO rolü: arama derinliği, kaynak önceliği ve sentez yönetmek
10.13 DEEPSEARCH
Puter karşılığı: çok adımlı araştırma akışı
ANO rolü: doğrudan araştırma çağrısı sunmak
BABO rolü: alt sorgu, sentez, timeout, izleme ve maliyet yönetmek
---
11. MODEL KATALOĞU — SAHİPLİK KURALI
11.1 Sahiplik
Ana katalog sahibi ANO’dur.
BABO katalogu tanır ama sahibi değildir.
11.2 Sonuç
Frontend’in “modelleri yükle” çağrısı ANO’dan yapılır.
BABO katalogu birincil kullanıcı endpoint’i olarak açmaz.
11.3 Katalog filtresi yaklaşımı
Sistem sade kalmalıdır.
Bu yüzden:
tüm filtrelerin aynı anda çalışması zorunlu değildir,
ilk sınıf filtreler: `provider`, `q`, `input`, `output`, `limit`
ikinci sınıf filtreler: `tool_call`, `open_weights`
11.4 Katalog veri alanları
Model objesi şu alanları korur:
`puterId`
`id`
`name`
`provider`
`aliases`
`modalities.input`
`modalities.output`
`costs_currency`
`input_cost_key`
`output_cost_key`
`costs`
`context`
`max_tokens`
`tool_call`
`open_weights`
`knowledge`
`release_date`
---
12. HİZMET YÜRÜTME — SAHİPLİK KURALI
12.1 ANO
ANO her hizmet için sade route sahibidir.
Örnek:
`TXT2IMG` → `/api/gorsel`
`CHAT` → `/api/chat`
`TTS` → `/api/tts`
`OCR` → `/api/ocr`
12.2 BABO
BABO her hizmet için tek ortak yürütme kapısı sahibidir:
`POST /api/calistir`
12.3 Sonuç
ANO = çok hizmetli doğrudan servis worker’ı
BABO = tek girişli orkestrasyon worker’ı
---
13. İŞ KİMLİĞİ, GEÇMİŞ VE ARŞİV — SAHİPLİK KURALI
13.1 Sahiplik
Aşağıdaki yapıların sahibi yalnız BABO’dur:
`isKimligi`
`olayKimligi`
`korelasyonAnahtari`
iş özeti
geçmiş
arşiv
panel
izleme
13.2 ANO sınırı
ANO:
iş kimliği açmaz,
geçmiş tutmaz,
arşiv üretmez,
panel verisi üretmez,
polling dostu iş izleme route’u taşımaz.
13.3 Sonuç
Süreç görünürlüğü gereken her işte BABO devreye girer.
---
14. RETRY, FALLBACK, TIMEOUT, MALİYET — SAHİPLİK KURALI
14.1 Sahiplik
Aşağıdaki kararların sahibi yalnız BABO’dur:
retry
fallback
timeout politikası
maliyet sınırı
güvenlik modu
sağlayıcı önceliği
etkin ayar üretimi
14.2 ANO sınırı
ANO:
retry kararı vermez,
fallback zinciri kurmaz,
timeout orkestrasyonu yapmaz,
maliyet kararı vermez,
güvenlik politikası yöneten ana katman olmaz.
14.3 Sonuç
ANO hizmeti çalıştırır.
BABO hizmetin nasıl, hangi sınırlarla ve hangi planla çalışacağını belirler.
---
15. META VE TEŞHİS — SAHİPLİK KURALI
15.1 ANO
sade cevap verir
sonuç odaklıdır
meta taşımaz
teşhis worker’ı değildir
15.2 BABO
meta taşır
teşhis üretir
karar görünürlüğü sağlar
neden bu yolun seçildiğini açıklayabilir
15.3 Sonuç
Sonuç gerekiyorsa ANO yeterli olabilir.
Sonuç + süreç açıklaması gerekiyorsa BABO gerekir.
---
16. FRONTEND İÇİN UYGULAMA KURALI
16.1 Basit UI
modelleri ANO’dan yükle
hizmet listesini ANO’dan öğren
doğrudan işlem için ANO hizmet route’unu çağır
16.2 Gelişmiş UI
daha akıllı yürütme istenirse BABO `/api/calistir` çağır
iş kimliğini sakla
job, geçmiş, arşiv ve izle route’larını BABO’dan oku
16.3 Yanlış kullanım örnekleri
modelleri BABO’dan yüklemek
basit chat için önce BABO’ya gitmek
ANO’da job izleme aramak
BABO’da `/api/gorsel` benzeri doğrudan route beklemek
---
17. KALDIRILMASI GEREKEN ROL ÇAKIŞMALARI
Aşağıdakiler sistemde bırakılmaz:
ANO içinde job takip mantığı
ANO içinde panel/arşiv/geçmiş mantığı
ANO içinde retry/fallback planlama
BABO içinde ana katalog route’u
BABO içinde ANO kopyası doğrudan hizmet route’ları
Aynı hizmet için iki worker’da aynı dış route davranışı
Hizmet adı sözlüğünde uydurma veya eski adlar
---
18. BASİTLİK KURALI
Sadeleştirme, özellik kesmek değildir.
Sadeleştirme şu anlama gelir:
hizmet kapsamı geniş kalır,
gereksiz fonksiyonlar temizlenir,
görev sınırları keskinleşir,
route yapısı sadeleşir,
sahiplik tekleşir,
çağrı sırası netleşir.
Sonuç
ANO küçülmez; doğru yerde sadeleşir.
BABO büyümez; doğru yerde derinleşir.
---
19. NİHAİ KARAR METNİ
Bu sistemin ana hükmü şudur:
ANO ve BABO aynı Puter hizmet evrenini bilen iki ortak sözleşme worker’ıdır. ANO, bu hizmetlerin doğrudan ve sade çalışan servis katmanıdır. BABO ise aynı hizmetler için orkestrasyon, karar, timeout, retry, fallback, maliyet, meta, iş kimliği ve takip katmanıdır. İkisi aynı işi yapmaz. İkisi birbirini ezmez. Doğru sıra şudur: hızlı ve doğrudan iş için önce ANO; akıllı, izlenebilir ve açıklanabilir iş akışı için BABO.
