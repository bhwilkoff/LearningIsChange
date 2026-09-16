// Dev-only helper (needs `npm i acorn acorn-walk` in a scratch dir; run with NODE_PATH pointing there).
// Usage: node scripts/dev-deadcode.mjs <tool>/index.html [--apply]  — see docs/MODERNIZATION-AUDIT.md tick 23.
// Remove unreferenced top-level function declarations from the main inline
// script of an admin tool. Iterates until stable. Prints what it removed.
import fs from 'node:fs';
import * as acorn from 'acorn';
import * as walk from 'acorn-walk';
const [,, file, applyFlag] = process.argv;
let html = fs.readFileSync(file, 'utf8');
const re = /<script(?![^>]*src=)([^>]*)>([\s\S]*?)<\/script>/g;
let m, blocks = [];
while ((m = re.exec(html))) blocks.push({ attrs: m[1], start: m.index + m[0].indexOf(m[2]), end: m.index + m[0].indexOf(m[2]) + m[2].length });
const main = blocks.reduce((a, b) => (b.end - b.start > a.end - a.start ? b : a));
let code = html.slice(main.start, main.end);
const keep = new Set((process.env.KEEP || '').split(',').filter(Boolean));
let removed = [];
for (let round = 0; round < 10; round++) {
  const ast = acorn.parse(code, { ecmaVersion: 'latest', sourceType: 'script', allowHashBang: true });
  const decls = ast.body.filter((n) => n.type === 'FunctionDeclaration').map((n) => ({ name: n.id.name, start: n.start, end: n.end }));
  // count identifier references (excluding the declaration's own id)
  const refs = new Map();
  walk.full(ast, (n) => { if (n.type === 'Identifier') refs.set(n.name, (refs.get(n.name) || 0) + 1); });
  // references from the HTML outside the script (onclick="fn()" etc.) and other script blocks
  const outside = html.slice(0, main.start) + html.slice(main.end);
  // dead only if the name appears nowhere else — not as an identifier, not inside any string/template in the whole document
  const doc = html.slice(0, main.start) + code + html.slice(main.end);
  const dead = decls.filter((d) => !keep.has(d.name) && (refs.get(d.name) || 0) <= 1 && (doc.match(new RegExp(`\\b${d.name}\\b`, 'g')) || []).length <= 1);
  if (!dead.length) break;
  dead.sort((a, b) => b.start - a.start);
  for (const d of dead) {
    // also eat the preceding comment block / blank lines
    let s = d.start;
    const before = code.slice(0, s);
    const mm = /(?:\n[ \t]*(?:\/\/[^\n]*|\/\*[\s\S]*?\*\/)[ \t]*)*\n[ \t]*$/.exec(before);
    if (mm) s = mm.index + 1;
    code = code.slice(0, s) + code.slice(d.end);
    removed.push(d.name);
  }
}
console.log(`removed ${removed.length} functions: ${removed.join(', ')}`);
if (applyFlag === '--apply') { fs.writeFileSync(file, html.slice(0, main.start) + code + html.slice(main.end)); console.log('written'); }
