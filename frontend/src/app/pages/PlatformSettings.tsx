import { useState } from 'react';
import { Bell, Globe, Shield, Zap, DollarSign, Check, X, Key, Lock, Users, Clock, CreditCard, AlertCircle, ChevronRight, ExternalLink } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Switch } from '../components/ui/switch';
import { Toast } from '../components/ui/toast';

type Tab = 'general' | 'authentication' | 'integrations' | 'billing';

const plans = [
  { name: 'Starter', price: '$99/mo', features: 'Basic features', maxUsers: '3', status: 'Active' },
  { name: 'Professional', price: '$299/mo', features: 'All features', maxUsers: '15', status: 'Active' },
  { name: 'Enterprise', price: '$899/mo', features: 'All features + Priority Support', maxUsers: 'Unlimited', status: 'Active' },
];

export default function PlatformSettings() {
  const [activeTab, setActiveTab] = useState<Tab>('general');
  const [showToast, setShowToast] = useState(false);
  const [platformName, setPlatformName] = useState('Vireos');
  const [supportEmail, setSupportEmail] = useState('support@vireos.com');
  const [termsUrl, setTermsUrl] = useState('https://vireos.com/terms');
  const [privacyUrl, setPrivacyUrl] = useState('https://vireos.com/privacy');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState('We are currently performing scheduled maintenance. We\'ll be back shortly!');

  // Authentication state
  const [ssoEnabled, setSsoEnabled] = useState(true);
  const [mfaRequired, setMfaRequired] = useState(true);
  const [passwordMinLength, setPasswordMinLength] = useState('12');
  const [sessionTimeout, setSessionTimeout] = useState('30');
  const [maxLoginAttempts, setMaxLoginAttempts] = useState('5');

  // Integrations state
  const [integrations, setIntegrations] = useState([
    { id: 1, name: 'Salesforce', category: 'CRM', status: 'connected', apiKey: '•••••••••••••••••', lastSync: '2 hours ago', icon: '🔷' },
    { id: 2, name: 'HubSpot', category: 'Marketing', status: 'connected', apiKey: '•••••••••••••••••', lastSync: '5 hours ago', icon: '🧡' },
    { id: 3, name: 'Google Analytics', category: 'Analytics', status: 'connected', apiKey: '•••••••••••••••••', lastSync: '1 hour ago', icon: '📊' },
    { id: 4, name: 'Slack', category: 'Communication', status: 'disconnected', apiKey: '', lastSync: 'Never', icon: '💬' },
    { id: 5, name: 'Stripe', category: 'Payments', status: 'connected', apiKey: '•••••••••••••••••', lastSync: '30 mins ago', icon: '💳' },
    { id: 6, name: 'Zapier', category: 'Automation', status: 'disconnected', apiKey: '', lastSync: 'Never', icon: '⚡' },
  ]);

  // Billing state
  const [paymentGateway, setPaymentGateway] = useState('stripe');
  const [billingEmail, setBillingEmail] = useState('billing@vireos.com');
  const [taxRate, setTaxRate] = useState('8.5');
  const [invoicePrefix, setInvoicePrefix] = useState('INV-');

  const handleSaveChanges = () => {
    setShowToast(true);
  };

  const handleToggleIntegration = (id: number) => {
    setIntegrations(integrations.map(int => 
      int.id === id 
        ? { ...int, status: int.status === 'connected' ? 'disconnected' : 'connected' }
        : int
    ));
  };

  const tabs: { id: Tab; label: string; icon: JSX.Element }[] = [
    { id: 'general', label: 'General', icon: <Globe size={16} /> },
    { id: 'authentication', label: 'Authentication', icon: <Shield size={16} /> },
    { id: 'integrations', label: 'Integrations', icon: <Zap size={16} /> },
    { id: 'billing', label: 'Billing', icon: <DollarSign size={16} /> },
  ];

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      {/* Top Bar */}
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold text-[#1E3A5F]">Platform Settings</h1>
            <p className="text-sm text-gray-500 mt-1">Configure global platform settings</p>
          </div>
          <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white w-full md:w-auto" onClick={handleSaveChanges}>
            Save Changes
          </Button>
        </div>
      </div>

      <div className="p-4 md:p-8 flex flex-col md:flex-row gap-6">
        {/* Left Sidebar - Tabs (Horizontal on mobile, vertical on desktop) */}
        <div className="w-full md:w-48 flex-shrink-0">
          <div className="flex flex-row md:flex-col gap-2 overflow-x-auto md:overflow-x-visible pb-2 md:pb-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2.5 rounded-lg text-sm font-medium text-left transition-colors whitespace-nowrap flex-shrink-0 flex items-center ${
                  activeTab === tab.id
                    ? 'bg-[#0EA5E9] text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-200'
                }`}
              >
                {tab.icon}
                <span className="ml-2">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 min-w-0">{/* min-w-0 fixes flexbox overflow */}

          {activeTab === 'general' && (
            <div className="space-y-6">
              {/* Platform Identity Section */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Platform Identity</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Platform Name
                    </label>
                    <Input
                      type="text"
                      value={platformName}
                      onChange={(e) => setPlatformName(e.target.value)}
                      placeholder="Platform name"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Support Email
                    </label>
                    <Input
                      type="email"
                      value={supportEmail}
                      onChange={(e) => setSupportEmail(e.target.value)}
                      placeholder="support@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Terms of Service URL
                    </label>
                    <Input
                      type="url"
                      value={termsUrl}
                      onChange={(e) => setTermsUrl(e.target.value)}
                      placeholder="https://example.com/terms"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Privacy Policy URL
                    </label>
                    <Input
                      type="url"
                      value={privacyUrl}
                      onChange={(e) => setPrivacyUrl(e.target.value)}
                      placeholder="https://example.com/privacy"
                    />
                  </div>
                </div>
              </Card>

              {/* Subscription Plans Section */}
              <Card className="rounded-lg shadow-sm border border-gray-200">
                <div className="px-6 py-4 border-b border-gray-200">
                  <h3 className="text-lg font-semibold text-[#1E3A5F]">Subscription Plans</h3>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Plan
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Price
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Features
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Max Users
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {plans.map((plan) => (
                        <tr key={plan.name} className="hover:bg-gray-50">
                          <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-[#1E3A5F]">
                            {plan.name}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {plan.price}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {plan.features}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                            {plan.maxUsers}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded text-xs font-medium bg-green-100 text-green-700">
                              {plan.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>

              {/* Maintenance Mode Section */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Maintenance Mode</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setMaintenanceMode(!maintenanceMode)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        maintenanceMode ? 'bg-[#0EA5E9]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          maintenanceMode ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <label className="text-sm font-medium text-gray-700">
                      Enable maintenance mode for all users
                    </label>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Scheduled Maintenance
                    </label>
                    <Input
                      type="datetime-local"
                      className="max-w-md"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Maintenance Message
                    </label>
                    <textarea
                      value={maintenanceMessage}
                      onChange={(e) => setMaintenanceMessage(e.target.value)}
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                      rows={4}
                      placeholder="Enter the message users will see during maintenance..."
                    />
                  </div>
                </div>
              </Card>

              {/* Save Button at Bottom */}
              <div className="flex justify-end">
                <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
                  Save Changes
                </Button>
              </div>
            </div>
          )}

          {activeTab === 'authentication' && (
            <div className="space-y-6">
              {/* SSO & SAML Configuration */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Single Sign-On (SSO)</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setSsoEnabled(!ssoEnabled)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        ssoEnabled ? 'bg-[#0EA5E9]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          ssoEnabled ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <label className="text-sm font-medium text-gray-700">
                      Enable SSO / SAML 2.0 Authentication
                    </label>
                  </div>
                  {ssoEnabled && (
                    <div className="pl-14 space-y-3">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          SAML Metadata URL
                        </label>
                        <Input
                          type="url"
                          placeholder="https://idp.example.com/metadata"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Entity ID
                        </label>
                        <Input
                          type="text"
                          placeholder="vireos-saml-entity"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          ACS URL
                        </label>
                        <Input
                          type="url"
                          value="https://app.vireos.com/auth/saml/callback"
                          readOnly
                          className="bg-gray-50"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Multi-Factor Authentication */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Multi-Factor Authentication</h3>
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => setMfaRequired(!mfaRequired)}
                      className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                        mfaRequired ? 'bg-[#0EA5E9]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                          mfaRequired ? 'translate-x-6' : 'translate-x-1'
                        }`}
                      />
                    </button>
                    <label className="text-sm font-medium text-gray-700">
                      Require MFA for all users
                    </label>
                  </div>
                  <div className="bg-blue-50 border border-blue-100 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-blue-900 font-medium">Enhanced Security Enabled</p>
                      <p className="text-xs text-blue-700 mt-1">
                        All users will be required to set up MFA on their next login. Supported methods: Authenticator App, SMS, Email.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Password Policy */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Password Policy</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Minimum Length
                      </label>
                      <Input
                        type="number"
                        value={passwordMinLength}
                        onChange={(e) => setPasswordMinLength(e.target.value)}
                        min="8"
                        max="32"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Password Expiry (days)
                      </label>
                      <Input
                        type="number"
                        placeholder="90"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">Password Requirements</label>
                    <div className="space-y-2">
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                        Require uppercase letters
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                        Require lowercase letters
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                        Require numbers
                      </label>
                      <label className="flex items-center gap-2 text-sm text-gray-600">
                        <input type="checkbox" defaultChecked className="rounded border-gray-300" />
                        Require special characters
                      </label>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Session Management */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Session Management</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Session Timeout (minutes)
                      </label>
                      <Input
                        type="number"
                        value={sessionTimeout}
                        onChange={(e) => setSessionTimeout(e.target.value)}
                        min="5"
                        max="1440"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Max Login Attempts
                      </label>
                      <Input
                        type="number"
                        value={maxLoginAttempts}
                        onChange={(e) => setMaxLoginAttempts(e.target.value)}
                        min="3"
                        max="10"
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#0EA5E9]"
                    >
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                    </button>
                    <label className="text-sm font-medium text-gray-700">
                      Force logout on all devices when password is changed
                    </label>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#0EA5E9]"
                    >
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                    </button>
                    <label className="text-sm font-medium text-gray-700">
                      Require re-authentication for sensitive actions
                    </label>
                  </div>
                </div>
              </Card>

              {/* IP Whitelisting */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">IP Whitelisting</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Allowed IP Addresses
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                      rows={4}
                      placeholder="Enter IP addresses or CIDR ranges (one per line)&#10;Example:&#10;192.168.1.0/24&#10;203.0.113.50"
                    />
                  </div>
                  <p className="text-xs text-gray-500">
                    Leave empty to allow access from all IP addresses. Add specific IPs or ranges to restrict access.
                  </p>
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'integrations' && (
            <div className="space-y-6">
              {/* Integrations Overview */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[#1E3A5F]">Connected Integrations</h3>
                    <p className="text-sm text-gray-500 mt-1">Manage third-party service connections</p>
                  </div>
                  <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white">
                    <Zap className="w-4 h-4 mr-2" />
                    Add Integration
                  </Button>
                </div>
                
                {/* Integration Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {integrations.map((integration) => (
                    <div
                      key={integration.id}
                      className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 flex items-center justify-center bg-gray-100 rounded-lg text-xl">
                            {integration.icon}
                          </div>
                          <div>
                            <h4 className="font-semibold text-[#1E3A5F]">{integration.name}</h4>
                            <p className="text-xs text-gray-500">{integration.category}</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleToggleIntegration(integration.id)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            integration.status === 'connected' ? 'bg-[#0EA5E9]' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              integration.status === 'connected' ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      
                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-500">Status</span>
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                            integration.status === 'connected' 
                              ? 'bg-green-100 text-green-700' 
                              : 'bg-gray-100 text-gray-600'
                          }`}>
                            {integration.status === 'connected' ? (
                              <><Check className="w-3 h-3 mr-1" /> Connected</>
                            ) : (
                              <><X className="w-3 h-3 mr-1" /> Disconnected</>
                            )}
                          </span>
                        </div>
                        
                        {integration.status === 'connected' && (
                          <>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">API Key</span>
                              <span className="text-gray-700 font-mono text-xs">{integration.apiKey}</span>
                            </div>
                            <div className="flex items-center justify-between text-sm">
                              <span className="text-gray-500">Last Sync</span>
                              <span className="text-gray-700">{integration.lastSync}</span>
                            </div>
                          </>
                        )}
                      </div>
                      
                      {integration.status === 'connected' && (
                        <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                          <Button className="flex-1 text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                            <Key className="w-3 h-3 mr-1" />
                            Regenerate Key
                          </Button>
                          <Button className="flex-1 text-xs bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                            <ExternalLink className="w-3 h-3 mr-1" />
                            Configure
                          </Button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </Card>

              {/* API Configuration */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Platform API</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      API Base URL
                    </label>
                    <Input
                      type="url"
                      value="https://api.vireos.com/v1"
                      readOnly
                      className="bg-gray-50"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Master API Key
                    </label>
                    <div className="flex gap-2">
                      <Input
                        type="password"
                        value="vir_live_sk_••••••••••••••••••••••••"
                        readOnly
                        className="flex-1 bg-gray-50"
                      />
                      <Button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                        <Key className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  <div className="bg-amber-50 border border-amber-100 rounded-lg p-4 flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm text-amber-900 font-medium">Security Warning</p>
                      <p className="text-xs text-amber-700 mt-1">
                        Keep your API keys secure. Never share them or commit them to version control.
                      </p>
                    </div>
                  </div>
                </div>
              </Card>

              {/* Webhook Configuration */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-[#1E3A5F]">Webhooks</h3>
                  <Button className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-50">
                    Add Webhook
                  </Button>
                </div>
                <div className="space-y-3">
                  {[
                    { event: 'user.created', url: 'https://hooks.example.com/user-created', status: 'active' },
                    { event: 'subscription.updated', url: 'https://hooks.example.com/subscription', status: 'active' },
                    { event: 'compliance.alert', url: 'https://hooks.example.com/compliance', status: 'paused' },
                  ].map((webhook, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex-1">
                        <p className="text-sm font-medium text-[#1E3A5F]">{webhook.event}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{webhook.url}</p>
                      </div>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                        webhook.status === 'active' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-gray-200 text-gray-600'
                      }`}>
                        {webhook.status}
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          )}

          {activeTab === 'billing' && (
            <div className="space-y-6">
              {/* Revenue Overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
                      <DollarSign className="w-5 h-5 text-green-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Monthly Revenue</p>
                      <p className="text-2xl font-semibold text-[#1E3A5F]">$47,892</p>
                    </div>
                  </div>
                  <p className="text-xs text-green-600">↑ 12% from last month</p>
                </Card>

                <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                      <Users className="w-5 h-5 text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Active Subscriptions</p>
                      <p className="text-2xl font-semibold text-[#1E3A5F]">342</p>
                    </div>
                  </div>
                  <p className="text-xs text-blue-600">↑ 8% from last month</p>
                </Card>

                <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                      <CreditCard className="w-5 h-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Failed Payments</p>
                      <p className="text-2xl font-semibold text-[#1E3A5F]">7</p>
                    </div>
                  </div>
                  <p className="text-xs text-gray-500">Requires attention</p>
                </Card>
              </div>

              {/* Payment Gateway Configuration */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Payment Gateway</h3>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      Select Payment Processor
                    </label>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      {['stripe', 'paypal', 'braintree'].map((gateway) => (
                        <button
                          key={gateway}
                          onClick={() => setPaymentGateway(gateway)}
                          className={`p-4 border-2 rounded-lg text-left transition-all ${
                            paymentGateway === gateway
                              ? 'border-[#0EA5E9] bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-semibold text-[#1E3A5F] capitalize">{gateway}</span>
                            {paymentGateway === gateway && (
                              <Check className="w-5 h-5 text-[#0EA5E9]" />
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {gateway === 'stripe' && 'Recommended for SaaS'}
                            {gateway === 'paypal' && 'Global coverage'}
                            {gateway === 'braintree' && 'PayPal owned'}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {paymentGateway === 'stripe' && (
                    <div className="space-y-3 pt-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Stripe Publishable Key
                        </label>
                        <Input
                          type="text"
                          placeholder="pk_live_..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Stripe Secret Key
                        </label>
                        <Input
                          type="password"
                          placeholder="sk_live_..."
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1.5">
                          Webhook Signing Secret
                        </label>
                        <Input
                          type="password"
                          placeholder="whsec_..."
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Card>

              {/* Invoice Settings */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Invoice Settings</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Invoice Prefix
                      </label>
                      <Input
                        type="text"
                        value={invoicePrefix}
                        onChange={(e) => setInvoicePrefix(e.target.value)}
                        placeholder="INV-"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Starting Number
                      </label>
                      <Input
                        type="number"
                        placeholder="1000"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Billing Email
                    </label>
                    <Input
                      type="email"
                      value={billingEmail}
                      onChange={(e) => setBillingEmail(e.target.value)}
                      placeholder="billing@vireos.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5">
                      Invoice Footer Text
                    </label>
                    <textarea
                      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9]"
                      rows={3}
                      placeholder="Add custom text to appear at the bottom of all invoices..."
                      defaultValue="Thank you for your business! Payment is due within 30 days."
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#0EA5E9]"
                    >
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                    </button>
                    <label className="text-sm font-medium text-gray-700">
                      Send automated invoice reminders
                    </label>
                  </div>
                </div>
              </Card>

              {/* Tax Configuration */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Tax Configuration</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Default Tax Rate (%)
                      </label>
                      <Input
                        type="number"
                        value={taxRate}
                        onChange={(e) => setTaxRate(e.target.value)}
                        step="0.1"
                        placeholder="8.5"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Tax ID / VAT Number
                      </label>
                      <Input
                        type="text"
                        placeholder="US-123456789"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#0EA5E9]"
                    >
                      <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                    </button>
                    <label className="text-sm font-medium text-gray-700">
                      Enable automatic tax calculation based on customer location
                    </label>
                  </div>
                </div>
              </Card>

              {/* Subscription Management */}
              <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
                <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Subscription Management</h3>
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Trial Period (days)
                      </label>
                      <Input
                        type="number"
                        placeholder="14"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">
                        Grace Period (days)
                      </label>
                      <Input
                        type="number"
                        placeholder="3"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <button
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#0EA5E9]"
                      >
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                      </button>
                      <label className="text-sm font-medium text-gray-700">
                        Allow plan downgrades
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-[#0EA5E9]"
                      >
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-6" />
                      </button>
                      <label className="text-sm font-medium text-gray-700">
                        Prorate charges when upgrading/downgrading
                      </label>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        className="relative inline-flex h-6 w-11 items-center rounded-full bg-gray-300"
                      >
                        <span className="inline-block h-4 w-4 transform rounded-full bg-white translate-x-1" />
                      </button>
                      <label className="text-sm font-medium text-gray-700">
                        Require payment method for free trials
                      </label>
                    </div>
                  </div>
                </div>
              </Card>
            </div>
          )}
        </div>
      </div>

      {/* Toast Notification */}
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