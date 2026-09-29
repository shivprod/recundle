import { AnimatePresence, motion } from 'framer-motion';
import ApperIcon from '@/components/ApperIcon';
import ServiceIcon from '@/components/ServiceIcon';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatRupees, PERIOD_LABEL } from '@/gmail';
import { cn } from '@/lib/utils';
import { FILTERS, SORTS, isThisWeek, renewalText } from './format';

const STATUS_TAG = {
  trial: { label: 'Free trial', className: 'bg-warning/15 text-warning' },
  failed: { label: 'Payment failed', className: 'bg-destructive/15 text-destructive' },
};

function StatusTag({ status }) {
  const tag = STATUS_TAG[status];
  if (!tag) return null;
  return <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-semibold', tag.className)}>{tag.label}</span>;
}

function Row({ sub, onOpen, index }) {
  const soon = sub.status === 'active' && isThisWeek(sub) && sub.daysUntilRenewal <= 3;
  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25, delay: Math.min(index, 10) * 0.025 }}
    >
      <button
        type="button"
        onClick={() => onOpen(sub)}
        className="group grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto]"
      >
        <ServiceIcon name={sub.name} className="transition-transform group-hover:scale-105" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <p className="truncate text-[16px] font-semibold">{sub.name}</p>
            <StatusTag status={sub.status} />
          </div>
          <p
            className={cn(
              'truncate text-[13px] text-muted-foreground md:hidden',
              soon && 'font-medium text-primary',
              sub.status === 'failed' && 'text-destructive',
            )}
          >
            {renewalText(sub)}
          </p>
          <p className="hidden truncate text-[13px] text-muted-foreground md:block">
            {[sub.plan, sub.paidWith].filter(Boolean).join(' · ') || ' '}
          </p>
        </div>
        <p
          className={cn(
            'hidden truncate text-[14px] text-muted-foreground md:block',
            soon && 'font-medium text-primary',
            sub.status === 'failed' && 'text-destructive',
          )}
        >
          {renewalText(sub) ?? '—'}
        </p>
        <p className="hidden text-right text-[14px] tabular-nums md:block">
          {formatRupees(sub.amount)}
          {sub.period && <span className="text-muted-foreground"> / {PERIOD_LABEL[sub.period]}</span>}
        </p>
        <p className="text-right text-[15px] font-semibold tabular-nums">
          {sub.monthly != null ? formatRupees(sub.monthly, { whole: true }) : formatRupees(sub.amount)}
          <span className="block text-[12px] font-normal text-muted-foreground md:hidden">
            {sub.monthly != null ? 'per month' : sub.period ? `per ${PERIOD_LABEL[sub.period]}` : ''}
          </span>
        </p>
        <ApperIcon name="ChevronRight" size={18} className="hidden text-muted-foreground transition-transform group-hover:translate-x-0.5 md:block" />
      </button>
    </motion.li>
  );
}

/** Searchable, filterable, sortable list of subscriptions; rows open the detail panel. */
export default function SubscriptionList({ subscriptions, filter, onFilter, sort, onSort, query, onQuery, onOpen }) {
  const counts = Object.fromEntries(Object.entries(FILTERS).map(([k, f]) => [k, subscriptions.filter(f.test).length]));
  const q = query.trim().toLowerCase();
  const visible = subscriptions
    .filter(FILTERS[filter].test)
    .filter((s) => !q || [s.name, s.plan, s.paidWith].filter(Boolean).some((t) => t.toLowerCase().includes(q)))
    .sort(SORTS[sort].compare);

  return (
    <section id="subscriptions" aria-labelledby="subs-h" className="scroll-mt-24 rounded-2xl bg-card p-3 sm:p-4">
      <div className="flex flex-col gap-3 px-1 pb-3 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="subs-h" className="text-[18px] font-semibold tracking-tight">Subscriptions</h2>
        <div className="flex gap-2">
          <div className="relative min-w-0 flex-1 sm:w-56 sm:flex-none">
            <ApperIcon name="Search" size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="subscription-search"
              type="search"
              value={query}
              onChange={(e) => onQuery(e.target.value)}
              placeholder="Search"
              aria-label="Search subscriptions"
              className="h-10 pl-9"
            />
          </div>
          <Select value={sort} onValueChange={onSort}>
            <SelectTrigger className="h-10 w-auto gap-1.5 rounded-xl" aria-label="Sort subscriptions">
              <ApperIcon name="ArrowUpDown" size={15} className="text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              {Object.entries(SORTS).map(([k, s]) => (
                <SelectItem key={k} value={k}>{s.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-3" role="group" aria-label="Filter subscriptions">
        {Object.entries(FILTERS)
          .filter(([k]) => k === 'all' || counts[k] > 0 || filter === k)
          .map(([k, f]) => (
            <button
              key={k}
              type="button"
              onClick={() => onFilter(k)}
              aria-pressed={filter === k}
              className={cn(
                'relative shrink-0 rounded-full px-3 py-1.5 text-[14px] font-medium transition-colors',
                filter === k ? 'text-primary-foreground' : 'bg-muted text-muted-foreground hover:text-foreground',
              )}
            >
              {filter === k && (
                <motion.span layoutId="filter-pill" className="absolute inset-0 rounded-full bg-primary" transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }} />
              )}
              <span className="relative">
                {f.label} <span className="tabular-nums opacity-70">{counts[k]}</span>
              </span>
            </button>
          ))}
      </div>

      <div
        aria-hidden="true"
        className="hidden grid-cols-[auto_minmax(0,1.6fr)_minmax(0,1.3fr)_minmax(0,0.9fr)_minmax(0,0.9fr)_auto] gap-3 border-b border-[var(--hairline)] px-3 pb-2 text-[12px] font-medium uppercase tracking-[0.06em] text-muted-foreground md:grid"
      >
        <span className="w-10" />
        <span>Service</span>
        <span>Renewal</span>
        <span className="text-right">Price</span>
        <span className="text-right">Per month</span>
        <span className="w-[18px]" />
      </div>

      {visible.length > 0 ? (
        <ul className="mt-1">
          <AnimatePresence initial={false} mode="popLayout">
            {visible.map((sub, i) => (
              <Row key={sub.id} sub={sub} index={i} onOpen={onOpen} />
            ))}
          </AnimatePresence>
        </ul>
      ) : (
        <div className="flex flex-col items-center px-4 py-12 text-center">
          <ApperIcon name="SearchX" size={22} className="text-muted-foreground" />
          <p className="mt-3 font-medium">No subscriptions match</p>
          <button
            type="button"
            onClick={() => { onQuery(''); onFilter('all'); }}
            className="mt-2 text-[15px] font-medium text-primary hover:underline"
          >
            Show all subscriptions
          </button>
        </div>
      )}
    </section>
  );
}
