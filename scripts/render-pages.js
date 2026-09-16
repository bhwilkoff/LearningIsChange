#!/usr/bin/env node
// Render static pages from database/pages.json on the new shell
// (Decision 014, P3). database/page-rules.json decides which URLs are
// redirects (kept so the permalink resolves) and which are noindex.
// /all-posts/ is special-cased into a full index of every post by year.
//
//   node scripts/render-pages.js            # dry run
//   node scripts/render-pages.js --apply

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, SITE, SITE_NAME, AUTHOR, DEFAULT_IMAGE, escapeHtml, escapeAttr, describe, dates, plainText,
  firstImage, loadAllPosts, loadTaxonomies, nav, rail, footer, fill,
} from './lib/shell.js';

const APPLY = process.argv.includes('--apply');
const T_PAGE = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'page.html'), 'utf8');
const T_REDIRECT = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'redirect.html'), 'utf8');
const RULES = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'database', 'page-rules.json'), 'utf8'));
const NOINDEX = new Set(RULES.noindex || []);
const raw = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'database', 'pages.json'), 'utf8'));
const PAGES = (Array.isArray(raw) ? raw : raw.pages || Object.values(raw)).filter((p) => p && (p.url || p.path));
// admin tools and data dirs listed in pages.json are not pages
const TOOL_PATHS = new Set(['/archive-sync/', '/database/', '/makedatabase/', '/new/', '/rss-creator/', '/update/', '/edit/', '/remove/', '/admin/', '/search/', '/links/', '/menus/', '/podcast-rss/']);

const ALL = loadAllPosts();
const SHELL = { nav: nav({ active: '' }), rail: rail(ALL, loadTaxonomies()), footer: footer() };
const urlOf = (p) => (p.url || '/' + p.path.replace(/index\.html$/, '')).replace(/^https?:\/\/[^/]+/, '').replace(/\/?$/, '/');

function allPostsIndex() {
  const byYear = new Map();
  for (const p of [...ALL].reverse()) { const y = dates(p).year; if (!y) continue; (byYear.get(y) || byYear.set(y, []).get(y)).push(p); }
  return [...byYear].map(([y, ps]) => `<section class="section"><div class="section-title"><h2><a href="/${y}/">${y}</a></h2><span class="text-muted" style="font-size:.85rem">${ps.length} posts</span></div><ul class="post-list">${ps.map((p) => `<li><time datetime="${dates(p).dateOnly}">${dates(p).dateOnly}</time><div><a class="t" href="${escapeAttr(p.url)}">${escapeHtml(p.title || 'Untitled')}</a></div></li>`).join('')}</ul></section>`).join('');
}

const out = new Map();
let redirects = 0, pages = 0, noindex = 0;
for (const p of PAGES) {
  const url = urlOf(p);
  if (TOOL_PATHS.has(url) || url.startsWith('/portfolio/') || url === '/meet/' || url === '/') continue;
  const abs = SITE + url;
  if (RULES.redirects[url]) {
    const target = RULES.redirects[url];
    out.set(url, fill(T_REDIRECT, { title: escapeHtml(p.title || 'Moved'), target, target_abs: target.startsWith('http') ? target : SITE + target, target_json: JSON.stringify(target), target_text: escapeHtml(target) }));
    redirects++; continue;
  }
  const isIndex = url === '/all-posts/';
  const content = isIndex ? allPostsIndex() : (p.content || '');
  const mod = p.date_modified && p.date_modified !== 'None' ? String(p.date_modified).slice(0, 10) : '';
  const description = isIndex ? `Every one of the ${ALL.length.toLocaleString('en-US')} posts on Learning is Change, by year.` : describe({ title: p.title, excerpt: p.excerpt, content });
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': isIndex ? 'CollectionPage' : 'WebPage', name: p.title, url: abs, description, ...(mod ? { dateModified: mod } : {}), isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website`, name: SITE_NAME }, author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url } }).replace(/<\//g, '<\\/');
  const noidx = NOINDEX.has(url) || (!isIndex && plainText(content).length < 40);
  if (noidx) noindex++;
  const html = fill(T_PAGE, {
    title: escapeHtml(p.title || 'Untitled'), description: escapeAttr(description), abs_url: abs,
    og_image: escapeAttr(firstImage(content) || DEFAULT_IMAGE),
    robots: noidx ? '<meta name="robots" content="noindex, follow">' : '',
    json_ld: ld, body_classes: `page-${(p.slug || url).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
    kicker: isIndex ? '<span class="card-tag">Archive</span>' : '<span class="card-tag">Page</span>',
    meta: mod ? `<div class="post-meta"><span>Updated <time datetime="${mod}">${dates({ date_published: mod }).formatted}</time></span></div>` : '',
    ...SHELL,
  }).split('{{content}}').join(content);
  out.set(url, html); pages++;
}

let written = 0, unchanged = 0;
for (const [u, html] of out) {
  const f = path.join(REPO_ROOT, u.replace(/^\//, ''), 'index.html');
  const prior = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null;
  if (prior === html) { unchanged++; continue; }
  if (APPLY) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, html); }
  written++;
}
console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'} — ${out.size} static pages (${pages} rendered, ${noindex} noindex, ${redirects} redirects) — ${written} ${APPLY ? 'written' : 'would change'}, ${unchanged} unchanged`);
if (!APPLY) console.log('Run again with --apply to write files.');
