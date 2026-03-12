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
      await authService.ensureAdminFromEnv();
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
