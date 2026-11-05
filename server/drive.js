import { googleFetch } from './google.js';
import { HttpError } from './http.js';

/**
 * The user's Recundle data (edits, rules, loans, to-dos, imported transactions) lives in one JSON
 * file in their own Google Drive "app data" folder: private to Recundle, invisible in their Drive
 * file list, and removable from Drive settings. Recundle keeps no copy on its servers.
 */
const FILE = 'recundle-data.json';
const API = 'https://www.googleapis.com/drive/v3/files';
const UPLOAD = 'https://www.googleapis.com/upload/drive/v3/files';

async function findFile(session) {
  const q = encodeURIComponent(`name='${FILE}'`);
  const res = await googleFetch(session, `${API}?spaces=appDataFolder&q=${q}&fields=files(id,modifiedTime)&pageSize=1`);
  const { files } = await res.json();
  return files?.[0] ?? null;
}

export async function readData(session) {
  if (!session.drive) throw new HttpError(403, 'scope_missing', 'Allow Google Drive app storage to keep your data across devices.');
  const file = await findFile(session);
  if (!file) return { data: null, version: null };
  const res = await googleFetch(session, `${API}/${file.id}?alt=media`);
  return { data: await res.json(), version: file.modifiedTime };
}

/**
 * Saves only when the file hasn't changed since `baseVersion` (another device may have saved).
 * On a conflict the current remote copy is returned so the client can merge and retry.
 */
export async function writeData(session, data, baseVersion) {
  if (!session.drive) throw new HttpError(403, 'scope_missing', 'Allow Google Drive app storage to keep your data across devices.');
  const file = await findFile(session);
  if (file && baseVersion && file.modifiedTime !== baseVersion) {
    const current = await readData(session);
    throw new HttpError(409, 'conflict', 'Your data changed on another device.', current);
  }
  const body = JSON.stringify(data);
  let res;
  if (file) {
    res = await googleFetch(session, `${UPLOAD}/${file.id}?uploadType=media&fields=modifiedTime`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
  } else {
    const boundary = `recundle${Date.now()}`;
    const multipart = [
      `--${boundary}`,
      'Content-Type: application/json; charset=UTF-8',
      '',
      JSON.stringify({ name: FILE, parents: ['appDataFolder'] }),
      `--${boundary}`,
      'Content-Type: application/json',
      '',
      body,
      `--${boundary}--`,
    ].join('\r\n');
    res = await googleFetch(session, `${UPLOAD}?uploadType=multipart&fields=modifiedTime`, {
      method: 'POST',
      headers: { 'Content-Type': `multipart/related; boundary=${boundary}` },
      body: multipart,
    });
  }
  const { modifiedTime } = await res.json();
  return { version: modifiedTime };
}

export async function deleteData(session) {
  const file = await findFile(session);
  if (file) await googleFetch(session, `${API}/${file.id}`, { method: 'DELETE' });
}
