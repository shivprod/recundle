import { HttpError } from './http.js';
import { readCookie, sessionCookie, unseal } from './session.js';

export const DEFAULT_CLIENT_ID = '286940691052-ss6b2j3m1hfp69678ce04oburpmjunuf.apps.googleusercontent.com';
export const clientId = () => process.env.GOOGLE_CLIENT_ID || DEFAULT_CLIENT_ID;

export const SCOPES = { drive: 'https://www.googleapis.com/auth/drive.readonly' };
export const REQUESTED_SCOPES = ['openid', 'email', 'profile', SCOPES.drive];

const TOKEN_URL = 'https://oauth2.googleapis.com/token';

async function tokenRequest(params) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: clientId(), client_secret: process.env.GOOGLE_WEB_CLIENT_SECRET ?? '', ...params }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const revoked = body.error === 'invalid_grant';
    throw new HttpError(revoked ? 401 : 502, revoked ? 'reconnect' : 'google_error', revoked ? 'Google access ended. Sign in again.' : `Google sign-in failed (${body.error ?? res.status}).`);
  }
  return body;
}

function decodeIdToken(idToken) {
  // Received directly from Google's token endpoint over TLS, so the signature check is not needed here.
  const payload = JSON.parse(Buffer.from(idToken.split('.')[1], 'base64url').toString('utf8'));
  return { sub: payload.sub, email: payload.email, name: payload.name ?? payload.given_name ?? '', picture: payload.picture ?? null };
}

/** Exchanges the popup's one-time code. The popup flow uses the special redirect URI "postmessage". */
export async function exchangeCode(code, previous) {
  const tokens = await tokenRequest({ code, grant_type: 'authorization_code', redirect_uri: 'postmessage' });
  const user = decodeIdToken(tokens.id_token);
  const scopes = String(tokens.scope ?? '').split(' ');
  return {
    ...user,
    // Google only sends a refresh token on first consent; keep the earlier one for the same account.
    rt: tokens.refresh_token ?? (previous?.sub === user.sub ? previous.rt : null),
    at: tokens.access_token,
    exp: Date.now() + (tokens.expires_in ?? 3600) * 1000,
    drive: scopes.includes(SCOPES.drive),
  };
}

export function readSession(req) {
  const raw = readCookie(req);
  return raw ? unseal(raw) : null;
}

/**
 * The signed-in session with a fresh access token. Returns the cookie to set when the token was
 * refreshed, so routes can pass it back to the browser.
 */
export async function requireSession(req) {
  const session = readSession(req);
  if (!session) throw new HttpError(401, 'signed_out', 'Sign in with Google to continue.');
  if (session.exp - Date.now() > 60_000) return { session, setCookie: null };
  if (!session.rt) throw new HttpError(401, 'reconnect', 'Google access ended. Sign in again.');
  const tokens = await tokenRequest({ refresh_token: session.rt, grant_type: 'refresh_token' });
  const next = { ...session, at: tokens.access_token, exp: Date.now() + (tokens.expires_in ?? 3600) * 1000 };
  return { session: next, setCookie: sessionCookie(next) };
}

/** fetch() against a Google API with the session's token; maps auth and quota errors to HttpErrors. */
export async function googleFetch(session, url, init = {}) {
  const res = await fetch(url, { ...init, headers: { Authorization: `Bearer ${session.at}`, ...(init.headers ?? {}) } });
  if (res.ok) return res;
  const text = await res.text();
  if (res.status === 401) throw new HttpError(401, 'reconnect', 'Google access ended. Sign in again.');
  if (res.status === 429 || (res.status === 403 && /rateLimitExceeded|userRateLimitExceeded|quota/i.test(text))) {
    const retryAfter = Number(res.headers.get('retry-after')) || 30;
    throw new HttpError(429, 'rate_limited', 'Google asked us to slow down. Syncing will continue shortly.', { retryAfter });
  }
  if (res.status === 403 && /insufficient|scope|PERMISSION_DENIED/i.test(text)) {
    throw new HttpError(403, 'scope_missing', 'Recundle does not have permission for this. Sign in again and allow access.');
  }
  if (res.status === 403 && /accessNotConfigured|has not been used|disabled/i.test(text)) {
    throw new HttpError(503, 'api_disabled', 'This Google API is not enabled for the Recundle Google Cloud project.');
  }
  throw new HttpError(502, 'google_error', `Google API error ${res.status}.`);
}

export async function revoke(session) {
  const token = session?.rt ?? session?.at;
  if (!token) return;
  await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(token)}`, { method: 'POST' }).catch(() => undefined);
}
