import { useState } from 'react';
import { Edit, Send, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Badge } from '../components/ui/badge';
import { Input } from '../components/ui/input';

interface User {
  name: string;
  initials: string;
  role: string;
  roleBadgeColor: string;
  email: string;
  lastActive: string;
  status: 'Active' | 'Inactive';
}

const users: User[] = [
  {
    name: 'James Peterson',
    initials: 'JP',
    role: 'Admin',
    roleBadgeColor: 'bg-purple-100 text-purple-800',
    email: 'james.peterson@pinnacle.com',
    lastActive: '2 hours ago',
    status: 'Active',
  },
  {
    name: 'Sarah Mitchell',
    initials: 'SM',
    role: 'Advisor',
    roleBadgeColor: 'bg-blue-100 text-blue-800',
    email: 'sarah.mitchell@pinnacle.com',
    lastActive: '1 hour ago',
    status: 'Active',
  },
  {
    name: 'Michael Chen',
    initials: 'MC',
    role: 'Advisor',
    roleBadgeColor: 'bg-blue-100 text-blue-800',
    email: 'michael.chen@pinnacle.com',
    lastActive: '3 hours ago',
    status: 'Active',
  },
  {
    name: 'Jennifer Walsh',
    initials: 'JW',
    role: 'Advisor',
    roleBadgeColor: 'bg-blue-100 text-blue-800',
    email: 'jennifer.walsh@pinnacle.com',
    lastActive: '30 minutes ago',
    status: 'Active',
  },
  {
    name: 'David Park',
    initials: 'DP',
    role: 'Advisor',
    roleBadgeColor: 'bg-blue-100 text-blue-800',
    email: 'david.park@pinnacle.com',
    lastActive: '5 hours ago',
    status: 'Active',
  },
  {
    name: 'Lisa Nguyen',
    initials: 'LN',
    role: 'Advisor',
    roleBadgeColor: 'bg-blue-100 text-blue-800',
    email: 'lisa.nguyen@pinnacle.com',
    lastActive: '2 hours ago',
    status: 'Active',
  },
  {
    name: 'Tom Bradley',
    initials: 'TB',
    role: 'Advisor',
    roleBadgeColor: 'bg-blue-100 text-blue-800',
    email: 'tom.bradley@pinnacle.com',
    lastActive: '3 days ago',
    status: 'Inactive',
  },
  {
    name: 'Rachel Torres',
    initials: 'RT',
    role: 'Compliance Officer',
    roleBadgeColor: 'bg-amber-100 text-amber-800',
    email: 'rachel.torres@pinnacle.com',
    lastActive: '4 hours ago',
    status: 'Active',
  },
];

interface PendingInvite {
  email: string;
  role: string;
  sentDate: string;
}

const pendingInvites: PendingInvite[] = [
  {
    email: 'alex.johnson@pinnacle.com',
    role: 'Advisor',
    sentDate: '2 days ago',
  },
  {
    email: 'emily.rodriguez@pinnacle.com',
    role: 'Advisor',
    sentDate: '5 days ago',
  },
];

export default function UserManagement() {
  const [roleFilter, setRoleFilter] = useState('All Roles');
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [editedUsers, setEditedUsers] = useState<{ [key: string]: { name: string; email: string; role: string } }>({});
  const [userStatuses, setUserStatuses] = useState<{ [key: string]: 'Active' | 'Inactive' }>(
    users.reduce((acc, user) => ({ ...acc, [user.email]: user.status }), {})
  );
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteName, setInviteName] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('Advisor');
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [invites, setInvites] = useState<PendingInvite[]>(pendingInvites);
  const [resendingInvite, setResendingInvite] = useState<string | null>(null);
  const [confirmingCancel, setConfirmingCancel] = useState<string | null>(null);

  const filteredUsers = roleFilter === 'All Roles' 
    ? users 
    : users.filter(user => user.role === roleFilter);

  const toggleUserStatus = (email: string) => {
    setUserStatuses(prev => ({
      ...prev,
      [email]: prev[email] === 'Active' ? 'Inactive' : 'Active'
    }));
  };

  const handleSendInvite = () => {
    setToastMessage('Invitation sent!');
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
    setShowInviteModal(false);
    setInviteName('');
    setInviteEmail('');
    setInviteRole('Advisor');
  };

  const handleResendInvite = (email: string) => {
    setResendingInvite(email);
    setTimeout(() => {
      setResendingInvite(null);
      setToastMessage('Invite resent!');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    }, 600);
  };

  const handleCancelInvite = (email: string) => {
    setInvites(invites.filter(inv => inv.email !== email));
    setConfirmingCancel(null);
  };

  const handleEdit = (userEmail: string, user: User) => {
    setEditingUserId(userEmail);
    setEditedUsers({
      ...editedUsers,
      [userEmail]: {
        name: user.name,
        email: user.email,
        role: user.role,
      },
    });
  };

  const handleSave = (userEmail: string) => {
    // In a real app, this would save to backend
    setEditingUserId(null);
  };

  const handleCancel = () => {
    setEditingUserId(null);
  };

  const updateEditedUser = (userEmail: string, field: string, value: string) => {
    setEditedUsers({
      ...editedUsers,
      [userEmail]: {
        ...editedUsers[userEmail],
        [field]: value,
      },
    });
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">User Management</h1>
            <p className="text-sm text-gray-500 mt-1">Manage team members and permissions</p>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => setShowInviteModal(true)}>
            + Invite User
          </Button>
        </div>
      </div>

      <div className="p-8">
        {/* Filter Bar */}
        <div className="mb-6">
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
          >
            <option>All Roles</option>
            <option>Advisor</option>
            <option>Admin</option>
            <option>Compliance Officer</option>
          </select>
        </div>

        {/* Users Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 mb-8">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Last Active
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => {
                  const isEditing = editingUserId === user.email;
                  const editedData = editedUsers[user.email] || { name: user.name, email: user.email, role: user.role };
                  
                  return (
                  <tr key={user.email} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white font-medium text-sm">
                          {user.initials}
                        </div>
                        {isEditing ? (
                          <input
                            type="text"
                            value={editedData.name}
                            onChange={(e) => updateEditedUser(user.email, 'name', e.target.value)}
                            className="text-sm font-medium text-[#1E3A5F] border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                          />
                        ) : (
                          <span className="text-sm font-medium text-[#1E3A5F]">{user.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isEditing ? (
                        <select
                          value={editedData.role}
                          onChange={(e) => updateEditedUser(user.email, 'role', e.target.value)}
                          className="text-sm border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                        >
                          <option>Advisor</option>
                          <option>Admin</option>
                          <option>Compliance Officer</option>
                        </select>
                      ) : (
                        <Badge className={`${user.roleBadgeColor} hover:${user.roleBadgeColor}`}>
                          {user.role}
                        </Badge>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {isEditing ? (
                        <input
                          type="email"
                          value={editedData.email}
                          onChange={(e) => updateEditedUser(user.email, 'email', e.target.value)}
                          className="text-sm text-gray-700 border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] w-full"
                        />
                      ) : (
                        user.email
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {user.lastActive}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge
                        className={
                          userStatuses[user.email] === 'Active'
                            ? 'bg-green-100 text-green-800 hover:bg-green-100'
                            : 'bg-gray-100 text-gray-800 hover:bg-gray-100'
                        }
                      >
                        {userStatuses[user.email]}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {isEditing ? (
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => handleSave(user.email)}
                            className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs h-8"
                          >
                            Save
                          </Button>
                          <Button
                            onClick={handleCancel}
                            className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 text-xs h-8"
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <>
                          <button 
                            onClick={() => handleEdit(user.email, user)}
                            className="text-[#0EA5E9] hover:text-[#0284C7] mr-4 inline-flex items-center gap-1"
                          >
                            <Edit className="w-4 h-4" />
                            Edit
                          </button>
                          <button className="text-gray-500 hover:text-red-600" onClick={() => toggleUserStatus(user.email)}>
                            {userStatuses[user.email] === 'Active' ? 'Deactivate' : 'Activate'}
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Pending Invites */}
        <Card className="rounded-lg shadow-sm border border-gray-200">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-[#1E3A5F]">Pending Invites</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {invites.map((invite) => (
                  <tr key={invite.email} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {invite.email}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Badge className="bg-gray-100 text-gray-800 hover:bg-gray-100">
                        {invite.role}
                      </Badge>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {invite.sentDate}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button className="text-[#0EA5E9] hover:text-[#0284C7] mr-4 inline-flex items-center gap-1" onClick={() => handleResendInvite(invite.email)}>
                        <Send className="w-4 h-4" />
                        Resend
                      </button>
                      <button className="text-gray-500 hover:text-red-600 inline-flex items-center gap-1" onClick={() => setConfirmingCancel(invite.email)}>
                        <X className="w-4 h-4" />
                        Cancel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Invite Modal */}
      {showInviteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-semibold text-[#1E3A5F] mb-4">Invite User</h2>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <Input
                type="text"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="mt-1 block w-full"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <Input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1 block w-full"
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value)}
                className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
              >
                <option>Advisor</option>
                <option>Admin</option>
                <option>Compliance Officer</option>
              </select>
            </div>
            <div className="flex justify-end">
              <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white mr-4" onClick={handleSendInvite}>
                Send Invite
              </Button>
              <Button className="bg-gray-300 hover:bg-gray-400 text-gray-700" onClick={() => setShowInviteModal(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-gray-800 text-white px-4 py-2 rounded-lg shadow-lg">
          {toastMessage}
        </div>
      )}

      {/* Confirm Cancel Invite */}
      {confirmingCancel && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
          <div className="bg-white p-8 rounded-lg shadow-lg w-96">
            <h2 className="text-xl font-semibold text-[#1E3A5F] mb-4">Cancel Invite</h2>
            <p className="text-sm text-gray-700 mb-4">Are you sure you want to cancel the invite for {confirmingCancel}?</p>
            <div className="flex justify-end">
              <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white mr-4" onClick={() => handleCancelInvite(confirmingCancel)}>
                Cancel Invite
              </Button>
              <Button className="bg-gray-300 hover:bg-gray-400 text-gray-700" onClick={() => setConfirmingCancel(null)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}