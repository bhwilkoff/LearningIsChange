// "Sign in with GitHub" for LiC Admin (Decision 016). The GitHub App's
// user-authorization flow: redirect → code → Worker exchange → short-lived
// token (+ refresh token) kept in sessionStorage for this tab only.
import { CONFIG } from './config.js';

const KEY = 'licAdminOAuth';
const STATE_KEY = 'licAdminOAuthState';

export function configured() { return !!(CONFIG.auth?.clientId && CONFIG.auth?.worker); }
export function session() { try { return JSON.parse(sessionStorage.getItem(KEY) || 'null'); } catch { return null; } }
export function signedIn() { const s = session(); return !!(s && s.access_token && Date.now() < s.expires_at); }
export function signOut() { sessionStorage.removeItem(KEY); }

export function signIn() {
  const state = crypto.randomUUID();
  sessionStorage.setItem(STATE_KEY, state);
  const redirect = location.origin + location.pathname;
  location.href = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(CONFIG.auth.clientId)}&redirect_uri=${encodeURIComponent(redirect)}&state=${state}`;
}

// Call on app load: completes the redirect if ?code= is present. Returns true when a session exists afterwards.
export async function completeSignIn() {
  const params = new URLSearchParams(location.search);
  const code = params.get('code'), state = params.get('state');
  if (!code) return signedIn();
  const expected = sessionStorage.getItem(STATE_KEY); sessionStorage.removeItem(STATE_KEY);
  history.replaceState(null, '', location.pathname + location.hash); // scrub the code from the URL
  if (!expected || state !== expected) throw new Error('Sign-in state mismatch — try again.');
  await exchange('/token', { code });
  return true;
}

async function exchange(path, body) {
  const res = await fetch(CONFIG.auth.worker.replace(/\/$/, '') + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data.access_token) throw new Error(data.error || `auth exchange failed (${res.status})`);
  const now = Date.now();
  sessionStorage.setItem(KEY, JSON.stringify({
    access_token: data.access_token, expires_at: now + (data.expires_in ? data.expires_in * 1000 : 8 * 3600e3) - 60e3,
    refresh_token: data.refresh_token || null, refresh_expires_at: data.refresh_token_expires_in ? now + data.refresh_token_expires_in * 1000 : null,
  }));
  return data;
}

// Returns a valid access token, refreshing silently when possible; '' when signed out.
export async function token() {
  const s = session();
  if (!s) return '';
  if (Date.now() < s.expires_at) return s.access_token;
  if (s.refresh_token && (!s.refresh_expires_at || Date.now() < s.refresh_expires_at)) {
    try { await exchange('/refresh', { refresh_token: s.refresh_token }); return session().access_token; } catch { signOut(); return ''; }
  }
  signOut(); return '';
}
