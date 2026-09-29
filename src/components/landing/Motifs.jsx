import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import ApperIcon from '@/components/ApperIcon';
import ServiceIcon from '@/components/ServiceIcon';
import { cn } from '@/lib/utils';

/** Hero backdrop: slow-drifting teal light over a faint dot grid. */
export function HeroBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 overflow-hidden">
      <div className="motif-dots absolute inset-0" />
      <div className="motif-blob motif-blob--a" />
      <div className="motif-blob motif-blob--b" />
    </div>
  );
}

const PERMISSIONS = [
  { label: 'Read receipts and invoices', allowed: true },
  { label: 'Send email', allowed: false },
  { label: 'Delete email', allowed: false },
  { label: 'Change settings', allowed: false },
];

/** What Recundle can and can't do in Gmail, ticked off one by one. */
export function PermissionsCard({ className }) {
  return (
    <motion.div
      className={cn('relative mt-10 max-w-sm overflow-hidden rounded-3xl bg-card p-5 shadow-[var(--shadow-md)]', className)}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, margin: '0px 0px -15% 0px' }}
    >
      <div className="flex items-center gap-3">
        <span className="relative flex size-10 items-center justify-center rounded-xl bg-secondary text-primary">
          <ApperIcon name="ShieldCheck" size={20} />
          <span className="motif-pulse absolute inset-0 rounded-xl" />
        </span>
        <div>
          <p className="text-[15px] font-semibold">Gmail access</p>
          <p className="text-[13px] text-muted-foreground">What Recundle can do</p>
        </div>
      </div>
      <ul className="mt-4 flex flex-col gap-2">
        {PERMISSIONS.map((p, i) => (
          <motion.li
            key={p.label}
            variants={{ hidden: { opacity: 0, x: -10 }, shown: { opacity: 1, x: 0 } }}
            transition={{ delay: 0.25 + i * 0.35, duration: 0.35 }}
            className="flex items-center justify-between gap-3 rounded-xl bg-muted/60 px-3 py-2.5"
          >
            <span className={cn('text-[14px]', p.allowed ? 'font-medium' : 'text-muted-foreground line-through decoration-1')}>
              {p.label}
            </span>
            <motion.span
              variants={{ hidden: { scale: 0 }, shown: { scale: 1 } }}
              transition={{ delay: 0.45 + i * 0.35, type: 'spring', stiffness: 400, damping: 18 }}
              className={cn(
                'flex size-6 shrink-0 items-center justify-center rounded-full',
                p.allowed ? 'bg-primary text-primary-foreground' : 'bg-destructive/15 text-destructive',
              )}
            >
              <ApperIcon name={p.allowed ? 'Check' : 'X'} size={14} strokeWidth={3} />
            </motion.span>
          </motion.li>
        ))}
      </ul>
    </motion.div>
  );
}

const REMINDERS = [
  { name: 'Spotify', text: 'Renews tomorrow', amount: '₹139' },
  { name: 'Cursor', text: 'Free trial ends in 2 days', amount: '₹1,700' },
  { name: 'Netflix', text: 'Renews on Friday', amount: '₹649' },
  { name: 'Prime Video', text: 'Yearly plan renews next week', amount: '₹1,499' },
  { name: 'Claude', text: 'Renews in 3 days', amount: '₹450' },
];

/** Renewal reminders sliding in one after another, like notifications. */
export function ReminderStack({ className }) {
  const reduce = useReducedMotion();
  const [start, setStart] = useState(0);
  useEffect(() => {
    if (reduce) return undefined;
    const id = setInterval(() => setStart((s) => (s + 1) % REMINDERS.length), 2600);
    return () => clearInterval(id);
  }, [reduce]);
  const visible = [0, 1, 2].map((k) => REMINDERS[(start + k) % REMINDERS.length]);

  return (
    <div className={cn('relative mt-10 max-w-sm', className)} aria-hidden="true">
      <p className="mb-3 text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground">Coming up</p>
      <ul className="flex flex-col gap-2.5">
        <AnimatePresence initial={false} mode="popLayout">
          {visible.map((r, i) => (
            <motion.li
              key={r.name}
              layout
              initial={{ opacity: 0, y: -16, scale: 0.96 }}
              animate={{ opacity: 1 - i * 0.22, y: 0, scale: 1 - i * 0.03 }}
              exit={{ opacity: 0, x: 40, transition: { duration: 0.25 } }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
              className="flex items-center gap-3 rounded-2xl bg-card p-3 shadow-[var(--shadow-sm)]"
            >
              <ServiceIcon name={r.name} className="size-9 rounded-[10px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-semibold">{r.name}</p>
                <p className="truncate text-[13px] text-muted-foreground">{r.text}</p>
              </div>
              <span className="text-[14px] font-semibold tabular-nums">{r.amount}</span>
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </div>
  );
}

const CLOSING_ICONS = ['Netflix', 'Spotify', 'YouTube Premium', 'Claude', 'Prime Video', 'Notion'];

/** Closing backdrop: rings pulsing outward with a few services in slow orbit. */
export function RadarBackdrop() {
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
      <div className="motif-radar">
        {[0, 1, 2].map((i) => (
          <span key={i} className="motif-radar__ring" style={{ animationDelay: `${i * 1.6}s` }} />
        ))}
        <div className="motif-radar__orbit">
          {CLOSING_ICONS.map((name, i) => (
            <span key={name} className="motif-radar__sat" style={{ '--a': `${(i / CLOSING_ICONS.length) * 360}deg` }}>
              <span className="motif-radar__counter">
                <ServiceIcon name={name} className="size-9 rounded-[10px] opacity-80" />
              </span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
