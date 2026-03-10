import { Download, FileCheck, TrendingUp, Clock, AlertCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { LineChart, Line, PieChart, Pie, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const kpiData = [
  { label: 'Total Reviewed', value: '47', icon: FileCheck, color: 'bg-blue-500' },
  { label: 'Approval Rate', value: '93.6%', icon: TrendingUp, color: 'bg-green-500' },
  { label: 'Avg Review Time', value: '4.2 hrs', icon: Clock, color: 'bg-teal-500' },
  { label: 'Prohibited Terms Flagged', value: '43', icon: AlertCircle, color: 'bg-orange-500' },
];

// 30 days of compliance rate data
const complianceRateData = [
  { day: 'Day 1', rate: 91.2 },
  { day: 'Day 2', rate: 92.5 },
  { day: 'Day 3', rate: 89.8 },
  { day: 'Day 4', rate: 94.1 },
  { day: 'Day 5', rate: 91.7 },
  { day: 'Day 6', rate: 93.3 },
  { day: 'Day 7', rate: 90.5 },
  { day: 'Day 8', rate: 92.8 },
  { day: 'Day 9', rate: 94.5 },
  { day: 'Day 10', rate: 91.9 },
  { day: 'Day 11', rate: 93.1 },
  { day: 'Day 12', rate: 92.4 },
  { day: 'Day 13', rate: 90.8 },
  { day: 'Day 14', rate: 93.7 },
  { day: 'Day 15', rate: 95.2 },
  { day: 'Day 16', rate: 92.3 },
  { day: 'Day 17', rate: 91.5 },
  { day: 'Day 18', rate: 94.0 },
  { day: 'Day 19', rate: 93.8 },
  { day: 'Day 20', rate: 92.1 },
  { day: 'Day 21', rate: 94.3 },
  { day: 'Day 22', rate: 93.2 },
  { day: 'Day 23', rate: 91.8 },
  { day: 'Day 24', rate: 95.0 },
  { day: 'Day 25', rate: 93.9 },
  { day: 'Day 26', rate: 92.6 },
  { day: 'Day 27', rate: 94.7 },
  { day: 'Day 28', rate: 93.4 },
  { day: 'Day 29', rate: 92.9 },
  { day: 'Day 30', rate: 93.6 },
];

const rejectionReasonsData = [
  { name: 'Prohibited Terms', value: 52, color: '#EF4444' },
  { name: 'Misleading Claims', value: 28, color: '#F97316' },
  { name: 'Missing Disclaimer', value: 20, color: '#EAB308' },
];

const platformReviewsData = [
  { platform: 'LinkedIn', reviews: 28 },
  { platform: 'Facebook', reviews: 12 },
  { platform: 'Email', reviews: 7 },
];

const flaggedTermsData = [
  { term: 'guaranteed', occurrences: 23, advisors: 3 },
  { term: 'promise', occurrences: 8, advisors: 2 },
  { term: 'risk-free', occurrences: 6, advisors: 2 },
  { term: 'will double', occurrences: 4, advisors: 1 },
  { term: 'no risk', occurrences: 3, advisors: 1 },
];

export default function ComplianceReports() {
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Compliance Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Generate compliance analytics and reports</p>
          </div>
          <div className="flex items-center gap-3">
            <select className="h-9 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]">
              <option value="30">Last 30 Days</option>
              <option value="7">Last 7 Days</option>
              <option value="90">Last Quarter</option>
              <option value="365">Last Year</option>
            </select>
            <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
              <Download className="w-4 h-4 mr-2" />
              Export PDF Report
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* KPI Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {kpiData.map((kpi) => {
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

        {/* Compliance Rate Over Time */}
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Compliance Rate Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={complianceRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} interval={4} />
              <YAxis domain={[80, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <ReferenceLine y={90} stroke="#F97316" strokeDasharray="3 3" label="Target" />
              <Line type="monotone" dataKey="rate" stroke="#0EA5E9" strokeWidth={2} name="Compliance Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Charts Row */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Rejection Reasons Pie Chart */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Rejection Reasons</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={rejectionReasonsData}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {rejectionReasonsData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-4">
              {rejectionReasonsData.map((entry) => (
                <div key={entry.name} className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: entry.color }} />
                  <span className="text-xs text-gray-600">{entry.name}</span>
                </div>
              ))}
            </div>
          </Card>

          {/* Reviews by Platform Bar Chart */}
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Reviews by Platform</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={platformReviewsData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="reviews" name="Reviews">
                  <Cell fill="#0EA5E9" />
                  <Cell fill="#3B82F6" />
                  <Cell fill="#6366F1" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </div>

        {/* Most Flagged Terms Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Most Flagged Terms This Month</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Term
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Occurrences
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Advisors Affected
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {flaggedTermsData.map((item) => (
                  <tr key={item.term} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm font-medium text-red-600 bg-red-50 px-2 py-1 rounded">
                        "{item.term}"
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {item.occurrences}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {item.advisors} advisor{item.advisors > 1 ? 's' : ''}
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