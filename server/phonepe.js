import { getDocumentProxy } from 'unpdf';
import { HttpError } from './http.js';
import { parsePhonePeStatement } from '../src/core/phonepe.js';

const MAX_PAGES = 60;

/**
 * Reads a PhonePe statement PDF in memory and returns its rows. The PDF and the password are not
 * stored or logged. A locked PDF without the right password throws `statement_password`.
 */
export async function readPhonePePdf(bytes, password) {
  let pdf;
  try {
    pdf = await getDocumentProxy(new Uint8Array(bytes), { password: password || undefined, isEvalSupported: false });
  } catch (err) {
    if (err?.name === 'PasswordException') {
      // pdf.js: code 1 = a password is needed, 2 = the one given is wrong.
      throw new HttpError(422, 'statement_password', password ? 'That password did not open the statement.' : 'This statement is password-protected.', { wrongPassword: Boolean(password) });
    }
    throw new HttpError(422, 'statement_unreadable', 'This file could not be read as a PDF.');
  }
  try {
    const pages = [];
    for (let n = 1; n <= Math.min(pdf.numPages, MAX_PAGES); n++) {
      const page = await pdf.getPage(n);
      const content = await page.getTextContent();
      pages.push(content.items.filter((i) => 'str' in i).map((i) => ({ str: i.str, x: i.transform[4], y: i.transform[5] })));
    }
    return parsePhonePeStatement(pages);
  } finally {
    pdf.destroy?.();
  }
}
