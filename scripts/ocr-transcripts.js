#!/usr/bin/env node
// OCR transcripts for image-only posts (the typewritten pages).
//
//   node scripts/ocr-transcripts.js                 dry run: list candidates and show the text
//   node scripts/ocr-transcripts.js --apply         write `transcript` into the shards
//   node scripts/ocr-transcripts.js --count         print only the number of candidates (workflow gate)
//   --engine=vision|tesseract|auto (default auto: Apple Vision on macOS via
//     scripts/ocr/vision-ocr.swift, tesseract elsewhere — the Actions runner)
//   --url=/2026/03/26/…/   one post      --force   redo posts that already have an OCR transcript
//
// A candidate is a published-or-draft post whose body is (almost) only
// self-hosted images. The result is stored on the record as plain text with
// blank-line paragraphs: { transcript, transcript_source: 'vision'|'tesseract'
// |'edited', transcript_at }. A transcript someone edited ('edited') is never
// touched. The renderer shows it under the image, feeds it to descriptions,
// JSON-LD, the Markdown twin and the search index.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { plainText } from './lib/core.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const APPLY = args.includes('--apply'), FORCE = args.includes('--force'), COUNT = args.includes('--count');
const ONLY = (args.find((a) => a.startsWith('--url=')) || '').slice(6);
let ENGINE = (args.find((a) => a.startsWith('--engine=')) || '--engine=auto').slice(9);
if (ENGINE === 'auto') ENGINE = os.platform() === 'darwin' && spawnSync('xcrun', ['--find', 'swift']).status === 0 ? 'vision' : 'tesseract';

// ---- candidates -------------------------------------------------------------
const shards = fs.readdirSync(path.join(ROOT, 'database/posts')).filter((n) => /^\d{4}\.json$/.test(n)).sort();
const cands = [];
for (const f of shards) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'database/posts', f), 'utf8'));
  data.posts.forEach((p, i) => {
    if (p.removed) return;
    if (ONLY && p.url !== ONLY) return;
    const imgs = [...String(p.content || '').matchAll(/<img[^>]+src=["']([^"']+)["']/gi)].map((m) => m[1]).map((u) => u.replace(/^https?:\/\/(?:i[0-3]\.wp\.com\/)?learningischange\.com/, '')).filter((u) => u.startsWith('/wp-content/uploads/'));
    if (!imgs.length || plainText(p.content).length >= 40) return;
    if (p.transcript_source === 'edited') return;
    if (p.transcript && !FORCE) return;
    // prefer the largest variant when the img carries a srcset
    const files = imgs.map((u) => { try { return decodeURIComponent(u); } catch { return u; } }).map((u) => u.replace(/-\d+w(\.\w+)$/, '$1')).map((u) => path.join(ROOT, u.slice(1))).filter((fp) => fs.existsSync(fp));
    if (files.length) cands.push({ file: f, index: i, url: p.url, title: p.title, files, data });
  });
}
if (COUNT) { console.log(cands.length); process.exit(0); }
if (!cands.length) { console.log('No image-only posts without a transcript.'); process.exit(0); }
console.log(`${cands.length} post(s) to transcribe with ${ENGINE}`);

// ---- OCR engines → [{text, y, h, x}] per image ---------------------------
function vision(files) {
  const r = spawnSync('swift', [path.join(ROOT, 'scripts/ocr/vision-ocr.swift'), ...files], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  if (r.status !== 0) throw new Error(`vision-ocr failed: ${r.stderr.slice(0, 400)}`);
  return r.stdout.trim().split('\n').filter(Boolean).map((l) => { const o = JSON.parse(l); return { lines: JSON.parse(o.lines), confidence: o.confidence }; });
}
function tesseract(files) {
  return files.map((f) => {
    // ImageMagick (present on the Actions runner) cleans the scan first: gray, normalize, 2× — tesseract reads typewriter faces much better that way
    let src = f;
    const magick = spawnSync('which', ['magick']).status === 0 ? 'magick' : spawnSync('which', ['convert']).status === 0 ? 'convert' : null;
    if (magick) { const tmp = path.join(os.tmpdir(), `ocr-${process.pid}-${path.basename(f)}.png`); const m = spawnSync(magick, [f, '-colorspace', 'Gray', '-normalize', '-resize', '200%', tmp]); if (m.status === 0) src = tmp; }
    const r = spawnSync('tesseract', [src, '-', '--psm', '4', '-l', 'eng'], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
    if (src !== f) fs.rmSync(src, { force: true });
    if (r.status !== 0) throw new Error(`tesseract failed: ${r.stderr.slice(0, 400)}`);
    // psm 4 gives blank lines between blocks; fake the geometry so the same paragraph logic applies
    const lines = []; let y = 0;
    for (const raw of r.stdout.split('\n')) { const t = raw.trim(); if (!t) { y += 0.03; continue; } lines.push({ text: t, y, h: 0.015, x: 0 }); y += 0.015; }
    return { lines, confidence: 0 };
  });
}

// ---- lines → paragraphs ---------------------------------------------------------
function paragraphs(lines) {
  if (!lines.length) return '';
  // merge fragments Vision split on the same baseline
  const rows = [];
  for (const l of [...lines].sort((a, b) => a.y - b.y || a.x - b.x)) {
    const last = rows[rows.length - 1];
    if (last && Math.abs(last.y - l.y) < Math.max(last.h, l.h) * 0.5) { last.parts.push(l); last.text = last.parts.sort((a, b) => a.x - b.x).map((p) => p.text).join(' '); continue; }
    rows.push({ y: l.y, h: l.h, parts: [l], text: l.text });
  }
  const gaps = rows.slice(1).map((r, i) => r.y - rows[i].y).filter((g) => g > 0).sort((a, b) => a - b);
  const median = gaps[Math.floor(gaps.length / 2)] || 0.02;
  const paras = [[]];
  rows.forEach((r, i) => { if (i && r.y - rows[i - 1].y > median * 1.6) paras.push([]); paras[paras.length - 1].push(r.text.trim()); });
  return paras.map((ls) => ls.join('\n').replace(/(\w)-\n(?=[a-z])/g, '$1').replace(/\n/g, ' ').replace(/\s+/g, ' ').trim()).filter(Boolean).join('\n\n');
}

// ---- run ----------------------------------------------------------------------
const touched = new Map();
for (const c of cands) {
  let results;
  try { results = ENGINE === 'vision' ? vision(c.files) : tesseract(c.files); } catch (e) { console.error(`  ✗ ${c.url}: ${e.message}`); continue; }
  const text = results.map((r) => paragraphs(r.lines)).filter(Boolean).join('\n\n');
  const conf = results.reduce((n, r) => n + (r.confidence || 0), 0) / (results.length || 1);
  console.log(`  ${c.url}  (${c.files.length} image${c.files.length > 1 ? 's' : ''}, ${text.split(/\s+/).filter(Boolean).length} words${conf ? `, confidence ${conf.toFixed(2)}` : ''})`);
  if (!APPLY) { console.log('    ' + text.slice(0, 300).replace(/\n/g, '\n    ') + (text.length > 300 ? '…' : '')); continue; }
  const p = c.data.posts[c.index];
  p.transcript = text; p.transcript_source = ENGINE; p.transcript_at = new Date().toISOString();
  touched.set(c.file, c.data);
}
for (const [f, data] of touched) fs.writeFileSync(path.join(ROOT, 'database/posts', f), JSON.stringify(data, null, 2) + '\n');
if (APPLY) console.log(`APPLIED — ${cands.length} transcript(s) written to ${touched.size} shard(s)`); else console.log('Run again with --apply to write transcripts.');
