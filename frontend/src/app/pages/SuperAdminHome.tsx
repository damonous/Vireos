import { Building2, Users, DollarSign, CreditCard, Eye, Settings as SettingsIcon, CheckCircle, AlertTriangle, TrendingUp, ArrowUp, Sliders } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/api-client';

interface OrganizationRow {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: string;
  creditBalance: number;
  userCount?: number;
  createdAt: string;
}

interface UserRow {
  id: string;
  status: string;
}

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
    organization: {
      name: string;
    };
  }>;
}

interface MetricsPayload {
  activeConnections: number;
  errorRate4xx: number;
  errorRate5xx: number;
}

export default function SuperAdminHome() {
  const navigate = useNavigate();
  const [organizations, setOrganizations] = useState<OrganizationRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [billing, setBilling] = useState<BillingSummary | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload | null>(null);

  useEffect(() => {
    const load = async () => {
      const [organizationsData, usersData, billingData] = await Promise.all([
        apiClient.get<OrganizationRow[]>('/organizations?page=1&limit=20'),
        apiClient.get<UserRow[]>('/admin/users?page=1&limit=20'),
        apiClient.get<BillingSummary>('/admin/billing/summary'),
      ]);

      let metricsData: MetricsPayload | null = null;
      try {
        metricsData = await apiClient.get<MetricsPayload>('/metrics');
      } catch {
        metricsData = null;
      }

      setOrganizations(organizationsData);
      setUsers(usersData);
      setBilling(billingData);
      setMetrics(metricsData);
    };

    void load();
  }, []);

  const kpiData = useMemo(() => [
    { label: 'Total Organizations', value: String(billing?.kpis.organizationsTotal ?? organizations.length), icon: Building2, color: 'bg-indigo-500', trend: null },
    { label: 'Total Users', value: String(users.length), icon: Users, color: 'bg-blue-500', trend: null },
    { label: 'Tracked Credit Balance', value: `$${(billing?.kpis.totalCreditBalance ?? 0).toLocaleString()}`, icon: DollarSign, color: 'bg-green-500', trend: null },
    { label: 'Annualized Credit Proxy', value: `$${((billing?.kpis.totalCreditBalance ?? 0) * 12).toLocaleString()}`, icon: TrendingUp, color: 'bg-green-500', trend: 'Live projection from current balance' },
    {
      label: 'Avg Revenue Per Org',
      value: `$${Math.round((billing?.kpis.totalCreditBalance ?? 0) / Math.max(1, billing?.kpis.organizationsTotal ?? organizations.length)).toLocaleString()}`,
      icon: DollarSign,
      color: 'bg-blue-500',
      trend: 'Based on current credit balance',
    },
    { label: 'Active Subscriptions', value: String(billing?.kpis.activeOrgs ?? 0), icon: CreditCard, color: 'bg-purple-500', trend: null },
  ], [billing, organizations.length, users.length]);

  const systemHealth = [
    { service: 'API Status', status: metrics?.errorRate5xx ? 'Degraded' : 'Operational', statusColor: metrics?.errorRate5xx ? 'bg-yellow-500' : 'bg-green-500', icon: metrics?.errorRate5xx ? AlertTriangle : CheckCircle },
    { service: 'Billing', status: billing?.kpis.pastDueOrgs ? 'Attention Needed' : 'Operational', statusColor: billing?.kpis.pastDueOrgs ? 'bg-yellow-500' : 'bg-green-500', icon: billing?.kpis.pastDueOrgs ? AlertTriangle : CheckCircle },
    { service: 'Readiness', status: metrics?.activeConnections !== undefined ? 'Operational' : 'Unknown', statusColor: metrics?.activeConnections !== undefined ? 'bg-green-500' : 'bg-yellow-500', icon: metrics?.activeConnections !== undefined ? CheckCircle : AlertTriangle },
    { service: 'Error Rate', status: (metrics?.errorRate4xx ?? 0) > 0 || (metrics?.errorRate5xx ?? 0) > 0 ? 'Watch' : 'Operational', statusColor: (metrics?.errorRate4xx ?? 0) > 0 || (metrics?.errorRate5xx ?? 0) > 0 ? 'bg-yellow-500' : 'bg-green-500', icon: (metrics?.errorRate4xx ?? 0) > 0 || (metrics?.errorRate5xx ?? 0) > 0 ? AlertTriangle : CheckCircle },
  ];

  const platformActivity = useMemo(() => [
    { action: 'Organizations visible', detail: `${organizations.length} orgs returned by the platform API`, time: 'Current snapshot' },
    { action: 'Active subscriptions', detail: `${billing?.kpis.activeOrgs ?? 0} orgs currently active`, time: 'Billing summary' },
    { action: 'Trialing organizations', detail: `${billing?.kpis.trialingOrgs ?? 0} orgs in trial`, time: 'Billing summary' },
    { action: 'Past due organizations', detail: `${billing?.kpis.pastDueOrgs ?? 0} orgs need billing attention`, time: 'Billing summary' },
    { action: 'Live connections', detail: `${metrics?.activeConnections ?? 0} active connections reported`, time: 'Metrics endpoint' },
  ], [organizations.length, billing, metrics]);
  
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1E3A5F]">Key Metrics</h2>
          <button className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1E3A5F] transition-colors">
            <Sliders className="w-4 h-4" />
            Customize Metrics
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {kpiData.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">{kpi.label}</p>
                    <p className="text-3xl font-semibold text-[#1E3A5F] mb-1">{kpi.value}</p>
                    {kpi.trend ? (
                      <div className="flex items-center gap-1 mt-2">
                        <ArrowUp className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">{kpi.trend}</span>
                      </div>
                    ) : null}
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Organizations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Users</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Joined</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.map((org) => (
                  <tr key={org.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#1E3A5F] flex items-center justify-center text-white font-medium text-sm">
                          {org.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-[#1E3A5F]">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={org.subscriptionStatus === 'ACTIVE' ? 'bg-blue-100 text-blue-800 hover:bg-blue-100' : 'bg-gray-100 text-gray-800 hover:bg-gray-100'}>
                        {org.subscriptionStatus}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {org.userCount ?? 0}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={org.isActive ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-amber-100 text-amber-800 hover:bg-amber-100'}>
                        {org.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {org.creditBalance.toLocaleString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {new Date(org.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-[#0EA5E9] hover:text-[#0284C7] mr-3 inline-flex items-center gap-1" onClick={() => navigate('/super-admin/orgs')}>
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button className="text-gray-500 hover:text-[#1E3A5F] inline-flex items-center gap-1" onClick={() => navigate('/super-admin/settings')}>
                        <SettingsIcon className="w-4 h-4" />
                        Manage
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <div className="grid grid-cols-3 gap-6">
          {systemHealth.map((system) => {
            const Icon = system.icon;
            return (
              <Card key={system.service} className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-medium text-gray-600">{system.service}</h3>
                  <div className={`w-3 h-3 rounded-full ${system.statusColor}`}></div>
                </div>
                <div className="flex items-center gap-2">
                  <Icon className={`w-5 h-5 ${system.statusColor === 'bg-green-500' ? 'text-green-600' : 'text-yellow-600'}`} />
                  <span className="text-sm font-medium text-[#1E3A5F]">{system.status}</span>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-lg shadow-sm border border-gray-200 mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Recent Platform Activity</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {platformActivity.map((activity) => (
              <div key={activity.action} className="px-6 py-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-[#1E3A5F] mb-1">{activity.action}</p>
                    <p className="text-sm text-gray-600">{activity.detail}</p>
                  </div>
                  <p className="text-xs text-gray-400 whitespace-nowrap ml-4">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
