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
  nav, rail, footer, fill, jsonLdPost, markdownTwin, headCommon,
} from './lib/shell.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DIFF = args.includes('--diff');
const NO_MD = args.includes('--no-md');
const ONLY_YEAR = (args.find((a) => a.startsWith('--year=')) || '').slice(7) || null;
const ONLY_URL = (args.find((a) => a.startsWith('--url=')) || '').slice(6) || null;

const TEMPLATE = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'post.html'), 'utf8');
const ALL = loadAllPosts();
const TAX = loadTaxonomies();
const NAV = nav({ active: '' });
const RAIL = rail(ALL, TAX);
const FOOTER = footer();

function termLinks(list, cls) {
  return list.map((t) => `<a class="${cls}" href="${escapeAttr(t.url)}">${escapeHtml(t.name)}</a>`).join('');
}
function listItem(p) {
  const d = dates(p);
  return `<li><time datetime="${d.dateOnly}">${d.dateOnly}</time><div><a class="t" href="${escapeAttr(p.url)}">${escapeHtml(p.title || 'Untitled')}</a><span class="d">${escapeHtml(describe(p, 150))}</span></div></li>`;
}

function renderPost(post, index) {
  const url = post.url;
  const absUrl = SITE + url;
  const d = dates(post);
  const cats = signalTerms(post, 'categories');
  const tags = signalTerms(post, 'tags');
  const description = describe(post);
  const { prev, next } = neighbors(ALL, index);
  const rel = related(ALL, index, 4);
  const slug = url.replace(/\/$/, '').split('/').pop() || 'post';

  const values = {
    title: escapeHtml(post.title || 'Untitled'),
    description: escapeAttr(description),
    abs_url: absUrl,
    og_image: escapeAttr(firstImage(post.content) || DEFAULT_IMAGE),
    date_iso: d.iso,
    date_formatted: d.formatted,
    json_ld: jsonLdPost(post, absUrl, d, description),
    body_classes: [...cats.map((c) => `category-${c.slug}`), ...tags.map((t) => `tag-${t.slug}`)].join(' '),
    post_id: slug,
    categories: termLinks(cats, 'card-tag'),
    word_count: String(wordCount(post.content)),
    reading_time: String(readingMinutes(post.content)),
    tags: termLinks(tags, 'tag'),
    prev_link: prev ? `<a href="${escapeAttr(prev.url)}" class="prev" rel="prev"><small>← Previous</small><strong>${escapeHtml(prev.title || 'Untitled')}</strong></a>` : '<span></span>',
    next_link: next ? `<a href="${escapeAttr(next.url)}" class="next" rel="next"><small>Next →</small><strong>${escapeHtml(next.title || 'Untitled')}</strong></a>` : '<span></span>',
    related: rel.length ? `<section class="related"><h2>Related</h2><ul class="post-list">${rel.map(listItem).join('')}</ul></section>` : '',
    nav: NAV, rail: RAIL, footer: FOOTER, head_common: headCommon(),
  };
  // content last: a body that happens to contain "{{...}}" must never be expanded
  const html = fill(TEMPLATE, values).split('{{content}}').join(post.content || '');
  return { html, md: NO_MD ? null : markdownTwin(post, absUrl) };
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

function main() {
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
      if (!post.content) { s.noContent++; return; }
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
  // Tombstones: the permalink keeps resolving as a redirect to the year archive
  const T_REDIRECT = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'redirect.html'), 'utf8');
  let tomb = 0;
  for (const p of loadTombstones()) {
    if (ONLY_YEAR && dates(p).year !== ONLY_YEAR) continue;
    if (ONLY_URL && p.url !== cleanUrl(ONLY_URL)) continue;
    const target = dates(p).year ? `/${dates(p).year}/` : '/';
    const html = fill(T_REDIRECT, { title: escapeHtml(p.title || 'Removed'), target, target_abs: SITE + target, target_json: JSON.stringify(target), target_text: escapeHtml(target) });
    const out = outPaths(p.url);
    const prior = fs.existsSync(out.html) ? fs.readFileSync(out.html, 'utf8') : null;
    if (prior !== html) { tomb++; if (APPLY) { fs.mkdirSync(path.dirname(out.html), { recursive: true }); fs.writeFileSync(out.html, html); } }
    if (APPLY && fs.existsSync(out.md)) fs.unlinkSync(out.md);
  }
  if (tomb) console.log(`tombstones: ${tomb} redirect page(s) ${APPLY ? 'written' : 'would be written'}`);
  console.log('─'.repeat(60));
  console.log(`TOTAL  ${String(t.total).padStart(6)} ${String(t.rendered).padStart(9)} ${String(t.noContent).padStart(10)} ${String(t.written).padStart(8)} ${String(t.unchanged).padStart(10)} ${String(t.err).padStart(5)}`);
  if (!APPLY) console.log('\nRun again with --apply to write files.');
  if (t.err) process.exitCode = 1;
}

main();
