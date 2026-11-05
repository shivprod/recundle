import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyStore, ingestEvents, editTransaction, putRecord, newRule, mergeStores } from '../src/core/store.js';
import { buildTransactions, similarPayees } from '../src/core/transactions.js';
import { metrics, periodRange, monthlySeries, leakageInsights, categoryBreakdown } from '../src/core/analytics.js';
import { statementToEvents } from '../src/core/csv.js';
import { entityKey, similarity, looksLikePerson } from '../src/core/entities.js';

// All data here is made up.
const ev = (id, over) => ({ kind: 'txn', source: 'phonepe', rowId: `pp:${id}`, messageId: 'stmt', date: '2026-10-05', direction: 'out', amount: 50000, counterparty: 'Someone', ...over });

function sample() {
  return ingestEvents(emptyStore(), [
    ev('a1', { counterparty: 'RAHUL KUMAR', amount: 2500_00, method: 'UPI', date: '2026-10-03' }),
    ev('a2', { counterparty: 'Rahul Kumar', amount: 2500_00, method: 'UPI', date: '2026-09-03' }),
    ev('a3', { counterparty: 'Swiggy', amount: 412_00, date: '2026-10-04' }),
    ev('a4', { counterparty: 'Swiggy', amount: 530_00, date: '2026-09-10' }),
    ev('a5', { counterparty: 'Acme Tech Pvt Ltd', direction: 'in', amount: 85000_00, method: 'NEFT', description: 'SALARY OCT', date: '2026-10-01' }),
    ev('a6', { counterparty: 'Amazon', direction: 'in', amount: 499_00, description: 'Refund for order', date: '2026-10-06' }),
    ev('a7', { counterparty: 'Netflix', amount: 649_00, date: '2026-10-02', reference: 'R1' }),
    { kind: 'txn', source: 'gmail-receipt', messageId: 'r7', date: '2026-10-02', direction: 'out', amount: 649_00, counterparty: 'Netflix', subscription: { isSubscription: true, known: true, period: 'monthly', service: 'Netflix' } },
    ev('a8', { counterparty: 'R Kumar', amount: 1000_00, method: 'UPI', date: '2026-10-07' }),
  ]);
}

test('entity keys and similarity', () => {
  assert.equal(entityKey('RAHUL  KUMAR.'), 'rahul kumar');
  assert.equal(entityKey('Acme Tech Pvt Ltd'), 'acme tech');
  assert.ok(similarity('rahul kumar', 'r kumar') >= 0.5);
  assert.ok(similarity('rahul kumar', 'swiggy') < 0.2);
  assert.ok(looksLikePerson('Rahul Kumar'));
  assert.ok(!looksLikePerson('Acme Tech Pvt Ltd'));
});

test('a receipt and a bank alert for the same payment count once', () => {
  const txns = buildTransactions(sample());
  const netflix = txns.filter((t) => t.counterparty === 'Netflix');
  assert.equal(netflix.length, 1);
  assert.equal(netflix[0].sources.length, 2);
  assert.equal(netflix[0].subscription.period, 'monthly');
});

test('built-in guesses: salary, refund, person', () => {
  const txns = buildTransactions(sample());
  const by = (n) => txns.find((t) => t.counterparty === n);
  assert.equal(by('Acme Tech Pvt Ltd').category, 'salary');
  assert.equal(by('Amazon').type, 'refund');
  assert.equal(by('RAHUL KUMAR').category, 'personal_transfers');
  assert.equal(by('RAHUL KUMAR').classifiedBy, 'auto');
});

test('a rule re-classifies every matching payment, past and future; a manual edit still wins', () => {
  let s = sample();
  s = putRecord(s, 'rules', newRule({ keys: ['rahul kumar'], direction: 'out', set: { category: 'rent', counterparty: 'Rahul (landlord)' }, label: 'Rahul Kumar' }));
  let txns = buildTransactions(s);
  const rahul = txns.filter((t) => t.rawKey === 'rahul kumar');
  assert.equal(rahul.length, 2);
  assert.ok(rahul.every((t) => t.category === 'rent' && t.classifiedBy === 'rule' && t.counterparty === 'Rahul (landlord)'));
  // The similar "R Kumar" payment is not changed silently; it's offered for confirmation.
  assert.equal(txns.find((t) => t.rawKey === 'r kumar').category, 'personal_transfers');
  assert.deepEqual(similarPayees(txns, 'rahul kumar', 'out').map((p) => p.key), ['r kumar']);
  // A new payment from the same payee arrives later: the rule applies.
  s = ingestEvents(s, [ev('a9', { counterparty: 'RAHUL KUMAR', amount: 2500_00, date: '2026-11-03' })]);
  txns = buildTransactions(s);
  assert.equal(txns.find((t) => t.id === 'pp:a9').category, 'rent');
  // An individual override wins over the rule.
  s = editTransaction(s, 'pp:a1', { category: 'personal_transfers' });
  assert.equal(buildTransactions(s).find((t) => t.id === 'pp:a1').category, 'personal_transfers');
});

test('metrics: income, expenses net of refunds, cash flow', () => {
  const txns = buildTransactions(sample());
  const r = periodRange('this_month', '2026-10-20');
  const m = metrics(txns, r);
  assert.equal(m.income, 85000_00);
  assert.equal(m.refunds, 499_00);
  // Out in October: 2500 + 412 + 649 + 1000 = 4561, minus the 499 refund.
  assert.equal(m.grossExpenses, 4561_00);
  assert.equal(m.expenses, 4062_00);
  assert.equal(m.moneyIn, 85499_00);
  assert.equal(m.moneyOut, 4561_00);
  assert.equal(m.netCashFlow, 85499_00 - 4561_00);
  assert.equal(r.previous.from, '2026-09-01');
  assert.equal(r.previous.to, '2026-09-20');
});

test('own transfers and card bill payments are not spending', () => {
  let s = sample();
  s = ingestEvents(s, [ev('c1', { counterparty: 'CRED', description: 'Credit card bill payment', amount: 20000_00, date: '2026-10-09' })]);
  const m = metrics(buildTransactions(s), periodRange('this_month', '2026-10-20'));
  assert.equal(m.moneyOut, 4561_00);
});

test('monthly series and category breakdown', () => {
  const txns = buildTransactions(sample());
  const series = monthlySeries(txns, '2026-10', 2);
  assert.deepEqual(series.map((x) => [x.key, x.income, x.expenses]), [['2026-09', 0, 3030_00], ['2026-10', 85000_00, 4062_00]]);
  const cats = categoryBreakdown(txns.filter((t) => t.date >= '2026-10-01'));
  assert.equal(cats[0].id, 'personal_transfers');
});

test('insights always point at the transactions behind them', () => {
  const txns = buildTransactions(sample());
  const list = leakageInsights(txns, periodRange('this_month', '2026-10-20'));
  assert.ok(list.length > 0);
  for (const i of list) assert.ok(Array.isArray(i.ids));
});

test('two devices merge record by record', () => {
  const base = sample();
  for (const t of Object.values(base.txns)) t.updatedAt = '2020-01-01T00:00:00.000Z';
  const a = editTransaction(base, 'pp:a1', { notes: 'from phone' });
  const b = editTransaction(base, 'pp:a3', { category: 'groceries' });
  const m = mergeStores(a, b);
  assert.equal(m.txns['pp:a1'].user.notes, 'from phone');
  assert.equal(m.txns['pp:a3'].user.category, 'groceries');
});

test('statement CSV import with UPI narration, and re-import adds nothing', () => {
  const csv = [
    'HDFC BANK STATEMENT,,,,,',
    'Date,Narration,Chq./Ref.No.,Value Dt,Withdrawal Amt.,Deposit Amt.,Closing Balance',
    '03/10/26,UPI-RAHUL KUMAR-RAHULK@OKAXIS-SBIN0001234-627812345678-RENT,0000627812345678,03/10/26,"2,500.00",,"10,000.00"',
    '01/10/26,NEFT CR-HDFC0000123-ACME TECH PVT LTD-SALARY,N123456,01/10/26,,"85,000.00","12,500.00"',
  ].join('\n');
  const { events } = statementToEvents(csv, { account: 'HDFC savings' });
  assert.equal(events.length, 2);
  assert.equal(events[0].counterparty, 'Rahul Kumar');
  assert.equal(events[0].vpa, 'rahulk@okaxis');
  assert.equal(events[0].amount, 2500_00);
  assert.equal(events[0].direction, 'out');
  assert.equal(events[1].direction, 'in');
  assert.equal(events[1].counterparty, 'Acme Tech Pvt Ltd');
  let s = ingestEvents(emptyStore(), events, 'statement');
  const before = Object.keys(s.txns).length;
  s = ingestEvents(s, statementToEvents(csv).events, 'statement');
  assert.equal(Object.keys(s.txns).length, before);
});
