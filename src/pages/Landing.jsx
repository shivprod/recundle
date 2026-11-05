import { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { CountUp, Icon, Spinner } from '@/components/ui';
import { RecundleLogo } from '@/components/layout/Logo';
import { Eyebrow, Heading, Marquee, PixelMosaic, Section } from '@/components/landing/Frame';
import { HeroSlab, IsoStack, Shapes, SourcesDiagram } from '@/components/landing/Illustrations';
import { useApp } from '@/data/AppData';
import { cn } from '@/lib/cn';

const NAV = [
  ['#modules', 'Modules'],
  ['#how', 'How it works'],
  ['#access', 'Privacy'],
  ['#faq', 'FAQ'],
];

const MODULES = [
  { id: 'expenses', title: 'Expenses', text: 'Money in, money out, and where it goes, by category and payee.' },
  { id: 'subscriptions', title: 'Subscriptions', text: 'Every recurring payment, with renewals and price changes.' },
  { id: 'loans', title: 'Loans', text: 'What you owe, NOCs found, and the fastest way out of debt.' },
  { id: 'todos', title: 'To-Dos', text: 'Personal responsibilities as cards you flip and tick off.' },
];

const PRINCIPLES = [
  ['Eye', 'Read-only Gmail', 'Recundle reads payment alerts, receipts and loan emails. It can never send, delete or change an email.'],
  ['Smartphone', 'Stays on your device', 'Your transactions, edits, loans and to-dos are saved in your browser, not on Recundle’s servers.'],
  ['BadgeCheck', 'Nothing invented', 'Every figure comes from an email, a statement or you. Estimates are always labelled.'],
  ['Wand', 'Learns from you', 'Correct a payee once and choose “apply to all”. Similar names are never changed without asking.'],
  ['CopyCheck', 'Counted once', 'A payment seen in a bank alert and a receipt is matched and counted once.'],
  ['ShieldCheck', 'You stay in charge', 'Loans close only when you confirm the NOC. Statuses and categories are always editable.'],
];

const USE_CASES = [
  ['ChartPie', 'Where is my money going?', 'Category trends, payments that add up, unusual spikes and possible double charges, each linked to the transactions behind it.'],
  ['UserPen', '“Rahul Kumar” is my landlord', 'Fix a UPI transfer once and every future payment to that person is filed as rent.'],
  ['Repeat', 'What renews next week', 'Subscriptions found from receipts and renewal emails, with failed payments flagged before a service stops.'],
  ['FileCheck2', 'Is that loan really closed?', 'NOCs and closure letters in your inbox are matched to the right loan for you to confirm.'],
  ['Flag', 'Debt-free sooner', 'Compare paying the costliest loan first with the smallest first, and see the date you’re debt-free.'],
  ['ListTodo', 'Passport, check-up, paperwork', 'The personal tasks still waiting on you, as flip cards. No calendars, no due dates required.'],
];

const STATS = [
  ['4', 'modules in one app'],
  ['0', 'copies of your data on our servers'],
  ['100%', 'read-only Gmail access'],
  ['₹', 'built for Indian banks, UPI and INR'],
];

const ACCESS = [
  {
    title: 'Gmail',
    tag: 'Read-only',
    text: 'To find payment alerts, receipts, subscription and loan emails.',
    yes: ['Searches only for financial emails', 'Reads them in memory, keeps the parsed fields', 'Links back to each source email'],
    no: ['Never sends, deletes or changes email', 'Never stores email bodies'],
  },
  {
    title: 'This device',
    tag: 'Where data lives',
    featured: true,
    text: 'What Recundle finds, and everything you change, is saved in your browser.',
    yes: ['Categories, rules and corrections', 'Loans, subscriptions and to-dos', 'Download a backup any time'],
    no: ['Nothing kept on Recundle’s servers', 'Delete it all from Settings in one click'],
  },
  {
    title: 'Your profile',
    tag: 'Basic',
    text: 'Your name, email and photo, to show who is signed in.',
    yes: ['Greets you by name', 'One account per Google sign-in'],
    no: ['No Recundle password to remember', 'No bank logins, ever'],
  },
];

const FAQ = [
  ['Do I need to share my bank password?', 'No. Recundle never asks for bank, UPI or card credentials. It reads the alerts and receipts your bank and apps already email you, and statements you choose to import.'],
  ['Can Recundle move money or pay bills?', 'No. It is read-only: it can show and organise your finances, but it can’t make payments or change anything in your accounts or email.'],
  ['Where is my data stored?', 'On this device, in your browser’s storage. Recundle’s servers keep nothing: emails are read, the payment details are sent back to your browser, and the email is discarded. You can download a backup or delete everything from Settings.'],
  ['Does it work with Google Pay and PhonePe?', 'Those apps don’t let other apps read your history, so Recundle uses the UPI alerts your bank emails you. Import a bank statement (CSV) to fill any gaps.'],
  ['What if a payment is categorised wrongly?', 'Open it and change it. Recundle asks whether to apply the change to all future payments from that payee, and remembers your choice.'],
  ['How are loan balances worked out?', 'From your lender’s emails where they state it. Anything calculated is labelled “Estimated”, and missing figures are shown as missing, never guessed.'],
];

function GetStarted({ onClick, busy, size = 'md', children = 'Get Started', className, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={busy || disabled}
      className={cn('inline-flex items-center justify-center gap-2 rounded-[3px] bg-primary font-medium text-primary-ink transition hover:opacity-90 disabled:opacity-60', size === 'lg' ? 'h-11 px-6 text-[15px]' : 'h-10 px-5 text-[14px]', className)}
    >
      {busy ? <Spinner size={16} /> : null}
      {children}
    </button>
  );
}

const ghostLink = 'inline-flex h-11 items-center justify-center gap-2 rounded-[3px] border border-line bg-surface px-6 text-[15px] font-medium text-ink-2 transition hover:border-ink/30 hover:text-ink';

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <ul className="flex flex-col gap-3">
      {FAQ.map(([q, a], i) => (
        <li key={q} className="rounded-md border border-line bg-surface">
          <button type="button" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} className="flex w-full items-center justify-between gap-4 px-5 py-5 text-left">
            <span className="font-display text-[15px] font-medium uppercase tracking-[0.01em] sm:text-[16px]">{q}</span>
            <motion.span animate={{ rotate: open === i ? 45 : 0 }} className="shrink-0">
              <Icon name="Plus" size={22} />
            </motion.span>
          </button>
          <AnimatePresence initial={false}>
            {open === i && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-ink-2">{a}</p>
              </motion.div>
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
  const reduce = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || reduce) return undefined;
    const t = setInterval(() => setActive((a) => (a + 1) % MODULES.length), 3800);
    return () => clearInterval(t);
  }, [paused, reduce]);

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
  const unconfigured = session.configured === false;

  return (
    <div className="min-h-svh overflow-x-clip bg-bg">
      <header className="sticky top-0 z-40 border-b border-line bg-bg/90 backdrop-blur">
        <div className="mx-auto flex h-[72px] max-w-[1224px] items-center justify-between gap-4 px-5 sm:h-20 sm:px-8">
          <a href="#top" aria-label="Recundle home">
            <RecundleLogo />
          </a>
          <nav className="hidden items-center gap-7 md:flex" aria-label="Sections">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="text-[14.5px] text-ink-2 transition hover:text-ink">{label}</a>
            ))}
          </nav>
          <GetStarted onClick={start} busy={busy} disabled={unconfigured}>
            <span className="sm:hidden">Sign in</span>
            <span className="hidden sm:inline">Get Started</span>
          </GetStarted>
        </div>
      </header>

      <main id="top">
        {/* Hero */}
        <section className="relative">
          <div className="rails relative mx-auto max-w-[1224px] px-5 sm:px-8">
            <div className="mx-auto flex max-w-3xl flex-col items-center pt-16 text-center sm:pt-24">
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1 text-[13px] text-ink-2">
                <span className="size-1.5 rounded-full bg-accent ring-2 ring-brand/40" />
                Track. Bundle. Recundle.
              </motion.p>
              <Heading as="h1" scroll={false} dark="Your money and to-dos," muted="bundled in one place" center className="sm:text-[68px]" />
              <motion.p initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="mt-6 max-w-[620px] text-[16.5px] leading-relaxed text-ink-2 sm:text-[17px]">
                Recundle reads the payment alerts, receipts and loan emails already in your Gmail, and shows where your money goes, what renews next, what you still owe, and what’s still pending.
              </motion.p>
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }} className="mt-9 flex w-full flex-col gap-2.5 sm:w-auto sm:flex-row">
                <GetStarted onClick={start} busy={busy} size="lg" disabled={unconfigured}>Continue with Google</GetStarted>
                <a href="#how" className={ghostLink}>
                  <Icon name="Play" size={14} className="fill-current" /> See how it works
                </a>
              </motion.div>
              {unconfigured && <p className="mt-5 max-w-xl rounded-md border border-warn/30 bg-warn-soft px-4 py-3 text-[13.5px] text-warn">Sign-in isn’t available yet: this deployment is missing its Google client secret. See the README.</p>}
              {error && <p className="mt-5 max-w-xl text-[14px] text-bad">{error}</p>}
            </div>
            <div className="relative -mx-5 mt-14 sm:-mx-8 sm:mt-20">
              <PixelMosaic cols={46} rows={12} />
              <HeroSlab />
            </div>
          </div>
        </section>

        <Section className="py-8" crosses={false}>
          <p className="mb-4 text-center text-[13px] font-medium uppercase tracking-[0.12em] text-ink-3">Reads alerts and receipts from</p>
          <Marquee items={['HDFC Bank', 'ICICI Bank', 'SBI', 'Axis Bank', 'Kotak', 'IDFC FIRST', 'Google Pay alerts', 'PhonePe alerts', 'Netflix', 'Spotify', 'Amazon', 'Swiggy', 'Bajaj Finserv', 'Tata Capital']} />
        </Section>

        <Section id="modules" className="grid items-center gap-12 py-20 sm:py-28 lg:grid-cols-2">
          <div>
            <Heading dark="One app," muted="four answers" />
            <p className="mt-6 max-w-[540px] text-[16px] leading-relaxed text-ink-2">
              Expenses, subscriptions, loans and to-dos share one set of data, so a payment in Expenses is the same one in its subscription’s history or its loan’s EMIs, never counted twice.
            </p>
            <div className="mt-10 grid gap-2 sm:grid-cols-2" onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
              {MODULES.map((m, i) => (
                <button key={m.id} type="button" onClick={() => setActive(i)} aria-pressed={active === i} className={cn('rounded-md border p-4 text-left transition-colors', active === i ? 'border-line bg-surface' : 'border-transparent hover:bg-surface/60')}>
                  <p className={cn('font-display text-[18px] font-medium', active === i ? 'text-ink' : 'text-ink-3')}>{m.title}</p>
                  <p className={cn('mt-2 text-[14.5px] leading-relaxed', active === i ? 'text-ink-2' : 'text-ink-3')}>{m.text}</p>
                </button>
              ))}
            </div>
          </div>
          <IsoStack active={MODULES[active].id} />
        </Section>

        <Section className="py-20 sm:py-28">
          <Heading dark="Personal finance built for" muted="accuracy and privacy" className="max-w-[900px]" />
          <p className="mt-6 max-w-[620px] text-[16px] leading-relaxed text-ink-2">Recundle only shows what your emails, your statements and you have told it, and keeps your data with you.</p>
          <div className="mt-14 grid border-l border-t border-line sm:grid-cols-2 lg:grid-cols-3">
            {PRINCIPLES.map(([icon, title, text], i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 10 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.06 }} className="border-b border-r border-line p-6 sm:p-8">
                <span className="flex size-10 items-center justify-center rounded border border-ink/40">
                  <Icon name={icon} size={18} />
                </span>
                <h3 className="mt-5 text-[19px] font-medium">{title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{text}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        <Section id="how" className="py-20 sm:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>How it helps</Eyebrow>
            <Heading dark="Answers for your" muted="whole financial life" center className="mt-3" />
            <p className="mx-auto mt-6 max-w-[600px] text-[16px] leading-relaxed text-ink-2">Sign in with Google and Recundle reads the last 12 months of financial email. Everything below works from that, from statements you import, and from your corrections.</p>
          </div>
          <div className="mt-14 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {USE_CASES.map(([icon, title, text], i) => (
              <motion.div key={title} initial={{ opacity: 0, y: 14 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: (i % 3) * 0.07 }} className="group rounded-md border border-line bg-surface p-6">
                <div className="dot-grid flex h-32 items-center justify-center rounded border border-line">
                  <span className="flex size-14 items-center justify-center rounded-lg border border-ink/70 bg-surface shadow-[4px_4px_0_0_var(--ink)] transition-transform group-hover:-translate-y-1">
                    <Icon name={icon} size={24} />
                  </span>
                </div>
                <h3 className="mt-5 text-[19px] font-medium">{title}</h3>
                <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{text}</p>
              </motion.div>
            ))}
          </div>
        </Section>

        <Section className="pt-20 sm:pt-24">
          <Heading dark="Built around how" muted="you actually pay" center />
          <div className="-mx-5 mt-14 grid grid-cols-2 border-t border-line sm:-mx-8 lg:grid-cols-4">
            {STATS.map(([n, l], i) => (
              <div key={l} className={cn('flex flex-col items-center justify-center px-4 py-10 text-center', i !== 3 && 'border-r border-line', i === 1 && 'border-r-0 lg:border-r', i < 2 && 'border-b border-line lg:border-b-0')}>
                <p className="font-display text-[44px] font-medium leading-none tracking-tight sm:text-[56px]"><CountUp value={n} /></p>
                <p className="mt-3 text-[14.5px] text-ink-2">{l}</p>
              </div>
            ))}
          </div>
        </Section>

        <Section className="py-20 sm:py-28" bg="dot-grid">
          <div className="mx-auto max-w-3xl text-center">
            <Eyebrow>Sources</Eyebrow>
            <Heading dark="Works with what" muted="you already use" center className="mt-3" />
          </div>
          <div className="mt-14">
            <SourcesDiagram />
          </div>
          <p className="mx-auto mt-10 max-w-xl text-center text-[14px] text-ink-3">Google Pay, PhonePe and banks don’t let other apps read your transactions, so Recundle uses what they email you and the statements you import.</p>
        </Section>

        <Section id="access" className="pt-20 sm:pt-28">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <Heading dark="Simple, transparent" muted="access" className="max-w-[640px]" />
            <p className="max-w-[380px] text-[15.5px] leading-relaxed text-ink-2">What Google will ask you to allow, where your data lives, and what Recundle never does.</p>
          </div>
          <div className="-mx-5 mt-14 grid border-t border-line sm:-mx-8 lg:grid-cols-3">
            {ACCESS.map((a, i) => (
              <div key={a.title} className={cn('flex flex-col', i < 2 && 'border-b border-line lg:border-b-0 lg:border-r')}>
                <div className="border-b border-line px-5 py-7 sm:px-8">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-[21px] font-medium">{a.title}</h3>
                    <span className={cn('rounded-[3px] px-2 py-1 text-[11.5px] font-medium uppercase tracking-wide', a.featured ? 'bg-accent text-accent-ink' : 'bg-surface-2 text-ink-2')}>{a.tag}</span>
                  </div>
                  <p className="mt-2 text-[14.5px] leading-relaxed text-ink-2">{a.text}</p>
                  {a.featured && (
                    <GetStarted onClick={start} busy={busy} className="mt-6 w-full" disabled={unconfigured}>
                      Continue with Google <Icon name="ArrowRight" size={16} />
                    </GetStarted>
                  )}
                </div>
                <div className="px-5 py-7 sm:px-8">
                  <p className="font-display text-[16px] font-medium">What it does:</p>
                  <ul className="mt-3">
                    {[...a.yes.map((x) => ['CircleCheck', x]), ...a.no.map((x) => ['CircleSlash', x])].map(([icon, x]) => (
                      <li key={x} className="flex items-start gap-3 border-b border-dashed border-line py-3 text-[14.5px] text-ink-2">
                        <Icon name={icon} size={18} className="mt-px shrink-0 text-ink-3" />
                        {x}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section id="faq" className="grid gap-10 py-20 sm:py-28 lg:grid-cols-[1fr_1.15fr]">
          <div>
            <Heading dark="Questions," muted="answered" />
            <p className="mt-6 max-w-[420px] text-[15.5px] leading-relaxed text-ink-2">Quick answers about how Recundle reads your finances and keeps them private.</p>
          </div>
          <Faq />
        </Section>

        <Section className="grid items-center gap-12 py-20 sm:py-24 lg:grid-cols-2">
          <div>
            <Heading dark="Ready to bundle" muted="your finances?" />
            <div className="mt-9 flex flex-col gap-2.5 sm:flex-row">
              <GetStarted onClick={start} busy={busy} size="lg" disabled={unconfigured}>Continue with Google</GetStarted>
              <a href="#modules" className={ghostLink}>
                <Icon name="Play" size={14} className="fill-current" /> See the modules
              </a>
            </div>
          </div>
          <div className="flex justify-center lg:justify-end">
            <Shapes />
          </div>
        </Section>
      </main>

      <footer className="hairline">
        <div className="rails mx-auto flex max-w-[1224px] flex-col gap-6 px-5 py-10 sm:flex-row sm:items-center sm:justify-between sm:px-8">
          <div>
            <RecundleLogo />
            <p className="mt-2 text-[13.5px] text-ink-3">Track. Bundle. Recundle.</p>
          </div>
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[14px] text-ink-2" aria-label="Footer">
            {NAV.map(([href, label]) => (
              <a key={href} href={href} className="hover:text-ink">{label}</a>
            ))}
          </nav>
          <p className="text-[13px] text-ink-3">© {new Date().getFullYear()} Recundle</p>
        </div>
      </footer>
    </div>
  );
}
