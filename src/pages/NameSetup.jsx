import { useEffect, useRef, useState } from 'react';
import { useSelector } from 'react-redux';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { APP_CONFIG, GENERIC_AUTH } from '@/config/app.config';
import ApperIcon from '@/components/ApperIcon';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import AuthLayout from '@/pages/auth/AuthLayout';
import {
  MAX_PREFERRED_NAME_LENGTH,
  normalizePreferredName,
  usePreferredName,
} from '@/personalization';
import { useGmail } from '@/gmail';

export const route = { path: '/onboarding/name', layout: 'public', access: 'authenticated' };

export default function NameSetup() {
  const navigate = useNavigate();
  const { hasPreferredName, isLoading, setPreferredName } = usePreferredName();
  const user = useSelector((s) => s.user.user);
  const { account } = useGmail();
  const suggestion = normalizePreferredName(user?.firstName || account?.name?.split(' ')[0] || '');
  const [value, setValue] = useState(suggestion);
  const edited = useRef(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!edited.current && suggestion) setValue(suggestion);
  }, [suggestion]);

  if (isLoading) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <ApperIcon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (hasPreferredName && !saving) {
    return <Navigate to={GENERIC_AUTH.redirectAfterAuth} replace />;
  }

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!normalizePreferredName(value)) {
      setError('Please tell us what to call you.');
      return;
    }
    setError(null);
    setSaving(true);
    try {
      const name = await setPreferredName(value);
      toast.success(`Nice to meet you, ${name}.`);
      navigate(GENERIC_AUTH.redirectAfterAuth, { replace: true });
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
      setSaving(false);
    }
  };

  return (
    <AuthLayout
      title="What should we call you?"
      description={`We'll use your name to make ${APP_CONFIG.name} feel a little more personal.`}
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
        <div className="space-y-1">
          <Label htmlFor="preferred-name">Your name</Label>
          <Input
            id="preferred-name"
            value={value}
            onChange={(e) => {
              edited.current = true;
              setValue(e.target.value);
            }}
            placeholder="Your name"
            autoComplete="given-name"
            maxLength={MAX_PREFERRED_NAME_LENGTH}
            autoFocus
            required
            aria-invalid={Boolean(error)}
            className="h-12"
          />
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="pt-2">
          <Button type="submit" disabled={saving} className="w-full h-12 rounded-xl text-[16px] font-semibold">
            {saving ? 'Saving…' : 'Continue'}
          </Button>
        </div>
      </form>
    </AuthLayout>
  );
}
