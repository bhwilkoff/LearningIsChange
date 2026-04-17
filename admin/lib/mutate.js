// Null-safe mutators for the JSON database.
//
// Every mutator is a pure function — takes the current state + a
// delta, returns the new state. Callers decide when/how to persist.
// Preserves unknown keys so mutators don't clobber fields written by
// other tools or added in the future.
//
// Historical note: `posts/YYYY.json` has both `count` and `post_count`
// in existing data (drift from multiple tools). Write both; read
// whichever is present, preferring `count` (matches `manifest.json`'s
// `shards.posts.<year>.count` contract).

const toArray = (v) => (Array.isArray(v) ? v : []);

function stripOrigin(url) {
  if (!url) return '';
  return String(url)
    .replace(/^https?:\/\/[^/]+/, '')
    .replace(/^\/?/, '/');
}

// -------- Posts shard (posts/YYYY.json) --------

// Insert or update a post in the per-year shard. Dedup by URL.
// `post` fields — title, url, date_published, excerpt, categories,
// tags, content_preview. Extra keys preserved.
export function upsertPost(shard, post) {
  const s = shard || { posts: [] };
  const posts = toArray(s.posts);
  const url = stripOrigin(post.url);
  const idx = posts.findIndex(p => stripOrigin(p?.url) === url);
  const entry = {
    ...(idx >= 0 ? posts[idx] : {}),
    title: post.title || 'Untitled',
    url,
    date_published: post.date_published || post.date || '',
    excerpt: post.excerpt || '',
    categories: toArray(post.categories).map(c => c && c.slug ? c.slug : String(c || '')).filter(Boolean),
    tags: toArray(post.tags).map(t => t && t.slug ? t.slug : String(t || '')).filter(Boolean),
    content_preview: post.content_preview ?? post.excerpt ?? '',
  };
  const next = idx >= 0
    ? [...posts.slice(0, idx), entry, ...posts.slice(idx + 1)]
    : [entry, ...posts];
  return {
    ...s,
    year: s.year || parseInt((post.date_published || '').slice(0, 4), 10) || undefined,
    posts: next,
    count: next.length,
    post_count: next.length,
  };
}

export function removePost(shard, url) {
  const s = shard || { posts: [] };
  const posts = toArray(s.posts);
  const target = stripOrigin(url);
  const next = posts.filter(p => stripOrigin(p?.url) !== target);
  return { ...s, posts: next, count: next.length, post_count: next.length };
}

// -------- Pages (pages.json) --------
// pages.json stores full rendered HTML in each entry's `content`.

export function upsertPage(pagesFile, page) {
  const file = pagesFile || { pages: [] };
  const pages = toArray(file.pages);
  const idFields = [page.id, page.wp_post_id].filter(Boolean);
  const idx = pages.findIndex(p => {
    if (p.id && page.id && p.id === page.id) return true;
    if (p.wp_post_id && page.wp_post_id && p.wp_post_id === page.wp_post_id) return true;
    if (p.url && page.url && stripOrigin(p.url) === stripOrigin(page.url)) return true;
    return false;
  });
  const merged = {
    ...(idx >= 0 ? pages[idx] : {}),
    ...page,
    url: stripOrigin(page.url || (idx >= 0 ? pages[idx].url : '')),
    date_modified: page.date_modified || new Date().toISOString(),
  };
  const next = idx >= 0
    ? [...pages.slice(0, idx), merged, ...pages.slice(idx + 1)]
    : [...pages, merged];
  return { ...file, pages: next, count: next.length };
}

export function removePage(pagesFile, urlOrId) {
  const file = pagesFile || { pages: [] };
  const pages = toArray(file.pages);
  const target = stripOrigin(urlOrId);
  const next = pages.filter(p =>
    stripOrigin(p.url) !== target && p.id !== urlOrId && p.wp_post_id !== urlOrId);
  return { ...file, pages: next, count: next.length };
}

// -------- Taxonomies (taxonomies.json) --------

function ensureTaxonomyBucket(taxonomies) {
  const t = taxonomies || {};
  return {
    ...t,
    categories: { count: 0, items: {}, ...(t.categories || {}) },
    tags: { count: 0, items: {}, ...(t.tags || {}) },
  };
}

function adjustTaxonomyCount(bucket, key, delta, factory) {
  const items = { ...(bucket.items || {}) };
  const existing = items[key] || factory();
  const nextCount = Math.max(0, (existing.count || 0) + delta);
  items[key] = { ...existing, count: nextCount };
  return { ...bucket, items, count: Object.values(items).reduce((s, v) => s + (v.count || 0), 0) };
}

// Increment category + tag counts for a post being added.
// `categories` and `tags` are arrays of either strings (slugs) or
// { name, slug, parent?, parentName? } objects. Unknown items are
// created on the fly.
export function incrementTaxonomies(taxonomies, { categories = [], tags = [] } = {}) {
  let t = ensureTaxonomyBucket(taxonomies);
  for (const c of toArray(categories)) {
    const slug = typeof c === 'string' ? c : c.slug;
    if (!slug) continue;
    t = {
      ...t,
      categories: adjustTaxonomyCount(t.categories, slug, +1, () => ({
        name: typeof c === 'string' ? c : (c.name || slug),
        slug,
        count: 0,
        parent: (typeof c === 'object' && c.parent) ? c.parent : null,
      })),
    };
  }
  for (const tag of toArray(tags)) {
    const slug = typeof tag === 'string' ? tag : tag.slug;
    if (!slug) continue;
    t = {
      ...t,
      tags: adjustTaxonomyCount(t.tags, slug, +1, () => ({
        name: typeof tag === 'string' ? tag : (tag.name || slug),
        slug,
        count: 0,
      })),
    };
  }
  return t;
}

export function decrementTaxonomies(taxonomies, { categories = [], tags = [] } = {}) {
  let t = ensureTaxonomyBucket(taxonomies);
  for (const c of toArray(categories)) {
    const slug = typeof c === 'string' ? c : c.slug;
    if (!slug || !t.categories.items[slug]) continue;
    t = { ...t, categories: adjustTaxonomyCount(t.categories, slug, -1, () => t.categories.items[slug]) };
  }
  for (const tag of toArray(tags)) {
    const slug = typeof tag === 'string' ? tag : tag.slug;
    if (!slug || !t.tags.items[slug]) continue;
    t = { ...t, tags: adjustTaxonomyCount(t.tags, slug, -1, () => t.tags.items[slug]) };
  }
  return t;
}

// -------- Changelog (changelog.json) --------

export function appendChangelog(changelog, entry) {
  const c = changelog || { entries: [] };
  const entries = toArray(c.entries);
  const stamped = {
    timestamp: new Date().toISOString(),
    ...entry,
  };
  return { ...c, entries: [stamped, ...entries].slice(0, 1000) };
}

// -------- Manifest shard bookkeeping --------
// When posts/YYYY.json changes, manifest.shards.posts[year].count
// should follow. Hash updating is expensive (content-address); we set
// to `null` and let database-generator refresh it in a scheduled run.

export function updateManifestShardCount(manifest, year, count) {
  const m = manifest || { shards: { posts: {} } };
  const shards = { ...(m.shards || {}) };
  const posts = { ...(shards.posts || {}) };
  posts[String(year)] = {
    ...(posts[String(year)] || {}),
    count,
    hash: null, // invalidated; regenerate offline
  };
  return { ...m, shards: { ...shards, posts } };
}
