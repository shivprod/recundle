import { motion } from 'framer-motion';
import ApperIcon from '@/components/ApperIcon';
import ServiceIcon from '@/components/ServiceIcon';
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { EVENT_LABEL, formatRupees, PERIOD_LABEL } from '@/gmail';
import { cn } from '@/lib/utils';
import { formatLocalDate } from '@/utils/date';
import { plural, renewalText } from './format';

const PERIOD_NAME = { monthly: 'Monthly', quarterly: 'Every 3 months', 'half-yearly': 'Every 6 months', yearly: 'Yearly' };

function Fact({ label, value, hint }) {
  return (
    <div className="min-w-0 rounded-xl bg-muted/60 px-3.5 py-3">
      <dt className="text-[12px] font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 truncate text-[16px] font-semibold tabular-nums">{value ?? '—'}</dd>
      {hint && <dd className="text-[12px] text-muted-foreground">{hint}</dd>}
    </div>
  );
}

const EVENT_ICON = { payment: 'CircleCheck', trial_started: 'Sparkles', payment_failed: 'CircleAlert' };

/** Side panel with everything Recundle knows about one subscription. */
export default function SubscriptionDetail({ sub, onClose }) {
  return (
    <Sheet open={Boolean(sub)} onOpenChange={(open) => !open && onClose()}>
      <SheetContent side="right" className="w-full gap-0 overflow-y-auto p-0 sm:max-w-md">
        {sub && (
          <>
            <SheetHeader className="border-b border-[var(--hairline)] p-6">
              <div className="flex items-center gap-4">
                <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  <ServiceIcon name={sub.name} className="size-14 rounded-2xl" />
                </motion.div>
                <div className="min-w-0">
                  <SheetTitle className="truncate text-[22px] font-bold tracking-tight">{sub.name}</SheetTitle>
                  <SheetDescription className="truncate text-[14px]">
                    {[sub.plan, PERIOD_NAME[sub.period]].filter(Boolean).join(' · ') || 'Subscription'}
                  </SheetDescription>
                </div>
              </div>
              <p
                className={cn(
                  'mt-4 inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-semibold',
                  sub.status === 'failed' ? 'bg-destructive/15 text-destructive' : sub.status === 'trial' ? 'bg-warning/15 text-warning' : 'bg-secondary text-primary',
                )}
              >
                <ApperIcon name={sub.status === 'failed' ? 'CircleAlert' : sub.status === 'trial' ? 'Sparkles' : 'CalendarClock'} size={14} />
                {renewalText(sub) ?? 'No renewal date found'}
              </p>
              {sub.status === 'failed' && (
                <p className="mt-2 text-[14px] text-destructive">
                  Update your payment method with {sub.name} to keep this subscription running.
                </p>
              )}
            </SheetHeader>

            <div className="flex flex-col gap-6 p-6">
              <dl className="grid grid-cols-2 gap-2.5">
                <Fact
                  label="Price"
                  value={formatRupees(sub.amount)}
                  hint={sub.period ? `per ${PERIOD_LABEL[sub.period]}` : null}
                />
                <Fact label="Per month" value={sub.monthly != null ? formatRupees(sub.monthly, { whole: true }) : '—'} />
                <Fact label="Per year" value={sub.yearly != null ? formatRupees(sub.yearly, { whole: true }) : '—'} />
                <Fact
                  label="Next renewal"
                  value={sub.nextRenewal ? formatLocalDate(sub.nextRenewal, 'd MMM yyyy') : '—'}
                  hint={sub.estimated ? 'Estimated from last payment' : null}
                />
                <Fact label="Last paid" value={sub.lastPaid ? formatLocalDate(sub.lastPaid, 'd MMM yyyy') : '—'} />
                <Fact label="Paid with" value={sub.paidWith ?? '—'} />
              </dl>

              <section aria-labelledby="history-h">
                <div className="flex items-baseline justify-between">
                  <h3 id="history-h" className="text-[13px] font-medium uppercase tracking-[0.06em] text-muted-foreground">
                    Payment history
                  </h3>
                  {sub.paymentCount > 0 && (
                    <p className="text-[13px] text-muted-foreground">
                      {formatRupees(sub.totalPaid, { whole: true })} over {plural(sub.paymentCount, 'payment', 'payments')}
                    </p>
                  )}
                </div>
                <ol className="relative mt-3 border-l border-[var(--hairline)] pl-5">
                  {sub.history.map((e, i) => (
                    <motion.li
                      key={e.id}
                      initial={{ opacity: 0, x: 8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + Math.min(i, 12) * 0.03 }}
                      className="relative pb-4 last:pb-0"
                    >
                      <span
                        className={cn(
                          'absolute -left-[29px] top-0.5 flex size-[18px] items-center justify-center rounded-full bg-card ring-2 ring-card',
                          e.type === 'payment_failed' ? 'text-destructive' : e.type === 'trial_started' ? 'text-warning' : 'text-primary',
                        )}
                      >
                        <ApperIcon name={EVENT_ICON[e.type] ?? 'Circle'} size={18} />
                      </span>
                      <div className="flex items-baseline justify-between gap-3">
                        <p className="text-[15px] font-medium">{EVENT_LABEL[e.type] ?? 'Receipt'}</p>
                        <p className={cn('text-[15px] font-semibold tabular-nums', e.type === 'payment_failed' && 'text-destructive line-through decoration-1')}>
                          {e.amount != null ? formatRupees(e.amount) : ''}
                        </p>
                      </div>
                      <p className="text-[13px] text-muted-foreground">
                        {[formatLocalDate(e.date, 'd MMM yyyy'), e.paidWith].filter(Boolean).join(' · ')}
                      </p>
                    </motion.li>
                  ))}
                </ol>
              </section>

              <p className="text-[13px] leading-snug text-muted-foreground">
                Found from {plural(sub.history.length, 'receipt', 'receipts')} in your Gmail. To change or cancel this subscription, use {sub.name} directly.
              </p>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}
