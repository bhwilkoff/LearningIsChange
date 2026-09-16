// LiC Admin — one application on the JSON content model (Decision 015).
// Hash router + view registry. Views live in ./views/*.js and export
// { title, render(root, ctx) } and optionally destroy().
import { getSettings, saveSettings } from '/admin/lib/auth.js';
import { GitHubAPI } from '/admin/lib/github.js';
import { CONFIG } from '/admin/lib/config.js';
import * as render from './views/render.js';
import * as settings from './views/settings.js';

const VIEWS = {
  posts: { title: 'Posts', soon: 'A2' }, pages: { title: 'Pages', soon: 'A2' }, terms: { title: 'Terms', soon: 'A2' },
  media: { title: 'Media', soon: 'A2' }, render, settings,
};
const ORDER = ['posts', 'pages', 'terms', 'media', 'render', 'settings'];

export const ctx = {
  CONFIG,
  settings: () => getSettings(),
  save: (s) => saveSettings(s),
  api() {
    const s = getSettings();
    if (!s.githubToken) return null;
    return new GitHubAPI({ token: s.githubToken, owner: s.repoOwner, name: s.repoName, branch: s.branch });
  },
  status(text) { document.getElementById('app-status').textContent = text || ''; },
  el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstElementChild; },
  esc: (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
};

let current = null;
function route() {
  const name = (location.hash.replace(/^#\/?/, '').split('/')[0]) || 'render';
  const view = VIEWS[name] || VIEWS.render;
  document.querySelectorAll('#app-nav a').forEach((a) => a.classList.toggle('active', a.dataset.view === name));
  if (current?.destroy) current.destroy();
  const root = document.getElementById('view');
  root.innerHTML = '';
  document.title = `${view.title} · LiC Admin`;
  if (view.soon) {
    root.appendChild(ctx.el(`<div><h1>${view.title}</h1><p class="lead">Coming in phase ${view.soon} (Decision 015). Until then use the existing tool: ${legacyLink(name)}.</p></div>`));
    current = null; return;
  }
  current = view; view.render(root, ctx);
}
function legacyLink(name) {
  const m = { posts: '<a href="/new/">New post</a> · <a href="/edit/">Edit</a> · <a href="/remove/">Remove</a> · <a href="/update/">Mass update</a>', pages: '<a href="/edit/">Edit</a>', terms: '<a href="/admin/db-maintenance/">DB maintenance</a>', media: '<a href="/admin/dedup/">Dedup</a> · <a href="/links/">Links</a>' };
  return m[name] || '';
}
document.getElementById('app-nav').innerHTML = ORDER.map((k) => `<a href="#/${k}" data-view="${k}">${VIEWS[k].title}</a>`).join('');
window.addEventListener('hashchange', route);
route();
