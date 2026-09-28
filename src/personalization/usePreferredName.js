import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { useSelector } from 'react-redux';
import {
  getSnapshot,
  loadPreferredName,
  savePreferredName,
  subscribe,
} from './preferredNameStore';

/**
 * The signed-in user's preferred name, loaded once per user and shared by every
 * screen that calls this hook.
 *
 * `isLoading` is true only while nothing is known yet; a locally cached name is
 * returned immediately while the server copy is confirmed in the background.
 */
export function usePreferredName() {
  const userId = useSelector((s) => s.user.user?.userId ?? null);
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
