#!/usr/bin/env node
// Media index: every file under wp-content/uploads/ and where the site uses it.
//
//   node scripts/index-media.js            dry run (prints the summary)
//   node scripts/index-media.js --apply    writes database/media.json
//
// Referrers scanned: post + page bodies/excerpts and `podcast.audio` in
// database/ (drafts and tombstones included — a hidden post still "uses" its
// files), the podcast channel artwork, and the hand-written shell (templates,
// portfolio, meet, support). Resize variants (name-300x200.jpg) fold into their original.
// Referenced paths with no file in the repo are listed as `missing`.
// Image dimensions come from the file headers (PNG/GIF/JPEG/WebP), so the
// whole run is stat + a few KB per file — no full reads of 1.3 GB.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const UPLOADS = 'wp-content/uploads';
const APPLY = process.argv.includes('--apply');
const OUT = path.join(ROOT, 'database/media.json');

const KIND = { jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', svg: 'image', avif: 'image',
  mp3: 'audio', m4a: 'audio', wav: 'audio', ogg: 'audio', mp4: 'video', mov: 'video', m4v: 'video', webm: 'video', flv: 'video',
  pdf: 'doc', doc: 'doc', docx: 'doc', ppt: 'doc', pptx: 'doc', xls: 'doc', xlsx: 'doc', txt: 'doc', xml: 'doc', zip: 'doc' };

// ---- walk the uploads tree ----------------------------------------------
const files = new Map(); // repo-relative path -> record
(function walk(dir) {
  for (const e of fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true })) {
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) { walk(rel); continue; }
    if (e.name === '.DS_Store') continue;
    const ext = e.name.split('.').pop().toLowerCase();
    const m = /^wp-content\/uploads\/(\d{4})\/(\d{2})\//.exec(rel);
    const st = fs.statSync(path.join(ROOT, rel));
    files.set(rel, { path: rel, bytes: st.size, ext, kind: KIND[ext] || 'other', year: m ? m[1] : '', month: m ? m[2] : '', used_by: [], variants: [] });
  }
})(UPLOADS);

// ---- image dimensions from headers -------------------------------------
function dims(rel, ext) {
  const fd = fs.openSync(path.join(ROOT, rel), 'r');
  try {
    const buf = Buffer.alloc(64 * 1024); const n = fs.readSync(fd, buf, 0, buf.length, 0); const b = buf.subarray(0, n);
    if (ext === 'png' && b.readUInt32BE(0) === 0x89504e47) return [b.readUInt32BE(16), b.readUInt32BE(20)];
    if (ext === 'gif' && b.toString('latin1', 0, 3) === 'GIF') return [b.readUInt16LE(6), b.readUInt16LE(8)];
    if (ext === 'webp' && b.toString('latin1', 8, 12) === 'WEBP') {
      const c = b.toString('latin1', 12, 16);
      if (c === 'VP8 ') return [b.readUInt16LE(26) & 0x3fff, b.readUInt16LE(28) & 0x3fff];
      if (c === 'VP8L') { const x = b.readUInt32LE(21); return [(x & 0x3fff) + 1, ((x >> 14) & 0x3fff) + 1]; }
      if (c === 'VP8X') return [(b.readUIntLE(24, 3)) + 1, (b.readUIntLE(27, 3)) + 1];
    }
    if ((ext === 'jpg' || ext === 'jpeg') && b[0] === 0xff && b[1] === 0xd8) {
      let i = 2;
      while (i + 9 < b.length) {
        if (b[i] !== 0xff) { i++; continue; }
        const marker = b[i + 1];
        if (marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7) || marker === 0x01 || marker === 0xff) { i += 2; continue; }
        const len = b.readUInt16BE(i + 2);
        if ((marker >= 0xc0 && marker <= 0xcf) && ![0xc4, 0xc8, 0xcc].includes(marker)) return [b.readUInt16BE(i + 7), b.readUInt16BE(i + 5)];
        i += 2 + len;
      }
    }
  } catch { /* unreadable header: no dims */ } finally { fs.closeSync(fd); }
  return null;
}
for (const f of files.values()) if (f.kind === 'image' && f.ext !== 'svg') { const d = dims(f.path, f.ext); if (d && d[0] && d[1]) { f.w = d[0]; f.h = d[1]; } }

// ---- fold resize variants into their original --------------------------
for (const f of [...files.values()]) {
  const m = /^(.*)-\d+x\d+(\.\w+)$/.exec(f.path);
  if (m && files.has(m[1] + m[2])) { files.get(m[1] + m[2]).variants.push(f.path); f.variant_of = m[1] + m[2]; }
}

// ---- referrers -----------------------------------------------------------
// Spaces are allowed inside a path (filenames like "SwiftScan Jan 27, 2026 8.44 AM.jpeg"
// are referenced verbatim in src attributes); record() falls back to the first-space cut.
const REF = /(?:https?:\/\/(?:i[0-3]\.wp\.com\/)?(?:www\.)?learningischange\.com)?\/?(wp-content\/uploads\/[^"'<>?#)\n]+)/g;
const missing = new Map(); // path -> { path, used_by }
const seen = new Set();
function canonical(p) { let s = p; try { s = decodeURIComponent(p); } catch { /* keep raw */ } return s.replace(/[\s\\]+$/, '').replace(/\/+$/, ''); }
function record(p, ref) {
  if (!files.has(p) && /\s/.test(p)) { const cut = p.replace(/\s.*$/, ''); if (files.has(cut)) p = cut; else if (!/\.\w{2,5}$/.test(p)) p = cut; }
  const hit = files.get(p);
  const target = hit && hit.variant_of ? files.get(hit.variant_of) : hit;
  const key = `${target ? target.path : p}|${ref.type}|${ref.url || ref.title}`; if (seen.has(key)) return; seen.add(key);
  if (target) { target.used_by.push(ref); return; }
  if (!missing.has(p)) missing.set(p, { path: p, used_by: [] });
  missing.get(p).used_by.push(ref);
}
function scan(text, ref) { for (const m of String(text || '').matchAll(REF)) record(canonical(m[1]), ref); }

const readJson = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
for (const f of fs.readdirSync(path.join(ROOT, 'database/posts')).filter((n) => /^\d{4}\.json$/.test(n)).sort()) {
  for (const p of readJson(`database/posts/${f}`).posts || []) {
    const status = p.removed ? 'removed' : p.status === 'draft' ? 'draft' : 'published';
    const ref = { type: 'post', url: String(p.url || '').replace(/^https?:\/\/[^/]+/, ''), title: p.title || 'Untitled', status };
    scan(p.content, ref); scan(p.excerpt, ref);
    if (p.podcast && p.podcast.audio) record(canonical(String(p.podcast.audio).replace(/^\//, '')), { ...ref, type: 'podcast' });
  }
}
{
  const d = readJson('database/pages.json'); const pages = Array.isArray(d) ? d : d.pages || [];
  for (const p of pages) scan(p.content, { type: 'page', url: String(p.url || '').replace(/^https?:\/\/[^/]+/, ''), title: p.title || 'Untitled', status: p.status === 'draft' ? 'draft' : 'published' });
}
if (fs.existsSync(path.join(ROOT, 'database/podcast.json'))) {
  const c = readJson('database/podcast.json').channel || {};
  if (c.image) record(canonical(String(c.image).replace(/^\//, '')), { type: 'podcast', url: '/feed/podcast/', title: 'Podcast channel artwork' });
}
const SHELL = ['templates', 'portfolio', 'meet', 'css', 'support.html']; // hand-written only; rendered pages inherit from posts
function walkShell(rel) {
  const abs = path.join(ROOT, rel); if (!fs.existsSync(abs)) return;
  if (fs.statSync(abs).isDirectory()) { for (const n of fs.readdirSync(abs)) walkShell(`${rel}/${n}`); return; }
  if (!/\.(html|css|js|md|json|svg|vcf)$/.test(rel)) return;
  scan(fs.readFileSync(abs, 'utf8'), { type: 'site', url: '/' + rel.replace(/index\.html$/, ''), title: rel });
}
for (const s of SHELL) walkShell(s);

// ---- output ----------------------------------------------------------------
const list = [...files.values()].filter((f) => !f.variant_of).sort((a, b) => a.path.localeCompare(b.path));
for (const f of list) { f.used_by.sort((a, b) => (a.type + a.url).localeCompare(b.type + b.url)); if (!f.variants.length) delete f.variants; }
const bytes = list.reduce((n, f) => n + f.bytes + (f.variants || []).reduce((m, v) => m + files.get(v).bytes, 0), 0);
const used = list.filter((f) => f.used_by.length).length;
const out = {
  generated: new Date().toISOString(), root: UPLOADS,
  summary: { files: files.size, originals: list.length, bytes, used, unused: list.length - used, missing: missing.size,
    by_kind: Object.fromEntries(['image', 'audio', 'video', 'doc', 'other'].map((k) => [k, list.filter((f) => f.kind === k).length])) },
  files: list,
  missing: [...missing.values()].sort((a, b) => a.path.localeCompare(b.path)),
};
const json = JSON.stringify(out, null, 1) + '\n';
const prev = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
const same = prev && prev.replace(/"generated": "[^"]*"/, '') === json.replace(/"generated": "[^"]*"/, '');
const s = out.summary;
console.log(`${APPLY ? 'APPLIED' : 'DRY RUN'} — ${s.files} files (${s.originals} originals, ${(bytes / 1048576).toFixed(0)} MB): ${s.used} used, ${s.unused} unreferenced, ${s.missing} referenced-but-missing; ${JSON.stringify(s.by_kind)}${same ? ' — unchanged' : ''}`);
if (APPLY && !same) fs.writeFileSync(OUT, json);
else if (!APPLY) console.log('Run again with --apply to write database/media.json');
