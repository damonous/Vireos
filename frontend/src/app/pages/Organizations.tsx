import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { apiClient } from '../lib/api-client';

interface Organization {
  id: string;
  name: string;
  slug: string;
  isActive: boolean;
  subscriptionStatus: string;
  creditBalance: number;
  createdAt: string;
  userCount?: number;
}

interface OrganizationDetail extends Organization {
  icpType: string;
  website: string | null;
  logoUrl: string | null;
  prohibitedTerms: string[];
  requiredDisclosures?: string[] | Record<string, unknown> | null;
  complianceRules?: Record<string, unknown> | null;
  settings?: {
    timezone?: string;
    defaultContentLanguage?: string;
    workflowTerminology?: {
      reviewLabel?: string;
      approveLabel?: string;
      rejectLabel?: string;
    };
    requireComplianceReview?: boolean;
  };
}

export default function Organizations() {
  const organizations = useApiData<Organization[]>('/organizations?page=1&limit=50');
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [website, setWebsite] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [savingDetails, setSavingDetails] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailName, setDetailName] = useState('');
  const [detailWebsite, setDetailWebsite] = useState('');
  const [detailIcpType, setDetailIcpType] = useState('financial_advisor');
  const [detailProhibitedTerms, setDetailProhibitedTerms] = useState<string[]>([]);
  const [detailNewTerm, setDetailNewTerm] = useState('');
  const [detailDisclosures, setDetailDisclosures] = useState<string[]>([]);
  const [detailNewDisclosure, setDetailNewDisclosure] = useState('');
  const [reviewLabel, setReviewLabel] = useState('Review');
  const [approveLabel, setApproveLabel] = useState('Approve');
  const [rejectLabel, setRejectLabel] = useState('Reject');
  const [requireComplianceReview, setRequireComplianceReview] = useState(true);
  const [autoApproveNoFlags, setAutoApproveNoFlags] = useState(false);
  const [notifyOnFlag, setNotifyOnFlag] = useState(true);
  const selectedOrganization = useApiData<OrganizationDetail>(
    selectedOrgId ? `/organizations/${selectedOrgId}` : '/organizations/unknown',
    [selectedOrgId],
    Boolean(selectedOrgId)
  );

  const rows = organizations.data ?? [];

  useEffect(() => {
    if (!selectedOrganization.data) {
      return;
    }

    const details = selectedOrganization.data;
    const workflowTerminology = details.settings?.workflowTerminology ?? {};
    setDetailName(details.name);
    setDetailWebsite(details.website ?? '');
    setDetailIcpType(details.icpType ?? 'financial_advisor');
    setDetailProhibitedTerms(details.prohibitedTerms ?? []);
    setDetailDisclosures(
      Array.isArray(details.requiredDisclosures)
        ? details.requiredDisclosures.map(String)
        : Object.values(details.requiredDisclosures ?? {}).map(String)
    );
    setReviewLabel(workflowTerminology.reviewLabel ?? 'Review');
    setApproveLabel(workflowTerminology.approveLabel ?? 'Approve');
    setRejectLabel(workflowTerminology.rejectLabel ?? 'Reject');
    setRequireComplianceReview(Boolean(details.settings?.requireComplianceReview ?? true));
    setAutoApproveNoFlags(Boolean(details.complianceRules?.autoApproveNoFlags ?? false));
    setNotifyOnFlag(Boolean(details.complianceRules?.notifyOnFlag ?? true));
  }, [selectedOrganization.data]);

  const handleCreate = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await apiClient.post<Organization>('/organizations', {
        name,
        slug,
        website: website.trim() || undefined,
      });
      organizations.setData((current) => [created, ...(current ?? [])]);
      setShowCreate(false);
      setName('');
      setSlug('');
      setWebsite('');
      setSelectedOrgId(created.id);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create organization.');
    } finally {
      setSubmitting(false);
    }
  };

  const addDetailTerm = () => {
    const normalized = detailNewTerm.trim().toLowerCase();
    if (!normalized || detailProhibitedTerms.includes(normalized)) {
      return;
    }
    setDetailProhibitedTerms((current) => [...current, normalized]);
    setDetailNewTerm('');
  };

  const addDetailDisclosure = () => {
    const next = detailNewDisclosure.trim();
    if (!next) {
      return;
    }
    setDetailDisclosures((current) => [...current, next]);
    setDetailNewDisclosure('');
  };

  const handleSaveDetails = async () => {
    if (!selectedOrgId) {
      return;
    }

    setSavingDetails(true);
    setDetailError(null);
    try {
      const updated = await apiClient.put<OrganizationDetail>(`/organizations/${selectedOrgId}`, {
        name: detailName,
        website: detailWebsite.trim() || null,
        icpType: detailIcpType,
        prohibitedTerms: detailProhibitedTerms,
        requiredDisclosures: detailDisclosures,
        complianceRules: {
          ...(selectedOrganization.data?.complianceRules ?? {}),
          autoApproveNoFlags,
          notifyOnFlag,
        },
        settings: {
          ...(selectedOrganization.data?.settings ?? {}),
          requireComplianceReview,
          workflowTerminology: {
            reviewLabel,
            approveLabel,
            rejectLabel,
          },
        },
      });
      await selectedOrganization.reload();
      organizations.setData((current) =>
        (current ?? []).map((item) =>
          item.id === selectedOrgId ? { ...item, name: updated.name, subscriptionStatus: updated.subscriptionStatus } : item
        )
      );
    } catch (error) {
      setDetailError(error instanceof Error ? error.message : 'Failed to update organization settings.');
    } finally {
      setSavingDetails(false);
    }
  };

  if (organizations.loading) return <LoadingState label="Loading organizations..." />;
  if (organizations.error) return <ErrorState message={organizations.error} onRetry={() => void organizations.reload()} />;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Organizations</h1>
            <p className="text-sm text-gray-500 mt-1">Live platform organizations from the backend</p>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => setShowCreate((value) => !value)}>
            <Plus className="w-4 h-4 mr-2" />
            {showCreate ? 'Close' : 'Add Organization'}
          </Button>
        </div>
      </div>

      <div className="p-8 grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_380px]">
        <div className="space-y-6">
        {showCreate ? (
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Create Organization</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Organization name" />
              <Input value={slug} onChange={(event) => setSlug(event.target.value)} placeholder="slug-with-hyphens" />
              <Input value={website} onChange={(event) => setWebsite(event.target.value)} placeholder="https://example.com" className="md:col-span-2" />
            </div>
            {submitError ? <p className="mt-4 text-sm text-red-600">{submitError}</p> : null}
            <div className="mt-4 flex justify-end">
              <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handleCreate()} disabled={submitting || !name || !slug}>
                {submitting ? 'Creating...' : 'Create Organization'}
              </Button>
            </div>
          </Card>
        ) : null}

        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10">
              <EmptyState title="No organizations found" description="Create the first organization to populate this list." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Organization</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Slug</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subscription</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Credits</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Created</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((organization) => (
                    <tr
                      key={organization.id}
                      className={`cursor-pointer hover:bg-gray-50 ${selectedOrgId === organization.id ? 'bg-sky-50' : ''}`}
                      onClick={() => setSelectedOrgId(organization.id)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-[#1E3A5F]">{organization.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{organization.slug}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{organization.subscriptionStatus}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{organization.creditBalance}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{organization.isActive ? 'Active' : 'Inactive'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{new Date(organization.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        </div>

        <Card className="h-fit rounded-lg shadow-sm border border-gray-200">
          <div className="border-b border-gray-200 px-6 py-4">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Organization Details</h2>
            <p className="mt-1 text-sm text-gray-500">Select an organization to inspect its live configuration.</p>
          </div>
          <div className="p-6">
            {!selectedOrgId ? (
              <EmptyState title="No organization selected" description="Choose an organization from the table to review tenant details." />
            ) : selectedOrganization.loading ? (
              <LoadingState label="Loading organization details..." />
            ) : selectedOrganization.error ? (
              <ErrorState message={selectedOrganization.error} onRetry={() => void selectedOrganization.reload()} />
            ) : selectedOrganization.data ? (
              <div className="space-y-4 text-sm">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Organization</p>
                  <p className="mt-1 text-lg font-semibold text-[#1E3A5F]">{selectedOrganization.data.name}</p>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">ICP Type</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">{selectedOrganization.data.icpType}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Credits</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">{selectedOrganization.data.creditBalance}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Users</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">{rows.find((item) => item.id === selectedOrganization.data?.id)?.userCount ?? 0}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Subscription</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">{selectedOrganization.data.subscriptionStatus}</p>
                  </div>
                  <div className="rounded-lg bg-gray-50 p-3">
                    <p className="text-xs text-gray-500">Timezone</p>
                    <p className="mt-1 font-medium text-[#1E3A5F]">{selectedOrganization.data.settings?.timezone ?? 'Not set'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Website</p>
                  <p className="mt-1 text-[#1E3A5F]">{selectedOrganization.data.website ?? 'Not set'}</p>
                </div>
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Prohibited Terms</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedOrganization.data.prohibitedTerms.length > 0 ? selectedOrganization.data.prohibitedTerms.map((term) => (
                      <span key={term} className="rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">{term}</span>
                    )) : <span className="text-gray-500">No prohibited terms configured.</span>}
                  </div>
                </div>
                <div className="space-y-4 border-t border-gray-200 pt-4">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Edit ICP Configuration</p>
                    <p className="mt-1 text-xs text-gray-500">Update industry vertical, compliance rules, disclosures, and workflow terminology for this organization.</p>
                  </div>
                  <div className="grid grid-cols-1 gap-3">
                    <Input value={detailName} onChange={(event) => setDetailName(event.target.value)} placeholder="Organization name" />
                    <Input value={detailWebsite} onChange={(event) => setDetailWebsite(event.target.value)} placeholder="https://example.com" />
                    <Input value={detailIcpType} onChange={(event) => setDetailIcpType(event.target.value)} placeholder="financial_advisor" />
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Workflow Terminology</p>
                    <div className="mt-2 grid grid-cols-3 gap-2">
                      <Input value={reviewLabel} onChange={(event) => setReviewLabel(event.target.value)} placeholder="Review" />
                      <Input value={approveLabel} onChange={(event) => setApproveLabel(event.target.value)} placeholder="Approve" />
                      <Input value={rejectLabel} onChange={(event) => setRejectLabel(event.target.value)} placeholder="Reject" />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Prohibited Terms</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {detailProhibitedTerms.map((term) => (
                        <span key={term} className="inline-flex items-center gap-2 rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                          {term}
                          <button type="button" onClick={() => setDetailProhibitedTerms((current) => current.filter((item) => item !== term))}>
                            <X className="h-3 w-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input value={detailNewTerm} onChange={(event) => setDetailNewTerm(event.target.value)} placeholder="Add prohibited term" />
                      <Button variant="outline" onClick={addDetailTerm}>Add</Button>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Required Disclosures</p>
                    <div className="mt-2 space-y-2">
                      {detailDisclosures.map((disclosure, index) => (
                        <div key={`${disclosure}-${index}`} className="flex items-center justify-between gap-3 rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-700">
                          <span>{disclosure}</span>
                          <button type="button" onClick={() => setDetailDisclosures((current) => current.filter((_, currentIndex) => currentIndex !== index))}>
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 flex gap-2">
                      <Input value={detailNewDisclosure} onChange={(event) => setDetailNewDisclosure(event.target.value)} placeholder="Add disclosure copy" />
                      <Button variant="outline" onClick={addDetailDisclosure}>Add</Button>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 gap-2 text-xs text-gray-700">
                    <label className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <span>Require compliance review</span>
                      <input type="checkbox" checked={requireComplianceReview} onChange={(event) => setRequireComplianceReview(event.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <span>Auto-approve drafts with no flags</span>
                      <input type="checkbox" checked={autoApproveNoFlags} onChange={(event) => setAutoApproveNoFlags(event.target.checked)} />
                    </label>
                    <label className="flex items-center justify-between rounded-lg bg-gray-50 px-3 py-2">
                      <span>Notify on flagged content</span>
                      <input type="checkbox" checked={notifyOnFlag} onChange={(event) => setNotifyOnFlag(event.target.checked)} />
                    </label>
                  </div>
                  {detailError ? <p className="text-xs text-red-600">{detailError}</p> : null}
                  <Button className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handleSaveDetails()} disabled={savingDetails}>
                    {savingDetails ? 'Saving...' : 'Save ICP Settings'}
                  </Button>
                </div>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
