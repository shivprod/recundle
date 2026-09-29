import { useState } from 'react';
import { motion } from 'framer-motion';
import ServiceIcon from '@/components/ServiceIcon';
import { formatRupees } from '@/gmail';
import { cn } from '@/lib/utils';

const MAX_ROWS = 6;

/**
 * Monthly cost per paid subscription as a sorted bar list (one hue, labelled
 * directly). Hovering a row shows its share and yearly cost; clicking opens it.
 */
export default function SpendBreakdown({ subscriptions, monthlyTotal, onOpen }) {
  const [hovered, setHovered] = useState(null);
  const paid = subscriptions.filter((s) => s.status !== 'trial' && s.monthly > 0).sort((a, b) => b.monthly - a.monthly);
  const top = paid.slice(0, MAX_ROWS);
  const rest = paid.slice(MAX_ROWS);
  const rows = rest.length
    ? [...top, { id: '__other', name: `${rest.length} more`, monthly: rest.reduce((n, s) => n + s.monthly, 0), yearly: rest.reduce((n, s) => n + (s.yearly ?? 0), 0), other: true }]
    : top;
  const max = rows.reduce((m, r) => Math.max(m, r.monthly), 0) || 1;

  return (
    <section aria-labelledby="spend-h" className="rounded-2xl bg-card p-5">
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="spend-h" className="text-[18px] font-semibold tracking-tight">Where it goes</h2>
        <p className="text-[13px] text-muted-foreground">Per month</p>
      </div>

      {rows.length === 0 ? (
        <p className="mt-6 text-[15px] text-muted-foreground">Paid subscriptions will appear here.</p>
      ) : (
        <ul className="mt-4 flex flex-col gap-1" onMouseLeave={() => setHovered(null)}>
          {rows.map((r, i) => {
            const share = monthlyTotal ? Math.round((r.monthly / monthlyTotal) * 100) : 0;
            const isHovered = hovered === r.id;
            const dimmed = hovered && !isHovered;
            const content = (
              <>
                <div className="flex items-center gap-2.5">
                  {r.other ? (
                    <span className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[11px] font-semibold text-muted-foreground">+{rest.length}</span>
                  ) : (
                    <ServiceIcon name={r.name} className="size-7 rounded-lg" />
                  )}
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{r.name}</span>
                  <span className="shrink-0 text-[14px] font-semibold tabular-nums">
                    {isHovered ? `${share}% · ${formatRupees(r.yearly, { whole: true })}/yr` : formatRupees(r.monthly, { whole: true })}
                  </span>
                </div>
                <div className="mt-1.5 h-2 w-full overflow-hidden rounded-r-[4px] bg-transparent pl-[38px]">
                  <motion.div
                    className="h-full rounded-r-[4px] bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(2, (r.monthly / max) * 100)}%` }}
                    transition={{ duration: 0.7, delay: 0.1 + i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                  />
                </div>
              </>
            );
            return (
              <li key={r.id} onMouseEnter={() => setHovered(r.id)} className={cn('transition-opacity', dimmed && 'opacity-50')}>
                {r.other ? (
                  <div className="rounded-lg px-2 py-2">{content}</div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onOpen(r)}
                    onFocus={() => setHovered(r.id)}
                    onBlur={() => setHovered(null)}
                    className="w-full rounded-lg px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label={`${r.name}: ${formatRupees(r.monthly, { whole: true })} a month, ${share}% of your total`}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
