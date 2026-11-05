import { Badge, Icon, Input, Segmented } from '@/components/ui';
import { allCategories, TYPES } from '@/core/categories';
import { addDays, inr, shortDate } from '@/core/format';
import { PERIODS } from '@/core/analytics';
import { cn } from '@/lib/cn';

export function categoryMap(custom) {
  return new Map(allCategories(custom).map((c) => [c.id, c]));
}

export function ClassifiedBadge({ t }) {
  if (t.classifiedBy === 'user') return <Badge tone="info" icon="UserPen">You</Badge>;
  if (t.classifiedBy === 'rule') return <Badge tone="brand" icon="Wand">Your rule</Badge>;
  if (t.confidence < 0.5) return <Badge tone="warn" icon="CircleHelp">Check</Badge>;
  return null;
}

export function Amount({ t, className }) {
  const transfer = t.type === 'transfer';
  return (
    <span className={cn('tnum font-semibold', t.direction === 'in' && !transfer ? 'text-good' : 'text-ink', transfer && 'text-ink-3', t.excluded && 'line-through opacity-60', className)}>
      {t.direction === 'in' ? '+' : '−'}
      {inr(t.amount, { exact: true })}
    </span>
  );
}

export function TransactionRow({ t, cats, onOpen, showDate }) {
  const cat = cats.get(t.category);
  return (
    <li>
      <button type="button" onClick={() => onOpen(t)} className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-3 rounded-xl px-2 py-2.5 text-left transition hover:bg-surface-2">
        <span className={cn('flex size-9 items-center justify-center rounded-xl', t.direction === 'in' ? 'bg-good-soft text-good' : 'bg-surface-2 text-ink-2')}>
          <Icon name={t.isPerson ? 'User' : (cat?.icon ?? 'Receipt')} size={17} />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14.5px] font-semibold">{t.name}</span>
            <ClassifiedBadge t={t} />
            {t.subscriptionKey || t.subscription?.isSubscription ? <Icon name="Repeat" size={13} className="shrink-0 text-ink-3" aria-label="Subscription" /> : null}
          </span>
          <span className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] text-ink-3">
            {showDate && <span className="shrink-0">{shortDate(t.date)} ·</span>}
            <span className="truncate">{cat?.label ?? 'Other'}{t.subcategory ? ` · ${t.subcategory}` : ''}</span>
            {t.method && <span className="hidden shrink-0 sm:inline">· {t.method}</span>}
            {t.type !== 'expense' && t.type !== 'income' && <Badge className="ml-0.5">{TYPES[t.type]?.label}</Badge>}
          </span>
        </span>
        <Amount t={t} className="text-[14.5px]" />
      </button>
    </li>
  );
}

export function dayLabel(iso, today) {
  if (iso === today) return 'Today';
  if (iso === addDays(today, -1)) return 'Yesterday';
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: d.getFullYear() !== new Date().getFullYear() ? 'numeric' : undefined });
}

/** Grouped by day with the day's net total. */
export function GroupedList({ txns, cats, onOpen, today, limit = 400 }) {
  const days = [];
  for (const t of txns.slice(0, limit)) {
    const last = days[days.length - 1];
    if (last?.date === t.date) last.items.push(t);
    else days.push({ date: t.date, items: [t] });
  }
  return (
    <div className="flex flex-col gap-3">
      {days.map((d) => {
        const out = d.items.filter((t) => t.direction === 'out' && !t.excluded && t.type !== 'transfer').reduce((s, t) => s + t.amount, 0);
        return (
          <div key={d.date}>
            <div className="flex items-baseline justify-between border-b border-line px-2 pb-1 text-[12px] font-medium uppercase tracking-wide text-ink-3">
              <span>{dayLabel(d.date, today)}</span>
              {out > 0 && <span className="tnum normal-case">Spent {inr(out)}</span>}
            </div>
            <ul className="mt-1">
              {d.items.map((t) => (
                <TransactionRow key={t.id} t={t} cats={cats} onOpen={onOpen} />
              ))}
            </ul>
          </div>
        );
      })}
      {txns.length > limit && <p className="text-center text-[13px] text-ink-3">Showing the latest {limit}. Narrow the period or search to see more.</p>}
    </div>
  );
}

export function PeriodPicker({ value, custom, onChange, onCustom }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <Segmented id="period" label="Period" size="sm" value={value} onChange={onChange} options={PERIODS.map((p) => ({ value: p.id, label: p.label }))} />
      {value === 'custom' && (
        <div className="flex items-center gap-2">
          <Input type="date" value={custom.from ?? ''} onChange={(e) => onCustom({ ...custom, from: e.target.value })} className="h-8 w-[9.5rem] text-[13px]" aria-label="From" />
          <span className="text-ink-3">–</span>
          <Input type="date" value={custom.to ?? ''} onChange={(e) => onCustom({ ...custom, to: e.target.value })} className="h-8 w-[9.5rem] text-[13px]" aria-label="To" />
        </div>
      )}
    </div>
  );
}
