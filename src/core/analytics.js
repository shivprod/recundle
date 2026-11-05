import { allCategories } from './categories.js';
import { addMonths, daysBetween, endOfMonth, inr, monthKey, monthLabel, monthsBetweenKeys, pct, plural, shiftMonthKey, shortDate, toIso } from './format.js';

/**
 * Money in and out over a period. Definitions (shown in the app):
 *  - Money received: every credit except transfers between your own accounts.
 *  - Money spent:    every debit except own transfers, card bill payments and investments.
 *  - Income:         credits marked as income (not refunds, reimbursements or loans received).
 *  - Expenses:       debits marked as expenses, minus refunds.
 *  - Net cash flow:  money received − money spent.
 *  - Savings:        income − expenses.
 */

export const PERIODS = [
  { id: 'this_month', label: 'This month' },
  { id: 'last_month', label: 'Previous month' },
  { id: '3m', label: 'Last 3 months' },
  { id: '6m', label: 'Last 6 months' },
  { id: '12m', label: 'Last 12 months' },
  { id: 'custom', label: 'Custom' },
];

/** { from, to, label, months } for a period preset, plus the equal-length period before it. */
export function periodRange(id, today = toIso(new Date()), custom = {}) {
  const thisMonth = monthKey(today);
  let from;
  let to;
  if (id === 'last_month') {
    const k = shiftMonthKey(thisMonth, -1);
    [from, to] = [`${k}-01`, endOfMonth(k)];
  } else if (id === '3m' || id === '6m' || id === '12m') {
    const n = Number.parseInt(id, 10);
    [from, to] = [`${shiftMonthKey(thisMonth, -(n - 1))}-01`, today];
  } else if (id === 'custom' && custom.from && custom.to) {
    [from, to] = custom.from <= custom.to ? [custom.from, custom.to] : [custom.to, custom.from];
  } else {
    [from, to] = [`${thisMonth}-01`, today];
  }
  const months = monthsBetweenKeys(monthKey(from), monthKey(to)) + 1;
  const span = daysBetween(from, to) + 1;
  // The period before: the same number of calendar months (or days, for custom ranges) immediately preceding.
  const previous = id === 'custom' ? { from: toIso(new Date(new Date(`${from}T00:00:00`).getTime() - span * 86_400_000)), to: toIso(new Date(new Date(`${from}T00:00:00`).getTime() - 86_400_000)) } : { from: `${shiftMonthKey(monthKey(from), -months)}-01`, to: id === 'this_month' ? addMonths(today, -1) : endOfMonth(shiftMonthKey(monthKey(from), -1)) };
  const label = PERIODS.find((p) => p.id === id)?.label ?? 'Custom';
  return { id, from, to, months, label: id === 'custom' ? `${shortDate(from)} – ${shortDate(to)}` : label, previous };
}

export const inRange = (t, r) => t.date >= r.from && t.date <= r.to;

const SPENDING_EXCLUDED = new Set(['card_bill', 'investments', 'own_accounts']);
const isTransfer = (t) => t.type === 'transfer';

export function metrics(txns, range) {
  const list = txns.filter((t) => !t.excluded && inRange(t, range));
  let moneyIn = 0;
  let moneyOut = 0;
  let income = 0;
  let expense = 0;
  let refunds = 0;
  let transfers = 0;
  for (const t of list) {
    if (isTransfer(t)) {
      transfers += t.amount;
      continue;
    }
    if (t.direction === 'in') {
      moneyIn += t.amount;
      if (t.type === 'income') income += t.amount;
      if (t.type === 'refund') refunds += t.amount;
    } else if (!SPENDING_EXCLUDED.has(t.category)) {
      moneyOut += t.amount;
      if (t.type === 'expense') expense += t.amount;
    }
  }
  const expenses = Math.max(0, expense - refunds);
  const cats = categoryBreakdown(list);
  return {
    count: list.length,
    moneyIn,
    moneyOut,
    netCashFlow: moneyIn - moneyOut,
    income,
    expenses,
    grossExpenses: expense,
    refunds,
    transfers,
    savings: income - expenses,
    savingsPerMonth: Math.round((income - expenses) / range.months),
    avgMonthlyExpense: Math.round(expenses / range.months),
    savingsRate: income > 0 ? (income - expenses) / income : null,
    topCategory: cats[0] ?? null,
  };
}

/** Spending by category (expenses only), largest first, with share of the total. */
export function categoryBreakdown(list, customCategories = {}) {
  const cats = new Map(allCategories(customCategories).map((c) => [c.id, c]));
  const m = new Map();
  let total = 0;
  for (const t of list) {
    if (t.excluded || t.direction !== 'out' || t.type !== 'expense') continue;
    const c = cats.get(t.category) ?? cats.get('other');
    const row = m.get(c.id) ?? { id: c.id, label: c.label, icon: c.icon, total: 0, count: 0, subs: new Map() };
    row.total += t.amount;
    row.count += 1;
    if (t.subcategory) row.subs.set(t.subcategory, (row.subs.get(t.subcategory) ?? 0) + t.amount);
    m.set(c.id, row);
    total += t.amount;
  }
  return [...m.values()]
    .map((r) => ({ ...r, share: total ? r.total / total : 0, subs: [...r.subs.entries()].map(([label, amount]) => ({ label, amount })).sort((a, b) => b.amount - a.amount) }))
    .sort((a, b) => b.total - a.total);
}

/** Month-by-month income, expenses and savings for the `count` months ending at `endKey`. */
export function monthlySeries(txns, endKey, count = 12) {
  const rows = Array.from({ length: count }, (_, i) => {
    const key = shiftMonthKey(endKey, i - count + 1);
    return { key, label: monthLabel(key), longLabel: monthLabel(key, true), income: 0, expenses: 0, refunds: 0, moneyIn: 0, moneyOut: 0 };
  });
  const byKey = new Map(rows.map((r) => [r.key, r]));
  for (const t of txns) {
    if (t.excluded || isTransfer(t)) continue;
    const r = byKey.get(monthKey(t.date));
    if (!r) continue;
    if (t.direction === 'in') {
      r.moneyIn += t.amount;
      if (t.type === 'income') r.income += t.amount;
      if (t.type === 'refund') r.refunds += t.amount;
    } else if (!SPENDING_EXCLUDED.has(t.category)) {
      r.moneyOut += t.amount;
      if (t.type === 'expense') r.expenses += t.amount;
    }
  }
  return rows.map((r, i) => {
    const expenses = Math.max(0, r.expenses - r.refunds);
    const prev = i > 0 ? Math.max(0, rows[i - 1].expenses - rows[i - 1].refunds) : null;
    const prior = rows.slice(Math.max(0, i - 3), i).map((x) => Math.max(0, x.expenses - x.refunds)).filter((x) => x > 0);
    const avg = prior.length ? prior.reduce((s, x) => s + x, 0) / prior.length : null;
    return {
      ...r,
      expenses,
      savings: r.income - expenses,
      change: prev ? (expenses - prev) / prev : null,
      // An unusual month: 30% above the average of the three before it (and at least ₹2,000 more).
      unusual: avg != null && prior.length >= 2 && expenses > avg * 1.3 && expenses - avg >= 200_000,
    };
  });
}

/** Payees grouped: totals, counts, and whether they look like a person. */
export function entities(list, direction = 'out') {
  const m = new Map();
  for (const t of list) {
    if (t.excluded || t.direction !== direction || isTransfer(t)) continue;
    const k = t.entityKey || t.counterparty;
    const e = m.get(k) ?? { key: k, name: t.counterparty, isPerson: t.isPerson, total: 0, count: 0, largest: 0, last: t.date, first: t.date, category: t.category, ids: [] };
    e.total += t.amount;
    e.count += 1;
    e.largest = Math.max(e.largest, t.amount);
    if (t.date > e.last) e.last = t.date;
    if (t.date < e.first) e.first = t.date;
    e.ids.push(t.id);
    m.set(k, e);
  }
  return [...m.values()].sort((a, b) => b.total - a.total);
}

/** Income sources: recurring payers (3+ months with similar amounts) are marked, e.g. salary. */
export function inflows(txns, range) {
  const list = txns.filter((t) => !t.excluded && t.direction === 'in' && inRange(t, range));
  const sources = entities(list, 'in');
  const history = txns.filter((t) => !t.excluded && t.direction === 'in' && t.type === 'income');
  for (const s of sources) {
    const months = new Map();
    for (const t of history) if ((t.entityKey || t.counterparty) === s.key) months.set(monthKey(t.date), (months.get(monthKey(t.date)) ?? 0) + t.amount);
    const values = [...months.values()];
    const avg = values.reduce((a, b) => a + b, 0) / (values.length || 1);
    s.recurring = values.length >= 3 && values.every((v) => Math.abs(v - avg) / avg < 0.25);
  }
  const byType = {};
  for (const t of list) byType[t.type] = (byType[t.type] ?? 0) + t.amount;
  return {
    sources,
    people: sources.filter((s) => s.isPerson),
    recurring: sources.filter((s) => s.recurring),
    byType,
    total: list.reduce((s, t) => s + t.amount, 0),
  };
}

/**
 * "Where is my money going?" Observations with the transactions behind each one (`ids`), so every
 * claim can be opened and checked. Nothing is reported without evidence.
 */
export function leakageInsights(txns, range, { subscriptions = [], customCategories = {} } = {}) {
  const out = [];
  const list = txns.filter((t) => !t.excluded && inRange(t, range));
  const spend = list.filter((t) => t.direction === 'out' && t.type === 'expense');
  const prevList = txns.filter((t) => !t.excluded && inRange(t, range.previous) && t.direction === 'out' && t.type === 'expense');
  const now = categoryBreakdown(spend, customCategories);
  const before = new Map(categoryBreakdown(prevList, customCategories).map((c) => [c.id, c.total]));
  const prevLabel = range.id === 'this_month' ? 'the same days last month' : range.id === 'last_month' ? 'the month before' : 'the period before';

  for (const c of now) {
    const prev = before.get(c.id) ?? 0;
    if (prev > 0 && c.total - prev >= 100_000 && (c.total - prev) / prev >= 0.2) {
      out.push({
        id: `rise-${c.id}`,
        tone: 'warn',
        title: `${c.label} up ${pct((c.total - prev) / prev)}`,
        text: `You spent ${inr(c.total)} on ${c.label.toLowerCase()}, up from ${inr(prev)} in ${prevLabel}.`,
        ids: spend.filter((t) => t.category === c.id).map((t) => t.id),
        filter: { category: c.id },
      });
    }
  }

  const small = spend.filter((t) => t.amount < 30_000);
  const smallTotal = small.reduce((s, t) => s + t.amount, 0);
  if (small.length >= 8) {
    out.push({ id: 'small', tone: 'info', title: `${plural(small.length, 'small payment')} add up`, text: `You made ${plural(small.length, 'payment')} under ₹300, adding up to ${inr(smallTotal)}.`, ids: small.map((t) => t.id), filter: { maxAmount: 30_000 } });
  }

  if (now.length >= 2) {
    const total = now.reduce((s, c) => s + c.total, 0);
    out.push({ id: 'top', tone: 'info', title: `${now[0].label} leads your spending`, text: `${now[0].label} is ${pct(now[0].share)} of your expenses (${inr(now[0].total)}). ${now[1].label} is second at ${inr(now[1].total)}.`, ids: spend.filter((t) => t.category === now[0].id).map((t) => t.id), filter: { category: now[0].id }, total });
  }

  const active = subscriptions.filter((s) => s.status === 'active' && s.monthly);
  if (active.length) {
    const monthly = active.reduce((s, x) => s + x.monthly, 0);
    out.push({ id: 'recurring', tone: 'info', title: `Recurring payments: ${inr(monthly)} a month`, text: `${plural(active.length, 'active subscription')} cost ${inr(monthly)} a month, ${inr(monthly * 12)} a year.`, ids: active.flatMap((s) => s.paymentIds.slice(0, 1)), link: '/subscriptions' });
  }

  // Same payee, same amount, same day, not already merged: possibly paid twice.
  const seen = new Map();
  for (const t of spend) {
    const k = `${t.entityKey}|${t.amount}|${t.date}`;
    seen.set(k, [...(seen.get(k) ?? []), t]);
  }
  for (const group of seen.values()) {
    if (group.length < 2) continue;
    const t = group[0];
    out.push({ id: `dup-${t.id}`, tone: 'warn', title: 'Possible duplicate payment', text: `${inr(t.amount)} to ${t.counterparty} ${group.length} times on ${shortDate(t.date)}. Check whether you were charged twice.`, ids: group.map((x) => x.id) });
  }

  // A payment far above what you usually spend in that category.
  const history = txns.filter((t) => !t.excluded && t.direction === 'out' && t.type === 'expense');
  for (const t of spend) {
    const same = history.filter((x) => x.category === t.category && x.id !== t.id).map((x) => x.amount).sort((a, b) => a - b);
    if (same.length < 5) continue;
    const median = same[Math.floor(same.length / 2)];
    if (t.amount >= 200_000 && t.amount > median * 4) {
      out.push({ id: `spike-${t.id}`, tone: 'warn', title: 'Unusually large payment', text: `${inr(t.amount)} to ${t.counterparty} on ${shortDate(t.date)}, about ${Math.round(t.amount / median)}× your usual ${allCategories(customCategories).find((c) => c.id === t.category)?.label.toLowerCase() ?? 'spend'} payment.`, ids: [t.id] });
    }
  }
  return out.slice(0, 12);
}
