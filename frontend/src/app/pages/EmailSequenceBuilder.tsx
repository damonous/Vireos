import { useState } from 'react';
import { ArrowLeft, Plus, Trash2 } from 'lucide-react';
import { useNavigate } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { apiClient } from '../lib/api-client';

interface StepDraft {
  id: number;
  subject: string;
  body: string;
  delayDays: number;
  delayHours: number;
}

interface EmailSequence {
  id: string;
}

interface EmailTemplate {
  id: string;
}

export default function EmailSequenceBuilder() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<'MANUAL' | 'LEAD_CREATED' | 'PROSPECT_IMPORTED' | 'FACEBOOK_LEAD'>('LEAD_CREATED');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [steps, setSteps] = useState<StepDraft[]>([
    { id: 1, subject: '', body: '', delayDays: 0, delayHours: 0 },
  ]);

  const updateStep = (id: number, patch: Partial<StepDraft>) => {
    setSteps((current) => current.map((step) => (step.id === id ? { ...step, ...patch } : step)));
  };

  const addStep = () => {
    setSteps((current) => [...current, { id: current.length + 1, subject: '', body: '', delayDays: 1, delayHours: 0 }]);
  };

  const removeStep = (id: number) => {
    setSteps((current) => current.filter((step) => step.id !== id).map((step, index) => ({ ...step, id: index + 1 })));
  };

  const handleSave = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const sequence = await apiClient.post<EmailSequence>('/email/sequences', {
        name,
        description: description.trim() || undefined,
        triggerType,
      });

      for (let index = 0; index < steps.length; index += 1) {
        const step = steps[index]!;
        const template = await apiClient.post<EmailTemplate>('/email/templates', {
          name: `${name} Step ${index + 1}`,
          subject: step.subject,
          htmlContent: step.body.replace(/\n/g, '<br />'),
          textContent: step.body,
        });

        await apiClient.post(`/email/sequences/${sequence.id}/steps`, {
          templateId: template.id,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          subject: step.subject,
        });
      }

      navigate('/email');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save email sequence.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate('/email')} className="flex items-center gap-2 text-sm text-gray-600 hover:text-[#0EA5E9] transition-colors">
              <ArrowLeft className="w-4 h-4" />
              Back to Sequences
            </button>
            <div className="h-6 w-px bg-gray-300"></div>
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">Create Email Sequence</h1>
              <p className="text-sm text-gray-500 mt-0.5">Create a sequence with email templates and automated follow-up steps.</p>
            </div>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handleSave()} disabled={submitting || !name.trim() || steps.some((step) => !step.subject.trim() || !step.body.trim())}>
            {submitting ? 'Saving...' : 'Save Sequence'}
          </Button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-8 space-y-6">
        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-lg font-semibold text-[#1E3A5F] mb-6">Sequence Setup</h2>
          <div className="space-y-5">
            <label className="block text-sm">
              <span className="block text-sm font-medium text-gray-700 mb-2">Sequence Name</span>
              <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New lead nurture" />
            </label>
            <label className="block text-sm">
              <span className="block text-sm font-medium text-gray-700 mb-2">Description</span>
              <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-[100px]" placeholder="Optional description for this sequence." />
            </label>
            <label className="block text-sm">
              <span className="block text-sm font-medium text-gray-700 mb-2">Trigger Type</span>
              <select className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={triggerType} onChange={(event) => setTriggerType(event.target.value as typeof triggerType)}>
                <option value="LEAD_CREATED">Lead Created</option>
                <option value="PROSPECT_IMPORTED">Prospect Imported</option>
                <option value="FACEBOOK_LEAD">Facebook Lead</option>
                <option value="MANUAL">Manual</option>
              </select>
            </label>
          </div>
        </Card>

        <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-lg font-semibold text-[#1E3A5F]">Sequence Steps</h2>
              <p className="text-sm text-gray-500 mt-1">Each step creates a template and attaches it to the sequence.</p>
            </div>
            <Button variant="outline" onClick={addStep}>
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
                <div className="grid grid-cols-1 md:grid-cols-[1fr_140px_140px] gap-4 mb-4">
                  <label className="block text-sm md:col-span-1">
                    <span className="block text-sm font-medium text-gray-700 mb-2">Subject</span>
                    <Input value={step.subject} onChange={(event) => updateStep(step.id, { subject: event.target.value })} placeholder="Your first touchpoint" />
                  </label>
                  <label className="block text-sm">
                    <span className="block text-sm font-medium text-gray-700 mb-2">Delay Days</span>
                    <Input type="number" min="0" value={String(step.delayDays)} onChange={(event) => updateStep(step.id, { delayDays: Number(event.target.value) })} />
                  </label>
                  <label className="block text-sm">
                    <span className="block text-sm font-medium text-gray-700 mb-2">Delay Hours</span>
                    <Input type="number" min="0" max="23" value={String(step.delayHours)} onChange={(event) => updateStep(step.id, { delayHours: Number(event.target.value) })} />
                  </label>
                </div>
                <label className="block text-sm">
                  <span className="block text-sm font-medium text-gray-700 mb-2">Body</span>
                  <Textarea value={step.body} onChange={(event) => updateStep(step.id, { body: event.target.value })} className="min-h-[160px]" placeholder="Write the actual email body that should be stored in the template." />
                </label>
              </div>
            ))}
          </div>
          {submitError ? <p className="mt-4 text-sm text-red-600">{submitError}</p> : null}
        </Card>
      </div>
    </div>
  );
}
