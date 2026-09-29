import { motion } from 'framer-motion';
import ApperIcon from '@/components/ApperIcon';
import { formatRupees } from '@/gmail';
import { cn } from '@/lib/utils';

function Tile({ icon, label, value, sub, filter, active, onSelect, index, emphasis }) {
  const interactive = Boolean(filter);
  const Tag = interactive ? motion.button : motion.div;
  return (
    <Tag
      type={interactive ? 'button' : undefined}
      onClick={interactive ? () => onSelect(active ? 'all' : filter) : undefined}
      aria-pressed={interactive ? active : undefined}
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.04 * index, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      whileHover={interactive ? { y: -2 } : undefined}
      whileTap={interactive ? { scale: 0.98 } : undefined}
      className={cn(
        'group relative flex min-w-0 flex-col rounded-2xl bg-card p-4 text-left ring-1 ring-transparent transition-[box-shadow,background-color] sm:p-5',
        interactive && 'cursor-pointer hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
        active && 'bg-secondary ring-primary/40',
        emphasis && 'col-span-2 sm:col-span-1',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-medium text-muted-foreground">{label}</span>
        <span
          className={cn(
            'flex size-8 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors',
            (active || emphasis) && 'bg-primary/15 text-primary',
            interactive && 'group-hover:bg-primary/15 group-hover:text-primary',
          )}
        >
          <ApperIcon name={icon} size={16} />
        </span>
      </div>
      <p className="mt-2 truncate text-[28px] font-bold leading-tight tracking-tight tabular-nums">{value}</p>
      <p className="mt-0.5 flex items-center gap-1 truncate text-[13px] text-muted-foreground">
        {sub}
        {interactive && (
          <ApperIcon
            name={active ? 'X' : 'ChevronRight'}
            size={13}
            className="shrink-0 opacity-60 transition-transform group-hover:translate-x-0.5"
          />
        )}
      </p>
    </Tag>
  );
}

/** Headline numbers. Count tiles double as filters for the subscription list. */
export default function KpiRow({ totals, filter, onFilter }) {
  const { monthlyTotal, yearlyTotal, paidCount, trialCount, weekCount } = totals;
  const tiles = [
    { icon: 'Wallet', label: 'Every month', value: formatRupees(monthlyTotal, { whole: true }), sub: 'Paid subscriptions', emphasis: true },
    { icon: 'TrendingUp', label: 'Every year', value: formatRupees(yearlyTotal, { whole: true }), sub: 'At current prices' },
    { icon: 'Layers', label: 'Subscriptions', value: paidCount, sub: 'Show paid', filter: 'active' },
    { icon: 'CalendarDays', label: 'This week', value: weekCount, sub: 'Show renewals', filter: 'week' },
    { icon: 'Sparkles', label: 'Free trials', value: trialCount, sub: 'Show trials', filter: 'trial' },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
      {tiles.map((t, i) => (
        <Tile key={t.label} {...t} index={i} active={t.filter && filter === t.filter} onSelect={onFilter} />
      ))}
    </div>
  );
}
