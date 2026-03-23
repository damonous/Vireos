import { useMemo } from 'react';
import { AlertCircle, Clock, Download, FileCheck, TrendingUp } from 'lucide-react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ReferenceLine,
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

interface ReviewItem {
  id: string;
  status: string;
  reviewNotes: string | null;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  draft: {
    title: string | null;
    channel: string;
  } | null;
}

interface ReviewResponse {
  data?: ReviewItem[];
  items?: ReviewItem[];
}

interface AuditItem {
  id: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
  metadata?: Record<string, unknown> | null;
}

function humanize(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function ComplianceReports() {
  const reviews = useApiData<ReviewItem[] | ReviewResponse>('/reviews?page=1&limit=100');
  const auditTrail = useApiData<AuditItem[]>('/audit-trail?page=1&limit=100');

  const reviewRows = Array.isArray(reviews.data)
    ? reviews.data
    : reviews.data?.items ?? reviews.data?.data ?? [];
  const auditRows = auditTrail.data ?? [];

  const totals = useMemo(() => {
    const approved = reviewRows.filter((item) => item.status === 'APPROVED').length;
    const rejected = reviewRows.filter((item) => item.status === 'REJECTED').length;
    const pending = reviewRows.filter((item) => item.status === 'PENDING').length;

    const reviewDurations = reviewRows
      .filter((item) => item.reviewedAt && item.submittedAt)
      .map((item) => {
        const submittedAt = new Date(item.submittedAt as string).getTime();
        const reviewedAt = new Date(item.reviewedAt as string).getTime();
        return Math.max(0, (reviewedAt - submittedAt) / (1000 * 60 * 60));
      });

    const avgReviewTime =
      reviewDurations.length > 0
        ? Math.round((reviewDurations.reduce((sum, value) => sum + value, 0) / reviewDurations.length) * 10) / 10
        : 0;

    const flaggedTerms = auditRows.filter((item) => item.action.includes('REJECT') || item.action.includes('FLAG'));

    return {
      totalReviewed: reviewRows.length,
      approvalRate: reviewRows.length > 0 ? Math.round((approved / reviewRows.length) * 1000) / 10 : 0,
      avgReviewTime,
      flaggedCount: flaggedTerms.length,
      approved,
      rejected,
      pending,
    };
  }, [auditRows, reviewRows]);

  const complianceRateData = useMemo(() => {
    const grouped = new Map<string, { approved: number; total: number }>();

    for (const review of reviewRows) {
      const key = new Date(review.createdAt).toLocaleDateString();
      const existing = grouped.get(key) ?? { approved: 0, total: 0 };
      existing.total += 1;
      if (review.status === 'APPROVED') {
        existing.approved += 1;
      }
      grouped.set(key, existing);
    }

    return Array.from(grouped.entries())
      .map(([day, value]) => ({
        day,
        rate: value.total > 0 ? Math.round((value.approved / value.total) * 1000) / 10 : 0,
      }))
      .slice(-14);
  }, [reviewRows]);

  const rejectionReasonsData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const review of reviewRows.filter((item) => item.status === 'REJECTED')) {
      const note = review.reviewNotes?.trim() || 'No note provided';
      counts.set(note, (counts.get(note) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([name, value], index) => ({
        name,
        value,
        color: ['#EF4444', '#F97316', '#EAB308', '#0EA5E9'][index % 4] ?? '#94A3B8',
      }))
      .slice(0, 4);
  }, [reviewRows]);

  const platformReviewsData = useMemo(() => {
    const counts = new Map<string, number>();

    for (const review of reviewRows) {
      const channel = review.draft?.channel ?? 'UNKNOWN';
      counts.set(channel, (counts.get(channel) ?? 0) + 1);
    }

    return Array.from(counts.entries()).map(([platform, reviewsCount]) => ({
      platform: humanize(platform),
      reviews: reviewsCount,
    }));
  }, [reviewRows]);

  const flaggedTermsData = useMemo(() => {
    const counts = new Map<string, { occurrences: number; actors: Set<string> }>();

    for (const review of reviewRows.filter((item) => item.status === 'REJECTED')) {
      const key = review.reviewNotes?.trim() || 'No note provided';
      const existing = counts.get(key) ?? { occurrences: 0, actors: new Set<string>() };
      existing.occurrences += 1;
      existing.actors.add(review.id);
      counts.set(key, existing);
    }

    return Array.from(counts.entries())
      .map(([term, value]) => ({
        term,
        occurrences: value.occurrences,
        advisors: value.actors.size,
      }))
      .sort((a, b) => b.occurrences - a.occurrences)
      .slice(0, 6);
  }, [reviewRows]);

  const exportReport = () => {
    const payload = {
      generatedAt: new Date().toISOString(),
      summary: totals,
      reviews: reviewRows,
      auditTrail: auditRows,
    };

    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'vireos-compliance-report.json';
    link.click();
    URL.revokeObjectURL(url);
  };

  const hasData = reviewRows.length > 0 || auditRows.length > 0;

  if (reviews.loading || auditTrail.loading) {
    return <LoadingState label="Loading compliance reports..." />;
  }

  if (reviews.error || auditTrail.error) {
    return (
      <ErrorState
        message={reviews.error || auditTrail.error || 'Failed to load compliance reports.'}
        onRetry={() => {
          void reviews.reload();
          void auditTrail.reload();
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-end">
          <div className="flex items-center gap-3">
            <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={exportReport}>
              <Download className="w-4 h-4 mr-2" />
              Export JSON Report
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        {!hasData ? (
          <Card className="p-10 rounded-lg shadow-sm border border-gray-200 mb-8">
            <EmptyState
              title="No compliance activity yet"
              description="Review submissions and audit events will populate this report automatically."
            />
          </Card>
        ) : null}

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Total Reviewed', value: totals.totalReviewed.toString(), icon: FileCheck, color: 'bg-blue-500' },
            { label: 'Approval Rate', value: `${totals.approvalRate}%`, icon: TrendingUp, color: 'bg-green-500' },
            { label: 'Avg Review Time', value: `${totals.avgReviewTime} hrs`, icon: Clock, color: 'bg-teal-500' },
            { label: 'Flagged Events', value: totals.flaggedCount.toString(), icon: AlertCircle, color: 'bg-orange-500' },
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

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-8">
          <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Compliance Rate Over Time</h3>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={complianceRateData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" tick={{ fontSize: 12 }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 12 }} />
              <Tooltip />
              <ReferenceLine y={90} stroke="#F97316" strokeDasharray="3 3" label="Target" />
              <Line type="monotone" dataKey="rate" stroke="#0EA5E9" strokeWidth={2} name="Compliance Rate %" />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Rejection Reasons</h3>
            {rejectionReasonsData.length === 0 ? (
              <EmptyState title="No rejected reviews" description="Rejection reasons will appear once content is rejected." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={rejectionReasonsData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name.slice(0, 16)} ${Math.round((percent ?? 0) * 100)}%`}
                    outerRadius={80}
                    dataKey="value"
                  >
                    {rejectionReasonsData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Reviews by Channel</h3>
            {platformReviewsData.length === 0 ? (
              <EmptyState title="No review volume yet" description="Channel breakdown appears after content enters the review flow." />
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={platformReviewsData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="platform" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="reviews" name="Reviews">
                    {platformReviewsData.map((entry, index) => (
                      <Cell key={entry.platform} fill={['#0EA5E9', '#3B82F6', '#6366F1'][index % 3] ?? '#94A3B8'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        <Card className="rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Most Frequent Rejection Notes</h3>
          </div>
          {flaggedTermsData.length === 0 ? (
            <div className="p-8">
              <EmptyState title="No flagged notes recorded" description="Once reviewers reject or flag items, the notes will be summarized here." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Review Note</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Occurrences</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Affected Reviews</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {flaggedTermsData.map((item) => (
                    <tr key={item.term} className="hover:bg-gray-50">
                      <td className="px-6 py-4 text-sm font-medium text-red-600">{item.term}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.occurrences}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{item.advisors}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
