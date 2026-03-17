/*
DELILX: Bu adapter artık sabit puter.workers.exec bağımlılığı yerine backend effective-config + güvenli JSON kontrolü kullanır.
*/

export const ANA_AI_WORKER = 'dynamic-from-effective-config';
export const IS_DURUMU_WORKER = 'dynamic-from-effective-config';
export const VARSAYILAN_TIMEOUT_MS = 120000;

async function guvenliJsonIste(url, init) {
  const response = await fetch(url, init);
  const text = await response.text();
  const contentType = response.headers.get('content-type') || '';

  // DELILX: Bu koruma JSON yerine HTML fallback'ını kullanıcıya patlatmamak içindir.
  if (/<!doctype|<html/i.test(text)) {
    throw new Error('Beklenmeyen HTML yanıtı alındı. API yönlendirmesi kontrol edilmeli.');
  }
  if (!contentType.includes('application/json')) {
    throw new Error('JSON beklenirken farklı içerik tipi döndü.');
  }

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Yanıt JSON olarak ayrıştırılamadı.');
  }

  if (!response.ok) {
    throw new Error(data?.error || `İstek başarısız (${response.status})`);
  }

  return data;
}

async function effectiveConfig(feature) {
  return guvenliJsonIste(`/api/ai/effective-config/${encodeURIComponent(feature)}`);
}

export async function workerCagir({ feature = 'chat', endpoint = '/api/ai/chat', payload = {}, timeoutMs = VARSAYILAN_TIMEOUT_MS, method = 'POST' } = {}) {
  const cfg = await effectiveConfig(feature);
  const timer = new AbortController();
  const timeout = setTimeout(() => timer.abort(), timeoutMs);

  try {
    const result = await guvenliJsonIste(endpoint, {
      method,
      signal: timer.signal,
      headers: {
        'Content-Type': 'application/json',
        'x-source-page': payload?.sourcePage || 'workerApi.js',
      },
      body: method === 'GET' ? undefined : JSON.stringify({ ...payload, _effectiveConfig: cfg?.config || null }),
    });
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

export async function chatIste({ prompt, model, timeoutMs, ...extra } = {}) {
  return workerCagir({ feature: 'chat', endpoint: '/api/ai/chat', timeoutMs, payload: { prompt, modelId: model, ...extra } });
}
export const sohbetEt = chatIste;

export async function gorselUret({ prompt, model, timeoutMs, ...extra } = {}) {
  return workerCagir({ feature: 'image', endpoint: '/api/ai/image', timeoutMs, payload: { prompt, modelId: model, ...extra } });
}
export const resimUret = gorselUret;

export async function sesiUret({ text, voice, model, timeoutMs, ...extra } = {}) {
  return workerCagir({ feature: 'tts', endpoint: '/api/ai/tts', timeoutMs, payload: { text, voiceName: voice, modelId: model, ...extra } });
}
export const ttsIste = sesiUret;

export async function videoUret({ prompt, model, timeoutMs, ...extra } = {}) {
  return workerCagir({ feature: 'video', endpoint: '/api/ai/video', timeoutMs, payload: { prompt, modelId: model, ...extra } });
}

export async function fotografaVideoUret({ prompt, imageUrl, model, timeoutMs, ...extra } = {}) {
  return workerCagir({ feature: 'photoToVideo', endpoint: '/api/ai/photo-to-video', timeoutMs, payload: { prompt, imageUrl, modelId: model, ...extra } });
}
export const photoToVideoIste = fotografaVideoUret;

export async function isDurumuGetir(jobId) {
  return guvenliJsonIste(`/api/ai/jobs/${encodeURIComponent(jobId)}`);
}
export const isDurumuGetirGet = isDurumuGetir;

export default {
  workerCagir,
  chatIste,
  sohbetEt,
  gorselUret,
  resimUret,
  sesiUret,
  ttsIste,
  videoUret,
  fotografaVideoUret,
  photoToVideoIste,
  isDurumuGetir,
  isDurumuGetirGet,
};
