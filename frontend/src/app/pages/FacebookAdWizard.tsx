import { useState } from 'react';
import { useNavigate } from 'react-router';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { useApiData } from '../hooks/useApiData';
import { apiClient } from '../lib/api-client';

interface Draft {
  id: string;
  title: string;
}

interface DraftListResponse {
  data: Draft[];
}

interface FacebookCampaign {
  id: string;
}

export default function FacebookAdWizard() {
  const navigate = useNavigate();
  const drafts = useApiData<DraftListResponse>('/content/drafts?status=APPROVED&page=1&limit=20');
  const [name, setName] = useState('');
  const [objective, setObjective] = useState<'LEAD_GENERATION' | 'BRAND_AWARENESS' | 'TRAFFIC' | 'CONVERSIONS'>('LEAD_GENERATION');
  const [budget, setBudget] = useState('25');
  const [startDate, setStartDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 16));
  const [endDate, setEndDate] = useState(() => new Date(Date.now() + 604800000).toISOString().slice(0, 16));
  const [targetingSummary, setTargetingSummary] = useState('');
  const [adAccountId, setAdAccountId] = useState('');
  const [draftId, setDraftId] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const approvedDrafts = drafts.data ?? [];

  const handleSubmit = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await apiClient.post<FacebookCampaign>('/facebook/campaigns', {
        name,
        objective,
        budget: Number(budget),
        budgetCurrency: 'USD',
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        targetingJson: targetingSummary.trim() ? { summary: targetingSummary.trim() } : undefined,
        draftId: draftId || undefined,
        adAccountId: adAccountId.trim() || undefined,
      });
      navigate(`/facebook-campaign-detail?campaignId=${created.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create Facebook campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  if (drafts.loading) {
    return <div className="flex h-full items-center justify-center text-sm text-gray-500">Loading approved drafts...</div>;
  }

  if (drafts.error) {
    return <div className="flex h-full items-center justify-center text-sm text-red-600">{drafts.error}</div>;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <h1 className="text-2xl font-semibold text-[#1E3A5F]">Create Facebook Ad Campaign</h1>
        <p className="text-sm text-gray-500 mt-1">Set up your Facebook ad campaign details and save as a draft.</p>
      </div>

      <div className="p-8 max-w-4xl mx-auto space-y-6">
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-5">Campaign Setup</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="block text-sm md:col-span-2">
              <span className="block font-medium text-gray-700 mb-2">Campaign Name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Retirement planning consultation" />
            </label>

            <label className="block text-sm">
              <span className="block font-medium text-gray-700 mb-2">Objective</span>
              <select className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={objective} onChange={(event) => setObjective(event.target.value as typeof objective)}>
                <option value="LEAD_GENERATION">Lead Generation</option>
                <option value="BRAND_AWARENESS">Brand Awareness</option>
                <option value="TRAFFIC">Traffic</option>
                <option value="CONVERSIONS">Conversions</option>
              </select>
            </label>

            <label className="block text-sm">
              <span className="block font-medium text-gray-700 mb-2">Daily Budget</span>
              <Input type="number" min="1" value={budget} onChange={(event) => setBudget(event.target.value)} />
            </label>

            <label className="block text-sm">
              <span className="block font-medium text-gray-700 mb-2">Start Date</span>
              <Input type="datetime-local" value={startDate} onChange={(event) => setStartDate(event.target.value)} />
            </label>

            <label className="block text-sm">
              <span className="block font-medium text-gray-700 mb-2">End Date</span>
              <Input type="datetime-local" value={endDate} onChange={(event) => setEndDate(event.target.value)} />
            </label>

            <label className="block text-sm">
              <span className="block font-medium text-gray-700 mb-2">Approved Draft</span>
              <select className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={draftId} onChange={(event) => setDraftId(event.target.value)}>
                <option value="">None</option>
                {approvedDrafts.map((draft) => (
                  <option key={draft.id} value={draft.id}>{draft.title}</option>
                ))}
              </select>
            </label>

            <label className="block text-sm">
              <span className="block font-medium text-gray-700 mb-2">Facebook Ad Account ID</span>
              <Input value={adAccountId} onChange={(event) => setAdAccountId(event.target.value)} placeholder="Optional until provider credentials are configured" />
            </label>

            <label className="block text-sm md:col-span-2">
              <span className="block font-medium text-gray-700 mb-2">Targeting Summary</span>
              <Textarea value={targetingSummary} onChange={(event) => setTargetingSummary(event.target.value)} className="min-h-[120px]" placeholder="Describe audience, geography, age range, interests, and exclusions." />
            </label>
          </div>

          {submitError ? <p className="mt-4 text-sm text-red-600">{submitError}</p> : null}

          <div className="mt-6 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-amber-900">Launching to Meta still depends on configured provider credentials. This screen now only saves the real campaign draft and links any approved content draft you selected.</p>
          </div>

          <div className="mt-6 flex justify-end">
            <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handleSubmit()} disabled={submitting || !name.trim()}>
              {submitting ? 'Saving campaign...' : 'Create Campaign'}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}
