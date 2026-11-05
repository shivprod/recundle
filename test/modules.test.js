import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editTransaction, emptyStore, ingestEvents, putRecord } from '../src/core/store.js';
import { buildTransactions } from '../src/core/transactions.js';
import { deriveSubscriptions, subscriptionTotals } from '../src/core/subscriptions.js';
import { balanceAfter, deriveLoans, emiFor, monthsToRepay, repaymentPlan, simulate, loanRecordFrom } from '../src/core/loans.js';

// All data here is made up.
const TODAY = '2026-10-20';
const row = (id, date, amount) => ({ kind: 'txn', source: 'phonepe', rowId: `pp:${id}`, date, direction: 'out', amount, counterparty: 'Netflix Com', method: 'UPI' });
const linked = (events) => {
  let s = ingestEvents(emptyStore(), events, 'statement');
  for (const e of events) s = editTransaction(s, e.rowId, { subscription: 'Netflix' });
  return s;
};

test('payments you link to a subscription: active once paid on schedule, with price changes', () => {
  let s = linked([row('n1', '2026-10-02', 649_00)]);
  let [sub] = deriveSubscriptions(s, buildTransactions(s), TODAY);
  assert.equal(sub.name, 'Netflix');
  s = linked([row('n0', '2026-09-02', 499_00), row('n1', '2026-10-02', 649_00)]);
  [sub] = deriveSubscriptions(s, buildTransactions(s), TODAY);
  assert.equal(sub.status, 'active');
  assert.equal(sub.monthly, 649_00);
  assert.equal(sub.nextRenewalSource, 'estimated');
  assert.equal(sub.nextRenewal, '2026-11-02');
  assert.deepEqual(sub.priceChanges.map((c) => [c.from, c.to]), [[499_00, 649_00]]);
});

test('a subscription you mark cancelled keeps its history but is not counted', () => {
  let s = linked([row('n0', '2026-09-02', 649_00), row('n1', '2026-10-02', 649_00)]);
  s = putRecord(s, 'subscriptions', { id: 'netflix', status: 'cancelled' });
  const [sub] = deriveSubscriptions(s, buildTransactions(s), TODAY);
  assert.equal(sub.status, 'cancelled');
  assert.equal(sub.payments.length, 2);
  assert.equal(subscriptionTotals([sub], TODAY).monthly, 0);
});

test('regular payments to the same payee are a candidate, not a confirmed subscription', () => {
  const pay = (id, date) => ({ kind: 'txn', source: 'phonepe', rowId: `pp:${id}`, messageId: 'stmt', date, direction: 'out', amount: 299_00, counterparty: 'Gym Studio Pvt Ltd', method: 'Card' });
  const s = ingestEvents(emptyStore(), [pay('g1', '2026-07-05'), pay('g2', '2026-08-05'), pay('g3', '2026-09-05'), pay('g4', '2026-10-05')]);
  const [sub] = deriveSubscriptions(s, buildTransactions(s), TODAY);
  assert.equal(sub.status, 'needs_verification');
  assert.equal(sub.fromPattern, true);
  assert.equal(sub.period, 'monthly');
});

test('amortisation maths', () => {
  const emi = emiFor(500000_00, 12, 36);
  assert.equal(Math.round(emi / 100), 16607);
  assert.equal(monthsToRepay(500000_00, 12, emi), 36);
  assert.equal(balanceAfter(500000_00, 12, emi, 36), 0);
  assert.equal(monthsToRepay(100000_00, 24, 1000_00), null); // EMI below interest: never repaid
});

const loanEvent = (id, over) => ({ kind: 'loan', messageId: id, date: '2026-08-05', lender: 'Example Finance', loanType: 'Personal loan', account: 'XX1111', purpose: 'emi_paid', confidence: 0.8, ...over });

test('a discovered loan: verified figures from emails, estimates labelled, missing listed', () => {
  const s = ingestEvents(emptyStore(), [
    loanEvent('s1', { purpose: 'sanction', date: '2026-01-10', principal: 300000_00, rate: 14, tenureMonths: 24 }),
    loanEvent('e1', { purpose: 'emi_paid', date: '2026-09-05', emi: 14404_00, amount: 14404_00, outstanding: 120000_00 }),
  ]);
  const { loans } = deriveLoans(s, buildTransactions(s), TODAY);
  assert.equal(loans.length, 1);
  const l = loans[0];
  assert.equal(l.status, 'needs_verification');
  assert.equal(l.principal.source, 'verified');
  assert.equal(l.emi.value, 14404_00);
  assert.equal(l.rate.value, 14);
  // Lender said ₹1,20,000 on 5 Sep; one EMI since, so the current figure is an estimate.
  assert.equal(l.outstanding.source, 'estimated');
  assert.ok(l.outstanding.value < 120000_00 && l.outstanding.value > 100000_00);
  assert.equal(l.remainingEmis.source, 'estimated');
});

test('an NOC is matched to its loan but never closes it without confirmation', () => {
  let s = ingestEvents(emptyStore(), [loanEvent('e1', { emi: 5000_00, amount: 5000_00 }), loanEvent('n1', { purpose: 'noc', date: '2026-10-10', closureDate: '2026-10-08', subject: 'NOC' })]);
  let { loans } = deriveLoans(s, buildTransactions(s), TODAY);
  assert.equal(loans[0].status, 'noc_received');
  assert.equal(loans[0].noc.date, '2026-10-08');
  assert.notEqual(loans[0].status, 'closed');
  s = putRecord(s, 'loans', loanRecordFrom(loans[0], { status: 'closed', statusSetByUser: true, closedOn: '2026-10-08' }));
  ({ loans } = deriveLoans(s, buildTransactions(s), TODAY));
  assert.equal(loans.length, 1);
  assert.equal(loans[0].status, 'closed');
});

test('closing a loan without an NOC is flagged', () => {
  let s = ingestEvents(emptyStore(), [loanEvent('e1', { emi: 5000_00, amount: 5000_00 })]);
  let { loans } = deriveLoans(s, buildTransactions(s), TODAY);
  s = putRecord(s, 'loans', loanRecordFrom(loans[0], { status: 'closed', statusSetByUser: true }));
  ({ loans } = deriveLoans(s, buildTransactions(s), TODAY));
  assert.ok(loans[0].flags.some((f) => f.kind === 'no_noc'));
});

test('repayment strategies: avalanche saves more interest, snowball closes a loan sooner', () => {
  const mk = (id, balance, rate, emi) => ({ id, lender: id, status: 'active', outstanding: { value: balance, source: 'user' }, emi: { value: emi }, rate: { value: rate }, foreclosurePct: null });
  const loans = [mk('big-expensive', 400000_00, 24, 15000_00), mk('small-cheap', 50000_00, 11, 4500_00)];
  const plan = repaymentPlan(loans, { extraMonthly: 10000_00, today: TODAY });
  const av = plan.strategies.find((x) => x.id === 'avalanche');
  const sb = plan.strategies.find((x) => x.id === 'snowball');
  assert.equal(av.first.id, 'big-expensive');
  assert.equal(sb.first.id, 'small-cheap');
  assert.ok(av.interestSaved > sb.interestSaved);
  assert.ok(sb.first.closesInMonth < av.first.closesInMonth);
  assert.ok(av.months < plan.baseline.months);
  // Avalanche saves only ~₹2.8K more here, while snowball frees an EMI 15 months sooner: snowball is recommended.
  assert.equal(plan.recommended, 'snowball');
  // A loan without a rate is excluded with the reason.
  const partial = repaymentPlan([...loans, { ...mk('no-rate', 10000_00, null, 1000_00), rate: { value: null } }], { today: TODAY });
  assert.deepEqual(partial.excluded.map((e) => e.missing), [['interest rate']]);
});

test('lump sum shortens the payoff', () => {
  const l = [{ id: 'a', lender: 'a', balance: 100000_00, rate: 12, emi: 5000_00 }];
  assert.ok(simulate(l, { lumpSum: 50000_00 }).months < simulate(l).months);
});
