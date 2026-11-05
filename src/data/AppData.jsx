import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api, ApiError } from './api';
import { requestGoogleCode } from './google';
import { addDays, addMonths, todayIso, uid } from '@/core/format';
import { editTransaction, emptyStore, ingestEvents, newRule, normalise, patchRecord, putRecord, removeRecord, withAudit } from '@/core/store';
import { deleteData, loadData, saveData } from './localdb';
import { buildTransactions } from '@/core/transactions';
import { deriveSubscriptions } from '@/core/subscriptions';
import { deriveLoans, loanRecordFrom } from '@/core/loans';
import { statementToEvents } from '@/core/csv';

/**
 * Everything the app knows lives here: the Google session, the user's data (kept on this device in
 * IndexedDB), the Gmail scan, and every action that changes data.
 * Pages read derived views (transactions, subscriptions, loans) and call actions; nothing else
 * touches storage.
 */
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

const SCAN_STALE_MS = 6 * 3600_000;

export function AppDataProvider({ children }) {
  const [session, setSession] = useState({ status: 'loading' });
  const [store, setStore] = useState(emptyStore());
  const [dataState, setDataState] = useState({ status: 'idle', error: null });
  const [scan, setScan] = useState({ running: false, scanned: 0, found: 0, pausedUntil: null, error: null });
  const storeRef = useRef(store);
  const saveTimer = useRef(null);
  const scanning = useRef(false);
  const emailRef = useRef(null);
  const email = session.user?.email ?? null;

  storeRef.current = store;
  emailRef.current = email;

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

  // ── Load + save (on this device) ────────────────────────────────────────
  const persist = useCallback((now = false) => {
    clearTimeout(saveTimer.current);
    const write = () => {
      const who = emailRef.current;
      if (!who) return;
      saveData(who, storeRef.current).catch((err) => setDataState((d) => ({ ...d, error: err.message })));
    };
    if (now) write();
    else saveTimer.current = setTimeout(write, 400);
  }, []);

  useEffect(() => {
    if (!email) return undefined;
    let cancelled = false;
    setDataState({ status: 'loading', error: null });
    loadData(email).then((data) => {
      if (cancelled) return;
      const loaded = normalise(data);
      storeRef.current = loaded;
      setStore(loaded);
      setDataState({ status: 'ready', error: null });
    });
    return () => {
      cancelled = true;
    };
  }, [email]);

  // Save straight away when the tab is hidden or closed.
  useEffect(() => {
    const h = () => {
      if (document.visibilityState === 'hidden') persist(true);
    };
    document.addEventListener('visibilitychange', h);
    window.addEventListener('pagehide', h);
    return () => {
      document.removeEventListener('visibilitychange', h);
      window.removeEventListener('pagehide', h);
    };
  }, [persist]);

  /** Applies a change: updates the screen and saves on this device. */
  const update = useCallback(
    (fn) => {
      const next = fn(storeRef.current);
      if (next === storeRef.current) return;
      storeRef.current = next;
      setStore(next);
      persist();
    },
    [persist],
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

  /** Signs out. Data stays on this device for next time unless `forget` is set. */
  const signOut = useCallback(
    async ({ disconnect = false, forget = false } = {}) => {
      persist(true);
      await api('logout', { method: 'POST', body: { disconnect } }).catch(() => undefined);
      if (forget && email) await deleteData(email);
      const empty = emptyStore();
      storeRef.current = empty;
      setStore(empty);
      setSession((s) => ({ ...s, user: null, access: null }));
    },
    [email, persist],
  );

  // ── Gmail scan ────────────────────────────────────────────────────────
  /**
   * Reads one window of Gmail page by page. After every page the new transactions and the position
   * (`sync.pending`) are saved, so reloading or switching pages mid-scan resumes instead of restarting.
   */
  const runScan = useCallback(
    async ({ after, before, pageToken: startToken = null }) => {
      if (scanning.current) return;
      scanning.current = true;
      setScan({ running: true, scanned: 0, found: 0, pausedUntil: null, error: null });
      let pageToken = startToken;
      let scanned = 0;
      let found = 0;
      const savePending = (token) => {
        const s = storeRef.current;
        storeRef.current = { ...s, sync: { ...s.sync, pending: { after: after ?? null, before: before ?? null, pageToken: token } } };
      };
      try {
        savePending(pageToken);
        do {
          let page;
          try {
            page = await api('gmail', { method: 'POST', body: { after, before, pageToken } });
          } catch (err) {
            if (err instanceof ApiError && err.code === 'rate_limited') {
              const wait = Math.min(120, err.body.retryAfter ?? 30);
              setScan((x) => ({ ...x, pausedUntil: Date.now() + wait * 1000 }));
              await new Promise((r) => setTimeout(r, wait * 1000));
              setScan((x) => ({ ...x, pausedUntil: null }));
              continue;
            }
            // An expired page token: start this window again from its newest page.
            if (err instanceof ApiError && err.status === 400 && pageToken) {
              pageToken = null;
              continue;
            }
            throw err;
          }
          scanned += page.scanned;
          found += page.events.length;
          storeRef.current = ingestEvents(storeRef.current, page.events, 'gmail');
          pageToken = page.nextPageToken;
          savePending(pageToken);
          setStore(storeRef.current);
          persist(true);
          setScan((x) => ({ ...x, scanned, found }));
        } while (pageToken);
        const s = storeRef.current;
        storeRef.current = {
          ...s,
          updatedAt: new Date().toISOString(),
          sync: {
            lastScanAt: new Date().toISOString(),
            scannedFrom: [s.sync.scannedFrom, after].filter(Boolean).sort()[0] ?? after ?? null,
            scannedTo: before && s.sync.scannedTo ? s.sync.scannedTo : todayIso(),
            messages: (s.sync.messages ?? 0) + scanned,
            pending: null,
          },
        };
        setStore(storeRef.current);
        persist(true);
        setScan({ running: false, scanned, found, pausedUntil: null, error: null, finishedAt: Date.now() });
      } catch (err) {
        setStore(storeRef.current);
        persist(true);
        setScan({ running: false, scanned, found, pausedUntil: null, error: err.message, code: err.code });
        if (err.code === 'reconnect' || err.code === 'signed_out') setSession((x) => ({ ...x, needsReconnect: true }));
      } finally {
        scanning.current = false;
      }
    },
    [persist],
  );

  /** New mail since the last scan (or the first 12 months on a new account). Resumes an unfinished scan first. */
  const syncNow = useCallback(() => {
    const s = storeRef.current.sync;
    if (s.pending) return runScan(s.pending);
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

  // Once per sign-in: resume an interrupted scan, or check for new mail if the last one is old.
  const autoSynced = useRef(null);
  useEffect(() => {
    if (!email || !session.access?.gmail || dataState.status !== 'ready' || autoSynced.current === email) return;
    autoSynced.current = email;
    const s = storeRef.current.sync;
    const last = Date.parse(s.lastScanAt ?? '') || 0;
    if (s.pending || Date.now() - last > SCAN_STALE_MS) syncNow();
  }, [email, session.access?.gmail, dataState.status, syncNow]);

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
        if (email) await deleteData(email);
        const empty = emptyStore();
        storeRef.current = empty;
        setStore(empty);
        toast.success('All Recundle data on this device was deleted.');
      },
    }),
    [update, email],
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
  };
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}
