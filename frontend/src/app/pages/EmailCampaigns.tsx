import { Eye, Mail, Plus, TrendingUp, Users, XCircle } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface EmailSequence {
  id: string;
  name: string;
  status: string;
  _count?: {
    steps?: number;
    enrollments?: number;
  };
}

interface EmailSequenceList {
  items: EmailSequence[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
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

export default function EmailCampaigns() {
  const navigate = useNavigate();
  const sequences = useApiData<EmailSequenceList>('/email/sequences');
  const metrics = useApiData<EmailMetrics>('/analytics/email?preset=30d');

  if (sequences.loading || metrics.loading) {
    return <LoadingState label="Loading email campaigns..." />;
  }

  if (sequences.error || metrics.error) {
    return (
      <ErrorState
        message={sequences.error || metrics.error || 'Failed to load email campaigns.'}
        onRetry={() => {
          void sequences.reload();
          void metrics.reload();
        }}
      />
    );
  }

  const sequenceRows = sequences.data?.items ?? [];
  const emailMetrics = metrics.data ?? {
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

  const activeSequences = sequenceRows.filter((item) => item.status.toLowerCase() === 'active').length;
  const totalEnrolled = sequenceRows.reduce((sum, item) => sum + (item._count?.enrollments ?? 0), 0);

  const getStatusBadge = (status: string) => {
    const normalized = status.toLowerCase();
    if (normalized === 'active') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700 border border-green-200">Active</span>;
    }
    if (normalized === 'draft') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">Draft</span>;
    }
    if (normalized === 'paused') {
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-yellow-100 text-yellow-700 border border-yellow-200">Paused</span>;
    }
    return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 border border-gray-200">{status}</span>;
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Email Campaigns</h1>
            <p className="text-sm text-gray-500 mt-1">Live sequence and delivery analytics</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              <span className="text-sm font-medium text-green-700">Provider Ready</span>
            </div>
            <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => navigate('/email/create')}>
              <Plus className="w-4 h-4 mr-2" />
              New Sequence
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {[
            { label: 'Active Sequences', value: activeSequences, hint: 'Currently running', icon: Mail, color: 'bg-blue-50 text-[#0EA5E9]' },
            { label: 'Emails Sent This Month', value: emailMetrics.totalSent.toLocaleString(), hint: `${emailMetrics.deliveryRate}% delivery rate`, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
            { label: 'Open Rate', value: `${emailMetrics.openRate.toFixed(1)}%`, hint: `${emailMetrics.totalOpened} opens`, icon: Eye, color: 'bg-green-50 text-green-600' },
            { label: 'Unsubscribes', value: emailMetrics.unsubscribeCount, hint: `${emailMetrics.bounceRate.toFixed(1)}% bounce rate`, icon: XCircle, color: 'bg-red-50 text-red-500' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm text-gray-600 mb-1">{item.label}</p>
                    <h3 className="text-3xl font-semibold text-[#1E3A5F]">{item.value}</h3>
                    <p className="text-sm text-gray-500 mt-2">{item.hint}</p>
                  </div>
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${item.color}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Email Sequences</h3>
            {sequenceRows.length === 0 ? (
              <EmptyState title="No email sequences yet" description="Create a sequence to populate this view with live enrollment counts and status." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Sequence Name</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Enrolled Leads</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Steps</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sequenceRows.map((sequence) => (
                      <tr key={sequence.id} className="border-b border-gray-100 hover:bg-gray-50">
                        <td className="py-4 px-4 text-sm font-medium text-[#1E3A5F]">{sequence.name}</td>
                        <td className="py-4 px-4">{getStatusBadge(sequence.status)}</td>
                        <td className="py-4 px-4 text-sm text-gray-700">
                          <div className="flex items-center gap-2">
                            <Users className="w-4 h-4 text-gray-400" />
                            <span>{sequence._count?.enrollments ?? 0}</span>
                          </div>
                        </td>
                        <td className="py-4 px-4 text-sm text-gray-700">{sequence._count?.steps ?? 0} steps</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Card>

        <Card className="mt-6 p-6 rounded-lg shadow-sm border border-gray-200 bg-gradient-to-r from-blue-50 to-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-[#0EA5E9] rounded-lg flex items-center justify-center flex-shrink-0">
              <Mail className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Email Automation Active</h3>
              <p className="text-sm text-gray-600 mt-1">
                {totalEnrolled} leads are currently enrolled across {activeSequences} active sequences.
              </p>
              <div className="flex items-center gap-4 mt-3">
                <div className="text-sm">
                  <span className="text-gray-600">Total sent: </span>
                  <span className="font-semibold text-[#1E3A5F]">{emailMetrics.totalSent.toLocaleString()}</span>
                </div>
                <div className="text-sm">
                  <span className="text-gray-600">Avg. click rate: </span>
                  <span className="font-semibold text-[#1E3A5F]">{emailMetrics.clickRate.toFixed(1)}%</span>
                </div>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
