import { sdk } from '@/services/sdk';

export const RECRIPTION_FUNCTION = 'recription-api';

// The web OAuth client shared with the Android app; client IDs are public.
export const GOOGLE_WEB_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID ||
  '86235899973-st5it9v5gaajo3q2qv0jt84n2i7ar2jt.apps.googleusercontent.com';

export const GMAIL_SCOPE = 'https://www.googleapis.com/auth/gmail.readonly';

/** Error from the recription-api function; `code` mirrors its `error` field. */
export class GmailApiError extends Error {
  constructor(message, code) {
    super(message);
    this.name = 'GmailApiError';
    this.code = code;
  }
}

/**
 * Calls the recription-api edge function. The SDK reports transport success
 * only, so failures are read from the `{ success: false, message, error }`
 * body the function returns.
 */
export async function callRecriptionApi(action, body = {}) {
  const result = await sdk.functions.invoke(RECRIPTION_FUNCTION, { action, ...body });
  if (!result?.ok) {
    throw new GmailApiError(result?.error?.message || 'Could not reach Recundle. Check your connection.', 'network');
  }
  const value = result.value;
  if (!value || typeof value !== 'object' || value.success === false) {
    throw new GmailApiError(value?.message || 'Something went wrong while talking to Gmail.', value?.error || 'unexpected');
  }
  return value;
}
