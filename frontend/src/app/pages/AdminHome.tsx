import { Users, FileText, TrendingUp, Target, Edit, MoreVertical, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useNavigate } from 'react-router';
import { useState } from 'react';

const kpiData = [
  { label: 'Total Team Members', value: '8', icon: Users, color: 'bg-blue-500' },
  { label: 'Active Advisors', value: '6', icon: Target, color: 'bg-green-500' },
  { label: 'Content This Month', value: '47', icon: FileText, color: 'bg-purple-500' },
  { label: 'Team Leads Generated', value: '342', icon: TrendingUp, color: 'bg-orange-500' },
];

const teamData = [
  {
    name: 'Sarah Mitchell',
    initials: 'SM',
    contentCreated: 12,
    leadsGenerated: 47,
    complianceRate: 98,
    activeCampaigns: 3,
    status: 'Active',
  },
  {
    name: 'Michael Chen',
    initials: 'MC',
    contentCreated: 8,
    leadsGenerated: 32,
    complianceRate: 95,
    activeCampaigns: 2,
    status: 'Active',
  },
  {
    name: 'Jennifer Walsh',
    initials: 'JW',
    contentCreated: 15,
    leadsGenerated: 61,
    complianceRate: 100,
    activeCampaigns: 4,
    status: 'Active',
  },
  {
    name: 'David Park',
    initials: 'DP',
    contentCreated: 6,
    leadsGenerated: 28,
    complianceRate: 92,
    activeCampaigns: 1,
    status: 'Active',
  },
  {
    name: 'Lisa Nguyen',
    initials: 'LN',
    contentCreated: 10,
    leadsGenerated: 38,
    complianceRate: 97,
    activeCampaigns: 2,
    status: 'Active',
  },
  {
    name: 'Tom Bradley',
    initials: 'TB',
    contentCreated: 0,
    leadsGenerated: 0,
    complianceRate: 85,
    activeCampaigns: 0,
    status: 'Inactive',
  },
];

const activityFeed = [
  { action: 'New user added', detail: 'Tom Bradley joined as Advisor', time: '2 hours ago' },
  { action: 'Compliance approval', detail: 'Sarah Mitchell - 3 posts approved', time: '4 hours ago' },
  { action: 'Campaign launched', detail: 'Jennifer Walsh started LinkedIn campaign', time: '6 hours ago' },
  { action: 'Lead milestone', detail: 'Team reached 300+ leads this month', time: '1 day ago' },
  { action: 'Content published', detail: 'Michael Chen published 5 new posts', time: '2 days ago' },
];

export default function AdminHome() {
  const navigate = useNavigate();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Advisor');
  const [showToast, setShowToast] = useState(false);

  const handleSendInvite = () => {
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Advisor');
  };
  
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your team and monitor performance</p>
          </div>
          <Button 
            className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
            onClick={() => setShowInviteModal(true)}
          >
            Invite Advisor
          </Button>
        </div>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4"
          onClick={() => setShowInviteModal(false)}
        >
          <div 
            className="bg-white rounded-lg shadow-xl w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F]">Invite Advisor</h2>
              <button 
                className="p-1 hover:bg-gray-100 rounded transition-colors" 
                onClick={() => setShowInviteModal(false)}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Name
                </label>
                <Input
                  type="text"
                  placeholder="Enter advisor name"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Email
                </label>
                <Input
                  type="email"
                  placeholder="advisor@example.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Role
                </label>
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value)}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                >
                  <option value="Advisor">Advisor</option>
                  <option value="Compliance Officer">Compliance Officer</option>
                </select>
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowInviteModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                onClick={handleSendInvite}
                disabled={!inviteName || !inviteEmail}
              >
                Send Invite
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
          Invitation sent!
        </div>
      )}

      <div className="p-4 md:p-8">
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
                  </div>
                  <div className={`w-10 h-10 rounded-lg ${kpi.color} flex items-center justify-center`}>
                    <Icon className="w-5 h-5 text-white" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        {/* Team Performance Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Team Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Advisor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Content Created
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Leads Generated
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Compliance Rate
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Active Campaigns
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamData.map((advisor) => (
                  <tr 
                    key={advisor.name} 
                    onClick={() => navigate('/analytics')}
                    className="hover:bg-gray-50 cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white font-medium text-sm">
                          {advisor.initials}
                        </div>
                        <span className="text-sm font-medium text-[#1E3A5F]">{advisor.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {advisor.contentCreated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {advisor.leadsGenerated}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {advisor.complianceRate}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {advisor.activeCampaigns}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        className={
                          advisor.status === 'Active'
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                        }
                      >
                        {advisor.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button className="text-gray-400 hover:text-[#0EA5E9] mr-3">
                        <Edit className="w-4 h-4" />
                      </button>
                      <button className="text-gray-400 hover:text-[#0EA5E9]">
                        <MoreVertical className="w-4 h-4" />
                      </button>
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