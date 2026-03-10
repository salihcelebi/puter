import { kv } from '../db/kv.js';
import { fileSystem } from '../db/fs.js';
import { GoogleGenAI, Modality } from '@google/genai';
import { getPricingSettings } from '../db/fiyatlandirma/fiyatlandirma.js';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

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
      created_at: new Date().toISOString()
    });
    
    return true;
  },

  async logUsage(userId: string, module: string, cost: number, internalCost: number, status: 'success'|'failed', details: any) {
    const usageId = `usg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    const log = {
      id: usageId,
      kullanici_id: userId,
      modul: module,
      kredi_maliyeti: cost,
      ic_maliyet: internalCost,
      durum: status,
      detaylar: details,
      created_at: new Date().toISOString()
    };
    await kv.set(`usage:${usageId}`, log);
    await kv.set(`userUsage:${userId}:${usageId}`, usageId);
    return usageId;
  },

  async generateChat(userId: string, prompt: string, modelId?: string) {
    // If modelId is provided, fetch it to calculate cost
    let cost = 1;
    let internalCost = 0.001;
    let actualModelName = 'gemini-3-flash-preview';
    
    if (modelId) {
      const modelRecord = await kv.get(`model:${modelId}`);
      if (modelRecord) {
        actualModelName = modelRecord.model_name;
        // Estimate tokens (very rough estimate: 1 word ~ 1.3 tokens)
        const estimatedInputTokens = prompt.split(' ').length * 1.3;
        const estimatedOutputTokens = 200; // Assume 200 tokens output for now
        
        const inputCost = (estimatedInputTokens / 1000) * (modelRecord.sale_credit_input || 0);
        const outputCost = (estimatedOutputTokens / 1000) * (modelRecord.sale_credit_output || 0);
        cost = Math.ceil(inputCost + outputCost) || 1; // Minimum 1 credit
        
        const internalInputCost = (estimatedInputTokens / 1000) * (modelRecord.raw_cost_input_try || 0);
        const internalOutputCost = (estimatedOutputTokens / 1000) * (modelRecord.raw_cost_output_try || 0);
        internalCost = internalInputCost + internalOutputCost;
      }
    }

    const hasCredit = await this.checkAndDeductCredit(userId, cost, 'chat');
    if (!hasCredit) throw new Error('Yetersiz kredi');

    try {
      const response = await ai.models.generateContent({
        model: actualModelName,
        contents: prompt,
      });
      
      await this.logUsage(userId, 'chat', cost, internalCost, 'success', { prompt, modelId });
      return response.text;
    } catch (error: any) {
      await this.logUsage(userId, 'chat', cost, internalCost, 'failed', { prompt, modelId, error: error.message });
      throw error;
    }
  },

  async generateImage(userId: string, prompt: string) {
    const cost = 5;
    const internalCost = 0.02;
    const hasCredit = await this.checkAndDeductCredit(userId, cost, 'image');
    if (!hasCredit) throw new Error('Yetersiz kredi');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: prompt,
        config: {
          imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
        }
      });
      
      let base64Image = '';
      for (const part of response.candidates?.[0]?.content?.parts || []) {
        if (part.inlineData) {
          base64Image = part.inlineData.data;
          break;
        }
      }

      if (!base64Image) throw new Error('Görsel üretilemedi');

      const fileName = `img_${Date.now()}.png`;
      const filePath = `/users/${userId}/images/${fileName}`;
      await fileSystem.write(filePath, Buffer.from(base64Image, 'base64'));

      const assetId = `ast_${Date.now()}`;
      await kv.set(`assets:${assetId}`, {
        id: assetId,
        kullanici_id: userId,
        tur: 'image',
        dosya_adi: fileName,
        fs_path: filePath,
        created_at: new Date().toISOString()
      });

      await this.logUsage(userId, 'image', cost, internalCost, 'success', { prompt, assetId });
      return { assetId, url: `/api/assets/${assetId}` };
    } catch (error: any) {
      await this.logUsage(userId, 'image', cost, internalCost, 'failed', { prompt, error: error.message });
      throw error;
    }
  },

  async generateTTS(userId: string, text: string, voiceName: string = 'Kore') {
    const cost = 3;
    const internalCost = 0.01;
    const hasCredit = await this.checkAndDeductCredit(userId, cost, 'tts');
    if (!hasCredit) throw new Error('Yetersiz kredi');

    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash-preview-tts',
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName } }
          }
        }
      });

      const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!base64Audio) throw new Error('Ses üretilemedi');

      const fileName = `tts_${Date.now()}.mp3`;
      const filePath = `/users/${userId}/audio/${fileName}`;
      await fileSystem.write(filePath, Buffer.from(base64Audio, 'base64'));

      const assetId = `ast_${Date.now()}`;
      await kv.set(`assets:${assetId}`, {
        id: assetId,
        kullanici_id: userId,
        tur: 'audio',
        dosya_adi: fileName,
        fs_path: filePath,
        created_at: new Date().toISOString()
      });

      await this.logUsage(userId, 'tts', cost, internalCost, 'success', { text, voiceName, assetId });
      return { assetId, url: `/api/assets/${assetId}` };
    } catch (error: any) {
      await this.logUsage(userId, 'tts', cost, internalCost, 'failed', { text, error: error.message });
      throw error;
    }
  },

  async generateVideo(userId: string, prompt: string, modelId: string = 'runway-gen4-turbo', duration: number = 5, aspectRatio: string = '16:9') {
    const VIDEO_MODELS = [
      { id: 'runway-gen4-turbo', name: 'Runway / Gen-4 Turbo', baseCost: 10 },
      { id: 'runway-gen3-alpha-turbo', name: 'Runway / Gen-3 Alpha Turbo', baseCost: 12 },
      { id: 'runway-act-two', name: 'Runway / Act-Two', baseCost: 15 },
      { id: 'kling-2.1-standard-i2v', name: 'Kling / 2.1 Standard I2V', baseCost: 18 },
      { id: 'sora-2', name: 'Sora / 2', baseCost: 25 },
      { id: 'runway-gen4.5', name: 'Runway / Gen-4.5', baseCost: 20 },
      { id: 'veo-3-fast', name: 'Veo / 3 Fast', baseCost: 15 },
      { id: 'veo-3.1-fast', name: 'Veo / 3.1 Fast', baseCost: 18 },
      { id: 'sora-2-pro-720p', name: 'Sora / 2-Pro 720p', baseCost: 35 },
      { id: 'veo-2', name: 'Veo / 2', baseCost: 20 },
      { id: 'veo-3-standard', name: 'Veo / 3 Standard', baseCost: 25 },
      { id: 'veo-3.1-standard', name: 'Veo / 3.1 Standard', baseCost: 30 },
    ];

    const model = VIDEO_MODELS.find(m => m.id === modelId) || VIDEO_MODELS[0];
    const cost = Math.ceil(model.baseCost * (duration / 5));
    const internalCost = cost * 0.01; // Mock internal cost

    const hasCredit = await this.checkAndDeductCredit(userId, cost, 'video');
    if (!hasCredit) throw new Error('Yetersiz kredi');

    try {
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const assetId = `ast_${Date.now()}`;
      await kv.set(`assets:${assetId}`, {
        id: assetId,
        kullanici_id: userId,
        tur: 'video',
        dosya_adi: `mock_video_${Date.now()}.mp4`,
        fs_path: `/mock/path`,
        created_at: new Date().toISOString()
      });

      await this.logUsage(userId, 'video', cost, internalCost, 'success', { prompt, modelId, duration, aspectRatio, assetId });
      return { assetId, url: `https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4` };
    } catch (error: any) {
      await this.logUsage(userId, 'video', cost, internalCost, 'failed', { prompt, modelId, duration, aspectRatio, error: error.message });
      throw error;
    }
  }
};
