import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Badge, Button, Card, CardHead, Empty, Icon, Progress, Tile } from '@/components/ui';
import { CashFlowChart } from '@/components/charts';
import { metrics, monthlySeries, periodRange } from '@/core/analytics';
import { subscriptionTotals } from '@/core/subscriptions';
import { loanTotals } from '@/core/loans';
import { addDays, daysBetween, endOfMonth, inr, monthKey, pct, plural, shortDate } from '@/core/format';
import { useApp } from '@/data/AppData';
import { TODO_CATEGORIES } from './Todos';
import { CircuitGrid } from '@/components/landing/Grw';

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export default function Dashboard() {
  const { session, txns, subscriptions, loans, todos, today, drive, syncNow, dataState } = useApp();
  const navigate = useNavigate();
  // Statements arrive after a month ends, so until this month has any rows, show the latest month.
  const current = useMemo(() => txns.some((t) => t.date >= `${monthKey(today)}-01`), [txns, today]);
  const range = useMemo(() => periodRange(current ? 'this_month' : 'last_month', today), [today, current]);
  const monthName = new Date(`${range.from}T00:00:00`).toLocaleDateString('en-IN', { month: 'long' });
  const when = current ? 'this month' : `· ${monthName}`;
  const m = useMemo(() => metrics(txns, range), [txns, range]);
  const prev = useMemo(() => metrics(txns, range.previous), [txns, range]);
  const series = useMemo(() => monthlySeries(txns, monthKey(today), 6), [txns, today]);
  const subs = useMemo(() => subscriptionTotals(subscriptions, today), [subscriptions, today]);
  const lt = useMemo(() => loanTotals(loans), [loans]);
  const pending = todos.filter((t) => t.status !== 'completed');
  const first = session.user?.name?.split(' ')[0];
  const in30 = addDays(today, 30);

  const upcoming = [
    ...subs.upcoming.map((s) => ({ key: `s-${s.key}`, date: s.nextRenewal, label: s.name, amount: s.amount, kind: 'Subscription', estimated: s.nextRenewalSource === 'estimated', to: '/subscriptions' })),
    ...loans.filter((l) => l.status !== 'closed' && l.nextEmi.value && l.nextEmi.value <= in30).map((l) => ({ key: `l-${l.id}`, date: l.nextEmi.value, label: `${l.lender} EMI`, amount: l.emi.value, kind: 'EMI', estimated: l.nextEmi.source === 'estimated', to: '/loans' })),
  ].sort((a, b) => a.date.localeCompare(b.date)).slice(0, 6);

  const insights = [];
  if (prev.expenses > 0 && m.expenses > 0) {
    // Compares the same days of last month, so a half-finished month isn't flattered.
    const ch = (m.expenses - prev.expenses) / prev.expenses;
    if (Math.abs(ch) >= 0.1) insights.push({ icon: ch > 0 ? 'TrendingUp' : 'TrendingDown', tone: ch > 0 ? 'warn' : 'good', text: `Spending is ${ch > 0 ? 'up' : 'down'} ${pct(Math.abs(ch))} on ${current ? 'the same days last month' : 'the month before'} (${inr(m.expenses)} vs ${inr(prev.expenses)}).`, to: '/expenses' });
  }
  if (subs.upcoming[0]) {
    const s = subs.upcoming[0];
    const d = daysBetween(today, s.nextRenewal);
    insights.push({ icon: 'CalendarClock', tone: 'info', text: `${s.name} renews ${d === 0 ? 'today' : d === 1 ? 'tomorrow' : `in ${d} days`}${s.amount ? ` (${inr(s.amount)})` : ''}.`, to: '/subscriptions' });
  }
  if (subs.failed) insights.push({ icon: 'CircleAlert', tone: 'bad', text: `${plural(subs.failed, 'subscription')} had a failed payment. Update the payment method to keep ${subs.failed === 1 ? 'it' : 'them'}.`, to: '/subscriptions' });
  const noc = loans.find((l) => l.status === 'noc_received');
  if (noc) insights.push({ icon: 'FileCheck2', tone: 'good', text: `An NOC for your ${noc.lender} loan was found. Review it to close the loan.`, to: '/loans' });
  if (pending.length) insights.push({ icon: 'ListTodo', tone: 'info', text: `${plural(pending.length, 'personal responsibility', 'personal responsibilities')} still pending.`, to: '/todos' });

  const nothing = !txns.length && !subscriptions.length && !loans.length;

  return (
    <div className="flex flex-col gap-5">
      <div className="relative overflow-hidden rounded-[var(--radius-xl)] border border-line bg-surface px-5 py-6 sm:px-7 sm:py-8">
        <CircuitGrid width={1400} height={360} seed={5} className="opacity-70 [mask-image:linear-gradient(90deg,transparent_25%,black_75%)]" />
        <div className="relative">
        <p className="label-mono text-ink-3">01 / {greeting()}</p>
        <h1 className="mt-1 text-[34px] font-medium leading-tight sm:text-[46px]">{first ? <>Hi {first}, <span className="text-ink/45">here’s your month.</span></> : 'Welcome.'}</h1>
        <p className="mt-1 text-[14px] text-ink-2">
          {drive.running ? (drive.total ? `Reading your PhonePe statements… ${drive.read} of ${drive.total}.` : 'Checking your Google Drive for statements…') : dataState.status === 'loading' ? 'Loading your data…' : current || !txns.length ? `Here's where things stand in ${new Date().toLocaleDateString('en-IN', { month: 'long' })}.` : `Showing ${monthName}, from your latest PhonePe statement.`}
        </p>
        </div>
      </div>

      {nothing && !drive.running && (
        <Card>
          <Empty icon="Sparkles" title="Let's find your finances" action={<div className="flex flex-wrap justify-center gap-2">{session.access?.drive && <Button icon="RefreshCw" onClick={() => syncNow()}>Sync Drive</Button>}<Button variant="outline" icon="FileUp" onClick={() => navigate('/expenses?tab=overview')}>Add a statement</Button><Button variant="outline" icon="ListTodo" onClick={() => navigate('/todos')}>Add to-dos</Button></div>}>
            Recundle reads the PhonePe statement PDFs in your Google Drive folder “Phone Pe - Monthly Statement”. Every payment and credit becomes a transaction; recurring payments become subscriptions and EMIs.
          </Empty>
        </Card>
      )}

      <section aria-label="Financial snapshot" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Tile label={`Money in ${when}`} value={inr(m.moneyIn)} icon="ArrowDownLeft" tone="good" sub={m.income ? `${inr(m.income)} income` : 'No income found yet'} onClick={() => navigate('/expenses?tab=in')} />
        <Tile label={`Money out ${when}`} value={inr(m.moneyOut)} icon="ArrowUpRight" tone="warn" sub={`${plural(txns.filter((t) => t.direction === 'out' && t.date >= range.from).length, 'payment')}`} onClick={() => navigate(`/expenses?tab=transactions&dir=out${current ? '' : '&period=last_month'}`)} />
        <Tile label="Net cash flow" value={inr(m.netCashFlow, { sign: true })} icon="ArrowLeftRight" tone={m.netCashFlow >= 0 ? 'good' : 'bad'} emphasis sub="Money in − money out" onClick={() => navigate('/expenses')} />
        <Tile label="Loans outstanding" value={inr(lt.outstanding)} icon="Landmark" sub={lt.active ? `${plural(lt.active, 'active loan')}${lt.outstandingEstimated ? ' · incl. estimates' : ''}` : 'No active loans'} onClick={() => navigate('/loans')} />
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <Card>
          <CardHead title="Cash flow" subtitle="Income and expenses, last 6 months" icon="ChartSpline" action={<Link to="/expenses" className="text-[13px] font-medium text-primary hover:underline">Expenses</Link>} />
          <CashFlowChart data={series} height={240} onSelect={(d) => navigate(`/expenses?tab=transactions&period=custom&from=${d.key}-01&to=${endOfMonth(d.key)}`)} />
        </Card>
        <Card>
          <CardHead title="Commitments" subtitle="What leaves every month" icon="Repeat" />
          <div className="grid grid-cols-2 gap-2.5">
            <Link to="/subscriptions" className="rounded-xl bg-surface-2 px-3 py-2.5 hover:bg-primary-soft">
              <p className="text-[12px] text-ink-3">Subscriptions</p>
              <p className="tnum text-[17px] font-bold">{inr(subs.monthly)}<span className="text-[12px] font-normal text-ink-3">/mo</span></p>
              <p className="text-[12px] text-ink-3">{subs.active} active</p>
            </Link>
            <Link to="/loans" className="rounded-xl bg-surface-2 px-3 py-2.5 hover:bg-primary-soft">
              <p className="text-[12px] text-ink-3">EMIs</p>
              <p className="tnum text-[17px] font-bold">{inr(lt.emi)}<span className="text-[12px] font-normal text-ink-3">/mo</span></p>
              <p className="text-[12px] text-ink-3">{plural(lt.emiKnownFor, 'loan')}</p>
            </Link>
          </div>
          <p className="mb-1 mt-4 text-[12.5px] font-medium uppercase tracking-wide text-ink-3">Next 30 days</p>
          {upcoming.length ? (
            <ul className="divide-y divide-line">
              {upcoming.map((u) => (
                <li key={u.key}>
                  <Link to={u.to} className="flex items-center gap-3 py-2 hover:text-primary">
                    <span className="w-14 shrink-0 text-[12.5px] font-semibold text-ink-2">{shortDate(u.date)}</span>
                    <span className="min-w-0 flex-1 truncate text-[13.5px]">{u.label}</span>
                    {u.estimated && <Badge>est.</Badge>}
                    <span className="tnum text-[13.5px] font-semibold">{u.amount ? inr(u.amount) : '—'}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-[13px] text-ink-3">No known renewals or EMIs in the next 30 days.</p>
          )}
        </Card>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card>
          <CardHead title="Loans" icon="Landmark" action={<Link to="/loans" className="text-[13px] font-medium text-primary hover:underline">All loans</Link>} />
          {loans.filter((l) => l.status !== 'closed').length ? (
            <ul className="flex flex-col gap-3">
              {loans.filter((l) => l.status !== 'closed').slice(0, 4).map((l) => (
                <li key={l.id}>
                  <Link to="/loans" className="block rounded-lg hover:bg-surface-2">
                    <div className="flex items-center justify-between gap-2 text-[13.5px]">
                      <span className="truncate font-medium">{l.lender}</span>
                      <span className="tnum font-semibold">{l.outstanding.value != null ? inr(l.outstanding.value) : '—'}</span>
                    </div>
                    {l.progress != null ? <Progress value={l.progress} className="mt-1.5" /> : <p className="text-[12px] text-ink-3">{l.discovered ? 'Found · confirm it' : 'Progress needs the original amount'}</p>}
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-[13px] text-ink-3">No active loans.</p>
          )}
          {lt.closable > 0 && <p className="mt-3 flex items-center gap-1.5 text-[13px] text-good"><Icon name="FileCheck2" size={15} /> {plural(lt.closable, 'loan')} can be closed</p>}
        </Card>

        <Card>
          <CardHead title="Pending to-dos" subtitle={`${pending.length} pending · ${todos.length - pending.length} done`} icon="ListTodo" action={<Link to="/todos" className="text-[13px] font-medium text-primary hover:underline">All</Link>} />
          {pending.length ? (
            <ul className="grid gap-2">
              {pending.slice(0, 4).map((t) => {
                const c = TODO_CATEGORIES.find((x) => x.id === t.category) ?? TODO_CATEGORIES.at(-1);
                return (
                  <li key={t.id}>
                    <Link to="/todos" className={`flex items-center gap-3 rounded-xl border border-line bg-gradient-to-br ${c.hue} px-3 py-2.5 transition hover:-translate-y-0.5`}>
                      <Icon name={c.icon} size={16} className="shrink-0 text-ink-2" />
                      <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{t.title}</span>
                      {t.dueDate && <span className="text-[12px] text-ink-3">{shortDate(t.dueDate)}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="py-3 text-[13px] text-ink-3">Nothing pending. <Link to="/todos" className="text-primary hover:underline">Add a to-do</Link></p>
          )}
        </Card>

        <Card>
          <CardHead title="Insights" icon="Lightbulb" />
          {insights.length ? (
            <ul className="flex flex-col gap-1">
              {insights.slice(0, 5).map((i) => (
                <li key={i.text}>
                  <Link to={i.to} className="flex gap-2.5 rounded-lg p-2 text-[13.5px] hover:bg-surface-2">
                    <Icon name={i.icon} size={16} className={`mt-0.5 shrink-0 ${i.tone === 'warn' ? 'text-warn' : i.tone === 'bad' ? 'text-bad' : i.tone === 'good' ? 'text-good' : 'text-info'}`} />
                    <span>{i.text}</span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="py-3 text-[13px] text-ink-3">Insights appear as Recundle learns your patterns.</p>
          )}
        </Card>
      </div>
    </div>
  );
}
