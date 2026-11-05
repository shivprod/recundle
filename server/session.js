import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

/**
 * The Google session lives in an HttpOnly cookie, sealed with AES-256-GCM. The key is derived from
 * GOOGLE_WEB_CLIENT_SECRET, so the server stays stateless: rotating the secret signs everyone out.
 * The HKDF salt is fixed ("recription-session-v1") so existing deployments keep their sessions.
 */
export const COOKIE = 'recundle_session';
const MAX_AGE = 60 * 60 * 24 * 30;

function key() {
  const secret = process.env.GOOGLE_WEB_CLIENT_SECRET;
  if (!secret) throw Object.assign(new Error('Server is missing GOOGLE_WEB_CLIENT_SECRET.'), { status: 503, code: 'unconfigured' });
  return Buffer.from(hkdfSync('sha256', secret, 'recription-session-v1', 'recundle-cookie', 32));
}

export function seal(payload) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const body = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map((b) => b.toString('base64url')).join('.');
}

export function unseal(token) {
  try {
    const [iv, tag, body] = String(token).split('.').map((p) => Buffer.from(p, 'base64url'));
    const decipher = createDecipheriv('aes-256-gcm', key(), iv);
    decipher.setAuthTag(tag);
    return JSON.parse(Buffer.concat([decipher.update(body), decipher.final()]).toString('utf8'));
  } catch (err) {
    if (err.code === 'unconfigured') throw err;
    return null;
  }
}

export function readCookie(req, name = COOKIE) {
  const header = req.headers.get('cookie') ?? '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return decodeURIComponent(v.join('='));
  }
  return null;
}

const secure = () => (process.env.VERCEL || process.env.NODE_ENV === 'production' ? '; Secure' : '');

export function sessionCookie(payload) {
  return `${COOKIE}=${seal(payload)}; Path=/api; HttpOnly; SameSite=Lax; Max-Age=${MAX_AGE}${secure()}`;
}

export function clearCookie() {
  return `${COOKIE}=; Path=/api; HttpOnly; SameSite=Lax; Max-Age=0${secure()}`;
}
