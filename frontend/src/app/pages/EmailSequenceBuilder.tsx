import { ArrowLeft, ArrowUpDown, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Textarea } from '../components/ui/textarea';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { apiClient } from '../lib/api-client';
import { useApiData } from '../hooks/useApiData';
import { EmailNav } from './email/EmailNav';

type TriggerType = 'MANUAL' | 'LEAD_CREATED' | 'PROSPECT_IMPORTED' | 'FACEBOOK_LEAD';
type SequenceStatus = 'DRAFT' | 'ACTIVE' | 'PAUSED' | 'ARCHIVED';

interface TemplateOption {
  id: string;
  name: string;
  subject: string;
  variables: string[];
}

interface TemplateListResponse {
  items: TemplateOption[];
}

interface SequenceDetail {
  id: string;
  name: string;
  description?: string | null;
  triggerType: TriggerType;
  status: SequenceStatus;
  steps: Array<{
    id: string;
    stepNumber: number;
    templateId: string;
    delayDays: number;
    delayHours: number;
    subject?: string | null;
    template: TemplateOption;
  }>;
}

interface StepDraft {
  key: string;
  templateId: string;
  delayDays: number;
  delayHours: number;
  subject: string;
}

function newStep(index: number): StepDraft {
  return {
    key: `new-${Date.now()}-${index}`,
    templateId: '',
    delayDays: index === 0 ? 0 : 1,
    delayHours: 0,
    subject: '',
  };
}

function humanizeTrigger(trigger: TriggerType) {
  return trigger
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function EmailSequenceBuilder() {
  const navigate = useNavigate();
  const { sequenceId } = useParams();
  const isEditing = Boolean(sequenceId);
  const templates = useApiData<TemplateListResponse>('/email/templates?page=1&limit=100');
  const sequence = useApiData<SequenceDetail>(sequenceId ? `/email/sequences/${sequenceId}` : '', [sequenceId], Boolean(sequenceId));

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [triggerType, setTriggerType] = useState<TriggerType>('LEAD_CREATED');
  const [status, setStatus] = useState<SequenceStatus>('DRAFT');
  const [steps, setSteps] = useState<StepDraft[]>([newStep(0)]);
  const [draggingKey, setDraggingKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  useEffect(() => {
    if (!sequence.data) {
      return;
    }

    setName(sequence.data.name);
    setDescription(sequence.data.description ?? '');
    setTriggerType(sequence.data.triggerType);
    setStatus(sequence.data.status);
    setSteps(
      sequence.data.steps.length > 0
        ? sequence.data.steps.map((step) => ({
            key: step.id,
            templateId: step.templateId,
            delayDays: step.delayDays,
            delayHours: step.delayHours,
            subject: step.subject ?? '',
          }))
        : [newStep(0)]
    );
  }, [sequence.data]);

  const templateOptions = templates.data?.items ?? [];
  const templateMap = useMemo(
    () => new Map(templateOptions.map((template) => [template.id, template])),
    [templateOptions]
  );

  const updateStep = (key: string, patch: Partial<StepDraft>) => {
    setSteps((current) => current.map((step) => (step.key === key ? { ...step, ...patch } : step)));
  };

  const moveStep = (fromKey: string, toKey: string) => {
    if (fromKey === toKey) {
      return;
    }
    setSteps((current) => {
      const next = [...current];
      const fromIndex = next.findIndex((step) => step.key === fromKey);
      const toIndex = next.findIndex((step) => step.key === toKey);
      if (fromIndex < 0 || toIndex < 0) {
        return current;
      }
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved!);
      return next;
    });
  };

  const handleSave = async () => {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const payload = {
        name,
        description: description.trim() || undefined,
        triggerType,
        ...(isEditing ? { status } : {}),
      };

      const savedSequence = isEditing && sequenceId
        ? await apiClient.put<SequenceDetail>(`/email/sequences/${sequenceId}`, payload)
        : await apiClient.post<SequenceDetail>('/email/sequences', payload);

      await apiClient.put(`/email/sequences/${savedSequence.id}/steps`, {
        steps: steps.map((step) => ({
          templateId: step.templateId,
          delayDays: step.delayDays,
          delayHours: step.delayHours,
          subject: step.subject.trim() || undefined,
        })),
      });

      navigate(`/email/sequences/${savedSequence.id}`);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to save email sequence.');
    } finally {
      setSubmitting(false);
    }
  };

  if (templates.loading || (isEditing && sequence.loading)) {
    return <LoadingState label="Loading sequence builder..." />;
  }

  if (templates.error || sequence.error) {
    return (
      <ErrorState
        message={templates.error || sequence.error || 'Failed to load sequence builder.'}
        onRetry={() => {
          void templates.reload();
          void sequence.reload();
        }}
      />
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <button onClick={() => navigate('/email/sequences')} className="inline-flex items-center gap-2 text-sm text-gray-600 transition-colors hover:text-[#0EA5E9]">
              <ArrowLeft className="h-4 w-4" />
              Back to Sequences
            </button>
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">{isEditing ? 'Edit Email Sequence' : 'Create Email Sequence'}</h1>
              <p className="mt-1 text-sm text-gray-500">Create a sequence with email templates and automated follow-up steps.</p>
            </div>
            <EmailNav />
          </div>
          <Button
            className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]"
            onClick={() => void handleSave()}
            disabled={submitting || !name.trim() || steps.some((step) => !step.templateId)}
          >
            {submitting ? 'Saving...' : isEditing ? 'Save Sequence' : 'Create Sequence'}
          </Button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="space-y-6">
          <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <h2 className="mb-6 text-lg font-semibold text-[#1E3A5F]">Sequence Setup</h2>
            <div className="grid gap-5 md:grid-cols-2">
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700">Sequence Name</span>
                <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="New prospect nurture" />
              </label>
              <label className="block text-sm md:col-span-2">
                <span className="mb-2 block font-medium text-gray-700">Description</span>
                <Textarea value={description} onChange={(event) => setDescription(event.target.value)} className="min-h-[100px]" placeholder="What this sequence is for and when it should run." />
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700">Trigger Type</span>
                <select className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={triggerType} onChange={(event) => setTriggerType(event.target.value as TriggerType)}>
                  <option value="LEAD_CREATED">Lead Created</option>
                  <option value="PROSPECT_IMPORTED">Prospect Imported</option>
                  <option value="FACEBOOK_LEAD">Facebook Lead</option>
                  <option value="MANUAL">Manual</option>
                </select>
              </label>
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700">Status</span>
                <select className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={status} onChange={(event) => setStatus(event.target.value as SequenceStatus)} disabled={!isEditing}>
                  <option value="DRAFT">Draft</option>
                  <option value="ACTIVE">Active</option>
                  <option value="PAUSED">Paused</option>
                  <option value="ARCHIVED">Archived</option>
                </select>
              </label>
            </div>
          </Card>

          <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-[#1E3A5F]">Sequence Steps</h2>
                <p className="mt-1 text-sm text-gray-500">Drag steps to reorder them before saving.</p>
              </div>
              <Button variant="outline" onClick={() => setSteps((current) => [...current, newStep(current.length)])}>
                <Plus className="mr-2 h-4 w-4" />
                Add Step
              </Button>
            </div>

            <div className="space-y-4">
              {steps.map((step, index) => {
                const selectedTemplate = templateMap.get(step.templateId);
                return (
                  <div
                    key={step.key}
                    draggable
                    onDragStart={() => setDraggingKey(step.key)}
                    onDragOver={(event) => {
                      event.preventDefault();
                    }}
                    onDrop={() => {
                      if (draggingKey) {
                        moveStep(draggingKey, step.key);
                      }
                      setDraggingKey(null);
                    }}
                    onDragEnd={() => setDraggingKey(null)}
                    className="rounded-lg border border-gray-200 bg-white p-4"
                  >
                    <div className="mb-4 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <GripVertical className="h-4 w-4 text-gray-400" />
                        <h3 className="text-sm font-semibold text-[#1E3A5F]">Step {index + 1}</h3>
                        <ArrowUpDown className="h-4 w-4 text-gray-300" />
                      </div>
                      {steps.length > 1 ? (
                        <button type="button" onClick={() => setSteps((current) => current.filter((candidate) => candidate.key !== step.key))} className="text-gray-400 hover:text-red-500">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>

                    <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_140px_140px]">
                      <label className="block text-sm">
                        <span className="mb-2 block font-medium text-gray-700">Template</span>
                        <select className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={step.templateId} onChange={(event) => updateStep(step.key, { templateId: event.target.value })}>
                          <option value="">Select template</option>
                          {templateOptions.map((template) => (
                            <option key={template.id} value={template.id}>
                              {template.name}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-sm">
                        <span className="mb-2 block font-medium text-gray-700">Delay Days</span>
                        <Input type="number" min="0" value={String(step.delayDays)} onChange={(event) => updateStep(step.key, { delayDays: Number(event.target.value) })} />
                      </label>
                      <label className="block text-sm">
                        <span className="mb-2 block font-medium text-gray-700">Delay Hours</span>
                        <Input type="number" min="0" max="23" value={String(step.delayHours)} onChange={(event) => updateStep(step.key, { delayHours: Number(event.target.value) })} />
                      </label>
                    </div>

                    <label className="mt-4 block text-sm">
                      <span className="mb-2 block font-medium text-gray-700">Subject Override</span>
                      <Input value={step.subject} onChange={(event) => updateStep(step.key, { subject: event.target.value })} placeholder={selectedTemplate?.subject ?? 'Use the template subject by default'} />
                    </label>

                    {selectedTemplate ? (
                      <div className="mt-4 rounded-lg border border-sky-100 bg-sky-50 p-4">
                        <p className="text-xs font-semibold uppercase tracking-wide text-sky-700">Template Preview</p>
                        <p className="mt-2 text-sm font-medium text-[#1E3A5F]">{selectedTemplate.subject}</p>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {selectedTemplate.variables.length === 0 ? (
                            <span className="text-sm text-sky-700">No extracted variables.</span>
                          ) : (
                            selectedTemplate.variables.map((variable) => (
                              <span key={variable} className="rounded-full bg-white px-2 py-1 text-xs font-medium text-sky-700">
                                {`{{${variable}}}`}
                              </span>
                            ))
                          )}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {submitError ? <p className="mt-4 text-sm text-red-600">{submitError}</p> : null}
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Summary</h3>
            <div className="mt-4 space-y-3 text-sm text-gray-600">
              <p>
                Trigger: <span className="font-semibold text-[#1E3A5F]">{humanizeTrigger(triggerType)}</span>
              </p>
              <p>
                Status: <span className="font-semibold text-[#1E3A5F]">{status}</span>
              </p>
              <p>
                Steps configured: <span className="font-semibold text-[#1E3A5F]">{steps.length}</span>
              </p>
            </div>
          </Card>

          <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Available Templates</h3>
            {templateOptions.length === 0 ? (
              <p className="mt-4 text-sm text-gray-500">Create templates first so this sequence can reference them.</p>
            ) : (
              <div className="mt-4 space-y-3">
                {templateOptions.map((template) => (
                  <div key={template.id} className="rounded-lg border border-gray-200 p-3">
                    <p className="text-sm font-semibold text-[#1E3A5F]">{template.name}</p>
                    <p className="mt-1 text-sm text-gray-600">{template.subject}</p>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
