import { useMemo, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Plus } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { apiClient } from '../lib/api-client';
import { useApiData } from '../hooks/useApiData';

interface Draft {
  id: string;
  title: string;
  status: string;
}

interface PublishJob {
  id: string;
  draftId: string;
  channel: 'LINKEDIN' | 'FACEBOOK' | 'EMAIL' | 'AD_COPY';
  status: string;
  scheduledAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  draft?: {
    id: string;
    title: string;
  };
}

function startOfMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function statusClasses(status: string) {
  if (status === 'PUBLISHED') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'FAILED') return 'bg-red-100 text-red-700 border-red-200';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-700 border-gray-200';
  return 'bg-sky-100 text-sky-700 border-sky-200';
}

export default function PublishingCalendar() {
  const [visibleMonth, setVisibleMonth] = useState(() => startOfMonth(new Date()));
  const [selectedDraftId, setSelectedDraftId] = useState('');
  const [selectedChannel, setSelectedChannel] = useState<'LINKEDIN' | 'FACEBOOK' | 'EMAIL' | 'AD_COPY'>('LINKEDIN');
  const [scheduledDate, setScheduledDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);

  const jobs = useApiData<PublishJob[]>('/publish?page=1&limit=50', [], true, 15_000);
  const approvedDrafts = useApiData<Draft[]>('/content/drafts?status=APPROVED&page=1&limit=20');

  const jobRows = jobs.data ?? [];
  const draftRows = approvedDrafts.data ?? [];
  const monthName = visibleMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const monthJobs = useMemo(() => {
    return jobRows.filter((job) => {
      const rawDate = job.scheduledAt ?? job.publishedAt;
      if (!rawDate) return false;
      const jobDate = new Date(rawDate);
      return jobDate.getFullYear() === visibleMonth.getFullYear() && jobDate.getMonth() === visibleMonth.getMonth();
    });
  }, [jobRows, visibleMonth]);

  const days = useMemo(() => {
    const start = startOfMonth(visibleMonth);
    const firstDay = start.getDay();
    const lastDate = new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
    const cells: Array<{ day: number | null; jobs: PublishJob[] }> = [];

    for (let index = 0; index < firstDay; index += 1) {
      cells.push({ day: null, jobs: [] });
    }

    for (let day = 1; day <= lastDate; day += 1) {
      const dayJobs = monthJobs.filter((job) => {
        const rawDate = job.scheduledAt ?? job.publishedAt;
        return rawDate ? new Date(rawDate).getDate() === day : false;
      });
      cells.push({ day, jobs: dayJobs });
    }

    return cells;
  }, [monthJobs, visibleMonth]);

  const upcomingJobs = [...jobRows]
    .filter((job) => Boolean(job.scheduledAt))
    .sort((left, right) => new Date(right.scheduledAt ?? right.createdAt).getTime() - new Date(left.scheduledAt ?? left.createdAt).getTime());

  const handleSchedule = async () => {
    if (!selectedDraftId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await apiClient.post<PublishJob>('/publish', {
        draftId: selectedDraftId,
        channel: selectedChannel,
        scheduledAt: new Date(scheduledDate).toISOString(),
      });

      jobs.setData((current) => [created, ...(current ?? [])]);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to schedule post.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveJob = async () => {
    if (!editingJobId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const updated = await apiClient.patch<PublishJob>(`/publish/${editingJobId}`, {
        channel: selectedChannel,
        scheduledAt: new Date(scheduledDate).toISOString(),
      });

      jobs.setData((current) => (current ?? []).map((job) => (job.id === updated.id ? updated : job)));
      setEditingJobId(null);
      setSelectedDraftId('');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to update scheduled post.');
    } finally {
      setSubmitting(false);
    }
  };

  if (jobs.loading || approvedDrafts.loading) {
    return <LoadingState label="Loading publishing calendar..." />;
  }

  if (jobs.error) {
    return <ErrorState message={jobs.error} onRetry={() => void jobs.reload()} />;
  }

  if (approvedDrafts.error) {
    return <ErrorState message={approvedDrafts.error} onRetry={() => void approvedDrafts.reload()} />;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" className="w-9 h-9 p-0" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() - 1, 1))}>
              <ChevronLeft className="w-4 h-4" />
            </Button>
            <h1 className="text-2xl font-semibold text-[#1E3A5F] min-w-[220px]">{monthName}</h1>
            <Button variant="outline" size="sm" className="w-9 h-9 p-0" onClick={() => setVisibleMonth(new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1))}>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </div>
          <Button variant="outline" size="sm" onClick={() => setVisibleMonth(startOfMonth(new Date()))}>Today</Button>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-6">
        <div className="space-y-6">
          <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="grid grid-cols-7 bg-gray-50">
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                <div key={day} className="py-3 text-center text-sm font-semibold text-gray-700 border-b border-gray-200">{day}</div>
              ))}
            </div>
            <div className="grid grid-cols-7">
              {days.map((cell, index) => (
                <div key={`${cell.day ?? 'empty'}-${index}`} className="min-h-32 border border-gray-200 bg-white p-2 align-top">
                  {cell.day ? (
                    <>
                      <div className="text-sm font-medium text-[#1E3A5F] mb-2">{cell.day}</div>
                      <div className="space-y-1">
                        {cell.jobs.length === 0 ? <div className="text-xs text-gray-400">No scheduled posts</div> : null}
                        {cell.jobs.map((job) => (
                          <div
                            key={job.id}
                            className={`rounded border px-2 py-1 text-xs ${statusClasses(job.status)} ${job.status !== 'PUBLISHED' && job.status !== 'CANCELLED' ? 'cursor-pointer hover:opacity-80' : ''}`}
                            onClick={() => {
                              if (job.status !== 'PUBLISHED' && job.status !== 'CANCELLED') {
                                setEditingJobId(job.id);
                                setSelectedDraftId(job.draftId);
                                setSelectedChannel(job.channel);
                                setScheduledDate(new Date(job.scheduledAt ?? job.createdAt).toISOString().slice(0, 16));
                                document.getElementById('schedule-form')?.scrollIntoView({ behavior: 'smooth' });
                              }
                            }}
                          >
                            <div className="font-medium">{job.channel.replace('_', ' ')}</div>
                            <div className="truncate">{job.draft?.title ?? 'Untitled draft'}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card id="schedule-form" className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Plus className="w-4 h-4 text-[#0EA5E9]" />
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Schedule Approved Content</h3>
            </div>
            {editingJobId ? (
              <p className="mb-4 text-sm text-sky-700">Editing scheduled post. Saving will reschedule the existing post.</p>
            ) : null}

            {draftRows.length === 0 ? (
              <EmptyState
                title="No approved drafts available"
                description="A draft must be approved before it can be scheduled for publishing."
              />
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-[#1E3A5F]">Approved draft</span>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={selectedDraftId}
                    onChange={(event) => setSelectedDraftId(event.target.value)}
                  >
                    <option value="">Select a draft</option>
                    {draftRows.map((draft) => (
                      <option key={draft.id} value={draft.id}>{draft.title}</option>
                    ))}
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-[#1E3A5F]">Channel</span>
                  <select
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
                    value={selectedChannel}
                    onChange={(event) => setSelectedChannel(event.target.value as typeof selectedChannel)}
                  >
                    <option value="LINKEDIN">LinkedIn</option>
                    <option value="FACEBOOK">Facebook</option>
                    <option value="EMAIL">Email</option>
                    <option value="AD_COPY">Ad Copy</option>
                  </select>
                </label>

                <label className="block text-sm">
                  <span className="mb-2 block font-medium text-[#1E3A5F]">Scheduled time</span>
                  <Input type="datetime-local" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} />
                </label>
              </div>
            )}

            {submitError ? <p className="mt-4 text-sm text-red-600">{submitError}</p> : null}

            <div className="mt-4 flex justify-end">
              <Button
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                onClick={() => void (editingJobId ? handleSaveJob() : handleSchedule())}
                disabled={submitting || !selectedDraftId}
              >
                {submitting ? (editingJobId ? 'Saving...' : 'Scheduling...') : (editingJobId ? 'Save Changes' : 'Schedule Post')}
              </Button>
            </div>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <Clock3 className="w-4 h-4 text-gray-500" />
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Upcoming Posts</h3>
            </div>

            {upcomingJobs.length === 0 ? (
              <EmptyState
                title="Nothing scheduled"
                description="Scheduled posts will appear here as soon as approved content is queued."
              />
            ) : (
              <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
                {upcomingJobs.map((job) => (
                  <div key={job.id} className="rounded-lg border border-gray-200 p-4">
                    <p className="text-sm font-semibold text-[#1E3A5F]">{job.draft?.title ?? 'Untitled draft'}</p>
                    <p className="text-xs text-gray-500 mt-1">{job.channel.replace('_', ' ')}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(job.scheduledAt ?? job.createdAt).toLocaleString()}</p>
                    {job.status === 'QUEUED' ? (
                      <div className="mt-3 flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setEditingJobId(job.id);
                            setSelectedDraftId(job.draftId);
                            setSelectedChannel(job.channel);
                            setScheduledDate(new Date(job.scheduledAt ?? job.createdAt).toISOString().slice(0, 16));
                          }}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => void apiClient.del(`/publish/${job.id}`).then(() => jobs.reload())}
                        >
                          Cancel
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <CalendarDays className="w-4 h-4 text-gray-500" />
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Publishing Snapshot</h3>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Approved Drafts</p>
                <p className="text-2xl font-semibold text-[#1E3A5F] mt-1">{draftRows.length}</p>
              </div>
              <div className="rounded-lg bg-gray-50 p-4">
                <p className="text-xs text-gray-500">Scheduled Posts</p>
                <p className="text-2xl font-semibold text-[#1E3A5F] mt-1">{jobRows.length}</p>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
