#!/usr/bin/env node
// Render every listing page from database/*.json (Decision 014, P2):
//   /                    homepage (templates/home.html)
//   /page/N/             10 posts per page, newest first
//   /YYYY/  /YYYY/MM/  /YYYY/MM/DD/   date archives (unpaginated)
//   /category/<path>/(page/N/)   /tag/<slug>/(page/N/)   /author/<name>/(page/N/)
// plus database/on-this-day.json for the homepage widget.
//
// Permalink rule: after the canonical set is produced, every protected
// archive URL (database/permalinks.json) that was not produced — e.g.
// /page/389/ when the data only fills 366 pages, or /author/user/ —
// is rendered as a clamped alias (same content as the nearest real
// page, canonical pointing at it, noindex). Nothing ever 404s.
//
// Usage:
//   node scripts/render-archives.js              # dry run (counts)
//   node scripts/render-archives.js --apply
//   node scripts/render-archives.js --only=home|page|date|category|tag|author

import fs from 'node:fs';
import path from 'node:path';
import {
  REPO_ROOT, SITE, SITE_NAME, AUTHOR, TAGLINE, NOISE_TERMS, escapeHtml, escapeAttr, describe, dates, terms,
  firstImage, plainText, loadAllPosts, loadTaxonomies, nav, rail, footer, fill, slugify, headCommon,
} from './lib/shell.js';

const args = process.argv.slice(2);
const APPLY = args.includes('--apply');
const ONLY = (args.find((a) => a.startsWith('--only=')) || '').slice(7) || null;
const PER_PAGE = 10;

const T_ARCHIVE = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'archive.html'), 'utf8');
const T_HOME = fs.readFileSync(path.join(REPO_ROOT, 'templates', 'home.html'), 'utf8');
const ALL = loadAllPosts();                 // chronological
const NEWEST = [...ALL].reverse();          // newest first
const TAX = loadTaxonomies();
const SHELL = { nav: nav({ active: 'blog' }), rail: rail(ALL, TAX), footer: footer(), head_common: headCommon() };
const NAV_PLAIN = nav({ active: '' });
const PROTECTED = new Set(JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'database', 'permalinks.json'), 'utf8')).urls);

const pages = new Map(); // url -> html
function emit(url, html) { pages.set(url, html); }

// ---------- list rendering ----------
function item(p) {
  const d = dates(p); const ds = describe(p, 150); const img = firstImage(p.content);
  const thumb = img && plainText(p.content).length < 40 ? `<img class="thumb" src="${escapeAttr(img)}" alt="" loading="lazy">` : '';
  const cats = terms(p, 'categories').filter((c) => !NOISE_TERMS.has(c.slug));
  const k = cats.length ? `<span class="k">${cats.map((c) => `<a href="${escapeAttr(c.url)}">${escapeHtml(c.name)}</a>`).join('')}</span>` : '';
  return `<li><time datetime="${d.dateOnly}">${d.dateOnly}</time><div>${thumb}<a class="t" href="${escapeAttr(p.url)}">${escapeHtml(p.title || 'Untitled')}</a>${ds && ds !== TAGLINE ? `<span class="d">${escapeHtml(ds)}</span>` : ''}${k}</div></li>`;
}
const list = (posts) => `<ul class="post-list">${posts.map(item).join('')}</ul>`;
function pager(base, n, last) {
  if (last <= 1) return '';
  const href = (i) => (i === 1 ? base : `${base}page/${i}/`);
  return `<nav class="pager" aria-label="Pagination">${n > 1 ? `<a href="${href(n - 1)}" rel="prev">← Newer</a>` : '<span></span>'}<span class="text-muted" style="font-weight:400">Page ${n} of ${last}</span>${n < last ? `<a href="${href(n + 1)}" rel="next">Older →</a>` : '<span></span>'}</nav>`;
}
function collectionLd(name, url, count, description) {
  return JSON.stringify({ '@context': 'https://schema.org', '@type': 'CollectionPage', name, url, description, isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website`, name: SITE_NAME }, author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url }, numberOfItems: count }).replace(/<\//g, '<\\/');
}

// Generic archive page (one page of a listing)
function archivePage({ url, title, heading, kicker = '', intro, posts, base, n = 1, last = 1, canonical = null, noindex = false, sections = null, bodyClass = '' }) {
  const canon = SITE + (canonical || url);
  const prevNext = last > 1 ? [n > 1 ? `<link rel="prev" href="${SITE}${n - 1 === 1 ? base : `${base}page/${n - 1}/`}">` : '', n < last ? `<link rel="next" href="${SITE}${base}page/${n + 1}/">` : ''].join('\n') : '';
  const html = fill(T_ARCHIVE, {
    title: escapeHtml(title), heading: escapeHtml(heading), kicker, intro: escapeHtml(intro),
    description: escapeAttr(intro), canonical: canon, prev_next_links: prevNext,
    robots: noindex ? '<meta name="robots" content="noindex, follow">' : '',
    json_ld: collectionLd(title, canon, posts.length, intro),
    body_classes: bodyClass, sections: sections ?? list(posts), pager: pager(base, n, last), ...SHELL,
  });
  emit(url, html);
}
function paginated(base, posts, opts) {
  const last = Math.max(1, Math.ceil(posts.length / PER_PAGE));
  for (let n = 1; n <= last; n++) {
    const url = n === 1 ? base : `${base}page/${n}/`;
    archivePage({ ...opts, url, base, n, last, posts: posts.slice((n - 1) * PER_PAGE, n * PER_PAGE),
      title: n === 1 ? opts.title : `${opts.title} – Page ${n}`, heading: opts.heading || opts.title });
  }
  return last;
}
const plural = (n, w) => `${n.toLocaleString('en-US')} ${w}${n === 1 ? '' : 's'}`;

// ---------- homepage + /page/N/ ----------
function renderHome() {
  const years = [...new Set(ALL.map((p) => dates(p).year))].filter(Boolean);
  const cats = Object.values(TAX.categories).filter((c) => c && c.slug);
  const tags = Object.values(TAX.tags).filter((t) => t && t.slug);
  const now = new Date(); const key = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const otd = NEWEST.filter((p) => dates(p).dateOnly.slice(5) === key);
  const series = [
    ['365 Questions That Google Can’t Answer', 'questions', 'A question a day for a year, answered in public.'],
    ['#C4C15', 'c4c15', 'Connected Courses, 2015.'],
    ['#LifeWideLearning16', 'lifewidelearning16', 'A year of learning outside the classroom.'],
    ['#AskBenW', 'askbenw', 'Video answers to questions from educators.'],
    ['Newsletter Archive', 'newsletter-archive', 'The Weekly Authentic, every issue.'],
    ['Lesson Plans', 'lesson-plans', 'Two decades of classroom plans.'],
  ].map(([name, slug, blurb]) => { const c = TAX.categories[slug]; return c ? `<a class="series" href="${escapeAttr(c.url)}"><strong>${escapeHtml(c.name || name)}</strong><span>${escapeHtml(blurb)}</span><span class="n">${plural(c.count || 0, 'post')}</span></a>` : ''; }).join('');
  // D-3: "Start here" is whatever /important-posts/ (pages.json) links to, in order
  const start = (() => {
    try {
      const raw = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'database', 'pages.json'), 'utf8'));
      const pages = Array.isArray(raw) ? raw : raw.pages || Object.values(raw);
      const page = pages.find((p) => String(p.url || '').replace(/^https?:\/\/[^/]+/, '') === '/important-posts/');
      const byUrl = new Map(ALL.map((p) => [p.url, p]));
      const links = [...String(page?.content || '').matchAll(/href="(?:https?:\/\/learningischange\.com)?(\/\d{4}\/\d{2}\/\d{2}\/[^"#?]+\/)"/g)].map((m) => m[1]);
      const picked = [...new Set(links)].map((u) => byUrl.get(u)).filter(Boolean);
      return picked.length ? picked : ['/2007/06/07/the-ripe-environment/', '/2005/04/20/the-reason-for-the-blog/'].map((u) => byUrl.get(u)).filter(Boolean);
    } catch { return []; }
  })();
  // B-5: sections for the category subtrees the old menu featured
  const subtree = (prefix) => { const slugs = Object.values(TAX.categories).filter((c) => c && c.url && c.url.startsWith(prefix)).map((c) => c.slug); return NEWEST.filter((p) => terms(p, 'categories').some((t) => slugs.includes(t.slug))); };
  const watch = subtree('/category/videos/').slice(0, 5);
  const recs = subtree('/category/recs/').slice(0, 5);
  const recsLinks = Object.values(TAX.categories).filter((c) => c && c.url && c.url.startsWith('/category/recs/') && c.url !== '/category/recs/' && (c.count || 0) > 0)
    .sort((a, b) => (b.count || 0) - (a.count || 0)).map((c) => `<a class="tag" href="${escapeAttr(c.url)}">${escapeHtml(c.name)} · ${c.count}</a>`).join('');
  const ld = JSON.stringify([
    { '@context': 'https://schema.org', '@type': 'WebSite', '@id': `${SITE}/#website`, url: `${SITE}/`, name: SITE_NAME, description: TAGLINE, author: { '@id': `${SITE}/#person` }, potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: `${SITE}/search/?q={search_term_string}` }, 'query-input': 'required name=search_term_string' } },
    { '@context': 'https://schema.org', '@type': 'Person', '@id': `${SITE}/#person`, name: AUTHOR.name, url: AUTHOR.url, image: `${SITE}/meet/ben.jpg`, jobTitle: 'Educator, Builder, Writer', sameAs: ['https://www.linkedin.com/in/bhwilkoff/', 'https://github.com/bhwilkoff', 'https://bsky.app/profile/laserdiscleftist.bsky.social'] },
    { '@context': 'https://schema.org', '@type': 'Blog', '@id': `${SITE}/#blog`, url: `${SITE}/`, name: SITE_NAME, author: { '@id': `${SITE}/#person` }, blogPost: NEWEST.slice(0, PER_PAGE).map((p) => ({ '@type': 'BlogPosting', headline: p.title, url: SITE + p.url, datePublished: dates(p).iso })) },
  ]).replace(/<\//g, '<\\/');
  emit('/', fill(T_HOME, {
    post_count: ALL.length.toLocaleString('en-US'), year_count: String(years.length), category_count: String(cats.length), tag_count: tags.length.toLocaleString('en-US'),
    latest: NEWEST.slice(0, PER_PAGE).map(item).join(''),
    otd_date: now.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }),
    otd: otd.length ? otd.map((p) => `<a href="${escapeAttr(p.url)}"><b>${dates(p).year}</b><span>${escapeHtml(p.title || 'Untitled')}</span></a>`).join('') : '<p class="text-muted">Nothing published on this date — yet.</p>',
    start_here: start.map(item).join(''), series, json_ld: ld,
    watch: watch.map(item).join(''), recs: recs.map(item).join(''), recs_links: recsLinks, ...SHELL,
  }));
  // /page/N/ (page 1 is the homepage)
  const last = Math.ceil(ALL.length / PER_PAGE);
  for (let n = 2; n <= last; n++) {
    archivePage({ url: `/page/${n}/`, base: '/', n, last, title: `All posts – Page ${n}`, heading: 'All posts', kicker: `<span class="card-tag">Page ${n} of ${last}</span>`,
      intro: `Every post, newest first. ${plural(ALL.length, 'post')} since 2005.`, posts: NEWEST.slice((n - 1) * PER_PAGE, n * PER_PAGE) });
  }
  // on-this-day.json: mm-dd -> [{y,t,u}]
  const map = {};
  for (const p of NEWEST) { const k = dates(p).dateOnly.slice(5); if (k.length === 5) (map[k] ||= []).push({ y: dates(p).year, t: p.title || 'Untitled', u: p.url }); }
  if (APPLY) fs.writeFileSync(path.join(REPO_ROOT, 'database', 'on-this-day.json'), JSON.stringify(map));
  return last;
}

// ---------- date archives ----------
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function renderDates() {
  const byYear = new Map(), byMonth = new Map(), byDay = new Map();
  for (const p of NEWEST) {
    const d = dates(p).dateOnly; if (d.length !== 10) continue;
    (byYear.get(d.slice(0, 4)) || byYear.set(d.slice(0, 4), []).get(d.slice(0, 4))).push(p);
    (byMonth.get(d.slice(0, 7)) || byMonth.set(d.slice(0, 7), []).get(d.slice(0, 7))).push(p);
    (byDay.get(d) || byDay.set(d, []).get(d)).push(p);
  }
  for (const [y, posts] of byYear) {
    // year-in-review: grouped by month, with topic counts
    const months = [...byMonth].filter(([k]) => k.startsWith(y)).sort().reverse();
    const topicCount = new Map();
    for (const p of posts) for (const c of terms(p, 'categories')) if (!NOISE_TERMS.has(c.slug)) topicCount.set(c.slug, { c, n: (topicCount.get(c.slug)?.n || 0) + 1 });
    const topics = [...topicCount.values()].sort((a, b) => b.n - a.n).slice(0, 10).map(({ c, n }) => `<a class="tag" href="${escapeAttr(c.url)}">${escapeHtml(c.name)} · ${n}</a>`).join('');
    const sections = (topics ? `<div class="tag-list" style="margin-bottom:var(--space-xl)">${topics}</div>` : '') +
      months.map(([k, ps]) => `<section class="section"><div class="section-title"><h2><a href="/${k.replace('-', '/')}/">${MONTHS[parseInt(k.slice(5), 10) - 1]} ${y}</a></h2><span class="text-muted" style="font-size:.85rem">${plural(ps.length, 'post')}</span></div>${list(ps)}</section>`).join('');
    archivePage({ url: `/${y}/`, base: `/${y}/`, title: `${y}`, heading: `${y} in review`, kicker: `<span class="card-tag">Year</span>`, intro: `${plural(posts.length, 'post')} across ${plural(months.length, 'month')}.`, posts, sections, bodyClass: 'year-archive' });
  }
  for (const [k, posts] of byMonth) {
    const [y, m] = k.split('-'); const name = `${MONTHS[parseInt(m, 10) - 1]} ${y}`;
    archivePage({ url: `/${y}/${m}/`, base: `/${y}/${m}/`, title: name, heading: name, kicker: `<span class="card-tag"><a href="/${y}/">${y}</a></span>`, intro: `${plural(posts.length, 'post')} published in ${name}.`, posts });
  }
  for (const [d, posts] of byDay) {
    const [y, m, dd] = d.split('-'); const name = `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(dd, 10)}, ${y}`;
    archivePage({ url: `/${y}/${m}/${dd}/`, base: `/${y}/${m}/${dd}/`, title: name, heading: name, kicker: `<span class="card-tag"><a href="/${y}/${m}/">${MONTHS[parseInt(m, 10) - 1]} ${y}</a></span>`, intro: `${plural(posts.length, 'post')} published on ${name}.`, posts });
  }
}

// ---------- taxonomy archives ----------
function renderTerms(kind) {
  const key = kind === 'category' ? 'categories' : 'tags';
  // only local term pages (12 tags carry technorati.com URLs from 2007 — queue item C-10)
  const items = Object.values(TAX[key]).filter((t) => t && t.slug && typeof t.url === 'string' && t.url.startsWith(kind === 'category' ? '/category/' : '/tag/'));
  // slug -> posts (categories include descendants by URL prefix)
  const direct = new Map();
  for (const p of NEWEST) for (const t of terms(p, key)) (direct.get(t.slug) || direct.set(t.slug, []).get(t.slug)).push(p);
  for (const it of items) {
    let posts;
    if (kind === 'category') {
      const desc = items.filter((o) => o.url.startsWith(it.url)).map((o) => o.slug);
      const seen = new Set(); posts = [];
      for (const p of NEWEST) if (!seen.has(p.url) && terms(p, key).some((t) => desc.includes(t.slug))) { seen.add(p.url); posts.push(p); }
    } else posts = direct.get(it.slug) || [];
    if (!posts.length && !PROTECTED.has(it.url)) continue;
    const parent = kind === 'category' ? items.find((o) => o.url !== it.url && it.url.startsWith(o.url) && o.url.split('/').length === it.url.split('/').length - 1) : null;
    paginated(it.url, posts, { title: it.name, kicker: `<span class="card-tag">${kind === 'category' ? 'Category' : 'Tag'}</span>${parent ? ` <span class="card-tag"><a href="${escapeAttr(parent.url)}">${escapeHtml(parent.name)}</a></span>` : ''}`,
      intro: `${plural(posts.length, 'post')} ${kind === 'category' ? 'in' : 'tagged'} ${it.name}.`, bodyClass: `${kind}-archive` });
  }
}
function renderAuthor() {
  paginated('/author/bhwilkoff/', NEWEST, { title: 'Posts by Ben Wilkoff', heading: 'Ben Wilkoff', kicker: '<span class="card-tag">Author</span>', intro: `${plural(ALL.length, 'post')} since 2005. ${TAGLINE}`, bodyClass: 'author-archive' });
}

// ---------- coverage of protected archive URLs ----------
function coverProtected() {
  const isArchive = (u) => /^\/page\/\d+\/$/.test(u) || /^\/\d{4}\/(\d{2}\/(\d{2}\/)?)?(page\/\d+\/)?$/.test(u) || /^\/(category|tag|author|type)\//.test(u);
  let aliases = 0;
  for (const u of PROTECTED) {
    if (!isArchive(u) || pages.has(u)) continue;
    // nearest real page: strip /page/N/ and walk down; /author/user/ -> bhwilkoff; /type/* -> videos
    let base = u.replace(/page\/\d+\/$/, '');
    if (base.startsWith('/author/')) base = '/author/bhwilkoff/';
    if (base.startsWith('/type/')) base = TAX.categories.videos?.url || '/';
    if (base.startsWith('/category/') && !pages.has(base)) {
      const slug = base.replace(/\/$/, '').split('/').pop(); const lc = slugify(slug);
      const hit = Object.values(TAX.categories).find((c) => c && c.slug && slugify(c.slug) === lc);
      base = hit?.url && pages.has(hit.url) ? hit.url : '/';
    }
    if (base.startsWith('/tag/') && !pages.has(base)) {
      const slug = decodeURIComponent(base.replace(/\/$/, '').split('/').pop()); const lc = slugify(slug);
      const hit = Object.values(TAX.tags).find((t) => t && t.slug && slugify(t.slug) === lc);
      base = hit?.url && pages.has(hit.url) ? hit.url : '/';
    }
    // clamp page number to the base's last page
    const m = /page\/(\d+)\/$/.exec(u);
    let target = base;
    if (m) { let n = parseInt(m[1], 10); while (n > 1 && !pages.has(`${base}page/${n}/`)) n--; target = n > 1 ? `${base}page/${n}/` : base; }
    if (!pages.has(target)) target = '/';
    const html = pages.get(target)
      .replace(/<link rel="canonical" href="[^"]*">/, `<link rel="canonical" href="${SITE}${target}">`)
      .replace(/<meta name="robots"[^>]*>\n?/, '').replace('</head>', '<meta name="robots" content="noindex, follow">\n</head>');
    pages.set(u, html); aliases++;
  }
  return aliases;
}

// ---------- main ----------
const want = (k) => !ONLY || ONLY === k;
if (want('home') || want('page')) renderHome();
if (want('date')) renderDates();
if (want('category')) renderTerms('category');
if (want('tag')) renderTerms('tag');
if (want('author')) renderAuthor();
const aliases = ONLY ? 0 : coverProtected();

const counts = {};
for (const u of pages.keys()) {
  const k = u === '/' ? 'home' : u.startsWith('/page/') ? 'page' : /^\/\d{4}\//.test(u) ? 'date' : u.split('/')[1];
  counts[k] = (counts[k] || 0) + 1;
}
let written = 0, unchanged = 0;
for (const [u, html] of pages) {
  const out = path.join(REPO_ROOT, u.replace(/^\//, ''), 'index.html');
  const prior = fs.existsSync(out) ? fs.readFileSync(out, 'utf8') : null;
  if (prior === html) { unchanged++; continue; }
  if (APPLY) { fs.mkdirSync(path.dirname(out), { recursive: true }); fs.writeFileSync(out, html); }
  written++;
}
console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'} — ${pages.size} listing pages (${Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(', ')}; ${aliases} protected-URL aliases) — ${written} ${APPLY ? 'written' : 'would change'}, ${unchanged} unchanged`);
const missing = [...PROTECTED].filter((u) => (/^\/page\/|^\/\d{4}\/|^\/(category|tag|author|type)\//.test(u)) && !pages.has(u) && !/^\/\d{4}\/\d{2}\/\d{2}\/[^/]+\/$/.test(u));
if (missing.length) { console.error(`MISSING ${missing.length} protected archive URLs:`); missing.slice(0, 20).forEach((u) => console.error('  ' + u)); process.exitCode = 1; }
if (!APPLY) console.log('Run again with --apply to write files.');
