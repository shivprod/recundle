import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import {
  connectGmail,
  disconnectGmail,
  getSnapshot,
  loadGmailState,
  skipGmail,
  subscribe,
  syncReceipts,
} from './gmailStore';

/** The signed-in user's Gmail connection and synced receipts. */
export function useGmail() {
  const user = useSelector((s) => s.user.user);
  const userId = user?.userId ?? null;
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    loadGmailState(userId);
  }, [userId]);

  const current = Boolean(userId) && snapshot.userId === userId;

  return {
    isReady: current,
    isConnected: current && Boolean(snapshot.connection),
    hasDecided: current && (Boolean(snapshot.connection) || snapshot.skipped),
    needsReconnect: current && snapshot.needsReconnect,
    account: current ? snapshot.connection : null,
    sync: current ? snapshot.sync : null,
    connect: useCallback(() => connectGmail(userId, { loginHint: user?.emailAddress }), [userId, user?.emailAddress]),
    skip: useCallback(() => skipGmail(userId), [userId]),
    disconnect: useCallback(() => disconnectGmail(userId), [userId]),
    syncNow: useCallback(() => syncReceipts(userId), [userId]),
  };
}
