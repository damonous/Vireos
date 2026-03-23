import React, { useMemo, useState } from 'react';
import { CheckCircle, Clock, Edit3, Info, Mail, X, XCircle } from 'lucide-react';

// Custom brand icons (lucide brand icons are deprecated)
function LinkedinIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}
import { useNavigate } from 'react-router';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';

type StatusFilter = 'all' | 'pending' | 'approved' | 'rejected';

interface ReviewItem {
  id: string;
  title: string | null;
  originalPrompt: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  reviewNotes: string | null;
  scheduledFor?: string | null;
  linkedinContent?: string | null;
  facebookContent?: string | null;
  emailContent?: string | null;
  adCopyContent?: string | null;
  reviewerId?: string | null;
}

interface ReviewResponse {
  data?: ReviewItem[];
  items?: ReviewItem[];
}

type Platform = 'linkedin' | 'facebook' | 'email' | 'ad-copy';

const statusConfig: Record<string, { label: string; sublabel?: string; filter: StatusFilter; className: string }> = {
  PENDING_REVIEW:    { label: 'Pending',               filter: 'pending',  className: 'bg-amber-100 text-amber-700' },
  APPROVED:          { label: 'Approved',               filter: 'approved', className: 'bg-emerald-100 text-emerald-800' },
  APPROVED_SCHEDULED:{ label: 'Approved', sublabel: 'Scheduled', filter: 'approved', className: 'bg-emerald-100 text-emerald-800' },
  REJECTED:          { label: 'Rejected',  sublabel: 'Action Required', filter: 'rejected', className: 'bg-red-100 text-red-800' },
  NEEDS_CHANGES:     { label: 'Needs Changes', sublabel: 'Action Required', filter: 'rejected', className: 'bg-red-100 text-red-800' },
  REVISION_REQUIRED: { label: 'Needs Changes', sublabel: 'Action Required', filter: 'rejected', className: 'bg-red-100 text-red-800' },
  PUBLISHED:         { label: 'Published',              filter: 'approved', className: 'bg-green-500 text-white' },
};

const platformConfig: Record<Platform, { Icon: React.ElementType; label: string }> = {
  linkedin:  { Icon: LinkedinIcon, label: 'LinkedIn' },
  facebook:  { Icon: FacebookIcon, label: 'Facebook' },
  email:     { Icon: Mail,         label: 'Email' },
  'ad-copy': { Icon: Edit3,        label: 'Ad Copy' },
};

function getPlatform(item: ReviewItem): Platform {
  if (item.linkedinContent) return 'linkedin';
  if (item.facebookContent) return 'facebook';
  if (item.adCopyContent)   return 'ad-copy';
  return 'email';
}

function getContent(item: ReviewItem): string {
  return item.linkedinContent ?? item.facebookContent ?? item.emailContent ?? item.adCopyContent ?? '';
}

function getDisplayTitle(item: ReviewItem): string {
  if (item.title && !item.title.startsWith('Topic:')) return item.title;
  const source = item.title ?? item.originalPrompt ?? '';
  const match = source.match(/^Topic:\s*(.+)/m);
  if (match?.[1]) return match[1].trim();
  const prompt = item.originalPrompt?.trim();
  if (prompt) return prompt.length > 55 ? prompt.slice(0, 55) + '…' : prompt;
  return 'Untitled Draft';
}

function timeAgo(dateStr: string): string {
  const diffMs = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

function StatusBadge({ status, compact = false }: { status: string; compact?: boolean }) {
  const cfg = statusConfig[status] ?? { label: status, filter: 'all' as StatusFilter, className: 'bg-gray-100 text-gray-700' };
  const showIcon = status === 'PUBLISHED' || status === 'APPROVED' || status === 'APPROVED_SCHEDULED';
  return (
    <span className={`inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium whitespace-nowrap ${cfg.className}`}>
      {showIcon && <CheckCircle className="h-3 w-3 flex-shrink-0" aria-hidden="true" />}
      {cfg.label}
      {!compact && cfg.sublabel && (
        <span className="opacity-75">— {cfg.sublabel}</span>
      )}
    </span>
  );
}

export default function ComplianceQueue() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const reviews = useApiData<ReviewItem[] | ReviewResponse>('/reviews?page=1&limit=50');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<StatusFilter>('all');
  const [infoDismissed, setInfoDismissed] = useState(false);

  const items = useMemo<ReviewItem[]>(() => {
    const raw = reviews.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    return (raw as ReviewResponse).items ?? (raw as ReviewResponse).data ?? [];
  }, [reviews.data]);

  const counts = useMemo(
    () => ({
      all:      items.length,
      pending:  items.filter((i) => statusConfig[i.status]?.filter === 'pending').length,
      approved: items.filter((i) => statusConfig[i.status]?.filter === 'approved').length,
      rejected: items.filter((i) => statusConfig[i.status]?.filter === 'rejected').length,
    }),
    [items],
  );

  const filteredItems = useMemo(
    () => (activeFilter === 'all' ? items : items.filter((i) => statusConfig[i.status]?.filter === activeFilter)),
    [items, activeFilter],
  );

  if (reviews.loading) return <LoadingState label="Loading compliance queue..." />;
  if (reviews.error)   return <ErrorState message={reviews.error} onRetry={() => void reviews.reload()} />;

  const effectiveSelectedId = selectedId ?? filteredItems[0]?.id ?? null;
  const selectedItem = filteredItems.find((i) => i.id === effectiveSelectedId) ?? filteredItems[0] ?? null;
  const selStatus = selectedItem
    ? (statusConfig[selectedItem.status] ?? { label: selectedItem.status, filter: 'all' as StatusFilter, className: 'bg-gray-100 text-gray-700' })
    : null;
  const selPlatform = selectedItem ? getPlatform(selectedItem) : null;
  const selPlatformInfo = selPlatform ? platformConfig[selPlatform] : null;

  const advisorName = user?.firstName
    ? `${user.firstName}${user.lastName ? ` ${user.lastName}` : ''}`.trim()
    : (user?.email ?? 'You');

  const filterPills: { key: StatusFilter; label: string }[] = [
    { key: 'all',      label: `All (${counts.all})` },
    { key: 'pending',  label: `Pending (${counts.pending})` },
    { key: 'approved', label: `Approved (${counts.approved})` },
    { key: 'rejected', label: `Rejected (${counts.rejected})` },
  ];

  const isActionable = selectedItem && (
    selectedItem.status === 'REJECTED' ||
    selectedItem.status === 'NEEDS_CHANGES' ||
    selectedItem.status === 'REVISION_REQUIRED'
  );
  const isPending   = selectedItem?.status === 'PENDING_REVIEW';
  const isApproved  = selectedItem?.status === 'APPROVED' || selectedItem?.status === 'APPROVED_SCHEDULED';
  const isPublished = selectedItem?.status === 'PUBLISHED';

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">

      {/* ── Info Banner ── */}
      {!infoDismissed && (
        <div className="mx-8 mt-4 shrink-0 flex items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-800">
          <Info className="h-4 w-4 flex-shrink-0 text-sky-500" aria-hidden="true" />
          <p className="flex-1">
            Approved content is automatically published at the scheduled time. No further action is required from you.
          </p>
          <button
            onClick={() => setInfoDismissed(true)}
            className="flex-shrink-0 rounded p-0.5 hover:bg-sky-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4 text-sky-500" />
          </button>
        </div>
      )}

      {/* ── Main Content ── */}
      <div className="flex flex-1 min-h-0 bg-slate-50 p-6 gap-6 overflow-hidden">

        {/* ── Left Panel ── */}
        <div className="flex flex-col flex-1 gap-4 min-w-0">

          {/* Filter pills */}
          <div className="flex gap-2 flex-wrap">
            {filterPills.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => { setActiveFilter(key); setSelectedId(null); }}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 ${
                  activeFilter === key
                    ? 'bg-sky-500 text-white shadow-sm'
                    : 'bg-white text-slate-600 border border-gray-200 hover:bg-gray-50'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* List card */}
          <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden flex flex-col flex-1 min-h-0">

            {/* Table header */}
            <div className="grid grid-cols-12 px-6 py-3 bg-slate-50 border-b border-slate-100 text-xs font-semibold text-slate-500 uppercase tracking-wider flex-shrink-0">
              <div className="col-span-3">Content Title</div>
              <div className="col-span-2">Advisor</div>
              <div className="col-span-2">Platform</div>
              <div className="col-span-2">Submitted</div>
              <div className="col-span-3">Status</div>
            </div>

            {filteredItems.length === 0 ? (
              <div className="flex flex-1 items-center justify-center p-10">
                <EmptyState
                  title="No items"
                  description={
                    activeFilter === 'all'
                      ? 'Drafts submitted for compliance review will appear here.'
                      : `No ${activeFilter} items found.`
                  }
                />
              </div>
            ) : (
              <ul className="overflow-y-auto flex-1" role="listbox" aria-label="Compliance queue items">
                {filteredItems.map((item) => {
                  const p = getPlatform(item);
                  const { Icon, label: pLabel } = platformConfig[p];
                  const isSelected = item.id === effectiveSelectedId;
                  return (
                    <li key={item.id} role="option" aria-selected={isSelected}>
                      <button
                        onClick={() => setSelectedId(item.id)}
                        className={`w-full grid grid-cols-12 px-6 py-4 border-b border-gray-100 items-center text-sm text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-sky-500 ${
                          isSelected ? 'bg-blue-50/50' : 'bg-white hover:bg-slate-50'
                        }`}
                      >
                        {/* Content Title */}
                        <div className="col-span-3 min-w-0 pr-3">
                          <p className="truncate text-sm font-medium text-blue-900">{getDisplayTitle(item)}</p>
                        </div>

                        {/* Advisor */}
                        <div className="col-span-2 text-sm text-slate-600 truncate pr-2">
                          {advisorName}
                        </div>

                        {/* Platform */}
                        <div className="col-span-2">
                          <span className="inline-flex items-center gap-1.5 text-slate-600">
                            <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                            <span className="hidden xl:inline text-sm">{pLabel}</span>
                          </span>
                        </div>

                        {/* Submitted */}
                        <div className="col-span-2 text-sm text-slate-500">
                          {timeAgo(item.updatedAt ?? item.createdAt)}
                        </div>

                        {/* Status */}
                        <div className="col-span-3">
                          <StatusBadge status={item.status} compact />
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* ── Right Panel ── */}
        <article className="w-[400px] flex-shrink-0 bg-white rounded-xl shadow-sm border border-slate-100 p-6 flex flex-col overflow-y-auto">
          <h2 className="text-lg font-semibold text-slate-900 mb-6">Content Details</h2>

          {selectedItem && selStatus && selPlatformInfo ? (
            <>
              {/* Title + badge */}
              <div className="mb-5">
                <p className="text-base font-semibold text-slate-900 leading-snug mb-2">
                  {getDisplayTitle(selectedItem)}
                </p>
                <StatusBadge status={selectedItem.status} />
              </div>

              {/* Metadata grid */}
              <div className="space-y-3 mb-5 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Advisor</span>
                  <span className="font-medium text-slate-700">{advisorName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Platform</span>
                  <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                    <selPlatformInfo.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                    {selPlatformInfo.label}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Submitted</span>
                  <span className="font-medium text-slate-700">
                    {new Date(selectedItem.updatedAt ?? selectedItem.createdAt).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                    })}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 mb-5" />

              {/* Content preview */}
              <div className="mb-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Content Preview</p>
                <div className="rounded-lg bg-slate-50 p-4">
                  {getContent(selectedItem) ? (
                    <p className="text-sm leading-relaxed text-slate-700 whitespace-pre-wrap">
                      {getContent(selectedItem)}
                    </p>
                  ) : (
                    <p className="text-sm italic text-slate-400">No content stored for this channel.</p>
                  )}
                </div>
              </div>

              {/* Reviewer notes */}
              {selectedItem.reviewNotes && (
                <div className="mb-5">
                  <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500">Reviewer Notes</p>
                  <div className="rounded-lg border border-amber-100 bg-amber-50 p-4">
                    <p className="text-sm leading-relaxed text-slate-700">{selectedItem.reviewNotes}</p>
                  </div>
                </div>
              )}

              {/* Approved / Scheduled card */}
              {(isApproved || isPublished) && (
                <div className="mb-5 rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <div className="flex items-start gap-2.5 mb-3">
                    <CheckCircle className="h-5 w-5 flex-shrink-0 text-emerald-600 mt-0.5" aria-hidden="true" />
                    <div>
                      <p className="text-sm font-semibold text-emerald-800">
                        {isPublished ? 'Published Successfully' : 'Approved & Scheduled for Distribution'}
                      </p>
                      <p className="text-xs text-emerald-700 mt-0.5 leading-relaxed">
                        {isPublished
                          ? 'This content has been published to your selected platform.'
                          : 'This content has been approved by compliance and is scheduled to be automatically distributed.'}
                      </p>
                    </div>
                  </div>

                  {!isPublished && (
                    <>
                      <div className="border-t border-emerald-200 pt-3 space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Platform</span>
                          <span className="inline-flex items-center gap-1.5 font-medium text-slate-700">
                            <selPlatformInfo.Icon className="h-3.5 w-3.5" aria-hidden="true" />
                            {selPlatformInfo.label}
                          </span>
                        </div>
                        {selectedItem.scheduledFor && (
                          <div className="flex items-center justify-between">
                            <span className="text-slate-500">Scheduled</span>
                            <span className="font-medium text-slate-700">
                              {new Date(selectedItem.scheduledFor).toLocaleString('en-US', {
                                month: 'short', day: 'numeric', year: 'numeric',
                                hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
                              })}
                            </span>
                          </div>
                        )}
                        <div className="flex items-center justify-between">
                          <span className="text-slate-500">Status</span>
                          <span className="inline-flex items-center gap-1 text-emerald-700 font-medium">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                            Queued for auto-publish
                          </span>
                        </div>
                      </div>
                      <p className="mt-3 text-xs text-slate-500">
                        Will be posted to {selPlatformInfo.label.toLowerCase()} automatically
                      </p>
                      <div className="mt-3 flex items-center gap-4 text-sm">
                        <button className="text-sky-600 hover:text-sky-700 font-medium focus:outline-none focus-visible:underline">
                          Reschedule
                        </button>
                        <button className="text-slate-500 hover:text-slate-700 focus:outline-none focus-visible:underline">
                          Cancel Distribution
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Actions footer */}
              <div className="mt-auto pt-2 space-y-3">
                {isActionable && (
                  <>
                    <Button
                      className="w-full bg-green-500 hover:bg-green-600 text-white rounded-md text-sm font-medium"
                      onClick={() => navigate('/content-drafts')}
                    >
                      <Edit3 className="mr-2 h-4 w-4" aria-hidden="true" />
                      Edit &amp; Resubmit
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-red-200 text-red-600 bg-red-50/50 hover:bg-red-50 rounded-md text-sm font-medium"
                    >
                      <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                      Withdraw Submission
                    </Button>
                    <Button
                      variant="outline"
                      className="w-full border-gray-200 text-gray-700 hover:bg-gray-50 rounded-md text-sm font-medium"
                      onClick={() => navigate('/content-drafts')}
                    >
                      <Clock className="mr-2 h-4 w-4" aria-hidden="true" />
                      View Original Prompt
                    </Button>
                  </>
                )}

                {isPending && (
                  <div className="flex items-center gap-2 rounded-md border border-amber-100 bg-amber-50 px-3 py-2.5">
                    <Clock className="h-4 w-4 flex-shrink-0 text-amber-600" aria-hidden="true" />
                    <p className="text-sm text-amber-700">Awaiting compliance review</p>
                  </div>
                )}
              </div>
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <EmptyState
                title="Select an item"
                description="Click a row in the list to view its details here."
              />
            </div>
          )}
        </article>
      </div>
    </div>
  );
}
