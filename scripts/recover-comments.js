#!/usr/bin/env node
// Recover comment threads that the first M4 post regeneration (9b39a965)
// dropped: the WordPress export hard-coded them into each post's HTML,
// but the JSON backfill captured only the article body. The last commit
// that still has them is 582b036dd3. This reads those files from git and
// stores the threads verbatim on each post's JSON entry as `comments`.
//
//   node scripts/recover-comments.js            # dry run (counts)
//   node scripts/recover-comments.js --apply    # write shards
//
// Comment shape: { id, author, author_url, avatar, date, depth, parent, html }

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { REPO_ROOT, cleanUrl, unescapeEntities } from './lib/shell.js';

const SOURCE_COMMIT = '582b036dd3';
const APPLY = process.argv.includes('--apply');

const files = execFileSync('git', ['grep', '-l', '-e', 'class="comment-body"', SOURCE_COMMIT, '--', '20*/index.html'], { cwd: REPO_ROOT, maxBuffer: 1 << 26 })
  .toString().trim().split('\n').filter(Boolean).map((l) => l.slice(SOURCE_COMMIT.length + 1));

const text = (html) => unescapeEntities(String(html || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim();

function parseComments(html) {
  const sec = /<section id="comments">([\s\S]*?)<\/section>/.exec(html);
  if (!sec) return [];
  const out = [];
  const re = /<li class="comment[^"]*?depth-(\d+)[^"]*" id="comment-(\d+)"[^>]*>([\s\S]*?)(?=<li class="comment|<\/ol>|<\/section>)/g;
  const stack = []; // depth -> id
  let m;
  while ((m = re.exec(sec[1]))) {
    const depth = parseInt(m[1], 10), id = m[2], chunk = m[3];
    const author = /<span class="author-name[^"]*"[^>]*>([\s\S]*?)<\/span>/.exec(chunk);
    const authorUrl = /<span class="author-name[^"]*"[^>]*>\s*<a href="([^"]+)"/.exec(chunk);
    const avatar = /<img[^>]+class="avatar[^"]*"[^>]*src="([^"]+)"|<img[^>]+src="([^"]+)"[^>]*class="avatar/.exec(chunk);
    const date = /<time datetime="([^"]+)"/.exec(chunk);
    const body = /<div class="comment-body"[^>]*>([\s\S]*?)<\/div>\s*<footer>/.exec(chunk) || /<div class="comment-body"[^>]*>([\s\S]*?)<\/div>/.exec(chunk);
    stack.length = depth - 1;
    const parent = depth > 1 ? stack[depth - 2] || null : null;
    stack[depth - 1] = id;
    out.push({
      id, author: author ? text(author[1]) : 'Anonymous', author_url: authorUrl ? authorUrl[1] : '',
      avatar: avatar ? (avatar[1] || avatar[2]).replace(/&amp;/g, '&') : '',
      date: date ? date[1] : '', depth, parent,
      html: body ? body[1].replace(/^\s+|\s+$/g, '').replace(/\n\t+/g, '\n') : '',
    });
  }
  return out;
}

const byUrl = new Map();
let total = 0;
for (const f of files) {
  const html = execFileSync('git', ['show', `${SOURCE_COMMIT}:${f}`], { cwd: REPO_ROOT, maxBuffer: 1 << 26 }).toString();
  const comments = parseComments(html);
  if (!comments.length) continue;
  byUrl.set('/' + f.replace(/index\.html$/, ''), comments);
  total += comments.length;
}
console.log(`parsed ${total} comments on ${byUrl.size} posts (from ${files.length} files at ${SOURCE_COMMIT})`);
const sample = [...byUrl.entries()][100];
console.log('sample:', sample[0], JSON.stringify(sample[1][0]).slice(0, 300));

// write into shards
const dir = path.join(REPO_ROOT, 'database', 'posts');
let matched = 0, written = 0;
for (const f of fs.readdirSync(dir).filter((n) => /^\d{4}\.json$/.test(n))) {
  const p = path.join(dir, f);
  const shard = JSON.parse(fs.readFileSync(p, 'utf8'));
  let changed = false;
  for (const post of shard.posts || []) {
    const c = byUrl.get(cleanUrl(post.url));
    if (!c) continue;
    matched++;
    if (JSON.stringify(post.comments) !== JSON.stringify(c)) { post.comments = c; changed = true; }
  }
  if (changed) { written++; if (APPLY) fs.writeFileSync(p, JSON.stringify(shard, null, 2) + '\n'); }
}
console.log(`${matched} of ${byUrl.size} posts matched a JSON entry; ${written} shard(s) ${APPLY ? 'written' : 'would change'}`);
const unmatched = [...byUrl.keys()].filter((u) => !fs.existsSync(path.join(REPO_ROOT, u.slice(1), 'index.html')));
if (unmatched.length) console.log(`unmatched (no page today): ${unmatched.length}`, unmatched.slice(0, 5));
if (!APPLY) console.log('Run again with --apply to write.');
