/**
 * PhonePe "Transaction Statement" PDFs → transactions.
 *
 * The statement is a table: Date | Transaction Details | Type | Amount. Each row's details cell holds
 * several lines, e.g.
 *     Paid to Swiggy
 *     Transaction ID T2610312015000001
 *     UTR No. 630412345601
 *     Paid by XXXXXX4521
 * Input is the PDF's positioned text (one array of {x, y, str} per page, y growing upwards), so the
 * rows can be rebuilt from the layout. Pure: no I/O, shared by the server and the tests.
 */

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12 };
const DATE_PATTERNS = [
  // Oct 31, 2026
  [/^([A-Za-z]{3,4})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})$/, (m) => [m[3], MONTHS[m[1].toLowerCase()], m[2]]],
  // 31 Oct 2026, 31 Oct, 2026
  [/^(\d{1,2})\s+([A-Za-z]{3,4})[a-z]*\.?,?\s+(\d{4})$/, (m) => [m[3], MONTHS[m[2].toLowerCase()], m[1]]],
  // 31/10/2026, 31-10-2026
  [/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/, (m) => [m[3], Number(m[2]), m[1]]],
];

export function parseDate(s) {
  const t = String(s).trim();
  for (const [re, f] of DATE_PATTERNS) {
    const m = t.match(re);
    if (!m) continue;
    const [y, mo, d] = f(m).map(Number);
    if (!mo || mo > 12 || d < 1 || d > 31) return null;
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  return null;
}

const TIME = /^\d{1,2}:\d{2}\s?(am|pm)?$/i;
const META = /^(transaction id|utr\b|utr no|paid by|debited from|credited to|paid from|bank ref|reference)/i;
const AMOUNT = /^(?:₹|rs\.?|inr)?\s?([\d,]+(?:\.\d{1,2})?)$/i;
const TYPE = /^(debit|credit|dr|cr)$/i;
const HEADER = /^(date|transaction details|details|type|amount|page \d+( of \d+)?)$/i;

const PREFIXES = [
  [/^paid to\s+/i, 'out'],
  [/^payment to\s+/i, 'out'],
  [/^sent to\s+/i, 'out'],
  [/^transfer(red)? to\s+/i, 'out'],
  [/^bill paid\s*[-–:]\s*/i, 'out'],
  [/^(mobile|dth|fastag)\s+recharged?\s*[-–:]?\s*/i, 'out'],
  [/^received from\s+/i, 'in'],
  [/^refund (from|for)\s+/i, 'in'],
  [/^cashback (from|for)\s+/i, 'in'],
  [/^(money )?added to\s+/i, null],
];

const toPaise = (s) => Math.round(Number(String(s).replace(/,/g, '')) * 100);

/** Splits a details cell into who it was with, and the IDs/accounts below it. */
function readDetails(lines) {
  const head = [];
  const meta = {};
  for (const l of lines) {
    let m;
    if ((m = l.match(/^transaction id\s*:?\s*([A-Za-z0-9]+)/i))) meta.reference = m[1];
    else if ((m = l.match(/^utr(?: no\.?)?\s*:?\s*([A-Za-z0-9]+)/i))) meta.utr = m[1];
    else if ((m = l.match(/^(paid by|debited from|credited to|paid from)\s*:?\s*(.+)$/i))) meta.account = m[2].replace(/\s+/g, '').replace(/^.*?(\d{2,4})$/, 'XX$1');
    else if (!META.test(l)) head.push(l);
  }
  const details = head.join(' ').replace(/\s+/g, ' ').trim();
  let counterparty = details;
  let hint = null;
  for (const [re, dir] of PREFIXES) {
    if (re.test(details)) {
      counterparty = details.replace(re, '').trim();
      hint = dir;
      break;
    }
  }
  return { details, counterparty: counterparty || details, hint, ...meta };
}

/**
 * Rebuilds the rows of one page. The details column is found from its "Transaction ID" lines; a new
 * row starts at a details line that follows the ID/UTR/account lines of the row before. Date, type
 * and amount are then matched to the row whose first line is closest vertically.
 */
function pageRows(items) {
  const clean = items.map((i) => ({ ...i, str: String(i.str).trim() })).filter((i) => i.str && !HEADER.test(i.str));
  const idItems = clean.filter((i) => /^transaction id\b/i.test(i.str));
  if (!idItems.length) return [];
  const xs = idItems.map((i) => Math.round(i.x));
  const colX = xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const inCol = (i) => Math.abs(i.x - colX) <= 6;
  const detail = clean.filter(inCol).sort((a, b) => b.y - a.y);
  const others = clean.filter((i) => !inCol(i));

  const rows = [];
  let cur = null;
  let lastWasMeta = false;
  for (const it of detail) {
    const meta = META.test(it.str);
    if (!meta && (!cur || lastWasMeta)) {
      cur = { top: it.y, bottom: it.y, lines: [] };
      rows.push(cur);
    }
    if (!cur) continue;
    cur.lines.push(it.str);
    cur.bottom = it.y;
    lastWasMeta = meta;
  }
  // Rows without an ID are table headers or footers.
  const real = rows.filter((r) => r.lines.some((l) => /^transaction id\b/i.test(l)));
  if (!real.length) return [];
  const lineGap = Math.max(8, Math.min(...real.map((r) => (r.lines.length > 1 ? (r.top - r.bottom) / (r.lines.length - 1) : 14))));
  const nearest = (y) => {
    let best = null;
    for (const r of real) {
      // Inside the row's span (with a little slack above), or else nearest to its first line.
      const d = y <= r.top + lineGap && y >= r.bottom - lineGap / 2 ? 0 : Math.abs(y - r.top);
      if (!best || d < best.d) best = { r, d };
    }
    return best && best.d <= lineGap * 1.5 ? best.r : null;
  };

  for (const it of others) {
    const r = nearest(it.y);
    if (!r) continue;
    const date = parseDate(it.str);
    if (date) {
      if (!r.date || Math.abs(it.y - r.top) < Math.abs(r.dateY - r.top)) Object.assign(r, { date, dateY: it.y });
      continue;
    }
    if (TIME.test(it.str)) {
      r.time ??= it.str;
      continue;
    }
    if (TYPE.test(it.str)) {
      r.type ??= /^(debit|dr)$/i.test(it.str) ? 'out' : 'in';
      continue;
    }
    const m = it.str.replace(/^₹\s?/, '').match(AMOUNT);
    if (m && it.x > colX && /[\d]/.test(m[1])) {
      const v = toPaise(m[1]);
      if (v > 0 && (r.amount == null || Math.abs(it.y - r.top) < Math.abs(r.amountY - r.top))) Object.assign(r, { amount: v, amountY: it.y });
    }
  }
  return real;
}

/** Fallback for statements whose text comes out as whole lines: "Oct 31, 2026 Paid to X DEBIT ₹245". */
function streamRows(pages) {
  const lines = [];
  for (const items of pages) {
    const sorted = items.filter((i) => String(i.str).trim()).sort((a, b) => b.y - a.y || a.x - b.x);
    let cur = null;
    for (const it of sorted) {
      if (!cur || Math.abs(cur.y - it.y) > 3) {
        cur = { y: it.y, parts: [] };
        lines.push(cur);
      }
      cur.parts.push(String(it.str).trim());
    }
  }
  const text = lines.map((l) => l.parts.join(' ')).join('\n');
  const re = /([A-Z][a-z]{2} \d{1,2}, \d{4})\s+(?:(\d{1,2}:\d{2}\s?(?:am|pm)?)\s+)?(.+?)\s+(DEBIT|CREDIT)\s+(?:₹|Rs\.?|INR)?\s?([\d,]+(?:\.\d{1,2})?)([\s\S]*?)(?=\n[A-Z][a-z]{2} \d{1,2}, \d{4}|$)/gi;
  const rows = [];
  for (const m of text.matchAll(re)) {
    rows.push({ date: parseDate(m[1]), time: m[2] ?? null, lines: [m[3], ...m[6].split('\n').map((s) => s.trim()).filter(Boolean)], type: /debit/i.test(m[4]) ? 'out' : 'in', amount: toPaise(m[5]) });
  }
  return rows;
}

/** The statement's period, e.g. "01 Oct, 2026 - 31 Oct, 2026", if printed. */
export function statementPeriod(pages) {
  for (const items of pages) {
    for (const i of items) {
      const m = String(i.str).match(/(\d{1,2} [A-Za-z]{3},? \d{4}|[A-Za-z]{3} \d{1,2}, \d{4})\s*(?:-|–|to)\s*(\d{1,2} [A-Za-z]{3},? \d{4}|[A-Za-z]{3} \d{1,2}, \d{4})/);
      if (m) return { from: parseDate(m[1]), to: parseDate(m[2]) };
    }
  }
  return null;
}

/**
 * All rows of a statement as transactions (amounts in paise). Rows missing a date or amount are
 * returned in `skipped` so the app can say how many could not be read.
 */
export function parsePhonePeStatement(pages) {
  let rows = pages.flatMap((items) => pageRows(items));
  // No table layout found (or it didn't line up): read the text line by line instead.
  if (!rows.some((r) => r.date && r.amount)) rows = streamRows(pages);
  const txns = [];
  let skipped = 0;
  for (const r of rows) {
    const d = readDetails(r.lines);
    const direction = r.type ?? d.hint;
    if (!r.date || !r.amount || !direction) {
      skipped += 1;
      continue;
    }
    txns.push({
      date: r.date,
      time: r.time ?? null,
      direction,
      amount: r.amount,
      counterparty: d.counterparty || null,
      details: d.details,
      reference: d.reference ?? null,
      utr: d.utr ?? null,
      account: d.account ?? null,
    });
  }
  return { txns, skipped, period: statementPeriod(pages) };
}

/** "RAHUL KUMAR" → "Rahul Kumar"; mixed-case names are kept as printed. */
function displayName(s) {
  if (!s || /[a-z]/.test(s)) return s;
  return s.toLowerCase().replace(/(^|[\s.(&/-])([a-z])/g, (m, a, b) => a + b.toUpperCase());
}

/** Statement rows → the app's transaction events. */
export function phonePeEvents(parsed, { messageId = null, fileName = null } = {}) {
  return parsed.txns.map((t, i) => ({
    kind: 'txn',
    source: 'phonepe',
    rowId: `pp:${t.reference ?? t.utr ?? `${t.date}:${t.direction}:${t.amount}:${i}`}`,
    messageId,
    fileName,
    date: t.date,
    direction: t.direction,
    amount: t.amount,
    counterparty: displayName(t.counterparty),
    method: 'UPI',
    institution: 'PhonePe',
    account: t.account,
    reference: t.reference,
    utr: t.utr,
    description: t.details,
    confidence: 0.98,
  }));
}

/** Is this email a PhonePe statement? */
export const isPhonePeStatement = (from, subject) => /phonepe/i.test(`${from} ${subject}`) && /statement/i.test(subject);
