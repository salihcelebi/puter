 README.md

> DOĞRULAMA NOTU     
> Bu README, yüklediğin `nisai.zip` içindeki **69 dosyanın okunmuş içeriğine** göre hazırlanmıştır.  
> `server/db/kv.json` dosyası bu **zip snapshot’ında 0 byte / 0 satır** durumundadır; çalışan bir local instance’ta aynı dosya binlerce satıra büyüyebilir.  
> Runtime’da üretilen/veri taşıyan dosyalar, kaynak kod dosyalarından ayrı mantıkla açıklanmıştır.  
> Emin olunmayan hiçbir nokta “kesin” gibi yazılmamıştır; görülen davranış ile runtime’da oluşabilecek durum ayrılmıştır.

## SİSTEMİN GENEL AMACI

1. Bu sistem, kullanıcıların kredi kullanarak metin, görsel, video, ses ve müzik üretimi yapabildiği tam yığın bir AI üretim platformudur.  
2. Proje tek depoda hem React tabanlı istemciyi hem de Express tabanlı API sunucusunu taşır.  
3. Kimlik doğrulama JWT + cookie modeliyle backend’de üretilir, frontend’de `AuthContext` ile yönetilir.  
4. Kullanıcı tarafı; giriş/kayıt, dashboard, AI araçları, varlık listesi, kullanım geçmişi, kredi geçmişi ve hesap ekranlarından oluşur.  
5. Yönetici tarafı; kullanıcı yönetimi, kredi müdahalesi, ödeme geçmişi, loglar, model kataloğu ve fiyat senkronizasyonu ekranlarını içerir.  
6. Veritabanı olarak klasik SQL yerine `server/db/kv.ts` üzerinden çalışan JSON dosya tabanlı bir KV yaklaşımı kullanılmıştır.  
7. Fiziksel medya dosyaları `.data/fs` altında saklanır; metadata ise KV tarafında tutulur.  
8. AI çağrıları owner-controlled backend sınırında owner runtime’a yönlendirilir; video ve photo-to-video job/polling ile izlenir, music native olmadığı için capability-gated pasif durumda tutulur.  
9. Ana Express uygulamasından bağımsız olarak `worker.js` altında ayrı bir fiyat katalog / kur senkronizasyon hattı da bulunur.  
10. Sistemin genel zinciri; kullanıcı girişi → yetki kontrolü → kredi kontrolü → AI üretimi → log / ledger / asset kaydı → kullanıcı ve admin ekranlarında görünürlük şeklindedir.  

████████████████████████████

DOSYA ADI: `server.ts`  
SATIR SAYISI: 161

1. AMACI  
- Bu dosya Express uygulamasının gerçek giriş noktasıdır.  
- Sunucuyu ayağa kaldırır, temel middleware’leri yükler, route’ları bağlar ve geliştirme modunda Vite middleware’ini aynı süreçte çalıştırır.  
- Ayrıca dosya sistemi hazırlığı, varsayılan admin oluşturma ve model seed işlemleri burada uygulama başlangıcına bağlanır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `startServer()`: Sunucunun tüm başlangıç sırasını çalıştırır; `fileSystem.init()`, `authService.ensureDefaultAdmin()`, `ensureModelsSeeded()`, middleware kurulumu, route mount işlemi, Vite/production ayrımı ve `listen` çağrısı burada yapılır.  
- `GET /api/health`: Servis durumu ile owner-runtime readiness bilgisini döner.  
- `POST /api/test-sync`: TCMB veya fallback kur kaynağından USD/TRY oranı alır, ardından `https://turk.puter.work/api/prices` verisini çekip `model:*` kayıtlarını KV içine senkronize eder.  

3. DOSYA YOLU  
- `server.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Import ettiği iç dosyalar: `server/routes/auth.ts`, `server/routes/billing.ts`, `server/routes/ai.ts`, `server/routes/admin.ts`, `server/routes/assets.ts`, `server/routes/user.ts`, `server/db/fs.ts`, `server/services/authService.ts`, `server/db/kv.ts`, `server/db/seed-model-prices.ts`.  
- Harici bağımlılıklar: `express`, `vite`, `cookie-parser`, `path`, `url`, `fs`.  
- Dış servis bağımlılıkları: `https://www.tcmb.gov.tr/kurlar/today.xml`, `https://api.exchangerate-api.com/v4/latest/USD`, `https://turk.puter.work/api/prices`.  

5. EK NOT  
- Bu dosya teknik omurgadır.  
- Buradaki `/api/test-sync` mantığının çok benzeri `server/routes/admin.ts` içinde de tekrar edilmektedir; senkronizasyon mantığı iki yerde dağılmıştır.  
- `package.json` içindeki `start` script’i `dist/server.js` bekliyor, fakat `build` script’i yalnızca `vite build` çalıştırıyor; bu nedenle dağıtım zinciri bu snapshot’ta tam kapanmış görünmüyor.  

████████████████████████████

DOSYA ADI: `src/App.tsx`  
SATIR SAYISI: 72

1. AMACI  
- Bu dosya frontend uygulamasının merkezî rota haritasını tanımlar.  
- Bütün kullanıcı ve admin sayfaları burada `react-router-dom` ile bağlanır.  
- `AuthProvider`, `ProtectedRoute`, `Layout` ve tüm sayfa bileşenleri bu dosya üzerinden tek ağaçta birleşir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `App()`: Toaster’ı, `AuthProvider`’ı, Router’ı ve tüm route tanımlarını render eder.  

3. DOSYA YOLU  
- `src/App.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Doğrudan kullandığı iç dosyalar: `src/context/AuthContext.tsx`, `src/components/ProtectedRoute.tsx`, `src/components/Layout.tsx`, tüm `src/pages/**` sayfaları.  
- Harici bağımlılıklar: `react-router-dom`, `react-hot-toast`.  
- Bu dosya `src/main.tsx` tarafından mount edilir.  

5. EK NOT  
- Frontend’in fiilî yönlendirme omurgasıdır.  
- Admin route’ları burada ayrı ayrı `requireAdmin` ile sarılmıştır.  
- Uygulamada yeni ekran eklenecekse ilk düzenlenecek yerlerden biridir.  

████████████████████████████

DOSYA ADI: `server/services/authService.ts`  
SATIR SAYISI: 107

1. AMACI  
- Bu dosya kullanıcı kayıtları ve JWT işlemleri için servis katmanıdır.  
- Kullanıcı oluşturma, kullanıcı bulma, token üretme/doğrulama ve varsayılan admin hazırlığı burada yürütülür.  
- Route katmanının doğrudan veri yapısı manipülasyonu yapmasını azaltır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `findUserByEmail(email)`: `userByEmail:*` indeksini kullanarak kullanıcıyı bulur.  
- `findUserByUsername(username)`: `userByUsername:*` indeksini kullanarak kullanıcıyı bulur.  
- `createUser(data)`: Yeni kullanıcı nesnesi kurar, `users:*` ve indeks kayıtlarını yazar, başlangıç kredisini atar.  
- `updateLastLogin(userId)`: Son giriş tarihini günceller.  
- `generateToken(user)`: JWT üretir.  
- `verifyToken(token)`: JWT’yi doğrular; başarısızsa `null` döner.  
- `ensureDefaultAdmin()`: `admin` kullanıcı adıyla varsayılan yönetici hesabı yoksa oluşturur.  

3. DOSYA YOLU  
- `server/services/authService.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `server/db/kv.ts`.  
- Harici bağımlılıklar: `bcryptjs`, `jsonwebtoken`.  
- Kullanan dosyalar: `server.ts`, `server/middleware/auth.ts`, `server/routes/auth.ts`.  

5. EK NOT  
- `JWT_SECRET` ortam değişkeni yoksa dosya içinde sert bir fallback anahtar kullanılır.  
- Bu davranış geliştirme kolaylığı sağlar ama üretim için zayıf noktadır.  
- Güvenlik katmanının çekirdek servisidir.  

████████████████████████████

DOSYA ADI: `server/middleware/auth.ts`  
SATIR SAYISI: 66

1. AMACI  
- Bu dosya giriş yapmış kullanıcı ve yönetici doğrulamasını middleware olarak sağlar.  
- Cookie veya `Authorization` header içindeki token’ı çözerek kullanıcıyı `req.user` içine taşır.  
- Yetkisiz veya pasif kullanıcı erişimini ortak noktada durdurur.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `requireAuth(req, res, next)`: Token varlığını, token geçerliliğini ve kullanıcı aktifliğini doğrular; başarılıysa `req.user` set eder.  
- `requireAdmin(req, res, next)`: `requireAuth` benzeri çalışır; ek olarak `user.rol === 'admin'` şartını zorunlu kılar.  
- `AuthRequest`: `req.user` alanını tip seviyesinde taşıyan genişletilmiş request arayüzüdür.  

3. DOSYA YOLU  
- `server/middleware/auth.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `server/services/authService.ts`, `server/db/kv.ts`.  
- Kullanan dosyalar: `server/routes/auth.ts`, `server/routes/ai.ts`, `server/routes/billing.ts`, `server/routes/user.ts`, `server/routes/admin.ts`.  
- Harici bağımlılık: `express` tipleri.  

5. EK NOT  
- Bu dosya backend güvenliğinin ortak kapı kontrolüdür.  
- Frontend route koruması (`ProtectedRoute`) bunun yerine geçmez; asıl güvenlik burada sağlanır.  
- Kritik güvenlik dosyasıdır.  

████████████████████████████

DOSYA ADI: `server/routes/auth.ts`  
SATIR SAYISI: 138

1. AMACI  
- Bu dosya kayıt, giriş, çıkış ve mevcut kullanıcı sorgusu için API yüzünü açar.  
- Aynı dosyada mock Google OAuth başlangıç ve callback akışı da bulunur.  
- Başarılı auth sonrası JWT cookie yazımı burada route seviyesinde yapılır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Adlandırılmış bağımsız ana fonksiyon yok; route callback’leri vardır.  
- `POST /register`: Kullanıcı oluşturur, şifre hash’ler, token cookie yazar.  
- `POST /login`: E-posta veya kullanıcı adıyla giriş yapar, şifre doğrular, token cookie yazar.  
- `POST /logout`: Auth cookie’yi temizler.  
- `GET /me`: Auth middleware sonrası güvenli kullanıcı nesnesi döner.  
- `GET /google/url`: Mock callback URL’si döner.  
- `GET /google/callback`: Mock Google kullanıcı oluşturur/günceller ve dashboard’a yönlendirir.  

3. DOSYA YOLU  
- `server/routes/auth.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `server/services/authService.ts`, `server/middleware/auth.ts`.  
- Harici bağımlılık: `bcryptjs`, `express`.  
- Tüketen frontend dosyaları: `src/context/AuthContext.tsx`, `src/pages/Login.tsx`, `src/pages/Register.tsx`.  

5. EK NOT  
- Google OAuth akışı bu snapshot’ta gerçek OAuth değil, mock akıştır.  
- Cookie güvenlik ayarları `httpOnly`, production’da `secure`, `sameSite=lax` şeklindedir.  
- Kullanıcı auth API’sinin dış yüzüdür.  

████████████████████████████

DOSYA ADI: `src/context/AuthContext.tsx`  
SATIR SAYISI: 74

1. AMACI  
- Bu dosya frontend tarafındaki kullanıcı oturum bilgisini global context olarak taşır.  
- Uygulama ilk açıldığında `/api/auth/me` çağrısı yaparak mevcut oturumu doğrular.  
- `login`, `logout` ve `checkAuth` davranışlarını ortak state katmanında toplar.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `AuthProvider({ children })`: Auth state’ini ve auth yardımcılarını alt ağaçlara dağıtır.  
- `checkAuth()`: Backend’den mevcut kullanıcıyı çekip `user` state’ini günceller.  
- `login(userData)`: Frontend state’ine kullanıcıyı yazar.  
- `logout()`: `/api/auth/logout` çağrısı yapar ve kullanıcı state’ini temizler.  
- `useAuth()`: Context’i güvenli şekilde tüketmek için özel hook döner.  

3. DOSYA YOLU  
- `src/context/AuthContext.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- HTTP bağımlılıkları: `/api/auth/me`, `/api/auth/logout`.  
- İç bağımlılık: React context/hook altyapısı.  
- Kullanan dosyalar: `src/App.tsx`, `src/components/Layout.tsx`, `src/components/ProtectedRoute.tsx`, `src/pages/Login.tsx`, `src/pages/Register.tsx`, `src/pages/Billing.tsx`, `src/pages/Checkout.tsx`, `src/pages/Account.tsx`, `src/components/AILayout.tsx`.  

5. EK NOT  
- Frontend oturum gerçeği burada tutulur.  
- `login()` yalnızca state günceller; gerçek cookie üretimi backend route’larında yapılır.  
- Auth tarafındaki en kritik frontend dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/components/ProtectedRoute.tsx`  
SATIR SAYISI: 31

1. AMACI  
- Bu dosya korumalı route mantığını UI seviyesinde uygular.  
- Kullanıcı yoksa giriş ekranına, admin gereksinimi karşılanmıyorsa dashboard’a geri yönlendirir.  
- Auth yüklenirken spinner göstererek geçişte boş ekran hissini engeller.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `ProtectedRoute({ children, requireAdmin })`: Auth durumuna göre içeriği render eder veya yönlendirme yapar.  

3. DOSYA YOLU  
- `src/components/ProtectedRoute.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/context/AuthContext.tsx`.  
- Harici bağımlılık: `react-router-dom`.  
- Kullanan dosya: `src/App.tsx`.  

5. EK NOT  
- Bu bileşen güvenliği kolaylaştırır ama backend auth yerine geçmez.  
- Gerçek yetki kontrolü yine `server/middleware/auth.ts` tarafındadır.  
- UI tarafında kritik yönlendirme bileşenidir.  

████████████████████████████

DOSYA ADI: `src/components/Layout.tsx`  
SATIR SAYISI: 154

1. AMACI  
- Bu dosya giriş yapmış kullanıcıların gördüğü ana kabuk arayüzünü üretir.  
- Sol menü, üst bölüm, kullanıcı kredi görünürlüğü, mobil sidebar ve çıkış davranışı burada tanımlanır.  
- Alt sayfalar `Outlet` üzerinden bu kabuğun içine yerleştirilir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `Layout()`: Sidebar, header, kullanıcı kartı ve içerik alanını render eder.  
- `handleLogout()`: Context logout çağrısı sonrası kullanıcıyı giriş sayfasına götürür.  
- `closeSidebar()`: Mobil sidebar’ı kapatır.  

3. DOSYA YOLU  
- `src/components/Layout.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/context/AuthContext.tsx`.  
- Harici bağımlılıklar: `react-router-dom`, `lucide-react`.  
- Kullanan dosya: `src/App.tsx`.  

5. EK NOT  
- Tüm ana kullanıcı deneyiminin görsel iskeleti burada kuruludur.  
- Menü linkleri kullanıcı ve admin route’larını görünür hale getirir.  
- Arayüz tarafında kritik ortak kabuktur.  

████████████████████████████

DOSYA ADI: `server/services/aiService.ts`  
SATIR SAYISI: 223

1. AMACI  
- Bu dosya AI üretim iş mantığını merkezî servis olarak toplar.  
- Kredi düşümü, kullanım logu, asset kaydı ve gerçek/simüle üretim akışları burada birleşir.  
- Sohbet, görsel, TTS ve video modüllerinin backend operasyon omurgasıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `checkAndDeductCredit(userId, cost, module)`: Kullanıcının bakiye yeterliliğini kontrol eder, kullanım kredisi düşer ve ledger kaydı yazar.  
- `logUsage(userId, module, cost, internalCost, status, details)`: `usage:*` ve `userUsage:*` kayıtlarını üretir.  
- `runFeature({ feature: 'chat', ... })`: Model allowlist çözümleme yapar, owner runtime chat çağrısını başlatır, normalize response döner.  
- `runFeature({ feature: 'image', ... })`: Owner runtime image çağrısı yapar, base64 sonucu asset katmanına yazar.  
- `runFeature({ feature: 'tts', ... })`: Owner runtime TTS çağrısı yapar, sesi asset katmanına yazar.  
- `runFeature({ feature: 'video' | 'photoToVideo', ... })`: Owner runtime job başlatır, backend `aiJob:*` kaydıyla polling sözleşmesini sürdürür.  

3. DOSYA YOLU  
- `server/services/aiService.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `server/db/kv.ts`, `server/db/fs.ts`.  
- Harici bağımlılık: `@google/genai`.  
- Kullanan dosyalar: `server/routes/ai.ts`, `server/services/musicAdapter.ts`.  

5. EK NOT  
- Görsel ve TTS için dönen `url` değeri `/api/assets/:id` formatındadır.  
- Ancak `server/routes/assets.ts` bu snapshot’ta gerçek medya stream’i değil placeholder JSON döndürdüğü için, `src/pages/AI/ImageGen.tsx` ve `src/pages/AI/TTS.tsx` içindeki doğrudan `<img src>` / `<audio src>` kullanımı mevcut haliyle güvenilir önizleme sağlamayabilir.  
- Muhasebe + üretim birleşimi yaptığı için sistemin en kritik servislerinden biridir.  

████████████████████████████

DOSYA ADI: `server/routes/ai.ts`  
SATIR SAYISI: 82

1. AMACI  
- Bu dosya AI üretim endpoint’lerini HTTP tarafında açar.  
- Tüm endpoint’ler route bazında auth koruması altındadır.  
- Frontend’den gelen üretim isteklerini ilgili servis katmanlarına yönlendirir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Bağımsız adlandırılmış fonksiyon yok; route callback’leri vardır.  
- `GET /models`: Aktif modelleri listeler.  
- `POST /chat`: Sohbet üretimini başlatır.  
- `POST /image`: Görsel üretimini başlatır.  
- `POST /tts`: TTS üretimini başlatır.  
- `POST /video`: Video üretimini başlatır.  
- `POST /music`: Müzik üretimini başlatır.  

3. DOSYA YOLU  
- `server/routes/ai.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `server/middleware/auth.ts`, `server/services/aiService.ts`, `server/services/musicAdapter.ts`, `server/db/kv.ts`.  
- Kullanan frontend sayfaları: `src/pages/AI/Chat.tsx`, `src/pages/AI/ImageGen.tsx`, `src/pages/AI/VideoGen.tsx`, `src/pages/AI/PhotoToVideo.tsx`, `src/pages/AI/TTS.tsx`.
- Mount noktası: `server.ts` içindeki `/api/ai`.  

5. EK NOT  
- `GET /models` yalnızca `is_active` modelleri döndürür.  
- Bu route katmanı iş mantığını minimumda tutup servis katmanına bırakır.  
- AI API yüzeyinin ana dosyasıdır.  

████████████████████████████

DOSYA ADI: `server/services/musicAdapter.ts`  
SATIR SAYISI: 31

1. AMACI  
- Bu dosya müzik üretimi için adapter görevi görür.  
- Kredi kontrolü ve usage loglama işini mevcut `aiService` altyapısından yeniden kullanır.  
- Gerçek müzik sağlayıcısı yerine simüle URL dönen bir ara katmandır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `getCapability()`: Müzik özelliğinin native olmadığını dürüstçe bildirir; `generateMusic()` capability yoksa kodlu hata döner.  

3. DOSYA YOLU  
- `server/services/musicAdapter.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `server/db/kv.ts`, `server/services/aiService.ts`.  
- Kullanan dosya: `server/routes/ai.ts`.

5. EK NOT
- Bu snapshot’ta gerçek müzik üretimi yok; capability endpoint ile kontrollü pasif durum döner.  
- Asset metadata kaydı oluşur ama fiziksel dosya yazılmaz.  
- AI tarafında yardımcı servis dosyasıdır.  

████████████████████████████

DOSYA ADI: `server/services/billingService.ts`  
SATIR SAYISI: 163

1. AMACI  
- Bu dosya kredi paketleri, ödeme kayıtları ve webhook sonrası kredi yükleme işini yürütür.  
- Paket verisi, ödeme lifecycle’ı ve credit ledger mantığı burada toplanır.  
- Ödeme tarafındaki ana servis katmanıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `getPackages()`: Özel paket ayarı varsa onu, yoksa varsayılan paket listesini döner.  
- `getPackage(id)`: Tek paket bulur.  
- `createPayment(userId, packageId, provider)`: Bekleyen ödeme kaydı oluşturur ve mock checkout URL’si üretir.  
- `processWebhook(provider, payload)`: Webhook payload’ını işler, idempotency kontrolü yapar ve ödeme sonucunu kayda yazar.  
- `addCredits(userId, amount, paymentId, description)`: Kullanıcı toplam kredisini artırır ve ledger kaydı açar.  

3. DOSYA YOLU  
- `server/services/billingService.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `server/db/kv.ts`.  
- Import edilmiş ama kullanılmayan iç bağımlılık: `server/services/authService.ts`.  
- Kullanan dosya: `server/routes/billing.ts`.  

5. EK NOT  
- `Payment.durum` alanı bu dosyada `'pending' | 'completed' | 'failed'` olarak tanımlıdır.  
- Bu bilgi önemlidir çünkü `server/routes/admin.ts` içindeki özet hesaplamaları `success` filtresi kullandığı için bu snapshot’ta gerçek completed ödemeleri kaçırabilir.  
- Muhasebe servisinin çekirdek dosyasıdır.  

████████████████████████████

DOSYA ADI: `server/routes/billing.ts`  
SATIR SAYISI: 86

1. AMACI  
- Bu dosya paket listeleme, checkout başlatma ve webhook alma endpoint’lerini açar.  
- Ayrıca test amacıyla tarayıcıda çalışan sahte ödeme sayfası üretir.  
- Kullanıcı ödeme akışının HTTP dış yüzüdür.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `GET /packages`: Paket listesini döner.  
- `POST /checkout`: Auth sonrası ödeme başlatır ve checkout URL döner.  
- `POST /webhook/:provider`: Sağlayıcı webhook’unu alır ve `billingService.processWebhook` çalıştırır.  
- `GET /mock-checkout/:paymentId`: Tarayıcıda çalışan test ödeme ekranı döner.  
- İç script fonksiyonu `simulateWebhook(status)`: Mock sayfa içinde webhook çağrısı yapar.  

3. DOSYA YOLU  
- `server/routes/billing.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `server/services/billingService.ts`, `server/middleware/auth.ts`.  
- Kullanan frontend sayfaları: `src/pages/Billing.tsx`, `src/pages/Checkout.tsx`.  
- Mount noktası: `server.ts` içindeki `/api/billing`.  

5. EK NOT  
- Mock checkout akışı gerçek sağlayıcı entegrasyonu yerine test amaçlıdır.  
- İmza doğrulama / sağlayıcı SDK entegrasyonu yoktur.  
- Ödeme API’sinin route yüzeyidir.  

████████████████████████████

DOSYA ADI: `server/routes/user.ts`  
SATIR SAYISI: 105

1. AMACI  
- Bu dosya kullanıcının kendi profil, asset, usage ve ledger verilerini okuduğu endpoint’leri sağlar.  
- Tüm route’lar auth koruması altındadır.  
- Kullanıcı panelindeki veri ekranlarının backend kaynağıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `GET /profile`: Güvenli kullanıcı profilini döner.  
- `GET /assets`: Kullanıcıya ait asset kayıtlarını listeler.  
- `DELETE /assets/:id`: Asset metadata kaydını siler.  
- `GET /assets/:id/download`: Bu snapshot’ta gerçek dosya stream’i yapmaz; simüle indirme cevabı döner.  
- `GET /usage`: Kullanıcı usage geçmişini döner.  
- `GET /credits`: Kullanıcı kredi ledger geçmişini döner.  

3. DOSYA YOLU  
- `server/routes/user.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `server/db/kv.ts`, `server/middleware/auth.ts`.  
- Tüketen frontend sayfaları: `src/pages/Account.tsx`, `src/pages/Assets.tsx`, `src/pages/UsageHistory.tsx`, `src/pages/CreditHistory.tsx`.  
- Mount noktası: `server.ts` içindeki `/api/user`.  

5. EK NOT  
- Asset silme işlemi metadata kaydını kaldırır; gerçek dosya sistemi temizliği bu dosyada yapılmıyor.  
- Download endpoint’i de simülasyon düzeyinde kalıyor.  
- Kullanıcı paneli veri API’sinin ana dosyasıdır.  

████████████████████████████

DOSYA ADI: `server/routes/admin.ts`  
SATIR SAYISI: 532

1. AMACI  
- Bu dosya yönetim panelinin neredeyse bütün backend yüzeyini taşır.  
- Kullanıcı listesi, kredi müdahalesi, ödeme listesi, log listesi, model ayarları, model senkronizasyonu ve model güncelleme mantıkları burada toplanmıştır.  
- Route katmanı olmasına rağmen iş mantığının ciddi bir kısmı inline callback’ler içinde tutulur.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Bağımsız adlandırılmış ana fonksiyon yok; yoğun route callback yapısı vardır.  
- `GET /exchange-rate`: TCMB veya fallback kur servisini çağırır.  
- `GET /summary`: Toplam kullanıcı/satış/kredi/maliyet özeti döndürmeye çalışır.  
- `GET /models/stats`: Usage kayıtlarından model bazlı istatistik üretir.  
- `GET /users`, `PUT /users/:id`, `POST /users/:id/credits`: Kullanıcı listeleme, güncelleme ve kredi müdahalesi yapar.  
- `GET /payments`: Ödeme kayıtlarını listeler.  
- `GET /logs`: Usage ve error kayıtlarını birleştirir.  
- `GET /settings/models`, `POST /settings/models`: Model ayarlarını okur/yazar.  
- `GET /models`, `POST /models/sync-test`, `POST /models/sync`, `PUT /models/:id`, `PUT /models/bulk/update`: Model listeleme, senkronizasyon ve güncelleme işlemlerini yürütür.  

3. DOSYA YOLU  
- `server/routes/admin.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `server/db/kv.ts`, `server/middleware/auth.ts`, `server/db/seed-model-prices.ts`.  
- Tüketen frontend sayfaları: `src/pages/Admin/AdminDashboard.tsx`, `src/pages/Admin/AdminUsers.tsx`, `src/pages/Admin/AdminPayments.tsx`, `src/pages/Admin/AdminLogs.tsx`, `src/pages/Admin/AdminModels.tsx`.  
- Harici veri bağımlılıkları: TCMB XML, fallback exchange API, `https://turk.puter.work/api/prices`.  

5. EK NOT  
- Bu dosyada **doğrulanmış birkaç tutarsızlık** var:  
  1) `/summary` ödemeleri `p.durum === 'success'` ile, kullanımları ise `u.durum === 'completed'` ile filtreliyor; oysa yazan katmanlar sırasıyla `completed` ve `success/failed` kullanıyor.  
  2) `/payments` sıralamasında `created_at` alanı kullanılıyor; `billingService` ise ödeme kayıtlarında `olusturma_tarihi` ve `guncelleme_tarihi` yazıyor.  
  3) `/models/sync-test` ile `/models/sync` içinde aynı senkronizasyon mantığının çok büyük bölümü tekrar ediyor.  
- Bu nedenle admin tarafı çalışsa bile bazı metrik ve sıralamalar bu snapshot’ta beklenen sonucu vermeyebilir.  

████████████████████████████

DOSYA ADI: `server/db/kv.ts`  
SATIR SAYISI: 49

1. AMACI  
- Bu dosya JSON dosyası üzerinde çalışan basit bir KV depo adapter’ıdır.  
- Uygulama içindeki kullanıcı, ödeme, ledger, usage, settings, model ve asset metadata kayıtlarının ana kalıcılık katmanıdır.  
- Klasik veritabanı yerine process içi `Map` + disk dosyası yaklaşımı kullanır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `saveStore()`: Bellekteki `Map` içeriğini JSON olarak `kv.json` dosyasına yazar.  
- `kv.get(key)`: Tek anahtar okur.  
- `kv.set(key, value)`: Tek anahtar yazar ve dosyaya persist eder.  
- `kv.delete(key)`: Tek anahtarı siler ve dosyaya persist eder.  
- `kv.list(prefix)`: Belirli prefix ile başlayan tüm kayıtları döner.  

3. DOSYA YOLU  
- `server/db/kv.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Fiziksel veri dosyası: `server/db/kv.json`.  
- Kullanan backend dosyaları: `server.ts`, `server/services/authService.ts`, `server/services/aiService.ts`, `server/services/billingService.ts`, `server/services/musicAdapter.ts`, `server/routes/ai.ts`, `server/routes/user.ts`, `server/routes/admin.ts`, `server/db/seed-model-prices.ts`.  
- Harici bağımlılıklar: Node `fs`, `path`, `url`.  

5. EK NOT  
- `kv.json` bu zip snapshot’ında boş olduğu için `JSON.parse('')` denemesi hata üretir; dosyadaki `try/catch` bunu loglayıp sürecin devam etmesini sağlar.  
- Bu mimari hızlı prototipleme için pratik ama concurrency, locking ve büyük veri ölçeği açısından sınırlıdır.  
- Sistemin fiilî veritabanıdır.  

████████████████████████████

DOSYA ADI: `server/db/fs.ts`  
SATIR SAYISI: 29

1. AMACI  
- Bu dosya fiziksel medya dosyalarını yerel disk üzerinde tutan dosya sistemi adapter’ıdır.  
- Görsel ve ses gibi çıktılar `.data/fs` kökü altına bu katman üzerinden yazılır.  
- Puter benzeri dosya sistemi yerine local geliştirme yaklaşımı kullanır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `init()`: Kök klasörü hazırlar.  
- `write(filePath, data)`: İç içe klasörleri açıp dosyayı yazar.  
- `read(filePath)`: Dosya içeriğini okur.  
- `delete(filePath)`: Dosyayı siler.  

3. DOSYA YOLU  
- `server/db/fs.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Kullanan dosyalar: `server.ts`, `server/services/aiService.ts`.  
- Harici bağımlılıklar: `fs/promises`, `path`.  
- Fiziksel hedef dizin: `.data/fs`.  

5. EK NOT  
- Asset metadata ile fiziksel dosya saklama birbirinden ayrılmıştır.  
- Metadata `kv` tarafında, gerçek dosya bu adapter’da tutulur.  
- Depolama altyapısının çekirdek dosyasıdır.  

████████████████████████████

DOSYA ADI: `server/db/seed-model-prices.ts`  
SATIR SAYISI: 1041

1. AMACI  
- Bu dosya model fiyat kataloğunu gömülü veri olarak taşır ve başlangıç seed mantığını sağlar.  
- Uygulama ilk açıldığında model kayıtlarının KV içine yazılmasını garanti eder.  
- Dosyanın büyük olmasının nedeni uzun model katalog sabitidir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `seedModelPrices()`: Katalog ve kur sabitlerini ilgili KV anahtarlarına yazar.  
- `setUsdTryRate(rate)`: USD/TRY oranını KV’ye yazar.  
- `getAllModelPrices()`: Gömülü katalog listesini döner.  
- `getModelPrice(modelId)`: Tek katalog kaydı döner.  
- `ensureModelsSeeded()`: `model:*` kayıtları yoksa yönetim paneliyle uyumlu model kayıtlarını üretir.  
- Sabitler: `MODEL_PRICES_KEY`, `USD_TRY_RATE_KEY`, `MODEL_PRICE_PREFIX`, `MODEL_PRICES`.  

3. DOSYA YOLU  
- `server/db/seed-model-prices.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `server/db/kv.ts`.  
- Kullanan dosyalar: `server.ts`, `server/routes/admin.ts`.  
- Bu dosyanın ürettiği kayıtları `server/routes/ai.ts` ve `src/pages/Admin/AdminModels.tsx` dolaylı olarak kullanır.  

5. EK NOT  
- Bu katalog, dış senkronizasyon gelmeden önce başlangıç veri tabanı görevi görür.  
- `MODEL_PRICES` içinde çok sayıda model satırı olduğu için dosya veri-ağırlıklıdır.  
- Veri seed altyapısının ana dosyasıdır.  

████████████████████████████

DOSYA ADI: `server/middleware/credit.ts`  
SATIR SAYISI: 8

1. AMACI  
- Bu dosya kredi kontrolü için düşünülmüş middleware iskeletidir.  
- Şu an gerçek kredi doğrulama yapmaz.  
- Gelecekte route seviyesinde kredi kontrolü eklemek için bırakılmış görünür.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `checkCredit(cost)`: Şimdilik yalnızca `next()` çağıran placeholder middleware üretir.  

3. DOSYA YOLU  
- `server/middleware/credit.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılık: `express` tipleri.  
- Bu snapshot’ta aktif route’larda doğrudan kullanım tespit edilmedi.  
- Mantıksal olarak `server/services/aiService.ts` içindeki kredi düşüm akışıyla aynı problem alanına temas eder.  

5. EK NOT  
- Çalışan iş mantığı değil, yarım bırakılmış altyapı dosyasıdır.  
- Canlı kullanım etkisi görünmüyor.  
- Placeholder middleware dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/main.tsx`  
SATIR SAYISI: 10

1. AMACI  
- Bu dosya React uygulamasının tarayıcı giriş noktasıdır.  
- `App` bileşenini `#root` alanına mount eder.  
- Global CSS yüklemesi burada başlar.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Bağımsız fonksiyon tanımı yoktur.  
- `createRoot(...).render(...)`: Uygulamayı tarayıcı DOM’una bağlar.  

3. DOSYA YOLU  
- `src/main.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `src/App.tsx`, `src/index.css`.  
- Harici bağımlılıklar: `react`, `react-dom/client`.  
- HTML mount noktası: `index.html` içindeki `#root`.  

5. EK NOT  
- Küçük ama kritik giriş dosyasıdır.  
- Frontend bundan başlar.  
- Altyapısal arayüz dosyasıdır.  

████████████████████████████

DOSYA ADI: `index.html`  
SATIR SAYISI: 14

1. AMACI  
- Bu dosya frontend’in tarayıcı kabuk HTML’idir.  
- React uygulaması bu dosyadaki `#root` elementine yerleşir.  
- Harici Puter JS script’i de burada yüklenir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- `#root` mount alanı ve `/src/main.tsx` script girişi vardır.  

3. DOSYA YOLU  
- `index.html`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/main.tsx`.  
- Harici script: `https://js.puter.com/v2/`.  
- Vite bu dosyayı frontend entry olarak işler.  

5. EK NOT  
- Puter script varlığı proje niyetinde platform entegrasyonu olduğunu gösterir.  
- Ancak aktif backend/AI akışının büyük bölümü bu snapshot’ta Puter yerine kendi Express servisleri üzerinden yürümektedir.  
- Frontend kabuk dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/components/AILayout.tsx`  
SATIR SAYISI: 71

1. AMACI  
- Bu dosya AI araç sayfaları için ortak görsel düzen sağlar.  
- Sol tarafta araç ekranını, sağ tarafta ayarlar/kullanım/son işlemler panelini taşır.  
- Böylece sohbet, görsel, video, TTS ve müzik sayfalarında aynı layout standardı korunur.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `AILayout({ title, breadcrumb, children, usageCount, settings, recentItems })`: Ortak AI sayfa kabuğunu render eder.  

3. DOSYA YOLU  
- `src/components/AILayout.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/context/AuthContext.tsx`.  
- Kullanan sayfalar: `src/pages/AI/Chat.tsx`, `src/pages/AI/ImageGen.tsx`, `src/pages/AI/VideoGen.tsx`, `src/pages/AI/PhotoToVideo.tsx`, `src/pages/AI/TTS.tsx`.
- Harici bağımlılık: React.  

5. EK NOT  
- Tekrarlı AI ekran şablonunu azaltır.  
- Ürün deneyimini tutarlı kılan yardımcı düzen bileşenidir.  
- Yoğun kullanılan ortak UI dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Dashboard.tsx`  
SATIR SAYISI: 12

1. AMACI  
- Bu dosya kullanıcı veya admin dashboard görünümünü seçmek için hazırlanmıştır.  
- Ancak seçim mantığı bu snapshot’ta gerçek role bağlı değildir.  
- Dosya şu an fiilen yalnızca kullanıcı dashboard’unu göstermektedir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `Dashboard()`: `isAdmin` değişkenine göre iki dashboard bileşeninden birini render eder.  

3. DOSYA YOLU  
- `src/pages/Dashboard.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `src/components/dashboard/UserDashboard.tsx`, `src/components/dashboard/AdminDashboard.tsx`.  
- Kullanan dosya: `src/App.tsx`.  
- Harici bağımlılık yoktur.  

5. EK NOT  
- `const isAdmin = false; // TODO: Implement real role check` satırı doğrudan dosyada yer alır.  
- Bu nedenle bu route altındaki admin dashboard seçimi tamamlanmış değildir.  
- Yarım bırakılmış yönlendirme sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/components/dashboard/UserDashboard.tsx`  
SATIR SAYISI: 78

1. AMACI  
- Bu dosya son kullanıcı için özet dashboard görünümü üretir.  
- Hızlı aksiyon kartları, kredi görünümü ve örnek kullanım grafiği burada gösterilir.  
- Dashboard deneyimi daha çok görsel yönlendirme amaçlıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `UserDashboard()`: Kullanıcı dashboard kartlarını ve grafiği render eder.  
- `data`: Grafik için kullanılan örnek veri sabitidir.  

3. DOSYA YOLU  
- `src/components/dashboard/UserDashboard.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılıklar: `lucide-react`, `recharts`, `react-router-dom`.  
- Kullanan dosya: `src/pages/Dashboard.tsx`.  
- Hızlı aksiyon linkleri çeşitli kullanıcı route’larına gider.  

5. EK NOT  
- Görsel katman baskındır.  
- Bu snapshot’ta canlı backend verisi değil, örnek grafik datası kullanır.  
- Kullanıcı ana ekran bileşenidir.  

████████████████████████████

DOSYA ADI: `src/components/dashboard/AdminDashboard.tsx`  
SATIR SAYISI: 51

1. AMACI  
- Bu dosya basit bir admin dashboard bileşeni sağlar.  
- Statik metrik kartları ve son aktivite görünümü sunar.  
- Ayrı admin sayfaları gelmeden önce düşünülmüş özet bileşen görünümündedir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `AdminDashboard()`: Statik yönetim özet kartlarını render eder.  

3. DOSYA YOLU  
- `src/components/dashboard/AdminDashboard.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılık: `lucide-react`.  
- Kullanan dosya: `src/pages/Dashboard.tsx`.  
- `src/pages/Admin/AdminDashboard.tsx` ile karıştırılmamalıdır; aktif admin route ekranı o dosyadır.  

5. EK NOT  
- Bu bileşen veri odaklı gerçek admin paneli değildir.  
- Daha çok statik/erken taslak görünümündedir.  
- Yardımcı UI dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Login.tsx`  
SATIR SAYISI: 151

1. AMACI  
- Bu dosya kullanıcı giriş ekranını oluşturur.  
- E-posta veya kullanıcı adıyla giriş formunu backend’e bağlar.  
- Ayrıca mock Google giriş akışını tetikleyen butonu içerir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `Login()`: Sayfa bileşenini render eder.  
- `handleSubmit(e)`: `/api/auth/login` isteği yapar, dönen kullanıcıyı context’e yazar ve hedef route’a yönlendirir.  
- `handleGoogleLogin()`: Tarayıcıyı `/api/auth/google/url` adresine yönlendirir.  

3. DOSYA YOLU  
- `src/pages/Login.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/context/AuthContext.tsx`.  
- Harici bağımlılık: `react-router-dom`, React.  
- Backend bağımlılığı: `server/routes/auth.ts`.  

5. EK NOT  
- `from` route mantığı ile kullanıcıyı geldiği korumalı sayfaya geri göndermeye çalışır.  
- Auth UX’in ana giriş noktasıdır.  
- Kullanıcı giriş sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Register.tsx`  
SATIR SAYISI: 164

1. AMACI  
- Bu dosya yeni kullanıcı kayıt ekranını oluşturur.  
- E-posta, kullanıcı adı, görünen ad ve şifre verisini backend’e yollar.  
- Başarılı kayıt sonrası kullanıcıyı anında giriş yapmış state’e alır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `Register()`: Sayfa bileşenini render eder.  
- `handleSubmit(e)`: `/api/auth/register` isteği atar, dönen kullanıcıyı auth context’e yazar ve dashboard’a yönlendirir.  
- `handleGoogleLogin()`: Tarayıcıyı `/api/auth/google/url` adresine yönlendirir.  

3. DOSYA YOLU  
- `src/pages/Register.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/context/AuthContext.tsx`.  
- Harici bağımlılık: `react-router-dom`, React.  
- Backend bağımlılığı: `server/routes/auth.ts`.  

5. EK NOT  
- Kayıt sonrası ek giriş istemeden kullanıcı state’i güncellenir.  
- Google kayıt akışı da bu snapshot’ta mock’tur.  
- Kullanıcı onboarding sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/ForgotPassword.tsx`  
SATIR SAYISI: 86

1. AMACI  
- Bu dosya şifre sıfırlama ekranını gösterir.  
- Ancak gerçek backend entegrasyonu içermez.  
- Kullanıcıya yalnızca simüle başarı mesajı veren placeholder bir akış sunar.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `ForgotPassword()`: Şifre sıfırlama form ekranını render eder.  
- `handleSubmit(e)`: 1.5 saniyelik bekleme sonrası başarılıymış gibi mesaj gösterir.  

3. DOSYA YOLU  
- `src/pages/ForgotPassword.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılık: `react-router-dom`, React.  
- İç link bağımlılığı: Login route’u.  
- Backend ile aktif çağrı ilişkisi yoktur.  

5. EK NOT  
- Gerçek reset token / e-posta altyapısı yoktur.  
- Kullanıcıya fonksiyonel görünüm veren placeholder sayfadır.  
- Eksik ürün sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Billing.tsx`  
SATIR SAYISI: 84

1. AMACI  
- Bu dosya kredi paketlerinin kullanıcıya gösterildiği satış ekranıdır.  
- Paket verisini backend’den çeker.  
- Satın alma sürecini checkout ekranına yönlendirir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `Billing()`: Paket kartlarını ve ekran state’ini render eder.  
- `fetchPackages()`: `/api/billing/packages` çağrısı yapar.  
- `handleBuy(pkg)`: Seçilen paketin checkout route’una gider.  

3. DOSYA YOLU  
- `src/pages/Billing.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/context/AuthContext.tsx`.  
- Harici bağımlılık: `react-router-dom`, React.  
- Backend bağımlılığı: `server/routes/billing.ts`.  

5. EK NOT  
- Kredi satış akışının kullanıcı yüzüdür.  
- Paketler backend kontrollüdür; frontend’de sabit fiyat listesi yoktur.  
- Satış funnel’ının ilk ekranıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Checkout.tsx`  
SATIR SAYISI: 196

1. AMACI  
- Bu dosya seçilen kredi paketinin ödeme onay ekranını üretir.  
- Kullanıcıdan ödeme sağlayıcısı seçimi alır ve backend’de ödeme kaydı oluşturur.  
- Başarılıysa tarayıcıyı mock checkout sayfasına yönlendirir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `Checkout()`: Paket özeti ve ödeme sağlayıcı kartlarını render eder.  
- `fetchPackage()`: Paket listesini çekip route parametresine göre eşleşen paketi bulur.  
- `handlePayment(provider)`: `/api/billing/checkout` çağrısı yapar ve dönen `checkoutUrl`’e yönlendirir.  

3. DOSYA YOLU  
- `src/pages/Checkout.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/context/AuthContext.tsx`.  
- Harici bağımlılık: `react-router-dom`, React.  
- Backend bağımlılıkları: `server/routes/billing.ts`, dolaylı olarak `server/services/billingService.ts`.  

5. EK NOT  
- Bu snapshot’ta gerçek PSP entegrasyonu yoktur.  
- Sayfa mock ödeme sayfasına gönderir.  
- Satın alma akışının ikinci adımıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Account.tsx`  
SATIR SAYISI: 181

1. AMACI  
- Bu dosya kullanıcının hesap özetini gösterir.  
- Profil, rol, kredi ve tarih alanları burada okunur ve görselleştirilir.  
- Salt okunur hesap görünümü sağlar.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `Account()`: Hesap kartlarını render eder.  
- `fetchProfile()`: `/api/user/profile` çağrısı yapar ve profil state’ini doldurur.  

3. DOSYA YOLU  
- `src/pages/Account.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/context/AuthContext.tsx`.  
- Harici bağımlılıklar: `date-fns`, `date-fns/locale`, `lucide-react`, `react-hot-toast`, React.  
- Backend bağımlılığı: `server/routes/user.ts`.  

5. EK NOT  
- Profil güncelleme formu yoktur; görünüm ekranıdır.  
- Auth durumunu anlamak ve kredi görünürlüğü sağlamak için önemlidir.  
- Kullanıcı paneli özet sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Assets.tsx`  
SATIR SAYISI: 183

1. AMACI  
- Bu dosya kullanıcının ürettiği varlıkları listeler ve filtreler.  
- Silme ve indirme tetikleme davranışlarını içerir.  
- Asset tipi bazlı ikon ve aksiyon görünürlüğü sağlar.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `Assets()`: Liste, filtre ve arama ekranını render eder.  
- `fetchAssets()`: `/api/user/assets` çağrısı yapar.  
- `handleDelete(id)`: Backend’de asset metadata siler ve listeyi günceller.  
- `handleDownload(id, fileName)`: `/api/user/assets/:id/download` çağrısı yapar.  
- `getIcon(type)`: Asset tipine göre ikon seçer.  

3. DOSYA YOLU  
- `src/pages/Assets.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılıklar: `date-fns`, `lucide-react`, `react-hot-toast`, React.  
- Backend bağımlılığı: `server/routes/user.ts`.  
- Asset metadata üreticileri: `server/services/aiService.ts`, `server/services/musicAdapter.ts`.  

5. EK NOT  
- Bu sayfa metadata üzerinden çalışır.  
- Download endpoint’i gerçek dosya stream’i değil simülasyon cevabı verdiği için indirme deneyimi tam değildir.  
- Kullanıcı asset operasyon ekranıdır.  

████████████████████████████

DOSYA ADI: `src/pages/UsageHistory.tsx`  
SATIR SAYISI: 127

1. AMACI  
- Bu dosya kullanıcının AI kullanım geçmişini gösterir.  
- Modül, durum ve maliyet görünürlüğü sağlar.  
- Kullanım şeffaflığı için raporlama ekranı görevi görür.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `UsageHistory()`: Usage tablo ekranını render eder.  
- `fetchUsage()`: `/api/user/usage` çağrısı yapar.  
- `getIcon(module)`: Modül tipine göre ikon seçer.  
- `getStatusIcon(status)`: Başarı/başarısızlık ikonunu belirler.  

3. DOSYA YOLU  
- `src/pages/UsageHistory.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılıklar: `date-fns`, `lucide-react`, `react-hot-toast`, React.  
- Backend bağımlılığı: `server/routes/user.ts`.  
- Log kaynağı: `server/services/aiService.ts`, `server/services/musicAdapter.ts`.  

5. EK NOT  
- Kullanıcıya maliyet ve kullanım izlenebilirliği sunar.  
- Bu veriler `usage:*` kayıtlarından gelir.  
- Yardımcı raporlama sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/CreditHistory.tsx`  
SATIR SAYISI: 116

1. AMACI  
- Bu dosya kullanıcının kredi ledger geçmişini listeler.  
- Top-up ve usage gibi hareket tiplerini görsel olarak ayırır.  
- Kredi muhasebesinin kullanıcı tarafındaki görünümüdür.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `CreditHistory()`: Kredi geçmişi tablosunu render eder.  
- `fetchCredits()`: `/api/user/credits` çağrısı yapar.  
- `getIcon(type)`: Ledger işlem tipine göre ikon seçer.  

3. DOSYA YOLU  
- `src/pages/CreditHistory.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılıklar: `date-fns`, `lucide-react`, `react-hot-toast`, React.  
- Backend bağımlılığı: `server/routes/user.ts`.  
- Ledger kaynakları: `server/services/aiService.ts`, `server/services/billingService.ts`, `server/routes/admin.ts`.  

5. EK NOT  
- Kullanıcı güveni açısından önemlidir.  
- Kredi hareketlerinin tek bakışta görüldüğü ekrandır.  
- Yardımcı raporlama sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/AI/Chat.tsx`  
SATIR SAYISI: 211

1. AMACI  
- Bu dosya sohbet tabanlı AI deneyimini sağlar.  
- Model seçimi, mesaj geçmişi ve prompt gönderme akışı burada yönetilir.  
- Sağ panel yapısı için ortak `AILayout` bileşenini kullanır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `Chat()`: Sohbet ekranını render eder.  
- `scrollToBottom()`: Mesaj listesini aşağı kaydırır.  
- `fetchModels()`: `/api/ai/models` çağrısı yapar ve model listesini yükler.  
- `handleSend()`: Kullanıcı prompt’unu backend’e yollar ve gelen cevabı UI’da işler.  
- `settings`: Sağ panel ayar özetini üretir.  

3. DOSYA YOLU  
- `src/pages/AI/Chat.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/components/AILayout.tsx`.  
- Harici bağımlılıklar: React, `react-hot-toast`.  
- Backend bağımlılığı: `server/routes/ai.ts`.  

5. EK NOT  
- Bu ekran model listesini backend’den çektiği için admin tarafında aktifleştirilen modellerden etkilenir.  
- Sohbet ürünü tarafındaki ana ekranlardan biridir.  
- Kritik kullanıcı AI sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/AI/ImageGen.tsx`  
SATIR SAYISI: 103

1. AMACI  
- Bu dosya prompt’tan görsel üretim ekranını sağlar.  
- Kullanıcı prompt’unu backend’e gönderir ve dönen sonucu görsel olarak göstermeye çalışır.  
- Minimal ve tek amaçlı AI araç ekranıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `ImageGen()`: Formu ve sonuç alanını render eder.  
- `handleGenerate()`: `/api/ai/image` çağrısı yapar ve sonucu state’e yazar.  

3. DOSYA YOLU  
- `src/pages/AI/ImageGen.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/components/AILayout.tsx`.  
- Backend bağımlılığı: `server/routes/ai.ts` ve dolaylı olarak `server/services/aiService.ts`.  
- Harici bağımlılık: React.  

5. EK NOT  
- UI, dönen `result.url` değerini doğrudan `<img src>` olarak kullanır.  
- Backend’in `/api/assets/:id` endpoint’i bu snapshot’ta placeholder JSON döndürdüğü için gerçek görsel önizleme zinciri tamamlanmış görünmüyor.  
- Ekran var, medya teslim zinciri eksik görünüyor.  

████████████████████████████

DOSYA ADI: `src/pages/AI/VideoGen.tsx`  
SATIR SAYISI: 203

1. AMACI  
- Bu dosya metinden videoya üretim ekranını sağlar.  
- Model, süre ve en-boy oranı seçimini kullanıcıya açar.  
- Tahmini kredi maliyeti görünürlüğü de bu ekranda hesaplanır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `VideoGen()`: Form ve sonuç alanını render eder.  
- `handleGenerate()`: `/api/ai/video` çağrısı yapar.  
- `settings`: Sağ panel ayar özetini üretir.  
- `useEffect` içindeki maliyet hesabı: Seçili parametrelere göre tahmini kredi maliyeti gösterir.  

3. DOSYA YOLU  
- `src/pages/AI/VideoGen.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/components/AILayout.tsx`.  
- Backend bağımlılığı: `server/routes/ai.ts`, `server/services/aiService.ts`.  
- Harici bağımlılık: React.  

5. EK NOT  
- Video ve photo-to-video akışları queued job başlatır; frontend `/api/ai/jobs/:id` ile polling yapar.  
- Buna rağmen UI gerçek üretim ekranı gibi tasarlanmıştır.  
- Kısmen simülasyonlu AI sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/AI/PhotoToVideo.tsx`  
SATIR SAYISI: 166

1. AMACI  
- Bu dosya fotoğraftan video üretim arayüzünü hedefler.  
- Kullanıcıdan görsel dosya ve prompt alır.  
- Ancak backend tarafında ayrı image-to-video veri hattı bu snapshot’ta tamamlanmamıştır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `PhotoToVideo()`: Sayfayı render eder.  
- `handleImageChange(e)`: Yüklenen görsel dosyasını state’e alır.  
- `handleGenerate()`: `/api/ai/video` çağrısı yapar.  
- `settings`: Sağ panel ayar bilgisini üretir.  

3. DOSYA YOLU  
- `src/pages/AI/PhotoToVideo.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/components/AILayout.tsx`.  
- Backend bağımlılığı: `server/routes/ai.ts`, dolaylı olarak `server/services/aiService.ts`.  
- Harici bağımlılık: React.  

5. EK NOT  
- Frontend görsel dosyayı state’e alsa da `handleGenerate()` mevcut kodda dosyayı backend’e yüklemiyor.  
- Yani bu snapshot’ta bu sayfa “fotoğraftan video” değil, prompt tabanlı video üretimine yakın davranıyor.  
- Yarım kalmış AI ekranıdır.  

████████████████████████████

DOSYA ADI: `src/pages/AI/TTS.tsx`  
SATIR SAYISI: 183

1. AMACI  
- Bu dosya metinden sese üretim ekranını sağlar.  
- Kullanıcının metnini backend’e yollar ve sonuç sesi oynatmaya çalışır.  
- Sağ panelde ayar ve kullanım özeti gösterir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `TTS()`: Ekranı render eder.  
- `handleGenerate()`: `/api/ai/tts` çağrısı yapar.  
- `settings`: Sağ panel ayarlarını üretir.  

3. DOSYA YOLU  
- `src/pages/AI/TTS.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/components/AILayout.tsx`.  
- Backend bağımlılığı: `server/routes/ai.ts`, `server/services/aiService.ts`.  
- Harici bağımlılık: React.  

5. EK NOT  
- Backend TTS çağrısını owner runtime üzerinden server-controlled boundary içinde yürütür.  
- Ancak dönen URL yine `/api/assets/:id` formatında olduğu için gerçek medya stream route’u placeholder kaldığından oynatma zinciri tamamlanmış görünmeyebilir.  
- Kritik AI sayfalarından biridir.  

████████████████████████████

DOSYA ADI: `src/pages/Admin/AdminDashboard.tsx`
SATIR SAYISI: 119

1. AMACI  
- Bu dosya yönetim panelinin gerçek özet ekranıdır.  
- Backend’den özet metrikleri çekip kartlar halinde gösterir.  
- Admin için ilk bakış durum ekranı görevi görür.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `AdminDashboard()`: Sayfayı render eder.  
- `fetchSummary()`: `/api/admin/summary` çağrısı yapar.  

3. DOSYA YOLU  
- `src/pages/Admin/AdminDashboard.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Backend bağımlılığı: `server/routes/admin.ts`.  
- Harici bağımlılıklar: `lucide-react`, `react-hot-toast`, React.  
- Route tanımı: `src/App.tsx`.  

5. EK NOT  
- Bu ekranın doğruluğu doğrudan `/api/admin/summary` hesabına bağlıdır.  
- `server/routes/admin.ts` içindeki durum alanı filtreleri tutarsız olduğu için özet kartlar eksik/hatalı veri gösterebilir.  
- Aktif admin dashboard sayfasıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Admin/AdminUsers.tsx`  
SATIR SAYISI: 242

1. AMACI  
- Bu dosya adminin kullanıcı listesi üzerinde işlem yaptığı ana ekrandır.  
- Kullanıcı arama, aktif/pasif güncelleme ve kredi ekleme/çıkarma burada yapılır.  
- Operasyonel admin işlerinin en doğrudan ekranıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `AdminUsers()`: Tablo ve modal arayüzünü render eder.  
- `fetchUsers()`: `/api/admin/users` çağrısı yapar.  
- `toggleUserStatus(userId, currentStatus)`: Kullanıcı aktiflik durumunu günceller.  
- `handleCreditAction(action)`: Kullanıcıya kredi ekleme/çıkarma isteği gönderir.  

3. DOSYA YOLU  
- `src/pages/Admin/AdminUsers.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Backend bağımlılıkları: `GET /api/admin/users`, `PUT /api/admin/users/:id`, `POST /api/admin/users/:id/credits`.  
- Harici bağımlılıklar: `lucide-react`, `react-hot-toast`, React.  
- Backend uygulayıcısı: `server/routes/admin.ts`.  

5. EK NOT  
- Bu ekran doğrudan kullanıcı bakiyesi ve aktiflik durumunu değiştirir.  
- Operasyonel etkisi yüksek olduğu için kritik admin sayfasıdır.  
- Admin müdahale ekranıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Admin/AdminPayments.tsx`  
SATIR SAYISI: 127

1. AMACI  
- Bu dosya ödeme kayıtlarını yöneticiye listeler.  
- Arama ve filtreleme ile ödeme görünürlüğü sağlar.  
- Satış tarafının izleme ekranıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `AdminPayments()`: Ödeme tablosunu render eder.  
- `fetchPayments()`: `/api/admin/payments` çağrısı yapar.  

3. DOSYA YOLU  
- `src/pages/Admin/AdminPayments.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Backend bağımlılığı: `server/routes/admin.ts`.  
- Harici bağımlılıklar: `lucide-react`, `react-hot-toast`, React.  
- Veri kaynağı: `payments:*` kayıtları, yani `server/services/billingService.ts`.  

5. EK NOT  
- Listeleme doğruluğu backend sıralama mantığına bağlıdır.  
- Backend tarafında `created_at` ile sıralama yapılırken ödeme nesneleri `olusturma_tarihi` alanı yazdığı için bu snapshot’ta sıralama beklenenden sapabilir.  
- Yönetim tarafı denetim ekranıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Admin/AdminLogs.tsx`  
SATIR SAYISI: 170

1. AMACI  
- Bu dosya usage ve error loglarını yöneticiye tek ekranda gösterir.  
- Arama ve tip filtreleme davranışı içerir.  
- Denetim ve hata inceleme ekranıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `AdminLogs()`: Log tablosunu render eder.  
- `fetchLogs()`: `/api/admin/logs` çağrısı yapar.  

3. DOSYA YOLU  
- `src/pages/Admin/AdminLogs.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Backend bağımlılığı: `server/routes/admin.ts`.  
- Harici bağımlılıklar: `lucide-react`, `react-hot-toast`, React.  
- Log kaynakları: `server/services/aiService.ts`, `server/services/musicAdapter.ts`, potansiyel `errors:*` kayıtları.  

5. EK NOT  
- `server/routes/admin.ts` içinde `errors:*` kayıtları okunuyor ama bu snapshot’ta onları yazan ayrı bir katman net görünmüyor.  
- Bu yüzden error tarafı usage tarafına göre daha zayıf/boş kalabilir.  
- Admin denetim ekranıdır.  

████████████████████████████

DOSYA ADI: `src/pages/Admin/AdminModels.tsx`  
SATIR SAYISI: 771

1. AMACI  
- Bu dosya model, fiyat, kur, kârlılık ve aktiflik yönetiminin büyük ekranıdır.  
- Filtreleme, tekli güncelleme, toplu güncelleme ve senkronizasyon akışlarını içerir.  
- Yönetim panelindeki en yoğun operasyon ekranıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `flexibleMatch(query, text)`: Gevşek metin eşleşmesi yapar.  
- `priceMatch(query, usdPrice, tryPrice)`: Fiyat bazlı arama mantığı yürütür.  
- `AdminModels()`: Sayfayı ve tüm state’leri render eder.  
- `fetchStats()`: `/api/admin/models/stats` çağrısı yapar.  
- `fetchModels()`: `/api/admin/models` çağrısı yapar.  
- `handleSync()`: `/api/admin/models/sync` çağrısı yapar.  
- `handleUpdateModel(id, updates)`: Tek model güncellemesi yapar.  
- `handleBulkUpdate(updates)`: Toplu model güncellemesi yapar.  
- `toggleSelection(id)`: Tek model seçer/kaldırır.  
- `selectAll(filteredModels)`: Filtrelenmiş listedeki tüm modelleri seçer.  
- `renderFilters()`, `renderActiveModels()`, `renderInactiveModels()`, `renderPrices()`, `renderCreditPrices()`, `renderPopular()`: Sekme bazlı görünüm parçalarını render eder.  

3. DOSYA YOLU  
- `src/pages/Admin/AdminModels.tsx`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Backend bağımlılıkları: `/api/admin/models`, `/api/admin/models/stats`, `/api/admin/models/sync`, `PUT /api/admin/models/:id`, `PUT /api/admin/models/bulk/update`.  
- Harici bağımlılıklar: `lucide-react`, `react-hot-toast`, React.  
- Backend uygulayıcısı: `server/routes/admin.ts`; veri kaynağı ayrıca `server/db/seed-model-prices.ts`.  

5. EK NOT  
- Dosya çok büyüktür ve görünüm/iş mantığı aynı yerde toplanmıştır.  
- Bakım açısından parçalanması gerekir.  
- Model yönetiminin en kritik admin sayfasıdır.  

████████████████████████████

DOSYA ADI: `worker.js`  
SATIR SAYISI: 52

1. AMACI  
- Bu dosya ana Express uygulamasından ayrı çalışan worker tabanlı bir API yüzeyidir.  
- Fiyat kataloğunu okuma ve yenileme işlemlerini KV tabanlı servis mantığıyla sunar.  
- Ayrı dağıtım hedefi olan bağımsız bir çalışma birimidir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `fetch(request, env, ctx)`: Worker giriş noktasıdır.  
- İçteki `kvAdapter.get(key)`: Worker ortamı KV’den veri okur.  
- İçteki `kvAdapter.set(key, value)`: Worker ortamı KV’ye veri yazar.  
- `GET /api/prices`: Katalog verisini döner.  
- `POST /api/refresh`: Secret doğrulayıp resmi fiyat kataloğunu yeniler.  

3. DOSYA YOLU  
- `worker.js`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/server/services/puter-sync.ts`.  
- Dış çalışma ortamı bağımlılığı: `env.KV`.  
- Harici HTTP bağımlılıkları dolaylı olarak `puter-sync` zinciri üzerinden gelir.  

5. EK NOT  
- Secret kontrolü bu dosyada sabit `'my-admin-secret'` string’i ile yapılır.  
- `src/server/services/puter-sync.ts` içindeki `assertAdminSecret()` burada kullanılmıyor.  
- Ana Express uygulamasının canlı request akışından ayrı bir worker hattıdır.  

████████████████████████████

DOSYA ADI: `src/server/services/puter-sync.ts`  
SATIR SAYISI: 92

1. AMACI  
- Bu dosya worker tarafındaki fiyat katalog senkronizasyon servisidir.  
- Scrape sonucu katalog verisini KV’ye yazma ve farklı para biriminde okuma mantığını toplar.  
- Worker fiyat servisinin asıl iş akışını taşır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `assertAdminSecret(input)`: Secret doğrulaması yapar.  
- `readCatalog(kv, catalogKey)`: KV’den katalog JSON’unu okur.  
- `writeCatalog(kv, catalog, catalogKey)`: Kataloğu KV’ye yazar.  
- `refreshOfficialPuterCatalog(options)`: Resmî fiyat verisini tarar, kur verisini günceller, sonucu KV’ye kaydeder.  
- `getCatalogWithTryPrices(kv, targetCurrency, catalogKey)`: Kaydedilmiş katalog verisini hedef para birimine çevrilmiş biçimde döner.  

3. DOSYA YOLU  
- `src/server/services/puter-sync.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılıklar: `src/server/services/pricing.ts`, `src/server/services/fx-rate.ts`, `src/server/store/models.ts`.  
- Kullanan dosya: `worker.js`.  
- KV adapter’ı çalışma zamanında worker ortamından gelir.  

5. EK NOT  
- Bu dosya ana Express backend’den bağımsız ayrı bir servis ağacındadır.  
- Fiyat senkronizasyon mimarisinin worker tarafındaki merkezidir.  
- Altyapısal servis dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/server/services/pricing.ts`  
SATIR SAYISI: 341

1. AMACI  
- Bu dosya fiyat sayfalarından bilgi çıkaran scraping servisidir.  
- HTML temizleme, fiyat yakalama, sağlayıcı sınıflandırma ve kayıt üretme mantığı burada bulunur.  
- Worker fiyat katalog hattının veri çıkarım çekirdeğidir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `scrapeOfficialPuterPricing(fetchFn, options)`: Tüm scraping akışını çalıştırır.  
- `pushUnique`, `stripTags`, `titleFromHtml`, `inferProvider`, `inferServiceType`, `normalizeAmount`, `findPriceHits`, `buildRecordBase`, `pageToRecords`, `dedupeRows`, `extractLinksFromModelsIndex`, `fetchHtml`, `fetchPage`: Sayfa içeriğini parse edip fiyat kayıtlarına dönüştüren yardımcı fonksiyonlardır.  

3. DOSYA YOLU  
- `src/server/services/pricing.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/server/store/models.ts` tipleri.  
- Kullanan dosya: `src/server/services/puter-sync.ts`.  
- Harici HTTP bağımlılıkları: hedef fiyat sayfaları.  

5. EK NOT  
- Bu dosya veri çıkarımı odaklıdır; UI veya ana Express route katmanına bağlı değildir.  
- Worker hattının teknik olarak en karmaşık yardımcı servislerinden biridir.  
- Altyapısal scraper dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/server/services/fx-rate.ts`  
SATIR SAYISI: 80

1. AMACI  
- Bu dosya kur verisi çekme, cache’leme ve USD’den hedef para birimine çevirme işini yapar.  
- Fiyat katalog verisinin para birimi dönüşüm katmanıdır.  
- Worker hattında finansal yardımcı servis görevi görür.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `roundMoney(value, digits)`: Para değerini yuvarlar.  
- `normalizeCurrency(input)`: Para birimi kodunu normalize eder.  
- `fetchUsdFxRates(fetchFn)`: USD bazlı kur verilerini harici servisten çeker.  
- `getCachedFxRates(kv, key)`: KV cache’i okur.  
- `saveFxRates(kv, rates, key)`: Kur cache’ini yazar.  
- `getOrRefreshFxRates(fetchFn, kv, key)`: Cache varsa kullanır, yoksa yeniler.  
- `convertFromUsd(amount, rates, targetCurrency)`: USD tutarı hedef para birimine çevirir.  

3. DOSYA YOLU  
- `src/server/services/fx-rate.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık: `src/server/store/models.ts`.  
- Kullanan dosya: `src/server/services/puter-sync.ts`.  
- Harici servis: Frankfurter tabanlı kur API çağrısı.  

5. EK NOT  
- Worker senkronizasyon hattının finansal yardımcı bileşenidir.  
- Ana Express uygulaması bu dosyayı kullanmaz.  
- Altyapısal yardımcı servis dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/server/store/models.ts`  
SATIR SAYISI: 93

1. AMACI  
- Bu dosya worker senkronizasyon hattında kullanılan veri tiplerini tanımlar.  
- Katalog kayıtları, scrape sonuçları, kur haritaları ve KV adapter sözleşmeleri burada tanımlanır.  
- Kodun veri sözlüğü işlevini görür.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Bağımsız fonksiyon tanımı yoktur.  
- Türler ve arayüzler: `CurrencyCode`, `ServiceType`, `PricingRecord`, `PricingCatalog`, `PricingSourcePage`, `ParsedPriceHit`, `ScrapeOptions`, `ScrapeResult`, `FxRateMap`, `FetchLike`, `KvAdapter`, `SyncOptions`, `SyncResult`, `AdminRequestGuardInput`.  

3. DOSYA YOLU  
- `src/server/store/models.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Kullanan dosyalar: `src/server/services/pricing.ts`, `src/server/services/fx-rate.ts`, `src/server/services/puter-sync.ts`.  
- Harici bağımlılık yoktur.  
- Worker veri katmanının ortak tip dosyasıdır.  

5. EK NOT  
- Bu dosya runtime mantık değil, sözleşme/tip katmanıdır.  
- Kod tekrarını azaltır.  
- Altyapısal tip dosyasıdır.  

████████████████████████████

DOSYA ADI: `server/routes/assets.ts`  
SATIR SAYISI: 10

1. AMACI  
- Bu dosya asset liste/detay route’u için ayrılmış basit bir placeholder router’dır.  
- Şu an gerçek asset stream veya detay metadata döndürmez.  
- AI servislerinin döndürdüğü `/api/assets/:id` URL’lerinin hedefi bu dosyadır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `GET /`: Sabit bir “Assets list endpoint” mesajı döner.  
- `GET /:id`: Sabit bir “Asset detail endpoint” mesajı döner.  

3. DOSYA YOLU  
- `server/routes/assets.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılık: `express`.  
- Mount noktası: `server.ts` içindeki `/api/assets`.  
- AI servisleri (`server/services/aiService.ts`) bu route’u gerçek asset URL’siymiş gibi referanslar.  

5. EK NOT  
- Bu dosya placeholder kaldığı için asset detay/stream zinciri tamamlanmamıştır.  
- Özellikle image ve TTS önizleme akışını etkileyen açık noktalardan biridir.  
- Yarım kalmış route dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/api/index.ts`  
SATIR SAYISI: 7

1. AMACI  
- Bu dosya ayrı bir Express router iskeletidir.  
- Sadece basit bir health endpoint tanımlar.  
- Ana uygulama akışına bağlı görünmeyen yardımcı/artık dosya niteliğindedir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `GET /health`: `{ status: 'ok' }` döner.  

3. DOSYA YOLU  
- `src/api/index.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılık: `express`.  
- `server.ts` içinde import edilmediği için aktif kullanım tespit edilmedi.  
- Ayrı bir router taslağı olarak duruyor.  

5. EK NOT  
- Canlı route ağacının parçası görünmüyor.  
- Temizlik veya ileride yeniden kullanım adayıdır.  
- Yardımcı iskelet dosyasıdır.  

████████████████████████████

DOSYA ADI: `src/admin/adminService.ts`  
SATIR SAYISI: 5

1. AMACI  
- Bu dosya frontend tarafında admin servis iskeleti olarak bırakılmıştır.  
- Gerçek backend çağrısı içermez.  
- Yönetim istatistik servisi için düşünülmüş ama kullanılmayan taslak görünümündedir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `getAdminStats()`: Şimdilik sabit `{ users: 0, revenue: 0 }` döner.  

3. DOSYA YOLU  
- `src/admin/adminService.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık yoktur.  
- Aktif frontend sayfalarında doğrudan kullanım tespit edilmedi.  
- Mantıksal olarak admin dashboard servis iskeleti olabilir.  

5. EK NOT  
- Placeholder frontend servisidir.  
- Çalışan admin ekranları bundan değil, doğrudan `fetch` çağrılarından beslenir.  
- Temizlik adayıdır.  

████████████████████████████

DOSYA ADI: `src/auth/authService.ts`  
SATIR SAYISI: 5

1. AMACI  
- Bu dosya frontend auth servis taslağıdır.  
- Gerçek backend auth akışı yerine sabit kullanıcı nesnesi döndürür.  
- Aktif auth mimarisinde kullanılmadığı görülür.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `authenticateUser(credentials)`: Sahte kullanıcı nesnesi döndürür.  

3. DOSYA YOLU  
- `src/auth/authService.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık yoktur.  
- `src/pages/Login.tsx` veya `src/context/AuthContext.tsx` bunu kullanmaz.  
- Gerçek auth akışı `server/routes/auth.ts` üzerinden yürür.  

5. EK NOT  
- Kullanılmayan taslak dosyadır.  
- Aktif auth mimarisiyle paralel ama devre dışıdır.  
- Temizlik adayıdır.  

████████████████████████████

DOSYA ADI: `src/billing/creditService.ts`  
SATIR SAYISI: 9

1. AMACI  
- Bu dosya frontend kredi servisi taslağıdır.  
- Gerçek kredi düşümü/ekleme mantığı burada değil backend’de çalışır.  
- Kullanılmayan placeholder yardımcı dosya niteliğindedir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `checkCredit(userId)`: Şimdilik sabit `100` döner.  
- `deductCredit(userId, amount)`: Placeholder olarak boştur.  

3. DOSYA YOLU  
- `src/billing/creditService.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık yoktur.  
- Aktif sayfalarda doğrudan kullanım tespit edilmedi.  
- Gerçek kredi mantığı `server/services/aiService.ts` ve `server/services/billingService.ts` tarafındadır.  

5. EK NOT  
- Bu dosya canlı mantığın parçası değildir.  
- Sadece erken iskelet olarak kalmıştır.  
- Temizlik adayıdır.  

████████████████████████████

DOSYA ADI: `src/services/aiService.ts`  
SATIR SAYISI: 5

1. AMACI  
- Bu dosya frontend AI servis taslağıdır.  
- Gerçek AI çağrıları yerine sahte cevap döndürür.  
- Aktif AI ekranlarının kullandığı servis bu dosya değildir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `generateContent(prompt)`: Şimdilik `'AI response'` döndürür.  

3. DOSYA YOLU  
- `src/services/aiService.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık yoktur.  
- Aktif AI sayfaları doğrudan `fetch('/api/ai/...')` kullandığı için bu dosya devre dışıdır.  
- Gerçek AI servis mantığı backend’de `server/services/aiService.ts` dosyasındadır.  

5. EK NOT  
- Kullanılmayan frontend servis taslağıdır.  
- Canlı AI akışını etkilemez.  
- Temizlik adayıdır.  

████████████████████████████

DOSYA ADI: `src/utils/logger.ts`  
SATIR SAYISI: 4

1. AMACI  
- Bu dosya basit console tabanlı log yardımcı iskeletidir.  
- Kullanıcı aksiyonunu loglamak için tasarlanmıştır.  
- Bu snapshot’ta aktif kullanım izi görünmüyor.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `logAction(userId, action)`: Console’a kullanıcı aksiyon satırı basar.  

3. DOSYA YOLU  
- `src/utils/logger.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- İç bağımlılık yoktur.  
- Aktif sayfalarda doğrudan kullanım tespit edilmedi.  
- Backend log sistemine bağlı değildir.  

5. EK NOT  
- Yardımcı iskelet dosyasıdır.  
- Operasyonel log altyapısı değildir.  
- Temizlik ya da genişletme adayıdır.  

████████████████████████████

DOSYA ADI: `generate_backend.ts`  
SATIR SAYISI: 166

1. AMACI  
- Bu dosya backend klasör ve başlangıç dosyalarını otomatik üretmek için yazılmış yardımcı script’tir.  
- Çeşitli route, middleware ve db dosyalarının erken iskelet versiyonlarını string olarak üretir.  
- Uygulamanın runtime parçası değildir; geliştirme yardımcı aracıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Bağımsız adlandırılmış gerçek runtime fonksiyonları yoktur; script içinde üretilecek dosya içerikleri string olarak tanımlanır.  
- `dirs.forEach(...)`: Klasörleri oluşturur.  
- `files.forEach(...)`: Dosya içeriklerini hedef yollara yazar.  

3. DOSYA YOLU  
- `generate_backend.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılıklar: Node `fs`, `path`.  
- Hedef klasörler: `server/`, `server/db/`, `server/routes/`, `server/middleware/`, `server/services/`.  
- Aktif runtime akışında kullanılmaz.  

5. EK NOT  
- Bugünkü kodun erken iskelet üreticisi gibi görünür.  
- İçinde üretilen şablonların bazıları bugünkü çalışan dosyalardan daha basittir.  
- Geliştirici yardımcı scriptidir.  

████████████████████████████

DOSYA ADI: `generate_pages.ts`  
SATIR SAYISI: 43

1. AMACI  
- Bu dosya frontend sayfa iskeletlerini otomatik üretmek için yazılmış script’tir.  
- Bir dizi sayfayı “yapım aşamasında” içeriğiyle üretir.  
- Çalışan uygulamanın runtime zincirine dahil değildir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Bağımsız adlandırılmış gerçek runtime fonksiyonları yoktur.  
- `dirs.forEach(...)`: Sayfa klasörlerini oluşturur.  
- `pages.forEach(...)`: Hedef TSX dosyalarını basit placeholder içerikle yazar.  

3. DOSYA YOLU  
- `generate_pages.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılıklar: Node `fs`, `path`.  
- Hedef klasörler: `src/pages`, `src/pages/AI`, `src/pages/Admin`.  
- Aktif runtime akışında kullanılmaz.  

5. EK NOT  
- Erken prototipleme scriptidir.  
- Çalışan ekranlar bugün bu script’in ürettiği placeholderların ötesine geçmiş durumdadır.  
- Geliştirici yardımcı scriptidir.  

████████████████████████████

DOSYA ADI: `package.json`  
SATIR SAYISI: 46

1. AMACI  
- Bu dosya projenin paket manifestidir.  
- Bağımlılıkları ve script komutlarını merkezî olarak tanımlar.  
- Kurulum ve çalıştırma zincirinin ana yapılandırma dosyasıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- Scriptler: `dev`, `start`, `build`, `preview`, `clean`, `lint`.  

3. DOSYA YOLU  
- `package.json`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Tüm proje dosyaları bu manifest üzerinden bağımlılık çözer.  
- `package-lock.json` ile sürüm kilidi kurar.  
- Önemli bağımlılıklar: `express`, `react`, `vite`, `@google/genai`, `cookie-parser`, `jsonwebtoken`, `bcryptjs`, `react-router-dom`, `recharts`, `lucide-react`, `date-fns`, `tailwindcss`.  

5. EK NOT  
- Bu snapshot’ta `better-sqlite3`, `dotenv`, `motion` gibi paketler manifestte bulunmasına rağmen aktif kodda kullanım izi zayıf veya yoktur.  
- `build` script’i yalnızca `vite build` çalıştırırken `start` script’i `dist/server.js` beklediği için build/start zinciri eksik görünür.  
- Kritik yapılandırma dosyasıdır.  

████████████████████████████

DOSYA ADI: `package-lock.json`  
SATIR SAYISI: 5845

1. AMACI  
- Bu dosya bağımlılık ağacının tam sürüm kilidini tutar.  
- Farklı ortamlarda aynı bağımlılık çözümlemesini tekrar üretmeye yarar.  
- NPM kurulumunun deterministik olmasını sağlar.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- NPM tarafından üretilen kilit veri dosyasıdır.  

3. DOSYA YOLU  
- `package-lock.json`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Doğrudan `package.json` ile ilişkilidir.  
- Tüm `node_modules` çözümlemesi bu dosyadaki sürümlere dayanır.  
- Runtime mantık taşımaz.  

5. EK NOT  
- Bu dosya el ile iş mantığı yazılan yer değildir.  
- Ama kurulum tutarlılığı açısından kritik önemdedir.  
- Üretilmiş kilit dosyasıdır.  

████████████████████████████

DOSYA ADI: `vite.config.ts`  
SATIR SAYISI: 24

1. AMACI  
- Bu dosya Vite derleme ve geliştirme ayarlarını tanımlar.  
- React ve Tailwind plugin’lerini bağlar, alias kurar ve env değerini define eder.  
- Frontend geliştirme deneyiminin altyapı dosyasıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- `defineConfig(({ mode }) => ...)`: Mode’a göre env okuyup Vite config nesnesini döner.  

3. DOSYA YOLU  
- `vite.config.ts`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Harici bağımlılıklar: `@tailwindcss/vite`, `@vitejs/plugin-react`, `path`, `vite`.  
- Frontend giriş dosyaları ve tüm build zinciri bu config’ten etkilenir.  
- Frontend bundle’a AI sağlayıcı anahtarı enjekte edilmez; AI çağrıları backend sınırı arkasında tutulur.  

5. EK NOT  
- HMR davranışı `DISABLE_HMR` env değişkenine bağlıdır.  
- Dosyada karakter bozulmalı bir yorum satırı görülüyor (`Do not modifyâ...`), ama mantığı etkilemiyor.  
- Kritik build/dev config dosyasıdır.  

████████████████████████████

DOSYA ADI: `tsconfig.json`  
SATIR SAYISI: 26

1. AMACI  
- Bu dosya TypeScript derleme davranışını tanımlar.  
- JSX, module resolution, alias ve hedef platform ayarları burada belirlenir.  
- TS/TSX kaynaklarının ortak derleme sözleşmesidir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- `compilerOptions`: TS davranış ayarlarını taşır.  

3. DOSYA YOLU  
- `tsconfig.json`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Tüm `.ts` ve `.tsx` dosyaları bundan etkilenir.  
- `vite.config.ts` ve editör/type-check zinciriyle ilişkilidir.  
- Alias `@/*` burada tanımlanmıştır.  

5. EK NOT  
- `noEmit: true` olduğu için TypeScript doğrudan build artifact üretmez.  
- Bu, `package.json` içindeki build/start zinciriyle birlikte düşünülmesi gereken bir noktadır.  
- Kritik derleme config dosyasıdır.  

████████████████████████████

DOSYA ADI: `.env.example`  
SATIR SAYISI: 9

1. AMACI  
- Bu dosya gerekli environment değişkenleri için örnek şablon sağlar.  
- Geliştiriciye hangi secret ve URL değerlerinin beklendiğini gösterir.  
- Kurulum/dokümantasyon yardımcı dosyasıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- Değişkenler: `APP_URL`, `PUTER_OWNER_AI_BASE_URL`, `PUTER_OWNER_AI_TOKEN`.  

3. DOSYA YOLU  
- `.env.example`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- `server/services/aiService.ts` owner runtime (`PUTER_OWNER_AI_BASE_URL`, `PUTER_OWNER_AI_TOKEN`) ile ilişkilidir.  
- `vite.config.ts` env yüklemesiyle ilişkilidir.  
- Dağıtım ve local kurulum adımlarında referans dosyasıdır.  

5. EK NOT  
- Gerçek secret bu dosyada tutulmaz.  
- Referans şablondur.  
- Kritik kurulum dosyasıdır.  

████████████████████████████

DOSYA ADI: `metadata.json`  
SATIR SAYISI: 5

1. AMACI  
- Bu dosya uygulamanın üst veri tanımını taşır.  
- Uygulama adı, açıklaması ve istenen frame izinleri burada yer alır.  
- Çalıştırma/dağıtım ortamı için meta bilgi sağlar.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- Alanlar: `name`, `description`, `requestFramePermissions`.  

3. DOSYA YOLU  
- `metadata.json`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Doğrudan runtime import bağımlılığı tespit edilmedi.  
- Platform/host ortamı tarafından okunmak üzere tasarlanmış görünür.  
- İzinler kamera, mikrofon ve geolocation içerir.  

5. EK NOT  
- Meta/config dosyasıdır.  
- İş mantığı içermez.  
- Dağıtım bağlamı için önemlidir.  

████████████████████████████

DOSYA ADI: `src/index.css`  
SATIR SAYISI: 1

1. AMACI  
- Bu dosya frontend’in global CSS giriş dosyasıdır.  
- Tailwind CSS import’u burada yapılır.  
- Stil zinciri bu tek satırdan başlar.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- İçerik: `@import "tailwindcss";`  

3. DOSYA YOLU  
- `src/index.css`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Kullanan dosya: `src/main.tsx`.  
- Harici bağımlılık: Tailwind CSS.  
- Tüm frontend görselliği dolaylı olarak bu giriş import’undan etkilenir.  

5. EK NOT  
- Minimal ama kritik stil giriş dosyasıdır.  
- Uygulama stil zincirinin kapısıdır.  
- Altyapısal CSS dosyasıdır.  

████████████████████████████

DOSYA ADI: `.gitignore`  
SATIR SAYISI: 8

1. AMACI  
- Bu dosya Git’e dahil edilmemesi gereken dosyaları tanımlar.  
- Secret, bağımlılık klasörleri ve build çıktılarının repo dışında kalmasını sağlar.  
- Kaynak kontrol hijyeninin temel dosyasıdır.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- Ignore pattern listesi taşır.  

3. DOSYA YOLU  
- `.gitignore`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Dolaylı olarak tüm depo içeriğiyle ilişkilidir.  
- Özellikle `.env*`, `node_modules`, `dist`, loglar ve benzeri üretilen dosyaları etkiler.  
- Git davranışını belirler.  

5. EK NOT  
- Runtime mantık içermez.  
- Fakat güvenlik ve depo temizliği açısından önemlidir.  
- Yardımcı yapılandırma dosyasıdır.  

████████████████████████████

DOSYA ADI: `README.md`  
SATIR SAYISI: 20

1. AMACI  
- Bu dosya projeyle gelen mevcut varsayılan README’dir.  
- İçeriği daha çok local çalıştırma ve platform bağlantısı anlatır.  
- Sistem mimarisi ve dosya envanteri açısından yetersizdir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- Metinsel dokümantasyon dosyasıdır.  

3. DOSYA YOLU  
- `README.md`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- `package.json` script’lerine ve `.env.local` kurulumuna referans verir.  
- Çalışan kod tarafından import edilmez.  
- Bu yeni dokümantasyon metni onun yerini alacak kapsamda düşünülmüştür.  

5. EK NOT  
- Dokümantasyon dosyasıdır.  
- İçeriği sistem derinliği açısından güncellenmelidir.  
- Mevcut hali operasyonel README seviyesi değildir.  

████████████████████████████

DOSYA ADI: `server/db/kv.json`  
SATIR SAYISI: 0  
DOSYA BOYUTU: 0 byte (yalnızca bu zip snapshot’ı için)

1. AMACI  
- Bu dosya `server/db/kv.ts` tarafından kullanılan fiziksel JSON veri deposudur.  
- Uygulama çalışırken kullanıcılar, ödemeler, ledger kayıtları, usage logları, model kayıtları ve diğer KV verileri burada tutulabilir.  
- İçeriği sabit değildir; bu zip snapshot’ında boştur, ancak çalışan bir local instance’ta çok büyük bir runtime veri dosyasına dönüşebilir.  

2. İÇİNDE BULUNAN FONKSİYONLAR VE AMAÇLARI  
- Fonksiyon tanımı yoktur.  
- Kaynak kod değil, runtime veri snapshot dosyasıdır.  

3. DOSYA YOLU  
- `server/db/kv.json`

4. BAĞIMLILIKLAR / DOSYALAR ARASI İLİŞKİLER  
- Doğrudan `server/db/kv.ts` tarafından okunur ve yazılır.  
- Dolaylı olarak `kv` kullanan tüm backend modülleri (`authService`, `aiService`, `billingService`, admin/user route’ları, model seed akışı) bu dosyada tutulan verilerden etkilenir.  
- Runtime’da sistemin ana kalıcılık hedefidir.  

5. EK NOT  
- Bu dosya için “boştur” ifadesi yalnızca **yüklenen zip snapshot’ı** için doğrudur.  
- Çalışmış bir local ortamda aynı dosyanın on binlerce satıra büyümesi normaldir.  
- README içinde bunu statik proje dosyası gibi değil, **runtime data store** olarak sınıflandırmak en doğrusudur.  

████████████████████████████

## DİĞER KAYNAK / YARDIMCI / ERKEN İSKELET DOSYALARI

DOSYA ADI: `src/pages/Admin/AdminDashboard.tsx`, `src/pages/Admin/AdminUsers.tsx`, `src/pages/Admin/AdminPayments.tsx`, `src/pages/Admin/AdminLogs.tsx`, `src/pages/Admin/AdminModels.tsx`
- Bu dosyalar admin ekranlarının aktif frontend katmanıdır.
- Tamamı doğrudan `fetch` ile backend admin route’larına bağlanır.
- Özellikle `AdminModels.tsx` ve `AdminUsers.tsx` operasyonel etkisi en yüksek iki admin ekranıdır.

DOSYA ADI: `src/admin/adminService.ts`, `src/auth/authService.ts`, `src/billing/creditService.ts`, `src/services/aiService.ts`, `src/utils/logger.ts`, `src/api/index.ts`
- Bunlar erken iskelet / placeholder / kullanılmayan yardımcı dosyalardır.
- Aktif çalışma zinciri bunlar üzerinden değil, doğrudan route + fetch yaklaşımı üzerinden yürür.
- Temizlik veya yeniden tasarım adaylarıdır.

████████████████████████████

## SİSTEM AKIŞI — MADDE MADDE

1. Tarayıcı `index.html` içindeki `#root` alanına `src/main.tsx` üzerinden React uygulamasını yükler.  
2. `src/App.tsx`, `AuthProvider`, route haritası ve korumalı alan yapısını kurar.  
3. `src/context/AuthContext.tsx`, uygulama açılışında `/api/auth/me` çağrısı yaparak mevcut oturumu doğrular.  
4. Kullanıcı giriş/kayıt ekranında `src/pages/Login.tsx` veya `src/pages/Register.tsx` üzerinden `/api/auth/*` endpoint’lerine gider.  
5. `server/routes/auth.ts` -> `server/services/authService.ts` -> `server/db/kv.ts` zinciri kullanıcı kaydı, giriş doğrulaması ve JWT cookie üretimini tamamlar.  
6. Giriş başarılı olunca `ProtectedRoute` ve `Layout` korumalı kullanıcı alanlarını açar.  
7. Kullanıcı AI sayfalarından birinde üretim başlattığında ilgili sayfa `/api/ai/*` endpoint’ine istek atar.  
8. `server/routes/ai.ts`, `requireAuth` ile kullanıcıyı doğrular ve isteği `aiService` veya `musicAdapter` içine yönlendirir.  
9. `server/services/aiService.ts` owner runtime çağrısını normalize eder; başarılı çağrılarda kredi/usage kaydını işler, job işlerinde polling sözleşmesini sürdürür.  
10. Görsel/TTS tarafında fiziksel dosya gerekiyorsa `server/db/fs.ts` dosya yazar; metadata `server/db/kv.ts` içine `assets:*` olarak kaydedilir.  
11. Kullanıcı `Account`, `Assets`, `UsageHistory`, `CreditHistory` ekranlarından `/api/user/*` endpoint’leriyle kendi verilerini geri okur.  
12. Satın alma akışında `Billing` ve `Checkout` sayfaları `/api/billing/packages` ve `/api/billing/checkout` çağrılarıyla ödeme başlatır.  
13. `billingService` ödeme kaydı oluşturur; webhook başarıyla işlenirse kullanıcıya kredi eklenir ve ledger kaydı yazılır.  
14. Admin sayfaları `/api/admin/*` uçlarına gider; burada kullanıcılar, ödemeler, loglar ve modeller okunur/güncellenir.  
15. Uygulama açılışında `ensureModelsSeeded()` modeli sıfırdan doldurur; admin isterse dış servis üzerinden fiyat/kur senkronizasyonu çalıştırabilir.  
16. Ana uygulamadan ayrı olarak `worker.js` -> `puter-sync.ts` -> `pricing.ts` -> `fx-rate.ts` hattı, fiyat katalog verisini ayrı bir KV tabanlı worker API olarak sunar.  

████████████████████████████

## ASCII MAKET — SİSTEM FLOW

[ Browser ]
    |
    v
[index.html]
    |
    v
[src/main.tsx]
    |
    v
[src/App.tsx]
    |
    +------------------------------+
    |                              |
    v                              v
[AuthProvider]               [Route Map]
    |                              |
    v                              v
[src/context/AuthContext.tsx] ---> [ProtectedRoute]
    |                                   |
    | /api/auth/me                      |
    v                                   v
========================= BACKEND =========================
                        [server.ts]
                            |
        +-------------------+-------------------+-------------------+-------------------+
        |                   |                   |                   |                   |
        v                   v                   v                   v                   v
   [/api/auth]         [/api/ai]         [/api/billing]        [/api/user]        [/api/admin]
 auth.ts               ai.ts             billing.ts            user.ts             admin.ts
    |                    |                   |                   |                   |
    v                    v                   v                   v                   v
authService.ts      aiService.ts       billingService.ts       kv.ts               kv.ts
    |                |     \                 |                  |                   |
    |                |      \                |                  |                   |
    v                |       \               v                  v                   v
  kv.ts              |    musicAdapter.ts   kv.ts        profile/assets/     users/payments/
                     |                       |           usage/credits        logs/models/sync
                     |
                     +------> fileSystem.ts ------> .data/fs/*
                     |
                     +------> Owner Runtime API
                     |
                     +------> creditLedger:* / usage:* / assets:*

========================= USER FLOW =========================

[Login / Register]
    -> /api/auth/register or /api/auth/login
    -> authService.ts
    -> kv.ts
    -> JWT cookie
    -> AuthContext user state

[Chat / Image / Video / TTS]
    -> /api/ai/*
    -> requireAuth
    -> aiService.ts
    -> kredi kontrolü
    -> üretim / simülasyon
    -> usage log
    -> credit ledger
    -> asset metadata (+ gerekirse fileSystem)

[Billing / Checkout]
    -> /api/billing/packages
    -> /api/billing/checkout
    -> billingService.ts
    -> payments:* kaydı
    -> mock checkout page
    -> webhook
    -> addCredits()
    -> user toplam_kredi + creditLedger:*

[User Panel]
    -> /api/user/profile
    -> /api/user/assets
    -> /api/user/usage
    -> /api/user/credits
    -> kv.ts
    -> kullanıcı ekranı

[Admin Panel]
    -> /api/admin/summary
    -> /api/admin/users
    -> /api/admin/payments
    -> /api/admin/logs
    -> /api/admin/models*
    -> admin.ts
    -> kv.ts + dış kur/fiyat servisleri
    -> yönetim ekranları

===================== AYRI WORKER FLOW =====================

[worker.js]
    |
    +--> GET /api/prices
    |       -> puter-sync.ts
    |       -> readCatalog()
    |       -> getCatalogWithTryPrices()
    |
    +--> POST /api/refresh
            -> secret kontrolü
            -> pricing.ts (scrape)
            -> fx-rate.ts (kur dönüşümü)
            -> KV write
            -> güncel katalog
