import { DollarSign, FileText, TrendingDown, TrendingUp, Users } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface BillingSummary {
  kpis: {
    organizationsTotal: number;
    trialingOrgs: number;
    activeOrgs: number;
    pastDueOrgs: number;
    cancelledOrgs: number;
    totalCreditBalance: number;
  };
  subscriptions: Array<{
    id: string;
    status: string;
    planName: string;
    currentPeriodEnd: string | null;
    updatedAt: string;
    organization: {
      name: string;
      slug: string;
    };
  }>;
}

interface OrganizationRow {
  id: string;
  name: string;
  subscriptionStatus: string;
  creditBalance: number;
  createdAt: string;
}

export default function PlatformBilling() {
  const billing = useApiData<BillingSummary>('/admin/billing/summary');
  const organizations = useApiData<OrganizationRow[]>('/organizations?page=1&limit=50');

  if (billing.loading || organizations.loading) {
    return <LoadingState label="Loading platform billing..." />;
  }

  if (billing.error || organizations.error) {
    return (
      <ErrorState
        message={billing.error || organizations.error || 'Failed to load platform billing.'}
        onRetry={() => {
          void billing.reload();
          void organizations.reload();
        }}
      />
    );
  }

  const summary = billing.data?.kpis ?? {
    organizationsTotal: 0,
    trialingOrgs: 0,
    activeOrgs: 0,
    pastDueOrgs: 0,
    cancelledOrgs: 0,
    totalCreditBalance: 0,
  };

  const subscriptions = billing.data?.subscriptions ?? [];
  const orgRows = organizations.data ?? [];
  const planBreakdown = [
    { name: 'Trialing Orgs', organizations: summary.trialingOrgs, amount: 0, badge: 'bg-gray-100 text-gray-700' },
    { name: 'Active Orgs', organizations: summary.activeOrgs, amount: summary.totalCreditBalance, badge: 'bg-blue-100 text-blue-700' },
    { name: 'Past Due / Cancelled', organizations: summary.pastDueOrgs + summary.cancelledOrgs, amount: 0, badge: 'bg-red-100 text-red-700' },
  ];
  const chartData = orgRows.map((org) => ({
    name: org.name,
    credits: org.creditBalance,
  }));
  const exportReport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      subscriptions,
      organizations: orgRows,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'vireos-platform-billing.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Platform Billing</h1>
            <p className="text-sm text-gray-500 mt-1">Live billing and subscription visibility across organizations</p>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={exportReport}>
            <FileText className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'MRR Proxy', value: `$${summary.totalCreditBalance.toLocaleString()}`, icon: DollarSign, color: 'bg-[#0EA5E9]' },
            { label: 'ARR Proxy', value: `$${(summary.totalCreditBalance * 12).toLocaleString()}`, icon: TrendingUp, color: 'bg-green-500' },
            { label: 'Active Subscriptions', value: summary.activeOrgs.toString(), icon: Users, color: 'bg-purple-500' },
            { label: 'Churned / Past Due', value: (summary.cancelledOrgs + summary.pastDueOrgs).toString(), icon: TrendingDown, color: 'bg-red-500' },
          ].map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{kpi.label}</p>
                    <p className="text-3xl font-semibold text-[#1E3A5F]">{kpi.value}</p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {planBreakdown.map((plan) => (
            <Card key={plan.name} className="p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#1E3A5F]">{plan.name}</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${plan.badge}`}>
                  {plan.organizations} orgs
                </span>
              </div>
              <div className="text-sm text-gray-600">Tracked balance</div>
              <div className="text-2xl font-semibold text-[#1E3A5F] mt-1">${plan.amount.toLocaleString()}</div>
            </Card>
          ))}
        </div>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Organization Credit Balance</h3>
          {chartData.length === 0 ? (
            <EmptyState title="No organizations found" description="Platform billing metrics will appear once organizations exist." />
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="credits" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>

        <Card className="rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Recent Subscription Activity</h3>
          </div>
          {subscriptions.length === 0 ? (
            <div className="p-8">
              <EmptyState title="No Stripe subscriptions yet" description="Subscriptions will appear here once organizations move beyond trial." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period End</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Updated</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {subscriptions.map((subscription) => (
                    <tr key={subscription.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E3A5F]">{subscription.organization.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{subscription.planName}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{subscription.status}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {subscription.currentPeriodEnd ? new Date(subscription.currentPeriodEnd).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(subscription.updatedAt).toLocaleString()}</td>
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
