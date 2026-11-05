import { parseBankAlert } from './bank.js';
import { isLoanEmail, parseLoanEmail } from './loan.js';
import { parseReceipt } from './receipt.js';

/**
 * One email → zero or more events:
 *  - { kind: 'txn' }  money that moved (bank alert, receipt, EMI receipt)
 *  - { kind: 'sub' }  subscription facts without a payment (trial, failed payment, cancellation, reminder)
 *  - { kind: 'loan' } a loan event (sanction, disbursal, EMI, statement, closure, NOC)
 * Pure: no I/O, so it can be tested with sample emails.
 */
export function parseEmail(email) {
  const events = [];
  if (isLoanEmail(email)) {
    const loan = parseLoanEmail(email);
    if (loan) {
      events.push(loan);
      // A lender's "EMI received" email is also money out; duplicates with the bank alert are merged later.
      const alert = parseBankAlert(email);
      if (alert && alert.direction === 'out') events.push({ ...alert, loanHint: { lender: loan.lender, account: loan.account } });
      else if (loan.purpose === 'emi_paid' && loan.amount) {
        events.push({
          kind: 'txn',
          source: 'gmail-loan',
          messageId: email.id,
          date: email.date,
          direction: 'out',
          amount: loan.amount,
          counterparty: loan.lender,
          method: 'Auto-debit',
          reference: null,
          description: loan.subject,
          confidence: loan.confidence,
          loanHint: { lender: loan.lender, account: loan.account },
        });
      } else if (loan.purpose === 'disbursal' && loan.amount) {
        events.push({
          kind: 'txn',
          source: 'gmail-loan',
          messageId: email.id,
          date: loan.disbursedOn ?? email.date,
          direction: 'in',
          amount: loan.amount,
          counterparty: loan.lender,
          method: null,
          reference: null,
          description: loan.subject,
          confidence: loan.confidence,
          loanHint: { lender: loan.lender, account: loan.account, disbursal: true },
        });
      }
      return events;
    }
  }
  const alert = parseBankAlert(email);
  if (alert) return [alert];
  return parseReceipt(email);
}

/** The Gmail search for everything Recundle reads: payment alerts, receipts, subscriptions and loans. */
export function gmailQuery({ after, before } = {}) {
  const terms = [
    'debited', 'credited', '"has been debited"', '"has been credited"', '"transaction alert"', 'upi', '"spent on"',
    'receipt', 'invoice', '"payment received"', '"payment successful"', '"your order"', 'subscription', 'renewal', '"free trial"', '"payment failed"', 'membership',
    'emi', 'loan', 'disbursed', 'instalment', '"no objection certificate"', 'noc', '"no dues"', 'foreclosure', '"loan closure"', 'sanction',
  ];
  const range = [after ? `after:${after.replaceAll('-', '/')}` : '', before ? `before:${before.replaceAll('-', '/')}` : ''].filter(Boolean).join(' ');
  return `{${terms.join(' ')}} ${range} -category:social -category:promotions -in:chats -in:spam -in:trash`.replace(/\s+/g, ' ').trim();
}
