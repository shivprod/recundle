/** Money is kept in paise (integers) everywhere; dates are local 'YYYY-MM-DD' strings. */

const inr0 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const inr2 = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function inr(paise, { exact = false, sign = false } = {}) {
  if (paise == null || Number.isNaN(paise)) return '—';
  const rupees = paise / 100;
  const text = exact && !Number.isInteger(rupees) ? inr2.format(Math.abs(rupees)) : inr0.format(Math.abs(Math.round(rupees)));
  const prefix = paise < 0 ? '−' : sign && paise > 0 ? '+' : '';
  return prefix + text;
}

/** ₹1.2L, ₹3.4Cr, ₹12.5K for chart axes and tight tiles. */
export function inrShort(paise) {
  if (paise == null) return '—';
  const r = Math.abs(paise / 100);
  const s = paise < 0 ? '−' : '';
  if (r >= 1e7) return `${s}₹${(r / 1e7).toFixed(r >= 1e8 ? 0 : 1)}Cr`;
  if (r >= 1e5) return `${s}₹${(r / 1e5).toFixed(r >= 1e6 ? 0 : 1)}L`;
  if (r >= 1e3) return `${s}₹${(r / 1e3).toFixed(r >= 1e4 ? 0 : 1)}K`;
  return `${s}₹${Math.round(r)}`;
}

/** "₹1,25,000.50", "1,25,000", "Rs. 500", "-500" → paise. */
export function parseRupees(value) {
  if (typeof value === 'number') return Math.round(value * 100);
  const s = String(value ?? '').replace(/[₹,\s]|rs\.?|inr/gi, '').replace(/^\((.*)\)$/, '-$1');
  if (!s || s === '-' || s === '—') return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

export const pct = (x, digits = 0) => (x == null || !Number.isFinite(x) ? '—' : `${(x * 100).toFixed(digits)}%`);
export const plural = (n, one, many = `${one}s`) => `${n.toLocaleString('en-IN')} ${n === 1 ? one : many}`;

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const MONTH_NAMES = MONTHS;

export function toIso(d) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}
export function fromIso(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d || 1);
}
export const todayIso = () => toIso(new Date());
export const DAY = 86_400_000;
export const daysBetween = (a, b) => Math.round((fromIso(b) - fromIso(a)) / DAY);
export function addDays(iso, n) {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
}
/** Same day next month, clamped to the month's length (31 Jan + 1 → 28/29 Feb). */
export function addMonths(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const target = new Date(y, m - 1 + n, 1);
  const last = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
  target.setDate(Math.min(d || 1, last));
  return toIso(target);
}
export const monthKey = (iso) => iso.slice(0, 7);
export function monthLabel(key, long = false) {
  const [y, m] = key.split('-').map(Number);
  return long ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
}
export function monthsBetweenKeys(a, b) {
  const [ya, ma] = a.split('-').map(Number);
  const [yb, mb] = b.split('-').map(Number);
  return (yb - ya) * 12 + (mb - ma);
}
export function shiftMonthKey(key, n) {
  const [y, m] = key.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}
export function endOfMonth(key) {
  const [y, m] = key.split('-').map(Number);
  return toIso(new Date(y, m, 0));
}

export function shortDate(iso, withYear = null) {
  if (!iso) return '—';
  const d = fromIso(iso);
  const showYear = withYear ?? d.getFullYear() !== new Date().getFullYear();
  return `${d.getDate()} ${MONTHS[d.getMonth()]}${showYear ? ` ${d.getFullYear()}` : ''}`;
}

export function monthsToWords(m) {
  if (m == null) return '—';
  if (m < 12) return plural(m, 'month');
  const y = Math.floor(m / 12);
  const r = m % 12;
  return r ? `${y} yr ${r} mo` : plural(y, 'year');
}

export const uid = (prefix = 'id') => `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
