import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePhonePeStatement, phonePeEvents, parseDate } from '../src/core/phonepe.js';
import { dropEmailData } from '../src/core/store.js';
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

test('statement rows are the transactions; re-reading adds nothing; old Gmail data is dropped', () => {
  const rows = phonePeEvents(parsePhonePeStatement([page]), { fileName: 'oct.pdf' });
  let s = ingestEvents(emptyStore(), rows, 'statement');
  s = ingestEvents(s, rows, 'statement');
  assert.equal(buildTransactions(s).length, 4);
  // Data saved by an older version that read Gmail.
  const old = {
    ...s,
    sync: { version: 2 },
    txns: {
      ...s.txns,
      'g:r1': { id: 'g:r1', source: 'gmail', raw: { source: 'gmail-receipt', date: '2026-10-15', direction: 'out', amount: 64900, counterparty: 'Netflix' } },
      'pp:T1': { id: 'pp:T1', source: 'phonepe', raw: { source: 'phonepe', messageId: 'm1', date: '2026-09-02', direction: 'out', amount: 100, counterparty: 'X' } },
    },
    subEvents: { m2: { id: 'm2', isSubscription: true, service: 'Spotify', status: 'failed', date: '2026-10-01' } },
    statements: { 'm1:1': { id: 'm1:1', messageId: 'm1', status: 'read' }, 'file:a': { id: 'file:a', status: 'read' } },
  };
  const clean = dropEmailData(old);
  assert.deepEqual(Object.keys(clean.txns).sort(), Object.keys(s.txns).sort());
  assert.deepEqual(Object.keys(clean.statements), ['file:a']);
  assert.deepEqual(clean.subEvents, {});
  assert.equal(dropEmailData(clean), clean);
  const all = buildTransactions(clean);
  assert.ok(all.every((t) => t.source === 'phonepe'));
  assert.equal(all.find((t) => t.amount === 64900).counterparty, 'Netflix Com');
  assert.deepEqual(deriveSubscriptions(clean, all, '2026-11-01'), []);
});
