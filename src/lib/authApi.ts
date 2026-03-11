const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || '').replace(/\/$/, '');

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
