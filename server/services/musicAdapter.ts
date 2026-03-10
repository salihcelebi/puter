import { kv } from '../db/kv.js';
import { aiService } from './aiService.js';
import { getPricingSettings } from '../db/fiyatlandirma/fiyatlandirma.js';

export const musicAdapter = {
  async generateMusic(userId: string, prompt: string, tags: string[]) {
    const internalCost = 0.05;
    const cost = Math.ceil(internalCost * getPricingSettings().creditPerUsd);
    
    const hasCredit = await aiService.checkAndDeductCredit(userId, cost, 'music');
    if (!hasCredit) throw new Error('Yetersiz kredi');

    try {
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const assetId = `ast_${Date.now()}`;
      await kv.set(`assets:${assetId}`, {
        id: assetId,
        kullanici_id: userId,
        tur: 'music',
        dosya_adi: `mock_music_${Date.now()}.mp3`,
        fs_path: `/mock/path`,
        created_at: new Date().toISOString()
      });

      await aiService.logUsage(userId, 'music', cost, internalCost, 'success', { prompt, tags, assetId });
      return { assetId, url: `https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3` };
    } catch (error: any) {
      await aiService.logUsage(userId, 'music', cost, internalCost, 'failed', { prompt, error: error.message });
      throw error;
    }
  }
};
