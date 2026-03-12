import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, Bird, UserPlus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { apiClient } from '../lib/api-client';
import { useAuth } from '../hooks/useAuth';
import type { AuthTokens } from '../types/api';

export default function Register() {
  const location = useLocation();
  const navigate = useNavigate();
  const { establishSession } = useAuth();
  const params = useMemo(() => new URLSearchParams(location.search), [location.search]);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [organizationId, setOrganizationId] = useState(params.get('organizationId') ?? params.get('orgId') ?? '');
  const [organizationName, setOrganizationName] = useState(params.get('organizationName') ?? '');
  const [inviteToken, setInviteToken] = useState(params.get('inviteToken') ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const tokens = await apiClient.post<AuthTokens>('/auth/register', {
        email: email.trim(),
        password,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        organizationId: organizationId.trim() || undefined,
        organizationName: organizationName.trim() || undefined,
        inviteToken: inviteToken.trim() || undefined,
      });
      await establishSession(tokens);
      navigate('/billing?onboarding=required', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-[520px] p-8 shadow-lg border border-gray-200">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#0EA5E9] rounded-lg flex items-center justify-center">
              <Bird className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-[#1E3A5F]">Vireos</h1>
          </div>
          <h2 className="text-xl font-semibold text-[#1E3A5F]">Create your account</h2>
          <p className="text-sm text-gray-600 mt-2">
            Registration is scoped to an existing organization. After account creation, you will land on plan selection before using the app.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="firstName" className="text-sm font-medium text-gray-700 mb-2 block">
                First name
              </Label>
              <Input id="firstName" value={firstName} onChange={(event) => setFirstName(event.target.value)} required />
            </div>
            <div>
              <Label htmlFor="lastName" className="text-sm font-medium text-gray-700 mb-2 block">
                Last name
              </Label>
              <Input id="lastName" value={lastName} onChange={(event) => setLastName(event.target.value)} required />
            </div>
          </div>

          <div>
            <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-2 block">
              Email
            </Label>
            <Input id="email" type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </div>

          <div>
            <Label htmlFor="organizationName" className="text-sm font-medium text-gray-700 mb-2 block">
              Organization name
            </Label>
            <Input id="organizationName" value={organizationName} onChange={(event) => setOrganizationName(event.target.value)} placeholder="Your firm or organization name" required={!organizationId.trim()} />
          </div>

          <div>
            <Label htmlFor="organizationId" className="text-sm font-medium text-gray-700 mb-2 block">
              Organization ID (optional)
            </Label>
            <Input id="organizationId" value={organizationId} onChange={(event) => setOrganizationId(event.target.value)} placeholder="UUID from your admin or invite" />
          </div>

          <div>
            <Label htmlFor="inviteToken" className="text-sm font-medium text-gray-700 mb-2 block">
              Invite token (optional)
            </Label>
            <Input id="inviteToken" value={inviteToken} onChange={(event) => setInviteToken(event.target.value)} placeholder="Only required for invite-specific onboarding" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="password" className="text-sm font-medium text-gray-700 mb-2 block">
                Password
              </Label>
              <Input id="password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 chars, uppercase, number" required />
            </div>
            <div>
              <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 mb-2 block">
                Confirm password
              </Label>
              <Input id="confirmPassword" type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} required />
            </div>
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}

          <Button type="submit" disabled={busy} className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white h-11">
            <UserPlus className="w-4 h-4 mr-2" />
            {busy ? 'Creating account...' : 'Create account'}
          </Button>

          <div className="flex items-center justify-between text-sm">
            <Link to="/login" className="inline-flex items-center gap-2 text-[#0EA5E9] hover:underline">
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
            <Link to="/forgot-password" className="text-[#0EA5E9] hover:underline">
              Forgot password?
            </Link>
          </div>
        </form>
      </Card>
    </div>
  );
}
