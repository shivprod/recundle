/**
 * Text helpers for reading financial emails: amounts, dates, senders and MIME bodies.
 * Ported from Expensize's Gmail parser (amount scoring by label, loose date parsing).
 */

const CURRENCY = { '₹': 'INR', rs: 'INR', 'rs.': 'INR', inr: 'INR', $: 'USD', usd: 'USD', '€': 'EUR', eur: 'EUR', '£': 'GBP', gbp: 'GBP' };

// Currency marker before the number (₹1,234.00 / Rs. 1234 / INR 1,234) or ISO code after it (1,234.00 INR).
const AMOUNT_RE =
  /(₹|\brs\.?|\binr\b|\$|\busd\b|€|\beur\b|£|\bgbp\b)\s*([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)|([0-9]{1,3}(?:,[0-9]{2,3})+(?:\.[0-9]{1,2})?|[0-9]+(?:\.[0-9]{1,2})?)\s*(\binr\b|\busd\b|\beur\b|\bgbp\b)/gi;

/** Labels for figures that describe the account rather than this event. */
const SIDE_FIGURE =
  /(available balance|avl\.? bal|bal(ance)?|credit limit|available limit|limit|minimum (amount )?due|min\.? due|outstanding|late fee|late payment|charges?|interest rate|reward|points|cashback|gst|tax|savings?|discount|mrp|you saved)\s*(is)?\s*[:\-]?\s*(of\s*)?$/i;

/**
 * Every amount in the text with a score. `preferred` is a regex for labels that mark the headline
 * figure ("Total", "EMI amount"); side figures (balances, limits) are scored down.
 * Amounts are returned in paise.
 */
export function extractAmounts(text, preferred = null) {
  const out = [];
  for (const m of String(text).matchAll(AMOUNT_RE)) {
    const symbol = (m[1] ?? m[4] ?? '').toLowerCase();
    const value = Number.parseFloat((m[2] ?? m[3] ?? '').replace(/,/g, ''));
    if (!Number.isFinite(value) || value <= 0 || value > 1e9) continue;
    const index = m.index ?? 0;
    const before = text.slice(Math.max(0, index - 60), index);
    const label = (before.split(/[0-9]/).pop() ?? before).trim();
    let score = 1;
    if (preferred?.test(label)) score += 4;
    else if (SIDE_FIGURE.test(label)) score -= 4;
    if (Number.isInteger(value) && value < 10) score -= 1;
    score -= Math.min(index / 4000, 1);
    out.push({ amount: Math.round(value * 100), currency: CURRENCY[symbol] ?? 'INR', score, index, label });
  }
  return out;
}

export function pickAmount(text, preferred = null) {
  const all = extractAmounts(text, preferred);
  return all.length ? all.reduce((best, c) => (c.score > best.score ? c : best)) : null;
}

/** The amount printed right after a label, e.g. /outstanding/. In paise. */
export function labelledAmount(text, label) {
  return extractAmounts(text).find((c) => label.test(c.label))?.amount;
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/** "05-Oct-2026", "05/10/26", "5 October 2026", "Oct 5, 2026", "2026-10-05" → "2026-10-05". */
export function parseLooseDate(s) {
  const t = String(s).trim().replace(/,/g, ' ').replace(/\s+/g, ' ');
  let d = 0;
  let mo = 0;
  let y = 0;
  const iso = t.match(/^(\d{4})-(\d{2})-(\d{2})/);
  const named = t.match(/^(\d{1,2})(?:st|nd|rd|th)?[\s\-\/.]([a-z]{3,9})[\s\-\/.]?(\d{2,4})\b/i);
  const us = t.match(/^([a-z]{3,9})\s(\d{1,2})(?:st|nd|rd|th)?\s(\d{2,4})\b/i);
  const numeric = t.match(/^(\d{1,2})[\-\/.](\d{1,2})[\-\/.](\d{2,4})\b/);
  if (iso) [y, mo, d] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  else if (named) [d, mo, y] = [Number(named[1]), MONTHS.indexOf(named[2].slice(0, 3).toLowerCase()) + 1, Number(named[3])];
  else if (us) [d, mo, y] = [Number(us[2]), MONTHS.indexOf(us[1].slice(0, 3).toLowerCase()) + 1, Number(us[3])];
  else if (numeric) [d, mo, y] = [Number(numeric[1]), Number(numeric[2]), Number(numeric[3])];
  if (!d || mo < 1 || mo > 12 || d > 31 || !y) return undefined;
  if (y < 100) y += 2000;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const DATE_TOKEN = String.raw`(\d{4}-\d{2}-\d{2}|\d{1,2}(?:st|nd|rd|th)?[\s\-\/.](?:[a-z]{3,9}|\d{1,2})[\s\-\/.,]*\d{2,4}|[a-z]{3,9}\s\d{1,2}(?:st|nd|rd|th)?,?\s\d{4})`;

/** First date that follows a label such as "due date" or "renews on". */
export function dateAfter(text, label) {
  const re = new RegExp(`(?:${label.source})\\s*(?:is|on|by|of|date)?\\s*[:\\-]?\\s*${DATE_TOKEN}`, 'i');
  const m = String(text).match(re);
  return m ? parseLooseDate(m[1]) : undefined;
}

/** `Bajaj Finserv <noreply@bajajfinserv.in>` → { name, address } */
export function parseFrom(from) {
  const m = String(from).match(/^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/);
  if (m) return { name: m[1].trim(), address: m[2].trim().toLowerCase() };
  return { name: '', address: String(from).trim().toLowerCase() };
}

export function htmlToText(html) {
  return String(html)
    .replace(/<(script|style|head)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|tr|li|h\d|table)>/gi, '\n')
    .replace(/<\/t[dh]>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#8377;|&#x20b9;/gi, '₹')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/[ \t ]+/g, ' ')
    .replace(/\n\s*\n+/g, '\n')
    .trim();
}

const decode = (data) => Buffer.from(data.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');

/** Walks a Gmail MIME tree, preferring text/plain unless the HTML part is much richer. */
export function extractBody(part) {
  if (!part) return '';
  const plain = [];
  const html = [];
  const walk = (p) => {
    if (p.filename) return;
    if (p.body?.data) {
      if (p.mimeType === 'text/plain') plain.push(decode(p.body.data));
      else if (p.mimeType === 'text/html') html.push(decode(p.body.data));
    }
    p.parts?.forEach(walk);
  };
  walk(part);
  const text = plain.join('\n').trim();
  if (text && (html.length === 0 || text.length > 200)) return text;
  return htmlToText(html.join('\n'));
}

/** Attachment names (PDF statements, NOC letters), so a NOC sent as a PDF still counts as evidence. */
export function attachmentNames(part) {
  const names = [];
  const walk = (p) => {
    if (p.filename) names.push(p.filename);
    p.parts?.forEach(walk);
  };
  if (part) walk(part);
  return names;
}

export const cleanSubject = (s) => String(s).replace(/^(re|fwd?|fw):\s*/gi, '').replace(/\s+/g, ' ').trim().slice(0, 160);

export function titleCase(s) {
  return String(s).toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).trim();
}
