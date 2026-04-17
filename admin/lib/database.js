// Read access to the site database under /database/.
//
// All admin tools fetch from the public Pages URL (served by GitHub's
// CDN) rather than hitting the GitHub API — it's faster and avoids
// burning API rate limit on every tool load.
//
// Mutations live in `mutate.js` (to be added) and go through the
// GitHub API. This module is read-only.

import { CONFIG } from './config.js';

const DB_BASE = `${CONFIG.site.base}/${CONFIG.paths.database}`;

async function getJson(path, fallback) {
  try {
    // Cache-bust — admin tools expect the latest committed state
    const r = await fetch(`${path}?t=${Date.now()}`);
    if (!r.ok) return fallback;
    return r.json();
  } catch {
    return fallback;
  }
}

export function fetchManifest() {
  return getJson(`${DB_BASE}/manifest.json`, null);
}

export function fetchTaxonomies() {
  return getJson(`${DB_BASE}/taxonomies.json`, {
    categories: { count: 0, items: {} },
    tags: { count: 0, items: {} },
  });
}

export function fetchAuthors() {
  return getJson(`${DB_BASE}/authors.json`, { count: 0, authors: {} });
}

export function fetchPages() {
  return getJson(`${DB_BASE}/pages.json`, { pages: [] });
}

export function fetchPostsByYear(year) {
  return getJson(`${DB_BASE}/posts/${year}.json`, {
    year, count: 0, posts: [],
  });
}

export async function fetchAllPosts() {
  const manifest = await fetchManifest();
  if (!manifest?.shards?.posts) return [];
  const years = Object.keys(manifest.shards.posts).sort((a, b) => b - a);
  const all = [];
  for (const year of years) {
    const shard = await fetchPostsByYear(year);
    if (shard.posts) all.push(...shard.posts);
  }
  return all;
}

// Convenience: all the DB bundles in one call for tools that want
// the full picture up front.
export async function fetchEverything() {
  const [manifest, taxonomies, authors, pages] = await Promise.all([
    fetchManifest(), fetchTaxonomies(), fetchAuthors(), fetchPages(),
  ]);
  return { manifest, taxonomies, authors, pages };
}
