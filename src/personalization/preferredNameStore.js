import { sdk } from '@/services/sdk';

/**
 * Source of truth for the signed-in user's preferred name.
 *
 * Persisted on the platform User record as `preferred_name_c` (Apper's per-user
 * settings mechanism: `sdk.admin.get/update('user', …)`). A per-user localStorage
 * copy lets the name render instantly on reload and keeps onboarding working if
 * the server read/write is unavailable.
 */

export const PREFERRED_NAME_FIELD = 'preferred_name_c';
export const MAX_PREFERRED_NAME_LENGTH = 40;

const CACHE_PREFIX = 'recundle.preferredName.';

let state = { userId: null, name: null, status: 'idle' };
let pending = null;
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
    // Storage can be unavailable (private mode); the server copy still applies.
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

async function fetchServerName(userId) {
  const res = await sdk.admin.get('user', userId);
  if (!res?.success) {
    throw new Error(res?.message || 'Could not load your profile');
  }
  return normalizePreferredName(res.data?.[PREFERRED_NAME_FIELD]) || null;
}

export function loadPreferredName(userId) {
  if (!userId) {
    pending = null;
    setState({ userId: null, name: null, status: 'idle' });
    return Promise.resolve(null);
  }
  if (state.userId === userId && state.status === 'ready') return Promise.resolve(state.name);
  if (state.userId === userId && pending) return pending;

  setState({ userId, name: readCache(userId), status: 'loading' });

  const request = fetchServerName(userId)
    .then((serverName) => {
      const name = serverName ?? readCache(userId);
      if (serverName) writeCache(userId, serverName);
      return name;
    })
    .catch((err) => {
      console.warn('[Recundle] Using locally saved name; profile read failed:', err);
      return readCache(userId);
    })
    .then((name) => {
      if (pending === request) {
        pending = null;
        setState({ userId, name, status: 'ready' });
      }
      return name;
    });

  pending = request;
  return request;
}

export async function savePreferredName(userId, value) {
  const name = normalizePreferredName(value);
  if (!userId) throw new Error('You need to be signed in to save your name.');
  if (!name) throw new Error('Please enter a name.');

  writeCache(userId, name);
  pending = null;
  setState({ userId, name, status: 'ready' });

  try {
    const res = await sdk.admin.update('user', { Id: userId, [PREFERRED_NAME_FIELD]: name });
    const failed = !res?.success || res?.results?.some?.((r) => r && r.success === false);
    if (failed) throw new Error(res?.message || res?.messages?.[0] || 'Profile update failed');
  } catch (err) {
    console.warn('[Recundle] Preferred name saved on this device only:', err);
  }

  return name;
}
