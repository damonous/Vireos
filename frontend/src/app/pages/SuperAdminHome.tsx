import { Building2, Users, DollarSign, CreditCard, Eye, Settings as SettingsIcon, CheckCircle, AlertTriangle, TrendingUp, ArrowUp, Sliders } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { useNavigate } from 'react-router';

const kpiData = [
  { label: 'Total Organizations', value: '24', icon: Building2, color: 'bg-indigo-500', trend: null },
  { label: 'Total Users', value: '187', icon: Users, color: 'bg-blue-500', trend: null },
  { label: 'MRR', value: '$8,940', icon: DollarSign, color: 'bg-green-500', trend: null },
  { label: 'ARR', value: '$107,280', icon: TrendingUp, color: 'bg-green-500', trend: '+18% YoY' },
  { label: 'Avg Revenue Per Org', value: '$406', icon: DollarSign, color: 'bg-blue-500', trend: '+8% vs last quarter' },
  { label: 'Active Subscriptions', value: '22', icon: CreditCard, color: 'bg-purple-500', trend: null },
];

const organizations = [
  {
    name: 'Pinnacle Financial',
    plan: 'Professional',
    planColor: 'bg-blue-100 text-blue-800',
    users: 8,
    status: 'Active',
    statusColor: 'bg-green-100 text-green-800',
    mrr: '$299',
    joinedDate: 'Jan 15, 2024',
  },
  {
    name: 'Summit Wealth',
    plan: 'Enterprise',
    planColor: 'bg-purple-100 text-purple-800',
    users: 24,
    status: 'Active',
    statusColor: 'bg-green-100 text-green-800',
    mrr: '$899',
    joinedDate: 'Feb 3, 2024',
  },
  {
    name: 'Blue Ridge Advisors',
    plan: 'Professional',
    planColor: 'bg-blue-100 text-blue-800',
    users: 5,
    status: 'Active',
    statusColor: 'bg-green-100 text-green-800',
    mrr: '$299',
    joinedDate: 'Jan 28, 2024',
  },
  {
    name: 'Coastal Capital',
    plan: 'Starter',
    planColor: 'bg-gray-100 text-gray-800',
    users: 2,
    status: 'Trial',
    statusColor: 'bg-amber-100 text-amber-800',
    mrr: '$99',
    joinedDate: 'Feb 20, 2024',
  },
  {
    name: 'Meridian Partners',
    plan: 'Professional',
    planColor: 'bg-blue-100 text-blue-800',
    users: 12,
    status: 'Active',
    statusColor: 'bg-green-100 text-green-800',
    mrr: '$299',
    joinedDate: 'Dec 10, 2023',
  },
  {
    name: 'Peak Financial',
    plan: 'Enterprise',
    planColor: 'bg-purple-100 text-purple-800',
    users: 31,
    status: 'Active',
    statusColor: 'bg-green-100 text-green-800',
    mrr: '$899',
    joinedDate: 'Nov 5, 2023',
  },
  {
    name: 'Harbor Wealth',
    plan: 'Professional',
    planColor: 'bg-blue-100 text-blue-800',
    users: 7,
    status: 'Active',
    statusColor: 'bg-green-100 text-green-800',
    mrr: '$299',
    joinedDate: 'Jan 8, 2024',
  },
  {
    name: 'Sunrise Advisors',
    plan: 'Starter',
    planColor: 'bg-gray-100 text-gray-800',
    users: 3,
    status: 'Active',
    statusColor: 'bg-green-100 text-green-800',
    mrr: '$99',
    joinedDate: 'Feb 12, 2024',
  },
];

const systemHealth = [
  { service: 'API Status', status: 'Operational', statusColor: 'bg-green-500', icon: CheckCircle },
  { service: 'Stripe', status: 'Operational', statusColor: 'bg-green-500', icon: CheckCircle },
  { service: 'SendGrid', status: 'Operational', statusColor: 'bg-green-500', icon: CheckCircle },
  { service: 'LinkedIn API', status: 'Rate Limited', statusColor: 'bg-yellow-500', icon: AlertTriangle },
];

const platformActivity = [
  { action: 'New organization signup', detail: 'Coastal Capital started trial', time: '1 hour ago' },
  { action: 'Plan upgrade', detail: 'Summit Wealth upgraded to Enterprise', time: '3 hours ago' },
  { action: 'User count milestone', detail: 'Platform reached 187 total users', time: '5 hours ago' },
  { action: 'Subscription renewed', detail: 'Peak Financial renewed annual plan', time: '1 day ago' },
  { action: 'New feature deployed', detail: 'LinkedIn integration v2.0 released', time: '2 days ago' },
];

export default function SuperAdminHome() {
  const navigate = useNavigate();
  
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Platform Overview</h1>
            <p className="text-sm text-gray-500 mt-1">Monitor all organizations and system health</p>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* KPI Cards Section Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-[#1E3A5F]">Key Metrics</h2>
          <button className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-[#1E3A5F] transition-colors">
            <Sliders className="w-4 h-4" />
            Customize Metrics
          </button>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {kpiData.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <p className="text-sm text-gray-600 mb-1">{kpi.label}</p>
                    <p className="text-3xl font-semibold text-[#1E3A5F] mb-1">{kpi.value}</p>
                    {kpi.trend && (
                      <div className="flex items-center gap-1 mt-2">
                        <ArrowUp className="w-3.5 h-3.5 text-green-600" />
                        <span className="text-sm text-green-600 font-medium">{kpi.trend}</span>
                      </div>
                    )}
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center flex-shrink-0`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Organizations Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Organizations</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MRR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {organizations.map((org) => (
                  <tr key={org.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-[#1E3A5F] flex items-center justify-center text-white font-medium text-sm">
                          {org.name.charAt(0)}
                        </div>
                        <span className="text-sm font-medium text-[#1E3A5F]">{org.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={`${org.planColor} hover:${org.planColor}`}>
                        {org.plan}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {org.users}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={`${org.statusColor} hover:${org.statusColor}`}>
                        {org.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {org.mrr}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {org.joinedDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-[#0EA5E9] hover:text-[#0284C7] mr-3 inline-flex items-center gap-1">
                        <Eye className="w-4 h-4" />
                        View
                      </button>
                      <button className="text-gray-500 hover:text-[#1E3A5F] inline-flex items-center gap-1">
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

        {/* System Health & Activity */}
        <div className="grid grid-cols-3 gap-6">
          {/* System Health Cards */}
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

        {/* Platform Activity */}
        <Card className="rounded-lg shadow-sm border border-gray-200 mt-6">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Recent Platform Activity</h2>
          </div>
          <div className="divide-y divide-gray-200">
            {platformActivity.map((activity, index) => (
              <div key={index} className="px-6 py-4">
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