import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { Bird } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { useAuth } from '../hooks/useAuth';

interface Role {
  id: string;
  title: string;
  email: string;
  password: string;
  route: string;
}

const roles: Role[] = [
  {
    id: 'advisor',
    title: 'Advisor',
    email: 'advisor@vireos-demo.com',
    password: 'Password123!',
    route: '/home',
  },
  {
    id: 'admin',
    title: 'Admin',
    email: 'admin@vireos-demo.com',
    password: 'Password123!',
    route: '/admin/home',
  },
  {
    id: 'compliance-officer',
    title: 'Compliance Officer',
    email: 'compliance@vireos-demo.com',
    password: 'Password123!',
    route: '/compliance-officer/home',
  },
  {
    id: 'super-admin',
    title: 'Super Admin',
    email: 'super_admin@vireos.ai',
    password: 'Password123!',
    route: '/super-admin/home',
  },
];

export default function Login() {
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuth();
  const registrationMessage = useMemo(() => {
    const state = location.state as { registrationSuccess?: boolean; email?: string } | null;
    if (!state?.registrationSuccess) return null;
    return state.email ? `Account created for ${state.email}. Sign in to continue.` : 'Account created successfully. Sign in to continue.';
  }, [location.state]);

  const signInWithCredentials = async (emailValue: string, passwordValue: string, defaultRoute?: string) => {
    if (!emailValue.trim() || !passwordValue.trim()) {
      setError('Please enter your email and password');
      return;
    }

    setError('');
    setBusy(true);
    try {
      await login(emailValue.trim(), passwordValue);
      const matchedRole = roles.find((role) => role.email === emailValue.trim().toLowerCase());
      navigate(defaultRoute ?? matchedRole?.route ?? '/home');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign in failed');
    } finally {
      setBusy(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    await signInWithCredentials(email, password);
  };

  const applyDemoCredentials = async (role: Role) => {
    setError('');
    setEmail(role.email);
    setPassword(role.password);
    await signInWithCredentials(role.email, role.password, role.route);
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg w-full max-w-[440px] transition-all duration-300">
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
              {registrationMessage ? (
                <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-800">
                  {registrationMessage}
                </div>
              ) : null}

              <div>
                <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-2 block">
                  Email
                </Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
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
                  name="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={busy}
                className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white h-11"
              >
                {busy ? 'Signing In...' : 'Sign In'}
              </Button>
              
              {error && (
                <p className="text-sm text-red-600 text-center">{error}</p>
              )}
            </form>

            {/* Additional Links */}
            <div className="mt-6 text-center">
              <Link to="/forgot-password" className="text-sm text-[#0EA5E9] hover:underline">
                Forgot password?
              </Link>
              <span className="mx-2 text-gray-300">|</span>
              <Link to="/register" className="text-sm text-[#0EA5E9] hover:underline">
                Create account
              </Link>
            </div>

            {/* Quick Login Section */}
            <div className="mt-8 pt-6 border-t border-gray-200">
              <p className="text-xs text-gray-400 text-center mb-4">
                Demo Credentials
              </p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => applyDemoCredentials(roles[0])}
                  className="p-3 rounded-lg border-2 border-[#0EA5E9] bg-white hover:bg-blue-50 transition-colors text-left"
                >
                  <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">Advisor</div>
                  <div className="text-xs text-gray-500">{roles[0].email}</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyDemoCredentials(roles[1])}
                  className="p-3 rounded-lg border-2 border-[#7C3AED] bg-white hover:bg-purple-50 transition-colors text-left"
                >
                  <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">Admin</div>
                  <div className="text-xs text-gray-500">{roles[1].email}</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyDemoCredentials(roles[2])}
                  className="p-3 rounded-lg border-2 border-[#F97316] bg-white hover:bg-orange-50 transition-colors text-left"
                >
                  <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">Compliance</div>
                  <div className="text-xs text-gray-500">{roles[2].email}</div>
                </button>

                <button
                  type="button"
                  onClick={() => applyDemoCredentials(roles[3])}
                  className="p-3 rounded-lg border-2 border-[#EF4444] bg-white hover:bg-red-50 transition-colors text-left"
                >
                  <div className="text-xs font-semibold text-[#1E3A5F] mb-0.5">Super Admin</div>
                  <div className="text-xs text-gray-500">{roles[3].email}</div>
                </button>
              </div>
            </div>
          </div>
      </div>
    </div>
  );
}
