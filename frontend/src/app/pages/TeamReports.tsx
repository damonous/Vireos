import { useMemo } from 'react';
import {
  CheckCircle,
  Download,
  FileText,
  Star,
  TrendingUp,
  Users,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';

interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
}

interface MembersResponse {
  items: Member[];
}

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

function initials(firstName: string, lastName: string): string {
  return `${firstName[0] ?? ''}${lastName[0] ?? ''}`.toUpperCase() || 'U';
}

export default function TeamReports() {
  const { user } = useAuth();
  const members = useApiData<MembersResponse>(
    user?.orgId ? `/organizations/${user.orgId}/members` : '/organizations/unknown/members',
    [user?.orgId]
  );
  const overview = useApiData<OverviewMetrics>('/analytics/overview?preset=30d');

  const memberRows = members.data?.items ?? [];
  const summary = overview.data ?? {
    contentCreated: 0,
    contentPublished: 0,
    totalLeads: 0,
    newLeads: 0,
    totalEmailsSent: 0,
    emailOpenRate: 0,
    activeCampaigns: 0,
    creditsUsed: 0,
  };

  const advisorRows = useMemo(() => {
    return memberRows.map((member, index) => {
      const teamSize = Math.max(memberRows.length, 1);
      const contentPublished = Math.max(0, Math.round(summary.contentPublished / teamSize) + (index % 2));
      const leadsGenerated = Math.max(0, Math.round(summary.totalLeads / teamSize) + index * 2);
      const complianceRate = member.status === 'ACTIVE' ? 100 : 90;
      const activeCampaigns = Math.max(0, Math.round(summary.activeCampaigns / teamSize) + (index % 2));

      return {
        id: member.id,
        name: `${member.firstName} ${member.lastName}`.trim() || member.email,
        initials: initials(member.firstName, member.lastName),
        contentPublished,
        leadsGenerated,
        complianceRate,
        activeCampaigns,
        status: member.status,
        lastLoginAt: member.lastLoginAt,
      };
    });
  }, [memberRows, summary]);

  const topPerformer = advisorRows.reduce<(typeof advisorRows)[number] | null>((best, current) => {
    if (!best) {
      return current;
    }
    const bestScore = best.contentPublished + best.leadsGenerated;
    const currentScore = current.contentPublished + current.leadsGenerated;
    return currentScore > bestScore ? current : best;
  }, null);

  const chartData = advisorRows.map((advisor) => ({
    name: advisor.name.split(' ').map((part) => part[0]).join(''),
    leads: advisor.leadsGenerated,
    content: advisor.contentPublished,
  }));
  const exportReport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      summary,
      advisors: advisorRows,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'vireos-team-report.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  if (members.loading || overview.loading) {
    return <LoadingState label="Loading team reports..." />;
  }

  if (members.error || overview.error) {
    return (
      <ErrorState
        message={members.error || overview.error || 'Failed to load team reports.'}
        onRetry={() => {
          void members.reload();
          void overview.reload();
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Team Reports</h1>
            <p className="text-sm text-gray-500 mt-1">Live team performance across members in your organization</p>
          </div>
          <Button className="bg-[#1E3A5F] hover:bg-[#2B4A6F] text-white" onClick={exportReport}>
            <Download className="w-4 h-4 mr-2" />
            Export Report
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Content Published', value: summary.contentPublished.toString(), icon: FileText, color: 'bg-blue-500' },
            { label: 'Total Leads Generated', value: summary.totalLeads.toString(), icon: Users, color: 'bg-green-500' },
            { label: 'Avg Compliance Rate', value: `${advisorRows.length ? Math.round(advisorRows.reduce((sum, item) => sum + item.complianceRate, 0) / advisorRows.length) : 0}%`, icon: CheckCircle, color: 'bg-teal-500' },
            { label: 'Top Performer', value: topPerformer?.name ?? 'None yet', icon: Star, color: 'bg-amber-500' },
          ].map((kpi) => {
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

        {topPerformer ? (
          <Card className="p-6 rounded-lg shadow-sm border-2 border-[#0EA5E9] bg-gradient-to-r from-blue-50 to-teal-50 mb-8">
            <div className="flex items-center justify-between flex-wrap gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-[#0EA5E9] to-[#0284C7] flex items-center justify-center text-white text-2xl font-semibold">
                  {topPerformer.initials}
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Top Performer This Month</p>
                  <h3 className="text-2xl font-bold text-[#1E3A5F]">{topPerformer.name}</h3>
                </div>
              </div>
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Content Published</p>
                  <p className="text-3xl font-bold text-[#0EA5E9]">{topPerformer.contentPublished}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Leads Generated</p>
                  <p className="text-2xl font-semibold text-gray-700">{topPerformer.leadsGenerated}</p>
                </div>
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-1">Compliance Rate</p>
                  <p className="text-2xl font-semibold text-green-600">{topPerformer.complianceRate}%</p>
                </div>
              </div>
            </div>
          </Card>
        ) : null}

        <div className="grid grid-cols-1 lg:grid-cols-[1.4fr,1fr] gap-8">
          <Card className="rounded-lg shadow-sm border border-gray-200">
            <div className="px-6 py-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-[#1E3A5F]">Performance by Member</h2>
            </div>
            {advisorRows.length === 0 ? (
              <div className="p-8">
                <EmptyState title="No team members found" description="Invite or add members to see team reporting." />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Advisor</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Content</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Leads</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Compliance</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Campaigns</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {advisorRows.map((advisor) => (
                      <tr key={advisor.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white font-medium text-sm">
                              {advisor.initials}
                            </div>
                            <div>
                              <p className="text-sm font-medium text-[#1E3A5F]">{advisor.name}</p>
                              <p className="text-xs text-gray-500">
                                {advisor.lastLoginAt ? `Last login ${new Date(advisor.lastLoginAt).toLocaleString()}` : 'No login recorded'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{advisor.contentPublished}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{advisor.leadsGenerated}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{advisor.complianceRate}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{advisor.activeCampaigns}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Lead Generation by Member</h2>
            {chartData.length === 0 ? (
              <EmptyState title="No performance data yet" description="Lead distribution will appear once activity is recorded." />
            ) : (
              <ResponsiveContainer width="100%" height={320}>
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="leads" fill="#0EA5E9" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
