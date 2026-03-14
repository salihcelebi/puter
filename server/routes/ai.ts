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


async function runImageGeneration(req: AuthRequest, res: any, envelope = false) {
  try {
    const { prompt, modelId, model, clientRequestId } = req.body || {};
    if (!prompt || typeof prompt !== 'string') fail('prompt alanı zorunludur', 'INVALID_INPUT');

    const result = await aiService.runFeature({
      feature: 'image',
      userId: req.user.id,
      modelId: modelId || model,
      clientRequestId,
      payload: { prompt },
    });

    if (!envelope) {
      return res.json(result);
    }

    const data = {
      ...result,
      images: Array.isArray((result as any).images)
        ? (result as any).images
        : (result as any).url
        ? [{ url: (result as any).url }]
        : [],
      url: (result as any).url || (Array.isArray((result as any).images) && (result as any).images[0]?.url) || null,
    };

    return res.json({ ok: true, code: 'IMAGE_GENERATED', data, error: null });
  } catch (error: any) {
    if (!envelope) {
      return sendError(res, error);
    }

    const mapped = normalizeError(error);
    return res.status(mapped.status).json({
      ok: false,
      code: mapped.code,
      data: null,
      error: { message: error?.message || 'AI isteği başarısız' },
    });
  }
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

aiRouter.post('/chat', requireAuth, requirePermission('use_chat'), async (req: AuthRequest, res) => {
  try {
    const { prompt, modelId, clientRequestId, conversationId } = req.body || {};
    if (!prompt || typeof prompt !== 'string') fail('prompt alanı zorunludur', 'INVALID_INPUT');

    const result = await aiService.runFeature({
      feature: 'chat',
      userId: req.user.id,
      modelId,
      clientRequestId,
      payload: { prompt, conversationId },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/image', requireAuth, requirePermission('use_image'), async (req: AuthRequest, res) => {
  return runImageGeneration(req, res, false);
});

aiRouter.post('/image/generate', requireAuth, requirePermission('use_image'), async (req: AuthRequest, res) => {
  return runImageGeneration(req, res, true);
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
