import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { AlertTriangle, Clock3, Facebook, Info, Linkedin, Mail, Megaphone, Sparkles } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Textarea } from '../components/ui/textarea';
import { Input } from '../components/ui/input';
import { Badge } from '../components/ui/badge';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { useApiData } from '../hooks/useApiData';
import { ApiError, apiClient } from '../lib/api-client';

type Platform = 'LINKEDIN' | 'FACEBOOK' | 'EMAIL' | 'AD_COPY';

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

const platformConfig: Record<Platform, { label: string; icon: typeof Linkedin }> = {
  LINKEDIN: { label: 'LinkedIn', icon: Linkedin },
  FACEBOOK: { label: 'Facebook', icon: Facebook },
  EMAIL: { label: 'Email', icon: Mail },
  AD_COPY: { label: 'Ad Copy', icon: Megaphone },
};

function renderHighlightedText(text: string, terms: string[]) {
  if (!text || terms.length === 0) {
    return <span>{text}</span>;
  }

  const escapedTerms = terms
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
        const flagged = terms.some((term) => term.toLowerCase() === part.toLowerCase());
        return flagged ? (
          <mark key={`${part}-${index}`} className="rounded bg-red-100 px-1 text-red-800 font-medium">
            {part}
          </mark>
        ) : (
          <span key={`${part}-${index}`}>{part}</span>
        );
      })}
    </>
  );
}

function getDraftContent(draft: Draft | null, platform: Platform): string {
  if (!draft) return '';
  if (platform === 'LINKEDIN') return draft.linkedinContent ?? '';
  if (platform === 'FACEBOOK') return draft.facebookContent ?? '';
  if (platform === 'EMAIL') return draft.emailContent ?? '';
  return draft.adCopyContent ?? '';
}

export default function AIContent() {
  const drafts = useApiData<DraftListResponse>('/content/drafts?page=1&limit=8');
  const [title, setTitle] = useState('');
  const [topic, setTopic] = useState('');
  const [audience, setAudience] = useState('');
  const [talkingPoints, setTalkingPoints] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<Platform[]>(['LINKEDIN', 'FACEBOOK', 'EMAIL', 'AD_COPY']);
  const [isGenerating, setIsGenerating] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [flaggedTerms, setFlaggedTerms] = useState<string[]>([]);
  const [activePreviewTab, setActivePreviewTab] = useState<Platform>('LINKEDIN');
  const [previewDraft, setPreviewDraft] = useState<Draft | null>(null);

  const draftRows = Array.isArray(drafts.data) ? drafts.data : drafts.data?.data ?? [];
  const newestDraft = previewDraft ?? draftRows[0] ?? null;
  const previewFlaggedTerms = useMemo(() => {
    const flags = newestDraft?.flagsJson?.['post_generation_flags'];
    return Array.isArray(flags) ? flags.map((f) => String(f)) : [];
  }, [newestDraft]);
  const draftPlatforms = (Object.keys(platformConfig) as Platform[]).filter((platform) => Boolean(getDraftContent(newestDraft, platform)));
  const availablePreviewTabs = useMemo(
    () => draftPlatforms,
    [draftPlatforms]
  );
  const recentDrafts = draftRows.slice(0, 4);

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((prev) => {
      const next = prev.includes(platform) ? prev.filter((item) => item !== platform) : [...prev, platform];
      if (!next.includes(activePreviewTab)) {
        setActivePreviewTab(next[0] ?? 'LINKEDIN');
      }
      return next;
    });
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    setSubmitError(null);
    setFlaggedTerms([]);
    try {
      const prompt = [
        `Topic: ${topic.trim()}`,
        `Audience: ${audience.trim()}`,
        `Talking points: ${talkingPoints.trim()}`,
      ].join('\n');
      const created = await apiClient.post<Draft>('/content/generate', {
        title: title.trim() || undefined,
        prompt,
        channels: selectedPlatforms,
      });

      setPreviewDraft(created);
      setActivePreviewTab(selectedPlatforms[0] ?? 'LINKEDIN');
      setTopic('');
      setAudience('');
      setTalkingPoints('');
      setTitle('');
      drafts.setData((current) => {
        const existing = Array.isArray(current) ? current : current?.data ?? [];
        return [created, ...existing].slice(0, 8) as typeof current;
      });
    } catch (error) {
      // Extract flagged terms from compliance error details
      if (error instanceof ApiError && error.details) {
        const details = error.details as { flagged_terms?: string[] };
        if (Array.isArray(details.flagged_terms) && details.flagged_terms.length > 0) {
          setFlaggedTerms(details.flagged_terms);
        }
      }
      setSubmitError(error instanceof Error ? error.message : 'Failed to generate content.');
    } finally {
      setIsGenerating(false);
    }
  };

  if (drafts.loading) {
    return <LoadingState label="Loading AI content workspace..." />;
  }

  if (drafts.error) {
    return <ErrorState message={drafts.error} onRetry={() => void drafts.reload()} />;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-end">
        <div className="text-right">
          <p className="text-sm text-[#1E3A5F] font-medium">{draftRows.length}</p>
          <p className="text-xs text-gray-500">drafts in your workspace</p>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] gap-6">
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-6">
            <Sparkles className="w-5 h-5 text-[#0EA5E9]" />
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Create New Content</h3>
          </div>

          <div className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Draft title</label>
              <Input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                placeholder="Optional title for the generated draft"
                className="border-gray-300"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Topic</label>
              <Input
                placeholder="Retirement planning, tax strategy, estate planning..."
                className="border-gray-300"
                value={topic}
                onChange={(event) => setTopic(event.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Audience</label>
              <Input
                placeholder="Pre-retirees, business owners, existing clients..."
                className="border-gray-300"
                value={audience}
                onChange={(event) => setAudience(event.target.value)}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Talking points</label>
              <Textarea
                placeholder="Capture the key points, caveats, CTA, and any compliance-sensitive context."
                className="min-h-[160px] border-gray-300"
                value={talkingPoints}
                onChange={(event) => setTalkingPoints(event.target.value)}
              />
            </div>

            {flaggedTerms.length > 0 && (topic || audience || talkingPoints) ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <p className="text-sm font-semibold text-red-800 mb-2">Prohibited terms detected in your input:</p>
                <div className="space-y-2 text-sm leading-6 text-gray-700">
                  {topic ? (
                    <p><span className="font-medium text-gray-900">Topic:</span> {renderHighlightedText(topic, flaggedTerms)}</p>
                  ) : null}
                  {audience ? (
                    <p><span className="font-medium text-gray-900">Audience:</span> {renderHighlightedText(audience, flaggedTerms)}</p>
                  ) : null}
                  {talkingPoints ? (
                    <p><span className="font-medium text-gray-900">Talking points:</span> {renderHighlightedText(talkingPoints, flaggedTerms)}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div>
              <label className="block text-sm font-medium text-[#1E3A5F] mb-2">Channels</label>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(platformConfig).map(([id, config]) => {
                  const platform = id as Platform;
                  const Icon = config.icon;
                  const selected = selectedPlatforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      type="button"
                      onClick={() => togglePlatform(platform)}
                      className={`flex items-center gap-3 rounded-lg border-2 px-4 py-3 text-left transition-colors ${
                        selected ? 'border-[#0EA5E9] bg-[#0EA5E9]/5' : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <Icon className={`w-5 h-5 ${selected ? 'text-[#0EA5E9]' : 'text-gray-500'}`} />
                      <span className={`text-sm font-medium ${selected ? 'text-[#1E3A5F]' : 'text-gray-700'}`}>{config.label}</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-gray-500 mt-2">{selectedPlatforms.length} channel{selectedPlatforms.length === 1 ? '' : 's'} selected</p>
            </div>

            {submitError ? (
              <div className="rounded-lg border border-red-200 bg-red-50 p-4">
                <div className="flex gap-3">
                  <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-red-700">
                    <p>{submitError}</p>
                    {flaggedTerms.length > 0 ? (
                      <div className="mt-2">
                        <p className="font-semibold text-red-800">Flagged terms:</p>
                        <div className="mt-1 flex flex-wrap gap-2">
                          {flaggedTerms.map((term) => (
                            <span
                              key={term}
                              className="inline-block rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800 border border-red-300"
                            >
                              {term}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <Button
              className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
              onClick={() => void handleGenerate()}
              disabled={isGenerating || selectedPlatforms.length === 0 || topic.trim().length < 3 || audience.trim().length < 3 || talkingPoints.trim().length < 10}
            >
              {isGenerating ? <Sparkles className="w-4 h-4 mr-2 animate-spin" /> : <Sparkles className="w-4 h-4 mr-2" />}
              {isGenerating ? 'Generating draft...' : 'Generate Draft'}
            </Button>

            <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 flex gap-3">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-blue-900">
                <p className="font-medium mb-1">How it works</p>
                <p>Your draft will be generated using AI based on the topic, audience, and talking points you provide. If something goes wrong, an error message will appear above the button.</p>
              </div>
            </div>

            <div className="flex justify-end">
              <Link to="/content/drafts" className="text-sm text-[#0EA5E9] hover:underline">
                Browse saved drafts
              </Link>
            </div>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200 min-h-[420px]">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-lg font-semibold text-[#1E3A5F]">Preview</h3>
                <p className="text-sm text-gray-500 mt-1">
                  {newestDraft ? `Showing "${newestDraft.title}"` : 'Generate or load a draft to preview channel output.'}
                </p>
              </div>
              {newestDraft ? <Badge className="bg-[#0EA5E9]/10 text-[#0EA5E9] border-0">{newestDraft.status}</Badge> : null}
            </div>

            {newestDraft && availablePreviewTabs.length > 0 ? (
              <Tabs value={activePreviewTab} onValueChange={(value) => setActivePreviewTab(value as Platform)}>
                <TabsList className="mb-4">
                  {availablePreviewTabs.map((platform) => {
                    const Icon = platformConfig[platform].icon;
                    return (
                      <TabsTrigger key={platform} value={platform}>
                        <Icon className="w-4 h-4 mr-2" />
                        {platformConfig[platform].label}
                      </TabsTrigger>
                    );
                  })}
                </TabsList>
                {availablePreviewTabs.map((platform) => {
                  const content = getDraftContent(newestDraft, platform);
                  return (
                    <TabsContent key={platform} value={platform} className="mt-0">
                      <div className="mb-3 flex items-center justify-between text-xs text-gray-500">
                        <span>Saved channel output</span>
                        <span>{content.length} characters</span>
                      </div>
                      {previewFlaggedTerms.length > 0 ? (
                        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 p-3 flex gap-2">
                          <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div className="text-xs text-amber-800">
                            <span className="font-semibold">Compliance flags:</span>{' '}
                            {previewFlaggedTerms.join(', ')}
                          </div>
                        </div>
                      ) : null}
                      <div className="rounded-lg border border-gray-200 bg-white p-4 whitespace-pre-wrap text-sm text-gray-700 leading-6 min-h-[280px]">
                        {previewFlaggedTerms.length > 0
                          ? renderHighlightedText(content, previewFlaggedTerms)
                          : content}
                      </div>
                    </TabsContent>
                  );
                })}
              </Tabs>
            ) : (
              <EmptyState
                title="No generated content yet"
                description="Once a draft is created, each selected channel preview will appear here."
              />
            )}
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="w-4 h-4 text-gray-500" />
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Recent Drafts</h3>
            </div>

            {recentDrafts.length === 0 ? (
              <EmptyState
                title="No drafts in this workspace"
                description="Generated drafts will appear here once you create them."
              />
            ) : (
              <div className="space-y-3">
                {recentDrafts.map((draft) => (
                  <button
                    key={draft.id}
                    type="button"
                    onClick={() => {
                      setPreviewDraft(draft);
                      const firstAvailable = (Object.keys(platformConfig) as Platform[]).find((platform) => Boolean(getDraftContent(draft, platform)));
                      setActivePreviewTab(firstAvailable ?? 'LINKEDIN');
                    }}
                    className="w-full rounded-lg border border-gray-200 bg-white p-4 text-left hover:border-[#0EA5E9] transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1E3A5F]">{draft.title}</p>
                        <p className="text-xs text-gray-500 mt-1 line-clamp-2">{draft.originalPrompt}</p>
                      </div>
                      <Badge className="bg-gray-100 text-gray-700 border-0">{draft.status}</Badge>
                    </div>
                    <p className="text-xs text-gray-500 mt-3">{new Date(draft.createdAt).toLocaleString()}</p>
                  </button>
                ))}
              </div>
            )}
          </Card>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-amber-900">
              <p className="font-medium mb-1">Provider dependency</p>
              <p>OpenAI credentials are still required for successful generation. This screen now exposes that real dependency instead of mocking a successful result.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
