import { aiAvailable } from '../server/ai.js';
import { clientId, readSession, REQUESTED_SCOPES } from '../server/google.js';
import { json, route } from '../server/http.js';

/** Who is signed in (from the sealed cookie) and what the server is set up to do. Never returns tokens. */
export const GET = route(async (req) => {
  const configured = Boolean(process.env.GOOGLE_WEB_CLIENT_SECRET);
  const session = configured ? readSession(req) : null;
  return json({
    configured,
    clientId: clientId(),
    scopes: REQUESTED_SCOPES,
    ai: aiAvailable(),
    user: session ? { email: session.email, name: session.name, picture: session.picture } : null,
    access: session ? { gmail: Boolean(session.gmail) } : null,
  });
});
