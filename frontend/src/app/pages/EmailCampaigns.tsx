import { Eye, Mail, Plus, TrendingUp, Users, XCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { EmailNav } from './email/EmailNav';

interface EmailSequenceItem {
  id: string;
  name: string;
  status: string;
  triggerType: string;
  _count: {
    steps: number;
    enrollments: number;
  };
  stats: {
    active: number;
    completed: number;
    unsubscribed: number;
    completionRate: number;
  };
}

interface EmailSequenceList {
  items: EmailSequenceItem[];
  total: number;
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

function statusBadge(status: string) {
  const normalized = status.toLowerCase();
  const classes =
    normalized === 'active'
      ? 'bg-green-100 text-green-700 border-green-200'
      : normalized === 'draft'
        ? 'bg-slate-100 text-slate-700 border-slate-200'
        : normalized === 'paused'
          ? 'bg-amber-100 text-amber-700 border-amber-200'
          : 'bg-slate-100 text-slate-700 border-slate-200';

  return <span className={`inline-flex rounded-full border px-2 py-1 text-xs font-medium ${classes}`}>{status}</span>;
}

function humanizeTrigger(trigger: string) {
  return trigger
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function EmailCampaigns() {
  const navigate = useNavigate();
  const sequences = useApiData<EmailSequenceList>('/email/sequences?page=1&limit=100');
  const metrics = useApiData<EmailMetrics>('/analytics/email?preset=30d');

  if (sequences.loading || metrics.loading) {
    return <LoadingState label="Loading email sequences..." />;
  }

  if (sequences.error || metrics.error) {
    return (
      <ErrorState
        message={sequences.error || metrics.error || 'Failed to load email sequences.'}
        onRetry={() => {
          void sequences.reload();
          void metrics.reload();
        }}
      />
    );
  }

  const rows = sequences.data?.items ?? [];
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

  const activeSequences = rows.filter((item) => item.status === 'ACTIVE').length;
  const totalEnrolled = rows.reduce((sum, item) => sum + item._count.enrollments, 0);

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">Email Marketing</h1>
              <p className="mt-1 text-sm text-gray-500">Sequence list, Mailgun delivery analytics, and enrollment performance.</p>
            </div>
            <EmailNav />
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 px-3 py-2">
              <div className="h-2 w-2 rounded-full bg-green-500" />
              <span className="text-sm font-medium text-green-700">Mailgun Ready</span>
            </div>
            <Button className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]" onClick={() => navigate('/email/sequences/new')}>
              <Plus className="mr-2 h-4 w-4" />
              New Sequence
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active Sequences', value: activeSequences, hint: `${rows.length} total sequences`, icon: Mail, color: 'bg-blue-50 text-[#0EA5E9]' },
            { label: 'Emails Sent', value: emailMetrics.totalSent.toLocaleString(), hint: `${emailMetrics.deliveryRate.toFixed(1)}% delivered`, icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
            { label: 'Open Rate', value: `${emailMetrics.openRate.toFixed(1)}%`, hint: `${emailMetrics.totalOpened} opens`, icon: Eye, color: 'bg-green-50 text-green-600' },
            { label: 'Unsubscribes', value: emailMetrics.unsubscribeCount, hint: `${emailMetrics.bounceRate.toFixed(1)}% bounce rate`, icon: XCircle, color: 'bg-red-50 text-red-500' },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="mb-1 text-sm text-gray-600">{item.label}</p>
                    <h3 className="text-3xl font-semibold text-[#1E3A5F]">{item.value}</h3>
                    <p className="mt-2 text-sm text-gray-500">{item.hint}</p>
                  </div>
                  <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${item.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <Card className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between p-6">
            <div>
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Sequences</h3>
              <p className="mt-1 text-sm text-gray-500">View detail, edit steps, and enroll leads into any live sequence.</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/email/templates')}>
              Manage Templates
            </Button>
          </div>
          {rows.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState title="No email sequences yet" description="Create a sequence and enroll leads to start Mailgun-backed campaigns." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sequence</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Trigger</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Steps</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Enrolled</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Completion Rate</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((sequence) => (
                    <tr key={sequence.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4">
                        <Link to={`/email/sequences/${sequence.id}`} className="text-sm font-medium text-[#1E3A5F] hover:text-[#0EA5E9]">
                          {sequence.name}
                        </Link>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{humanizeTrigger(sequence.triggerType)}</td>
                      <td className="px-4 py-4">{statusBadge(sequence.status)}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{sequence._count.steps}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">
                        <div className="flex items-center gap-2">
                          <Users className="h-4 w-4 text-gray-400" />
                          <span>{sequence._count.enrollments}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{sequence.stats.completionRate.toFixed(1)}%</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Link to={`/email/sequences/${sequence.id}`} className="text-sm font-medium text-[#0EA5E9] hover:underline">
                            View
                          </Link>
                          <Link to={`/email/sequences/${sequence.id}/edit`} className="text-sm font-medium text-[#0EA5E9] hover:underline">
                            Edit
                          </Link>
                          <Link to={`/email/sequences/${sequence.id}/enroll`} className="text-sm font-medium text-[#0EA5E9] hover:underline">
                            Enroll
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="mt-6 rounded-lg border border-gray-200 bg-gradient-to-r from-blue-50 to-white p-6 shadow-sm">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-lg bg-[#0EA5E9]">
              <Mail className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Automation Snapshot</h3>
              <p className="mt-1 text-sm text-gray-600">
                {totalEnrolled} leads are currently enrolled across {activeSequences} active sequences.
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                <span className="text-gray-600">
                  Total sent: <span className="font-semibold text-[#1E3A5F]">{emailMetrics.totalSent.toLocaleString()}</span>
                </span>
                <span className="text-gray-600">
                  Avg. click rate: <span className="font-semibold text-[#1E3A5F]">{emailMetrics.clickRate.toFixed(1)}%</span>
                </span>
              </div>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
