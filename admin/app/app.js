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

const VIEWS = {
  posts, pages: { title: 'Pages', soon: 'A2' }, terms: { title: 'Terms', soon: 'A2' },
  media: { title: 'Media', soon: 'A2' }, render, settings,
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
function route() {
  const path = location.hash.replace(/^#\/?/, '');
  const name = path.split('/')[0] || 'render';
  // #/posts/edit/<url> → editor
  const sub = path.startsWith('posts/edit/') ? path.slice('posts/edit'.length) : null;
  const view = sub !== null ? edit : (VIEWS[name] || VIEWS.render);
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
function legacyLink(name) {
  const m = { posts: '<a href="/new/">New post</a> · <a href="/edit/">Edit</a> · <a href="/remove/">Remove</a> · <a href="/update/">Mass update</a>', pages: '<a href="/edit/">Edit</a>', terms: '<a href="/admin/db-maintenance/">DB maintenance</a>', media: '<a href="/admin/dedup/">Dedup</a> · <a href="/links/">Links</a>' };
  return m[name] || '';
}
if (location.search.includes('code=')) {
  oauth.completeSignIn().then(() => { location.hash = '#/settings'; route(); ctx.status('Signed in with GitHub'); }).catch((e) => alert(e.message));
}
document.getElementById('app-lock').onclick = async () => { if (vault.isUnlocked()) vault.lock(); else await ctx.ensureUnlocked(); ctx.refreshLock(); route(); };
ctx.refreshLock();
document.getElementById('app-nav').innerHTML = ORDER.map((k) => `<a href="#/${k}" data-view="${k}">${VIEWS[k].title}</a>`).join('');
window.addEventListener('hashchange', route);
route();
