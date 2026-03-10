# puter

## Geliştirme

1. Bağımlılıkları yükleyin:
   `npm install`
2. `.env` dosyanızı oluşturun (`.env.example` kopyalanabilir).
3. Sunucu + frontend birlikte çalıştırın:
   `npm run dev`

## Build / Start

- Frontend build: `npm run build`
- Production server başlatma: `npm start`

`npm start`, `server.ts` üzerinden Express API'yi ayağa kaldırır ve `dist` içindeki frontend build'ini servis eder.

## Deploy Notu (Auth için kritik)

Bu projede auth endpoint'leri (`/api/auth/*`) Express backend üzerinde çalışır.

Eğer frontend ayrı bir hostta (ör. Netlify) yayınlanıyorsa, frontend ortamına aşağıdaki değişkeni verin:

- `VITE_API_BASE_URL=https://<backend-host>`

Böylece login/register/me/logout çağrıları backend'e yönlenir ve JSON parse hataları engellenir.
