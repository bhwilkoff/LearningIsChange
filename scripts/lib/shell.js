// Shared rendering helpers for the JSON → HTML generators (Decision 014).
// Everything a page needs beyond its own content: the site shell
// (nav / rail / footer partials), text helpers, JSON-LD, and the
// Markdown twin. No dependencies.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(HERE, '..', '..');
export const SITE = 'https://learningischange.com';
export const SITE_NAME = 'Learning is Change';
export const AUTHOR = { name: 'Ben Wilkoff', url: `${SITE}/portfolio/about/` };
export const DEFAULT_IMAGE = `${SITE}/meet/ben.jpg`;
export const TAGLINE = 'My name is Ben Wilkoff, and I Teach. And Learn. A Lot.';
// Terms every post carries; useless as "topics"
export const NOISE_TERMS = new Set(['ben-wilkoff', 'uncategorized', 'blog-2']);

const PARTIALS = path.join(REPO_ROOT, 'templates', 'partials');

// ---------- text ----------
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const escapeAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
export const stripOrigin = (u) => String(u || '').replace(/^https?:\/\/[^/]+/, '');
export const cleanUrl = (u) => stripOrigin(u).replace(/\/?$/, '/');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•' };
export function unescapeEntities(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] ?? m));
}
export function plainText(html) {
  return unescapeEntities(String(html ?? '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
export function wordCount(html) { const t = plainText(html); return t ? t.split(' ').length : 0; }
export function readingMinutes(html) { return Math.max(1, Math.round(wordCount(html) / 220)); }

// Excerpt if present, else the first ~160 chars of the body — derived at render, content untouched.
export function describe(post, max = 160) {
  let text = plainText(post.excerpt || post.content || '');
  // many bodies open by repeating the title (tweet-style posts); don't echo it
  const title = plainText(post.title || '');
  if (title && text.toLowerCase().startsWith(title.toLowerCase())) text = text.slice(title.length).replace(/^[\s:.,;–—-]+/, '');
  if (!text) return TAGLINE;
  if (text.length <= max) return text;
  return text.slice(0, max - 3).replace(/\s+\S*$/, '') + '…';
}
export function firstImage(html) {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(html || '');
  if (!m) return '';
  return m[1].startsWith('/') ? SITE + m[1] : m[1];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function dates(post) {
  const raw = post.date_published || '';
  const dateOnly = raw.slice(0, 10);
  const [y, m, d] = dateOnly.split('-');
  return {
    dateOnly,
    iso: /T\d/.test(raw) ? raw.replace(/Z$/, '+00:00') : `${dateOnly}T12:00:00+00:00`,
    formatted: y && m && d ? `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}` : dateOnly,
    year: y,
  };
}

// ---------- taxonomy ----------
// Tolerates every shape that has existed in the shards: [{name,slug,url}], ['slug'], stringified list.
export function terms(post, key) {
  let v = post[key];
  if (typeof v === 'string') { try { v = JSON.parse(v.replace(/'/g, '"')); } catch { v = []; } }
  if (!Array.isArray(v)) return [];
  const base = key === 'categories' ? '/category/' : '/tag/';
  return v.map((t) => {
    if (t && typeof t === 'object') return { name: t.name || t.slug, slug: t.slug || slugify(t.name), url: t.url || `${base}${t.slug}/` };
    const s = String(t || '').trim(); if (!s) return null;
    return { name: s, slug: slugify(s), url: `${base}${slugify(s)}/` };
  }).filter((t) => t && t.slug);
}
export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---------- data ----------
export function loadAllPosts() {
  const dir = path.join(REPO_ROOT, 'database', 'posts');
  const all = [];
  for (const f of fs.readdirSync(dir).filter((n) => /^\d{4}\.json$/.test(n)).sort()) {
    const shard = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
    for (const p of shard.posts || []) all.push({ ...p, url: cleanUrl(p.url), _shard: f });
  }
  // chronological, stable on url
  all.sort((a, b) => (a.date_published || '').localeCompare(b.date_published || '') || a.url.localeCompare(b.url));
  return all;
}
export function loadTaxonomies() {
  const p = path.join(REPO_ROOT, 'database', 'taxonomies.json');
  const t = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : { categories: { items: {} }, tags: { items: {} } };
  return { categories: t.categories?.items || {}, tags: t.tags?.items || {} };
}

// ---------- related / neighbors ----------
export function neighbors(all, index) {
  return { prev: index > 0 ? all[index - 1] : null, next: index < all.length - 1 ? all[index + 1] : null };
}
// term slug -> [post index], built once per `all` array
const TERM_INDEX = new WeakMap();
function termIndex(all) {
  let idx = TERM_INDEX.get(all);
  if (idx) return idx;
  idx = { tags: new Map(), cats: new Map() };
  all.forEach((p, i) => {
    for (const t of terms(p, 'tags')) if (!NOISE_TERMS.has(t.slug)) (idx.tags.get(t.slug) || idx.tags.set(t.slug, []).get(t.slug)).push(i);
    for (const c of terms(p, 'categories')) if (!NOISE_TERMS.has(c.slug)) (idx.cats.get(c.slug) || idx.cats.set(c.slug, []).get(c.slug)).push(i);
  });
  TERM_INDEX.set(all, idx);
  return idx;
}
export function related(all, index, n = 4) {
  const me = all[index];
  const idx = termIndex(all);
  const myTags = terms(me, 'tags').map((t) => t.slug).filter((s) => !NOISE_TERMS.has(s));
  const myCats = terms(me, 'categories').map((t) => t.slug).filter((s) => !NOISE_TERMS.has(s));
  if (!myTags.length && !myCats.length) return nearest(all, index, n);
  const score = new Map();
  for (const s of myTags) for (const i of idx.tags.get(s) || []) if (i !== index) score.set(i, (score.get(i) || 0) + 2);
  for (const s of myCats) for (const i of idx.cats.get(s) || []) if (i !== index) score.set(i, (score.get(i) || 0) + 1);
  const scored = [...score].map(([i, s]) => ({ s, d: Math.abs(i - index), p: all[i] }));
  scored.sort((a, b) => b.s - a.s || a.d - b.d);
  const out = scored.slice(0, n).map((x) => x.p);
  if (out.length < n) for (const p of nearest(all, index, n * 2)) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
  return out;
}
function nearest(all, index, n) {
  const out = [];
  for (let k = 1; out.length < n && (index - k >= 0 || index + k < all.length); k++) {
    if (index - k >= 0) out.push(all[index - k]);
    if (out.length < n && index + k < all.length) out.push(all[index + k]);
  }
  return out;
}

// ---------- shell ----------
function partial(name) { return fs.readFileSync(path.join(PARTIALS, `${name}.html`), 'utf8').replace(/\n$/, ''); }
export function fill(tpl, values) {
  let out = tpl;
  for (const [k, v] of Object.entries(values)) out = out.split(`{{${k}}}`).join(v ?? '');
  return out;
}
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

// ---------- structured data ----------
export function jsonLdPost(post, absUrl, d, description) {
  const data = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl },
    headline: post.title || 'Untitled',
    description, datePublished: d.iso, dateModified: post.date_modified || d.iso,
    author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url },
    publisher: { '@type': 'Person', name: AUTHOR.name, url: `${SITE}/` },
    isPartOf: { '@type': 'Blog', '@id': `${SITE}/#blog`, name: SITE_NAME },
    inLanguage: 'en-US',
    wordCount: wordCount(post.content),
  };
  const img = firstImage(post.content); if (img) data.image = img;
  const kw = [...terms(post, 'categories'), ...terms(post, 'tags')].map((t) => t.name).filter((n) => !NOISE_TERMS.has(slugify(n)));
  if (kw.length) data.keywords = kw.join(', ');
  return JSON.stringify(data).replace(/<\//g, '<\\/');
}

// ---------- Markdown twin ----------
// Good-enough conversion of WordPress-era HTML for agents and curl.
// Unknown/complex markup degrades to its text; nothing is lost from the HTML page.
export function toMarkdown(html) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '');
  s = s.replace(/\r?\n\s*/g, ' ');
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => '\n\n```\n' + plainText(c.replace(/<br\s*\/?>/gi, '\n')).replace(/ \n /g, '\n') + '\n```\n\n');
  s = s.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, (_, c) => ` *${plainText(c)}*`);
  s = s.replace(/<img[^>]*>/gi, (tag) => { const src = /src=["']([^"']+)/i.exec(tag)?.[1] || ''; const alt = /alt=["']([^"']*)/i.exec(tag)?.[1] || ''; return src ? `![${alt}](${src})` : ''; });
  s = s.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => { const t = plainText(txt); return t ? `[${t}](${href})` : ''; });
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, c) => `**${c.trim()}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, c) => `*${c.trim()}*`);
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + plainText(c) + '`');
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, c) => `\n\n${'#'.repeat(Math.min(6, parseInt(n, 10) + 1))} ${plainText(c)}\n\n`);
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `\n- ${c.trim()}`);
  s = s.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => '\n\n' + plainText(c).split(/\n/).map((l) => `> ${l}`).join('\n') + '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '  \n');
  s = s.replace(/<\/(p|div|figure|ul|ol|section|article|table|tr)>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = unescapeEntities(s);
  return s.split('\n').map((l) => l.replace(/^[ \t]+(?!$)/, '').replace(/[ \t]+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
export function markdownTwin(post, absUrl) {
  const d = dates(post);
  const cats = terms(post, 'categories').map((t) => t.name);
  const tags = terms(post, 'tags').map((t) => t.name);
  const yaml = (arr) => arr.length ? `[${arr.map((x) => JSON.stringify(x)).join(', ')}]` : '[]';
  return `---\ntitle: ${JSON.stringify(post.title || 'Untitled')}\ndate: ${d.dateOnly}\nurl: ${absUrl}\nauthor: ${AUTHOR.name}\ncategories: ${yaml(cats)}\ntags: ${yaml(tags)}\n---\n\n# ${post.title || 'Untitled'}\n\n${toMarkdown(post.content)}`;
}
