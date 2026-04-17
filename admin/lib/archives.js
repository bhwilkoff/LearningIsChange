// Archive-page HTML surgery.
//
// Every archive page (`/YYYY/`, `/YYYY/MM/`, `/category/<slug>/`,
// `/tag/<slug>/`, `/author/<slug>/`, `/`) has the same Fluida shape:
// a container like `<main id="main">` or `<div id="content-masonry">`
// that holds `<article>` blocks. To add a post to an archive we fetch
// the existing page and splice the new article in after the container's
// opening tag. The sidebar's month list also gets an entry.
//
// This module does string-based insertion (matching the legacy tool)
// rather than DOM parsing to avoid perturbing whitespace, comments,
// and script tags that we don't want the HTML serializer to "clean up".
//
// After M3 (zone markers) this file can be replaced by a cleaner
// marker-based insertion; for now we preserve the legacy approach.

import { CONFIG } from './config.js';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

const CONTAINER_SELECTORS = [
  '<div id="content-masonry"',
  '<main id="main"',
  '<div id="main"',
  '<main',
];

// Insert an `<article>...</article>` block into an archive page's
// primary content container. Returns new HTML string.
export function insertArticleIntoPage(pageHtml, articleHtml) {
  for (const selector of CONTAINER_SELECTORS) {
    const openIdx = pageHtml.indexOf(selector);
    if (openIdx === -1) continue;
    const tagEnd = pageHtml.indexOf('>', openIdx);
    if (tagEnd === -1) continue;
    return pageHtml.slice(0, tagEnd + 1) + '\n' + articleHtml + '\n' + pageHtml.slice(tagEnd + 1);
  }

  // Fallback 1: before the first existing <article>
  const articleIdx = pageHtml.indexOf('<article');
  if (articleIdx !== -1) {
    return pageHtml.slice(0, articleIdx) + articleHtml + '\n' + pageHtml.slice(articleIdx);
  }

  // Fallback 2: after <body>
  const bodyIdx = pageHtml.indexOf('<body');
  if (bodyIdx !== -1) {
    const bodyEnd = pageHtml.indexOf('>', bodyIdx);
    if (bodyEnd !== -1) {
      return pageHtml.slice(0, bodyEnd + 1) + '\n' + articleHtml + '\n' + pageHtml.slice(bodyEnd + 1);
    }
  }

  return pageHtml;
}

// Ensure the sidebar archives list has a link for {year}/{month}.
// Idempotent: if the month is already linked anywhere in the page,
// returns the input unchanged.
export function updateSidebarInPage(pageHtml, year, month) {
  const mm = String(month).padStart(2, '0');
  if (pageHtml.includes(`/${year}/${mm}/"`)) return pageHtml;

  const monthName = MONTH_NAMES[parseInt(mm, 10) - 1];
  const newLi = `<li><a href="/${year}/${mm}/">${monthName} ${year}</a></li>`;

  const listPatterns = [
    /<ul[^>]*class="[^"]*wp-block-archives[^"]*"[^>]*>/i,
    /<ul[^>]*class="[^"]*archives[^"]*"[^>]*>/i,
    /<section[^>]*widget_archive[^>]*>[\s\S]*?<ul[^>]*>/i,
  ];
  for (const pattern of listPatterns) {
    const match = pageHtml.match(pattern);
    if (!match) continue;
    const insertAt = match.index + match[0].length;
    return pageHtml.slice(0, insertAt) + '\n' + newLi + pageHtml.slice(insertAt);
  }
  return pageHtml;
}

// Remove an <article> block from an archive page by matching its
// canonical URL. Used by the Post Remover.
export function removeArticleFromPage(pageHtml, postUrl) {
  const url = postUrl.replace(/^https?:\/\/[^/]+/, '');
  // Find the <article...> ... </article> that contains this URL
  const re = /<article[\s\S]*?<\/article>/g;
  return pageHtml.replace(re, (block) => {
    if (block.includes(url + '"') || block.includes(url + '/')) return '';
    return block;
  });
}

// Fetch an existing archive page from Pages to use as a template for
// new archives (year / month / category / tag / author). Tries a few
// known-to-exist paths in priority order, caches the first hit.
let _cachedTemplate = null;
export async function fetchArchiveTemplate() {
  if (_cachedTemplate) return _cachedTemplate;
  const candidates = [
    `${CONFIG.site.base}/2024/07/`,
    `${CONFIG.site.base}/2024/06/`,
    `${CONFIG.site.base}/2022/03/`,
    `${CONFIG.site.base}/`,
  ];
  for (const url of candidates) {
    try {
      const r = await fetch(url);
      if (r.ok) {
        _cachedTemplate = await r.text();
        return _cachedTemplate;
      }
    } catch { /* try next */ }
  }
  return null;
}

export function buildBreadcrumb(segments) {
  return segments.map((s, i) =>
    i < segments.length - 1 && s.href
      ? `<a href="${s.href}">${escapeHtml(s.label)}</a>`
      : escapeHtml(s.label)
  ).join(' › ');
}

function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

// Create a basic <article> block for a post. Called once per
// archive / homepage update. For M4+ this will be replaced by a
// template-based renderer reading from the JSON database.
export function buildArticleBlock(post) {
  const title = escapeHtml(post.title || 'Untitled');
  const url = post.url || '#';
  const date = post.date_published || post.date || '';
  const excerpt = post.excerpt || post.content_preview || '';
  const monthName = date && date.length >= 7
    ? MONTH_NAMES[parseInt(date.slice(5, 7), 10) - 1]
    : '';
  const day = date.slice(8, 10);
  const year = date.slice(0, 4);
  const friendlyDate = monthName ? `${monthName} ${parseInt(day, 10)}, ${year}` : '';
  return `<article class="post type-post status-publish format-standard hentry">
  <header class="entry-header">
    <h2 class="entry-title"><a href="${url}" rel="bookmark">${title}</a></h2>
    <div class="entry-meta">
      <span class="posted-on"><time datetime="${date}">${friendlyDate}</time></span>
    </div>
  </header>
  <div class="entry-summary">
    <p>${escapeHtml(excerpt)}</p>
  </div>
</article>`;
}

export { MONTH_NAMES };
