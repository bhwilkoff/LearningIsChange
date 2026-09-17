// LiC Admin — one application on the JSON content model (Decision 015).
// Hash router + view registry. Views live in ./views/*.js and export
// { title, render(root, ctx) } and optionally destroy().
import { getSettings, saveSettings } from '/admin/lib/auth.js';
import { GitHubAPI } from '/admin/lib/github.js';
import { CONFIG } from '/admin/lib/config.js';
import * as vault from '/admin/lib/vault.js';
import * as oauth from '/admin/lib/oauth.js';
import * as render from './views/render.js';
import * as settings from './views/settings.js';
import * as posts from './views/posts.js';
import * as edit from './views/edit.js';
import * as pages from './views/pages.js';
import * as terms from './views/terms.js';
import * as media from './views/media.js';

const VIEWS = {
  posts, pages, terms,
  media, render, settings,
};
const ORDER = ['posts', 'pages', 'terms', 'media', 'render', 'settings'];

export const ctx = {
  CONFIG,
  settings: () => getSettings(),
  save: (s) => saveSettings(s),
  vault, oauth,
  // token resolution: GitHub sign-in (short-lived) → unlocked vault → legacy plaintext
  token() { const o = oauth.session(); return (o && Date.now() < o.expires_at ? o.access_token : '') || vault.unlockedToken() || getSettings().githubToken || ''; },
  api() {
    const s = getSettings(); const token = this.token();
    if (!token) return null;
    return new GitHubAPI({ token, owner: s.repoOwner, name: s.repoName, branch: s.branch });
  },
  // The gate: true when any credential is usable — GitHub sign-in (refreshed
  // silently when expired), an unlocked vault, or a saved plaintext token.
  async authed() { return !!(await oauth.token()) || !!vault.unlockedToken() || !!getSettings().githubToken; },
  // Sign out = require a credential again: drop the GitHub session, lock the
  // vault (ciphertext stays), forget a remembered plaintext token.
  signOut() { oauth.signOut(); vault.lock(); const s = getSettings(); if (s.githubToken) saveSettings({ ...s, githubToken: '' }); this.status(''); this.refreshLock(); route(); },
  // Ask for the passphrase if a vault exists and is locked. Resolves true when a token is available.
  async ensureUnlocked() {
    if (await oauth.token()) return true; // refreshes an expired GitHub session silently
    if (this.token()) return true;
    if (!vault.hasVault()) return false;
    const pass = prompt('Unlock LiC Admin — passphrase for your encrypted GitHub token:');
    if (!pass) return false;
    try { await vault.unlock(pass); this.refreshLock(); return true; } catch (e) { alert(e.message); return false; }
  },
  refreshLock() {
    const el = document.getElementById('app-lock');
    if (!vault.hasVault()) { el.hidden = true; return; }
    el.hidden = false; el.textContent = vault.isUnlocked() ? '🔓 Lock' : '🔒 Unlock';
  },
  status(text) { document.getElementById('app-status').textContent = text || ''; },
  el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; },
  esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
};

let current = null;
async function route() {
  const path = location.hash.replace(/^#\/?/, '').split('?')[0]; // views read their own ?query
  const name = path.split('/')[0] || 'render';
  // Signed-out: every view except Settings (where a token can be pasted) is the sign-in gate.
  const ok = await ctx.authed();
  document.body.classList.toggle('signed-out', !ok);
  document.getElementById('app-signout').hidden = !ok;
  if (!ok && name !== 'settings') { if (current?.destroy) current.destroy(); current = null; renderGate(); return; }
  // #/posts/edit/<url> → editor
  const sub = path.startsWith('posts/edit/') ? path.slice('posts/edit'.length) : path === 'posts/new' ? 'new' : path.startsWith('pages/edit/') ? path.slice('pages/edit'.length) : null;
  const view = path.startsWith('posts/edit/') || path === 'posts/new' ? edit : (VIEWS[name] || VIEWS.render);
  document.querySelectorAll('#app-nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
  if (current?.destroy) current.destroy();
  const root = document.getElementById('view');
  root.innerHTML = '';
  document.title = `${view.title} · LiC Admin`;
  current = view; view.render(root, ctx, sub);
}
function renderGate() {
  const root = document.getElementById('view');
  root.innerHTML = '';
  document.title = 'Sign in · LiC Admin';
  document.querySelectorAll('#app-nav a').forEach((a) => a.classList.remove('active'));
  const denied = new URLSearchParams(location.search).get('error');
  root.appendChild(ctx.el(`<section class="gate">
    <p class="kicker">LiC Admin</p>
    <h1>Sign in to continue</h1>
    <p class="lead">Everything here writes to <code>${ctx.esc(CONFIG.repo.owner)}/${ctx.esc(CONFIG.repo.name)}</code> as you, so a GitHub credential is required before any view opens.</p>
    ${denied ? `<div class="msg warn">GitHub reported <code>${ctx.esc(denied)}</code> — the authorization was cancelled. Try again.</div>` : ''}
    <div class="row">
      ${oauth.configured() ? '<button class="btn primary" id="gate-github">Sign in with GitHub</button>' : ''}
      ${vault.hasVault() ? '<button class="btn" id="gate-unlock">Unlock with passphrase</button>' : ''}
    </div>
    <p class="text-muted">Prefer a fine-grained token? <a href="#/settings">Paste one in Settings</a>.</p>
  </section>`));
  root.querySelector('#gate-github')?.addEventListener('click', () => { if (location.hash && location.hash !== '#/') sessionStorage.setItem('licAdminNext', location.pathname + location.hash); oauth.signIn(); });
  root.querySelector('#gate-unlock')?.addEventListener('click', async () => { if (await ctx.ensureUnlocked()) { ctx.refreshLock(); route(); } });
}
// ?next=/some/tool/ (from the legacy tools' gate) survives the GitHub round-trip in sessionStorage.
const NEXT = new URLSearchParams(location.search).get('next');
if (NEXT && /^\/[^/\\]/.test(NEXT)) { sessionStorage.setItem('licAdminNext', NEXT); history.replaceState(null, '', location.pathname + location.hash); }
if (location.search.includes('code=')) {
  oauth.completeSignIn().then(() => {
    const next = sessionStorage.getItem('licAdminNext'); sessionStorage.removeItem('licAdminNext');
    if (next) { location.replace(next); return; }
    location.hash = location.hash && location.hash !== '#/' ? location.hash : '#/posts'; route(); ctx.status('Signed in with GitHub');
  }).catch((e) => alert(e.message));
} else if (location.search.includes('error=')) {
  // GitHub bounced back without a code (authorization cancelled): the gate shows it once, then the URL is scrubbed.
  setTimeout(() => history.replaceState(null, '', location.pathname + location.hash), 0);
}
document.getElementById('app-signout').onclick = () => ctx.signOut();

// Stale-module guard. GitHub Pages serves with a 10-minute cache lifetime and
// ES-module imports honour it, so for a few minutes after a deploy a tab can
// run old views against new data. Compare the newest commit touching admin/
// with the Last-Modified of the app.js this browser has cached; when a newer
// deploy exists, offer a reload that refreshes every module first.
const MODULES = ['/admin/app/index.html', '/admin/app/app.js', '/admin/app/app.css', '/admin/app/store.js', '/admin/app/media.js',
  ...['render', 'settings', 'posts', 'edit', 'pages', 'terms', 'media'].map((v) => `/admin/app/views/${v}.js`),
  ...['config', 'auth', 'vault', 'oauth', 'github', 'slug', 'mutate', 'database', 'editor', 'pickers', 'bluesky', 'base64', 'feeds'].map((l) => `/admin/lib/${l}.js`),
  '/admin/admin.css', '/admin/admin-bar.js'];
async function hardReload() {
  await Promise.all(MODULES.map((m) => fetch(m, { cache: 'reload' }).catch(() => {})));
  location.reload();
}
async function checkForUpdate() {
  try {
    const api = ctx.api(); if (!api) return;
    const cached = await fetch('/admin/app/app.js', { cache: 'force-cache' });
    const have = new Date(cached.headers.get('Last-Modified') || 0);
    const s = getSettings();
    const r = await fetch(`https://api.github.com/repos/${s.repoOwner}/${s.repoName}/commits?path=admin&per_page=1`, { headers: { Authorization: `Bearer ${ctx.token()}`, Accept: 'application/vnd.github+json' } });
    if (!r.ok) return;
    const [c] = await r.json(); const latest = new Date(c?.commit?.committer?.date || 0);
    if (!have.getTime() || latest - have < 60e3) return;
    const el = document.createElement('div'); el.className = 'app-update'; el.innerHTML = `A newer LiC Admin was deployed ${latest.toLocaleString()} — this tab is running an older copy. <button class="btn primary" type="button">Reload</button>`;
    el.querySelector('button').onclick = hardReload;
    document.body.insertBefore(el, document.getElementById('view'));
  } catch { /* offline or rate-limited: never block the app */ }
}
ctx.authed().then((ok) => { if (ok) checkForUpdate(); });
document.getElementById('app-lock').onclick = async () => { if (vault.isUnlocked()) vault.lock(); else await ctx.ensureUnlocked(); ctx.refreshLock(); route(); };
ctx.refreshLock();
document.getElementById('app-nav').innerHTML = ORDER.map((k) => `<a href="#/${k}" data-view="${k}">${VIEWS[k].title}</a>`).join('');
window.addEventListener('hashchange', route);
route();
