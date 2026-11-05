import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Badge, Button, Card, CardHead, Dialog, Icon, Input, PageHeader } from '@/components/ui';
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
  const { session, store, drive, syncNow, signIn, signOut, actions, statements, phonepePassword, setPhonePePassword } = useApp();
  const [pw, setPw] = useState('');
  const [pwBusy, setPwBusy] = useState(false);
  const locked = statements.filter((x) => x.status === 'locked' || x.status === 'wrong_password');
  const read = statements.filter((x) => x.status === 'read');
  const savePw = async (value) => {
    setPwBusy(true);
    try {
      const r = await setPhonePePassword(value);
      setPw('');
      if (!value) toast.success('Password removed from this device');
      else if (r.read) toast.success(`Opened ${plural(r.read, 'statement')}`);
      else if (r.locked) toast.error('That password did not open the locked statements.');
      else toast.success('Password saved on this device');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setPwBusy(false);
    }
  };
  const navigate = useNavigate();
  const [importing, setImporting] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [typed, setTyped] = useState('');
  const a = session.access ?? {};

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
        <Row icon="FolderOpen" title="Google Drive (read-only)" status={a.drive ? <Badge tone="good" icon="Check">Connected</Badge> : <Button size="sm" onClick={reconnect}>Allow Google Drive</Button>}>
          Reads only the PDFs in your “Phone Pe - Monthly Statement” folder. Recundle can't change, move or delete anything in your Drive. Gmail is not used.
        </Row>
        <Row icon="Smartphone" title="Your data" status={<Badge tone="info">On this device</Badge>}>
          Saved in this browser (IndexedDB). It isn't sent to Recundle's servers or synced to other devices. Download a backup below to keep a copy.
        </Row>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" icon="RefreshCw" onClick={reconnect}>Sign in again</Button>
          <Button variant="outline" icon="LogOut" onClick={() => setConfirm('signout')}>Sign out</Button>
          <Button variant="danger-ghost" icon="Unplug" onClick={() => setConfirm('disconnect')}>Disconnect Google</Button>
        </div>
      </Card>

      <Card>
        <CardHead title="PhonePe statements" subtitle="Your expenses come from these" icon="FileSpreadsheet" />
        <p className="text-[13.5px] text-ink-2">
          Recundle reads every PDF in your Google Drive folder <b>“Phone Pe - Monthly Statement”</b> (and folders inside it). Every payment and credit becomes a transaction; regular payments are offered as subscriptions, and you can link EMI payments to your loans. New or changed files are read each time you open Recundle or press Sync.
        </p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button icon="RefreshCw" onClick={() => syncNow()} disabled={drive.running || !a.drive}>{drive.running ? (drive.total ? `Reading ${drive.read} of ${drive.total}…` : 'Checking Drive…') : 'Check Drive now'}</Button>
          {drive.checkedAt && !drive.running && <span className="text-[13px] text-ink-3">{drive.folders ? `${plural(drive.files ?? 0, 'PDF')} in the folder.` : 'Folder not found in your Drive.'}</span>}
        </div>
        {drive.error && <p className="mt-2 text-[13.5px] text-bad">{drive.error}</p>}
        <p className="mt-2 text-[13.5px] text-ink-2">
          {statements.length ? `${plural(read.length, 'statement')} read${locked.length ? `, ${locked.length} locked` : ''}.` : 'No PhonePe statements found yet.'}
          {read[0]?.period ? ` Latest covers ${shortDate(read[0].period.from, true)} – ${shortDate(read[0].period.to, true)}.` : ''}
        </p>
        {statements.length > 0 && (
          <ul className="mt-2 max-h-56 overflow-y-auto rounded-xl border border-line text-[13px]">
            {statements.slice(0, 24).map((x) => (
              <li key={x.id} className="flex items-center justify-between gap-2 border-b border-line px-3 py-2 last:border-0">
                <span className="min-w-0 truncate">{x.period ? `${shortDate(x.period.from, true)} – ${shortDate(x.period.to, true)}` : x.fileName ?? 'Statement'}</span>
                {x.status === 'read' ? <Badge tone="good">{plural(x.rows, 'row')}</Badge> : x.status === 'locked' ? <Badge tone="warn" icon="Lock">Locked</Badge> : x.status === 'wrong_password' ? <Badge tone="bad" icon="Lock">Wrong password</Badge> : <Badge>{x.status === 'empty' ? 'No rows' : 'Unreadable'}</Badge>}
              </li>
            ))}
          </ul>
        )}
        <div className="mt-3 flex flex-col gap-2">
          <p className="text-[13.5px] font-semibold">Statement password</p>
          <p className="text-[13px] text-ink-3">
            If your statement PDFs are password-protected, enter the password. It is saved only in this browser and sent only to open the PDFs while syncing. {phonepePassword ? 'A password is saved.' : 'No password saved.'}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Input type="password" autoComplete="off" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={phonepePassword ? '••••••••' : 'PDF password'} className="sm:max-w-xs" aria-label="PhonePe statement password" />
            <Button onClick={() => savePw(pw)} disabled={!pw || pwBusy || !a.drive}>{pwBusy ? 'Opening…' : locked.length ? 'Save and open locked statements' : 'Save'}</Button>
            {phonepePassword && <Button variant="ghost" onClick={() => savePw(null)} disabled={pwBusy}>Remove</Button>}
          </div>
        </div>
        <Button className="mt-4" variant="outline" icon="FileUp" onClick={() => setImporting(true)}>Add a statement PDF</Button>
      </Card>

      <Card>
        <CardHead title="Your data" icon="Database" />
        <p className="text-[13.5px] text-ink-2">
          {plural(count('txns'), 'transaction')} · {plural(count('rules'), 'rule')} · {plural(count('loans'), 'confirmed loan')} · {plural(count('todos'), 'to-do')}. Statement PDFs are never stored; only the rows read from them.
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
        {confirm === 'disconnect' ? 'Recundle’s access to your Google Drive is revoked and you are signed out. Your data stays on this device; delete it first if you want it gone.' : 'Your data stays on this device for next time.'}
      </Dialog>
      <Dialog
        open={confirm === 'delete'}
        onClose={() => { setConfirm(null); setTyped(''); }}
        title="Delete all Recundle data?"
        footer={<><Button variant="ghost" onClick={() => { setConfirm(null); setTyped(''); }}>Cancel</Button><Button variant="danger" disabled={typed !== 'DELETE'} onClick={async () => { try { await actions.deleteAllData(); } catch (err) { toast.error(err.message); } setConfirm(null); setTyped(''); }}>Delete everything</Button></>}
      >
        <p>Transactions, your edits and rules, subscriptions, loans and to-dos are deleted from this device. Your Google Drive files are not touched. This can't be undone; download a copy first if unsure.</p>
        <Input className="mt-3" value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Type DELETE to confirm" />
      </Dialog>
    </div>
  );
}
