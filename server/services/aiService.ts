import { kv } from '../db/kv.js';
import { fileSystem } from '../db/fs.js';

function getOwnerRuntimeConfig() {
  const baseUrl = process.env.PUTER_OWNER_AI_BASE_URL;
  const token = process.env.PUTER_OWNER_AI_TOKEN;
  return { baseUrl, token };
}

async function callOwnerRuntime<T>(operation: string, payload: Record<string, unknown>): Promise<T> {
  const { baseUrl, token } = getOwnerRuntimeConfig();

  if (!baseUrl || !token) {
    throw Object.assign(new Error('Owner AI runtime kullanılamıyor'), { code: 'OWNER_RUNTIME_UNAVAILABLE' });
  }

  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/${operation}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Owner AI runtime hatası';
    throw Object.assign(new Error(message), { code: data?.code || 'FEATURE_NOT_READY' });
  }

  return data as T;
}

export const aiService = {
  async checkAndDeductCredit(userId: string, cost: number, module: string): Promise<boolean> {
    const user = await kv.get(`users:${userId}`);
    if (!user || user.toplam_kredi - user.kullanilan_kredi < cost) {
      return false;
    }

    user.kullanilan_kredi += cost;
    await kv.set(`users:${userId}`, user);

    const ledgerId = `ldg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    await kv.set(`creditLedger:${ledgerId}`, {
      id: ledgerId,
      kullanici_id: userId,
      islem_tipi: 'usage',
      miktar: -cost,
      onceki_bakiye: user.toplam_kredi - (user.kullanilan_kredi - cost),
      sonraki_bakiye: user.toplam_kredi - user.kullanilan_kredi,
      aciklama: `${module} kullanımı`,
      created_at: new Date().toISOString(),
    });

    return true;
  },

  async logUsage(userId: string, module: string, cost: number, internalCost: number, status: 'success' | 'failed', details: any) {
    const usageId = `usg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const log = {
      id: usageId,
      kullanici_id: userId,
      modul: module,
      kredi_maliyeti: cost,
      ic_maliyet: internalCost,
      durum: status,
      detaylar: details,
      created_at: new Date().toISOString(),
    };
    await kv.set(`usage:${usageId}`, log);
    await kv.set(`userUsage:${userId}:${usageId}`, usageId);
    return usageId;
  },

  async generateChat(userId: string, prompt: string, modelId?: string) {
    let cost = 1;
    let internalCost = 0.001;

    if (modelId) {
      const modelRecord = await kv.get(`model:${modelId}`);
      if (modelRecord) {
        const estimatedInputTokens = prompt.split(' ').length * 1.3;
        const estimatedOutputTokens = 200;

        const inputCost = (estimatedInputTokens / 1000) * (modelRecord.sale_credit_input || 0);
        const outputCost = (estimatedOutputTokens / 1000) * (modelRecord.sale_credit_output || 0);
        cost = Math.ceil(inputCost + outputCost) || 1;

        const internalInputCost = (estimatedInputTokens / 1000) * (modelRecord.raw_cost_input_try || 0);
        const internalOutputCost = (estimatedOutputTokens / 1000) * (modelRecord.raw_cost_output_try || 0);
        internalCost = internalInputCost + internalOutputCost;
      }
    }

    try {
      const response = await callOwnerRuntime<{ response: string }>('chat', { prompt, modelId });
      const hasCredit = await this.checkAndDeductCredit(userId, cost, 'chat');
      if (!hasCredit) throw new Error('Yetersiz kredi');

      await this.logUsage(userId, 'chat', cost, internalCost, 'success', { prompt, modelId });
      return response.response;
    } catch (error: any) {
      await this.logUsage(userId, 'chat', cost, internalCost, 'failed', { prompt, modelId, error: error.message });
      throw error;
    }
  },

  async generateImage(userId: string, prompt: string) {
    const cost = 5;
    const internalCost = 0.02;

    try {
      const response = await callOwnerRuntime<{ base64Image: string }>('image', { prompt });
      if (!response.base64Image) throw new Error('Görsel üretilemedi');

      const hasCredit = await this.checkAndDeductCredit(userId, cost, 'image');
      if (!hasCredit) throw new Error('Yetersiz kredi');

      const fileName = `img_${Date.now()}.png`;
      const filePath = `/users/${userId}/images/${fileName}`;
      await fileSystem.write(filePath, Buffer.from(response.base64Image, 'base64'));

      const assetId = `ast_${Date.now()}`;
      await kv.set(`assets:${assetId}`, {
        id: assetId,
        kullanici_id: userId,
        tur: 'image',
        dosya_adi: fileName,
        fs_path: filePath,
        created_at: new Date().toISOString(),
      });

      await this.logUsage(userId, 'image', cost, internalCost, 'success', { prompt, assetId });
      return { assetId, url: `/api/assets/${assetId}` };
    } catch (error: any) {
      await this.logUsage(userId, 'image', cost, internalCost, 'failed', { prompt, error: error.message });
      throw error;
    }
  },

  async generateTTS(userId: string, text: string, voiceName = 'Kore') {
    const cost = 3;
    const internalCost = 0.01;

    try {
      const response = await callOwnerRuntime<{ base64Audio: string }>('tts', { text, voiceName });
      if (!response.base64Audio) throw new Error('Ses üretilemedi');

      const hasCredit = await this.checkAndDeductCredit(userId, cost, 'tts');
      if (!hasCredit) throw new Error('Yetersiz kredi');

      const fileName = `tts_${Date.now()}.mp3`;
      const filePath = `/users/${userId}/audio/${fileName}`;
      await fileSystem.write(filePath, Buffer.from(response.base64Audio, 'base64'));

      const assetId = `ast_${Date.now()}`;
      await kv.set(`assets:${assetId}`, {
        id: assetId,
        kullanici_id: userId,
        tur: 'audio',
        dosya_adi: fileName,
        fs_path: filePath,
        created_at: new Date().toISOString(),
      });

      await this.logUsage(userId, 'tts', cost, internalCost, 'success', { text, voiceName, assetId });
      return { assetId, url: `/api/assets/${assetId}` };
    } catch (error: any) {
      await this.logUsage(userId, 'tts', cost, internalCost, 'failed', { text, error: error.message });
      throw error;
    }
  },

  async generateVideo(userId: string, prompt: string, modelId = 'runway-gen4-turbo', duration = 5, aspectRatio = '16:9') {
    const cost = Math.max(1, Math.ceil((duration / 5) * 10));
    const internalCost = cost * 0.01;

    try {
      const response = await callOwnerRuntime<{ jobId: string }>('video', { prompt, modelId, duration, aspectRatio });
      if (!response.jobId) throw new Error('Video işi başlatılamadı');

      const hasCredit = await this.checkAndDeductCredit(userId, cost, 'video');
      if (!hasCredit) throw new Error('Yetersiz kredi');

      await this.logUsage(userId, 'video', cost, internalCost, 'success', { prompt, modelId, duration, aspectRatio, jobId: response.jobId });
      return { jobId: response.jobId, status: 'queued' };
    } catch (error: any) {
      await this.logUsage(userId, 'video', cost, internalCost, 'failed', { prompt, modelId, duration, aspectRatio, error: error.message });
      throw error;
    }
  },
};
