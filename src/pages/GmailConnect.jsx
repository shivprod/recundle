import { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { GENERIC_AUTH } from '@/config/app.config';
import ApperIcon from '@/components/ApperIcon';
import SyncShowcase from '@/components/SyncShowcase';
import { Button } from '@/components/ui/button';
import { usePreferredName } from '@/personalization';
import { useGmail } from '@/gmail';

export const route = { path: '/onboarding/gmail', layout: 'public', access: 'authenticated' };

function errorMessage(err) {
  if (err?.code === 'gmail_not_granted') {
    return 'Gmail access wasn\'t granted. On Google\'s screen, tick "Read your email" so Recundle can find your receipts.';
  }
  return err?.message || 'Could not connect Gmail. Please try again.';
}

/**
 * First screen after sign-in: popular services float around the Recundle mark
 * with a Sync button. Sync connects Gmail (read-only) and reads the first page
 * of receipts here, so the next screen opens on real subscriptions.
 */
export default function GmailConnect() {
  const { preferredName, hasPreferredName, isLoading } = usePreferredName();
  const user = useSelector((s) => s.user.user);
  const { isReady, isConnected, hasDecided, sync, connect, skip, syncNow } = useGmail();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const firstSyncPending = isConnected && !sync?.syncedAt;
  const firstSyncFailed = firstSyncPending && sync?.status === 'error';
  const syncing = connecting || (firstSyncPending && !firstSyncFailed);

  // Resume the first read after a reload mid-sync.
  useEffect(() => {
    if (firstSyncPending && sync?.status === 'idle') syncNow();
  }, [firstSyncPending, sync?.status, syncNow]);

  if (isLoading || !isReady) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <ApperIcon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!connecting && !firstSyncPending && (hasDecided || hasPreferredName)) {
    return <Navigate to={GENERIC_AUTH.redirectAfterAuth} replace />;
  }

  const handleSync = async () => {
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

  const name = preferredName || user?.firstName;
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
            ? 'Finding your subscriptions…'
            : name
              ? `${name}, let's find your subscriptions`
              : "Let's find your subscriptions"}
        </h1>
        <p className="mt-2 text-[15px] text-muted-foreground text-balance">
          {syncing
            ? 'This takes a few seconds. Keep this screen open.'
            : 'Sync Gmail and Recundle will read your receipts from services like these.'}
        </p>

        <div className="mt-6 w-full" aria-live="polite">
          {syncing ? (
            <div className="flex h-12 items-center justify-center gap-2 rounded-xl bg-secondary text-[15px] font-medium text-secondary-foreground">
              <ApperIcon name="Loader2" size={16} className="animate-spin" />
              {status}
            </div>
          ) : (
            <Button onClick={handleSync} className="w-full h-12 rounded-xl text-[16px] font-semibold">
              <ApperIcon name="RefreshCw" size={16} />
              {firstSyncFailed ? 'Try again' : 'Sync with Gmail'}
            </Button>
          )}
        </div>

        {(error || firstSyncFailed) && (
          <p className="mt-3 text-sm text-destructive">{error || sync?.error}</p>
        )}

        <p className="mt-4 text-xs text-muted-foreground text-balance">
          Read-only · Only receipts and invoices · Disconnect any time
        </p>

        {!syncing && !isConnected && (
          <button
            type="button"
            onClick={skip}
            className="mt-5 text-[15px] font-medium text-primary underline-offset-4 hover:underline"
          >
            Skip for now
          </button>
        )}
      </div>
    </main>
  );
}
