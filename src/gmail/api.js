// The backend Vercel function (api/recundle.js), served from the same site.
export const RECUNDLE_API_URL = import.meta.env.VITE_RECUNDLE_API_URL || '/api/recundle';

// The web OAuth client shared with the Android app; client IDs are public.
export const GOOGLE_WEB_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ||
  '86235899973-st5it9v5gaajo3q2qv0jt84n2i7ar2jt.apps.googleusercontent.com';

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/** Error from the Recundle backend; `code` mirrors its `error` field. */
export class GmailApiError extends Error {
  constructor(message, code, retryAt = null) {
    super(message);
    this.name = 'GmailApiError';
    this.code = code;
    // When Gmail asks us to pause (code "rate_limited"): ISO time it's OK to retry.
    this.retryAt = retryAt;
  }
}

/**
 * Calls the Recundle backend. Failures come back as
 * `{ success: false, message, error }` with a non-2xx status.
 */
export async function callRecundleApi(action, body = {}) {
  let res;
  try {
    res = await fetch(RECUNDLE_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, ...body }),
    });
  } catch {
    throw new GmailApiError('Could not reach Recundle. Check your connection.', 'network');
  }
  const value = await res.json().catch(() => null);
  if (!res.ok || !value || value.success === false) {
    throw new GmailApiError(value?.message || 'Something went wrong while talking to Gmail.', value?.error || 'unexpected', value?.retryAt ?? null);
  }
  return value;
}
