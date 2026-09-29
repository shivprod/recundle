/**
 * Source of truth for the signed-in user's preferred name. Recundle signs people
 * in with Google directly, so the name (first name from the Google profile by
 * default) is kept on this device, like the Gmail session.
 */

export const MAX_PREFERRED_NAME_LENGTH = 40;

const CACHE_PREFIX = 'recundle.preferredName.';

let state = { userId: null, name: null, status: 'idle' };
const listeners = new Set();

function setState(next) {
  state = { ...state, ...next };
  listeners.forEach((listener) => listener());
}

function readCache(userId) {
  try {
    return localStorage.getItem(CACHE_PREFIX + userId) || null;
  } catch {
    return null;
  }
}

function writeCache(userId, name) {
  try {
    localStorage.setItem(CACHE_PREFIX + userId, name);
  } catch {
    // Storage can be unavailable (private mode); the name lasts for this visit.
  }
}

export function normalizePreferredName(value) {
  return String(value ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_PREFERRED_NAME_LENGTH);
}

export function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getSnapshot() {
  return state;
}

/** Current preferred name for non-React callers (toasts, services). */
export function getUserName() {
  return state.name;
}

export function loadPreferredName(userId) {
  if (!userId) {
    setState({ userId: null, name: null, status: 'idle' });
    return Promise.resolve(null);
  }
  if (state.userId !== userId || state.status !== 'ready') {
    setState({ userId, name: readCache(userId), status: 'ready' });
  }
  return Promise.resolve(state.name);
}

export async function savePreferredName(userId, value) {
  const name = normalizePreferredName(value);
  if (!userId) throw new Error('You need to be signed in to save your name.');
  if (!name) throw new Error('Please enter a name.');

  writeCache(userId, name);
  setState({ userId, name, status: 'ready' });
  return name;
}

/** Forgets the saved name on this device (used when signing out). */
export function clearPreferredName(userId) {
  try {
    localStorage.removeItem(CACHE_PREFIX + userId);
  } catch {
    // Nothing stored.
  }
  if (state.userId === userId) setState({ name: null });
}
