import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Button, Dialog, Field, Icon, Input, Select } from '@/components/ui';
import { allCategories } from '@/core/categories';
import { parseRupees, todayIso } from '@/core/format';
import { useApp } from '@/data/AppData';

export function ImportStatementDialog({ open, onClose }) {
  const { actions } = useApp();
  const [account, setAccount] = useState('');
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const file = useRef(null);

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setError(null);
    setResult(null);
    if (!/\.(csv|txt)$/i.test(f.name)) {
      setError('Please choose a CSV file. Most banks offer "Download as CSV" (or open the Excel file and save it as CSV).');
      return;
    }
    if (f.size > 5_000_000) {
      setError('That file is larger than 5 MB. Export a shorter date range.');
      return;
    }
    try {
      const r = actions.importStatement(await f.text(), { account: account || f.name.replace(/\.[^.]+$/, '') });
      setResult(r);
      toast.success(`${r.added} new transactions imported`);
    } catch (err) {
      setError(err.message);
    } finally {
      if (file.current) file.current.value = '';
    }
  };

  return (
    <Dialog open={open} onClose={() => { setResult(null); setError(null); onClose(); }} title="Import a bank statement" footer={<Button variant="ghost" onClick={onClose}>Done</Button>}>
      <div className="flex flex-col gap-3">
        <p>Download your statement from net banking as a CSV file and choose it here. It's read in your browser; only the transactions are saved, on this device. Re-importing the same statement adds nothing twice, and payments already found in Gmail are matched, not double counted.</p>
        <Field label="Account name (optional)" hint="Shown on each transaction, e.g. HDFC savings">
          <Input value={account} onChange={(e) => setAccount(e.target.value)} placeholder="HDFC savings" />
        </Field>
        <input ref={file} type="file" accept=".csv,text/csv" onChange={onFile} className="text-[13.5px] file:mr-3 file:rounded-lg file:border-0 file:bg-primary-soft file:px-3 file:py-2 file:font-medium file:text-primary" />
        {error && <p className="flex gap-2 text-bad"><Icon name="CircleAlert" size={16} className="mt-0.5 shrink-0" />{error}</p>}
        {result && (
          <p className="rounded-xl bg-good-soft px-3 py-2 text-good">
            Read {result.events.length} rows, added {result.added} new{result.skipped ? `, skipped ${result.skipped} lines that weren't transactions` : ''}. Columns used: {Object.values(result.columns).join(', ')}.
          </p>
        )}
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
