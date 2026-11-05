import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseEmail } from '../server/parse/index.js';
import { parseLooseDate } from '../server/parse/text.js';

// Every email here is made up.
const email = (over) => ({ id: 'm1', from: 'Someone <someone@example.com>', subject: '', date: '2026-10-08', snippet: '', body: '', attachments: [], ...over });

test('UPI debit to a person: amount, name, UPI ID, reference, account', () => {
  const [e] = parseEmail(email({
    from: 'HDFC Bank InstaAlerts <alerts@hdfcbank.net>',
    subject: 'You have done a UPI txn. Check details!',
    body: 'Dear Customer, Rs.2,500.00 has been debited from account **4321 to VPA rahulk.demo@okaxis RAHUL KUMAR on 05-10-26. Your UPI transaction reference number is 527812345678.',
  }));
  assert.equal(e.kind, 'txn');
  assert.equal(e.direction, 'out');
  assert.equal(e.amount, 250000);
  assert.equal(e.counterparty, 'Rahul Kumar');
  assert.equal(e.vpa, 'rahulk.demo@okaxis');
  assert.equal(e.reference, '527812345678');
  assert.equal(e.account, 'XX4321');
  assert.equal(e.method, 'UPI');
  assert.equal(e.date, '2026-10-05');
  assert.equal(e.institution, 'HDFC Bank');
});

test('salary credit by NEFT', () => {
  const [e] = parseEmail(email({
    from: 'ICICI Bank <alerts@icicibank.com>',
    subject: 'Transaction alert for your ICICI Bank account',
    body: 'Your A/c XX7788 has been credited with INR 85,000.00 on 01-Oct-26 by ACME TECH PVT LTD via NEFT. Avl Bal INR 1,20,000.00',
  }));
  assert.equal(e.direction, 'in');
  assert.equal(e.amount, 8500000);
  assert.equal(e.counterparty, 'Acme Tech Pvt Ltd');
  assert.equal(e.method, 'NEFT');
});

test('card spend at a merchant', () => {
  const [e] = parseEmail(email({
    from: 'Axis Bank Alerts <alerts@axisbank.com>',
    subject: 'Transaction alert on your Axis Bank Credit Card',
    body: 'INR 1,249.00 spent on your Axis Bank Credit Card ending 9012 at SWIGGY on 06-10-2026. Available limit INR 50,000.',
  }));
  assert.equal(e.direction, 'out');
  assert.equal(e.amount, 124900);
  assert.equal(e.counterparty, 'Swiggy');
  assert.equal(e.account, 'XX9012');
  assert.equal(e.method, 'Credit card');
});

test('OTPs, failed payments and future debits are ignored', () => {
  assert.deepEqual(parseEmail(email({ subject: 'OTP for transaction', body: 'Your OTP is 123456 for Rs 500 at Amazon from card ending 1234' })), []);
  assert.deepEqual(parseEmail(email({ subject: 'Transaction failed', body: 'Rs 500 debit from A/c XX1234 failed.' })), []);
});

test('subscription receipt carries period and renewal', () => {
  const [e] = parseEmail(email({
    from: 'Netflix <info@account.netflix.com>',
    subject: 'Your Netflix membership receipt',
    body: 'Thank you for your payment. Plan: Standard. Amount paid ₹649.00 / month. Paid with Visa ending 4242. Your next billing date is 2 November 2026.',
  }));
  assert.equal(e.kind, 'txn');
  assert.equal(e.amount, 64900);
  assert.equal(e.counterparty, 'Netflix');
  assert.equal(e.method, 'Card •• 4242');
  assert.equal(e.subscription.period, 'monthly');
  assert.equal(e.subscription.nextRenewal, '2026-11-02');
  assert.equal(e.subscription.plan, 'Standard');
});

test('failed and cancelled subscription emails are status events', () => {
  const [f] = parseEmail(email({ from: 'Spotify <no-reply@spotify.com>', subject: 'Your payment failed', body: 'We could not process your payment of ₹119 for Spotify Premium. Update your payment method.' }));
  assert.equal(f.kind, 'sub');
  assert.equal(f.status, 'failed');
  const [c] = parseEmail(email({ from: 'Spotify <no-reply@spotify.com>', subject: 'Your subscription has been cancelled', body: 'Your Premium subscription has been cancelled and will end on 30 Nov 2026.' }));
  assert.equal(c.status, 'cancelled');
});

test('EMI receipt from a lender is a loan event and a payment', () => {
  const events = parseEmail(email({
    from: 'Bajaj Finserv <noreply@bajajfinserv.in>',
    subject: 'EMI payment received - Loan A/c XX4412',
    body: 'We have received your EMI of Rs. 8,250.00 for Personal Loan A/c XX4412. Principal outstanding: Rs. 1,42,300.00',
  }));
  const loan = events.find((e) => e.kind === 'loan');
  const txn = events.find((e) => e.kind === 'txn');
  assert.equal(loan.purpose, 'emi_paid');
  assert.equal(loan.lender, 'Bajaj Finserv');
  assert.equal(loan.account, 'XX4412');
  assert.equal(loan.emi, 825000);
  assert.equal(loan.outstanding, 14230000);
  assert.equal(loan.loanType, 'Personal loan');
  assert.equal(txn.direction, 'out');
  assert.equal(txn.amount, 825000);
});

test('NOC email is recognised with its closure date', () => {
  const [loan] = parseEmail(email({
    from: 'Tata Capital <care@tatacapital.com>',
    subject: 'No Objection Certificate for Loan Account XX7710',
    body: 'This is to certify that the loan account XX7710 has been closed on 12-Sep-2026 and there are no dues outstanding.',
    attachments: ['NOC_XX7710.pdf'],
  }));
  assert.equal(loan.purpose, 'noc');
  assert.equal(loan.lender, 'Tata Capital');
  assert.equal(loan.account, 'XX7710');
  assert.equal(loan.closureDate, '2026-09-12');
  assert.equal(loan.hasAttachment, true);
});

test('loan marketing without an account is ignored', () => {
  assert.deepEqual(parseEmail(email({ from: 'Lender <offers@lender.in>', subject: 'Pre-approved personal loan of Rs 5,00,000', body: 'Apply now! Interest rates starting 10.5%' })), []);
});

test('loose dates', () => {
  assert.equal(parseLooseDate('05-Oct-26'), '2026-10-05');
  assert.equal(parseLooseDate('Oct 5, 2026'), '2026-10-05');
  assert.equal(parseLooseDate('2nd November 2026'), '2026-11-02');
});

test('a shop receipt that says "paid with UPI" is a receipt, not a bank alert', () => {
  const [e] = parseEmail(email({ from: 'Amazon.in <auto-confirm@amazon.in>', subject: 'Your Amazon.in order has been placed', body: 'Thank you for your order. Order Total: ₹2,499.00. Order # 402-1234567-7654321. Paid with UPI.' }));
  assert.equal(e.source, 'gmail-receipt');
  assert.equal(e.counterparty, 'Amazon.in');
  assert.equal(e.amount, 249900);
  assert.equal(e.reference, '402-1234567-7654321');
});
