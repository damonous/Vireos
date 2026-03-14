import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';

export function ProtectedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const isEasyModeRoute = location.pathname === '/easy';

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

      <div className={`flex-1 overflow-y-auto ${isEasyModeRoute ? '' : 'md:ml-64'}`}>
        <Outlet />
      </div>
    </div>
  );
}
