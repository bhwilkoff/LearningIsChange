// Encrypted token vault (Decision 015 security). The GitHub token is
// stored only as AES-GCM ciphertext under a key derived from a
// passphrase (PBKDF2-SHA256, 310k iterations). The plaintext lives in
// sessionStorage for the current tab only, so closing the tab locks it.
// No plaintext token is ever written to localStorage when the vault is used.

const VAULT_KEY = 'licAdminVault';
const SESSION_KEY = 'licAdminUnlockedToken';
const ITER = 310000;
const enc = new TextEncoder(), dec = new TextDecoder();
const b64 = (u8) => btoa(String.fromCharCode(...u8));
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(passphrase, salt) {
  const base = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, iterations: ITER, hash: 'SHA-256' }, base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}

export function hasVault() { return !!localStorage.getItem(VAULT_KEY); }
export function isUnlocked() { return !!sessionStorage.getItem(SESSION_KEY); }
export function unlockedToken() { return sessionStorage.getItem(SESSION_KEY) || ''; }
export function lock() { sessionStorage.removeItem(SESSION_KEY); }
export function forget() { lock(); localStorage.removeItem(VAULT_KEY); }

export async function store(token, passphrase) {
  if (!token || !passphrase) throw new Error('token and passphrase required');
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(token)));
  localStorage.setItem(VAULT_KEY, JSON.stringify({ v: 1, iter: ITER, salt: b64(salt), iv: b64(iv), ct: b64(ct), created: new Date().toISOString() }));
  sessionStorage.setItem(SESSION_KEY, token);
}

export async function unlock(passphrase) {
  const raw = localStorage.getItem(VAULT_KEY);
  if (!raw) throw new Error('No vault');
  const v = JSON.parse(raw);
  const key = await deriveKey(passphrase, unb64(v.salt));
  let pt;
  try { pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(v.iv) }, key, unb64(v.ct)); }
  catch { throw new Error('Wrong passphrase'); }
  const token = dec.decode(pt);
  sessionStorage.setItem(SESSION_KEY, token);
  return token;
}
