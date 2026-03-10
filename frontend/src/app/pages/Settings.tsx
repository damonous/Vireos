import { useState } from 'react';
import { User, Building2, Link2, Bell, Check, X, Upload } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Toast } from '../components/ui/toast';

type Tab = 'profile' | 'organization' | 'integrations' | 'notifications';

const integrations = [
  { name: 'LinkedIn', connected: true, icon: '🔵', color: 'bg-blue-600' },
  { name: 'Facebook', connected: true, icon: '📘', color: 'bg-blue-700' },
  { name: 'SendGrid', connected: true, icon: '📧', color: 'bg-blue-500' },
  { name: 'Stripe', connected: true, icon: '💳', color: 'bg-indigo-600' },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [showToast, setShowToast] = useState(false);

  const tabs = [
    { id: 'profile' as Tab, label: 'Profile', icon: User },
    { id: 'organization' as Tab, label: 'Organization', icon: Building2 },
    { id: 'integrations' as Tab, label: 'Integrations', icon: Link2 },
    { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
  ];

  const handleSaveChanges = () => {
    setShowToast(true);
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Manage your account preferences and integrations</p>
        </div>
      </div>

      <div className="p-4 md:p-8">
        {/* Tab Navigation */}
        <div className="flex gap-1 mb-8 border-b border-gray-200">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative ${
                  activeTab === tab.id
                    ? 'text-[#0EA5E9] border-b-2 border-[#0EA5E9]'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Profile Tab Content */}
        {activeTab === 'profile' && (
          <div className="max-w-4xl">
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Profile Information</h3>

              {/* Avatar Section */}
              <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-200">
                <div className="w-20 h-20 bg-[#0EA5E9] rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                  SM
                </div>
                <div>
                  <Button variant="outline" size="sm" className="mb-2">
                    <Upload className="w-4 h-4 mr-2" />
                    Upload Photo
                  </Button>
                  <p className="text-xs text-gray-500">JPG, PNG or GIF. Max size 2MB.</p>
                </div>
              </div>

              {/* Form Fields - 2 Column Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div>
                  <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 mb-2 block">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    defaultValue="Sarah"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 mb-2 block">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    defaultValue="Mitchell"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-2 block">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    defaultValue="sarah.mitchell@pinnacle.com"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="phone" className="text-sm font-medium text-gray-700 mb-2 block">
                    Phone
                  </Label>
                  <Input
                    id="phone"
                    defaultValue="555-0142"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="timezone" className="text-sm font-medium text-gray-700 mb-2 block">
                    Timezone
                  </Label>
                  <select
                    id="timezone"
                    defaultValue="America/New_York"
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                  >
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="America/Denver">America/Denver</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="license" className="text-sm font-medium text-gray-700 mb-2 block">
                    License #
                  </Label>
                  <Input
                    id="license"
                    defaultValue="RIA-2891047"
                    className="w-full"
                  />
                </div>
              </div>

              <Button className="w-full md:w-auto bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={handleSaveChanges}>
                Save Changes
              </Button>
            </Card>

            {/* Password Section */}
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200 mb-6">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Change Password</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700 mb-2 block">
                    Current Password
                  </Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    placeholder="••••••••"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700 mb-2 block">
                    New Password
                  </Label>
                  <Input
                    id="newPassword"
                    type="password"
                    placeholder="••••••••"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 mb-2 block">
                    Confirm New Password
                  </Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    className="w-full"
                  />
                </div>
                <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
                  Update Password
                </Button>
              </div>
            </Card>

            {/* Integrations Preview */}
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Connected Integrations</h3>
              <div className="space-y-3">
                {integrations.map((integration) => (
                  <div
                    key={integration.name}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 ${integration.color} rounded-lg flex items-center justify-center text-xl`}>
                        {integration.icon}
                      </div>
                      <div>
                        <p className="font-medium text-[#1E3A5F]">{integration.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Check className="w-3 h-3 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">Connected</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm" className="text-gray-600 hover:text-red-600">
                      <X className="w-4 h-4 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Organization Tab Content */}
        {activeTab === 'organization' && (
          <div className="max-w-4xl">
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Organization Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="md:col-span-2">
                  <Label htmlFor="companyName" className="text-sm font-medium text-gray-700 mb-2 block">
                    Company Name
                  </Label>
                  <Input
                    id="companyName"
                    defaultValue="Pinnacle Financial"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="industry" className="text-sm font-medium text-gray-700 mb-2 block">
                    Industry
                  </Label>
                  <Input
                    id="industry"
                    defaultValue="Financial Services"
                    className="w-full"
                  />
                </div>
                <div>
                  <Label htmlFor="companySize" className="text-sm font-medium text-gray-700 mb-2 block">
                    Company Size
                  </Label>
                  <select
                    id="companySize"
                    defaultValue="1-10"
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent"
                  >
                    <option value="1-10">1-10 employees</option>
                    <option value="11-50">11-50 employees</option>
                    <option value="51-200">51-200 employees</option>
                    <option value="201+">201+ employees</option>
                  </select>
                </div>
              </div>
              <Button className="w-full md:w-auto bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={handleSaveChanges}>
                Save Changes
              </Button>
            </Card>
          </div>
        )}

        {/* Integrations Tab Content */}
        {activeTab === 'integrations' && (
          <div className="max-w-4xl">
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Manage Integrations</h3>
              <p className="text-sm text-gray-600 mb-6">
                Connect your favorite tools and platforms to streamline your workflow.
              </p>
              <div className="space-y-3">
                {integrations.map((integration) => (
                  <div
                    key={integration.name}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 ${integration.color} rounded-lg flex items-center justify-center text-2xl`}>
                        {integration.icon}
                      </div>
                      <div>
                        <p className="font-medium text-[#1E3A5F]">{integration.name}</p>
                        <div className="flex items-center gap-1 mt-1">
                          <Check className="w-3 h-3 text-green-600" />
                          <span className="text-xs text-green-600 font-medium">Connected</span>
                        </div>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" className="text-red-600 hover:bg-red-50 border-red-200">
                      Disconnect
                    </Button>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        )}

        {/* Notifications Tab Content */}
        {activeTab === 'notifications' && (
          <div className="max-w-4xl">
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Notification Preferences</h3>
              <p className="text-sm text-gray-600 mb-6">
                Choose what notifications you want to receive and how.
              </p>
              <div className="space-y-4">
                {[
                  { label: 'Email notifications for new leads', checked: true },
                  { label: 'Content approval reminders', checked: true },
                  { label: 'Weekly performance reports', checked: true },
                  { label: 'Campaign updates and alerts', checked: false },
                  { label: 'Product updates and news', checked: true },
                ].map((item, index) => (
                  <div key={index} className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <p className="text-sm text-gray-700">{item.label}</p>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={item.checked} className="sr-only peer" />
                      <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#0EA5E9]"></div>
                    </label>
                  </div>
                ))}
              </div>
              <Button className="w-full md:w-auto bg-[#0EA5E9] hover:bg-[#0284C7] text-white mt-6">
                Save Preferences
              </Button>
            </Card>
          </div>
        )}
      </div>

      {/* Toast */}
      {showToast && (
        <Toast
          type="success"
          message="Changes saved successfully!"
          onClose={() => setShowToast(false)}
        />
      )}
    </div>
  );
}