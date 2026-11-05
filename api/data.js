import { deleteData, readData, writeData } from '../server/drive.js';
import { requireSession } from '../server/google.js';
import { HttpError, json, readJson, requireAppHeader, route } from '../server/http.js';

const cookie = (setCookie) => (setCookie ? { 'Set-Cookie': setCookie } : {});

/** The user's Recundle data file in their Google Drive app folder. */
export const GET = route(async (req) => {
  requireAppHeader(req);
  const { session, setCookie } = await requireSession(req);
  return json(await readData(session), 200, cookie(setCookie));
});

export const PUT = route(async (req) => {
  requireAppHeader(req);
  const { data, baseVersion } = await readJson(req);
  if (!data || typeof data !== 'object' || data.app !== 'recundle') throw new HttpError(400, 'bad_request', 'Not a Recundle data file.');
  const { session, setCookie } = await requireSession(req);
  return json(await writeData(session, data, baseVersion ?? null), 200, cookie(setCookie));
});

export const DELETE = route(async (req) => {
  requireAppHeader(req);
  const { session, setCookie } = await requireSession(req);
  await deleteData(session);
  return json({ ok: true }, 200, cookie(setCookie));
});
