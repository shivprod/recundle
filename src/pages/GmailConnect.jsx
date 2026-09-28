import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { APP_CONFIG, GENERIC_AUTH } from '@/config/app.config';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import AuthLayout from '@/pages/auth/AuthLayout';
import { usePreferredName } from '@/personalization';
import { useGmail } from '@/gmail';

export const route = { path: '/onboarding/gmail', layout: 'public', access: 'authenticated' };

const NAME_STEP = '/onboarding/name';

const POINTS = [
  { icon: 'Receipt', text: 'We only search for receipts and invoices, from services like Netflix, Spotify and Google Play.' },
  { icon: 'EyeOff', text: "Read-only. Recundle can't send, delete or change your email." },
  { icon: 'Smartphone', text: 'Your subscription list is kept on this device. Disconnect any time.' },
];

export default function GmailConnect() {
  const navigate = useNavigate();
  const { hasPreferredName, isLoading } = usePreferredName();
  const { isReady, hasDecided, connect, skip } = useGmail();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  if (isLoading || !isReady) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <ApperIcon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (hasPreferredName) {
    return <Navigate to={GENERIC_AUTH.redirectAfterAuth} replace />;
  }
  if (hasDecided && !connecting) {
    return <Navigate to={NAME_STEP} replace />;
  }

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      await connect();
      toast.success('Gmail connected. Finding your subscriptions…');
      navigate(NAME_STEP, { replace: true });
    } catch (err) {
      setConnecting(false);
      if (err?.code === 'popup_closed') return;
      if (err?.code === 'gmail_not_granted') {
        setError('Gmail access wasn\'t granted. On Google\'s screen, tick "Read your email" to let Recundle find your receipts.');
        return;
      }
      setError(err?.message || 'Could not connect Gmail. Please try again.');
    }
  };

  const handleSkip = () => {
    skip();
    navigate(NAME_STEP, { replace: true });
  };

  return (
    <AuthLayout
      title="Find your subscriptions automatically"
      description={`Connect Gmail and ${APP_CONFIG.name} will build your subscription list from your receipts.`}
    >
      <ul className="flex flex-col gap-3 mb-6">
        {POINTS.map((p) => (
          <li key={p.icon} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
              <ApperIcon name={p.icon} size={15} />
            </span>
            <span className="min-w-0 text-muted-foreground">{p.text}</span>
          </li>
        ))}
      </ul>
      {error && <p className="mb-3 text-sm text-destructive">{error}</p>}
      <div className="flex flex-col gap-2">
        <Button onClick={handleConnect} disabled={connecting} className="w-full h-9">
          <ApperIcon name="Mail" size={16} />
          {connecting ? 'Connecting…' : 'Connect Gmail'}
        </Button>
        <Button variant="ghost" onClick={handleSkip} disabled={connecting} className="w-full h-9">
          Not now
        </Button>
      </div>
    </AuthLayout>
  );
}
