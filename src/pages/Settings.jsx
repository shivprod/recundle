import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHead, Dialog, Icon, Input, PageHeader, Select } from '@/components/ui';
import { ImportStatementDialog } from '@/components/expenses/ImportDialogs';
import { plural, shortDate } from '@/core/format';
import { useApp } from '@/data/AppData';

function Row({ icon, title, children, status }) {
  return (
    <div className="flex flex-col gap-2 border-b border-line py-3 last:border-0 sm:flex-row sm:items-center">
      <Icon name={icon} size={18} className="hidden shrink-0 text-ink-3 sm:block" />
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-semibold">{title}</p>
        <div className="text-[13px] text-ink-2">{children}</div>
      </div>
      {status}
    </div>
  );
}

export default function Settings() {
  const { session, store, scan, syncNow, scanHistory, signIn, signOut, actions } = useApp();
  const navigate = useNavigate();
  const [months, setMonths] = useState('24');
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [typed, setTyped] = useState('');
  const a = session.access ?? {};
  const s = store.sync;
  const count = (c) => Object.values(store[c]).filter((x) => !x.deleted).length;

  const reconnect = async () => {
    try {
      await signIn();
      toast.success('Google access updated');
    } catch (err) {
      if (err.code !== 'popup_closed') toast.error(err.message);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <PageHeader title="Settings & data" subtitle="Connections, syncing, imports and your data." />

      <Card>
        <CardHead title="Google account" icon="CircleUserRound" />
        <Row icon="Mail" title="Gmail (read-only)" status={a.gmail ? <Badge tone="good" icon="Check">Connected</Badge> : <Button size="sm" onClick={reconnect}>Allow Gmail</Button>}>
          Reads payment alerts, receipts, subscription and loan emails. Recundle can't send, delete or change email.
        </Row>
        <Row icon="Smartphone" title="Your data" status={<Badge tone="info">On this device</Badge>}>
          Saved in this browser (IndexedDB). It isn't sent to Recundle's servers or synced to other devices. Download a backup below to keep a copy.
        </Row>
        <Row icon="Sparkles" title="AI reading of loan emails" status={session.ai ? <Badge tone="good">On</Badge> : <Badge>Off</Badge>}>
          {session.ai ? 'Closure letters, NOCs and unclear loan emails are read by Claude to extract figures. You still confirm every loan and closure.' : 'Rule-based reading only. The server owner can turn this on by setting ANTHROPIC_API_KEY.'}
        </Row>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" icon="RefreshCw" onClick={reconnect}>Sign in again</Button>
          <Button variant="outline" icon="LogOut" onClick={() => setConfirm('signout')}>Sign out</Button>
          <Button variant="danger-ghost" icon="Unplug" onClick={() => setConfirm('disconnect')}>Disconnect Google</Button>
        </div>
      </Card>

      <Card>
        <CardHead title="Gmail sync" icon="RefreshCw" />
        <p className="text-[13.5px] text-ink-2">
          {s.lastScanAt ? `Last synced ${new Date(s.lastScanAt).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}. Emails read from ${shortDate(s.scannedFrom, true)} to ${shortDate(s.scannedTo, true)} (${plural(s.messages ?? 0, 'email')} checked).` : 'Not synced yet.'}
          {' '}Syncs automatically when you open Recundle if it's been more than 6 hours.
        </p>
        {scan.error && <p className="mt-2 text-[13.5px] text-bad">{scan.error}</p>}
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button icon="RefreshCw" onClick={() => syncNow()} disabled={scan.running || !a.gmail}>{scan.running ? `Syncing… ${scan.scanned}` : 'Sync new emails'}</Button>
          <div className="flex items-center gap-2">
            <Select value={months} onChange={(e) => setMonths(e.target.value)} className="h-10 w-44" aria-label="History to read">
              {['12', '24', '36', '60'].map((m) => <option key={m} value={m}>Back to {Number(m) / 12} year{m === '12' ? '' : 's'} ago</option>)}
            </Select>
            <Button variant="outline" onClick={() => scanHistory(Number(months))} disabled={scan.running || !a.gmail}>Read older emails</Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHead title="Import" icon="FileUp" />
        <p className="text-[13.5px] text-ink-2">Google Pay, PhonePe and banks don't let other apps read your transactions directly. Import a bank statement (CSV from net banking) to add money received, UPI transfers and anything not emailed. Duplicates with Gmail are matched automatically.</p>
        <Button className="mt-3" variant="outline" icon="FileUp" onClick={() => setImporting(true)}>Import a bank statement</Button>
      </Card>

      <Card>
        <CardHead title="Your data" icon="Database" />
        <p className="text-[13.5px] text-ink-2">
          {plural(count('txns'), 'transaction')} · {plural(count('rules'), 'rule')} · {plural(count('loans'), 'confirmed loan')} · {plural(count('todos'), 'to-do')}. Email bodies are never stored; only the fields read from them.
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" icon="Download" onClick={actions.exportData}>Download a copy (JSON)</Button>
          <Button variant="danger-ghost" icon="Trash2" onClick={() => setConfirm('delete')}>Delete all my Recundle data</Button>
        </div>
      </Card>

      <Card>
        <CardHead title="Change history" subtitle="Important changes to your financial data, newest first" icon="History" />
        {store.audit.length ? (
          <ul className="max-h-80 divide-y divide-line overflow-y-auto text-[13px]">
            {store.audit.slice(0, 120).map((e) => (
              <li key={`${e.at}-${e.action}-${e.ref}`} className="flex gap-3 py-2">
                <span className="w-32 shrink-0 text-ink-3">{new Date(e.at).toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' })}</span>
                <span className="min-w-0"><b className="font-medium">{e.action}</b> <span className="text-ink-2">{e.detail}</span></span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[13px] text-ink-3">No changes yet.</p>
        )}
      </Card>

      <ImportStatementDialog open={importing} onClose={() => setImporting(false)} />
      <Dialog
        open={confirm === 'signout' || confirm === 'disconnect'}
        onClose={() => setConfirm(null)}
        title={confirm === 'disconnect' ? 'Disconnect Google?' : 'Sign out?'}
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(null)}>Cancel</Button>
            <Button variant={confirm === 'disconnect' ? 'danger' : 'primary'} onClick={async () => { await signOut({ disconnect: confirm === 'disconnect' }); navigate('/', { replace: true }); }}>
              {confirm === 'disconnect' ? 'Disconnect' : 'Sign out'}
            </Button>
          </>
        }
      >
        {confirm === 'disconnect' ? 'Recundle’s access to your Gmail is revoked and you are signed out. Your data stays on this device; delete it first if you want it gone.' : 'Your data stays on this device for next time.'}
      </Dialog>
      <Dialog
        open={confirm === 'delete'}
        onClose={() => { setConfirm(null); setTyped(''); }}
        title="Delete all Recundle data?"
        footer={<><Button variant="ghost" onClick={() => { setConfirm(null); setTyped(''); }}>Cancel</Button><Button variant="danger" disabled={typed !== 'DELETE'} onClick={async () => { try { await actions.deleteAllData(); } catch (err) { toast.error(err.message); } setConfirm(null); setTyped(''); }}>Delete everything</Button></>}
      >
        <p>Transactions, your edits and rules, subscriptions, loans and to-dos are deleted from this device. Your emails are not touched. This can't be undone; download a copy first if unsure.</p>
        <Input className="mt-3" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type DELETE to confirm" />
      </Dialog>
    </div>
  );
}
