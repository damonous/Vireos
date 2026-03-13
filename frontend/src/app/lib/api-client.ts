import type { ApiEnvelope, ApiErrorEnvelope } from '../types/api';

const API_PREFIX = '/api/v1';

const STORAGE_KEYS = {
  accessToken: 'vireos_access_token',
  refreshToken: 'vireos_refresh_token',
  expiresAt: 'vireos_access_expires_at',
  user: 'vireos_user',
} as const;

function resolveUrl(path: string): string {
  if (path.startsWith('/health') || path.startsWith('/metrics')) {
    return path;
  }
  if (path.startsWith('/api/')) {
    return path;
  }
  return `${API_PREFIX}${path.startsWith('/') ? path : `/${path}`}`;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status: number, code: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let refreshPromise: Promise<string | null> | null = null;

function getAccessToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.accessToken);
}

function getRefreshToken(): string | null {
  return localStorage.getItem(STORAGE_KEYS.refreshToken);
}

function setAccessToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.accessToken, token);
}

function setRefreshToken(token: string): void {
  localStorage.setItem(STORAGE_KEYS.refreshToken, token);
}

export function clearAuthStorage(): void {
  localStorage.removeItem(STORAGE_KEYS.accessToken);
  localStorage.removeItem(STORAGE_KEYS.refreshToken);
  localStorage.removeItem(STORAGE_KEYS.expiresAt);
  localStorage.removeItem(STORAGE_KEYS.user);
}

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) {
    return null;
  }

  if (!refreshPromise) {
    refreshPromise = (async () => {
      const response = await fetch(`${API_PREFIX}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as ApiEnvelope<{ accessToken: string; refreshToken: string }>;
      if (!payload.success || !payload.data?.accessToken) {
        return null;
      }

      setAccessToken(payload.data.accessToken);
      if (payload.data.refreshToken) {
        setRefreshToken(payload.data.refreshToken);
      }

      return payload.data.accessToken;
    })().finally(() => {
      refreshPromise = null;
    });
  }

  return refreshPromise;
}

async function parseResponse<T>(response: Response): Promise<T> {
  let body: unknown = null;

  if (response.status !== 204) {
    body = await response.json();
  }

  if (!response.ok) {
    const errorBody = body as ApiErrorEnvelope | null;
    let message = errorBody?.error?.message ?? `Request failed with status ${response.status}`;

    // If there are validation details, build a user-friendly message
    const details = errorBody?.error?.details as Array<{ field: string; message: string }> | undefined;
    if (details && Array.isArray(details) && details.length > 0) {
      message = details.map((d) => d.message).join('. ');
    }

    const code = errorBody?.error?.code ?? 'HTTP_ERROR';
    throw new ApiError(message, response.status, code, errorBody?.error?.details);
  }

  if (body && typeof body === 'object' && 'success' in (body as Record<string, unknown>)) {
    const envelope = body as ApiEnvelope<T>;
    return envelope.data;
  }

  return body as T;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retry = true
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(resolveUrl(path), {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (response.status === 401 && retry && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return request<T>(method, path, body, false);
    }
    clearAuthStorage();
    if (window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
  }

  return parseResponse<T>(response);
}

export const apiClient = {
  get: <T>(path: string): Promise<T> => request<T>('GET', path),
  post: <T>(path: string, body?: unknown): Promise<T> => request<T>('POST', path, body),
  put: <T>(path: string, body?: unknown): Promise<T> => request<T>('PUT', path, body),
  patch: <T>(path: string, body?: unknown): Promise<T> => request<T>('PATCH', path, body),
  del: <T>(path: string): Promise<T> => request<T>('DELETE', path),
  upload: async <T>(path: string, formData: FormData): Promise<T> => {
    const token = getAccessToken();
    const headers: Record<string, string> = {};

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(resolveUrl(path), {
      method: 'POST',
      headers,
      body: formData,
    });

    return parseResponse<T>(response);
  },
  keys: STORAGE_KEYS,
};
