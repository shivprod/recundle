import { Component, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button, Dialog, Icon, Spinner } from '@/components/ui';
import { RecundleLogo } from './Logo';
import { useApp } from '@/data/AppData';
import { cn } from '@/lib/cn';

export const NAV = [
  { to: '/dashboard', label: 'Home', icon: 'LayoutDashboard' },
  { to: '/expenses', label: 'Expenses', icon: 'Wallet' },
  { to: '/subscriptions', label: 'Subscriptions', icon: 'Repeat' },
  { to: '/loans', label: 'Loans', icon: 'Landmark' },
  { to: '/todos', label: 'To-Dos', icon: 'ListTodo' },
];

function SyncStatus() {
  const { drive, dataState, syncNow, session } = useApp();
  let text;
  if (drive.running) text = drive.total ? `Reading statements · ${drive.read} of ${drive.total}` : 'Checking Google Drive…';
  else if (dataState.error) text = `Couldn’t save on this device: ${dataState.error}`;
  else text = null;
  return (
    <div className="flex items-center gap-2">
      {text && <span className={cn('hidden text-[12.5px] md:inline', dataState.status === 'error' ? 'text-bad' : 'text-ink-3')}>{text}</span>}
      {session.access?.drive && (
        <Button variant="secondary" size="sm" icon={drive.running ? undefined : 'RefreshCw'} onClick={() => syncNow()} disabled={drive.running} aria-label="Check Google Drive for new statements">
          {drive.running ? <Spinner size={15} /> : null}
          <span className="hidden sm:inline">{drive.running ? 'Syncing' : 'Sync'}</span>
        </Button>
      )}
    </div>
  );
}

function AccountMenu() {
  const { session, signOut } = useApp();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const user = session.user;
  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl p-1 hover:bg-surface-2" aria-label="Account menu" aria-expanded={open}>
        {user?.picture ? <img src={user.picture} alt="" className="size-8 rounded-full" referrerPolicy="no-referrer" /> : <span className="flex size-8 items-center justify-center rounded-full bg-primary-soft text-[13px] font-bold text-primary">{user?.name?.[0] ?? '?'}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="card absolute right-0 top-11 z-40 w-64 p-1.5">
            <div className="px-3 py-2">
              <p className="truncate text-[14px] font-semibold">{user?.name}</p>
              <p className="truncate text-[12.5px] text-ink-3">{user?.email}</p>
            </div>
            <Link to="/settings" onClick={() => setOpen(false)} className="flex items-center gap-2 rounded-lg px-3 py-2 text-[14px] hover:bg-surface-2">
              <Icon name="Settings" size={16} /> Settings & data
            </Link>
            <button type="button" onClick={() => { setOpen(false); setConfirm(true); }} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[14px] hover:bg-surface-2">
              <Icon name="LogOut" size={16} /> Sign out
            </button>
          </div>
        </>
      )}
      <Dialog
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Sign out of Recundle?"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirm(false)}>Cancel</Button>
            <Button
              onClick={async () => {
                await signOut();
                toast.success('Signed out. Your data stays on this device for next time.');
                navigate('/', { replace: true });
              }}
            >
              Sign out
            </Button>
          </>
        }
      >
        Your data stays on this device and is there when you sign in again. To remove it, use Settings → Delete all my Recundle data.
      </Dialog>
    </div>
  );
}

/** Shows a message (instead of a blank page) if a screen fails, with a way back. */
class ScreenBoundary extends Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto mt-10 max-w-lg p-6">
        <p className="font-display text-[22px] font-medium">This screen hit a problem</p>
        <p className="mt-2 text-[14px] text-ink-2">Your data is safe on this device. Reload to try again; if it keeps happening, the message below helps us fix it.</p>
        <pre className="mt-3 overflow-x-auto rounded bg-surface-2 p-3 text-[12px] text-ink-2">{String(this.state.error?.message ?? this.state.error)}</pre>
        <div className="mt-4 flex gap-2">
          <Button onClick={() => window.location.reload()}>Reload</Button>
          <Button variant="outline" onClick={() => { this.setState({ error: null }); window.history.back(); }}>Go back</Button>
        </div>
      </div>
    );
  }
}

export default function AppShell() {
  const { pathname } = useLocation();
  const { session, signIn, drive } = useApp();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  const reconnect = session.needsReconnect || drive.code === 'reconnect';
  return (
    <div className="min-h-svh pb-20 lg:pb-0 lg:pl-60">
      {/* Sidebar (desktop) */}
      <aside className="fixed inset-y-0 left-0 z-20 hidden w-60 flex-col border-r border-line bg-surface px-3 py-5 lg:flex">
        <Link to="/dashboard" className="px-2">
          <RecundleLogo />
        </Link>
        <p className="mt-1 px-2 text-[12px] text-ink-3">Track. Bundle. Recundle.</p>
        <nav className="mt-6 flex flex-col gap-1" aria-label="Main">
          <p className="mb-2 px-3 text-[11px] font-medium uppercase tracking-[0.1em] text-ink-3">Modules</p>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('relative flex items-center gap-3 rounded px-3 py-2.5 text-[14.5px] font-medium transition-colors', isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2 hover:text-ink')}>
              {({ isActive }) => (
                <>
                  {isActive && <motion.span layoutId="nav-bar" className="absolute inset-y-1.5 left-0 w-[3px] rounded-r bg-brand" />}
                  <Icon name={n.icon} size={18} />
                  {n.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>
        <div className="mt-auto">
          <NavLink to="/settings" className={({ isActive }) => cn('flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium', isActive ? 'bg-surface-2 text-ink' : 'text-ink-2 hover:bg-surface-2')}>
            <Icon name="Settings" size={18} /> Settings & data
          </NavLink>
        </div>
      </aside>

      {/* Top bar */}
      <header className="sticky top-0 z-20 border-b border-line bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-4 sm:px-6">
          <Link to="/dashboard" className="lg:hidden">
            <RecundleLogo />
          </Link>
          <div className="hidden lg:block" />
          <div className="flex items-center gap-2">
            <SyncStatus />
            <AccountMenu />
          </div>
        </div>
      </header>

      {reconnect && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 rounded-xl bg-warn-soft px-4 py-3 text-[14px] text-warn sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><Icon name="TriangleAlert" size={17} /> Google access ended. Sign in again to keep syncing.</span>
            <Button size="sm" onClick={() => signIn().then(() => window.location.reload()).catch((e) => e.code !== 'popup_closed' && toast.error(e.message))}>Sign in again</Button>
          </div>
        </div>
      )}
      {!reconnect && session.user && session.access && !session.access.drive && (
        <div className="mx-auto mt-4 max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col gap-3 rounded-xl bg-primary-soft px-4 py-3 text-[14px] text-ink sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><Icon name="FolderOpen" size={17} /> Recundle reads your PhonePe statements from Google Drive. Allow read-only Drive access to continue.</span>
            <Button size="sm" onClick={() => signIn().catch((e) => e.code !== 'popup_closed' && toast.error(e.message))}>Allow Google Drive</Button>
          </div>
        </div>
      )}

      <main className="rails relative mx-auto min-h-[calc(100svh-3.5rem)] w-full max-w-6xl px-4 pb-10 pt-5 sm:px-8 sm:pt-8">
        <span className="cross -left-[6px] -top-[7px] hidden sm:block" aria-hidden="true" />
        <span className="cross -right-[6px] -top-[7px] hidden 2xl:block" aria-hidden="true" />
        <ScreenBoundary key={pathname}>
          <motion.div key={pathname} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}>
            <Outlet />
          </motion.div>
        </ScreenBoundary>
      </main>

      {/* Bottom tabs (phones/tablets) */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden" aria-label="Main">
        <div className="mx-auto grid max-w-lg grid-cols-5">
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => cn('flex flex-col items-center gap-0.5 border-t-2 py-2 text-[11px] font-medium', isActive ? 'border-brand text-ink' : 'border-transparent text-ink-3')}>
              <Icon name={n.icon} size={21} />
              {n.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
