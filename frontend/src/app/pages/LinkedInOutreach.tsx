import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { CheckCircle2, Pause, Plus, Users } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface LinkedInCampaign {
  id: string;
  name: string;
  status: string;
  totalEnrolled: number;
  totalReplied: number;
}

interface LinkedInCampaignList {
  data: LinkedInCampaign[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export default function LinkedInOutreach() {
  const navigate = useNavigate();
  const campaigns = useApiData<LinkedInCampaignList>('/linkedin/campaigns');
  const campaignRows = campaigns.data?.data ?? [];
  const totalConnections = campaignRows.reduce((sum, item) => sum + item.totalEnrolled, 0);
  const totalReplies = campaignRows.reduce((sum, item) => sum + item.totalReplied, 0);
  const totalMessages = totalConnections;
  const acceptanceRate = totalConnections > 0 ? Math.round((totalReplies / totalConnections) * 100) : 0;
  const dailyProgress = useMemo(() => {
    const used = Math.min(totalMessages, 100);
    return { used, remaining: Math.max(0, 100 - used), percent: used };
  }, [totalMessages]);

  if (campaigns.loading) {
    return <LoadingState label="Loading LinkedIn outreach..." />;
  }

  if (campaigns.error) {
    return <ErrorState message={campaigns.error} onRetry={() => void campaigns.reload()} />;
  }

  const statusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'active') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">
          <CheckCircle2 className="w-3 h-3" />
          Active
        </span>
      );
    }
    if (normalized === 'paused') {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">
          <Pause className="w-3 h-3" />
          Paused
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">
        {status}
      </span>
    );
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">LinkedIn Outreach</h1>
            <p className="text-sm text-gray-500 mt-1">Live LinkedIn campaign performance from the backend</p>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => navigate('/linkedin-builder')}>
            <Plus className="w-4 h-4 mr-2" />
            New Campaign
          </Button>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Connections Sent', value: totalConnections, hint: 'Live enrollments', color: 'bg-blue-50 text-[#0A66C2]' },
            { label: 'Acceptance Rate', value: `${acceptanceRate}%`, hint: 'Replies over enrollments', color: 'bg-green-50 text-green-600' },
            { label: 'Messages Sent', value: totalMessages, hint: 'Current campaign list', color: 'bg-purple-50 text-purple-600' },
            { label: 'Replies', value: totalReplies, hint: `${campaignRows.length} tracked campaigns`, color: 'bg-sky-50 text-sky-600' },
          ].map((item) => (
            <Card key={item.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm text-gray-600 mb-1">{item.label}</p>
                  <h3 className="text-3xl font-semibold text-[#1E3A5F]">{item.value}</h3>
                  <p className="text-sm text-gray-500 mt-2">{item.hint}</p>
                </div>
                <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${item.color}`}>
                  <Users className="w-6 h-6" />
                </div>
              </div>
            </Card>
          ))}
        </div>

        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <Tabs defaultValue="campaigns">
            <div className="border-b border-gray-200 px-6 pt-4">
              <TabsList className="bg-transparent p-0">
                <TabsTrigger value="campaigns" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#0EA5E9]">
                  Campaigns
                </TabsTrigger>
                <TabsTrigger value="contacts" className="data-[state=active]:bg-transparent data-[state=active]:shadow-none data-[state=active]:text-[#0EA5E9]">
                  Contacts
                </TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="campaigns" className="m-0 p-6">
              {campaignRows.length === 0 ? (
                <EmptyState
                  title="No LinkedIn campaigns yet"
                  description="Create a campaign in the builder to populate this table with live outreach activity."
                />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Campaign Name</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Connections Sent</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Messages Sent</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Replies</th>
                      </tr>
                    </thead>
                    <tbody>
                      {campaignRows.map((campaign) => (
                        <tr key={campaign.id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-4 px-4 text-sm font-medium text-[#1E3A5F]">{campaign.name}</td>
                          <td className="py-4 px-4">{statusBadge(campaign.status)}</td>
                          <td className="py-4 px-4 text-sm text-gray-700">{campaign.totalEnrolled}</td>
                          <td className="py-4 px-4 text-sm text-gray-700">{campaign.totalEnrolled}</td>
                          <td className="py-4 px-4 text-sm text-gray-700">{campaign.totalReplied}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </TabsContent>

            <TabsContent value="contacts" className="m-0 p-6">
              <EmptyState
                title="No enrolled contacts yet"
                description="Contacts will appear here once leads are enrolled into active LinkedIn campaigns."
              />
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="mt-6 p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1E3A5F]">Daily Message Limit</h3>
              <p className="text-xs text-gray-500 mt-1">
                {dailyProgress.used} of 100 estimated messages used from current enrollments
              </p>
            </div>
            <span className="text-2xl font-semibold text-[#1E3A5F]">{dailyProgress.percent}%</span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#0EA5E9] rounded-full transition-all" style={{ width: `${dailyProgress.percent}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2">{dailyProgress.remaining} messages remaining before the 100/day soft cap</p>
        </Card>
      </div>
    </div>
  );
}
