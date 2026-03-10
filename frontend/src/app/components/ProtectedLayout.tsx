import { useEffect, useState } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';
import { Menu } from 'lucide-react';

export function ProtectedLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  // Check if we're on the /easy route (which has its own custom sidebar)
  const isEasyMode = location.pathname === '/easy';

  useEffect(() => {
    // Check if user is logged in (has a role set)
    const role = localStorage.getItem('vireos_role');
    
    // If not logged in, redirect to login
    if (!role) {
      navigate('/login', { replace: true });
    }
  }, [navigate, location.pathname]);

  // Close sidebar on route change (mobile)
  useEffect(() => {
    setIsSidebarOpen(false);
  }, [location.pathname]);

  // If on /easy route, don't render the standard sidebar
  if (isEasyMode) {
    return <Outlet />;
  }

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB]">
      {/* Hamburger Button - Only visible on mobile */}
      <button
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded-lg shadow-lg flex items-center justify-center text-[#0EA5E9] hover:bg-gray-50 transition-colors"
      >
        <Menu className="w-6 h-6" />
      </button>

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      {/* Main Content */}
      <div className="flex-1 overflow-hidden md:ml-64">
        <Outlet />
      </div>
    </div>
  );
}