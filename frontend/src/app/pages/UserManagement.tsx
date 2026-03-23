import { useState } from 'react';
import { UserMinus } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';
import { EmptyState } from '../components/ui/empty-state';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { useApiData } from '../hooks/useApiData';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api-client';

interface Member {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'ADMIN' | 'ADVISOR' | 'COMPLIANCE' | 'SUPER_ADMIN';
  status: string;
  lastLoginAt?: string | null;
}

interface MemberResponse {
  items: Member[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  };
}

export default function UserManagement() {
  const { user } = useAuth();
  const orgId = user?.organization?.id ?? user?.orgId ?? '';
  const members = useApiData<{ data: MemberResponse } | MemberResponse>(`/organizations/${orgId}/members?page=1&limit=50`, [orgId], Boolean(orgId));
  const [showInvite, setShowInvite] = useState(false);
  const [inviteFirstName, setInviteFirstName] = useState('');
  const [inviteLastName, setInviteLastName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'ADMIN' | 'ADVISOR' | 'COMPLIANCE'>('ADVISOR');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [rowActionId, setRowActionId] = useState<string | null>(null);

  const response = members.data && 'items' in members.data ? members.data : members.data?.data;
  const rows = response?.items ?? [];

  const handleInvite = async () => {
    if (!orgId) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const created = await apiClient.post<Member>(`/organizations/${orgId}/members/invite`, {
        email: inviteEmail,
        firstName: inviteFirstName,
        lastName: inviteLastName,
        role: inviteRole,
      });

      members.setData((current) => {
        const currentResponse = current && 'items' in current ? current : current?.data;
        if (!currentResponse) return current;
        const next = { ...currentResponse, items: [created, ...currentResponse.items] };
        return ('items' in (current ?? {})) ? next as typeof current : { data: next } as typeof current;
      });
      setShowInvite(false);
      setInviteFirstName('');
      setInviteLastName('');
      setInviteEmail('');
      setInviteRole('ADVISOR');
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to invite member.');
    } finally {
      setSubmitting(false);
    }
  };

  const updateMember = (memberId: string, updater: (member: Member) => Member) => {
    members.setData((current) => {
      const currentResponse = current && 'items' in current ? current : current?.data;
      if (!currentResponse) return current;
      const next = {
        ...currentResponse,
        items: currentResponse.items.map((member) => (member.id === memberId ? updater(member) : member)),
      };
      return ('items' in (current ?? {})) ? next as typeof current : { data: next } as typeof current;
    });
  };

  const handleRoleChange = async (memberId: string, role: Member['role']) => {
    if (!orgId) return;
    setRowActionId(memberId);
    setSubmitError(null);
    try {
      const updated = await apiClient.put<Member>(`/organizations/${orgId}/members/${memberId}/role`, { role });
      updateMember(memberId, () => updated);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to update role.');
    } finally {
      setRowActionId(null);
    }
  };

  const handleDeactivate = async (memberId: string) => {
    if (!orgId) return;
    setRowActionId(memberId);
    setSubmitError(null);
    try {
      await apiClient.del(`/organizations/${orgId}/members/${memberId}`);
      updateMember(memberId, (member) => ({ ...member, status: 'INACTIVE' }));
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to deactivate member.');
    } finally {
      setRowActionId(null);
    }
  };

  if (members.loading) return <LoadingState label="Loading organization members..." />;
  if (members.error) return <ErrorState message={members.error} onRetry={() => void members.reload()} />;

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => setShowInvite((value) => !value)}>
            {showInvite ? 'Close Invite' : '+ Invite User'}
          </Button>
        </div>
      </div>

      <div className="p-8 space-y-6">
        {showInvite ? (
          <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F] mb-4">Invite Team Member</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input value={inviteFirstName} onChange={(event) => setInviteFirstName(event.target.value)} placeholder="First name" />
              <Input value={inviteLastName} onChange={(event) => setInviteLastName(event.target.value)} placeholder="Last name" />
              <Input value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="Email address" className="md:col-span-2" />
              <select className="rounded-md border border-gray-300 bg-white px-3 py-2 text-sm" value={inviteRole} onChange={(event) => setInviteRole(event.target.value as typeof inviteRole)}>
                <option value="ADVISOR">Advisor</option>
                <option value="ADMIN">Admin</option>
                <option value="COMPLIANCE">Compliance</option>
              </select>
            </div>
            {submitError ? <p className="mt-4 text-sm text-red-600">{submitError}</p> : null}
            <div className="mt-4 flex justify-end">
              <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handleInvite()} disabled={submitting || !inviteEmail || !inviteFirstName || !inviteLastName}>
                {submitting ? 'Sending...' : 'Send Invite'}
              </Button>
            </div>
          </Card>
        ) : null}
        {submitError ? <p className="text-sm text-red-600">{submitError}</p> : null}

        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          {rows.length === 0 ? (
            <div className="p-10">
              <EmptyState title="No organization members found" description="Invited members will appear here once they have joined the organization." />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">User</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Login</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {rows.map((member) => (
                    <tr key={member.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-[#1E3A5F]">{member.firstName} {member.lastName}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <select
                          className="rounded-md border border-gray-300 bg-white px-2 py-1 text-sm"
                          value={member.role}
                          onChange={(event) => void handleRoleChange(member.id, event.target.value as Member['role'])}
                          disabled={rowActionId === member.id || member.id === user?.id || member.status === 'INACTIVE'}
                        >
                          <option value="ADMIN">Admin</option>
                          <option value="ADVISOR">Advisor</option>
                          <option value="COMPLIANCE">Compliance</option>
                        </select>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{member.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{member.lastLoginAt ? new Date(member.lastLoginAt).toLocaleString() : 'Never'}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Badge className={member.status === 'ACTIVE' ? 'bg-green-100 text-green-700 border-0' : 'bg-gray-100 text-gray-700 border-0'}>{member.status}</Badge>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        {member.status === 'ACTIVE' && member.id !== user?.id ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDeactivate(member.id)}
                            disabled={rowActionId === member.id}
                          >
                            <UserMinus className="mr-2 h-4 w-4" />
                            {rowActionId === member.id ? 'Updating...' : 'Deactivate'}
                          </Button>
                        ) : (
                          <span className="text-xs text-gray-400">{member.id === user?.id ? 'Current user' : 'Inactive'}</span>
                        )}
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
  );
}
