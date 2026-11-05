import { requireSession } from '../server/google.js';
import { HttpError, json, readJson, requireAppHeader, route } from '../server/http.js';
import { readPhonePePdf } from '../server/phonepe.js';

/**
 * Reads a PhonePe statement PDF you upload (for months not in Gmail). Signed-in users only. The
 * file is read in memory and discarded; only the parsed rows are returned.
 */
export const POST = route(async (req) => {
  requireAppHeader(req);
  const { setCookie } = await requireSession(req);
  const { pdf, password } = await readJson(req, 4_200_000);
  if (typeof pdf !== 'string' || !pdf) throw new HttpError(400, 'bad_request', 'No file was sent.');
  if (password != null && (typeof password !== 'string' || password.length > 64)) throw new HttpError(400, 'bad_request', 'Bad password.');
  const parsed = await readPhonePePdf(Buffer.from(pdf, 'base64'), password || null);
  return json(parsed, 200, setCookie ? { 'Set-Cookie': setCookie } : {});
});
