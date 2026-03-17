import { kv } from '../db/kv.js';

function pickEnv(...keys: string[]) {
  for (const key of keys) {
    const raw = process.env[key];
    if (typeof raw === 'string' && raw.trim()) return raw.trim();
  }
  return '';
}

function redact(value?: string) {
  if (!value) return '';
  if (value.length <= 8) return '***';
  return `${value.slice(0, 3)}***${value.slice(-3)}`;
}

export const puterServiceSession = {
  async hasValidSession() {
    const session = await kv.get('serviceSession:puter');
    if (!session?.tokenMasked) return false;
    if (!session?.expiresAt) return true;
    return Date.parse(session.expiresAt) > Date.now();
  },

  async ensureServiceSession() {
    const token = pickEnv('PUTER_OWNER_AI_TOKEN', 'OWNER_RUNTIME_TOKEN', 'PUTER_OWNER_RUNTIME_TOKEN');
    const baseUrl = pickEnv('PUTER_OWNER_AI_BASE_URL', 'OWNER_RUNTIME_BASE_URL', 'PUTER_OWNER_RUNTIME_BASE_URL') || 'https://api-cagrilari.puter.work';

    if (!token) {
      const e = new Error('Servis oturumu yapılandırması eksik');
      (e as any).code = 'MISCONFIGURATION';
      throw e;
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + 1000 * 60 * 30).toISOString();
    const session = {
      baseUrl,
      tokenMasked: redact(token),
      updatedAt: now.toISOString(),
      expiresAt,
      status: 'ready',
    };
    await kv.set('serviceSession:puter', session);
    return session;
  },

  async refreshSessionIfNeeded() {
    const valid = await this.hasValidSession();
    if (valid) return kv.get('serviceSession:puter');
    return this.ensureServiceSession();
  },

  async getEffectiveRuntimeCredentials() {
    await this.refreshSessionIfNeeded();
    return {
      baseUrl: pickEnv('PUTER_OWNER_AI_BASE_URL', 'OWNER_RUNTIME_BASE_URL', 'PUTER_OWNER_RUNTIME_BASE_URL') || 'https://api-cagrilari.puter.work',
      statusBaseUrl: pickEnv('PUTER_OWNER_JOB_STATUS_BASE_URL', 'OWNER_RUNTIME_JOB_STATUS_BASE_URL') || 'https://is-durumu.puter.work',
      token: pickEnv('PUTER_OWNER_AI_TOKEN', 'OWNER_RUNTIME_TOKEN', 'PUTER_OWNER_RUNTIME_TOKEN'),
    };
  },

  async getSessionHealthSummary() {
    const session = await kv.get('serviceSession:puter');
    return {
      ok: Boolean(session?.tokenMasked),
      baseUrl: session?.baseUrl || null,
      tokenMasked: session?.tokenMasked || null,
      status: session?.status || 'missing',
      updatedAt: session?.updatedAt || null,
      expiresAt: session?.expiresAt || null,
    };
  },

  sanitizeSensitiveError(error: any) {
    const code = String(error?.code || 'SESSION_ERROR');
    if (code === 'MISCONFIGURATION') return { code: 'MISCONFIGURATION', message: 'Servis oturumu yapılandırması eksik' };
    if (code === 'AUTH_FAILURE') return { code: 'AUTH_FAILURE', message: 'Servis kimlik doğrulaması başarısız' };
    if (code === 'SESSION_EXPIRED') return { code: 'SESSION_EXPIRED', message: 'Servis oturumu süresi doldu' };
    return { code: 'UPSTREAM_UNAVAILABLE', message: 'Servis geçici olarak kullanılamıyor' };
  },
};
