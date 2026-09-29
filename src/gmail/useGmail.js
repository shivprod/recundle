import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  connectGmail,
  disconnectGmail,
  getSnapshot,
  loadGmailState,
  subscribe,
  syncReceipts,
} from './gmailStore';

// Recundle signs people in with Google directly, so the Google connection is
// the account. One account per browser; signing out forgets it.
export const LOCAL_ACCOUNT = 'local';

/** The Google (Gmail) account signed in on this device and its synced receipts. */
export function useGmail() {
  const userId = LOCAL_ACCOUNT;
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    loadGmailState(userId);
  }, [userId]);

  const current = snapshot.userId === userId;

  return {
    isReady: current,
    isConnected: current && Boolean(snapshot.connection),
    needsReconnect: current && snapshot.needsReconnect,
    account: current ? snapshot.connection : null,
    sync: current ? snapshot.sync : null,
    connect: useCallback(() => connectGmail(userId, { loginHint: getSnapshot().connection?.email }), [userId]),
    disconnect: useCallback(() => disconnectGmail(userId), [userId]),
    syncNow: useCallback(() => syncReceipts(userId), [userId]),
  };
}
