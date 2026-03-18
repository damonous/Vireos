import { useEffect, useMemo, useState } from 'react';
import { Bell, Building2, Check, KeyRound, Link2, User, X } from 'lucide-react';
import { Card } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { ErrorState } from '../components/ui/error-state';
import { LoadingState } from '../components/ui/loading-state';
import { EmptyState } from '../components/ui/empty-state';
import { Toast } from '../components/ui/toast';
import { useAuth } from '../hooks/useAuth';
import { useApiData } from '../hooks/useApiData';
import { apiClient } from '../lib/api-client';

type Tab = 'profile' | 'organization' | 'integrations' | 'notifications';

interface MeResponse {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string | null;
  role: string;
  status: string;
  orgId: string;
  createdAt: string;
  organization?: {
    id: string;
    name: string;
    slug: string;
    subscriptionStatus: string;
  };
}

interface OrganizationResponse {
  id: string;
  name: string;
  slug: string;
  website: string | null;
  subscriptionStatus: string;
  settings?: {
    timezone?: string;
    dateFormat?: string;
    defaultContentLanguage?: string;
    emailNotificationsEnabled?: boolean;
  };
}

interface SocialConnection {
  id: string;
  platform: string;
  platformUsername: string | null;
  scopes: string[];
  isActive: boolean;
  tokenExpiresAt: string | null;
  createdAt: string;
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

export default function Settings() {
  const { user, refresh } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [orgName, setOrgName] = useState('');
  const [orgWebsite, setOrgWebsite] = useState('');
  const [orgTimezone, setOrgTimezone] = useState('America/New_York');
  const [orgLanguage, setOrgLanguage] = useState('en-US');
  const [orgEmailNotifications, setOrgEmailNotifications] = useState(true);
  const [savingOrganization, setSavingOrganization] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);
  const [integrationAction, setIntegrationAction] = useState<string | null>(null);

  const me = useApiData<MeResponse>('/auth/me');
  const org = useApiData<OrganizationResponse>(
    user?.orgId ? `/organizations/${user.orgId}` : '/organizations/unknown',
    [user?.orgId]
  );
  const connections = useApiData<SocialConnection[]>('/oauth/connections');
  const notifications = useApiData<NotificationRow[]>('/notifications');

  useEffect(() => {
    if (org.data) {
      setOrgName(org.data.name ?? '');
      setOrgWebsite(org.data.website ?? '');
      setOrgTimezone(org.data.settings?.timezone ?? 'America/New_York');
      setOrgLanguage(org.data.settings?.defaultContentLanguage ?? 'en-US');
      setOrgEmailNotifications(org.data.settings?.emailNotificationsEnabled ?? true);
    }
  }, [org.data]);

  const tabs = useMemo(
    () => [
      { id: 'profile' as Tab, label: 'Profile', icon: User },
      { id: 'organization' as Tab, label: 'Organization', icon: Building2 },
      { id: 'integrations' as Tab, label: 'Integrations', icon: Link2 },
      { id: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    ],
    []
  );

  const isLoading =
    me.loading || connections.loading || notifications.loading || (Boolean(user?.orgId) && org.loading);
  const error =
    me.error || connections.error || notifications.error || (user?.orgId ? org.error : null);

  if (isLoading) {
    return <LoadingState label="Loading settings..." />;
  }

  if (error) {
    return (
      <ErrorState
        message={error}
        onRetry={() => {
          void me.reload();
          void connections.reload();
          void notifications.reload();
          if (user?.orgId) {
            void org.reload();
          }
        }}
      />
    );
  }

  const profile = me.data;
  const integrationRows = [
    {
      key: 'linkedin',
      name: 'LinkedIn',
      color: 'bg-blue-600',
      icon: 'in',
      connection: connections.data?.find((item) => item.platform === 'LINKEDIN') ?? null,
    },
    {
      key: 'facebook',
      name: 'Facebook',
      color: 'bg-blue-700',
      icon: 'f',
      connection: connections.data?.find((item) => item.platform === 'FACEBOOK') ?? null,
    },
    {
      key: 'sendgrid',
      name: 'SendGrid',
      color: 'bg-sky-500',
      icon: '@',
      connection: null,
    },
    {
      key: 'stripe',
      name: 'Stripe',
      color: 'bg-indigo-600',
      icon: '$',
      connection: null,
    },
  ];

  const handlePasswordUpdate = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      setToastMessage('Enter all password fields.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setToastMessage('New password and confirmation do not match.');
      return;
    }

    setUpdatingPassword(true);
    try {
      await apiClient.patch('/auth/change-password', {
        currentPassword,
        newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setToastMessage('Password updated.');
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Password update failed.');
    } finally {
      setUpdatingPassword(false);
    }
  };

  const handleOrganizationSave = async () => {
    if (!user?.orgId) {
      return;
    }

    setSavingOrganization(true);
    try {
      await apiClient.put(`/organizations/${user.orgId}`, {
        name: orgName,
        website: orgWebsite || null,
        settings: {
          ...(org.data?.settings ?? {}),
          timezone: orgTimezone,
          defaultContentLanguage: orgLanguage,
          emailNotificationsEnabled: orgEmailNotifications,
        },
      });
      await org.reload();
      await refresh();
      setToastMessage('Organization settings saved.');
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Failed to save organization settings.');
    } finally {
      setSavingOrganization(false);
    }
  };

  const canManageOrganization = user?.role === 'admin' || user?.role === 'super-admin';

  const handleConnect = async (platform: 'linkedin' | 'facebook') => {
    setIntegrationAction(`connect:${platform}`);
    try {
      const response = await apiClient.get<{ url: string }>(`/oauth/${platform}`);
      window.location.assign(response.url);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Failed to start connection flow.');
      setIntegrationAction(null);
    }
  };

  const handleDisconnect = async (platform: 'linkedin' | 'facebook') => {
    setIntegrationAction(`disconnect:${platform}`);
    try {
      await apiClient.del(`/oauth/${platform}`);
      await connections.reload();
      setToastMessage(`${platform === 'linkedin' ? 'LinkedIn' : 'Facebook'} disconnected.`);
    } catch (err) {
      setToastMessage(err instanceof Error ? err.message : 'Failed to disconnect integration.');
    } finally {
      setIntegrationAction(null);
    }
  };

  return (
    <div className="flex-1 overflow-auto bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-4 md:px-8 py-4">
        <div>
          <h1 className="text-2xl font-semibold text-[#1E3A5F]">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">Live account, organization, and connection settings</p>
        </div>
      </div>

      <div className="p-4 md:p-8">
        <div className="flex gap-1 mb-8 border-b border-gray-200 overflow-x-auto">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-3 text-sm font-medium transition-colors relative whitespace-nowrap ${
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

        {activeTab === 'profile' ? (
          <div className="max-w-4xl space-y-6">
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Profile Information</h3>

              <div className="flex items-center gap-6 mb-8 pb-8 border-b border-gray-200">
                <div className="w-20 h-20 bg-[#0EA5E9] rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                  {`${profile?.firstName?.[0] ?? ''}${profile?.lastName?.[0] ?? ''}`.toUpperCase() || 'U'}
                </div>
                <div>
                  <p className="text-sm font-medium text-[#1E3A5F]">
                    {profile?.firstName} {profile?.lastName}
                  </p>
                  <p className="text-sm text-gray-500">{profile?.role.replace('_', ' ')}</p>
                  <p className="text-xs text-gray-500 mt-2">
                    Account created {profile?.createdAt ? new Date(profile.createdAt).toLocaleDateString() : 'Unknown'}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">First Name</Label>
                  <Input value={profile?.firstName ?? ''} readOnly />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Last Name</Label>
                  <Input value={profile?.lastName ?? ''} readOnly />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Email</Label>
                  <Input value={profile?.email ?? ''} readOnly />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Phone</Label>
                  <Input value={profile?.phone ?? 'Not set'} readOnly />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Role</Label>
                  <Input value={profile?.role ?? ''} readOnly />
                </div>
                <div>
                  <Label className="text-sm font-medium text-gray-700 mb-2 block">Status</Label>
                  <Input value={profile?.status ?? ''} readOnly />
                </div>
              </div>
            </Card>

            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Change Password</h3>
              <div className="space-y-4 max-w-md">
                <div>
                  <Label htmlFor="currentPassword" className="text-sm font-medium text-gray-700 mb-2 block">
                    Current Password
                  </Label>
                  <Input id="currentPassword" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="newPassword" className="text-sm font-medium text-gray-700 mb-2 block">
                    New Password
                  </Label>
                  <Input id="newPassword" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                <div>
                  <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 mb-2 block">
                    Confirm New Password
                  </Label>
                  <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
                </div>
                <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handlePasswordUpdate()} disabled={updatingPassword}>
                  <KeyRound className="w-4 h-4 mr-2" />
                  {updatingPassword ? 'Updating...' : 'Update Password'}
                </Button>
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'organization' ? (
          <div className="max-w-4xl">
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-6">Organization Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="md:col-span-2">
                  <Label htmlFor="companyName" className="text-sm font-medium text-gray-700 mb-2 block">
                    Company Name
                  </Label>
                  <Input id="companyName" value={orgName} onChange={(e) => setOrgName(e.target.value)} readOnly={!canManageOrganization} />
                </div>
                <div>
                  <Label htmlFor="website" className="text-sm font-medium text-gray-700 mb-2 block">
                    Website
                  </Label>
                  <Input id="website" value={orgWebsite} onChange={(e) => setOrgWebsite(e.target.value)} readOnly={!canManageOrganization} />
                </div>
                <div>
                  <Label htmlFor="subscriptionStatus" className="text-sm font-medium text-gray-700 mb-2 block">
                    Subscription Status
                  </Label>
                  <Input id="subscriptionStatus" value={org.data?.subscriptionStatus ?? ''} readOnly />
                </div>
                <div>
                  <Label htmlFor="timezone" className="text-sm font-medium text-gray-700 mb-2 block">
                    Timezone
                  </Label>
                  <select
                    id="timezone"
                    value={orgTimezone}
                    onChange={(e) => setOrgTimezone(e.target.value)}
                    disabled={!canManageOrganization}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Chicago">America/Chicago</option>
                    <option value="America/Denver">America/Denver</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                  </select>
                </div>
                <div>
                  <Label htmlFor="language" className="text-sm font-medium text-gray-700 mb-2 block">
                    Default Content Language
                  </Label>
                  <select
                    id="language"
                    value={orgLanguage}
                    onChange={(e) => setOrgLanguage(e.target.value)}
                    disabled={!canManageOrganization}
                    className="w-full h-10 px-3 rounded-md border border-gray-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-[#0EA5E9] focus:border-transparent disabled:bg-gray-100"
                  >
                    <option value="en-US">English (US)</option>
                    <option value="en-GB">English (UK)</option>
                  </select>
                </div>
              </div>

              <div className="rounded-lg bg-gray-50 border border-gray-200 p-4 mb-6">
                <label className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={orgEmailNotifications}
                    onChange={(e) => setOrgEmailNotifications(e.target.checked)}
                    disabled={!canManageOrganization}
                  />
                  <span className="text-sm text-gray-700">Enable organization email notifications</span>
                </label>
              </div>

              {canManageOrganization ? (
                <Button className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white" onClick={() => void handleOrganizationSave()} disabled={savingOrganization}>
                  {savingOrganization ? 'Saving...' : 'Save Organization Changes'}
                </Button>
              ) : (
                <p className="text-sm text-gray-500">Your role has read-only access to organization settings.</p>
              )}
            </Card>
          </div>
        ) : null}

        {activeTab === 'integrations' ? (
          <div className="max-w-4xl">
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Connected Integrations</h3>
              <div className="space-y-3">
                {integrationRows.map((integration) => (
                  <div
                    key={integration.key}
                    className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 ${integration.color} rounded-lg flex items-center justify-center text-white font-semibold`}>
                        {integration.icon}
                      </div>
                      <div>
                        <p className="font-medium text-[#1E3A5F]">{integration.name}</p>
                        {integration.connection ? (
                          <div className="mt-1">
                            <div className="flex items-center gap-1">
                              <Check className="w-3 h-3 text-green-600" />
                              <span className="text-xs text-green-600 font-medium">
                                Connected {integration.connection.platformUsername ? `as ${integration.connection.platformUsername}` : ''}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500 mt-1">
                              Added {new Date(integration.connection.createdAt).toLocaleDateString()}
                              {integration.connection.tokenExpiresAt ? ` • token expires ${new Date(integration.connection.tokenExpiresAt).toLocaleDateString()}` : ''}
                            </p>
                          </div>
                        ) : (
                          <p className="text-xs text-gray-500 mt-1">
                            {integration.key === 'linkedin' || integration.key === 'facebook'
                              ? 'No active OAuth connection found for this user.'
                              : 'This service is configured at the organization level and does not require a personal connection.'}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {integration.connection ? (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-green-100 text-green-700 border border-green-200">
                          <Check className="w-3 h-3" />
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-600 border border-gray-200">
                          <X className="w-3 h-3" />
                          Not connected
                        </span>
                      )}
                      {integration.key === 'linkedin' || integration.key === 'facebook' ? (
                        integration.connection ? (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={integrationAction === `connect:${integration.key}` || integrationAction === `disconnect:${integration.key}`}
                              onClick={() => void handleConnect(integration.key as 'linkedin' | 'facebook')}
                            >
                              Reauthorize
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={integrationAction === `connect:${integration.key}` || integrationAction === `disconnect:${integration.key}`}
                              onClick={() => void handleDisconnect(integration.key as 'linkedin' | 'facebook')}
                            >
                              {integrationAction === `disconnect:${integration.key}` ? 'Disconnecting...' : 'Disconnect'}
                            </Button>
                          </>
                        ) : (
                          <Button
                            size="sm"
                            className="bg-[#0EA5E9] hover:bg-[#0284C7] text-white"
                            disabled={integrationAction === `connect:${integration.key}`}
                            onClick={() => void handleConnect(integration.key as 'linkedin' | 'facebook')}
                          >
                            {integrationAction === `connect:${integration.key}` ? 'Connecting...' : 'Connect'}
                          </Button>
                        )
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        ) : null}

        {activeTab === 'notifications' ? (
          <div className="max-w-4xl">
            <Card className="p-6 rounded-lg shadow-sm border border-gray-200">
              <h3 className="text-lg font-semibold text-[#1E3A5F] mb-4">Notification Preferences</h3>
              <div className="space-y-4">
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-[#1E3A5F]">Organization notifications</p>
                  <p className="text-sm text-gray-600 mt-1">
                    {orgEmailNotifications ? 'Email notifications are enabled in organization settings.' : 'Email notifications are currently disabled.'}
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-[#1E3A5F]">Security alerts</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Login activity and password changes are recorded in your activity history.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-medium text-[#1E3A5F]">Campaign notifications</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Channel-level delivery and engagement events appear as live metrics once providers are configured.
                  </p>
                </div>
                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-medium text-[#1E3A5F]">Recent in-app notifications</p>
                      <p className="text-sm text-gray-600 mt-1">Recent approval and content activity for your account.</p>
                    </div>
                    <Button variant="outline" size="sm" onClick={() => void notifications.reload()}>
                      Refresh
                    </Button>
                  </div>
                  <div className="mt-4 space-y-3">
                    {(notifications.data ?? []).length === 0 ? (
                      <EmptyState title="No notifications yet" description="Workflow events will appear here for your account as they occur." />
                    ) : (
                      (notifications.data ?? []).slice(0, 12).map((item) => (
                        <div key={item.id} className={`rounded-lg border p-3 ${item.isRead ? 'border-gray-200 bg-gray-50' : 'border-sky-200 bg-sky-50'}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-medium text-[#1E3A5F]">{item.title}</p>
                              <p className="mt-1 text-sm text-gray-600">{item.body}</p>
                              <p className="mt-2 text-xs text-gray-500">{new Date(item.createdAt).toLocaleString()}</p>
                            </div>
                            {!item.isRead ? (
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => void apiClient.patch(`/notifications/${item.id}/read`).then(() => notifications.reload())}
                              >
                                Mark read
                              </Button>
                            ) : null}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </Card>
          </div>
        ) : null}
      </div>

      {toastMessage ? (
        <Toast message={toastMessage} type="success" onClose={() => setToastMessage(null)} />
      ) : null}
    </div>
  );
}
