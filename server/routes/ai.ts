import { Router } from 'express';
import { requireAuth, AuthRequest } from '../middleware/auth.js';
import { aiService } from '../services/aiService.js';
import { musicAdapter } from '../services/musicAdapter.js';
import { kv } from '../db/kv.js';

export const aiRouter = Router();

aiRouter.use(requireAuth);

aiRouter.get('/models', async (req: AuthRequest, res) => {
  try {
    const models = await kv.list('model:');
    const activeModels = models
      .map(m => m.value)
      .filter(m => m.is_active)
      .map(m => ({
        id: m.id,
        provider_name: m.provider_name,
        model_name: m.model_name,
        service_type: m.service_type,
        billing_unit: m.billing_unit,
        sale_credit_input: m.sale_credit_input,
        sale_credit_output: m.sale_credit_output,
        sale_credit_single: m.sale_credit_single,
        metadata_json: m.metadata_json
      }));
    res.json(activeModels);
  } catch (error) {
    res.status(500).json({ error: 'Modeller alınamadı' });
  }
});

aiRouter.post('/chat', async (req: AuthRequest, res) => {
  try {
    const { prompt, modelId } = req.body;
    const response = await aiService.generateChat(req.user.id, prompt, modelId);
    res.json({ response });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

aiRouter.post('/image', async (req: AuthRequest, res) => {
  try {
    const { prompt } = req.body;
    const result = await aiService.generateImage(req.user.id, prompt);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

aiRouter.post('/tts', async (req: AuthRequest, res) => {
  try {
    const { text, voice } = req.body;
    const result = await aiService.generateTTS(req.user.id, text, voice);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

aiRouter.post('/video', async (req: AuthRequest, res) => {
  try {
    const { prompt, model, duration, aspectRatio } = req.body;
    const result = await aiService.generateVideo(req.user.id, prompt, model, duration, aspectRatio);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

aiRouter.post('/music', async (req: AuthRequest, res) => {
  try {
    const { prompt, tags } = req.body;
    const result = await musicAdapter.generateMusic(req.user.id, prompt, tags);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});
