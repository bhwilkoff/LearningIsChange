// Node adapter for the rendering core: partials, loaders, file checks.
// Everything browser-safe lives in core.js and is re-exported here so the
// renderers keep importing from './lib/shell.js'.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setImageExists, terms, dates, escapeHtml, escapeAttr, cleanUrl, fill, NOISE_TERMS } from './core.js';
export * from './core.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
const PARTIALS = path.join(REPO_ROOT, 'templates', 'partials');
setImageExists((rel) => fs.existsSync(path.join(REPO_ROOT, rel)));

// ---------- data ----------
// Live posts only. A post removed with /remove/ stays in its shard as a
// tombstone ({ removed: true, removed_at }) so its permalink can keep
// resolving (redirect page) — see loadTombstones().
export function loadAllPosts() {
  const dir = path.join(REPO_ROOT, 'database', 'posts');
  const all = [];
  for (const f of fs.readdirSync(dir).filter((n) => /^\d{4}\.json$/.test(n)).sort()) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const p of shard.posts || []) if (!p.removed) all.push({ ...p, url: cleanUrl(p.url), _shard: f });
  }
  // chronological, stable on url
  all.sort((a, b) => (a.date_published || '').localeCompare(b.date_published || '') || a.url.localeCompare(b.url));
  return all;
}
export function loadTombstones() {
  const dir = path.join(REPO_ROOT, 'database', 'posts');
  const out = [];
  for (const f of fs.readdirSync(dir).filter((n) => /^\d{4}\.json$/.test(n)).sort()) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const p of shard.posts || []) if (p.removed) out.push({ ...p, url: cleanUrl(p.url), _shard: f });
  }
  return out;
}
export function loadTaxonomies() {
  const p = path.join(REPO_ROOT, 'database', 'taxonomies.json');
  const t = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { categories: { items: {} }, tags: { items: {} } };
  return { categories: t.categories?.items || {}, tags: t.tags?.items || {} };
}

// ---------- shell ----------
function partial(name) { return fs.readFileSync(path.join(PARTIALS, `${name}.html`), 'utf8').replace(/\n$/, ''); }
// active: a data-nav key from templates/partials/nav.html (blog, portfolio, career, …)
export function nav({ active = '' } = {}) {
  const html = partial('nav');
  if (!active) return html;
  return html.replace(new RegExp(`(<a href="[^"]*" data-nav="${active}"(?: class="([^"]*)")?)`), (m, _, cls) =>
    cls ? m.replace(`class="${cls}"`, `class="${cls} active"`) : `${m} class="active"`);
}
// Which nav item a URL belongs to
export function navKeyFor(url) {
  if (url === '/meet/') return 'meet';
  const m = /^\/portfolio\/(career|apps|projects|writing|video|about)\//.exec(url);
  if (m) return m[1];
  if (url === '/portfolio/') return 'portfolio';
  return '';
}
export function footer() { return partial('footer'); }
// Head boilerplate shared by every template (icons, fonts, stylesheets)
export function headCommon() { return partial('head'); }
// Directories that are never public pages: tooling, data, WordPress leftovers (sitemap + permalink checker)
export const NON_PUBLIC_DIRS = new Set([
  '.git', 'node_modules', 'docs', 'templates', 'scripts', 'database',
  'admin', 'new', 'edit', 'update', 'remove', 'archive-sync',
  'rss-creator', 'podcast-rss', 'menus', 'links', 'database-generator',
  'wp-admin', 'wp-includes', 'wp-content', '__qs',
]);

// The rail is the same on every page of a run: build it once.
export function rail(all, taxonomies) {
  const recent = all.slice(-5).reverse().map((p) => `<li><a href="${escapeAttr(p.url)}">${escapeHtml(p.title || 'Untitled')}</a><time>${escapeHtml(dates(p).dateOnly)}</time></li>`).join('');
  const topics = Object.values(taxonomies.categories || {})
    .filter((c) => c && c.slug && !NOISE_TERMS.has(c.slug) && (c.count || 0) > 3)
    .sort((a, b) => (b.count || 0) - (a.count || 0)).slice(0, 12)
    .map((c) => `<a href="${escapeAttr(c.url)}">${escapeHtml(c.name)}</a>`).join('');
  const years = [...new Set(all.map((p) => dates(p).year).filter(Boolean))].sort().reverse()
    .map((y) => `<a href="/${y}/">${y}</a>`).join('');
  return fill(partial('rail'), { recent, topics, years });
}

