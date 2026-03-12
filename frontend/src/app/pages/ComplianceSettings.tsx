import { useEffect, useMemo, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Toast } from '../components/ui/toast';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useAuth } from '../hooks/useAuth';
import { useApiData } from '../hooks/useApiData';
import { apiClient } from '../lib/api-client';
import { PageShell } from '../components/page-shell';

interface OrganizationResponse {
  id: string;
  name: string;
  prohibitedTerms: string[];
  requiredDisclosures?: Record<string, unknown> | string[] | null;
  complianceRules?: Record<string, unknown> | null;
  settings?: Record<string, unknown> | null;
}

export default function ComplianceSettings() {
  const { user } = useAuth();
  const organization = useApiData<OrganizationResponse>(
    user?.orgId ? `/organizations/${user.orgId}` : '/organizations/unknown',
    [user?.orgId],
    Boolean(user?.orgId)
  );

  const [prohibitedTerms, setProhibitedTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [disclosures, setDisclosures] = useState<string[]>([]);
  const [newDisclosure, setNewDisclosure] = useState('');
  const [requireComplianceReview, setRequireComplianceReview] = useState(true);
  const [autoApprove, setAutoApprove] = useState(false);
  const [notifyOnFlag, setNotifyOnFlag] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!organization.data) {
      return;
    }

    setProhibitedTerms(organization.data.prohibitedTerms ?? []);

    const rawDisclosures = organization.data.requiredDisclosures;
    if (Array.isArray(rawDisclosures)) {
      setDisclosures(rawDisclosures.map(String).filter(Boolean));
    } else if (rawDisclosures && typeof rawDisclosures === 'object') {
      setDisclosures(Object.values(rawDisclosures).map(String).filter(Boolean));
    } else {
      setDisclosures([]);
    }

    setRequireComplianceReview(Boolean(organization.data.settings?.requireComplianceReview ?? true));
    setAutoApprove(Boolean(organization.data.complianceRules?.autoApproveNoFlags ?? false));
    setNotifyOnFlag(Boolean(organization.data.complianceRules?.notifyOnFlag ?? true));
  }, [organization.data]);

  const duplicatedTerms = useMemo(() => {
    const normalized = prohibitedTerms.map((term) => term.trim().toLowerCase());
    return new Set(normalized.filter((term, index) => normalized.indexOf(term) !== index));
  }, [prohibitedTerms]);

  if (organization.loading) {
    return <LoadingState label="Loading compliance settings..." />;
  }

  if (organization.error) {
    return <ErrorState message={organization.error} onRetry={() => void organization.reload()} />;
  }

  const addProhibitedTerm = () => {
    const normalized = newTerm.trim().toLowerCase();
    if (!normalized || prohibitedTerms.includes(normalized)) {
      return;
    }
    setProhibitedTerms((current) => [...current, normalized]);
    setNewTerm('');
  };

  const addDisclosure = () => {
    const value = newDisclosure.trim();
    if (!value) {
      return;
    }
    setDisclosures((current) => [...current, value]);
    setNewDisclosure('');
  };

  const saveChanges = async () => {
    if (!user?.orgId) {
      return;
    }

    setSaving(true);
    try {
      await apiClient.put(`/organizations/${user.orgId}`, {
        prohibitedTerms,
        requiredDisclosures: disclosures,
        complianceRules: {
          ...(organization.data?.complianceRules ?? {}),
          autoApproveNoFlags: autoApprove,
          notifyOnFlag,
        },
        settings: {
          ...(organization.data?.settings ?? {}),
          requireComplianceReview,
        },
      });
      await organization.reload();
      setToastMessage('Compliance settings saved.');
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Failed to save compliance settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <PageShell
      title="Compliance Settings"
      subtitle="Live organization rules used by the compliance workflow"
      actions={
        <Button className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]" onClick={() => void saveChanges()} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      }
    >
      <div className="mx-auto max-w-5xl space-y-6">
        <Card className="border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1E3A5F]">Prohibited Terms</h2>
          <p className="mt-1 text-sm text-gray-500">These terms are stored on the organization record and can be highlighted during review.</p>

          <div className="mt-5 flex flex-wrap gap-2">
            {prohibitedTerms.length === 0 ? (
              <p className="text-sm text-gray-500">No prohibited terms are currently configured.</p>
            ) : (
              prohibitedTerms.map((term) => (
                <div
                  key={term}
                  className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm ${
                    duplicatedTerms.has(term) ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-800'
                  }`}
                >
                  <span>{term}</span>
                  <button onClick={() => setProhibitedTerms((current) => current.filter((item) => item !== term))} className="rounded-full p-0.5 hover:bg-white/40">
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <Input
              value={newTerm}
              onChange={(event) => setNewTerm(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addProhibitedTerm()}
              placeholder="Add prohibited phrasing"
            />
            <Button className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]" onClick={addProhibitedTerm}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        </Card>

        <Card className="border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1E3A5F]">Required Disclosures</h2>
          <p className="mt-1 text-sm text-gray-500">Store the disclosure copy the compliance team expects to see before publication.</p>

          <div className="mt-5 space-y-3">
            {disclosures.length === 0 ? (
              <p className="text-sm text-gray-500">No disclosures are configured.</p>
            ) : (
              disclosures.map((disclosure, index) => (
                <div key={`${disclosure}-${index}`} className="flex items-start justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                  <p className="text-sm text-gray-700">{disclosure}</p>
                  <button onClick={() => setDisclosures((current) => current.filter((_, currentIndex) => currentIndex !== index))} className="rounded-full p-1 text-gray-500 hover:bg-white hover:text-gray-700">
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))
            )}
          </div>

          <div className="mt-5 flex gap-2">
            <Input
              value={newDisclosure}
              onChange={(event) => setNewDisclosure(event.target.value)}
              onKeyDown={(event) => event.key === 'Enter' && addDisclosure()}
              placeholder="Add disclosure text"
            />
            <Button className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]" onClick={addDisclosure}>
              <Plus className="mr-2 h-4 w-4" />
              Add
            </Button>
          </div>
        </Card>

        <Card className="border border-gray-200 p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-[#1E3A5F]">Workflow Preferences</h2>
          <div className="mt-5 space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Require compliance review before publishing</Label>
                <p className="mt-1 text-xs text-gray-500">Stored in organization settings and enforced by workflow policy.</p>
              </div>
              <Switch checked={requireComplianceReview} onCheckedChange={setRequireComplianceReview} className="data-[state=checked]:bg-[#0EA5E9]" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Auto-approve drafts with no flagged terms</Label>
                <p className="mt-1 text-xs text-gray-500">This is stored as a live rule but does not bypass review unless backend workflow implements it.</p>
              </div>
              <Switch checked={autoApprove} onCheckedChange={setAutoApprove} className="data-[state=checked]:bg-[#0EA5E9]" />
            </div>

            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="text-sm font-medium text-gray-700">Notify on flagged content</Label>
                <p className="mt-1 text-xs text-gray-500">Used to track whether flagged submissions should trigger compliance notifications.</p>
              </div>
              <Switch checked={notifyOnFlag} onCheckedChange={setNotifyOnFlag} className="data-[state=checked]:bg-[#0EA5E9]" />
            </div>
          </div>
        </Card>
      </div>

      {toastMessage ? <Toast type="success" message={toastMessage} onClose={() => setToastMessage(null)} /> : null}
    </PageShell>
  );
}
