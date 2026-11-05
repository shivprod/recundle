import { googleFetch } from './google.js';
import { HttpError } from './http.js';
import { gmailQuery, parseEmail } from './parse/index.js';
import { attachmentNames, extractBody } from './parse/text.js';
import { aiAvailable, refineLoanEvent } from './ai.js';

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
export async function scanPage(session, { after, before, pageToken, aiBudget = 4 } = {}) {
  if (!session.gmail) throw new HttpError(403, 'scope_missing', 'Gmail access was not granted. Sign in again and allow "Read your email".');
  const params = new URLSearchParams({ q: gmailQuery({ after, before }), maxResults: String(PAGE_SIZE) });
  if (pageToken) params.set('pageToken', pageToken);
  const list = await (await googleFetch(session, `${API}/messages?${params}`)).json();
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
