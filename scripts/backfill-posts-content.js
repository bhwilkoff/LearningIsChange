#!/usr/bin/env node
// Backfill each post's rendered HTML body into database/posts/YYYY.json.
//
// Every post in the JSON index currently has metadata (title, url, date,
// categories, tags, excerpt) but no `content` field — the body lives in
// `/YYYY/MM/DD/slug/index.html`. This script reads each HTML file, extracts
// the contents of the `<div class="entry-content">` block, and stores it
// on the post entry as `content`.
//
// After this runs, `posts/YYYY.json` is the single source of truth for both
// metadata AND body, matching the pattern `pages.json` already uses. M4's
// post regenerator then produces the HTML from template + data.
//
// Usage:
//   node scripts/backfill-posts-content.js              # dry run
//   node scripts/backfill-posts-content.js --apply      # write changes
//   node scripts/backfill-posts-content.js --apply --year=2026
//   node scripts/backfill-posts-content.js --apply --overwrite   # re-extract even if content already set
//
// Idempotent: posts that already have non-empty `content` are skipped
// unless --overwrite is passed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const POSTS_DIR = path.join(REPO_ROOT, 'database', 'posts');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const OVERWRITE = args.includes('--overwrite');
const YEAR_ARG = args.find(a => a.startsWith('--year='));
const ONLY_YEAR = YEAR_ARG ? YEAR_ARG.slice('--year='.length) : null;

function findMatchingClose(html, openIdx, tagName) {
  const openTagEnd = html.indexOf('>', openIdx);
  if (openTagEnd === -1) return -1;
  const openRe = new RegExp(`<${tagName}\\b`, 'gi');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
  let pos = openTagEnd + 1;
  let depth = 1;
  while (depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const openM = openRe.exec(html);
    const closeM = closeRe.exec(html);
    if (!closeM) return -1;
    if (openM && openM.index < closeM.index) { depth++; pos = openM.index + openM[0].length; }
    else { depth--; if (depth === 0) return closeM.index; pos = closeM.index + closeM[0].length; }
  }
  return -1;
}

// Extract the innerHTML of the post's <div class="entry-content"> block.
function extractContent(html) {
  const openRe = /<div[^>]+class="[^"]*\bentry-content\b[^"]*"[^>]*>/i;
  const m = html.match(openRe);
  if (!m) return null;
  const openEnd = m.index + m[0].length;
  const closeIdx = findMatchingClose(html, m.index, 'div');
  if (closeIdx === -1) return null;
  return html.slice(openEnd, closeIdx).trim();
}

function postHtmlPath(postUrl) {
  // URL format drifts across years: some entries are full URLs
  // (https://learningischange.com/2013/01/02/foo/), others are paths
  // (/2026/03/26/foo/). Normalize both.
  const withoutOrigin = String(postUrl).replace(/^https?:\/\/[^/]+/, '');
  const rel = withoutOrigin.replace(/^\//, '').replace(/\/?$/, '/index.html');
  return path.join(REPO_ROOT, rel);
}

function processShard(year) {
  const shardPath = path.join(POSTS_DIR, `${year}.json`);
  if (!fs.existsSync(shardPath)) return null;
  const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
  const posts = Array.isArray(shard.posts) ? shard.posts : [];

  const summary = { year, total: posts.length, extracted: 0, skipped: 0, missing: 0, noContent: 0, addedBytes: 0 };
  let modified = false;

  for (const post of posts) {
    if (!post || !post.url) { summary.skipped++; continue; }
    const hasContent = typeof post.content === 'string' && post.content.length > 0;
    if (hasContent && !OVERWRITE) { summary.skipped++; continue; }

    const htmlPath = postHtmlPath(post.url);
    if (!fs.existsSync(htmlPath)) {
      summary.missing++;
      continue;
    }
    const html = fs.readFileSync(htmlPath, 'utf8');
    const content = extractContent(html);
    if (content == null) {
      summary.noContent++;
      continue;
    }
    const before = hasContent ? post.content.length : 0;
    post.content = content;
    summary.extracted++;
    summary.addedBytes += content.length - before;
    modified = true;
  }

  if (modified) {
    shard.count = posts.length;
    shard.post_count = posts.length;
    if (APPLY) fs.writeFileSync(shardPath, JSON.stringify(shard, null, 2) + '\n');
  }
  summary.wrote = modified && APPLY;
  return summary;
}

function main() {
  const years = ONLY_YEAR
    ? [ONLY_YEAR]
    : fs.readdirSync(POSTS_DIR).filter(f => /^\d{4}\.json$/.test(f)).map(f => f.replace('.json', '')).sort();

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}${OVERWRITE ? ' [OVERWRITE]' : ''} — processing ${years.length} year shard(s)`);
  console.log(`${'year'.padEnd(6)} ${'total'.padStart(6)} ${'extracted'.padStart(10)} ${'skipped'.padStart(8)} ${'missing'.padStart(8)} ${'noContent'.padStart(10)} ${'MB added'.padStart(10)}`);
  console.log('─'.repeat(64));

  let totals = { total: 0, extracted: 0, skipped: 0, missing: 0, noContent: 0, addedBytes: 0 };
  for (const year of years) {
    const s = processShard(year);
    if (!s) { console.log(`${year.padEnd(6)} (shard not found)`); continue; }
    console.log(
      `${String(s.year).padEnd(6)} ${String(s.total).padStart(6)} ${String(s.extracted).padStart(10)} ${String(s.skipped).padStart(8)} ${String(s.missing).padStart(8)} ${String(s.noContent).padStart(10)} ${(s.addedBytes / 1048576).toFixed(2).padStart(10)}`,
    );
    totals.total += s.total; totals.extracted += s.extracted; totals.skipped += s.skipped;
    totals.missing += s.missing; totals.noContent += s.noContent; totals.addedBytes += s.addedBytes;
  }
  console.log('─'.repeat(64));
  console.log(
    `TOTAL  ${String(totals.total).padStart(6)} ${String(totals.extracted).padStart(10)} ${String(totals.skipped).padStart(8)} ${String(totals.missing).padStart(8)} ${String(totals.noContent).padStart(10)} ${(totals.addedBytes / 1048576).toFixed(2).padStart(10)}`,
  );
  if (!APPLY) console.log('\nRun again with --apply to write changes.');
}

main();
