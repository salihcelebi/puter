import { aiService } from './aiService.js';

function fail(message: string, code: string): never {
  throw Object.assign(new Error(message), { code });
}

async function callOwnerRuntime<T>(operation: string, payload: Record<string, unknown>): Promise<T> {
  const baseUrl = process.env.PUTER_OWNER_AI_BASE_URL;
  const token = process.env.PUTER_OWNER_AI_TOKEN;

  if (!baseUrl || !token) {
    fail('Owner AI runtime kullanılamıyor', 'OWNER_RUNTIME_UNAVAILABLE');
  }

  let response: Response;
  try {
    response = await fetch(`${baseUrl.replace(/\/$/, '')}/${operation}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(payload),
    });
  } catch {
    fail('Owner runtime çağrısı başarısız', 'OWNER_RUNTIME_CALL_FAILED');
  }

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = typeof data?.error === 'string' ? data.error : 'Owner AI runtime hatası';
    fail(message, data?.code || 'FEATURE_NOT_READY');
  }

  return data as T;
}

export const musicAdapter = {
  // Part 2: music is not a native helper; expose honest capability to UI.
  async getCapability() {
    return {
      supported: false,
      mode: 'capability_only',
      code: 'FEATURE_NOT_READY',
      reason: 'Music üretimi native yardımcı değil, ayrı adapter zinciri gerektirir.',
    };
  },

  async generateMusic(userId: string, prompt: string, tags: string[]) {
    const capability = await this.getCapability();
    if (!capability.supported) {
      fail(capability.reason, capability.code);
    }

    const internalCost = 0.05;
    const cost = Math.ceil(internalCost * 100);

    try {
      const result = await callOwnerRuntime<{ jobId: string }>('music', { prompt, tags });
      if (!result.jobId) {
        fail('Müzik işi başlatılamadı', 'OWNER_RUNTIME_CALL_FAILED');
      }

      const hasCredit = await aiService.checkAndDeductCredit(userId, cost, 'music');
      if (!hasCredit) fail('Yetersiz kredi', 'INSUFFICIENT_CREDIT');

      await aiService.logUsage(userId, 'music', cost, internalCost, 'success', { prompt, tags, jobId: result.jobId });
      return { jobId: result.jobId, status: 'queued' };
    } catch (error: any) {
      await aiService.logUsage(userId, 'music', cost, internalCost, 'failed', {
        prompt,
        tags,
        error: error.message,
        code: error.code,
      });
      throw error;
    }
  },
};
