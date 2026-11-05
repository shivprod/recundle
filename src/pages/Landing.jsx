import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Icon, Spinner } from '@/components/ui';
import { RecundleLogo } from '@/components/layout/Logo';
import { CircuitGrid, DriftRow, Eyebrow, GemField, MonthCountdown, RibbonArt, Title } from '@/components/landing/Grw';
import { useApp } from '@/data/AppData';
import { cn } from '@/lib/cn';

const PILLARS = [
  ['Expenses', 'Money in, money out, and where it goes, by category, payee and month.'],
  ['Subscriptions', 'Every recurring payment, its renewal date, price changes and history.'],
  ['Loans', 'What you owe, EMIs from your statements, and the fastest way out of debt.'],
  ['To-Dos', 'Personal responsibilities as cards you flip and tick off. No calendars.'],
];

const MODULES = [
  { code: 'M/01', kind: 'Expenses', title: 'Where it goes', sub: 'Cash flow · categories · payees', text: 'Income against spending each month, money flowing into categories, and the payments that add up.' },
  { code: 'M/02', kind: 'Subscriptions', title: 'What renews', sub: 'Renewals · price changes', text: 'Found from regular payments in your PhonePe statements, with renewal dates and price changes.' },
  { code: 'M/03', kind: 'Loans', title: 'What you owe', sub: 'Balances · EMIs · payoff plan', text: 'Your lender figures, labelled estimates, EMIs matched from your statements, and your debt-free date.' },
  { code: 'M/04', kind: 'To-Dos', title: 'What’s pending', sub: 'Flip cards · done in a tap', text: 'Renew a passport, book a check-up, file the paperwork. A calm list of what’s still on you.' },
];

const PRIVACY = [
  ['Read-only Drive folder', 'Recundle reads only the PhonePe statements in one Google Drive folder. It can never change, move or delete a file.'],
  ['Stays on your device', 'What it finds and everything you change is saved in your browser. Recundle’s servers keep nothing.'],
  ['Nothing invented', 'Every figure comes from a statement or from you. Anything calculated is labelled as an estimate.'],
];

const FAQ = [
  ['Do I share my bank password?', 'Never. Recundle reads the PhonePe statements you save in your Google Drive, nothing else.'],
  ['Can it move money?', 'No. It is read-only: it organises your finances but can’t pay, transfer or change anything.'],
  ['Where do my transactions come from?', 'Download your monthly statement from the PhonePe app and save the PDF in a Google Drive folder named “Phone Pe - Monthly Statement”. Recundle reads every statement in it.'],
  ['What if it gets a category wrong?', 'Change it. Recundle asks whether to apply it to future payments from that payee, and remembers.'],
];

function Cta({ onClick, busy, disabled, children, className }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={cn('group inline-flex h-[52px] items-center justify-center gap-3 rounded-lg bg-ink px-6 text-[15px] font-medium text-bg transition hover:bg-brand disabled:opacity-60', className)}
    >
      {busy && <Spinner size={16} />}
      {children}
      <Icon name="ArrowRight" size={18} className="transition-transform group-hover:translate-x-1" />
    </button>
  );
}

function Faq() {
  const [open, setOpen] = useState(null);
  return (
    <ul className="border-t border-ink/15">
      {FAQ.map(([q, a], i) => (
        <li key={q} className="border-b border-ink/15">
          <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-6 py-6 text-left">
            <span className="flex items-baseline gap-5">
              <span className="label-mono">/ {String(i + 1).padStart(2, '0')}</span>
              <span className="font-display text-[20px] font-light tracking-[-0.02em] sm:text-[24px]">{q}</span>
            </span>
            <motion.span animate={{ rotate: open === i ? 45 : 0 }}>
              <Icon name="Plus" size={20} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.p initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="max-w-2xl overflow-hidden pb-6 pl-[3.6rem] text-[15px] leading-relaxed text-ink-2">
                {a}
              </motion.p>
            )}
          </AnimatePresence>
        </li>
      ))}
    </ul>
  );
}

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
  const off = session.configured === false;
  const wrap = 'mx-auto w-full max-w-[1224px] px-5 sm:px-8';

  return (
    <div className="min-h-svh overflow-x-clip bg-bg">
      <header className="fixed inset-x-0 top-0 z-40">
        <div className={cn(wrap, 'flex h-[72px] items-center justify-between')}>
          <a href="#top" aria-label="Recundle home">
            <RecundleLogo />
          </a>
          <p className="label-mono hidden items-center gap-2 md:flex">
            <span className="size-1.5 animate-pulse rounded-full bg-brand" /> Read-only · PhonePe statements · India
          </p>
          <button type="button" onClick={start} disabled={busy || off} className="text-[14px] font-medium text-ink transition hover:text-brand disabled:opacity-60">
            Sign in
          </button>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative flex min-h-svh flex-col overflow-hidden pt-[72px]">
          <CircuitGrid />
          <div className={cn(wrap, 'relative flex flex-1 flex-col justify-between gap-12 pb-12 pt-16 sm:pt-24')}>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }} className="glass max-w-[880px] rounded-xl p-6 sm:p-7">
              <p className="label-mono">N° 001 — Personal finance · Track. Bundle. Recundle.</p>
              <Title as="h1" dark="Your money, bundled" muted="into one calm view" tail="." className="mt-5 text-[46px] sm:text-[80px]" />
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="mt-5 max-w-[620px] text-[16px] leading-relaxed text-ink-2">
                Recundle reads the PhonePe statements in your Google Drive and shows where your money goes, what renews next, what you still owe, and what’s still pending.
              </motion.p>
              {off && <p className="mt-4 text-[13.5px] text-warn">Sign-in isn’t available yet: this deployment is missing its Google client secret.</p>}
              {error && <p className="mt-4 text-[14px] text-bad">{error}</p>}
            </motion.div>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4, duration: 0.8 }} className="flex flex-col gap-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="label-mono mb-4">This month closes in</p>
                <MonthCountdown />
              </div>
              <Cta onClick={start} busy={busy} disabled={off}>Continue with Google</Cta>
            </motion.div>
          </div>
        </section>

        {/* 01 / Vision */}
        <section className={cn(wrap, 'py-24 sm:py-36')}>
          <div className="grid gap-8 lg:grid-cols-[1fr_2.4fr]">
            <Eyebrow n="01">Vision</Eyebrow>
            <motion.p initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="font-display text-[26px] font-light leading-[1.3] tracking-[-0.02em] sm:text-[32px]">
              One place for the four things that weigh on you: what you spend, what renews, what you owe, and <span className="text-brand">what’s still pending</span>, read from the PhonePe statements in your Drive and corrected by you.
            </motion.p>
          </div>
          <div className="mt-20 grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            {PILLARS.map(([title, text], i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.7 }}>
                <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="h-px origin-left bg-ink" />
                <p className="label-mono mt-5">—</p>
                <p className="mt-4 font-display text-[56px] font-light leading-none tracking-[-0.05em] sm:text-[64px]">/ {String(i + 1).padStart(2, '0')}</p>
                <p className="mt-6 text-[18px] font-medium">{title}</p>
                <p className="mt-3 max-w-[260px] text-[14.5px] leading-relaxed text-ink-2">{text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 02 / Modules: cards drift sideways while you scroll */}
        <section id="modules" className="relative">
          <div className={cn(wrap, 'flex flex-col gap-4 pb-4 sm:flex-row sm:items-end sm:justify-between')}>
            <div>
              <Eyebrow n="02">Modules</Eyebrow>
              <Title dark="Four answers," muted="one set of data" className="mt-4 text-[34px] sm:text-[44px]" />
            </div>
            <p className="max-w-[340px] text-[15px] leading-relaxed text-ink-2">A payment counted in Expenses is the same one in its subscription or loan, never counted twice. Keep scrolling: they drift past, slowly.</p>
          </div>
          <DriftRow
            items={MODULES}
            renderCard={(m, i) => (
              <article key={m.code} className="w-[82vw] max-w-[640px] shrink-0">
                <div className="group relative aspect-video overflow-hidden rounded-xl">
                  <div className="h-full w-full transition-transform duration-700 group-hover:scale-[1.04]">
                    <RibbonArt variant={i} />
                  </div>
                  <span className="label-mono absolute left-4 top-4 rounded bg-surface/70 px-2 py-1 backdrop-blur">{m.sub}</span>
                </div>
                <div className="mt-4 h-px bg-ink" />
                <div className="mt-4 flex items-start justify-between gap-6">
                  <div>
                    <p className="label-mono">{m.code}</p>
                    <h3 className="mt-2 text-[22px] font-normal tracking-[-0.02em]">{m.title}</h3>
                    <p className="mt-2 max-w-[460px] text-[14px] leading-relaxed text-ink-2">{m.text}</p>
                  </div>
                  <div className="flex flex-col items-end gap-3">
                    <p className="label-mono">{m.kind}</p>
                    <Icon name="ArrowRight" size={20} />
                  </div>
                </div>
              </article>
            )}
          />
        </section>

        {/* Quote over floating gems */}
        <section className="relative h-[90svh] min-h-[560px] overflow-hidden">
          <GemField className="absolute inset-0" />
          <div className={cn(wrap, 'relative flex h-full items-center')}>
            <motion.blockquote initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.9 }} className="glass max-w-[920px] rounded-xl p-6 sm:p-8">
              <Title as="p" dark="We don’t guess your numbers." muted="We read your statements, and you correct the rest" tail="." className="text-[36px] sm:text-[64px]" />
              <footer className="label-mono mt-6">— How Recundle works</footer>
            </motion.blockquote>
          </div>
        </section>

        {/* 03 / Privacy */}
        <section id="privacy" className={cn(wrap, 'py-24 sm:py-36')}>
          <div className="grid gap-8 lg:grid-cols-[1fr_2.4fr]">
            <Eyebrow n="03">Privacy</Eyebrow>
            <Title dark="Your Drive stays yours." muted="Your numbers stay on your device" tail="." className="text-[34px] sm:text-[52px]" />
          </div>
          <div className="mt-20 grid gap-10 md:grid-cols-3 md:gap-8">
            {PRIVACY.map(([title, text], i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: i * 0.1, duration: 0.7 }}>
                <motion.div initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.15 + i * 0.1, duration: 0.9, ease: [0.22, 1, 0.36, 1] }} className="h-px origin-left bg-ink" />
                <p className="mt-6 font-display text-[44px] font-light leading-none tracking-[-0.05em]">/ {String(i + 1).padStart(2, '0')}</p>
                <p className="mt-5 text-[18px] font-medium">{title}</p>
                <p className="mt-3 max-w-[320px] text-[14.5px] leading-relaxed text-ink-2">{text}</p>
              </motion.div>
            ))}
          </div>
        </section>

        {/* 04 / Questions */}
        <section className={cn(wrap, 'pb-24 sm:pb-36')}>
          <div className="grid gap-8 lg:grid-cols-[1fr_2.4fr]">
            <Eyebrow n="04">Questions</Eyebrow>
            <Faq />
          </div>
        </section>

        {/* 05 / Access */}
        <section className="relative overflow-hidden py-24 sm:py-36">
          <CircuitGrid seed={29} dots={18} />
          <div className={cn(wrap, 'relative grid items-center gap-12 lg:grid-cols-[1.1fr_1fr]')}>
            <div>
              <Eyebrow n="05">Access</Eyebrow>
              <Title dark="Bundle your" muted="money" tail="." className="mt-4 text-[46px] sm:text-[72px]" />
              <p className="mt-5 max-w-[440px] text-[16px] leading-relaxed text-ink-2">Sign in with Google and Recundle reads the statements in your “Phone Pe - Monthly Statement” Drive folder. It takes a few seconds, and new statements are picked up each time you open it.</p>
            </div>
            <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="glass rounded-xl p-6 sm:p-7">
              <p className="label-mono">This month closes in</p>
              <MonthCountdown compact className="mt-4" />
              <div className="mt-7 border-t border-ink/12 pt-6">
                <p className="label-mono">Recundle reads</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {['PhonePe statements', 'Payments & credits', 'Recurring payments', 'EMIs'].map((t) => (
                    <span key={t} className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 bg-surface/70 px-3 py-2 text-[13.5px]">
                      <Icon name="Check" size={14} className="text-brand" /> {t}
                    </span>
                  ))}
                </div>
              </div>
              <Cta onClick={start} busy={busy} disabled={off} className="mt-7 w-full">Continue with Google</Cta>
              <p className="mt-4 text-[12.5px] text-ink-3">Read-only. Nothing is sent, deleted or stored on our servers. Sign out any time.</p>
            </motion.div>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/12">
        <div className={cn(wrap, 'flex flex-col gap-4 py-10 sm:flex-row sm:items-center sm:justify-between')}>
          <RecundleLogo />
          <p className="text-[13px] text-ink-3">© {new Date().getFullYear()} Recundle. Track. Bundle. Recundle.</p>
          <nav className="flex gap-6 text-[13.5px] text-ink-2" aria-label="Footer">
            <a href="#modules" className="hover:text-ink">Modules</a>
            <a href="#privacy" className="hover:text-ink">Privacy</a>
          </nav>
        </div>
      </footer>
    </div>
  );
}
