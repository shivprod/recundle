import { cleanSubject, dateAfter, parseFrom, pickAmount, titleCase } from './text.js';

/**
 * Bank and card transaction alerts ("Rs.2,500 debited from A/c XX1234 to VPA rahul@okaxis RAHUL KUMAR",
 * "INR 50,000 credited to your account by ACME PVT LTD (NEFT)") → one transaction each.
 * Written for the alert formats Indian banks send; returns null for anything else.
 */

const BANKS = [
  ['HDFC Bank', /\bhdfc\s?bank\b|\bhdfcbank\b/i],
  ['ICICI Bank', /\bicici\s?bank\b|\bicicibank\b/i],
  ['State Bank of India', /\bstate\s?bank\b|\bsbi\b|\bonlinesbi\b/i],
  ['Axis Bank', /\baxis\s?bank\b|\baxisbank\b/i],
  ['Kotak Mahindra Bank', /\bkotak\b/i],
  ['IDFC FIRST Bank', /\bidfc\s?first\b|\bidfcfirstbank\b/i],
  ['Yes Bank', /\byes\s?bank\b/i],
  ['IndusInd Bank', /\bindusind\b/i],
  ['AU Small Finance Bank', /\bau\s?(small\s?finance\s?)?bank\b/i],
  ['Federal Bank', /\bfederal\s?bank\b/i],
  ['Bank of Baroda', /\bbank\s?of\s?baroda\b|\bbankofbaroda\b/i],
  ['Punjab National Bank', /\bpunjab\s?national\b|\bpnb\b/i],
  ['Canara Bank', /\bcanara\b/i],
  ['Union Bank', /\bunion\s?bank\b/i],
  ['RBL Bank', /\brbl\s?bank\b/i],
  ['Standard Chartered', /\bstandard\s?chartered\b/i],
  ['HSBC', /\bhsbc\b/i],
  ['American Express', /\bamerican\s?express\b|\bamex\b/i],
  ['SBI Card', /\bsbi\s?card\b|\bsbicard\b/i],
  ['OneCard', /\bonecard\b/i],
  ['Jupiter', /\bjupiter\b/i],
  ['Fi', /\bfi\.money\b|\bepifi\b/i],
  ['Slice', /\bsliceit\b|\bslice\b/i],
  ['Paytm Payments Bank', /\bpaytm\s?payments?\s?bank\b/i],
  ['Airtel Payments Bank', /\bairtel\s?payments?\s?bank\b/i],
];

const OUT = /\b(debited|spent|paid|sent|withdrawn|deducted|purchase(d)?|transferred to|used for|charged|txn of|transaction of)\b/i;
const IN = /\b(credited|received|deposited|added to your|reversed to your)\b/i;
const MONEY_CONTEXT = /\ba\/c\b|\baccount\b|\bacct\b|\bcard\b|\bupi\b|\bvpa\b|\bneft\b|\bimps\b|\brtgs\b|\bwallet\b/i;
const NOT_A_TXN =
  /\botp\b|one[\s-]time password|\bwill be (debited|credited|charged)\b|\bis due\b|\bdue (date|on)\b|\bscheduled\b|\bcollect request\b|\bpayment request\b|\brequested money\b|\bmandate (created|registered|set up)\b|\bstatement (is|has been) generated\b|\bminimum (amount )?due\b|\bfailed\b|\bdeclined\b|\bunsuccessful\b|\bcould not be\b|\boffer\b|\bcashback of up to\b|\bpre-?approved\b/i;

const AMOUNT_LABEL = /(debited|credited|spent|paid|received|sent|withdrawn|amount|txn of|transaction of|for|of|inr|rs\.?)\s*(with|by)?\s*$/i;

function accountRef(text) {
  const m =
    text.match(/\bcard\s*(?:no\.?|number)?\s*(?:ending|ends)\s*(?:in|with)?\s*[:\-]?\s*[x*]*\s*(\d{4})\b/i) ??
    text.match(/\b(?:a\/c|account|acct)\s*(?:no\.?|number)?\s*[:\-]?\s*(?:ending\s*(?:in|with)?\s*)?[x*.]*\s*(\d{3,})\b/i) ??
    text.match(/\bending\s*(?:in|with)?\s*[:\-]?\s*(\d{4})\b/i) ??
    text.match(/\b[x*]{2,}\s*(\d{3,4})\b/i);
  return m ? `XX${m[1].slice(-4)}` : null;
}

export function reference(text) {
  const m = text.match(
    /\b(?:upi\s*ref(?:erence)?|ref(?:erence)?\.?|rrn|utr|txn\.?\s*id|transaction\s*(?:id|ref(?:erence)?))\s*(?:no\.?|number|id)?\s*(?:is)?\s*[:\-#.]?\s*([A-Z0-9]{6,22})\b/i,
  );
  return m && /\d/.test(m[1]) ? m[1] : null;
}

function method(text) {
  if (/\bupi\b|\bvpa\b|@ok(axis|hdfc|icici|sbi)|@ybl|@paytm|@ibl|@axl/i.test(text)) return 'UPI';
  if (/\bnach\b|\becs\b|\bauto-?debit\b|\bmandate\b|\bsi\b standing instruction/i.test(text)) return 'Auto-debit';
  if (/\bneft\b/i.test(text)) return 'NEFT';
  if (/\bimps\b/i.test(text)) return 'IMPS';
  if (/\brtgs\b/i.test(text)) return 'RTGS';
  if (/\batm\b|\bcash withdrawal\b/i.test(text)) return 'ATM';
  if (/\bcredit card\b/i.test(text)) return 'Credit card';
  if (/\bdebit card\b/i.test(text)) return 'Debit card';
  if (/\bcard\b/i.test(text)) return 'Card';
  if (/\bwallet\b/i.test(text)) return 'Wallet';
  if (/\bnet\s?banking\b/i.test(text)) return 'Net banking';
  return null;
}

const NOISE = /\b(your|a\/c|account|acct|no\.?|vpa|upi|ref|imps|neft|rtgs|on|the|via|using|xx+\d*|\*+\d*)\b/gi;

function tidyName(raw) {
  const name = String(raw)
    .replace(/\s+/g, ' ')
    .replace(/[.,;:]+$/, '')
    .replace(/^(mr|mrs|ms|m\/s|shri|smt)\.?\s+/i, '')
    .trim();
  if (!name || name.length < 2 || /^\d+$/.test(name)) return null;
  if (name.replace(NOISE, '').trim().length < 2) return null;
  return /[a-z]/.test(name) ? name : titleCase(name);
}

const vpaName = (vpa) => {
  const local = vpa.split('@')[0].replace(/[._-]+/g, ' ').replace(/\d+/g, ' ').trim();
  return local.length >= 3 ? titleCase(local) : vpa;
};

/** Who the money went to (or came from), plus the UPI ID when the alert names one. */
export function counterparty(text, direction) {
  const vpaRe = /([a-z0-9][\w.\-]{1,60}@[a-z][a-z0-9]{1,20})\b/i;
  // "to VPA rahul@okaxis RAHUL KUMAR on 05-10-26"
  let m = text.match(/\b(?:to|from|by)\s+(?:vpa|upi id)?\s*([a-z0-9][\w.\-]{1,60}@[a-z][a-z0-9]{1,20})\s+([A-Za-z][A-Za-z .&'\-]{1,60}?)(?=\s+(?:on|ref|upi|via|dated)\b|[.,\n(]|$)/i);
  if (m) return { name: tidyName(m[2]) ?? vpaName(m[1]), vpa: m[1].toLowerCase() };
  // UPI narration: UPI/P2A/312345678901/RAHUL KUMAR/SBIN/...
  m = text.match(/\bUPI[\/\-](?:P2[AMP][\/\-]|DR[\/\-]|CR[\/\-])?(?:\d{6,}[\/\-])?([A-Za-z][^\/\n\-]{1,60})[\/\-]/i);
  if (m && tidyName(m[1])) {
    const vpa = text.match(vpaRe)?.[1]?.toLowerCase() ?? null;
    return { name: tidyName(m[1]), vpa };
  }
  const name =
    direction === 'in'
      ? text.match(/\b(?:from|by)\s+(?!your\b|a\/c\b|account\b)([A-Za-z0-9][A-Za-z0-9 .&'\-]{1,60}?)(?=\s+(?:on|via|ref|towards|in|to|through|dated|with|for|upi|neft|imps|rtgs)\b|[.,\n(]|$)/i)?.[1]
      : (text.match(/\b(?:at|towards|to)\s+(?!your\b|a\/c\b|account\b|vpa\b|be\b|the\b)([A-Za-z0-9][A-Za-z0-9 .&'*\-]{1,50}?)(?=\s+(?:on|via|using|ref|txn|with|for|from|dated|upi|through)\b|[.,\n(]|$)/i)?.[1] ??
        text.match(/\bInfo:?\s*(?:UPI\/|POS\/|ECOM\/)?([A-Za-z][A-Za-z0-9 .&'*\-]{2,50})/i)?.[1]);
  const vpa = text.match(vpaRe)?.[1]?.toLowerCase() ?? null;
  const tidy = name ? tidyName(name.replace(/\*+/g, ' ')) : null;
  if (tidy) return { name: tidy, vpa };
  if (vpa) return { name: vpaName(vpa), vpa };
  return { name: null, vpa: null };
}

function institution(from, text) {
  const { name, address } = parseFrom(from);
  const hit = BANKS.find(([, re]) => re.test(`${name} ${address}`)) ?? BANKS.find(([, re]) => re.test(text));
  return hit ? hit[0] : name || null;
}

export function parseBankAlert(email) {
  const subject = email.subject ?? '';
  const body = (email.body || email.snippet || '').slice(0, 8000);
  const text = `${subject}\n${body}`;
  if (!MONEY_CONTEXT.test(text) || NOT_A_TXN.test(text)) return null;
  // A bank or card alert names an account, card or UPI reference, or comes from a bank. A shop's
  // receipt that merely says "paid with UPI" is left to the receipt parser.
  const fromBank = BANKS.some(([, re]) => re.test(email.from ?? ''));
  if (!fromBank && !accountRef(text) && !/\bvpa\b|\bupi (ref|transaction)|\butr\b|\brrn\b/i.test(text)) return null;
  const outHit = text.match(OUT);
  const inHit = text.match(IN);
  if (!outHit && !inHit) return null;
  // Whichever verb comes first decides ("credited ... debited from" is rare; "debited ... credited to beneficiary" is common).
  const direction = outHit && (!inHit || outHit.index <= inHit.index) ? 'out' : 'in';
  const amount = pickAmount(text, AMOUNT_LABEL);
  if (!amount || amount.currency !== 'INR') return null;
  const party = counterparty(body || subject, direction);
  const date = dateAfter(text, /\bon|\bdated|\bdate/) ?? email.date;
  let confidence = 0.55;
  if (party.name) confidence += 0.15;
  if (amount.score >= 4) confidence += 0.15;
  if (accountRef(text)) confidence += 0.1;
  return {
    kind: 'txn',
    source: 'gmail-alert',
    messageId: email.id,
    date: date && date <= email.date ? date : email.date,
    direction,
    amount: amount.amount,
    counterparty: party.name,
    vpa: party.vpa,
    method: method(text),
    account: accountRef(text),
    institution: institution(email.from, text),
    reference: reference(text),
    description: cleanSubject(subject) || body.slice(0, 120),
    confidence: Math.min(0.95, Number(confidence.toFixed(2))),
  };
}
