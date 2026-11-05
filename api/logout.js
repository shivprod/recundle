import { readSession, revoke } from '../server/google.js';
import { json, readJson, requireAppHeader, route } from '../server/http.js';
import { clearCookie } from '../server/session.js';

/** Signs out on this device. With { disconnect: true } it also revokes Recundle's Google access. */
export const POST = route(async (req) => {
  requireAppHeader(req);
  const { disconnect } = await readJson(req, 1000);
  if (disconnect) await revoke(readSession(req));
  return json({ ok: true }, 200, { 'Set-Cookie': clearCookie() });
});
