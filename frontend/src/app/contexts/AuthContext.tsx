import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { apiClient, clearAuthStorage } from '../lib/api-client';
import type { AuthTokens, User, FrontendRole } from '../types/api';

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  establishSession: (tokens: AuthTokens) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);
const IDLE_TIMEOUT_MS = 15 * 60 * 1000;

function normalizeRole(role: string): FrontendRole {
  const value = role.toLowerCase();
  if (value === 'super_admin' || value === 'super-admin') return 'super-admin';
  if (value === 'org_admin' || value === 'admin') return 'admin';
  if (value === 'advisor') return 'advisor';
  if (value === 'viewer' || value === 'compliance' || value === 'compliance-officer') return 'compliance-officer';
  return 'advisor';
}

function mapUser(raw: Record<string, unknown>): User {
  return {
    id: String(raw.id ?? ''),
    email: String(raw.email ?? ''),
    firstName: String(raw.firstName ?? ''),
    lastName: String(raw.lastName ?? ''),
    role: normalizeRole(String(raw.role ?? 'advisor')),
    orgId: String(raw.orgId ?? ''),
    organization: raw.organization
      ? {
          id: String((raw.organization as Record<string, unknown>).id ?? ''),
          name: String((raw.organization as Record<string, unknown>).name ?? ''),
          slug: String((raw.organization as Record<string, unknown>).slug ?? ''),
          subscriptionStatus: String((raw.organization as Record<string, unknown>).subscriptionStatus ?? ''),
        }
      : undefined,
  };
}

function persistTokens(tokens: AuthTokens): void {
  localStorage.setItem(apiClient.keys.accessToken, tokens.accessToken);
  localStorage.setItem(apiClient.keys.refreshToken, tokens.refreshToken);
  localStorage.setItem(apiClient.keys.expiresAt, String(Date.now() + tokens.expiresIn * 1000));
}

function persistUser(user: User): void {
  localStorage.setItem(apiClient.keys.user, JSON.stringify(user));
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [sessionExpiresAt, setSessionExpiresAt] = useState<number | null>(null);
  const [lastActivityAt, setLastActivityAt] = useState<number>(Date.now());

  const refresh = async () => {
    const me = await apiClient.get<Record<string, unknown>>('/auth/me');
    const mapped = mapUser(me);
    setUser(mapped);
    persistUser(mapped);
  };

  const refreshSession = async () => {
    const refreshToken = localStorage.getItem(apiClient.keys.refreshToken);
    if (!refreshToken) {
      throw new Error('Missing refresh token');
    }

    const result = await apiClient.post<AuthTokens>('/auth/refresh', { refreshToken });
    persistTokens(result);
    setSessionExpiresAt(Date.now() + result.expiresIn * 1000);
    await refresh();
  };

  const login = async (email: string, password: string) => {
    const result = await apiClient.post<AuthTokens>('/auth/login', { email, password });
    persistTokens(result);
    setSessionExpiresAt(Date.now() + result.expiresIn * 1000);
    await refresh();
  };

  const establishSession = async (tokens: AuthTokens) => {
    persistTokens(tokens);
    setSessionExpiresAt(Date.now() + tokens.expiresIn * 1000);
    setLastActivityAt(Date.now());
    await refresh();
  };

  const logout = async () => {
    try {
      await apiClient.post('/auth/logout');
    } catch {
      // Ignore logout failures while clearing local auth state.
    }
    clearAuthStorage();
    setUser(null);
    setSessionExpiresAt(null);
  };

  useEffect(() => {
    const init = async () => {
      const token = localStorage.getItem(apiClient.keys.accessToken);
      const cachedUser = localStorage.getItem(apiClient.keys.user);

      if (!token) {
        setIsLoading(false);
        return;
      }

      const storedExpiry = localStorage.getItem(apiClient.keys.expiresAt);
      if (storedExpiry) {
        const parsed = Number(storedExpiry);
        setSessionExpiresAt(Number.isFinite(parsed) ? parsed : null);
      }
      setLastActivityAt(Date.now());

      if (cachedUser) {
        try {
          setUser(JSON.parse(cachedUser) as User);
        } catch {
          localStorage.removeItem(apiClient.keys.user);
        }
      }

      try {
        await refresh();
      } catch {
        clearAuthStorage();
        setUser(null);
        setSessionExpiresAt(null);
      } finally {
        setIsLoading(false);
      }
    };

    void init();
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    const markActive = () => setLastActivityAt(Date.now());
    const events: Array<keyof WindowEventMap> = ['mousedown', 'keydown', 'scroll', 'touchstart'];

    events.forEach((eventName) => window.addEventListener(eventName, markActive, { passive: true }));

    return () => {
      events.forEach((eventName) => window.removeEventListener(eventName, markActive));
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    const remainingMs = Math.max(IDLE_TIMEOUT_MS - (Date.now() - lastActivityAt), 0);
    const timeout = window.setTimeout(() => {
      void logout();
    }, remainingMs);

    return () => window.clearTimeout(timeout);
  }, [user, lastActivityAt]);

  useEffect(() => {
    if (!user || !sessionExpiresAt) {
      return;
    }

    const refreshInMs = Math.max(sessionExpiresAt - Date.now() - 60_000, 5_000);
    const timeout = window.setTimeout(() => {
      void refreshSession().catch(() => {
        clearAuthStorage();
        setUser(null);
        setSessionExpiresAt(null);
      });
    }, refreshInMs);

    return () => window.clearTimeout(timeout);
  }, [user, sessionExpiresAt]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      isLoading,
      login,
      establishSession,
      logout,
      refresh,
    }),
    [user, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used inside AuthProvider');
  }
  return context;
}
