import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { api } from './api';
import { requestGoogleCode } from './google';
import { todayIso, uid } from '@/core/format';
import { dropEmailData, editTransaction, emptyStore, ingestEvents, newRule, normalise, patchRecord, putRecord, removeRecord, withAudit } from '@/core/store';
import { deleteData, loadData, loadSetting, saveData, saveSetting } from './localdb';
import { phonePeEvents } from '@/core/phonepe';
import { buildTransactions } from '@/core/transactions';
import { deriveSubscriptions } from '@/core/subscriptions';
import { deriveLoans, loanRecordFrom } from '@/core/loans';
import { statementToEvents } from '@/core/csv';

/**
 * Everything the app knows lives here: the Google session, the user's data (kept on this device in
 * IndexedDB), reading PhonePe statements from the Google Drive folder, and every action that changes data.
 * Pages read derived views (transactions, subscriptions, loans) and call actions; nothing else
 * touches storage.
 */
const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);



export function AppDataProvider({ children }) {
  const [session, setSession] = useState({ status: 'loading' });
  const [store, setStore] = useState(emptyStore());
  const [dataState, setDataState] = useState({ status: 'idle', error: null });
  const [drive, setDrive] = useState({ running: false, files: 0, read: 0, total: 0, error: null, checkedAt: null });
  const driveBusy = useRef(false);
  const sessionRef = useRef(null);
  const storeRef = useRef(store);
  const saveTimer = useRef(null);
  const [ppPassword, setPpPassword] = useState(null);
  const ppRef = useRef(null);
  const emailRef = useRef(null);
  const email = session.user?.email ?? null;

  storeRef.current = store;
  emailRef.current = email;
  sessionRef.current = session;

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
    loadSetting(email, 'phonepePassword').then((v) => {
      if (cancelled) return;
      ppRef.current = v;
      setPpPassword(v);
    });
    loadData(email).then((data) => {
      if (cancelled) return;
      const normal = normalise(data);
      const loaded = dropEmailData(normal);
      if (loaded !== normal) saveData(email, loaded).catch(() => undefined);
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

  // ── Google Drive statements ─────────────────────────────────────────
  /**
   * PhonePe statement PDFs in the Google Drive folder "Phone Pe - Monthly Statement" (and its
   * subfolders). Only new or changed files are downloaded.
   */
  const syncDrive = useCallback(
    async ({ retryLocked = false } = {}) => {
      if (driveBusy.current || !sessionRef.current?.access?.drive) return null;
      driveBusy.current = true;
      setDrive((d) => ({ ...d, running: true, read: 0, total: 0, error: null }));
      try {
        const files = [];
        let pageToken = null;
        let folders = 0;
        do {
          const page = await api('drive', { method: 'POST', body: { action: 'list', pageToken } });
          files.push(...page.files);
          folders = Math.max(folders, page.folders ?? 0);
          pageToken = page.nextPageToken;
        } while (pageToken && files.length < 2000);
        const known = storeRef.current.statements;
        const todo = files.filter((f) => {
          const st = known[`drive:${f.id}`];
          if (!st || st.deleted || st.modifiedTime !== f.modifiedTime) return true;
          if (st.status === 'locked') return Boolean(ppRef.current);
          if (st.status === 'wrong_password') return retryLocked && Boolean(ppRef.current);
          return false;
        });
        setDrive((d) => ({ ...d, files: files.length, folders, total: todo.length }));
        let read = 0;
        for (let i = 0; i < todo.length; i += 4) {
          const batch = todo.slice(i, i + 4);
          const res = await api('drive', { method: 'POST', body: { action: 'read', files: batch, password: ppRef.current || undefined } });
          storeRef.current = ingestEvents(storeRef.current, res.events, 'statement');
          read += batch.length;
          setStore(storeRef.current);
          persist(true);
          setDrive((d) => ({ ...d, read }));
        }
        setDrive((d) => ({ ...d, running: false, checkedAt: Date.now() }));
        return { files: files.length, read };
      } catch (err) {
        setDrive((d) => ({ ...d, running: false, error: err.message, code: err.code, enableUrl: err.body?.enableUrl ?? null }));
        if (err.code === 'reconnect' || err.code === 'signed_out') setSession((x) => ({ ...x, needsReconnect: true }));
        return null;
      } finally {
        driveBusy.current = false;
      }
    },
    [persist],
  );

  /** Sync button: new or changed statements in the Drive folder. */
  const syncNow = useCallback(() => syncDrive(), [syncDrive]);

  /** Saves the PhonePe statement password on this device and re-reads statements it couldn't open. */
  const setPhonePePassword = useCallback(
    async (password) => {
      const value = password?.trim() || null;
      ppRef.current = value;
      setPpPassword(value);
      if (email) await saveSetting(email, 'phonepePassword', value);
      if (!value) return { read: 0, locked: 0 };
      const isLocked = (x) => !x.deleted && (x.status === 'locked' || x.status === 'wrong_password');
      const before = Object.values(storeRef.current.statements).filter(isLocked).length;
      await syncDrive({ retryLocked: true });
      const locked = Object.values(storeRef.current.statements).filter(isLocked).length;
      return { read: before - locked, locked };
    },
    [email, persist, syncDrive],
  );

  // Drive is checked on every visit (and as soon as access is granted): listing is cheap and only
  // new or changed statements are downloaded.
  const autoDrive = useRef(null);
  useEffect(() => {
    if (!email || !session.access?.drive || dataState.status !== 'ready' || autoDrive.current === email) return;
    autoDrive.current = email;
    syncDrive();
  }, [email, session.access?.drive, dataState.status, syncDrive]);

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
      /** A PhonePe statement PDF picked from the device (for months not yet in the Drive folder). */
      importPhonePePdf: async (file, password) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        let bin = '';
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        const parsed = await api('statement', { method: 'POST', body: { pdf: btoa(bin), password: password || ppRef.current || undefined } });
        const record = { kind: 'statement', id: `file:${file.name}:${parsed.period?.from ?? todayIso()}`, fileName: file.name, date: todayIso(), status: parsed.txns.length ? 'read' : 'empty', period: parsed.period, rows: parsed.txns.length, skipped: parsed.skipped, uploaded: true };
        const before = Object.keys(storeRef.current.txns).length;
        update((s) => withAudit(ingestEvents(s, [record, ...phonePeEvents(parsed, { fileName: file.name })], 'statement'), 'Imported PhonePe statement', `${file.name} · ${parsed.txns.length} rows`));
        persist(true);
        return { rows: parsed.txns.length, skipped: parsed.skipped, added: Object.keys(storeRef.current.txns).length - before, period: parsed.period };
      },
      importStatement: (text, opts) => {
        const result = statementToEvents(text, opts);
        const before = Object.keys(storeRef.current.txns).length;
        update((s) => withAudit(ingestEvents(s, result.events, 'statement'), 'Imported statement', `${result.events.length} rows${opts?.account ? ` · ${opts.account}` : ''}`));
        persist(true);
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
    [update, email, persist],
  );

  const value = {
    session,
    signIn,
    signOut,
    refreshSession,
    store,
    dataState,
    drive,
    syncNow,
    phonepePassword: ppPassword,
    setPhonePePassword,
    statements: Object.values(store.statements ?? {}).filter((x) => !x.deleted).sort((a, b) => (b.period?.from ?? b.date).localeCompare(a.period?.from ?? a.date)),
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
