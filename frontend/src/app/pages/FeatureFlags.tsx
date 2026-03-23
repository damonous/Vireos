import { useMemo, useState } from 'react';
import { X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { apiClient } from '../lib/api-client';

interface FeatureFlagRow {
  id: string;
  organizationId: string;
  flag: string;
  isEnabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export default function FeatureFlags() {
  const [environment, setEnvironment] = useState('Production');
  const [showBanner, setShowBanner] = useState(true);
  const flags = useApiData<FeatureFlagRow[]>('/feature-flags');
  const [savingId, setSavingId] = useState<string | null>(null);

  const activeCount = useMemo(
    () => (flags.data ?? []).filter((item) => item.isEnabled).length,
    [flags.data]
  );
  const inactiveCount = (flags.data?.length ?? 0) - activeCount;

  if (flags.loading) {
    return <LoadingState label="Loading feature flags..." />;
  }

  if (flags.error) {
    return <ErrorState message={flags.error} onRetry={() => void flags.reload()} />;
  }

  const toggleFlag = async (id: string, isEnabled: boolean) => {
    setSavingId(id);
    try {
      await apiClient.patch(`/feature-flags/${id}`, { isEnabled: !isEnabled });
      await flags.reload();
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-600">Environment:</span>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] bg-white"
            >
              <option value="Production">Production</option>
            </select>
          </div>
        </div>
      </div>

      <div className="p-8">
        {showBanner && environment === 'Production' ? (
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-3 mb-6 flex items-start justify-between">
            <div className="flex items-start gap-2">
              <span className="text-yellow-600 text-lg">!</span>
              <p className="text-sm text-yellow-800">
                You are editing organization feature flags. Changes take effect immediately once saved.
              </p>
            </div>
            <button onClick={() => setShowBanner(false)} className="text-yellow-600 hover:text-yellow-800">
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4 mb-6 max-w-md">
          <Card className="p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600">Active Flags</p>
            <p className="text-3xl font-semibold text-[#1E3A5F] mt-1">{activeCount}</p>
          </Card>
          <Card className="p-4 rounded-lg shadow-sm border border-gray-200">
            <p className="text-sm text-gray-600">Inactive Flags</p>
            <p className="text-3xl font-semibold text-[#1E3A5F] mt-1">{inactiveCount}</p>
          </Card>
        </div>

        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Flag</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {(flags.data ?? []).map((flag) => (
                  <tr key={flag.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E3A5F]">
                      {flag.flag.replace(/_/g, ' ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${flag.isEnabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        {flag.isEnabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {new Date(flag.updatedAt).toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={() => void toggleFlag(flag.id, flag.isEnabled)}
                        disabled={savingId === flag.id}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${flag.isEnabled ? 'bg-[#0EA5E9]' : 'bg-gray-300'} ${savingId === flag.id ? 'opacity-60' : ''}`}
                      >
                        <span
                          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${flag.isEnabled ? 'translate-x-6' : 'translate-x-1'}`}
                        />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </div>
  );
}
