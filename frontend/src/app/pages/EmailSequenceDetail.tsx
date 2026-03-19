import { ArrowLeft, Mail, Plus, Users } from 'lucide-react';
import { Link, useNavigate, useParams } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { EmailNav } from './email/EmailNav';

interface SequenceDetail {
  id: string;
  name: string;
  description?: string | null;
  triggerType: string;
  status: string;
  steps: Array<{
    id: string;
    stepNumber: number;
    delayDays: number;
    delayHours: number;
    subject?: string | null;
    template: {
      id: string;
      name: string;
      subject: string;
      variables: string[];
    };
  }>;
  enrollments: Array<{
    id: string;
    currentStep: number;
    status: string;
    nextSendAt?: string | null;
    completedAt?: string | null;
    unsubscribedAt?: string | null;
    lead: {
      id: string;
      firstName?: string | null;
      lastName?: string | null;
      email?: string | null;
      company?: string | null;
    };
  }>;
  stats: {
    active: number;
    completed: number;
    unsubscribed: number;
    bounced: number;
    paused: number;
    total: number;
    completionRate: number;
  };
}

function fullName(lead: SequenceDetail['enrollments'][number]['lead']) {
  return `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.email || 'Unnamed lead';
}

export default function EmailSequenceDetail() {
  const navigate = useNavigate();
  const { sequenceId } = useParams();
  const sequence = useApiData<SequenceDetail>(sequenceId ? `/email/sequences/${sequenceId}` : '', [sequenceId], Boolean(sequenceId));

  if (sequence.loading) {
    return <LoadingState label="Loading email sequence..." />;
  }

  if (sequence.error || !sequence.data) {
    return <ErrorState message={sequence.error || 'Email sequence not found.'} onRetry={() => void sequence.reload()} />;
  }

  const detail = sequence.data;

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
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">{detail.name}</h1>
              <p className="mt-1 text-sm text-gray-500">{detail.description || 'No description provided.'}</p>
            </div>
            <EmailNav />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button variant="outline" onClick={() => navigate(`/email/sequences/${detail.id}/edit`)}>
              Edit Sequence
            </Button>
            <Button className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]" onClick={() => navigate(`/email/sequences/${detail.id}/enroll`)}>
              <Plus className="mr-2 h-4 w-4" />
              Enroll Leads
            </Button>
          </div>
        </div>
      </div>

      <div className="p-8">
        <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-4">
          {[
            { label: 'Active Enrollments', value: detail.stats.active, icon: Users },
            { label: 'Completed', value: detail.stats.completed, icon: Mail },
            { label: 'Unsubscribed', value: detail.stats.unsubscribed, icon: Users },
            { label: 'Completion Rate', value: `${detail.stats.completionRate.toFixed(1)}%`, icon: Mail },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <Card key={item.label} className="rounded-lg border border-gray-200 p-6 shadow-sm">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="mb-1 text-sm text-gray-600">{item.label}</p>
                    <h3 className="text-3xl font-semibold text-[#1E3A5F]">{item.value}</h3>
                  </div>
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-[#0EA5E9]">
                    <Icon className="h-6 w-6" />
                  </div>
                </div>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
          <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Sequence Steps</h3>
              <Link to={`/email/sequences/${detail.id}/edit`} className="text-sm font-medium text-[#0EA5E9] hover:underline">
                Edit
              </Link>
            </div>
            <div className="mt-4 space-y-4">
              {detail.steps.map((step) => (
                <div key={step.id} className="rounded-lg border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-[#1E3A5F]">Step {step.stepNumber}</p>
                    <p className="text-xs text-gray-500">
                      Delay {step.delayDays}d {step.delayHours}h
                    </p>
                  </div>
                  <p className="mt-2 text-sm font-medium text-gray-700">{step.subject || step.template.subject}</p>
                  <p className="mt-1 text-sm text-gray-500">{step.template.name}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {step.template.variables.map((variable) => (
                      <span key={variable} className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                        {`{{${variable}}}`}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-semibold text-[#1E3A5F]">Enrolled Leads</h3>
              <span className="text-sm text-gray-500">{detail.enrollments.length} records</span>
            </div>
            {detail.enrollments.length === 0 ? (
              <div className="mt-4">
                <EmptyState title="No enrolled leads yet" description="Use the enroll flow to add leads to this sequence." />
              </div>
            ) : (
              <div className="mt-4 overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Lead</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Current Step</th>
                      <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Next Send</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.enrollments.map((enrollment) => (
                      <tr key={enrollment.id} className="border-b border-gray-100">
                        <td className="px-4 py-4">
                          <div className="text-sm font-medium text-[#1E3A5F]">{fullName(enrollment.lead)}</div>
                          <div className="text-xs text-gray-500">{enrollment.lead.company || enrollment.lead.email}</div>
                        </td>
                        <td className="px-4 py-4 text-sm text-gray-700">{enrollment.status}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">Step {enrollment.currentStep}</td>
                        <td className="px-4 py-4 text-sm text-gray-700">
                          {enrollment.nextSendAt ? new Date(enrollment.nextSendAt).toLocaleString() : 'No next send scheduled'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
