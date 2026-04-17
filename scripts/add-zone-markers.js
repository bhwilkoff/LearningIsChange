#!/usr/bin/env node
// Wrap Fluida theme zones with LIC comment markers on every HTML page
// in the repo, so the regenerator can find and replace them later.
//
// Idempotent: pages already marked (found by looking for the open
// marker) are skipped per-zone. Running twice is safe.
//
// Zones:
//   LIC:MASTHEAD   — <header id="masthead">...</header>
//   LIC:SIDEBAR    — <aside id="primary">...</aside>
//   LIC:COLOPHON   — <aside id="colophon">...</aside>
//   LIC:FOOTER     — <footer id="footer">...</footer>
//
// Usage:
//   node scripts/add-zone-markers.js              # dry run
//   node scripts/add-zone-markers.js --apply      # write changes
//   node scripts/add-zone-markers.js --apply <path>  # limit scope
//
// The first form reports what would change without touching any files.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');

const ZONES = [
  { id: 'MASTHEAD', tag: 'header', attr: 'id="masthead"' },
  { id: 'SIDEBAR',  tag: 'aside',  attr: 'id="primary"' },
  { id: 'COLOPHON', tag: 'aside',  attr: 'id="colophon"' },
  { id: 'FOOTER',   tag: 'footer', attr: 'id="footer"' },
];

const SKIP_DIRS = new Set([
  '.git', 'node_modules',
  // Admin tools have their own HTML structure unrelated to Fluida
  'admin', 'new', 'edit', 'update', 'remove', 'archive-sync',
  'rss-creator', 'podcast-rss', 'menus', 'links', 'search',
  'database-generator', 'database',
  // Raw WP artifacts
  'wp-admin', 'wp-includes', 'wp-content',
  // Template / fragment output
  'templates', 'scripts',
]);

function* walkHtml(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walkHtml(full);
    } else if (entry.isFile() && entry.name.endsWith('.html')) {
      yield full;
    }
  }
}

// Find the index of the closing tag that matches the opening tag that
// starts at `openIdx`. Returns the index of the `<` of `</tag>`, or -1.
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
    const openM = openRe.exec(html);
    const closeM = closeRe.exec(html);
    if (!closeM) return -1;
    if (openM && openM.index < closeM.index) {
      depth++;
      pos = openM.index + openM[0].length;
    } else {
      depth--;
      if (depth === 0) return closeM.index;
      pos = closeM.index + closeM[0].length;
    }
  }
  return -1;
}

function wrapZone(html, zone) {
  const openMarker = `<!-- LIC:${zone.id}:START -->`;
  const closeMarker = `<!-- LIC:${zone.id}:END -->`;
  if (html.includes(openMarker)) return { html, changed: false, reason: 'already-marked' };

  const openRe = new RegExp(`<${zone.tag}[^>]*${zone.attr}[^>]*>`, 'i');
  const match = html.match(openRe);
  if (!match) return { html, changed: false, reason: 'not-found' };
  const openIdx = match.index;

  const closeIdx = findMatchingClose(html, openIdx, zone.tag);
  if (closeIdx === -1) return { html, changed: false, reason: 'no-close' };

  const afterClose = html.indexOf('>', closeIdx) + 1;
  const next = html.slice(0, openIdx)
    + openMarker + '\n'
    + html.slice(openIdx, afterClose)
    + '\n' + closeMarker
    + html.slice(afterClose);
  return { html: next, changed: true, reason: 'wrapped' };
}

function processFile(filepath, apply) {
  const original = fs.readFileSync(filepath, 'utf8');
  let html = original;
  const zoneStatus = {};
  for (const zone of ZONES) {
    const result = wrapZone(html, zone);
    html = result.html;
    zoneStatus[zone.id] = result.reason;
  }
  const changed = html !== original;
  if (apply && changed) fs.writeFileSync(filepath, html);
  return { changed, zoneStatus };
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const scopeArgs = args.filter(a => !a.startsWith('--'));
  const root = scopeArgs[0] ? path.resolve(scopeArgs[0]) : REPO_ROOT;

  const summary = {
    total: 0, changed: 0,
    zones: Object.fromEntries(ZONES.map(z => [z.id, { wrapped: 0, already: 0, missing: 0, noclose: 0 }])),
  };

  for (const fp of walkHtml(root)) {
    summary.total++;
    const { changed, zoneStatus } = processFile(fp, apply);
    if (changed) summary.changed++;
    for (const z of ZONES) {
      const s = zoneStatus[z.id];
      const bucket = s === 'wrapped' ? 'wrapped'
        : s === 'already-marked' ? 'already'
        : s === 'not-found' ? 'missing'
        : 'noclose';
      summary.zones[z.id][bucket]++;
    }
  }

  console.log(`${apply ? 'APPLIED' : 'DRY RUN'} — scanned ${summary.total} HTML files, ${summary.changed} would change\n`);
  console.log('Per-zone breakdown:');
  for (const z of ZONES) {
    const s = summary.zones[z.id];
    console.log(`  ${z.id.padEnd(10)} wrapped=${String(s.wrapped).padStart(5)}  already=${String(s.already).padStart(5)}  missing=${String(s.missing).padStart(5)}  noclose=${String(s.noclose).padStart(3)}`);
  }
  if (!apply) console.log('\nRun again with --apply to write changes.');
}

main();
