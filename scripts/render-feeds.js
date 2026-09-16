#!/usr/bin/env node
// Render the blog RSS feeds from database/posts/*.json (Decision 014).
//   feed/index.xml  newest 50 posts (excerpt feed, what readers subscribe to)
//   feed/full.xml   every post
// The podcast feed (feed/podcast/feed.xml) is NOT touched — it has its own tool.
//
// GUIDs are the permalink (isPermaLink="true"), so they are stable by
// construction; check-permalinks.js enforces that every GUID that has ever
// been in full.xml is still there.
//
//   node scripts/render-feeds.js            # dry run
//   node scripts/render-feeds.js --apply

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, SITE, SITE_NAME, describe, dates, terms, loadAllPosts, unescapeEntities, selfHostImages } from './lib/shell.js';

const APPLY = process.argv.includes('--apply');
const INDEX_COUNT = 50;
const DESCRIPTION = 'Learning is Change - Thoughts on education, social justice, and making a difference.';

const cdata = (s) => `<![CDATA[${String(s ?? '').replace(/\]\]>/g, ']]]]><![CDATA[>')}]]>`;
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const rfc822 = (iso) => { const d = new Date(iso); return isNaN(d) ? '' : d.toUTCString().replace(/GMT$/, '+0000'); };
// Feed readers have no base URL: make site-relative src/href absolute (feed-only transform)
const absolutize = (html) => String(html || '').replace(/(\s(?:src|href|poster))=(["'])\/(?!\/)/g, `$1=$2${SITE}/`);

function item(p) {
  const d = dates(p);
  const cats = [...terms(p, 'categories'), ...terms(p, 'tags')].filter((t) => t.slug !== 'ben-wilkoff' && t.slug !== 'uncategorized' && t.slug !== 'blog-2');
  return `    <item>
      <title>${esc(unescapeEntities(p.title || 'Untitled'))}</title>
      <link>${SITE}${p.url}</link>
      <pubDate>${rfc822(d.iso)}</pubDate>
      <dc:creator>${cdata('Ben')}</dc:creator>
      <guid isPermaLink="true">${SITE}${p.url}</guid>
${cats.map((c) => `      <category>${cdata(c.name)}</category>`).join('\n')}${cats.length ? '\n' : ''}      <description>${cdata(describe(p, 300))}</description>
      <content:encoded>${cdata(absolutize(selfHostImages(p.content)))}</content:encoded>
    </item>`;
}

function feed(posts, self) {
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
    <title>${esc(SITE_NAME)}</title>
    <atom:link href="${SITE}${self}" rel="self" type="application/rss+xml" />
    <link>${SITE}</link>
    <description>${esc(DESCRIPTION)}</description>
    <lastBuildDate>${new Date().toUTCString().replace(/GMT$/, '+0000')}</lastBuildDate>
    <language>en-US</language>
    <sy:updatePeriod>hourly</sy:updatePeriod>
    <sy:updateFrequency>1</sy:updateFrequency>
    <generator>Learning is Change (scripts/render-feeds.js)</generator>
${posts.map(item).join('\n')}
  </channel>
</rss>
`;
}

const newest = loadAllPosts().reverse().filter((p) => p.content !== undefined);
const outputs = [
  ['feed/index.xml', feed(newest.slice(0, INDEX_COUNT), '/feed/')],
  ['feed/full.xml', feed(newest, '/feed/full.xml')],
];
for (const [rel, xml] of outputs) {
  const f = path.join(REPO_ROOT, rel);
  const prior = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  const items = (xml.match(/<item>/g) || []).length;
  const priorItems = (prior.match(/<item>/g) || []).length;
  if (APPLY) fs.writeFileSync(f, xml);
  console.log(`${APPLY ? 'wrote' : 'would write'} ${rel}: ${items} items (was ${priorItems}), ${(xml.length / 1048576).toFixed(1)} MB`);
}
if (!APPLY) console.log('Run again with --apply to write files.');
