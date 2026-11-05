/**
 * Merchant and person names come in many spellings ("RAHUL KUMAR", "Rahul  Kumar.", "rahulk@okaxis").
 * entityKey() reduces a name to a stable key for grouping and rules; similarity() scores how alike
 * two keys are so near-matches can be offered for confirmation instead of applied silently.
 */

const STRIP = /\b(pvt|private|ltd|limited|llp|inc|co|india|in|the|www|com|payments?|technologies|services|online|retail|store|mr|mrs|ms|shri|smt|m s)\b/g;

export function entityKey(name) {
  return String(name ?? '')
    .toLowerCase()
    .replace(/@[a-z0-9.]+$/, '')
    .replace(/[^a-z0-9 ]+/g, ' ')
    .replace(STRIP, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const tokens = (key) => new Set(key.split(' ').filter((t) => t.length > 1));

/** Jaccard over name tokens, with credit for an initial ("rahul k" ≈ "rahul kumar"). 0..1 */
export function similarity(a, b) {
  if (!a || !b) return 0;
  if (a === b) return 1;
  const A = tokens(a);
  const B = tokens(b);
  if (!A.size || !B.size) return 0;
  let shared = 0;
  for (const t of A) {
    if (B.has(t)) shared += 1;
    else if ([...B].some((u) => (u.length === 1 || t.length === 1) && u[0] === t[0])) shared += 0.5;
  }
  const union = A.size + B.size - shared;
  const score = shared / union;
  // "amazon" vs "amazon in" style containment.
  if (a.includes(b) || b.includes(a)) return Math.max(score, 0.75);
  return score;
}

const BUSINESS = /\b(pvt|ltd|limited|llp|inc|store|stores|mart|enterprises?|traders?|foods?|services|solutions|technologies|tech|india|bank|pay|payments?|retail|restaurant|cafe|hotel|hospital|clinic|pharmacy|medical|agency|centre|center|studio|motors|fuels?|petroleum|telecom|broadband|insurance|finance|capital|securities|labs?|kitchen|bazaar|super|market|com)\b/i;

/** Two or three alphabetic words and nothing that sounds like a business: probably a person. */
export function looksLikePerson(name) {
  const n = String(name ?? '').trim();
  if (!n || BUSINESS.test(n) || /\d/.test(n)) return false;
  const words = n.split(/\s+/).filter(Boolean);
  return words.length >= 2 && words.length <= 4 && words.every((w) => /^[a-z.'-]+$/i.test(w));
}
