import { motion } from 'framer-motion';
import ServiceIcon from '@/components/ServiceIcon';
import { formatRupees } from '@/gmail';
import { cn } from '@/lib/utils';
import { formatLocalDate } from '@/utils/date';

const WINDOW_DAYS = 30;

function whenLabel(d) {
  if (d === 0) return 'Today';
  if (d === 1) return 'Tomorrow';
  return `In ${d} days`;
}

/** Renewals and trial ends in the next 30 days, as a vertical timeline. */
export default function UpcomingRenewals({ subscriptions, onOpen }) {
  const upcoming = subscriptions
    .filter((s) => s.status !== 'failed' && s.daysUntilRenewal != null && s.daysUntilRenewal >= 0 && s.daysUntilRenewal <= WINDOW_DAYS)
    .sort((a, b) => a.daysUntilRenewal - b.daysUntilRenewal);
  const total = upcoming.filter((s) => s.status !== 'trial').reduce((n, s) => n + (s.amount ?? 0), 0);

  return (
    <section aria-labelledby="upcoming-h" className="rounded-2xl bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="upcoming-h" className="text-[18px] font-semibold tracking-tight">Next 30 days</h2>
        {total > 0 && <p className="text-[13px] text-muted-foreground tabular-nums">{formatRupees(total, { whole: true })} due</p>}
      </div>

      {upcoming.length === 0 ? (
        <p className="mt-6 text-[15px] text-muted-foreground">Nothing renews in the next 30 days.</p>
      ) : (
        <ol className="relative mt-4">
          <span aria-hidden="true" className="absolute bottom-3 left-[27px] top-3 w-px bg-[var(--hairline)]" />
          {upcoming.map((s, i) => {
            const soon = s.daysUntilRenewal <= 3;
            return (
              <motion.li
                key={s.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.05 + i * 0.04 }}
              >
                <button
                  type="button"
                  onClick={() => onOpen(s)}
                  className="group relative flex w-full items-center gap-3 rounded-xl py-2 pl-1 pr-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <span
                    className={cn(
                      'relative z-10 flex w-[54px] shrink-0 flex-col items-center rounded-xl py-1 ring-4 ring-card',
                      soon ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                    )}
                  >
                    <span className="text-[17px] font-bold leading-none tabular-nums">{formatLocalDate(s.nextRenewal, 'd')}</span>
                    <span className="mt-0.5 text-[11px] font-medium uppercase tracking-wide opacity-80">{formatLocalDate(s.nextRenewal, 'MMM')}</span>
                  </span>
                  <ServiceIcon name={s.name} className="size-8 rounded-[9px]" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[15px] font-medium">{s.name}</span>
                    <span className={cn('block text-[12px] text-muted-foreground', soon && 'font-medium text-primary')}>
                      {s.status === 'trial' ? `Trial ends · ${whenLabel(s.daysUntilRenewal).toLowerCase()}` : whenLabel(s.daysUntilRenewal)}
                      {s.estimated && ' · likely'}
                    </span>
                  </span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                    {s.status === 'trial' ? 'Trial' : formatRupees(s.amount, { whole: true })}
                  </span>
                </button>
              </motion.li>
            );
          })}
        </ol>
      )}
    </section>
  );
}
