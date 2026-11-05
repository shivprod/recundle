import { requireSession } from '../server/google.js';
import { HttpError, json, readJson, requireAppHeader, route } from '../server/http.js';
import { listStatements, readStatements } from '../server/drive.js';

const ID = /^[A-Za-z0-9_-]{10,100}$/;

/**
 * PhonePe statements in the Google Drive statements folder.
 *   { action: 'list', pageToken? } → { files, folders, nextPageToken }
 *   { action: 'read', files: [{ id, name, modifiedTime, size }] (≤ 4), password? } → { events }
 */
export const POST = route(async (req) => {
  requireAppHeader(req);
  const body = await readJson(req, 20_000);
  const { session, setCookie } = await requireSession(req);
  const headers = setCookie ? { 'Set-Cookie': setCookie } : {};
  if (body.action === 'list') {
    if (body.pageToken != null && (typeof body.pageToken !== 'string' || body.pageToken.length > 500)) throw new HttpError(400, 'bad_request', 'Bad page token.');
    return json(await listStatements(session, { pageToken: body.pageToken ?? null }), 200, headers);
  }
  if (body.action === 'read') {
    const files = Array.isArray(body.files) ? body.files : [];
    if (!files.length || files.length > 4 || files.some((f) => !ID.test(f?.id ?? '') || typeof f.name !== 'string' || f.name.length > 300)) throw new HttpError(400, 'bad_request', 'Bad files.');
    if (body.password != null && (typeof body.password !== 'string' || body.password.length > 64)) throw new HttpError(400, 'bad_request', 'Bad password.');
    const clean = files.map((f) => ({ id: f.id, name: f.name, modifiedTime: typeof f.modifiedTime === 'string' ? f.modifiedTime.slice(0, 40) : null, size: Number(f.size) || 0 }));
    return json(await readStatements(session, clean, body.password || null), 200, headers);
  }
  throw new HttpError(400, 'bad_request', 'Unknown action.');
});
