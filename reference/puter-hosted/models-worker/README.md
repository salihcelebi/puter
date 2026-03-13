# models-worker.js
`models-worker.js`
  - görev: Worker
  - aktif deploy URL: `https://models-worker.puter.work`
- Bu dosya aktif deploy dosyasıdır.
- GitHub tarafındaki kopya sadece referans içindir; deploy olan yer GitHub değildir.
## Kimlik Bilgisi

- **Dosya adı:** `models-worker.js`
- **Görev:** Worker
- **Dosya yolu / URL:** `https://models-worker.puter.work`

## Temel Tanım

Bu dosya, Puter Hosting üzerinde barındırılan `models-worker` kodunun **içerik bakımından birebir referans kopyasıdır**.  
**Aktif deploy dosyası değildir** ve üretimde doğrudan çalıştırılmaz.

## Amaç

Bu dosyanın amacı:

- model kataloğunu açıklamak,
- belgelemek,
- Codex talimatlarında güvenilir referans göstermek,
- teknik anlamı tek yerde toplamak,
- model kataloğunun yapısını,
- model alanlarını,
- fiyat alanlarını,
- hız bilgilerini,
- filtreleri,
- sıralama mantığını,
- API yüzeyini açıklamaktır.

## Kapsam

- Modeller bu dosya içinde **statik olarak tanımlanır**.
- Katalog verisi **harici dosyadan okunmaz**.
- Katalog verisi **harici Excel okumasına dayanmaz**.
- Tüm model kayıtları doğrudan kaynak kod içindeki `RAW_MODELS` dizisinde bulunur.

## İçerik

Bu dosyada tek JSON benzeri veri kümesi içinde şu model türleri bulunur:

- chat
- multimodal
- reasoning
- coding
- görsel / image generation
- search / arama
- safety / güvenlik
- audio / ses

## Model Alanları

Her model kaydında şu alanlar bulunur:

- `company`
- `provider`
- `modelName`
- `modelId`
- `categoryRaw`
- `badges`
- `parameters`
- `speedLabel`
- `prices`
- `traits`
- `standoutFeature`
- `useCase`
- `rivalAdvantage`
- `sourceUrl`
- `style`

### Alan Açıklamaları

- `company`, `provider`, `modelName`, `modelId`: sağlayıcı, görünen ad ve teknik kimliği tutar.
- `categoryRaw`: modelin ana sınıfını belirtir.
- `badges`: hızlı etiketleme sağlar.
- `parameters`: yaklaşık model boyutunu veya kullanılan mimari tipini insan okunur biçimde özetler.
- `speedLabel`: hız sınıfını taşır.
- `prices`: fiyat bilgisini tutar.
- `traits`: her model için en fazla beş kısa özellik taşır.
- `standoutFeature`: modelin ayırt edici gücünü tek cümlede açıklar.
- `useCase` ve `rivalAdvantage`: bağlamı tamamlar.
- `sourceUrl`: katalog bilgisinin bağlı olduğu kaynak bağlantıyı saklar.
- `style`: üretim prompt stili değil, model kartının görsel kimliğini belirleyen alanıdır.

## Kategori ve Etiketleme

### categoryRaw türleri

- chat
- multimodal
- reasoning
- coding
- görsel
- arama
- güvenlik
- ses

### badges değerleri

- `CHAT`
- `MULTIMODAL`
- `REASONING`
- `CODING`
- `GÖRSEL`
- `ARAMA`
- `AGENTIC`
- `GÜVENLİK`
- `SES`

## Hız Bilgisi

- `speedLabel` alanı hız sınıfını taşır.
- `SPEED_SCORE_MAP`, bu yazıları otomatik olarak sayısal `speedScore` değerine dönüştürür.

## Fiyat Yapısı

Fiyat bilgisi `prices` alanı altında tutulur:

- `input`
- `output`
- `image`

Uygun olmayan fiyat alanları `null` kalır.

## Style Notu

- `style` alanı **prompt stili değildir**.
- Bu alan, model kartı / arayüz teması için `brandKey` ve `accent` bilgisini taşır.
- Bu dosyada doğrudan `anime`, `cinematic` veya `watercolor` gibi stil filtreleri yoktur.
- Stil burada daha çok arayüz teması anlamına gelir.

Buna rağmen bazı görsel model açıklamalarında şu yetenekler açıklama seviyesinde yer alır:

- stil tutarlılığı
- referans görsel anlama
- stil transfer yetenekleri

Özellikle:

- **Flux Kontext Max**
- **Kontext Pro**

kayıtlarında referans görsel uyumu ve tutarlı stil aktarımı vurgulanır.

Ayrıca Recraft benzeri görsel modeller şu avantajları öne çıkarır:

- marka kimliği uyumu
- SVG hassasiyeti
- kurumsal tasarım uyumu

## Multimodal ve Ses Notları

- Multimodal modeller, metin yanında görsel, ses ve bazı kayıtlarda video anlama yeteneklerini açıklama katmanında gösterir.
- Ayrı bir `video-generation` kategori anahtarı yoktur.
- Video kabiliyeti bazı multimodal model açıklamalarında ve kullanım örneklerinde geçer.
- Ses tarafı sınırlı ama mevcuttur.
- Audio model kategorisinde **PlayAI Dialog 1.0** ve `SES` etiketi bulunur.

## Filtreler

API yüzeyinde desteklenen filtreler:

- `search`
- `company`
- `badge`
- `category`
- `modelId`

Bu filtreler sorguyla birlikte uygulanır.

## Sıralama

Şu alanlara göre artan / azalan sıralama desteklenir:

- `name`
- `company`
- `input price`
- `output price`
- `image price`
- `speed score`

## Sayfalama

- `limit` ve `offset` parametreleri kullanılır.
- Varsayılan `limit` değeri **50**’dir.
- Üst sınır **250** olacak şekilde kısıtlanır.

## API Yüzeyi ve Routelar

Şu rotalar bulunur:

- `GET /`
- `GET /health`
- `GET /models`

Bu rotalar sırasıyla:

- bilgi,
- sağlık kontrolü,
- katalog listeleme

cevaplarını üretir.


EĞER BU BİLGİLER GPT YA DA CODEX GÖNDERİLECEK OLUSA AŞAĞIDAKİ BİLGİLER KESİNLİKLE VERİLMELİDİR. 
- bu kopya **referans amaçlıdır**,
- **aktif deploy değildir**,
- Puter Hosting üzerindeki worker kodunun **aynasıdır**,
- asıl vurgu bunun **birebir referans kopya** ve **okunabilir katalog** olmasıdır.

EĞER BU BİLGİLER YETERLİ DEĞİLSE 
BU URL OKUNMALIDIR : https://github.com/salihcelebi/puter/tree/main/reference/puter-hosted/models-worker


DİĞER WORKER URLLERİNE GİRİLDİĞİ ZAMAN ÇIKAN BİLGİLER 
https://api-cagrilari.puter.work/
{
  "ok": true,
  "worker": "api-cagrilari",
  "version": "2.0.0",
  "purpose": "Toleranslı AI gateway worker",
  "billingMode": "owner_pays",
  "routes": [
    "POST /chat",
    "POST /image",
    "POST /tts",
    "POST /video",
    "POST /photo-to-video",
    "POST /photoToVideo"
  ]
}

https://vite_api_base_url.puter.work/

{
  "ok": false,
  "worker": "vite_api_base_url",
  "deprecated": true,
  "useInstead": "https://api-cagrilari.puter.work",
  "reason": "Bu isim frontend env değişkeni gibi görünüyor; gerçek servis adı olmamalı.",
  "message": "Bu worker artık gerçek API kökü olarak kullanılmamalıdır.",
  "routesToUse": [
    "https://api-cagrilari.puter.work/chat",
    "https://api-cagrilari.puter.work/image",
    "https://api-cagrilari.puter.work/tts",
    "https://api-cagrilari.puter.work/video",
    "https://api-cagrilari.puter.work/photo-to-video",
    "https://is-durumu.puter.work/jobs/status"
  ]
}

https://is-durumu.puter.work/

{
  "ok": true,
  "worker": "is-durumu",
  "version": "1.0.0",
  "purpose": "Job durumlarını KV üzerinden okur.",
  "time": "2026-03-13T17:34:25.594Z",
  "routes": [
    "POST /jobs/status",
    "GET /jobs/status/:jobId"
  ],
  "notes": [
    "Bu worker yalnızca KV üzerindeki job kayıtlarını okur.",
    "Gerçek üretim çağrıları api-cagrilari.puter.work üzerinde yapılır."
  ]
}


https://chat.puter.work/
{
  "ok": true,
  "code": "WORKER_INFO",
  "error": null,
  "data": {
    "worker": "chat",
    "version": "1.0.0",
    "protocolVersion": "2026-03-12",
    "billingMode": "owner_pays",
    "routes": [
      "GET /",
      "GET /health",
      "POST /chat"
    ],
    "notes": [
      "BU WORKER SADECE CHAT İÇİNDİR.",
      "CHAT İŞLEMLERİ ME.PUTER ÜZERİNDEN OWNER-PAYS MANTIĞIYLA ÇALIŞIR.",
      "STREAM VE TOOLS DESTEĞİ AYNI CHAT CONTRACT'I İÇİNDE SUNULUR."
    ]
  },
  "meta": null,
  "worker": "chat",
  "version": "1.0.0",
  "protocolVersion": "2026-03-12",
  "billingMode": "owner_pays",
  "requestId": "info_1773423312548_dffrgm77",
  "traceId": "trace_1773423312548_ex41xk0k",
  "time": "2026-03-13T17:35:12.548Z",
  "durationMs": 0
}

https://puter_owner_ai_base_url.puter.work/
Subdomain not found

https://nisaworker.puter.work/
{
  "ok": true,
  "message": "Puter pricing worker ayakta.",
  "endpoints": [
    "/api/prices",
    "/api/refresh"
  ]
}

