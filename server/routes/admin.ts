import { Router } from 'express';
import { kv } from '../db/kv.js';
import { requireAdmin, AuthRequest } from '../middleware/auth.js';
import { getPricingSettings, updatePricingSettings } from '../db/fiyatlandirma/fiyatlandirma.js';
import { modelCatalogService } from '../services/modelCatalogService.js';

export const adminRouter = Router();

adminRouter.use(requireAdmin);

// Pricing Endpoints
adminRouter.get('/pricing', async (req: AuthRequest, res) => {
  try {
    const pricing = getPricingSettings();
    res.json(pricing);
  } catch (error) {
    res.status(500).json({ error: 'Fiyatlandırma ayarları alınamadı' });
  }
});

adminRouter.put('/pricing', async (req: AuthRequest, res) => {
  try {
    const { creditPerUsd } = req.body;
    if (typeof creditPerUsd !== 'number' || creditPerUsd <= 0) {
      return res.status(400).json({ error: 'Geçersiz kredi oranı' });
    }
    
    const updatedBy = req.user?.email || 'admin';
    const newSettings = updatePricingSettings(creditPerUsd, updatedBy);
    
    // Update all models with new ratio
    const models = await kv.list('model:');
    for (const m of models) {
      const model = m.value;
      const pm = Number(model.margin_multiplier ?? model.profit_multiplier ?? 1) || 1;
      
      model.sale_credit_input = model.raw_cost_input_usd !== null ? Math.ceil(model.raw_cost_input_usd * pm * creditPerUsd) : null;
      model.sale_credit_output = model.raw_cost_output_usd !== null ? Math.ceil(model.raw_cost_output_usd * pm * creditPerUsd) : null;
      model.sale_credit_single = model.raw_cost_single_usd !== null ? Math.ceil(model.raw_cost_single_usd * pm * creditPerUsd) : null;
      
      await kv.set(`model:${model.id}`, model);
    }
    
    res.json({ success: true, pricing: newSettings });
  } catch (error) {
    res.status(500).json({ error: 'Fiyatlandırma ayarları güncellenemedi' });
  }
});

// Dashboard Summary
adminRouter.get('/exchange-rate', async (req: AuthRequest, res) => {
  try {
    const response = await fetch('https://www.tcmb.gov.tr/kurlar/today.xml');
    const xmlText = await response.text();
    const match = xmlText.match(/<Currency CrossOrder="0" Kod="USD" CurrencyCode="USD">[\s\S]*?<ForexSelling>(.*?)<\/ForexSelling>/);
    if (match && match[1]) {
      const rate = parseFloat(match[1]);
      res.json({ rate });
    } else {
      throw new Error('USD rate not found in XML');
    }
  } catch (error) {
    console.error('TCMB fetch error:', error);
    try {
      const fallback = await fetch('https://api.exchangerate-api.com/v4/latest/USD');
      const data = await fallback.json();
      res.json({ rate: data.rates.TRY });
    } catch (fallbackError) {
      res.status(500).json({ error: 'Kur bilgisi alınamadı' });
    }
  }
});

adminRouter.get('/summary', async (req: AuthRequest, res) => {
  try {
    const users = await kv.list('users:');
    const payments = await kv.list('payments:');
    const usages = await kv.list('usage:');
    const models = await kv.list('model:');
    const assets = await kv.list('assets:');
    const errors = await kv.list('errors:');
    
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    
    const userValues = users.map(u => u.value);
    const paymentValues = payments.map(p => p.value);
    const usageValues = usages.map(u => u.value);
    const modelValues = models.map(m => m.value);
    const assetValues = assets.map(a => a.value);
    const errorValues = errors.map(e => e.value);

    // Basic Metrics
    const totalUsers = userValues.length;
    
    const todayActiveUsers = new Set(
      usageValues.filter(u => u.created_at?.startsWith(todayStr)).map(u => u.kullanici_id)
    ).size;

    const todayCreditUsage = usageValues
      .filter(u => u.created_at?.startsWith(todayStr) && u.durum === 'completed')
      .reduce((sum, u) => sum + (u.kredi_maliyeti || 0), 0);

    const todayRevenue = paymentValues
      .filter(p => p.created_at?.startsWith(todayStr) && p.durum === 'success')
      .reduce((sum, p) => sum + (p.tutar_tl || 0), 0);

    const pendingPaymentsCount = paymentValues.filter(p => p.durum === 'pending').length;
    const activeModelsCount = modelValues.filter(m => m.is_active).length;

    const totalSales = paymentValues
      .filter(p => p.durum === 'success')
      .reduce((sum, p) => sum + (p.tutar_tl || 0), 0);
      
    const totalCreditsSold = paymentValues
      .filter(p => p.durum === 'success')
      .reduce((sum, p) => sum + (p.kredi_miktari || 0), 0);
      
    const totalCreditsUsed = usageValues
      .filter(u => u.durum === 'completed')
      .reduce((sum, u) => sum + (u.kredi_maliyeti || 0), 0);
      
    const totalInternalCost = usageValues
      .filter(u => u.durum === 'completed')
      .reduce((sum, u) => sum + (u.ic_maliyet || 0), 0);

    // Recent Activity (Mix of new users, payments, usages)
    const recentUsers = userValues.map(u => ({ type: 'user_registered', date: u.created_at, data: u }));
    const recentPayments = paymentValues.map(p => ({ type: 'payment', date: p.created_at, data: p }));
    const recentUsages = usageValues.map(u => ({ type: 'usage', date: u.created_at, data: u }));
    
    const recentActivity = [...recentUsers, ...recentPayments, ...recentUsages]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 10);

    // System Preview (Assets)
    const recentAssets = assetValues
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 8);

    // Charts Data
    const last7Days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dStr = d.toISOString().split('T')[0];
      
      const dayUsages = usageValues.filter(u => u.created_at?.startsWith(dStr) && u.durum === 'completed');
      const dayPayments = paymentValues.filter(p => p.created_at?.startsWith(dStr) && p.durum === 'success');
      
      last7Days.push({
        date: d.toLocaleDateString('tr-TR', { weekday: 'short' }),
        fullDate: dStr,
        usage: dayUsages.reduce((sum, u) => sum + (u.kredi_maliyeti || 0), 0),
        revenue: dayPayments.reduce((sum, p) => sum + (p.tutar_tl || 0), 0),
        cost: dayUsages.reduce((sum, u) => sum + (u.ic_maliyet || 0), 0)
      });
    }

    const toolUsageMap = new Map();
    usageValues.forEach(u => {
      if (u.durum === 'completed') {
        const current = toolUsageMap.get(u.modul) || 0;
        toolUsageMap.set(u.modul, current + 1);
      }
    });
    const toolUsage = Array.from(toolUsageMap.entries()).map(([name, value]) => ({ name, value }));

    // Alerts
    const recentErrors = errorValues
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);
      
    const failedPayments = paymentValues
      .filter(p => p.durum === 'failed' || p.durum === 'cancelled')
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, 5);

    res.json({
      metrics: {
        totalUsers,
        todayActiveUsers,
        todayCreditUsage,
        todayRevenue,
        pendingPaymentsCount,
        activeModelsCount,
        totalSales,
        totalCreditsSold,
        totalCreditsUsed,
        totalInternalCost
      },
      recentActivity,
      recentAssets,
      charts: {
        last7Days,
        toolUsage
      },
      alerts: {
        recentErrors,
        failedPayments
      }
    });
  } catch (error) {
    console.error('Admin summary error:', error);
    res.status(500).json({ error: 'Özet bilgileri alınamadı' });
  }
});

// Users Management
adminRouter.get('/models/stats', async (req: AuthRequest, res) => {
  try {
    // Part 2.5: admin model state persists in model:* records.
    const stats = await modelCatalogService.getUsageStats();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: 'Model istatistikleri alınamadı' });
  }
});

adminRouter.get('/settings/models', async (req: AuthRequest, res) => {
  try {
    const settings = await kv.get('settings:models') || {
      chat: 'gemini-3.1-pro-preview',
      image: 'gemini-3.1-flash-image-preview',
      video: 'veo-3.1-fast-generate-preview',
      tts: 'gemini-2.5-flash-preview-tts',
      music: 'placeholder-music-provider'
    };
    res.json(settings);
  } catch (error) {
    res.status(500).json({ error: 'Model ayarları alınamadı' });
  }
});

adminRouter.post('/settings/models', async (req: AuthRequest, res) => {
  try {
    const settings = req.body;
    await kv.set('settings:models', settings);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Model ayarları kaydedilemedi' });
  }
});

// Advanced Model Management
import { USD_TRY_RATE_KEY, ensureModelsSeeded } from '../db/seed-model-prices.js';

adminRouter.get('/models', async (req: AuthRequest, res) => {
  try {
    const models = await modelCatalogService.listModels({
      tab: req.query.tab,
      provider: req.query.provider,
      modelName: req.query.modelName,
      serviceType: req.query.serviceType,
      minInputCost: req.query.minInputCost,
      maxInputCost: req.query.maxInputCost,
      minOutputCost: req.query.minOutputCost,
      maxOutputCost: req.query.maxOutputCost,
      sortBy: req.query.sortBy,
      sortDir: req.query.sortDir,
    });
    res.json(models);
  } catch (error) {
    res.status(500).json({ error: 'Modeller alınamadı' });
  }
});

// Temporary endpoint for testing
adminRouter.post('/models/sync-test', async (req, res) => {
  try {
    // 1. Fetch exchange rate
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

    // 2. Fetch prices from provider
    const pricesRes = await fetch('https://turk.puter.work/api/prices');
    if (!pricesRes.ok) throw new Error('Fiyatlar alınamadı');
    const pricesData = await pricesRes.json();
    const rawPrices = Array.isArray(pricesData) ? pricesData : (pricesData.rows || []);

    // 3. Sync to KV
    await kv.set(USD_TRY_RATE_KEY, rate);
    const now = new Date().toISOString();
    const existingModels = await kv.list('model:');
    const existingMap = new Map(existingModels.map(m => [m.value.id, m.value]));

    for (const p of rawPrices) {
      const id = `${p.provider}_${p.model}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const existing = existingMap.get(id);

      const profitMultiplier = Number(existing?.margin_multiplier ?? existing?.profit_multiplier ?? 1) || 1;
      const isActive = existing?.is_active ?? true;

      // Determine single price for non-llm
      let singlePrice = null;
      if (p.service_type !== 'llm') {
        singlePrice = p.image_price ?? p.video_price ?? p.input_price ?? p.output_price ?? null;
      }

      // Map service_type to standardized values
      let standardizedServiceType = 'chat';
      const rawType = (p.service_type || '').toLowerCase();
      const modelName = (p.model || '').toLowerCase();
      
      if (rawType.includes('image')) {
        standardizedServiceType = 'image';
      } else if (rawType.includes('video')) {
        standardizedServiceType = modelName.includes('image') || modelName.includes('photo') ? 'image_to_video' : 'video';
      } else if (rawType.includes('audio') || rawType.includes('tts') || modelName.includes('tts') || modelName.includes('speech')) {
        standardizedServiceType = 'tts';
      } else if (rawType.includes('music') || modelName.includes('music')) {
        standardizedServiceType = 'music';
      }

      const modelRecord = {
        id,
        provider_name: p.provider,
        model_name: p.model,
        service_type: standardizedServiceType,
        billing_unit: p.price_unit || '',
        is_active: isActive,
        is_favorite: existing?.is_favorite ?? false,
        
        raw_cost_input_usd: p.input_price,
        raw_cost_output_usd: p.output_price,
        raw_cost_single_usd: singlePrice,
        
        usd_try_rate: rate,
        
        raw_cost_input_try: p.input_price !== null ? Number((p.input_price * rate).toFixed(4)) : null,
        raw_cost_output_try: p.output_price !== null ? Number((p.output_price * rate).toFixed(4)) : null,
        raw_cost_single_try: singlePrice !== null ? Number((singlePrice * rate).toFixed(4)) : null,
        
        margin_multiplier: profitMultiplier,
        profit_multiplier: profitMultiplier,
        
        sale_cost_input_usd: p.input_price !== null ? Number((p.input_price * profitMultiplier).toFixed(4)) : null,
        sale_cost_output_usd: p.output_price !== null ? Number((p.output_price * profitMultiplier).toFixed(4)) : null,
        sale_cost_single_usd: singlePrice !== null ? Number((singlePrice * profitMultiplier).toFixed(4)) : null,
        
        sale_cost_input_try: p.input_price !== null ? Number((p.input_price * profitMultiplier * rate).toFixed(4)) : null,
        sale_cost_output_try: p.output_price !== null ? Number((p.output_price * profitMultiplier * rate).toFixed(4)) : null,
        sale_cost_single_try: singlePrice !== null ? Number((singlePrice * profitMultiplier * rate).toFixed(4)) : null,
        
        sale_credit_input: p.input_price !== null ? Math.ceil(p.input_price * profitMultiplier * getPricingSettings().creditPerUsd) : null,
        sale_credit_output: p.output_price !== null ? Math.ceil(p.output_price * profitMultiplier * getPricingSettings().creditPerUsd) : null,
        sale_credit_single: singlePrice !== null ? Math.ceil(singlePrice * profitMultiplier * getPricingSettings().creditPerUsd) : null,
        
        metadata_json: { ...(p as any), ...(existing?.metadata_json || {}) },
        admin_override_pricing: existing?.admin_override_pricing ?? false,
        usage_count: existing?.usage_count ?? 0,
        revenue_try: existing?.revenue_try ?? 0,
        cost_try: existing?.cost_try ?? 0,
        profit_try: existing?.profit_try ?? 0,
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

adminRouter.post('/models/sync', async (req: AuthRequest, res) => {
  try {
    // 1. Fetch exchange rate
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

    // 2. Fetch prices from provider
    const pricesRes = await fetch('https://turk.puter.work/api/prices');
    if (!pricesRes.ok) throw new Error('Fiyatlar alınamadı');
    const pricesData = await pricesRes.json();
    const rawPrices = Array.isArray(pricesData) ? pricesData : (pricesData.rows || []);

    // 3. Sync to KV
    await kv.set(USD_TRY_RATE_KEY, rate);
    const now = new Date().toISOString();
    const existingModels = await kv.list('model:');
    const existingMap = new Map(existingModels.map(m => [m.value.id, m.value]));

    for (const p of rawPrices) {
      const id = `${p.provider}_${p.model}`.replace(/[^a-zA-Z0-9_-]/g, '_');
      const existing = existingMap.get(id);

      const profitMultiplier = Number(existing?.margin_multiplier ?? existing?.profit_multiplier ?? 1) || 1;
      const isActive = existing?.is_active ?? true;

      // Determine single price for non-llm
      let singlePrice = null;
      if (p.service_type !== 'llm') {
        singlePrice = p.image_price ?? p.video_price ?? p.input_price ?? p.output_price ?? null;
      }

      // Map service_type to standardized values
      let standardizedServiceType = 'chat';
      const rawType = (p.service_type || '').toLowerCase();
      const modelName = (p.model || '').toLowerCase();
      
      if (rawType.includes('image')) {
        standardizedServiceType = 'image';
      } else if (rawType.includes('video')) {
        standardizedServiceType = modelName.includes('image') || modelName.includes('photo') ? 'image_to_video' : 'video';
      } else if (rawType.includes('audio') || rawType.includes('tts') || modelName.includes('tts') || modelName.includes('speech')) {
        standardizedServiceType = 'tts';
      } else if (rawType.includes('music') || modelName.includes('music')) {
        standardizedServiceType = 'music';
      }

      const modelRecord = {
        id,
        provider_name: p.provider,
        model_name: p.model,
        service_type: standardizedServiceType,
        billing_unit: p.price_unit || '',
        is_active: isActive,
        is_favorite: existing?.is_favorite ?? false,
        
        raw_cost_input_usd: p.input_price,
        raw_cost_output_usd: p.output_price,
        raw_cost_single_usd: singlePrice,
        
        usd_try_rate: rate,
        
        raw_cost_input_try: p.input_price !== null ? Number((p.input_price * rate).toFixed(4)) : null,
        raw_cost_output_try: p.output_price !== null ? Number((p.output_price * rate).toFixed(4)) : null,
        raw_cost_single_try: singlePrice !== null ? Number((singlePrice * rate).toFixed(4)) : null,
        
        margin_multiplier: profitMultiplier,
        profit_multiplier: profitMultiplier,
        
        sale_cost_input_usd: p.input_price !== null ? Number((p.input_price * profitMultiplier).toFixed(4)) : null,
        sale_cost_output_usd: p.output_price !== null ? Number((p.output_price * profitMultiplier).toFixed(4)) : null,
        sale_cost_single_usd: singlePrice !== null ? Number((singlePrice * profitMultiplier).toFixed(4)) : null,
        
        sale_cost_input_try: p.input_price !== null ? Number((p.input_price * profitMultiplier * rate).toFixed(4)) : null,
        sale_cost_output_try: p.output_price !== null ? Number((p.output_price * profitMultiplier * rate).toFixed(4)) : null,
        sale_cost_single_try: singlePrice !== null ? Number((singlePrice * profitMultiplier * rate).toFixed(4)) : null,
        
        sale_credit_input: p.input_price !== null ? Math.ceil(p.input_price * profitMultiplier * getPricingSettings().creditPerUsd) : null,
        sale_credit_output: p.output_price !== null ? Math.ceil(p.output_price * profitMultiplier * getPricingSettings().creditPerUsd) : null,
        sale_credit_single: singlePrice !== null ? Math.ceil(singlePrice * profitMultiplier * getPricingSettings().creditPerUsd) : null,
        
        metadata_json: { ...(p as any), ...(existing?.metadata_json || {}) },
        admin_override_pricing: existing?.admin_override_pricing ?? false,
        usage_count: existing?.usage_count ?? 0,
        revenue_try: existing?.revenue_try ?? 0,
        cost_try: existing?.cost_try ?? 0,
        profit_try: existing?.profit_try ?? 0,
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

adminRouter.put('/models/:id', async (req: AuthRequest, res) => {
  try {
    const id = req.params.id;
    const updates = req.body || {};
    const normalizedUpdates = {
      ...updates,
      ...(updates.profit_multiplier !== undefined ? { margin_multiplier: updates.profit_multiplier } : {}),
      ...(updates.margin_multiplier !== undefined || updates.profit_multiplier !== undefined ? { admin_override_pricing: true } : {}),
    };

    const model = await modelCatalogService.updateModel(id, normalizedUpdates);
    if (!model) return res.status(404).json({ error: 'Model bulunamadı' });

    res.json({ success: true, model });
  } catch (error) {
    res.status(500).json({ error: 'Model güncellenemedi' });
  }
});

adminRouter.put('/models/bulk/update', async (req: AuthRequest, res) => {
  try {
    const { ids, updates } = req.body;
    if (!Array.isArray(ids)) return res.status(400).json({ error: 'ids array olmalı' });

    const normalizedUpdates = {
      ...(updates || {}),
      ...(updates?.profit_multiplier !== undefined ? { margin_multiplier: updates.profit_multiplier } : {}),
      ...(updates?.margin_multiplier !== undefined || updates?.profit_multiplier !== undefined ? { admin_override_pricing: true } : {}),
    };

    await modelCatalogService.bulkUpdate(ids, normalizedUpdates);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: 'Toplu güncelleme başarısız' });
  }
});
