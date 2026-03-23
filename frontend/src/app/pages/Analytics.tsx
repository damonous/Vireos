import { useCallback, useMemo, useState } from 'react';
import {
  TrendingUp,
  FileText,
  Target,
  Users,
  Linkedin,
  Facebook,
  Mail,
  DollarSign,
  ArrowUpRight,
  Download,
} from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
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
import { DateRangeSelector } from '../components/DateRangeSelector';
import type { DatePreset, CustomDateRange } from '../components/DateRangeSelector';

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

interface LinkedInMetrics {
  postsPublished: number;
  activeCampaigns: number;
  totalEnrolled: number;
  totalReplied: number;
  replyRate: number;
  campaignList: Array<{
    id: string;
    name: string;
    status: string;
    enrolled: number;
    replied: number;
  }>;
}

interface FacebookMetrics {
  postsPublished: number;
  activeCampaigns: number;
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  totalLeads: number;
  totalSpend: number;
  cpl: number;
  campaignList: Array<{
    id: string;
    name: string;
    status: string;
    impressions: number;
    clicks: number;
    leads: number;
    spend: number;
  }>;
}

interface EmailMetrics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeCount: number;
}

interface LeadMetrics {
  total: number;
  byStatus: Record<string, number>;
  bySource: Record<string, number>;
  conversionRate: number;
  averageTimeToClient: number | null;
}

function formatCount(value: number): string {
  if (value >= 1000000) {
    return `${(value / 1000000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}K`;
  }
  return value.toString();
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: value >= 1000 ? 0 : 2,
  }).format(value);
}

function humanizeKey(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function Analytics() {
  const [preset, setPreset] = useState<DatePreset>('30d');
  const [customRange, setCustomRange] = useState<CustomDateRange | undefined>();

  const handleDateChange = useCallback((newPreset: DatePreset, range?: CustomDateRange) => {
    setPreset(newPreset);
    setCustomRange(newPreset === 'custom' ? range : undefined);
  }, []);

  const queryString = useMemo(() => {
    if (preset === 'custom' && customRange) {
      return `from=${customRange.from.toISOString()}&to=${customRange.to.toISOString()}`;
    }
    return `preset=${preset}`;
  }, [preset, customRange]);

  const overview = useApiData<OverviewMetrics>(`/analytics/overview?${queryString}`, [queryString]);
  const linkedIn = useApiData<LinkedInMetrics>(`/analytics/linkedin?${queryString}`, [queryString]);
  const facebook = useApiData<FacebookMetrics>(`/analytics/facebook?${queryString}`, [queryString]);
  const email = useApiData<EmailMetrics>(`/analytics/email?${queryString}`, [queryString]);
  const leads = useApiData<LeadMetrics>(`/analytics/leads?${queryString}`, [queryString]);

  const isLoading =
    overview.loading ||
    linkedIn.loading ||
    facebook.loading ||
    email.loading ||
    leads.loading;

  const hasError =
    overview.error ||
    linkedIn.error ||
    facebook.error ||
    email.error ||
    leads.error;

  if (isLoading) {
    return <LoadingState label="Loading analytics..." />;
  }

  if (hasError) {
    return (
      <ErrorState
        message={hasError}
        onRetry={() => {
          void overview.reload();
          void linkedIn.reload();
          void facebook.reload();
          void email.reload();
          void leads.reload();
        }}
      />
    );
  }

  const overviewData = overview.data ?? {
    contentCreated: 0,
    contentPublished: 0,
    totalLeads: 0,
    newLeads: 0,
    totalEmailsSent: 0,
    emailOpenRate: 0,
    activeCampaigns: 0,
    creditsUsed: 0,
  };

  const linkedInData = linkedIn.data ?? {
    postsPublished: 0,
    activeCampaigns: 0,
    totalEnrolled: 0,
    totalReplied: 0,
    replyRate: 0,
    campaignList: [],
  };

  const facebookData = facebook.data ?? {
    postsPublished: 0,
    activeCampaigns: 0,
    totalImpressions: 0,
    totalClicks: 0,
    ctr: 0,
    totalLeads: 0,
    totalSpend: 0,
    cpl: 0,
    campaignList: [],
  };

  const emailData = email.data ?? {
    totalSent: 0,
    totalDelivered: 0,
    totalOpened: 0,
    totalClicked: 0,
    deliveryRate: 0,
    openRate: 0,
    clickRate: 0,
    bounceRate: 0,
    unsubscribeCount: 0,
  };

  const leadData = leads.data ?? {
    total: 0,
    byStatus: {},
    bySource: {},
    conversionRate: 0,
    averageTimeToClient: null,
  };

  const engagementData = [
    { channel: 'LinkedIn', engagements: linkedInData.totalReplied, reach: linkedInData.totalEnrolled },
    { channel: 'Facebook', engagements: facebookData.totalClicks, reach: facebookData.totalImpressions },
    { channel: 'Email', engagements: emailData.totalClicked, reach: emailData.totalSent },
  ];

  const contentData = [
    { platform: 'LinkedIn', count: linkedInData.postsPublished },
    { platform: 'Facebook', count: facebookData.postsPublished },
    { platform: 'Email', count: overviewData.totalEmailsSent },
  ];

  const leadSourceData = Object.entries(leadData.bySource).map(([name, value], index) => ({
    name: humanizeKey(name),
    value,
    color: ['#0A66C2', '#1877F2', '#0EA5E9', '#10B981', '#8B5CF6'][index % 5] ?? '#94A3B8',
  }));

  const topContent = [
    ...linkedInData.campaignList.slice(0, 2).map((campaign) => ({
      id: campaign.id,
      title: campaign.name,
      platform: 'linkedin',
      primaryMetric: `${campaign.enrolled} enrolled`,
      secondaryMetric: `${campaign.replied} replies`,
      tertiaryMetric: `${campaign.status.toLowerCase()}`,
      value: `${campaign.replied} replies`,
    })),
    ...facebookData.campaignList.slice(0, 2).map((campaign) => ({
      id: campaign.id,
      title: campaign.name,
      platform: 'facebook',
      primaryMetric: `${formatCount(campaign.impressions)} impressions`,
      secondaryMetric: `${campaign.clicks} clicks`,
      tertiaryMetric: `${campaign.leads} leads`,
      value: formatCurrency(campaign.spend),
    })),
    {
      id: 'email-performance',
      title: 'Email Performance',
      platform: 'email',
      primaryMetric: `${emailData.totalOpened} opens`,
      secondaryMetric: `${emailData.totalClicked} clicks`,
      tertiaryMetric: `${emailData.unsubscribeCount} unsubscribes`,
      value: `${emailData.openRate}% open rate`,
    },
  ].slice(0, 5);
  const exportAnalytics = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      overview: overviewData,
      linkedIn: linkedInData,
      facebook: facebookData,
      email: emailData,
      leads: leadData,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = 'vireos-analytics.json';
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const leadPipeline = Object.entries(leadData.byStatus).map(([stage, count]) => ({
    stage: humanizeKey(stage),
    count,
    aum:
      stage === 'CLIENT' && leadData.averageTimeToClient !== null
        ? `${leadData.averageTimeToClient} days avg`
        : null,
  }));

  const aumGrowthData = [
    { metric: 'Credits Used', value: Math.abs(overviewData.creditsUsed) },
    { metric: 'Spend', value: facebookData.totalSpend },
    { metric: 'Reply Rate', value: linkedInData.replyRate },
    { metric: 'Open Rate', value: emailData.openRate },
    { metric: 'Conversion', value: leadData.conversionRate },
  ];

  const hasAnyData =
    overviewData.contentCreated > 0 ||
    overviewData.totalLeads > 0 ||
    linkedInData.campaignList.length > 0 ||
    facebookData.campaignList.length > 0 ||
    emailData.totalSent > 0;

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

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Analytics Dashboard</h1>
            <p className="text-sm text-gray-500 mt-1">Live performance data across content, campaigns, and lead flow</p>
          </div>
          <div className="flex items-center gap-2">
            <DateRangeSelector value={preset} onChange={handleDateChange} customRange={customRange} />
            <Button variant="outline" className="flex items-center gap-2" onClick={exportAnalytics}>
              <Download className="w-4 h-4" />
              Export
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {!hasAnyData ? (
          <Card className="p-10 rounded-lg shadow-sm border border-gray-200 mb-8">
            <EmptyState
              title="No analytics data yet"
              description="Create campaigns, publish content, or add leads to populate the reporting views."
            />
          </Card>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-start justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Reach</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">
                  {formatCount(linkedInData.totalEnrolled + facebookData.totalImpressions + emailData.totalSent)}
                </h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  Live aggregate audience
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
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">
                  {overviewData.contentPublished + linkedInData.postsPublished + facebookData.postsPublished}
                </h3>
                <p className="text-sm text-gray-500 mt-2">{overviewData.contentCreated} drafts created</p>
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
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">
                  {Math.round((((linkedInData.replyRate + facebookData.ctr + emailData.clickRate) / 3) || 0) * 10) / 10}%
                </h3>
                <p className="text-sm text-green-600 mt-2">Based on reply, CTR, and click rate</p>
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
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{leadData.total}</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <TrendingUp className="w-4 h-4" />
                  {overviewData.newLeads} new this period
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
                <p className="text-sm text-gray-600 mb-1">Facebook Spend</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{formatCurrency(facebookData.totalSpend)}</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  CPL {formatCurrency(facebookData.cpl || 0)}
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
                <p className="text-sm text-gray-600 mb-1">Lead Conversion Rate</p>
                <h3 className="text-3xl font-semibold text-[#1E3A5F]">{leadData.conversionRate}%</h3>
                <p className="text-sm text-green-600 mt-2 flex items-center gap-1">
                  <ArrowUpRight className="w-4 h-4" />
                  {leadData.averageTimeToClient ?? 0} day avg to client
                </p>
              </div>
              <div className="w-12 h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </Card>
        </div>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Channel Reach vs Engagement</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={engagementData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" />
              <XAxis dataKey="channel" stroke="#6B7280" fontSize={12} />
              <YAxis stroke="#6B7280" fontSize={12} />
              <Tooltip />
              <Legend />
              <Line type="monotone" dataKey="reach" stroke="#0EA5E9" strokeWidth={2} />
              <Line type="monotone" dataKey="engagements" stroke="#10B981" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Published Output by Channel</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={contentData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="platform" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" radius={[8, 8, 0, 0]}>
                  <Cell fill="#0A66C2" />
                  <Cell fill="#1877F2" />
                  <Cell fill="#0EA5E9" />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Lead Sources</h3>
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={leadSourceData}
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  labelLine={false}
                  label={({ name, percent }) => `${name} ${Math.round((percent ?? 0) * 100)}%`}
                  dataKey="value"
                >
                  {leadSourceData.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Top Performing Campaigns</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {topContent.length === 0 ? (
                <div className="p-6">
                  <EmptyState title="No live campaigns yet" description="Campaign performance will appear here once channels are active." />
                </div>
              ) : (
                topContent.map((item) => (
                  <div key={item.id} className="px-6 py-4 flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center">
                        {getPlatformIcon(item.platform)}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-[#1E3A5F]">{item.title}</p>
                        <p className="text-sm text-gray-600">{item.primaryMetric}</p>
                        <p className="text-xs text-gray-500 mt-1">{item.secondaryMetric} • {item.tertiaryMetric}</p>
                      </div>
                    </div>
                    <p className="text-sm font-semibold text-[#1E3A5F] whitespace-nowrap">{item.value}</p>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="rounded-lg shadow-sm border border-gray-200">
            <div className="p-6 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Lead Pipeline</h3>
            </div>
            <div className="divide-y divide-gray-100">
              {leadPipeline.map((item) => (
                <div key={item.stage} className="px-6 py-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-medium text-[#1E3A5F]">{item.stage}</p>
                    <p className="text-xs text-gray-500">{item.aum ?? 'Current lead count by status'}</p>
                  </div>
                  <p className="text-xl font-semibold text-[#1E3A5F]">{item.count}</p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Efficiency Indicators</h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={aumGrowthData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="metric" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="value" fill="#1E3A5F" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>
    </div>
  );
}
