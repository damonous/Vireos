import { useEffect, useMemo, useState } from 'react';
import { Check, Edit3, Facebook, Linkedin, Mail, Search, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { Toast } from '../components/ui/toast';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api-client';
import { PageShell } from '../components/page-shell';

interface DraftReview {
  id: string;
  title: string;
  status: string;
  creatorId: string;
  reviewerId: string | null;
  reviewNotes: string | null;
  originalPrompt: string;
  linkedinContent: string | null;
  facebookContent: string | null;
  emailContent: string | null;
  adCopyContent: string | null;
  createdAt: string;
  updatedAt: string;
}

interface OrganizationResponse {
  id: string;
  prohibitedTerms: string[];
  requiredDisclosures?: Record<string, unknown> | string[] | null;
}

interface Member {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

interface MemberResponse {
  items: Member[];
}

type PlatformFilter = 'all' | 'linkedin' | 'facebook' | 'email' | 'ad-copy';
type ActivePane = 'content' | 'notes';

const platformIcons = {
  linkedin: Linkedin,
  facebook: Facebook,
  email: Mail,
  'ad-copy': Edit3,
} as const;

function getDraftPlatforms(draft: DraftReview): PlatformFilter[] {
  const platforms: PlatformFilter[] = [];
  if (draft.linkedinContent) platforms.push('linkedin');
  if (draft.facebookContent) platforms.push('facebook');
  if (draft.emailContent) platforms.push('email');
  if (draft.adCopyContent) platforms.push('ad-copy');
  return platforms;
}

function getPrimaryPlatform(draft: DraftReview): PlatformFilter {
  return getDraftPlatforms(draft)[0] ?? 'email';
}

function getContentByPlatform(draft: DraftReview, platform: PlatformFilter): string {
  switch (platform) {
    case 'linkedin':
      return draft.linkedinContent ?? '';
    case 'facebook':
      return draft.facebookContent ?? '';
    case 'email':
      return draft.emailContent ?? '';
    case 'ad-copy':
      return draft.adCopyContent ?? '';
    default:
      return '';
  }
}

function buildEditPayload(platform: PlatformFilter, value: string): Record<string, string> {
  switch (platform) {
    case 'linkedin':
      return { linkedinContent: value };
    case 'facebook':
      return { facebookContent: value };
    case 'email':
      return { emailContent: value };
    case 'ad-copy':
      return { adCopyContent: value };
    default:
      return {};
  }
}

function renderHighlightedText(text: string, prohibitedTerms: string[]) {
  if (!text) {
    return <span className="text-gray-400">No content stored for this channel.</span>;
  }

  if (prohibitedTerms.length === 0) {
    return <span>{text}</span>;
  }

  const escapedTerms = prohibitedTerms
    .map((term) => term.trim())
    .filter(Boolean)
    .map((term) => term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));

  if (escapedTerms.length === 0) {
    return <span>{text}</span>;
  }

  const regex = new RegExp(`(${escapedTerms.join('|')})`, 'gi');
  const parts = text.split(regex);

  return (
    <>
      {parts.map((part, index) => {
        const flagged = prohibitedTerms.some((term) => term.toLowerCase() === part.toLowerCase());
        return flagged ? (
          <mark key={`${part}-${index}`} className="rounded bg-red-100 px-1 text-red-800">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </>
  );
}

export default function ContentReview() {
  const { user } = useAuth();
  const reviews = useApiData<DraftReview[]>('/reviews?page=1&limit=100');
  const organization = useApiData<OrganizationResponse>(
    user?.orgId ? `/organizations/${user.orgId}` : '/organizations/unknown',
    [user?.orgId],
    Boolean(user?.orgId)
  );
  const members = useApiData<MemberResponse>(
    user?.orgId ? `/organizations/${user.orgId}/members?page=1&limit=100` : '/organizations/unknown/members?page=1&limit=100',
    [user?.orgId],
    Boolean(user?.orgId)
  );

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useApiData<DraftReview>(`/reviews/${selectedId ?? ''}`, [selectedId], Boolean(selectedId));
  const [platformFilter, setPlatformFilter] = useState<PlatformFilter>('all');
  const [search, setSearch] = useState('');
  const [activePane, setActivePane] = useState<ActivePane>('content');
  const [selectedPlatform, setSelectedPlatform] = useState<PlatformFilter>('linkedin');
  const [editedContent, setEditedContent] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const firstId = reviews.data?.[0]?.id ?? null;
    setSelectedId((current) => current ?? firstId);
  }, [reviews.data]);

  useEffect(() => {
    const current = detail.data;
    if (!current) {
      return;
    }
    const nextPlatform = getPrimaryPlatform(current);
    setSelectedPlatform(nextPlatform);
    setEditedContent(getContentByPlatform(current, nextPlatform));
    setReviewNotes(current.reviewNotes ?? '');
  }, [detail.data]);

  const filteredReviews = useMemo(() => {
    const rows = reviews.data ?? [];
    return rows.filter((draft) => {
      const channels = getDraftPlatforms(draft);
      const matchesPlatform = platformFilter === 'all' || channels.includes(platformFilter);
      const normalizedSearch = search.trim().toLowerCase();
      const matchesSearch =
        normalizedSearch.length === 0 ||
        draft.title.toLowerCase().includes(normalizedSearch) ||
        draft.originalPrompt.toLowerCase().includes(normalizedSearch) ||
        draft.id.toLowerCase().includes(normalizedSearch);

      return matchesPlatform && matchesSearch;
    });
  }, [platformFilter, reviews.data, search]);

  const selectedDraft = detail.data ?? reviews.data?.find((draft) => draft.id === selectedId) ?? null;
  const prohibitedTerms = organization.data?.prohibitedTerms ?? [];
  const memberMap = useMemo(
    () =>
      new Map((members.data?.items ?? []).map((member) => [
        member.id,
        `${member.firstName} ${member.lastName}`.trim() || member.email,
      ])),
    [members.data]
  );

  const disclosureRows = useMemo(() => {
    const raw = organization.data?.requiredDisclosures;
    if (Array.isArray(raw)) {
      return raw.map(String).filter(Boolean);
    }
    if (raw && typeof raw === 'object') {
      return Object.values(raw).map(String).filter(Boolean);
    }
    return [];
  }, [organization.data?.requiredDisclosures]);

  const currentPlatforms = selectedDraft ? getDraftPlatforms(selectedDraft) : [];
  const currentContent = selectedDraft ? getContentByPlatform(selectedDraft, selectedPlatform) : '';

  useEffect(() => {
    if (!selectedDraft) {
      return;
    }
    if (!currentPlatforms.includes(selectedPlatform)) {
      const fallback = getPrimaryPlatform(selectedDraft);
      setSelectedPlatform(fallback);
      setEditedContent(getContentByPlatform(selectedDraft, fallback));
      return;
    }
    setEditedContent(currentContent);
  }, [currentContent, currentPlatforms, selectedDraft, selectedPlatform]);

  if (reviews.loading || organization.loading || members.loading) {
    return <LoadingState label="Loading review queue..." />;
  }

  if (reviews.error || organization.error || members.error) {
    return (
      <ErrorState
        message={reviews.error || organization.error || members.error || 'Failed to load review data.'}
        onRetry={() => {
          void reviews.reload();
          void organization.reload();
          void members.reload();
          if (selectedId) {
            void detail.reload();
          }
        }}
      />
    );
  }

  const handleSaveEdits = async () => {
    if (!selectedDraft) {
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.patch(`/reviews/${selectedDraft.id}/edit`, buildEditPayload(selectedPlatform, editedContent));
      await Promise.all([reviews.reload(), detail.reload()]);
      setToastMessage('Draft content updated.');
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Failed to save draft edits.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (action: 'approve' | 'reject' | 'request-changes') => {
    if (!selectedDraft) {
      return;
    }

    const body =
      action === 'approve'
        ? undefined
        : action === 'reject'
          ? { reason: reviewNotes.trim() }
          : { notes: reviewNotes.trim() };

    setSubmitting(true);
    try {
      await apiClient.patch(`/reviews/${selectedDraft.id}/${action}`, body);
      await Promise.all([reviews.reload(), detail.reload()]);
      setToastMessage(
        action === 'approve'
          ? 'Draft approved.'
          : action === 'reject'
            ? 'Draft rejected.'
            : 'Changes requested from advisor.'
      );
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Review action failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <PageShell
      title="Content Review"
      subtitle="Review, approve, or reject content submitted for compliance"
      actions={
        <div className="flex items-center gap-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search title, prompt, or draft ID"
              className="h-10 rounded-lg border border-gray-300 bg-white pl-10 pr-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
            />
          </div>
          <select
            value={platformFilter}
            onChange={(event) => setPlatformFilter(event.target.value as PlatformFilter)}
            className="h-10 rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="all">All Channels</option>
            <option value="linkedin">LinkedIn</option>
            <option value="facebook">Facebook</option>
            <option value="email">Email</option>
            <option value="ad-copy">Ad Copy</option>
          </select>
        </div>
      }
    >
      {filteredReviews.length === 0 ? (
        <Card className="border border-gray-200 p-10 shadow-sm">
          <EmptyState
            title="No matching review items"
            description="Submitted drafts will appear here once advisors send them to compliance."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.15fr_1.85fr]">
          <Card className="overflow-hidden border border-gray-200 shadow-sm">
            <div className="border-b border-gray-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-[#1E3A5F]">Queue</h2>
              <p className="mt-1 text-sm text-gray-500">{filteredReviews.length} live drafts require review visibility.</p>
            </div>
            <div className="max-h-[760px] overflow-y-auto">
              {filteredReviews.map((draft) => {
                const platforms = getDraftPlatforms(draft);
                const active = selectedId === draft.id;
                return (
                  <button
                    key={draft.id}
                    onClick={() => setSelectedId(draft.id)}
                    className={`w-full border-b border-gray-100 px-6 py-4 text-left transition-colors ${active ? 'bg-sky-50' : 'bg-white hover:bg-gray-50'}`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[#1E3A5F]">{draft.title}</p>
                        <p className="mt-1 text-xs text-gray-500">
                          {memberMap.get(draft.creatorId) ?? draft.creatorId} · {new Date(draft.updatedAt).toLocaleString()}
                        </p>
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          {platforms.map((platform) => {
                            const Icon = platformIcons[platform];
                            return (
                              <span key={`${draft.id}-${platform}`} className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs text-gray-700">
                                <Icon className="h-3.5 w-3.5" />
                                {platform}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">
                        {draft.status.replace(/_/g, ' ')}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </Card>

          <div className="space-y-6">
            {selectedDraft ? (
              <>
                <Card className="border border-gray-200 shadow-sm">
                  <div className="border-b border-gray-200 px-6 py-4">
                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-semibold text-[#1E3A5F]">{selectedDraft.title}</h2>
                        <p className="mt-1 text-sm text-gray-500">
                          Created by {memberMap.get(selectedDraft.creatorId) ?? selectedDraft.creatorId}
                          {selectedDraft.reviewerId ? ` · reviewer ${memberMap.get(selectedDraft.reviewerId) ?? selectedDraft.reviewerId}` : ''}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {currentPlatforms.map((platform) => {
                          const Icon = platformIcons[platform];
                          return (
                            <button
                              key={platform}
                              onClick={() => setSelectedPlatform(platform)}
                              className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm ${
                                selectedPlatform === platform
                                  ? 'border-[#0EA5E9] bg-sky-50 text-[#0EA5E9]'
                                  : 'border-gray-200 bg-white text-gray-600'
                              }`}
                            >
                              <Icon className="h-4 w-4" />
                              {platform}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  <div className="px-6 py-4">
                    <div className="mb-4 flex gap-2">
                      <button
                        onClick={() => setActivePane('content')}
                        className={`rounded-full px-3 py-1.5 text-sm ${activePane === 'content' ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        Review Content
                      </button>
                      <button
                        onClick={() => setActivePane('notes')}
                        className={`rounded-full px-3 py-1.5 text-sm ${activePane === 'notes' ? 'bg-[#1E3A5F] text-white' : 'bg-gray-100 text-gray-600'}`}
                      >
                        Reviewer Notes
                      </button>
                    </div>

                    {activePane === 'content' ? (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Original Prompt</p>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{selectedDraft.originalPrompt}</p>
                        </div>
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <div className="flex items-center justify-between gap-4">
                            <p className="text-sm font-semibold text-[#1E3A5F]">Channel Copy</p>
                            <Button variant="outline" onClick={() => void handleSaveEdits()} disabled={submitting}>
                              Save Reviewer Edit
                            </Button>
                          </div>
                          <textarea
                            value={editedContent}
                            onChange={(event) => setEditedContent(event.target.value)}
                            className="mt-4 min-h-[220px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                          />
                          <div className="mt-4 rounded-lg border border-red-100 bg-red-50 p-4">
                            <p className="text-sm font-semibold text-red-800">Compliance scan against stored prohibited terms</p>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-gray-700">
                              {renderHighlightedText(editedContent, prohibitedTerms)}
                            </p>
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <p className="text-sm font-semibold text-[#1E3A5F]">Required disclosures on record</p>
                          {disclosureRows.length === 0 ? (
                            <p className="mt-2 text-sm text-gray-500">No disclosures are currently stored for this organization.</p>
                          ) : (
                            <ul className="mt-3 space-y-2 text-sm text-gray-700">
                              {disclosureRows.map((disclosure, index) => (
                                <li key={`${disclosure}-${index}`} className="rounded-lg bg-gray-50 px-3 py-2">
                                  {disclosure}
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>

                        <div className="rounded-xl border border-gray-200 bg-white p-4">
                          <label className="text-sm font-semibold text-[#1E3A5F]">Review notes</label>
                          <textarea
                            value={reviewNotes}
                            onChange={(event) => setReviewNotes(event.target.value)}
                            className="mt-3 min-h-[180px] w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                            placeholder="Record the exact compliance guidance for this draft."
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </Card>

                <Card className="border border-gray-200 shadow-sm">
                  <div className="flex flex-wrap items-center justify-between gap-4 px-6 py-4">
                    <div>
                      <h3 className="text-lg font-semibold text-[#1E3A5F]">Decision</h3>
                      <p className="mt-1 text-sm text-gray-500">Use the real review workflow endpoints. Reject and request-changes require notes.</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      <Button className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={submitting} onClick={() => void handleAction('approve')}>
                        <Check className="mr-2 h-4 w-4" />
                        Approve
                      </Button>
                      <Button className="bg-amber-500 text-white hover:bg-amber-600" disabled={submitting || reviewNotes.trim().length === 0} onClick={() => void handleAction('request-changes')}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        Request Changes
                      </Button>
                      <Button className="bg-rose-600 text-white hover:bg-rose-700" disabled={submitting || reviewNotes.trim().length === 0} onClick={() => void handleAction('reject')}>
                        <X className="mr-2 h-4 w-4" />
                        Reject
                      </Button>
                    </div>
                  </div>
                </Card>
              </>
            ) : (
              <Card className="border border-gray-200 p-10 shadow-sm">
                <EmptyState title="Select a draft" description="Choose a review item from the queue to inspect live content and take action." />
              </Card>
            )}
          </div>
        </div>
      )}

      {toastMessage ? <Toast type="success" message={toastMessage} onClose={() => setToastMessage(null)} /> : null}
    </PageShell>
  );
}
