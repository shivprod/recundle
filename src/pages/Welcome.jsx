import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { GENERIC_AUTH } from '@/config/app.config';
import ApperIcon from '@/components/ApperIcon';
import GoogleG from '@/components/GoogleG';
import SiteHeader from '@/components/SiteHeader';
import RenewalOrbit from '@/components/RenewalOrbit';
import { Button } from '@/components/ui/button';
import {
  ClosingSection,
  DemoSection,
  FaqSection,
  HowItWorksSection,
  LandingFooter,
  PrivacySection,
  ServicesStrip,
} from '@/components/landing/LandingSections';
import { HeroBackdrop } from '@/components/landing/Motifs';
import { usePreferredName } from '@/personalization';
import { useGmail } from '@/gmail';

export const route = { path: '/', layout: 'public' };

function errorMessage(err) {
  if (err?.code === 'gmail_not_granted') {
    return 'Gmail access wasn\'t granted. On Google\'s screen, tick "Read your email" so Recundle can find your receipts.';
  }
  return err?.message || 'Could not sign in with Google. Please try again.';
}

const NAV = [
  ['#how', 'How it works'],
  ['#privacy', 'Privacy'],
  ['#faq', 'FAQ'],
];

/**
 * Landing page and sign-in. "Continue with Google" signs in with read-only
 * Gmail access; the first page of receipts is read here (the logos gather
 * into the mark), then the visitor goes to the dashboard. Signed-in visitors
 * see the page with "Open dashboard" and are only redirected right after a
 * fresh sign-in.
 */
export default function Welcome() {
  const { preferredName } = usePreferredName();
  const { isReady, isConnected, account, sync, connect, syncNow } = useGmail();
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState(null);
  const [redirectWhenSynced, setRedirectWhenSynced] = useState(false);

  const firstSyncPending = isConnected && !sync?.syncedAt;
  const firstSyncFailed = firstSyncPending && sync?.status === 'error';
  const paused = Date.parse(sync?.retryAt ?? '') > Date.now();
  const syncing = connecting || (firstSyncPending && !firstSyncFailed);
  const signedIn = isConnected && !firstSyncPending;

  // A first sync in progress means the visitor has just signed in (possibly
  // reloaded mid-sync): resume it and go to the dashboard when it finishes.
  useEffect(() => {
    if (!firstSyncPending) return;
    setRedirectWhenSynced(true);
    if (sync?.status === 'idle') syncNow();
  }, [firstSyncPending, sync?.status, syncNow]);

  if (!isReady) {
    return (
      <div className="flex min-h-svh items-center justify-center">
        <ApperIcon name="Loader2" size={32} className="animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (redirectWhenSynced && signedIn && !connecting) {
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
      setRedirectWhenSynced(true);
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

  const primaryCta = (size = 'lg') => {
    const cls = size === 'lg' ? 'h-12 w-full rounded-xl px-6 text-[16px] font-semibold sm:w-auto' : 'h-9 rounded-lg px-3.5 text-[15px] font-semibold';
    if (signedIn) {
      return (
        <Button asChild className={cls}>
          <Link to="/dashboard">
            <ApperIcon name="LayoutDashboard" size={size === 'lg' ? 18 : 16} />
            Open dashboard
          </Link>
        </Button>
      );
    }
    return (
      <Button onClick={handleContinue} disabled={syncing} className={cls}>
        <GoogleG size={size === 'lg' ? 18 : 16} />
        {size === 'lg' ? 'Continue with Google' : <><span className="sm:hidden">Sign in</span><span className="hidden sm:inline">Continue with Google</span></>}
      </Button>
    );
  };

  return (
    <>
      <SiteHeader
        nav={NAV.map(([href, label]) => (
          <a key={href} href={href} className="rounded-lg px-3 py-1.5 text-[15px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground">
            {label}
          </a>
        ))}
        actions={primaryCta('sm')}
      />

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden">
          <HeroBackdrop />
          <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-20 pt-12 sm:px-6 sm:pt-16 lg:grid-cols-[1.05fr_1fr] lg:pb-28">
            <div className="min-w-0">
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-[15px] font-semibold tracking-wide text-primary"
              >
                Track. Bundle. Recundle.
              </motion.p>
              <motion.h1
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 }}
                className="mt-3 text-[44px] font-bold leading-[1.02] tracking-tight text-balance sm:text-[60px]"
              >
                {syncing
                  ? name ? `${name}, finding your subscriptions…` : 'Finding your subscriptions…'
                  : signedIn && name
                    ? <>Welcome back, <span className="text-primary">{name}.</span></>
                    : <>Every subscription. <span className="text-primary">One place.</span></>}
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="mt-5 max-w-xl text-[18px] leading-relaxed text-muted-foreground text-pretty"
              >
                {syncing
                  ? 'This takes a few seconds. Keep this page open and your subscriptions will be ready.'
                  : 'Recundle reads the receipts already in your Gmail, finds every subscription you pay for, and shows what renews next, before the money leaves your account.'}
              </motion.p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center" aria-live="polite">
                <AnimatePresence mode="wait" initial={false}>
                  {syncing ? (
                    <motion.div
                      key="syncing"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -6 }}
                      className="flex h-12 items-center gap-2 rounded-xl bg-secondary px-5 text-[15px] font-medium text-secondary-foreground"
                    >
                      <ApperIcon name="Loader2" size={16} className="animate-spin" />
                      {status}
                    </motion.div>
                  ) : firstSyncFailed ? (
                    <motion.div key="retry" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                      <Button onClick={handleContinue} disabled={paused} className="h-12 rounded-xl px-6 text-[16px] font-semibold">
                        <ApperIcon name="RefreshCw" size={16} />
                        Try again
                      </Button>
                    </motion.div>
                  ) : (
                    <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-3 sm:flex-row">
                      {primaryCta('lg')}
                      <Button asChild variant="ghost" className="h-12 rounded-xl px-5 text-[16px] font-semibold">
                        <a href="#how">See how it works</a>
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {(error || firstSyncFailed) && (
                <p className="mt-3 max-w-xl text-sm text-destructive">{error || sync?.error}</p>
              )}
              <p className="mt-5 text-[13px] text-muted-foreground">
                Read-only Gmail access · Only receipts and invoices · Sign out any time
              </p>
            </div>

            <motion.div
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.15, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-0"
            >
              <RenewalOrbit syncing={syncing} className="[--orbit-max:500px]" />
            </motion.div>
          </div>
        </section>

        <DemoSection />
        <HowItWorksSection />
        <ServicesStrip />
        <PrivacySection />
        <FaqSection />
        <ClosingSection cta={<div className="flex justify-center [&>*]:w-full">{primaryCta('lg')}</div>} />
      </main>
      <LandingFooter />
    </>
  );
}
