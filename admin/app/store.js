// Content store for LiC Admin (Decision 015, A2). Reads the JSON source of
// truth from the live site (fast, cached with ETag) and writes back
// through the Git Data API (one commit per save). The renderers do the rest.
import { CONFIG } from '/admin/lib/config.js';
import { isLive } from '/admin/lib/database.js';
import { taxonomyTerm } from '/admin/lib/mutate.js';

const BASE = `${CONFIG.site.base}/database`;
const cache = new Map(); // path -> { etag, data }

async function getJson(rel, { fresh = false } = {}) {
  const hit = cache.get(rel);
  const res = await fetch(`${BASE}/${rel}${fresh ? `?t=${Date.now()}` : ''}`, { headers: hit?.etag && !fresh ? { 'If-None-Match': hit.etag } : {} });
  if (res.status === 304 && hit) return hit.data;
  if (!res.ok) throw new Error(`${rel}: HTTP ${res.status}`);
  const data = await res.json();
  cache.set(rel, { etag: res.headers.get('ETag'), data });
  return data;
}

export const store = {
  async manifest() { return getJson('manifest.json'); },
  async taxonomies() { const t = await getJson('taxonomies.json'); return { categories: t.categories?.items || {}, tags: t.tags?.items || {} }; },
  async years() { const m = await this.manifest(); return Object.keys(m.shards?.posts || {}).sort().reverse(); },
  async shard(year, opts) { return getJson(`posts/${year}.json`, opts); },
  async pages() { const raw = await getJson('pages.json'); return Array.isArray(raw) ? raw : raw.pages || []; },

  // All posts, newest first, with { year, index } so a record can be written back.
  async posts({ includeRemoved = false } = {}) {
    const years = await this.years();
    const shards = await Promise.all(years.map((y) => this.shard(y).then((s) => [y, s])));
    const out = [];
    for (const [y, s] of shards) {
      (s.posts || []).forEach((p, index) => { if (includeRemoved || isLive(p)) out.push({ ...p, _year: y, _index: index }); });
    }
    out.sort((a, b) => String(b.date_published).localeCompare(String(a.date_published)));
    return out;
  },
  async post(url) {
    const y = /^\/(\d{4})\//.exec(url)?.[1]; if (!y) return null;
    const s = await this.shard(y, { fresh: true });
    const index = (s.posts || []).findIndex((p) => p.url === url);
    return index < 0 ? null : { ...s.posts[index], _year: y, _index: index };
  },

  // Write one post record back into its shard and commit. `api` is a GitHubAPI.
  // Returns the commit sha. Terms are normalized to { name, slug, url }.
  async savePost(api, record, message) {
    const y = record._year || /^\/(\d{4})\//.exec(record.url)?.[1];
    const path = `database/posts/${y}.json`;
    const s = await this.shard(y, { fresh: true });
    const clean = { ...record }; delete clean._year; delete clean._index;
    clean.categories = (clean.categories || []).map((t) => taxonomyTerm(t, 'category')).filter(Boolean);
    clean.tags = (clean.tags || []).map((t) => taxonomyTerm(t, 'tag')).filter(Boolean);
    clean.date_modified = new Date().toISOString();
    const i = (s.posts || []).findIndex((p) => p.url === clean.url);
    if (i >= 0) s.posts[i] = { ...s.posts[i], ...clean }; else s.posts.unshift(clean);
    s.count = s.post_count = s.posts.length; s.year = s.year || Number(y);
    const result = await api.commitFiles([{ path, content: JSON.stringify(s, null, 2) + '\n' }], message || `Edit: ${clean.title}`);
    cache.delete(`posts/${y}.json`);
    return result;
  },
  async savePage(api, record, message) {
    const raw = await getJson('pages.json', { fresh: true });
    const list = Array.isArray(raw) ? raw : raw.pages;
    const i = list.findIndex((p) => String(p.url).replace(/^https?:\/\/[^/]+/, '') === String(record.url).replace(/^https?:\/\/[^/]+/, ''));
    if (i < 0) throw new Error('page not found');
    list[i] = { ...list[i], ...record, date_modified: new Date().toISOString() };
    const result = await api.commitFiles([{ path: 'database/pages.json', content: JSON.stringify(raw, null, 2) + '\n' }], message || `Edit page: ${record.title}`);
    cache.delete('pages.json');
    return result;
  },
  invalidate() { cache.clear(); },
};
