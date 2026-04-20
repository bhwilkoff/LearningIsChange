#!/usr/bin/env node
// Recompute stale counts in database/manifest.json + database/taxonomies.json
// + database/search.json from the actual content of database/posts/YYYY.json.
//
// After bulk operations like dedup-date-archives or any /remove/ usage, the
// manifest's `total_posts`, the per-shard `count`, and each taxonomy's
// `count` field drift from reality. This script puts them back in sync.
//
// Also rebuilds search.json so the in-browser search reflects the current
// posts (excerpts, keywords).
//
// Does NOT touch:
//   - posts/YYYY.json (those are the source of truth this reads from)
//   - pages.json (pages are independent of posts)
//   - search.db (SQLite FTS — needs sqlite3, separate concern)
//   - changelog.json (append-only edit log)
//   - authors.json (manually maintained)
//
// Usage:
//   node scripts/recompute-database-stats.js              # dry run
//   node scripts/recompute-database-stats.js --apply      # write changes

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const DB_DIR = path.join(REPO_ROOT, 'database');
const POSTS_DIR = path.join(DB_DIR, 'posts');

const APPLY = process.argv.includes('--apply');

function readJson(p, fallback = null) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return fallback; }
}

function loadShards() {
  const out = {};
  for (const f of fs.readdirSync(POSTS_DIR)) {
    const m = f.match(/^(\d{4})\.json$/);
    if (m) out[m[1]] = readJson(path.join(POSTS_DIR, f), { posts: [] });
  }
  return out;
}

function slugOf(v) { return typeof v === 'string' ? v : v?.slug; }

function tally(shards) {
  const allPosts = [];
  const shardCounts = {};
  let earliest = '9999-99-99';
  let latest = '0000-00-00';
  for (const [year, shard] of Object.entries(shards)) {
    const posts = Array.isArray(shard.posts) ? shard.posts : [];
    shardCounts[year] = posts.length;
    for (const p of posts) {
      allPosts.push({ year, ...p });
      const d = String(p.date_published || '').slice(0, 10);
      if (d && d < earliest) earliest = d;
      if (d && d > latest) latest = d;
    }
  }

  const catCounts = {};
  const tagCounts = {};
  for (const p of allPosts) {
    for (const c of (p.categories || [])) {
      const s = slugOf(c); if (s) catCounts[s] = (catCounts[s] || 0) + 1;
    }
    for (const t of (p.tags || [])) {
      const s = slugOf(t); if (s) tagCounts[s] = (tagCounts[s] || 0) + 1;
    }
  }
  return { allPosts, shardCounts, catCounts, tagCounts, earliest, latest };
}

function rebuildTaxonomies(existing, catCounts, tagCounts) {
  const exCats = (existing.categories?.items) || {};
  const exTags = (existing.tags?.items) || {};

  const newCats = {};
  for (const [slug, count] of Object.entries(catCounts)) {
    const ex = exCats[slug] || {};
    newCats[slug] = {
      ...ex,
      slug,
      name: ex.name || slug,
      url: ex.url || `/category/${slug}/`,
      count,
    };
  }
  const removedCats = Object.keys(exCats).filter(s => !(s in catCounts));

  const newTags = {};
  for (const [slug, count] of Object.entries(tagCounts)) {
    const ex = exTags[slug] || {};
    newTags[slug] = {
      ...ex,
      slug,
      name: ex.name || slug,
      url: ex.url || `/tag/${slug}/`,
      count,
    };
  }
  const removedTags = Object.keys(exTags).filter(s => !(s in tagCounts));

  return {
    taxonomies: {
      categories: { count: Object.keys(newCats).length, items: newCats },
      tags: { count: Object.keys(newTags).length, items: newTags },
    },
    removedCats,
    removedTags,
  };
}

function rebuildSearch(allPosts, taxonomies) {
  const cats = taxonomies.categories.items;
  const tags = taxonomies.tags.items;
  const sorted = [...allPosts].sort((a, b) =>
    String(b.date_published || '').localeCompare(String(a.date_published || ''))
  );
  return {
    generated: new Date().toISOString(),
    count: sorted.length,
    posts: sorted.map(p => {
      const catNames = (p.categories || []).map(c => cats[slugOf(c)]?.name || slugOf(c)).filter(Boolean);
      const tagNames = (p.tags || []).map(t => tags[slugOf(t)]?.name || slugOf(t)).filter(Boolean);
      return {
        title: p.title || 'Untitled',
        url: String(p.url || '').replace(/^https?:\/\/[^/]+/, ''),
        date: String(p.date_published || '').slice(0, 10),
        excerpt: p.excerpt || '',
        categories: catNames,
        tags: tagNames,
        keywords: [
          (p.title || '').toLowerCase(),
          ...catNames.map(s => s.toLowerCase()),
          ...tagNames.map(s => s.toLowerCase()),
        ].join(' '),
      };
    }),
  };
}

function main() {
  const shards = loadShards();
  const oldManifest = readJson(path.join(DB_DIR, 'manifest.json'), {});
  const oldTaxonomies = readJson(path.join(DB_DIR, 'taxonomies.json'), { categories: { items: {} }, tags: { items: {} } });
  const oldSearch = readJson(path.join(DB_DIR, 'search.json'), { posts: [] });
  const pages = readJson(path.join(DB_DIR, 'pages.json'), { pages: [] });

  const t = tally(shards);
  const { taxonomies, removedCats, removedTags } = rebuildTaxonomies(oldTaxonomies, t.catCounts, t.tagCounts);
  const search = rebuildSearch(t.allPosts, taxonomies);

  const manifest = {
    ...oldManifest,
    generated: new Date().toISOString(),
    stats: {
      ...(oldManifest.stats || {}),
      total_posts: t.allPosts.length,
      total_categories: Object.keys(taxonomies.categories.items).length,
      total_tags: Object.keys(taxonomies.tags.items).length,
      total_pages: pages.pages?.length ?? pages.count ?? oldManifest.stats?.total_pages,
      date_range: {
        earliest: `${t.earliest}T12:00:00Z`,
        latest: `${t.latest}T12:00:00Z`,
      },
      last_modified: new Date().toISOString(),
    },
    shards: {
      ...(oldManifest.shards || {}),
      posts: Object.fromEntries(
        Object.entries(t.shardCounts).map(([y, c]) => [y, { count: c, hash: null }]),
      ),
    },
  };

  const summary = {
    posts:      { old: oldManifest.stats?.total_posts,      new: t.allPosts.length },
    categories: { old: oldManifest.stats?.total_categories, new: Object.keys(taxonomies.categories.items).length, removed_unused: removedCats.length },
    tags:       { old: oldManifest.stats?.total_tags,       new: Object.keys(taxonomies.tags.items).length, removed_unused: removedTags.length },
    search:     { old: oldSearch.posts?.length || 0,        new: search.posts.length },
  };

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'} — recompute database stats\n`);
  for (const [k, v] of Object.entries(summary)) {
    const delta = v.new - v.old;
    const arrow = delta === 0 ? '=' : delta > 0 ? '↑' : '↓';
    console.log(`  ${k.padEnd(11)} ${String(v.old).padStart(6)} → ${String(v.new).padStart(6)}  ${arrow} ${delta >= 0 ? '+' : ''}${delta}${v.removed_unused != null ? `  (removed ${v.removed_unused} unused)` : ''}`);
  }
  if (removedCats.length) console.log(`\n  Removed categories: ${removedCats.join(', ')}`);
  if (removedTags.length && removedTags.length <= 25) console.log(`\n  Removed tags: ${removedTags.join(', ')}`);
  else if (removedTags.length) console.log(`\n  Removed ${removedTags.length} tags (sample: ${removedTags.slice(0, 10).join(', ')}, ...)`);

  if (APPLY) {
    fs.writeFileSync(path.join(DB_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(DB_DIR, 'taxonomies.json'), JSON.stringify(taxonomies, null, 2) + '\n');
    fs.writeFileSync(path.join(DB_DIR, 'search.json'), JSON.stringify(search, null, 2) + '\n');
    console.log(`\n✓ Wrote manifest.json, taxonomies.json, search.json`);
  } else {
    console.log('\nRun again with --apply to write changes.');
  }
}

main();
