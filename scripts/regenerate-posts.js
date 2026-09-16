#!/usr/bin/env node
// Render every post from templates/post.html + database/posts/YYYY.json
// (Decision 013/014). JSON is the source of truth; the HTML file and its
// Markdown twin (index.md) are derived artifacts.
//
// Usage:
//   node scripts/regenerate-posts.js                          # dry run (counts)
//   node scripts/regenerate-posts.js --apply                  # write to disk
//   node scripts/regenerate-posts.js --year=2026 --apply
//   node scripts/regenerate-posts.js --url=/2026/03/26/foo/ --diff   # single post + line diff
//   node scripts/regenerate-posts.js --apply --no-md          # skip Markdown twins
//
// Shell partials (templates/partials/{nav,rail,footer}.html) are composed
// at render time. The rail (recent, topics, years) and the prev/next +
// related lists need every post, so all shards are loaded up front.
// Skips posts without a `content` field (run backfill-posts-content.js).

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, SITE, DEFAULT_IMAGE, cleanUrl, escapeHtml, escapeAttr, describe, dates, signalTerms,
  wordCount, readingMinutes, firstImage, loadAllPosts, loadTombstones, loadTaxonomies, neighbors, related,
  nav, rail, footer, fill, jsonLdPost, markdownTwin, headCommon, selfHostImages, renderPostPage, renderBlueskyThread,
} from './lib/shell.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DIFF = args.includes('--diff');
const NO_MD = args.includes('--no-md');
const NO_BSKY = args.includes('--no-bluesky');
const ONLY_YEAR = (args.find((a) => a.startsWith('--year=')) || '').slice(7) || null;
const ONLY_URL = (args.find((a) => a.startsWith('--url=')) || '').slice(6) || null;

const TEMPLATE = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'post.html'), 'utf8');
const ALL = loadAllPosts();
const TAX = loadTaxonomies();
const NAV = nav({ active: '' });
const RAIL = rail(ALL, TAX);
const FOOTER = footer();

// Bluesky reply threads for cross-posted posts, fetched once per run (public API, no auth)
const THREADS = new Map();
async function prefetchBluesky() {
  const posts = ALL.filter((p) => p.bluesky?.uri && (!ONLY_YEAR || dates(p).year === ONLY_YEAR) && (!ONLY_URL || p.url === cleanUrl(ONLY_URL)));
  for (const p of posts) {
    try {
      const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(p.bluesky.uri)}&depth=6&parentHeight=0`);
      if (res.ok) THREADS.set(p.url, (await res.json()).thread);
    } catch { /* offline: render without replies */ }
  }
  if (posts.length) console.log(`bluesky: fetched ${THREADS.size}/${posts.length} thread(s)`);
}

function renderPost(post, index) {
  const { prev, next } = neighbors(ALL, index);
  const bluesky = THREADS.has(post.url) ? renderBlueskyThread(THREADS.get(post.url), post.url) : (post.bluesky?.uri && post.bluesky?.url ? `<section class="comments bluesky" id="conversation"><h2>Join the conversation on Bluesky <small><a href="${escapeAttr(post.bluesky.url)}" rel="nofollow">Reply to this post on Bluesky</a></small></h2></section>` : '');
  const html = renderPostPage(TEMPLATE, post, { prev, next, related: related(ALL, index, 4), shell: { nav: NAV, rail: RAIL, footer: FOOTER, head_common: headCommon(), bluesky } });
  const absUrl = SITE + post.url;
  return { html, md: NO_MD ? null : markdownTwin({ ...post, content: selfHostImages(post.content) }, absUrl) };
}

function outPaths(url) {
  const dir = path.join(REPO_ROOT, url.replace(/^\//, ''));
  return { html: path.join(dir, 'index.html'), md: path.join(dir, 'index.md') };
}

function lineDiff(a, b) {
  const al = a.split('\n'), bl = b.split('\n');
  const out = []; let same = 0;
  for (let i = 0; i < Math.max(al.length, bl.length); i++) {
    if (al[i] === bl[i]) { same++; continue; }
    out.push(`@ line ${i + 1}`);
    if (al[i] !== undefined) out.push(`  - ${al[i].length > 140 ? al[i].slice(0, 140) + '…' : al[i]}`);
    if (bl[i] !== undefined) out.push(`  + ${bl[i].length > 140 ? bl[i].slice(0, 140) + '…' : bl[i]}`);
    if (out.length > 40) { out.push('  (diff truncated)'); break; }
  }
  return out.length ? out.join('\n') : `  identical (${same} lines)`;
}

async function main() {
  if (!NO_BSKY) await prefetchBluesky();
  const years = ONLY_YEAR ? [ONLY_YEAR] : [...new Set(ALL.map((p) => dates(p).year).filter(Boolean))].sort();
  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}${DIFF ? ' [DIFF]' : ''} — regenerate posts from template + JSON (${ALL.length} posts loaded)`);
  console.log(`${'year'.padEnd(6)} ${'total'.padStart(6)} ${'rendered'.padStart(9)} ${'noContent'.padStart(10)} ${'written'.padStart(8)} ${'unchanged'.padStart(10)} ${'err'.padStart(5)}`);
  console.log('─'.repeat(60));
  const t = { total: 0, rendered: 0, noContent: 0, written: 0, unchanged: 0, err: 0 };
  for (const year of years) {
    const s = { total: 0, rendered: 0, noContent: 0, written: 0, unchanged: 0, err: 0 };
    ALL.forEach((post, index) => {
      if (dates(post).year !== year) return;
      s.total++;
      if (post.content == null) { s.noContent++; return; } // '' is a real (title-only) post
      if (ONLY_URL && post.url !== cleanUrl(ONLY_URL)) return;
      try {
        const { html, md } = renderPost(post, index);
        s.rendered++;
        const out = outPaths(post.url);
        const prior = fs.existsSync(out.html) ? fs.readFileSync(out.html, 'utf8') : null;
        const priorMd = md !== null && fs.existsSync(out.md) ? fs.readFileSync(out.md, 'utf8') : null;
        if (prior === html && (md === null || priorMd === md)) { s.unchanged++; return; }
        if (DIFF && prior !== null) { console.log(`\n== ${post.url} ==`); console.log(lineDiff(prior, html)); }
        if (APPLY) {
          fs.mkdirSync(path.dirname(out.html), { recursive: true });
          if (prior !== html) fs.writeFileSync(out.html, html);
          if (md !== null && priorMd !== md) fs.writeFileSync(out.md, md);
          s.written++;
        }
      } catch (err) { console.error(`  ERROR: ${post.url}: ${err.message}`); s.err++; }
    });
    console.log(`${year.padEnd(6)} ${String(s.total).padStart(6)} ${String(s.rendered).padStart(9)} ${String(s.noContent).padStart(10)} ${String(s.written).padStart(8)} ${String(s.unchanged).padStart(10)} ${String(s.err).padStart(5)}`);
    for (const k of Object.keys(t)) t[k] += s[k];
  }
  // Hidden posts (removed / draft / scheduled): a URL that ever shipped keeps
  // resolving as a redirect to the year archive; an unpublished URL gets no file.
  const T_REDIRECT = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'redirect.html'), 'utf8');
  const protectedUrls = new Set((JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'database', 'permalinks.json'), 'utf8')).urls) || []);
  let tomb = 0, unpublished = 0;
  for (const p of loadTombstones()) {
    if (!protectedUrls.has(p.url)) { unpublished++; continue; }
    if (ONLY_YEAR && dates(p).year !== ONLY_YEAR) continue;
    if (ONLY_URL && p.url !== cleanUrl(ONLY_URL)) continue;
    const target = dates(p).year ? `/${dates(p).year}/` : '/';
    const html = fill(T_REDIRECT, { title: escapeHtml(p.title || 'Removed'), target, target_abs: SITE + target, target_json: JSON.stringify(target), target_text: escapeHtml(target) });
    const out = outPaths(p.url);
    const prior = fs.existsSync(out.html) ? fs.readFileSync(out.html, 'utf8') : null;
    if (prior !== html) { tomb++; if (APPLY) { fs.mkdirSync(path.dirname(out.html), { recursive: true }); fs.writeFileSync(out.html, html); } }
    if (APPLY && fs.existsSync(out.md)) fs.unlinkSync(out.md);
  }
  if (tomb) console.log(`hidden (removed/draft/scheduled): ${tomb} redirect page(s) ${APPLY ? 'written' : 'would be written'}`);
  if (unpublished) console.log(`unpublished (draft/scheduled, never shipped): ${unpublished} — no file`);
  console.log('─'.repeat(60));
  console.log(`TOTAL  ${String(t.total).padStart(6)} ${String(t.rendered).padStart(9)} ${String(t.noContent).padStart(10)} ${String(t.written).padStart(8)} ${String(t.unchanged).padStart(10)} ${String(t.err).padStart(5)}`);
  if (!APPLY) console.log('\nRun again with --apply to write files.');
  if (t.err) process.exitCode = 1;
}

await main();
