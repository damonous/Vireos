import { Plus, Edit2, Eye, Pause, Mail, TrendingUp, Users, XCircle } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Toast } from '../components/ui/toast';

const sequences = [
  {
    id: 1,
    name: 'Welcome to Pinnacle Financial',
    status: 'active',
    enrolled: 47,
    steps: 5,
    openRate: 42,
    clickRate: 8,
  },
  {
    id: 2,
    name: 'Tax Season Tips Series',
    status: 'active',
    enrolled: 128,
    steps: 4,
    openRate: 38,
    clickRate: 12,
  },
  {
    id: 3,
    name: 'Retirement Planning Series',
    status: 'active',
    enrolled: 89,
    steps: 6,
    openRate: 31,
    clickRate: 6,
  },
  {
    id: 4,
    name: 'Monthly Newsletter',
    status: 'active',
    enrolled: 312,
    steps: 1,
    openRate: 28,
    clickRate: 4,
  },
];

export default function EmailCampaigns() {
  const navigate = useNavigate();
  const [showToast, setShowToast] = useState(false);
  
  const activeSequences = sequences.filter(s => s.status === 'active').length;
  const totalEnrolled = sequences.reduce((sum, s) => sum + s.enrolled, 0);
  const avgOpenRate = sequences.reduce((sum, s) => sum + s.openRate, 0) / sequences.length;
  const emailsSent = 1847;
  const unsubscribes = 12;

  const handleCreateSequence = () => {
    setShowToast(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
            Active
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
            Draft
          </span>
        );
      case 'paused':
        return (
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
            Paused
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Email Campaigns</h1>
            <p className="text-sm text-gray-500 mt-1">Create and manage automated email sequences</p>
          </div>
          <div className="flex items-center gap-4">
            {/* SendGrid Integration Badge */}
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium text-green-700">SendGrid Connected</span>
            </div>
            <Button 
              className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
              onClick={() => navigate('/email/create')}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Sequence
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Sequences</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{activeSequences}</h3>
                <p className="text-sm text-gray-500 mt-2">Currently running</p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Mail className="w-6 h-6 text-[#0EA5E9]" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Emails Sent This Month</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{emailsSent.toLocaleString()}</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  +18% vs last month
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Open Rate</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{avgOpenRate.toFixed(1)}%</h3>
                <p className="text-sm text-green-600 mt-2">Above industry avg</p>
              </div>
              <div className="w-12 h-12 bg-green-50 rounded-lg flex items-center justify-center">
                <Eye className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Unsubscribes</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{unsubscribes}</h3>
                <p className="text-sm text-green-600 mt-2">-3 vs last month</p>
              </div>
              <div className="w-12 h-12 bg-red-50 rounded-lg flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-500" />
              </div>
            </div>
          </Card>
        </div>

        {/* Sequences Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Email Sequences</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sequence Name</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Enrolled Leads</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Steps</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Open Rate</th>
                    <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Click Rate</th>
                    <th className="text-right py-3 px-4 text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sequences.map((sequence) => (
                    <tr key={sequence.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-4 px-4">
                        <p className="text-sm font-medium text-[#1E3A5F]">{sequence.name}</p>
                      </td>
                      <td className="py-4 px-4">{getStatusBadge(sequence.status)}</td>
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400" />
                          <span className="text-sm text-gray-700">{sequence.enrolled}</span>
                        </div>
                      </td>
                      <td className="py-4 px-4 text-sm text-gray-700">{sequence.steps} steps</td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-[#1E3A5F]">{sequence.openRate}%</span>
                      </td>
                      <td className="py-4 px-4">
                        <span className="text-sm font-medium text-[#0EA5E9]">{sequence.clickRate}%</span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center justify-end gap-2">
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <Edit2 className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <Eye className="w-4 h-4 text-gray-600" />
                          </Button>
                          <Button variant="ghost" size="sm" className="w-8 h-8 p-0">
                            <Pause className="w-4 h-4 text-gray-600" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </Card>

        {/* Info Card */}
        <Card className="mt-6 p-6 rounded-lg shadow-sm border border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#0EA5E9] rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Email Automation Active</h3>
              <p className="text-sm text-gray-600 mt-1">
                {totalEnrolled} leads are currently enrolled across {activeSequences} active sequences. Emails are sent automatically based on your configured triggers and delays.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="text-sm">
                  <span className="text-gray-600">Total sent: </span>
                  <span className="font-semibold text-[#1E3A5F]">{emailsSent.toLocaleString()}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Avg. open rate: </span>
                  <span className="font-semibold text-[#1E3A5F]">{avgOpenRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Toast */}
      {showToast && (
        <Toast
          type="success"
          message="Email sequence created successfully!"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}