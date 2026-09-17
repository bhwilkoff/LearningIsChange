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

// ---- Podcast (database/podcast.json + posts with a `podcast` field) --------
// Item GUID = the post URL (as the retired /podcast-rss/ tool wrote it), so
// subscribers see no re-downloads. Enclosure length is refreshed from the
// file on disk when it exists; the stored length is the fallback.
const MIME = { mp3: 'audio/mpeg', m4a: 'audio/mp4', mp4: 'audio/mp4', aac: 'audio/aac', ogg: 'audio/ogg', wav: 'audio/wav', m4v: 'video/mp4' };
function podcastItem(p) {
  const pc = p.podcast; const d = dates(p);
  const audio = String(pc.audio || '');
  const abs = audio.startsWith('/') ? SITE + audio : audio;
  let length = Number(pc.length) || 0;
  try { if (audio.startsWith('/')) length = fs.statSync(path.join(REPO_ROOT, decodeURIComponent(audio.slice(1)))).size; } catch { /* file not in repo (see media library → broken references) */ }
  const type = pc.type || MIME[audio.split('.').pop().toLowerCase()] || 'audio/mpeg';
  const summary = pc.summary || describe(p, 200);
  return `    <item>
      <title>${esc(unescapeEntities(p.title || 'Untitled'))}</title>
      <link>${SITE}${p.url}</link>
      <guid isPermaLink="true">${SITE}${p.url}</guid>
      <pubDate>${rfc822(d.iso)}</pubDate>
      <description>${cdata(summary)}</description>
      <enclosure url="${esc(abs)}" type="${esc(type)}" length="${length}"/>
      <itunes:title>${esc(unescapeEntities(p.title || 'Untitled'))}</itunes:title>
      <itunes:summary>${cdata(summary)}</itunes:summary>${pc.duration ? `\n      <itunes:duration>${esc(pc.duration)}</itunes:duration>` : ''}${pc.episode ? `\n      <itunes:episode>${Number(pc.episode)}</itunes:episode>` : ''}${pc.season ? `\n      <itunes:season>${Number(pc.season)}</itunes:season>` : ''}
      <itunes:episodeType>${esc(pc.episode_type || 'full')}</itunes:episodeType>
      <itunes:explicit>${pc.explicit ? 'true' : 'false'}</itunes:explicit>
    </item>`;
}
function podcastFeed(episodes) {
  const c = JSON.parse(fs.readFileSync(path.join(REPO_ROOT, 'database', 'podcast.json'), 'utf8')).channel;
  const img = c.image && c.image.startsWith('/') ? SITE + c.image : c.image;
  const now = new Date().toUTCString().replace(/GMT$/, '+0000');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
    xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd"
    xmlns:content="http://purl.org/rss/1.0/modules/content/"
    xmlns:atom="http://www.w3.org/2005/Atom"
    xmlns:googleplay="http://www.google.com/schemas/play-podcasts/1.0"
>
  <channel>
    <title>${esc(c.title)}</title>
    <link>${esc(c.link || SITE)}</link>
    <description>${esc(c.description)}</description>
    <language>${esc(c.language || 'en-us')}</language>
    <copyright>${esc(c.copyright || '')}</copyright>
    <lastBuildDate>${now}</lastBuildDate>
    <pubDate>${episodes.length ? rfc822(dates(episodes[0]).iso) : now}</pubDate>
    <generator>Learning is Change (scripts/render-feeds.js)</generator>

    <atom:link href="${SITE}/feed/podcast/" rel="self" type="application/rss+xml"/>

    <itunes:author>${esc(c.author)}</itunes:author>
    <itunes:summary>${esc(c.description)}</itunes:summary>
    <itunes:type>${esc(c.type || 'episodic')}</itunes:type>
    <itunes:owner>
      <itunes:name>${esc(c.owner_name || c.author)}</itunes:name>
      <itunes:email>${esc(c.owner_email || '')}</itunes:email>
    </itunes:owner>
    <itunes:explicit>${c.explicit ? 'true' : 'false'}</itunes:explicit>
    <itunes:category text="${esc(c.category || 'Education')}"/>
    <itunes:image href="${esc(img)}"/>

    <image>
      <url>${esc(img)}</url>
      <title>${esc(c.title)}</title>
      <link>${esc(c.link || SITE)}</link>
    </image>

    <googleplay:author>${esc(c.author)}</googleplay:author>
    <googleplay:description>${esc(c.description)}</googleplay:description>
    <googleplay:image href="${esc(img)}"/>
    <googleplay:explicit>${c.explicit ? 'yes' : 'no'}</googleplay:explicit>
    <googleplay:category text="${esc(c.category || 'Education')}"/>

${episodes.map(podcastItem).join('\n\n')}
  </channel>
</rss>
`;
}

const newest = loadAllPosts().reverse().filter((p) => p.content !== undefined);
const episodes = newest.filter((p) => p.podcast && p.podcast.audio);
const outputs = [
  ['feed/index.xml', feed(newest.slice(0, INDEX_COUNT), '/feed/')],
  ['feed/full.xml', feed(newest, '/feed/full.xml')],
  ['feed/podcast/feed.xml', podcastFeed(episodes)],
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
