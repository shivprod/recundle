import { reference as txnReference } from './bank.js';
import { cleanSubject, dateAfter, parseFrom, pickAmount, titleCase } from './text.js';

/**
 * Merchant receipts and subscription emails: payments, renewals, failed payments, trials and
 * cancellations. A payment with an amount becomes a transaction; the subscription facts it states
 * (billing period, next renewal, plan) travel with it as evidence for the Subscriptions module.
 */

/** Services that bill on a schedule. Names here are only used to label senders; nothing is assumed about the user. */
export const SERVICES = [
  ['Netflix', /netflix/i],
  ['Spotify', /spotify/i],
  ['YouTube Premium', /youtube\s?premium|youtube\s?music|youtube/i],
  ['Google One', /google\s?one/i],
  ['Google Play', /google\s?play/i],
  ['Apple', /apple\.com|itunes|app\s?store|icloud|apple\s?(music|tv|one)/i],
  ['Amazon Prime', /amazon\s?prime|prime\s?video|primevideo/i],
  ['JioHotstar', /hotstar|jiocinema/i],
  ['SonyLIV', /sonyliv/i],
  ['ZEE5', /zee5/i],
  ['ChatGPT', /openai|chatgpt/i],
  ['Claude', /anthropic|claude\.ai/i],
  ['Cursor', /cursor/i],
  ['Perplexity', /perplexity/i],
  ['Notion', /notion/i],
  ['Canva', /canva/i],
  ['Adobe', /adobe/i],
  ['Microsoft 365', /microsoft|office\s?365|xbox/i],
  ['GitHub', /github/i],
  ['Figma', /figma/i],
  ['Dropbox', /dropbox/i],
  ['Midjourney', /midjourney/i],
  ['Duolingo', /duolingo/i],
  ['LinkedIn Premium', /linkedin/i],
  ['Audible', /audible/i],
  ['Kindle Unlimited', /kindle\s?unlimited/i],
  ['Swiggy One', /swiggy\s?one/i],
  ['Zomato Gold', /zomato\s?gold/i],
  ['Times Prime', /times\s?prime/i],
  ['Cult.fit', /cult\.?fit|curefit/i],
];

const FAILED = /\bpayment (has )?failed\b|\bpayment (was )?declined\b|\bunable to (process|charge)\b|\bcould(n'?t| not) (process|charge|renew)\b|\bpayment (issue|problem)\b|\bupdate your payment\b|\bpayment unsuccessful\b/i;
const CANCELLED = /\b(subscription|membership|plan)\b.{0,40}\b(cancel+ed|has ended|will end|expired|has been stopped)\b|\bcancel+ation (is )?confirmed\b|\bwe'?ve cancel+ed\b|\byou('ve| have) cancel+ed\b/i;
const TRIAL = /\bfree trial\b|\btrial (has )?(started|begins|is active)\b|\bstart(ed)? your (free )?trial\b/i;
const UPCOMING = /\b(will|is going to) (auto-?)?(renew|be charged|be billed)\b|\bupcoming (payment|renewal|charge)\b|\brenews (on|in)\b|\brenewal reminder\b|\bwill be renewed\b/i;
const PAYMENT =
  /\breceipt\b|\binvoice\b|\bpayment (successful|received|confirmed|complete)\b|\bthank(s| you) for (your )?(payment|purchase|order|subscribing)\b|\byou (paid|were charged)\b|\bhas been charged\b|\border (confirmed|placed|delivered)\b|\b(subscription|membership) (is )?(confirmed|activated|renewed|active)\b|\bsuccessfully renewed\b|\bamount (paid|charged)\b|\btrip with\b|\byour ride\b/i;
const SUBSCRIPTIONISH = /\bsubscription\b|\bmembership\b|\brenew(al|ed|s)?\b|\bauto-?pay\b|\bbilling period\b|\bnext billing\b|\bplan\b/i;
const NOT_RECEIPT = /\botp\b|one[\s-]time password|\bnewsletter\b|\bunsubscribe from (this|these) (offers|promotions)\b|\bsale\b.*\b% off\b|\bwishlist\b|\babandoned\b|\bcart\b.*\bwaiting\b/i;

const TOTAL_LABEL = /(total|grand total|amount paid|amount charged|order total|you paid|paid|charged|price|amount|billed|payment of|for)\s*(\(incl\.? (gst|tax)\))?\s*[:\-]?\s*$/i;

export function service(from, subject) {
  const { name, address } = parseFrom(from);
  const hay = `${name} ${address} ${subject}`;
  return SERVICES.find(([, re]) => re.test(hay))?.[0] ?? null;
}

function merchant(from) {
  const { name, address } = parseFrom(from);
  const cleaned = name.replace(/\b(no-?reply|team|support|billing|payments?|receipts?|orders?|notifications?|updates?|info|mailer)\b/gi, '').replace(/[|:–-]+\s*$/, '').trim();
  if (cleaned.length >= 2) return cleaned;
  const domain = (address.split('@')[1] ?? '').split('.').filter((p) => !/^(com|in|co|net|org|io|mail|email|e|info|mailer|send|accounts?|billing|noreply)$/i.test(p));
  return domain.length ? titleCase(domain[domain.length - 1]) : null;
}

export function billingPeriod(text) {
  if (/\b(monthly|per month|every month|1 month|month-to-month)\b|\/\s?(month|mo)\b/i.test(text)) return 'monthly';
  if (/\b(yearly|annual(ly)?|per year|12 months|1 year)\b|\/\s?(year|yr)\b/i.test(text)) return 'yearly';
  if (/\b(quarterly|3 months|every 3 months)\b/i.test(text)) return 'quarterly';
  if (/\b(half[\s-]?yearly|6 months|every 6 months)\b/i.test(text)) return 'half-yearly';
  if (/\b(weekly|per week)\b|\/\s?week\b/i.test(text)) return 'weekly';
  return null;
}

function plan(text, svc) {
  const m = text.match(/\b(?:plan|membership|subscription|tier)\s*(?:name)?\s*[:\-]\s*([A-Za-z0-9+ ]{2,40}?)(?=\s{2,}|\n|[.,]|$)/i);
  if (m) return m[1].trim();
  const named = svc && text.match(new RegExp(`${svc.split(' ')[0]}\\s+(Premium|Pro|Plus|Basic|Standard|Mobile|Max|Team|Family|Individual|Duo|Student|Super|Gold|One)\\b`, 'i'));
  return named ? named[1] : null;
}

function instrument(text) {
  const card = text.match(/\b(?:card|visa|mastercard|rupay|amex)\b[^\n]{0,30}?(?:ending|ends|xx+|\*+|•+)\s*(?:in|with)?\s*[:\-]?\s*(\d{4})\b/i);
  if (card) return `Card •• ${card[1]}`;
  if (/\bgoogle\s?pay\b|\bgpay\b/i.test(text)) return 'UPI · Google Pay';
  if (/\bphonepe\b/i.test(text)) return 'UPI · PhonePe';
  if (/\bpaytm\b/i.test(text)) return 'UPI · Paytm';
  if (/\bupi\b/i.test(text)) return 'UPI';
  if (/\bgoogle play balance\b|\bapple account balance\b/i.test(text)) return 'Store balance';
  if (/\bnet\s?banking\b/i.test(text)) return 'Net banking';
  return null;
}

function orderRef(text) {
  const m = text.match(/\b(?:order|invoice|receipt|transaction|booking|payment)\s*(?:no\.?|number|id|#)\s*[:#\-]?\s*([A-Z0-9][A-Z0-9\-]{4,30})\b/i);
  return m && /\d/.test(m[1]) ? m[1] : txnReference(text);
}

export function parseReceipt(email) {
  const subject = email.subject ?? '';
  const body = (email.body || email.snippet || '').slice(0, 12000);
  const text = `${subject}\n${body}`;
  if (NOT_RECEIPT.test(subject)) return [];
  const svc = service(email.from, subject);
  const status = FAILED.test(text) ? 'failed' : CANCELLED.test(text) ? 'cancelled' : TRIAL.test(text) && !PAYMENT.test(subject) ? 'trial' : UPCOMING.test(text) && !PAYMENT.test(subject) ? 'upcoming' : PAYMENT.test(text) ? 'payment' : null;
  if (!status) return [];
  const period = billingPeriod(text);
  const isSubscription = Boolean(svc) || Boolean(period) || SUBSCRIPTIONISH.test(text);
  if (status !== 'payment' && !isSubscription) return [];
  const name = svc ?? merchant(email.from);
  if (!name) return [];
  const amount = pickAmount(text, TOTAL_LABEL);
  const sub = {
    status,
    service: name,
    period,
    plan: plan(text, svc),
    nextRenewal: dateAfter(text, /renews?|renewal date|next (?:billing|payment|charge)(?: date)?|will be (?:renewed|charged)(?: on)?|valid (?:till|until)/) ?? null,
    trialEnds: status === 'trial' ? (dateAfter(text, /trial (?:ends|will end|expires)|until|ends on/) ?? null) : null,
    isSubscription,
    known: Boolean(svc),
  };
  const base = { messageId: email.id, date: email.date, subject: cleanSubject(subject), sender: parseFrom(email.from).address };
  if (status === 'payment') {
    if (!amount || amount.currency !== 'INR') return [];
    return [
      {
        kind: 'txn',
        source: 'gmail-receipt',
        ...base,
        direction: /\brefund(ed)?\b/i.test(subject) ? 'in' : 'out',
        amount: amount.amount,
        counterparty: name,
        method: instrument(text),
        reference: orderRef(text),
        description: base.subject,
        confidence: Number((0.5 + (amount.score >= 4 ? 0.25 : 0) + (svc ? 0.15 : 0)).toFixed(2)),
        subscription: isSubscription ? sub : null,
      },
    ];
  }
  return [{ kind: 'sub', ...base, ...sub, amount: amount?.currency === 'INR' ? amount.amount : null, method: instrument(text) }];
}
