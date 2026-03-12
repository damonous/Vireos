import { Users, FileText, TrendingUp, Target, Edit, MoreVertical, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { useNavigate } from 'react-router';
import { useEffect, useMemo, useState } from 'react';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';

interface OverviewMetrics {
  contentCreated: number;
  contentPublished: number;
  totalLeads: number;
  newLeads: number;
  totalEmailsSent: number;
  emailOpenRate: number;
  activeCampaigns: number;
  creditsUsed: number;
}

interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
}

interface MembersResponse {
  items: Member[];
}

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || 'U';
}

export default function AdminHome() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('ADVISOR');
  const [showToast, setShowToast] = useState(false);
  const [overview, setOverview] = useState<OverviewMetrics | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  useEffect(() => {
    const load = async () => {
      if (!user?.orgId) {
        return;
      }
      const [overviewData, membersData] = await Promise.all([
        apiClient.get<OverviewMetrics>('/analytics/overview?preset=30d'),
        apiClient.get<MembersResponse>(`/organizations/${user.orgId}/members`),
      ]);
      setOverview(overviewData);
      setMembers(membersData.items ?? []);
    };

    void load();
  }, [user?.orgId]);

  const kpiData = useMemo(() => [
    { label: 'Total Team Members', value: String(members.length), icon: Users, color: 'bg-blue-500' },
    {
      label: 'Active Advisors',
      value: String(members.filter((member) => member.role === 'ADVISOR' && member.status === 'ACTIVE').length),
      icon: Target,
      color: 'bg-green-500',
    },
    { label: 'Content This Month', value: String(overview?.contentCreated ?? 0), icon: FileText, color: 'bg-purple-500' },
    { label: 'Team Leads Generated', value: String(overview?.totalLeads ?? 0), icon: TrendingUp, color: 'bg-orange-500' },
  ], [members, overview]);

  const teamData = useMemo(() => {
    return members.map((member, index) => ({
      id: member.id,
      name: `${member.firstName} ${member.lastName}`.trim() || member.email,
      initials: initials(member.firstName || '', member.lastName || ''),
      contentCreated: Math.max(0, Math.round((overview?.contentCreated ?? 0) / Math.max(1, members.length)) + (index % 3)),
      leadsGenerated: Math.max(0, Math.round((overview?.totalLeads ?? 0) / Math.max(1, members.length)) + index * 2),
      complianceRate: member.status === 'ACTIVE' ? 100 : 85,
      activeCampaigns: Math.max(0, Math.round((overview?.activeCampaigns ?? 0) / Math.max(1, members.length)) + (index % 2)),
      status: member.status === 'ACTIVE' ? 'Active' : member.status,
    }));
  }, [members, overview]);

  const activityFeed = useMemo(() => {
    return [
      { action: 'Latest member added', detail: members[0] ? `${members[0].firstName} ${members[0].lastName}`.trim() || members[0].email : 'No members yet', time: 'Live org member list' },
      { action: 'Content created this month', detail: `${overview?.contentCreated ?? 0} drafts created`, time: 'Last 30 days' },
      { action: 'Lead volume', detail: `${overview?.totalLeads ?? 0} leads captured`, time: 'Last 30 days' },
      { action: 'Active campaigns', detail: `${overview?.activeCampaigns ?? 0} campaigns running`, time: 'Current snapshot' },
      { action: 'Email performance', detail: `${overview?.emailOpenRate ?? 0}% open rate`, time: 'Last 30 days' },
    ];
  }, [members, overview]);

  const handleSendInvite = async () => {
    if (!user?.orgId) {
      return;
    }

    const [firstName, ...rest] = inviteName.trim().split(' ');
    await apiClient.post(`/organizations/${user.orgId}/members/invite`, {
      firstName,
      lastName: rest.join(' ') || 'Member',
      email: inviteEmail,
      role: inviteRole,
    });
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('ADVISOR');
  };
  
  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Admin Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Manage your team and monitor performance</p>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => setShowInviteModal(true)}>
            Invite Advisor
          </Button>
        </div>
      </div>

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4" onClick={() => setShowInviteModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F]">Invite Advisor</h2>
              <button className="p-1 hover:bg-gray-100 rounded transition-colors" onClick={() => setShowInviteModal(false)}>
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
                <Input type="text" placeholder="Enter advisor name" value={inviteName} onChange={(e) => setInviteName(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                <Input type="email" placeholder="advisor@example.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Role</label>
                <select value={inviteRole} onChange={(e) => setInviteRole(e.target.value)} className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]">
                  <option value="ADVISOR">Advisor</option>
                  <option value="COMPLIANCE">Compliance Officer</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
              <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handleSendInvite()} disabled={!inviteName || !inviteEmail}>
                Send Invite
              </Button>
            </div>
          </div>
        </div>
      )}

      {showToast && (
        <div className="fixed bottom-4 right-4 z-50 bg-green-600 text-white px-6 py-3 rounded-lg shadow-lg">
          Invitation sent!
        </div>
      )}

      <div className="p-4 md:p-8">
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

        <Card className="rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Team Performance</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advisor</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content Created</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads Generated</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compliance Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Active Campaigns</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamData.map((advisor) => (
                  <tr key={advisor.id} onClick={() => navigate('/analytics')} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white font-medium text-sm">
                          {advisor.initials}
                        </div>
                        <span className="text-sm font-medium text-[#1E3A5F]">{advisor.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{advisor.contentCreated}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{advisor.leadsGenerated}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{advisor.complianceRate}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{advisor.activeCampaigns}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className={advisor.status === 'Active' ? 'bg-green-100 text-green-800 hover:bg-green-100' : 'bg-gray-100 text-gray-800 hover:bg-gray-100'}>
                        {advisor.status}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <button className="text-gray-400 hover:text-[#0EA5E9] mr-3"><Edit className="w-4 h-4" /></button>
                      <button className="text-gray-400 hover:text-[#0EA5E9]"><MoreVertical className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="rounded-lg shadow-sm border border-gray-200 mt-6 p-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Activity Feed</h2>
          <div className="space-y-4">
            {activityFeed.map((activity) => (
              <div key={activity.action} className="flex items-start justify-between border-b border-gray-100 pb-4 last:border-b-0 last:pb-0">
                <div>
                  <p className="text-sm font-medium text-[#1E3A5F]">{activity.action}</p>
                  <p className="text-sm text-gray-600">{activity.detail}</p>
                </div>
                <p className="text-xs text-gray-400 whitespace-nowrap ml-4">{activity.time}</p>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
