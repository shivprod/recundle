import { useEffect, useRef, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Cell, Layer, Legend, Line, LineChart, Pie, PieChart, ReferenceArea, Rectangle, ResponsiveContainer, Sankey, Sector, Tooltip, XAxis, YAxis } from 'recharts';
import { motion } from 'framer-motion';
import { inr, inrShort, pct } from '@/core/format';
import { Icon } from '@/components/ui';
import { cn } from '@/lib/cn';

const VARS = ['--brand', '--accent', '--ink', '--viz-in', '--viz-out', '--viz-1', '--viz-2', '--viz-3', '--viz-4', '--viz-5', '--viz-other', '--viz-grid', '--ink-2', '--ink-3', '--surface', '--line', '--primary'];

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
            <Pie
              data={rows}
              dataKey="total"
              nameKey="label"
              innerRadius={66}
              outerRadius={92}
              paddingAngle={2.5}
              cornerRadius={5}
              stroke="none"
              activeIndex={rows.findIndex((r) => r.id === hover)}
              activeShape={(p) => <Sector {...p} outerRadius={p.outerRadius + 7} innerRadius={p.innerRadius - 2} />}
              onMouseEnter={(d) => setHover(d.id)}
              onMouseLeave={() => setHover(null)}
              onClick={(d) => !d.other && onPick?.(d.id)}
              animationDuration={900}
              animationBegin={100}
            >
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
              <div className="h-full rounded-full bg-brand" style={{ width: `${Math.max(2, (r.total / max) * 100)}%` }} />
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

/**
 * Cash flow over time: income and expenses as soft gradient areas on one axis, with the selected month
 * shaded. Hover for the month's income, expenses, savings and change.
 */
export function CashFlowChart({ data, onSelect, selectedKey, height = 280 }) {
  const c = useVizColors();
  const sel = data.find((d) => d.key === selectedKey);
  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 10, right: 6, left: 0, bottom: 0 }} onClick={(e) => e?.activePayload && onSelect?.(e.activePayload[0].payload)}>
          <defs>
            <linearGradient id="cf-in" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c['viz-in']} stopOpacity={0.38} />
              <stop offset="100%" stopColor={c['viz-in']} stopOpacity={0.02} />
            </linearGradient>
            <linearGradient id="cf-out" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c['viz-out']} stopOpacity={0.32} />
              <stop offset="100%" stopColor={c['viz-out']} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke={c['viz-grid']} strokeDasharray="2 6" />
          {sel && <ReferenceArea x1={sel.label} x2={sel.label} fill={c['viz-in']} fillOpacity={0.06} />}
          <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: c['ink-3'], fontSize: 11.5, fontFamily: 'var(--font-mono)' }} dy={6} />
          <YAxis tickFormatter={inrShort} tickLine={false} axisLine={false} tick={{ fill: c['ink-3'], fontSize: 11, fontFamily: 'var(--font-mono)' }} width={54} />
          <Tooltip
            cursor={{ stroke: c['ink-3'], strokeDasharray: '3 4' }}
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
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12.5, color: c['ink-2'] }} />
          <Area type="monotone" dataKey="income" name="Income" stroke={c['viz-in']} strokeWidth={2.2} fill="url(#cf-in)" activeDot={{ r: 5, strokeWidth: 2, stroke: c.surface }} animationDuration={1100} cursor={onSelect ? 'pointer' : undefined} />
          <Area type="monotone" dataKey="expenses" name="Expenses" stroke={c['viz-out']} strokeWidth={2.2} fill="url(#cf-out)" activeDot={{ r: 5, strokeWidth: 2, stroke: c.surface }} animationDuration={1100} animationBegin={150} cursor={onSelect ? 'pointer' : undefined} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/** A tiny trend line for a tile. */
export function Sparkline({ values, color = 'viz-in', height = 34 }) {
  const c = useVizColors();
  const data = values.map((v, i) => ({ i, v }));
  const id = `sp-${color}`;
  return (
    <div style={{ height }} className="w-full" aria-hidden="true">
      <ResponsiveContainer>
        <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={c[color]} stopOpacity={0.3} />
              <stop offset="100%" stopColor={c[color]} stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area type="monotone" dataKey="v" stroke={c[color]} strokeWidth={1.6} fill={`url(#${id})`} dot={false} isAnimationActive animationDuration={900} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

/**
 * Money flow: where money came from (left), through you, to where it went (right), including what
 * was saved. Built from the period's transactions; own transfers are left out.
 */
export function MoneyFlow({ sources, targets, height = 340, onPickTarget }) {
  const c = useVizColors();
  const [hover, setHover] = useState(null);
  const nodes = [...sources.map((s) => ({ name: s.label, value: s.value, side: 'in', key: s.key })), { name: 'You', side: 'mid' }, ...targets.map((t) => ({ name: t.label, value: t.value, side: 'out', key: t.key, saved: t.saved }))];
  const mid = sources.length;
  const links = [...sources.map((s, i) => ({ source: i, target: mid, value: s.value })), ...targets.map((t, i) => ({ source: mid, target: mid + 1 + i, value: t.value }))].filter((l) => l.value > 0);
  if (!links.length) return null;
  const Node = ({ x, y, width, height: h, index, payload }) => {
    const n = nodes[index];
    const isMid = n.side === 'mid';
    const fill = isMid ? c.ink : n.saved ? c['viz-3'] : n.side === 'in' ? c['viz-in'] : c['viz-out'];
    const right = n.side === 'out';
    return (
      <Layer key={`n-${index}`}>
        <Rectangle x={x} y={y} width={width} height={Math.max(2, h)} fill={fill} radius={2} onClick={() => right && !n.saved && onPickTarget?.(n.key)} style={{ cursor: right && !n.saved ? 'pointer' : 'default' }} />
        {!isMid && (
          <text x={right ? x - 8 : x + width + 8} y={y + h / 2} textAnchor={right ? 'end' : 'start'} dominantBaseline="middle" fontSize={12} fill={c['ink-2']}>
            <tspan fontWeight={600} fill={c.ink}>{n.name}</tspan>
            <tspan dx={6} fontFamily="var(--font-mono)" fontSize={11}>{inrShort(payload.value)}</tspan>
          </text>
        )}
      </Layer>
    );
  };
  const Link = ({ sourceX, targetX, sourceY, targetY, sourceControlX, targetControlX, linkWidth, index, payload }) => {
    const active = hover == null || hover === index;
    const toSaved = payload.target?.saved;
    return (
      <path
        d={`M${sourceX},${sourceY} C${sourceControlX},${sourceY} ${targetControlX},${targetY} ${targetX},${targetY}`}
        fill="none"
        stroke={toSaved ? c['viz-3'] : c['viz-in']}
        strokeOpacity={active ? 0.32 : 0.08}
        strokeWidth={Math.max(1, linkWidth)}
        onMouseEnter={() => setHover(index)}
        onMouseLeave={() => setHover(null)}
        style={{ transition: 'stroke-opacity .2s' }}
      >
        <title>{`${payload.source.name} → ${payload.target.name}: ${inr(payload.value)}`}</title>
      </path>
    );
  };
  return (
    <motion.div initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} viewport={{ once: true }} transition={{ duration: 0.8 }} className="w-full overflow-x-auto pb-1">
      <div style={{ height }} className="min-w-[620px]">
        <ResponsiveContainer>
          <Sankey data={{ nodes, links }} node={<Node />} link={<Link />} nodePadding={18} nodeWidth={10} iterations={48} margin={{ top: 8, bottom: 8, left: 8, right: 8 }} sort={false} />
        </ResponsiveContainer>
      </div>
    </motion.div>
  );
}

/**
 * Daily spending for the last `weeks` weeks as a calendar heatmap: one violet ramp from light (little)
 * to dark (a lot). Hover shows the day; clicking opens its transactions.
 */
export function SpendHeatmap({ days, weeks = 26, today, onPick }) {
  const [tip, setTip] = useState(null);
  const scroller = useRef(null);
  useEffect(() => {
    // Start at the latest weeks on narrow screens.
    if (scroller.current) scroller.current.scrollLeft = scroller.current.scrollWidth;
  }, []);
  const end = new Date(`${today}T00:00:00`);
  const start = new Date(end);
  start.setDate(start.getDate() - (weeks * 7 - 1) - ((end.getDay() + 6) % 7 === 6 ? 0 : 6 - ((end.getDay() + 6) % 7)));
  const cells = [];
  const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  // Start on a Monday.
  const first = new Date(end);
  first.setDate(first.getDate() - ((end.getDay() + 6) % 7) - (weeks - 1) * 7);
  for (let w = 0; w < weeks; w++) {
    for (let d = 0; d < 7; d++) {
      const day = new Date(first);
      day.setDate(first.getDate() + w * 7 + d);
      const key = iso(day);
      cells.push({ key, w, d, value: days.get(key) ?? 0, future: day > end, month: day.getDate() <= 7 && d === 0 ? day.toLocaleDateString('en-IN', { month: 'short' }) : null });
    }
  }
  const values = cells.filter((c) => c.value > 0).map((c) => c.value).sort((a, b) => a - b);
  const q = (p) => values[Math.min(values.length - 1, Math.floor(p * values.length))] ?? 0;
  const steps = [q(0.25), q(0.5), q(0.75), q(0.92)];
  const level = (v) => (v <= 0 ? 0 : v <= steps[0] ? 1 : v <= steps[1] ? 2 : v <= steps[2] ? 3 : v <= steps[3] ? 4 : 5);
  const shade = ['var(--surface-2)', 'color-mix(in oklab, var(--viz-in) 18%, var(--surface))', 'color-mix(in oklab, var(--viz-in) 36%, var(--surface))', 'color-mix(in oklab, var(--viz-in) 58%, var(--surface))', 'color-mix(in oklab, var(--viz-in) 80%, var(--surface))', 'var(--viz-in)'];
  const size = 13;
  const gap = 3;
  return (
    <div className="relative">
      <div ref={scroller} className="overflow-x-auto pb-1">
        <svg width={weeks * (size + gap) + 30} height={7 * (size + gap) + 20} role="img" aria-label="Daily spending heatmap">
          {['Mon', '', 'Wed', '', 'Fri', '', ''].map((l, i) => (
            <text key={i} x={0} y={20 + i * (size + gap) + size - 3} fontSize="9.5" fill="var(--ink-3)" fontFamily="var(--font-mono)">{l}</text>
          ))}
          {cells.filter((c) => c.month).map((c) => (
            <text key={`m-${c.key}`} x={30 + c.w * (size + gap)} y={10} fontSize="9.5" fill="var(--ink-3)" fontFamily="var(--font-mono)">{c.month}</text>
          ))}
          {cells.map((c, i) =>
            c.future ? null : (
              <motion.rect
                key={c.key}
                x={30 + c.w * (size + gap)}
                y={18 + c.d * (size + gap)}
                width={size}
                height={size}
                rx={3}
                fill={shade[level(c.value)]}
                stroke={tip?.key === c.key ? 'var(--ink)' : 'none'}
                initial={{ opacity: 0, scale: 0.4 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ delay: c.w * 0.015, duration: 0.3 }}
                style={{ cursor: c.value ? 'pointer' : 'default', transformOrigin: 'center', transformBox: 'fill-box' }}
                onMouseEnter={() => setTip({ ...c, x: 30 + c.w * (size + gap), y: 18 + c.d * (size + gap) })}
                onMouseLeave={() => setTip(null)}
                onClick={() => c.value && onPick?.(c.key)}
              />
            ),
          )}
        </svg>
      </div>
      {tip && (
        <div className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full" style={{ left: tip.x + 6, top: tip.y + 12 }}>
          <div className="card whitespace-nowrap px-2.5 py-1.5 text-[12px]">
            <b>{new Date(`${tip.key}T00:00:00`).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</b> · {tip.value ? inr(tip.value) : 'No spending'}
          </div>
        </div>
      )}
      <div className="mt-2 flex items-center justify-end gap-1.5 text-[11px] text-ink-3">
        <span className="label-mono !text-[10px]">Less</span>
        {shade.map((s, i) => <span key={i} className="size-3 rounded-[3px]" style={{ background: s }} />)}
        <span className="label-mono !text-[10px]">More</span>
      </div>
    </div>
  );
}
