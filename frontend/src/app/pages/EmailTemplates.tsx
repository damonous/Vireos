import { Copy, Eye, Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { apiClient } from '../lib/api-client';
import { useApiData } from '../hooks/useApiData';
import { EmailNav } from './email/EmailNav';

interface TemplateRow {
  id: string;
  name: string;
  subject: string;
  variables: string[];
  htmlContent: string;
  textContent?: string | null;
  createdAt: string;
}

interface TemplateList {
  items: TemplateRow[];
}

export default function EmailTemplates() {
  const navigate = useNavigate();
  const templates = useApiData<TemplateList>('/email/templates?page=1&limit=100');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [duplicatingId, setDuplicatingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const rows = templates.data?.items ?? [];
  const previewTemplate = useMemo(
    () => rows.find((template) => template.id === previewId) ?? null,
    [previewId, rows]
  );

  if (templates.loading) {
    return <LoadingState label="Loading email templates..." />;
  }

  if (templates.error) {
    return <ErrorState message={templates.error} onRetry={() => void templates.reload()} />;
  }

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="border-b border-gray-200 bg-white px-8 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div>
              <h1 className="text-2xl font-semibold text-[#1E3A5F]">Email Templates</h1>
              <p className="mt-1 text-sm text-gray-500">Create, preview, and edit reusable Mailgun template content.</p>
            </div>
            <EmailNav />
          </div>
          <Button className="bg-[#0EA5E9] text-white hover:bg-[#0284C7]" onClick={() => navigate('/email/templates/new')}>
            <Plus className="mr-2 h-4 w-4" />
            New Template
          </Button>
        </div>
      </div>

      <div className="grid gap-6 p-8 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card className="overflow-hidden rounded-lg border border-gray-200 shadow-sm">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-[#1E3A5F]">Template Library</h3>
            <p className="mt-1 text-sm text-gray-500">Preview variables before binding templates to sequence steps.</p>
          </div>
          {rows.length === 0 ? (
            <div className="px-6 pb-6">
              <EmptyState title="No templates yet" description="Create your first reusable email template to unlock the sequence builder." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Subject</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Variables</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Created</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((template) => (
                    <tr key={template.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-4 py-4 text-sm font-medium text-[#1E3A5F]">{template.name}</td>
                      <td className="px-4 py-4 text-sm text-gray-700">{template.subject}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {template.variables.length === 0 ? (
                            <span className="text-sm text-gray-400">No variables</span>
                          ) : (
                            template.variables.map((variable) => (
                              <span key={variable} className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                                {`{{${variable}}}`}
                              </span>
                            ))
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-sm text-gray-700">{new Date(template.createdAt).toLocaleDateString()}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-3">
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-sm font-medium text-[#0EA5E9] hover:underline"
                            onClick={() => setPreviewId(template.id)}
                          >
                            <Eye className="h-4 w-4" />
                            Preview
                          </button>
                          <Link to={`/email/templates/${template.id}/edit`} className="inline-flex items-center gap-1 text-sm font-medium text-[#0EA5E9] hover:underline">
                            <Pencil className="h-4 w-4" />
                            Edit
                          </Link>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-sm font-medium text-[#0EA5E9] hover:underline"
                            disabled={duplicatingId === template.id}
                            onClick={() => {
                              setDuplicatingId(template.id);
                              setActionError(null);
                              void apiClient
                                .post(`/email/templates/${template.id}/duplicate`)
                                .then(() => templates.reload())
                                .catch((error) => setActionError(error instanceof Error ? error.message : 'Failed to duplicate template.'))
                                .finally(() => setDuplicatingId(null));
                            }}
                          >
                            <Copy className="h-4 w-4" />
                            {duplicatingId === template.id ? 'Duplicating...' : 'Duplicate'}
                          </button>
                          <button
                            type="button"
                            className="inline-flex items-center gap-1 text-sm font-medium text-red-600 hover:underline"
                            disabled={deletingId === template.id}
                            onClick={() => {
                              setDeletingId(template.id);
                              setActionError(null);
                              void apiClient
                                .del(`/email/templates/${template.id}`)
                                .then(() => templates.reload())
                                .catch((error) => setActionError(error instanceof Error ? error.message : 'Failed to delete template.'))
                                .finally(() => setDeletingId(null));
                            }}
                          >
                            <Trash2 className="h-4 w-4" />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {actionError ? <p className="px-6 py-4 text-sm text-red-600">{actionError}</p> : null}
        </Card>

        <Card className="rounded-lg border border-gray-200 p-6 shadow-sm">
          <h3 className="text-lg font-semibold text-[#1E3A5F]">Preview</h3>
          {!previewTemplate ? (
            <EmptyState title="Select a template" description="Use Preview on any row to inspect the rendered subject and body." />
          ) : (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Subject</p>
                <p className="mt-1 text-sm font-medium text-[#1E3A5F]">{previewTemplate.subject}</p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Variables</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {previewTemplate.variables.length === 0 ? (
                    <span className="text-sm text-gray-500">No variables extracted.</span>
                  ) : (
                    previewTemplate.variables.map((variable) => (
                      <span key={variable} className="rounded-full bg-sky-50 px-2 py-1 text-xs font-medium text-sky-700">
                        {`{{${variable}}}`}
                      </span>
                    ))
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">HTML Body</p>
                <div className="mt-2 rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-700">
                  <div dangerouslySetInnerHTML={{ __html: previewTemplate.htmlContent }} />
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Plain Text</p>
                <pre className="mt-2 whitespace-pre-wrap rounded-lg border border-gray-200 bg-slate-950 p-4 text-sm text-slate-100">
                  {previewTemplate.textContent || 'No plain text body provided.'}
                </pre>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
