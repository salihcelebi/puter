# README.md

# ANO + BABO — KAYNAK KODU GÖRÜLMEDEN UYUMLU KODLAMA İÇİN TAM TEKNİK SÖZLEŞME

## BU README.md NEDEN OLUŞTURULDU?

1. Bu README.md, ANO ve BABO worker’larının kaynak kodu açılmadan da yüksek doğrulukla yeniden kodlanabilmesi için oluşturuldu.
2. Bu belge, bir yapay zekânın veya geliştiricinin sistemin dış davranışını anlayıp uyumlu kod üretebilmesi için hazırlandı.
3. Bu README.md, endpoint’lerin görevini, girişlerini, çıkışlarını ve kurallarını tek yerde toplamak için yazıldı.
4. Bu belge, ANO ile BABO’nun rol farkını netleştirip yanlış mimari kurulmasını önlemek için oluşturuldu.
5. Bu README.md, kaynak kod görünmese bile route, response, yetki, KV ve iş akışlarının doğru kurulabilmesi için hazırlandı.
6. Bu belge, tahmine dayalı değil, açık teknik sözleşmeye dayalı kodlama yapılabilmesi için oluşturuldu.
7. Bu README.md, başka bir AI aracının sistemi eksik anlamadan, kontrollü ve tutarlı biçimde geliştirme yapabilmesi için yazıldı.
8. Bu belge, bakım, taşıma, yeniden yazım ve genişletme süreçlerinde resmi teknik referans olarak kullanılmak için hazırlandı.
9. Bu README.md, canlı davranışı koruyarak iç kod farklı olsa bile dış uyumun korunmasını sağlamak için oluşturuldu.
10. Bu belge, ANO ve BABO worker’larının kaynak kod görülmeden bile yüksek doğrulukla kodlanabileceğini net biçimde tanımlayan ana teknik sözleşmedir.
11. Bu belge, worker kimliği, response kimliği, meta dosya adı ve env sözlüğünü tek standarda bağlamak için güçlendirildi.
12. Bu belge, isim dönüşümü sırasında yarım migration riskini azaltmak için güvenli geçiş planını görünür kılar.

---

## AMAÇ

Bu belge, herhangi bir yapay zekânın veya geliştiricinin, ANO ve BABO worker’larının **kaynak kodunu doğrudan görmeden** davranışı anlayıp **uyumlu yeniden uygulama** geliştirebilmesi için hazırlanmıştır.

## KISA CEVAP

- Sadece kısa amaç listeleriyle: güvenli ve yüksek doğruluklu kodlama yapılamaz.
- Bu README seviyesinde teknik sözleşme ile: kaynak kod görülmeden bile yüksek doğrulukta kodlama yapılabilir.
- Son davranış eşleşmesini doğrulamak için: **contract test** uygulanmalıdır.
- Fayda karakter sayısıyla değil; contract görünürlüğü, hata önleme, migration kolaylığı ve AI yönlendirme kalitesiyle ölçülür.

---

# 1) SİSTEM KİMLİĞİ

## 1.1 Worker’lar

### ANO
- worker adı: `ano`
- rol: `uygulama servis workerı`
- panelde görünen isim: `ANO`
- response kimliği: `ANO`
- meta dosya adı: `ano.js`

### BABO
- worker adı: `babo`
- rol: `orkestrasyon workerı`
- panelde görünen isim: `BABO`
- response kimliği: `BABO`
- meta dosya adı: `babo.js`

## 1.2 Worker kimliği / response kimliği / meta kimliği

Bu belgede üç ayrı kimlik katmanı açıkça sabitlenir:

### ANO için
- Worker kimliği: `ano`
- İç raporlanan kimlik: `ANO`
- Response kimliği: `ANO`
- Meta dosya adı: `ano.js`
- Panelde görünen isim: `ANO`
- Test anahtarı prefix’i: `ano:test:meputer`

### BABO için
- Worker kimliği: `babo`
- İç raporlanan kimlik: `BABO`
- Response kimliği: `BABO`
- Meta dosya adı: `babo.js`
- Panelde görünen isim: `BABO`
- Repo prefix’i: `aaoit`

## 1.3 Runtime varsayımları

Her iki worker da Puter Worker ortamını hedefler.
Pratikte şu nesneler beklenir:

- `router`
- `Response`
- `ReadableStream`
- `TextEncoder`
- `URL`
- `me`
- `me.puter`
- `me.puter.kv`
- `me.puter.ai.*`
- bazı akışlarda `globalThis.me.puter`

---

# 2) ANA AYRIM

## 2.1 ANO nedir?

ANO, uygulamaya yakın ortak servis worker’ıdır.

Ana işi:
- sohbet
- akışlı sohbet
- görsel üretim
- model listesi
- ayar okuma/kaydetme
- ortak durum okuma/yazma
- önbellek silme
- sağlık/test/amaç endpointleri

Kısa tanım:
**frontend’e yakın, pratik, doğrudan kullanılan servis worker**

## 2.2 BABO nedir?

BABO, çok hizmetli AI orkestrasyon worker’ıdır.

Ana işi:
- hizmet türü çözmek
- girdi doğrulamak
- etkin ayar üretmek
- sağlayıcı önceliği belirlemek
- fallback kurmak
- timeout uygulamak
- maliyet bütçesi yönetmek
- iş kaydı / geçmiş / arşiv tutmak
- sağlık / teşhis / panel verisi üretmek

Kısa tanım:
**AI çağrılarının arka plandaki orkestra şefi + iş takip + teşhis çekirdeği**

## 2.3 Tek cümlede fark
- **ANO = uygulama servis worker’ı**
- **BABO = orkestrasyon worker’ı**

---

# 3) KAYNAK KOD GÖRÜLMEDEN KODLAMA KURALI

Bu belgeye göre yeniden uygulama yazacak bir AI aşağıdaki kuralları bozmayacaktır:

1. Route adlarını değiştirmeyecek.
2. Request alanlarını bozmayacak.
3. Response sözleşmesini bozmayacak.
4. ANO ile BABO cevap şemalarını birbirine karıştırmayacak.
5. ANO’daki admin koruma mantığını gevşetmeyecek.
6. ANO’daki rate limit ve cache anahtarlarını koruyacak.
7. BABO’daki iş kaydı / geçmiş / arşiv omurgasını koruyacak.
8. BABO’daki timeout / retry / fallback / maliyet mantığını koruyacak.
9. PDF ve DEEPSEARCH’i tek adımlı yalancı akışa çevirmeyecek.
10. İç implementasyon birebir aynı olmak zorunda değildir; dış davranış birebir uyumlu olmalıdır.
11. Nihai sözleşmede sadece ANO ve BABO kimliklerini kullanacaktır.
12. Önceki worker kimliklerinden hiçbiri nihai response, meta, log, yorum ve README içinde bırakılmayacaktır.

---

# 4) RESPONSE SÖZLEŞMELERİ

## 4.1 ANO cevap şeması

### Başarı
```json
{
  "ok": true,
  "veri": {},
  "hata": null
}
```

### Hata
```json
{
  "ok": false,
  "veri": null,
  "hata": "..."
}
```

### ANO notları
- `meta` alanı yoktur.
- `Content-Type: application/json; charset=utf-8`
- `Cache-Control: no-store`
- Kimlik dönen alanlarda `ANO` veya `ano` dışında başka worker adı kullanılmaz.

---

## 4.2 BABO cevap şeması

### Standart gövde
```json
{
  "ok": true,
  "veri": {},
  "hata": null,
  "meta": {
    "dosya": "babo.js",
    "surum": "2026-03-18.1",
    "zamanDamgasi": "ISO_DATE",
    "isKimligi": null,
    "sureMs": 0,
    "maliyet": 0,
    "teshis": null,
    "worker": "BABO"
  }
}
```

### Hata gövdesi
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
    "dosya": "babo.js",
    "surum": "2026-03-18.1",
    "zamanDamgasi": "ISO_DATE",
    "isKimligi": null,
    "sureMs": 0,
    "maliyet": 0,
    "teshis": null,
    "worker": "BABO"
  }
}
```

### BABO notları
- `meta` zorunlu omurganın parçasıdır.
- `dosya` ve `surum` BABO içinde sabittir.
- `yanitDondur()` tüm nihai JSON cevabın alt taşıyıcısıdır.
- Meta ve response içinde sadece `BABO` kimliği görünür.

---

# 5) CORS VE HTTP KURALLARI

## 5.1 ANO CORS

Başlıklar:
- `Access-Control-Allow-Origin: origin || *`
- `Access-Control-Allow-Headers: Content-Type, Authorization, X-Istemci-Kimligi, X-Yonetici-Anahtari`
- `Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS`
- `Access-Control-Allow-Credentials: origin ? true : false`
- `Vary: Origin`

## 5.2 BABO CORS

BABO aynı mantığı kullanır, ek olarak şunu kabul eder:
- `X-Korelasyon-Anahtari`

## 5.3 OPTIONS

Her iki worker:
- `204`
- boş body
- CORS başlıkları
  döndürür.

---

# 6) ANO — TAM DAVRANIŞ SÖZLEŞMESİ

## 6.1 ANO’nun ana görevi

ANO aşağıdaki alanları yönetir:
1. sohbet
2. akışlı sohbet
3. görsel üretim
4. model listesi
5. ayar okuma
6. ayar kaydetme
7. ortak durum okuma
8. ortak durum yazma
9. önbellek silme
10. sağlık, test, amaç ve tanıtım endpointleri

## 6.2 ANO route listesi

### Genel
- `GET /`
- `GET /tumu`
- `GET /api`
- `GET /api/amac`

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

### Test
- `GET /api/test/calisiyor`
- `GET /api/test/saglik`
- `GET /api/test/me-puter`

### Preflight
- `OPTIONS /*yol`

## 6.3 ANO gövde parse davranışı

Fonksiyon: `govdeyiCozumle(request)`

Kurallar:
- `content-type` içinde `application/json` yoksa `{}` döner.
- `application/json` ise `request.json()` dener.
- parse başarısızsa `null` döner.
- route’lar `govde === null` kontrolü ile `400 Geçersiz JSON gövdesi.` döndürür.

Önemli sonuç:
- ANO form-data veya urlencoded parse etmez.
- JSON dışı body’ler hata değil, boş nesne gibi görülür.

## 6.4 ANO KV anahtarları

### Ayarlar
- `uygulama:ayarlar`
- env karşılığı: `ANO_SETTINGS_KEY`

### Ortak durum
- `ortakveri:durum`
- env karşılığı: `ANO_SHARED_STATE_KEY`

### Rate limit sayaçları
- `<ANO_RATE_PREFIX>:<istemciKimligi>:<dakikaDamgasi>`

### Sohbet cache
- `<ANO_CACHE_PREFIX>:sohbet:<timestamp>`

### Akış cache
- `<ANO_CACHE_PREFIX>:akis:<timestamp>`

### Görsel cache
- `<ANO_CACHE_PREFIX>:gorsel:<timestamp>`

### Test key
- `<ANO_TEST_KEY_PREFIX>:kontrol`

## 6.5 ANO TTL kuralları

### Rate limit
- TTL: `saniyeDamgasiAl() + 120`

### Sohbet cache
- TTL: `saniyeDamgasiAl() + 3600`

### Akış cache
- TTL: `saniyeDamgasiAl() + 3600`

### Görsel cache
- TTL: `saniyeDamgasiAl() + 3600`

## 6.6 ANO istemci kimliği çıkarma mantığı

Fonksiyon: `istemciKimliginiCikar(request, user)`

Sıra:
1. `x-istemci-kimligi`
2. `origin`
3. `user.id`
4. `user.uuid`
5. `user.username`
6. `user.email`
7. fallback: `genel`

Ek kural:
- sonuç string’e çevrilir
- en fazla `160` karakter tutulur

## 6.7 ANO rate limit kuralları

Fonksiyon: `istekSiniriniKontrolEt(me, istemciKimligi, dakikaBasinaSinir)`

Limitler:
- `/api/sohbet` → `12`
- `/api/sohbet/akis` → `8`
- `/api/gorsel` → `4`

Hata metni:
- `İstek sınırı aşıldı. Lütfen kısa süre sonra tekrar dene.`

Aşım durumunda:
- HTTP `429`

## 6.8 ANO sohbet doğrulama kuralları

Fonksiyon: `sohbetGovdesiniDogrula(govde)`

### Zorunlu alanlar
- `model` zorunlu
- `mesajlar` veya `prompt` zorunlu

### Prompt fallback
- `mesajlar` yok ama `prompt` varsa:
```json
[{ "role": "user", "content": "<prompt>" }]
```

### Mesaj sayısı
- en fazla `40`

### Geçerli roller
- `system`
- `assistant`
- `user`
- `tool`

### İçerik tipleri
- string içerik kabul edilir
- içerik dizisi kabul edilir
- dizi içindeki desteklenen tipler:
  - `text`
  - `file`

### text öğesi
- boş olamaz
- tek text öğesi max `12000`

### file öğesi
- `puter_path` zorunlu

### Bir mesajdaki toplam text
- max `16000`

### Tüm mesajların toplam text’i
- max `30000`

### Normalize edilen alanlar
- `sicaklik` → varsayılan `0.7`, aralık `0–2`
- `azamiToken` → varsayılan `1200`, aralık `1–4000`
- `dusunmeSeviyesi`
- `metinKisalikSeviyesi`
- `webArama`
- `istemciKimligi`

## 6.9 ANO görsel doğrulama kuralları

Fonksiyon: `gorselGovdesiniDogrula(govde)`

### Zorunlu
- `prompt`

### Sınırlar
- prompt max `2000`
- `genislik` → `256–2048`
- `yukseklik` → `256–2048`
- `adet` → `1–4`

### Normalize edilen alanlar
- `model`
- `kalite` → varsayılan `low`
- `genislik` → varsayılan `1024`
- `yukseklik` → varsayılan `1024`
- `adet` → varsayılan `1`
- `testModu`
- `istemciKimligi`

## 6.10 ANO ayar doğrulama kuralları

Fonksiyon: `ayarGirdisiniDogrula(govde)`

Alanlar:
- `ayarlar`
- `yoneticiAnahtari`
- `yeniYoneticiAnahtari`

Kural:
- boş `ayarlar` + boş `yeniYoneticiAnahtari` birlikte kabul edilmez

## 6.11 ANO ortak durum doğrulama kuralları

Fonksiyon: `ortakDurumGovdesiniDogrula(govde)`

`durum` şu tiplerden biri olabilir:
- object
- array
- string
- number
- boolean

Aksi halde hata:
- `durum alanı zorunludur.`

## 6.12 ANO önbellek silme doğrulama kuralları

Fonksiyon: `onbellekSilGovdesiniDogrula(govde)`

Kurallar:
- `anahtar` zorunlu
- sadece `onbellek:` ile başlayan anahtarlar silinebilir
- `yoneticiAnahtari` gövdeden alınır

## 6.13 ANO yönetici anahtarı kuralları

### Fonksiyonlar
- `yoneticiAnahtariVarMi`
- `yoneticiYetkisiniDogrula`

### İlk kurulum
- gizli yönetici anahtarı yoksa
- `yeniYoneticiAnahtari` zorunlu
- minimum `16` karakter

### Sonraki kaydetmeler
- `yoneticiAnahtari` ile doğrulama gerekir

### Saklanan alan
- `ANO_ADMIN_SECRET` env değeri veya kalıcı ayardaki gizli yönetici alanı

### Dışarıya asla verilmez
- `ayarlariDisariHazirla()` gizli yönetici alanını response’tan siler

## 6.14 ANO AI seçenekleri

Fonksiyon: `sohbetSecenekleriniHazirla(sohbetVerisi, akisModu)`

Çıkan alanlar:
- `model`
- `stream`
- `max_tokens`
- `temperature`

Opsiyonel:
- `reasoning_effort` ← `dusunmeSeviyesi`
- `text_verbosity` ← `metinKisalikSeviyesi`
- `tools: [{ type: 'web_search' }]` ← `webArama = true`

## 6.15 ANO SSE kuralları

Fonksiyonlar:
- `sseSatiriUret`
- `akisDestegiVarMi`
- `akisYanitiUret`

### Ortam uygunsa
- `ReadableStream`
- `TextEncoder`
Vardır ve SSE açılır.

### Ortam uygun değilse
ANO normal JSON döner:
```json
{
  "ok": true,
  "veri": {
    "akisaUygunOrtam": false,
    "metin": "..."
  },
  "hata": null
}
```

### SSE event adları
- `hazir`
- `parca`
- `arac`
- `bitti`
- `hata`

### Hazır event
```txt
event: hazir
data: {"ok":true,"veri":{"durum":"hazir"},"hata":null}
```

### Parça event
```txt
event: parca
data: {"ok":true,"veri":{"metin":"..."},"hata":null}
```

### Araç event
Tool parçası gelirse:
```json
{
  "ok": true,
  "veri": {
    "ad": "<tool name>",
    "girdi": {}
  },
  "hata": null
}
```

### Bitti event
Toplu metni döner.

### Hata event
Güvenli hata mesajı döner.

### SSE response başlıkları
- `Content-Type: text/event-stream; charset=utf-8`
- `Cache-Control: no-cache, no-transform`
- `Connection: keep-alive`

## 6.16 ANO route sözleşmeleri

### `GET /api/durum`
Amaç:
- worker hazır mı
- yönetici kurulmuş mu
- ortak durum var mı

Örnek veri:
```json
{
  "servis": "ANO",
  "durum": "hazir",
  "mePuterOdakli": true,
  "yoneticiKurulu": true,
  "ortakDurumVar": true,
  "zaman": "ISO_DATE"
}
```

### `GET /api/modeller`
Amaç:
- model listesi döndürmek

Query:
- `saglayici`
- `ara`
- `sinir`

Normalizasyon:
- `kimlik`
- `ad`
- `saglayici`
- `baglam`
- `azamiToken`
- `maliyet`
- `takmaAdlar`

Sınır:
- varsayılan `150`
- aralık `1–500`

### `POST /api/sohbet`
Amaç:
- senkron sohbet

Body örneği:
```json
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
```

Akış:
1. JSON parse
2. sohbet doğrulama
3. istemci kimliği çıkarma
4. rate limit
5. `me.puter.ai.chat(...)`
6. metne dönüştürme
7. cache yazma
8. başarı cevabı

Cache gövdesi:
- `model`
- `istemciKimligi`
- `soru`
- `cevap`
- `zaman`

Başarı veri alanları:
- `model`
- `metin`
- `oranSayisi`
- `onbellekAnahtari`

### `POST /api/sohbet/akis`
Amaç:
- akışlı sohbet

Akış:
1. JSON parse
2. sohbet doğrulama
3. istemci kimliği
4. rate limit
5. SSE veya fallback JSON
6. `me.puter.ai.chat(..., { stream: true })`
7. text parçaları `parca` event’i
8. tool parçaları `arac` event’i
9. tamamlanan metni cache altında kaydet

### `POST /api/gorsel`
Amaç:
- txt2img üretimi

AI çağrısı:
```js
me.puter.ai.txt2img({
  prompt,
  test_mode,
  quality,
  width,
  height,
  n,
  model?
})
```

Çıktı çözümleme:
- string → `url`
- object.url → `url`
- object.src → `url`
- object.image_url → `url`

### `GET /api/ayarlar/getir`
Amaç:
- ayarları döndürmek

Kural:
- gizli yönetici alanı response’a asla girmez

### `POST /api/ayarlar/kaydet`
Amaç:
- ayar kaydetmek
- ilk yönetici anahtarı kurmak
- admin anahtarını yenilemek

Kurallar:
- ilk kurulumda `yeniYoneticiAnahtari` min `16`
- kurulum sonrası `yoneticiAnahtari` zorunlu doğrulama
- yeni yönetici değeri gelirse gizli alan olarak saklanır

### `GET /api/ortak-durum/oku`
Başarı veri:
```json
{
  "durum": {}
}
```

### `POST /api/ortak-durum/yaz`
Gerekli:
- `durum`
- `yoneticiAnahtari`

Başarı veri:
- `mesaj`
- `durum`

### `POST /api/onbellek/sil`
Gerekli:
- `anahtar`
- `yoneticiAnahtari`

Kural:
- yalnız cache prefix’i ile başlayan anahtarlar

Başarı veri:
- `mesaj`
- `anahtar`

### `GET /`
### `GET /tumu`
Amaç:
- `tumOzetiOlustur(me)` sonucunu döndürmek

Önemli:
- worker alanı ve özet kimliği `ANO` standardını kullanır
- kök özet, test ve amaç endpointleri aynı kimlik sözlüğüne bağlı kalır

### `GET /api`
Amaç:
- API erişilebilirlik cevabı
- önerilen test yolları
- kök özet

Alanlar:
- `mesaj`
- `durum`
- `onerilenTestYollari`
- `ozet`

### `GET /api/test/calisiyor`
Amaç:
- worker cevap veriyor mu

Alanlar:
- `calisiyor: true`
- `durum: "ok"`
- `mesaj`
- `worker: "ANO"`

### `GET /api/test/saglik`
Amaç:
- `me`
- `me.puter`
- `globalThis.me`
- `kv`
- temel KV metotları
  kontrol etmek

Önemli alanlar:
- `worker: "ANO"`
- `durum: "ok" | "uyari"`
- `kontroller.handlerMe`
- `kontroller.handlerMePuter`
- `kontroller.globalMe`
- `kontroller.globalMePuter`
- `kontroller.mePuter`
- `kontroller.kvErisimiTanimli`
- `kontroller.mePuterKaynakTuru`
- `kontroller.kvTemelMetotlari.get`
- `kontroller.kvTemelMetotlari.set`
- `kontroller.kvTemelMetotlari.del`

### `GET /api/test/me-puter`
Amaç:
- gerçek KV roundtrip testi

Akış:
1. key üret
2. set
3. get
4. del
5. eşleşme doğrula

Başarı veri:
- `durum`
- `mesaj`
- `mePuter`
- `kvErisimiTanimli`
- `kvGercekTest`
- `deneme`
- `zamanDamgasi`
- `worker: "ANO"`

### `GET /api/amac`
Amaç:
- 20 maddelik amaç listesi döndürmek

Başlık:
- `ANO Puter Worker amaci`

## 6.17 ANO tam fonksiyon envanteri

### Çekirdek HTTP
- `corsBasliklariniHazirla`
- `jsonBasliklariniHazirla`
- `basariCevabiUret`
- `hataCevabiUret`
- `secenekIsteginiYanitla`
- `govdeyiCozumle`

### Yardımcılar
- `metniKirp`
- `sayiDonustur`
- `dakikayiDamgala`
- `saniyeDamgasiAl`
- `anahtariOlustur`
- `diziMi`
- `nesneMi`
- `bosMu`

### Ayar / kimlik / yetki
- `ayarlariGetir`
- `ayarlariKaydet`
- `ayarlariDisariHazirla`
- `istemciKimliginiCikar`
- `yoneticiAnahtariVarMi`
- `yoneticiYetkisiniDogrula`

### Doğrulama
- `rolGecerliMi`
- `yaziIceriginiTopla`
- `mesajIceriginiDogrula`
- `sohbetGovdesiniDogrula`
- `gorselGovdesiniDogrula`
- `ayarGirdisiniDogrula`
- `ortakDurumGovdesiniDogrula`
- `onbellekSilGovdesiniDogrula`

### KV / durum
- `ortakDurumuOku`
- `ortakDurumuYaz`
- `istekSiniriniKontrolEt`

### AI / çıktı
- `sohbetSecenekleriniHazirla`
- `sohbetYanitiniMetneDonustur`
- `gorselCiktisiniCozumle`
- `sohbetiCalistir`

### Hata / log / akış
- `guvenliHataMesajiAl`
- `guvenliLogYaz`
- `sseSatiriUret`
- `akisDestegiVarMi`
- `akisYanitiUret`

### Özet
- `tumOzetiOlustur`

---

# 7) BABO — TAM DAVRANIŞ SÖZLEŞMESİ

## 7.1 Sabitler

### Dosya adı
- `DOSYA_ADI = "babo.js"`

### Sürüm
- `SURUM = "2026-03-18.1"`

### Depo ön eki
- `DEPO_ONEKI = "aaoit"`
- env karşılığı: `BABO_REPO_PREFIX`

### Varsayılan timeout değerleri
- `CHAT = 45000`
- `IMG = 60000`
- `VIDEO = 120000`
- `TTS = 45000`
- `OCR = 45000`
- `PDF = 90000`
- `DEEPSEARCH = 120000`
- `TESHIS = 20000`

### Hizmet yetkinlikleri
- `CHAT -> ai.chat`
- `IMG -> ai.txt2img`
- `VIDEO -> ai.txt2vid`
- `TTS -> ai.txt2speech`
- `OCR -> ai.img2txt`
- `PDF -> []`
- `DEEPSEARCH -> ai.chat`

## 7.2 BABO route listesi

### Kök
- `GET /`
- `GET /tumu`

### Durum / panel
- `GET /api/durum`
- `GET /api/panel`

### İş izleme
- `GET /api/is/:isKimligi`
- `GET /api/is/:isKimligi/gecmis`
- `GET /api/is/:isKimligi/arsiv`
- `GET /api/is/:isKimligi/izle`

### Yürütme
- `POST /api/calistir`

### Teşhis
- `POST /api/teshis`
- `GET /api/teshis/:hizmetTuru`
- `GET /api/saglayici/:hizmetTuru/:saglayici`
- `GET /api/ispat/ozet`

### Preflight
- `OPTIONS /*yol`

## 7.3 BABO gövde parse davranışı

Fonksiyon: `govdeyiCozumle(request)`

BABO şu içerik tiplerini parse eder:
- `application/json`
- `application/x-www-form-urlencoded`
- `multipart/form-data`

Kurallar:
- JSON parse hatası → `null`
- form parse hatası → `null`
- bilinmeyen içerik tipi → `{}`

Önemli fark:
- BABO, ANO’dan farklı olarak form verisini de parse eder.

## 7.4 BABO hizmet türleri

Desteklenen tipler:
- `CHAT`
- `IMG`
- `VIDEO`
- `TTS`
- `OCR`
- `PDF`
- `DEEPSEARCH`

## 7.5 BABO hizmet türü çözümleme mantığı

Fonksiyon: `hizmetTurunuCozumle(girdi)`

Öncelik:
1. `serviceType`
2. `hizmetTuru`
3. `tip`

Sezgisel çözümleme:
- `mesajlar` / `systemPrompt` / `webArama` → `CHAT`
- `gorselUrl` / `gorselVerisi` / `referansGorsel` / `/gorsel` → `IMG`
- `videoUrl` / `sureSaniye` / `/video` → `VIDEO`
- `ses` / `voice` / `sesFormati` / `/ses` → `TTS`
- `.pdf` / pdf mime / `sayfalar` / `pdf` → `PDF`
- image mime / `ocr` / `/ocr` → `OCR`
- `sorgu` / `altSorgular` / `derinlik` / `/ara` / `/deepsearch` → `DEEPSEARCH`
- aksi halde → `CHAT`

Ek:
- geçersiz açık tip verilirse yine `CHAT`

## 7.6 BABO girdi doğrulama kuralları

Fonksiyon: `guvenliGirdiDogrula(girdi, hizmetTuru)`

### Ortak kurallar
- geçerli JSON nesnesi olmalı
- riskli URL şemaları engellenir:
  - `javascript:`
  - `data:`
- yasak mime:
  - `application/x-msdownload`

### CHAT
- `mesajlar` veya `prompt` zorunlu
- `prompt` varsa tek user mesaja çevrilir
- en fazla `60` mesaj
- toplam metin max `50000`
- roller:
  - `system`
  - `assistant`
  - `user`
  - `tool`
- normalize:
  - `mesajlar`
  - `maxTokens` → `1–8000`, varsayılan `1200`
  - `sicaklik` → `0–2`, varsayılan `0.7`
  - `webArama`
  - `model`

### IMG
- `prompt` zorunlu
- prompt max `2500`
- `adet` → `1–4`
- `oran` varsayılan `1:1`
- `kalite` varsayılan `medium`
- `stil`
- `referansGorsel`

### VIDEO
- `prompt` zorunlu
- `sureSaniye` → `1–120`, varsayılan `8`
- `oran` varsayılan `16:9`
- `kalite` varsayılan `medium`
- `referansKareler`
- `testModu`

### TTS
- `metin` zorunlu
- metin max `12000`
- `ses` varsayılan `Joanna`
- `dil` varsayılan `tr-TR`
- `hiz` → `0.5–2`
- `format` varsayılan `mp3`

### OCR
- `gorselUrl` veya `gorselListesi` zorunlu
- `sayfaSayisi` → `1–500`
- `dil` varsayılan `tr`
- `kirpmaAlani`

### PDF
- en az biri zorunlu:
  - `dosyaUrl`
  - `metin`
  - `sayfalar`
- `sayfaSayisi` → `1–1000`
- `ocrGereksinimi`
- `ozetIsteniyor` varsayılan true

### DEEPSEARCH
- `sorgu` zorunlu
- sorgu max `3000`
- `altSorguSiniri` → `1–20`, varsayılan `4`
- `hizliMod` varsayılan true
- `kaynakOnceligi` varsayılan `["web","yazi","rapor"]`
- `ozetle` varsayılan true

## 7.7 BABO etkin ayar üretme mantığı

Fonksiyon: `etkinAyariOlustur(...)`

Header override’ları:
- `x-kalite-seviyesi`
- `x-timeout-ms`
- `x-saglayici`

### Varsayılan modeller
- CHAT → `gpt-5-nano`
- IMG → `gpt-image-1-mini`
- VIDEO → `runway`
- TTS → `openai-tts`
- OCR → `aws-textract`
- PDF → `belge-orkestrasi`
- DEEPSEARCH → `switchpoint/router`

### Varsayılan sağlayıcılar
- CHAT → `auto`
- IMG → `openai-image-generation`
- VIDEO → `auto`
- TTS → `auto`
- OCR → `auto`
- PDF → `internal`
- DEEPSEARCH → `auto`

### Normalize edilen ayarlar
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

### Varsayılan fallback zinciri
Fallback boşsa:
```json
["auto", "yedek", "guvenli-donus"]
```

### Güvenlik etkileri
- yasaklı sağlayıcı seçilmişse → `auto`
- timeout `azamiTimeoutMs` üstündeyse kırpılır
- kalite seviyesi izinli listede yoksa ilk izinli değere çekilir

## 7.8 BABO tahmini maliyet mantığı

Fonksiyon: `tahminiMaliyetHesapla(hizmetTuru, girdi, etkinAyar)`

Temel formüller:
- CHAT → `0.000002 * max(uzunluk, 50)`
- IMG → `0.01 * adet`
- VIDEO → `0.02 * sureSaniye`
- TTS → `0.000003 * max(uzunluk, 100)`
- OCR → `0.002 * sayfaSayisi`
- PDF → `0.003 * sayfaSayisi`
- DEEPSEARCH → `0.004 * altSorguSiniri`

Ek:
- `kaliteSeviyesi === "high"` ise sonuç `1.35` ile çarpılır

Çıktı:
- `Number(...toFixed(6))`

## 7.9 BABO sağlayıcı skor mantığı

Fonksiyon: `agirlikliSkorHesapla(veri)`

Formül:
- kalite → `%45`
- hız → `%25`
- maliyetin tersi → `%20`
- hatanın tersi → `%10`

Pratikte:
```txt
(kalite * 0.45) + (hiz * 0.25) + ((100 - maliyet) * 0.2) + ((100 - hata) * 0.1)
```

## 7.10 BABO benzersiz imza ve olay kimliği

### `benzersizImzaUret(metin)`
- karakter kodu tabanlı modlu toplam üretir
- çıktı biçimi:
  - `imza_<sayi>`

### `olayKimligiUret(onek, baglam)`
Parçalar:
- `onek`
- zaman damgası
- rastgele parça
- bağlam imzası

Biçim:
```txt
<onek>_<time36>_<random>_<context>
```

## 7.11 BABO bağlam hazırlama

Fonksiyon: `istekBaglaminiHazirla(istek, girdi, hizmetTuru)`

Çıkan alanlar:
- `isKimligi`
- `olayKimligi`
- `kullaniciKimligi`
- `hizmetTuru`
- `baslangicZamani`
- `zamanDamgasi`
- `korelasyonAnahtari`
- `islemDurumu`
- `tanilama.userAgent`
- `tanilama.kaynak`

Korelasyon sırası:
1. `x-korelasyon-anahtari`
2. `x-request-id`
3. yoksa otomatik üretilir

Kullanıcı kimliği sırası:
1. `girdi.kullaniciKimligi`
2. `x-istemci-kimligi`
3. fallback: `anonim`

## 7.12 BABO hata sınıfları

Fonksiyon: `hataSinifiniBelirle(hata, ekBaglam)`

Sınıflar:
- `zaman_asimi_hatasi`
- `kota_hatasi`
- `yetki_hatasi`
- `ag_hatasi`
- `dogrulama_hatasi`
- `veri_bicimi_hatasi`
- `saglayici_hatasi`
- `bilinmeyen_hata`

Kritik sayılan:
- `yetki_hatasi`

## 7.13 BABO güvenli hata özeti

Fonksiyon: `guvenliHataOzetiUret(hata, gorunumDuzeyi)`

### Düzeyler
- `kullanici`
- `panel`
- `gelistirici`

### Panel görünümü
- mesaj: `İşlem tamamlanamadı.`
- ayrıntı: max `180`

### Geliştirici görünümü
- mesaj: max `240`
- ayrıntı:
  - `sinif`
  - `kritikMi`

### Özel kullanıcı mesajları
- doğrulama → ham mesajın kısaltılmış hali
- zaman aşımı → `İşlem zaman aşımına uğradı.`
- kota → `Kota veya oran sınırı nedeniyle işlem durdu.`

## 7.14 BABO yeniden deneme kuralları

Fonksiyon: `yenidenDenemeKarariniVer(...)`

### Yeniden deneme yapılabilir
- `ag_hatasi`
- `zaman_asimi_hatasi`
- `saglayici_hatasi` ve hizmet PDF değilse
- `kota_hatasi`

### Yeniden deneme nedenleri
- `gecici_hata`
- `saglayici_kararsizligi`
- `yedek_saglayici_icin_tekrar`

### Durdurma nedenleri
- `azami_denemeye_ulasti`
- `yeniden_deneme_gereksiz`

### Üst sınır
- `denemeSiniri`

## 7.15 BABO işlem metaverisi

Fonksiyon: `islemMetaverisiniHazirla(...)`

Alanlar:
- `isKimligi`
- `korelasyonAnahtari`
- `hizmetTuru`
- `saglayici`
- `model`
- `retrySayisi`
- `fallbackBilgisi`
- `sureMs`
- `maliyet`
- `teshisIsaretleri`

## 7.16 BABO hizmet yetkinliği

Fonksiyon: `hizmetYetkinliginiKontrolEt(me, etkinAyar, hizmetTuru)`

Kural:
- gerekli `me.puter` metotları tek tek aranır

İstisna:
- `PDF`
- `DEEPSEARCH`

Bu iki tipte eksik metot olsa bile sonuç:
- `etkinMi: true`
- açıklama: orkestrasyon / birleşik akış desteği

## 7.17 BABO kalite puanlama

Fonksiyon: `sonucKalitesiniPuanla(hizmetTuru, sonuc, baglam)`

Başlangıç puanı:
- `55`

Artış örnekleri:
- CHAT → metin uzunluğuna göre +25’e kadar
- CHAT içinde `kaynak` veya `özet` geçerse +8
- IMG URL/görsel varsa +28
- VIDEO jobId/url varsa +24
- TTS url/veri varsa +22
- OCR metin uzunluğuna göre +30’a kadar
- PDF özet/metin uzunluğuna göre +28’e kadar
- DEEPSEARCH kaynak sayısına göre +30’a kadar

Ceza:
- fallback kullanıldıysa `-5`
- hata varsa `-20`

Sonuç aralığı:
- `0–100`

## 7.18 BABO hizmete özel filtreler

Fonksiyon: `hizmeteOzelFiltreleriUygula(...)`

### IMG
- adet > 4 → ihlal
- oran `9:16` ve güvenlik modu `katı` ise → `1:1`

### VIDEO
- süre > 60 ve maliyet sınırı düşükse → ihlal

### TTS
- metin > 6000 ve kalite `high` ise → `medium`

### OCR
- tek işte max `100` sayfa

### PDF
- max `500` sayfa

### DEEPSEARCH
- `altSorguSiniri > 12` ve bütçe düşükse → `12`

## 7.19 BABO sağlayıcı istek gövdesi

Fonksiyon: `saglayiciIstekGovdesiHazirla(...)`

### CHAT
- `messages`
- `stream: false`
- `temperature`
- `max_tokens`
- `tools` (web search)

### IMG
- `prompt`
- `n`
- `ratio`
- `quality`
- `reference_image`

### VIDEO
- `prompt`
- `testMode`
- `options.duration`
- `options.ratio`
- `options.quality`
- `options.referenceFrames`

### TTS
- `text`
- `options.voice`
- `options.language`
- `options.speed`
- `options.format`

### OCR
- `image`
- `images`
- `options.language`
- `options.crop`

### PDF
- `documentUrl`
- `text`
- `pages`
- `options.pageCount`
- `options.forceOcr`
- `options.summarize`

### DEEPSEARCH
- `query`
- `options.depth`
- `options.fastMode`
- `options.sources`

## 7.20 BABO sağlayıcı yanıtı çözümleme

Fonksiyon: `saglayiciYanitiCozumle(...)`

### CHAT
Kaynaklar:
- string
- `message.content`
- `content`

Çıkan alan:
- `metin`

### IMG
Kaynaklar:
- string
- `url`
- `src`
- `images[]`

Çıkan alanlar:
- `url`
- `gorseller`

### VIDEO
Kaynaklar:
- `jobId + status`
- `url`
- string url
- hiçbir şey gelmezse fallback queued job

Çıkan alanlar:
- `jobId`
- `durum`
- `url`
- `senkronMu`

### TTS
- `url`
- string
- ham veri

### OCR
- string veya `text`

### PDF
- `metin`
- `ozet`
- `sayfalar`

### DEEPSEARCH
- `ozet`
- `kaynaklar`
- `altSorgular`

Ek:
- çözüm sonrası `maliyet = tahminiMaliyetHesapla(...)`

## 7.21 BABO asıl servis çağrıları

### `sohbetApiCagrisiniYurut`
- `ai.chat`
- `stream: false`
- tools varsa geçirir

### `gorselApiCagrisiniYurut`
- `ai.txt2img`
- `prompt / n / quality / ratio / reference_image`

### `videoApiCagrisiniYurut`
- `ai.txt2vid` varsa gerçek çağrı
- yoksa queued job fallback

### `seslendirmeApiCagrisiniYurut`
- `ai.txt2speech` varsa gerçek çağrı
- yoksa boş/plan çıktısı

### `ocrApiCagrisiniYurut`
- tek görsel ve çoklu görsel desteği
- her görseli `ai.img2txt` ile işler
- metinleri birleştirir

### `pdfApiCagrisiniYurut`
- sayfalar varsa OCR yapar
- metin yok ama dosyaUrl varsa placeholder metin üretir
- özet isteniyorsa `ai.chat` ile kısa özet çıkarır

### `derinAramaApiCagrisiniYurut`
- alt sorgu listesi üretir
- `ai.chat + web_search` ile araştırma özeti ister
- yapay kaynak özeti listesi üretir

## 7.22 BABO işçi seçimi

Fonksiyon: `uygunIsciyiSec(hizmetTuru, etkinAyar)`

### Varsayılanlar
- birincil = hizmetin kendisi
- yedek = çoğu durumda `CHAT`
- acil geri dönüş = çoğu durumda `CHAT`

### Özel eşlemeler
- IMG → yedek `CHAT`
- VIDEO → yedek `IMG`, acil `CHAT`
- OCR → yedek `PDF`, acil `CHAT`
- PDF → yedek `OCR`, acil `CHAT`
- DEEPSEARCH → yedek `CHAT`, acil `CHAT`

## 7.23 BABO sağlayıcı önceliği

Fonksiyon: `saglayiciOnceliginiBelirle(...)`

### Temel aday setleri
- CHAT / DEEPSEARCH → `[temel, openai, anthropic, google]`
- IMG → `[temel, openai-image-generation, gemini, xai]`
- VIDEO → `[temel, runway, google, openai]`
- TTS → `[temel, openai, aws, elevenlabs]`
- OCR → `[temel, aws, mistral]`
- PDF → `[temel, internal, aws, openai]`

### Ek davranış
- tekrarlar temizlenir
- geçmiş sağlayıcı hata sayısı depo üzerinden okunur
- her sağlayıcı için skor üretilir
- yüksek skordan düşüğe sıralanır

Çıktı:
- `siraliSaglayicilar`
- `skorlar`

## 7.24 BABO fallback zinciri

Fonksiyon: `fallbackZinciriniKur(...)`

Zincir türleri:
- `saglayici`
- `isci`
- `politika`

### Sağlayıcı adımları
Her aday için:
```json
{
  "tur": "saglayici",
  "hedef": "provider",
  "strateji": "birincil | yedek"
}
```

### Acil işçi fallback’i
Şu tiplerde ekstra eklenir:
- `VIDEO`
- `PDF`
- `DEEPSEARCH`

Ek adım:
```json
{
  "tur": "isci",
  "hedef": "CHAT",
  "strateji": "acil_geri_donus"
}
```

### Politika fallback’i
`etkinAyar.fallbackZinciri` içindeki her öğe:
```json
{
  "tur": "politika",
  "hedef": "<adim>",
  "strateji": "ozel_tanim"
}
```

## 7.25 BABO maliyet bütçesi

Fonksiyon: `maliyetButcesiniYonet(...)`

Alanlar:
- `tahminiMaliyet`
- `toplamMaliyet`
- `maliyetSiniri`
- `devamEdebilirMi`
- `isKimligi`

Aşılırsa hata:
```json
{
  "mesaj": "Maliyet bütçesi aşıldı.",
  "kod": "MALIYET_BUTCESI"
}
```

## 7.26 BABO timeout politikası

Fonksiyon: `zamanAsimiPolitikasiniUygula(...)`

Uygulama:
- `Promise.race`

Timeout hatası biçimi:
```txt
timeout:<TIP>:<timeoutMs>
```

## 7.27 BABO çok adımlı akışlar

Fonksiyon: `cokAdimliAkisiYonet(...)`

### PDF adımları
- `PDF_HAZIRLA`
- `OCR_GEREKIRSE`
- `OZETLE`

### DEEPSEARCH adımları
- `ARASTIR`
- `OZETLE`
- `TTS_SECENEGI`

### TTS seçeneği
- `normalizeGirdi.seslendir` varsa tetiklenir

## 7.28 BABO sonuç birleştirici

Fonksiyon: `sonucBirlestiriciyiCalistir(...)`

Ortak alanlar:
- `hizmetTuru`
- `parcaliSonuclar`
- `uyarilar`
- `kalitePuani`
- `toplamMaliyet`

Özel:
- CHAT → `birlesikMetin`
- PDF / DEEPSEARCH → `birlesikOzet`

## 7.29 BABO iptal / duraklat kararı

Fonksiyon: `iptalVeDuraklatmaKarariniVer(...)`

Kurallar:
- kullanıcı iptali → `iptal`
- bütçe aşımı → `iptal`
- yetki hatası → `iptal`
- zaman aşımı → `duraklat`
- aksi → `devam`

## 7.30 BABO iş yaşam döngüsü

### Başlat
Fonksiyon: `isKaydiBaslat`

Kayıt alanları:
- `isKimligi`
- `hizmetTuru`
- `kullaniciKimligi`
- `baslangicZamani`
- `durum: basladi`
- `saglayiciPlani`
- `istekOzeti.imza`
- `istekOzeti.kisa`

### Güncelle
Fonksiyon: `isDurumunuGuncelle`

Alanlar:
- `durum`
- `sonGuncelleme`
- `yuzde`
- `aktifAdim`
- `sonMesaj`
- `saglayici`
- `hataOzeti`

### Geçmiş
Fonksiyon: `isGecmisineKaydet`

Alanlar:
- `olayKimligi`
- `olay`
- `veri`
- `zamanDamgasi`

Sınır:
- son `200` kayıt tutulur

### Özet
Fonksiyon: `isDurumuOzetiUret`

Alanlar:
- `isKimligi`
- `durum`
- `yuzde`
- `aktifAdim`
- `sonHata`
- `tahminiBitis`
- `sonGuncelleme`

Panel modunda:
- `kisaMetin`

### Kuyruktaki iş izleme
Fonksiyon: `kuyruktaBekleyenIsiIzle`

Kurallar:
- durum `queued` veya `kuyrukta` ise
- `isleniyor` yapılır
- yüzde en az `10`
- aktif adım varsayılan `sağlayıcı durum sorgusu`

### Arşiv
Fonksiyon: `gecmisVeSonucArsiviniHazirla`

Alanlar:
- `isKimligi`
- `durum`
- `baslangicZamani`
- `bitisZamani`
- `hizmetTuru`
- `sonMesaj`
- `sonuc`
- `gecmis` → son `50` kayıt

## 7.31 BABO sağlık ve teşhis

### `sistemSaglikTaramasiYap`
Başlangıç puanı:
- `100`

Kesintiler:
- router yoksa `-25`
- me.puter yoksa `-35`
- her eksik kritik AI metodunda `-6`
- KV testi başarısızsa `-20`

Kontrol edilen AI yolları:
- `ai.chat`
- `ai.txt2img`
- `ai.txt2vid`
- `ai.txt2speech`
- `ai.img2txt`

### `hizmetBazliTeshisYap`
Örnek testler:
- `chat_yetkinlik`
- `img_yetkinlik`
- `video_yetkinlik`
- `pdf_orkestra`
- `genel`

### `saglayiciErisimTestiYap`
Belirli hizmet için gerekli me.puter metodunu doğrular.

### `kvVeDurumDeposuTestiYap`
- yaz
- oku
- sil
  zinciri

### `fallbackMekanizmasiniSinamaYap`
- zincir üretir
- yeniden deneme kararı örnekler

### `gecikmeVeSureAnaliziYap`
- adım sürelerini hesaplar
- ortalama süre
- timeout riski:
  - `dusuk`
  - `orta`
  - `yuksek`

### `maliyetSapmasiniAnalizEt`
- tahmini maliyet
- gerçek maliyet
- sapma
- sapma oranı
- risk

### `tanisalRaporUret`
- `sorunlar`
- `oneriler`
- `ozet`
- `saglikPuani`

Panel modunda:
- kartlar:
  - Sağlık
  - Sorun
  - Öneri

### `panelIcinKisaDurumHazirla`
Alanlar:
- `aktifIsSayisi`
- `sonHata`
- `genelSaglikPuani`
- `durum`
  - `iyi`
  - `izlenmeli`
  - `kritik`

## 7.32 BABO ana orkestrasyon akışı

Fonksiyon: `tumSistemiKoordineEt(me, request, girdi)`

Sıra:
1. hizmet türünü çöz
2. bağlam hazırla
3. varsayılan ayarları belirle
4. girdi doğrula
5. etkin ayarı üret
6. hizmet yetkinliğini kontrol et
7. iş kaydı başlat
8. geçmişe `is_basladi` yaz
9. durumu `hazirlaniyor` yap
10. orkestra planı üret
11. durumu `isleniyor` yap
12. ana işlemi başlat
13. timeout uygula
14. hata olursa sınıflandır + yeniden deneme kararı ver
15. geçmişe hata yaz
16. gerekirse `yeniden_denemede`
17. son başarıda `tamamlandi`
18. geçmişe kalite kaydı yaz
19. sonuçları birleştir
20. arşive yaz
21. nihai cevap döndür

### İlk durum güncellemesi
- `%5`
- aktif adım: `doğrulama`

### İşçi seçimi sonrası
- `%20`
- aktif adım: `işçi seçimi`

### Yeniden deneme
- `%20 + deneme*10`, max `60`

### Tamamlanma
- `%100`
- aktif adım: `tamamlandı`

## 7.33 BABO root endpointleri

### `GET /`
### `GET /tumu`
Amaç:
- AIAI sınıf özeti vermek
- gerçek iş çalıştırmak değil

Alanlar:
- `dosya`
- `mesaj`
- `format: AIAI`
- `sinifSayisi: 4`
- `siniflar`
- `sinifDisiOrtaklar`
- `zamanDamgasi`
- `worker: "BABO"`

### AIAI sınıfları
1. `SINIF-1` → API ÇAĞIRAN İŞÇİLER
2. `SINIF-3` → ORKESTRA ŞEFİ
3. `SINIF-4` → İŞ TAKİP UZMANI
4. `SINIF-5` → TEST DEDEKTİFİ

## 7.34 BABO route sözleşmeleri

### `GET /api/durum`
Alanlar:
- `worker: "BABO"`
- `surum: SURUM`
- `durum: hazir | uyari`
- `saglik`

### `GET /api/panel`
Alanlar:
- `aktifIsSayisi`
- `sonHata`
- `genelSaglikPuani`
- `durum`

### `GET /api/is/:isKimligi`
Alanlar:
- iş özeti

### `GET /api/is/:isKimligi/gecmis`
Alanlar:
- `isKimligi`
- `gecmis`

### `GET /api/is/:isKimligi/arsiv`
Alanlar:
- `isKimligi`
- `arsiv`

### `GET /api/is/:isKimligi/izle`
- kuyrukta iş varsa canlı güncelleyebilir

### `POST /api/calistir`
Geçersiz JSON:
- `400`
- `teshis: json`

Başarılı koordinasyon:
- `200`

Koordinasyon hatası:
- `400`

Beklenmeyen runtime hatası:
- `500`
- `teshis: api/calistir`

### `POST /api/teshis`
Üretilen bloklar:
- `saglik`
- `hizmet`
- `saglayici`
- `kv`
- `fallback`
- `rapor`

### `GET /api/teshis/:hizmetTuru`
- tek hizmet teşhisi

### `GET /api/saglayici/:hizmetTuru/:saglayici`
- erişim başarısızsa `503`

### `GET /api/ispat/ozet`
- sağlık + panel özeti

## 7.35 BABO tam fonksiyon envanteri

### HTTP / cevap çekirdeği
- `corsBasliklariniHazirla`
- `jsonBasliklariniHazirla`
- `yanitDondur`
- `basariCevabiUret`
- `hataCevabiUret`
- `secenekIsteginiYanitla`
- `standartCevapGovdesiOlustur`

### Parse / tip / yardımcılar
- `govdeyiCozumle`
- `nesneMi`
- `diziMi`
- `metniKirp`
- `sayiDonustur`
- `metniDiziyeCevir`
- `kopyaOlustur`
- `simdiIso`
- `sayiDamgasiAl`
- `anahtarBirlestir`
- `dakikaPenceresiDamgasiAl`
- `saniyeDamgasiAl`

### Runtime / KV / metod erişimi
- `calisanMePuteriniAl`
- `guvenliLogYaz`
- `depoAnahtariUret`
- `depodanOku`
- `depoyaYaz`
- `depodanSil`
- `mePuterMetodunuAl`
- `mePuterMetodunuCalistir`

### Maliyet / skor / kimlik
- `tahminiMaliyetHesapla`
- `agirlikliSkorHesapla`
- `benzersizImzaUret`
- `olayKimligiUret`

### Bağlam / çözümleme / doğrulama
- `istekBaglaminiHazirla`
- `hizmetTurunuCozumle`
- `guvenliGirdiDogrula`
- `etkinAyariOlustur`
- `hataSinifiniBelirle`
- `guvenliHataOzetiUret`
- `yenidenDenemeKarariniVer`
- `islemMetaverisiniHazirla`
- `hizmetYetkinliginiKontrolEt`
- `sonucKalitesiniPuanla`
- `hizmeteOzelFiltreleriUygula`

### Sağlayıcı sözleşmesi
- `saglayiciIstekGovdesiHazirla`
- `saglayiciYanitiCozumle`

### Hizmet çağrıları
- `sohbetApiCagrisiniYurut`
- `gorselApiCagrisiniYurut`
- `videoApiCagrisiniYurut`
- `seslendirmeApiCagrisiniYurut`
- `ocrApiCagrisiniYurut`
- `pdfApiCagrisiniYurut`
- `derinAramaApiCagrisiniYurut`

### Orkestrasyon
- `uygunIsciyiSec`
- `saglayiciOnceliginiBelirle`
- `fallbackZinciriniKur`
- `maliyetButcesiniYonet`
- `zamanAsimiPolitikasiniUygula`
- `cokAdimliAkisiYonet`
- `sonucBirlestiriciyiCalistir`
- `iptalVeDuraklatmaKarariniVer`
- `orkestrayiBaslat`
- `tumSistemiKoordineEt`

### İş takibi
- `isKaydiBaslat`
- `isDurumunuGuncelle`
- `isGecmisineKaydet`
- `isDurumuOzetiUret`
- `kuyruktaBekleyenIsiIzle`
- `gecmisVeSonucArsiviniHazirla`

### Teşhis / panel
- `sistemSaglikTaramasiYap`
- `hizmetBazliTeshisYap`
- `saglayiciErisimTestiYap`
- `kvVeDurumDeposuTestiYap`
- `fallbackMekanizmasiniSinamaYap`
- `gecikmeVeSureAnaliziYap`
- `maliyetSapmasiniAnalizEt`
- `tanisalRaporUret`
- `panelIcinKisaDurumHazirla`

### AIAI kök özet
- `aiaiSinifGorevOzetiniOlustur`
- `kokEndpointAiaiTumuCevabiniUret`
- `kokEndpointiTumuGibiCalistir`
- `ispatOzetiHazirla`

---

# 8) ENV SÖZLÜĞÜ

README ile JS aynı sözlüğü kullanmalıdır.
Aşağıdaki env alanları öneri değil, sözleşme katmanıdır:

```env
ANO_ADMIN_SECRET=
ANO_SETTINGS_KEY=uygulama:ayarlar
ANO_SHARED_STATE_KEY=ortakveri:durum
ANO_CACHE_PREFIX=onbellek
ANO_RATE_PREFIX=oran
ANO_TEST_KEY_PREFIX=ano:test:meputer
ANO_PUBLIC_NAME=ano
ANO_DISPLAY_NAME=ANO
ANO_ROLE_NAME=uygulama servis workerı
ANO_META_NAME=ANO
ANO_HEALTH_WORKER_NAME=ANO
ANO_ALLOWED_ORIGIN=

BABO_PUBLIC_NAME=babo
BABO_DISPLAY_NAME=BABO
BABO_ROLE_NAME=orkestrasyon workerı
BABO_INTERNAL_FILE_NAME=babo
BABO_META_NAME=BABO
BABO_HEALTH_WORKER_NAME=BABO
BABO_REPO_PREFIX=aaoit
BABO_ALLOWED_ORIGIN=
BABO_DEFAULT_TIMEOUT_CHAT=45000
BABO_DEFAULT_TIMEOUT_IMG=60000
BABO_DEFAULT_TIMEOUT_VIDEO=120000
BABO_DEFAULT_TIMEOUT_TTS=45000
BABO_DEFAULT_TIMEOUT_OCR=45000
BABO_DEFAULT_TIMEOUT_PDF=90000
BABO_DEFAULT_TIMEOUT_DEEPSEARCH=120000
```

### Secret üretim notu
Secret değerleri güçlü, okunabilir ve tahmin edilmesi zor olmalıdır.
Başlangıç kuralı:
- `Nisa` ile başlamalı
- okunabilir ama güçlü olmalı
- gerekiyorsa birden fazla alternatif üretilmeli

### Örnek güçlü secret
```env
ANO_ADMIN_SECRET=Nisa.Salih_2026+Salih!Muzeyyen#Nihal.mert
```

---

# 9) GÜVENLİ GEÇİŞ STRATEJİSİ

İsim dönüşümü yapılırken aşağıdaki sıra zorunludur:
1. Kodda önceki worker kimliklerini tam tara.
2. Kullanım türüne göre sınıflandır:
   - worker kimliği
   - dosya/meta kimliği
   - test anahtarı
   - KV anahtarı
   - log etiketi
   - README açıklaması
   - response alanı
   - comment/metin
3. README’yi yeni sözlüğe göre güncelle.
4. Env sözlüğünü yeni isimlerle oluştur.
5. Önce iç raporlanan kimlikleri düzelt.
6. Sonra response/meta/log alanlarını düzelt.
7. Sonra test/sağlık endpointlerini düzelt.
8. Sonra KV/test prefix’lerini tutarlı hale getir.
9. Sonra tekrar tarama yap.
10. Nihai çıktıda yalnız ANO ve BABO kaldığını doğrula.

### Yarım migration neden tehlikelidir?
- response ve meta farklı isim döndürebilir
- panel ve log katmanı ayrışabilir
- test endpointleri eski sabitlere bakabilir
- KV prefix ve test anahtarı farklı sözlükte kalabilir
- README ile JS birbirinden kopabilir

### Tam replace zorunlu alanlar
- response worker alanları
- meta dosya alanları
- sağlık/test çıktıları
- amaç ve kök özet metinleri
- log etiketleri
- test anahtarı prefix’leri
- env örnekleri
- README örnek JSON blokları

---

# 10) ANO + BABO ARASINDAKİ ORTAK VE FARKLI YERLER

## 10.1 Ortaklar
- CORS
- JSON response altyapısı
- güvenli log mantığı
- body parse
- sayı ve metin yardımcıları
- `diziMi`
- `nesneMi`
- `saniyeDamgasiAl`

## 10.2 Farklılıklar
- ANO sade API worker’dır
- BABO meta’lı orkestratördür
- ANO admin korumalı ayar / durum / cache işlemleri yapar
- BABO iş kaydı / teşhis / maliyet / fallback yönetir
- ANO SSE kullanır
- BABO job-tracking kullanır
- ANO yalnız JSON parse eder
- BABO form-data da parse eder

---

# 11) BİREBİR KOPYALANMASI GEREKMEYEN YERLER

Aşağıdakiler birebir aynı olmak zorunda değildir:
- iç kod sırası
- yardımcı fonksiyonların iç implementasyon stili
- log metinlerinin birebir yazımı
- küçük refactor kararları

Ama aşağıdakiler korunmalıdır:
- tüm route path’leri
- request alanları
- response gövdeleri
- ANO admin kuralları
- ANO cache prefix’leri
- ANO rate limit sayıları
- ANO SSE event adları
- BABO meta alanları
- BABO timeout değerleri
- BABO hizmet tipleri
- BABO provider / fallback / retry / maliyet kararları
- BABO depo anahtar biçimleri
- BABO iş yaşam döngüsü

---

# 12) CONTRACT TEST LİSTESİ

## 12.1 ANO testleri
1. `GET /api/durum` → `200`
2. `GET /api/modeller` → filtreleme ve `sinir`
3. `POST /api/sohbet` geçerli body → `200`
4. `POST /api/sohbet` bozuk JSON → `400`
5. `POST /api/sohbet` eksik model → `400`
6. `POST /api/sohbet/akis` → `hazir/parca/bitti`
7. SSE yoksa → `akisaUygunOrtam: false`
8. `POST /api/gorsel` eksik prompt → `400`
9. `GET /api/ayarlar/getir` → gizli yönetici alanı görünmez
10. ilk kurulum kısa admin anahtarı → `400`
11. yanlış admin ile ayar kaydetme → `403`
12. `POST /api/ortak-durum/yaz` yanlış admin → `403`
13. `POST /api/onbellek/sil` yanlış prefix → `400`
14. `GET /api/test/saglik` → KV metot alanları görünür
15. `GET /api/test/me-puter` → gerçek KV set/get/del
16. tüm sağlık ve test çıktıları `ANO` kimliğini döndürür

## 12.2 BABO testleri
1. `POST /api/calistir` CHAT → `200`
2. `POST /api/calistir` JSON bozuk → `400`
3. `POST /api/calistir` form-data parse → çalışmalı
4. serviceType yok ama prompt var → doğru tip çözülmeli
5. riskli URL → `DOGRULAMA_HATASI`
6. yasak mime → hata
7. timeout simülasyonu → `zaman_asimi_hatasi`
8. quota simülasyonu → retry/fallback kararı
9. `GET /api/is/:id` → iş özeti
10. `GET /api/is/:id/gecmis` → olay listesi
11. `GET /api/is/:id/arsiv` → arşiv
12. `GET /api/is/:id/izle` → queued → isleniyor dönüşümü
13. `POST /api/teshis` → çoklu rapor
14. `GET /api/saglayici/:hizmetTuru/:saglayici` başarısız erişim → `503`
15. `GET /api/ispat/ozet` → sağlık + panel
16. meta ve panel cevapları yalnız `BABO` kimliğini döndürür

---

# 13) BAŞKA BİR AI’A DOĞRUDAN VERİLECEK TALİMAT

> ANO ve BABO isminde iki Puter Worker yeniden uygula. Route adlarını, request/response sözleşmelerini, ANO admin korumasını, ANO rate-limit sayılarını, ANO cache/KV anahtarlarını, ANO SSE event adlarını, BABO meta yapısını, BABO hizmet türü çözümleme mantığını, BABO timeout/retry/fallback/maliyet/job-tracking/diagnostic akışını bu README ile birebir uyumlu koru. İç kod aynı olmak zorunda değil; dış davranış aynı olmalı. Önce route iskeletini kur, sonra response sözleşmesini oturt, sonra doğrulama/güvenlik/KV/AI entegrasyonu/iş kaydı/teşhis katmanlarını ekle. Son aşamada contract test ile doğrula.

---

# 14) SON KARAR

Bu README ile:
- kaynak kod görülmeden bile
- ANO ve BABO davranışı
- route, response, KV, admin, SSE, timeout, fallback, maliyet, iş takibi ve teşhis düzeyinde
- yüksek doğrulukta yeniden kodlanabilir.

Kalan son doğrulama için:
- canlı endpoint doğrulaması
- contract test
- response karşılaştırması
  önerilir.

---

# 15) TEK CÜMLELİK ÖZET

Bu README, ANO’yu uygulama servis worker’ı, BABO’yu AI orkestrasyon worker’ı olarak tanımlayan; route, response, güvenlik, KV, SSE, timeout, retry, fallback, maliyet, iş takibi ve teşhis davranışlarını tek isim standardına bağlayan ana teknik belgedir.
