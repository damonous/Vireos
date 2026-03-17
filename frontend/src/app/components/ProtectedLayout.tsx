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
        {/* Top bar with notification bell */}
        {!isEasyModeRoute && (
          <div className="flex items-center justify-end px-6 py-2 bg-white border-b border-gray-200 shrink-0">
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
