import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Badge, Button, Dialog, Field, GmailLink, Icon, Input, Select, Sheet, Textarea } from '@/components/ui';
import { allCategories, TYPES } from '@/core/categories';
import { matchingCount, similarPayees } from '@/core/transactions';
import { inr, pct, shortDate } from '@/core/format';
import { useApp } from '@/data/AppData';
import { Amount, ClassifiedBadge } from './common';

const RULE_FIELDS = ['category', 'subcategory', 'type', 'counterparty', 'purpose', 'subscription'];
const SOURCE_LABEL = { 'gmail-alert': 'Bank alert (Gmail)', 'gmail-receipt': 'Receipt (Gmail)', 'gmail-loan': 'Lender email (Gmail)', statement: 'Imported statement', manual: 'Added by you' };

/**
 * Everything about one transaction, editable. When the category, type or payee name changes,
 * Recundle asks whether to remember it for this payee (a rule), and lists similarly named payees
 * for the user to include or leave out. Nothing similar is changed without that confirmation.
 */
export default function TransactionSheet({ txn, onClose }) {
  const { store, txns, subscriptions, loans, actions, session } = useApp();
  const [form, setForm] = useState(null);
  const [ask, setAsk] = useState(null);
  const cats = useMemo(() => allCategories(store.categories), [store.categories]);

  useEffect(() => {
    if (!txn) return;
    setForm({
      name: txn.name === txn.counterparty ? '' : txn.name,
      counterparty: txn.counterparty,
      type: txn.type,
      category: txn.category,
      subcategory: txn.subcategory ?? '',
      purpose: txn.purpose ?? '',
      description: txn.description ?? '',
      notes: txn.notes ?? '',
      subscription: txn.subscriptionKey ?? (txn.subscription?.isSubscription ? '__auto' : '__none'),
      loanId: txn.loanId ?? '',
      excluded: txn.excluded,
    });
  }, [txn]);

  if (!txn || !form) return <Sheet open={false} onClose={onClose} />;
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }));
  const kindOk = (c) => (txn.direction === 'in' ? c.kind === 'income' || c.kind === 'transfer' : c.kind !== 'income');
  const typeOptions = Object.entries(TYPES).filter(([, v]) => v.direction === txn.direction || v.direction === 'both');
  const category = cats.find((c) => c.id === form.category);

  const save = () => {
    const changes = {};
    if ((form.name || null) !== (txn.name === txn.counterparty ? null : txn.name)) changes.name = form.name || null;
    if (form.counterparty !== txn.counterparty) changes.counterparty = form.counterparty || null;
    if (form.type !== txn.type) changes.type = form.type;
    if (form.category !== txn.category) changes.category = form.category;
    if ((form.subcategory || null) !== (txn.subcategory ?? null)) changes.subcategory = form.subcategory || null;
    if (form.purpose !== (txn.purpose ?? '')) changes.purpose = form.purpose || null;
    if (form.description !== (txn.description ?? '')) changes.description = form.description || null;
    if (form.notes !== (txn.notes ?? '')) changes.notes = form.notes || null;
    const subNow = txn.subscriptionKey ?? (txn.subscription?.isSubscription ? '__auto' : '__none');
    if (form.subscription !== subNow) changes.subscription = form.subscription === '__auto' ? null : form.subscription === '__none' ? '' : form.subscription;
    if ((form.loanId || null) !== (txn.loanId ?? null)) changes.loanId = form.loanId || null;
    if (form.excluded !== txn.excluded) changes.excluded = form.excluded || null;
    if (!Object.keys(changes).length) return onClose();

    // Rule-worthy changes: classification of the payee, not one-off notes.
    const ruleSet = Object.fromEntries(RULE_FIELDS.filter((k) => changes[k] !== undefined && changes[k] !== null).map((k) => [k, changes[k]]));
    if (Object.keys(ruleSet).length && txn.rawKey) {
      const similar = similarPayees(txns, txn.rawKey, txn.direction);
      setAsk({ changes, ruleSet, similar, picked: [], matchAmount: changes.subscription !== undefined, count: matchingCount(txns, [txn.rawKey], txn.direction) });
      return;
    }
    actions.editTransaction(txn.id, changes);
    toast.success('Transaction updated');
    onClose();
  };

  const applyRule = (scope) => {
    const { changes, ruleSet, picked, matchAmount } = ask;
    actions.editTransaction(txn.id, changes);
    if (scope === 'all') {
      const who = txn.rawCounterparty ?? txn.counterparty;
      actions.addRule({ keys: [txn.rawKey, ...picked], direction: txn.direction, set: ruleSet, amount: matchAmount ? txn.amount : null, label: who });
      toast.success(`Saved. Payments ${txn.direction === 'in' ? 'from' : 'to'} ${who} will be classified this way from now on.`);
    } else toast.success('Transaction updated');
    setAsk(null);
    onClose();
  };

  const subOptions = subscriptions.map((s) => ({ key: s.name, label: s.name }));
  const who = txn.rawCounterparty ?? txn.counterparty;

  return (
    <>
      <Sheet
        open={Boolean(txn)}
        onClose={onClose}
        title={<span className="flex items-center gap-2">{txn.name}<ClassifiedBadge t={txn} /></span>}
        subtitle={`${shortDate(txn.date, true)} · ${txn.direction === 'in' ? 'Money in' : 'Money out'}${txn.method ? ` · ${txn.method}` : ''}`}
        footer={
          <>
            {txn.source === 'manual' && (
              <Button variant="danger-ghost" icon="Trash2" className="mr-auto" onClick={() => { actions.deleteManualTransaction(txn.id); onClose(); }}>
                Delete
              </Button>
            )}
            <Button variant="ghost" onClick={onClose}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <div className="flex items-end justify-between gap-3">
          <Amount t={txn} className="text-[30px] leading-none" />
          <span className="text-right text-[12px] text-ink-3">
            {txn.classifiedBy === 'auto' ? `Recundle's guess · ${pct(txn.confidence)} sure` : txn.reason}
            <br />
            {txn.classifiedBy === 'auto' && txn.reason}
          </span>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <Field label={txn.direction === 'in' ? 'Received from' : 'Paid to'} hint={txn.rawCounterparty && txn.rawCounterparty !== form.counterparty ? `Bank shows "${txn.rawCounterparty}"` : null}>
            <Input value={form.counterparty} onChange={set('counterparty')} />
          </Field>
          <Field label="Transaction name" hint="Optional; shown instead of the payee">
            <Input value={form.name} onChange={set('name')} placeholder={form.counterparty} />
          </Field>
          <Field label="Type" hint={form.type === 'transfer' ? 'Not counted as income or spending' : null}>
            <Select value={form.type} onChange={set('type')}>
              {typeOptions.map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Category">
            <Select value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value, subcategory: '' }))}>
              {cats.filter(kindOk).map((c) => (
                <option key={c.id} value={c.id}>{c.label}</option>
              ))}
            </Select>
          </Field>
          <Field label="Subcategory">
            <Select value={form.subcategory} onChange={set('subcategory')}>
              <option value="">None</option>
              {(category?.subcategories ?? []).map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </Select>
          </Field>
          <Field label="Purpose" hint="e.g. October rent, Mom's medicines">
            <Input value={form.purpose} onChange={set('purpose')} />
          </Field>
          <Field label="Description" className="sm:col-span-2">
            <Input value={form.description} onChange={set('description')} />
          </Field>
          <Field label="Notes" className="sm:col-span-2">
            <Textarea value={form.notes} onChange={set('notes')} rows={2} />
          </Field>
          {txn.direction === 'out' && (
            <>
              <Field label="Subscription" hint="Link this payment to a subscription, e.g. an Amazon payment that is really Amazon Prime">
                <Select value={form.subscription} onChange={set('subscription')}>
                  <option value="__auto">{txn.subscription?.isSubscription ? `Automatic (${txn.subscription.service})` : 'Automatic'}</option>
                  <option value="__none">Not a subscription payment</option>
                  {subOptions.map((s) => (
                    <option key={s.key} value={s.key}>{s.label}</option>
                  ))}
                  {!subOptions.some((s) => s.key === form.counterparty) && <option value={form.counterparty}>New: {form.counterparty}</option>}
                </Select>
              </Field>
              <Field label="Loan" hint="Count this payment towards a loan">
                <Select value={form.loanId} onChange={set('loanId')}>
                  <option value="">{txn.loanHint ? `Automatic (${txn.loanHint.lender})` : 'Not a loan payment'}</option>
                  {loans.filter((l) => !l.discovered).map((l) => (
                    <option key={l.id} value={l.id}>{l.lender}{l.account ? ` · ${l.account}` : ''}</option>
                  ))}
                </Select>
              </Field>
            </>
          )}
        </div>

        <label className="mt-4 flex items-center gap-2 text-[13.5px]">
          <input type="checkbox" checked={form.excluded} onChange={set('excluded')} className="size-4 accent-[var(--primary)]" />
          Leave out of totals and charts (keeps it in the list)
        </label>

        <div className="mt-5 rounded-xl bg-surface-2 p-3.5 text-[13px]">
          <p className="font-semibold">Where this came from</p>
          <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-ink-2">
            {txn.reference && (<><dt>Reference</dt><dd className="tnum truncate">{txn.reference}</dd></>)}
            {txn.account && (<><dt>Account</dt><dd>{[txn.institution, txn.account].filter(Boolean).join(' · ')}</dd></>)}
            {txn.vpa && (<><dt>UPI ID</dt><dd className="truncate">{txn.vpa}</dd></>)}
            {txn.method && (<><dt>Method</dt><dd>{txn.method}</dd></>)}
          </dl>
          <ul className="mt-2 flex flex-col gap-1.5">
            {txn.sources.map((s) => (
              <li key={s.id} className="flex flex-wrap items-center justify-between gap-2">
                <span className="min-w-0 truncate text-ink-2">{SOURCE_LABEL[s.kind] ?? s.kind}{s.subject ? ` · ${s.subject}` : ''}</span>
                <GmailLink messageId={s.messageId} email={session.user?.email} />
              </li>
            ))}
          </ul>
          {txn.sources.length > 1 && (
            <p className="mt-2 text-ink-3">
              Seen in {txn.sources.length} places and counted once.{' '}
              <button type="button" className="font-medium text-primary hover:underline" onClick={() => { actions.editTransaction(txn.sources[1].id, { notDuplicate: true }); toast.success('Kept as two separate payments'); onClose(); }}>
                These are two different payments
              </button>
            </p>
          )}
        </div>
      </Sheet>

      <Dialog
        open={Boolean(ask)}
        onClose={() => setAsk(null)}
        title={`Apply this to future transactions from ${who}?`}
        footer={
          <>
            <Button variant="outline" onClick={() => applyRule('one')}>Only this transaction</Button>
            <Button onClick={() => applyRule('all')}>Apply to all from {who.length > 18 ? 'this payee' : who}</Button>
          </>
        }
      >
        {ask && (
          <div className="flex flex-col gap-3">
            <p>
              {ask.count > 1 ? `${ask.count} transactions ${txn.direction === 'in' ? 'from' : 'to'} ${who} match now` : `This is the only ${txn.direction === 'in' ? 'credit from' : 'payment to'} ${who} so far`}. New ones will be classified the same way. You can still change any single transaction, and edit or remove the rule in Expenses → Rules.
            </p>
            {ask.changes.subscription !== undefined && (
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={ask.matchAmount} onChange={(e) => setAsk((a) => ({ ...a, matchAmount: e.target.checked }))} className="size-4 accent-[var(--primary)]" />
                Only payments of exactly {inr(txn.amount, { exact: true })} (so other purchases from {who} aren't linked)
              </label>
            )}
            {ask.similar.length > 0 && (
              <div>
                <p className="font-medium text-ink">Similar names. Include any that are the same {txn.isPerson ? 'person' : 'payee'}?</p>
                <ul className="mt-1.5 flex flex-col gap-1">
                  {ask.similar.map((p) => (
                    <li key={p.key}>
                      <label className="flex items-center gap-2">
                        <input type="checkbox" checked={ask.picked.includes(p.key)} onChange={(e) => setAsk((a) => ({ ...a, picked: e.target.checked ? [...a.picked, p.key] : a.picked.filter((k) => k !== p.key) }))} className="size-4 accent-[var(--primary)]" />
                        <span className="min-w-0 flex-1 truncate">{p.name}</span>
                        <Badge>{p.count} · {inr(p.total)}</Badge>
                      </label>
                    </li>
                  ))}
                </ul>
                <p className="mt-1.5 flex items-center gap-1 text-[12.5px] text-ink-3"><Icon name="Info" size={13} /> Unticked names are left as they are.</p>
              </div>
            )}
          </div>
        )}
      </Dialog>
    </>
  );
}
