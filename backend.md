PUTER, DOSYANDAKİ me.puter YAPISINA GÖRE VERİTABANI VE BACKEND’İ NASIL KURDURUYOR?
(11 Mart 2026 itibarıyla resmi Puter dokümanları + yüklediğin me.puter notları birleştirilerek hazırlanmıştır.)

NET HÜKÜM

Puter sana “tam ürün backend’i”ni otomatik kurmaz.
Puter sana şu 5 temel parçayı verir:

1. Worker tabanlı HTTP backend yüzeyi
2. `me.puter` ve `user.puter` diye iki ayrı kaynak bağlamı
3. KV tabanlı kalıcılık katmanı
4. Dosya saklama katmanı
5. AI çağrı katmanı

Ama şunu SEN kurarsın:

1. kendi kullanıcı sistemi
2. kendi kredi/limit mantığın
3. kendi admin panelin
4. kendi allowlist / policy / abuse kontrolün
5. uzun işlerin job mimarisi
6. ilişkisel veri modeli gerekiyorsa kendi SQL düzenin

Yani Puter burada “senin ürününün iç motoru” olur.
Ürün olmaz.
Özellikle dosyandaki me.puter yaklaşımında Puter görünmez motor, senin backend ise görünen yönetim katmanıdır.

==================================================
1) DOSYADAKİ YAPI NE DİYOR?
==================================================

Senin dosyanın özü şu:

- Kullanıcı Puter’a değil, SENİN uygulamana giriş yapar.
- Frontend doğrudan Puter AI’a gitmez.
- İstek önce senin `/api/ai/*` uçlarına gelir.
- Yetki, kredi, kota, allowlist ve log kontrolü önce backend’de yapılır.
- Sonra backend, `me.puter.ai.*` veya owner token ile başlatılmış Node tarafındaki `puter.ai.*` çağrısını yapar.
- Üretilen çıktı gerekiyorsa kalıcı depolamaya SENİN tarafında alınır.
- Özellikle video gibi uzun işlerde job + polling + idempotency gerekir.

Bu, saf “user-pays Puter frontend” modelinden farklıdır.
Bu artık “merkezi kaynak kullanan kontrollü backend” modelidir.

Kısa cümleyle:
me.puter yaklaşımında Puter, son kullanıcının hesabı değil; senin backend’inin sahip olduğu paylaşımlı kaynak havuzudur.

==================================================
2) RESMİ DOKÜMANLARDA GÖRÜNEN GERÇEK MİMARİ
==================================================

Resmi dokümanlar bugünkü haliyle Puter için üç ayrı çalışma biçimi gösteriyor:

A. Website / frontend kullanımı
B. Node.js backend kullanımı
C. Serverless Worker kullanımı

Ama kritik kırılma şurada:

- Normal website kullanımında kullanıcı Puter ile oturum açar.
- Worker içinde ise `user.puter` ve `me.puter` ayrımı vardır.
- `user.puter`, kullanıcının kendi kaynaklarını temsil eder.
- `me.puter`, deploy eden kişinin yani sahibin kaynaklarını temsil eder.

İşte senin dosyan tam burada `me.puter` yolunu seçiyor.

Bu ne demek?

Şu demek:

- Veri kullanıcı hesabına dağılmasın
- AI maliyeti kullanıcıya dağılmasın
- Yönetim sende toplansın
- Quota, kredi, abuse, moderation ve logging sende olsun
- Kullanıcı Puter popup’ı bile görmesin

Yani mimari, “frontend-first Puter app” değil;
“policy-first owner backend + Puter service core” olur.

==================================================
3) PUTER BU MİMARİDE BACKEND’İ NASIL OLUŞTURTUR?
==================================================

Puter backend’i 2 yoldan kurdurur:

YOL-1: PUTER WORKERS
- Worker içinde `router.get`, `router.post` ile HTTP endpoint tanımlarsın.
- Bu endpoint’ler senin REST API katmanın olur.
- Worker içinde `me.puter.kv`, `me.puter.fs`, `me.puter.ai` gibi yüzeyleri kullanırsın.
- Yani Worker, Puter’ın kendi içinde çalışan backend katmanı olur.

YOL-2: NODE.JS BACKEND
- Resmi dokümanda Node.js içinde `init(process.env.puterAuthToken)` ile Puter başlatılabildiği açıkça gösteriliyor.
- Bu modelde Express / Fastify / Next API route / herhangi bir Node backend üstünde Puter çağrısı yaparsın.
- Böylece Puter senin mevcut backend’ine gömülü servis katmanı olur.

Senin dosyaya göre en mantıklı sonuç şu:

Eğer ürünün sadece Puter üzerinde yaşayacaksa:
- Worker-first mimari yeterli olabilir.

Eğer ürününde şu şeyler varsa:
- kendi auth sistemi
- ödeme sistemi
- admin panel
- raporlama
- webhook
- ilişkisel veriler
- özel RBAC
- detaylı muhasebe / kredi defteri

o zaman:
- Node.js backend + Puter entegrasyonu
veya
- hibrit: dış backend + Puter Worker
daha doğru olur.

==================================================
4) PUTER VERİTABANI DİYE NE VERİYOR?
==================================================

EN KRİTİK NOKTA BU.

Resmi dokümanlarda bugün açıkça, tek tek metotları belgelenmiş veri kalıcılığı katmanı:
KV STORE’dur.

Yani bugün net ve somut veri API’si şudur:

- `puter.kv.set`
- `puter.kv.get`
- `puter.kv.del`
- `puter.kv.list`
- `puter.kv.incr`
- `puter.kv.decr`
- `puter.kv.flush`
- `puter.kv.expire`
- `puter.kv.expireAt`

Bu şu anlama gelir:

Puter sana “uygulama verisi saklama” için doğrudan kullanılabilir bir key-value veri katmanı veriyor.
Ama bu bir klasik ilişkisel veritabanı şeması değildir.
Yani Puter senin yerine şunları otomatik oluşturmaz:

- users tablosu
- invoices tablosu
- subscriptions tablosu
- audit_logs tablosu
- joins
- foreign keys
- transaction boundary
- ledger accounting modeli

Bunlar ürün tasarımıdır.
Bunları sen kurarsın.

Daha sert söyleyeyim:
Puter veri saklama primitive’i veriyor.
Ürün veritabanı tasarımını SEN yapıyorsun.

==================================================
5) PUTER KV’Yİ NEREDE KULLANMALISIN?
==================================================

KV çok faydalı ama HER ŞEY için doğru yer değil.

KV İÇİN DOĞRU KULLANIMLAR

1. Kısa ayarlar
- model allowlist
- feature flag
- tenant config
- varsayılan prompt
- ses ayarları

2. Sayaçlar
- günlük istek sayısı
- dakika başı rate limit
- kullanıcı kredi sayaçları
- endpoint bazlı hit count

3. Kısa durum kayıtları
- job status: queued / running / done / failed
- son hata mesajı
- son iş zamanı
- idempotency key sonucu

4. Cache
- aynı TTS metni için cache
- aynı prompt çıktısı için kısa süreli cache
- expensive moderation sonucu cache

5. Küçük oturum / workflow state
- çok adımlı AI akışında geçici state
- tool-call dönüşleri
- küçük conversation snapshot

KV İÇİN YANLIŞ KULLANIMLAR

1. Büyük medya meta modelleri ve dev kayıtlar
2. Derin raporlama / analitik sorguları
3. Çok tablolama gerektiren iş modelleri
4. muhasebe defteri
5. güçlü filtreleme / join / relation gereken veri
6. denetim izi için ağır kurumsal kayıtlar

NEDEN?

Çünkü resmi KV sınırlarında:
- key en fazla 1 KB
- value en fazla 400 KB

Bu küçük ve orta büyüklükte state için güzel.
Ama “ürün çekirdeğinin tüm ilişkisel gerçeği” için yeterli tasarım değil.

==================================================
6) DOSYANA GÖRE DOĞRU VERİTABANI TASARIMI: HİBRİT
==================================================

Senin dosyadaki me.puter mimarisi için en doğru veritabanı tasarımı şudur:

KATMAN-A: PUTER KV
KATMAN-B: PUTER FS
KATMAN-C: HARİCİ SQL VERİTABANI
KATMAN-D: BACKEND POLICY KATMANI

Şimdi tek tek:

--------------------------------
KATMAN-A: PUTER KV
--------------------------------

Buraya koy:

- rate limit bucket
- idempotency kayıtları
- kısa kullanım sayaçları
- geçici job state
- cache
- tenant config
- kısa admin ayarları
- günlük kredi ön-kontrol sayacı

ÖRNEK KEY TASARIMI

- `tenant:{tenantId}:config`
- `user:{userId}:quota:daily`
- `user:{userId}:quota:minute`
- `idem:{endpoint}:{idempotencyKey}`
- `job:{jobId}:status`
- `job:{jobId}:last_error`
- `cache:tts:{hash}`
- `cache:img:{hash}`
- `allowlist:models`
- `abuse:ip:{ip}:score`

Bu katman HIZ katmanıdır.
Hafif state katmanıdır.
Anlık kontrol katmanıdır.

--------------------------------
KATMAN-B: PUTER FS
--------------------------------

Buraya koy:

- oluşturulan görseller
- üretilen ses dosyaları
- video çıktıları
- kullanıcı yüklemeleri
- geçici iş dosyaları
- PDF / image / audio input’ları

Ama kritik kural:

KV metadata içindir.
FS dosya içindir.

Yani:
- görselin kendisi FS’de
- görsel kaydının kısa metadata’sı KV veya SQL’de

ÖRNEK DİZİN YAPISI

- `/uploads/{tenantId}/{userId}/...`
- `/generated/images/{yyyy}/{mm}/{dd}/...`
- `/generated/audio/{yyyy}/{mm}/{dd}/...`
- `/generated/video/{yyyy}/{mm}/{dd}/...`
- `/jobs/{jobId}/input/...`
- `/jobs/{jobId}/output/...`

--------------------------------
KATMAN-C: HARİCİ SQL
--------------------------------

İŞTE ASIL ÜRÜN VERİTABANI BURASI OLMALI.

Neden?

Çünkü senin dosyanda şunlar var:
- kredi
- kota
- log
- yönetici görünürlüğü
- model allowlist
- kullanıcıya özel kontrol
- uzun iş takibi
- maliyet sahipliği

Bunlar KV ile yapılabilir ama büyüyen üründe yönetilemez hale gelir.
Kurumsal doğruluk için ilişkisel veri gerekir.

KURMAN GEREKEN TABLOLAR

1. users
- id
- tenant_id
- email
- username
- password_hash / auth_provider
- status
- created_at
- updated_at

2. tenants
- id
- name
- plan
- status
- created_at

3. memberships
- id
- tenant_id
- user_id
- role
- created_at

4. balances
- id
- user_id
- current_credit
- reserved_credit
- updated_at

5. credit_ledger
- id
- user_id
- request_id
- direction (debit/credit)
- amount
- unit
- reason
- created_at

6. model_policies
- id
- tenant_id
- model_name
- enabled
- max_input_chars
- max_output_tokens
- max_image_size
- max_video_duration
- created_at

7. ai_requests
- id
- tenant_id
- user_id
- endpoint_type (chat/image/video/tts/stt)
- provider
- model
- input_hash
- status
- request_bytes
- response_bytes
- started_at
- finished_at

8. ai_request_events
- id
- request_id
- event_type
- payload_json
- created_at

9. jobs
- id
- request_id
- kind
- status
- progress
- retry_count
- idempotency_key
- started_at
- finished_at

10. generated_assets
- id
- request_id
- asset_type
- storage_provider
- storage_path
- mime_type
- byte_size
- sha256
- created_at

11. audit_logs
- id
- actor_user_id
- tenant_id
- action
- target_type
- target_id
- diff_json
- created_at

12. abuse_signals
- id
- user_id
- ip
- fingerprint
- score
- reason
- created_at

13. api_keys_or_service_tokens
- id
- scope
- status
- rotated_at
- created_at

14. webhooks
- id
- event_name
- payload_json
- delivery_status
- attempts
- created_at

BU NEDEN GEREKLİ?

Çünkü kredi düşümü, rezervasyon, geri iade, job retry, asset üretimi, admin raporu, kullanım raporu ve tenant bazlı limitler “ilişkisel gerçek” ister.

==================================================
7) PUTER BURADA NEYİ OTOMATİK YAPAR, NEYİ YAPMAZ?
==================================================

PUTER’IN HAZIR VERDİĞİ ŞEYLER

- AI endpoint yüzeyleri
- Worker tabanlı backend taşıyıcısı
- KV kalıcılığı
- Dosya yazma / saklama
- kullanıcı veya deployer kaynak bağlamı
- kullanım istatistiklerini okuma yüzeyleri
- tool calling için model yüzeyi

PUTER’IN SENİN YERİNE YAPMADIĞI ŞEYLER

- ürün tablolarını tasarlamak
- kredi muhasebesi
- tenant mantığı
- iş kuralları
- role-based access control
- denetim log stratejisi
- retry / reservation / refund muhasebesi
- kalıcı medya yaşam döngüsü politikası
- admin paneli
- ödeme entegrasyonu

ÇOK ÖNEMLİ ÇIKARIM

User-pays modelde Puter sana güvenlik ve abuse tarafında ciddi kolaylık sağlar.
Ama sen me.puter ile owner-pays / merkezi kaynak modeline geçtiğinde,
dosyandaki gibi rate limit, kota, log ve allowlist kurallarını artık SENİN backend’in taşımalıdır.

Yani user-pays rahatlığını bırakıp kontrol kazanıyorsun.
Kontrol kazanırken sorumluluk da alıyorsun.

==================================================
8) EN DOĞRU BACKEND KATMANI NASIL KURULUR?
==================================================

TAVSİYE EDİLEN AKIŞ

FRONTEND
-> kendi auth sistemin
-> kendi kullanıcı oturumu
-> kendi ödeme ekranın
-> kendi dashboard’un

SONRA

API GATEWAY / BACKEND
-> JWT/session doğrulama
-> tenant bulma
-> kullanıcı rolü doğrulama
-> endpoint policy
-> model allowlist
-> quota kontrolü
-> kredi rezervasyonu
-> abuse kontrolü
-> idempotency kontrolü
-> request log başlangıcı

SONRA

PUTER SERVİS ÇAĞRISI
-> `me.puter.ai.chat()`
-> `me.puter.ai.txt2img()`
-> `me.puter.ai.txt2speech()`
-> `me.puter.ai.txt2vid()`
veya
-> Node’da `puter.ai.*`

SONRA

SONUÇ KATMANI
-> çıktı büyükse FS’ye yaz
-> metadata SQL’e yaz
-> kısa durum KV’ye yaz
-> kredi kesinleştir
-> response dön
-> event logla

BU TAM OLARAK ŞUNA DÖNÜŞÜR:

Tarayıcı
-> Senin backend’in
-> Puter servis yüzeyi
-> Puter KV / FS / AI
-> Senin SQL ürün veritabanın

==================================================
9) ENDPOINT TASARIMI NASIL OLMALI?
==================================================

ME.PUTER DOSYANA GÖRE İSKELET ŞU OLMALI

- `POST /api/ai/chat`
- `POST /api/ai/image`
- `POST /api/ai/video`
- `POST /api/ai/tts`
- `POST /api/ai/stt`
- `POST /api/ai/photo-to-video`
- `GET /api/ai/jobs/:id`
- `POST /api/admin/models/allowlist`
- `GET /api/admin/usage`
- `GET /api/admin/logs`
- `POST /api/internal/webhooks/usage`

HER ENDPOINT’TE ZORUNLU SIRA

1. auth
2. tenant resolve
3. policy check
4. quota / balance check
5. idempotency check
6. request create
7. Puter call
8. asset persist
9. ledger finalize
10. audit / analytics log
11. response

==================================================
10) CHAT, IMAGE, VIDEO, TTS İÇİN ARKA PLAN MANTIĞI
==================================================

--------------------------------
CHAT
--------------------------------

Chat’te Puter sana model yüzeyi ve tool-calling yüzeyi verir.
Ama tool çalıştırmayı sen yaparsın.
Yani model “fonksiyon çağırmak istiyorum” der.
Asıl fonksiyonu backend’in çalıştırır.
Sonra sonucu tekrar modele verirsin.

Bu nedenle chat backend’in şu bileşenleri ister:

- conversation state
- moderation
- tool registry
- timeout
- retry
- token / maliyet kaydı
- response logging

CHAT İÇİN SQL TABLOLARI
- conversations
- conversation_messages
- ai_requests
- ai_request_events
- tool_invocations

KV’DE TUTULABİLECEKLER
- son conversation snapshot
- kısa cache
- rate limit bucket

--------------------------------
IMAGE
--------------------------------

Puter image üretiminde çıktı olarak görsel nesnesi verir.
Ama senin ürününde “kalıcı asset yönetimi” gerekliyse,
görseli sadece dönmek yetmez.
Asset olarak kaydetmen gerekir.

IMAGE İÇİN DOĞRU MODEL

- input SQL’de request kaydı
- output FS’de dosya
- output metadata SQL’de generated_assets
- preview/cache KV’de olabilir

--------------------------------
VIDEO
--------------------------------

Video tarafı en kritik kısım.

Neden?

Çünkü resmi dokümanda da açık:
gerçek video üretimi dakika sürebilir.

Demek ki:
tek HTTP isteği bekletmek kötü mimaridir.

DOĞRU YAPI

- `POST /api/ai/video`
  -> request kabul
  -> job oluştur
  -> status `queued`
  -> 202 dön
- worker/background process
  -> `me.puter.ai.txt2vid()`
  -> output hazır olunca FS’ye yaz
  -> SQL job status `done`
- `GET /api/ai/jobs/:id`
  -> progress / asset URL / fail reason dön

Video için idempotency ZORUNLUDUR.
Yoksa retry = çifte üretim = çifte maliyet olabilir.

--------------------------------
TTS
--------------------------------

TTS’de çıktı `audio` nesnesi şeklinde gelir.
Ama ürün mantığında şu gerekir:

- aynı text + same voice hash
- önce cache bak
- varsa mevcut asset dön
- yoksa üret
- FS’ye yaz
- SQL’e metadata yaz

Böylece gereksiz maliyet düşer.

==================================================
11) PUTER KULLANIRKEN HANGİ VERİYİ KV’DE, HANGİSİNİ SQL’DE, HANGİSİNİ FS’DE TUTMALISIN?
==================================================

KURAL TEK SATIRDA ŞU:

KÜÇÜK VE ANLIK = KV
BÜYÜK DOSYA = FS
İŞ GERÇEĞİ VE RAPORLAMA = SQL

ÖRNEK SINIFLANDIRMA

KV
- quota counter
- rate limiter
- cache
- job short status
- idempotency

FS
- image binary
- audio binary
- video binary
- upload file
- temp artifact

SQL
- users
- balances
- ledger
- jobs
- generated_assets
- audit_logs
- abuse_signals
- policies
- memberships
- tenant config history

==================================================
12) HANGİ SENARYODA SADECE PUTER YETER, HANGİ SENARYODA YETMEZ?
==================================================

SADECE PUTER YETERSE
- basit araç
- kullanıcı Puter ile login olacaksa
- user-pays istiyorsan
- ağır admin / ödeme / muhasebe yoksa
- relation azsa
- KV + FS yeterliyse

SADECE PUTER YETMEZSE
- senin kendi kullanıcı sistemin varsa
- sen ödeme alıyorsan
- owner-pays ise
- tenant / role / membership varsa
- detaylı raporlama varsa
- kredi defteri gerekiyorsa
- hukuk / denetim izi gerekiyorsa
- job maliyeti hassassa
- büyük ölçek yönetim paneli varsa

Senin dosyan ikinci kümeye giriyor.

Yani:
Puter tek başına “tam ürün veritabanın” değil.
Puter + senin ürün veritabanın birlikte çalışmalı.

==================================================
13) SANA EN DOĞRU KURULUMU TEK CÜMLEYLE SÖYLEYEYİM
==================================================

Senin dosyadaki me.puter yapısına göre en doğru kurulum şudur:

Puter’ı AI + KV + FS + Worker motoru olarak kullan;
ama ürünün asıl backend yönetimini Node.js veya Worker tabanlı policy katmanında kur;
ürün verisinin kısa/anlık kısmını Puter KV’de,
dosyaları Puter FS’de,
ilişkisel ve finansal gerçeği ise ayrı SQL veritabanında tut.

==================================================
14) SON KARAR
==================================================

Puter, senin dosyandaki me.puter modelinde veritabanını “tamamını otomatik kuran sistem” gibi davranmıyor.
Puter, backend primitive’leri veriyor:
Worker, AI, KV, FS, auth/usage yüzeyleri.
Sen ise bunların üstüne ürün backend’ini kuruyorsun.

EN DOĞRU MİMARİ:
- frontend -> kendi auth
- backend -> kendi policy
- Puter -> AI/KV/FS motoru
- SQL -> ürünün gerçek veritabanı

Yani Puter burada “database replacement” değil;
“backend capability layer”dir.

İstersen bunun bir sonraki adımında sana doğrudan şu 3 şeyi tek parça halinde çıkarayım:
1. hazır PostgreSQL tablo şeması
2. hazır `/api/ai/*` endpoint taslağı
3. hazır me.puter tabanlı backend klasör yapısı