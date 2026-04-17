// RSS feed builders and in-place mutations.
//
// Two variants for each post:
//   - excerpt form: used in feed/index.xml (smaller; subscribers pull full via link)
//   - full form:    used in feed/full.xml (archival; content:encoded has full HTML body)
//
// Surgery on existing XML is string-based, matching the
// `update-rss.yml` workflow and the legacy Post Generator behavior.
// Keeps whitespace/indent that WordPress' RSS emitter used so diffs
// stay minimal.

import { CONFIG } from './config.js';

const FEED_CHANNEL_DEFAULTS = {
  title: 'Learning is Change',
  description: 'Learning is Change — Thoughts on education, social justice, and making a difference.',
  link: CONFIG.site.base,
  language: 'en-US',
  creator: 'Ben Wilkoff',
  generator: 'Learning is Change Post Generator',
};

export function escapeXml(text) {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

// Build an <item> XML block for a post. `variant` is 'excerpt' or 'full'.
export function buildRssItem(post, { variant = 'excerpt', creator } = {}) {
  const pubDate = new Date(`${(post.date_published || post.date || '')}T12:00:00Z`).toUTCString();
  const permalink = toAbsoluteUrl(post.url || '');
  const categories = [];
  if (post.category) {
    categories.push(`<category><![CDATA[${post.category.name || post.category}]]></category>`);
  }
  for (const c of toArray(post.categories)) {
    const name = typeof c === 'string' ? c : c.name;
    if (name) categories.push(`<category><![CDATA[${name}]]></category>`);
  }
  for (const t of toArray(post.tags)) {
    const name = typeof t === 'string' ? t : t.name;
    if (name) categories.push(`<category><![CDATA[${name}]]></category>`);
  }

  const description = variant === 'full' ? (post.content || '') : (post.excerpt || '');
  const content = post.content || post.excerpt || '';
  const creatorName = creator || FEED_CHANNEL_DEFAULTS.creator;

  return `<item>
      <title>${escapeXml(post.title || 'Untitled')}</title>
      <link>${permalink}</link>
      <pubDate>${pubDate}</pubDate>
      <dc:creator><![CDATA[${creatorName}]]></dc:creator>
      <guid isPermaLink="true">${permalink}</guid>
      ${categories.join('\n      ')}
      <description><![CDATA[${description}]]></description>
      <content:encoded><![CDATA[${content}]]></content:encoded>
    </item>`;
}

// Insert a new <item> near the top of an existing RSS document and
// refresh <lastBuildDate>. Returns the updated XML string. If the
// post URL is already in the feed, replaces the existing <item>.
export function insertRssItem(rssXml, post, options = {}) {
  let xml = rssXml;
  const permalink = toAbsoluteUrl(post.url || '');
  const itemXml = buildRssItem(post, options);

  // Replace existing item by this URL, if present
  const existingRe = /<item>[\s\S]*?<\/item>/g;
  let replaced = false;
  xml = xml.replace(existingRe, (block) => {
    if (replaced) return block;
    if (block.includes(permalink + '<') || block.includes(permalink + '/')) {
      replaced = true;
      return itemXml;
    }
    return block;
  });

  if (!replaced) {
    // Insert after </generator>, fallback: before first <item>
    const genClose = xml.indexOf('</generator>');
    if (genClose !== -1) {
      const after = xml.indexOf('>', genClose) + 1;
      xml = xml.slice(0, after) + '\n    ' + itemXml + xml.slice(after);
    } else {
      const firstItem = xml.indexOf('<item>');
      if (firstItem !== -1) {
        xml = xml.slice(0, firstItem) + itemXml + '\n' + xml.slice(firstItem);
      }
    }
  }

  xml = xml.replace(
    /<lastBuildDate>.*?<\/lastBuildDate>/,
    `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
  );
  return xml;
}

// Remove the <item> whose <link> or <guid> matches the given post URL.
// Used by the Post Remover tool.
export function removeRssItem(rssXml, postUrl) {
  const target = toAbsoluteUrl(postUrl);
  const existingRe = /<item>[\s\S]*?<\/item>\s*/g;
  let removed = false;
  let xml = rssXml.replace(existingRe, (block) => {
    if (removed) return block;
    if (block.includes(target + '<') || block.includes(target + '/')) {
      removed = true;
      return '';
    }
    return block;
  });
  if (removed) {
    xml = xml.replace(
      /<lastBuildDate>.*?<\/lastBuildDate>/,
      `<lastBuildDate>${new Date().toUTCString()}</lastBuildDate>`,
    );
  }
  return xml;
}

// Minimal RSS 2.0 skeleton when feed/index.xml does not yet exist.
// Adds the supplied post as the only item.
export function newRssFeed(post, { channel = {}, variant = 'excerpt' } = {}) {
  const ch = { ...FEED_CHANNEL_DEFAULTS, ...channel };
  const now = new Date().toUTCString();
  const itemXml = buildRssItem(post, { variant, creator: ch.creator });
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
    xmlns:content="http://purl.org/rss/1.0/modules/content/"
    xmlns:wfw="http://wellformedweb.org/CommentAPI/"
    xmlns:dc="http://purl.org/dc/elements/1.1/"
    xmlns:atom="http://www.w3.org/2005/Atom"
    xmlns:sy="http://purl.org/rss/1.0/modules/syndication/"
    xmlns:slash="http://purl.org/rss/1.0/modules/slash/"
>
  <channel>
    <title>${escapeXml(ch.title)}</title>
    <atom:link href="${ch.link}/feed/" rel="self" type="application/rss+xml" />
    <link>${ch.link}</link>
    <description>${escapeXml(ch.description)}</description>
    <lastBuildDate>${now}</lastBuildDate>
    <language>${ch.language}</language>
    <sy:updatePeriod>hourly</sy:updatePeriod>
    <sy:updateFrequency>1</sy:updateFrequency>
    <generator>${escapeXml(ch.generator)}</generator>
    ${itemXml}
  </channel>
</rss>`;
}

function toAbsoluteUrl(url) {
  if (!url) return CONFIG.site.base;
  if (/^https?:\/\//i.test(url)) return url;
  const path = url.startsWith('/') ? url : `/${url}`;
  return `${CONFIG.site.base}${path}`;
}

function toArray(v) { return Array.isArray(v) ? v : []; }
