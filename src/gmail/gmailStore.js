import { callRecundleApi, GmailApiError } from './api';
import { requestGmailCode } from './googleCodeClient';

/**
 * Per-user Gmail connection and receipt sync.
 *
 * The recundle session (the Google refresh token, sealed with the
 * server's key) and the parsed receipts are kept on this device only, like the
 * Android app keeps them on the phone. Nothing Gmail-related is written to the
 * shared database.
 */

// Background backfill stops after this many pages (60 emails each).
const MAX_BACKFILL_PAGES = 10;
const SIGNED_OUT_CODES = new Set(['signed_out', 'consent_revoked', 'gmail_not_granted']);

const EMPTY_SYNC = {
  status: 'idle', // idle | syncing | done | error
  events: [],
  syncedAt: null,
  backfillBefore: null,
  backfillComplete: false,
  scanned: 0,
  error: null,
};

let state = { userId: null, connection: null, skipped: false, needsReconnect: false, sync: EMPTY_SYNC };
let running = null;
// Bumped whenever the connection is replaced so in-flight syncs stop writing.
let generation = 0;
const listeners = new Set();

const key = (kind, userId) => `recundle.gmail.${kind}.${userId}`;

function read(kind, userId) {
  try {
    const raw = localStorage.getItem(key(kind, userId));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function write(kind, userId, value) {
  try {
    if (value === null) localStorage.removeItem(key(kind, userId));
    else localStorage.setItem(key(kind, userId), JSON.stringify(value));
  } catch {
    // Storage unavailable: the connection lasts for this visit only.
  }
}

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function setSync(userId, next, gen = generation) {
  if (state.userId !== userId || gen !== generation) return;
  const sync = { ...state.sync, ...next };
  setState({ sync });
  const { status, error, ...persisted } = sync;
  write('receipts', userId, persisted);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return state;
}

/** Loads the stored connection for a user (no network). */
export function loadGmailState(userId) {
  if (state.userId === userId) return;
  running = null;
  generation += 1;
  if (!userId) {
    setState({ userId: null, connection: null, skipped: false, needsReconnect: false, sync: EMPTY_SYNC });
    return;
  }
  const stored = read('receipts', userId);
  setState({
    userId,
    connection: read('connection', userId),
    skipped: Boolean(read('skipped', userId)),
    needsReconnect: false,
    sync: { ...EMPTY_SYNC, ...(stored ?? {}), status: 'idle', error: null },
  });
}

function mergeEvents(existing, incoming) {
  const byId = new Map(existing.map((e) => [e.id, e]));
  incoming.forEach((e) => byId.set(e.id, e));
  return [...byId.values()].sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
}

async function fetchPage(userId, params) {
  const res = await callRecundleApi('receipts', { session: state.connection?.session, ...params });
  const events = mergeEvents(state.sync.events, res.events ?? []);
  return { res, events };
}

async function runSync(userId) {
  const gen = generation;
  const alive = () => state.userId === userId && gen === generation;
  const first = !state.sync.syncedAt;
  setSync(userId, { status: 'syncing', error: null }, gen);

  try {
    if (first) {
      const { res, events } = await fetchPage(userId, {});
      setSync(userId, {
        events,
        syncedAt: res.syncedAt,
        scanned: state.sync.scanned + (res.scanned ?? 0),
        backfillBefore: res.backfill?.before ?? null,
        backfillComplete: res.backfill?.complete ?? true,
      }, gen);
    } else {
      const { res, events } = await fetchPage(userId, { since: state.sync.syncedAt });
      setSync(userId, { events, syncedAt: res.syncedAt, scanned: state.sync.scanned + (res.scanned ?? 0) }, gen);
    }

    let pages = 0;
    while (alive() && !state.sync.backfillComplete && state.sync.backfillBefore && pages < MAX_BACKFILL_PAGES) {
      const { res, events } = await fetchPage(userId, { before: state.sync.backfillBefore });
      pages += 1;
      setSync(userId, {
        events,
        scanned: state.sync.scanned + (res.scanned ?? 0),
        backfillBefore: res.backfill?.before ?? null,
        backfillComplete: res.backfill?.complete ?? true,
      }, gen);
    }

    setSync(userId, { status: 'done' }, gen);
  } catch (err) {
    if (!alive()) return;
    if (err instanceof GmailApiError && SIGNED_OUT_CODES.has(err.code)) {
      setState({ needsReconnect: true });
    }
    setSync(userId, { status: 'error', error: err?.message || 'Sync failed.' }, gen);
  }
}

/** Starts (or joins) a receipt sync for the user; resolves when it finishes. */
export function syncReceipts(userId) {
  if (!userId || state.userId !== userId || !state.connection) return Promise.resolve();
  if (!running) {
    const current = runSync(userId).finally(() => {
      if (running === current) running = null;
    });
    running = current;
  }
  return running;
}

/**
 * Asks Google for read-only Gmail access, exchanges the code for a sealed
 * session and starts the first sync in the background. Resolves with the
 * Google account `{ email, name }` as soon as the connection is saved.
 */
export async function connectGmail(userId, { loginHint } = {}) {
  const code = await requestGmailCode({ loginHint });
  const res = await callRecundleApi('auth', { serverAuthCode: code, redirectUri: 'postmessage' });
  if (state.userId !== userId) return res.user;

  const connection = { session: res.session, email: res.user?.email ?? null, name: res.user?.name ?? null, connectedAt: new Date().toISOString() };
  write('connection', userId, connection);
  write('skipped', userId, null);
  write('receipts', userId, null);
  generation += 1;
  running = null;
  setState({ sync: EMPTY_SYNC, connection, skipped: false, needsReconnect: false });
  syncReceipts(userId);
  return res.user;
}

export function skipGmail(userId) {
  if (!userId) return;
  write('skipped', userId, true);
  if (state.userId === userId) setState({ skipped: true });
}

/** Revokes Google access and forgets the session and receipts on this device. */
export async function disconnectGmail(userId) {
  const session = state.userId === userId ? state.connection?.session : read('connection', userId)?.session;
  running = null;
  generation += 1;
  write('connection', userId, null);
  write('receipts', userId, null);
  if (state.userId === userId) {
    setState({ connection: null, needsReconnect: false, sync: EMPTY_SYNC });
  }
  if (session) {
    await callRecundleApi('revoke', { session }).catch(() => undefined);
  }
}
