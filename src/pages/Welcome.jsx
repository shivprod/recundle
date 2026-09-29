import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { GENERIC_AUTH } from '@/config/app.config';
import ApperIcon from '@/components/ApperIcon';
import SyncShowcase from '@/components/SyncShowcase';
import { Button } from '@/components/ui/button';
import { usePreferredName } from '@/personalization';
import { useGmail } from '@/gmail';

export const route = { path: '/', layout: 'public' };

const GOOGLE_G = (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34.1 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
  </svg>
);

function errorMessage(err) {
  if (err?.code === 'gmail_not_granted') {
    return 'Gmail access wasn\'t granted. On Google\'s screen, tick "Read your email" so Recundle can find your receipts.';
  }
  return err?.message || 'Could not sign in with Google. Please try again.';
}

/**
 * Sign-in screen: popular services float around the Recundle mark with one
 * "Continue with Google" button. Google sign-in also grants read-only Gmail
 * access, and the first page of receipts is read here, so the dashboard opens
 * on real subscriptions.
 */
export default function Welcome() {
  const { preferredName } = usePreferredName();
  const { isReady, isConnected, account, sync, connect, syncNow } = useGmail();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const firstSyncPending = isConnected && !sync?.syncedAt;
  const firstSyncFailed = firstSyncPending && sync?.status === 'error';
  const syncing = connecting || (firstSyncPending && !firstSyncFailed);

  // Resume the first read after a reload mid-sync.
  useEffect(() => {
    if (firstSyncPending && sync?.status === 'idle') syncNow();
  }, [firstSyncPending, sync?.status, syncNow]);

  if (!isReady) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <ApperIcon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (isConnected && !connecting && !firstSyncPending) {
    return <Navigate to={GENERIC_AUTH.redirectAfterAuth} replace />;
  }

  const handleContinue = async () => {
    setError(null);
    if (firstSyncFailed) {
      syncNow();
      return;
    }
    setConnecting(true);
    try {
      await connect();
    } catch (err) {
      if (err?.code !== 'popup_closed') setError(errorMessage(err));
    } finally {
      setConnecting(false);
    }
  };

  const name = preferredName || account?.name?.split(' ')[0];
  const status = connecting && !isConnected
    ? 'Waiting for Google…'
    : sync?.scanned
      ? `Reading your receipts… ${sync.scanned} emails checked`
      : 'Reading your receipts…';

  return (
    <main className="min-h-svh flex flex-col items-center justify-center px-4 py-12">
      <div className="w-full max-w-[26rem] flex flex-col items-center text-center">
        <SyncShowcase syncing={syncing} />

        <h1 className="mt-6 text-[28px] font-bold leading-tight tracking-tight text-balance">
          {syncing
            ? name ? `${name}, finding your subscriptions…` : 'Finding your subscriptions…'
            : 'Every subscription. One place.'}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground text-balance">
          {syncing
            ? 'This takes a few seconds. Keep this screen open.'
            : 'Sign in with Google and Recundle finds your subscriptions from the receipts in your Gmail.'}
        </p>

        <div className="mt-6 w-full" aria-live="polite">
          {syncing ? (
            <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary text-[15px] font-medium text-secondary-foreground">
              <ApperIcon name="Loader2" size={16} className="animate-spin" />
              {status}
            </div>
          ) : firstSyncFailed ? (
            <Button onClick={handleContinue} disabled={Date.parse(sync?.retryAt ?? '') > Date.now()} className="w-full h-12 rounded-xl text-[16px] font-semibold">
              <ApperIcon name="RefreshCw" size={16} />
              Try again
            </Button>
          ) : (
            <Button onClick={handleContinue} className="w-full h-12 rounded-xl text-[16px] font-semibold">
              {GOOGLE_G}
              Continue with Google
            </Button>
          )}
        </div>

        {(error || firstSyncFailed) && (
          <p className="mt-3 text-sm text-destructive">{error || sync?.error}</p>
        )}

        <p className="mt-4 text-xs text-muted-foreground text-balance">
          Read-only Gmail access · Only receipts and invoices · Sign out any time
        </p>
      </div>
    </main>
  );
}
