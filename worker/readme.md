# README.md
# AMG + AMH — KAYNAK KODU GÖRMEDEN UYUMLU KODLAMA İÇİN TAM TEKNİK SÖZLEŞME

> AMAÇ:
> Bu belge, herhangi bir yapay zekânın (ör. Codex), **kaynak kodu doğrudan görmeden**
> AMG ve AMH worker’larının davranışını anlayıp **uyumlu yeniden uygulama**
> geliştirebilmesi için hazırlanmıştır.
>
> KISA CEVAP:
> - Bu README seviyesinde teknik sözleşme ile: **EVET, kaynak kod görülmeden bile %90 ile %95  doğrulukta kodlama yapılabilir.**
> - Birebir davranış uyumunu son aşamada doğrulamak için: **contract test (sözleşme testi)** uygulanmalıdır.

## BU README.md NEDEN OLUŞTURULDU?

1. Bu README.md, AMG ve AMH worker’larının kaynak kodu açılmadan da **%90 ile %95  doğrulukta yeniden kodlanabilmesi** için oluşturuldu.  
2. Bu belge, bir yapay zekânın veya geliştiricinin sistemin dış davranışını anlayıp uyumlu kod üretebilmesi için hazırlandı.  
3. Bu README.md, endpoint’lerin görevini, girişlerini, çıkışlarını ve kurallarını tek yerde toplamak için yazıldı.  
4. Bu belge, AMG ile AMH’nin rol farkını netleştirip yanlış mimari kurulmasını önlemek için oluşturuldu.  
5. Bu README.md, kaynak kod görünmese bile route, response, yetki, KV ve iş akışlarının doğru kurulabilmesi için hazırlandı.  
6. Bu belge, tahmine dayalı değil, açık teknik sözleşmeye dayalı kodlama yapılabilmesi için oluşturuldu.  
7. Bu README.md, başka bir AI aracının sistemi eksik anlamadan, kontrollü ve tutarlı biçimde geliştirme yapabilmesi için yazıldı.  
8. Bu belge, bakım, taşıma, yeniden yazım ve genişletme süreçlerinde resmi teknik referans olarak kullanılmak için hazırlandı.  
9. Bu README.md, canlı davranışı koruyarak iç kod farklı olsa bile dış uyumun korunmasını sağlamak için oluşturuldu.  
10. Bu belge, AMG ve AMH worker’larının kaynak kod görülmeden bile yüksek doğrulukla kodlanabileceğini net biçimde tanımlayan ana teknik sözleşmedir.

---

# 1) SİSTEM KİMLİĞİ

## 1.1 Worker’lar
- Worker adı: `amg`
- Canlı worker URL’si: `https://amg.puter.work`

- Worker adı: `amh`
- Canlı worker URL’si: `https://amh.puter.work`

## 1.2 Kamuya açık raw kaynaklar
AMG ve AMH worker’ları Puter hosting üstündedir.
Doğrudan Puter hosting üzerinden okunmaları garanti olmadığı için kamuya açık raw erişim URL’leri:

- `https://turk.puter.site/workers/all/amg.js`
- `https://turk.puter.site/workers/all/amh.js`

## 1.3 Çalışma varsayımı
Bu iki worker da Puter Worker ortamında çalışır.
Temel runtime bağımlılığı:
- `router`
- `me.puter`
- `me.puter.kv`
- `me.puter.ai.*`
- standard web runtime nesneleri (`Response`, `ReadableStream`, `TextEncoder`, `URL`)

---

# 2) EN KRİTİK AYRIM — AMG VE AMH AYNI ŞEY DEĞİLDİR

## 2.1 AMG nedir?
AMG, **uygulamaya yakın ortak servis worker’ıdır**.
Ana rolü:
- sohbet
- akışlı sohbet
- görsel üretim
- ayar okuma/kaydetme
- ortak durum okuma/yazma
- önbellek silme
- durum / test / amaç endpointleri

Yani AMG, “frontend’in konuştuğu pratik API worker” gibi düşünülmelidir.

## 2.2 AMH nedir?
AMH, **genel AI orkestrasyon worker’ıdır**.
Ana rolü:
- hizmet türünü çözmek
- girdiyi normalize etmek
- uygun sağlayıcı / işçi seçmek
- timeout uygulamak
- maliyet bütçesi korumak
- fallback zinciri kurmak
- iş kaydı / geçmiş / arşiv tutmak
- teşhis / sağlık / sağlayıcı erişim testleri üretmek

Yani AMH, “arka plandaki orkestra şefi + iş takip uzmanı + teşhis motoru” olarak düşünülmelidir.

## 2.3 Tek cümlede fark
- **AMG = doğrudan uygulama servis worker’ı**
- **AMH = çok hizmetli AI çağrı orkestratörü**

---

# 3) AI İÇİN UYGULAMA KURALI
Bir yapay zekâ bu belgeye göre kod yazacaksa şu kuralları bozmayacak:

1. Endpoint adlarını değiştirmeyecek.
2. JSON response şekillerini bozmayacak.
3. AMG ile AMH response şemalarını birbirine karıştırmayacak.
4. Rate limit davranışını AMG’de koruyacak.
5. İş kaydı / geçmiş / arşiv mantığını AMH’de koruyacak.
6. CORS başlıklarını eksiltmeyecek.
7. Yönetici koruması olan akışları açık bırakmayacak.
8. Puter runtime yoksa bunu sessizce yutmayacak; kontrollü hata veya degrade davranış üretecek.
9. Birebir aynı iç kodu yazmak zorunda değil; ama **aynı dış sözleşmeyi** üretmek zorunda.
10. “Benzer” değil, **uyumlu** davranış hedeflenecek.

---

# 4) RESPONSE ŞEMALARI — EN ÖNEMLİ BÖLÜM

## 4.1 AMG response sözleşmesi
AMG başarı cevabı:
- `ok: true`
- `veri: <payload>`
- `hata: null`

AMG hata cevabı:
- `ok: false`
- `veri: null | ekVeri`
- `hata: <string>`

### AMG örnek başarı
{
  "ok": true,
  "veri": {
    "durum": "hazir"
  },
  "hata": null
}

### AMG örnek hata
{
  "ok": false,
  "veri": null,
  "hata": "Geçersiz JSON gövdesi."
}

## 4.2 AMH response sözleşmesi
AMH standard cevabı:
- `ok: boolean`
- `veri: any | null`
- `hata: object | null`
- `meta: object`

### AMH meta alanları
AMH meta objesinde tipik alanlar:
- `dosya`
- `surum`
- `zamanDamgasi`
- `isKimligi`
- `sureMs`
- `maliyet`
- `teshis`

### AMH örnek başarı
{
  "ok": true,
  "veri": {
    "hizmetTuru": "CHAT"
  },
  "hata": null,
  "meta": {
    "dosya": "amh.js",
    "surum": "2026-03-18.1",
    "zamanDamgasi": "2026-03-18T12:00:00.000Z",
    "isKimligi": "is_xxx",
    "sureMs": 123,
    "maliyet": 0.0012,
    "teshis": null
  }
}

### AMH örnek hata
{
  "ok": false,
  "veri": null,
  "hata": {
    "mesaj": "Girdi doğrulaması başarısız.",
    "kod": "DOGRULAMA_HATASI",
    "ayrintilar": ["CHAT için mesajlar veya prompt zorunludur."]
  },
  "meta": {
    "dosya": "amh.js",
    "surum": "2026-03-18.1",
    "zamanDamgasi": "2026-03-18T12:00:00.000Z",
    "isKimligi": null,
    "sureMs": 0,
    "maliyet": 0,
    "teshis": null
  }
}

---

# 5) CORS VE ORTAK HTTP KURALLARI

## 5.1 AMG CORS
İzin verilen header’lar:
- `Content-Type`
- `Authorization`
- `X-Istemci-Kimligi`
- `X-Yonetici-Anahtari`

İzin verilen method’lar:
- `GET`
- `POST`
- `PUT`
- `DELETE`
- `OPTIONS`

## 5.2 AMH CORS
AMH, AMG’deki header’lara ek olarak şunu da tanır:
- `X-Korelasyon-Anahtari`

## 5.3 OPTIONS davranışı
Her iki worker da OPTIONS isteğine:
- `204`
- boş body
- CORS başlıkları
ile cevap vermelidir.

---

# 6) AMG — TAM TEKNİK SÖZLEŞME

---

## 6.1 AMG’nin ana sorumluluğu
AMG şu alanları yönetir:

1. sohbet isteği alma
2. akışlı sohbet üretme
3. görsel üretme
4. model listesi dökme
5. ayarları KV’den okuma
6. ayarları KV’ye yazma
7. ortak durum okuma
8. ortak durum yazma
9. önbellek kaydı silme
10. servis sağlık / amaç / test endpointleri sunma

---

## 6.2 AMG endpoint listesi

### Genel / kök
- `GET /`
- `GET /tumu`
- `GET /api`
- `GET /api/amac`

### Test / sağlık
- `GET /api/test/calisiyor`
- `GET /api/test/saglik`
- `GET /api/test/me-puter`

### Durum / modeller
- `GET /api/durum`
- `GET /api/modeller`

### Sohbet
- `POST /api/sohbet`
- `POST /api/sohbet/akis`

### Görsel
- `POST /api/gorsel`

### Ayarlar
- `GET /api/ayarlar/getir`
- `POST /api/ayarlar/kaydet`

### Ortak durum
- `GET /api/ortak-durum/oku`
- `POST /api/ortak-durum/yaz`

### Önbellek
- `POST /api/onbellek/sil`

---

## 6.3 AMG — endpoint ayrıntıları

### 6.3.1 `GET /api/durum`
Amaç:
- worker çalışıyor mu?
- yönetici kurulmuş mu?
- ortak durum var mı?

Başarı payload’ı:
{
  "servis": "amg",
  "durum": "hazir",
  "mePuterOdakli": true,
  "yoneticiKurulu": true,
  "ortakDurumVar": true,
  "zaman": "ISO_DATE"
}

---

### 6.3.2 `GET /api/modeller`
Amaç:
- Puter AI model listesini istemciye vermek

Query parametreleri:
- `saglayici`
- `ara`
- `sinir`

Beklenen davranış:
- `me.puter.ai.listModels(saglayici || null)` çağrılır
- sonuç normalize edilir
- filtrelenir
- üst sınır uygulanır

Başarı payload’ı:
{
  "toplam": 25,
  "modeller": [
    {
      "kimlik": "gpt-5-nano",
      "ad": "GPT-5 Nano",
      "saglayici": "openai",
      "baglam": null,
      "azamiToken": 128000,
      "maliyet": null,
      "takmaAdlar": []
    }
  ]
}

---

### 6.3.3 `POST /api/sohbet`
Amaç:
- senkron sohbet cevabı üretmek

İstek gövdesi:
{
  "model": "gpt-5-nano",
  "mesajlar": [
    { "role": "user", "content": "Merhaba" }
  ],
  "sicaklik": 0.7,
  "azamiToken": 1200,
  "dusunmeSeviyesi": "",
  "metinKisalikSeviyesi": "",
  "webArama": false,
  "istemciKimligi": "optional"
}

Alternatif giriş:
- `mesajlar` yoksa `prompt` kabul edilir
- bu durumda worker bunu tek user mesajına çevirir

Davranış:
1. body parse edilir
2. gövde doğrulanır
3. istemci kimliği çıkarılır
4. rate limit uygulanır
5. `me.puter.ai.chat(...)` çağrılır
6. cevap metne dönüştürülür
7. 1 saat TTL ile KV önbelleğe yazılır
8. standart başarı cevabı döner

Başarı payload’ı:
{
  "model": "gpt-5-nano",
  "metin": "LLM cevabı",
  "oranSayisi": 3,
  "onbellekAnahtari": "onbellek:sohbet:TIMESTAMP"
}

Rate limit:
- dakika başına `12`

KV önbellek kaydı:
- anahtar: `onbellek:sohbet:<timestamp>`
- içerik:
  - `model`
  - `istemciKimligi`
  - `soru`
  - `cevap`
  - `zaman`

TTL:
- `3600 saniye`

---

### 6.3.4 `POST /api/sohbet/akis`
Amaç:
- SSE ile akışlı sohbet üretmek

İstek gövdesi:
- `/api/sohbet` ile aynıdır

Davranış:
1. gövde parse edilir
2. sohbet gövdesi doğrulanır
3. istemci kimliği çıkarılır
4. rate limit uygulanır
5. ortam `ReadableStream` destekliyorsa SSE açılır
6. `me.puter.ai.chat(..., { stream: true })` çağrılır
7. parçalar `event:` satırlarıyla yayınlanır
8. bittiğinde özet KV’ye yazılır

Rate limit:
- dakika başına `8`

SSE event tipleri:
- `hazir`
- `parca`
- `arac`
- `bitti`
- `hata`

SSE veri şekli:
- her event için `data: <JSON>`

Örnek event akışı:
event: hazir
data: {"ok":true,"veri":{"durum":"hazir"},"hata":null}

event: parca
data: {"ok":true,"veri":{"metin":"Mer"},"hata":null}

event: parca
data: {"ok":true,"veri":{"metin":"haba"},"hata":null}

event: bitti
data: {"ok":true,"veri":{"metin":"Merhaba"},"hata":null}

KV önbellek:
- anahtar: `onbellek:akis:<timestamp>`
- TTL: 1 saat

---

### 6.3.5 `POST /api/gorsel`
Amaç:
- txt2img görsel üretmek

İstek gövdesi:
{
  "prompt": "kırmızı bir araba",
  "model": "optional-model",
  "kalite": "low",
  "genislik": 1024,
  "yukseklik": 1024,
  "adet": 1,
  "testModu": false,
  "istemciKimligi": "optional"
}

Davranış:
1. gövde parse edilir
2. prompt zorunlu kontrolü yapılır
3. rate limit uygulanır
4. `me.puter.ai.txt2img(...)` çağrılır
5. çıktı normalize edilir
6. KV’ye cache kaydı yazılır
7. JSON cevap döner

Rate limit:
- dakika başına `4`

Başarı payload’ı:
{
  "model": "optional-model",
  "prompt": "kırmızı bir araba",
  "url": "https://...",
  "ham": {}
}

KV cache:
- anahtar: `onbellek:gorsel:<timestamp>`
- alanlar:
  - `model`
  - `istemciKimligi`
  - `prompt`
  - `url`
  - `zaman`
- TTL: 1 saat

---

### 6.3.6 `GET /api/ayarlar/getir`
Amaç:
- uygulama ayarlarını istemciye vermek

Davranış:
- `uygulama:ayarlar` KV kaydı okunur
- `gizliYoneticiAnahtari` dışarı verilmez

Başarı payload’ı:
{
  "...": "ayar alanları",
  "gizliYoneticiAnahtari": "ASLA DÖNMEZ"
}

---

### 6.3.7 `POST /api/ayarlar/kaydet`
Amaç:
- ayar kaydetmek
- ilk yönetici anahtarını kurmak
- mevcut ayarları güncellemek

İstek gövdesi:
{
  "ayarlar": { "...": "..." },
  "yoneticiAnahtari": "optional",
  "yeniYoneticiAnahtari": "optional"
}

Kurallar:
- İlk kurulumda:
  - mevcut gizli anahtar yoksa
  - `yeniYoneticiAnahtari` zorunlu
  - minimum uzunluk: `16`
- Kurulum sonrası:
  - `yoneticiAnahtari` doğrulanmalı
- Yeni admin anahtarı verilirse:
  - `gizliYoneticiAnahtari` olarak saklanır

KV anahtarı:
- `uygulama:ayarlar`

Başarı payload’ı:
{
  "mesaj": "Ayarlar kaydedildi.",
  "ayarlar": { "...": "..." }
}

---

### 6.3.8 `GET /api/ortak-durum/oku`
Amaç:
- ortak durum nesnesini okumak

KV anahtarı:
- `ortakveri:durum`

Başarı payload’ı:
{
  "durum": {}
}

---

### 6.3.9 `POST /api/ortak-durum/yaz`
Amaç:
- ortak durumu güncellemek

İstek gövdesi:
{
  "durum": {},
  "yoneticiAnahtari": "SECRET"
}

Kurallar:
- `durum` şu tiplerden biri olabilir:
  - object
  - array
  - string
  - number
  - boolean
- yönetici doğrulaması zorunludur

KV anahtarı:
- `ortakveri:durum`

Başarı payload’ı:
{
  "mesaj": "Ortak durum güncellendi.",
  "durum": {}
}

---

### 6.3.10 `POST /api/onbellek/sil`
Amaç:
- belirli cache kaydını silmek

İstek gövdesi:
{
  "anahtar": "onbellek:sohbet:123",
  "yoneticiAnahtari": "SECRET"
}

Kurallar:
- `anahtar` zorunlu
- sadece `onbellek:` prefix’i ile başlayan anahtar silinebilir
- yönetici doğrulaması şarttır

Başarı payload’ı:
{
  "mesaj": "Önbellek kaydı silindi.",
  "anahtar": "onbellek:sohbet:123"
}

---

### 6.3.11 `GET /api/test/calisiyor`
Amaç:
- worker yanıt veriyor mu?

Başarı payload’ı:
{
  "calisiyor": true,
  "durum": "ok",
  "mesaj": "Worker istek aliyor ve cevap uretiyor."
}

---

### 6.3.12 `GET /api/test/saglik`
Amaç:
- `me.puter`
- `me.puter.kv`
- handler/global bağlamı
var mı görmek

Başarı payload’ı:
- handlerMe
- handlerMePuter
- globalMe
- globalMePuter
- kvErisimiTanimli
- kvTemelMetotlari
gibi tanılama alanları içerir

---

### 6.3.13 `GET /api/test/me-puter`
Amaç:
- gerçek KV yazma/okuma/silme testi yapmak

Davranış:
1. test key üretir
2. KV’ye yazar
3. okur
4. siler
5. sonucu doğrular

Bu endpoint gerçek ortam testi için kritiktir.

---

### 6.3.14 `GET /`
### 6.3.15 `GET /tumu`
### 6.3.16 `GET /api`
### 6.3.17 `GET /api/amac`
Amaç:
- tanıtım / amaç / özet / önerilen test yolları dönmek

ÖNEMLİ NOT:
Root özet içinde bazı yerlerde worker kimliği `ams` olarak geçebilir.
Bu, davranış sözleşmesinde **legacy/metinsel etiket** olarak kabul edilmelidir.
Canlı worker adı yine de `amg`’dir.

---

## 6.4 AMG giriş doğrulama kuralları

### Sohbet doğrulama
- `model` zorunlu
- `mesajlar` veya `prompt` zorunlu
- en fazla `40` mesaj
- geçerli roller:
  - `system`
  - `assistant`
  - `user`
  - `tool`
- tek string mesaj max: `12000`
- içerik dizisinde toplam metin max: `16000`
- toplam mesaj metni max: `30000`
- desteklenen içerik tipleri:
  - `text`
  - `file`
- file için `puter_path` zorunlu

### Görsel doğrulama
- `prompt` zorunlu
- prompt max: `2000`
- `genislik`: 256–2048
- `yukseklik`: 256–2048
- `adet`: 1–4

### Ayar doğrulama
- boş ayar + boş yeni admin key kabul edilmez

### Ortak durum doğrulama
- `durum` zorunludur

### Önbellek silme doğrulama
- `anahtar` zorunlu
- `onbellek:` prefix’i zorunlu

---

## 6.5 AMG rate limit kuralları
İstemci kimliği sırası:
1. `x-istemci-kimligi` header
2. `origin` header
3. `user.id | user.uuid | user.username | user.email`
4. fallback: `genel`

Dakika penceresi bazlı limit:
- `/api/sohbet` → `12`
- `/api/sohbet/akis` → `8`
- `/api/gorsel` → `4`

Sayaç KV anahtarı:
- `oran:<istemciKimligi>:<dakikaDamgasi>`

TTL:
- yaklaşık `120 saniye`

---

# 7) AMH — TAM TEKNİK SÖZLEŞME

---

## 7.1 AMH’nin ana görevi
AMH şunları yapar:

1. hizmet türü çözme
2. girdi normalize etme
3. etkin ayar üretme
4. sağlayıcı önceliği hesaplama
5. fallback zinciri kurma
6. timeout uygulama
7. maliyet bütçesi koruma
8. çok adımlı iş akışlarını yürütme
9. sonuç birleştirme
10. iş kaydı / geçmiş / arşiv / teşhis yönetme

---

## 7.2 AMH desteklediği hizmet türleri
AMH şu hizmet türlerini bilir:

- `CHAT`
- `IMG`
- `VIDEO`
- `TTS`
- `OCR`
- `PDF`
- `DEEPSEARCH`

---

## 7.3 AMH varsayılan timeout değerleri
- `CHAT` → `45000 ms`
- `IMG` → `60000 ms`
- `VIDEO` → `120000 ms`
- `TTS` → `45000 ms`
- `OCR` → `45000 ms`
- `PDF` → `90000 ms`
- `DEEPSEARCH` → `120000 ms`
- `TESHIS` → `20000 ms`

---

## 7.4 AMH gereken me.puter yetkinlikleri
- `CHAT` → `ai.chat`
- `IMG` → `ai.txt2img`
- `VIDEO` → `ai.txt2vid`
- `TTS` → `ai.txt2speech`
- `OCR` → `ai.img2txt`
- `PDF` → doğrudan zorunlu metot yok; orkestrasyon destekli
- `DEEPSEARCH` → `ai.chat`

---

## 7.5 AMH endpoint listesi

### Kök
- `GET /`
- `GET /tumu`

### Genel durum / panel
- `GET /api/durum`
- `GET /api/panel`

### İş yönetimi
- `GET /api/is/:isKimligi`
- `GET /api/is/:isKimligi/gecmis`
- `GET /api/is/:isKimligi/arsiv`
- `GET /api/is/:isKimligi/izle`

### Ana yürütme
- `POST /api/calistir`

### Teşhis
- `POST /api/teshis`
- `GET /api/teshis/:hizmetTuru`
- `GET /api/saglayici/:hizmetTuru/:saglayici`
- `GET /api/ispat/ozet`

---

## 7.6 AMH kök endpoint davranışı
`GET /` ve `GET /tumu`:
- sistemin AIAI sınıf özetini döndürür
- dosya adı
- sürüm
- sınıf bazlı görev grupları
- ortak görevler
dahil olabilir

Yani bu endpoint “ne yaparım?” özetidir; canlı iş çalıştırmaz.

---

## 7.7 `POST /api/calistir`
Bu, AMH’nin ana giriş kapısıdır.

Amaç:
- gelen girdiyi analiz edip
- hizmet türünü çözmek
- doğrulamak
- ayar üretmek
- gerekiyorsa sağlayıcı seçmek
- işi yürütmek
- iş kaydı oluşturmak
- sonucu tek sözleşmede döndürmek

### Kabul edilen temel istek biçimi
Tek bir sabit body yoktur.
AMH body’yi hizmet türüne göre yorumlar.

Örnek CHAT:
{
  "serviceType": "CHAT",
  "mesajlar": [
    { "role": "user", "content": "Merhaba" }
  ],
  "model": "gpt-5-nano",
  "webArama": true
}

Örnek IMG:
{
  "serviceType": "IMG",
  "prompt": "bir dağ manzarası",
  "adet": 1,
  "oran": "1:1"
}

Örnek VIDEO:
{
  "serviceType": "VIDEO",
  "prompt": "uçan bir şehir",
  "sureSaniye": 8,
  "oran": "16:9"
}

Örnek TTS:
{
  "serviceType": "TTS",
  "metin": "Merhaba dünya",
  "ses": "Joanna",
  "dil": "tr-TR"
}

Örnek OCR:
{
  "serviceType": "OCR",
  "gorselUrl": "https://..."
}

Örnek PDF:
{
  "serviceType": "PDF",
  "dosyaUrl": "https://...",
  "ozetIsteniyor": true
}

Örnek DEEPSEARCH:
{
  "serviceType": "DEEPSEARCH",
  "sorgu": "Türkiye'de yapay zeka regülasyonları",
  "altSorguSiniri": 4
}

---

## 7.8 Hizmet türü çözümleme kuralları
Eğer `serviceType | hizmetTuru | tip` verilirse önce ona bakılır.

Aksi halde sezgisel çözümleme:

- `mesajlar` veya `systemPrompt` veya `webArama` varsa → `CHAT`
- `gorselUrl`, `gorselVerisi`, `referansGorsel` veya `/gorsel` işareti varsa → `IMG`
- `videoUrl`, `sureSaniye` veya `/video` varsa → `VIDEO`
- `ses`, `voice`, `sesFormati` veya `/ses` varsa → `TTS`
- `.pdf`, `pdfUrl`, `sayfalar`, `pdf` varsa → `PDF`
- image mime veya `ocr` varsa → `OCR`
- `sorgu`, `altSorgular`, `derinlik` veya `/deepsearch` varsa → `DEEPSEARCH`
- aksi halde → `CHAT`

---

## 7.9 AMH doğrulama kuralları

### CHAT
- `mesajlar` veya `prompt` zorunlu
- max `60` mesaj
- toplam metin max `50000`
- rol seti:
  - `system`
  - `assistant`
  - `user`
  - `tool`

### IMG
- `prompt` zorunlu
- prompt max `2500`
- `adet`: 1–4

### VIDEO
- `prompt` zorunlu
- `sureSaniye`: 1–120

### TTS
- `metin` zorunlu
- metin max `12000`
- `hiz`: 0.5–2

### OCR
- `gorselUrl` veya `gorselListesi` zorunlu
- `sayfaSayisi`: 1–500

### PDF
- en az biri zorunlu:
  - `dosyaUrl`
  - `metin`
  - `sayfalar`
- `sayfaSayisi`: 1–1000 normalizasyon, fakat filtre katmanında 500 üstü reddedilebilir

### DEEPSEARCH
- `sorgu` zorunlu
- sorgu max `3000`
- `altSorguSiniri`: 1–20 normalizasyon, filtre katmanında bütçeye göre 12’ye indirilebilir

### URL güvenliği
- `javascript:` ve `data:` engellenir

### MIME güvenliği
- `application/x-msdownload` engellenir

---

## 7.10 Hizmete özel filtre kuralları

### IMG
- `adet > 4` reddedilir
- `oran = 9:16` ve katı güvenlik modunda → `1:1`’e çekilebilir

### VIDEO
- `sureSaniye > 60` ve bütçe düşükse reddedilebilir

### TTS
- metin çok uzunsa kalite `medium`’a çekilebilir

### OCR
- tek işte max `100` sayfa

### PDF
- max `500` sayfa

### DEEPSEARCH
- alt sorgu limiti bütçeye göre `12`’ye indirilebilir

---

## 7.11 AMH etkin ayar üretme mantığı
AMH şu parametreleri birleştirerek etkin ayar üretir:
- varsayılan ayarlar
- kullanıcı tercihi
- güvenlik kısıtları
- request header’ları

Okuyabildiği header’lar:
- `x-kalite-seviyesi`
- `x-timeout-ms`
- `x-saglayici`
- `x-korelasyon-anahtari`
- `x-request-id`
- `x-istemci-kimligi`

Etkin ayar alanları:
- `hizmetTuru`
- `model`
- `saglayici`
- `timeoutMs`
- `kaliteSeviyesi`
- `maliyetSiniri`
- `fallbackZinciri`
- `oncelik`
- `kotaKoruma`
- `denemeSiniri`
- `gecikmeToleransiMs`
- `guvenlikModu`

---

## 7.12 Varsayılan model/saglayici yaklaşımı

### Varsayılan model mantığı
- CHAT → `gpt-5-nano`
- IMG → `gpt-image-1-mini`
- VIDEO → `runway`
- TTS → `openai-tts`
- OCR → `aws-textract`
- PDF → `belge-orkestrasi`
- DEEPSEARCH → `switchpoint/router`

### Varsayılan sağlayıcı mantığı
- CHAT → `auto`
- IMG → `openai-image-generation`
- VIDEO → `auto`
- TTS → `auto`
- OCR → `auto`
- PDF → `internal`
- DEEPSEARCH → `auto`

---

## 7.13 AMH orkestrasyon mantığı

### Adım 1
Hizmet türü çözülür.

### Adım 2
İstek bağlamı üretilir:
- `isKimligi`
- `olayKimligi`
- `kullaniciKimligi`
- `korelasyonAnahtari`
- `baslangicZamani`

### Adım 3
Girdi doğrulanır.

### Adım 4
Etkin ayar üretilir.

### Adım 5
Hizmet yetkinliği kontrol edilir.

### Adım 6
İş kaydı açılır.

### Adım 7
Sağlayıcı önceliği ve fallback zinciri belirlenir.

### Adım 8
Tahmini maliyet hesaplanır ve bütçe kontrol edilir.

### Adım 9
İlgili hizmet çalıştırılır.

### Adım 10
Hata olursa:
- hata sınıfı çıkarılır
- yeniden deneme kararı verilir
- gerekirse fallback uygulanır

### Adım 11
Sonuçlar birleştirilir.

### Adım 12
İş tamamlanır, arşivlenir ve sonuç döner.

---

## 7.14 AMH hata sınıfları
Hata sınıflandırma motoru şu sınıfları üretir:

- `zaman_asimi_hatasi`
- `kota_hatasi`
- `yetki_hatasi`
- `ag_hatasi`
- `dogrulama_hatasi`
- `veri_bicimi_hatasi`
- `saglayici_hatasi`
- `bilinmeyen_hata`

---

## 7.15 Yeniden deneme kuralları
Şu durumlarda retry düşünülebilir:
- ağ hatası
- zaman aşımı
- sağlayıcı kararsızlığı
- kota nedeniyle yedek sağlayıcıya geçiş

Retry üst sınırı:
- `denemeSiniri`

---

## 7.16 İş kaydı / geçmiş / arşiv

### Depo anahtar ön eki
- `aaoit`

### Tipik anahtarlar
- `aaoit:is:<isKimligi>`
- `aaoit:gecmis:<isKimligi>`
- `aaoit:arsiv:<isKimligi>`
- `aaoit:saglayici-hata:<HIZMET>`
- `aaoit:test:<...>`

### İş kaydı içeriği
- `isKimligi`
- `hizmetTuru`
- `kullaniciKimligi`
- `baslangicZamani`
- `durum`
- `saglayiciPlani`
- `istekOzeti`

### Geçmiş kaydı
- olay kimliği
- olay adı
- veri
- zaman damgası

### Arşiv
- iş özeti
- sonuç
- son mesaj
- geçmişin son bölümü

---

## 7.17 `GET /api/is/:isKimligi`
Amaç:
- iş özeti döndürmek

Özet alanları:
- `isKimligi`
- `durum`
- `yuzde`
- `aktifAdim`
- `sonHata`
- `tahminiBitis`
- `sonGuncelleme`

---

## 7.18 `GET /api/is/:isKimligi/gecmis`
Amaç:
- olay geçmişini döndürmek

---

## 7.19 `GET /api/is/:isKimligi/arsiv`
Amaç:
- tamamlanan iş arşivini döndürmek

---

## 7.20 `GET /api/is/:isKimligi/izle`
Amaç:
- kuyruktaki işi izlemek

Özel davranış:
- `queued | kuyrukta` ise
- worker bunu `isleniyor` durumuna çekebilir
- yüzdeyi en az `10` yapabilir
- aktif adımı “sağlayıcı durum sorgusu” olarak işaretleyebilir

---

## 7.21 `POST /api/teshis`
Amaç:
- toplu teşhis raporu üretmek

İçerebilir:
- genel sağlık
- hizmet bazlı teşhis
- sağlayıcı erişim testi
- KV testi
- fallback testi
- rapor özeti

---

## 7.22 `GET /api/teshis/:hizmetTuru`
Amaç:
- tek hizmet için teşhis

---

## 7.23 `GET /api/saglayici/:hizmetTuru/:saglayici`
Amaç:
- belirli sağlayıcının belirli hizmette erişilebilir olup olmadığını kontrol etmek

---

## 7.24 `GET /api/ispat/ozet`
Amaç:
- sistem sağlık + panel özetini birlikte vermek

---

# 8) AMH HİZMET BAZLI ÇIKTI DAVRANIŞLARI

## 8.1 CHAT
- `ai.chat` çağrılır
- string / message.content / content normalize edilir
- metin döner

## 8.2 IMG
- `ai.txt2img` çağrılır
- url / src / images[0] normalize edilir

## 8.3 VIDEO
- `ai.txt2vid` varsa çağrılır
- yoksa queued job benzeri fallback üretilir
- `jobId`, `status`, `url` normalize edilir

## 8.4 TTS
- `ai.txt2speech` varsa çağrılır
- yoksa plan/fallback benzeri boş çıktı oluşturulabilir

## 8.5 OCR
- `ai.img2txt` tekil veya çoklu görseller için çağrılır
- metinler birleştirilir

## 8.6 PDF
- doğrudan parse motoru yoksa:
  - sayfa görselleri varsa OCR yolu izlenir
  - sadece URL varsa placeholder metin oluşabilir
- özet gerekiyorsa `ai.chat` ile özetlenir

## 8.7 DEEPSEARCH
- alt sorgular üretilir
- `ai.chat + web_search` ile araştırma özeti alınabilir
- kaynak özeti listesi üretilir

---

# 9) KOD YAZARKEN KORUNMASI GEREKEN ÖZEL DAVRANIŞLAR

1. AMG ve AMH response şekillerini ayır.
2. AMG’de `meta` alanı zorunlu değildir; AMH’de vardır.
3. AMG’de admin koruması body içindeki `yoneticiAnahtari` ile işler.
4. AMG’de ilk kurulum için `yeniYoneticiAnahtari` min 16 karakterdir.
5. AMG sohbet akışında SSE event adları değiştirilmeyecek.
6. AMG cache prefix’i `onbellek:` korunacak.
7. AMG ortak durum KV anahtarı `ortakveri:durum` korunacak.
8. AMG ayar KV anahtarı `uygulama:ayarlar` korunacak.
9. AMH depo prefix’i `aaoit` korunacak.
10. AMH hizmet türü isimleri büyük harfli set olarak korunacak.
11. AMH timeout mantığı Promise.race benzeri olmalı.
12. AMH retry kararı hata sınıfına göre verilmeli.
13. AMH fallback zinciri provider + policy mantığı içermeli.
14. AMH kalite / maliyet / süre meta alanları korunmalı.
15. AMH PDF ve DEEPSEARCH için “çok adımlı akış” ayrı mantık olarak kalmalı.

---

# 10) BİREBİR KOPYALANMASI GEREKMEYEN AMA DAVRANIŞI KORUNMASI GEREKEN YERLER

Şunlar birebir aynı isimde olmak zorunda değildir:
- iç yardımcı fonksiyon adları
- kodun satır sırası
- log başlık metinleri
- küçük iç refactor kararları

Ama şunlar korunmalıdır:
- route path’leri
- request alanları
- response alanları
- auth kuralları
- limitler
- KV anahtar formatları
- event isimleri
- hata sınıfları
- timeout / maliyet / retry / fallback karar modeli

---

# 11) BİLİNEN TUTARSIZLIKLAR / LEGACY NOTLARI

1. AMG canlı worker adı `amg` olsa da bazı iç özet alanlarında `ams` metni geçebilir.
2. Bu metin farkı davranış kırığı değil; metinsel/legacy etiket gibi ele alınmalıdır.
3. AI bunu “bug” sanıp route veya worker adını değiştirmemelidir.

---

# 12) KAYNAK KOD GÖRMEDEN YENİDEN UYGULAMA STRATEJİSİ

Bir AI şu sırayla ilerlemelidir:

## Aşama 1 — Sözleşme iskeleti
Önce tüm endpointleri aynen aç:
- AMG rotaları
- AMH rotaları

## Aşama 2 — Response uyumu
Sonra success/error şemalarını tam oturt:
- AMG düz şema
- AMH meta’lı şema

## Aşama 3 — Güvenlik
Sonra:
- admin koruması
- URL güvenliği
- mime güvenliği
- rate limit
eklenir

## Aşama 4 — KV
Sonra:
- ayarlar
- ortak durum
- cache
- iş kaydı
- geçmiş
- arşiv
eklenir

## Aşama 5 — AI entegrasyonu
Sonra:
- chat
- img
- video
- tts
- ocr
- pdf
- deepsearch
adım adım bağlanır

## Aşama 6 — Teşhis
Sonra:
- sağlık
- KV testi
- sağlayıcı testi
- fallback testi
eklenir

---

# 13) CONTRACT TEST LİSTESİ
Kaynak kodu görmeden yazılan klon şu testleri geçmeden “uyumlu” sayılmamalıdır:

## AMG testleri
1. `GET /api/durum` → 200 ve `ok=true`
2. `POST /api/sohbet` geçerli body → 200
3. `POST /api/sohbet` bozuk JSON → 400
4. `POST /api/sohbet/akis` → SSE event akışı
5. `POST /api/gorsel` prompt yok → 400
6. `GET /api/ayarlar/getir` → `gizliYoneticiAnahtari` dönmez
7. ilk kurulumda kısa admin anahtarı → 400
8. `/api/ortak-durum/yaz` yanlış admin → 403
9. `/api/onbellek/sil` prefix yanlış → 400
10. `/api/test/me-puter` → gerçek KV roundtrip

## AMH testleri
1. `POST /api/calistir` CHAT → 200
2. `POST /api/calistir` geçersiz body → 400
3. `POST /api/calistir` serviceType yok ama prompt var → uygun tür seçimi
4. `POST /api/calistir` riskli URL → doğrulama hatası
5. timeout simülasyonu → `zaman_asimi_hatasi`
6. kota simülasyonu → `kota_hatasi`
7. `GET /api/is/:id` → iş özeti
8. `GET /api/is/:id/gecmis` → olay listesi
9. `GET /api/is/:id/arsiv` → arşiv nesnesi
10. `POST /api/teshis` → rapor gövdesi

---

# 14) AI İÇİN DOĞRUDAN GÖREV TALİMATI
Aşağıdaki metin, başka bir yapay zekâya doğrudan verilebilir:

“AMG ve AMH isminde iki Puter Worker yeniden uygula. Route adlarını, request/response sözleşmelerini, rate-limit kurallarını, admin korumasını, KV anahtar biçimlerini, AMH meta yapısını, hizmet türü çözümleme mantığını, timeout–retry–fallback–maliyet–iş kaydı–teşhis akışlarını bu README’ye birebir uyumlu koru. İç kod birebir olmak zorunda değil; dış davranış birebir uyumlu olmalı. Önce route iskeletini kur, sonra response sözleşmesini oturt, ardından doğrulama/güvenlik/KV/AI entegrasyonu/teşhis katmanlarını sırayla ekle. Son aşamada contract test yaz ve her endpointi doğrula.”

---

# 15) SON KARAR

## Soru:
Bu bilgileri okuyan herhangi bir AI, kaynak kodları görmeden kodlama yapabilir mi?

## Net cevap:
- Senin önceki kısa özetinle: **TAM OLARAK HAYIR**
- Bu README ile: **EVET, büyük ölçüde EVET**
- Ama:
  - birebir davranış garantisi için
  - canlı endpoint karşılaştırması
  - contract test
  yine gereklidir

## En doğru ifade:
Bu README, kaynak kodu görmeden **uyumlu yeniden uygulama geliştirmek için yeterli teknik sözleşmeyi** sağlar.

---
# 16) KISA ÖZET

- **AMG** = uygulama tarafı ortak servis worker’ı
- **AMH** = çok hizmetli AI orkestrasyon worker’ı
- **AMG** düz JSON şeması kullanır
- **AMH** meta’lı standart cevap şeması kullanır
- **AMG** rate limit + cache + admin ayar + ortak durum yapar
- **AMH** service resolution + timeout + retry + fallback + job tracking + diagnosis yapar
- Bu README olmadan AI eksik kalır
- Bu README ile AI kaynak kod görmeden ciddi ölçüde kod yazabilir
