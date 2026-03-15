/*
█████████████████████████████████████████████
1) BU DOSYA, FRONTEND TARAFINDA AUTH ENDPOINT'LERİNE GİDEN İSTEMCİ KATMANIDIR.
2) API_BASE_URL DEĞERİ, AUTH İSTEKLERİNİN HANGİ KÖKE GİDECEĞİNİ BELİRLEMEK İÇİN ÇÖZÜMLENİR.
3) resolveApiBaseUrl() İÇİNDE AYARLI ORIGIN İLE window.location.origin KARŞILAŞTIRILIR.
4) ORIGIN UYUŞMUYORSA SAME-ORIGIN /api/* FALLBACK YAPILIR.
5) BU, DEPLOY ORTAMI İLE TARAYICI ORTAMI ÇAKIŞTIĞINDA AUTH KIRILMASINI AZALTMAK İÇİN YAPILMIŞTIR.
6) AUTH_PATHS SABİTİ, login, register, me, logout VE google/url ENDPOINT'LERİNİ TEK YERDE TUTAR.
7) AuthApiError SINIFI, STATUS, CODE VE DETAILS GİBİ EK BİLGİ TAŞIYAN ÖZEL BİR İSTEMCİ HATASI ÜRETİR.
8) buildAuthUrl(), PATH'I API_BASE_URL İLE BİRLEŞTİREREK TAM AUTH URL'SİNİ OLUŞTURUR.
9) withDeployHint(), HATA MESAJINA DEPLOY BAĞLAMI EKLEYEN YARDIMCI BİR METİN KATMANIDIR.
10) KISACA: BU DOSYA, AUTH ÇAĞRILARININ DOĞRU KÖKE GİTMESİNİ VE HATALARIN DAHA AÇIK GÖRÜLMESİNİ SAĞLAYAN FRONTEND AUTH ADAPTÖRÜDÜR.
█████████████████████████████████████████████
*/
const RAW_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').trim();
const NORMALIZED_API_BASE_URL = RAW_API_BASE_URL.replace(/\/$/, '');
const ALLOW_CROSS_ORIGIN_API = String(import.meta.env.VITE_ALLOW_CROSS_ORIGIN_API || '').toLowerCase() === 'true';

const resolveApiBaseUrl = () => {
  if (!NORMALIZED_API_BASE_URL) {
    return '';
  }

  if (typeof window === 'undefined') {
    return NORMALIZED_API_BASE_URL;
  }

  if (ALLOW_CROSS_ORIGIN_API) {
    return NORMALIZED_API_BASE_URL;
  }

  try {
    const configured = new URL(NORMALIZED_API_BASE_URL, window.location.origin);
    if (configured.origin !== window.location.origin) {
      console.warn('[auth-api] Cross-origin VITE_API_BASE_URL ignored. Falling back to same-origin /api/*.', {
        configuredOrigin: configured.origin,
        currentOrigin: window.location.origin,
      });
      return '';
    }
  } catch {
    return '';
  }

  return NORMALIZED_API_BASE_URL;
};

const API_BASE_URL = resolveApiBaseUrl();

const AUTH_PATHS = ['/api/auth/login', '/api/auth/register', '/api/auth/me', '/api/auth/logout', '/api/auth/google/url'] as const;
type AuthPath = (typeof AUTH_PATHS)[number];

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: string
  ) {
    super(message);
    this.name = 'AuthApiError';
  }
}

const buildAuthUrl = (path: AuthPath) => {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
};

const withDeployHint = (message: string) => `${message}. Deploy ortamında backend çalışmıyor olabilir.`;

const getNetworkErrorMessage = () => {
  if (API_BASE_URL) {
    return withDeployHint('Auth API erişilemiyor');
  }

  return withDeployHint('Auth API erişilemiyor');
};

export async function safeFetchAuthJson<T>(
  path: AuthPath,
  options?: RequestInit
): Promise<T> {
  const url = buildAuthUrl(path);

  let response: Response;
  try {
    response = await fetch(url, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
  } catch (error) {
    throw new AuthApiError(getNetworkErrorMessage(), undefined, 'AUTH_API_UNREACHABLE', String(error));
  }

  const rawBody = await response.text();
  if (!rawBody.trim()) {
    const message = response.ok
      ? withDeployHint('Sunucu JSON dönmedi')
      : withDeployHint('Auth API erişilemiyor');

    throw new AuthApiError(message, response.status, 'EMPTY_BODY');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    console.error('[auth-api] Beklenmeyen content-type:', {
      path,
      status: response.status,
      contentType,
      bodyPreview: rawBody.slice(0, 240),
    });

    throw new AuthApiError(
      withDeployHint('Sunucu JSON dönmedi'),
      response.status,
      'NON_JSON_RESPONSE',
      rawBody.slice(0, 240)
    );
  }

  let parsed: any;
  try {
    parsed = JSON.parse(rawBody);
  } catch (error) {
    console.error('[auth-api] JSON parse hatası:', {
      path,
      status: response.status,
      bodyPreview: rawBody.slice(0, 240),
      error,
    });

    throw new AuthApiError(withDeployHint('Sunucu JSON dönmedi'), response.status, 'INVALID_JSON');
  }

  if (!response.ok) {
    throw new AuthApiError(
      parsed?.error || withDeployHint('Auth API erişilemiyor'),
      response.status,
      parsed?.code
    );
  }

  return parsed as T;
}

export const authApi = {
  login: <T>(body: { identifier: string; password: string }) =>
    safeFetchAuthJson<T>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  register: <T>(body: {
    email: string;
    password: string;
    kullanici_adi: string;
    gorunen_ad: string;
  }) =>
    safeFetchAuthJson<T>('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  me: <T>() => safeFetchAuthJson<T>('/api/auth/me'),
  logout: <T>() =>
    safeFetchAuthJson<T>('/api/auth/logout', {
      method: 'POST',
    }),
  getGoogleUrl: () => buildAuthUrl('/api/auth/google/url'),
};
