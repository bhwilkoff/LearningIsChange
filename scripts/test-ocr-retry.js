#!/usr/bin/env node
// The daily render must not OCR the same unreadable page every day.
//
// Owner 2026-11-23: "fix the re-scan of the exact same failures. We should
// never build something that does that." A page tesseract failed on, or read
// as no words, stayed a candidate, so every scheduled run installed tesseract
// and read it again. This copies ocr-transcripts.js into a scratch site with
// two image-only posts and a fake tesseract (one fails, one reads nothing).
//
//   node scripts/test-ocr-retry.js
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'ocr-retry-'));
fs.mkdirSync(path.join(root, 'scripts/lib'), { recursive: true });
fs.copyFileSync(path.join(HERE, 'ocr-transcripts.js'), path.join(root, 'scripts/ocr-transcripts.js'));
fs.copyFileSync(path.join(HERE, 'lib/core.js'), path.join(root, 'scripts/lib/core.js'));
fs.mkdirSync(path.join(root, 'database/posts'), { recursive: true });
fs.mkdirSync(path.join(root, 'wp-content/uploads'), { recursive: true });
for (const n of ['broken.jpg', 'blank.jpg']) fs.writeFileSync(path.join(root, 'wp-content/uploads', n), 'x');
const post = (slug, img) => ({ title: slug, url: `/2026/01/01/${slug}/`, date_published: '2026-01-01', content: `<img src="/wp-content/uploads/${img}">` });
fs.writeFileSync(path.join(root, 'database/posts/2026.json'), JSON.stringify({ year: 2026, count: 2, posts: [post('broken', 'broken.jpg'), post('blank', 'blank.jpg')] }));

const bin = path.join(root, 'bin');
fs.mkdirSync(bin);
fs.writeFileSync(path.join(bin, 'tesseract'), '#!/bin/sh\ncase "$1" in *broken*) echo "cannot read" >&2; exit 1;; esac\nexit 0\n', { mode: 0o755 });

const run = (...args) => {
  const r = spawnSync(process.execPath, [path.join(root, 'scripts/ocr-transcripts.js'), ...args], { encoding: 'utf8', env: { ...process.env, PATH: `${bin}:/usr/bin:/bin` } });
  return (r.stdout + r.stderr).trim();
};
const fail = (msg) => { console.error(`FAIL: ${msg}`); process.exit(1); };

if (run('--count', '--engine=tesseract') !== '2') fail('both posts start as candidates');
run('--engine=tesseract', '--apply');
const left = run('--count', '--engine=tesseract');
if (left !== '0') fail(`after one run that failed on one page and read nothing on the other, ${left} page(s) would be read again tomorrow`);
const posts = JSON.parse(fs.readFileSync(path.join(root, 'database/posts/2026.json'), 'utf8')).posts;
for (const p of posts) if (!p.ocr_attempt || p.ocr_attempt.tries !== 1 || !p.ocr_attempt.reason) fail(`${p.url} has no recorded attempt: ${JSON.stringify(p.ocr_attempt)}`);
if (run('--count', '--engine=tesseract', '--force') !== '2') fail('--force reopens them');
fs.rmSync(root, { recursive: true, force: true });
console.log('ocr-transcripts: a failed or empty read is recorded and waits, it is not read again every day');
