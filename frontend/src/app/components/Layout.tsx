import { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router';
import { Sidebar } from './Sidebar';

export function Layout() {
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // Check if user is logged in (has a role set)
    const role = localStorage.getItem('vireos_role');
    
    // If not logged in and not on login page, redirect to login
    if (!role && location.pathname !== '/login') {
      navigate('/login', { replace: true });
    }
    
    // If on root path and logged in, redirect to /home
    if (location.pathname === '/' && role) {
      navigate('/home', { replace: true });
    }
  }, [navigate, location.pathname]);

  return (
    <div className="flex h-screen overflow-hidden bg-[#F8F9FB]">
      <Sidebar />
      <Outlet />
    </div>
  );
}
