import { ArrowLeft, Search, Users } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { apiClient } from '../lib/api-client';
import { useApiData } from '../hooks/useApiData';
import { EmailNav } from './email/EmailNav';

interface SequenceSummary {
  id: string;
  name: string;
}

interface LeadRow {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  status: string;
}

function fullName(lead: LeadRow) {
  return `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.email || 'Unnamed lead';
}

export default function EmailSequenceEnroll() {
  const navigate = useNavigate();
  const { sequenceId } = useParams();
  const sequence = useApiData<SequenceSummary>(sequenceId ? `/email/sequences/${sequenceId}` : '', [sequenceId], Boolean(sequenceId));
  const leads = useApiData<LeadRow[]>('/leads?page=1&limit=100');
  const [search, setSearch] = useState('');
  const [selectedLeadIds, setSelectedLeadIds] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const visibleLeads = useMemo(() => {
    const query = search.trim().toLowerCase();
    const rows = Array.isArray(leads.data) ? leads.data : [];
    if (!query) {
      return rows;
    }
    return rows.filter((lead) =>
      [lead.firstName, lead.lastName, lead.email, lead.company].join(' ').toLowerCase().includes(query)
    );
  }, [leads.data, search]);

  const toggleLead = (leadId: string) => {
    setSelectedLeadIds((current) => (current.includes(leadId) ? current.filter((id) => id !== leadId) : [...current, leadId]));
  };

  const handleEnroll = async () => {
    if (!sequenceId || selectedLeadIds.length === 0) {
      return;
    }
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.post(`/email/sequences/${sequenceId}/enroll`, { leadIds: selectedLeadIds });
      navigate(`/email/sequences/${sequenceId}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to enroll leads.');
    } finally {
      setSubmitting(false);
    }
  };

  if (sequence.loading || leads.loading) {
    return <LoadingState label="Loading enrollment manager..." />;
  }

  if (sequence.error || leads.error || !sequence.data) {
    return <ErrorState message={sequence.error || leads.error || 'Failed to load enrollment manager.'} onRetry={() => {
      void sequence.reload();
      void leads.reload();
    }} />;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <button onClick={() => navigate(`/email/sequences/${sequence.data.id}`)} className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-[#0EA5E9]">
              <ArrowLeft className="h-4 w-4" />
              Back to Sequence
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">Enroll Leads</h1>
              <p className="mt-1 text-sm text-gray-500">Select leads to add to {sequence.data.name}.</p>
            </div>
            <EmailNav />
          </div>
          <Button className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]" onClick={() => void handleEnroll()} disabled={submitting || selectedLeadIds.length === 0}>
            {submitting ? 'Enrolling...' : `Enroll ${selectedLeadIds.length} Lead${selectedLeadIds.length === 1 ? '' : 's'}`}
          </Button>
        </div>
      </div>

      <div className="p-8">
        <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
          <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="relative w-full max-w-md">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <Input className="pl-10" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search leads by name, email, or company" />
            </div>
            <div className="text-sm text-gray-500">{visibleLeads.length} leads available</div>
          </div>

          {visibleLeads.length === 0 ? (
            <EmptyState title="No leads found" description="Adjust your search or create leads before enrolling them in a sequence." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {visibleLeads.map((lead) => {
                const selected = selectedLeadIds.includes(lead.id);
                return (
                  <button
                    key={lead.id}
                    type="button"
                    onClick={() => toggleLead(lead.id)}
                    className={`rounded-lg border p-4 text-left transition-colors ${selected ? 'border-[#0EA5E9] bg-sky-50' : 'border-gray-200 bg-white hover:border-sky-200'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1E3A5F]">{fullName(lead)}</p>
                        <p className="mt-1 text-sm text-gray-500">{lead.email || 'No email address'}</p>
                        <p className="mt-1 text-xs text-gray-500">{lead.company || 'No company set'}</p>
                      </div>
                      <div className={`flex h-8 w-8 items-center justify-center rounded-full ${selected ? 'bg-[#0EA5E9] text-white' : 'bg-slate-100 text-slate-400'}`}>
                        <Users className="h-4 w-4" />
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          {submitError ? <p className="mt-4 text-sm text-red-600">{submitError}</p> : null}
        </Card>
      </div>
    </div>
  );
}
