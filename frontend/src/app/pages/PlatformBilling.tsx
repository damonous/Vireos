import { DollarSign, TrendingUp, Users, TrendingDown, FileText } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const kpiData = [
  { label: 'MRR', value: '$8,940', icon: DollarSign, color: 'bg-[#0EA5E9]' },
  { label: 'ARR', value: '$107,280', subtext: 'projected', icon: TrendingUp, color: 'bg-green-500' },
  { label: 'Active Subscriptions', value: '22', icon: Users, color: 'bg-purple-500' },
  { label: 'Churned This Month', value: '1', icon: TrendingDown, color: 'bg-red-500' },
];

const planBreakdown = [
  {
    name: 'Starter Plan',
    price: '$99/mo',
    organizations: 3,
    mrr: 297,
    badge: 'bg-gray-100 text-gray-700',
  },
  {
    name: 'Professional Plan',
    price: '$299/mo',
    organizations: 14,
    mrr: 4186,
    badge: 'bg-blue-100 text-blue-700',
  },
  {
    name: 'Enterprise Plan',
    price: '$899/mo',
    organizations: 5,
    mrr: 4495,
    badge: 'bg-purple-100 text-purple-700',
  },
];

// 12 months of MRR data
const mrrData = [
  { month: 'Mar 2025', mrr: 4200 },
  { month: 'Apr 2025', mrr: 4580 },
  { month: 'May 2025', mrr: 5120 },
  { month: 'Jun 2025', mrr: 5340 },
  { month: 'Jul 2025', mrr: 5890 },
  { month: 'Aug 2025', mrr: 6420 },
  { month: 'Sep 2025', mrr: 6780 },
  { month: 'Oct 2025', mrr: 7210 },
  { month: 'Nov 2025', mrr: 7650 },
  { month: 'Dec 2025', mrr: 8020 },
  { month: 'Jan 2026', mrr: 8480 },
  { month: 'Feb 2026', mrr: 8940 },
];

interface BillingEvent {
  id: number;
  date: string;
  organization: string;
  event: string;
  amount: string;
  status: 'paid' | 'trial' | 'cancelled';
}

const billingEvents: BillingEvent[] = [
  {
    id: 1,
    date: 'Feb 27, 2026',
    organization: 'Summit Wealth Management',
    event: 'Monthly renewal',
    amount: '$899',
    status: 'paid',
  },
  {
    id: 2,
    date: 'Feb 27, 2026',
    organization: 'Pinnacle Financial',
    event: 'Monthly renewal',
    amount: '$299',
    status: 'paid',
  },
  {
    id: 3,
    date: 'Feb 27, 2026',
    organization: 'Peak Financial Group',
    event: 'Monthly renewal',
    amount: '$899',
    status: 'paid',
  },
  {
    id: 4,
    date: 'Feb 25, 2026',
    organization: 'Coastal Capital',
    event: 'Trial started',
    amount: '$0',
    status: 'trial',
  },
  {
    id: 5,
    date: 'Feb 20, 2026',
    organization: 'Blue Ridge Advisors',
    event: 'Monthly renewal',
    amount: '$299',
    status: 'paid',
  },
  {
    id: 6,
    date: 'Feb 18, 2026',
    organization: 'Old Firm LLC',
    event: 'Subscription cancelled',
    amount: '$299',
    status: 'cancelled',
  },
];

const getEventStatusBadge = (status: string) => {
  switch (status) {
    case 'paid':
      return 'bg-green-100 text-green-700';
    case 'trial':
      return 'bg-yellow-100 text-yellow-700';
    case 'cancelled':
      return 'bg-red-100 text-red-700';
    default:
      return 'bg-gray-100 text-gray-700';
  }
};

export default function PlatformBilling() {
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Platform Billing</h1>
            <p className="text-sm text-gray-500 mt-1">Manage billing and revenue across organizations</p>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
            <FileText className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="p-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          {kpiData.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{kpi.label}</p>
                    <p className="text-3xl font-semibold text-[#1E3A5F]">{kpi.value}</p>
                    {kpi.subtext && (
                      <p className="text-xs text-gray-500 mt-1">{kpi.subtext}</p>
                    )}
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Plan Breakdown Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {planBreakdown.map((plan) => (
            <Card key={plan.name} className="p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-[#1E3A5F]">{plan.name}</h3>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${plan.badge}`}>
                  {plan.price}
                </span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Organizations</span>
                  <span className="font-semibold text-[#1E3A5F]">{plan.organizations}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600">Monthly Revenue</span>
                  <span className="font-semibold text-[#1E3A5F]">${plan.mrr.toLocaleString()}</span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* MRR Chart */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">
            Monthly Recurring Revenue (Last 12 Months)
          </h3>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={mrrData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis 
                dataKey="month" 
                tick={{ fontSize: 12 }} 
                angle={-45}
                textAnchor="end"
                height={80}
              />
              <YAxis 
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${(value / 1000).toFixed(0)}k`}
              />
              <Tooltip 
                formatter={(value: number) => `$${value.toLocaleString()}`}
                labelStyle={{ color: '#1E3A5F' }}
              />
              <Bar dataKey="mrr" fill="#0EA5E9" name="MRR" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Recent Billing Events */}
        <Card className="rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Recent Billing Events</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {billingEvents.map((event) => (
                  <tr key={event.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {event.date}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E3A5F]">
                      {event.organization}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {event.event}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-700">
                      {event.amount}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getEventStatusBadge(event.status)}`}>
                        {event.status.charAt(0).toUpperCase() + event.status.slice(1)}
                      </span>
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