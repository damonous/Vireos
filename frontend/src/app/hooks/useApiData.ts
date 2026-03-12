import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../lib/api-client';

export function useApiData<T>(path: string, deps: unknown[] = [], enabled = true) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  return { data, loading, error, reload: load, setData };
}
