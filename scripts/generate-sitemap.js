#!/usr/bin/env node
// Build sitemap.xml from the working tree: every public index.html
// (plus a few top-level files) becomes a <url>. Posts get <lastmod>
// from database/posts/YYYY.json; everything else has none.
//
// Usage:
//   node scripts/generate-sitemap.js            # dry run (counts only)
//   node scripts/generate-sitemap.js --apply    # write sitemap.xml
//
// Idempotent. Re-run after adding/removing pages. Keep in sync with
// robots.txt (admin tools and WordPress leftovers are excluded here
// and disallowed there).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const SITE = 'https://learningischange.com';
const OUT = path.join(REPO_ROOT, 'sitemap.xml');
const APPLY = process.argv.includes('--apply');

// Not public content: admin tools, WordPress runtime, data, templates,
// and the auth stubs WordPress left behind.
const SKIP_DIRS = new Set([
  '.git', 'node_modules', 'docs', 'templates', 'scripts', 'database',
  'admin', 'new', 'edit', 'update', 'remove', 'archive-sync',
  'rss-creator', 'podcast-rss', 'menus', 'links', 'database-generator',
  'wp-admin', 'wp-includes', 'wp-content', '__qs',
  'login', 'logout', 'register', 'lostpassword', 'resetpass',
]);
const EXTRA_FILES = ['support.html'];

function* walk(dir, rel = '') {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name.startsWith('.')) continue;
    const r = rel ? `${rel}/${e.name}` : e.name;
    if (e.isDirectory()) {
      if (!rel && SKIP_DIRS.has(e.name)) continue;
      yield* walk(path.join(dir, e.name), r);
    } else if (e.isFile() && e.name === 'index.html') {
      yield rel ? `/${rel}/` : '/';
    }
  }
}

// url -> lastmod (YYYY-MM-DD) for posts
const lastmod = new Map();
const postsDir = path.join(REPO_ROOT, 'database', 'posts');
for (const f of fs.readdirSync(postsDir).filter((n) => n.endsWith('.json'))) {
  const data = JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8'));
  for (const p of data.posts || []) {
    const d = p.date_modified || p.date_published;
    // posts JSON mixes absolute and relative urls (3,639 vs 12 as of 2026-09) — normalize
    const u = p.url ? String(p.url).replace(/^https?:\/\/[^/]+/, '') : '';
    if (u && d) lastmod.set(u, String(d).slice(0, 10));
  }
}

const urls = [...walk(REPO_ROOT)];
for (const f of EXTRA_FILES) if (fs.existsSync(path.join(REPO_ROOT, f))) urls.push(`/${f}`);
urls.sort();

const esc = (s) => s.replace(/&/g, '&amp;').replace(/'/g, '&apos;').replace(/"/g, '&quot;')
  .replace(/</g, '&lt;').replace(/>/g, '&gt;');
const xml = ['<?xml version="1.0" encoding="UTF-8"?>',
  '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ...urls.map((u) => {
    const lm = lastmod.get(u);
    return `  <url><loc>${esc(SITE + encodeURI(u))}</loc>${lm ? `<lastmod>${lm}</lastmod>` : ''}</url>`;
  }),
  '</urlset>', ''].join('\n');

const posts = urls.filter((u) => lastmod.has(u)).length;
console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'} — ${urls.length} URLs (${posts} posts with lastmod), ${(xml.length / 1024).toFixed(0)} KB`);
if (urls.length > 50000) console.warn('WARNING: over the 50,000-URL sitemap limit; split into a sitemap index.');
if (APPLY) fs.writeFileSync(OUT, xml);
else console.log('Run again with --apply to write sitemap.xml');
