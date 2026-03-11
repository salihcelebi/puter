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
import { kv } from "./db/kv.js";
import { ensureModelsSeeded } from "./db/seed-model-prices.js";

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

  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post('/api/test-sync', async (req, res) => {
    try {
      let rate = 35.0;
      try {
        const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml');
        const xmlText = await response.text();
        const match = xmlText.match(/<Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">[\s\S]*?<ForexSelling>(.*?)<\/ForexSelling>/);
        if (match && match[1]) {
          rate = parseFloat(match[1]);
        }
      } catch (e) {
        console.error('TCMB fetch error during sync:', e);
        try {
          const fallback = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
          const data = await fallback.json();
          rate = data.rates.TRY;
        } catch (fallbackError) {
          console.error('Fallback rate fetch error:', fallbackError);
        }
      }

      const pricesRes = await fetch('https://turk.puter.work/api/prices');
      if (!pricesRes.ok) throw new Error('Fiyatlar alınamadı');
      const pricesData = await pricesRes.json();
      const rawPrices = Array.isArray(pricesData) ? pricesData : (pricesData.rows || []);

      const now = new Date().toISOString();
      const existingModels = await kv.list('model:');
      const existingMap = new Map(existingModels.map(m => [m.value.id, m.value]));

      for (const p of rawPrices) {
        const id = `${p.provider}_${p.model}`.replace(/[^a-zA-Z0-9_-]/g, '_');
        const existing = existingMap.get(id);

        const profitMultiplier = existing?.profit_multiplier || 1;
        const isActive = existing?.is_active ?? false;

        let singlePrice = null;
        if (p.service_type !== 'llm') {
          singlePrice = p.image_price ?? p.video_price ?? p.input_price ?? p.output_price ?? null;
        }

        const modelRecord = {
          id,
          provider_name: p.provider,
          model_name: p.model,
          service_type: p.service_type,
          billing_unit: p.price_unit || '',
          is_active: isActive,

          raw_cost_input_usd: p.input_price,
          raw_cost_output_usd: p.output_price,
          raw_cost_single_usd: singlePrice,

          usd_try_rate: rate,

          raw_cost_input_try: p.input_price !== null ? Number((p.input_price * rate).toFixed(4)) : null,
          raw_cost_output_try: p.output_price !== null ? Number((p.output_price * rate).toFixed(4)) : null,
          raw_cost_single_try: singlePrice !== null ? Number((singlePrice * rate).toFixed(4)) : null,

          profit_multiplier: profitMultiplier,

          sale_cost_input_usd: p.input_price !== null ? Number((p.input_price * profitMultiplier).toFixed(4)) : null,
          sale_cost_output_usd: p.output_price !== null ? Number((p.output_price * profitMultiplier).toFixed(4)) : null,
          sale_cost_single_usd: singlePrice !== null ? Number((singlePrice * profitMultiplier).toFixed(4)) : null,

          sale_cost_input_try: p.input_price !== null ? Number((p.input_price * profitMultiplier * rate).toFixed(4)) : null,
          sale_cost_output_try: p.output_price !== null ? Number((p.output_price * profitMultiplier * rate).toFixed(4)) : null,
          sale_cost_single_try: singlePrice !== null ? Number((singlePrice * profitMultiplier * rate).toFixed(4)) : null,

          sale_credit_input: p.input_price !== null ? Math.ceil(p.input_price * profitMultiplier * 100) : null,
          sale_credit_output: p.output_price !== null ? Math.ceil(p.output_price * profitMultiplier * 100) : null,
          sale_credit_single: singlePrice !== null ? Math.ceil(singlePrice * profitMultiplier * 100) : null,

          metadata_json: p,
          last_rate_sync_at: now,
          last_price_sync_at: now,
          created_at: existing?.created_at || now,
          updated_at: now
        };

        await kv.set(`model:${id}`, modelRecord);
      }

      res.json({ success: true, count: rawPrices.length });
    } catch (error) {
      console.error('Sync error:', error);
      res.status(500).json({ error: 'Senkronizasyon başarısız: ' + (error instanceof Error ? error.message : String(error)) });
    }
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
