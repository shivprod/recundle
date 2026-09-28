import { GMAIL_SCOPE, GOOGLE_WEB_CLIENT_ID, GmailApiError } from './api';

const GIS_SRC = 'https://accounts.google.com/gsi/client';
let gisPromise = null;

function loadGoogleIdentityServices() {
  if (window.google?.accounts?.oauth2) return Promise.resolve(window.google);
  gisPromise ??= new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = GIS_SRC;
    script.async = true;
    script.onload = () => resolve(window.google);
    script.onerror = () => {
      gisPromise = null;
      reject(new GmailApiError("Couldn't load Google sign-in. Check your connection and try again.", 'network'));
    };
    document.head.appendChild(script);
  });
  return gisPromise;
}

/**
 * Opens Google's consent popup for read-only Gmail access and resolves with a
 * one-time authorization code for the recription-api `auth` action
 * (exchanged server-side with redirect_uri "postmessage").
 */
export async function requestGmailCode({ loginHint } = {}) {
  const google = await loadGoogleIdentityServices();
  return new Promise((resolve, reject) => {
    const client = google.accounts.oauth2.initCodeClient({
      client_id: GOOGLE_WEB_CLIENT_ID,
      scope: `openid email profile ${GMAIL_SCOPE}`,
      ux_mode: 'popup',
      include_granted_scopes: true,
      ...(loginHint && { login_hint: loginHint }),
      callback: (response) => {
        if (response?.code) {
          resolve(response.code);
        } else {
          reject(new GmailApiError(response?.error_description || 'Google sign-in was not completed.', response?.error || 'google_error'));
        }
      },
      error_callback: (err) => {
        const closed = err?.type === 'popup_closed' || err?.type === 'popup_failed_to_open';
        reject(new GmailApiError(
          err?.type === 'popup_failed_to_open'
            ? 'Your browser blocked the Google window. Allow pop-ups for Recundle and try again.'
            : 'Google sign-in was closed before finishing.',
          closed ? err.type : 'google_error',
        ));
      },
    });
    client.requestCode();
  });
}
