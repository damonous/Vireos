import { useCallback, useEffect, useRef, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { Bell, Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { apiClient } from '../lib/api-client';

interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
}

interface PageMeta { title: string; subtitle: string }

const PAGE_META: Array<{ match: (p: string) => boolean } & PageMeta> = [
  // Advisor
  { match: (p) => p === '/home',                                      title: 'Dashboard',                subtitle: "Here's what's happening with your marketing today" },
  { match: (p) => p.startsWith('/content/drafts') || p === '/content-drafts', title: 'Content Drafts', subtitle: 'Review saved drafts, status changes, and flagged compliance output.' },
  { match: (p) => p.startsWith('/content'),                           title: 'AI Content Generator',    subtitle: 'Generate drafts and review the latest saved content.' },
  { match: (p) => p === '/compliance',                                title: 'Compliance Queue',         subtitle: 'Review and approve marketing content' },
  { match: (p) => p.startsWith('/calendar'),                          title: 'Publishing Calendar',      subtitle: 'Schedule and manage your published content' },
  { match: (p) => p.includes('/campaigns/new') && p.startsWith('/linkedin'), title: 'Create LinkedIn Campaign', subtitle: 'Define your outreach sequence and save it as a campaign draft.' },
  { match: (p) => p.startsWith('/linkedin'),                          title: 'LinkedIn Outreach',        subtitle: 'Live LinkedIn campaign performance from the backend' },
  { match: (p) => p.includes('/wizard') && p.startsWith('/facebook'), title: 'Create Facebook Ad Campaign', subtitle: 'Set up a new Facebook ad campaign.' },
  { match: (p) => p.startsWith('/facebook'),                          title: 'Facebook Ads',             subtitle: 'Live Facebook campaign metrics and lead acquisition' },
  { match: (p) => p.startsWith('/prospects'),                         title: 'Prospect Finder',          subtitle: 'Discover and add new prospects' },
  { match: (p) => p.startsWith('/leads'),                             title: 'Lead Management',          subtitle: 'Live lead pipeline. Drag cards between stages or use the arrow controls.' },
  { match: (p) => p.startsWith('/email/templates/') && p.length > '/email/templates/'.length, title: 'Edit Email Template', subtitle: 'Define reusable subject and body copy with extracted variable chips.' },
  { match: (p) => p === '/email/templates/new',                       title: 'Create Email Template',   subtitle: 'Define reusable subject and body copy with extracted variable chips.' },
  { match: (p) => p === '/email/templates',                           title: 'Email Templates',          subtitle: 'Create, preview, and edit reusable Mailgun template content.' },
  { match: (p) => p.startsWith('/email/sequences/') && p.endsWith('/enroll'), title: 'Enroll Leads',   subtitle: 'Select leads to add to this sequence.' },
  { match: (p) => p.startsWith('/email/sequences/') && p.endsWith('/edit'),   title: 'Edit Email Sequence',   subtitle: 'Create a sequence with email templates and automated follow-up steps.' },
  { match: (p) => p === '/email/sequences/new',                       title: 'Create Email Sequence',   subtitle: 'Create a sequence with email templates and automated follow-up steps.' },
  { match: (p) => p.startsWith('/email'),                             title: 'Email Marketing',          subtitle: 'Sequence list, Mailgun delivery analytics, and enrollment performance.' },
  { match: (p) => p.startsWith('/analytics'),                         title: 'Analytics Dashboard',      subtitle: 'Live performance data across content, campaigns, and lead flow' },
  { match: (p) => p.startsWith('/billing'),                           title: 'Billing & Subscription',   subtitle: 'Live billing state, credits, and Stripe invoice history' },
  { match: (p) => p.startsWith('/settings'),                          title: 'Settings',                 subtitle: 'Live account, organization, and connection settings' },
  // Admin
  { match: (p) => p === '/admin/home',                                title: 'Admin Dashboard',          subtitle: 'Manage your team and monitor performance' },
  { match: (p) => p.startsWith('/admin/users'),                       title: 'User Management',          subtitle: 'Live organization members and invitation workflow' },
  { match: (p) => p.startsWith('/admin/reports'),                     title: 'Team Reports',             subtitle: 'Live team performance across members in your organization' },
  { match: (p) => p.startsWith('/admin/org-settings'),                title: 'Organization Settings',    subtitle: 'Manage your organization profile, compliance rules, and team preferences' },
  { match: (p) => p.startsWith('/admin/billing'),                     title: 'Billing & Subscription',   subtitle: 'Live billing state, credits, and Stripe invoice history' },
  { match: (p) => p.startsWith('/admin/settings'),                    title: 'Settings',                 subtitle: 'Live account, organization, and connection settings' },
  // Compliance Officer
  { match: (p) => p === '/compliance-officer/home',                   title: 'Compliance Dashboard',     subtitle: 'Review pending advisor submissions' },
  { match: (p) => p.startsWith('/compliance-officer/review'),         title: 'Content Review',           subtitle: 'Review and approve marketing content' },
  { match: (p) => p.startsWith('/compliance-officer/audit'),          title: 'Audit Trail',              subtitle: 'Live organization audit events' },
  { match: (p) => p.startsWith('/compliance-officer/reports'),        title: 'Compliance Reports',       subtitle: 'Live review and audit analytics for your organization' },
  { match: (p) => p.startsWith('/compliance-officer/settings'),       title: 'Settings',                 subtitle: 'Configure compliance settings' },
  // Super Admin
  { match: (p) => p === '/super-admin/home',                          title: 'Platform Overview',        subtitle: 'Monitor all organizations and system health' },
  { match: (p) => p.startsWith('/super-admin/orgs'),                  title: 'Organizations',            subtitle: 'Live platform organizations from the backend' },
  { match: (p) => p.startsWith('/super-admin/users'),                 title: 'Platform Users',           subtitle: 'Live user directory across all organizations' },
  { match: (p) => p.startsWith('/super-admin/prospects'),             title: 'Prospect Fulfillment',     subtitle: 'Receive requests, upload CSV fulfillments, and review imports before confirmation.' },
  { match: (p) => p.startsWith('/super-admin/tokens'),                title: 'Token Usage',              subtitle: 'View token usage by content generation request, user, and organization.' },
  { match: (p) => p.startsWith('/super-admin/health'),                title: 'System Health',            subtitle: 'Live readiness checks and billing KPIs from the backend' },
  { match: (p) => p.startsWith('/super-admin/billing'),               title: 'Platform Billing',         subtitle: 'Live billing and subscription visibility across organizations' },
  { match: (p) => p.startsWith('/super-admin/flags'),                 title: 'Feature Flags',            subtitle: 'Live feature availability for the current organization' },
  { match: (p) => p.startsWith('/super-admin/settings'),              title: 'Platform Settings',        subtitle: 'Platform-wide configuration and feature management' },
];

function getPageMeta(pathname: string): PageMeta | null {
  return PAGE_META.find((entry) => entry.match(pathname)) ?? null;
}

export function ProtectedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isEasyModeRoute = location.pathname === '/easy';

  // Notification bell state
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const bellRef = useRef<HTMLDivElement>(null);
  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const loadNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const result = await apiClient.get<NotificationItem[]>('/notifications');
      setNotifications(result ?? []);
    } catch {
      // silent fail — notifications are non-critical
    }
  }, [isAuthenticated]);

  // Load notifications on mount and every 30s
  useEffect(() => {
    void loadNotifications();
    const interval = setInterval(() => void loadNotifications(), 30_000);
    return () => clearInterval(interval);
  }, [loadNotifications]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) {
        setShowNotifications(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAsRead = async (id: string) => {
    try {
      await apiClient.patch(`/notifications/${id}/read`);
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, isRead: true } : n)));
    } catch {
      // silent fail
    }
  };

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      navigate('/login', { replace: true });
    }
  }, [isAuthenticated, isLoading, navigate, location.pathname]);

  useEffect(() => {
    if (isLoading || !user || user.role === 'super-admin') {
      return;
    }

    const subscriptionStatus = user.organization?.subscriptionStatus?.toUpperCase() ?? '';
    const hasActiveSubscription = subscriptionStatus === 'ACTIVE' || subscriptionStatus === 'TRIALING';
    const onAllowedRoute =
      location.pathname.startsWith('/billing') ||
      location.pathname.startsWith('/settings') ||
      location.pathname.startsWith('/profile');

    if (!hasActiveSubscription && !onAllowedRoute) {
      navigate('/billing?required=subscription', { replace: true });
    }
  }, [isLoading, user, location.pathname, navigate]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F8F9FB] text-[#1E3A5F]">
        Loading Vireos...
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB]">
      {!isEasyModeRoute ? (
        <button
          onClick={() => setIsSidebarOpen(!isSidebarOpen)}
          className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-[#0EA5E9] hover:bg-gray-50 transition-colors"
        >
          <Menu className="w-6 h-6" />
        </button>
      ) : null}

      {isSidebarOpen && !isEasyModeRoute && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {!isEasyModeRoute ? <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} /> : null}

      <div className={`flex-1 flex flex-col overflow-hidden ${isEasyModeRoute ? '' : 'md:ml-64'}`}>
        {/* Top bar with page header + notification bell */}
        {!isEasyModeRoute && (
          <div className="flex items-center justify-between px-8 py-4 bg-white border-b border-slate-100 shrink-0">
            {/* Page title + subtitle */}
          {(() => {
            const meta = getPageMeta(location.pathname);
            return meta ? (
              <div>
                <h1 className="text-xl font-bold text-slate-900 leading-tight">{meta.title}</h1>
                <p className="mt-0.5 text-sm text-slate-500">{meta.subtitle}</p>
              </div>
            ) : <div />;
          })()}

          <div ref={bellRef} className="relative">
              <button
                onClick={() => setShowNotifications((prev) => !prev)}
                className="relative p-2 rounded-full text-gray-500 hover:bg-gray-100 hover:text-[#1E3A5F] transition-colors"
                aria-label="Notifications"
              >
                <Bell className="w-5 h-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>

              {showNotifications && (
                <div className="absolute right-0 top-full mt-2 w-80 max-h-96 overflow-y-auto bg-white rounded-lg shadow-lg border border-gray-200 z-50">
                  <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
                    <h4 className="text-sm font-semibold text-[#1E3A5F]">Notifications</h4>
                    {unreadCount > 0 && (
                      <span className="text-xs text-gray-500">{unreadCount} unread</span>
                    )}
                  </div>

                  {notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center text-sm text-gray-500">
                      No notifications yet
                    </div>
                  ) : (
                    <div>
                      {notifications.slice(0, 15).map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            if (!n.isRead) void markAsRead(n.id);
                          }}
                          className={`w-full text-left px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-sky-50' : ''}`}
                        >
                          <div className="flex items-start gap-2">
                            {!n.isRead && <span className="mt-1.5 w-2 h-2 rounded-full bg-[#0EA5E9] shrink-0" />}
                            <div className={!n.isRead ? '' : 'ml-4'}>
                              <p className="text-sm font-medium text-[#1E3A5F]">{n.title}</p>
                              <p className="text-xs text-gray-600 mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-xs text-gray-400 mt-1">{new Date(n.createdAt).toLocaleString()}</p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
