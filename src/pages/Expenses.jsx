import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHead, Dialog, Empty, Field, Icon, Input, PageHeader, SearchInput, Segmented, Select, Tile } from '@/components/ui';
import { BarList, CashFlowChart, CategoryDonut, MoneyFlow, Sparkline, SpendHeatmap } from '@/components/charts';
import { categoryMap, GroupedList, PeriodPicker, TransactionRow } from '@/components/expenses/common';
import TransactionSheet from '@/components/expenses/TransactionSheet';
import PayeeSheet from '@/components/expenses/PayeeSheet';
import { AddTransactionDialog, ImportStatementDialog } from '@/components/expenses/ImportDialogs';
import { categoryBreakdown, entities, inflows, inRange, leakageInsights, metrics, monthlySeries, periodRange } from '@/core/analytics';
import { allCategories, TYPES } from '@/core/categories';
import { endOfMonth, inr, monthKey, pct, plural, shortDate } from '@/core/format';
import { useApp } from '@/data/AppData';
import { cn } from '@/lib/cn';

const TABS = [
  { value: 'overview', label: 'Overview', icon: 'ChartColumn' },
  { value: 'transactions', label: 'Transactions', icon: 'List' },
  { value: 'payees', label: 'Payees', icon: 'Store' },
  { value: 'in', label: 'Money in', icon: 'ArrowDownLeft' },
  { value: 'rules', label: 'Rules & categories', icon: 'Wand' },
];

function useParamState() {
  const [params, setParams] = useSearchParams();
  const get = (k, d = '') => params.get(k) ?? d;
  const set = (patch) =>
    setParams(
      (prev) => {
        const p = new URLSearchParams(prev);
        for (const [k, v] of Object.entries(patch)) v == null || v === '' ? p.delete(k) : p.set(k, v);
        return p;
      },
      { replace: true },
    );
  return [get, set];
}

export default function Expenses() {
  const { txns, store, subscriptions, today, session, scan, syncNow } = useApp();
  const [get, set] = useParamState();
  const tab = get('tab', 'overview');
  const periodId = get('period', 'this_month');
  const custom = { from: get('from'), to: get('to') };
  const range = useMemo(() => periodRange(periodId, today, custom), [periodId, today, custom.from, custom.to]);
  const cats = useMemo(() => categoryMap(store.categories), [store.categories]);
  const [openTxn, setOpenTxn] = useState(null);
  const [payee, setPayee] = useState(null);
  const [importing, setImporting] = useState(false);
  const [adding, setAdding] = useState(false);

  const m = useMemo(() => metrics(txns, range), [txns, range]);
  const inPeriod = useMemo(() => txns.filter((t) => inRange(t, range)), [txns, range]);
  const openTx = openTxn ? txns.find((t) => t.id === openTxn) : null;
  const showTxns = (filters) => set({ tab: 'transactions', q: null, dir: null, cat: null, type: null, ids: null, payee: null, max: null, review: null, ...filters });

  const hasData = txns.length > 0;
  const header = (
    <PageHeader
      title="Expenses"
      subtitle="Where your money comes from and where it goes."
      actions={
        <>
          <Button variant="outline" size="sm" icon="FileUp" onClick={() => setImporting(true)}>Import statement</Button>
          <Button variant="outline" size="sm" icon="Plus" onClick={() => setAdding(true)}>Add</Button>
        </>
      }
    />
  );

  return (
    <div>
      {header}
      {!hasData ? (
        <Card>
          <Empty icon={scan.running ? 'LoaderCircle' : 'Wallet'} title={scan.running ? `Reading your Gmail… ${scan.scanned} emails checked` : 'No transactions yet'}>
            {scan.running
              ? 'Payment alerts, receipts and loan emails are being read. Transactions appear here as they are found.'
              : session.access?.gmail
                ? 'Sync Gmail to read your bank alerts and receipts, or import a bank statement (CSV) for complete history including money received.'
                : 'Gmail access was not granted. Import a bank statement (CSV) or sign in again and allow Gmail.'}
          </Empty>
          <div className="flex flex-wrap justify-center gap-2 pb-4">
            {session.access?.gmail && !scan.running && <Button icon="RefreshCw" onClick={() => syncNow()}>Sync Gmail</Button>}
            <Button variant="outline" icon="FileUp" onClick={() => setImporting(true)}>Import statement</Button>
          </div>
        </Card>
      ) : (
        <>
          <div className="mb-4 flex flex-col gap-3">
            <Segmented id="exp-tabs" label="Expenses sections" value={tab} onChange={(v) => set({ tab: v })} options={TABS} className="self-start" />
            {tab !== 'rules' && <PeriodPicker value={periodId} custom={custom} onChange={(v) => set({ period: v === 'this_month' ? null : v })} onCustom={(c) => set({ from: c.from, to: c.to })} />}
          </div>

          {tab === 'overview' && <Overview m={m} range={range} txns={txns} inPeriod={inPeriod} subscriptions={subscriptions} store={store} cats={cats} showTxns={showTxns} setPayee={setPayee} openTxn={setOpenTxn} today={today} />}
          {tab === 'transactions' && <Transactions inPeriod={inPeriod} range={range} cats={cats} store={store} get={get} set={set} onOpen={(t) => setOpenTxn(t.id)} today={today} />}
          {tab === 'payees' && <Payees inPeriod={inPeriod} cats={cats} setPayee={setPayee} openTxn={(t) => setOpenTxn(t.id)} get={get} set={set} />}
          {tab === 'in' && <MoneyIn txns={txns} range={range} setPayee={setPayee} showTxns={showTxns} m={m} />}
          {tab === 'rules' && <Rules />}
        </>
      )}

      <TransactionSheet txn={openTx} onClose={() => setOpenTxn(null)} />
      <PayeeSheet payeeKey={payee} onClose={() => setPayee(null)} onOpenTxn={(t) => { setPayee(null); setOpenTxn(t.id); }} />
      <ImportStatementDialog open={importing} onClose={() => setImporting(false)} />
      <AddTransactionDialog open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

/** Sources → categories (+ saved) for the money-flow chart. Own transfers are already left out. */
function moneyFlow(txns, range, breakdown, m) {
  if (!m.moneyIn && !m.moneyOut) return null;
  const src = entities(txns.filter((t) => inRange(t, range)), 'in');
  const sources = src.slice(0, 4).map((e) => ({ key: e.key, label: e.name, value: e.total }));
  const restIn = m.moneyIn - sources.reduce((s, x) => s + x.value, 0);
  if (restIn > 0) sources.push({ key: 'other-in', label: 'Other sources', value: restIn });
  const targets = breakdown.slice(0, 6).map((c) => ({ key: c.id, label: c.label, value: c.total }));
  const restOut = m.moneyOut - targets.reduce((s, x) => s + x.value, 0);
  if (restOut > 0) targets.push({ key: 'other-out', label: 'Other payments', value: restOut });
  const saved = m.moneyIn - m.moneyOut;
  if (saved > 0) targets.push({ key: 'saved', label: 'Kept', value: saved, saved: true });
  const fromBalance = saved < 0 ? -saved : 0;
  if (fromBalance) sources.push({ key: 'balance', label: 'Earlier balance', value: fromBalance });
  if (!sources.length || !targets.length) return null;
  return { sources, targets, fromBalance };
}

function Overview({ m, range, txns, inPeriod, subscriptions, store, cats, showTxns, setPayee, openTxn, today }) {
  const endKey = monthKey(range.to);
  const series = useMemo(() => monthlySeries(txns, endKey, Math.max(6, Math.min(12, range.months + 5))), [txns, endKey, range.months]);
  const breakdown = useMemo(() => categoryBreakdown(inPeriod, store.categories), [inPeriod, store.categories]);
  const insights = useMemo(() => leakageInsights(txns, range, { subscriptions, customCategories: store.categories }), [txns, range, subscriptions, store.categories]);
  const payees = useMemo(() => entities(inPeriod), [inPeriod]);
  const largest = useMemo(() => inPeriod.filter((t) => t.direction === 'out' && !t.excluded && t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 5), [inPeriod]);
  const perMonth = range.months > 1;
  const top = m.topCategory;
  const flow = useMemo(() => moneyFlow(txns, range, breakdown, m), [txns, range, breakdown, m]);
  const days = useMemo(() => {
    const map = new Map();
    for (const t of txns) if (!t.excluded && t.direction === 'out' && t.type === 'expense') map.set(t.date, (map.get(t.date) ?? 0) + t.amount);
    return map;
  }, [txns]);

  const tiles = [
    { label: 'Total income', value: inr(m.income), icon: 'TrendingUp', tone: 'good', sub: 'Salary and other earnings', onClick: () => showTxns({ dir: 'in', type: 'income' }), spark: <Sparkline values={series.map((x) => x.income)} color="viz-in" /> },
    { label: 'Total expenses', value: inr(m.expenses), icon: 'TrendingDown', tone: 'warn', sub: m.refunds ? `After ${inr(m.refunds)} of refunds` : 'Spending, excluding transfers', onClick: () => showTxns({ dir: 'out', type: 'expense' }), spark: <Sparkline values={series.map((x) => x.expenses)} color="viz-out" /> },
    { label: 'Net cash flow', value: inr(m.netCashFlow, { sign: true }), icon: 'ArrowLeftRight', tone: m.netCashFlow >= 0 ? 'good' : 'bad', sub: 'Money received − money spent', emphasis: true },
    { label: 'Money received', value: inr(m.moneyIn), icon: 'ArrowDownLeft', sub: 'All credits except own transfers', onClick: () => showTxns({ dir: 'in' }) },
    { label: 'Money spent', value: inr(m.moneyOut), icon: 'ArrowUpRight', sub: 'All debits except own transfers', onClick: () => showTxns({ dir: 'out' }) },
    { label: perMonth ? 'Saved per month' : 'Saved this period', value: inr(m.savingsPerMonth, { sign: true }), icon: 'PiggyBank', tone: m.savingsPerMonth >= 0 ? 'good' : 'bad', sub: m.savingsRate != null ? `${pct(m.savingsRate)} of income` : 'Income − expenses' },
    { label: 'Average monthly spend', value: inr(m.avgMonthlyExpense), icon: 'CalendarRange', sub: `Over ${plural(range.months, 'month')}` },
    { label: 'Highest spending', value: top ? top.label : '—', icon: top?.icon ?? 'ChartPie', sub: top ? `${inr(top.total)} · ${pct(top.share)}` : 'No spending yet', onClick: top ? () => showTxns({ cat: top.id }) : undefined },
  ];

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {tiles.map((t) => (
          <Tile key={t.label} {...t} />
        ))}
      </div>
      <p className="-mt-2 text-[12.5px] text-ink-3">
        {range.label} · {shortDate(range.from, true)} – {shortDate(range.to, true)}. Transfers between your own accounts, credit card bill payments and investments are not counted as spending.
      </p>

      <Card>
        <CardHead title="Cash flow" subtitle="Income and expenses by month. Click a month to see its transactions." icon="ChartSpline" />
        <CashFlowChart data={series} selectedKey={range.months === 1 ? endKey : null} onSelect={(d) => showTxns({ period: 'custom', from: `${d.key}-01`, to: endOfMonth(d.key) })} />
        {series.some((s) => s.unusual) && (
          <p className="mt-2 flex items-center gap-1.5 text-[12.5px] text-warn">
            <Icon name="TriangleAlert" size={14} /> Unusually high spending in {series.filter((s) => s.unusual).map((s) => s.longLabel).join(', ')} (30%+ above the three months before).
          </p>
        )}
      </Card>

      {flow && (
        <Card>
          <CardHead title="Money flow" subtitle="Where this period's money came from and where it went. Click a category to see its payments." icon="Waypoints" />
          <MoneyFlow sources={flow.sources} targets={flow.targets} onPickTarget={(k) => (k === 'other-out' ? showTxns({ dir: 'out' }) : showTxns({ cat: k }))} />
          {flow.fromBalance > 0 && <p className="mt-1 text-[12.5px] text-ink-3">More went out than came in, so {inr(flow.fromBalance)} is shown as coming from earlier balance.</p>}
        </Card>
      )}

      <Card>
        <CardHead title="Daily spending" subtitle="Expenses per day over the last six months. Darker means more. Click a day to see its payments." icon="CalendarDays" />
        {days.size ? <SpendHeatmap days={days} today={today} onPick={(d) => showTxns({ period: 'custom', from: d, to: d })} /> : <Empty icon="CalendarDays" title="No spending yet" />}
      </Card>

      <div className="grid gap-5 lg:grid-cols-[1.25fr_1fr]">
        <Card>
          <CardHead title="Where it goes" subtitle="Spending by category. Click one to see its transactions." icon="ChartPie" />
          {breakdown.length ? <CategoryDonut categories={breakdown} total={m.grossExpenses} onPick={(id) => (id ? showTxns({ cat: id }) : showTxns({ dir: 'out', type: 'expense' }))} /> : <Empty icon="ChartPie" title="No spending in this period" />}
        </Card>
        <Card>
          <CardHead title="Where is my money going?" subtitle="Observations from your transactions. Each one opens the payments behind it." icon="Search" />
          {insights.length ? (
            <ul className="flex flex-col gap-2">
              {insights.map((i) => (
                <li key={i.id}>
                  {i.link ? (
                    <Link to={i.link} className="flex gap-3 rounded-xl p-2.5 transition hover:bg-surface-2">
                      <InsightBody i={i} />
                    </Link>
                  ) : (
                    <button type="button" onClick={() => showTxns(i.filter?.category ? { cat: i.filter.category } : i.filter?.maxAmount ? { max: String(i.filter.maxAmount), dir: 'out', type: 'expense' } : { ids: i.ids.join(',') })} className="flex w-full gap-3 rounded-xl p-2.5 text-left transition hover:bg-surface-2">
                      <InsightBody i={i} />
                    </button>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <Empty icon="Sparkles" title="Nothing stands out yet">Observations appear once there are a few weeks of transactions to compare.</Empty>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHead title="Top payees" subtitle="Who you paid the most" icon="Store" />
          <BarList rows={payees.slice(0, 6).map((e) => ({ ...e, label: e.name, icon: e.isPerson ? 'User' : 'Store' }))} onPick={(r) => setPayee(r.key)} sub={(r) => `${plural(r.count, 'payment')}`} empty="No payments in this period." />
        </Card>
        <Card>
          <CardHead title="Largest payments" icon="ArrowUpRight" />
          {largest.length ? (
            <ul>
              {largest.map((t) => (
                <TransactionRow key={t.id} t={t} cats={cats} onOpen={(x) => openTxn(x.id)} showDate />
              ))}
            </ul>
          ) : (
            <p className="py-6 text-center text-[13.5px] text-ink-3">No payments in this period.</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function InsightBody({ i }) {
  return (
    <>
      <span className={cn('mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg', i.tone === 'warn' ? 'bg-warn-soft text-warn' : 'bg-info-soft text-info')}>
        <Icon name={i.tone === 'warn' ? 'TriangleAlert' : 'Lightbulb'} size={16} />
      </span>
      <span className="min-w-0">
        <span className="block text-[14px] font-semibold">{i.title}</span>
        <span className="block text-[13px] text-ink-2">{i.text}</span>
      </span>
      <Icon name="ChevronRight" size={16} className="ml-auto mt-2 shrink-0 text-ink-3" />
    </>
  );
}

function Transactions({ inPeriod, range, cats, store, get, set, onOpen, today }) {
  const q = get('q');
  const dir = get('dir');
  const cat = get('cat');
  const type = get('type');
  const ids = get('ids');
  const payee = get('payee');
  const max = Number(get('max')) || null;
  const review = get('review') === '1';
  const idSet = ids ? new Set(ids.split(',')) : null;
  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return inPeriod.filter((t) => {
      if (idSet && !idSet.has(t.id)) return false;
      if (dir && t.direction !== dir) return false;
      if (cat && t.category !== cat) return false;
      if (type && t.type !== type) return false;
      if (payee && t.entityKey !== payee) return false;
      if (max && t.amount >= max) return false;
      if (review && (t.classifiedBy !== 'auto' || t.confidence >= 0.5)) return false;
      if (needle && ![t.name, t.counterparty, t.description, t.notes, t.purpose, t.reference, t.vpa, t.method, cats.get(t.category)?.label].some((x) => x && String(x).toLowerCase().includes(needle))) return false;
      return true;
    });
  }, [inPeriod, q, dir, cat, type, ids, payee, max, review, cats]);
  const totalOut = list.filter((t) => t.direction === 'out' && !t.excluded && t.type !== 'transfer').reduce((s, t) => s + t.amount, 0);
  const totalIn = list.filter((t) => t.direction === 'in' && !t.excluded && t.type !== 'transfer').reduce((s, t) => s + t.amount, 0);
  const toReview = inPeriod.filter((t) => t.classifiedBy === 'auto' && t.confidence < 0.5).length;
  const active = [idSet && 'Selected payments', payee && `Payee`, max && `Under ${inr(max)}`].filter(Boolean);

  return (
    <Card className="p-3 sm:p-4">
      <div className="flex flex-col gap-2 px-1 pb-3 lg:flex-row lg:items-center">
        <SearchInput value={q} onChange={(v) => set({ q: v })} placeholder="Search name, UPI ID, reference, notes" className="lg:w-80" />
        <div className="grid grid-cols-3 gap-2 lg:flex">
          <Select value={dir} onChange={(e) => set({ dir: e.target.value })} aria-label="Direction" className="h-9 text-[13px]">
            <option value="">In & out</option>
            <option value="out">Money out</option>
            <option value="in">Money in</option>
          </Select>
          <Select value={cat} onChange={(e) => set({ cat: e.target.value })} aria-label="Category" className="h-9 text-[13px]">
            <option value="">All categories</option>
            {allCategories(store.categories).map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </Select>
          <Select value={type} onChange={(e) => set({ type: e.target.value })} aria-label="Type" className="h-9 text-[13px]">
            <option value="">All types</option>
            {Object.entries(TYPES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </Select>
        </div>
        {toReview > 0 && (
          <Button variant={review ? 'secondary' : 'ghost'} size="sm" icon="CircleHelp" onClick={() => set({ review: review ? null : '1' })}>
            To check · {toReview}
          </Button>
        )}
      </div>
      {active.length > 0 && (
        <div className="mb-2 flex flex-wrap items-center gap-2 px-1">
          {active.map((a) => (
            <Badge key={a} tone="brand">{a}</Badge>
          ))}
          <button type="button" className="text-[13px] font-medium text-primary hover:underline" onClick={() => set({ ids: null, payee: null, max: null })}>Clear</button>
        </div>
      )}
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 px-2 text-[12.5px] text-ink-3">
        <span>{plural(list.length, 'transaction')}</span>
        <span className="tnum">Out {inr(totalOut)}</span>
        <span className="tnum">In {inr(totalIn)}</span>
        <span>{range.label}</span>
      </div>
      {list.length ? <GroupedList txns={list} cats={cats} onOpen={onOpen} today={today} /> : <Empty icon="SearchX" title="No transactions match" action={<Button variant="ghost" onClick={() => set({ q: null, dir: null, cat: null, type: null, ids: null, payee: null, max: null, review: null })}>Clear filters</Button>} />}
    </Card>
  );
}

function Payees({ inPeriod, setPayee, get, set }) {
  const view = get('view', 'merchants');
  const all = useMemo(() => entities(inPeriod), [inPeriod]);
  const largest = useMemo(() => inPeriod.filter((t) => t.direction === 'out' && !t.excluded && t.type === 'expense').sort((a, b) => b.amount - a.amount).slice(0, 15), [inPeriod]);
  const rows =
    view === 'people' ? all.filter((e) => e.isPerson) : view === 'frequent' ? [...all].sort((a, b) => b.count - a.count) : view === 'largest' ? null : all.filter((e) => !e.isPerson);
  return (
    <Card className="p-3 sm:p-4">
      <Segmented
        id="payee-view"
        label="Payee view"
        size="sm"
        value={view}
        onChange={(v) => set({ view: v })}
        className="mb-3"
        options={[
          { value: 'merchants', label: 'Top merchants' },
          { value: 'people', label: 'Top people' },
          { value: 'frequent', label: 'Most frequent' },
          { value: 'largest', label: 'Largest payments' },
        ]}
      />
      {rows ? (
        rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-[13.5px]">
              <thead>
                <tr className="border-b border-line text-left text-[12px] uppercase tracking-wide text-ink-3">
                  <th className="px-2 py-2 font-medium">Payee</th>
                  <th className="px-2 py-2 text-right font-medium">Total spent</th>
                  <th className="px-2 py-2 text-right font-medium">Payments</th>
                  <th className="px-2 py-2 text-right font-medium">Average</th>
                  <th className="px-2 py-2 text-right font-medium">Last paid</th>
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 60).map((e) => (
                  <tr key={e.key} onClick={() => setPayee(e.key)} className="cursor-pointer border-b border-line/60 hover:bg-surface-2">
                    <td className="px-2 py-2.5">
                      <button type="button" className="flex items-center gap-2 text-left font-medium" onClick={() => setPayee(e.key)}>
                        <Icon name={e.isPerson ? 'User' : 'Store'} size={15} className="text-ink-3" />
                        {e.name}
                      </button>
                    </td>
                    <td className="tnum px-2 py-2.5 text-right font-semibold">{inr(e.total)}</td>
                    <td className="tnum px-2 py-2.5 text-right">{e.count}</td>
                    <td className="tnum px-2 py-2.5 text-right">{inr(Math.round(e.total / e.count))}</td>
                    <td className="px-2 py-2.5 text-right text-ink-2">{shortDate(e.last)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <Empty icon="Users" title={view === 'people' ? 'No payments to people in this period' : 'No payees in this period'} />
        )
      ) : (
        <BarList rows={largest.map((t) => ({ key: t.id, label: t.name, total: t.amount, entity: t.entityKey, date: t.date }))} sub={(r) => shortDate(r.date)} onPick={(r) => setPayee(r.entity)} empty="No payments in this period." />
      )}
    </Card>
  );
}

function MoneyIn({ txns, range, setPayee, showTxns, m }) {
  const flow = useMemo(() => inflows(txns, range), [txns, range]);
  const t = flow.byType;
  const tiles = [
    { label: 'Income', value: inr(t.income ?? 0), icon: 'BriefcaseBusiness', tone: 'good', type: 'income' },
    { label: 'Refunds', value: inr(t.refund ?? 0), icon: 'Undo2', type: 'refund' },
    { label: 'Reimbursements', value: inr(t.reimbursement ?? 0), icon: 'ReceiptText', type: 'reimbursement' },
    { label: 'Loans received', value: inr(t.borrowing ?? 0), icon: 'Landmark', type: 'borrowing' },
    { label: 'Own transfers', value: inr(t.transfer ?? 0), icon: 'ArrowLeftRight', type: 'transfer' },
  ];
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {tiles.map((x) => (
          <Tile key={x.label} label={x.label} value={x.value} icon={x.icon} tone={x.tone} onClick={() => showTxns({ dir: 'in', type: x.type })} />
        ))}
      </div>
      <p className="-mt-2 text-[12.5px] text-ink-3">Only "Income" counts as income. Refunds reduce your expenses; reimbursements, loans and transfers between your own accounts are kept separate. Change any credit's type to correct it.</p>
      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHead title="Top sources" subtitle={`${inr(flow.total)} received in total`} icon="ArrowDownLeft" />
          <BarList
            rows={flow.sources.slice(0, 8).map((s) => ({ ...s, label: s.name, icon: s.isPerson ? 'User' : 'Building2', badge: s.recurring ? <Badge tone="good" icon="Repeat">Recurring</Badge> : null }))}
            sub={(r) => plural(r.count, 'credit')}
            onPick={(r) => setPayee(r.key)}
            empty="No money received in this period."
          />
        </Card>
        <Card>
          <CardHead title="From people" subtitle="Friends, family and others who sent you money" icon="HandCoins" />
          <BarList rows={flow.people.slice(0, 8).map((s) => ({ ...s, label: s.name, icon: 'User' }))} sub={(r) => `${plural(r.count, 'credit')} · last ${shortDate(r.last)}`} onPick={(r) => setPayee(r.key)} empty="No money from people in this period." />
          {m.income > 0 && flow.recurring.length > 0 && (
            <p className="mt-3 text-[12.5px] text-ink-3">Recurring income: {flow.recurring.map((r) => r.name).join(', ')} (3+ months of similar amounts).</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function Rules() {
  const { store, txns, actions } = useApp();
  const rules = Object.values(store.rules).filter((r) => !r.deleted);
  const cats = allCategories(store.categories);
  const catLabel = (id) => cats.find((c) => c.id === id)?.label ?? id;
  const [confirm, setConfirm] = useState(null);
  const [newCat, setNewCat] = useState({ label: '', kind: 'expense', parent: '' });
  const custom = Object.values(store.categories).filter((c) => !c.deleted);
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardHead title="Your classification rules" subtitle="Made when you chose “Apply to all” after correcting a transaction. Your edits to single transactions still win." icon="Wand" />
        {rules.length ? (
          <ul className="flex flex-col divide-y divide-line">
            {rules.map((r) => {
              const n = txns.filter((t) => t.ruleId === r.id).length;
              return (
                <li key={r.id} className="flex flex-wrap items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px] font-semibold">
                      {r.direction === 'in' ? 'From' : 'To'} {r.label ?? r.keys[0]}
                      {r.keys.length > 1 && <span className="font-normal text-ink-3"> + {r.keys.length - 1} similar name{r.keys.length > 2 ? 's' : ''}</span>}
                      {r.amount != null && <span className="font-normal text-ink-3"> · exactly {inr(r.amount, { exact: true })}</span>}
                    </p>
                    <p className="text-[13px] text-ink-2">
                      {[r.set.counterparty && `Name: ${r.set.counterparty}`, r.set.category && `Category: ${catLabel(r.set.category)}`, r.set.subcategory && `Subcategory: ${r.set.subcategory}`, r.set.type && `Type: ${TYPES[r.set.type]?.label}`, r.set.purpose && `Purpose: ${r.set.purpose}`, r.set.subscription !== undefined && (r.set.subscription ? `Subscription: ${r.set.subscription}` : 'Not a subscription')].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-[12px] text-ink-3">Applies to {plural(n, 'transaction')} now</p>
                  </div>
                  <Button variant="danger-ghost" size="sm" icon="Trash2" onClick={() => setConfirm(r)}>Remove</Button>
                </li>
              );
            })}
          </ul>
        ) : (
          <Empty icon="Wand" title="No rules yet">Open any transaction, correct its category or payee, and choose “Apply to all” to teach Recundle.</Empty>
        )}
      </Card>
      <Card>
        <CardHead title="Your categories" subtitle="Add categories or subcategories of your own." icon="Tags" />
        <div className="grid gap-2">
          <Field label="Name">
            <Input value={newCat.label} onChange={(e) => setNewCat((c) => ({ ...c, label: e.target.value }))} placeholder="e.g. Pets" />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Inside">
              <Select value={newCat.parent} onChange={(e) => setNewCat((c) => ({ ...c, parent: e.target.value }))}>
                <option value="">New category</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>Subcategory of {c.label}</option>
                ))}
              </Select>
            </Field>
            {!newCat.parent && (
              <Field label="For">
                <Select value={newCat.kind} onChange={(e) => setNewCat((c) => ({ ...c, kind: e.target.value }))}>
                  <option value="expense">Spending</option>
                  <option value="income">Money in</option>
                </Select>
              </Field>
            )}
          </div>
          <Button
            icon="Plus"
            disabled={!newCat.label.trim()}
            onClick={() => {
              actions.addCategory({ label: newCat.label.trim(), kind: newCat.kind, parent: newCat.parent || null });
              toast.success(`Added ${newCat.label.trim()}`);
              setNewCat({ label: '', kind: 'expense', parent: '' });
            }}
          >
            Add
          </Button>
        </div>
        {custom.length > 0 && (
          <ul className="mt-4 flex flex-col divide-y divide-line">
            {custom.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 py-2 text-[13.5px]">
                <span>{c.label}{c.parent && <span className="text-ink-3"> · in {catLabel(c.parent)}</span>}</span>
                <Button variant="danger-ghost" size="sm" onClick={() => actions.deleteCategory(c.id)}>Remove</Button>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Dialog
        open={Boolean(confirm)}
        onClose={() => setConfirm(null)}
        title="Remove this rule?"
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Keep</Button><Button variant="danger" onClick={() => { actions.deleteRule(confirm.id); setConfirm(null); toast.success('Rule removed'); }}>Remove rule</Button></>}
      >
        Transactions it classified go back to Recundle's own guess, except ones you edited individually.
      </Dialog>
    </div>
  );
}
