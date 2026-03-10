import { useState } from 'react';
import { Search, FileDown, ChevronLeft, ChevronRight, Eye, UserCog } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { useNavigate } from 'react-router';

interface PlatformUser {
  id: number;
  name: string;
  email: string;
  initials: string;
  role: 'Advisor' | 'Admin' | 'Compliance Officer' | 'Super Admin';
  organization: string;
  lastActive: string;
  status: 'Active' | 'Inactive';
}

const users: PlatformUser[] = [
  {
    id: 1,
    name: 'James Peterson',
    email: 'james@pinnacle.com',
    initials: 'JP',
    role: 'Admin',
    organization: 'Pinnacle Financial',
    lastActive: '2 min ago',
    status: 'Active',
  },
  {
    id: 2,
    name: 'Sarah Mitchell',
    email: 'sarah@pinnacle.com',
    initials: 'SM',
    role: 'Advisor',
    organization: 'Pinnacle Financial',
    lastActive: '1 hr ago',
    status: 'Active',
  },
  {
    id: 3,
    name: 'Michael Chen',
    email: 'michael@pinnacle.com',
    initials: 'MC',
    role: 'Advisor',
    organization: 'Pinnacle Financial',
    lastActive: '3 hrs ago',
    status: 'Active',
  },
  {
    id: 4,
    name: 'Jennifer Walsh',
    email: 'jennifer@pinnacle.com',
    initials: 'JW',
    role: 'Advisor',
    organization: 'Pinnacle Financial',
    lastActive: '5 hrs ago',
    status: 'Active',
  },
  {
    id: 5,
    name: 'Rachel Torres',
    email: 'rachel@pinnacle.com',
    initials: 'RT',
    role: 'Compliance Officer',
    organization: 'Pinnacle Financial',
    lastActive: '30 min ago',
    status: 'Active',
  },
  {
    id: 6,
    name: 'David Chen',
    email: 'david@summit-wealth.com',
    initials: 'DC',
    role: 'Admin',
    organization: 'Summit Wealth',
    lastActive: '15 min ago',
    status: 'Active',
  },
  {
    id: 7,
    name: 'Amanda Foster',
    email: 'amanda@summit-wealth.com',
    initials: 'AF',
    role: 'Advisor',
    organization: 'Summit Wealth',
    lastActive: '2 hrs ago',
    status: 'Active',
  },
  {
    id: 8,
    name: 'Robert Kim',
    email: 'robert@summit-wealth.com',
    initials: 'RK',
    role: 'Advisor',
    organization: 'Summit Wealth',
    lastActive: '1 day ago',
    status: 'Active',
  },
  {
    id: 9,
    name: 'Linda Park',
    email: 'linda@summit-wealth.com',
    initials: 'LP',
    role: 'Advisor',
    organization: 'Summit Wealth',
    lastActive: '2 days ago',
    status: 'Active',
  },
  {
    id: 10,
    name: 'Carlos Rivera',
    email: 'carlos@meridian.com',
    initials: 'CR',
    role: 'Admin',
    organization: 'Meridian Partners',
    lastActive: '4 hrs ago',
    status: 'Active',
  },
  {
    id: 11,
    name: 'Susan Lee',
    email: 'susan@meridian.com',
    initials: 'SL',
    role: 'Advisor',
    organization: 'Meridian Partners',
    lastActive: '6 hrs ago',
    status: 'Active',
  },
  {
    id: 12,
    name: 'Tom Bradley',
    email: 'tom@pinnacle.com',
    initials: 'TB',
    role: 'Advisor',
    organization: 'Pinnacle Financial',
    lastActive: '3 days ago',
    status: 'Inactive',
  },
  {
    id: 13,
    name: 'Patricia Wong',
    email: 'patricia@peak.com',
    initials: 'PW',
    role: 'Admin',
    organization: 'Peak Financial Group',
    lastActive: '20 min ago',
    status: 'Active',
  },
  {
    id: 14,
    name: "Kevin O'Brien",
    email: 'kevin@peak.com',
    initials: 'KO',
    role: 'Advisor',
    organization: 'Peak Financial Group',
    lastActive: '1 hr ago',
    status: 'Active',
  },
  {
    id: 15,
    name: 'Maria Santos',
    email: 'maria@harbor.com',
    initials: 'MS',
    role: 'Advisor',
    organization: 'Harbor Wealth',
    lastActive: '2 hrs ago',
    status: 'Active',
  },
];

const getRoleBadge = (role: string) => {
  const colors = {
    Advisor: 'bg-[#0EA5E9] text-white',
    Admin: 'bg-purple-600 text-white',
    'Compliance Officer': 'bg-orange-600 text-white',
    'Super Admin': 'bg-red-600 text-white',
  };
  return colors[role as keyof typeof colors] || 'bg-gray-100 text-gray-700';
};

export default function PlatformUsers() {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [orgFilter, setOrgFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('active');
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  const filteredUsers = users.filter((user) => {
    if (searchTerm && !user.name.toLowerCase().includes(searchTerm.toLowerCase()) && !user.email.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (orgFilter !== 'all' && user.organization !== orgFilter) return false;
    if (roleFilter !== 'all' && user.role !== roleFilter) return false;
    if (statusFilter === 'active' && user.status !== 'Active') return false;
    return true;
  });

  const totalPages = Math.ceil(filteredUsers.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentData = filteredUsers.slice(startIndex, endIndex);

  const toggleUserSelection = (userId: number) => {
    setSelectedUsers((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const toggleAllSelection = () => {
    if (selectedUsers.length === currentData.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(currentData.map((u) => u.id));
    }
  };

  const handleImpersonate = (user: PlatformUser) => {
    // Set localStorage to match the user's credentials
    localStorage.setItem('vireos_role', user.role.toLowerCase().replace(' ', '-'));
    localStorage.setItem('vireos_user_name', user.name);
    localStorage.setItem('vireos_user_initials', user.initials);

    // Navigate based on role
    switch (user.role) {
      case 'Advisor':
        navigate('/home');
        break;
      case 'Admin':
        navigate('/admin/home');
        break;
      case 'Compliance Officer':
        navigate('/compliance-officer/home');
        break;
      case 'Super Admin':
        navigate('/super-admin/home');
        break;
      default:
        navigate('/home');
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Platform Users</h1>
            <p className="text-sm text-gray-500 mt-1">Manage all users across organizations</p>
          </div>
          <Button className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50">
            <FileDown className="w-4 h-4 mr-2" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="p-8">
        {/* Filter Row */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search users..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={orgFilter}
            onChange={(e) => setOrgFilter(e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="all">All Organizations</option>
            <option value="Pinnacle Financial">Pinnacle Financial</option>
            <option value="Summit Wealth">Summit Wealth</option>
            <option value="Meridian Partners">Meridian Partners</option>
            <option value="Peak Financial Group">Peak Financial Group</option>
            <option value="Harbor Wealth">Harbor Wealth</option>
          </select>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="all">All Roles</option>
            <option value="Advisor">Advisor</option>
            <option value="Admin">Admin</option>
            <option value="Compliance Officer">Compliance Officer</option>
            <option value="Super Admin">Super Admin</option>
          </select>
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                statusFilter === 'active'
                  ? 'bg-white text-[#1E3A5F] shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Active
            </button>
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 text-sm font-medium rounded transition-colors ${
                statusFilter === 'all'
                  ? 'bg-white text-[#1E3A5F] shadow-sm'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              All
            </button>
          </div>
        </div>

        {/* Bulk Action Bar */}
        {selectedUsers.length > 0 && (
          <div className="mb-4 bg-[#0EA5E9] text-white rounded-lg px-6 py-3 flex items-center justify-between">
            <span className="font-medium">{selectedUsers.length} user(s) selected</span>
            <div className="flex gap-2">
              <Button className="bg-white text-[#0EA5E9] hover:bg-gray-100 text-sm h-8">
                Deactivate Selected
              </Button>
              <Button className="bg-white text-[#0EA5E9] hover:bg-gray-100 text-sm h-8">
                Export Selected
              </Button>
              <Button className="bg-white text-[#0EA5E9] hover:bg-gray-100 text-sm h-8">
                Send Email
              </Button>
            </div>
          </div>
        )}

        {/* Users Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedUsers.length === currentData.length && currentData.length > 0}
                      onChange={toggleAllSelection}
                      className="w-4 h-4 text-[#0EA5E9] rounded focus:ring-[#0EA5E9]"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
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
                {currentData.map((user) => (
                  <tr
                    key={user.id}
                    className={`hover:bg-gray-50 ${user.status === 'Inactive' ? 'opacity-50' : ''}`}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(user.id)}
                        onChange={() => toggleUserSelection(user.id)}
                        className="w-4 h-4 text-[#0EA5E9] rounded focus:ring-[#0EA5E9]"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white font-medium text-sm">
                          {user.initials}
                        </div>
                        <div>
                          <p className="text-sm font-medium text-[#1E3A5F]">{user.name}</p>
                          <p className="text-xs text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getRoleBadge(user.role)}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {user.organization}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                      {user.lastActive}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                          user.status === 'Active'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {user.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <Button className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 text-xs h-8">
                          <Eye className="w-3 h-3 mr-1" />
                          View Profile
                        </Button>
                        <Button
                          className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs h-8"
                          onClick={() => handleImpersonate(user)}
                        >
                          <UserCog className="w-3 h-3 mr-1" />
                          Impersonate
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Showing {startIndex + 1}-{Math.min(endIndex, filteredUsers.length)} of {filteredUsers.length} users
              <span className="text-gray-500 ml-2">(187 total platform users)</span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <span className="text-sm text-gray-700 px-2">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="bg-white text-gray-700 border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}