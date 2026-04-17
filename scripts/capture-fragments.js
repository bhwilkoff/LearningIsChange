#!/usr/bin/env node
// Extract each Fluida zone from a canonical page and write it to
// templates/fragments/<zone>.html. Run AFTER add-zone-markers has
// stamped that canonical page so we can extract precisely between
// markers.
//
// Usage:
//   node scripts/capture-fragments.js <source-html-path>
//
// Default source (if no arg): /2026/03/26/60-minutes-in-space/index.html

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..');
const OUT_DIR = path.join(REPO_ROOT, 'templates', 'fragments');

const ZONES = ['MASTHEAD', 'SIDEBAR', 'COLOPHON', 'FOOTER'];

function extract(html, zone) {
  const openMarker = `<!-- LIC:${zone}:START -->`;
  const closeMarker = `<!-- LIC:${zone}:END -->`;
  const startIdx = html.indexOf(openMarker);
  if (startIdx === -1) return null;
  const afterOpen = startIdx + openMarker.length;
  const endIdx = html.indexOf(closeMarker, afterOpen);
  if (endIdx === -1) return null;
  return html.slice(afterOpen, endIdx).trim();
}

function main() {
  const source = process.argv[2]
    ? path.resolve(process.argv[2])
    : path.join(REPO_ROOT, '2026/03/26/60-minutes-in-space/index.html');

  if (!fs.existsSync(source)) {
    console.error(`Source page not found: ${source}`);
    console.error('Run add-zone-markers.js --apply first on this page.');
    process.exit(1);
  }

  const html = fs.readFileSync(source, 'utf8');
  fs.mkdirSync(OUT_DIR, { recursive: true });

  console.log(`Source: ${path.relative(REPO_ROOT, source)}`);
  console.log(`Output: ${path.relative(REPO_ROOT, OUT_DIR)}/`);
  console.log('');

  let written = 0;
  for (const zone of ZONES) {
    const fragment = extract(html, zone);
    if (!fragment) {
      console.log(`  ${zone.padEnd(10)} — not found in source (markers missing?)`);
      continue;
    }
    const out = path.join(OUT_DIR, `${zone.toLowerCase()}.html`);
    fs.writeFileSync(out, fragment + '\n');
    console.log(`  ${zone.padEnd(10)} — wrote ${fragment.length} bytes → ${path.relative(REPO_ROOT, out)}`);
    written++;
  }
  console.log(`\n${written}/${ZONES.length} fragments captured.`);
}

main();
