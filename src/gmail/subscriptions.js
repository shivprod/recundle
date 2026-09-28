/**
 * Turns parsed receipt events (from the recundle function's `receipts` action) into
 * subscriptions. Amounts are in paise; dates are local `YYYY-MM-DD` strings.
 *
 * A merchant counts as a subscription when its receipts say so (a billing
 * period, a renewal date or a free trial) or when it charges the same amount
 * at a regular interval. One-off orders are left out.
 */

const PERIOD_DAYS = { monthly: 30.44, quarterly: 91.31, 'half-yearly': 182.62, yearly: 365.25 };
const GRACE_DAYS = 7;
const DAY_MS = 86400000;

const STRIP_WORDS = /\b(inc|llc|ltd|pvt|private|limited|india|payments?|billing|team|no ?reply)\b/g;

function merchantKey(event) {
  const text = (event.merchantText || event.sender || '').toLowerCase();
  return text.replace(STRIP_WORDS, ' ').replace(/[^a-z0-9]+/g, ' ').trim() || event.sender;
}

function toDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

function toIso(date) {
  const p = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}`;
}

function daysBetween(a, b) {
  return Math.round((toDate(b) - toDate(a)) / DAY_MS);
}

function addDays(iso, days) {
  return toIso(new Date(toDate(iso).getTime() + Math.round(days) * DAY_MS));
}

function inferPeriod(payments) {
  if (payments.length < 2) return null;
  const [prev, last] = payments.slice(-2);
  if (!prev.amount || Math.abs(last.amount - prev.amount) / prev.amount > 0.1) return null;
  const gaps = payments.slice(1).map((p, i) => daysBetween(payments[i].date, p.date)).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)];
  if (median >= 25 && median <= 35) return 'monthly';
  if (median >= 80 && median <= 100) return 'quarterly';
  if (median >= 170 && median <= 200) return 'half-yearly';
  if (median >= 350 && median <= 380) return 'yearly';
  return null;
}

function displayName(name) {
  // Google Play products read "YouTube Premium (YouTube)"; drop the app suffix.
  const clean = String(name ?? '').replace(/\s*\([^)]*\)\s*$/, '').trim() || String(name ?? '');
  return clean === clean.toLowerCase() ? clean.charAt(0).toUpperCase() + clean.slice(1) : clean;
}

function describeInstrument(instrument) {
  if (!instrument) return null;
  if (instrument.type === 'store') return 'Google Play';
  if (instrument.type === 'card') return `Card •• ${instrument.last4}`;
  if (instrument.type === 'bank') return `Bank •• ${instrument.last4}`;
  if (instrument.type === 'upi') {
    const app = { gpay: 'Google Pay', phonepe: 'PhonePe', paytm: 'Paytm' }[instrument.app];
    return app ? `UPI · ${app}` : 'UPI';
  }
  return null;
}

export function deriveSubscriptions(events, today = new Date()) {
  const todayIso = toIso(today);
  const groups = new Map();
  for (const e of events ?? []) {
    const k = merchantKey(e);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(e);
  }

  const subscriptions = [];
  let lapsed = 0;

  for (const [id, group] of groups) {
    const sorted = [...group].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    const payments = sorted.filter((e) => e.type === 'payment');
    const latest = sorted[sorted.length - 1];
    const lastPayment = payments[payments.length - 1] ?? null;

    const explicitPeriod = [...sorted].reverse().find((e) => e.billingPeriod)?.billingPeriod ?? null;
    const period = explicitPeriod ?? inferPeriod(payments);
    const statedRenewal = [...sorted].reverse().find((e) => e.nextRenewal)?.nextRenewal ?? null;
    const isTrial = latest.type === 'trial_started' && latest.trialEnds && latest.trialEnds >= todayIso;
    const isFailed = latest.type === 'payment_failed' && daysBetween(latest.date, todayIso) <= 30;

    if (!period && !statedRenewal && !isTrial && !isFailed) continue;

    let nextRenewal = statedRenewal && statedRenewal >= todayIso ? statedRenewal : null;
    let estimated = false;
    if (!nextRenewal && lastPayment && period) {
      nextRenewal = addDays(lastPayment.date, PERIOD_DAYS[period]);
      estimated = true;
    }
    if (isTrial) nextRenewal = latest.trialEnds;

    if (!isTrial && !isFailed && (!nextRenewal || daysBetween(nextRenewal, todayIso) > GRACE_DAYS)) {
      lapsed += 1;
      continue;
    }

    const amount = lastPayment?.amount ?? latest.amount ?? null;
    const status = isTrial ? 'trial' : isFailed ? 'failed' : 'active';
    const monthly = period && amount != null ? Math.round((amount * PERIOD_DAYS.monthly) / PERIOD_DAYS[period]) : null;

    subscriptions.push({
      id,
      name: displayName(latest.merchantText || lastPayment?.merchantText || id),
      plan: [...sorted].reverse().find((e) => e.plan)?.plan ?? null,
      amount,
      period,
      monthly,
      nextRenewal,
      estimated,
      daysUntilRenewal: nextRenewal ? daysBetween(todayIso, nextRenewal) : null,
      status,
      paidWith: describeInstrument(lastPayment?.instrument ?? latest.instrument),
      lastPaid: lastPayment?.date ?? null,
      failedOn: isFailed ? latest.date : null,
    });
  }

  // Failed payments first (they need action), then by next renewal.
  subscriptions.sort((a, b) => {
    if ((a.status === 'failed') !== (b.status === 'failed')) return a.status === 'failed' ? -1 : 1;
    return (a.nextRenewal ?? '9999') < (b.nextRenewal ?? '9999') ? -1 : 1;
  });

  const paid = subscriptions.filter((s) => s.status !== 'trial');
  return {
    subscriptions,
    paidCount: paid.length,
    trialCount: subscriptions.length - paid.length,
    monthlyTotal: paid.reduce((sum, s) => sum + (s.monthly ?? 0), 0),
    renewingThisWeek: subscriptions.filter((s) => s.daysUntilRenewal != null && s.daysUntilRenewal >= 0 && s.daysUntilRenewal <= 7),
    lapsed,
  };
}

export function formatRupees(paise, { perMonth = false, whole = false } = {}) {
  if (paise == null) return '—';
  const rupees = whole ? Math.round(paise / 100) : paise / 100;
  const text = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: Number.isInteger(rupees) ? 0 : 2,
  }).format(rupees);
  return perMonth ? `${text}/month` : text;
}

export const PERIOD_LABEL = { monthly: 'month', quarterly: 'quarter', 'half-yearly': '6 months', yearly: 'year' };
