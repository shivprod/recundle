import { useEffect, useState } from 'react';
import { Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { inr, inrShort, pct } from '@/core/format';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';

const VARS = ['--viz-in', '--viz-out', '--viz-1', '--viz-2', '--viz-3', '--viz-4', '--viz-5', '--viz-other', '--viz-grid', '--ink-2', '--ink-3', '--surface', '--line', '--primary'];

/** Chart colours come from CSS tokens (validated for colour-blind readers); re-read when the theme changes. */
export function useVizColors() {
  const read = () => {
    const cs = getComputedStyle(document.documentElement);
    return Object.fromEntries(VARS.map((v) => [v.slice(2), cs.getPropertyValue(v).trim()]));
  };
  const [c, setC] = useState(read);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const h = () => setC(read());
    mq.addEventListener('change', h);
    const obs = new MutationObserver(h);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    return () => {
      mq.removeEventListener('change', h);
      obs.disconnect();
    };
  }, []);
  return c;
}

function TipBox({ title, rows, foot }) {
  return (
    <div className="card min-w-44 px-3 py-2 text-[12.5px]">
      <p className="mb-1 font-semibold text-ink">{title}</p>
      {rows.map((r) => (
        <div key={r.label} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-ink-2">
            {r.color && <span className="size-2.5 rounded-sm" style={{ background: r.color }} />}
            {r.label}
          </span>
          <span className="tnum font-semibold text-ink">{r.value}</span>
        </div>
      ))}
      {foot && <p className="mt-1 border-t border-line pt-1 text-ink-3">{foot}</p>}
    </div>
  );
}

/** Monthly income vs expenses: two bars per month, one axis, hover for savings and change. */
export function IncomeExpenseChart({ data, onSelect, selectedKey, height = 260 }) {
  const c = useVizColors();
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <BarChart data={data} barGap={2} barCategoryGap="22%" margin={{ top: 8, right: 4, left: 0, bottom: 0 }} onClick={(e) => e?.activePayload && onSelect?.(e.activePayload[0].payload)}>
          <CartesianGrid vertical={false} stroke={c['viz-grid']} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c['ink-3'], fontSize: 12 }} />
          <YAxis tickFormatter={inrShort} tickLine={false} axisLine={false} tick={{ fill: c['ink-3'], fontSize: 11 }} width={52} />
          <Tooltip
            cursor={{ fill: c['viz-grid'], opacity: 0.5 }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return (
                <TipBox
                  title={d.longLabel}
                  rows={[
                    { label: 'Income', value: inr(d.income), color: c['viz-in'] },
                    { label: 'Expenses', value: inr(d.expenses), color: c['viz-out'] },
                    { label: 'Saved', value: inr(d.savings, { sign: true }) },
                  ]}
                  foot={d.change != null ? `Expenses ${d.change >= 0 ? 'up' : 'down'} ${pct(Math.abs(d.change))} on the month before${d.unusual ? ' · unusually high' : ''}` : null}
                />
              );
            }}
          />
          <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12.5, color: c['ink-2'] }} />
          <Bar dataKey="income" name="Income" fill={c['viz-in']} radius={[4, 4, 0, 0]} maxBarSize={22} cursor={onSelect ? 'pointer' : undefined}>
            {data.map((d) => (
              <Cell key={d.key} fillOpacity={selectedKey && selectedKey !== d.key ? 0.45 : 1} />
            ))}
          </Bar>
          <Bar dataKey="expenses" name="Expenses" fill={c['viz-out']} radius={[4, 4, 0, 0]} maxBarSize={22} cursor={onSelect ? 'pointer' : undefined}>
            {data.map((d) => (
              <Cell key={d.key} fillOpacity={selectedKey && selectedKey !== d.key ? 0.45 : 1} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

const SLOTS = ['viz-1', 'viz-2', 'viz-3', 'viz-4', 'viz-5'];

/** Top five categories plus "Other", with a clickable legend list (identity is never colour alone). */
export function CategoryDonut({ categories, onPick, total }) {
  const c = useVizColors();
  const [hover, setHover] = useState(null);
  const top = categories.slice(0, 5);
  const rest = categories.slice(5);
  const rows = rest.length ? [...top, { id: '__other', label: `Other (${rest.length})`, total: rest.reduce((s, r) => s + r.total, 0), share: rest.reduce((s, r) => s + r.share, 0), icon: 'Ellipsis', other: true }] : top;
  const color = (i, r) => (r.other ? c['viz-other'] : c[SLOTS[i]]);
  const focus = rows.find((r) => r.id === hover);
  return (
    <div className="grid items-center gap-4 sm:grid-cols-[200px_1fr]">
      <div className="relative mx-auto size-[200px]">
        <ResponsiveContainer>
          <PieChart>
            <Pie data={rows} dataKey="total" nameKey="label" innerRadius={64} outerRadius={94} paddingAngle={1.5} stroke={c.surface} strokeWidth={2} onMouseEnter={(d) => setHover(d.id)} onMouseLeave={() => setHover(null)} onClick={(d) => !d.other && onPick?.(d.id)} isAnimationActive>
              {rows.map((r, i) => (
                <Cell key={r.id} fill={color(i, r)} cursor={r.other ? 'default' : 'pointer'} fillOpacity={hover && hover !== r.id ? 0.45 : 1} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
          <span className="text-[11.5px] text-ink-3">{focus ? focus.label : 'Spent'}</span>
          <span className="tnum text-[17px] font-bold">{inr(focus ? focus.total : total)}</span>
          {focus && <span className="text-[11.5px] text-ink-3">{pct(focus.share)}</span>}
        </div>
      </div>
      <ul className="flex flex-col gap-0.5" onMouseLeave={() => setHover(null)}>
        {rows.map((r, i) => (
          <li key={r.id}>
            <button
              type="button"
              disabled={r.other && !onPick}
              onClick={() => (r.other ? onPick?.(null) : onPick?.(r.id))}
              onMouseEnter={() => setHover(r.id)}
              className={cn('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-surface-2', hover && hover !== r.id && 'opacity-60')}
            >
              <span className="size-3 shrink-0 rounded-sm" style={{ background: color(i, r) }} />
              <Icon name={r.icon} size={15} className="shrink-0 text-ink-3" />
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{r.label}</span>
              <span className="tnum text-[12.5px] text-ink-3">{pct(r.share)}</span>
              <span className="tnum w-20 text-right text-[13.5px] font-semibold">{inr(r.total)}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Sorted single-hue bar list with direct labels. Rows are buttons when `onPick` is given. */
export function BarList({ rows, onPick, valueLabel = (r) => inr(r.total), sub, max: maxIn, empty = 'Nothing here yet.' }) {
  const max = maxIn ?? (rows.reduce((m, r) => Math.max(m, r.total), 0) || 1);
  if (!rows.length) return <p className="py-6 text-center text-[13.5px] text-ink-3">{empty}</p>;
  return (
    <ul className="flex flex-col gap-1">
      {rows.map((r) => {
        const content = (
          <>
            <div className="flex items-center gap-2">
              {r.icon && <Icon name={r.icon} size={15} className="shrink-0 text-ink-3" />}
              <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{r.label}</span>
              {r.badge}
              <span className="tnum shrink-0 text-[13.5px] font-semibold">{valueLabel(r)}</span>
            </div>
            {sub && <div className="mt-0.5 truncate text-[12px] text-ink-3">{sub(r)}</div>}
            <div className="mt-1.5 h-1.5 w-full rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} />
            </div>
          </>
        );
        return (
          <li key={r.key ?? r.id ?? r.label}>
            {onPick ? (
              <button type="button" onClick={() => onPick(r)} className="w-full rounded-lg px-2 py-2 text-left transition hover:bg-surface-2">
                {content}
              </button>
            ) : (
              <div className="px-2 py-2">{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Remaining debt over time: paying EMIs only vs the chosen plan. */
export function PayoffChart({ baseline, plan, startIso, height = 220 }) {
  const c = useVizColors();
  // `baseline` and `plan` are balances by month, index 0 = today.
  const months = Math.max(baseline.length, plan.length);
  const start = new Date(`${startIso}T00:00:00`);
  const data = Array.from({ length: months }, (_, m) => {
    const d = new Date(start.getFullYear(), start.getMonth() + m, 1);
    return { m, label: d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }), baseline: baseline[m] ?? null, plan: plan[m] ?? null };
  });
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke={c['viz-grid']} />
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c['ink-3'], fontSize: 11 }} interval="preserveStartEnd" minTickGap={28} />
          <YAxis tickFormatter={inrShort} tickLine={false} axisLine={false} tick={{ fill: c['ink-3'], fontSize: 11 }} width={52} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0].payload;
              return <TipBox title={d.label} rows={[{ label: 'EMIs only', value: d.baseline != null ? inr(d.baseline) : '—', color: c['viz-other'] }, { label: 'With your plan', value: d.plan != null ? inr(d.plan) : '—', color: c['viz-in'] }]} />;
            }}
          />
          <Legend iconType="plainline" wrapperStyle={{ fontSize: 12.5 }} />
          <Line type="monotone" dataKey="baseline" name="EMIs only" stroke={c['viz-other']} strokeWidth={2} strokeDasharray="5 4" dot={false} connectNulls={false} />
          <Line type="monotone" dataKey="plan" name="With your plan" stroke={c['viz-in']} strokeWidth={2} dot={false} connectNulls={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
