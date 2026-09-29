import { motion } from 'framer-motion';
import './landing.css';
import ApperIcon from '@/components/ApperIcon';
import ServiceIcon from '@/components/ServiceIcon';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import Reveal from './Reveal';
import { PermissionsCard, RadarBackdrop, ReminderStack } from './Motifs';

function SectionHeading({ kicker, title, children, id }) {
  return (
    <Reveal className="max-w-2xl">
      <p className="text-[15px] font-semibold text-primary">{kicker}</p>
      <h2 id={id} className="mt-2 text-[32px] font-bold leading-[1.1] tracking-tight text-balance sm:text-[40px]">
        {title}
      </h2>
      {children && <p className="mt-3 text-[17px] text-muted-foreground text-pretty">{children}</p>}
    </Reveal>
  );
}

/* ── Receipt → subscription demo ─────────────────────────────────────────── */

const DEMO_ROWS = [
  { name: 'Spotify', when: 'Renews in 3 days', amount: '₹139', soon: true },
  { name: 'Netflix', when: 'Renews 12 Oct', amount: '₹649' },
  { name: 'YouTube Premium', when: 'Renews 20 Oct', amount: '₹149' },
  { name: 'Claude', when: 'Renews 28 Oct', amount: '₹450' },
];

export function DemoSection() {
  return (
    <section id="demo" aria-labelledby="demo-h" className="border-t border-[var(--hairline)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading id="demo-h" kicker="From inbox to overview" title="A receipt goes in. A renewal date comes out.">
          Recundle picks out the merchant, amount, billing period and next renewal from each receipt, then groups them
          by what needs your attention.
        </SectionHeading>

        <div className="mt-12 grid items-center gap-6 lg:grid-cols-[1fr_auto_1fr]">
          <Reveal className="motif-scan rounded-3xl bg-card p-6 shadow-[var(--shadow-md)]">
            <div className="flex items-center gap-3">
              <ServiceIcon name="Spotify" />
              <div className="min-w-0">
                <p className="font-semibold">Spotify</p>
                <p className="text-[13px] text-muted-foreground">to you · Receipt</p>
              </div>
            </div>
            <p className="mt-4 font-semibold">Your Spotify Premium receipt</p>
            <dl className="mt-3 divide-y divide-dashed divide-[var(--hairline)] text-sm">
              {[
                ['Plan', 'Premium Individual'],
                ['Amount', '₹139.00'],
                ['Billed', 'Monthly'],
                ['Next payment', '2 Oct'],
              ].map(([k, v], i) => (
                <div key={k} className="motif-scan-row -mx-2 flex justify-between gap-4 px-2 py-2" style={{ animationDelay: `${0.9 + i * 0.45}s` }}>
                  <dt className="text-muted-foreground">{k}</dt>
                  <dd className="font-semibold tabular-nums">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={0.1} className="mx-auto">
            <motion.div
              className="flex size-14 items-center justify-center rounded-full bg-secondary text-primary"
              animate={{ x: [0, 6, 0] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            >
              <ApperIcon name="ArrowRight" size={24} className="rotate-90 lg:rotate-0" />
            </motion.div>
          </Reveal>

          <Reveal delay={0.2} className="rounded-3xl bg-card p-6 shadow-[var(--shadow-md)]">
            <div className="mb-4 flex items-baseline justify-between">
              <span className="text-sm text-muted-foreground">Every month</span>
              <span className="text-[30px] font-bold tracking-tight tabular-nums">₹1,387</span>
            </div>
            <ul className="divide-y divide-[var(--hairline)]">
              {DEMO_ROWS.map((row, i) => (
                <motion.li
                  key={row.name}
                  className="flex items-center gap-3 py-3"
                  initial={{ opacity: 0, x: 12 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + i * 0.08 }}
                >
                  <ServiceIcon name={row.name} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{row.name}</p>
                    <p className={row.soon ? 'text-[13px] font-semibold text-primary' : 'text-[13px] text-muted-foreground'}>
                      {row.when}
                    </p>
                  </div>
                  <p className="font-semibold tabular-nums">
                    {row.amount}
                    <span className="ml-0.5 text-[13px] font-normal text-muted-foreground">/mo</span>
                  </p>
                </motion.li>
              ))}
            </ul>
          </Reveal>
        </div>
        <p className="mt-4 text-[13px] text-muted-foreground">Example data, for illustration.</p>
      </div>
    </section>
  );
}

/* ── How it works ────────────────────────────────────────────────────────── */

const STEPS = [
  { icon: 'LogIn', title: 'Sign in with Google', body: 'Use the Google account your receipts arrive in. No new password to remember.' },
  { icon: 'MailSearch', title: 'Recundle reads your receipts', body: 'With read-only access, it finds payment emails and works out what repeats.' },
  { icon: 'CalendarClock', title: 'See every renewal', body: 'Your subscriptions sorted by what renews next, with your monthly and yearly total.' },
];

export function HowItWorksSection() {
  return (
    <section id="how" aria-labelledby="how-h" className="border-t border-[var(--hairline)] py-20 sm:py-24">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <SectionHeading id="how-h" kicker="How it works" title="Set up in under a minute" />
        <motion.div
          aria-hidden="true"
          className="relative mt-12 hidden grid-cols-3 md:grid"
          initial="hidden"
          whileInView="shown"
          viewport={{ once: true }}
        >
          <div className="absolute left-[16.67%] right-[16.67%] top-1/2 h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-muted">
            <motion.div
              className="h-full origin-left bg-primary/60"
              variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1 } }}
              transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1] }}
            />
          </div>
          <div className="pointer-events-none absolute left-[16.67%] right-[16.67%] top-1/2 -translate-y-1/2">
            <span className="motif-traveller absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary shadow-[0_0_0_5px_color-mix(in_oklab,var(--primary)_20%,transparent)]" />
          </div>
          {STEPS.map((step, i) => (
            <div key={step.title} className="flex justify-center">
              <motion.span
                variants={{ hidden: { scale: 0.6, opacity: 0 }, shown: { scale: 1, opacity: 1 } }}
                transition={{ delay: 0.2 + i * 0.4, type: 'spring', stiffness: 300, damping: 18 }}
                className="relative z-10 flex size-11 items-center justify-center rounded-full bg-card text-[16px] font-bold text-primary shadow-[var(--shadow-sm)] ring-4 ring-background"
              >
                {i + 1}
              </motion.span>
            </div>
          ))}
        </motion.div>
        <ol className="mt-6 grid gap-4 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <Reveal as="li" key={step.title} delay={i * 0.08} className="group relative rounded-3xl bg-card p-6 transition-shadow hover:shadow-[var(--shadow-lg)]">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-[15px] font-bold text-primary md:hidden">
                  {i + 1}
                </span>
                <ApperIcon name={step.icon} size={22} className="text-primary transition-transform group-hover:scale-110" />
              </div>
              <h3 className="mt-5 text-[20px] font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-muted-foreground">{step.body}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

/* ── Supported services ──────────────────────────────────────────────────── */

const SERVICES = [
  'Netflix', 'Prime Video', 'YouTube Premium', 'Spotify', 'Claude', 'Notion', 'Duolingo', 'Audible',
  'Perplexity', 'Cursor', 'Swiggy One', 'Zomato Gold', 'Apple Music', 'Airtel', 'Uber One', 'Google Play',
];

export function ServicesStrip() {
  const loop = [...SERVICES, ...SERVICES];
  return (
    <section aria-labelledby="services-h" className="border-t border-[var(--hairline)] py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <h2 id="services-h" className="text-center text-[15px] font-semibold text-muted-foreground">
          Reads receipts from the services you already pay for
        </h2>
      </div>
      <div className="landing-marquee mt-8 overflow-hidden" aria-hidden="true">
        <div className="landing-marquee__track flex w-max gap-3">
          {loop.map((name, i) => (
            <div
              key={`${name}-${i}`}
              className={`flex items-center gap-2.5 rounded-2xl bg-card py-2 pl-2 pr-4 shadow-[var(--shadow-xs)]${i >= SERVICES.length ? ' landing-marquee__dup' : ''}`}
            >
              <ServiceIcon name={name} className="size-9 rounded-[10px]" />
              <span className="whitespace-nowrap text-[15px] font-medium">{name}</span>
            </div>
          ))}
        </div>
      </div>
      <p className="sr-only">Netflix, Prime Video, YouTube Premium, Spotify, Claude, Notion and other services.</p>
      <p className="mx-auto mt-6 max-w-7xl px-4 text-center text-[13px] text-muted-foreground sm:px-6">
        Plus any other service whose receipts show a regular billing period.
      </p>
    </section>
  );
}

/* ── Privacy ─────────────────────────────────────────────────────────────── */

const PROMISES = [
  { icon: 'Eye', title: 'Read-only access', body: "Recundle can't send, delete or change any email." },
  { icon: 'ReceiptText', title: 'Only receipts and invoices', body: 'It searches for payment emails and ignores everything else.' },
  { icon: 'Smartphone', title: 'Kept on your device', body: 'Your subscriptions are stored in your browser. Recundle has no database of your email.' },
  { icon: 'Unplug', title: 'Sign out any time', body: "Signing out removes Recundle's access to your Gmail and clears this device." },
];

export function PrivacySection() {
  return (
    <section id="privacy" aria-labelledby="privacy-h" className="border-t border-[var(--hairline)] py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionHeading id="privacy-h" kicker="Your inbox stays yours" title="Read-only, receipts only">
            Recundle needs your email to find receipts. It uses that access for nothing else.
          </SectionHeading>
          <PermissionsCard />
        </div>
        <ul className="grid gap-4 sm:grid-cols-2">
          {PROMISES.map((p, i) => (
            <Reveal as="li" key={p.title} delay={i * 0.06} className="rounded-3xl bg-card p-5">
              <span className="flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
                <ApperIcon name={p.icon} size={20} />
              </span>
              <h3 className="mt-4 font-semibold">{p.title}</h3>
              <p className="mt-1 text-[15px] text-muted-foreground">{p.body}</p>
            </Reveal>
          ))}
        </ul>
      </div>
    </section>
  );
}

/* ── FAQ ─────────────────────────────────────────────────────────────────── */

const FAQ = [
  {
    q: 'What does Recundle read?',
    a: 'Only receipts and invoices. It searches your Gmail for payment emails from subscription services and common receipt subjects, and reads the merchant, amount, billing period, renewal date and payment method from them.',
  },
  {
    q: 'Where is my data kept?',
    a: "In your browser, on this device. Recundle's server reads receipts when you sync and doesn't store them. Your Google sign-in is kept as an encrypted token that only Recundle's server can use.",
  },
  {
    q: 'Can Recundle cancel a subscription for me?',
    a: 'No. Recundle shows what you pay and when it renews, so you can decide. To cancel, use the service itself.',
  },
  {
    q: 'Why does the first sync take a little while?',
    a: 'Gmail limits how quickly an app can read email. Recundle reads your most recent receipts first, then loads older ones in the background.',
  },
  {
    q: 'How do I stop Recundle reading my Gmail?',
    a: "Choose Sign out. That revokes Recundle's Google access and removes your subscriptions from this device. You can also remove Recundle in your Google Account under Security › Third-party access.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" aria-labelledby="faq-h" className="border-t border-[var(--hairline)] py-20 sm:py-24">
      <div className="mx-auto grid max-w-7xl gap-12 px-4 sm:px-6 lg:grid-cols-[1fr_1.2fr]">
        <div>
          <SectionHeading id="faq-h" kicker="Questions" title="Frequently asked">
            Everything about what Recundle reads, where your data lives, and how reminders work.
          </SectionHeading>
          <ReminderStack className="hidden lg:block" />
        </div>
        <Reveal>
          <Accordion type="single" collapsible className="rounded-3xl bg-card px-5">
            {FAQ.map((item, i) => (
              <AccordionItem key={item.q} value={`q${i}`} className="border-[var(--hairline)]">
                <AccordionTrigger className="py-5 text-left text-[16px] font-semibold hover:no-underline">{item.q}</AccordionTrigger>
                <AccordionContent className="pb-5 text-[15px] leading-relaxed text-muted-foreground">{item.a}</AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </Reveal>
      </div>
    </section>
  );
}

/* ── Closing CTA + footer ────────────────────────────────────────────────── */

export function ClosingSection({ cta }) {
  return (
    <section aria-labelledby="closing-h" className="relative overflow-hidden border-t border-[var(--hairline)] py-32 sm:py-40">
      <RadarBackdrop />
      <Reveal className="relative mx-auto flex max-w-3xl flex-col items-center px-4 text-center">
        <h2 id="closing-h" className="text-[40px] font-bold leading-[1.05] tracking-tight sm:text-[56px]">
          Track. Bundle. <span className="text-primary">Recundle.</span>
        </h2>
        <p className="mt-4 max-w-md text-[17px] text-muted-foreground">
          See every subscription you pay for, and what renews next, in about a minute.
        </p>
        <div className="mt-8 w-full max-w-xs">{cta}</div>
      </Reveal>
    </section>
  );
}

export function LandingFooter() {
  return (
    <footer className="border-t border-[var(--hairline)]">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <span>© {new Date().getFullYear()} Recundle</span>
        <nav className="flex flex-wrap gap-x-5 gap-y-2">
          <a href="#how" className="hover:text-foreground">How it works</a>
          <a href="#privacy" className="hover:text-foreground">Privacy</a>
          <a href="#faq" className="hover:text-foreground">FAQ</a>
        </nav>
        <span>Brand names and logos belong to their owners.</span>
      </div>
    </footer>
  );
}
