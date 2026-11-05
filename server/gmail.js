import { googleFetch } from './google.js';
import { HttpError } from './http.js';
import { gmailQuery, parseEmail } from './parse/index.js';
import { attachmentNames, extractBody } from './parse/text.js';
import { aiAvailable, refineLoanEvent } from './ai.js';
import { readPhonePePdf } from './phonepe.js';
import { isPhonePeStatement, phonePeEvents } from '../src/core/phonepe.js';

const API = 'https://gmail.googleapis.com/gmail/v1/users/me';
const PAGE_SIZE = 40;
const CONCURRENCY = 6;

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

function pdfParts(part, out = []) {
  if (!part) return out;
  if ((part.mimeType === 'application/pdf' || /\.pdf$/i.test(part.filename ?? '')) && (part.body?.attachmentId || part.body?.data)) out.push(part);
  part.parts?.forEach((p) => pdfParts(p, out));
  return out;
}

const b64 = (s) => Buffer.from(String(s).replace(/-/g, '+').replace(/_/g, '/'), 'base64');

/**
 * A PhonePe statement email: every PDF attached is read in memory and turned into transactions.
 * Also returns a `statement` record (period, rows, or "locked") for the Settings page.
 */
async function readStatementEmail(session, id, msg, email, password) {
  const out = [];
  for (const part of pdfParts(msg.payload).slice(0, 3)) {
    const base = { kind: 'statement', id: `${id}:${part.partId ?? part.filename}`, messageId: id, subject: email.subject, date: email.date, fileName: part.filename || 'statement.pdf' };
    try {
      const data = part.body.data ?? (await (await googleFetch(session, `${API}/messages/${id}/attachments/${part.body.attachmentId}`)).json()).data;
      const parsed = await readPhonePePdf(b64(data), password);
      out.push({ ...base, status: parsed.txns.length ? 'read' : 'empty', period: parsed.period, rows: parsed.txns.length, skipped: parsed.skipped });
      out.push(...phonePeEvents(parsed, { messageId: id, fileName: base.fileName }));
    } catch (err) {
      if (err instanceof HttpError && err.code === 'statement_password') out.push({ ...base, status: err.extra.wrongPassword ? 'wrong_password' : 'locked' });
      else if (err instanceof HttpError && err.code !== 'statement_unreadable') throw err;
      else out.push({ ...base, status: 'unreadable' });
    }
  }
  return out;
}

const header = (payload, name) => payload?.headers?.find((h) => h.name.toLowerCase() === name)?.value ?? '';

function localIso(ms) {
  // Gmail's internalDate is UTC; Indian users read dates in IST.
  return new Date(ms + 5.5 * 3600_000).toISOString().slice(0, 10);
}

/**
 * One page of the scan: lists up to PAGE_SIZE matching messages and parses each. The browser calls
 * this repeatedly with `pageToken` until the window is covered, so no single request runs long.
 * Message bodies are read in memory and discarded; only the parsed fields are returned.
 */
export async function scanPage(session, { after, before, pageToken, aiBudget = 4, password = null, messageIds = null } = {}) {
  if (!session.gmail) throw new HttpError(403, 'scope_missing', 'Gmail access was not granted. Sign in again and allow "Read your email".');
  let list = { messages: (messageIds ?? []).map((id) => ({ id })) };
  if (!messageIds) {
    const params = new URLSearchParams({ q: gmailQuery({ after, before }), maxResults: String(PAGE_SIZE) });
    if (pageToken) params.set('pageToken', pageToken);
    list = await (await googleFetch(session, `${API}/messages?${params}`)).json();
  }
  const ids = (list.messages ?? []).map((m) => m.id);
  let aiLeft = aiAvailable() ? aiBudget : 0;
  const results = await mapLimit(ids, CONCURRENCY, async (id) => {
    const msg = await (await googleFetch(session, `${API}/messages/${id}?format=full`)).json();
    const email = {
      id,
      from: header(msg.payload, 'from'),
      subject: header(msg.payload, 'subject'),
      date: localIso(Number(msg.internalDate ?? Date.now())),
      snippet: msg.snippet ?? '',
      body: extractBody(msg.payload),
      attachments: attachmentNames(msg.payload),
    };
    if (isPhonePeStatement(email.from, email.subject)) return readStatementEmail(session, id, msg, email, password);
    let events;
    try {
      events = parseEmail(email);
    } catch {
      events = [];
    }
    // Loan closure, NOC and unclear loan emails are worth a careful read when AI extraction is set up.
    for (let i = 0; i < events.length; i++) {
      const e = events[i];
      if (e.kind === 'loan' && aiLeft > 0 && (e.purpose === 'noc' || e.purpose === 'closure' || e.purpose === 'sanction' || e.confidence < 0.7)) {
        aiLeft -= 1;
        events[i] = await refineLoanEvent(e, email);
      }
    }
    return events.filter(Boolean);
  });
  return {
    events: results.flat(),
    scanned: ids.length,
    nextPageToken: list.nextPageToken ?? null,
  };
}
