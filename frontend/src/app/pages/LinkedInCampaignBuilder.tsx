import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { Checkbox } from '../components/ui/checkbox';
import { apiClient } from '../lib/api-client';

interface CampaignStep {
  id: number;
  messageTemplate: string;
  delayDays: number;
}

export default function LinkedInCampaignBuilder() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [targetAudience, setTargetAudience] = useState('');
  const [dailyLimit, setDailyLimit] = useState('20');
  const [pauseOnReply, setPauseOnReply] = useState(true);
  const [businessHoursOnly, setBusinessHoursOnly] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [steps, setSteps] = useState<CampaignStep[]>([
    { id: 1, messageTemplate: '', delayDays: 0 },
    { id: 2, messageTemplate: '', delayDays: 3 },
  ]);

  const updateStep = (id: number, patch: Partial<CampaignStep>) => {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  };

  const addStep = () => {
    setSteps((current) => [
      ...current,
      { id: current.length + 1, messageTemplate: '', delayDays: current.at(-1)?.delayDays ?? 0 },
    ]);
  };

  const removeStep = (id: number) => {
    setSteps((current) => current.filter((step) => step.id !== id).map((step, index) => ({ ...step, id: index + 1 })));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      await apiClient.post('/linkedin/campaigns', {
        name,
        description: description.trim() || undefined,
        targetCriteria: targetAudience.trim() ? { audience: targetAudience.trim() } : undefined,
        dailyLimit: Number(dailyLimit),
        pauseOnReply,
        businessHoursOnly,
        steps: steps.map((step) => ({
          messageTemplate: step.messageTemplate.trim(),
          delayDays: step.delayDays,
        })),
      });
      navigate('/linkedin');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to create LinkedIn campaign.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="sticky top-0 z-10 bg-white border-b border-gray-200">
        <div className="px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/linkedin')} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">Create LinkedIn Campaign</h1>
              <p className="text-sm text-gray-500 mt-0.5">Define your outreach sequence and save it as a campaign draft.</p>
            </div>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handleSave()} disabled={submitting || !name.trim() || steps.some((step) => !step.messageTemplate.trim())}>
            {submitting ? 'Saving...' : 'Save Campaign'}
          </Button>
        </div>
      </div>

      <div className="max-w-5xl mx-auto p-8 space-y-6">
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-5">Campaign Details</h2>
          <div className="space-y-5">
            <label className="block text-sm">
              <span className="block text-sm font-medium text-gray-700 mb-2">Campaign Name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Retirement outreach Q2" />
            </label>
            <label className="block text-sm">
              <span className="block text-sm font-medium text-gray-700 mb-2">Description</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What is this campaign meant to accomplish?" className="min-h-[100px]" />
            </label>
            <label className="block text-sm">
              <span className="block text-sm font-medium text-gray-700 mb-2">Target Audience</span>
              <Input value={targetAudience} onChange={(event) => setTargetAudience(event.target.value)} placeholder="CFOs in Texas with 50-200 employees" />
            </label>
            <label className="block text-sm">
              <span className="block text-sm font-medium text-gray-700 mb-2">Daily Limit</span>
              <Input type="number" min="1" max="100" value={dailyLimit} onChange={(event) => setDailyLimit(event.target.value)} />
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
              <Checkbox checked={pauseOnReply} onCheckedChange={(checked) => setPauseOnReply(Boolean(checked))} />
              <span className="text-sm text-gray-700">Pause sequence when a prospect replies</span>
            </label>
            <label className="flex items-center gap-3 rounded-lg border border-gray-200 p-3">
              <Checkbox checked={businessHoursOnly} onCheckedChange={(checked) => setBusinessHoursOnly(Boolean(checked))} />
              <span className="text-sm text-gray-700">Only send during business hours</span>
            </label>
          </div>
        </Card>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-[#1E3A5F]">Outreach Steps</h2>
              <p className="text-sm text-gray-500 mt-1">Each step is saved directly into the LinkedIn campaign payload.</p>
            </div>
            <Button variant="outline" onClick={addStep} disabled={steps.length >= 5}>
              <Plus className="w-4 h-4 mr-2" />
              Add Step
            </Button>
          </div>

          <div className="space-y-4">
            {steps.map((step, index) => (
              <div key={step.id} className="rounded-lg border border-gray-200 p-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-semibold text-[#1E3A5F]">Step {index + 1}</h3>
                  {steps.length > 1 ? (
                    <button type="button" onClick={() => removeStep(step.id)} className="text-gray-400 hover:text-red-500">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>
                <div className="grid grid-cols-1 md:grid-cols-[140px_minmax(0,1fr)] gap-4">
                  <label className="block text-sm">
                    <span className="block text-sm font-medium text-gray-700 mb-2">Delay (days)</span>
                    <Input type="number" min="0" max="30" value={String(step.delayDays)} onChange={(event) => updateStep(step.id, { delayDays: Number(event.target.value) })} />
                  </label>
                  <label className="block text-sm">
                    <span className="block text-sm font-medium text-gray-700 mb-2">Message Template</span>
                    <Textarea value={step.messageTemplate} onChange={(event) => updateStep(step.id, { messageTemplate: event.target.value })} placeholder="Write the connection note or follow-up message." className="min-h-[130px]" />
                  </label>
                </div>
              </div>
            ))}
          </div>

          {submitError ? <p className="mt-4 text-sm text-red-600">{submitError}</p> : null}
        </Card>
      </div>
    </div>
  );
}
