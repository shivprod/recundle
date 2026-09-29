import { useEffect, useMemo, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { toast } from 'sonner';
import ApperIcon from '@/components/ApperIcon';
import ServiceIcon from '@/components/ServiceIcon';
import { Button } from '@/components/ui/button';
import AccountCard, { isPaused } from '@/components/dashboard/AccountCard';
import KpiRow from '@/components/dashboard/KpiRow';
import SpendBreakdown from '@/components/dashboard/SpendBreakdown';
import SubscriptionDetail from '@/components/dashboard/SubscriptionDetail';
import SubscriptionList from '@/components/dashboard/SubscriptionList';
import UpcomingRenewals from '@/components/dashboard/UpcomingRenewals';
import { isThisWeek, plural } from '@/components/dashboard/format';
import { cn } from '@/lib/utils';
import {
  addressUser,
  clearPreferredName,
  getPersonalizedGreeting,
  getTimeOfDayGreeting,
  normalizePreferredName,
  usePreferredName,
} from '@/personalization';
import { deriveSubscriptions, useGmail } from '@/gmail';
import { LOCAL_ACCOUNT } from '@/gmail/useGmail';

export const route = { path: '/dashboard', layout: 'owner' };

// Re-sync on open when the last sync is older than this.
const STALE_AFTER_MS = 10 * 60 * 1000;

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
    <section className="mt-6 flex flex-col items-center rounded-2xl bg-card px-6 py-8 text-center">
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

function EmptyState({ sync, preferredName }) {
  const firstSync = !sync.syncedAt;
  const scanning = sync.status === 'syncing' || (firstSync && sync.status === 'idle');
  const firstSyncFailed = firstSync && sync.status === 'error';
  return (
    <section className="flex flex-col items-center rounded-2xl bg-card px-6 py-14 text-center">
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
  );
}

export default function Dashboard() {
  const { preferredName, hasPreferredName, setPreferredName } = usePreferredName();
  const gmail = useGmail();
  const { isConnected, sync, syncNow } = gmail;
  const [filter, setFilter] = useState('all');
  const [sort, setSort] = useState('renewal');
  const [query, setQuery] = useState('');
  const [openId, setOpenId] = useState(null);
  const listRef = useRef(null);

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

  const derived = useMemo(() => deriveSubscriptions(sync?.events ?? []), [sync?.events]);

  if (!gmail.isReady) {
    return (
      <div className="flex min-h-[60svh] items-center justify-center">
        <ApperIcon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Signed out, or still on the first read of receipts: that happens on the home page.
  if (!isConnected || !sync?.syncedAt) return <Navigate to="/" replace />;

  const name = preferredName || profileName;
  const { subscriptions, monthlyTotal, yearlyTotal, paidCount, trialCount, attentionCount } = derived;
  const weekCount = subscriptions.filter(isThisWeek).length;
  const openSub = subscriptions.find((s) => s.id === openId) ?? null;
  const paused = isPaused(sync);

  const chooseFilter = (next) => {
    setFilter(next);
    // On narrow screens the list is below the fold; bring it into view.
    if (next !== 'all' && window.innerWidth < 1024) {
      listRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };
  const handleSignOut = async () => {
    await gmail.disconnect();
    clearPreferredName(LOCAL_ACCOUNT);
    toast.success('Signed out.');
  };
  const headline = weekCount > 0
    ? `${plural(weekCount, 'subscription renews', 'subscriptions renew')} this week.`
    : 'Your subscriptions. One place. Always on track.';

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6 sm:px-6 sm:pt-8">
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
      >
        <div className="min-w-0">
          <p className="text-[15px] font-medium text-muted-foreground">{getTimeOfDayGreeting()}</p>
          <h1 className="mt-1 text-[30px] font-bold leading-[1.1] tracking-tight text-balance sm:text-[36px]">
            {getPersonalizedGreeting(name)}
          </h1>
          <p className="mt-1.5 text-[15px] text-muted-foreground">{headline}</p>
        </div>
        {!gmail.needsReconnect && (
          <Button
            variant="secondary"
            onClick={() => syncNow()}
            disabled={sync.status === 'syncing' || paused}
            className="h-10 w-fit shrink-0 rounded-xl text-primary"
          >
            <ApperIcon name="RefreshCw" size={16} className={cn(sync.status === 'syncing' && 'animate-spin')} />
            {sync.status === 'syncing' ? 'Syncing…' : 'Sync now'}
          </Button>
        )}
      </motion.div>

      <AnimatePresence>
        {sync.status === 'error' && !gmail.needsReconnect && (
          <motion.p
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-5 overflow-hidden rounded-xl bg-destructive/10 px-4 py-3 text-sm text-destructive"
          >
            {sync.error}{' '}
            {!paused && (
              <button type="button" onClick={() => syncNow()} className="font-semibold underline underline-offset-4">
                Try again
              </button>
            )}
          </motion.p>
        )}
      </AnimatePresence>

      {gmail.needsReconnect ? (
        <ReconnectCard onConnect={gmail.connect} />
      ) : subscriptions.length === 0 ? (
        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <EmptyState sync={sync} preferredName={name} />
          <AccountCard account={gmail.account} sync={sync} onSync={() => syncNow()} onSignOut={handleSignOut} />
        </div>
      ) : (
        <>
          {attentionCount > 0 && (
            <motion.button
              type="button"
              onClick={() => chooseFilter('attention')}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-5 flex w-full items-center gap-3 rounded-xl bg-destructive/10 px-4 py-3 text-left text-[15px] text-destructive transition-colors hover:bg-destructive/15"
            >
              <ApperIcon name="CircleAlert" size={18} className="shrink-0" />
              <span className="min-w-0 flex-1">
                <span className="font-semibold">{plural(attentionCount, 'payment', 'payments')} failed recently.</span>{' '}
                Update your payment method to keep {attentionCount === 1 ? 'it' : 'them'} running.
              </span>
              <span className="shrink-0 font-semibold">Show</span>
            </motion.button>
          )}

          <div className="mt-6">
            <KpiRow
              totals={{ monthlyTotal, yearlyTotal, paidCount, trialCount, weekCount }}
              filter={filter}
              onFilter={chooseFilter}
            />
          </div>

          <div className="mt-6 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
            <div ref={listRef} className="min-w-0 scroll-mt-24">
              <SubscriptionList
                subscriptions={subscriptions}
                filter={filter}
                onFilter={setFilter}
                sort={sort}
                onSort={setSort}
                query={query}
                onQuery={setQuery}
                onOpen={(s) => setOpenId(s.id)}
              />
              <p className="mt-3 px-1 text-[13px] leading-snug text-muted-foreground">
                Found from your receipts. Dates marked "Likely" are estimated from your last payment.
              </p>
            </div>
            <div className="flex min-w-0 flex-col gap-6">
              <SpendBreakdown subscriptions={subscriptions} monthlyTotal={monthlyTotal} onOpen={(s) => setOpenId(s.id)} />
              <UpcomingRenewals subscriptions={subscriptions} onOpen={(s) => setOpenId(s.id)} />
              <AccountCard account={gmail.account} sync={sync} onSync={() => syncNow()} onSignOut={handleSignOut} />
            </div>
          </div>
        </>
      )}

      <SubscriptionDetail sub={openSub} onClose={() => setOpenId(null)} />
    </main>
  );
}
