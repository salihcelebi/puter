# puter

## Mimari (Kesin Karar)

Bu repo için kalıcı çözüm **Option A**: 

- Frontend: Netlify (Vite static build)
- Backend API/Auth: Ayrı Node/Express host (örn. Render)

`/api/auth/*` endpoint'leri Express üzerinde çalıştığı için yalnızca static Netlify yayını ile login çalışmaz.
Frontend bu yüzden `VITE_API_BASE_URL` ile backend hostuna gider.

## Gerekli Ortam Değişkenleri

### Backend
- `JWT_SECRET` (zorunlu, en az 32 karakter)
- `ADMIN_USERNAME` (zorunlu)
- `ADMIN_PASSWORD` (zorunlu)
- `ADMIN_EMAIL` (opsiyonel)
- `GEMINI_API_KEY` (AI uçları için)

### Frontend (Netlify)
- `VITE_API_BASE_URL=https://<backend-host>`

## Geliştirme

1. Bağımlılıkları yükleyin: `npm install`
2. `.env` oluşturun: `.env.example` dosyasını kopyalayın
3. Sunucuyu başlatın: `npm run dev`

## Build / Start

- Frontend build: `npm run build`
- Production server: `npm start`

## Netlify Production Deploy

```bash
NETLIFY_AUTH_TOKEN=... NETLIFY_SITE_ID=... npx netlify deploy --build --prod
```

Deploy öncesi Netlify ortamında mutlaka `VITE_API_BASE_URL` tanımlayın.
