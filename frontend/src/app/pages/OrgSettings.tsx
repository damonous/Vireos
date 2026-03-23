import { useEffect, useState } from 'react';
import { Upload, X } from 'lucide-react';
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

interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  icpType: string;
  logoUrl: string | null;
  website: string | null;
  subscriptionStatus: string;
  prohibitedTerms: string[];
  settings?: Record<string, unknown>;
}

export default function OrgSettings() {
  const { user, refresh } = useAuth();
  const org = useApiData<OrganizationResponse>(
    user?.orgId ? `/organizations/${user.orgId}` : '/organizations/unknown',
    [user?.orgId]
  );

  const [orgName, setOrgName] = useState('');
  const [website, setWebsite] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [prohibitedTerms, setProhibitedTerms] = useState<string[]>([]);
  const [newTerm, setNewTerm] = useState('');
  const [timezone, setTimezone] = useState('America/New_York');
  const [requireCompliance, setRequireCompliance] = useState(true);
  const [showToast, setShowToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!org.data) {
      return;
    }
    const settings = org.data.settings ?? {};
    setOrgName(org.data.name ?? '');
    setWebsite(org.data.website ?? '');
    setLogoUrl(org.data.logoUrl ?? '');
    setTimezone(String(settings.timezone ?? 'America/New_York'));
    setRequireCompliance(Boolean(settings.requireComplianceReview ?? true));
    setProhibitedTerms(Array.isArray(org.data.prohibitedTerms) ? org.data.prohibitedTerms.map(String) : []);
  }, [org.data]);

  if (org.loading) {
    return <LoadingState label="Loading organization settings..." />;
  }

  if (org.error) {
    return <ErrorState message={org.error} onRetry={() => void org.reload()} />;
  }

  const addProhibitedTerm = () => {
    const normalized = newTerm.trim().toLowerCase();
    if (normalized && !prohibitedTerms.includes(normalized)) {
      setProhibitedTerms([...prohibitedTerms, normalized]);
      setNewTerm('');
    }
  };

  const removeProhibitedTerm = (term: string) => {
    setProhibitedTerms(prohibitedTerms.filter((item) => item !== term));
  };

  const saveChanges = async () => {
    if (!user?.orgId) {
      return;
    }

    setSaving(true);
    try {
      await apiClient.put(`/organizations/${user.orgId}`, {
        name: orgName,
        website: website || null,
        logoUrl: logoUrl || null,
        prohibitedTerms,
        settings: {
          ...(org.data?.settings ?? {}),
          timezone,
          requireComplianceReview: requireCompliance,
        },
      });
      await org.reload();
      await refresh();
      setShowToast('Organization settings saved.');
    } catch (err) {
      setShowToast(err instanceof Error ? err.message : 'Failed to save organization settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="p-8 max-w-4xl">
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Organization Profile</h2>
          <div className="mb-6">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Organization Logo</Label>
            <div className="flex items-center gap-6">
              {logoUrl ? (
                <img src={logoUrl} alt={`${orgName} logo`} className="h-[120px] w-[120px] rounded-full border border-gray-200 object-cover" />
              ) : (
                <div className="w-[120px] h-[120px] rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center bg-[#1E3A5F] text-white text-4xl font-semibold">
                  {orgName.charAt(0) || 'O'}
                </div>
              )}
              <div>
                <Label htmlFor="logoUrl" className="text-sm font-medium text-gray-700 mb-2 block">Logo URL</Label>
                <div className="flex items-center gap-2">
                  <Upload className="h-4 w-4 text-gray-500" />
                  <Input id="logoUrl" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className="w-[320px]" placeholder="https://..." />
                </div>
                <p className="text-xs text-gray-500 mt-2">Provide a stored logo URL to update the organization profile image.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="orgName" className="text-sm font-medium text-gray-700 mb-2 block">Organization Name</Label>
              <Input id="orgName" value={orgName} onChange={(e) => setOrgName(e.target.value)} className="w-full" />
            </div>
            <div>
              <Label htmlFor="industry" className="text-sm font-medium text-gray-700 mb-2 block">Industry</Label>
              <Input id="industry" value={org.data?.icpType ?? ''} readOnly className="w-full" />
            </div>
            <div>
              <Label htmlFor="slug" className="text-sm font-medium text-gray-700 mb-2 block">Slug</Label>
              <Input id="slug" value={org.data?.slug ?? ''} readOnly className="w-full" />
            </div>
            <div>
              <Label htmlFor="website" className="text-sm font-medium text-gray-700 mb-2 block">Website</Label>
              <Input id="website" value={website} onChange={(e) => setWebsite(e.target.value)} className="w-full" />
            </div>
          </div>
        </Card>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Compliance Settings</h2>
          <div className="mb-6">
            <Label className="text-sm font-medium text-gray-700 mb-2 block">Prohibited Terms</Label>
            <div className="flex flex-wrap gap-2 mb-3">
              {prohibitedTerms.map((term) => (
                <div key={term} className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-100 text-red-800 rounded-full text-sm">
                  <span>{term}</span>
                  <button onClick={() => removeProhibitedTerm(term)} className="hover:bg-red-200 rounded-full p-0.5">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                placeholder="Enter a prohibited term"
                value={newTerm}
                onChange={(e) => setNewTerm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addProhibitedTerm()}
                className="flex-1"
              />
              <Button onClick={addProhibitedTerm} className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">Add</Button>
            </div>
          </div>

          <div className="flex items-center justify-between py-2">
            <div>
              <Label className="text-sm font-medium text-gray-700">Require Compliance Review</Label>
              <p className="text-xs text-gray-500 mt-1">All content must be reviewed before publishing</p>
            </div>
            <Switch checked={requireCompliance} onCheckedChange={setRequireCompliance} className="data-[state=checked]:bg-[#0EA5E9]" />
          </div>
        </Card>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Team Settings</h2>
          <div>
            <Label htmlFor="timezone" className="text-sm font-medium text-gray-700 mb-2 block">Default Timezone</Label>
            <select
              id="timezone"
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
            >
              <option value="America/New_York">America/New_York (EST/EDT)</option>
              <option value="America/Chicago">America/Chicago (CST/CDT)</option>
              <option value="America/Denver">America/Denver (MST/MDT)</option>
              <option value="America/Los_Angeles">America/Los_Angeles (PST/PDT)</option>
            </select>
          </div>
        </Card>

        <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void saveChanges()} disabled={saving}>
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

      {showToast ? <Toast message={showToast} type="success" onClose={() => setShowToast(null)} /> : null}
    </div>
  );
}
