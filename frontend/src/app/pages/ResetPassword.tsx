import { useMemo, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import { ArrowLeft, Bird, KeyRound } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { apiClient } from '../lib/api-client';

export default function ResetPassword() {
  const location = useLocation();
  const navigate = useNavigate();
  const tokenFromQuery = useMemo(() => new URLSearchParams(location.search).get('token') ?? '', [location.search]);
  const [token, setToken] = useState(tokenFromQuery);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/auth/reset-password', {
        token: token.trim(),
        password,
      });
      setSuccess('Password updated successfully. Redirecting to sign in...');
      window.setTimeout(() => navigate('/login', { replace: true }), 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to reset password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-[460px] p-8 shadow-lg border border-gray-200">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#0EA5E9] rounded-lg flex items-center justify-center">
              <Bird className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-[#1E3A5F]">Vireos</h1>
          </div>
          <h2 className="text-xl font-semibold text-[#1E3A5F]">Set a new password</h2>
          <p className="text-sm text-gray-600 mt-2">Use the reset token from your email to finish onboarding or recover access.</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <Label htmlFor="token" className="text-sm font-medium text-gray-700 mb-2 block">
              Reset token
            </Label>
            <Input
              id="token"
              value={token}
              onChange={(event) => setToken(event.target.value)}
              placeholder="Paste reset token"
              required
            />
          </div>

          <div>
            <Label htmlFor="password" className="text-sm font-medium text-gray-700 mb-2 block">
              New password
            </Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="At least 8 characters, one uppercase, one number"
              required
            />
          </div>

          <div>
            <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700 mb-2 block">
              Confirm new password
            </Label>
            <Input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Repeat your password"
              required
            />
          </div>

          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          {success ? <p className="text-sm text-green-700">{success}</p> : null}

          <Button type="submit" disabled={busy || !token.trim() || !password} className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white h-11">
            <KeyRound className="w-4 h-4 mr-2" />
            {busy ? 'Updating password...' : 'Update password'}
          </Button>

          <Link to="/login" className="inline-flex items-center gap-2 text-sm text-[#0EA5E9] hover:underline">
            <ArrowLeft className="h-4 w-4" />
            Back to sign in
          </Link>
        </form>
      </Card>
    </div>
  );
}
