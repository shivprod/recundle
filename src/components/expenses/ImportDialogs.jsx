import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, Field, Icon, Input, Select } from '@/components/ui';
import { allCategories } from '@/core/categories';
import { parseRupees, shortDate, todayIso } from '@/core/format';
import { useApp } from '@/data/AppData';

export function ImportStatementDialog({ open, onClose }) {
  const { actions, phonepePassword } = useApp();
  const [account, setAccount] = useState('');
  const [password, setPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const file = useRef(null);
  const last = useRef(null);

  const readPdf = async (f, pw) => {
    setBusy(true);
    try {
      const r = await actions.importPhonePePdf(f, pw);
      setResult({ pdf: true, ...r });
      setNeedsPassword(false);
      toast.success(r.added ? `${r.added} new transactions from your PhonePe statement` : 'Nothing new: this statement was already added');
    } catch (err) {
      if (err.code === 'statement_password') {
        setNeedsPassword(true);
        setError(err.body?.wrongPassword ? 'That password did not open the statement.' : 'This statement is password-protected. Enter its password.');
      } else setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setResult(null);
    if (f.size > 3_000_000) {
      setError('That file is larger than 3 MB. Choose a shorter statement.');
      return;
    }
    try {
      if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') {
        last.current = f;
        await readPdf(f, password);
      } else if (/\.(csv|txt)$/i.test(f.name)) {
        const r = actions.importStatement(await f.text(), { account: account || f.name.replace(/\.[^.]+$/, '') });
        setResult(r);
        toast.success(`${r.added} new transactions imported`);
      } else setError('Choose a PhonePe statement (PDF) or a bank statement saved as CSV.');
    } catch (err) {
      setError(err.message);
    } finally {
      if (file.current) file.current.value = '';
    }
  };

  const close = () => {
    setResult(null);
    setError(null);
    setNeedsPassword(false);
    onClose();
  };

  return (
    <Dialog open={open} onClose={close} title="Add a statement" footer={<Button variant="ghost" onClick={close}>Done</Button>}>
      <div className="flex flex-col gap-3">
        <p>
          Recundle reads your <b>PhonePe monthly statements</b> from Gmail automatically. For a month that isn't in Gmail, download the statement from the PhonePe app (History → Download statement) and choose the PDF here. It's read once and discarded; only the transactions are kept, on this device. The same statement never adds anything twice.
        </p>
        {(needsPassword || !phonepePassword) && (
          <Field label="Statement password (if it has one)" hint="Used only to open this file; not saved here. Save it in Settings to read locked statements from Gmail.">
            <Input type="password" autoComplete="off" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="PDF password" />
          </Field>
        )}
        {needsPassword && last.current && (
          <Button size="sm" variant="outline" disabled={!password || busy} onClick={() => { setError(null); readPdf(last.current, password); }}>
            Open with this password
          </Button>
        )}
        <input ref={file} type="file" accept=".pdf,application/pdf,.csv,text/csv" onChange={onFile} disabled={busy} className="text-[13.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:font-medium file:text-primary" />
        {busy && <p className="text-ink-3">Reading the statement…</p>}
        {error && <p className="flex gap-2 text-bad"><Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />{error}</p>}
        {result?.pdf && (
          <p className="rounded-xl bg-good-soft px-3 py-2 text-good">
            Read {result.rows} transactions{result.period ? ` (${shortDate(result.period.from, true)} – ${shortDate(result.period.to, true)})` : ''}, {result.added} new{result.skipped ? `. ${result.skipped} rows could not be read` : ''}.
          </p>
        )}
        {result && !result.pdf && (
          <p className="rounded-xl bg-good-soft px-3 py-2 text-good">
            Read {result.events.length} rows, added {result.added} new{result.skipped ? `, skipped ${result.skipped} lines that weren't transactions` : ''}. Columns used: {Object.values(result.columns).join(', ')}.
          </p>
        )}
        <details className="text-[13px] text-ink-3">
          <summary className="cursor-pointer">Have a bank statement as CSV instead?</summary>
          <div className="mt-2 flex flex-col gap-2">
            <p>CSV bank statements are counted too, and payments that also appear in a PhonePe statement are matched, not counted twice.</p>
            <Field label="Account name (optional)" hint="Shown on each transaction, e.g. HDFC savings">
              <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="HDFC savings" />
            </Field>
          </div>
        </details>
      </div>
    </Dialog>
  );
}

export function AddTransactionDialog({ open, onClose }) {
  const { actions, store } = useApp();
  const empty = { date: todayIso(), direction: 'out', amount: '', counterparty: '', method: 'Cash', description: '', category: '' };
  const [f, setF] = useState(empty);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const amount = parseRupees(f.amount);
  const cats = allCategories(store.categories).filter((c) => (f.direction === 'in' ? c.kind !== 'expense' : c.kind !== 'income'));
  const submit = () => {
    if (!amount || amount <= 0 || !f.counterparty.trim()) return;
    const id = actions.addManualTransaction({ date: f.date, direction: f.direction, amount, counterparty: f.counterparty.trim(), method: f.method || null, description: f.description, confidence: 1 });
    if (f.category) actions.editTransaction(id, { category: f.category });
    toast.success('Transaction added');
    setF(empty);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a transaction" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={!amount || !f.counterparty.trim()}>Add</Button></>}>
      <p className="mb-3">For cash or anything Gmail and your statements don't show.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Money">
          <Select value={f.direction} onChange={set('direction')}>
            <option value="out">Spent</option>
            <option value="in">Received</option>
          </Select>
        </Field>
        <Field label="Amount (₹)">
          <Input inputMode="decimal" value={f.amount} onChange={set('amount')} placeholder="0" />
        </Field>
        <Field label={f.direction === 'in' ? 'From' : 'To'} className="col-span-2">
          <Input value={f.counterparty} onChange={set('counterparty')} />
        </Field>
        <Field label="Date">
          <Input type="date" value={f.date} max={todayIso()} onChange={set('date')} />
        </Field>
        <Field label="Paid with">
          <Input value={f.method} onChange={set('method')} />
        </Field>
        <Field label="Category" className="col-span-2">
          <Select value={f.category} onChange={set('category')}>
            <option value="">Let Recundle suggest</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </Select>
        </Field>
      </div>
    </Dialog>
  );
}
