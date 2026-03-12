import { useState } from 'react';
import { Link } from 'react-router';
import { ArrowLeft, Bird, Mail } from 'lucide-react';
import { Button } from '../components/ui/button';
import { Card } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { apiClient } from '../lib/api-client';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to submit password reset request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-[440px] p-8 shadow-lg border border-gray-200">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-4">
            <div className="w-12 h-12 bg-[#0EA5E9] rounded-lg flex items-center justify-center">
              <Bird className="w-7 h-7 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-[#1E3A5F]">Vireos</h1>
          </div>
          <h2 className="text-xl font-semibold text-[#1E3A5F]">Reset your password</h2>
          <p className="text-sm text-gray-600 mt-2">
            Enter the email address tied to your account. If it exists, Vireos will send a reset link.
          </p>
        </div>

        {submitted ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-green-200 bg-green-50 p-4 text-sm text-green-800">
              Reset instructions have been requested for <span className="font-medium">{email}</span>.
            </div>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-[#0EA5E9] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-sm font-medium text-gray-700 mb-2 block">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </div>

            {error ? <p className="text-sm text-red-600">{error}</p> : null}

            <Button type="submit" disabled={busy || !email.trim()} className="w-full bg-[#0EA5E9] hover:bg-[#0284C7] text-white h-11">
              <Mail className="w-4 h-4 mr-2" />
              {busy ? 'Sending reset link...' : 'Send reset link'}
            </Button>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm text-[#0EA5E9] hover:underline"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to sign in
            </Link>
          </form>
        )}
      </Card>
    </div>
  );
}
