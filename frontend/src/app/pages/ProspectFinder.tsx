import { useState } from 'react';
import { Search, UploadCloud } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Checkbox } from '../components/ui/checkbox';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { apiClient } from '../lib/api-client';
import { useApiData } from '../hooks/useApiData';

interface ProspectRequest {
  id: string;
  status: 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'CANCELLED';
  requestedCount: number;
  fulfilledCount: number;
  creditCost: number;
  notes?: string | null;
  criteria: {
    geography?: string;
    employer?: string;
    industry?: string;
    occupation?: string;
    linkedinRequired?: boolean;
    emailValidated?: boolean;
    netWorthRange?: {
      min?: number;
      max?: number;
    };
  };
  createdAt: string;
}

function criteriaSummary(criteria: ProspectRequest['criteria']) {
  return [
    criteria.geography,
    criteria.industry,
    criteria.occupation,
    criteria.employer,
    criteria.linkedinRequired ? 'LinkedIn required' : null,
    criteria.emailValidated ? 'Validated email only' : null,
  ].filter(Boolean).join(' • ');
}

function statusClasses(status: ProspectRequest['status']) {
  if (status === 'FULFILLED') return 'bg-green-100 text-green-700 border-green-200';
  if (status === 'PROCESSING') return 'bg-sky-100 text-sky-700 border-sky-200';
  if (status === 'CANCELLED') return 'bg-gray-100 text-gray-700 border-gray-200';
  return 'bg-amber-100 text-amber-700 border-amber-200';
}

export default function ProspectFinder() {
  const requests = useApiData<ProspectRequest[]>('/prospects/requests?page=1&limit=20');
  const [geography, setGeography] = useState('');
  const [occupation, setOccupation] = useState('');
  const [industry, setIndustry] = useState('');
  const [employer, setEmployer] = useState('');
  const [requestedCount, setRequestedCount] = useState('100');
  const [linkedinRequired, setLinkedinRequired] = useState(true);
  const [emailValidated, setEmailValidated] = useState(true);
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const rows = requests.data ?? [];

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await apiClient.post<ProspectRequest>('/prospects/requests', {
        requestedCount: Number(requestedCount),
        notes: notes.trim() || undefined,
        criteria: {
          geography: geography.trim() || undefined,
          occupation: occupation.trim() || undefined,
          industry: industry.trim() || undefined,
          employer: employer.trim() || undefined,
          linkedinRequired,
          emailValidated,
        },
      });

      requests.setData((current) => [created, ...(current ?? [])]);
      setNotes('');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit prospect request.');
    } finally {
      setSubmitting(false);
    }
  };

  if (requests.loading) {
    return <LoadingState label="Loading prospect requests..." />;
  }

  if (requests.error) {
    return <ErrorState message={requests.error} onRetry={() => void requests.reload()} />;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8 grid grid-cols-1 xl:grid-cols-[360px_minmax(0,1fr)] gap-6">
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 mb-6">
            <Search className="w-5 h-5 text-[#0EA5E9]" />
            <h3 className="text-lg font-semibold text-[#1E3A5F]">New Prospect Request</h3>
          </div>

          <div className="space-y-4">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[#1E3A5F]">Geography</span>
              <Input value={geography} onChange={(event) => setGeography(event.target.value)} placeholder="United States, California, etc." />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[#1E3A5F]">Occupation</span>
              <Input value={occupation} onChange={(event) => setOccupation(event.target.value)} placeholder="CEO, CFO, Founder..." />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[#1E3A5F]">Industry</span>
              <Input value={industry} onChange={(event) => setIndustry(event.target.value)} placeholder="Financial services, healthcare..." />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[#1E3A5F]">Employer</span>
              <Input value={employer} onChange={(event) => setEmployer(event.target.value)} placeholder="Optional employer/company filter" />
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[#1E3A5F]">Requested count</span>
              <Input type="number" min="1" max="10000" value={requestedCount} onChange={(event) => setRequestedCount(event.target.value)} />
            </label>

            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
              <Checkbox checked={linkedinRequired} onCheckedChange={(value) => setLinkedinRequired(Boolean(value))} />
              <span className="text-sm text-gray-700">Require LinkedIn profile</span>
            </label>

            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
              <Checkbox checked={emailValidated} onCheckedChange={(value) => setEmailValidated(Boolean(value))} />
              <span className="text-sm text-gray-700">Only include validated email addresses</span>
            </label>

            <label className="block text-sm">
              <span className="mb-2 block font-medium text-[#1E3A5F]">Notes</span>
              <textarea
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional delivery instructions"
                className="min-h-[110px] w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm"
              />
            </label>

            {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

            <Button className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handleSubmit()} disabled={submitting}>
              {submitting ? 'Submitting request...' : 'Submit Request'}
            </Button>
          </div>
        </Card>

        <div className="space-y-6">
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center gap-2 mb-4">
              <UploadCloud className="w-4 h-4 text-gray-500" />
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Request Queue</h3>
            </div>

            {rows.length === 0 ? (
              <EmptyState
                title="No prospect requests yet"
                description="Submitted requests will appear here for processing and later CSV fulfillment."
              />
            ) : (
              <div className="space-y-4">
                {rows.map((request) => (
                  <div key={request.id} className="rounded-lg border border-gray-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[#1E3A5F]">{request.requestedCount} requested prospects</p>
                        <p className="text-xs text-gray-500 mt-1">{criteriaSummary(request.criteria) || 'No criteria summary provided'}</p>
                      </div>
                      <span className={`rounded-full border px-3 py-1 text-xs font-medium ${statusClasses(request.status)}`}>{request.status}</span>
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Fulfilled</p>
                        <p className="mt-1 font-semibold text-[#1E3A5F]">{request.fulfilledCount}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Credit Cost</p>
                        <p className="mt-1 font-semibold text-[#1E3A5F]">{request.creditCost}</p>
                      </div>
                    </div>
                    {request.notes ? <p className="mt-3 text-sm text-gray-600">{request.notes}</p> : null}
                    <p className="mt-3 text-xs text-gray-500">{new Date(request.createdAt).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h3 className="text-lg font-semibold text-[#1E3A5F] mb-2">How fulfillment works</h3>
            <p className="text-sm text-gray-600">
              Submitted requests enter the backend fulfillment queue. Once a CSV is uploaded and processed, the request moves through `PROCESSING` to `FULFILLED`, and imported leads become available in the CRM.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
