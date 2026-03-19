import { useCallback, useEffect, useRef, useState } from 'react';
import { apiClient } from '../lib/api-client';

export function useApiData<T>(
  path: string,
  deps: unknown[] = [],
  enabled = true,
  pollIntervalMs?: number,
) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    if (!enabled) {
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.get<T>(path);
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }, [enabled, path]);

  useEffect(() => {
    void load();
  }, [load, ...deps]);

  useEffect(() => {
    if (!pollIntervalMs || !enabled) return;
    intervalRef.current = setInterval(() => void load(), pollIntervalMs);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [pollIntervalMs, enabled, load]);

  return { data, loading, error, reload: load, setData };
}
