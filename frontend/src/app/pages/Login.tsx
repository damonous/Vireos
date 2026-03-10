import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Bird, ChevronRight } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';

interface Role {
  id: string;
  name: string;
  title: string;
  organization: string;
  initials: string;
  route: string;
  badge: string;
  badgeColor: string;
}

const roles: Role[] = [
  {
    id: 'advisor',
    name: 'Sarah Mitchell',
    title: 'Advisor',
    organization: 'Pinnacle Financial',
    initials: 'SM',
    route: '/home',
    badge: 'Advisor',
    badgeColor: 'bg-[#0EA5E9] text-white',
  },
  {
    id: 'admin',
    name: 'James Peterson',
    title: 'Admin',
    organization: 'Pinnacle Financial',
    initials: 'JP',
    route: '/admin/home',
    badge: 'Admin',
    badgeColor: 'bg-purple-600 text-white',
  },
  {
    id: 'compliance-officer',
    name: 'Rachel Torres',
    title: 'Compliance Officer',
    organization: 'Pinnacle Financial',
    initials: 'RT',
    route: '/compliance-officer/home',
    badge: 'Compliance',
    badgeColor: 'bg-amber-600 text-white',
  },
  {
    id: 'super-admin',
    name: 'Platform Admin',
    title: 'Super Admin',
    organization: 'Vireos Platform',
    initials: 'PA',
    route: '/super-admin/home',
    badge: 'Super Admin',
    badgeColor: 'bg-red-600 text-white',
  },
];

export default function Login() {
  const [showRoleSelector, setShowRoleSelector] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Validate that both fields are non-empty
    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password');
      return;
    }
    
    // Clear error and set localStorage for demo
    setError('');
    localStorage.setItem('vireos_role', 'advisor');
    localStorage.setItem('vireos_user_name', 'Sarah Mitchell');
    localStorage.setItem('vireos_user_initials', 'SM');
    
    // Navigate to advisor home
    navigate('/home');
  };

  const handleRoleSelect = (role: Role) => {
    // Store role in localStorage
    localStorage.setItem('vireos_role', role.id);
    localStorage.setItem('vireos_user_name', role.name);
    localStorage.setItem('vireos_user_initials', role.initials);
    
    // Navigate to role-specific route
    navigate(role.route);
  };

  const handleSignOut = () => {
    setShowRoleSelector(false);
    setEmail('');
    setPassword('');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div 
        className={`bg-white rounded-lg shadow-lg w-full transition-all duration-300 ${
          showRoleSelector ? 'max-w-2xl' : 'max-w-[440px]'
        }`}
      >
        {!showRoleSelector ? (
          // Login Form
          <div className="p-8">
            {/* Logo and Branding */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center gap-3 mb-4">
                <div className="w-12 h-12 bg-[#0EA5E9] rounded-lg flex items-center justify-center">
                  <Bird className="w-7 h-7 text-white" />
                </div>
                <h1 className="text-3xl font-bold text-[#1E3A5F]">Vireos</h1>
              </div>
              <p className="text-sm text-gray-600">
                AI-Powered Marketing for Financial Advisors
              </p>
            </div>

            {/* Login Form */}
            <form onSubmit={handleSignIn} className="space-y-5">
              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-2 block">
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full"
                  required
                />
              </div>

              <div>
                <Label htmlFor="password" className="text-sm font-medium text-gray-700 mb-2 block">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                  required
                />
              </div>

              <Button
                type="submit"
                className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white h-11"
              >
                Sign In
              </Button>
              
              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
            </form>

            {/* Additional Links */}
            <div className="mt-6 text-center">
              <a href="#" className="text-sm text-[#0EA5E9] hover:underline">
                Forgot password?
              </a>
            </div>

            {/* Quick Login Section */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-400 text-center mb-4">
                Quick Login (Demo)
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => {
                    localStorage.setItem('vireos_role', 'advisor');
                    localStorage.setItem('vireos_user_name', 'Sarah Mitchell');
                    localStorage.setItem('vireos_user_initials', 'SM');
                    navigate('/home');
                  }}
                  className="p-3 rounded-lg border-2 border-[#0EA5E9] bg-white hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">Advisor</div>
                  <div className="text-xs text-gray-500">Sarah Mitchell</div>
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem('vireos_role', 'admin');
                    localStorage.setItem('vireos_user_name', 'James Peterson');
                    localStorage.setItem('vireos_user_initials', 'JP');
                    navigate('/admin/home');
                  }}
                  className="p-3 rounded-lg border-2 border-[#7C3AED] bg-white hover:bg-purple-50 transition-colors text-left"
                >
                  <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">Admin</div>
                  <div className="text-xs text-gray-500">James Peterson</div>
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem('vireos_role', 'compliance-officer');
                    localStorage.setItem('vireos_user_name', 'Rachel Torres');
                    localStorage.setItem('vireos_user_initials', 'RT');
                    navigate('/compliance-officer/home');
                  }}
                  className="p-3 rounded-lg border-2 border-[#F97316] bg-white hover:bg-orange-50 transition-colors text-left"
                >
                  <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">Compliance</div>
                  <div className="text-xs text-gray-500">Rachel Torres</div>
                </button>

                <button
                  onClick={() => {
                    localStorage.setItem('vireos_role', 'super-admin');
                    localStorage.setItem('vireos_user_name', 'Platform Admin');
                    localStorage.setItem('vireos_user_initials', 'PA');
                    navigate('/super-admin/home');
                  }}
                  className="p-3 rounded-lg border-2 border-[#EF4444] bg-white hover:bg-red-50 transition-colors text-left"
                >
                  <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">Super Admin</div>
                  <div className="text-xs text-gray-500">Platform Admin</div>
                </button>
              </div>
            </div>
          </div>
        ) : (
          // Role Selector
          <div className="p-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-semibold text-[#1E3A5F] mb-2">
                Welcome back!
              </h2>
              <p className="text-gray-600">Select your workspace:</p>
            </div>

            {/* Role Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
              {roles.map((role) => (
                <button
                  key={role.id}
                  onClick={() => handleRoleSelect(role)}
                  className="flex items-center gap-4 p-4 rounded-lg border-2 border-gray-200 hover:border-[#0EA5E9] hover:bg-blue-50 transition-all text-left group"
                >
                  <div className="w-12 h-12 bg-[#1E3A5F] rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0">
                    {role.initials}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-[#1E3A5F] truncate">
                      {role.name}
                    </p>
                    <span className={`inline-block text-xs px-2 py-0.5 rounded mt-1 ${role.badgeColor}`}>
                      {role.badge}
                    </span>
                    <p className="text-xs text-gray-500 mt-1 truncate">
                      {role.organization}
                    </p>
                  </div>
                  <ChevronRight className="w-5 h-5 text-gray-400 group-hover:text-[#0EA5E9] flex-shrink-0" />
                </button>
              ))}
            </div>

            {/* Sign Out Link */}
            <div className="text-center pt-4 border-t border-gray-200">
              <button
                onClick={handleSignOut}
                className="text-sm text-gray-600 hover:text-[#0EA5E9] hover:underline"
              >
                ← Back to sign in
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}