import { parseRupees } from './format.js';

/**
 * Bank statement import (CSV exported from net banking). Finds the header row, maps columns by name
 * (Date / Narration / Withdrawal / Deposit / Ref / Balance, or Amount + Dr/Cr), and reads the
 * payee out of UPI, NEFT, IMPS and card narrations. Rows get a stable id from their content, so
 * importing the same statement twice adds nothing.
 */

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  const s = String(text).replace(/^﻿/, '');
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (quoted) {
      if (c === '"' && s[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',' || c === ';' || c === '\t') {
      row.push(cell.trim());
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && s[i + 1] === '\n') i++;
      row.push(cell.trim());
      if (row.some((x) => x !== '')) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x !== '')) rows.push(row);
  return rows;
}

const COLS = {
  date: /^(txn\.?|transaction|tran|value|posting|book(ing)?)?\s*date$|^date$/i,
  description: /narration|description|particulars|remarks|details|transaction details/i,
  debit: /withdraw|debit|^dr\.?$|paid out|amount out/i,
  credit: /deposit|credit|^cr\.?$|paid in|amount in/i,
  amount: /^(txn |transaction )?amount( \(inr\))?$|^amount$/i,
  drcr: /^(dr\s*\/\s*cr|cr\s*\/\s*dr|type|debit\s*\/\s*credit)$/i,
  reference: /ref|chq|cheque|utr|reference/i,
  balance: /balance/i,
};

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

export function parseDate(s) {
  const t = String(s).trim();
  let m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;
  m = t.match(/^(\d{1,2})[\/\-. ]([a-z]{3,9}|\d{1,2})[\/\-. ,]+(\d{2,4})/i);
  if (!m) return null;
  const mo = /\d/.test(m[2]) ? Number(m[2]) : MONTHS.indexOf(m[2].slice(0, 3).toLowerCase()) + 1;
  let y = Number(m[3]);
  if (y < 100) y += 2000;
  const d = Number(m[1]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const STOP = /^(?:(?:neft|imps|rtgs|upi|ach|nach|ecs|pos|atm)\s*(?:cr|dr|in|out)?|upi|p2a|p2m|p2p|dr|cr|atw|nwd|mb|ib|inb|transfer|trf|payment|pay|sent|received|to|from|by|bil|onl|ft|mmt|collect|paid via|via|ref|yes|ok|na|null)$/i;
const IFSC = /^[A-Z]{4}0[A-Z0-9]{6}$/;

function titleCase(s) {
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase());
}

/** Payee, UPI ID, method and reference from a bank narration. */
export function readNarration(text) {
  const raw = String(text ?? '');
  const method = /\bupi\b/i.test(raw) ? 'UPI' : /\bneft\b/i.test(raw) ? 'NEFT' : /\bimps\b|\bmmt\b/i.test(raw) ? 'IMPS' : /\brtgs\b/i.test(raw) ? 'RTGS' : /\b(ach|nach|ecs)\b/i.test(raw) ? 'Auto-debit' : /\batm\b|\batw\b|\bnwd\b|cash wdl/i.test(raw) ? 'ATM' : /\bpos\b|\becom\b|card/i.test(raw) ? 'Card' : null;
  const reference = raw.match(/\b(\d{10,16})\b/)?.[1] ?? null;
  const parts = raw.split(/[\/\-|:]+|\s{2,}/).map((p) => p.trim()).filter(Boolean);
  const vpa = parts.map((p) => p.match(/^([a-z0-9][\w.]{1,60}@[a-z][a-z0-9]{1,20})$/i)?.[1]).find(Boolean)?.toLowerCase() ?? null;
  const name = parts.find((p) => /[a-z]{3}/i.test(p) && !STOP.test(p) && !IFSC.test(p) && !p.includes('@') && !/^\d+$/.test(p) && !/^[x*]+\d+$/i.test(p) && !/^(hdfc|icic|sbin|utib|kkbk|yesb|idfb|barb|punb)\w*$/i.test(p));
  const counterparty = name ? (name === name.toUpperCase() ? titleCase(name) : name).replace(/\s+/g, ' ').slice(0, 60) : vpa;
  return { counterparty, vpa, method, reference };
}

function hash(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * CSV text → { events, skipped, columns }. `account` is a label the user picks ("HDFC savings").
 * Throws a readable error when the file doesn't look like a statement.
 */
export function statementToEvents(text, { account = null, institution = null } = {}) {
  const rows = parseCsv(text);
  const headerIndex = rows.findIndex((r) => r.some((c) => COLS.date.test(c)) && r.some((c) => COLS.debit.test(c) || COLS.amount.test(c) || COLS.credit.test(c)));
  if (headerIndex < 0) throw new Error('Could not find the header row. The file needs Date and Withdrawal/Deposit (or Amount) columns.');
  const header = rows[headerIndex];
  const col = (re, exclude = []) => header.findIndex((h, i) => re.test(h) && !exclude.includes(i));
  const c = {};
  c.date = col(COLS.date);
  c.description = col(COLS.description);
  c.debit = col(COLS.debit);
  c.credit = col(COLS.credit, [c.debit]);
  c.amount = c.debit < 0 ? col(COLS.amount) : -1;
  c.drcr = col(COLS.drcr);
  c.reference = col(COLS.reference, [c.date, c.description, c.debit, c.credit]);
  if (c.date < 0 || (c.debit < 0 && c.credit < 0 && c.amount < 0)) throw new Error('Could not find the date and amount columns.');

  const events = [];
  let skipped = 0;
  const seen = new Map();
  for (const r of rows.slice(headerIndex + 1)) {
    const date = parseDate(r[c.date] ?? '');
    if (!date) {
      skipped += 1;
      continue;
    }
    let direction = null;
    let amount = null;
    const debit = c.debit >= 0 ? parseRupees(r[c.debit]) : null;
    const credit = c.credit >= 0 ? parseRupees(r[c.credit]) : null;
    if (debit) [direction, amount] = ['out', Math.abs(debit)];
    else if (credit) [direction, amount] = ['in', Math.abs(credit)];
    else if (c.amount >= 0) {
      const a = parseRupees(r[c.amount]);
      const flag = c.drcr >= 0 ? String(r[c.drcr]).toLowerCase() : '';
      if (a) [direction, amount] = [flag.startsWith('d') || a < 0 ? 'out' : 'in', Math.abs(a)];
    }
    if (!direction || !amount) {
      skipped += 1;
      continue;
    }
    const description = c.description >= 0 ? r[c.description] : '';
    const parsed = readNarration(description);
    const reference = (c.reference >= 0 && r[c.reference] && !/^0+$/.test(r[c.reference]) ? r[c.reference] : null) ?? parsed.reference;
    // Two identical rows on the same day are two payments, so count occurrences in the id.
    const base = `${date}|${direction}|${amount}|${description}|${reference ?? ''}`;
    const n = (seen.get(base) ?? 0) + 1;
    seen.set(base, n);
    events.push({ kind: 'txn', source: 'statement', rowId: hash(`${base}|${n}`), date, direction, amount, ...parsed, reference, description, account, institution, confidence: 0.9 });
  }
  return { events, skipped, columns: Object.fromEntries(Object.entries(c).filter(([, i]) => i >= 0).map(([k, i]) => [k, header[i]])) };
}
