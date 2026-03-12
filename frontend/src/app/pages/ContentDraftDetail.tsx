import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { AlertTriangle, Archive, ArrowLeft, CheckCircle2, Save, Send } from 'lucide-react';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/tabs';
import { Textarea } from '../components/ui/textarea';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api-client';

type ChannelKey = 'linkedinContent' | 'facebookContent' | 'emailContent' | 'adCopyContent';

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

const channelConfig: Array<{ key: ChannelKey; label: string; limit: number }> = [
  { key: 'linkedinContent', label: 'LinkedIn', limit: 3000 },
  { key: 'facebookContent', label: 'Facebook', limit: 2200 },
  { key: 'emailContent', label: 'Email', limit: 6000 },
  { key: 'adCopyContent', label: 'Ad Copy', limit: 600 },
];

function getFlags(draft: Draft | null): string[] {
  const values = draft?.flagsJson?.['post_generation_flags'];
  return Array.isArray(values) ? values.map((value) => String(value)) : [];
}

export default function ContentDraftDetail() {
  const { draftId = '' } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const draft = useApiData<Draft>(draftId ? `/content/drafts/${draftId}` : '', [draftId], Boolean(draftId));
  const [activeTab, setActiveTab] = useState<ChannelKey>('linkedinContent');
  const [busyAction, setBusyAction] = useState<'save' | 'submit' | 'archive' | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoSaveState, setAutoSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const [formState, setFormState] = useState<Record<ChannelKey, string>>({
    linkedinContent: '',
    facebookContent: '',
    emailContent: '',
    adCopyContent: '',
  });

  const loadedDraft = draft.data;
  const flags = getFlags(loadedDraft ?? null);
  const canEdit = user?.role !== 'compliance-officer' || loadedDraft?.status === 'PENDING_REVIEW';
  const canSubmit = user?.role === 'advisor' || user?.role === 'admin' || user?.role === 'super-admin';
  const canArchive = user?.role === 'admin' || user?.role === 'compliance-officer' || user?.role === 'super-admin';

  useEffect(() => {
    if (!loadedDraft) return;
    setFormState({
      linkedinContent: loadedDraft.linkedinContent ?? '',
      facebookContent: loadedDraft.facebookContent ?? '',
      emailContent: loadedDraft.emailContent ?? '',
      adCopyContent: loadedDraft.adCopyContent ?? '',
    });
  }, [loadedDraft]);

  useEffect(() => {
    if (!loadedDraft || !canEdit) return;

    const unchanged =
      formState.linkedinContent === (loadedDraft.linkedinContent ?? '') &&
      formState.facebookContent === (loadedDraft.facebookContent ?? '') &&
      formState.emailContent === (loadedDraft.emailContent ?? '') &&
      formState.adCopyContent === (loadedDraft.adCopyContent ?? '');

    if (unchanged) {
      return;
    }

    const timer = window.setTimeout(async () => {
      setAutoSaveState('saving');
      try {
        await apiClient.put(`/content/drafts/${draftId}`, {
          title: loadedDraft.title,
          ...formState,
        });
        await draft.reload();
        setAutoSaveState('saved');
        window.setTimeout(() => setAutoSaveState('idle'), 1600);
      } catch {
        setAutoSaveState('error');
      }
    }, 1200);

    return () => window.clearTimeout(timer);
  }, [canEdit, draft, draftId, formState, loadedDraft]);

  if (draft.loading) return <LoadingState label="Loading draft..." />;
  if (draft.error) return <ErrorState message={draft.error} onRetry={() => void draft.reload()} />;
  if (!loadedDraft) return <EmptyState title="Draft not found" description="The requested draft could not be loaded." />;

  const handleSave = async () => {
    setBusyAction('save');
    setMessage(null);
    setError(null);
    try {
      await apiClient.put(`/content/drafts/${draftId}`, {
        title: loadedDraft.title,
        ...formState,
      });
      await draft.reload();
      setMessage('Draft saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save draft.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleSubmitForReview = async () => {
    setBusyAction('submit');
    setMessage(null);
    setError(null);
    try {
      await apiClient.patch(`/reviews/${draftId}/submit`);
      await draft.reload();
      setMessage('Draft submitted for compliance review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit for review.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleArchive = async () => {
    setBusyAction('archive');
    setMessage(null);
    setError(null);
    try {
      if (canArchive) {
        await apiClient.patch(`/content/drafts/${draftId}/archive`);
      } else {
        await apiClient.del(`/content/drafts/${draftId}`);
      }
      navigate('/content/drafts', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to archive draft.');
      setBusyAction(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between gap-4">
        <div>
          <Link to="/content/drafts" className="inline-flex items-center gap-2 text-sm text-[#0EA5E9] hover:underline mb-2">
            <ArrowLeft className="h-4 w-4" />
            Back to drafts
          </Link>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">{loadedDraft.title || 'Untitled draft'}</h1>
          <p className="text-sm text-gray-500 mt-1">Created {new Date(loadedDraft.createdAt).toLocaleString()}</p>
        </div>
        <Badge className="bg-gray-100 text-gray-700 border-0">{loadedDraft.status}</Badge>
      </div>

      <div className="p-8 space-y-6">
        <Card className="p-5 rounded-lg shadow-sm border border-gray-200">
          <p className="text-sm font-medium text-[#1E3A5F] mb-2">Original prompt</p>
          <p className="text-sm text-gray-600 leading-6">{loadedDraft.originalPrompt}</p>
        </Card>

        {flags.length > 0 ? (
          <Card className="p-5 rounded-lg shadow-sm border border-amber-200 bg-amber-50">
            <div className="flex gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-900">Stored compliance warnings</p>
                <p className="text-sm text-amber-800 mt-1">{flags.join(', ')}</p>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="p-5 rounded-lg shadow-sm border border-green-200 bg-green-50">
            <div className="flex gap-3">
              <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold text-green-900">No stored compliance flags</p>
                <p className="text-sm text-green-800 mt-1">This draft has no post-generation prohibited term flags recorded.</p>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as ChannelKey)}>
            <TabsList className="mb-6 flex flex-wrap gap-2 h-auto bg-transparent p-0">
              {channelConfig.map((channel) => (
                <TabsTrigger key={channel.key} value={channel.key} className="data-[state=active]:bg-[#0EA5E9] data-[state=active]:text-white">
                  {channel.label}
                </TabsTrigger>
              ))}
            </TabsList>

            {channelConfig.map((channel) => {
              const value = formState[channel.key];
              const overLimit = value.length > channel.limit;
              return (
                <TabsContent key={channel.key} value={channel.key} className="mt-0 space-y-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium text-[#1E3A5F]">{channel.label} content</span>
                    <div className="flex items-center gap-3">
                      <span className={overLimit ? 'text-red-600 font-medium' : 'text-gray-500'}>
                        {value.length}/{channel.limit} characters
                      </span>
                      {canEdit ? (
                        <span className={`text-xs ${
                          autoSaveState === 'saving'
                            ? 'text-sky-600'
                            : autoSaveState === 'saved'
                              ? 'text-green-600'
                              : autoSaveState === 'error'
                                ? 'text-red-600'
                                : 'text-gray-400'
                        }`}>
                          {autoSaveState === 'saving'
                            ? 'Autosaving...'
                            : autoSaveState === 'saved'
                              ? 'Autosaved'
                              : autoSaveState === 'error'
                                ? 'Autosave failed'
                                : 'Autosave enabled'}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <Textarea
                    value={value}
                    onChange={(event) => setFormState((current) => ({ ...current, [channel.key]: event.target.value }))}
                    readOnly={!canEdit}
                    className="min-h-[280px] border-gray-300 leading-6"
                  />
                </TabsContent>
              );
            })}
          </Tabs>

          {error ? <p className="mt-4 text-sm text-red-600">{error}</p> : null}
          {message ? <p className="mt-4 text-sm text-green-700">{message}</p> : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={() => void handleSave()} disabled={!canEdit || busyAction !== null} className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
              <Save className="h-4 w-4 mr-2" />
              {busyAction === 'save' ? 'Saving...' : 'Save draft'}
            </Button>
            {canSubmit ? (
              <Button onClick={() => void handleSubmitForReview()} disabled={busyAction !== null} variant="outline">
                <Send className="h-4 w-4 mr-2" />
                {busyAction === 'submit' ? 'Submitting...' : 'Submit for review'}
              </Button>
            ) : null}
            <Button onClick={() => void handleArchive()} disabled={busyAction !== null} variant="outline" className="border-red-200 text-red-700 hover:bg-red-50">
              <Archive className="h-4 w-4 mr-2" />
              {busyAction === 'archive' ? 'Archiving...' : 'Archive'}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
