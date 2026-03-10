import { useState } from 'react';
import { Download, FileText, Users, CheckCircle, Star, TrendingUp, TrendingDown, Minus, DollarSign, ArrowUp, ArrowDown } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const kpiData = [
  { label: 'Total Content Published', value: '47', icon: FileText, color: 'bg-blue-500' },
  { label: 'Total Leads Generated', value: '342', icon: Users, color: 'bg-green-500' },
  { label: 'Avg Compliance Rate', value: '97%', icon: CheckCircle, color: 'bg-teal-500' },
  { label: 'Top Performer', value: 'Jennifer Walsh', icon: Star, color: 'bg-amber-500' },
];

const advisors = [
  {
    name: 'Sarah Mitchell',
    initials: 'SM',
    contentPublished: 12,
    leadsGenerated: 47,
    newAum: '$1.8M',
    aumTrend: 'up',
    complianceRate: 98,
    activeCampaigns: 3,
    trend: 'up',
  },
  {
    name: 'Michael Chen',
    initials: 'MC',
    contentPublished: 8,
    leadsGenerated: 32,
    newAum: '$1.4M',
    aumTrend: 'up',
    complianceRate: 95,
    activeCampaigns: 2,
    trend: 'up',
  },
  {
    name: 'Jennifer Walsh',
    initials: 'JW',
    contentPublished: 15,
    leadsGenerated: 61,
    newAum: '$920K',
    aumTrend: 'up',
    complianceRate: 100,
    activeCampaigns: 4,
    trend: 'up',
  },
  {
    name: 'David Park',
    initials: 'DP',
    contentPublished: 6,
    leadsGenerated: 28,
    newAum: '$680K',
    aumTrend: 'flat',
    complianceRate: 92,
    activeCampaigns: 1,
    trend: 'flat',
  },
  {
    name: 'Lisa Nguyen',
    initials: 'LN',
    contentPublished: 10,
    leadsGenerated: 38,
    newAum: '$410K',
    aumTrend: 'up',
    complianceRate: 97,
    activeCampaigns: 2,
    trend: 'up',
  },
  {
    name: 'Tom Bradley',
    initials: 'TB',
    contentPublished: 0,
    leadsGenerated: 0,
    newAum: '$0',
    aumTrend: 'down',
    complianceRate: 85,
    activeCampaigns: 0,
    trend: 'down',
  },
];

const contentOverTimeData = [
  { week: 'Week 1', 'Sarah Mitchell': 3, 'Michael Chen': 2, 'Jennifer Walsh': 4, 'David Park': 2, 'Lisa Nguyen': 3, 'Tom Bradley': 0 },
  { week: 'Week 2', 'Sarah Mitchell': 3, 'Michael Chen': 2, 'Jennifer Walsh': 3, 'David Park': 1, 'Lisa Nguyen': 2, 'Tom Bradley': 0 },
  { week: 'Week 3', 'Sarah Mitchell': 3, 'Michael Chen': 2, 'Jennifer Walsh': 4, 'David Park': 2, 'Lisa Nguyen': 3, 'Tom Bradley': 0 },
  { week: 'Week 4', 'Sarah Mitchell': 3, 'Michael Chen': 2, 'Jennifer Walsh': 4, 'David Park': 1, 'Lisa Nguyen': 2, 'Tom Bradley': 0 },
];

const leadsChartData = [
  { name: 'Sarah M.', leads: 47 },
  { name: 'Michael C.', leads: 32 },
  { name: 'Jennifer W.', leads: 61 },
  { name: 'David P.', leads: 28 },
  { name: 'Lisa N.', leads: 38 },
  { name: 'Tom B.', leads: 0 },
];

const lineColors = ['#0EA5E9', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#6B7280'];

export default function TeamReports() {
  const [dateRange, setDateRange] = useState('This Month');

  const getComplianceColor = (rate: number) => {
    if (rate >= 95) return 'text-green-600 bg-green-50';
    if (rate >= 85) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-600 bg-red-50';
  };

  const getTrendIcon = (trend: string) => {
    if (trend === 'up') return <TrendingUp className="w-4 h-4 text-green-600" />;
    if (trend === 'down') return <TrendingDown className="w-4 h-4 text-red-600" />;
    return <Minus className="w-4 h-4 text-gray-400" />;
  };

  const getAumTrendIcon = (trend: string) => {
    if (trend === 'up') return <ArrowUp className="w-3 h-3 text-green-600" />;
    if (trend === 'down') return <ArrowDown className="w-3 h-3 text-red-600" />;
    return null;
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Team Reports</h1>
            <p className="text-sm text-gray-500 mt-1">View team performance and analytics</p>
          </div>
          <Button className="bg-[#1E3A5F] hover:bg-[#2B4A6F] text-white">
            <Download className="w-4 h-4 mr-2" />
            Export PDF Report
          </Button>
        </div>
      </div>

      <div className="p-8">
        {/* Date Range Selector */}
        <div className="flex gap-2 mb-6">
          {['This Month', 'Last 30 Days', 'Last Quarter', 'Custom Range'].map((range) => (
            <Button
              key={range}
              onClick={() => setDateRange(range)}
              className={
                dateRange === range
                  ? 'bg-[#0EA5E9] text-white hover:bg-[#0284C7]'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }
            >
              {range}
            </Button>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {kpiData.map((kpi) => {
            const Icon = kpi.icon;
            return (
              <Card key={kpi.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{kpi.label}</p>
                    <p className="text-3xl font-semibold text-[#1E3A5F] flex items-center gap-2">
                      {kpi.value}
                      {kpi.label === 'Top Performer' && (
                        <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
                      )}
                    </p>
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Top Performer Highlight Card */}
        <Card className="p-6 rounded-lg shadow-sm border-2 border-[#0EA5E9] bg-gradient-to-r from-blue-50 to-teal-50 mb-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] flex items-center justify-center">
                <Star className="w-8 h-8 text-white fill-white" />
              </div>
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Top Performer This Month</p>
                <h3 className="text-2xl font-bold text-[#1E3A5F]">Sarah Mitchell</h3>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">New AUM</p>
                <p className="text-3xl font-bold text-[#0EA5E9]">$1.8M</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Leads Generated</p>
                <p className="text-2xl font-semibold text-gray-700">47</p>
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 mb-1">Compliance Rate</p>
                <p className="text-2xl font-semibold text-green-600">98%</p>
              </div>
            </div>
          </div>
        </Card>

        {/* Performance by Advisor Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Performance by Advisor</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Advisor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content Published
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leads Generated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    New AUM
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compliance Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Campaigns
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Trend
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {advisors.map((advisor) => (
                  <tr key={advisor.name} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white font-medium text-sm">
                          {advisor.initials}
                        </div>
                        <span className="text-sm font-medium text-[#1E3A5F]">{advisor.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {advisor.contentPublished}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {advisor.leadsGenerated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <span className="text-sm font-bold text-[#0EA5E9]">{advisor.newAum}</span>
                        {getAumTrendIcon(advisor.aumTrend)}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getComplianceColor(advisor.complianceRate)}`}>
                        {advisor.complianceRate}%
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {advisor.activeCampaigns}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getTrendIcon(advisor.trend)}
                    </td>
                  </tr>
                ))}
                {/* Totals Row */}
                <tr className="bg-gray-100 font-semibold border-t-2 border-gray-300">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-[#1E3A5F]">TOTALS</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    51
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    206
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="text-sm font-bold text-[#0EA5E9]">$5.21M</span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    —
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                    12
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    —
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Line Chart */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Content Output Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={contentOverTimeData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="week" />
                <YAxis />
                <Tooltip />
                <Legend />
                {advisors.map((advisor, index) => (
                  <Line
                    key={advisor.name}
                    type="monotone"
                    dataKey={advisor.name}
                    stroke={lineColors[index]}
                    strokeWidth={2}
                  />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Bar Chart */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Leads Generated by Advisor</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={leadsChartData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="leads" fill="#0EA5E9" />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>
      </div>
    </div>
  );
}