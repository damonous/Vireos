import { Bell, CheckCircle2, Clock, Facebook, Info, Linkedin, Mail } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';

interface ReviewItem {
  id: string;
  status: string;
  createdAt: string;
  submittedAt: string | null;
  reviewedAt: string | null;
  reviewNotes: string | null;
  draft: {
    title: string | null;
    channel: string;
  } | null;
  reviewer?: {
    firstName?: string | null;
    lastName?: string | null;
  } | null;
}

interface ReviewResponse {
  data?: ReviewItem[];
  items?: ReviewItem[];
}

const platformIcons = {
  LINKEDIN: Linkedin,
  FACEBOOK: Facebook,
  EMAIL: Mail,
} as const;

export default function ComplianceQueue() {
  const { user } = useAuth();
  const reviews = useApiData<ReviewItem[] | ReviewResponse>('/reviews?page=1&limit=50');

  if (reviews.loading) {
    return <LoadingState label="Loading compliance queue..." />;
  }

  if (reviews.error) {
    return <ErrorState message={reviews.error} onRetry={() => void reviews.reload()} />;
  }

  const items = Array.isArray(reviews.data) ? reviews.data : reviews.data?.items ?? reviews.data?.data ?? [];
  const selectedItem = items[0] ?? null;
  const counts = {
    all: items.length,
    pending: items.filter((item) => item.status === 'PENDING_REVIEW').length,
    approved: items.filter((item) => item.status === 'APPROVED').length,
    rejected: items.filter((item) => item.status === 'REJECTED').length,
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Compliance Queue</h1>
          <p className="text-sm text-gray-500 mt-1">Live review requests and publishing approvals</p>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">{user?.organization?.name ?? 'Organization'}</span>
          <button className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Bell className="w-5 h-5 text-gray-600" />
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
          </button>
        </div>
      </div>

      <div className="p-8">
        <div className="bg-[#E0F2FE] border border-[#0EA5E9]/30 rounded-lg p-4 mb-6 flex items-start gap-3">
          <Info className="w-5 h-5 text-[#0EA5E9] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[#1E3A5F] flex-1">
            Approved content is automatically published at the scheduled time once downstream provider integrations are configured.
          </p>
        </div>

        <div className="flex gap-3 mb-6">
          {[
            ['all', counts.all],
            ['pending', counts.pending],
            ['approved', counts.approved],
            ['rejected', counts.rejected],
          ].map(([label, count]) => (
            <div key={label} className="px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-300">
              {label[0].toUpperCase() + label.slice(1)} ({count})
            </div>
          ))}
        </div>

        {items.length === 0 ? (
          <Card className="p-10 rounded-lg shadow-sm border border-gray-200">
            <EmptyState title="No content in review" description="Drafts submitted for compliance review will appear here." />
          </Card>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 rounded-lg shadow-sm border border-gray-200 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Content Title</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Platform</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Submitted</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-600 uppercase tracking-wider">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item) => {
                      const channel = (item.draft?.channel ?? 'EMAIL').toUpperCase();
                      const Icon = platformIcons[channel as keyof typeof platformIcons] ?? Mail;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E3A5F]">{item.draft?.title ?? 'Untitled draft'}</td>
                          <td className="px-6 py-4 whitespace-nowrap"><Icon className="w-5 h-5 text-gray-600" /></td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(item.submittedAt ?? item.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">
                            <Badge className={item.status === 'APPROVED' ? 'bg-green-100 text-green-800 border-green-200 border' : item.status === 'REJECTED' ? 'bg-red-100 text-red-800 border-red-200 border' : 'bg-amber-100 text-amber-800 border-amber-200 border'}>
                              {item.status}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Latest Review</h3>
              {selectedItem ? (
                <div className="space-y-4">
                  <div>
                    <h4 className="font-medium text-[#1E3A5F]">{selectedItem.draft?.title ?? 'Untitled draft'}</h4>
                    <Badge className={selectedItem.status === 'APPROVED' ? 'bg-green-100 text-green-800 border-green-200 border mt-2' : selectedItem.status === 'REJECTED' ? 'bg-red-100 text-red-800 border-red-200 border mt-2' : 'bg-amber-100 text-amber-800 border-amber-200 border mt-2'}>
                      {selectedItem.status}
                    </Badge>
                  </div>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Submitted:</span>
                      <span className="text-[#1E3A5F] font-medium">{new Date(selectedItem.submittedAt ?? selectedItem.createdAt).toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Reviewed:</span>
                      <span className="text-[#1E3A5F] font-medium">{selectedItem.reviewedAt ? new Date(selectedItem.reviewedAt).toLocaleString() : 'Pending'}</span>
                    </div>
                  </div>
                  <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-sm text-[#1E3A5F]">
                    {selectedItem.reviewNotes || 'No review notes recorded yet.'}
                  </div>
                </div>
              ) : (
                <EmptyState title="No selected review" description="Pick an item from the queue to inspect it in detail." />
              )}
            </Card>
          </div>
        )}

        <Card className="mt-6 p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-sm font-semibold text-[#1E3A5F]">Queue Overview</h3>
              <p className="text-xs text-gray-500 mt-1">Pending review items currently in the system</p>
            </div>
            <span className="text-2xl font-semibold text-[#1E3A5F]">{counts.pending}</span>
          </div>
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-[#0EA5E9] rounded-full transition-all" style={{ width: `${items.length ? Math.round((counts.pending / items.length) * 100) : 0}%` }} />
          </div>
          <p className="text-xs text-gray-500 mt-2">{counts.approved} approved, {counts.rejected} rejected</p>
        </Card>
      </div>
    </div>
  );
}
