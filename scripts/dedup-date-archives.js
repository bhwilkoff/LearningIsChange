#!/usr/bin/env node
// Remove date-archive entries from database/posts/YYYY.json shards.
//
// Background: the posts DB currently contains ~1,753 entries with URLs
// like /YYYY/MM/DD/ (no slug) — those are date-archive listing pages
// masquerading as posts. Real post URLs always have a slug:
// /YYYY/MM/DD/<slug>/. This script removes the date-archive entries
// so the posts DB cleanly represents actual posts.
//
// Usage:
//   node scripts/dedup-date-archives.js              # dry run
//   node scripts/dedup-date-archives.js --apply      # write changes
//   node scripts/dedup-date-archives.js --apply --year=2013
//
// Idempotent: rerunning after --apply is a no-op.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const POSTS_DIR = path.join(REPO_ROOT, 'database', 'posts');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const YEAR_ARG = args.find(a => a.startsWith('--year='));
const ONLY_YEAR = YEAR_ARG ? YEAR_ARG.slice('--year='.length) : null;

function isRealPost(url) {
  if (!url) return false;
  const clean = String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').replace(/\/?$/, '');
  const parts = clean.split('/').filter(Boolean);
  // Real post: YYYY / MM / DD / slug  (4+ segments with date prefix)
  if (parts.length < 4) return false;
  if (!/^\d{4}$/.test(parts[0])) return false;
  if (!/^\d{2}$/.test(parts[1])) return false;
  if (!/^\d{2}$/.test(parts[2])) return false;
  if (/^\d{2}$/.test(parts[3])) return false; // slug shouldn't be pure digits
  return true;
}

function processShard(year) {
  const shardPath = path.join(POSTS_DIR, `${year}.json`);
  if (!fs.existsSync(shardPath)) return null;
  const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
  const posts = Array.isArray(shard.posts) ? shard.posts : [];
  const kept = posts.filter(p => isRealPost(p?.url));
  const removed = posts.length - kept.length;
  if (removed > 0 && APPLY) {
    shard.posts = kept;
    shard.count = kept.length;
    shard.post_count = kept.length;
    fs.writeFileSync(shardPath, JSON.stringify(shard, null, 2) + '\n');
  }
  return { year, original: posts.length, kept: kept.length, removed };
}

function main() {
  const years = ONLY_YEAR
    ? [ONLY_YEAR]
    : fs.readdirSync(POSTS_DIR).filter(f => /^\d{4}\.json$/.test(f)).map(f => f.replace('.json', '')).sort();

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — dedup date-archive entries`);
  console.log(`${'year'.padEnd(6)} ${'before'.padStart(7)} ${'kept'.padStart(7)} ${'removed'.padStart(8)}`);
  console.log('─'.repeat(34));
  let totals = { original: 0, kept: 0, removed: 0 };
  for (const year of years) {
    const s = processShard(year);
    if (!s) continue;
    console.log(
      `${year.padEnd(6)} ${String(s.original).padStart(7)} ${String(s.kept).padStart(7)} ${String(s.removed).padStart(8)}${s.removed > 0 && APPLY ? '  ✓' : ''}`,
    );
    totals.original += s.original; totals.kept += s.kept; totals.removed += s.removed;
  }
  console.log('─'.repeat(34));
  console.log(`TOTAL  ${String(totals.original).padStart(7)} ${String(totals.kept).padStart(7)} ${String(totals.removed).padStart(8)}`);
  if (!APPLY) console.log('\nRun again with --apply to write changes.');
}

main();
