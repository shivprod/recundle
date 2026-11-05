/** Small helpers shared by the API routes (Web Request/Response handlers on Vercel). */

export class HttpError extends Error {
  constructor(status, code, message, extra = {}) {
    super(message);
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

export function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

/**
 * Every state-changing call must carry `X-Recundle: 1`. Browsers can't send a custom header
 * cross-site without a CORS preflight (which we never allow), so this blocks CSRF.
 */
export function requireAppHeader(req) {
  if (req.headers.get('x-recundle') !== '1') throw new HttpError(403, 'forbidden', 'Missing app header.');
}

export async function readJson(req, limit = 4_000_000) {
  const text = await req.text();
  if (text.length > limit) throw new HttpError(413, 'too_large', 'Request is too large.');
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    throw new HttpError(400, 'bad_json', 'Request body is not valid JSON.');
  }
}

/** Wraps a handler so thrown HttpErrors become JSON responses and nothing personal reaches the logs. */
export function route(handler) {
  return async (req) => {
    try {
      return await handler(req);
    } catch (err) {
      const status = err.status ?? 500;
      if (status >= 500) console.error(`[recundle] ${err.code ?? 'error'}: ${err.message}`);
      return json({ error: { code: err.code ?? 'server_error', message: status >= 500 && !err.code ? 'Something went wrong.' : err.message, ...(err.extra ?? {}) } }, status, err.headers ?? {});
    }
  };
}
