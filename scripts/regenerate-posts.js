#!/usr/bin/env node
// Render posts from templates/post.html + each post's JSON entry in
// database/posts/YYYY.json. This is the M4 regenerator: the JSON is
// the source of truth for post content, the HTML file is derived.
//
// Usage:
//   node scripts/regenerate-posts.js                          # dry run (shows which would be written)
//   node scripts/regenerate-posts.js --apply                  # write to disk
//   node scripts/regenerate-posts.js --year=2026 --apply
//   node scripts/regenerate-posts.js --url=/2026/03/26/foo/ --diff   # single post + diff
//   node scripts/regenerate-posts.js --year=2026 --diff       # show line diffs
//
// Skips posts whose `content` field is missing — run
// backfill-posts-content.js first if needed.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const TEMPLATE_PATH = path.join(REPO_ROOT, 'templates', 'post.html');
const POSTS_DIR = path.join(REPO_ROOT, 'database', 'posts');

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const DIFF = args.includes('--diff');
const URL_ARG = args.find(a => a.startsWith('--url='));
const YEAR_ARG = args.find(a => a.startsWith('--year='));
const ONLY_URL = URL_ARG ? URL_ARG.slice('--url='.length) : null;
const ONLY_YEAR = YEAR_ARG ? YEAR_ARG.slice('--year='.length) : null;

if (!fs.existsSync(TEMPLATE_PATH)) {
  console.error(`Template not found: ${TEMPLATE_PATH}`);
  console.error('Run scripts/capture-post-template.js first.');
  process.exit(1);
}
// Compose the shared theme zones from templates/fragments/ at render
// time so posts never drift from what regenerate-fragments.js applies
// to the rest of the site (the template's own copies are placeholders).
function composeFragments(html) {
  const dir = path.join(REPO_ROOT, 'templates', 'fragments');
  for (const zone of ['MASTHEAD', 'SIDEBAR', 'COLOPHON', 'FOOTER']) {
    const fragPath = path.join(dir, `${zone.toLowerCase()}.html`);
    if (!fs.existsSync(fragPath)) continue;
    const open = `<!-- LIC:${zone}:START -->`, close = `<!-- LIC:${zone}:END -->`;
    const i = html.indexOf(open), j = html.indexOf(close, i);
    if (i === -1 || j === -1) continue;
    const frag = fs.readFileSync(fragPath, 'utf8').replace(/\n$/, '');
    html = html.slice(0, i + open.length) + '\n' + frag + '\n' + html.slice(j);
  }
  return html;
}
const TEMPLATE = composeFragments(fs.readFileSync(TEMPLATE_PATH, 'utf8'));

// Plain-text description for og:description / meta description /
// JSON-LD: the excerpt if there is one, else the first ~160 chars of
// the body text. Derived at render time; the content itself is untouched.
function describe(post) {
  const src = post.excerpt || post.content || '';
  const text = String(src).replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&#0?39;|&#8217;/g, "'").replace(/&quot;|&#8220;|&#8221;/g, '"')
    .replace(/\s+/g, ' ').trim();
  if (!text) return 'My name is Ben Wilkoff, and I Teach. And Learn. A Lot.';
  if (text.length <= 160) return text;
  return text.slice(0, 157).replace(/\s+\S*$/, '') + '…';
}

function jsonLd(post, absUrl, dateIso, description) {
  const img = /<img[^>]+src=["']([^"']+)["']/i.exec(post.content || '');
  const data = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl },
    headline: post.title || 'Untitled',
    datePublished: dateIso,
    dateModified: post.date_modified || dateIso,
    author: { '@type': 'Person', name: 'Ben Wilkoff', url: 'https://learningischange.com/portfolio/about/' },
    publisher: { '@type': 'Person', name: 'Ben Wilkoff', url: 'https://learningischange.com/' },
    isPartOf: { '@type': 'Blog', '@id': 'https://learningischange.com/#blog', name: 'Learning is Change' },
    inLanguage: 'en-US',
  };
  if (description) data.description = description;
  if (img) data.image = img[1].startsWith('/') ? `https://learningischange.com${img[1]}` : img[1];
  const kw = [...(Array.isArray(post.categories) ? post.categories : []), ...(Array.isArray(post.tags) ? post.tags : [])]
    .map(t => (typeof t === 'string' ? t : t?.name || t?.slug)).filter(Boolean);
  if (kw.length) data.keywords = kw.join(', ');
  // </script> inside a value would break out of the tag
  return JSON.stringify(data).replace(/<\//g, '<\\/');
}

const TAXONOMIES = (() => {
  const p = path.join(REPO_ROOT, 'database', 'taxonomies.json');
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch { return { categories: { items: {} }, tags: { items: {} } }; }
})();

function taxonomyEntry(kind, slug) {
  return TAXONOMIES?.[kind]?.items?.[slug] || null;
}

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];

function cleanUrl(url) {
  return String(url || '').replace(/^https?:\/\/[^/]+/, '').replace(/\/?$/, '/');
}

function urlParts(url) {
  const clean = cleanUrl(url).replace(/^\//, '').replace(/\/$/, '');
  return clean.split('/');
}

function formatDate(isoDate) {
  const [y, m, d] = String(isoDate).split('-');
  return `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`;
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function escapeAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function buildBreadcrumbCrumbs(post) {
  const parts = [];
  const cats = Array.isArray(post.categories) ? post.categories : [];
  if (cats.length) {
    const firstSlug = typeof cats[0] === 'string' ? cats[0] : cats[0]?.slug;
    if (firstSlug) {
      const info = taxonomyEntry('categories', firstSlug);
      const name = info?.name || firstSlug;
      const catUrl = info?.url || `/category/${firstSlug}/`;
      parts.push(`<i class="icon-angle-right"></i> <a href="${escapeAttr(catUrl)}">${escapeHtml(name)}</a>`);
    }
  }
  parts.push(`<i class="icon-angle-right"></i> <span class="current">${escapeHtml(post.title || 'Untitled')}</span>`);
  return parts.join('');
}

function buildFooterTagsBlock(post) {
  const tags = Array.isArray(post.tags) ? post.tags : [];
  const links = tags.map(t => {
    const slug = typeof t === 'string' ? t : t?.slug;
    if (!slug) return null;
    const info = taxonomyEntry('tags', slug);
    const name = info?.name || slug;
    const tagUrl = info?.url || `/tag/${slug}/`;
    return `<a href="${escapeAttr(tagUrl)}" rel="tag">${escapeHtml(name)}</a>`;
  }).filter(Boolean);
  if (!links.length) return '';
  return `<span class="footer-tags" itemprop="keywords">
                    <i class="icon-tag icon-metas" title="Tagged"></i>&nbsp;${links.join(', ')}
                </span>`;
}

function renderPost(post) {
  if (!post || !post.url) return null;
  const url = cleanUrl(post.url);
  const parts = urlParts(post.url);
  const [year, , , slug] = parts;
  const rawDate = post.date_published || `${parts[0]}-${parts[1]}-${parts[2]}`;
  // date_published comes in two shapes across the database:
  //   newer shards: "2026-03-26"             (date only)
  //   older shards: "2014-01-01T12:00:00Z"   (already ISO datetime)
  // Normalize: dateOnly for display formatting, ISO for the <time datetime=...>.
  const dateOnly = rawDate.slice(0, 10);
  const dateFormatted = formatDate(dateOnly);
  const dateIso = /T\d/.test(rawDate) ? rawDate.replace(/Z$/, '+00:00') : `${dateOnly}T12:00:00+00:00`;

  const cats = (Array.isArray(post.categories) ? post.categories : [])
    .map(c => `category-${typeof c === 'string' ? c : c?.slug}`).filter(Boolean).join(' ');
  const tags = (Array.isArray(post.tags) ? post.tags : [])
    .map(t => `tag-${typeof t === 'string' ? t : t?.slug}`).filter(Boolean).join(' ');
  const classes = [cats, tags].filter(Boolean).join(' ');
  const postId = slug || 'new';

  const values = {
    '{{title}}': escapeHtml(post.title || 'Untitled'),
    '{{content}}': post.content || post.excerpt || '',
    '{{excerpt}}': escapeHtml(post.excerpt || ''),
    '{{url}}': url,
    '{{abs_url}}': `https://learningischange.com${url}`,
    '{{description}}': escapeHtml(describe(post)),
    '{{json_ld}}': jsonLd(post, `https://learningischange.com${url}`, dateIso, describe(post)),
    '{{date_iso}}': dateIso,
    '{{date_formatted}}': dateFormatted,
    '{{date_utc}}': dateIso,
    '{{post_id}}': postId,
    '{{body_classes}}': classes,
    '{{article_classes}}': classes,
    '{{breadcrumb_crumbs}}': buildBreadcrumbCrumbs(post),
    '{{footer_tags_block}}': buildFooterTagsBlock(post),
  };

  let html = TEMPLATE;
  for (const [key, val] of Object.entries(values)) {
    // Replace every occurrence — use split/join (safe for any string content, not regex)
    html = html.split(key).join(val);
  }
  return html;
}

function postHtmlPath(post) {
  const url = cleanUrl(post.url);
  return path.join(REPO_ROOT, url.replace(/^\//, '') + 'index.html');
}

function lineDiff(a, b, label) {
  const al = a.split('\n');
  const bl = b.split('\n');
  const max = Math.max(al.length, bl.length);
  const out = [];
  let same = 0;
  for (let i = 0; i < max; i++) {
    if (al[i] === bl[i]) { same++; continue; }
    out.push(`@ line ${i + 1}`);
    if (al[i] !== undefined) out.push(`  - ${al[i].length > 140 ? al[i].slice(0, 140) + '…' : al[i]}`);
    if (bl[i] !== undefined) out.push(`  + ${bl[i].length > 140 ? bl[i].slice(0, 140) + '…' : bl[i]}`);
    if (out.length > 40) { out.push('  (diff truncated)'); return out.join('\n'); }
  }
  if (out.length === 0) return `  ${label}: identical (${same} lines)`;
  return `  ${label}: ${same} lines same, ${max - same} lines differ\n` + out.join('\n');
}

function processShard(year) {
  const shardPath = path.join(POSTS_DIR, `${year}.json`);
  if (!fs.existsSync(shardPath)) return null;
  const shard = JSON.parse(fs.readFileSync(shardPath, 'utf8'));
  const posts = Array.isArray(shard.posts) ? shard.posts : [];

  let rendered = 0, skippedNoContent = 0, written = 0, errored = 0, unchanged = 0;
  for (const post of posts) {
    if (!post.content) { skippedNoContent++; continue; }
    if (ONLY_URL && cleanUrl(post.url) !== cleanUrl(ONLY_URL)) continue;

    try {
      const html = renderPost(post);
      if (!html) { errored++; continue; }
      rendered++;

      const outPath = postHtmlPath(post);
      const prior = fs.existsSync(outPath) ? fs.readFileSync(outPath, 'utf8') : null;

      if (prior === html) { unchanged++; continue; }

      if (DIFF && prior !== null) {
        console.log(`\n== ${post.url} ==`);
        console.log(lineDiff(prior, html, post.url));
      }

      if (APPLY) {
        fs.mkdirSync(path.dirname(outPath), { recursive: true });
        fs.writeFileSync(outPath, html);
        written++;
      }
    } catch (err) {
      console.error(`  ERROR: ${post.url}: ${err.message}`);
      errored++;
    }
  }

  return { year, total: posts.length, rendered, skippedNoContent, written, unchanged, errored };
}

function main() {
  const years = ONLY_YEAR
    ? [ONLY_YEAR]
    : fs.readdirSync(POSTS_DIR).filter(f => /^\d{4}\.json$/.test(f)).map(f => f.replace('.json', '')).sort();

  console.log(`${APPLY ? 'APPLY' : 'DRY RUN'}${DIFF ? ' [DIFF]' : ''} — regenerate posts from template + JSON`);
  console.log(`${'year'.padEnd(6)} ${'total'.padStart(6)} ${'rendered'.padStart(9)} ${'noContent'.padStart(10)} ${'written'.padStart(8)} ${'unchanged'.padStart(10)} ${'err'.padStart(5)}`);
  console.log('─'.repeat(60));

  let t = { total: 0, rendered: 0, skippedNoContent: 0, written: 0, unchanged: 0, errored: 0 };
  for (const year of years) {
    const s = processShard(year);
    if (!s) continue;
    console.log(
      `${year.padEnd(6)} ${String(s.total).padStart(6)} ${String(s.rendered).padStart(9)} ${String(s.skippedNoContent).padStart(10)} ${String(s.written).padStart(8)} ${String(s.unchanged).padStart(10)} ${String(s.errored).padStart(5)}`,
    );
    t.total += s.total; t.rendered += s.rendered; t.skippedNoContent += s.skippedNoContent;
    t.written += s.written; t.unchanged += s.unchanged; t.errored += s.errored;
  }
  console.log('─'.repeat(60));
  console.log(`TOTAL  ${String(t.total).padStart(6)} ${String(t.rendered).padStart(9)} ${String(t.skippedNoContent).padStart(10)} ${String(t.written).padStart(8)} ${String(t.unchanged).padStart(10)} ${String(t.errored).padStart(5)}`);
  if (!APPLY) console.log('\nRun again with --apply to write files.');
}

main();
