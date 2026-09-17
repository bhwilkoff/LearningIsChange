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
  const path = location.hash.replace(/^#\/?/, '');
  const name = path.split('/')[0] || 'render';
  // Signed-out: every view except Settings (where a token can be pasted) is the sign-in gate.
  const ok = await ctx.authed();
  document.body.classList.toggle('signed-out', !ok);
  document.getElementById('app-signout').hidden = !ok;
  if (!ok && name !== 'settings') { if (current?.destroy) current.destroy(); current = null; renderGate(); return; }
  // #/posts/edit/<url> → editor
  const sub = path.startsWith('posts/edit/') ? path.slice('posts/edit'.length) : path.startsWith('pages/edit/') ? path.slice('pages/edit'.length) : null;
  const view = path.startsWith('posts/edit/') ? edit : (VIEWS[name] || VIEWS.render);
  document.querySelectorAll('#app-nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
  if (current?.destroy) current.destroy();
  const root = document.getElementById('view');
  root.innerHTML = '';
  document.title = `${view.title} · LiC Admin`;
  if (view.soon) {
    root.appendChild(ctx.el(`<div><h1>${view.title}</h1><p class="lead">Coming in phase ${view.soon} (Decision 015). Until then use the existing tool: ${legacyLink(name)}.</p></div>`));
    current = null; return;
  }
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
  root.querySelector('#gate-github')?.addEventListener('click', () => oauth.signIn());
  root.querySelector('#gate-unlock')?.addEventListener('click', async () => { if (await ctx.ensureUnlocked()) { ctx.refreshLock(); route(); } });
}
function legacyLink(name) {
  const m = { posts: '<a href="/new/">New post</a> · <a href="/edit/">Edit</a> · <a href="/remove/">Remove</a> · <a href="/update/">Mass update</a>', pages: '<a href="/edit/">Edit</a>', terms: '<a href="/admin/db-maintenance/">DB maintenance</a>', media: '<a href="/admin/dedup/">Dedup</a> · <a href="/links/">Links</a>' };
  return m[name] || '';
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
document.getElementById('app-lock').onclick = async () => { if (vault.isUnlocked()) vault.lock(); else await ctx.ensureUnlocked(); ctx.refreshLock(); route(); };
ctx.refreshLock();
document.getElementById('app-nav').innerHTML = ORDER.map((k) => `<a href="#/${k}" data-view="${k}">${VIEWS[k].title}</a>`).join('');
window.addEventListener('hashchange', route);
route();
