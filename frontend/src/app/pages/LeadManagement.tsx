import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Facebook, Linkedin, LoaderCircle, Plus, Users as UsersIcon, X } from 'lucide-react';
import { Label } from '../components/ui/label';
import { Card } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { apiClient } from '../lib/api-client';

interface Lead {
  id: string;
  firstName?: string | null;
  lastName?: string | null;
  email?: string | null;
  company?: string | null;
  status: string;
  source?: string | null;
}

interface CreateLeadForm {
  firstName: string;
  lastName: string;
  email: string;
  company: string;
  title: string;
  phone: string;
  source: 'WEBSITE' | 'LINKEDIN' | 'FACEBOOK_ADS' | 'PROSPECT_FINDER' | 'MANUAL_IMPORT';
}

const columns = [
  { key: 'NEW', label: 'New', color: 'bg-blue-50' },
  { key: 'CONTACTED', label: 'Contacted', color: 'bg-amber-50' },
  { key: 'ENGAGED', label: 'Engaged', color: 'bg-cyan-50' },
  { key: 'MEETING_SCHEDULED', label: 'Meeting', color: 'bg-purple-50' },
  { key: 'CLIENT', label: 'Closed Won', color: 'bg-green-50' },
  { key: 'LOST', label: 'Closed Lost', color: 'bg-slate-100' },
] as const;

type LeadStatus = typeof columns[number]['key'];

function isLeadStatus(value: string): value is LeadStatus {
  return columns.some((column) => column.key === value);
}

function fullName(lead: Lead): string {
  return `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim() || lead.email || 'Unnamed lead';
}

function humanizeLabel(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function LeadManagement() {
  const [search, setSearch] = useState('');
  const [dragLeadId, setDragLeadId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<LeadStatus | null>(null);
  const [pendingLeadId, setPendingLeadId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [submittingLead, setSubmittingLead] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<CreateLeadForm>({
    firstName: '',
    lastName: '',
    email: '',
    company: '',
    title: '',
    phone: '',
    source: 'WEBSITE',
  });
  const leads = useApiData<Lead[]>(`/leads?page=1&limit=50${search ? `&search=${encodeURIComponent(search)}` : ''}`, [search]);
  const rows = Array.isArray(leads.data) ? leads.data : [];
  const grouped = useMemo(() => ({
    NEW: rows.filter((item) => item.status === 'NEW'),
    CONTACTED: rows.filter((item) => item.status === 'CONTACTED'),
    ENGAGED: rows.filter((item) => item.status === 'ENGAGED'),
    MEETING_SCHEDULED: rows.filter((item) => item.status === 'MEETING_SCHEDULED'),
    CLIENT: rows.filter((item) => item.status === 'CLIENT'),
    LOST: rows.filter((item) => item.status === 'LOST'),
  }), [rows]);

  if (leads.loading) {
    return <LoadingState label="Loading leads..." />;
  }

  if (leads.error) {
    return <ErrorState message={leads.error} onRetry={() => void leads.reload()} />;
  }

  const sourceBadge = (source?: string | null) => {
    const normalized = (source ?? '').toUpperCase();
    if (normalized.includes('LINKEDIN')) {
      return <Badge className="bg-blue-100 text-blue-700 border-0 text-xs"><Linkedin className="w-3 h-3 mr-1" />LinkedIn</Badge>;
    }
    if (normalized.includes('FACEBOOK')) {
      return <Badge className="bg-indigo-100 text-indigo-700 border-0 text-xs"><Facebook className="w-3 h-3 mr-1" />Facebook</Badge>;
    }
    return <Badge className="bg-green-100 text-green-700 border-0 text-xs"><UsersIcon className="w-3 h-3 mr-1" />{source ? humanizeLabel(source) : 'Manual'}</Badge>;
  };

  const setLeadStatusLocal = (leadId: string, status: LeadStatus) => {
    leads.setData((current) => {
      if (!Array.isArray(current)) {
        return current;
      }
      return current.map((item) => (item.id === leadId ? { ...item, status } : item));
    });
  };

  const moveLead = async (lead: Lead, status: LeadStatus) => {
    if (lead.status === status || pendingLeadId === lead.id) {
      return;
    }

    const previousStatus = isLeadStatus(lead.status) ? lead.status : null;
    setActionError(null);
    setPendingLeadId(lead.id);
    setLeadStatusLocal(lead.id, status);

    try {
      await apiClient.patch(`/leads/${lead.id}/status`, { status });
    } catch (err) {
      if (previousStatus) {
        setLeadStatusLocal(lead.id, previousStatus);
      }
      setActionError(err instanceof Error ? err.message : 'Unable to move lead.');
    } finally {
      setPendingLeadId(null);
      setDragLeadId(null);
      setDropTarget(null);
    }
  };

  const resetForm = () => {
    setForm({
      firstName: '',
      lastName: '',
      email: '',
      company: '',
      title: '',
      phone: '',
      source: 'WEBSITE',
    });
    setCreateError(null);
  };

  const handleCreateLead = async () => {
    setCreateError(null);
    setSubmittingLead(true);

    try {
      await apiClient.post('/leads', {
        firstName: form.firstName.trim(),
        lastName: form.lastName.trim(),
        email: form.email.trim(),
        company: form.company.trim() || undefined,
        title: form.title.trim() || undefined,
        phone: form.phone.trim() || undefined,
        source: form.source,
      });
      setShowCreateModal(false);
      resetForm();
      await leads.reload();
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Unable to create lead.');
    } finally {
      setSubmittingLead(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      {showCreateModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-[#1E3A5F]">Add Lead</h2>
                <p className="mt-1 text-sm text-slate-500">Create a real lead record in the live pipeline.</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="grid gap-4 px-6 py-5 md:grid-cols-2">
              <div>
                <Label htmlFor="leadFirstName">First Name</Label>
                <Input
                  id="leadFirstName"
                  name="leadFirstName"
                  value={form.firstName}
                  onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="leadLastName">Last Name</Label>
                <Input
                  id="leadLastName"
                  name="leadLastName"
                  value={form.lastName}
                  onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="leadEmail">Email</Label>
                <Input
                  id="leadEmail"
                  name="leadEmail"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="leadCompany">Company</Label>
                <Input
                  id="leadCompany"
                  name="leadCompany"
                  value={form.company}
                  onChange={(event) => setForm((current) => ({ ...current, company: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="leadTitle">Title</Label>
                <Input
                  id="leadTitle"
                  name="leadTitle"
                  value={form.title}
                  onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
                />
              </div>
              <div>
                <Label htmlFor="leadPhone">Phone</Label>
                <Input
                  id="leadPhone"
                  name="leadPhone"
                  value={form.phone}
                  onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <Label htmlFor="leadSource">Source</Label>
                <select
                  id="leadSource"
                  name="leadSource"
                  value={form.source}
                  onChange={(event) => setForm((current) => ({ ...current, source: event.target.value as CreateLeadForm['source'] }))}
                  className="mt-2 flex h-9 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none ring-offset-white focus:border-sky-500 focus:ring-2 focus:ring-sky-200"
                >
                  <option value="WEBSITE">Website</option>
                  <option value="LINKEDIN">LinkedIn</option>
                  <option value="FACEBOOK_ADS">Facebook Ads</option>
                  <option value="PROSPECT_FINDER">Prospect Finder</option>
                  <option value="MANUAL_IMPORT">Manual Import</option>
                </select>
              </div>
            </div>
            {createError ? <p className="px-6 pb-2 text-sm text-red-600">{createError}</p> : null}
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowCreateModal(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                disabled={submittingLead || !form.firstName.trim() || !form.lastName.trim() || !form.email.trim()}
                onClick={() => void handleCreateLead()}
              >
                {submittingLead ? 'Saving...' : 'Create Lead'}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
      <div className="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Lead Management</h1>
          <p className="text-sm text-gray-500 mt-1">Live lead pipeline. Drag cards between stages or use the arrow controls.</p>
        </div>
        <div className="flex items-center gap-3">
          <Input
            id="leadSearch"
            name="leadSearch"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search leads..."
            className="w-64"
          />
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => setShowCreateModal(true)}>
            <Plus className="w-4 h-4 mr-2" />
            Add Lead
          </Button>
        </div>
      </div>

      <div className="p-8">
        {actionError ? (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {actionError}
          </div>
        ) : null}
        {rows.length === 0 ? (
          <Card className="p-10 rounded-lg shadow-sm border border-gray-200">
            <EmptyState title="No leads yet" description="Leads created from campaigns, imports, or manual entry will appear here." />
          </Card>
        ) : (
          <div className="flex gap-6 overflow-x-auto pb-4">
            {columns.map((column) => {
              const columnRows = grouped[column.key];
              return (
                <div key={column.key} className="flex-shrink-0 w-80">
                  <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
                    <div className={`px-4 py-3 ${column.color} rounded-t-lg border-b border-gray-200`}>
                      <div className="flex items-center justify-between">
                        <h3 className="font-semibold text-[#1E3A5F]">{column.label}</h3>
                        <Badge className="bg-white text-[#1E3A5F] border-0 font-semibold">{columnRows.length}</Badge>
                      </div>
                    </div>
                    <div
                      className={`p-4 max-h-[calc(100vh-280px)] overflow-y-auto min-h-[300px] rounded-b-lg transition-colors ${
                        dropTarget === column.key ? 'bg-sky-50' : ''
                      }`}
                      onDragOver={(event) => {
                        event.preventDefault();
                        if (dragLeadId) {
                          setDropTarget(column.key);
                        }
                      }}
                      onDragLeave={() => {
                        if (dropTarget === column.key) {
                          setDropTarget(null);
                        }
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        const leadId = event.dataTransfer.getData('text/plain') || dragLeadId;
                        const lead = rows.find((item) => item.id === leadId);
                        if (!lead) {
                          setDropTarget(null);
                          return;
                        }
                        void moveLead(lead, column.key);
                      }}
                    >
                      {columnRows.length === 0 ? (
                        <p className="text-sm text-gray-500">No leads in this stage.</p>
                      ) : columnRows.map((lead) => (
                        <div
                          key={lead.id}
                          draggable={pendingLeadId !== lead.id}
                          onDragStart={(event) => {
                            event.dataTransfer.setData('text/plain', lead.id);
                            event.dataTransfer.effectAllowed = 'move';
                            setDragLeadId(lead.id);
                            setActionError(null);
                          }}
                          onDragEnd={() => {
                            setDragLeadId(null);
                            setDropTarget(null);
                          }}
                          className={`p-4 mb-3 rounded-lg shadow-sm border hover:shadow-md transition-shadow bg-white ${
                            dragLeadId === lead.id ? 'border-sky-400 shadow-md' : 'border-gray-200'
                          } ${pendingLeadId === lead.id ? 'opacity-70' : ''}`}
                        >
                          <div className="flex items-start justify-between mb-3">
                            <div className="min-w-0 flex-1">
                              <h4 className="truncate text-sm font-semibold text-[#1E3A5F] mb-1">{fullName(lead)}</h4>
                              <p className="truncate text-xs text-gray-600">{lead.company || 'No company provided'}</p>
                            </div>
                            {pendingLeadId === lead.id ? (
                              <LoaderCircle className="ml-3 h-4 w-4 shrink-0 animate-spin text-sky-600" />
                            ) : null}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="shrink-0">{sourceBadge(lead.source)}</div>
                            <span className="min-w-0 truncate text-right text-xs text-gray-500">{lead.email || 'No email'}</span>
                          </div>
                          <div className="mt-3 flex items-center justify-between border-t border-gray-100 pt-3">
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-gray-600"
                              disabled={pendingLeadId === lead.id || columns.findIndex((item) => item.key === column.key) === 0}
                              onClick={() => {
                                const index = columns.findIndex((item) => item.key === column.key);
                                const previousColumn = columns[index - 1];
                                if (previousColumn) {
                                  void moveLead(lead, previousColumn.key);
                                }
                              }}
                            >
                              <ChevronLeft className="mr-1 h-4 w-4" />
                              Back
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-8 px-2 text-xs text-gray-600"
                              disabled={pendingLeadId === lead.id || columns.findIndex((item) => item.key === column.key) === columns.length - 1}
                              onClick={() => {
                                const index = columns.findIndex((item) => item.key === column.key);
                                const nextColumn = columns[index + 1];
                                if (nextColumn) {
                                  void moveLead(lead, nextColumn.key);
                                }
                              }}
                            >
                              Next
                              <ChevronRight className="ml-1 h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
