// Browser-safe rendering core (Decision 015, A0). No Node imports: this
// file runs unchanged in the admin app for exact previews. Node-only
// pieces (partials, loaders, file checks) live in shell.js, which
// re-exports everything here.

export const SITE = 'https://learningischange.com';
export const SITE_NAME = 'Learning is Change';
export const AUTHOR = { name: 'Ben Wilkoff', url: `${SITE}/portfolio/about/` };
export const DEFAULT_IMAGE = `${SITE}/meet/ben.jpg`;
export const TAGLINE = 'My name is Ben Wilkoff, and I Teach. And Learn. A Lot.';
// Terms every post carries; useless as "topics"
export const NOISE_TERMS = new Set(['ben-wilkoff', 'uncategorized', 'blog-2']);

// ---------- text ----------
export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const escapeAttr = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/"/g, '&quot;');
export const stripOrigin = (u) => String(u || '').replace(/^https?:\/\/[^/]+/, '');
export const cleanUrl = (u) => stripOrigin(u).replace(/\/?$/, '/');

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', hellip: '…', mdash: '—', ndash: '–', lsquo: '‘', rsquo: '’', ldquo: '“', rdquo: '”', laquo: '«', raquo: '»', copy: '©', reg: '®', trade: '™', middot: '·', bull: '•' };
export function unescapeEntities(s) {
  return String(s ?? '')
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => (ENT[n.toLowerCase()] ?? m));
}
export function plainText(html) {
  return unescapeEntities(String(html ?? '').replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}
export function wordCount(html) { const t = plainText(html); return t ? t.split(' ').length : 0; }
export function readingMinutes(html) { return Math.max(1, Math.round(wordCount(html) / 220)); }

// Excerpt if present, else the first ~160 chars of the body — derived at render, content untouched.
export function describe(post, max = 160) {
  let text = plainText(post.excerpt || post.content || '');
  // many bodies open by repeating the title (tweet-style posts); don't echo it
  const title = plainText(post.title || '');
  if (title && text.toLowerCase().startsWith(title.toLowerCase())) text = text.slice(title.length).replace(/^[\s:.,;–—-]+/, '');
  if (!text) return TAGLINE;
  if (text.length <= max) return text;
  return text.slice(0, max - 3).replace(/\s+\S*$/, '') + '…';
}
// Decision 014 / C-3: images proxied through the Jetpack CDN
// (i0.wp.com/learningischange.com/wp-content/uploads/…?resize=…) are
// re-pointed at the self-hosted file when it exists. Render-time only;
// the JSON content is untouched. Third-party images stay on the CDN.
// `exists(relPath)` is provided by the host: the Node shell checks the
// working tree; the browser admin can pass () => true (assume uploads exist).
let imageExists = () => true;
export function setImageExists(fn) { imageExists = fn; }
const IMG_EXISTS = new Map();
function selfHostedPath(encoded) {
  let rel = encoded;
  try { rel = decodeURIComponent(encoded); } catch { /* keep as-is */ }
  if (!IMG_EXISTS.has(rel)) IMG_EXISTS.set(rel, imageExists(rel) || imageExists(encoded));
  return IMG_EXISTS.get(rel) ? '/' + encoded : null;
}
export function selfHostImages(html) {
  return String(html || '').replace(/https?:\/\/i[0-3]\.wp\.com\/learningischange\.com\/(wp-content\/uploads\/[^"'\s?&)]+)(\?[^"'\s)]*)?/g,
    (m, rel) => selfHostedPath(rel) || m);
}
export function firstImage(html) {
  const m = /<img[^>]+src=["']([^"']+)["']/i.exec(selfHostImages(html));
  if (!m) return '';
  return m[1].startsWith('/') ? SITE + m[1] : m[1];
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
export function dates(post) {
  const raw = post.date_published || '';
  const dateOnly = raw.slice(0, 10);
  const [y, m, d] = dateOnly.split('-');
  return {
    dateOnly,
    iso: /T\d/.test(raw) ? raw.replace(/Z$/, '+00:00') : `${dateOnly}T12:00:00+00:00`,
    formatted: y && m && d ? `${MONTHS[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}` : dateOnly,
    year: y,
  };
}

// ---------- taxonomy ----------
// Tolerates every shape that has existed in the shards: [{name,slug,url}], ['slug'], stringified list.
export function terms(post, key) {
  let v = post[key];
  if (typeof v === 'string') { try { v = JSON.parse(v.replace(/'/g, '"')); } catch { v = []; } }
  if (!Array.isArray(v)) return [];
  const base = key === 'categories' ? '/category/' : '/tag/';
  return v.map((t) => {
    if (t && typeof t === 'object') return { name: t.name || t.slug, slug: t.slug || slugify(t.name), url: t.url || `${base}${t.slug}/` };
    const s = String(t || '').trim(); if (!s) return null;
    return { name: s, slug: slugify(s), url: `${base}${slugify(s)}/` };
  }).filter((t) => t && t.slug);
}
// Terms worth showing (drops the ones every post carries)
export const signalTerms = (post, key) => terms(post, key).filter((t) => !NOISE_TERMS.has(t.slug));
export const slugify = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

// ---------- related / neighbors ----------
export function neighbors(all, index) {
  return { prev: index > 0 ? all[index - 1] : null, next: index < all.length - 1 ? all[index + 1] : null };
}
// term slug -> [post index], built once per `all` array
const TERM_INDEX = new WeakMap();
function termIndex(all) {
  let idx = TERM_INDEX.get(all);
  if (idx) return idx;
  idx = { tags: new Map(), cats: new Map() };
  all.forEach((p, i) => {
    for (const t of terms(p, 'tags')) if (!NOISE_TERMS.has(t.slug)) (idx.tags.get(t.slug) || idx.tags.set(t.slug, []).get(t.slug)).push(i);
    for (const c of terms(p, 'categories')) if (!NOISE_TERMS.has(c.slug)) (idx.cats.get(c.slug) || idx.cats.set(c.slug, []).get(c.slug)).push(i);
  });
  TERM_INDEX.set(all, idx);
  return idx;
}
export function related(all, index, n = 4) {
  const me = all[index];
  const idx = termIndex(all);
  const myTags = terms(me, 'tags').map((t) => t.slug).filter((s) => !NOISE_TERMS.has(s));
  const myCats = terms(me, 'categories').map((t) => t.slug).filter((s) => !NOISE_TERMS.has(s));
  if (!myTags.length && !myCats.length) return nearest(all, index, n);
  const score = new Map();
  for (const s of myTags) for (const i of idx.tags.get(s) || []) if (i !== index) score.set(i, (score.get(i) || 0) + 2);
  for (const s of myCats) for (const i of idx.cats.get(s) || []) if (i !== index) score.set(i, (score.get(i) || 0) + 1);
  const scored = [...score].map(([i, s]) => ({ s, d: Math.abs(i - index), p: all[i] }));
  scored.sort((a, b) => b.s - a.s || a.d - b.d);
  const out = scored.slice(0, n).map((x) => x.p);
  if (out.length < n) for (const p of nearest(all, index, n * 2)) { if (out.length >= n) break; if (!out.includes(p)) out.push(p); }
  return out;
}
function nearest(all, index, n) {
  const out = [];
  for (let k = 1; out.length < n && (index - k >= 0 || index + k < all.length); k++) {
    if (index - k >= 0) out.push(all[index - k]);
    if (out.length < n && index + k < all.length) out.push(all[index + k]);
  }
  return out;
}

export function fill(tpl, values) {
  let out = tpl;
  for (const [k, v] of Object.entries(values)) out = out.split(`{{${k}}}`).join(v ?? '');
  return out;
}

// ---------- structured data ----------
export function jsonLdPost(post, absUrl, d, description) {
  const data = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    mainEntityOfPage: { '@type': 'WebPage', '@id': absUrl },
    headline: post.title || 'Untitled',
    description, datePublished: d.iso, dateModified: post.date_modified || d.iso,
    author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url },
    publisher: { '@type': 'Person', name: AUTHOR.name, url: `${SITE}/` },
    isPartOf: { '@type': 'Blog', '@id': `${SITE}/#blog`, name: SITE_NAME },
    inLanguage: 'en-US',
    wordCount: wordCount(post.content),
    ...(Array.isArray(post.comments) && post.comments.length ? { commentCount: post.comments.length } : {}),
  };
  const img = firstImage(post.content); if (img) data.image = img;
  const kw = [...terms(post, 'categories'), ...terms(post, 'tags')].map((t) => t.name).filter((n) => !NOISE_TERMS.has(slugify(n)));
  if (kw.length) data.keywords = kw.join(', ');
  return JSON.stringify(data).replace(/<\//g, '<\\/');
}

// ---------- Markdown twin ----------
// Good-enough conversion of WordPress-era HTML for agents and curl.
// Unknown/complex markup degrades to its text; nothing is lost from the HTML page.
export function toMarkdown(html) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>|<!--[\s\S]*?-->/gi, '');
  s = s.replace(/\r?\n\s*/g, ' ');
  s = s.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, (_, c) => '\n\n```\n' + plainText(c.replace(/<br\s*\/?>/gi, '\n')).replace(/ \n /g, '\n') + '\n```\n\n');
  s = s.replace(/<figcaption[^>]*>([\s\S]*?)<\/figcaption>/gi, (_, c) => ` *${plainText(c)}*`);
  s = s.replace(/<img[^>]*>/gi, (tag) => { const src = /src=["']([^"']+)/i.exec(tag)?.[1] || ''; const alt = /alt=["']([^"']*)/i.exec(tag)?.[1] || ''; return src ? `![${alt}](${src})` : ''; });
  s = s.replace(/<a\s[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, href, txt) => { const t = plainText(txt); return t ? `[${t}](${href})` : ''; });
  s = s.replace(/<(strong|b)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, c) => `**${c.trim()}**`);
  s = s.replace(/<(em|i)\b[^>]*>([\s\S]*?)<\/\1>/gi, (_, __, c) => `*${c.trim()}*`);
  s = s.replace(/<code\b[^>]*>([\s\S]*?)<\/code>/gi, (_, c) => '`' + plainText(c) + '`');
  s = s.replace(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi, (_, n, c) => `\n\n${'#'.repeat(Math.min(6, parseInt(n, 10) + 1))} ${plainText(c)}\n\n`);
  s = s.replace(/<li\b[^>]*>([\s\S]*?)<\/li>/gi, (_, c) => `\n- ${c.trim()}`);
  s = s.replace(/<blockquote\b[^>]*>([\s\S]*?)<\/blockquote>/gi, (_, c) => '\n\n' + plainText(c).split(/\n/).map((l) => `> ${l}`).join('\n') + '\n\n');
  s = s.replace(/<br\s*\/?>/gi, '  \n');
  s = s.replace(/<\/(p|div|figure|ul|ol|section|article|table|tr)>/gi, '\n\n');
  s = s.replace(/<[^>]+>/g, '');
  s = unescapeEntities(s);
  return s.split('\n').map((l) => l.replace(/^[ \t]+(?!$)/, '').replace(/[ \t]+$/, '')).join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
export function markdownTwin(post, absUrl) {
  const d = dates(post);
  const cats = terms(post, 'categories').map((t) => t.name);
  const tags = terms(post, 'tags').map((t) => t.name);
  const yaml = (arr) => arr.length ? `[${arr.map((x) => JSON.stringify(x)).join(', ')}]` : '[]';
  return `---\ntitle: ${JSON.stringify(post.title || 'Untitled')}\ndate: ${d.dateOnly}\nurl: ${absUrl}\nauthor: ${AUTHOR.name}\ncategories: ${yaml(cats)}\ntags: ${yaml(tags)}\n---\n\n# ${post.title || 'Untitled'}\n\n${toMarkdown(post.content)}`;
}

// ---------- post page (used by scripts/regenerate-posts.js AND the admin preview) ----------
function termLinks(list, cls) {
  return list.map((t) => `<a class="${cls}" href="${escapeAttr(t.url)}">${escapeHtml(t.name)}</a>`).join('');
}
function listItem(p) {
  const d = dates(p);
  return `<li><time datetime="${d.dateOnly}">${d.dateOnly}</time><div><a class="t" href="${escapeAttr(p.url)}">${escapeHtml(p.title || 'Untitled')}</a><span class="d">${escapeHtml(describe(p, 150))}</span></div></li>`;
}

// Recovered WordPress comment threads (scripts/recover-comments.js), read-only.
function renderComments(post) {
  const list = Array.isArray(post.comments) ? post.comments : [];
  if (!list.length) return '';
  const byParent = new Map();
  for (const c of list) (byParent.get(c.parent || null) || byParent.set(c.parent || null, []).get(c.parent || null)).push(c);
  const fmt = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); };
  const item = (c) => {
    const who = c.author_url ? `<a href="${escapeAttr(c.author_url)}" rel="ugc nofollow">${escapeHtml(c.author)}</a>` : escapeHtml(c.author);
    const kids = byParent.get(c.id) || [];
    return `<li class="comment" id="comment-${escapeAttr(c.id)}"><div class="comment-head">${c.avatar ? `<img class="comment-avatar" src="${escapeAttr(c.avatar)}" alt="" width="40" height="40" loading="lazy">` : ''}<span class="comment-author">${who}</span>${c.date ? `<a class="comment-date" href="#comment-${escapeAttr(c.id)}"><time datetime="${escapeAttr(c.date)}">${fmt(c.date)}</time></a>` : ''}</div><div class="comment-body">${selfHostImages(c.html)}</div>${kids.length ? `<ol class="comment-children">${kids.map(item).join('')}</ol>` : ''}</li>`;
  };
  const roots = byParent.get(null) || [];
  return `<section class="comments" id="comments"><h2>${list.length} ${list.length === 1 ? 'comment' : 'comments'} <small>archived from the original blog; comments are closed</small></h2><ol class="comment-list">${roots.map(item).join('')}</ol></section>`;
}

export function renderPostPage(template, post, { prev = null, next = null, related = [], shell = {} } = {}) {
  const url = post.url;
  const absUrl = SITE + url;
  const d = dates(post);
  const cats = signalTerms(post, 'categories');
  const tags = signalTerms(post, 'tags');
  const description = describe(post);
  const rel = related;
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
    comments: renderComments(post),
    bluesky: '',
    ...shell,
  };
  // content last: a body that happens to contain "{{...}}" must never be expanded
  return fill(template, values).split('{{content}}').join(selfHostImages(post.content));
}

// ---------- static page (used by scripts/render-pages.js AND the admin preview) ----------
export function renderStaticPage(template, page, { url, content, description, noindex = false, isIndex = false, shell = {} }) {
  const abs = SITE + url;
  const mod = page.date_modified && page.date_modified !== 'None' ? String(page.date_modified).slice(0, 10) : '';
  const desc = description ?? describe({ title: page.title, excerpt: page.excerpt, content });
  const ld = JSON.stringify({ '@context': 'https://schema.org', '@type': isIndex ? 'CollectionPage' : 'WebPage', name: page.title, url: abs, description: desc, ...(mod ? { dateModified: mod } : {}), isPartOf: { '@type': 'WebSite', '@id': `${SITE}/#website`, name: SITE_NAME }, author: { '@type': 'Person', name: AUTHOR.name, url: AUTHOR.url } }).replace(/<\//g, '<\\/');
  return fill(template, {
    title: escapeHtml(page.title || 'Untitled'), description: escapeAttr(desc), abs_url: abs,
    og_image: escapeAttr(firstImage(content) || DEFAULT_IMAGE),
    robots: noindex ? '<meta name="robots" content="noindex, follow">' : '',
    json_ld: ld, body_classes: `page-${(page.slug || url).replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '')}`,
    kicker: isIndex ? '<span class="card-tag">Archive</span>' : '<span class="card-tag">Page</span>',
    meta: mod ? `<div class="post-meta"><span>Updated <time datetime="${mod}">${dates({ date_published: mod }).formatted}</time></span></div>` : '',
    ...shell,
  }).split('{{content}}').join(selfHostImages(content));
}

// ---------- Bluesky replies (A4) ----------
// `thread` is app.bsky.feed.getPostThread's `thread` for the cross-posted
// post. Renders the replies (not the root) as a nested, read-only list.
export function renderBlueskyThread(thread, postUrl) {
  if (!thread || !thread.post) return '';
  const replies = (thread.replies || []).filter((r) => r && r.post);
  const count = countReplies(thread);
  const item = (node) => {
    const p = node.post, a = p.author || {}, rec = p.record || {};
    const when = rec.createdAt ? new Date(rec.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : '';
    const link = `https://bsky.app/profile/${escapeAttr(a.handle || '')}/post/${escapeAttr(String(p.uri || '').split('/').pop())}`;
    const kids = (node.replies || []).filter((r) => r && r.post);
    return `<li class="comment"><div class="comment-head">${a.avatar ? `<img class="comment-avatar" src="${escapeAttr(a.avatar)}" alt="" width="32" height="32" loading="lazy">` : ''}<span class="comment-author"><a href="https://bsky.app/profile/${escapeAttr(a.handle || '')}" rel="ugc nofollow">${escapeHtml(a.displayName || a.handle || 'someone')}</a> <small class="mono">@${escapeHtml(a.handle || '')}</small></span><a class="comment-date" href="${link}" rel="nofollow">${escapeHtml(when)}</a></div><div class="comment-body"><p>${escapeHtml(rec.text || '')}</p></div>${kids.length ? `<ol class="comment-children">${kids.map(item).join('')}</ol>` : ''}</li>`;
  };
  const rootLink = `https://bsky.app/profile/${escapeAttr(thread.post.author?.handle || '')}/post/${escapeAttr(String(thread.post.uri || '').split('/').pop())}`;
  return `<section class="comments bluesky" id="conversation"><h2>${count ? `${count} ${count === 1 ? 'reply' : 'replies'} on Bluesky` : 'Join the conversation on Bluesky'} <small><a href="${rootLink}" rel="nofollow">Reply to this post on Bluesky</a> — replies appear here at the next daily render.</small></h2>${replies.length ? `<ol class="comment-list">${replies.map(item).join('')}</ol>` : ''}</section>`;
}
function countReplies(node) { return (node.replies || []).filter((r) => r && r.post).reduce((n, r) => n + 1 + countReplies(r), 0); }
