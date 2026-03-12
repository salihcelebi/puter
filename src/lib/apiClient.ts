export class ApiClientError extends Error {
  constructor(
    message: string,
    public readonly status?: number,
    public readonly code?: string,
    public readonly details?: string
  ) {
    super(message);
    this.name = 'ApiClientError';
  }
}

export async function fetchApiJson<T>(path: string, options?: RequestInit): Promise<T> {
  let response: Response;

  try {
    response = await fetch(path, {
      credentials: 'include',
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers || {}),
      },
    });
  } catch (error) {
    throw new ApiClientError('API erişilemiyor', undefined, 'NETWORK_ERROR', String(error));
  }

  const rawBody = await response.text();
  if (!rawBody.trim()) {
    throw new ApiClientError('Sunucu boş yanıt döndü', response.status, 'EMPTY_BODY');
  }

  const contentType = response.headers.get('content-type') || '';
  if (!contentType.toLowerCase().includes('application/json')) {
    throw new ApiClientError('Sunucu JSON dönmedi', response.status, 'NON_JSON_RESPONSE', rawBody.slice(0, 240));
  }

  let data: any;
  try {
    data = JSON.parse(rawBody);
  } catch {
    throw new ApiClientError('Sunucu geçerli JSON dönmedi', response.status, 'INVALID_JSON');
  }

  if (!response.ok) {
    throw new ApiClientError(data?.error || 'API hatası', response.status, data?.code);
  }

  return data as T;
}
