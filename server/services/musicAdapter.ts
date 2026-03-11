import { aiService } from './aiService.js';

async function callOwnerRuntime<T>(operation: string, payload: Record<string, unknown>): Promise<T> {
  const baseUrl = process.env.PUTER_OWNER_AI_BASE_URL;
  const token = process.env.PUTER_OWNER_AI_TOKEN;

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

export const musicAdapter = {
  async generateMusic(userId: string, prompt: string, tags: string[]) {
    const internalCost = 0.05;
    const cost = Math.ceil(internalCost * 100);

    try {
      const result = await callOwnerRuntime<{ jobId: string }>('music', { prompt, tags });
      if (!result.jobId) {
        throw new Error('Müzik işi başlatılamadı');
      }

      const hasCredit = await aiService.checkAndDeductCredit(userId, cost, 'music');
      if (!hasCredit) throw new Error('Yetersiz kredi');

      await aiService.logUsage(userId, 'music', cost, internalCost, 'success', { prompt, tags, jobId: result.jobId });
      return { jobId: result.jobId, status: 'queued' };
    } catch (error: any) {
      await aiService.logUsage(userId, 'music', cost, internalCost, 'failed', { prompt, error: error.message });
      throw error;
    }
  },
};
