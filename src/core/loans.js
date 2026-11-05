import { entityKey, similarity } from './entities.js';
import { addMonths, daysBetween, monthKey, monthsBetweenKeys, uid } from './format.js';
import { live } from './store.js';

/**
 * Loans are built from three kinds of evidence, and every figure says which it is:
 *  - verified:  stated in a lender email (statement, EMI receipt, sanction letter, NOC)
 *  - yours:     entered by you
 *  - estimated: calculated by Recundle from the other figures (always labelled, never shown as official)
 *  - missing:   not available; the app asks for it instead of guessing
 * A loan is never marked closed automatically. A matched NOC or closure email is shown for you to
 * review, and only your confirmation closes the loan.
 */

export const LOAN_STATUSES = {
  needs_verification: { label: 'Needs verification', tone: 'warn' },
  active: { label: 'Active', tone: 'info' },
  closure_pending: { label: 'Closure pending', tone: 'warn' },
  noc_received: { label: 'NOC received', tone: 'good' },
  noc_not_found: { label: 'NOC not found', tone: 'warn' },
  closed: { label: 'Closed', tone: 'muted' },
};

export const LOAN_TYPES = ['Personal loan', 'Home loan', 'Vehicle loan', 'Education loan', 'Gold loan', 'Consumer durable loan', 'Pay Later', 'Other loan'];

const lenderKey = (name) => entityKey(name).replace(/\b(bank|finance|financial|finserv|capital|fincorp|credit)\b/g, '').trim() || entityKey(name);
export const loanKey = (lender, account) => `${lenderKey(lender)}|${account ?? ''}`;

const field = (value, source, asOf = null, ref = null) => (value == null ? { value: null, source: 'missing' } : { value, source, asOf, ref });

/** Monthly EMI for principal P at annual rate r% over n months. */
export function emiFor(P, ratePct, n) {
  const i = ratePct / 1200;
  if (!i) return Math.round(P / n);
  return Math.round((P * i * (1 + i) ** n) / ((1 + i) ** n - 1));
}

/** Months to repay balance B with EMI E at annual rate r%. null if the EMI doesn't cover interest. */
export function monthsToRepay(B, ratePct, E) {
  if (B <= 0) return 0;
  const i = ratePct / 1200;
  if (!i) return Math.ceil(B / E);
  if (E <= B * i) return null;
  // Rounding the EMI to the paisa can leave a sliver of a payment; ignore anything under 1% of one.
  return Math.ceil(-Math.log(1 - (B * i) / E) / Math.log(1 + i) - 0.01);
}

/** Balance after k payments of E on principal P at rate r%. */
export function balanceAfter(P, ratePct, E, k) {
  const i = ratePct / 1200;
  let b = P;
  for (let m = 0; m < k && b > 0; m++) b = b * (1 + i) - E;
  // Paise left over from EMI rounding are not a balance.
  return b < 100 ? 0 : Math.round(b);
}

/** Annual rate (%) that makes `n` payments of E repay P (bisection). */
export function impliedRate(P, E, n) {
  if (E * n <= P) return null;
  let lo = 0;
  let hi = 60;
  for (let k = 0; k < 60; k++) {
    const mid = (lo + hi) / 2;
    if (emiFor(P, mid, n) > E) hi = mid;
    else lo = mid;
  }
  return Math.round(((lo + hi) / 2) * 100) / 100;
}

/** Groups loan emails into loans: by lender + account, or lender alone when it has one account. */
function groupEvents(events) {
  const groups = new Map();
  const sorted = [...events].sort((a, b) => a.date.localeCompare(b.date));
  for (const e of sorted.filter((x) => x.account)) {
    const k = loanKey(e.lender, e.account);
    groups.set(k, [...(groups.get(k) ?? []), e]);
  }
  const orphans = [];
  for (const e of sorted.filter((x) => !x.account)) {
    const same = [...groups.keys()].filter((k) => k.split('|')[0] === lenderKey(e.lender));
    if (same.length === 1) groups.get(same[0]).push({ ...e, matchedBy: 'lender' });
    else if (same.length === 0) {
      const k = loanKey(e.lender, null);
      groups.set(k, [...(groups.get(k) ?? []), e]);
    } else orphans.push(e);
  }
  return { groups, orphans };
}

const latest = (events, pick) => [...events].reverse().find((e) => pick(e) != null);

/**
 * All loans: the user's records merged with what the emails say. Discovered loans without a user
 * record are returned too (status "Needs verification") so they can be confirmed or dismissed.
 */
export function deriveLoans(store, txns, today) {
  const events = live(store.loanEvents).filter((e) => !e.dismissed);
  const { groups, orphans } = groupEvents(events);
  const records = live(store.loans);
  const claimed = new Set(records.flatMap((r) => r.eventKeys ?? []));
  const loans = [];

  const build = (record, evs) => {
    const ev = [...evs].sort((a, b) => a.date.localeCompare(b.date));
    const u = record?.user ?? {};
    const lender = u.lender ?? record?.lender ?? ev[ev.length - 1]?.lender ?? 'Unknown lender';
    const account = u.account ?? record?.account ?? ev.find((e) => e.account)?.account ?? null;
    const sanction = latest(ev, (e) => (e.purpose === 'sanction' || e.purpose === 'disbursal' ? e.principal ?? e.amount : null));
    const emiEv = latest(ev, (e) => e.emi);
    const outEv = latest(ev, (e) => e.outstanding);
    const rateEv = latest(ev, (e) => e.rate);
    const tenureEv = latest(ev, (e) => e.tenureMonths);
    const disbursedEv = latest(ev, (e) => e.disbursedOn);
    const fcEv = latest(ev, (e) => (e.purpose === 'foreclosure_quote' ? e.foreclosureAmount ?? e.amount : null));
    const dueEv = latest(ev, (e) => (e.dueDate && e.dueDate >= today ? e.dueDate : null));
    const noc = latest(ev, (e) => (e.purpose === 'noc' ? e : null));
    const closure = latest(ev, (e) => (e.purpose === 'closure' ? e : null));

    const principal = u.principal != null ? field(u.principal, 'user') : sanction ? field(sanction.principal ?? sanction.amount, 'verified', sanction.date, sanction.messageId) : field(null);
    const emi = u.emi != null ? field(u.emi, 'user') : emiEv ? field(emiEv.emi, 'verified', emiEv.date, emiEv.messageId) : field(null);
    const rate = u.rate != null ? field(u.rate, 'user') : rateEv ? field(rateEv.rate, 'verified', rateEv.date, rateEv.messageId) : field(null);
    const tenure = u.tenureMonths != null ? field(u.tenureMonths, 'user') : tenureEv ? field(tenureEv.tenureMonths, 'verified', tenureEv.date, tenureEv.messageId) : field(null);
    const disbursedOn = u.disbursedOn ? field(u.disbursedOn, 'user') : disbursedEv ? field(disbursedEv.disbursedOn, 'verified', disbursedEv.date, disbursedEv.messageId) : field(null);

    // Payments: transactions linked by you, or EMI payments to this lender.
    const key = loanKey(lender, account);
    const payments = txns.filter((t) => !t.excluded && t.direction === 'out' && (t.loanId ? t.loanId === record?.id : t.category === 'emi' && t.loanHint && lenderKey(t.loanHint.lender) === lenderKey(lender) && (!t.loanHint.account || !account || t.loanHint.account === account)));
    const lastPayment = payments[0] ?? null;

    // Outstanding: yours > lender-stated > estimated from the figures we have.
    let outstanding;
    const userOut = u.outstanding != null ? field(u.outstanding, 'user', u.outstandingAsOf ?? record?.updatedAt?.slice(0, 10)) : null;
    const stated = outEv ? field(outEv.outstanding, 'verified', outEv.date, outEv.messageId) : null;
    const base = [userOut, stated].filter(Boolean).sort((a, b) => (a.asOf ?? '').localeCompare(b.asOf ?? '')).pop();
    if (base) {
      outstanding = base;
      // Roll a stated balance forward by the EMIs paid since, when we know the rate.
      if (rate.value != null && emi.value && base.asOf) {
        const k = Math.max(0, monthsBetweenKeys(monthKey(base.asOf), monthKey(today)) - (daysBetween(base.asOf, today) < 28 ? 1 : 0));
        if (k > 0) outstanding = { value: balanceAfter(base.value, rate.value, emi.value, k), source: 'estimated', asOf: today, from: base, note: `${base.source === 'user' ? 'Your' : 'Lender-stated'} balance of ${base.asOf} less ${k} EMI${k === 1 ? '' : 's'} since` };
      }
    } else if (principal.value && emi.value && rate.value != null && disbursedOn.value) {
      const k = Math.max(0, monthsBetweenKeys(monthKey(disbursedOn.value), monthKey(today)));
      outstanding = { value: balanceAfter(principal.value, rate.value, emi.value, k), source: 'estimated', asOf: today, note: `Amortised from the loan amount, rate and ${k} EMIs since disbursal` };
    } else outstanding = field(null);

    // Rate missing but tenure known: the implied rate makes estimates possible (labelled).
    let effRate = rate;
    if (rate.value == null && principal.value && emi.value && tenure.value) {
      const r = impliedRate(principal.value, emi.value, tenure.value);
      if (r != null) effRate = { value: r, source: 'estimated', note: 'Implied by the loan amount, EMI and tenure' };
    }

    let remainingEmis = field(null);
    if (outstanding.value != null && emi.value && effRate.value != null) {
      const n = monthsToRepay(outstanding.value, effRate.value, emi.value);
      if (n != null) remainingEmis = { value: n, source: 'estimated' };
    } else if (tenure.value && disbursedOn.value) {
      remainingEmis = { value: Math.max(0, tenure.value - monthsBetweenKeys(monthKey(disbursedOn.value), monthKey(today))), source: 'estimated', note: 'Tenure less months since disbursal' };
    }
    const remainingTotal = remainingEmis.value != null && emi.value ? remainingEmis.value * emi.value : null;
    const remainingInterest = remainingTotal != null && outstanding.value != null ? Math.max(0, remainingTotal - outstanding.value) : null;
    const nextEmi = dueEv ? field(dueEv.dueDate, 'verified', dueEv.date, dueEv.messageId) : lastPayment && emi.value ? (() => {
      let d = addMonths(lastPayment.date, 1);
      while (d < today) d = addMonths(d, 1);
      return { value: d, source: 'estimated', note: 'A month after the last EMI payment' };
    })() : field(null);
    const foreclosure = fcEv ? field(fcEv.foreclosureAmount ?? fcEv.amount, 'verified', fcEv.date, fcEv.messageId) : outstanding.value != null && u.foreclosurePct != null ? { value: Math.round(outstanding.value * (1 + u.foreclosurePct / 100)), source: 'estimated', note: `Outstanding plus your ${u.foreclosurePct}% foreclosure charge` } : field(null);

    // Status: yours first; otherwise what the evidence supports.
    let status = record?.status ?? 'needs_verification';
    const nocMatch = noc ? { messageId: noc.messageId, date: noc.closureDate ?? noc.date, subject: noc.subject, confirmsFull: noc.confirmsFullRepayment ?? true, matchedBy: noc.matchedBy ?? 'account', attachment: noc.hasAttachment } : null;
    if (!record?.statusSetByUser) {
      if (nocMatch) status = 'noc_received';
      else if (closure) status = 'closure_pending';
    }
    const flags = [];
    if (nocMatch && status !== 'closed') flags.push({ kind: 'noc', text: 'NOC found. Review it and confirm to close this loan.' });
    if (!nocMatch && (status === 'closed' || closure)) flags.push({ kind: 'no_noc', text: 'NOC not identified. Loan closure status requires verification.' });
    if (nocMatch?.matchedBy === 'lender') flags.push({ kind: 'weak_match', text: 'The NOC was matched by lender only. Check the account number on it.' });
    const missing = [['outstanding', outstanding], ['emi', emi], ['rate', effRate], ['principal', principal]].filter(([, f]) => f.value == null).map(([k]) => k);

    const repaid = payments.reduce((s, p) => s + p.amount, 0);
    return {
      id: record?.id ?? `found:${key}`,
      discovered: !record,
      key,
      lender,
      account,
      loanType: u.loanType ?? record?.loanType ?? ev.find((e) => e.loanType)?.loanType ?? 'Other loan',
      status,
      statusSetByUser: Boolean(record?.statusSetByUser),
      principal,
      emi,
      rate: effRate,
      tenure,
      disbursedOn,
      outstanding,
      remainingEmis,
      remainingTotal,
      remainingInterest,
      completion: remainingEmis.value != null ? addMonths(today, remainingEmis.value) : null,
      nextEmi,
      foreclosure,
      foreclosurePct: u.foreclosurePct ?? null,
      noc: nocMatch,
      closure: closure ? { messageId: closure.messageId, date: closure.closureDate ?? closure.date, subject: closure.subject } : null,
      closedOn: record?.closedOn ?? null,
      flags,
      missing,
      events: [...ev].reverse(),
      payments,
      repaid,
      progress: principal.value && outstanding.value != null ? Math.min(1, Math.max(0, 1 - outstanding.value / principal.value)) : null,
      notes: u.notes ?? '',
      eventKeys: ev.map((e) => e.messageId),
    };
  };

  for (const r of records) {
    const key = loanKey(r.user?.lender ?? r.lender, r.user?.account ?? r.account);
    const evs = events.filter((e) => (r.eventKeys ?? []).includes(e.messageId));
    // Also adopt new emails for the same lender + account that arrived after the loan was confirmed.
    const more = (groups.get(key) ?? []).filter((e) => !claimed.has(e.messageId));
    loans.push(build(r, [...evs, ...more]));
    for (const e of more) claimed.add(e.messageId);
  }
  for (const [, evs] of groups) {
    const fresh = evs.filter((e) => !claimed.has(e.messageId));
    if (!fresh.length) continue;
    // A lone NOC/closure for a lender with no other emails is still worth showing (it may close a loan you add).
    loans.push(build(null, fresh));
  }
  return { loans: loans.sort((a, b) => (a.status === 'closed') - (b.status === 'closed') || (b.outstanding.value ?? 0) - (a.outstanding.value ?? 0)), unmatched: orphans };
}

export function loanTotals(loans) {
  const active = loans.filter((l) => !['closed'].includes(l.status) && l.status !== 'noc_received');
  const withOut = active.filter((l) => l.outstanding.value != null);
  const withEmi = active.filter((l) => l.emi.value);
  return {
    active: active.length,
    outstanding: withOut.reduce((s, l) => s + l.outstanding.value, 0),
    outstandingKnownFor: withOut.length,
    outstandingEstimated: withOut.some((l) => l.outstanding.source === 'estimated'),
    emi: withEmi.reduce((s, l) => s + l.emi.value, 0),
    emiKnownFor: withEmi.length,
    longest: Math.max(0, ...active.map((l) => l.remainingEmis.value ?? 0)),
    verify: loans.filter((l) => l.status === 'needs_verification' || l.discovered).length,
    closable: loans.filter((l) => l.status === 'noc_received' || l.status === 'closure_pending').length,
  };
}

/** Creates or updates the user's record for a loan (confirming a discovered loan creates one). */
export function loanRecordFrom(loan, patch = {}) {
  return {
    id: loan.discovered ? uid('loan') : loan.id,
    lender: loan.lender,
    account: loan.account,
    loanType: loan.loanType,
    eventKeys: loan.eventKeys,
    status: loan.status === 'needs_verification' ? 'active' : loan.status,
    ...patch,
  };
}

/**
 * Month-by-month payoff of several loans. Each month every loan gets its EMI; `extraMonthly` (plus
 * the EMIs of loans already closed, when `rollover`) goes to the first open loan in `order`;
 * `lumpSum` is paid toward the order at month 0. Foreclosure charges (when you entered them) are added
 * to any prepayment. Returns the timeline and totals.
 */
export function simulate(loans, { order, extraMonthly = 0, lumpSum = 0, rollover = true, maxMonths = 600 } = {}) {
  const state = loans.map((l) => ({ id: l.id, name: l.lender, balance: l.balance, rate: l.rate / 1200, emi: l.emi, fee: (l.foreclosurePct ?? 0) / 100, closedAt: l.balance <= 0 ? 0 : null, interest: 0, fees: 0 }));
  const seq = (order ?? state.map((s) => s.id)).map((id) => state.find((s) => s.id === id)).filter(Boolean);
  const prepay = (amount) => {
    let left = amount;
    for (const s of seq) {
      if (left <= 0) break;
      if (s.balance <= 0) continue;
      // Money toward a loan pays its charge first: paying `x` clears x / (1 + fee) of principal.
      const principal = Math.min(s.balance, left / (1 + s.fee));
      s.balance -= principal;
      s.fees += principal * s.fee;
      left -= principal * (1 + s.fee);
    }
    return left;
  };
  prepay(lumpSum);
  for (const s of state) if (s.balance <= 0.5 && s.closedAt == null) s.closedAt = 0;
  let month = 0;
  const timeline = [];
  while (state.some((s) => s.balance > 0.5) && month < maxMonths) {
    month += 1;
    let freed = 0;
    for (const s of state) {
      if (s.balance <= 0.5) {
        if (rollover) freed += s.emi;
        continue;
      }
      const interest = s.balance * s.rate;
      s.interest += interest;
      const pay = Math.min(s.emi, s.balance + interest);
      s.balance = s.balance + interest - pay;
      if (s.emi <= interest && s.balance > 0) s.stuck = true;
    }
    prepay(extraMonthly + freed);
    for (const s of state) if (s.balance <= 0.5 && s.closedAt == null) s.closedAt = month;
    timeline.push({ month, balance: Math.round(state.reduce((a, s) => a + Math.max(0, s.balance), 0)) });
  }
  return {
    months: month,
    interest: Math.round(state.reduce((a, s) => a + s.interest, 0)),
    fees: Math.round(state.reduce((a, s) => a + s.fees, 0)),
    closures: state.map((s) => ({ id: s.id, name: s.name, month: s.closedAt, emi: s.emi })).sort((a, b) => (a.month ?? 1e9) - (b.month ?? 1e9)),
    timeline,
    incomplete: month >= maxMonths || state.some((s) => s.stuck),
  };
}

/**
 * Compares paying off the highest-rate loan first (avalanche) with the smallest balance first
 * (snowball) for the same extra money, against just paying EMIs. Only loans with a known balance,
 * EMI and rate are included; the rest are listed as excluded with the reason.
 */
export function repaymentPlan(loans, { extraMonthly = 0, lumpSum = 0, today }) {
  const open = loans.filter((l) => l.status !== 'closed' && l.status !== 'noc_received');
  const included = [];
  const excluded = [];
  for (const l of open) {
    const need = [l.outstanding.value == null && 'outstanding balance', !l.emi.value && 'EMI', l.rate.value == null && 'interest rate'].filter(Boolean);
    if (need.length) excluded.push({ id: l.id, lender: l.lender, missing: need });
    else included.push({ id: l.id, lender: l.lender, balance: l.outstanding.value, emi: l.emi.value, rate: l.rate.value, foreclosurePct: l.foreclosurePct, estimated: l.outstanding.source === 'estimated' || l.rate.source === 'estimated' });
  }
  if (!included.length) return { included, excluded, baseline: null, strategies: [] };
  const baseline = simulate(included, { extraMonthly: 0, lumpSum: 0, rollover: false });
  const strategies = [
    { id: 'avalanche', title: 'Highest interest first', order: [...included].sort((a, b) => b.rate - a.rate || a.balance - b.balance).map((l) => l.id) },
    { id: 'snowball', title: 'Smallest balance first', order: [...included].sort((a, b) => a.balance - b.balance || b.rate - a.rate).map((l) => l.id) },
  ].map((s) => {
    const r = simulate(included, { order: s.order, extraMonthly, lumpSum, rollover: true });
    const first = included.find((l) => l.id === s.order[0]);
    const firstClose = r.closures.find((c) => c.id === first.id);
    return {
      ...s,
      ...r,
      interestSaved: baseline.interest - r.interest - r.fees,
      monthsSaved: baseline.months - r.months,
      debtFree: addMonths(today, r.months),
      first: { ...first, closesInMonth: firstClose?.month ?? null, closesOn: firstClose?.month != null ? addMonths(today, firstClose.month) : null, amountToClose: Math.round(first.balance * (1 + (first.foreclosurePct ?? 0) / 100)) },
    };
  });
  const [avalanche, snowball] = strategies;
  const diff = avalanche.interestSaved - snowball.interestSaved;
  // Avalanche saves the most interest; snowball frees an EMI sooner. Prefer avalanche unless the gap is small.
  const recommended = diff > Math.max(200_000, 0.05 * Math.abs(avalanche.interestSaved)) || avalanche.order[0] === snowball.order[0] ? 'avalanche' : (snowball.first.closesInMonth ?? 1e9) < (avalanche.first.closesInMonth ?? 1e9) ? 'snowball' : 'avalanche';
  return { included, excluded, baseline: { ...baseline, debtFree: addMonths(today, baseline.months) }, strategies, recommended, interestGap: diff };
}

/** Suggests which loan a NOC/closure email belongs to: same lender, then the account number. */
export function nocCandidates(event, loans) {
  return loans
    .map((l) => {
      const lenderScore = similarity(lenderKey(l.lender), lenderKey(event.lender));
      const accountMatch = event.account && l.account ? event.account === l.account : null;
      return { loan: l, score: lenderScore + (accountMatch === true ? 1 : accountMatch === false ? -1 : 0), accountMatch };
    })
    .filter((c) => c.score >= 0.5)
    .sort((a, b) => b.score - a.score);
}
