import { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHead, Dialog, Empty, Field, GmailLink, Icon, Input, PageHeader, Progress, Provenance, Select, Sheet, Textarea, Tile } from '@/components/ui';
import { PayoffChart } from '@/components/charts';
import { LOAN_STATUSES, LOAN_TYPES, loanTotals, nocCandidates, repaymentPlan, simulate } from '@/core/loans';
import { metrics, periodRange } from '@/core/analytics';
import { addMonths, inr, monthsToWords, parseRupees, pct, plural, shortDate } from '@/core/format';
import { useApp } from '@/data/AppData';
import { cn } from '@/lib/cn';

const TONE = { good: 'good', info: 'info', bad: 'bad', warn: 'warn', muted: 'muted' };
const PURPOSE = { sanction: 'Sanction letter', disbursal: 'Disbursal', emi_paid: 'EMI paid', emi_due: 'EMI reminder', statement: 'Statement', foreclosure_quote: 'Foreclosure quote', closure: 'Closure confirmation', noc: 'NOC' };

function Figure({ label, f, format = (v) => inr(v), hint }) {
  return (
    <div className="min-w-0 rounded-xl bg-surface-2 px-3 py-2.5">
      <dt className="text-[12px] text-ink-3">{label}</dt>
      <dd className="tnum truncate text-[15px] font-semibold">{f.value != null ? format(f.value) : '—'}</dd>
      <dd className="mt-1 flex flex-wrap items-center gap-1">
        <Provenance source={f.source} />
        {f.asOf && f.source !== 'missing' && <span className="text-[11.5px] text-ink-3">as of {shortDate(f.asOf, true)}</span>}
      </dd>
      {(f.note || hint) && <dd className="mt-0.5 text-[11.5px] text-ink-3">{f.note ?? hint}</dd>}
    </div>
  );
}

function LoanCard({ l, onOpen, index }) {
  const st = LOAN_STATUSES[l.status];
  return (
    <motion.button type="button" onClick={() => onOpen(l.id)} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index, 10) * 0.04 }} className={cn('card flex flex-col p-4 text-left transition hover:border-primary/40 hover:shadow-md', l.status === 'closed' && 'opacity-70')}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary-soft text-primary"><Icon name="Landmark" size={19} /></span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15.5px] font-semibold">{l.lender}</p>
          <p className="truncate text-[12.5px] text-ink-3">{l.loanType}{l.account ? ` · ${l.account}` : ''}</p>
        </div>
        <Badge tone={TONE[st.tone]}>{st.label}</Badge>
      </div>
      <div className="mt-4 grid grid-cols-3 gap-2 text-[12px] text-ink-3">
        <div>
          Outstanding
          <p className="tnum text-[15px] font-semibold text-ink">{l.outstanding.value != null ? inr(l.outstanding.value) : '—'}</p>
          {l.outstanding.source === 'estimated' && <p className="text-warn">estimated</p>}
        </div>
        <div>
          EMI
          <p className="tnum text-[15px] font-semibold text-ink">{l.emi.value ? inr(l.emi.value) : '—'}</p>
          {l.rate.value != null && <p>{l.rate.value}% p.a.{l.rate.source === 'estimated' ? ' (est.)' : ''}</p>}
        </div>
        <div>
          {l.status === 'closed' ? 'Closed' : 'Next EMI'}
          <p className="text-[15px] font-semibold text-ink">{l.status === 'closed' ? (l.closedOn ? shortDate(l.closedOn) : '✓') : l.nextEmi.value ? shortDate(l.nextEmi.value) : '—'}</p>
          {l.remainingEmis.value != null && l.status !== 'closed' && <p>{plural(l.remainingEmis.value, 'EMI')} left</p>}
        </div>
      </div>
      {l.progress != null && l.status !== 'closed' && (
        <div className="mt-3">
          <Progress value={l.progress} />
          <p className="mt-1 text-[11.5px] text-ink-3">{pct(l.progress)} of the principal repaid</p>
        </div>
      )}
      {l.flags.length > 0 && (
        <p className={cn('mt-3 flex items-start gap-1.5 text-[12.5px]', l.flags[0].kind === 'noc' ? 'text-good' : 'text-warn')}>
          <Icon name={l.flags[0].kind === 'noc' ? 'FileCheck2' : 'FileQuestion'} size={14} className="mt-0.5 shrink-0" /> {l.flags[0].text}
        </p>
      )}
      {l.missing.length > 0 && l.status !== 'closed' && <p className="mt-1.5 text-[12px] text-ink-3">Missing: {l.missing.join(', ')}</p>}
    </motion.button>
  );
}

export default function Loans() {
  const { loans, unmatchedLoanEmails, txns, today, actions, session } = useApp();
  const [openId, setOpenId] = useState(null);
  const [adding, setAdding] = useState(false);
  const totals = useMemo(() => loanTotals(loans), [loans]);
  const income = useMemo(() => metrics(txns, periodRange('3m', today)).income / 3, [txns, today]);
  const discovered = loans.filter((l) => l.discovered && l.status !== 'noc_received');
  const known = loans.filter((l) => !l.discovered || l.status === 'noc_received');
  const open = loans.find((l) => l.id === openId) ?? null;

  return (
    <div>
      <PageHeader title="Loans" subtitle="What you owe, what each loan costs, and how to close them sooner." actions={<Button variant="outline" size="sm" icon="Plus" onClick={() => setAdding(true)}>Add loan</Button>} />
      {loans.length === 0 ? (
        <Card>
          <Empty icon="Landmark" title="No loans found">
            Recundle looks in Gmail for sanction letters, EMI receipts and reminders, statements, foreclosure quotes, closure letters and NOCs. You can also add a loan yourself.
          </Empty>
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            <Tile label="Active loans" value={totals.active} icon="Landmark" tone="brand" sub={totals.verify ? `${totals.verify} to verify` : 'Confirmed by you'} />
            <Tile label="Outstanding" value={inr(totals.outstanding)} icon="Scale" emphasis sub={totals.outstandingKnownFor < totals.active ? `Known for ${totals.outstandingKnownFor} of ${totals.active}` : totals.outstandingEstimated ? 'Includes estimates' : 'From lender statements'} />
            <Tile label="EMIs every month" value={inr(totals.emi)} icon="CalendarClock" sub={totals.emiKnownFor < totals.active ? `Known for ${totals.emiKnownFor} of ${totals.active}` : 'All active loans'} />
            <Tile label="Monthly debt obligation" value={income > 0 ? pct(totals.emi / income) : inr(totals.emi)} icon="Percent" sub={income > 0 ? `of your average income (${inr(Math.round(income))})` : 'Add income to compare'} tone={income > 0 && totals.emi / income > 0.4 ? 'warn' : undefined} />
            <Tile label="Longest remaining" value={totals.longest ? monthsToWords(totals.longest) : '—'} icon="Hourglass" sub={totals.longest ? `Until about ${shortDate(addMonths(today, totals.longest), true)} (est.)` : 'Needs balance, EMI and rate'} />
            <Tile label="To verify" value={totals.verify} icon="CircleHelp" tone={totals.verify ? 'warn' : undefined} sub="Found in Gmail, not confirmed" />
            <Tile label="Can be closed" value={totals.closable} icon="FileCheck2" tone={totals.closable ? 'good' : undefined} sub="NOC or closure email found" />
            <Tile label="Unmatched closure emails" value={unmatchedLoanEmails.length} icon="FileQuestion" sub="Assign them to a loan" />
          </div>

          {discovered.length > 0 && (
            <Card className="border-warn/40">
              <CardHead title="Found in your Gmail: are these your loans?" subtitle="Confirm to track them. Nothing is counted until you do." icon="Search" />
              <ul className="divide-y divide-line">
                {discovered.map((l) => (
                  <li key={l.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{l.lender} <span className="font-normal text-ink-3">· {l.loanType}{l.account ? ` · ${l.account}` : ' · account number not found'}</span></p>
                      <p className="text-[12.5px] text-ink-3">{plural(l.events.length, 'email')}: {[...new Set(l.events.map((e) => PURPOSE[e.purpose] ?? e.purpose))].join(', ')}{l.emi.value ? ` · EMI ${inr(l.emi.value)}` : ''}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button variant="ghost" size="sm" onClick={() => setOpenId(l.id)}>Review</Button>
                      <Button variant="outline" size="sm" onClick={() => { actions.deleteLoan(l); toast.success('Hidden. Those emails won’t be shown as a loan again.'); }}>Not mine</Button>
                      <Button size="sm" onClick={() => { actions.saveLoan(l, { status: 'active' }); toast.success(`${l.lender} added to your loans`); }}>Confirm</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {unmatchedLoanEmails.length > 0 && <UnmatchedEmails events={unmatchedLoanEmails} loans={known} email={session.user?.email} />}

          {known.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {known.map((l, i) => (
                <LoanCard key={l.id} l={l} onOpen={setOpenId} index={i} />
              ))}
            </div>
          )}

          <Roadmap loans={known.filter((l) => !l.discovered)} today={today} onOpen={setOpenId} />
        </div>
      )}
      <LoanSheet loan={open} onClose={() => setOpenId(null)} />
      <AddLoan open={adding} onClose={() => setAdding(false)} />
    </div>
  );
}

function UnmatchedEmails({ events, loans, email }) {
  const { actions } = useApp();
  return (
    <Card>
      <CardHead title="Closure emails to match" subtitle="These name a lender with more than one loan and no account number. Choose the loan each belongs to." icon="FileQuestion" />
      <ul className="divide-y divide-line">
        {events.map((e) => {
          const options = nocCandidates(e, loans);
          return (
            <li key={e.messageId} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center">
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{PURPOSE[e.purpose] ?? 'Loan email'} · {e.lender}</p>
                <p className="truncate text-[12.5px] text-ink-3">{shortDate(e.date, true)} · {e.subject}</p>
              </div>
              <GmailLink messageId={e.messageId} email={email} />
              <Select defaultValue="" onChange={(ev) => { const l = loans.find((x) => x.id === ev.target.value); if (l) { actions.assignLoanEvent(e.messageId, l); toast.success(`Matched to ${l.lender}`); } }} className="h-9 text-[13px] sm:w-56">
                <option value="" disabled>Match to loan…</option>
                {(options.length ? options.map((o) => o.loan) : loans).map((l) => <option key={l.id} value={l.id}>{l.lender}{l.account ? ` · ${l.account}` : ''}</option>)}
              </Select>
            </li>
          );
        })}
      </ul>
    </Card>
  );
}

function Roadmap({ loans, today, onOpen }) {
  const [extra, setExtra] = useState('');
  const [lump, setLump] = useState('');
  const extraMonthly = parseRupees(extra) ?? 0;
  const lumpSum = parseRupees(lump) ?? 0;
  const plan = useMemo(() => repaymentPlan(loans, { extraMonthly, lumpSum, today }), [loans, extraMonthly, lumpSum, today]);
  const open = loans.filter((l) => l.status !== 'closed' && l.status !== 'noc_received');
  if (!open.length) return null;
  const chosen = plan.strategies.find((s) => s.id === plan.recommended);
  const other = plan.strategies.find((s) => s.id !== plan.recommended);
  const series = (r) => [plan.included.reduce((s, l) => s + l.balance, 0), ...r.timeline.map((t) => t.balance)];
  const baseRun = plan.baseline ? simulate(plan.included, { rollover: false }) : null;
  const anyEstimate = plan.included.some((l) => l.estimated);
  const sameOrder = chosen && other && chosen.order.join() === other.order.join();

  return (
    <Card>
      <CardHead title="How far am I from being debt-free?" subtitle="Try paying a little extra each month, or a one-time amount, and see the effect." icon="Flag" />
      {!plan.included.length ? (
        <Empty icon="Calculator" title="Not enough figures yet">
          The plan needs each loan's outstanding balance, EMI and interest rate. Open a loan and enter them from your latest statement. Missing: {plan.excluded.map((e) => `${e.lender} (${e.missing.join(', ')})`).join('; ')}.
        </Empty>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Field label="Extra every month (₹)" hint="On top of your EMIs"><Input inputMode="decimal" value={extra} onChange={(e) => setExtra(e.target.value)} placeholder="0" /></Field>
            <Field label="One-time payment now (₹)" hint="e.g. a bonus"><Input inputMode="decimal" value={lump} onChange={(e) => setLump(e.target.value)} placeholder="0" /></Field>
            <div className="rounded-xl bg-surface-2 px-3 py-2.5">
              <p className="text-[12px] text-ink-3">Remaining debt</p>
              <p className="tnum text-[18px] font-bold">{inr(plan.included.reduce((s, l) => s + l.balance, 0))}</p>
              <p className="text-[12px] text-ink-3">{inr(plan.included.reduce((s, l) => s + l.emi, 0))} a month in EMIs</p>
            </div>
            <div className="rounded-xl bg-primary-soft px-3 py-2.5">
              <p className="text-[12px] text-ink-2">Debt-free</p>
              <p className="text-[18px] font-bold">{shortDate((extraMonthly || lumpSum ? chosen : plan.baseline).debtFree, true)}</p>
              <p className="text-[12px] text-ink-2">{extraMonthly || lumpSum ? `${monthsToWords(chosen.monthsSaved)} sooner · saves ${inr(chosen.interestSaved)}` : `${monthsToWords(plan.baseline.months)} of EMIs left`}</p>
            </div>
          </div>

          {baseRun && <div className="mt-4"><PayoffChart baseline={series(baseRun)} plan={series(chosen)} startIso={today} /></div>}

          {sameOrder && <p className="mt-5 text-[13px] text-ink-2">{plan.included.length === 1 ? 'With one loan in the plan, both strategies are the same: every extra rupee goes to it.' : 'Here both strategies pick the same order: your highest-rate loan is also your smallest.'}</p>}
          <div className={cn('mt-5 grid gap-3', !sameOrder && 'lg:grid-cols-2')}>
            {(sameOrder ? [chosen] : [chosen, other]).map((s) => (
              <div key={s.id} className={cn('rounded-xl border p-4', s.id === plan.recommended ? 'border-primary bg-primary-soft/50' : 'border-line')}>
                <div className="flex items-center justify-between gap-2">
                  <p className="font-semibold">{sameOrder ? 'Your plan' : s.id === 'avalanche' ? 'A · Highest interest first' : 'B · Smallest balance first'}</p>
                  {s.id === plan.recommended && !sameOrder && <Badge tone="brand" icon="Star">Recommended</Badge>}
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1.5 text-[13px]">
                  <dt className="text-ink-3">Close first</dt>
                  <dd className="font-medium">{s.first.lender} ({s.first.rate}%)</dd>
                  <dt className="text-ink-3">Amount to close it</dt>
                  <dd className="tnum font-medium">{inr(s.first.amountToClose)}{s.first.foreclosurePct ? ` incl. ${s.first.foreclosurePct}% charge` : ''}</dd>
                  <dt className="text-ink-3">It closes</dt>
                  <dd className="font-medium">{s.first.closesOn ? `${shortDate(s.first.closesOn, true)} (month ${s.first.closesInMonth})` : '—'}</dd>
                  <dt className="text-ink-3">EMI freed then</dt>
                  <dd className="tnum font-medium">{inr(s.first.emi)} a month</dd>
                  <dt className="text-ink-3">Interest saved</dt>
                  <dd className="tnum font-medium text-good">{inr(Math.max(0, s.interestSaved))}</dd>
                  <dt className="text-ink-3">Debt-free</dt>
                  <dd className="font-medium">{shortDate(s.debtFree, true)}</dd>
                </dl>
                <ol className="mt-3 space-y-1 text-[12.5px] text-ink-2">
                  {s.closures.map((c, i) => (
                    <li key={c.id} className="flex justify-between gap-2">
                      <span>{i + 1}. {c.name}</span>
                      <span className="tnum">{c.month != null ? shortDate(addMonths(today, c.month), true) : '—'}</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-xl bg-surface-2 p-4 text-[13.5px] leading-relaxed">
            <p className="font-semibold">Recommended roadmap</p>
            {extraMonthly || lumpSum ? (
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-ink-2">
                <li>Put your extra money towards <b>{chosen.first.lender}</b> first{chosen.id === 'avalanche' ? `: at ${chosen.first.rate}% it's your most expensive loan` : `: its balance is the smallest, so it closes soonest`}.</li>
                <li>It would close around <b>{shortDate(chosen.first.closesOn, true)}</b>, releasing <b>{inr(chosen.first.emi)} a month</b>, which then goes to the next loan.</li>
                <li>Next priority: <b>{chosen.closures[1]?.name ?? 'none, that was the last one'}</b>.</li>
                <li>
                  Compared with paying EMIs only, this saves about <b>{inr(Math.max(0, chosen.interestSaved))}</b> in interest and finishes <b>{monthsToWords(Math.max(0, chosen.monthsSaved))}</b> sooner.{' '}
                  {sameOrder ? '' : plan.interestGap > 0 && chosen.id === 'snowball' ? `Strategy A would save ${inr(plan.interestGap)} more, but B frees an EMI sooner.` : `Strategy B would close ${other.first.lender} sooner but cost ${inr(Math.max(0, plan.interestGap))} more in interest.`}
                </li>
              </ol>
            ) : (
              <p className="mt-1 text-ink-2">Enter an extra monthly amount or a one-time payment above to compare strategies. Paying EMIs only, your loans finish in {monthsToWords(plan.baseline.months)} with about {inr(plan.baseline.interest)} of interest still to pay.</p>
            )}
            <p className="mt-2 text-[12.5px] text-ink-3">
              Assumes fixed interest rates, an EMI every month, and the foreclosure charges you entered (none otherwise). {anyEstimate && 'Some balances or rates are estimates. '}
              Confirm the foreclosure amount and any prepayment penalty with each lender before paying.
              {plan.excluded.length > 0 && ` Not included (missing figures): ${plan.excluded.map((e) => `${e.lender} – ${e.missing.join(', ')}`).join('; ')}.`}
            </p>
            {plan.excluded.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-2">
                {plan.excluded.map((e) => <Button key={e.id} variant="outline" size="sm" onClick={() => onOpen(e.id)}>Complete {e.lender}</Button>)}
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}

function LoanSheet({ loan, onClose }) {
  const { actions, session } = useApp();
  const [edit, setEdit] = useState(null);
  const [closing, setClosing] = useState(false);
  const [removing, setRemoving] = useState(false);
  if (!loan) return <Sheet open={false} onClose={onClose} />;
  const r = (v) => (v != null ? String(v / 100) : '');
  const startEdit = () =>
    setEdit({
      lender: loan.lender,
      account: loan.account ?? '',
      loanType: loan.loanType,
      principal: r(loan.principal.source === 'user' ? loan.principal.value : null),
      emi: r(loan.emi.source === 'user' ? loan.emi.value : null),
      rate: loan.rate.source === 'user' ? String(loan.rate.value) : '',
      tenureMonths: loan.tenure.source === 'user' ? String(loan.tenure.value) : '',
      disbursedOn: loan.disbursedOn.source === 'user' ? loan.disbursedOn.value : '',
      outstanding: '',
      outstandingAsOf: new Date().toISOString().slice(0, 10),
      foreclosurePct: loan.foreclosurePct != null ? String(loan.foreclosurePct) : '',
      notes: loan.notes ?? '',
    });
  const saveEdit = () => {
    const n = (v) => (v === '' ? null : Number(v));
    const fields = {
      lender: edit.lender.trim() || loan.lender,
      account: edit.account.trim() || null,
      loanType: edit.loanType,
      principal: parseRupees(edit.principal),
      emi: parseRupees(edit.emi),
      rate: n(edit.rate),
      tenureMonths: n(edit.tenureMonths),
      disbursedOn: edit.disbursedOn || null,
      foreclosurePct: n(edit.foreclosurePct),
      notes: edit.notes,
    };
    if (edit.outstanding !== '') {
      fields.outstanding = parseRupees(edit.outstanding);
      fields.outstandingAsOf = edit.outstandingAsOf;
    }
    for (const k of Object.keys(fields)) if (fields[k] === null) delete fields[k];
    actions.saveLoan(loan, { lender: fields.lender, account: fields.account ?? loan.account, loanType: fields.loanType, ...(loan.discovered ? { status: 'active' } : {}) }, fields);
    setEdit(null);
    toast.success('Loan updated');
  };
  const setStatus = (status) => {
    actions.saveLoan(loan, { status, statusSetByUser: true, ...(status === 'closed' ? { closedOn: loan.noc?.date ?? loan.closure?.date ?? new Date().toISOString().slice(0, 10) } : { closedOn: null }) });
    toast.success(`Marked ${LOAN_STATUSES[status].label.toLowerCase()}`);
  };
  const set = (k) => (e) => setEdit((x) => ({ ...x, [k]: e.target.value }));

  return (
    <>
      <Sheet
        open
        wide
        onClose={() => { setEdit(null); onClose(); }}
        title={loan.lender}
        subtitle={`${loan.loanType}${loan.account ? ` · ${loan.account}` : ''}`}
        footer={
          edit ? (
            <><Button variant="ghost" onClick={() => setEdit(null)}>Cancel</Button><Button onClick={saveEdit}>Save figures</Button></>
          ) : (
            <>
              <Button variant="danger-ghost" size="sm" className="mr-auto" icon="Trash2" onClick={() => setRemoving(true)}>{loan.discovered ? 'Not my loan' : 'Remove'}</Button>
              <Button variant="outline" icon="Pencil" onClick={startEdit}>Enter figures</Button>
              {loan.discovered && <Button onClick={() => { actions.saveLoan(loan, { status: 'active' }); toast.success('Loan confirmed'); }}>Confirm loan</Button>}
            </>
          )
        }
      >
        {!loan.discovered && !edit && (
          <Field label="Status">
            <Select value={loan.status} onChange={(e) => (e.target.value === 'closed' ? setClosing(true) : setStatus(e.target.value))}>
              {Object.entries(LOAN_STATUSES).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </Select>
          </Field>
        )}

        {(loan.noc || loan.closure || loan.flags.some((f) => f.kind === 'no_noc')) && !edit && (
          <div className={cn('mt-4 rounded-xl p-4 text-[13.5px]', loan.noc ? 'bg-good-soft' : 'bg-warn-soft')}>
            {loan.noc ? (
              <>
                <p className="flex items-center gap-2 font-semibold text-good"><Icon name="FileCheck2" size={17} /> NOC found</p>
                <p className="mt-1 text-ink-2">{loan.noc.subject} · closure date {shortDate(loan.noc.date, true)}{loan.noc.attachment ? ' · PDF attached' : ''}. Matched by {loan.noc.matchedBy === 'lender' ? 'lender name only — check the account number on it' : 'lender and account number'}.</p>
                <div className="mt-2 flex flex-wrap items-center gap-3">
                  <GmailLink messageId={loan.noc.messageId} email={session.user?.email}>Review the NOC</GmailLink>
                  {loan.status !== 'closed' && <Button size="sm" onClick={() => setClosing(true)}>I've checked it — mark closed</Button>}
                </div>
              </>
            ) : (
              <>
                <p className="flex items-center gap-2 font-semibold text-warn"><Icon name="FileQuestion" size={17} /> NOC not identified — loan closure status requires verification.</p>
                {loan.closure && <p className="mt-1 text-ink-2">A closure email was found ({shortDate(loan.closure.date, true)}), but no NOC. <GmailLink messageId={loan.closure.messageId} email={session.user?.email}>Open it</GmailLink></p>}
                <p className="mt-1 text-ink-2">Not finding an NOC in Gmail doesn't mean the loan is unpaid. Ask the lender for the NOC and keep it safe.</p>
              </>
            )}
          </div>
        )}

        {edit ? (
          <div className="mt-2 grid gap-3 sm:grid-cols-2">
            <p className="text-[13.5px] text-ink-2 sm:col-span-2">Enter what your latest loan statement or the lender's app says. Your figures are labelled "Entered by you" and take precedence over emails.</p>
            <Field label="Lender"><Input value={edit.lender} onChange={set('lender')} /></Field>
            <Field label="Loan account (last 4 digits)"><Input value={edit.account} onChange={set('account')} placeholder="XX1234" /></Field>
            <Field label="Type"><Select value={edit.loanType} onChange={set('loanType')}>{LOAN_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
            <Field label="Original loan amount (₹)"><Input inputMode="decimal" value={edit.principal} onChange={set('principal')} placeholder={loan.principal.value ? String(loan.principal.value / 100) : ''} /></Field>
            <Field label="Disbursed on"><Input type="date" value={edit.disbursedOn} onChange={set('disbursedOn')} /></Field>
            <Field label="EMI (₹ a month)"><Input inputMode="decimal" value={edit.emi} onChange={set('emi')} placeholder={loan.emi.value ? String(loan.emi.value / 100) : ''} /></Field>
            <Field label="Interest rate (% a year)"><Input inputMode="decimal" value={edit.rate} onChange={set('rate')} placeholder={loan.rate.value != null ? String(loan.rate.value) : ''} /></Field>
            <Field label="Tenure (months)"><Input inputMode="numeric" value={edit.tenureMonths} onChange={set('tenureMonths')} /></Field>
            <Field label="Outstanding principal (₹)" hint="From your latest statement"><Input inputMode="decimal" value={edit.outstanding} onChange={set('outstanding')} /></Field>
            <Field label="Outstanding as of"><Input type="date" value={edit.outstandingAsOf} onChange={set('outstandingAsOf')} /></Field>
            <Field label="Foreclosure / prepayment charge (%)" hint="Check your loan agreement; leave blank if unknown"><Input inputMode="decimal" value={edit.foreclosurePct} onChange={set('foreclosurePct')} /></Field>
            <Field label="Notes" className="sm:col-span-2"><Textarea value={edit.notes} onChange={set('notes')} /></Field>
          </div>
        ) : (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              <Figure label="Outstanding principal" f={loan.outstanding} />
              <Figure label="EMI" f={loan.emi} />
              <Figure label="Interest rate" f={loan.rate} format={(v) => `${v}% a year`} />
              <Figure label="Original amount" f={loan.principal} />
              <Figure label="Disbursed" f={loan.disbursedOn} format={(v) => shortDate(v, true)} />
              <Figure label="Tenure" f={loan.tenure} format={(v) => monthsToWords(v)} />
              <Figure label="EMIs remaining" f={loan.remainingEmis} format={(v) => `${v} (${monthsToWords(v)})`} />
              <Figure label="Next EMI" f={loan.nextEmi} format={(v) => shortDate(v, true)} />
              <Figure label="Foreclosure amount" f={loan.foreclosure} hint={loan.foreclosure.source === 'missing' ? 'Ask the lender for a foreclosure statement' : null} />
            </dl>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-3">
              <div className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]"><p className="text-[12px] text-ink-3">Still to pay in EMIs</p><p className="tnum font-semibold">{loan.remainingTotal != null ? inr(loan.remainingTotal) : '—'}</p><Provenance source={loan.remainingTotal != null ? 'estimated' : 'missing'} /></div>
              <div className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]"><p className="text-[12px] text-ink-3">Interest still to pay</p><p className="tnum font-semibold">{loan.remainingInterest != null ? inr(loan.remainingInterest) : '—'}</p><Provenance source={loan.remainingInterest != null ? 'estimated' : 'missing'} /></div>
              <div className="rounded-xl bg-surface-2 px-3 py-2.5 text-[13px]"><p className="text-[12px] text-ink-3">Finishes around</p><p className="font-semibold">{loan.completion ? shortDate(loan.completion, true) : '—'}</p><Provenance source={loan.completion ? 'estimated' : 'missing'} /></div>
            </div>
            {loan.missing.length > 0 && <p className="mt-3 text-[13px] text-ink-2"><Icon name="Info" size={14} className="mr-1 inline" />Not available from your emails: {loan.missing.join(', ')}. Choose "Enter figures" and copy them from your latest statement.</p>}
            {loan.notes && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-[13.5px]">{loan.notes}</p>}

            <div className="mt-5">
              <h3 className="text-[14px] font-semibold">EMI payments found ({loan.payments.length}) · {inr(loan.repaid)} repaid</h3>
              {loan.payments.length ? (
                <ul className="mt-1 divide-y divide-line text-[13.5px]">
                  {loan.payments.slice(0, 24).map((p) => (
                    <li key={p.id} className="flex justify-between py-2"><span>{shortDate(p.date, true)}{p.method ? ` · ${p.method}` : ''}</span><span className="tnum font-semibold">{inr(p.amount, { exact: true })}</span></li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-[13px] text-ink-3">No EMI payments matched yet. Open a payment in Expenses and choose this loan under "Loan".</p>
              )}
            </div>

            <div className="mt-5">
              <h3 className="text-[14px] font-semibold">Emails used ({loan.events.length})</h3>
              <ul className="mt-1 divide-y divide-line text-[13.5px]">
                {loan.events.map((e) => (
                  <li key={e.messageId} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2">
                    <span className="min-w-0 flex-1 truncate">{shortDate(e.date, true)} · <b>{PURPOSE[e.purpose] ?? e.purpose}</b> · {e.subject}</span>
                    {e.extractedBy === 'ai' && <Provenance source="ai" title={e.aiNotes ?? ''} />}
                    <GmailLink messageId={e.messageId} email={session.user?.email}>Open</GmailLink>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}
      </Sheet>
      <Dialog
        open={closing}
        onClose={() => setClosing(false)}
        title={`Mark ${loan.lender} as closed?`}
        footer={<><Button variant="ghost" onClick={() => setClosing(false)}>Cancel</Button><Button onClick={() => { setStatus('closed'); setClosing(false); }}>Mark closed</Button></>}
      >
        {loan.noc ? 'Make sure the NOC names this loan account and confirms nothing is due.' : 'No NOC was found in Gmail for this loan. Mark it closed only if you have confirmation from the lender; it will show "NOC not found" until one is added.'} It stops counting towards your outstanding debt and EMIs, and its history is kept.
      </Dialog>
      <Dialog
        open={removing}
        onClose={() => setRemoving(false)}
        title={loan.discovered ? 'Not your loan?' : `Remove ${loan.lender}?`}
        footer={<><Button variant="ghost" onClick={() => setRemoving(false)}>Cancel</Button><Button variant="danger" onClick={() => { actions.deleteLoan(loan); setRemoving(false); onClose(); toast.success('Removed'); }}>Remove</Button></>}
      >
        The emails it was found from won't be shown as a loan again. Payments stay in Expenses.
      </Dialog>
    </>
  );
}

function AddLoan({ open, onClose }) {
  const { actions } = useApp();
  const blank = { lender: '', loanType: 'Personal loan', account: '', principal: '', emi: '', rate: '', tenureMonths: '', disbursedOn: '', outstanding: '' };
  const [f, setF] = useState(blank);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = () => {
    const n = (v) => (v === '' ? undefined : Number(v));
    actions.addLoan({
      lender: f.lender.trim(),
      loanType: f.loanType,
      account: f.account.trim() || undefined,
      principal: parseRupees(f.principal) ?? undefined,
      emi: parseRupees(f.emi) ?? undefined,
      rate: n(f.rate),
      tenureMonths: n(f.tenureMonths),
      disbursedOn: f.disbursedOn || undefined,
      outstanding: parseRupees(f.outstanding) ?? undefined,
      outstandingAsOf: f.outstanding ? new Date().toISOString().slice(0, 10) : undefined,
    });
    toast.success(`${f.lender.trim()} added`);
    setF(blank);
    onClose();
  };
  return (
    <Dialog open={open} onClose={onClose} title="Add a loan" footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={!f.lender.trim()}>Add loan</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Lender" className="col-span-2"><Input value={f.lender} onChange={set('lender')} /></Field>
        <Field label="Type"><Select value={f.loanType} onChange={set('loanType')}>{LOAN_TYPES.map((t) => <option key={t}>{t}</option>)}</Select></Field>
        <Field label="Account (last 4)"><Input value={f.account} onChange={set('account')} /></Field>
        <Field label="Loan amount (₹)"><Input inputMode="decimal" value={f.principal} onChange={set('principal')} /></Field>
        <Field label="EMI (₹)"><Input inputMode="decimal" value={f.emi} onChange={set('emi')} /></Field>
        <Field label="Interest (% a year)"><Input inputMode="decimal" value={f.rate} onChange={set('rate')} /></Field>
        <Field label="Tenure (months)"><Input inputMode="numeric" value={f.tenureMonths} onChange={set('tenureMonths')} /></Field>
        <Field label="Disbursed on"><Input type="date" value={f.disbursedOn} onChange={set('disbursedOn')} /></Field>
        <Field label="Outstanding today (₹)"><Input inputMode="decimal" value={f.outstanding} onChange={set('outstanding')} /></Field>
      </div>
    </Dialog>
  );
}
