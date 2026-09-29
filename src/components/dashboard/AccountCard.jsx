import ApperIcon from '@/components/ApperIcon';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { formatResumeTime } from '@/gmail/gmailStore';
import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/date';
import { plural } from './format';

export const isPaused = (sync) => Boolean(sync?.retryAt) && Date.parse(sync.retryAt) > Date.now();

/** Signed-in Google account, sync status, Sync now and Sign out. */
export default function AccountCard({ account, sync, onSync, onSignOut }) {
  const syncing = sync.status === 'syncing';
  const paused = !syncing && isPaused(sync);
  const status = syncing
    ? `Scanning receipts… ${plural(sync.scanned, 'email', 'emails')} checked`
    : paused
      ? `Gmail asked for a pause. Syncing again at ${formatResumeTime(sync.retryAt)}`
      : sync.syncedAt
        ? `Synced ${formatRelativeTime(sync.syncedAt)}`
        : 'Not synced yet';

  return (
    <section aria-labelledby="account-h" className="rounded-2xl bg-card p-5">
      <h2 id="account-h" className="text-[18px] font-semibold tracking-tight">Account</h2>
      <div className="mt-4 flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-secondary text-primary">
          <ApperIcon name={syncing ? 'Loader2' : 'Mail'} size={20} className={cn(syncing && 'animate-spin')} />
        </span>
        <div className="min-w-0">
          <p className="truncate text-[15px] font-medium">{account?.email ?? 'Gmail'}</p>
          <p className="text-[13px] text-muted-foreground" aria-live="polite">{status}</p>
        </div>
      </div>
      <p className="mt-3 text-[13px] text-muted-foreground">
        {plural(sync.scanned ?? 0, 'email', 'emails')} checked · Read-only access to receipts and invoices.
      </p>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onSync}
          disabled={syncing || paused}
          className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-secondary text-[15px] font-medium text-primary transition-colors hover:bg-primary/15 disabled:opacity-50"
        >
          <ApperIcon name="RefreshCw" size={16} className={cn(syncing && 'animate-spin')} />
          Sync now
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-xl bg-muted text-[15px] font-medium text-destructive transition-colors hover:bg-destructive/10"
            >
              <ApperIcon name="LogOut" size={16} />
              Sign out
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Sign out of Recundle?</AlertDialogTitle>
              <AlertDialogDescription>
                Recundle will stop reading your Gmail, and the subscriptions it found will be removed from this device.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={onSignOut}>Sign out</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </section>
  );
}
