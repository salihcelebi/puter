import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";
import cookieParser from "cookie-parser";

import { authRouter } from "./server/routes/auth.js";
import { billingRouter } from "./server/routes/billing.js";
import { aiRouter } from "./server/routes/ai.js";
import { adminRouter } from "./server/routes/admin.js";
import { assetsRouter } from "./server/routes/assets.js";
import { userRouter } from "./server/routes/user.js";
import { fileSystem } from "./server/db/fs.js";
import { authService } from "./server/services/authService.js";
import { kv } from "./server/db/kv.js";
import { ensureModelsSeeded } from "./server/db/seed-model-prices.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  // Initialize FS
  await fileSystem.init();
  
  // Ensure default admin user exists
  await authService.ensureDefaultAdmin();

  // Ensure models are seeded
  await ensureModelsSeeded();

  app.use(express.json());
  app.use(cookieParser());

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  app.post('/api/test-sync', async (req, res) => {
    try {
      let rate = 35.0; // Fallback
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
      if (!pricesRes.ok) throw new Error('Fiyatlar alÄ±namadÄ±');
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
      res.status(500).json({ error: 'Senkronizasyon baÅŸarÄ±sÄ±z: ' + (error instanceof Error ? error.message : String(error)) });
    }
  });

  // Use routers
  app.use("/api/auth", authRouter);
  app.use("/api/billing", billingRouter);
  app.use("/api/ai", aiRouter);
  app.use("/api/admin", adminRouter);
  app.use("/api/assets", assetsRouter);
  app.use("/api/user", userRouter);

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.join(__dirname, "dist")));
    app.get("*", (req, res) => {
      res.sendFile(path.join(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

