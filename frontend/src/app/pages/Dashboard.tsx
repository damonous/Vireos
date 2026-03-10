import { Bell, TrendingUp, AlertCircle, Users, Target, Sparkles, CheckCircle2, Calendar, UserPlus } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useNavigate } from 'react-router';

const chartData = [
  { day: 'Mon', engagements: 245 },
  { day: 'Tue', engagements: 312 },
  { day: 'Wed', engagements: 289 },
  { day: 'Thu', engagements: 356 },
  { day: 'Fri', engagements: 421 },
  { day: 'Sat', engagements: 198 },
  { day: 'Sun', engagements: 167 },
];

const recentActivity = [
  { id: 1, action: 'Content "Market Update Q1" approved', time: '5 minutes ago', icon: CheckCircle2, color: 'text-green-600' },
  { id: 2, action: 'New lead added: John Davidson', time: '12 minutes ago', icon: UserPlus, color: 'text-blue-600' },
  { id: 3, action: 'Email campaign "Tax Season Tips" sent', time: '1 hour ago', icon: Target, color: 'text-purple-600' },
  { id: 4, action: 'Content flagged for compliance review', time: '2 hours ago', icon: AlertCircle, color: 'text-amber-600' },
  { id: 5, action: 'LinkedIn post published successfully', time: '3 hours ago', icon: CheckCircle2, color: 'text-green-600' },
];

const topPosts = [
  { id: 1, title: 'Understanding 401(k) Rollovers', platform: 'LinkedIn', engagements: 1247 },
  { id: 2, title: 'Tax Planning Strategies for 2026', platform: 'Facebook', engagements: 892 },
  { id: 3, title: 'Estate Planning Basics', platform: 'LinkedIn', engagements: 765 },
];

export default function Dashboard() {
  const navigate = useNavigate();

  return (
    <div className="flex-1 overflow-auto">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Good morning, Sarah</h1>
            <p className="text-sm text-gray-500 mt-1">Here's what's happening with your marketing today</p>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-sm text-gray-600">Pinnacle Financial</span>
            <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 md:p-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Content Generated</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">47</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +12 this week
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Sparkles className="w-6 h-6 text-[#0EA5E9]" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Pending Review</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">8</h3>
                <p className="text-sm text-amber-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="w-4 h-4" />
                  3 urgent
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                <CheckCircle2 className="w-6 h-6 text-amber-500" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Campaigns</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">5</h3>
                <p className="text-sm text-gray-500 mt-2">Running smoothly</p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <Target className="w-6 h-6 text-purple-500" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">New Leads</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">124</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +23% this month
                </p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-green-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Recent Activity */}
          <Card className="lg:col-span-2 p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {recentActivity.map((activity) => {
                const Icon = activity.icon;
                return (
                  <div key={activity.id} className="flex items-start gap-3 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                    <div className={`mt-0.5 ${activity.color}`}>
                      <Icon className="w-5 h-5" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm text-[#1E3A5F]">{activity.action}</p>
                      <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <Button 
                className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white justify-start"
                onClick={() => navigate('/ai-content')}
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Create Content
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start border-gray-300 text-[#1E3A5F] hover:bg-gray-50"
                onClick={() => navigate('/compliance')}
              >
                <CheckCircle2 className="w-4 h-4 mr-2" />
                Review Queue
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start border-gray-300 text-[#1E3A5F] hover:bg-gray-50"
                onClick={() => navigate('/calendar')}
              >
                <Calendar className="w-4 h-4 mr-2" />
                Schedule Post
              </Button>
              <Button 
                variant="outline" 
                className="w-full justify-start border-gray-300 text-[#1E3A5F] hover:bg-gray-50"
                onClick={() => navigate('/leads')}
              >
                <UserPlus className="w-4 h-4 mr-2" />
                Add Lead
              </Button>
            </div>
          </Card>
        </div>

        {/* Bottom Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Content Performance Chart */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Content Performance (7 Days)</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                <XAxis dataKey="day" stroke="#64748B" style={{ fontSize: '12px' }} />
                <YAxis stroke="#64748B" style={{ fontSize: '12px' }} />
                <Tooltip 
                  contentStyle={{ 
                    backgroundColor: 'white', 
                    border: '1px solid #E2E8F0', 
                    borderRadius: '8px',
                    fontSize: '12px'
                  }} 
                />
                <Line 
                  type="monotone" 
                  dataKey="engagements" 
                  stroke="#0EA5E9" 
                  strokeWidth={2}
                  dot={{ fill: '#0EA5E9', r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </Card>

          {/* Top Performing Posts */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Top Performing Posts</h3>
            <div className="space-y-4">
              {topPosts.map((post, index) => (
                <div key={post.id} className="flex items-center gap-4 pb-4 border-b border-gray-100 last:border-0 last:pb-0">
                  <div className="w-8 h-8 bg-[#0EA5E9] rounded-full flex items-center justify-center text-white font-semibold text-sm">
                    {index + 1}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#1E3A5F]">{post.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{post.platform}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-semibold text-[#1E3A5F]">{post.engagements.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">engagements</p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}