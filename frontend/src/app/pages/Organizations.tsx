import { useState } from 'react';
import { Plus, Search, MoreVertical, ChevronDown, ChevronUp, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Fragment } from 'react';

interface Organization {
  id: number;
  name: string;
  domain: string;
  plan: 'Starter' | 'Professional' | 'Enterprise';
  users: number;
  mrr: number;
  status: 'Active' | 'Trial' | 'Suspended';
  joinedDate: string;
  adminContact: string;
  adminEmail: string;
  featureFlags: { name: string; enabled: boolean }[];
  createdBy: string;
  notes: string;
}

const organizations: Organization[] = [
  {
    id: 1,
    name: 'Pinnacle Financial',
    domain: 'pinnacle.com',
    plan: 'Professional',
    users: 8,
    mrr: 299,
    status: 'Active',
    joinedDate: 'Jan 15, 2024',
    adminContact: 'James Peterson',
    adminEmail: 'james@pinnacle.com',
    featureFlags: [
      { name: 'AI Content', enabled: true },
      { name: 'Advanced Analytics', enabled: true },
      { name: 'White Label', enabled: false },
    ],
    createdBy: 'Platform Admin',
    notes: 'Premium customer, excellent retention',
  },
  {
    id: 2,
    name: 'Summit Wealth Management',
    domain: 'summit-wealth.com',
    plan: 'Enterprise',
    users: 24,
    mrr: 899,
    status: 'Active',
    joinedDate: 'Mar 2, 2023',
    adminContact: 'David Chen',
    adminEmail: 'david@summit-wealth.com',
    featureFlags: [
      { name: 'AI Content', enabled: true },
      { name: 'Advanced Analytics', enabled: true },
      { name: 'White Label', enabled: true },
    ],
    createdBy: 'Platform Admin',
    notes: 'Enterprise customer with custom integration',
  },
  {
    id: 3,
    name: 'Blue Ridge Advisors',
    domain: 'blueridge.com',
    plan: 'Professional',
    users: 5,
    mrr: 299,
    status: 'Active',
    joinedDate: 'Jun 8, 2024',
    adminContact: 'Emily Rogers',
    adminEmail: 'emily@blueridge.com',
    featureFlags: [
      { name: 'AI Content', enabled: true },
      { name: 'Advanced Analytics', enabled: false },
      { name: 'White Label', enabled: false },
    ],
    createdBy: 'Platform Admin',
    notes: '',
  },
  {
    id: 4,
    name: 'Coastal Capital',
    domain: 'coastal.com',
    plan: 'Starter',
    users: 2,
    mrr: 99,
    status: 'Trial',
    joinedDate: 'Feb 20, 2026',
    adminContact: 'Mark Williams',
    adminEmail: 'mark@coastal.com',
    featureFlags: [
      { name: 'AI Content', enabled: true },
      { name: 'Advanced Analytics', enabled: false },
      { name: 'White Label', enabled: false },
    ],
    createdBy: 'Self-service signup',
    notes: 'Trial ends March 6, 2026',
  },
  {
    id: 5,
    name: 'Meridian Partners',
    domain: 'meridian.com',
    plan: 'Professional',
    users: 12,
    mrr: 299,
    status: 'Active',
    joinedDate: 'Nov 3, 2023',
    adminContact: 'Carlos Rivera',
    adminEmail: 'carlos@meridian.com',
    featureFlags: [
      { name: 'AI Content', enabled: true },
      { name: 'Advanced Analytics', enabled: true },
      { name: 'White Label', enabled: false },
    ],
    createdBy: 'Platform Admin',
    notes: '',
  },
  {
    id: 6,
    name: 'Peak Financial Group',
    domain: 'peak.com',
    plan: 'Enterprise',
    users: 31,
    mrr: 899,
    status: 'Active',
    joinedDate: 'Aug 19, 2022',
    adminContact: 'Patricia Wong',
    adminEmail: 'patricia@peak.com',
    featureFlags: [
      { name: 'AI Content', enabled: true },
      { name: 'Advanced Analytics', enabled: true },
      { name: 'White Label', enabled: true },
    ],
    createdBy: 'Platform Admin',
    notes: 'Longest-standing customer',
  },
  {
    id: 7,
    name: 'Harbor Wealth',
    domain: 'harbor.com',
    plan: 'Professional',
    users: 7,
    mrr: 299,
    status: 'Active',
    joinedDate: 'Dec 1, 2024',
    adminContact: 'Richard Thompson',
    adminEmail: 'richard@harbor.com',
    featureFlags: [
      { name: 'AI Content', enabled: true },
      { name: 'Advanced Analytics', enabled: true },
      { name: 'White Label', enabled: false },
    ],
    createdBy: 'Platform Admin',
    notes: '',
  },
  {
    id: 8,
    name: 'Sunrise Advisors',
    domain: 'sunrise.com',
    plan: 'Starter',
    users: 3,
    mrr: 99,
    status: 'Active',
    joinedDate: 'Jan 5, 2026',
    adminContact: 'Lisa Anderson',
    adminEmail: 'lisa@sunrise.com',
    featureFlags: [
      { name: 'AI Content', enabled: true },
      { name: 'Advanced Analytics', enabled: false },
      { name: 'White Label', enabled: false },
    ],
    createdBy: 'Self-service signup',
    notes: '',
  },
];

const getPlanBadge = (plan: string) => {
  const colors = {
    Starter: 'bg-gray-100 text-gray-700',
    Professional: 'bg-blue-100 text-blue-700',
    Enterprise: 'bg-purple-100 text-purple-700',
  };
  return colors[plan as keyof typeof colors] || 'bg-gray-100 text-gray-700';
};

const getStatusBadge = (status: string) => {
  const colors = {
    Active: 'bg-green-100 text-green-700',
    Trial: 'bg-yellow-100 text-yellow-700',
    Suspended: 'bg-red-100 text-red-700',
  };
  return colors[status as keyof typeof colors] || 'bg-gray-100 text-gray-700';
};

export default function Organizations() {
  const [searchTerm, setSearchTerm] = useState('');
  const [planFilter, setPlanFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedOrg, setExpandedOrg] = useState<number | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newOrgName, setNewOrgName] = useState('');
  const [newOrgDomain, setNewOrgDomain] = useState('');
  const [newOrgPlan, setNewOrgPlan] = useState<'Starter' | 'Professional' | 'Enterprise'>('Professional');
  const [newOrgAdminName, setNewOrgAdminName] = useState('');
  const [newOrgAdminEmail, setNewOrgAdminEmail] = useState('');

  const filteredOrgs = organizations.filter((org) => {
    if (searchTerm && !org.name.toLowerCase().includes(searchTerm.toLowerCase()) && !org.domain.toLowerCase().includes(searchTerm.toLowerCase())) {
      return false;
    }
    if (planFilter !== 'all' && org.plan !== planFilter) return false;
    if (statusFilter !== 'all' && org.status !== statusFilter) return false;
    return true;
  });

  const totalUsers = filteredOrgs.reduce((sum, org) => sum + org.users, 0);
  const totalMRR = filteredOrgs.reduce((sum, org) => sum + org.mrr, 0);

  const handleAddOrganization = () => {
    // In a real app, this would make an API call
    console.log('Creating organization:', {
      name: newOrgName,
      domain: newOrgDomain,
      plan: newOrgPlan,
      adminName: newOrgAdminName,
      adminEmail: newOrgAdminEmail,
    });
    
    // Reset form and close modal
    setNewOrgName('');
    setNewOrgDomain('');
    setNewOrgPlan('Professional');
    setNewOrgAdminName('');
    setNewOrgAdminEmail('');
    setShowAddModal(false);
    
    // Show success message (you could add a toast notification here)
    alert('Organization created successfully! In a production app, this would create the organization in your database.');
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Organizations</h1>
            <p className="text-sm text-gray-500 mt-1">Manage all platform organizations</p>
          </div>
          <Button 
            className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
            onClick={() => setShowAddModal(true)}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Organization
          </Button>
        </div>
      </div>

      <div className="p-8">
        {/* Filters */}
        <div className="flex items-center gap-3 mb-6">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              type="text"
              placeholder="Search organizations..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={planFilter}
            onChange={(e) => setPlanFilter(e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="all">All Plans</option>
            <option value="Starter">Starter</option>
            <option value="Professional">Professional</option>
            <option value="Enterprise">Enterprise</option>
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
          >
            <option value="all">All</option>
            <option value="Active">Active</option>
            <option value="Trial">Trial</option>
            <option value="Suspended">Suspended</option>
          </select>
        </div>

        {/* Organizations Table */}
        <Card className="rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Organization
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Plan
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Users
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    MRR
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredOrgs.map((org) => (
                  <Fragment key={org.id}>
                    <tr className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-[#1E3A5F] flex items-center justify-center text-white font-medium text-sm">
                            {org.name.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-[#1E3A5F]">{org.name}</p>
                            <p className="text-xs text-gray-500">{org.domain}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getPlanBadge(org.plan)}`}>
                          {org.plan}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {org.users} users
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        ${org.mrr}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${getStatusBadge(org.status)}`}>
                          {org.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                        {org.joinedDate}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex items-center gap-2">
                          <Button
                            onClick={() => setExpandedOrg(expandedOrg === org.id ? null : org.id)}
                            className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white text-xs h-8"
                          >
                            {expandedOrg === org.id ? (
                              <>
                                <ChevronUp className="w-3 h-3 mr-1" />
                                Hide
                              </>
                            ) : (
                              'View'
                            )}
                          </Button>
                          <button className="p-1 hover:bg-gray-100 rounded">
                            <MoreVertical className="w-4 h-4 text-gray-500" />
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedOrg === org.id && (
                      <tr>
                        <td colSpan={7} className="px-6 py-4 bg-gray-50">
                          <div className="grid grid-cols-2 gap-6">
                            <div>
                              <h4 className="text-sm font-semibold text-[#1E3A5F] mb-3">Admin Contact</h4>
                              <p className="text-sm text-gray-700 mb-1">{org.adminContact}</p>
                              <p className="text-sm text-gray-500">{org.adminEmail}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-[#1E3A5F] mb-3">Feature Flag Overrides</h4>
                              <div className="flex flex-wrap gap-2">
                                {org.featureFlags.map((flag) => (
                                  <span
                                    key={flag.name}
                                    className={`inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium ${
                                      flag.enabled
                                        ? 'bg-green-100 text-green-700'
                                        : 'bg-gray-100 text-gray-600'
                                    }`}
                                  >
                                    {flag.name}: {flag.enabled ? 'ON' : 'OFF'}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-[#1E3A5F] mb-3">Created By</h4>
                              <p className="text-sm text-gray-700">{org.createdBy}</p>
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-[#1E3A5F] mb-3">Notes</h4>
                              <textarea
                                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                                rows={2}
                                defaultValue={org.notes}
                                placeholder="Add notes..."
                              />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>

          {/* Footer Summary */}
          <div className="bg-gray-50 px-6 py-4 border-t border-gray-200">
            <div className="text-sm text-gray-700">
              <span className="font-medium">{filteredOrgs.length} organizations</span>
              <span className="mx-2">·</span>
              <span className="font-medium">{totalUsers} total users</span>
              <span className="mx-2">·</span>
              <span className="font-medium">${totalMRR.toLocaleString()} MRR</span>
            </div>
          </div>
        </Card>
      </div>

      {/* Add Organization Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900 bg-opacity-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-[#1E3A5F]">Add Organization</h2>
              <button 
                className="p-1 hover:bg-gray-100 rounded transition-colors" 
                onClick={() => setShowAddModal(false)}
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Organization Name
                </label>
                <Input
                  type="text"
                  placeholder="Acme Financial Advisors"
                  value={newOrgName}
                  onChange={(e) => setNewOrgName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Domain
                </label>
                <Input
                  type="text"
                  placeholder="acme-financial.com"
                  value={newOrgDomain}
                  onChange={(e) => setNewOrgDomain(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Plan
                </label>
                <select
                  value={newOrgPlan}
                  onChange={(e) => setNewOrgPlan(e.target.value as 'Starter' | 'Professional' | 'Enterprise')}
                  className="w-full h-10 rounded-lg border border-gray-300 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                >
                  <option value="Starter">Starter - $99/mo</option>
                  <option value="Professional">Professional - $299/mo</option>
                  <option value="Enterprise">Enterprise - $899/mo</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Admin Contact Name
                </label>
                <Input
                  type="text"
                  placeholder="John Smith"
                  value={newOrgAdminName}
                  onChange={(e) => setNewOrgAdminName(e.target.value)}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">
                  Admin Email
                </label>
                <Input
                  type="email"
                  placeholder="john@acme-financial.com"
                  value={newOrgAdminEmail}
                  onChange={(e) => setNewOrgAdminEmail(e.target.value)}
                />
              </div>
            </div>
            
            <div className="p-6 border-t border-gray-200 flex justify-end gap-3">
              <Button
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
                onClick={() => setShowAddModal(false)}
              >
                Cancel
              </Button>
              <Button
                className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                onClick={handleAddOrganization}
                disabled={!newOrgName || !newOrgDomain || !newOrgAdminName || !newOrgAdminEmail}
              >
                Create Organization
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}