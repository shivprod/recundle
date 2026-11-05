import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from './api';
import { requestGoogleCode } from './google';
import { addDays, addMonths, todayIso, uid } from '@/core/format';
import { editTransaction, emptyStore, ingestEvents, mergeStores, newRule, normalise, patchRecord, putRecord, removeRecord, withAudit } from '@/core/store';
import { buildTransactions } from '@/core/transactions';
import { deriveSubscriptions } from '@/core/subscriptions';
import { deriveLoans, loanRecordFrom } from '@/core/loans';
import { statementToEvents } from '@/core/csv';

/**
 * Everything the app knows lives here: the Google session, the user's data (synced to their Google
 * Drive app folder, cached on this device), the Gmail scan, and every action that changes data.
 * Pages read derived views (transactions, subscriptions, loans) and call actions; nothing else
 * touches storage.
 */
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const cacheKey = (email) => `recundle.data.${email}`;
const readCache = (email) => {
  try {
    const raw = localStorage.getItem(cacheKey(email));
    return raw ? normalise(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
};
const writeCache = (email, data) => {
  try {
    localStorage.setItem(cacheKey(email), JSON.stringify(data));
  } catch {
    // Storage full or blocked: Drive still holds the data.
  }
};
const SCAN_STALE_MS = 6 * 3600_000;

export function AppDataProvider({ children }) {
  const [session, setSession] = useState({ status: 'loading' });
  const [store, setStore] = useState(emptyStore());
  const [dataState, setDataState] = useState({ status: 'idle', version: null, error: null, localOnly: false });
  const [scan, setScan] = useState({ running: false, scanned: 0, found: 0, pausedUntil: null, error: null });
  const versionRef = useRef(null);
  const storeRef = useRef(store);
  const dirtyRef = useRef(false);
  const saveTimer = useRef(null);
  const scanning = useRef(false);
  const email = session.user?.email ?? null;

  storeRef.current = store;

  // ── Session ────────────────────────────────────────────────────────────
  const refreshSession = useCallback(async () => {
    try {
      const s = await api('session');
      setSession({ status: 'ready', ...s });
      return s;
    } catch {
      setSession({ status: 'ready', configured: false, user: null, error: 'Could not reach the Recundle server.' });
      return null;
    }
  }, []);
  useEffect(() => {
    refreshSession();
  }, [refreshSession]);

  // ── Load + save ───────────────────────────────────────────────────────
  const save = useCallback(
    async (attempt = 0) => {
      if (!email || !session.access?.drive) return;
      clearTimeout(saveTimer.current);
      dirtyRef.current = false;
      setDataState((d) => ({ ...d, status: 'saving' }));
      try {
        const { version } = await api('data', { method: 'PUT', body: { data: storeRef.current, baseVersion: versionRef.current } });
        versionRef.current = version;
        setDataState((d) => ({ ...d, status: dirtyRef.current ? 'dirty' : 'saved', version, error: null }));
      } catch (err) {
        if (err instanceof ApiError && err.code === 'conflict' && attempt < 2) {
          // Another device saved: merge both copies record by record, then save the result.
          const merged = mergeStores(storeRef.current, err.body.data);
          versionRef.current = err.body.version;
          storeRef.current = merged;
          setStore(merged);
          writeCache(email, merged);
          return save(attempt + 1);
        }
        dirtyRef.current = true;
        setDataState((d) => ({ ...d, status: 'error', error: err.message }));
      }
    },
    [email, session.access?.drive],
  );

  const scheduleSave = useCallback(() => {
    dirtyRef.current = true;
    setDataState((d) => ({ ...d, status: 'dirty' }));
    clearTimeout(saveTimer.current);
    if (!scanning.current) saveTimer.current = setTimeout(() => save(), 1500);
  }, [save]);

  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;
    const cached = readCache(email) ?? emptyStore();
    setStore(cached);
    if (!session.access?.drive) {
      setDataState({ status: 'ready', version: null, error: null, localOnly: true });
      return undefined;
    }
    setDataState({ status: 'loading', version: null, error: null, localOnly: false });
    api('data')
      .then(({ data, version }) => {
        if (cancelled) return;
        versionRef.current = version;
        const merged = data ? mergeStores(cached, data) : cached;
        setStore(merged);
        writeCache(email, merged);
        setDataState({ status: 'ready', version, error: null, localOnly: false });
        const remoteStamp = data?.updatedAt ?? null;
        if (merged.updatedAt && merged.updatedAt !== remoteStamp) scheduleSave();
      })
      .catch((err) => {
        if (cancelled) return;
        setDataState({ status: 'error', version: null, error: err.message, localOnly: false });
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, session.access?.drive]);

  // Save straight away when the tab is hidden, so a pending edit isn't lost.
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'hidden' && dirtyRef.current && !scanning.current) save();
    };
    document.addEventListener('visibilitychange', h);
    return () => document.removeEventListener('visibilitychange', h);
  }, [save]);

  /** Applies a change to the data: updates the screen, this device's cache and (debounced) Drive. */
  const update = useCallback(
    (fn) => {
      const next = fn(storeRef.current);
      if (next === storeRef.current) return;
      storeRef.current = next;
      setStore(next);
      if (email) writeCache(email, next);
      scheduleSave();
    },
    [email, scheduleSave],
  );

  // ── Auth ───────────────────────────────────────────────────────────────
  const signIn = useCallback(async () => {
    const s = session.configured ? session : await refreshSession();
    if (!s?.configured) throw new Error('Recundle is not set up on this server yet (missing Google client secret).');
    const code = await requestGoogleCode({ clientId: s.clientId, scopes: s.scopes, hint: s.user?.email });
    const res = await api('auth', { method: 'POST', body: { code } });
    setSession((prev) => ({ ...prev, status: 'ready', user: res.user, access: res.access }));
    return res;
  }, [session, refreshSession]);

  const signOut = useCallback(
    async ({ disconnect = false } = {}) => {
      if (dirtyRef.current) await save().catch(() => undefined);
      await api('logout', { method: 'POST', body: { disconnect } }).catch(() => undefined);
      if (email) {
        try {
          localStorage.removeItem(cacheKey(email));
        } catch {
          /* ignore */
        }
      }
      versionRef.current = null;
      setStore(emptyStore());
      setSession((s) => ({ ...s, user: null, access: null }));
    },
    [email, save],
  );

  // ── Gmail scan ────────────────────────────────────────────────────────
  const runScan = useCallback(
    async ({ after, before } = {}) => {
      if (scanning.current) return;
      scanning.current = true;
      setScan({ running: true, scanned: 0, found: 0, pausedUntil: null, error: null });
      let pageToken = null;
      let scanned = 0;
      let found = 0;
      try {
        do {
          let page;
          try {
            page = await api('gmail', { method: 'POST', body: { after, before, pageToken } });
          } catch (err) {
            if (err instanceof ApiError && err.code === 'rate_limited') {
              const wait = Math.min(120, err.body.retryAfter ?? 30);
              setScan((s) => ({ ...s, pausedUntil: Date.now() + wait * 1000 }));
              await new Promise((r) => setTimeout(r, wait * 1000));
              setScan((s) => ({ ...s, pausedUntil: null }));
              continue;
            }
            throw err;
          }
          scanned += page.scanned;
          found += page.events.length;
          const next = ingestEvents(storeRef.current, page.events, 'gmail');
          storeRef.current = next;
          setStore(next);
          setScan((s) => ({ ...s, scanned, found }));
          pageToken = page.nextPageToken;
        } while (pageToken);
        const s = storeRef.current;
        const finished = {
          ...s,
          updatedAt: new Date().toISOString(),
          sync: {
            lastScanAt: new Date().toISOString(),
            scannedFrom: [s.sync.scannedFrom, after].filter(Boolean).sort()[0] ?? after,
            scannedTo: before && s.sync.scannedTo ? s.sync.scannedTo : todayIso(),
            messages: (s.sync.messages ?? 0) + scanned,
          },
        };
        storeRef.current = finished;
        setStore(finished);
        if (email) writeCache(email, finished);
        setScan({ running: false, scanned, found, pausedUntil: null, error: null, finishedAt: Date.now() });
      } catch (err) {
        setScan({ running: false, scanned, found, pausedUntil: null, error: err.message, code: err.code });
        if (err.code === 'reconnect' || err.code === 'signed_out') setSession((s) => ({ ...s, needsReconnect: true }));
      } finally {
        scanning.current = false;
        scheduleSave();
      }
    },
    [email, scheduleSave],
  );

  /** New mail since the last scan (or the first 12 months on a new account). */
  const syncNow = useCallback(() => {
    const s = storeRef.current.sync;
    const after = s.scannedTo ? addDays(s.scannedTo, -3) : addMonths(todayIso(), -12);
    return runScan({ after });
  }, [runScan]);

  /** Reads older mail, back to `months` ago. */
  const scanHistory = useCallback(
    (months) => {
      const s = storeRef.current.sync;
      const target = addMonths(todayIso(), -months);
      if (s.scannedFrom && target >= s.scannedFrom) return Promise.resolve();
      return runScan({ after: target, before: s.scannedFrom ? addDays(s.scannedFrom, 1) : undefined });
    },
    [runScan],
  );

  useEffect(() => {
    if (!email || !session.access?.gmail || dataState.status !== 'ready') return;
    const last = Date.parse(storeRef.current.sync.lastScanAt ?? '') || 0;
    if (Date.now() - last > SCAN_STALE_MS) syncNow();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, session.access?.gmail, dataState.status]);

  // ── Derived views ─────────────────────────────────────────────────────
  const today = todayIso();
  const txns = useMemo(() => buildTransactions(store, { ownNames: [session.user?.name] }), [store, session.user?.name]);
  const subscriptions = useMemo(() => deriveSubscriptions(store, txns, today), [store, txns, today]);
  const loanView = useMemo(() => deriveLoans(store, txns, today), [store, txns, today]);
  const todos = useMemo(() => Object.values(store.todos).filter((t) => !t.deleted), [store.todos]);

  // ── Actions ────────────────────────────────────────────────────────────
  const actions = useMemo(
    () => ({
      editTransaction: (id, fields, note) => update((s) => withAudit(editTransaction(s, id, fields), 'Edited transaction', note ?? Object.keys(fields).join(', '), id)),
      addRule: (rule) => update((s) => withAudit(putRecord(s, 'rules', newRule(rule)), 'Created rule', rule.label ?? rule.keys.join(', '))),
      updateRule: (id, patch) => update((s) => withAudit(patchRecord(s, 'rules', id, patch), 'Updated rule', patch.label ?? id, id)),
      deleteRule: (id) => update((s) => withAudit(removeRecord(s, 'rules', id), 'Deleted rule', s.rules[id]?.label ?? id, id)),
      addCategory: ({ label, kind = 'expense', parent = null, icon = 'Tag' }) => {
        const id = parent ? uid('sub') : uid('cat');
        update((s) => withAudit(putRecord(s, 'categories', { id, label, kind, parent, icon }), 'Added category', label));
        return id;
      },
      deleteCategory: (id) => update((s) => withAudit(removeRecord(s, 'categories', id), 'Deleted category', s.categories[id]?.label ?? id)),
      addManualTransaction: (t) => {
        const id = uid('m');
        update((s) => withAudit(putRecord(s, 'txns', { id, source: 'manual', raw: { ...t, source: 'manual' } }), 'Added transaction', `${t.counterparty} ${t.amount / 100}`));
        return id;
      },
      deleteManualTransaction: (id) => update((s) => withAudit(removeRecord(s, 'txns', id), 'Deleted transaction', id)),
      importStatement: (text, opts) => {
        const result = statementToEvents(text, opts);
        const before = Object.keys(storeRef.current.txns).length;
        update((s) => withAudit(ingestEvents(s, result.events, 'statement'), 'Imported statement', `${result.events.length} rows${opts?.account ? ` · ${opts.account}` : ''}`));
        return { ...result, added: Object.keys(storeRef.current.txns).length - before };
      },
      setSubscription: (key, patch) =>
        update((s) => {
          const current = s.subscriptions[key] ?? { id: key };
          return withAudit(putRecord(s, 'subscriptions', { ...current, id: key, ...patch }), patch.status ? 'Changed subscription status' : 'Edited subscription', `${key}${patch.status ? ` → ${patch.status}` : ''}`, key);
        }),
      saveLoan: (loan, patch = {}, userFields = null) =>
        update((s) => {
          const existing = loan.discovered ? null : s.loans[loan.id];
          const base = existing ?? loanRecordFrom(loan);
          const record = { ...base, ...patch, user: userFields ? { ...(base.user ?? {}), ...userFields } : base.user };
          return withAudit(putRecord(s, 'loans', record), patch.status ? `Loan status: ${patch.status}` : loan.discovered ? 'Confirmed loan' : 'Edited loan', loan.lender, record.id);
        }),
      addLoan: (fields) => {
        const id = uid('loan');
        update((s) => withAudit(putRecord(s, 'loans', { id, lender: fields.lender, account: fields.account || null, loanType: fields.loanType, status: 'active', eventKeys: [], user: fields }), 'Added loan', fields.lender, id));
        return id;
      },
      deleteLoan: (loan) =>
        update((s) => {
          let next = s;
          // "Not a loan": hide the emails it was built from so it isn't rediscovered.
          for (const k of loan.eventKeys ?? []) next = patchRecord(next, 'loanEvents', k, { dismissed: true });
          if (!loan.discovered) next = removeRecord(next, 'loans', loan.id);
          return withAudit(next, 'Removed loan', loan.lender, loan.id);
        }),
      assignLoanEvent: (messageId, loan) =>
        update((s) => {
          const record = loan.discovered ? loanRecordFrom(loan) : s.loans[loan.id];
          const next = putRecord(s, 'loans', { ...record, eventKeys: [...new Set([...(record.eventKeys ?? []), messageId])] });
          return withAudit(next, 'Matched email to loan', loan.lender, record.id);
        }),
      saveTodo: (todo) => {
        const id = todo.id ?? uid('todo');
        update((s) => putRecord(s, 'todos', { status: 'pending', createdAt: new Date().toISOString(), ...s.todos[id], ...todo, id }));
        return id;
      },
      setTodoStatus: (id, status) => update((s) => patchRecord(s, 'todos', id, { status, completedAt: status === 'completed' ? new Date().toISOString() : null })),
      deleteTodo: (id) => update((s) => removeRecord(s, 'todos', id)),
      exportData: () => {
        const blob = new Blob([JSON.stringify(storeRef.current, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `recundle-data-${todayIso()}.json`;
        a.click();
        URL.revokeObjectURL(a.href);
      },
      deleteAllData: async () => {
        if (session.access?.drive) await api('data', { method: 'DELETE' });
        versionRef.current = null;
        const empty = emptyStore();
        storeRef.current = empty;
        setStore(empty);
        if (email) writeCache(email, empty);
        dirtyRef.current = false;
        toast.success('All Recundle data was deleted.');
      },
    }),
    [update, session.access?.drive, email],
  );

  const value = {
    session,
    signIn,
    signOut,
    refreshSession,
    store,
    dataState,
    scan,
    syncNow,
    scanHistory,
    txns,
    subscriptions,
    loans: loanView.loans,
    unmatchedLoanEmails: loanView.unmatched,
    todos,
    today,
    actions,
    saveNow: save,
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
