import { test } from 'node:test';
import assert from 'node:assert/strict';
import { googleFetch } from '../server/google.js';

const reply = (status, error) => async () => new Response(JSON.stringify({ error }), { status });
const call = async (fake) => {
  const real = globalThis.fetch;
  globalThis.fetch = fake;
  try {
    await googleFetch({ at: 'x' }, 'https://www.googleapis.com/drive/v3/files?q=x');
    return null;
  } catch (e) {
    return e;
  } finally {
    globalThis.fetch = real;
  }
};

test('a disabled Drive API is reported as such, not as a missing permission', async () => {
  const e = await call(reply(403, { code: 403, status: 'PERMISSION_DENIED', message: 'Google Drive API has not been used in project 1 before or it is disabled.', details: [{ reason: 'SERVICE_DISABLED' }] }));
  assert.equal(e.code, 'api_disabled');
  assert.match(e.extra.enableUrl, /drive\.googleapis\.com/);
});

test('missing Drive scope asks to sign in again; other refusals show Google’s reason', async () => {
  assert.equal((await call(reply(403, { code: 403, status: 'PERMISSION_DENIED', message: 'Request had insufficient authentication scopes.', details: [{ reason: 'ACCESS_TOKEN_SCOPE_INSUFFICIENT' }] }))).code, 'scope_missing');
  const e = await call(reply(403, { code: 403, message: 'The user has not granted the app 1 read access to the file.' }));
  assert.equal(e.code, 'google_denied');
  assert.match(e.message, /has not granted/);
});
