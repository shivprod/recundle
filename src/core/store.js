import { uid } from './format.js';

/**
 * The persisted shape. Each collection is a map of records with `updatedAt`; deletions are kept as
 * tombstones (`deleted: true`) so two devices can be merged record by record (newer wins).
 * `raw` fields come from Gmail or an imported statement and are never edited; everything the user
 * changes lives in `user`, which always takes precedence.
 */
export const COLLECTIONS = ['txns', 'subEvents', 'loanEvents', 'rules', 'categories', 'subscriptions', 'loans', 'todos'];

export function emptyStore() {
  return {
    app: 'recundle',
    version: 1,
    updatedAt: null,
    ...Object.fromEntries(COLLECTIONS.map((c) => [c, {}])),
    audit: [],
    sync: { lastScanAt: null, scannedFrom: null, scannedTo: null, messages: 0 },
  };
}

export function normalise(data) {
  const base = emptyStore();
  if (!data || data.app !== 'recundle') return base;
  const out = { ...base, ...data, sync: { ...base.sync, ...(data.sync ?? {}) } };
  for (const c of COLLECTIONS) out[c] = { ...(data[c] ?? {}) };
  out.audit = Array.isArray(data.audit) ? data.audit : [];
  return out;
}

const newer = (a, b) => ((a?.updatedAt ?? '') >= (b?.updatedAt ?? '') ? a : b);

/** Record-by-record merge of two copies (this device and Drive). Newer edits win. */
export function mergeStores(a, b) {
  const A = normalise(a);
  const B = normalise(b);
  const out = emptyStore();
  for (const c of COLLECTIONS) {
    const keys = new Set([...Object.keys(A[c]), ...Object.keys(B[c])]);
    for (const k of keys) out[c][k] = A[c][k] && B[c][k] ? newer(A[c][k], B[c][k]) : (A[c][k] ?? B[c][k]);
  }
  const seen = new Set();
  out.audit = [...A.audit, ...B.audit]
    .filter((e) => {
      const key = `${e.at}|${e.action}|${e.ref ?? ''}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((x, y) => (x.at < y.at ? 1 : -1))
    .slice(0, 400);
  out.sync = {
    lastScanAt: [A.sync.lastScanAt, B.sync.lastScanAt].filter(Boolean).sort().pop() ?? null,
    scannedFrom: [A.sync.scannedFrom, B.sync.scannedFrom].filter(Boolean).sort()[0] ?? null,
    scannedTo: [A.sync.scannedTo, B.sync.scannedTo].filter(Boolean).sort().pop() ?? null,
    messages: Math.max(A.sync.messages ?? 0, B.sync.messages ?? 0),
  };
  out.updatedAt = [A.updatedAt, B.updatedAt].filter(Boolean).sort().pop() ?? null;
  return out;
}

const now = () => new Date().toISOString();

/** Audit trail for changes that matter financially (edits, rules, loan status, deletions). */
export function withAudit(store, action, detail, ref = null) {
  return { ...store, audit: [{ at: now(), action, detail, ref }, ...store.audit].slice(0, 400) };
}

export function putRecord(store, collection, record) {
  const stamped = { ...record, updatedAt: now() };
  return { ...store, updatedAt: stamped.updatedAt, [collection]: { ...store[collection], [record.id]: stamped } };
}

export function patchRecord(store, collection, id, patch) {
  const current = store[collection][id];
  if (!current) return store;
  return putRecord(store, collection, { ...current, ...patch });
}

export function removeRecord(store, collection, id) {
  const current = store[collection][id];
  if (!current) return store;
  return putRecord(store, collection, { id, deleted: true });
}

export const live = (map) => Object.values(map ?? {}).filter((r) => !r.deleted);

/** Updates a transaction's user overrides. `null` clears a field back to automatic. */
export function editTransaction(store, id, fields) {
  const t = store.txns[id];
  if (!t) return store;
  const user = { ...(t.user ?? {}) };
  for (const [k, v] of Object.entries(fields)) {
    if (v === null || v === undefined) delete user[k];
    else user[k] = v;
  }
  return putRecord(store, 'txns', { ...t, user });
}

/**
 * Adds parsed Gmail events (or statement rows) to the store. Existing records keep their user edits;
 * events already stored are skipped so a rescan doesn't churn timestamps.
 */
export function ingestEvents(store, events, source = 'gmail') {
  let next = store;
  const add = (collection, id, record) => {
    if (next[collection][id]) return;
    const stamped = { ...record, id, updatedAt: now() };
    next = { ...next, updatedAt: stamped.updatedAt, [collection]: { ...next[collection], [id]: stamped } };
  };
  for (const e of events) {
    if (e.kind === 'txn') {
      const { kind, ...raw } = e;
      add('txns', `${source === 'gmail' ? 'g' : 's'}:${e.messageId ?? e.rowId}`, { source, raw });
    } else if (e.kind === 'sub') add('subEvents', e.messageId, e);
    else if (e.kind === 'loan') add('loanEvents', e.messageId, e);
  }
  return next;
}

export function newRule({ keys, direction, set, amount = null, label }) {
  return { id: uid('rule'), keys, direction, set, amount, label, createdAt: now() };
}
