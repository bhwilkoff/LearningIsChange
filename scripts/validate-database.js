#!/usr/bin/env node
// Validate database/ against database/schema.json (Decision 015, A0).
// Zero dependencies. Exit 1 on any error; warnings do not fail.
//
//   node scripts/validate-database.js            # full report
//   node scripts/validate-database.js --quiet    # summary line only

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const QUIET = process.argv.includes('--quiet');
const errors = [], warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s);
const isDateTime = (s) => /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2})?(\.\d+)?(Z|[+-]\d{2}:?\d{2})?$/.test(s);
const isPath = (s) => typeof s === 'string' && /^\/(?:[^/\s]+\/)*$/.test(s);
const isSlug = (s) => /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(s);

function checkScalar(kind, v) {
  for (const k of String(kind).split('|')) {
    if (k === 'null' && v === null) return true;
    if (k === 'string' && typeof v === 'string') return true;
    if (k === 'integer' && Number.isInteger(v)) return true;
    if (k === 'boolean' && typeof v === 'boolean') return true;
    if (k === 'object' && v && typeof v === 'object' && !Array.isArray(v)) return true;
    if (k === 'array' && Array.isArray(v)) return true;
    if (k === 'date' && typeof v === 'string' && isDate(v)) return true;
    if (k === 'datetime' && typeof v === 'string' && isDateTime(v)) return true;
    if (k === 'path' && isPath(v)) return true;
    if (k === 'slug' && typeof v === 'string') return true; // strictness handled as a warning
    if (k.startsWith('enum:') && k.slice(5).split(',').includes(v)) return true;
  }
  return false;
}

function checkTerm(t, where) {
  if (!t || typeof t !== 'object') return err(`${where}: term is not an object`);
  if (typeof t.name !== 'string' || !t.name) err(`${where}: term.name missing`);
  if (typeof t.slug !== 'string' || !t.slug) err(`${where}: term.slug missing`);
  else if (!isSlug(t.slug)) warn(`${where}: non-canonical slug "${t.slug}"`);
  if (!isPath(t.url) || !/^\/(category|tag)\//.test(t.url)) err(`${where}: term.url "${t.url}" is not a local /category/ or /tag/ path`);
}
function checkComment(c, where) {
  for (const [k, kind] of [['id', 'string'], ['author', 'string'], ['date', 'datetime|null'], ['depth', 'integer'], ['html', 'string']]) {
    if (!checkScalar(kind, c?.[k])) err(`${where}: comment.${k} invalid`);
  }
}

// ---- posts ----
const postsDir = path.join(REPO_ROOT, 'database', 'posts');
const seenUrls = new Map();
let posts = 0, tombstones = 0, drafts = 0;
for (const f of fs.readdirSync(postsDir).filter((n) => /^\d{4}\.json$/.test(n)).sort()) {
  const year = f.slice(0, 4);
  let shard;
  try { shard = JSON.parse(fs.readFileSync(path.join(postsDir, f), 'utf8')); } catch (e) { err(`${f}: invalid JSON (${e.message})`); continue; }
  if (!Array.isArray(shard.posts)) { err(`${f}: missing posts[]`); continue; }
  if (shard.count !== undefined && shard.count !== shard.posts.length) warn(`${f}: count ${shard.count} ≠ posts.length ${shard.posts.length}`);
  shard.posts.forEach((p, i) => {
    const where = `${f}#${i} ${p?.url || ''}`;
    posts++;
    if (!p || typeof p !== 'object') return err(`${where}: not an object`);
    for (const [k, kind] of [['title', 'string'], ['url', 'path'], ['date_published', 'date|datetime'], ['content', 'string']]) {
      if (!checkScalar(kind, p[k])) err(`${where}: ${k} invalid (${JSON.stringify(p[k]).slice(0, 40)})`);
    }
    for (const k of ['categories', 'tags']) {
      if (!Array.isArray(p[k])) err(`${where}: ${k} is not an array`);
      else p[k].forEach((t, j) => checkTerm(t, `${where} ${k}[${j}]`));
    }
    if (p.status !== undefined && !checkScalar('enum:publish,draft', p.status)) err(`${where}: status "${p.status}"`);
    if (p.status === 'draft') drafts++;
    if (p.removed !== undefined && typeof p.removed !== 'boolean') err(`${where}: removed must be boolean`);
    if (p.removed) tombstones++;
    if (p.comments !== undefined) { if (!Array.isArray(p.comments)) err(`${where}: comments not an array`); else p.comments.forEach((c, j) => checkComment(c, `${where} comments[${j}]`)); }
    if (p.bluesky !== undefined && (!p.bluesky || typeof p.bluesky !== 'object')) err(`${where}: bluesky must be an object`);
    if (p.podcast !== undefined) {
      if (!p.podcast || typeof p.podcast !== 'object') err(`${where}: podcast must be an object`);
      else if (!isPath(String(p.podcast.audio || '').replace(/[^/]*$/, '')) ) err(`${where}: podcast.audio "${p.podcast.audio}" is not a site-relative path`);
    }
    if (typeof p.url === 'string') {
      const m = /^\/(\d{4})\/(\d{2})\/(\d{2})\/[^/]+\/$/.exec(p.url);
      if (!m) err(`${where}: url is not /YYYY/MM/DD/slug/`);
      else {
        if (m[1] !== year) err(`${where}: url year ${m[1]} but stored in ${f}`);
        const d = String(p.date_published).slice(0, 10);
        if (d !== `${m[1]}-${m[2]}-${m[3]}`) warn(`${where}: date_published ${d} ≠ url date`);
      }
      if (seenUrls.has(p.url)) err(`${where}: duplicate url (also in ${seenUrls.get(p.url)})`);
      seenUrls.set(p.url, f);
    }
  });
}

// ---- pages ----
try {
  const raw = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'database', 'pages.json'), 'utf8'));
  const pages = Array.isArray(raw) ? raw : raw.pages || [];
  const seen = new Set();
  pages.forEach((p, i) => {
    const where = `pages.json#${i} ${p?.url || ''}`;
    const url = typeof p?.url === 'string' ? p.url.replace(/^https?:\/\/[^/]+/, '') : '';
    if (typeof p?.title !== 'string') err(`${where}: title invalid`);
    if (typeof p?.content !== 'string') err(`${where}: content invalid`);
    if (!isPath(url)) err(`${where}: url invalid`);
    if (seen.has(url)) err(`${where}: duplicate url`); seen.add(url);
    if (p?.status !== undefined && !checkScalar('enum:publish,draft', p.status)) err(`${where}: status "${p.status}"`);
  });
  var pageCount = pages.length;
} catch (e) { err(`pages.json: ${e.message}`); }

// ---- taxonomies ----
try {
  const t = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'database', 'taxonomies.json'), 'utf8'));
  for (const kind of ['categories', 'tags']) {
    const items = t?.[kind]?.items;
    if (!items || typeof items !== 'object') { err(`taxonomies.json: ${kind}.items missing`); continue; }
    for (const [slug, term] of Object.entries(items)) {
      checkTerm(term, `taxonomies.json ${kind}.${slug}`);
      if (term && term.slug !== slug) warn(`taxonomies.json ${kind}.${slug}: key ≠ slug "${term.slug}"`);
      if (term && !term.url?.startsWith(kind === 'categories' ? '/category/' : '/tag/')) err(`taxonomies.json ${kind}.${slug}: url ${term.url} under the wrong prefix`);
    }
  }
} catch (e) { err(`taxonomies.json: ${e.message}`); }

// ---- page rules ----
try {
  const r = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'database', 'page-rules.json'), 'utf8'));
  for (const [from, to] of Object.entries(r.redirects || {})) if (!isPath(from) || !(isPath(to) || /^https?:\/\//.test(to))) err(`page-rules.json: bad redirect ${from} → ${to}`);
  for (const u of r.noindex || []) if (!isPath(u)) err(`page-rules.json: bad noindex ${u}`);
} catch (e) { err(`page-rules.json: ${e.message}`); }

const summary = `${errors.length ? 'FAIL' : 'OK'} — ${posts} posts (${tombstones} tombstones, ${drafts} drafts), ${pageCount ?? '?'} pages; ${errors.length} error(s), ${warnings.length} warning(s)`;
console.log(summary);
if (!QUIET) { errors.slice(0, 50).forEach((m) => console.error('  ✗ ' + m)); warnings.slice(0, 20).forEach((m) => console.warn('  ⚠ ' + m)); if (warnings.length > 20) console.warn(`  … +${warnings.length - 20} warnings`); }
process.exit(errors.length ? 1 : 0);
