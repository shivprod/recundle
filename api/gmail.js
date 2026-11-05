import { scanPage } from '../server/gmail.js';
import { requireSession } from '../server/google.js';
import { HttpError, json, readJson, requireAppHeader, route } from '../server/http.js';

const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** One page of the Gmail scan. The browser pages through until the chosen window is covered. */
export const POST = route(async (req) => {
  requireAppHeader(req);
  const { after, before, pageToken } = await readJson(req, 10_000);
  if ((after && !ISO.test(after)) || (before && !ISO.test(before))) throw new HttpError(400, 'bad_request', 'Dates must be YYYY-MM-DD.');
  if (pageToken && (typeof pageToken !== 'string' || pageToken.length > 200)) throw new HttpError(400, 'bad_request', 'Bad page token.');
  const { session, setCookie } = await requireSession(req);
  const page = await scanPage(session, { after, before, pageToken });
  return json(page, 200, setCookie ? { 'Set-Cookie': setCookie } : {});
});
