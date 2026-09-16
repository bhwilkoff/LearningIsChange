#!/usr/bin/env node
// Keep hand-authored pages (portfolio/*, support.html, meet/) on the same
// shell as the rendered site: splice templates/partials/nav.html and
// footer.html into their LIC:NAV / LIC:FOOTER marker blocks, with the
// active nav item chosen from the page URL. Idempotent.
//
//   node scripts/render-shell.js          # dry run
//   node scripts/render-shell.js --apply

import fs from 'node:fs';
import path from 'node:path';
import { REPO_ROOT, nav, footer, rail, navKeyFor, loadAllPosts, loadTaxonomies } from './lib/shell.js';

const APPLY = process.argv.includes('--apply');
const FILES = ['support.html', 'meet/index.html', 'search/index.html', 'portfolio/index.html',
  ...fs.readdirSync(path.join(REPO_ROOT, 'portfolio'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(REPO_ROOT, 'portfolio', e.name, 'index.html')))
    .map((e) => `portfolio/${e.name}/index.html`)];

function splice(html, zone, replacement) {
  const open = `<!-- LIC:${zone}:START -->`, close = `<!-- LIC:${zone}:END -->`;
  const i = html.indexOf(open), j = html.indexOf(close, i);
  if (i === -1 || j === -1) return html;
  return html.slice(0, i + open.length) + '\n' + replacement + '\n' + html.slice(j);
}

const RAIL = rail(loadAllPosts(), loadTaxonomies());
let changed = 0;
for (const rel of FILES) {
  const f = path.join(REPO_ROOT, rel);
  const url = '/' + rel.replace(/index\.html$/, '');
  const prior = fs.readFileSync(f, 'utf8');
  let html = splice(prior, 'NAV', nav({ active: navKeyFor(url) }));
  html = splice(html, 'RAIL', RAIL);
  html = splice(html, 'FOOTER', footer());
  if (html === prior) continue;
  changed++;
  if (APPLY) fs.writeFileSync(f, html);
  console.log(`${APPLY ? 'updated' : 'would update'} ${rel}`);
}
console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'} — ${FILES.length} shell pages, ${changed} changed`);
