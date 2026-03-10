import { NavLink, useNavigate } from 'react-router';
import { useState, useEffect, useRef } from 'react';
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
  MessageSquare,
  SlidersHorizontal,
  PenTool
} from 'lucide-react';

const advisorNavItems = [
  { path: '/home', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ai-content', label: 'Create Content', icon: PenTool },
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

const adminNavItems = [
  { path: '/admin/home', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/ai-content', label: 'Create Content', icon: PenTool },
  { path: '/compliance', label: 'Compliance Queue', icon: CheckCircle2 },
  { path: '/calendar', label: 'Publishing Calendar', icon: Calendar },
  { path: '/linkedin', label: 'LinkedIn Outreach', icon: Linkedin },
  { path: '/facebook', label: 'Facebook Ads', icon: Facebook },
  { path: '/prospects', label: 'Prospect Finder', icon: Search },
  { path: '/leads', label: 'Lead Management', icon: Users },
  { path: '/email', label: 'Email Campaigns', icon: Mail },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
];

const adminSectionItems = [
  { path: '/admin/users', label: 'User Management', icon: UserCog },
  { path: '/admin/reports', label: 'Team Reports', icon: FileText },
  { path: '/admin/org-settings', label: 'Org Settings', icon: Building2 },
  { path: '/admin/billing', label: 'Billing', icon: CreditCard },
  { path: '/admin/settings', label: 'Settings', icon: Settings },
];

const complianceOfficerNavItems = [
  { path: '/compliance-officer/home', label: 'Compliance Queue', icon: CheckCircle2 },
  { path: '/compliance-officer/review', label: 'Content Review', icon: ClipboardList },
  { path: '/compliance-officer/audit', label: 'Audit Trail', icon: FileText },
  { path: '/compliance-officer/reports', label: 'Reports', icon: BarChart3 },
  { path: '/compliance-officer/settings', label: 'Settings', icon: Settings },
];

const superAdminNavItems = [
  { path: '/super-admin/home', label: 'Platform Overview', icon: LayoutDashboard },
  { path: '/super-admin/orgs', label: 'Organizations', icon: Building2 },
  { path: '/super-admin/users', label: 'Users', icon: Users },
  { path: '/super-admin/health', label: 'System Health', icon: Activity },
  { path: '/super-admin/billing', label: 'Billing', icon: CreditCard },
  { path: '/super-admin/flags', label: 'Feature Flags', icon: Flag },
  { path: '/super-admin/settings', label: 'Settings', icon: Settings },
];

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}
export function Sidebar({ isOpen, onClose }: SidebarProps) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [userName, setUserName] = useState('Sarah Mitchell');
  const [userInitials, setUserInitials] = useState('SM');
  const [userRole, setUserRole] = useState('advisor');
  const [userRoleLabel, setUserRoleLabel] = useState('Advisor');
  const [companyName, setCompanyName] = useState('Pinnacle Financial');
  const dropdownRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    // Load user info from localStorage
    const storedName = localStorage.getItem('vireos_user_name');
    const storedInitials = localStorage.getItem('vireos_user_initials');
    const storedRole = localStorage.getItem('vireos_role');
    if (storedName) setUserName(storedName);
    if (storedInitials) setUserInitials(storedInitials);
    if (storedRole) {
      setUserRole(storedRole);
      // Set role label and user info based on role
      if (storedRole === 'admin') {
        setUserRoleLabel('Admin');
        setCompanyName('Pinnacle Financial');
      } else if (storedRole === 'compliance-officer') {
        setUserRoleLabel('Compliance Officer');
        setCompanyName('Pinnacle Financial');
      } else if (storedRole === 'super-admin') {
        setUserRoleLabel('Super Admin');
        setCompanyName('Vireos');
      } else {
        setUserRoleLabel('Advisor');
        setCompanyName('Pinnacle Financial');
      }
    }

    // Close dropdown when clicking outside
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitchRole = () => {
    setShowDropdown(false);
    navigate('/login');
  };

  const handleSignOut = () => {
    localStorage.removeItem('vireos_role');
    localStorage.removeItem('vireos_user_name');
    localStorage.removeItem('vireos_user_initials');
    navigate('/login');
  };

  // Determine which nav items to show based on role
  let navItems = advisorNavItems;
  let showAdminSection = false;

  if (userRole === 'admin') {
    navItems = adminNavItems;
    showAdminSection = true;
  } else if (userRole === 'compliance-officer') {
    navItems = complianceOfficerNavItems;
  } else if (userRole === 'super-admin') {
    navItems = superAdminNavItems;
  }

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
          onClick={() => navigate('/easy')}
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors text-gray-400 hover:text-gray-300"
        >
          <Sparkles className="w-3 h-3" />
          <span>Easy</span>
        </button>
        <button
          className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-colors bg-[#152d44] text-white font-medium"
        >
          <SlidersHorizontal className="w-3 h-3" />
          <span>Boss</span>
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-2 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === '/home' || item.path === '/admin/home' || item.path === '/compliance-officer/home' || item.path === '/super-admin/home'}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                  isActive
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
        {showAdminSection && (
          <>
            <div className="my-4 border-t border-[#2B4A6F]"></div>
            <div className="px-3 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">
              Administration
            </div>
            {adminSectionItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1 transition-colors ${
                      isActive
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
            {userInitials}
          </div>
          <div className="flex-1 text-left">
            <div className="text-white text-sm font-medium">{userName}</div>
            <div className="text-gray-400 text-xs">{userRoleLabel} · {companyName}</div>
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
              onClick={handleSignOut}
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