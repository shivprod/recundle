import { entityKey } from './entities.js';
import { addDays, addMonths, daysBetween } from './format.js';
import { live } from './store.js';

/**
 * Subscriptions come from evidence, never assumption:
 *  - receipts that say they're for a subscription (with a billing period or renewal date),
 *  - subscription emails without a payment (trial started, payment failed, cancelled, renewal reminder),
 *  - payments to the same payee on a regular schedule (3+ times, similar amount) — these start as
 *    "Needs verification" until the user confirms,
 *  - payments the user linked to a subscription themselves.
 * A single receipt doesn't make a subscription "Active": it needs a stated renewal date or a
 * repeat payment on schedule. The user can override the status at any time; history is kept.
 */

export const STATUSES = {
  active: { label: 'Active', tone: 'good' },
  trial: { label: 'Trial', tone: 'info' },
  failed: { label: 'Payment failed', tone: 'bad' },
  needs_verification: { label: 'Needs verification', tone: 'warn' },
  inactive: { label: 'Inactive', tone: 'muted' },
  cancelled: { label: 'Cancelled', tone: 'muted' },
};

export const PERIOD_DAYS = { weekly: 7, monthly: 30.44, quarterly: 91.31, 'half-yearly': 182.62, yearly: 365.25 };
export const PERIOD_LABEL = { weekly: 'week', monthly: 'month', quarterly: 'quarter', 'half-yearly': '6 months', yearly: 'year' };

/** Services that overlap: paying for several in one group is worth a look. */
export const OVERLAP_GROUPS = [
  ['video streaming', /netflix|prime|hotstar|jiocinema|sonyliv|zee5|youtube/i],
  ['music streaming', /spotify|youtube music|apple music|gaana|wynk/i],
  ['AI assistants', /chatgpt|openai|claude|anthropic|perplexity|gemini/i],
  ['cloud storage', /google one|icloud|dropbox|onedrive/i],
];

function inferPeriod(dates) {
  if (dates.length < 2) return null;
  const gaps = dates.slice(1).map((d, i) => daysBetween(dates[i], d)).sort((a, b) => a - b);
  const g = gaps[Math.floor(gaps.length / 2)];
  if (g >= 6 && g <= 8) return 'weekly';
  if (g >= 26 && g <= 35) return 'monthly';
  if (g >= 85 && g <= 98) return 'quarterly';
  if (g >= 175 && g <= 190) return 'half-yearly';
  if (g >= 350 && g <= 380) return 'yearly';
  return null;
}

const nextOf = (iso, period) => (period === 'weekly' ? addDays(iso, 7) : addMonths(iso, { monthly: 1, quarterly: 3, 'half-yearly': 6, yearly: 12 }[period] ?? 1));

/** Same payee paid 3+ times, at a regular interval, with amounts within 15% of each other. */
function looksRecurring(payments) {
  if (payments.length < 3) return false;
  const dates = payments.map((p) => p.date).sort();
  if (!inferPeriod(dates)) return false;
  const amounts = payments.map((p) => p.amount);
  const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
  return amounts.every((a) => Math.abs(a - avg) / avg <= 0.15);
}

export function deriveSubscriptions(store, txns, today) {
  const overrides = store.subscriptions ?? {};
  const groups = new Map();
  const group = (key, name) => {
    if (!groups.has(key)) groups.set(key, { key, name, payments: [], events: [], explicit: false, linked: false });
    return groups.get(key);
  };

  for (const t of txns) {
    if (t.excluded || t.direction !== 'out') continue;
    if (t.subscriptionKey === '') continue; // the user said "not a subscription payment"
    if (t.subscriptionKey) {
      const g = group(entityKey(t.subscriptionKey), t.subscriptionKey);
      g.payments.push(t);
      g.linked = true;
    } else if (t.subscription?.isSubscription) {
      const g = group(entityKey(t.subscription.service ?? t.counterparty), t.subscription.service ?? t.counterparty);
      g.payments.push(t);
      g.explicit = true;
      g.events.push({ ...t.subscription, date: t.date, messageId: t.sources[0]?.messageId, status: 'payment', amount: t.amount });
    }
  }
  for (const e of live(store.subEvents)) {
    if (!e.isSubscription) continue;
    const g = group(entityKey(e.service), e.service);
    g.events.push(e);
    g.explicit = true;
  }
  // Pattern-only candidates: regular payments to a payee that no receipt has labelled.
  const claimed = new Set([...groups.values()].flatMap((g) => g.payments.map((p) => p.id)));
  const byPayee = new Map();
  for (const t of txns) {
    if (t.excluded || t.direction !== 'out' || t.type !== 'expense' || claimed.has(t.id) || t.subscriptionKey === '') continue;
    if (['emi', 'rent', 'personal_transfers', 'groceries', 'food', 'transport', 'cash', 'fees', 'shopping'].includes(t.category)) continue;
    byPayee.set(t.entityKey, [...(byPayee.get(t.entityKey) ?? []), t]);
  }
  for (const [key, payments] of byPayee) {
    if (!looksRecurring(payments) || groups.has(key)) continue;
    const g = group(key, payments[0].counterparty);
    g.payments.push(...payments);
    g.pattern = true;
  }

  // Subscriptions the user added by hand (paid in cash, or before Gmail history starts).
  for (const o of Object.values(overrides)) {
    if (o.manual && !o.deleted && !groups.has(o.id)) groups.set(o.id, { key: o.id, name: o.name, payments: [], events: [], manual: true });
  }

  const out = [];
  for (const g of groups.values()) {
    const o = overrides[g.key] ?? {};
    if (o.notSubscription || o.deleted) continue;
    const payments = [...g.payments].sort((a, b) => a.date.localeCompare(b.date));
    const events = [...g.events].sort((a, b) => a.date.localeCompare(b.date));
    const last = payments[payments.length - 1] ?? null;
    const statedPeriod = [...events].reverse().find((e) => e.period)?.period ?? null;
    const period = o.period ?? statedPeriod ?? inferPeriod(payments.map((p) => p.date));
    const amount = o.amount ?? last?.amount ?? [...events].reverse().find((e) => e.amount)?.amount ?? null;
    const monthly = period && amount != null ? Math.round((amount * PERIOD_DAYS.monthly) / PERIOD_DAYS[period]) : null;
    const latest = events[events.length - 1] ?? null;
    const statedRenewal = [...events].reverse().find((e) => e.nextRenewal)?.nextRenewal ?? null;
    const trialEnds = [...events].reverse().find((e) => e.trialEnds)?.trialEnds ?? null;

    let status;
    let statusReason;
    const lastEventIsAfterPayment = latest && (!last || latest.date >= last.date);
    if (lastEventIsAfterPayment && latest.status === 'cancelled') [status, statusReason] = ['cancelled', 'A cancellation email was found'];
    else if (lastEventIsAfterPayment && latest.status === 'failed' && daysBetween(latest.date, today) <= 45) [status, statusReason] = ['failed', 'A failed-payment email was found'];
    else if (trialEnds && trialEnds >= today && (!last || last.date < (latest?.date ?? ''))) [status, statusReason] = ['trial', 'A free-trial email was found'];
    else if (last && period && daysBetween(last.date, today) > PERIOD_DAYS[period] * 1.5) [status, statusReason] = ['inactive', 'No payment since the last renewal was due'];
    else if (g.pattern) [status, statusReason] = ['needs_verification', 'Found from a regular payment pattern; confirm it is a subscription'];
    else if ((statedRenewal && statedRenewal >= today) || (period && payments.length >= 2) || (g.linked && period)) [status, statusReason] = ['active', statedRenewal ? 'The latest receipt states the next renewal' : 'Paid on schedule'];
    else if (g.manual) [status, statusReason] = ['active', 'Added by you'];
    else [status, statusReason] = ['needs_verification', 'One receipt found; no renewal date or repeat payment yet'];
    const autoStatus = status;
    if (o.status) [status, statusReason] = [o.status, 'Set by you'];

    let nextRenewal = null;
    let nextRenewalSource = null;
    if (status === 'active' || status === 'trial' || status === 'failed') {
      if (o.nextRenewal && o.nextRenewal >= today) [nextRenewal, nextRenewalSource] = [o.nextRenewal, 'user'];
      else if (status === 'trial' && trialEnds) [nextRenewal, nextRenewalSource] = [trialEnds, 'stated'];
      else if (statedRenewal && statedRenewal >= today) [nextRenewal, nextRenewalSource] = [statedRenewal, 'stated'];
      else if (last && period) {
        let n = nextOf(last.date, period);
        while (n < today) n = nextOf(n, period);
        [nextRenewal, nextRenewalSource] = [n, 'estimated'];
      }
    }
    const priceChanges = [];
    for (let i = 1; i < payments.length; i++) {
      if (payments[i].amount !== payments[i - 1].amount) priceChanges.push({ date: payments[i].date, from: payments[i - 1].amount, to: payments[i].amount });
    }
    out.push({
      key: g.key,
      name: o.name ?? g.name,
      status,
      autoStatus,
      statusReason,
      period,
      periodSource: o.period ? 'user' : statedPeriod ? 'stated' : period ? 'inferred' : null,
      amount,
      monthly,
      yearly: monthly != null ? monthly * 12 : null,
      firstPaid: payments[0]?.date ?? null,
      lastPaid: last?.date ?? null,
      paymentSource: last?.method ?? [...events].reverse().find((e) => e.method)?.method ?? null,
      plan: [...events].reverse().find((e) => e.plan)?.plan ?? null,
      nextRenewal,
      nextRenewalSource,
      paymentIds: payments.map((p) => p.id).reverse(),
      payments: [...payments].reverse(),
      events: [...events].reverse(),
      priceChanges,
      totalPaid: payments.reduce((s, p) => s + p.amount, 0),
      discovered: payments[0]?.date ?? events[0]?.date ?? null,
      fromPattern: Boolean(g.pattern),
      manual: Boolean(g.manual),
      notes: o.notes ?? '',
      overlapGroup: OVERLAP_GROUPS.find(([, re]) => re.test(o.name ?? g.name))?.[0] ?? null,
    });
  }
  const rank = { failed: 0, needs_verification: 1, trial: 2, active: 3, inactive: 4, cancelled: 5 };
  return out.sort((a, b) => rank[a.status] - rank[b.status] || (b.monthly ?? 0) - (a.monthly ?? 0));
}

/** Totals counted only over subscriptions that are active (a trial or an inactive one isn't a commitment yet). */
export function subscriptionTotals(subs, today) {
  const active = subs.filter((s) => s.status === 'active');
  const monthly = active.reduce((s, x) => s + (x.monthly ?? 0), 0);
  const in30 = addDays(today, 30);
  return {
    active: active.length,
    monthly,
    yearly: monthly * 12,
    inactive: subs.filter((s) => s.status === 'inactive' || s.status === 'cancelled').length,
    verify: subs.filter((s) => s.status === 'needs_verification').length,
    failed: subs.filter((s) => s.status === 'failed').length,
    upcoming: subs.filter((s) => s.nextRenewal && s.nextRenewal <= in30 && s.status !== 'cancelled' && s.status !== 'inactive').sort((a, b) => a.nextRenewal.localeCompare(b.nextRenewal)),
    recent: subs.filter((s) => s.discovered && daysBetween(s.discovered, today) <= 45),
    unknownCost: active.filter((s) => s.monthly == null).length,
  };
}

export function subscriptionInsights(subs) {
  const out = [];
  const active = subs.filter((s) => s.status === 'active' && s.monthly);
  const top = [...active].sort((a, b) => b.monthly - a.monthly)[0];
  if (top) out.push({ id: 'top', key: top.key, kind: 'top', subject: top.name, value: top.monthly });
  for (const s of subs) {
    const change = s.priceChanges[s.priceChanges.length - 1];
    if (change && change.to > change.from && s.status !== 'cancelled') out.push({ id: `price-${s.key}`, key: s.key, kind: 'price', subject: s.name, from: change.from, to: change.to, date: change.date });
  }
  const groups = new Map();
  for (const s of subs.filter((x) => (x.status === 'active' || x.status === 'trial') && x.overlapGroup)) groups.set(s.overlapGroup, [...(groups.get(s.overlapGroup) ?? []), s]);
  for (const [name, list] of groups) if (list.length >= 2) out.push({ id: `overlap-${name}`, kind: 'overlap', group: name, names: list.map((s) => s.name), monthly: list.reduce((a, s) => a + (s.monthly ?? 0), 0) });
  return out;
}
