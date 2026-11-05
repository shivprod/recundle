import { googleFetch } from './google.js';
import { HttpError } from './http.js';
import { readPhonePePdf } from './phonepe.js';
import { phonePeEvents } from '../src/core/phonepe.js';

const API = 'https://www.googleapis.com/drive/v3/files';
const MAX_BYTES = 8_000_000;

/**
 * PhonePe statement PDFs in the user's Drive: every PDF in the statements folder ("Phone Pe -
 * Monthly Statement") and its subfolders. Nothing outside that folder is listed or read, and
 * nothing in Drive is changed.
 */
export async function listStatements(session, { pageToken = null } = {}) {
  if (!session.drive) throw new HttpError(403, 'drive_scope_missing', 'Google Drive access was not granted. Sign in again and allow "See your Google Drive files".');
  const folderIds = await statementFolders(session);
  if (!folderIds.length) return { files: [], folders: 0, nextPageToken: null };
  const q = `(${folderIds.slice(0, 40).map((id) => `'${id}' in parents`).join(' or ')}) and mimeType = 'application/pdf' and trashed = false`;
  const params = new URLSearchParams({ q, fields: 'nextPageToken, files(id, name, modifiedTime, size)', pageSize: '100', orderBy: 'modifiedTime desc', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' });
  if (pageToken) params.set('pageToken', pageToken);
  const res = await (await googleFetch(session, `${API}?${params}`)).json();
  return { files: (res.files ?? []).map((f) => ({ id: f.id, name: f.name, modifiedTime: f.modifiedTime, size: Number(f.size ?? 0) })), folders: folderIds.length, nextPageToken: res.nextPageToken ?? null };
}

const FOLDER = "mimeType = 'application/vnd.google-apps.folder' and trashed = false";

/**
 * The statements folder: named like "Phone Pe - Monthly Statement" (or "PhonePe …"), plus its
 * subfolders (for example one per year), up to three levels down.
 */
async function statementFolders(session) {
  const list = async (q) => (await (await googleFetch(session, `${API}?${new URLSearchParams({ q, fields: 'files(id)', pageSize: '50', supportsAllDrives: 'true', includeItemsFromAllDrives: 'true' })}`)).json()).files?.map((f) => f.id) ?? [];
  const found = await list(`${FOLDER} and (name contains 'phone pe' or name contains 'phonepe')`);
  let level = found;
  for (let depth = 0; depth < 3 && level.length; depth++) {
    level = await list(`${FOLDER} and (${level.slice(0, 30).map((id) => `'${id}' in parents`).join(' or ')})`);
    found.push(...level.filter((id) => !found.includes(id)));
  }
  return found;
}

/** Reads statement PDFs from Drive in memory → statement records and transaction events. */
export async function readStatements(session, files, password) {
  if (!session.drive) throw new HttpError(403, 'drive_scope_missing', 'Google Drive access was not granted.');
  const events = [];
  for (const f of files) {
    const base = { kind: 'statement', id: `drive:${f.id}`, fileId: f.id, fileName: f.name, modifiedTime: f.modifiedTime ?? null, date: (f.modifiedTime ?? '').slice(0, 10) || null, source: 'drive' };
    if (f.size > MAX_BYTES) {
      events.push({ ...base, status: 'unreadable' });
      continue;
    }
    const res = await googleFetch(session, `${API}/${encodeURIComponent(f.id)}?alt=media&supportsAllDrives=true`);
    const bytes = Buffer.from(await res.arrayBuffer());
    try {
      const parsed = await readPhonePePdf(bytes, password);
      events.push({ ...base, status: parsed.txns.length ? 'read' : 'empty', period: parsed.period, rows: parsed.txns.length, skipped: parsed.skipped });
      events.push(...phonePeEvents(parsed, { fileName: f.name }).map((e) => ({ ...e, driveFileId: f.id })));
    } catch (err) {
      if (err instanceof HttpError && err.code === 'statement_password') events.push({ ...base, status: err.extra.wrongPassword ? 'wrong_password' : 'locked' });
      else events.push({ ...base, status: 'unreadable' });
    }
  }
  return { events };
}
