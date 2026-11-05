import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhonePeStatement, phonePeEvents, parseDate, isPhonePeStatement } from '../src/core/phonepe.js';
import { emptyStore, ingestEvents } from '../src/core/store.js';
import { buildTransactions } from '../src/core/transactions.js';
import { deriveSubscriptions } from '../src/core/subscriptions.js';

// A made-up statement page laid out like PhonePe's: Date | Transaction Details | Type | Amount.
// Positions are PDF points (y grows upwards), as pdf.js returns them.
function row(y, { date, time, lines, type, amount }) {
  return [
    { x: 22, y: y - 5, str: date },
    { x: 22, y: y - 19, str: time },
    ...lines.map((str, i) => ({ x: 125, y: y - i * 13.5, str })),
    { x: 425, y, str: type },
    { x: 493, y: y - 1, str: '₹' },
    { x: 500, y: y - 1, str: amount },
  ];
}
const page = [
  { x: 22, y: 811, str: 'Transaction Statement for 98XXXXXX10' },
  { x: 22, y: 792, str: '01 Oct, 2026 - 31 Oct, 2026' },
  { x: 23, y: 771, str: 'Date' }, { x: 125, y: 771, str: 'Transaction Details' }, { x: 425, y: 771, str: 'Type' }, { x: 493, y: 771, str: 'Amount' },
  ...row(755, { date: 'Oct 31, 2026', time: '08:15 PM', lines: ['Paid to Swiggy', 'Transaction ID T261031001', 'UTR No. 630400000001', 'Paid by XXXXXX4521'], type: 'DEBIT', amount: '245' }),
  ...row(699, { date: 'Oct 15, 2026', time: '09:00 AM', lines: ['Paid to NETFLIX COM', 'Transaction ID T261015002', 'UTR No. 630400000002', 'Paid by XXXXXX4521'], type: 'DEBIT', amount: '649' }),
  ...row(643, { date: 'Oct 05, 2026', time: '10:30 AM', lines: ['Received from RAHUL KUMAR', 'Transaction ID T261005003', 'UTR No. 630400000003', 'Credited to XXXXXX4521'], type: 'CREDIT', amount: '1,500.50' }),
  ...row(587, { date: 'Oct 02, 2026', time: '07:45 AM', lines: ['Paid to EXAMPLE FINANCE LIMITED', 'LOAN EMI', 'Transaction ID T261002004', 'UTR No. 630400000004', 'Paid by XXXXXX4521'], type: 'DEBIT', amount: '14,404' }),
  { x: 22, y: 60, str: 'Page 1 of 1' },
];

test('dates in the formats PhonePe uses', () => {
  assert.equal(parseDate('Oct 31, 2026'), '2026-10-31');
  assert.equal(parseDate('5 Sept 2026'), '2026-09-05');
  assert.equal(parseDate('05/10/2026'), '2026-10-05');
  assert.equal(parseDate('01 Oct, 2026 - 31 Oct, 2026'), null);
});

test('statement rows: date, direction, amount, payee, IDs and account', () => {
  const { txns, skipped, period } = parsePhonePeStatement([page]);
  assert.equal(skipped, 0);
  assert.deepEqual(period, { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(txns.length, 4);
  assert.deepEqual(txns[0], { date: '2026-10-31', time: '08:15 PM', direction: 'out', amount: 24500, counterparty: 'Swiggy', details: 'Paid to Swiggy', reference: 'T261031001', utr: '630400000001', account: 'XX4521' });
  assert.equal(txns[2].direction, 'in');
  assert.equal(txns[2].amount, 150050);
  assert.equal(txns[2].counterparty, 'RAHUL KUMAR');
  // A payee name that wraps onto a second line.
  assert.equal(txns[3].counterparty, 'EXAMPLE FINANCE LIMITED LOAN EMI');
  assert.equal(txns[3].amount, 1440400);
});

test('whole-line statements are read too', () => {
  const lines = ['Oct 31, 2026 08:15 PM Paid to Swiggy DEBIT ₹245', 'Transaction ID T1', 'Oct 30, 2026 Received from Asha CREDIT ₹1,000', 'Transaction ID T2'];
  const { txns } = parsePhonePeStatement([lines.map((str, i) => ({ x: 20, y: 700 - i * 14, str }))]);
  assert.equal(txns.length, 2);
  assert.equal(txns[0].counterparty, 'Swiggy');
  assert.equal(txns[1].direction, 'in');
  assert.equal(txns[1].amount, 100000);
});

test('only PhonePe statement emails are treated as statements', () => {
  assert.ok(isPhonePeStatement('PhonePe <noreply@phonepe.com>', 'PhonePe - Monthly Statement'));
  assert.ok(!isPhonePeStatement('PhonePe <noreply@phonepe.com>', 'Payment successful'));
  assert.ok(!isPhonePeStatement('HDFC Bank <alerts@hdfcbank.net>', 'Your account statement'));
});

test('statement rows are the expenses; receipts and lender emails are matched to them', () => {
  const rows = phonePeEvents(parsePhonePeStatement([page]), { messageId: 'stmt1' });
  let s = ingestEvents(emptyStore(), rows, 'gmail');
  // Re-reading the same statement adds nothing.
  s = ingestEvents(s, rows, 'gmail');
  s = ingestEvents(s, [
    // Netflix's receipt for the same payment: matched, lends its name and subscription facts.
    { kind: 'txn', source: 'gmail-receipt', messageId: 'r1', date: '2026-10-15', direction: 'out', amount: 649_00, counterparty: 'Netflix', subscription: { isSubscription: true, period: 'monthly', service: 'Netflix', nextRenewal: '2026-11-15' } },
    // A receipt paid by card (not in the statement): kept as evidence, not counted as an expense.
    { kind: 'txn', source: 'gmail-receipt', messageId: 'r2', date: '2026-10-20', direction: 'out', amount: 119_00, counterparty: 'Spotify', subscription: { isSubscription: true, period: 'monthly', service: 'Spotify' } },
    // An old bank alert from before: ignored.
    { kind: 'txn', source: 'gmail-alert', messageId: 'b1', date: '2026-10-21', direction: 'out', amount: 999_00, counterparty: 'Someone' },
  ], 'gmail');
  const all = buildTransactions(s);
  const expenses = all.filter((t) => !t.evidence);
  assert.equal(expenses.length, 4);
  assert.ok(expenses.every((t) => t.source === 'phonepe'));
  const netflix = expenses.find((t) => t.amount === 649_00);
  assert.equal(netflix.counterparty, 'Netflix');
  assert.ok(netflix.matched);
  assert.deepEqual(netflix.sources.map((x) => x.kind), ['phonepe', 'gmail-receipt']);
  assert.ok(all.find((t) => t.counterparty === 'Spotify').evidence);
  assert.ok(!all.some((t) => t.amount === 999_00));
  const subs = deriveSubscriptions(s, all, '2026-11-01');
  assert.deepEqual(subs.map((x) => x.name).sort(), ['Netflix', 'Spotify']);
});
