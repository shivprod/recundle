import { useEffect, useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { toast } from 'sonner';
import ApperIcon from '@/components/ApperIcon';
import ServiceIcon from '@/components/ServiceIcon';
import { Button } from '@/components/ui/button';
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
  clearPreferredName,
  getPersonalizedGreeting,
  getTimeOfDayGreeting,
  normalizePreferredName,
  usePreferredName,
} from '@/personalization';
import { deriveSubscriptions, formatRupees, PERIOD_LABEL, useGmail } from '@/gmail';
import { LOCAL_ACCOUNT } from '@/gmail/useGmail';
import { formatResumeTime } from '@/gmail/gmailStore';

export const route = { path: '/dashboard', layout: 'owner' };

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

/** iOS-style inset grouped section: small caps header, rounded group, footnote. */
function Section({ title, footer, children, className }) {
  return (
    <section className={cn('mt-8', className)}>
      {title && (
        <h2 className="px-4 pb-2 text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
          {title}
        </h2>
      )}
      <div className="overflow-hidden rounded-2xl bg-card">{children}</div>
      {footer && <p className="px-4 pt-2 text-[13px] leading-snug text-muted-foreground">{footer}</p>}
    </section>
  );
}

/** A grouped-list row; the hairline sits under the text, inset past the icon. */
function Row({ icon, children, trailing, first }) {
  return (
    <li className="flex items-center gap-3 pl-4">
      {icon}
      <div
        className={cn(
          'flex min-w-0 flex-1 items-center gap-3 py-3 pr-4',
          !first && 'border-t border-[var(--hairline)]',
        )}
      >
        <div className="min-w-0 flex-1">{children}</div>
        {trailing}
      </div>
    </li>
  );
}

const STATUS_TAG = {
  trial: { label: 'Free trial', className: 'bg-warning/15 text-warning' },
  failed: { label: 'Payment failed', className: 'bg-destructive/15 text-destructive' },
};

function SubscriptionRows({ subs }) {
  return (
    <ul>
      {subs.map((sub, i) => {
        const tag = STATUS_TAG[sub.status];
        const soon = sub.status === 'active' && sub.daysUntilRenewal != null && sub.daysUntilRenewal <= 3;
        const details = [sub.plan, sub.paidWith].filter(Boolean).join(' · ');
        return (
          <Row
            key={sub.id}
            first={i === 0}
            icon={<ServiceIcon name={sub.name} />}
            trailing={
              <div className="shrink-0 text-right">
                <p className="text-[16px] font-semibold tabular-nums">{formatRupees(sub.amount)}</p>
                {sub.period && (
                  <p className="text-[13px] text-muted-foreground">per {PERIOD_LABEL[sub.period]}</p>
                )}
              </div>
            }
          >
            <div className="flex items-center gap-2">
              <p className="truncate text-[16px] font-medium">{sub.name}</p>
              {tag && (
                <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', tag.className)}>
                  {tag.label}
                </span>
              )}
            </div>
            <p
              className={cn(
                'text-[13px] leading-snug text-muted-foreground',
                soon && 'font-medium text-primary',
                sub.status === 'failed' && 'text-destructive',
              )}
            >
              {renewalText(sub)}
            </p>
            {details && <p className="truncate text-[13px] text-muted-foreground">{details}</p>}
          </Row>
        );
      })}
    </ul>
  );
}

function SummaryCard({ monthlyTotal, paidCount, trialCount, renewingCount, headline }) {
  const stats = [
    { label: 'Subscriptions', value: paidCount },
    { label: 'This week', value: renewingCount },
    { label: 'Free trials', value: trialCount },
  ];
  return (
    <section className="mt-6 rounded-2xl bg-card p-5">
      <p className="text-[13px] font-medium text-muted-foreground">You're spending</p>
      <p className="mt-0.5 text-[40px] font-bold leading-none tracking-tight tabular-nums">
        {formatRupees(monthlyTotal, { whole: true })}
        <span className="ml-1 text-[17px] font-medium tracking-normal text-muted-foreground">/month</span>
      </p>
      <dl className="mt-5 grid grid-cols-3 gap-2">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl bg-muted px-3 py-2.5">
            <dt className="text-[12px] text-muted-foreground">{s.label}</dt>
            <dd className="text-[20px] font-semibold tabular-nums">{s.value}</dd>
          </div>
        ))}
      </dl>
      {headline && <p className="mt-4 text-[15px] font-medium">{headline}</p>}
    </section>
  );
}

function ReconnectCard({ onConnect }) {
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);

  const handleConnect = async () => {
    setError(null);
    setConnecting(true);
    try {
      await onConnect();
      toast.success('Signed in again. Updating your subscriptions…');
    } catch (err) {
      if (err?.code !== 'popup_closed') setError(err?.message || 'Could not sign in with Google. Please try again.');
    } finally {
      setConnecting(false);
    }
  };

  return (
    <section className="mt-8 flex flex-col items-center rounded-2xl bg-card px-6 py-8 text-center">
      <div className="flex -space-x-2" aria-hidden="true">
        {['Netflix', 'Prime Video', 'YouTube', 'Spotify', 'Claude'].map((n) => (
          <ServiceIcon key={n} name={n} className="size-9 rounded-[10px] ring-2 ring-card" />
        ))}
      </div>
      <h2 className="mt-5 text-[20px] font-semibold tracking-tight">
        Sign in again to keep your list up to date
      </h2>
      <p className="mt-1.5 max-w-sm text-[15px] text-muted-foreground">
        Google access for Recundle ended. Continue with Google to keep reading your receipts.
      </p>
      {error && <p className="mt-3 text-sm text-destructive">{error}</p>}
      <Button onClick={handleConnect} disabled={connecting} className="mt-6 h-12 w-full max-w-xs rounded-xl text-[16px] font-semibold">
        <ApperIcon name="LogIn" size={18} />
        {connecting ? 'Signing in…' : 'Continue with Google'}
      </Button>
    </section>
  );
}

const isPaused = (sync) => Boolean(sync?.retryAt) && Date.parse(sync.retryAt) > Date.now();

function GmailSection({ account, sync, onSync, onDisconnect }) {
  const syncing = sync.status === 'syncing';
  const paused = !syncing && isPaused(sync);
  const status = syncing
    ? `Scanning receipts… ${plural(sync.scanned, 'email', 'emails')} checked`
    : paused
      ? `Gmail asked for a pause. Syncing again at ${formatResumeTime(sync.retryAt)}`
      : sync.syncedAt
      ? `Synced ${formatRelativeTime(sync.syncedAt)}`
      : 'Not synced yet';

  return (
    <Section title="Account" footer="Read-only Gmail access. Recundle only looks at receipts and invoices.">
      <ul>
        <Row
          first
          icon={
            <div className="flex size-10 shrink-0 items-center justify-center rounded-[11px] bg-secondary text-secondary-foreground">
              <ApperIcon name={syncing ? 'Loader2' : 'Mail'} size={20} className={cn(syncing && 'animate-spin')} />
            </div>
          }
        >
          <p className="truncate text-[16px] font-medium">{account?.email ?? 'Gmail'}</p>
          <p className="text-[13px] text-muted-foreground" aria-live="polite">{status}</p>
        </Row>
        <li className="border-t border-[var(--hairline)]">
          <button
            type="button"
            onClick={onSync}
            disabled={syncing || paused}
            className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-[16px] font-medium text-primary disabled:opacity-50"
          >
            <ApperIcon name="RefreshCw" size={17} />
            Sync now
          </button>
        </li>
        <li className="border-t border-[var(--hairline)]">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-4 py-3.5 text-left text-[16px] font-medium text-destructive"
              >
                <ApperIcon name="LogOut" size={17} />
                Sign out
              </button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Sign out of Recundle?</AlertDialogTitle>
                <AlertDialogDescription>
                  Recundle will stop reading your Gmail, and the subscriptions it found will be removed from this device.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={onDisconnect}>Sign out</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </li>
      </ul>
    </Section>
  );
}

function Subscriptions({ preferredName, gmail }) {
  const { sync, account } = gmail;
  const derived = useMemo(() => deriveSubscriptions(sync.events), [sync.events]);
  const { subscriptions, monthlyTotal, renewingThisWeek, paidCount, trialCount } = derived;
  const firstSync = !sync.syncedAt;
  const scanning = sync.status === 'syncing' || (firstSync && sync.status === 'idle');
  const firstSyncFailed = firstSync && sync.status === 'error';

  const attention = subscriptions.filter((s) => s.status === 'failed');
  const thisWeek = subscriptions.filter((s) => s.status !== 'failed' && renewingThisWeek.includes(s));
  const later = subscriptions.filter((s) => s.status !== 'failed' && !renewingThisWeek.includes(s));

  const handleSync = () => gmail.syncNow();
  const handleDisconnect = async () => {
    await gmail.disconnect();
    clearPreferredName(LOCAL_ACCOUNT);
    toast.success('Signed out.');
  };

  return (
    <>
      {sync.status === 'error' && (
        <p className="mt-4 rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {sync.error}{' '}
          {!isPaused(sync) && (
            <button type="button" onClick={handleSync} className="font-semibold underline underline-offset-4">
              Try again
            </button>
          )}
        </p>
      )}

      {subscriptions.length > 0 ? (
        <>
          <SummaryCard
            monthlyTotal={monthlyTotal}
            paidCount={paidCount}
            trialCount={trialCount}
            renewingCount={renewingThisWeek.length}
            headline={
              renewingThisWeek.length > 0
                ? addressUser(
                    preferredName,
                    `${plural(renewingThisWeek.length, 'subscription renews', 'subscriptions renew')} this week.`,
                  )
                : null
            }
          />

          {attention.length > 0 && (
            <Section title="Needs attention">
              <SubscriptionRows subs={attention} />
            </Section>
          )}
          {thisWeek.length > 0 && (
            <Section title="This week">
              <SubscriptionRows subs={thisWeek} />
            </Section>
          )}
          {later.length > 0 && (
            <Section
              title={thisWeek.length > 0 ? 'Coming up' : "Here's what's coming up"}
              footer={'Found from your receipts. Dates marked "Likely" are estimated from your last payment.'}
            >
              <SubscriptionRows subs={later} />
            </Section>
          )}
        </>
      ) : (
        <section className="mt-6 flex flex-col items-center rounded-2xl bg-card px-6 py-12 text-center">
          <div className="mb-4 flex size-12 items-center justify-center rounded-2xl bg-primary/10">
            <ApperIcon
              name={scanning ? 'Loader2' : firstSyncFailed ? 'MailWarning' : 'Inbox'}
              size={22}
              className={cn('text-primary', scanning && 'animate-spin')}
            />
          </div>
          {scanning ? (
            <>
              <h2 className="text-[17px] font-semibold">Looking through your receipts…</h2>
              <p className="mt-1 max-w-sm text-[15px] text-muted-foreground">Your subscriptions will appear here in a moment.</p>
            </>
          ) : firstSyncFailed ? (
            <>
              <h2 className="text-[17px] font-semibold">Couldn't read your receipts yet</h2>
              <p className="mt-1 max-w-sm text-[15px] text-muted-foreground">Check the message above, then try again.</p>
            </>
          ) : (
            <>
              <h2 className="text-[17px] font-semibold">No subscriptions found yet</h2>
              <p className="mt-1 max-w-sm text-[15px] text-muted-foreground">
                {addressUser(
                  preferredName,
                  `we checked ${plural(sync.scanned, 'email', 'emails')} and didn't find a recurring payment. New receipts show up after each sync.`,
                )}
              </p>
            </>
          )}
        </section>
      )}

      <GmailSection account={account} sync={sync} onSync={handleSync} onDisconnect={handleDisconnect} />
    </>
  );
}

export default function Dashboard() {
  const { preferredName, hasPreferredName, setPreferredName } = usePreferredName();
  const gmail = useGmail();
  const { isConnected, sync, syncNow } = gmail;

  // The Google profile's first name is the default preferred name.
  const profileName = normalizePreferredName(gmail.account?.name?.split(' ')[0] || '');
  const adoptProfileName = isConnected && !hasPreferredName && Boolean(profileName);

  useEffect(() => {
    if (adoptProfileName) setPreferredName(profileName).catch(() => undefined);
  }, [adoptProfileName, profileName, setPreferredName]);

  useEffect(() => {
    if (!isConnected || !sync || sync.status === 'syncing') return;
    const stale = !sync.syncedAt || Date.now() - Date.parse(sync.syncedAt) > STALE_AFTER_MS;
    if (stale && sync.status !== 'error') syncNow();
    // Only on open / connection change, not on every sync update.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isConnected]);

  if (!gmail.isReady) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <ApperIcon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Signed out, or still on the first read of receipts: that happens on the sign-in screen.
  if (!isConnected || !sync?.syncedAt) return <Navigate to="/" replace />;

  const name = preferredName || profileName;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pt-6 pb-16">
      <p className="px-1 text-[15px] font-medium text-muted-foreground">{getTimeOfDayGreeting()}</p>
      <h1 className="mt-1 px-1 text-[32px] font-bold leading-[1.1] tracking-tight text-balance">
        {getPersonalizedGreeting(name)}
      </h1>
      <p className="mt-2 px-1 text-[15px] text-muted-foreground">
        Your subscriptions. One place. Always on track.
      </p>

      {gmail.needsReconnect ? (
        <ReconnectCard onConnect={gmail.connect} />
      ) : (
        <Subscriptions preferredName={name} gmail={gmail} />
      )}
    </main>
  );
}
