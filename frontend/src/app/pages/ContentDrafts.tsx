import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, ArrowRight, CheckCircle2, Clock3, FileText, Search } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { Input } from '../components/ui/input';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';

interface Draft {
  id: string;
  title: string;
  status: string;
  originalPrompt: string;
  linkedinContent?: string | null;
  facebookContent?: string | null;
  emailContent?: string | null;
  adCopyContent?: string | null;
  flagsJson?: Record<string, unknown> | null;
  createdAt: string;
}

interface DraftListResponse {
  data?: Draft[];
}

const statusOptions = ['ALL', 'DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED', 'NEEDS_CHANGES', 'ARCHIVED'] as const;

function getChannels(draft: Draft): string[] {
  const channels = [];
  if (draft.linkedinContent) channels.push('LinkedIn');
  if (draft.facebookContent) channels.push('Facebook');
  if (draft.emailContent) channels.push('Email');
  if (draft.adCopyContent) channels.push('Ad Copy');
  return channels;
}

function getFlags(draft: Draft): string[] {
  const values = draft.flagsJson?.['post_generation_flags'];
  return Array.isArray(values) ? values.map((value) => String(value)) : [];
}

export default function ContentDrafts() {
  const [status, setStatus] = useState<(typeof statusOptions)[number]>('ALL');
  const [search, setSearch] = useState('');
  const query = status === 'ALL' ? '/content/drafts?page=1&limit=50' : `/content/drafts?page=1&limit=50&status=${status}`;
  const drafts = useApiData<DraftListResponse>(query, [status]);

  const filtered = useMemo(() => {
    const rows = Array.isArray(drafts.data) ? drafts.data : drafts.data?.data ?? [];
    const needle = search.trim().toLowerCase();
    if (!needle) return rows;
    return rows.filter((draft) =>
      [draft.title, draft.originalPrompt, ...getChannels(draft)].join(' ').toLowerCase().includes(needle)
    );
  }, [drafts.data, search]);

  if (drafts.loading) return <LoadingState label="Loading content drafts..." />;
  if (drafts.error) return <ErrorState message={drafts.error} onRetry={() => void drafts.reload()} />;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Content Drafts</h1>
          <p className="text-sm text-gray-500 mt-1">Review saved drafts, status changes, and flagged compliance output.</p>
        </div>
        <Link to="/content/generate">
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">Create new draft</Button>
        </Link>
      </div>

      <div className="p-8 space-y-6">
        <Card className="p-4 rounded-lg shadow-sm border border-gray-200">
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_auto] gap-4 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input className="pl-9" placeholder="Search title, prompt, or channel" value={search} onChange={(event) => setSearch(event.target.value)} />
            </div>
            <div className="flex flex-wrap gap-2">
              {statusOptions.map((option) => (
                <button
                  key={option}
                  type="button"
                  onClick={() => setStatus(option)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
                    status === option ? 'border-[#0EA5E9] bg-[#0EA5E9] text-white' : 'border-gray-300 bg-white text-gray-700'
                  }`}
                >
                  {option.replaceAll('_', ' ')}
                </button>
              ))}
            </div>
          </div>
        </Card>

        {filtered.length === 0 ? (
          <Card className="p-10 rounded-lg shadow-sm border border-gray-200">
            <EmptyState title="No drafts matched this filter" description="Generate content or adjust the status/search filters." />
          </Card>
        ) : (
          <div className="space-y-4">
            {filtered.map((draft) => {
              const flags = getFlags(draft);
              return (
                <Card key={draft.id} className="p-5 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
                    <div className="space-y-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <h2 className="text-lg font-semibold text-[#1E3A5F]">{draft.title || 'Untitled draft'}</h2>
                        <Badge className="bg-gray-100 text-gray-700 border-0">{draft.status}</Badge>
                        <span className="inline-flex items-center gap-1 text-xs text-gray-500">
                          <Clock3 className="h-3.5 w-3.5" />
                          {new Date(draft.createdAt).toLocaleString()}
                        </span>
                      </div>

                      <p className="text-sm text-gray-600 max-w-3xl">{draft.originalPrompt}</p>

                      <div className="flex flex-wrap gap-2">
                        {getChannels(draft).map((channel) => (
                          <Badge key={channel} className="bg-[#E0F2FE] text-[#0EA5E9] border-0">{channel}</Badge>
                        ))}
                      </div>

                      {flags.length > 0 ? (
                        <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-3 text-sm text-amber-900">
                          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <div>
                            <p className="font-medium">Compliance flags detected</p>
                            <p>{flags.join(', ')}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="rounded-lg border border-green-200 bg-green-50 p-3 flex gap-3 text-sm text-green-800">
                          <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
                          <p>No stored compliance flags on this draft.</p>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-col gap-2 min-w-[180px]">
                      <Link to={`/content/drafts/${draft.id}`}>
                        <Button variant="outline" className="w-full justify-between">
                          Open draft
                          <ArrowRight className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link to="/content/generate">
                        <Button className="w-full bg-[#1E3A5F] hover:bg-[#17304e] text-white">
                          <FileText className="h-4 w-4 mr-2" />
                          New variation
                        </Button>
                      </Link>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
