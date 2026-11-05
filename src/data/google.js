/** Google Identity Services popup that returns a one-time code for the server to exchange. */
let loading = null;

function loadScript() {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => {
      loading = null;
      reject(new Error('Could not load Google sign-in. Check your connection.'));
    };
    document.head.appendChild(s);
  });
  return loading;
}

export async function requestGoogleCode({ clientId, scopes, hint }) {
  await loadScript();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initCodeClient({
      client_id: clientId,
      scope: scopes.join(' '),
      ux_mode: 'popup',
      include_granted_scopes: true,
      login_hint: hint,
      // Ask for consent so Google returns a refresh token and the permission boxes are shown.
      prompt: 'consent',
      callback: (resp) => (resp.error ? reject(Object.assign(new Error(resp.error_description || resp.error), { code: resp.error })) : resolve(resp.code)),
      error_callback: (err) => reject(Object.assign(new Error(err?.message ?? 'Sign-in was cancelled.'), { code: err?.type ?? 'popup_closed' })),
    });
    client.requestCode();
  });
}
