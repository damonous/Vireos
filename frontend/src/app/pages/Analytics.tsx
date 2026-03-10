import { Calendar, TrendingUp, FileText, Target, Users, Linkedin, Facebook, Mail, DollarSign, ArrowUpRight } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

// Engagement over time data (30 days)
const engagementData = [
  { day: '1', linkedin: 245, facebook: 180, email: 120 },
  { day: '3', linkedin: 280, facebook: 210, email: 150 },
  { day: '5', linkedin: 320, facebook: 190, email: 140 },
  { day: '7', linkedin: 295, facebook: 230, email: 160 },
  { day: '9', linkedin: 310, facebook: 250, email: 180 },
  { day: '11', linkedin: 340, facebook: 270, email: 190 },
  { day: '13', linkedin: 380, facebook: 290, email: 200 },
  { day: '15', linkedin: 360, facebook: 310, email: 210 },
  { day: '17', linkedin: 390, facebook: 300, email: 220 },
  { day: '19', linkedin: 410, facebook: 320, email: 230 },
  { day: '21', linkedin: 385, facebook: 310, email: 215 },
  { day: '23', linkedin: 420, facebook: 340, email: 240 },
  { day: '25', linkedin: 450, facebook: 360, email: 250 },
  { day: '27', linkedin: 440, facebook: 380, email: 260 },
  { day: '30', linkedin: 480, facebook: 390, email: 270 },
];

// Content by platform data
const contentData = [
  { platform: 'LinkedIn', count: 22 },
  { platform: 'Facebook', count: 14 },
  { platform: 'Email', count: 11 },
];

// Lead sources data
const leadSourceData = [
  { name: 'LinkedIn', value: 45, color: '#0A66C2' },
  { name: 'Facebook', value: 28, color: '#1877F2' },
  { name: 'Email', value: 18, color: '#0EA5E9' },
  { name: 'Referral', value: 9, color: '#8B5CF6' },
];

// Top performing content
const topContent = [
  { title: 'Understanding 401k Rollovers', platform: 'linkedin', impressions: 12400, clicks: 847, leads: 18, aumBroughtIn: '$1.2M' },
  { title: 'Tax Season Workshop', platform: 'facebook', impressions: 8200, clicks: 612, leads: 12, aumBroughtIn: '$890K' },
  { title: 'Estate Planning Basics', platform: 'linkedin', impressions: 7800, clicks: 523, leads: 9, aumBroughtIn: '$720K' },
  { title: 'Retirement Income Guide', platform: 'email', impressions: 4200, clicks: 389, leads: 7, aumBroughtIn: '$580K' },
  { title: 'Social Security Tips', platform: 'linkedin', impressions: 6100, clicks: 412, leads: 8, aumBroughtIn: '$650K' },
];

// AUM Growth data (6 months)
const aumGrowthData = [
  { month: 'Oct', aum: 32 },
  { month: 'Nov', aum: 33.5 },
  { month: 'Dec', aum: 34.1 },
  { month: 'Jan', aum: 35.8 },
  { month: 'Feb', aum: 37.2 },
  { month: 'Mar', aum: 38.4 },
];

// Lead Pipeline with AUM data
const leadPipeline = [
  { stage: 'New Leads', count: 24, aum: null },
  { stage: 'Contacted', count: 18, aum: '$3.1M' },
  { stage: 'Meeting Scheduled', count: 12, aum: '$2.4M' },
  { stage: 'Proposal Sent', count: 8, aum: '$1.8M' },
  { stage: 'New Clients — AUM Acquired', count: 5, aum: '$4.2M' },
];

export default function Analytics() {
  const getPlatformIcon = (platform: string) => {
    switch (platform) {
      case 'linkedin':
        return <Linkedin className="w-4 h-4 text-[#0A66C2]" />;
      case 'facebook':
        return <Facebook className="w-4 h-4 text-[#1877F2]" />;
      case 'email':
        return <Mail className="w-4 h-4 text-[#0EA5E9]" />;
      default:
        return null;
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return `${(num / 1000).toFixed(1)}K`;
    }
    return num.toString();
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Analytics Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Track your marketing performance and ROI</p>
          </div>
          <Button variant="outline" className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Last 30 Days
          </Button>
        </div>
      </div>

      <div className="p-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Reach</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">48,200</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +12% vs last month
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-[#0EA5E9]" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Content Pieces Published</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">47</h3>
                <p className="text-sm text-gray-500 mt-2">Across all platforms</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <FileText className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg Engagement Rate</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">6.8%</h3>
                <p className="text-sm text-green-600 mt-2">Above industry avg</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Leads Generated</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">124</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +18% vs last month
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-amber-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">New AUM</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">$4.2M</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  +12.3% vs last quarter
                </p>
              </div>
              <div className="w-12 h-12 bg-teal-50 rounded-lg flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-[#0EA5E9]" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg AUM per Client</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">$840K</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  +5.1% vs last quarter
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </div>

        {/* Engagement Over Time Chart */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Engagement Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="day" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '12px',
                  paddingTop: '20px',
                }}
              />
              <Line
                key="linkedin"
                type="monotone"
                dataKey="linkedin"
                stroke="#0A66C2"
                strokeWidth={2}
                name="LinkedIn"
                dot={false}
              />
              <Line
                key="facebook"
                type="monotone"
                dataKey="facebook"
                stroke="#1877F2"
                strokeWidth={2}
                name="Facebook"
                dot={false}
              />
              <Line
                key="email"
                type="monotone"
                dataKey="email"
                stroke="#0EA5E9"
                strokeWidth={2}
                name="Email"
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Content by Platform Bar Chart */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Content by Platform</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={contentData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
                <XAxis dataKey="platform" stroke="#6B7280" fontSize={12} />
                <YAxis stroke="#6B7280" fontSize={12} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Lead Sources Pie Chart */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Lead Sources</h3>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={leadSourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={(entry) => `${entry.name} ${entry.value}%`}
                  labelLine={false}
                >
                  {leadSourceData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: 'white',
                    border: '1px solid #E5E7EB',
                    borderRadius: '8px',
                    fontSize: '12px',
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Top Performing Content Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Top Performing Content</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Title</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Platform</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Impressions</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Clicks</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Leads Generated</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">AUM Brought In</th>
                  </tr>
                </thead>
                <tbody>
                  {topContent.map((content, index) => (
                    <tr key={index} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <p className="text-sm font-medium text-[#1E3A5F]">{content.title}</p>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          {getPlatformIcon(content.platform)}
                          <span className="text-sm text-gray-700 capitalize">{content.platform}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">{formatNumber(content.impressions)}</td>
                      <td className="py-4 px-4 text-sm text-gray-700">{content.clicks.toLocaleString()}</td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-[#0EA5E9]">{content.leads}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-[#0EA5E9]">{content.aumBroughtIn}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* AUM Growth Chart */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">AUM Growth Trend</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={aumGrowthData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="month" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'white',
                  border: '1px solid #E5E7EB',
                  borderRadius: '8px',
                  fontSize: '12px',
                }}
              />
              <Legend
                wrapperStyle={{
                  fontSize: '12px',
                  paddingTop: '20px',
                }}
              />
              <Line
                key="aum"
                type="monotone"
                dataKey="aum"
                stroke="#0EA5E9"
                strokeWidth={3}
                name="AUM ($M)"
                dot={{ fill: '#0EA5E9', r: 4 }}
              />
            </LineChart>
          </ResponsiveContainer>
          
          {/* Summary Stats Row */}
          <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-200">
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Total AUM Under Advisory</p>
              <p className="text-2xl font-semibold text-[#1E3A5F]">$38.4M</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">6-Month Growth</p>
              <p className="text-2xl font-semibold text-green-600">+$6.4M (+20%)</p>
            </div>
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Projected Year-End</p>
              <p className="text-2xl font-semibold text-[#0EA5E9]">$42M</p>
            </div>
          </div>
        </Card>

        {/* Lead Pipeline Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden mb-6">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Lead Pipeline</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Stage</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Count</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">AUM</th>
                  </tr>
                </thead>
                <tbody>
                  {leadPipeline.map((pipeline, index) => (
                    <tr key={`pipeline-${index}`} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <p className="text-sm font-medium text-[#1E3A5F]">{pipeline.stage}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-[#0EA5E9]">{pipeline.count}</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-[#0EA5E9]">{pipeline.aum || '—'}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Footer Note */}
        <div className="text-center py-4">
          <p className="text-sm text-gray-500">
            Showing data for: <span className="font-medium text-[#1E3A5F]">Sarah Mitchell (Advisor)</span>
          </p>
        </div>
      </div>
    </div>
  );
}