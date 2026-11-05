import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHead, Dialog, Empty, Field, GmailLink, Icon, Input, PageHeader, Provenance, Segmented, Select, Sheet, Textarea, Tile } from '@/components/ui';
import TransactionSheet from '@/components/expenses/TransactionSheet';
import { PERIOD_LABEL, STATUSES, subscriptionInsights, subscriptionTotals } from '@/core/subscriptions';
import { entityKey } from '@/core/entities';
import { daysBetween, inr, parseRupees, plural, shortDate } from '@/core/format';
import { useApp } from '@/data/AppData';
import { cn } from '@/lib/cn';

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'needs_verification', label: 'To verify' },
  { value: 'trial', label: 'Trials' },
  { value: 'failed', label: 'Failed' },
  { value: 'inactive', label: 'Inactive' },
];
const TONE = { good: 'good', info: 'info', bad: 'bad', warn: 'warn', muted: 'muted' };
const EVENT_LABEL = { payment: 'Payment', failed: 'Payment failed', trial: 'Free trial started', cancelled: 'Cancelled', upcoming: 'Renewal reminder' };

function renewalText(s, today) {
  if (!s.nextRenewal) return s.status === 'cancelled' ? 'Cancelled' : s.status === 'inactive' ? 'No recent payment' : 'Renewal date unknown';
  const d = daysBetween(today, s.nextRenewal);
  const when = d === 0 ? 'today' : d === 1 ? 'tomorrow' : d < 7 ? `in ${d} days` : `on ${shortDate(s.nextRenewal)}`;
  return `${s.status === 'trial' ? 'Trial ends' : 'Renews'} ${when}${s.nextRenewalSource === 'estimated' ? ' (estimated)' : ''}`;
}

function SubCard({ s, today, onOpen, index }) {
  const st = STATUSES[s.status];
  return (
    <motion.button
      type="button"
      onClick={() => onOpen(s.key)}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index, 12) * 0.03 }}
      className={cn('card group flex flex-col p-4 text-left transition hover:border-primary/40 hover:shadow-md', (s.status === 'inactive' || s.status === 'cancelled') && 'opacity-75')}
    >
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-[16px] font-bold text-primary">{s.name.slice(0, 1).toUpperCase()}</span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-semibold">{s.name}</p>
          <p className="truncate text-[12.5px] text-ink-3">{[s.plan, s.period && `Every ${PERIOD_LABEL[s.period]}`].filter(Boolean).join(' · ') || 'Billing cycle unknown'}</p>
        </div>
        <Badge tone={TONE[st.tone]}>{st.label}</Badge>
      </div>
      <div className="mt-4 flex items-end justify-between gap-2">
        <div>
          <p className="tnum text-[20px] font-bold leading-none">{s.amount != null ? inr(s.amount, { exact: true }) : '—'}</p>
          <p className="mt-1 text-[12px] text-ink-3">{s.monthly != null && s.period !== 'monthly' ? `${inr(s.monthly)} a month` : s.period ? `per ${PERIOD_LABEL[s.period]}` : 'Amount per cycle unknown'}</p>
        </div>
        <div className="text-right text-[12px] text-ink-3">
          <p className={cn(s.nextRenewal && daysBetween(today, s.nextRenewal) <= 3 && 'font-semibold text-primary', s.status === 'failed' && 'text-bad')}>{renewalText(s, today)}</p>
          <p>{s.lastPaid ? `Last paid ${shortDate(s.lastPaid)}` : 'No payment found'}{s.paymentSource ? ` · ${s.paymentSource}` : ''}</p>
        </div>
      </div>
    </motion.button>
  );
}

export default function Subscriptions() {
  const { subscriptions, today, actions, session, txns } = useApp();
  const [filter, setFilter] = useState('all');
  const [openKey, setOpenKey] = useState(null);
  const [adding, setAdding] = useState(false);
  const totals = useMemo(() => subscriptionTotals(subscriptions, today), [subscriptions, today]);
  const insights = useMemo(() => subscriptionInsights(subscriptions), [subscriptions]);
  const list = subscriptions.filter((s) => filter === 'all' || s.status === filter || (filter === 'inactive' && s.status === 'cancelled'));
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, subscriptions.filter((s) => f.value === 'all' || s.status === f.value || (f.value === 'inactive' && s.status === 'cancelled')).length]));
  const open = subscriptions.find((s) => s.key === openKey) ?? null;

  return (
    <div>
      <PageHeader title="Subscriptions" subtitle="Every recurring payment found in your receipts and bank alerts." actions={<Button variant="outline" size="sm" icon="Plus" onClick={() => setAdding(true)}>Add subscription</Button>} />
      {subscriptions.length === 0 ? (
        <Card>
          <Empty icon="Repeat" title="No subscriptions found yet">
            Recundle looks for receipts, renewal notices, trials, failed payments and cancellations in Gmail, and for regular payments to the same payee. Sync Gmail, or open a transaction and link it to a subscription.
          </Empty>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Active subscriptions" value={totals.active} icon="Repeat" tone="brand" sub={totals.verify ? `${totals.verify} to verify` : 'Confirmed by receipts or schedule'} onClick={() => setFilter('active')} />
            <Tile label="Every month" value={inr(totals.monthly)} icon="Wallet" emphasis sub={totals.unknownCost ? `${totals.unknownCost} without a known price` : 'Active subscriptions'} />
            <Tile label="Every year" value={inr(totals.yearly)} icon="CalendarRange" sub="At current prices" />
            <Tile label="Renewing in 30 days" value={totals.upcoming.length} icon="CalendarClock" sub={totals.upcoming[0] ? `Next: ${totals.upcoming[0].name}, ${shortDate(totals.upcoming[0].nextRenewal)}` : 'Nothing due soon'} />
            <Tile label="Inactive or cancelled" value={totals.inactive} icon="CirclePause" sub="Kept for history; not counted" onClick={() => setFilter('inactive')} />
            <Tile label="Recently discovered" value={totals.recent.length} icon="Sparkles" sub="First seen in the last 45 days" />
            <Tile label="Needs verification" value={totals.verify} icon="CircleHelp" tone={totals.verify ? 'warn' : undefined} sub="Confirm or change their status" onClick={() => setFilter('needs_verification')} />
            <Tile label="Payment failed" value={totals.failed} icon="CircleAlert" tone={totals.failed ? 'bad' : undefined} sub="Update the payment method" onClick={() => setFilter('failed')} />
          </div>

          {insights.length > 0 && (
            <Card>
              <CardHead title="Worth knowing" icon="Lightbulb" />
              <ul className="grid gap-2 md:grid-cols-2">
                {insights.map((i) => (
                  <li key={i.id} className="flex gap-3 rounded-xl bg-surface-2 p-3 text-[13.5px]">
                    <Icon name={i.kind === 'price' ? 'TrendingUp' : i.kind === 'overlap' ? 'Layers' : 'Crown'} size={17} className="mt-0.5 shrink-0 text-primary" />
                    <span>
                      {i.kind === 'top' && <><b>{i.subject}</b> is your most expensive subscription at {inr(i.value)} a month.</>}
                      {i.kind === 'price' && <><b>{i.subject}</b> went up from {inr(i.from, { exact: true })} to {inr(i.to, { exact: true })} on {shortDate(i.date)}.</>}
                      {i.kind === 'overlap' && <>You pay for {i.names.length} {i.group}: {i.names.join(', ')}{i.monthly ? ` (${inr(i.monthly)} a month together)` : ''}. Worth checking you use them all.</>}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-2 text-[12px] text-ink-3">Recundle can't see whether you use a service, so it never marks one as unused.</p>
            </Card>
          )}

          <div>
            <Segmented id="sub-filter" label="Filter subscriptions" value={filter} onChange={setFilter} options={FILTERS.map((f) => ({ ...f, count: counts[f.value] }))} className="mb-3" />
            {list.length ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {list.map((s, i) => (
                  <SubCard key={s.key} s={s} today={today} onOpen={setOpenKey} index={i} />
                ))}
              </div>
            ) : (
              <Card><Empty icon="Filter" title="Nothing here" /></Card>
            )}
          </div>
        </div>
      )}
      <SubscriptionSheet sub={open} onClose={() => setOpenKey(null)} />
      <AddSubscription open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function SubscriptionSheet({ sub, onClose }) {
  const { actions, session, txns, today } = useApp();
  const [edit, setEdit] = useState(null);
  const [openTxn, setOpenTxn] = useState(null);
  const [confirmHide, setConfirmHide] = useState(false);
  if (!sub) return <><Sheet open={false} onClose={onClose} /><TransactionSheet txn={openTxn ? txns.find((t) => t.id === openTxn) : null} onClose={() => setOpenTxn(null)} /></>;
  const startEdit = () => setEdit({ name: sub.name, amount: sub.amount != null ? String(sub.amount / 100) : '', period: sub.period ?? '', nextRenewal: '', notes: sub.notes ?? '' });
  const saveEdit = () => {
    actions.setSubscription(sub.key, {
      name: edit.name.trim() || sub.name,
      amount: edit.amount ? parseRupees(edit.amount) : null,
      period: edit.period || null,
      nextRenewal: edit.nextRenewal || null,
      notes: edit.notes,
    });
    setEdit(null);
    toast.success('Subscription updated');
  };
  const history = [
    ...sub.payments.map((p) => ({ kind: 'payment', date: p.date, amount: p.amount, id: p.id, messageId: p.sources[0]?.messageId, method: p.method })),
    ...sub.events.filter((e) => e.status !== 'payment').map((e) => ({ kind: e.status, date: e.date, amount: e.amount, messageId: e.messageId })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      <Sheet
        open
        onClose={() => { setEdit(null); onClose(); }}
        title={sub.name}
        subtitle={[sub.plan, sub.period && `Billed every ${PERIOD_LABEL[sub.period]}`].filter(Boolean).join(' · ') || 'Subscription'}
        footer={
          edit ? (
            <>
              <Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button>
              <Button onClick={saveEdit}>Save</Button>
            </>
          ) : (
            <>
              <Button variant="danger-ghost" size="sm" className="mr-auto" onClick={() => setConfirmHide(true)}>Not a subscription</Button>
              <Button variant="outline" icon="Pencil" onClick={startEdit}>Edit details</Button>
            </>
          )
        }
      >
        <Field label="Status">
          <Select value={sub.status} onChange={(e) => { actions.setSubscription(sub.key, { status: e.target.value === sub.autoStatus ? null : e.target.value }); toast.success(`Marked ${STATUSES[e.target.value].label.toLowerCase()}`); }}>
            {Object.entries(STATUSES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}{k === sub.autoStatus ? ' (from emails)' : ''}</option>
            ))}
          </Select>
        </Field>
        <p className="mt-1.5 text-[12.5px] text-ink-3">{sub.statusReason}. Inactive and cancelled subscriptions keep their history but aren't counted as a monthly commitment.</p>

        {edit ? (
          <div className="mt-5 grid grid-cols-2 gap-3">
            <Field label="Name" className="col-span-2"><Input value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Amount per cycle (₹)"><Input inputMode="decimal" value={edit.amount} onChange={(e) => setEdit({ ...edit, amount: e.target.value })} /></Field>
            <Field label="Billing cycle">
              <Select value={edit.period} onChange={(e) => setEdit({ ...edit, period: e.target.value })}>
                <option value="">Unknown</option>
                {Object.entries(PERIOD_LABEL).map(([k, v]) => <option key={k} value={k}>Every {v}</option>)}
              </Select>
            </Field>
            <Field label="Next renewal (if you know it)" className="col-span-2"><Input type="date" value={edit.nextRenewal} onChange={(e) => setEdit({ ...edit, nextRenewal: e.target.value })} /></Field>
            <Field label="Notes" className="col-span-2"><Textarea value={edit.notes} onChange={(e) => setEdit({ ...edit, notes: e.target.value })} /></Field>
          </div>
        ) : (
          <>
            <dl className="mt-5 grid grid-cols-2 gap-2.5">
              {[
                ['Amount', sub.amount != null ? inr(sub.amount, { exact: true }) : '—', sub.period ? `per ${PERIOD_LABEL[sub.period]}` : 'cycle unknown'],
                ['Per month', sub.monthly != null ? inr(sub.monthly) : '—', sub.yearly != null ? `${inr(sub.yearly)} a year` : null],
                ['Next payment', sub.nextRenewal ? shortDate(sub.nextRenewal, true) : '—', sub.nextRenewalSource && <Provenance source={sub.nextRenewalSource} />],
                ['Last paid', sub.lastPaid ? shortDate(sub.lastPaid, true) : '—', sub.paymentSource],
                ['First payment found', sub.firstPaid ? shortDate(sub.firstPaid, true) : '—', null],
                ['Paid so far', inr(sub.totalPaid), plural(sub.payments.length, 'payment')],
              ].map(([l, v, h]) => (
                <div key={l} className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
                  <dt className="text-[12px] text-ink-3">{l}</dt>
                  <dd className="tnum truncate text-[15px] font-semibold">{v}</dd>
                  {h && <dd className="mt-0.5 text-[12px] text-ink-3">{h}</dd>}
                </div>
              ))}
            </dl>
            {sub.period && <p className="mt-2 text-[12px] text-ink-3">Billing cycle {sub.periodSource === 'stated' ? 'stated on the receipts' : sub.periodSource === 'user' ? 'set by you' : 'worked out from the payment dates'}.</p>}
            {sub.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-[13.5px]">{sub.notes}</p>}
          </>
        )}

        {sub.priceChanges.length > 0 && (
          <div className="mt-5">
            <h3 className="text-[14px] font-semibold">Price changes</h3>
            <ul className="mt-1 text-[13.5px] text-ink-2">
              {sub.priceChanges.map((c) => (
                <li key={c.date} className="flex items-center gap-2 py-1">
                  <Icon name={c.to > c.from ? 'TrendingUp' : 'TrendingDown'} size={15} className={c.to > c.from ? 'text-warn' : 'text-good'} />
                  {shortDate(c.date, true)}: {inr(c.from, { exact: true })} → {inr(c.to, { exact: true })}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5">
          <h3 className="text-[14px] font-semibold">History</h3>
          {history.length ? (
            <ul className="mt-1 divide-y divide-line">
              {history.map((h, i) => (
                <li key={`${h.kind}-${h.date}-${i}`} className="flex items-center gap-3 py-2.5">
                  <Icon name={h.kind === 'payment' ? 'CircleCheck' : h.kind === 'failed' ? 'CircleAlert' : h.kind === 'cancelled' ? 'CircleX' : 'Bell'} size={17} className={h.kind === 'failed' ? 'text-bad' : h.kind === 'payment' ? 'text-good' : 'text-ink-3'} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-medium">{EVENT_LABEL[h.kind] ?? h.kind}{h.method ? ` · ${h.method}` : ''}</p>
                    <p className="text-[12px] text-ink-3">{shortDate(h.date, true)}</p>
                  </div>
                  {h.amount != null && <span className="tnum text-[13.5px] font-semibold">{inr(h.amount, { exact: true })}</span>}
                  {h.id ? (
                    <Button variant="ghost" size="sm" onClick={() => setOpenTxn(h.id)} aria-label="Open payment"><Icon name="ChevronRight" size={16} /></Button>
                  ) : (
                    <GmailLink messageId={h.messageId} email={session.user?.email}>Email</GmailLink>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-1 text-[13.5px] text-ink-3">No payments found yet. Link a payment from Expenses → open the transaction → Subscription.</p>
          )}
        </div>
      </Sheet>
      <TransactionSheet txn={openTxn ? txns.find((t) => t.id === openTxn) : null} onClose={() => setOpenTxn(null)} />
      <Dialog
        open={confirmHide}
        onClose={() => setConfirmHide(false)}
        title={`Remove ${sub.name} from subscriptions?`}
        footer={<><Button variant="ghost" onClick={() => setConfirmHide(false)}>Cancel</Button><Button onClick={() => { actions.setSubscription(sub.key, { notSubscription: true }); setConfirmHide(false); onClose(); toast.success('Removed from subscriptions. Its payments stay in Expenses.'); }}>Remove</Button></>}
      >
        Its payments stay in Expenses. Recundle won't list it as a subscription again unless you link a payment to it.
      </Dialog>
    </>
  );
}

function AddSubscription({ open, onClose }) {
  const { actions } = useApp();
  const [f, setF] = useState({ name: '', amount: '', period: 'monthly', nextRenewal: '' });
  const submit = () => {
    const key = entityKey(f.name);
    if (!key) return;
    actions.setSubscription(key, { manual: true, name: f.name.trim(), amount: parseRupees(f.amount), period: f.period, nextRenewal: f.nextRenewal || null });
    toast.success(`Added ${f.name.trim()}`);
    setF({ name: '', amount: '', period: 'monthly', nextRenewal: '' });
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a subscription" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={!f.name.trim()}>Add</Button></>}>
      <p className="mb-3">For subscriptions Gmail doesn't show. To link a payment you can see in Expenses, open that transaction instead.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Name" className="col-span-2"><Input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="e.g. Newspaper" /></Field>
        <Field label="Amount (₹)"><Input inputMode="decimal" value={f.amount} onChange={(e) => setF({ ...f, amount: e.target.value })} /></Field>
        <Field label="Billing cycle">
          <Select value={f.period} onChange={(e) => setF({ ...f, period: e.target.value })}>
            {Object.entries(PERIOD_LABEL).map(([k, v]) => <option key={k} value={k}>Every {v}</option>)}
          </Select>
        </Field>
        <Field label="Next renewal" className="col-span-2"><Input type="date" value={f.nextRenewal} onChange={(e) => setF({ ...f, nextRenewal: e.target.value })} /></Field>
      </div>
    </Dialog>
  );
}
