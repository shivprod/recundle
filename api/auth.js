import { exchangeCode, readSession } from '../server/google.js';
import { HttpError, json, readJson, requireAppHeader, route } from '../server/http.js';
import { sessionCookie } from '../server/session.js';

/** Finishes Google sign-in: trades the popup's one-time code for tokens and seals them in an HttpOnly cookie. */
export const POST = route(async (req) => {
  requireAppHeader(req);
  const { code } = await readJson(req, 10_000);
  if (typeof code !== 'string' || !code) throw new HttpError(400, 'bad_request', 'Missing sign-in code.');
  const session = await exchangeCode(code, readSession(req));
  if (!session.rt) throw new HttpError(400, 'no_refresh_token', 'Google did not grant offline access. Remove Recundle at myaccount.google.com/permissions and sign in again.');
  return json(
    { user: { email: session.email, name: session.name, picture: session.picture }, access: { gmail: session.gmail } },
    200,
    { 'Set-Cookie': sessionCookie(session) },
  );
});
