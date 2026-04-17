#!/usr/bin/env node
// Walk every HTML page, replace the content inside each
// LIC:<ZONE>:START / LIC:<ZONE>:END block with the corresponding
// fragment from templates/fragments/. Idempotent.
//
// Usage:
//   node scripts/regenerate-fragments.js              # dry run
//   node scripts/regenerate-fragments.js --apply      # write changes
//   node scripts/regenerate-fragments.js --apply --zones=MASTHEAD,FOOTER
//
// Pages without markers for a given zone are skipped (run
// add-zone-markers.js --apply first).

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const FRAGMENTS_DIR = path.join(REPO_ROOT, 'templates', 'fragments');

const ALL_ZONES = ['MASTHEAD', 'SIDEBAR', 'COLOPHON', 'FOOTER'];

const SKIP_DIRS = new Set([
  '.git', 'node_modules',
  'admin', 'new', 'edit', 'update', 'remove', 'archive-sync',
  'rss-creator', 'podcast-rss', 'menus', 'links', 'search',
  'database-generator', 'database',
  'wp-admin', 'wp-includes', 'wp-content',
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

function replaceZone(html, zone, fragment) {
  const openMarker = `<!-- LIC:${zone}:START -->`;
  const closeMarker = `<!-- LIC:${zone}:END -->`;
  const startIdx = html.indexOf(openMarker);
  if (startIdx === -1) return { html, changed: false, reason: 'no-marker' };
  const afterOpen = startIdx + openMarker.length;
  const endIdx = html.indexOf(closeMarker, afterOpen);
  if (endIdx === -1) return { html, changed: false, reason: 'unclosed' };

  const existing = html.slice(afterOpen, endIdx);
  const replacement = '\n' + fragment + '\n';
  if (existing === replacement) return { html, changed: false, reason: 'unchanged' };

  const next = html.slice(0, afterOpen) + replacement + html.slice(endIdx);
  return { html: next, changed: true, reason: 'updated' };
}

function loadFragments(zones) {
  const out = {};
  for (const zone of zones) {
    const p = path.join(FRAGMENTS_DIR, `${zone.toLowerCase()}.html`);
    if (!fs.existsSync(p)) {
      console.error(`Missing fragment: ${p}`);
      process.exit(1);
    }
    out[zone] = fs.readFileSync(p, 'utf8').trimEnd();
  }
  return out;
}

function main() {
  const args = process.argv.slice(2);
  const apply = args.includes('--apply');
  const zonesArg = args.find(a => a.startsWith('--zones='));
  const zones = zonesArg
    ? zonesArg.slice('--zones='.length).split(',').map(s => s.trim().toUpperCase()).filter(Boolean)
    : ALL_ZONES;
  for (const z of zones) if (!ALL_ZONES.includes(z)) {
    console.error(`Unknown zone: ${z}`); process.exit(1);
  }

  const fragments = loadFragments(zones);
  const summary = { total: 0, changed: 0, perZone: Object.fromEntries(zones.map(z => [z, { updated: 0, unchanged: 0, noMarker: 0, unclosed: 0 }])) };

  for (const fp of walkHtml(REPO_ROOT)) {
    summary.total++;
    let html = fs.readFileSync(fp, 'utf8');
    let fileChanged = false;
    for (const zone of zones) {
      const r = replaceZone(html, zone, fragments[zone]);
      html = r.html;
      const bucket = r.reason === 'updated' ? 'updated'
        : r.reason === 'unchanged' ? 'unchanged'
        : r.reason === 'no-marker' ? 'noMarker'
        : 'unclosed';
      summary.perZone[zone][bucket]++;
      if (r.changed) fileChanged = true;
    }
    if (fileChanged) {
      summary.changed++;
      if (apply) fs.writeFileSync(fp, html);
    }
  }

  console.log(`${apply ? 'APPLIED' : 'DRY RUN'} — scanned ${summary.total} HTML files, ${summary.changed} would change`);
  console.log(`Zones: ${zones.join(', ')}\n`);
  for (const z of zones) {
    const s = summary.perZone[z];
    console.log(`  ${z.padEnd(10)} updated=${String(s.updated).padStart(5)}  unchanged=${String(s.unchanged).padStart(5)}  noMarker=${String(s.noMarker).padStart(5)}  unclosed=${s.unclosed}`);
  }
  if (!apply) console.log('\nRun again with --apply to write changes.');
}

main();
