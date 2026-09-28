import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import ApperIcon from '@/components/ApperIcon';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';
import { formatLocalDate, formatRelativeTime } from '@/utils/date';
import {
  addressUser,
  getPersonalizedGreeting,
  getTimeOfDayGreeting,
  usePreferredName,
} from '@/personalization';
import { deriveSubscriptions, formatRupees, PERIOD_LABEL, useGmail } from '@/gmail';

export const route = { path: '/dashboard', layout: 'owner', access: 'authenticated' };

// Re-sync on open when the last sync is older than this.
const STALE_AFTER_MS = 10 * 60 * 1000;

function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many}`;
}

function renewalText(sub) {
  const d = sub.daysUntilRenewal;
  const date = sub.nextRenewal ? formatLocalDate(sub.nextRenewal, 'd MMM') : null;
  if (sub.status === 'failed') {
    return `Failed on ${formatLocalDate(sub.failedOn, 'd MMM')}. Update your payment method`;
  }
  if (sub.status === 'trial') {
    if (d === 0) return 'Trial ends today';
    if (d === 1) return 'Trial ends tomorrow';
    return d <= 7 ? `Trial ends in ${d} days` : `Trial ends ${date}`;
  }
  if (!date) return null;
  const prefix = sub.estimated ? 'Likely renews' : 'Renews';
  if (d < 0) return `${prefix} ${date}`;
  if (d === 0) return `${prefix} today`;
  if (d === 1) return `${prefix} tomorrow`;
  return d <= 7 ? `${prefix} in ${d} days` : `${prefix} ${date}`;
}

const STATUS_PILL = {
  trial: { label: 'Free trial', className: 'bg-warning/10 border-warning/20 text-warning' },
  failed: { label: 'Payment failed', className: 'bg-destructive/10 border-destructive/20 text-destructive' },
};

function SubscriptionRow({ sub }) {
  const pill = STATUS_PILL[sub.status];
  const soon = sub.status === 'active' && sub.daysUntilRenewal != null && sub.daysUntilRenewal <= 3;
  const details = [sub.plan, sub.paidWith].filter(Boolean).join(' · ');

  return (
    <li className="flex items-start gap-3 px-4 py-3">
      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-sm font-semibold text-secondary-foreground">
        {sub.name.charAt(0).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="truncate text-sm font-medium">{sub.name}</p>
          {pill && (
            <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-medium', pill.className)}>
              {pill.label}
            </span>
          )}
        </div>
        <p className={cn('text-xs text-muted-foreground', soon && 'font-medium text-primary')}>
          {renewalText(sub)}
        </p>
        {details && <p className="truncate text-xs text-muted-foreground">{details}</p>}
      </div>
      <div className="shrink-0 text-right">
        <p className="text-sm font-semibold tabular-nums">{formatRupees(sub.amount)}</p>
        {sub.period && <p className="text-xs text-muted-foreground">per {PERIOD_LABEL[sub.period]}</p>}
      </div>
    </li>
  );
}

function ConnectGmailCard({ needsReconnect, onConnect }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      await onConnect();
      toast.success('Gmail connected. Finding your subscriptions…');
    } catch (err) {
      if (err?.code !== 'popup_closed') setError(err?.message || 'Could not connect Gmail. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <Card className="mt-8">
      <CardContent className="flex flex-col items-center py-10 text-center">
        <div className="size-12 bg-secondary rounded-xl flex items-center justify-center mb-4">
          <ApperIcon name="Mail" size={22} className="text-secondary-foreground" />
        </div>
        <h2 className="text-base font-semibold">
          {needsReconnect ? 'Reconnect Gmail to keep your list up to date' : 'Find your subscriptions automatically'}
        </h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">
          {needsReconnect
            ? 'Google access for Recundle ended. Reconnect to continue reading your receipts.'
            : 'Connect Gmail and Recundle will build your list from your receipts. Read-only, and you can disconnect any time.'}
        </p>
        {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
        <Button onClick={handleConnect} disabled={connecting} className="mt-5">
          <ApperIcon name="Mail" size={16} />
          {connecting ? 'Connecting…' : needsReconnect ? 'Reconnect Gmail' : 'Connect Gmail'}
        </Button>
      </CardContent>
    </Card>
  );
}

function SyncBar({ account, sync, onSync, onDisconnect }) {
  const syncing = sync.status === 'syncing';
  const status = syncing
    ? `Scanning receipts… ${plural(sync.scanned, 'email', 'emails')} checked`
    : sync.syncedAt
      ? `Synced ${formatRelativeTime(sync.syncedAt)}`
      : 'Not synced yet';

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
      <span className="flex min-w-0 items-center gap-1.5">
        <ApperIcon name={syncing ? 'Loader2' : 'Mail'} size={14} className={cn('shrink-0', syncing && 'animate-spin')} />
        <span className="truncate">{account?.email ?? 'Gmail'}</span>
      </span>
      <span aria-live="polite">{status}</span>
      <div className="ml-auto flex items-center gap-1">
        <Button variant="ghost" size="xs" onClick={onSync} disabled={syncing}>
          <ApperIcon name="RefreshCw" size={12} />
          Sync now
        </Button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="xs">Disconnect</Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect Gmail?</AlertDialogTitle>
              <AlertDialogDescription>
                Recundle will stop reading your receipts, and the subscriptions it found will be removed from this device.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onDisconnect}>Disconnect</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}

function Subscriptions({ preferredName, gmail }) {
  const { sync, account } = gmail;
  const derived = useMemo(() => deriveSubscriptions(sync.events), [sync.events]);
  const { subscriptions, monthlyTotal, renewingThisWeek, paidCount, trialCount } = derived;
  const firstSync = !sync.syncedAt;
  const scanning = sync.status === 'syncing' || (firstSync && sync.status === 'idle');
  const firstSyncFailed = firstSync && sync.status === 'error';

  const handleSync = () => gmail.syncNow();
  const handleDisconnect = async () => {
    await gmail.disconnect();
    toast.success('Gmail disconnected.');
  };

  return (
    <>
      <SyncBar account={account} sync={sync} onSync={handleSync} onDisconnect={handleDisconnect} />

      {sync.status === 'error' && (
        <p className="mt-3 text-sm text-destructive">
          {sync.error}{' '}
          <button type="button" onClick={handleSync} className="font-medium underline underline-offset-4">
            Try again
          </button>
        </p>
      )}

      {subscriptions.length > 0 ? (
        <>
          <Card className="mt-4">
            <CardContent className="flex flex-wrap items-end gap-x-8 gap-y-2">
              <div>
                <p className="text-xs text-muted-foreground">You're spending</p>
                <p className="text-3xl font-bold tracking-tight tabular-nums">
                  {formatRupees(monthlyTotal, { whole: true })}
                  <span className="text-base font-medium text-muted-foreground">/month</span>
                </p>
              </div>
              <p className="text-sm text-muted-foreground">
                across {plural(paidCount, 'subscription', 'subscriptions')}
                {trialCount > 0 && <> · {plural(trialCount, 'free trial', 'free trials')}</>}
                {renewingThisWeek.length > 0 && <> · {renewingThisWeek.length} renewing this week</>}
              </p>
            </CardContent>
          </Card>

          <h2 className="mt-8 text-sm font-semibold">
            {renewingThisWeek.length > 0
              ? addressUser(
                  preferredName,
                  `${plural(renewingThisWeek.length, 'subscription renews', 'subscriptions renew')} this week.`,
                )
              : "Here's what's coming up."}
          </h2>
          <Card className="mt-3 py-0">
            <ul className="divide-y divide-border">
              {subscriptions.map((sub) => (
                <SubscriptionRow key={sub.id} sub={sub} />
              ))}
            </ul>
          </Card>
          <p className="mt-3 text-xs text-muted-foreground">
            Found from your receipts. Dates marked "Likely" are estimated from your last payment.
          </p>
        </>
      ) : (
        <Card className="mt-4">
          <CardContent className="flex flex-col items-center py-12 text-center">
            <div className="size-12 bg-primary/10 rounded-xl flex items-center justify-center mb-4">
              <ApperIcon
                name={scanning ? 'Loader2' : firstSyncFailed ? 'MailWarning' : 'Inbox'}
                size={22}
                className={cn('text-primary', scanning && 'animate-spin')}
              />
            </div>
            {scanning ? (
              <>
                <h2 className="text-base font-semibold">Looking through your receipts…</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Your subscriptions will appear here in a moment.
                </p>
              </>
            ) : firstSyncFailed ? (
              <>
                <h2 className="text-base font-semibold">Couldn't read your receipts yet</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  Check the message above, then try again.
                </p>
              </>
            ) : (
              <>
                <h2 className="text-base font-semibold">No subscriptions found yet</h2>
                <p className="mt-1 max-w-sm text-sm text-muted-foreground">
                  {addressUser(
                    preferredName,
                    `we checked ${plural(sync.scanned, 'email', 'emails')} and didn't find a recurring payment. New receipts show up after each sync.`,
                  )}
                </p>
              </>
            )}
          </CardContent>
        </Card>
      )}
    </>
  );
}

export default function Dashboard() {
  const { preferredName, hasPreferredName, isLoading } = usePreferredName();
  const gmail = useGmail();
  const { isConnected, sync, syncNow } = gmail;

  useEffect(() => {
    if (!isConnected || !sync || sync.status === 'syncing') return;
    const stale = !sync.syncedAt || Date.now() - Date.parse(sync.syncedAt) > STALE_AFTER_MS;
    if (stale && sync.status !== 'error') syncNow();
    // Only on open / connection change, not on every sync update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  if (isLoading || !gmail.isReady) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <ApperIcon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!hasPreferredName) {
    return <Navigate to={gmail.hasDecided ? '/onboarding/name' : '/onboarding/gmail'} replace />;
  }

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pt-24 pb-12">
      <p className="text-sm text-muted-foreground">{getTimeOfDayGreeting()}</p>
      <h1 className="mt-1 text-2xl font-semibold tracking-tight">
        {getPersonalizedGreeting(preferredName)}
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Your subscriptions. One place. Always on track.
      </p>

      {isConnected && !gmail.needsReconnect ? (
        <Subscriptions preferredName={preferredName} gmail={gmail} />
      ) : (
        <ConnectGmailCard needsReconnect={gmail.needsReconnect} onConnect={gmail.connect} />
      )}
    </main>
  );
}
