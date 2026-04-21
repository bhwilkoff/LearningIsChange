#!/usr/bin/env node
// Prune <article> blocks from archive/listing pages when the post they
// link to no longer exists in the database (has been deleted). Does not
// rebuild listings — just removes stale entries so there are no dead
// links from archive pages after dedup/removal.
//
// Usage:
//   node scripts/prune-archive-listings.js           # dry run (report)
//   node scripts/prune-archive-listings.js --apply   # write changes

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const POSTS_DIR = path.join(REPO_ROOT, 'database', 'posts');
const APPLY = process.argv.includes('--apply');

// 1) Build the set of live post URLs from JSON (source of truth)
const livePaths = new Set(); // canonical path form: "/YYYY/MM/DD/slug/"
for (const f of fs.readdirSync(POSTS_DIR).filter(x => /^\d{4}\.json$/.test(x))) {
  const shard = JSON.parse(fs.readFileSync(path.join(POSTS_DIR, f), 'utf8'));
  for (const p of (shard.posts || [])) {
    if (!p.url) continue;
    const u = String(p.url).replace(/^https?:\/\/[^/]+/, '').replace(/\/?$/, '/');
    livePaths.add(u);
  }
}
console.log(`Live posts in DB: ${livePaths.size}`);

// 2) Discover archive/listing page files. These are every index.html under:
//    /page/N/, /YYYY/, /YYYY/MM/, /YYYY/MM/DD/, /category/..., /tag/...,
//    /author/..., and root /index.html (home).
const archivePages = [];
function walk(dir, include) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
  for (const e of entries) {
    if (e.name === '.git' || e.name === 'node_modules') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, include);
    else if (e.name === 'index.html' && include(full)) archivePages.push(full);
  }
}
const isArchive = (full) => {
  const rel = path.relative(REPO_ROOT, full).replace(/\\/g, '/');
  // Home page and top-level pagination
  if (rel === 'index.html') return true;
  if (/^page\/\d+\/index\.html$/.test(rel)) return true;
  // Year / month / day archives (guard against post pages which are
  // /YYYY/MM/DD/slug/index.html — 4 segments before the filename)
  if (/^\d{4}\/index\.html$/.test(rel)) return true;
  if (/^\d{4}\/\d{2}\/index\.html$/.test(rel)) return true;
  if (/^\d{4}\/\d{2}\/\d{2}\/index\.html$/.test(rel)) return true;
  // Category / tag / author archives + their paginated pages
  if (/^(category|tag|author)\/[^/]+(?:\/[^/]+)*\/(page\/\d+\/)?index\.html$/.test(rel)) return true;
  return false;
};
walk(REPO_ROOT, isArchive);
console.log(`Archive/listing pages found: ${archivePages.length}`);

// 3) For each archive page, find <article> blocks that link to a path
//    not in livePaths. Remove those blocks.
// The post URL appears as `href="/YYYY/MM/DD/slug/"` with rel="bookmark"
// in the entry-title anchor.
const stats = { pagesScanned: 0, pagesModified: 0, articlesRemoved: 0, brokenLinks: new Map() };

function pathFromArticle(articleHtml) {
  // Primary: bookmark anchor (entry-title link)
  let m = articleHtml.match(/href="(\/[^"]*?)"[^>]*rel="bookmark"/i);
  if (m) return m[1].replace(/\/?$/, '/');
  // Secondary: any href starting with /YYYY/MM/DD/ followed by slug/
  m = articleHtml.match(/href="(\/\d{4}\/\d{2}\/\d{2}\/[^"\/]+\/?)"/);
  if (m) return m[1].replace(/\/?$/, '/');
  return null;
}

for (const pageFile of archivePages) {
  const html = fs.readFileSync(pageFile, 'utf8');
  let removed = 0;
  const newHtml = html.replace(/<article[\s\S]*?<\/article>/g, (block) => {
    const linkPath = pathFromArticle(block);
    if (!linkPath) return block; // can't parse; keep
    if (livePaths.has(linkPath)) return block;
    // Broken — track + drop
    removed++;
    stats.brokenLinks.set(linkPath, (stats.brokenLinks.get(linkPath) || 0) + 1);
    return '';
  });
  stats.pagesScanned++;
  if (removed > 0) {
    stats.pagesModified++;
    stats.articlesRemoved += removed;
    if (APPLY) fs.writeFileSync(pageFile, newHtml);
  }
}

console.log('');
console.log('=== Summary ===');
console.log(`Pages scanned:        ${stats.pagesScanned}`);
console.log(`Pages modified:       ${stats.pagesModified}`);
console.log(`<article> blocks cut: ${stats.articlesRemoved}`);
console.log(`Unique broken paths:  ${stats.brokenLinks.size}`);
if (stats.brokenLinks.size > 0 && stats.brokenLinks.size <= 25) {
  console.log('');
  console.log('Broken paths removed:');
  for (const [p, n] of [...stats.brokenLinks.entries()].sort((a,b)=>b[1]-a[1])) {
    console.log(`  ${p}  (${n}×)`);
  }
}
if (!APPLY) console.log('\nDRY RUN. Re-run with --apply to write changes.');
