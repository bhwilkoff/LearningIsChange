#!/usr/bin/env node
// Capture a canonical post HTML file as templates/post.html with
// {{placeholder}} slots for post-specific data. The template preserves
// all Fluida theme markup including the LIC:<ZONE> fragment markers,
// so regenerate-fragments continues to work on posts produced from
// this template.
//
// Usage:
//   node scripts/capture-post-template.js
//   node scripts/capture-post-template.js <path-to-source-post>
//
// Default source: 2026/03/26/60-minutes-in-space/index.html
//
// Placeholders produced (matched by regenerate-posts.js):
//   {{title}}             post title (HTML-escaped)
//   {{content}}           rendered post body HTML (from database/posts/YYYY.json .content)
//   {{excerpt}}           post excerpt (HTML-escaped; used in og:description)
//   {{url}}               relative URL, e.g. /2026/03/26/my-post/
//   {{abs_url}}           absolute URL including host
//   {{date_iso}}          ISO date+time, e.g. 2026-03-26T12:00:00+00:00
//   {{date_formatted}}    human-readable, e.g. "March 26, 2026"
//   {{post_id}}           slug or numeric id
//   {{body_classes}}      "category-x tag-y tag-z" (for <body>)
//   {{article_classes}}   same shape (for <article>)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const DEFAULT_SOURCE = path.join(REPO_ROOT, '2026/03/26/60-minutes-in-space/index.html');
const OUT = path.join(REPO_ROOT, 'templates', 'post.html');

const srcPath = process.argv[2] ? path.resolve(process.argv[2]) : DEFAULT_SOURCE;
if (!fs.existsSync(srcPath)) {
  console.error(`Source not found: ${srcPath}`);
  process.exit(1);
}

let html = fs.readFileSync(srcPath, 'utf8');
const before = html.length;

const replacements = [
  // <title>...</title> — first occurrence only (non-greedy match of first <title>)
  [/<title>[^<]*<\/title>/, '<title>{{title}} – Learning is Change</title>'],
  // canonical
  [/<link\s+rel="canonical"\s+href="[^"]*"\s*\/?>/, '<link rel="canonical" href="{{abs_url}}">'],
  // <body> class — preserve the stable class tokens, templatize the dynamic part
  [
    /<body class="single single-post postid-\w+ single-format-standard hentry[^"]*"/,
    '<body class="single single-post postid-{{post_id}} single-format-standard hentry {{body_classes}}"',
  ],
  // <article id+class>
  [
    /<article id="post-\w+" class="post-\w+ post type-post status-publish format-standard hentry[^"]*"/,
    '<article id="post-{{post_id}}" class="post-{{post_id}} post type-post status-publish format-standard hentry {{article_classes}}"',
  ],
  // <h1 class="entry-title">...</h1>
  [
    /<h1 class="entry-title" itemprop="headline">[^<]*<\/h1>/,
    '<h1 class="entry-title" itemprop="headline">{{title}}</h1>',
  ],
  // Published date
  [
    /<time class="published" datetime="[^"]*" itemprop="datePublished">[^<]*<\/time>/,
    '<time class="published" datetime="{{date_iso}}" itemprop="datePublished">{{date_formatted}}</time>',
  ],
  // Updated date
  [
    /<time class="updated" datetime="[^"]*" itemprop="dateModified">[^<]*<\/time>/,
    '<time class="updated" datetime="{{date_iso}}" itemprop="dateModified">{{date_formatted}}</time>',
  ],
  // <link itemprop="mainEntityOfPage">
  [
    /<link itemprop="mainEntityOfPage" href="[^"]*">/,
    '<link itemprop="mainEntityOfPage" href="{{url}}">',
  ],
];

for (const [re, sub] of replacements) {
  if (!re.test(html)) {
    console.warn(`  WARN: pattern not found, skipping: ${re.toString().slice(0, 80)}`);
    continue;
  }
  html = html.replace(re, sub);
}

// Entry content: tricky. We want to replace everything inside
// <div class="entry-content" itemprop="articleBody">...</div> with
// a single {{content}} placeholder. Use a depth-tracking find for
// the matching </div>.
html = replaceEntryContent(html);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, html);

const placeholders = [...new Set(html.match(/\{\{\w+\}\}/g) || [])];
console.log(`Source:  ${path.relative(REPO_ROOT, srcPath)}`);
console.log(`Output:  ${path.relative(REPO_ROOT, OUT)}  (${html.length} bytes, input was ${before})`);
console.log(`Placeholders: ${placeholders.join(', ')}`);

// ---- helpers ----

function replaceEntryContent(html) {
  const openRe = /<div class="entry-content" itemprop="articleBody">/;
  const m = html.match(openRe);
  if (!m) { console.warn('  WARN: entry-content div not found'); return html; }
  const openIdx = m.index;
  const afterOpen = openIdx + m[0].length;
  const closeIdx = findMatchingClose(html, openIdx, 'div');
  if (closeIdx === -1) { console.warn('  WARN: could not find closing </div> for entry-content'); return html; }
  return html.slice(0, afterOpen) + '\n{{content}}\n' + html.slice(closeIdx);
}

function findMatchingClose(html, openIdx, tagName) {
  const openTagEnd = html.indexOf('>', openIdx);
  if (openTagEnd === -1) return -1;
  const openRe = new RegExp(`<${tagName}\\b`, 'gi');
  const closeRe = new RegExp(`</${tagName}\\s*>`, 'gi');
  let pos = openTagEnd + 1;
  let depth = 1;
  while (depth > 0) {
    openRe.lastIndex = pos;
    closeRe.lastIndex = pos;
    const oM = openRe.exec(html);
    const cM = closeRe.exec(html);
    if (!cM) return -1;
    if (oM && oM.index < cM.index) { depth++; pos = oM.index + oM[0].length; }
    else { depth--; if (depth === 0) return cM.index; pos = cM.index + cM[0].length; }
  }
  return -1;
}
