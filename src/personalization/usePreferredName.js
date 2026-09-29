import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { LOCAL_ACCOUNT } from '@/gmail/useGmail';
import {
  getSnapshot,
  loadPreferredName,
  savePreferredName,
  subscribe,
} from './preferredNameStore';

/**
 * The signed-in user's preferred name, shared by every screen that calls this
 * hook. It is saved on this device, so it is available immediately.
 */
export function usePreferredName() {
  const userId = LOCAL_ACCOUNT;
  const snapshot = useSyncExternalStore(subscribe, getSnapshot);

  useEffect(() => {
    loadPreferredName(userId);
  }, [userId]);

  const isCurrentUser = Boolean(userId) && snapshot.userId === userId;
  const preferredName = isCurrentUser ? snapshot.name : null;
  const isResolved = isCurrentUser && snapshot.status === 'ready';

  const setPreferredName = useCallback(
    (value) => savePreferredName(userId, value),
    [userId],
  );

  return {
    preferredName,
    hasPreferredName: Boolean(preferredName),
    isLoading: Boolean(userId) && !preferredName && !isResolved,
    isResolved,
    setPreferredName,
  };
}
