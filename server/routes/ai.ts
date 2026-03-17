/*
█████████████████████████████████████████████
1) BU DOSYA, AI ÖZELLİKLERİNE AİT SUNUCU ROUTE'LARINI YÖNETEN ANA API DOSYASIDIR.
2) aiRouter, EXPRESS ROUTER ÜZERİNDEN TANIMLANIR VE AI İSTEKLERİ İÇİN AYRI BİR ROUTE GRUBU OLUŞTURUR.
3) requireAuth VE requirePermission ENTEGRASYONU, AI ÖZELLİKLERİNİN SADECE YETKİLİ KULLANICILAR TARAFINDAN KULLANILMASINI SAĞLAR.
4) aiService, BU DOSYANIN ASIL İŞ YÜKÜNÜ ARKA PLAN SERVİS KATMANINA AKTARMASINI SAĞLAR.
5) musicAdapter İTHALİ, AI KAPSAMINDA MÜZİK VEYA SES ÜRETİMİNE BAĞLI AKIŞLAR OLABİLECEĞİNİ GÖSTERİR.
6) AiErrorCode TİPİ, AI İŞLEMLERİNDE OLUŞABİLECEK HATALARI ÖNCEDEN SABİTLENMİŞ KODLARLA SINIFLANDIRIR.
7) NO_TOKEN VE UNAUTHORIZED GİBİ KODLAR, KİMLİK VE OTURUM PROBLEMLERİNE KARŞILIK GELİR.
8) MODEL_NOT_ALLOWED VE NO_ACTIVE_MODEL GİBİ KODLAR, MODEL SEÇİMİ VE ERİŞİM KISITLARINI İFADE EDER.
9) JOB_NOT_FOUND VE JOB_STATUS_NOT_IMPLEMENTED GİBİ KODLAR, AI İŞ TAKİBİ TARAFINDAKİ SORUNLARI ANLATIR.
10) CREDIT_COMMIT_FAILED VE CREDIT_REFUND_FAILED GİBİ KODLAR, AI ÇAĞRILARININ KREDİ SİSTEMİYLE BAĞLI OLDUĞUNU GÖSTERİR.
11) fail FONKSİYONU, HATALARI STANDART BİR KODLA FIRLATMAK İÇİN KULLANILIR.
12) normalizeError FONKSİYONU, HATA KODUNU UYGUN HTTP STATUS'A ÇEVİRİR.
13) BU DOSYA, HATA HARİTALAMA KONUSUNDA DİSİPLİNLİ BİR YAPI KULLANIR; BU FRONTEND AÇISINDAN ÇOK DEĞERLİDİR.
14) OWNER_RUNTIME_UNAVAILABLE VE OWNER_RUNTIME_CALL_FAILED KODLARI, HARİCİ VEYA SAHİP RUNTIME BAĞLANTISININ ÖNEMLİ OLDUĞUNU GÖSTERİR.
15) AI İŞLERİ, SENKRON DEĞİL KUYRUKLU VEYA JOB TABANLI MANTIĞA YAKIN BİR ŞEKİLDE ELE ALINIR.
16) ASSET_WRITE_FAILED KODU, ÜRETİLEN DOSYALARIN DAHA SONRA FS VEYA ASSET KATMANINA YAZILDIĞINI GÖSTERİR.
17) BU DOSYA, SADECE PROMPT ALIP SONUÇ DÖNEN BASİT BİR API DEĞİL; YETKİ, KREDİ, JOB VE OUTPUT AKIŞINI BİRLEŞTİRİR.
18) AI ROUTE'LARI, GÖRÜNENDEN DAHA FAZLA ALT SİSTEME BAĞLIDIR: AUTH, CREDIT, JOB, ASSET VE OWNER RUNTIME GİBİ.
19) HATA KODLARININ AÇIK OLMASI, DEBUG VE KULLANICI GERİ BİLDİRİMİNİ KOLAYLAŞTIRIR.
20) FRONTEND TARAFINDA image.tsx GİBİ DOSYALAR BU KATMANIN ÜSTÜNDE ÇALIŞABİLİR.
21) DOSYA, MODEL ERİŞİMİ VE ÖZELLİK YETKİSİNİ SUNUCU TARAFINDA ZORLAYARAK İSTEMCİYE GÜVENMEMEYİ HEDEFLER.
22) KREDİ SİSTEMİYLE ENTEGRASYON, AI KULLANIMININ MALİYET KONTROLLÜ OLDUĞUNU GÖSTERİR.
23) JOB BULUNAMAMASI VEYA STATUS SENKRON HATALARI, SİSTEMİN ASENKRON AKIŞLARLA ÇALIŞTIĞINI GÜÇLÜ ŞEKİLDE İŞARET EDER.
24) BU DOSYA BOZULURSA AI ÖZELLİKLERİ SADECE HATA VERMEZ; AYNI ZAMANDA KREDİ VE ASSET AKIŞI DA ETKİLENEBİLİR.
25) KISACA: BU DOSYA, PROJENİN AI ÜRETİM SÜRECİNİ KİMLİK, İZİN, KREDİ VE JOB YÖNETİMİYLE BİRLİKTE ORKESTRE EDEN ANA API KATMANIDIR.
█████████████████████████████████████████████
*/
import { Router } from 'express';
import { requireAuth, requirePermission, AuthRequest } from '../middleware/auth.js';
import { aiService } from '../services/aiService.js';
import { musicAdapter } from '../services/musicAdapter.js';

export const aiRouter = Router();

type AiErrorCode =
  | 'NO_TOKEN'
  | 'UNAUTHORIZED'
  | 'INVALID_INPUT'
  | 'OWNER_RUNTIME_UNAVAILABLE'
  | 'FEATURE_NOT_READY'
  | 'MODEL_NOT_ALLOWED'
  | 'NO_ACTIVE_MODEL'
  | 'JOB_NOT_FOUND'
  | 'JOB_STATUS_NOT_IMPLEMENTED'
  | 'OWNER_RUNTIME_CALL_FAILED'
  | 'OWNER_RUNTIME_JOB_NOT_FOUND'
  | 'JOB_SYNC_FAILED'
  | 'JOB_FINALIZE_FAILED'
  | 'ASSET_WRITE_FAILED'
  | 'CREDIT_COMMIT_FAILED'
  | 'CREDIT_REFUND_FAILED'
  | 'INSUFFICIENT_CREDIT'
  | 'PRICING_CONFIG_INVALID';

interface RouteError extends Error {
  code?: AiErrorCode | string;
}

function fail(message: string, code: AiErrorCode): never {
  throw Object.assign(new Error(message), { code });
}

function normalizeError(error: RouteError) {
  const code = (error.code || 'FEATURE_NOT_READY') as AiErrorCode;
  if (code === 'NO_TOKEN' || code === 'UNAUTHORIZED') return { status: 401, code };
  if (code === 'INVALID_INPUT' || code === 'PRICING_CONFIG_INVALID') return { status: 400, code };
  if (code === 'MODEL_NOT_ALLOWED' || code === 'NO_ACTIVE_MODEL') return { status: 422, code };
  if (code === 'JOB_NOT_FOUND' || code === 'OWNER_RUNTIME_JOB_NOT_FOUND') return { status: 404, code };
  if (code === 'INSUFFICIENT_CREDIT') return { status: 402, code };
  if (code === 'JOB_SYNC_FAILED' || code === 'JOB_FINALIZE_FAILED' || code === 'ASSET_WRITE_FAILED' || code === 'CREDIT_COMMIT_FAILED' || code === 'CREDIT_REFUND_FAILED') {
    return { status: 500, code };
  }
  if (code === 'OWNER_RUNTIME_UNAVAILABLE' || code === 'OWNER_RUNTIME_CALL_FAILED' || code === 'FEATURE_NOT_READY') return { status: 503, code };
  if (code === 'JOB_STATUS_NOT_IMPLEMENTED') return { status: 501, code };
  return { status: 400, code: 'FEATURE_NOT_READY' as AiErrorCode };
}

function sendError(res: any, error: RouteError) {
  const mapped = normalizeError(error);
  return res.status(mapped.status).json({
    error: error.message || 'AI isteği başarısız',
    code: mapped.code,
  });
}

aiRouter.get('/models', async (req, res) => {
  try {
    const models = await aiService.listVisibleModels({
      feature: req.query.feature as string | undefined,
      provider: req.query.provider as string | undefined,
      q: req.query.q as string | undefined,
      sort: req.query.sort as string | undefined,
    });
    res.json(models);
  } catch (error: any) {
    sendError(res, error);
  }
});


aiRouter.get('/effective-config/:feature', requireAuth, async (req: AuthRequest, res) => {
  try {
    const config = await aiService.getEffectiveFeatureConfig(req.params.feature);
    return res.json({ feature: req.params.feature, config });
  } catch (error: any) {
    return sendError(res, error);
  }
});

aiRouter.post('/chat', requireAuth, requirePermission('use_chat'), async (req: AuthRequest, res) => {
  try {
    const { prompt, modelId, clientRequestId, conversationId } = req.body || {};
    if (!prompt || typeof prompt !== 'string') fail('prompt alanı zorunludur', 'INVALID_INPUT');

    const result = await aiService.runFeature({
      feature: 'chat',
      userId: req.user.id,
      modelId,
      clientRequestId,
      payload: { prompt, conversationId, sourcePage: req.headers['x-source-page'] || null },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/image', requireAuth, requirePermission('use_image'), async (req: AuthRequest, res) => {
  try {
    const { prompt, modelId, clientRequestId } = req.body || {};
    if (!prompt || typeof prompt !== 'string') fail('prompt alanı zorunludur', 'INVALID_INPUT');

    const result = await aiService.runFeature({
      feature: 'image',
      userId: req.user.id,
      modelId,
      clientRequestId,
      payload: { prompt, sourcePage: req.headers['x-source-page'] || null },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/tts', requireAuth, requirePermission('use_tts'), async (req: AuthRequest, res) => {
  try {
    const { text, modelId, voiceName, voice, clientRequestId } = req.body || {};
    if (!text || typeof text !== 'string') fail('text alanı zorunludur', 'INVALID_INPUT');

    const result = await aiService.runFeature({
      feature: 'tts',
      userId: req.user.id,
      modelId,
      clientRequestId,
      payload: {
        text,
        voiceName: voiceName || voice || 'default',
        sourcePage: req.headers['x-source-page'] || null,
      },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/video', requireAuth, requirePermission('use_video'), async (req: AuthRequest, res) => {
  try {
    const { prompt, modelId, model, duration, aspectRatio, clientRequestId } = req.body || {};
    if (!prompt || typeof prompt !== 'string') fail('prompt alanı zorunludur', 'INVALID_INPUT');

    const result = await aiService.runFeature({
      feature: 'video',
      userId: req.user.id,
      modelId: modelId || model,
      clientRequestId,
      payload: {
        prompt,
        duration: Number(duration || 5),
        aspectRatio: aspectRatio || '16:9',
        sourcePage: req.headers['x-source-page'] || null,
      },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/photo-to-video', requireAuth, requirePermission('use_photo_to_video'), async (req: AuthRequest, res) => {
  try {
    const { prompt, imageUrl, imageBase64, modelId, model, duration, aspectRatio, clientRequestId } = req.body || {};
    let resolvedImageUrl = imageUrl;
    if ((!resolvedImageUrl || typeof resolvedImageUrl !== 'string') && typeof imageBase64 === 'string' && imageBase64.length > 20) {
      const sourceAsset = await aiService.createImageSourceAsset(req.user.id, imageBase64);
      resolvedImageUrl = sourceAsset.url;
    }
    if (!resolvedImageUrl || typeof resolvedImageUrl !== 'string') fail('imageUrl veya imageBase64 alanı zorunludur', 'INVALID_INPUT');

    const result = await aiService.runFeature({
      feature: 'photoToVideo',
      userId: req.user.id,
      modelId: modelId || model,
      clientRequestId,
      payload: {
        prompt: String(prompt || ''),
        imageUrl: resolvedImageUrl,
        duration: Number(duration || 5),
        aspectRatio: aspectRatio || '16:9',
        sourcePage: req.headers['x-source-page'] || null,
      },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.get('/jobs/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    // Part 3: auth + ownership + runtime sync are enforced by aiService.getJobStatus.
    const result = await aiService.getJobStatus(req.user.id, req.params.id);
    if (result.status === 'not_found') {
      return res.status(404).json({
        status: 'not_found',
        jobId: req.params.id,
        code: 'JOB_NOT_FOUND',
      });
    }
    return res.json(result);
  } catch (error: any) {
    return sendError(res, error);
  }
});

aiRouter.get('/music/capability', async (_req: AuthRequest, res) => {
  try {
    const capability = await musicAdapter.getCapability();
    res.json(capability);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/music', requireAuth, requirePermission('use_music'), async (req: AuthRequest, res) => {
  try {
    const { prompt, tags } = req.body || {};
    if (!prompt || typeof prompt !== 'string') fail('prompt alanı zorunludur', 'INVALID_INPUT');

    const result = await musicAdapter.generateMusic(req.user.id, prompt, Array.isArray(tags) ? tags : []);
    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});
