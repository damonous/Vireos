import { NavLink, useNavigate, useLocation } from 'react-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { 
  LayoutDashboard, 
  Sparkles, 
  CheckCircle2, 
  Calendar, 
  Linkedin, 
  Facebook, 
  Search, 
  Users, 
  Mail, 
  BarChart3, 
  CreditCard, 
  Settings,
  Bird,
  ChevronDown,
  LogOut,
  RefreshCw,
  UserCog,
  FileText,
  Building2,
  ClipboardList,
  Activity,
  Shield,
  Flag,
  SlidersHorizontal,
  PenTool,
  FileUp
} from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import type { FrontendRole } from '../types/api';

interface NavItem {
  path: string;
  label: string;
  icon: typeof LayoutDashboard;
  /** When set, this prefix is used for active-state matching instead of path */
  matchPrefix?: string;
}

const easyNavItems: NavItem[] = [
  { path: '/home', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/billing', label: 'Billing', icon: CreditCard },
];

const advisorNavItems: NavItem[] = [
  { path: '/home', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/content/generate', label: 'Create Content', icon: PenTool, matchPrefix: '/content' },
  { path: '/compliance', label: 'Compliance Queue', icon: CheckCircle2 },
  { path: '/calendar', label: 'Publishing Calendar', icon: Calendar },
  { path: '/linkedin', label: 'LinkedIn Outreach', icon: Linkedin },
  { path: '/facebook', label: 'Facebook Ads', icon: Facebook },
  { path: '/prospects', label: 'Prospect Finder', icon: Search },
  { path: '/leads', label: 'Lead Management', icon: Users },
  { path: '/email', label: 'Email Campaigns', icon: Mail },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/billing', label: 'Billing', icon: CreditCard },
  { path: '/settings', label: 'Settings', icon: Settings },
];

const adminNavItems: NavItem[] = [
  { path: '/admin/home', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/content/generate', label: 'Create Content', icon: PenTool, matchPrefix: '/content' },
  { path: '/compliance', label: 'Compliance Queue', icon: CheckCircle2 },
  { path: '/calendar', label: 'Publishing Calendar', icon: Calendar },
  { path: '/linkedin', label: 'LinkedIn Outreach', icon: Linkedin },
  { path: '/facebook', label: 'Facebook Ads', icon: Facebook },
  { path: '/prospects', label: 'Prospect Finder', icon: Search },
  { path: '/leads', label: 'Lead Management', icon: Users },
  { path: '/email', label: 'Email Campaigns', icon: Mail },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const adminSectionItems: NavItem[] = [
  { path: '/admin/users', label: 'User Management', icon: UserCog },
  { path: '/admin/reports', label: 'Team Reports', icon: FileText },
  { path: '/admin/org-settings', label: 'Org Settings', icon: Building2 },
  { path: '/admin/billing', label: 'Billing', icon: CreditCard },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

const complianceOfficerNavItems: NavItem[] = [
  { path: '/compliance-officer/home', label: 'Compliance Queue', icon: CheckCircle2 },
  { path: '/compliance-officer/review', label: 'Content Review', icon: ClipboardList },
  { path: '/compliance-officer/audit', label: 'Audit Trail', icon: FileText },
  { path: '/compliance-officer/reports', label: 'Reports', icon: BarChart3 },
  { path: '/compliance-officer/settings', label: 'Settings', icon: Settings },
];

const superAdminNavItems: NavItem[] = [
  { path: '/super-admin/home', label: 'Platform Overview', icon: LayoutDashboard },
  { path: '/super-admin/orgs', label: 'Organizations', icon: Building2 },
  { path: '/super-admin/users', label: 'Users', icon: Users },
  { path: '/super-admin/prospects', label: 'Prospects', icon: FileUp },
  { path: '/super-admin/tokens', label: 'Token Usage', icon: Sparkles },
  { path: '/super-admin/health', label: 'System Health', icon: Activity },
  { path: '/super-admin/billing', label: 'Billing', icon: CreditCard },
  { path: '/super-admin/flags', label: 'Feature Flags', icon: Flag },
  { path: '/super-admin/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

function formatRole(role: FrontendRole): string {
  switch (role) {
    case 'admin':
      return 'Admin';
    case 'compliance-officer':
      return 'Compliance Officer';
    case 'super-admin':
      return 'Super Admin';
    default:
      return 'Advisor';
  }
}

function initials(firstName?: string, lastName?: string): string {
  const a = firstName?.[0] ?? '';
  const b = lastName?.[0] ?? '';
  return `${a}${b}`.toUpperCase() || 'U';
}

export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();

  // Persist Easy/Boss mode across navigation within Easy mode pages
  // Default to "easy" when neither sessionStorage nor user settings have a value (new users)
  const [isEasy, setIsEasy] = useState(() => {
    const stored = sessionStorage.getItem('vireos-mode');
    if (stored) return stored === 'easy';
    const preferred = user?.settings?.preferredMode;
    return preferred !== 'boss'; // default to easy
  });

  // On mount, sync from user settings if sessionStorage has no mode set
  useEffect(() => {
    const stored = sessionStorage.getItem('vireos-mode');
    if (!stored && user?.settings?.preferredMode) {
      const mode = user.settings.preferredMode;
      sessionStorage.setItem('vireos-mode', mode);
      setIsEasy(mode === 'easy');
    }
  }, [user?.settings?.preferredMode]);

  useEffect(() => {
    if (location.pathname === '/easy') {
      sessionStorage.setItem('vireos-mode', 'easy');
      setIsEasy(true);
    }
  }, [location.pathname]);

  const activateEasy = useCallback(() => {
    sessionStorage.setItem('vireos-mode', 'easy');
    setIsEasy(true);
    // Persist before navigate — component unmounts on route change
    const token = localStorage.getItem('vireos_access_token');
    if (token) {
      fetch('/api/v1/auth/me/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferredMode: 'easy' }),
        keepalive: true,
      }).catch(() => {});
    }
    navigate('/easy');
  }, [navigate]);

  const activateBoss = useCallback(() => {
    sessionStorage.setItem('vireos-mode', 'boss');
    setIsEasy(false);
    // Persist before navigate — component unmounts on route change
    const token = localStorage.getItem('vireos_access_token');
    if (token) {
      fetch('/api/v1/auth/me/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ preferredMode: 'boss' }),
        keepalive: true,
      }).catch(() => {});
    }
    navigate('/home');
  }, [navigate]);

  const role = user?.role ?? 'advisor';
  const navConfig = useMemo(() => {
    if (isEasy) return { items: easyNavItems, showAdminSection: false };
    if (role === 'admin') return { items: adminNavItems, showAdminSection: true };
    if (role === 'compliance-officer') return { items: complianceOfficerNavItems, showAdminSection: false };
    if (role === 'super-admin') return { items: superAdminNavItems, showAdminSection: false };
    return { items: advisorNavItems, showAdminSection: false };
  }, [role, isEasy]);

  const handleSwitchRole = () => {
    setShowDropdown(false);
    navigate('/login');
  };

  const handleSignOut = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div 
      className={`
        w-64 bg-[#1E3A5F] h-screen flex flex-col
        fixed md:fixed top-0 left-0 z-40
        transition-transform duration-300 ease-in-out
        ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
      `}
    >
      {/* Logo */}
      <div className="p-6 flex items-center gap-3">
        <div className="w-8 h-8 bg-[#0EA5E9] rounded-lg flex items-center justify-center">
          <Bird className="w-5 h-5 text-white" />
        </div>
        <span className="text-white text-xl font-semibold">Vireos</span>
      </div>

      {/* Easy/Boss Mode Toggle */}
      <div className="bg-[#1a334d]/50 rounded-full p-0.5 mx-3 mb-4 flex">
        <button
          onClick={activateEasy}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${isEasy ? 'bg-[#152d44] text-white font-medium' : 'text-gray-400 hover:text-gray-300'}`}
        >
          <Sparkles className="w-3 h-3" />
          <span>Easy</span>
        </button>
        <button
          onClick={activateBoss}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors ${isEasy ? 'text-gray-400 hover:text-gray-300' : 'bg-[#152d44] text-white font-medium'}`}
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Boss</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {navConfig.items.map((item) => {
          const Icon = item.icon;
          const isHome = item.path === '/home' || item.path === '/admin/home' || item.path === '/compliance-officer/home' || item.path === '/super-admin/home';
          const prefixActive = item.matchPrefix ? location.pathname.startsWith(item.matchPrefix) : false;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={isHome}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  isActive || prefixActive
                    ? 'bg-[#0EA5E9] text-white'
                    : 'text-gray-300 hover:bg-[#2B4A6F] hover:text-white'
                }`
              }
            >
              <Icon className="w-5 h-5" />
              <span className="text-sm">{item.label}</span>
            </NavLink>
          );
        })}

        {/* Admin Section */}
        {navConfig.showAdminSection && (
          <>
            <div className="my-4 border-t border-[#2B4A6F]"></div>
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Administration
            </div>
            {adminSectionItems.map((item) => {
              const Icon = item.icon;
              const prefixActive = item.matchPrefix ? location.pathname.startsWith(item.matchPrefix) : false;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                      isActive || prefixActive
                        ? 'bg-[#0EA5E9] text-white'
                        : 'text-gray-300 hover:bg-[#2B4A6F] hover:text-white'
                    }`
                  }
                >
                  <Icon className="w-5 h-5" />
                  <span className="text-sm">{item.label}</span>
                </NavLink>
              );
            })}
          </>
        )}
      </nav>

      {/* User Profile with Dropdown */}
      <div className="p-4 border-t border-[#2B4A6F] relative" ref={dropdownRef}>
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="flex items-center gap-3 w-full hover:bg-[#2B4A6F] p-2 rounded-lg transition-colors"
        >
          <div className="w-10 h-10 rounded-full bg-[#0EA5E9] flex items-center justify-center text-white font-medium">
            {initials(user?.firstName, user?.lastName)}
          </div>
          <div className="flex-1 text-left">
            <div className="text-white text-sm font-medium">
              {`${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim() || user?.email || 'User'}
            </div>
            <div className="text-gray-400 text-xs">{formatRole(role)} · {user?.organization?.name ?? 'Organization'}</div>
          </div>
          <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown Menu */}
        {showDropdown && (
          <div className="absolute bottom-full left-4 right-4 mb-2 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50">
            <button
              onClick={() => {
                setShowDropdown(false);
                navigate('/settings');
              }}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <Settings className="w-4 h-4" />
              View Profile
            </button>
            <button
              onClick={handleSwitchRole}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Switch Role
            </button>
            <div className="border-t border-gray-200 my-1"></div>
            <button
              onClick={() => void handleSignOut()}
              className="flex items-center gap-2 w-full px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
            >
              <LogOut className="w-4 h-4" />
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
