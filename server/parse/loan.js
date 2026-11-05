import { LENDERS, LOAN_TYPES } from './lenders.js';
import { cleanSubject, dateAfter, extractAmounts, labelledAmount, parseFrom, pickAmount, titleCase } from './text.js';

/**
 * Loan emails: sanction letters, disbursals, EMI receipts and reminders, statements, foreclosure
 * quotes, closure confirmations and NOCs. Each email becomes one loan event; the Loans module groups
 * events by lender + account into loans. Figures are only what the email states.
 */

const LOAN_SIGNAL =
  /\bemi\b|\bloan\b|\binstal+ment\b|\brepayment\b|\bdisburs(ed|al|ement)\b|\bno[\s-]?objection certificate\b|\bno[\s-]?dues?\b|\bforeclos|\bpre-?clos|\bpay\s?later\b|\bbnpl\b/i;
const PROMO =
  /\bpre-?approved\b|\beligible for\b|\bapply now\b|\bget (an? )?(instant )?loan\b|\bloan offer\b|\blimited[- ]period\b|\binterest rates? (starting|as low)\b|\bup to \d+%|\bunlock\b.*\blimit\b/i;
const LENDER_SIDE = /\bborrowers?\b|\bp2p\b|\bpeer[\s-]to[\s-]peer\b|\blent to\b|\blen\s?den\s?club\b|\bfaircent\b|\bliquiloans\b/i;
const CREDIT_CARD = /\bcredit card\b|\bcard statement\b|\bcard ending\b/i;

const PURPOSES = [
  ['noc', /\bno[\s-]?objection certificate\b|\bnoc\b|\bno[\s-]?dues?\s?certificate\b|\bno dues\b/i],
  ['closure', /\bloan (account )?(has been |is |was )?(successfully )?(closed|fore-?closed|settled|repaid in full|fully repaid)\b|\bclosure (letter|confirmation)\b|\bloan closure\b|\baccount (has been )?closed\b/i],
  ['foreclosure_quote', /\bfore-?closure (statement|quote|amount|letter)\b|\bpre-?closure (amount|quote|statement)\b/i],
  ['sanction', /\bsanction(ed)? letter\b|\bloan (has been |is )?sanctioned\b|\bloan agreement\b|\bwelcome (letter|kit)\b/i],
  ['disbursal', /\bloan (amount )?(of .* )?(has been |is )?disbursed\b|\bdisbursal (of|amount|successful)\b|\bdisbursed (to|in|into) your\b|\bloan (has been |is )?credited\b/i],
  ['statement', /\bstatement of account\b|\bloan statement\b|\brepayment schedule\b|\bamorti[sz]ation\b|\binterest certificate\b/i],
  ['emi_due', /\bemi (is |will be )?due\b|\bupcoming emi\b|\bemi reminder\b|\bwill be (debited|presented)\b|\bdue (date|on)\b|\bpayment due\b|\boverdue\b|\bbounced?\b/i],
  ['emi_paid', /\bemi\b.*\b(paid|received|debited|successful|deducted)\b|\b(paid|received|debited|deducted)\b.*\bemi\b|\bpayment (received|successful)\b|\bthank you for (your )?payment\b|\brepayment (received|successful)\b|\binstal+ment (paid|received)\b/i],
];

function lender(from, subject, body) {
  const { name, address } = parseFrom(from);
  const sender = `${name} ${address}`;
  const content = `${subject}\n${body}`;
  const named = LENDERS.find((r) => !r.intermediary && r.pattern.test(content));
  const bySender = LENDERS.find((r) => r.pattern.test(sender));
  if (bySender) return bySender.intermediary && named ? named : bySender;
  if (named) return named;
  const bank = LENDERS.find((r) => r.intermediary && r.pattern.test(content));
  if (bank) return bank;
  const phrase = content.match(/\b(?:towards|to|for|from)\s+([A-Z][A-Za-z0-9&'. ]{1,40}?\s(?:FINANCE|FINSERV|CAPITAL|CREDIT|BANK|FINCORP|LENDING)\b(?:\s(?:LTD|LIMITED|PVT))?)/i);
  if (phrase) return { name: titleCase(phrase[1]), type: 'Other loan' };
  const cleaned = name.replace(/\b(no-?reply|alerts?|notifications?|team|support|care|updates?)\b/gi, '').trim();
  return { name: cleaned || titleCase((address.split('@')[1] ?? '').split('.')[0] || 'Unknown lender'), type: 'Other loan' };
}

/** "Loan A/c XX4412", "LAN 77120034" → "XX4412". Loan numbers win over the bank account an EMI is debited from. */
export function loanAccount(text) {
  const m =
    text.match(/\b(?:loan|lan|agreement)\s*(?:a\/c|account|id|agreement)?\s*(?:no\.?|number)?\s*[:\-#]?\s*((?:[x*]{2,}\s*)?[A-Z0-9]*\d{4,})\b/i) ??
    text.match(/\b(?:a\/c|account)\s*(?:no\.?|number)?\s*[:\-#]?\s*((?:[x*]{2,}\s*)?\d{4,})\b/i) ??
    text.match(/\b([x*]{2,}\s*\d{4})\b/i);
  return m ? `XX${m[1].replace(/\D/g, '').slice(-4)}` : null;
}

function rate(text) {
  const m = text.match(/\b(?:rate of interest|interest rate|roi|interest @|interest at)\s*(?:is|of|@)?\s*[:\-]?\s*(\d{1,2}(?:\.\d{1,2})?)\s*%/i) ?? text.match(/(\d{1,2}(?:\.\d{1,2})?)\s*%\s*(?:p\.?\s?a\.?|per annum)/i);
  const v = m ? Number(m[1]) : null;
  return v && v > 0 && v < 60 ? v : null;
}

function tenure(text) {
  const m = text.match(/\b(?:tenure|term|tenor)\s*(?:of)?\s*(?:the loan)?\s*(?:is)?\s*[:\-]?\s*(\d{1,3})\s*(months?|years?|yrs?)\b/i) ?? text.match(/\b(\d{1,3})\s*(months?|years?)\s*(?:tenure|term)\b/i);
  if (!m) return null;
  const n = Number(m[1]);
  return /y/i.test(m[2]) ? n * 12 : n;
}

export function isLoanEmail(email) {
  const text = `${email.subject}\n${email.body || email.snippet}`;
  return LOAN_SIGNAL.test(text) && !LENDER_SIDE.test(text);
}

export function parseLoanEmail(email) {
  const subject = email.subject ?? '';
  const body = (email.body || email.snippet || '').slice(0, 20000);
  const text = `${subject}\n${body}\n${(email.attachments ?? []).join(' ')}`;
  if (!LOAN_SIGNAL.test(text) || LENDER_SIDE.test(text)) return null;
  const purpose = PURPOSES.find(([, re]) => re.test(text))?.[0] ?? null;
  if (!purpose) return null;
  // A credit card bill isn't a loan; card spending shows up in Expenses instead.
  if (CREDIT_CARD.test(text) && !/\bloan\b|\bemi\b/i.test(text)) return null;
  const account = loanAccount(text);
  const promo = PROMO.test(text);
  if (promo && !account) return null;
  const who = lender(email.from, subject, body);
  const type = LOAN_TYPES.find(([, re]) => re.test(text))?.[0] ?? who.type;

  const emi = labelledAmount(text, /\b(emi|instal+ment)\s*(amount)?\s*(of|is)?\s*[:\-]?$/i) ?? null;
  const principal = labelledAmount(text, /\b(loan amount|sanctioned amount|disbursed amount|disbursal amount|amount disbursed|principal amount|amount financed|loan of)\s*(is|of)?\s*[:\-]?$/i) ?? null;
  const outstanding = labelledAmount(text, /\b(principal outstanding|outstanding principal|outstanding (amount|balance)?|balance (principal|outstanding)|pos)\s*(is|as on .*)?\s*[:\-]?$/i) ?? null;
  const foreclosure = labelledAmount(text, /\b(fore-?closure|pre-?closure) (amount|charges payable|payable)|total amount payable\s*(is)?\s*[:\-]?$/i) ?? null;
  const headline =
    purpose === 'emi_paid' || purpose === 'emi_due'
      ? (emi ?? pickAmount(text, /(emi|amount|paid|received|debited|due|of)\s*[:\-]?\s*(of)?\s*$/i)?.amount ?? null)
      : purpose === 'disbursal' || purpose === 'sanction'
        ? (principal ?? pickAmount(text, /(loan amount|disbursed|sanctioned|amount)\s*[:\-]?\s*(of)?\s*$/i)?.amount ?? null)
        : null;

  let confidence = 0.45;
  if (account) confidence += 0.2;
  if (LENDERS.some((r) => r.name === who.name)) confidence += 0.15;
  if (headline || outstanding || purpose === 'noc' || purpose === 'closure') confidence += 0.1;
  if (promo) confidence -= 0.3;

  return {
    kind: 'loan',
    messageId: email.id,
    date: email.date,
    subject: cleanSubject(subject),
    lender: who.name,
    loanType: type,
    account,
    purpose,
    amount: headline,
    emi: emi ?? (purpose === 'emi_paid' || purpose === 'emi_due' ? headline : null),
    principal,
    outstanding,
    foreclosureAmount: foreclosure,
    rate: rate(text),
    tenureMonths: tenure(text),
    dueDate: dateAfter(text, /due date|due on|payable by|will be debited on|presented on/) ?? null,
    closureDate: purpose === 'noc' || purpose === 'closure' ? (dateAfter(text, /closed on|closure date|date of closure|closed w\.?e\.?f\.?|closed with effect from|fully repaid on/) ?? null) : null,
    disbursedOn: purpose === 'disbursal' ? (dateAfter(text, /disbursed on|disbursal date|date of disbursal/) ?? email.date) : null,
    hasAttachment: (email.attachments ?? []).some((n) => /\.pdf$/i.test(n)),
    attachments: (email.attachments ?? []).slice(0, 5),
    confidence: Math.max(0.05, Math.min(0.95, Number(confidence.toFixed(2)))),
    amounts: extractAmounts(text).slice(0, 6).map((a) => ({ amount: a.amount, label: a.label.slice(-40) })),
  };
}
