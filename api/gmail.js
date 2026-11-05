import { scanPage } from '../server/gmail.js';
import { requireSession } from '../server/google.js';
import { HttpError, json, readJson, requireAppHeader, route } from '../server/http.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** One page of the Gmail scan. The browser pages through until the chosen window is covered. */
export const POST = route(async (req) => {
  requireAppHeader(req);
  const { after, before, pageToken, password, messageIds } = await readJson(req, 10_000);
  if (password != null && (typeof password !== 'string' || password.length > 64)) throw new HttpError(400, 'bad_request', 'Bad password.');
  if (messageIds != null && (!Array.isArray(messageIds) || messageIds.length > 40 || messageIds.some((m) => typeof m !== 'string' || !/^[A-Za-z0-9]{6,40}$/.test(m)))) throw new HttpError(400, 'bad_request', 'Bad message ids.');
  if ((after && !ISO.test(after)) || (before && !ISO.test(before))) throw new HttpError(400, 'bad_request', 'Dates must be YYYY-MM-DD.');
  if (pageToken && (typeof pageToken !== 'string' || pageToken.length > 200)) throw new HttpError(400, 'bad_request', 'Bad page token.');
  const { session, setCookie } = await requireSession(req);
  const page = await scanPage(session, { after, before, pageToken, password: password || null, messageIds: messageIds ?? null });
  return json(page, 200, setCookie ? { 'Set-Cookie': setCookie } : {});
});
