/*
█████████████████████████████████████████████
1) BU DOSYA, BACKEND'İN ANA EXPRESS UYGULAMA FABRİKASIDIR.
2) dotenv.config() İLE ENV YÜKLENİR VE UYGULAMA BAŞLANGICI HAZIRLANIR.
3) authRouter, billingRouter, aiRouter, adminRouter, assetsRouter VE userRouter BU DOSYADA BİRLEŞTİRİLİR.
4) fileSystem.init() ÇAĞRISI, DOSYA TABANLI DEPOLAMA KATMANINI BAŞLANGIÇTA HAZIR EDER.
5) authService.ensureSystemUsersFromEnv() ÇAĞRISI, ENV TABANLI SİSTEM KULLANICILARINI OTOMATİK OLUŞTURMAK İÇİN KULLANILIR.
6) ensureModelsSeeded() ÇAĞRISI, MODEL / FİYAT VERİSİNİN İLK BAŞLANGIÇTA SEED EDİLMESİNİ SAĞLAR.
7) initPromise YAPISI, BAŞLATMA İŞLEMLERİNİN BİRDEN FAZLA KEZ DEĞİL TEK SEFER GÜVENLİ ÇALIŞMASINI SAĞLAR.
8) createApiApp() İÇİNDE express.json() VE cookieParser() MIDDLEWARE'LERİ DEVREYE ALINIR.
9) /api/health ENDPOINT'I, SADECE “SUNUCU AYAKTA MI?” DEĞİL, AYNI ZAMANDA AI RUNTIME DURUMU VE VISIBLE MODEL SAYISI GİBİ BİLGİLERİ DE DÖNER.
10) aiService.isOwnerRuntimeConfigured() DEĞERİ, OWNER RUNTIME AYARININ HAZIR OLUP OLMADIĞINI GÖSTERİR.
11) aiService.listVisibleModels() İLE HEALTH ÇIKTISINDA GÖRÜNÜR MODEL SAYISI PAYLAŞILIR.
12) TÜM ANA ROUTE GRUPLARI /api/* ALTINDA MOUNT EDİLİR.
13) /api ALTINDA TANIMSIZ BİR ENDPOINT GELİRSE JSON TABANLI API_NOT_FOUND HATASI DÖNÜLÜR.
14) GLOBAL ERROR HANDLER, headersSent DEĞİLSE INTERNAL_SERVER_ERROR JSON'U DÖNER.
15) KISACA: BU DOSYA, BAŞLATMA, ROUTE BAĞLAMA, HEALTH KONTROLÜ VE MERKEZİ HATA YÖNETİMİNİ TEK YERDE TOPLAYAN ANA BACKEND GİRİŞİDİR.
█████████████████████████████████████████████
*/
import express from "express";
import cookieParser from "cookie-parser";
import dotenv from "dotenv";

import { authRouter } from "./routes/auth.js";
import { billingRouter } from "./routes/billing.js";
import { aiRouter } from "./routes/ai.js";
import { adminRouter } from "./routes/admin.js";
import { assetsRouter } from "./routes/assets.js";
import { userRouter } from "./routes/user.js";
import { fileSystem } from "./db/fs.js";
import { authService } from "./services/authService.js";
import { ensureModelsSeeded } from "./db/seed-model-prices.js";
import { aiService } from "./services/aiService.js";

dotenv.config();

let initPromise: Promise<void> | null = null;

async function ensureInitialized() {
  if (!initPromise) {
    initPromise = (async () => {
      await fileSystem.init();
      // DELILX: boot sırası ENV USERS -> model seed zincirini güvenli ve deterministik çalıştırır.
      await authService.ensureSystemUsersFromEnv();
      await ensureModelsSeeded();
    })();
  }

  await initPromise;
}

export async function createApiApp() {
  await ensureInitialized();

  const app = express();

  app.use(express.json());
  app.use(cookieParser());

  app.get("/api/health", async (req, res) => {
    // Part 2: expose owner-runtime readiness without leaking secrets.
    const models = await aiService.listVisibleModels();
    res.json({
      status: "ok",
      ai: {
        ownerRuntimeConfigured: aiService.isOwnerRuntimeConfigured(),
        jobsEndpointEnabled: true,
        visibleModelCount: models.length,
      },
    });
  });



  app.use("/api/auth", authRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/assets", assetsRouter);
  app.use("/api/user", userRouter);

  app.use('/api', (req, res) => {
    res.status(404).json({
      success: false,
      error: 'API endpoint bulunamadı',
      code: 'API_NOT_FOUND',
    });
  });

  app.use((error: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error('Unhandled server error:', error);
    if (res.headersSent) {
      return next(error);
    }

    return res.status(500).json({
      success: false,
      error: 'Sunucu hatası',
      code: 'INTERNAL_SERVER_ERROR',
    });
  });

  return app;
}
