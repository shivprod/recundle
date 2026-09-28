import { useEffect, useState } from 'react';
import { APP_CONFIG } from '@/config/app.config';
import { RecundleMark } from '@/components/RecundleLogo';
import './StartupSplash.css';

// Keep in sync with the exit animation in StartupSplash.css (1460ms delay + 240ms).
const SPLASH_DURATION_MS = 1700;

// Pages reached from an email or OAuth redirect finish a flow the user already
// started; replaying the brand intro there would only get in the way.
const SKIP_ON_ENTRY = /^\/(callback|reset-password|verify-email|accept-invite|prompt-password)(\/|$)/;

let startedAt = null;
let finished = typeof window !== 'undefined' && SKIP_ON_ENTRY.test(window.location.pathname);

function elapsedMs() {
  if (startedAt === null) startedAt = performance.now();
  return performance.now() - startedAt;
}

/**
 * Brand intro shown once per app load, layered over the first screen while it
 * renders underneath. Mounted by each layout; module state keeps it to a single
 * continuous run across a redirect from one layout to another.
 */
export default function StartupSplash() {
  const [elapsed] = useState(() => (finished ? SPLASH_DURATION_MS : elapsedMs()));
  const [visible, setVisible] = useState(() => elapsed < SPLASH_DURATION_MS);

  useEffect(() => {
    if (!visible) return undefined;
    const timer = setTimeout(() => {
      finished = true;
      setVisible(false);
    }, SPLASH_DURATION_MS - elapsed);
    return () => clearTimeout(timer);
  }, [visible, elapsed]);

  if (!visible) return null;

  return (
    <div
      className="recundle-splash fixed inset-0 z-[100] flex flex-col items-center justify-center bg-background px-4"
      style={{ '--splash-offset': `-${Math.round(elapsed)}ms` }}
      aria-hidden="true"
    >
      <div className="recundle-splash__content flex flex-col items-center">
        <RecundleMark size={72} className="recundle-splash__mark mb-5" />
        <p className="recundle-splash__wordmark font-heading text-4xl font-bold text-foreground">
          {APP_CONFIG.name}
        </p>
        <div className="recundle-splash__rule h-px w-10 bg-ring my-3" />
        <p className="recundle-splash__tagline text-sm tracking-[0.14em] text-muted-foreground">
          {APP_CONFIG.tagline}
        </p>
      </div>
    </div>
  );
}
