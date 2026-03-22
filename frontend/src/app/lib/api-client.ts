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

// ---------------------------------------------------------------------------
// SSE streaming support
// ---------------------------------------------------------------------------

export interface SSECallbacks {
  onEvent: (event: Record<string, unknown>) => void;
  onError: (err: Error) => void;
  onComplete: () => void;
}

async function streamPost(
  path: string,
  body: unknown,
  callbacks: SSECallbacks,
  signal?: AbortSignal,
  retry = true
): Promise<void> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let response: Response;
  try {
    response = await fetch(resolveUrl(path), {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal,
    });
  } catch (err) {
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
    return;
  }

  if (response.status === 401 && retry && !path.includes('/auth/login') && !path.includes('/auth/refresh')) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return streamPost(path, body, callbacks, signal, false);
    }
    clearAuthStorage();
    if (window.location.pathname !== '/login') {
      window.location.replace('/login');
    }
    return;
  }

  if (!response.ok) {
    let message = `Request failed with status ${response.status}`;
    try {
      const errorBody = await response.json();
      if (errorBody?.error?.message) {
        message = errorBody.error.message;
      }
    } catch {
      // ignore parse errors
    }
    callbacks.onError(new ApiError(message, response.status, 'HTTP_ERROR'));
    return;
  }

  if (!response.body) {
    callbacks.onError(new Error('Response body is not readable'));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            callbacks.onEvent(parsed);
          } catch {
            // skip malformed JSON
          }
        }
      }
    }

    // Process any remaining buffer
    if (buffer.trim().startsWith('data: ')) {
      try {
        const parsed = JSON.parse(buffer.trim().slice(6));
        callbacks.onEvent(parsed);
      } catch {
        // skip malformed JSON
      }
    }

    callbacks.onComplete();
  } catch (err) {
    if (signal?.aborted) return;
    callbacks.onError(err instanceof Error ? err : new Error(String(err)));
  }
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
  streamPost,
  keys: STORAGE_KEYS,
};
