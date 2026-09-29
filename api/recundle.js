// Recundle backend (Vercel function): Google sign-in with read-only Gmail access,
// sealed sessions, and receipt parsing. Ported from the Apper edge function;
// the only secret is GOOGLE_WEB_CLIENT_SECRET (a Vercel environment variable).
const getSecret = async (name) => {
  const value = process.env[name]?.trim();
  if (!value) throw new HttpError(503, `Recundle isn't configured yet: add ${name} in the Vercel project's environment variables, then redeploy.`, { error: "not_configured" });
  return value;
};

// src/domain/dates.ts
var MONTHS_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
var ISO_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parse(date) {
  const m = ISO_RE.exec(date);
  if (!m) throw new RangeError(`Invalid LocalDate: ${date}`);
  const out = { y: +m[1], m: +m[2], d: +m[3] };
  if (out.m < 1 || out.m > 12 || out.d < 1 || out.d > daysInMonth(out.y, out.m)) throw new RangeError(`Invalid LocalDate: ${date}`);
  return out;
}
function isValid(date) {
  try {
    parse(date);
    return true;
  } catch {
    return false;
  }
}
function make(y, m, d) {
  return `${String(y).padStart(4, "0")}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}
function isLeapYear(y) {
  return y % 4 === 0 && y % 100 !== 0 || y % 400 === 0;
}
function daysInMonth(y, m) {
  return [31, isLeapYear(y) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31][m - 1];
}

// src/domain/money.ts
var rupees = (r) => Math.round(r * 100);

// src/detection/raw.ts
var GOOGLE_PLAY_SENDER = "googleplay-noreply@google.com";

// src/detection/receiptParser.ts
var MONTH_RE = "(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*";
function monthIndex(m) {
  return MONTHS_SHORT.findIndex((x) => m.toLowerCase().startsWith(x.toLowerCase())) + 1;
}
function parseDate(s) {
  let m = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+${MONTH_RE},?\\s+(\\d{4})\\b`, "i").exec(s);
  if (m) return safe(+m[3], monthIndex(m[2]), +m[1]);
  m = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?,?\\s+(\\d{4})\\b`, "i").exec(s);
  if (m) return safe(+m[3], monthIndex(m[1]), +m[2]);
  m = /\b(\d{4})-(\d{2})-(\d{2})\b/.exec(s);
  if (m) return safe(+m[1], +m[2], +m[3]);
  m = /\b(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})\b/.exec(s);
  if (m) return safe(+m[3], +m[2], +m[1]);
  return null;
}
function safe(y, mo, d) {
  if (mo < 1 || mo > 12) return null;
  const v = make(y, mo, d);
  return isValid(v) ? v : null;
}
var MONEY = String.raw`(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)`;
function toMoney(s) {
  return rupees(Number(s.replace(/,/g, "")));
}
function parseAmount(text) {
  const labels = [
    String.raw`grand total|total amount|amount (?:charged|paid|due)|you (?:paid|were charged)`,
    String.raw`(?<![a-z-])total`,
    String.raw`charged?|paid|price|renew(?:s|al)? (?:at|for)|payment of`
  ];
  for (const l of labels) {
    const m = new RegExp(String.raw`(?:${l})[^\n₹]{0,30}${MONEY}`, "i").exec(text);
    if (m) return toMoney(m[1]);
  }
  const all = [...text.matchAll(new RegExp(MONEY, "gi"))].map((m) => toMoney(m[1])).filter((v) => v > 0);
  return all.length ? Math.max(...all) : null;
}
function parsePeriod(text) {
  const t = text.toLowerCase();
  if (/\b(annual(ly)?|yearly|per year|\/\s?(yr|year)|12 months|every year)\b/.test(t)) return "yearly";
  if (/\b(half[- ]yearly|semi[- ]annual|6 months|every 6 months)\b/.test(t)) return "half-yearly";
  if (/\b(quarterly|3 months|every 3 months|per quarter)\b/.test(t)) return "quarterly";
  if (/\b(monthly|per month|\/\s?(mo|month)|every month|1 month)\b/.test(t)) return "monthly";
  return null;
}
function dateAfter(text, cue) {
  const m = cue.exec(text);
  return m ? parseDate(text.slice(m.index, m.index + m[0].length + 60)) : null;
}
function parseInstrument(text, sender) {
  if (sender === GOOGLE_PLAY_SENDER) return { type: "store", store: "google_play" };
  const t = text;
  const card = /(?:visa|mastercard|master card|rupay|amex|american express|credit card|debit card|card)[^\n\d]{0,25}(?:ending(?: in| with)?|xx+|\*{2,}|•{2,}|last 4 digits)[\s:#-]*(\d{4})\b/i.exec(t) ?? /(?:ending(?: in| with)?|xx+|\*{4,}|•{4,})\s*(\d{4})\b[^\n]{0,20}\bcard\b/i.exec(t);
  if (card) return { type: "card", last4: card[1] };
  const handle = /\b([\w.-]{2,}@(?:ok\w+|ybl|ibl|axl|paytm|upi|apl|pthdfc|ptsbi|ptaxis|ptyes))\b/i.exec(t)?.[1] ?? "";
  if (/google pay|gpay|@ok(hdfc|axis|sbi|icici)/i.test(t)) return { type: "upi", app: "gpay", handle };
  if (/phonepe|@ybl|@ibl|@axl/i.test(t)) return { type: "upi", app: "phonepe", handle };
  if (/paytm/i.test(t)) return { type: "upi", app: "paytm", handle };
  if (/\bupi\b|autopay/i.test(t)) return { type: "upi", app: "other", handle };
  const bank = /(?:a\/c|account|acct)[^\n\d]{0,15}(?:xx+|\*+|ending(?: in)?)\s*(\d{4})\b/i.exec(t);
  if (bank) return { type: "bank", last4: bank[1] };
  return null;
}
function senderName(from) {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(from);
  const email = (m ? m[2] : from).trim().toLowerCase();
  const name = (m?.[1] || email.split("@")[1]?.split(".").slice(-2, -1)[0] || email).trim();
  return { name, email };
}
function playProduct(text, subject) {
  const m = /(?:^|\n)\s*(?:item|subscription|product)\s*[:\-]?\s*([^\n₹]{2,60}?)(?:\s+(?:₹|rs|inr)|\n|$)/i.exec(text) ?? /free trial of ([^\n.]{2,60}?)(?: has| is|\.|\n)/i.exec(`${subject}
${text}`) ?? /\n\s*([A-Z][^\n₹]{2,50}?)\s*\([^)]+\)\s*(?:₹|rs|inr)/i.exec(text);
  return m ? m[1].trim() : null;
}
var RECEIPTY = /(receipt|invoice|payment (?:successful|received|confirmation)|order (?:confirmation|receipt)|renew(?:ed|al)|subscription|membership|charged|your plan|billing|trial)/i;
function parseEmail(e) {
  const { name, email } = senderName(e.from);
  const hay = `${e.subject}
${e.text}`;
  const failed = /(payment (?:failed|declined|unsuccessful)|couldn[’']?t (?:process|charge)|didn[’']?t go through|card was declined|update your payment)/i.test(hay);
  if (!failed && !RECEIPTY.test(hay)) return null;
  const trial = /free trial/i.test(hay) && /(start|begun|began|activated|welcome|ends on|will be charged)/i.test(hay) && !/receipt for your payment/i.test(hay);
  const amount = parseAmount(hay);
  if (amount === null) return null;
  const play = email === GOOGLE_PLAY_SENDER;
  const merchantText = (play ? playProduct(e.text, e.subject) : null) ?? name;
  const trialEnds = trial ? dateAfter(hay, /(trial (?:ends|will end|expires)|will be charged|first (?:charge|payment|billing))/i) : null;
  const nextRenewal = dateAfter(hay, /(renews? on|renewal date|next (?:billing|payment|charge)(?: date)?|will (?:automatically )?renew|auto-renews?)/i) ?? trialEnds;
  const tax = /\b(?:gst|igst|cgst|tax)\b[^\n₹]{0,20}(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(hay);
  const sub = /\b(?:subtotal|sub-total|net amount|base price)\b[^\n₹]{0,20}(?:₹|rs\.?|inr)\s*([\d,]+(?:\.\d{1,2})?)/i.exec(hay);
  const plan = /\b(?:plan|membership|tier)\s*[:\-]\s*([^\n]{2,40}?)\s*(?:\n|$)/i.exec(e.text)?.[1] ?? null;
  const ref = /\b(?:order|invoice|receipt|transaction|reference|ref)\s*(?:id|no\.?|number|#)?\s*[:#]\s*([A-Z0-9][A-Z0-9.\-]{4,})/i.exec(hay)?.[1] ?? null;
  return {
    kind: "receipt",
    provider: "gmail",
    id: e.id,
    date: e.date,
    sender: email,
    subject: e.subject,
    merchantText,
    type: failed ? "payment_failed" : trial ? "trial_started" : "payment",
    amount,
    subtotal: sub ? toMoney(sub[1]) : null,
    tax: tax ? toMoney(tax[1]) : null,
    plan,
    billingPeriod: parsePeriod(hay),
    nextRenewal: trial ? trialEnds : nextRenewal,
    trialEnds,
    reference: ref,
    instrument: parseInstrument(hay, email)
  };
}
function receiptSearchQuery(senders, days = 730, window = {}) {
  const from = senders.length ? `from:(${senders.join(" OR ")})` : "";
  const generic = '(subject:(receipt OR invoice OR renewal OR renewed OR "payment successful" OR "payment received" OR "payment confirmation" OR "free trial" OR "payment failed" OR "payment declined" OR "subscription confirmed" OR "order confirmation") -category:promotions -category:social)';
  const range = [
    window.afterEpochSeconds ? `after:${Math.floor(window.afterEpochSeconds)}` : `newer_than:${Math.ceil(days)}d`,
    window.beforeEpochSeconds ? `before:${Math.floor(window.beforeEpochSeconds)}` : ""
  ].filter(Boolean).join(" ");
  return `(${[from, generic].filter(Boolean).join(" OR ")}) ${range} -in:chats`;
}

// src/detection/senders.ts
var RECEIPT_SENDER_DOMAINS = [
  "googleplay-noreply@google.com",
  "payments-noreply@google.com",
  "netflix.com",
  "openai.com",
  "anthropic.com",
  "microsoft.com",
  "xbox.com",
  "apple.com",
  "makenotion.com",
  "notion.so",
  "jiohotstar.com",
  "hotstar.com",
  "sonyliv.com",
  "zee5.com",
  "amazon.in",
  "audible.in",
  "primevideo.com",
  "swiggy.in",
  "zomato.com",
  "thehindu.co.in",
  "timesprime.com",
  "cult.fit",
  "curefit.com",
  "spotify.com",
  "youtube.com",
  "canva.com",
  "duolingo.com",
  "adobe.com",
  "linkedin.com",
  "cursor.com",
  "perplexity.ai",
  "midjourney.com",
  "uber.com",
  "razorpay.com",
  "paytm.com",
  "phonepe.com",
  "cred.club",
  "jio.com",
  "airtel.in"
];

var CLIENT_ID = "86235899973-st5it9v5gaajo3q2qv0jt84n2i7ar2jt.apps.googleusercontent.com";
var GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
var TIMEZONE = "Asia/Kolkata";
var BATCH = 60;
var CONCURRENCY = 4;
var HttpError = class extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
  status;
  extra;
};
var json = (status, body) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
var sleep = (ms) => new Promise((r) => setTimeout(r, ms));
var b64u = (bytes) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
var unb64u = (s) => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));
var keyPromise = null;
async function sessionKey() {
  keyPromise ??= (async () => {
    const secret = await getSecret("GOOGLE_WEB_CLIENT_SECRET");
    if (!secret) throw new HttpError(503, "Server is not configured yet (missing GOOGLE_WEB_CLIENT_SECRET).");
    const ikm = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), "HKDF", false, ["deriveKey"]);
    return crypto.subtle.deriveKey(
      { name: "HKDF", hash: "SHA-256", salt: new TextEncoder().encode("recription-session-v1"), info: new Uint8Array() },
      ikm,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt", "decrypt"]
    );
  })();
  return keyPromise;
}
async function seal(s) {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await sessionKey(), new TextEncoder().encode(JSON.stringify(s))));
  return `${b64u(iv)}.${b64u(ct)}`;
}
async function unseal(token) {
  if (typeof token !== "string" || !token.includes(".")) throw new HttpError(401, "Please sign in with Google again.", { error: "signed_out" });
  const key = await sessionKey();
  try {
    const [iv, ct] = token.split(".").map(unb64u);
    const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
    return JSON.parse(new TextDecoder().decode(plain));
  } catch {
    throw new HttpError(401, "Your sign-in is no longer valid. Please sign in with Google again.", { error: "signed_out" });
  }
}
async function tokenCall(body) {
  const res = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(body) });
  const j = await res.json().catch(() => ({}));
  if (!res.ok) throw new HttpError(res.status === 400 ? 401 : 502, `Google: ${[j.error, j.error_description].filter(Boolean).join(": ") || res.status}`, { error: j.error === "invalid_grant" ? "consent_revoked" : "google_error" });
  return j;
}
async function accessToken(s) {
  const secret = await getSecret("GOOGLE_WEB_CLIENT_SECRET");
  return (await tokenCall({ refresh_token: s.rt, client_id: CLIENT_ID, client_secret: secret, grant_type: "refresh_token" })).access_token;
}
async function gmail(path, token) {
  for (let attempt = 1; ; attempt++) {
    const res = await fetch(`https://gmail.googleapis.com/gmail/v1/users/me/${path}`, { headers: { Authorization: `Bearer ${token}` } });
    if (res.ok) return res.json();
    const err = (await res.json().catch(() => ({})))?.error;
    const reason = err?.errors?.[0]?.reason ?? err?.status ?? "";
    const limited = res.status === 429 || res.status === 403 && /rateLimit|RESOURCE_EXHAUSTED/.test(reason);
    if (limited && attempt < 3) {
      await sleep(1500 * attempt);
      continue;
    }
    if (limited) throw new HttpError(429, "Gmail is rate-limiting requests right now. Wait a minute and sync again.", { error: "rate_limited" });
    throw new HttpError(res.status === 401 ? 401 : 502, `Gmail API ${res.status}${reason ? ` (${reason})` : ""}`, { error: res.status === 401 ? "consent_revoked" : "gmail_error" });
  }
}
function decodeB64Url(data) {
  return new TextDecoder().decode(unb64u(data));
}
function collect(p, out) {
  if (p.body?.data) (p.mimeType === "text/plain" ? out.plain : p.mimeType === "text/html" ? out.html : []).push(decodeB64Url(p.body.data));
  p.parts?.forEach((c) => collect(c, out));
}
function htmlToText(html) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, " ").replace(/<br\s*\/?>|<\/(p|div|tr|li|h\d|table)>/gi, "\n").replace(/<\/t[dh]>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&#8377;|&#x20b9;/gi, "₹").replace(/&rsquo;|&#39;/g, "’").replace(/&[a-z#0-9]+;/gi, " ").replace(/[ \t]+/g, " ").replace(/\n\s*\n+/g, "\n").trim();
}
var localDate = (ms) => new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (i < items.length) {
      const k = i++;
      out[k] = await fn(items[k]);
    }
  }));
  return out;
}
async function auth(body) {
  const code = body.serverAuthCode;
  if (typeof code !== "string" || !code) throw new HttpError(400, "serverAuthCode is required");
  const secret = await getSecret("GOOGLE_WEB_CLIENT_SECRET");
  // Android sends a serverAuthCode (no redirect URI); the web app uses Google's popup code flow ("postmessage").
  const redirectUri = body.redirectUri === "postmessage" ? "postmessage" : "";
  const t = await tokenCall({ code, client_id: CLIENT_ID, client_secret: secret, grant_type: "authorization_code", redirect_uri: redirectUri });
  const infoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(t.id_token)}`);
  const info = await infoRes.json();
  if (!infoRes.ok || info.aud !== CLIENT_ID) throw new HttpError(401, "Google sign-in could not be verified");
  if (!String(t.scope ?? "").includes(GMAIL_SCOPE)) throw new HttpError(403, "Gmail read access wasn’t granted. Sign in again and allow “Read your email”.", { error: "gmail_not_granted" });
  if (!t.refresh_token) throw new HttpError(409, "Google didn’t grant ongoing access. Remove Recundle at myaccount.google.com › Security › Third-party access, then sign in again.", { error: "no_refresh_token" });
  const s = { rt: t.refresh_token, sub: info.sub, email: info.email, name: info.name ?? info.email, v: 1 };
  return { session: await seal(s), user: { email: s.email, name: s.name } };
}
async function receipts(body) {
  const s = await unseal(body.session);
  const token = await accessToken(s);
  const sinceMs = Date.parse(String(body.since ?? ""));
  const after = Number.isFinite(sinceMs) ? sinceMs / 1e3 - 86400 : void 0;
  const beforeParam = Number(body.before);
  const before = after === void 0 && beforeParam > 0 ? beforeParam : void 0;
  const q = receiptSearchQuery(RECEIPT_SENDER_DOMAINS, 730, { afterEpochSeconds: after, beforeEpochSeconds: before });
  const list = await gmail(`messages?q=${encodeURIComponent(q)}&maxResults=${BATCH}`, token);
  const ids = (list.messages ?? []).map((m) => m.id);
  const more = !!list.nextPageToken;
  let oldestMs = Infinity;
  const events = (await mapLimit(ids, CONCURRENCY, async (id) => {
    const m = await gmail(`messages/${id}?format=full`, token);
    const headers = m.payload?.headers ?? [];
    const h = (n) => headers.find((x) => x.name.toLowerCase() === n)?.value ?? "";
    const parts = { plain: [], html: [] };
    collect(m.payload ?? {}, parts);
    const text = (parts.plain.length ? parts.plain.join("\n") : htmlToText(parts.html.join("\n"))).slice(0, 2e4);
    const sentMs = Number(m.internalDate);
    oldestMs = Math.min(oldestMs, sentMs);
    return parseEmail({ id: m.id, from: h("from"), subject: h("subject"), date: localDate(sentMs), text });
  })).filter((e) => e !== null);
  const backfill = after !== void 0 ? null : { complete: !more, before: more && Number.isFinite(oldestMs) ? Math.floor(oldestMs / 1e3) : null };
  return { events, scanned: ids.length, parsed: events.length, syncedAt: (/* @__PURE__ */ new Date()).toISOString(), backfill };
}
async function revoke(body) {
  const s = await unseal(body.session).catch(() => null);
  if (s) await fetch(`https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(s.rt)}`, { method: "POST" }).catch(() => void 0);
  return { revoked: true };
}
export async function POST(req) {
  try {
    const body = await req.json().catch(() => ({}));
    switch (body.action) {
      case "auth":
        return json(200, { success: true, ...await auth(body) });
      case "me": {
        const s = await unseal(body.session);
        return json(200, { success: true, user: { email: s.email, name: s.name } });
      }
      case "receipts":
        return json(200, { success: true, ...await receipts(body) });
      case "revoke":
        return json(200, { success: true, ...await revoke(body) });
      default:
        return json(400, { success: false, message: "Unknown action" });
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { success: false, message: e.message, ...e.extra });
    return json(502, { success: false, message: e instanceof Error ? e.message : "Unexpected error", error: "unexpected" });
  }
}

export function GET() {
  return json(405, { success: false, message: "Use POST" });
}
