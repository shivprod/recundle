import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button, Icon, Spinner } from '@/components/ui';
import { RecundleLogo } from '@/components/layout/Logo';
import { useApp } from '@/data/AppData';

const MODULES = [
  { icon: 'Wallet', title: 'Expenses', text: 'Money in, money out, and where it goes. Fix a category once and Recundle remembers it for that payee.' },
  { icon: 'Repeat', title: 'Subscriptions', text: 'Every recurring payment found in your receipts, with renewal dates, price changes and full history.' },
  { icon: 'Landmark', title: 'Loans', text: 'Outstanding balances, EMIs, NOCs found in your inbox, and the smartest order to close them.' },
  { icon: 'ListTodo', title: 'To-Dos', text: 'The personal responsibilities still pending, as cards you flip and tick off. No calendars.' },
];

const PROMISES = [
  ['Eye', 'Read-only Gmail', 'Recundle can read receipts and alerts. It can never send, delete or change an email.'],
  ['HardDrive', 'Your data stays yours', 'Your edits, loans and to-dos are saved in a private folder in your own Google Drive, not on our servers.'],
  ['ShieldCheck', 'Nothing invented', 'Every number comes from an email, a statement you import, or you. Estimates are always labelled.'],
];

export default function Landing() {
  const { session, signIn } = useApp();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  if (session.status === 'loading') {
    return (
      <div className="flex min-h-svh items-center justify-center text-ink-3">
        <Spinner size={26} />
      </div>
    );
  }
  if (session.user) return <Navigate to="/dashboard" replace />;

  const start = async () => {
    setError(null);
    setBusy(true);
    try {
      await signIn();
      navigate('/dashboard');
    } catch (err) {
      if (err.code !== 'popup_closed' && err.code !== 'popup_failed_to_open') setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-svh">
      <header className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <RecundleLogo />
        <Button variant="secondary" size="sm" onClick={start} disabled={busy}>Sign in</Button>
      </header>
      <main className="mx-auto max-w-6xl px-4 pb-16 sm:px-6">
        <section className="grid items-center gap-10 py-10 sm:py-16 lg:grid-cols-[1.1fr_1fr]">
          <div>
            <motion.p initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="text-[15px] font-semibold text-primary">Track. Bundle. Recundle.</motion.p>
            <motion.h1 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="mt-3 text-[40px] font-bold leading-[1.05] tracking-tight text-balance sm:text-[54px]">
              Your money and your to-dos, <span className="text-primary">in one calm place.</span>
            </motion.h1>
            <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-5 max-w-xl text-[17px] leading-relaxed text-ink-2">
              Recundle reads the payment alerts, receipts and loan emails already in your Gmail and answers four questions: where your money goes, what you pay for every month, what you still owe, and what's still pending.
            </motion.p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
              <Button size="lg" onClick={start} disabled={busy || session.configured === false}>
                {busy ? <Spinner /> : <Icon name="LogIn" />}
                Continue with Google
              </Button>
              <span className="text-[13px] text-ink-3">Read-only Gmail · Private Drive storage · Sign out any time</span>
            </div>
            {session.configured === false && (
              <p className="mt-4 max-w-xl rounded-xl bg-warn-soft px-4 py-3 text-[13.5px] text-warn">
                Sign-in isn't available yet: this deployment is missing its Google client secret (GOOGLE_WEB_CLIENT_SECRET). See the README for setup.
              </p>
            )}
            {error && <p className="mt-4 max-w-xl text-[14px] text-bad">{error}</p>}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODULES.map((m, i) => (
              <motion.div key={m.title} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.06 }} className="card p-5">
                <span className="flex size-10 items-center justify-center rounded-xl bg-primary-soft text-primary">
                  <Icon name={m.icon} size={20} />
                </span>
                <h2 className="mt-3 text-[17px] font-semibold">{m.title}</h2>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{m.text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        <section className="grid gap-4 border-t border-line pt-10 sm:grid-cols-3">
          {PROMISES.map(([icon, title, text]) => (
            <div key={title} className="flex gap-3">
              <Icon name={icon} size={20} className="mt-0.5 shrink-0 text-primary" />
              <div>
                <h3 className="text-[15px] font-semibold">{title}</h3>
                <p className="mt-1 text-[13.5px] leading-relaxed text-ink-2">{text}</p>
              </div>
            </div>
          ))}
        </section>

        <section className="mt-10 rounded-2xl bg-surface-2 p-5 text-[13.5px] leading-relaxed text-ink-2">
          <h3 className="text-[15px] font-semibold text-ink">What Google will ask you to allow</h3>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li><b>Read your email</b> (read-only): to find payment alerts, receipts, subscription and loan emails. Recundle searches only for those and never stores email bodies.</li>
            <li><b>See and store its own configuration data in your Google Drive</b>: a hidden app folder that only Recundle can use, holding your categories, rules, loans and to-dos.</li>
            <li><b>Your name, email and profile picture</b>: to show who is signed in.</li>
          </ul>
          <p className="mt-2">Google Pay, PhonePe and banks don't share their data with other apps, so Recundle uses the alerts and receipts they email you, plus any bank statement you import.</p>
        </section>
      </main>
    </div>
  );
}
