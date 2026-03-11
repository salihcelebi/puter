import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
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
  | 'INSUFFICIENT_CREDIT';

interface RouteError extends Error {
  code?: AiErrorCode | string;
}

function fail(message: string, code: AiErrorCode): never {
  throw Object.assign(new Error(message), { code });
}

function normalizeError(error: RouteError) {
  const code = (error.code || 'FEATURE_NOT_READY') as AiErrorCode;
  if (code === 'NO_TOKEN' || code === 'UNAUTHORIZED') {
    return { status: 401, code };
  }
  if (code === 'INVALID_INPUT') {
    return { status: 400, code };
  }
  if (code === 'MODEL_NOT_ALLOWED' || code === 'NO_ACTIVE_MODEL') {
    return { status: 422, code };
  }
  if (code === 'JOB_NOT_FOUND') {
    return { status: 404, code };
  }
  if (code === 'INSUFFICIENT_CREDIT') {
    return { status: 402, code };
  }
  if (code === 'OWNER_RUNTIME_UNAVAILABLE' || code === 'OWNER_RUNTIME_CALL_FAILED' || code === 'FEATURE_NOT_READY') {
    return { status: 503, code };
  }
  if (code === 'JOB_STATUS_NOT_IMPLEMENTED') {
    return { status: 501, code };
  }
  return { status: 400, code: 'FEATURE_NOT_READY' as AiErrorCode };
}

function sendError(res: any, error: RouteError) {
  const mapped = normalizeError(error);
  return res.status(mapped.status).json({
    error: error.message || 'AI isteği başarısız',
    code: mapped.code,
  });
}

aiRouter.use(requireAuth);

aiRouter.get('/models', async (_req: AuthRequest, res) => {
  try {
    // Part 2: keep model catalog as a backend-governed allowlist projection.
    const models = await aiService.listVisibleModels();
    res.json(models);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/chat', async (req: AuthRequest, res) => {
  try {
    const { prompt, modelId, clientRequestId, conversationId } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      fail('prompt alanı zorunludur', 'INVALID_INPUT');
    }

    const result = await aiService.runFeature({
      feature: 'chat',
      userId: req.user.id,
      modelId,
      clientRequestId,
      payload: {
        prompt,
        conversationId,
      },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/image', async (req: AuthRequest, res) => {
  try {
    const { prompt, modelId, clientRequestId } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      fail('prompt alanı zorunludur', 'INVALID_INPUT');
    }

    const result = await aiService.runFeature({
      feature: 'image',
      userId: req.user.id,
      modelId,
      clientRequestId,
      payload: { prompt },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/tts', async (req: AuthRequest, res) => {
  try {
    const { text, modelId, voiceName, voice, clientRequestId } = req.body || {};
    const normalizedVoiceName = voiceName || voice;
    if (!text || typeof text !== 'string') {
      fail('text alanı zorunludur', 'INVALID_INPUT');
    }

    const result = await aiService.runFeature({
      feature: 'tts',
      userId: req.user.id,
      modelId,
      clientRequestId,
      payload: {
        text,
        voiceName: normalizedVoiceName || 'Kore',
      },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.post('/video', async (req: AuthRequest, res) => {
  try {
    const { prompt, modelId, model, duration, aspectRatio, clientRequestId } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      fail('prompt alanı zorunludur', 'INVALID_INPUT');
    }

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

aiRouter.post('/photo-to-video', async (req: AuthRequest, res) => {
  try {
    const { prompt, imageUrl, modelId, model, duration, aspectRatio, clientRequestId } = req.body || {};
    if (!imageUrl || typeof imageUrl !== 'string') {
      fail('imageUrl alanı zorunludur', 'INVALID_INPUT');
    }

    const result = await aiService.runFeature({
      feature: 'photoToVideo',
      userId: req.user.id,
      modelId: modelId || model,
      clientRequestId,
      payload: {
        prompt: String(prompt || ''),
        imageUrl,
        duration: Number(duration || 5),
        aspectRatio: aspectRatio || '16:9',
      },
    });

    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});

aiRouter.get('/jobs/:id', async (req: AuthRequest, res) => {
  try {
    const result = await aiService.getJobStatus(req.user.id, req.params.id);
    if (result.status === 'not_found') {
      return res.status(404).json({
        status: 'not_found',
        jobId: req.params.id,
        code: 'JOB_NOT_FOUND',
      });
    }
    res.json(result);
  } catch (error: any) {
    sendError(res, error);
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

aiRouter.post('/music', async (req: AuthRequest, res) => {
  try {
    const { prompt, tags } = req.body || {};
    if (!prompt || typeof prompt !== 'string') {
      fail('prompt alanı zorunludur', 'INVALID_INPUT');
    }

    const result = await musicAdapter.generateMusic(req.user.id, prompt, Array.isArray(tags) ? tags : []);
    res.json(result);
  } catch (error: any) {
    sendError(res, error);
  }
});
