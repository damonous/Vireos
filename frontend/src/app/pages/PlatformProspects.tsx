import { useMemo, useState } from 'react';
import { FileUp, Search } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { Input } from '../components/ui/input';
import { apiClient } from '../lib/api-client';
import { useApiData } from '../hooks/useApiData';

interface ProspectRequest {
  id: string;
  organizationId: string;
  status: 'PENDING' | 'PROCESSING' | 'FULFILLED' | 'CANCELLED';
  requestedCount: number;
  fulfilledCount: number;
  creditCost: number;
  createdAt: string;
  notes?: string | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
  };
}

interface ProspectPreview {
  leads: Array<{
    firstName: string;
    lastName: string;
    email: string;
    linkedinUrl?: string | null;
    company?: string | null;
  }>;
  creditCost: number;
  fulfilledCount: number;
}

function displayStatus(status: ProspectRequest['status']): string {
  if (status === 'PROCESSING') return 'Ready for Review';
  return status.replace('_', ' ');
}

export default function PlatformProspects() {
  const requests = useApiData<ProspectRequest[]>('/admin/prospect-requests?page=1&limit=50');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [search, setSearch] = useState('');
  const rows = requests.data ?? [];
  const selectedRow = rows.find((row) => row.id === selectedId) ?? null;
  const preview = useApiData<ProspectPreview>(
    selectedId ? `/admin/prospect-requests/${selectedId}/preview` : '/admin/prospect-requests/missing/preview',
    [selectedId, selectedRow?.status],
    Boolean(selectedId && selectedRow?.status === 'PROCESSING')
  );

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        `${row.organization?.name ?? ''} ${row.notes ?? ''} ${row.id}`.toLowerCase().includes(search.toLowerCase())
      ),
    [rows, search]
  );
  const selectedRequest = filteredRows.find((row) => row.id === selectedId) ?? selectedRow;

  const handleUpload = async (file: File | null) => {
    if (!selectedRequest || !file) return;
    setUploading(true);
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      await apiClient.upload(`/admin/prospect-requests/${selectedRequest.id}/upload`, formData);
      await requests.reload();
      await preview.reload();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to upload CSV.');
    } finally {
      setUploading(false);
    }
  };

  const handleConfirm = async () => {
    if (!selectedRequest) return;
    setConfirming(true);
    setUploadError(null);
    try {
      await apiClient.post(`/admin/prospect-requests/${selectedRequest.id}/confirm`);
      await requests.reload();
      await preview.reload();
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : 'Failed to confirm import.');
    } finally {
      setConfirming(false);
    }
  };

  if (requests.loading) {
    return <LoadingState label="Loading prospect fulfillment queue..." />;
  }

  if (requests.error) {
    return <ErrorState message={requests.error} onRetry={() => void requests.reload()} />;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.2fr)_420px]">
        <Card className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <div className="flex items-center gap-3">
              <Search className="h-4 w-4 text-gray-500" />
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search requests by organization, note, or request id" />
            </div>
          </div>
          {filteredRows.length === 0 ? (
            <div className="p-10">
              <EmptyState title="No prospect requests found" description="Advisor and admin requests will appear here once submitted." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Requested</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Credits</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">Created</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 bg-white">
                  {filteredRows.map((row) => (
                    <tr
                      key={row.id}
                      className={`cursor-pointer hover:bg-gray-50 ${selectedId === row.id ? 'bg-sky-50' : ''}`}
                      onClick={() => setSelectedId(row.id)}
                    >
                      <td className="px-6 py-4">
                        <p className="font-medium text-[#1E3A5F]">{row.organization?.name ?? row.organizationId}</p>
                        <p className="text-xs text-gray-500">{row.id}</p>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-700">{row.requestedCount}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{displayStatus(row.status)}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{row.creditCost}</td>
                      <td className="px-6 py-4 text-sm text-gray-700">{new Date(row.createdAt).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="rounded-lg border border-gray-200 shadow-sm">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Fulfillment Review</h2>
            <p className="mt-1 text-sm text-gray-500">Upload CSVs and confirm imports after review.</p>
          </div>
          <div className="p-6 space-y-4">
            {!selectedRequest ? (
              <EmptyState title="No request selected" description="Select a request to upload or review its CSV fulfillment." />
            ) : (
              <>
                <div className="rounded-lg bg-gray-50 p-4">
                  <p className="text-xs uppercase tracking-wide text-gray-500">Selected Request</p>
                  <p className="mt-1 font-semibold text-[#1E3A5F]">{selectedRequest.organization?.name ?? selectedRequest.organizationId}</p>
                  <p className="mt-1 text-sm text-gray-600">{selectedRequest.requestedCount} requested leads</p>
                  <p className="mt-1 text-sm text-gray-600">Status: {displayStatus(selectedRequest.status)}</p>
                </div>

                <label className="block rounded-lg border border-dashed border-gray-300 bg-white p-4 text-sm">
                  <span className="mb-3 block font-medium text-[#1E3A5F]">Upload fulfillment CSV</span>
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    className="block w-full text-sm"
                    onChange={(event) => void handleUpload(event.target.files?.[0] ?? null)}
                    disabled={uploading}
                  />
                  <p className="mt-2 text-xs text-gray-500">CSV upload validates the file and moves the request into the review-ready state.</p>
                </label>

                {uploadError ? <p className="text-sm text-red-600">{uploadError}</p> : null}

                {selectedRequest.status === 'PROCESSING' && preview.data ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Preview Rows</p>
                        <p className="mt-1 font-semibold text-[#1E3A5F]">{preview.data.fulfilledCount}</p>
                      </div>
                      <div className="rounded-lg bg-gray-50 p-3">
                        <p className="text-xs text-gray-500">Credit Cost</p>
                        <p className="mt-1 font-semibold text-[#1E3A5F]">{preview.data.creditCost}</p>
                      </div>
                    </div>
                    <div className="rounded-lg border border-gray-200">
                      <div className="border-b border-gray-200 px-4 py-3 text-sm font-medium text-[#1E3A5F]">Preview Leads</div>
                      <div className="max-h-80 overflow-auto divide-y divide-gray-200">
                        {preview.data.leads.slice(0, 10).map((lead, index) => (
                          <div key={`${lead.email}-${index}`} className="px-4 py-3 text-sm">
                            <p className="font-medium text-[#1E3A5F]">{lead.firstName} {lead.lastName}</p>
                            <p className="text-gray-600">{lead.email}</p>
                            <p className="text-xs text-gray-500">{lead.company ?? 'No company'}{lead.linkedinUrl ? ' • LinkedIn verified' : ''}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                    <Button
                      className="w-full bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
                      onClick={() => void handleConfirm()}
                      disabled={confirming}
                    >
                      <FileUp className="mr-2 h-4 w-4" />
                      {confirming ? 'Confirming...' : 'Confirm Import'}
                    </Button>
                  </div>
                ) : selectedRequest.status === 'PROCESSING' && preview.loading ? (
                  <LoadingState label="Loading CSV preview..." />
                ) : (
                  <p className="text-sm text-gray-500">Upload a CSV to preview the parsed leads and confirm the import.</p>
                )}
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
