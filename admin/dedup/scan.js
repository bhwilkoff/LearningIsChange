#!/usr/bin/env node
// Scan the repo for media dedup candidates and emit admin/dedup/data/manifest.json.
//
// Classes emitted:
//   - orphan_variants     : WP-generated size variants (-NNNxNNN, -scaled) not referenced anywhere
//   - orphan_images       : original images not referenced anywhere
//   - orphan_audio_video  : audio/video files not referenced anywhere
//   - orphan_documents    : PDFs etc. not referenced anywhere
//   - broken_refs         : referenced paths that do not exist on disk
//   - duplicate_clusters  : groups of byte-identical files (by MD5)
//   - variant_refs        : references that point at a size variant (may need rewrite to Jetpack)
//
// Run from repo root: node admin/dedup/scan.js

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '../..');
const UPLOADS = path.join(REPO_ROOT, 'wp-content', 'uploads');
const OUT_PATH = path.join(HERE, 'data', 'manifest.json');

const SCAN_EXTS = /\.(html|xml|json|css|js|md)$/i;
const MEDIA_EXTS_RE = '(?:jpg|jpeg|png|gif|mp3|mp4|m4a|pdf|mov|ppt|wav|webp|svg)';
const REF_REGEX = new RegExp(`wp-content/uploads/[^"'<>() ?#\\\\]+\\.${MEDIA_EXTS_RE}`, 'gi');
const VARIANT_RE = /-(?:scaled|rotated|\d+x\d+)\.(?:jpg|jpeg|png|gif|webp)$/i;

const SKIP_DIRS = new Set(['.git', 'node_modules']);
const SKIP_PATH_FRAGMENTS = ['admin/dedup/data/']; // avoid self-referencing manifest.json

function classify(basename) {
  const lower = basename.toLowerCase();
  if (VARIANT_RE.test(lower)) return 'variant';
  if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(lower)) return 'image';
  if (/\.(mp3|m4a|mp4|mov|wav)$/i.test(lower)) return 'audio_video';
  if (/\.(pdf|ppt|pptx|doc|docx)$/i.test(lower)) return 'document';
  return 'other';
}

function* walk(dir) {
  let entries;
  try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
  catch { return; }
  for (const entry of entries) {
    if (entry.name === '.DS_Store') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

function md5Stream(filepath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    fs.createReadStream(filepath)
      .on('error', reject)
      .on('data', chunk => hash.update(chunk))
      .on('end', () => resolve(hash.digest('hex')));
  });
}

async function scanUploads() {
  process.stderr.write('Scanning uploads...\n');
  const files = [];
  let count = 0;
  for (const fp of walk(UPLOADS)) {
    const rel = path.relative(REPO_ROOT, fp).split(path.sep).join('/').toLowerCase();
    const stat = fs.statSync(fp);
    const hash = await md5Stream(fp);
    files.push({
      path: rel,
      size: stat.size,
      mtime: stat.mtime.toISOString(),
      hash,
      class: classify(path.basename(fp)),
    });
    if (++count % 1000 === 0) process.stderr.write(`  ${count} files hashed\n`);
  }
  process.stderr.write(`  total: ${count} files\n`);
  return files;
}

function scanRefs() {
  process.stderr.write('Scanning refs...\n');
  const refs = new Set();
  let scanned = 0;
  for (const fp of walk(REPO_ROOT)) {
    if (!SCAN_EXTS.test(fp)) continue;
    const rel = path.relative(REPO_ROOT, fp).split(path.sep).join('/');
    if (SKIP_PATH_FRAGMENTS.some(frag => rel.includes(frag))) continue;
    // Skip files inside uploads (media files can't have refs to other media)
    if (rel.startsWith('wp-content/uploads/')) continue;
    try {
      const content = fs.readFileSync(fp, 'utf8');
      const matches = content.match(REF_REGEX);
      if (matches) for (const m of matches) refs.add(m.toLowerCase());
    } catch { /* binary or unreadable */ }
    if (++scanned % 2000 === 0) process.stderr.write(`  ${scanned} text files scanned\n`);
  }
  process.stderr.write(`  ${scanned} scanned, ${refs.size} unique refs\n`);
  return refs;
}

function buildManifest(files, refs) {
  const diskSet = new Set(files.map(f => f.path));
  const orphans = files.filter(f => !refs.has(f.path));
  const broken = [...refs].filter(r => !diskSet.has(r)).sort();

  const byHash = new Map();
  for (const f of files) {
    if (!byHash.has(f.hash)) byHash.set(f.hash, []);
    byHash.get(f.hash).push(f);
  }
  const dupClusters = [];
  for (const [hash, group] of byHash) {
    if (group.length < 2) continue;
    const size = group[0].size;
    const paths = group.map(f => f.path).sort();
    const anyReferenced = paths.some(p => refs.has(p));
    const referencedPaths = paths.filter(p => refs.has(p));
    dupClusters.push({
      hash,
      size_per_copy: size,
      wasted_bytes: size * (paths.length - 1),
      count: paths.length,
      paths,
      any_referenced: anyReferenced,
      referenced_paths: referencedPaths,
    });
  }
  dupClusters.sort((a, b) => b.wasted_bytes - a.wasted_bytes);

  const byClass = (cls) => orphans.filter(f => f.class === cls).map(f => ({
    path: f.path, size: f.size, mtime: f.mtime, hash: f.hash,
  }));

  const variantRefs = [...refs].filter(r => VARIANT_RE.test(r)).sort();
  const scaledRefs = [...refs].filter(r => /-scaled\.(jpg|jpeg|png|gif|webp)$/i.test(r)).sort();

  return {
    generated_at: new Date().toISOString(),
    repo: { owner: 'bhwilkoff', name: 'LearningIsChange', branch: 'main' },
    summary: {
      files_on_disk: files.length,
      total_bytes: files.reduce((s, f) => s + f.size, 0),
      unique_refs: refs.size,
      orphan_count: orphans.length,
      orphan_bytes: orphans.reduce((s, f) => s + f.size, 0),
      orphan_variants: orphans.filter(f => f.class === 'variant').length,
      orphan_images: orphans.filter(f => f.class === 'image').length,
      orphan_audio_video: orphans.filter(f => f.class === 'audio_video').length,
      orphan_documents: orphans.filter(f => f.class === 'document').length,
      broken_refs: broken.length,
      dup_clusters: dupClusters.length,
      dup_waste_bytes: dupClusters.reduce((s, d) => s + d.wasted_bytes, 0),
      variant_refs: variantRefs.length,
    },
    orphans: {
      variants: byClass('variant'),
      images: byClass('image'),
      audio_video: byClass('audio_video'),
      documents: byClass('document'),
      other: byClass('other'),
    },
    broken_refs: broken,
    duplicate_clusters: dupClusters,
    variant_refs: variantRefs,
    scaled_refs: scaledRefs,
  };
}

async function main() {
  const files = await scanUploads();
  const refs = scanRefs();
  const manifest = buildManifest(files, refs);
  fs.mkdirSync(path.dirname(OUT_PATH), { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(manifest, null, 2));
  process.stderr.write(`\nWrote ${OUT_PATH}\n`);
  process.stderr.write(`Summary:\n`);
  for (const [k, v] of Object.entries(manifest.summary)) {
    process.stderr.write(`  ${k}: ${v}\n`);
  }
}

main().catch(err => { console.error(err); process.exit(1); });
