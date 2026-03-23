import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface TokenUsageResponse {
  items: Array<{
    id: string;
    title: string;
    originalPrompt: string;
    tokensUsed: number;
    createdAt: string;
    organization: {
      id: string;
      name: string;
      slug: string;
    };
    creator: {
      id: string;
      firstName: string;
      lastName: string;
      email: string;
    };
  }>;
  summary: {
    totalTokensUsed: number;
    byOrganization: Array<{
      organizationId: string;
      tokensUsed: number;
      organization: {
        id: string;
        name: string;
        slug: string;
      } | null;
    }>;
    byUser: Array<{
      userId: string;
      tokensUsed: number;
      user: {
        id: string;
        firstName: string;
        lastName: string;
        email: string;
      } | null;
    }>;
  };
}

export default function TokenUsage() {
  const usage = useApiData<TokenUsageResponse>('/admin/token-usage?page=1&limit=50');

  if (usage.loading) {
    return <LoadingState label="Loading token usage..." />;
  }

  if (usage.error) {
    return <ErrorState message={usage.error} onRetry={() => void usage.reload()} />;
  }

  const items = usage.data?.items ?? [];
  const orgChart = usage.data?.summary.byOrganization.map((row) => ({
    name: row.organization?.name ?? row.organizationId.slice(0, 8),
    tokens: row.tokensUsed,
  })) ?? [];

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8 space-y-6">
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
          <Card className="p-6 rounded-lg border border-gray-200 shadow-sm">
            <p className="text-sm text-gray-500">Total Tokens Used</p>
            <p className="mt-2 text-4xl font-semibold text-[#1E3A5F]">{usage.data?.summary.totalTokensUsed ?? 0}</p>
            <div className="mt-6 space-y-3">
              {(usage.data?.summary.byUser ?? []).slice(0, 8).map((row) => (
                <div key={row.userId} className="rounded-lg bg-gray-50 p-3">
                  <p className="font-medium text-[#1E3A5F]">{row.user ? `${row.user.firstName} ${row.user.lastName}` : row.userId}</p>
                  <p className="text-xs text-gray-500">{row.user?.email ?? 'Unknown user'}</p>
                  <p className="mt-1 text-sm text-gray-700">{row.tokensUsed.toLocaleString()} tokens</p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6 rounded-lg border border-gray-200 shadow-sm">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Usage by Organization</h2>
            {orgChart.length === 0 ? (
              <EmptyState title="No token activity yet" description="Content generation requests will populate this chart." />
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={orgChart}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="tokens" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <Card className="rounded-lg border border-gray-200 shadow-sm overflow-hidden">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Generation Requests</h2>
          </div>
          {items.length === 0 ? (
            <div className="p-10">
              <EmptyState title="No generation requests found" description="Draft generation requests will appear here once content is created." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Request</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Tokens</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#1E3A5F]">{item.title}</p>
                        <p className="mt-1 max-w-xl truncate text-xs text-gray-500">{item.originalPrompt}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.organization.name}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{item.creator.firstName} {item.creator.lastName}</td>
                      <td className="px-6 py-4 text-sm font-medium text-[#1E3A5F]">{item.tokensUsed.toLocaleString()}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{new Date(item.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
