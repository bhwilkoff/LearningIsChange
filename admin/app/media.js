// Client-side image pipeline (Decision 015, A2.4). Decodes an image in the
// browser, resizes to sensible widths, encodes WebP (JPEG fallback when the
// browser can't encode WebP), and returns bytes ready for a Git Data commit.
// No CDN, no server: the files land in wp-content/uploads/YYYY/MM/.

export const WIDTHS = [1600, 800];  // full + a half-size variant for srcset
const QUALITY = 0.82;

export async function processImage(file, { widths = WIDTHS, keepOriginal = false } = {}) {
  const bitmap = await createImageBitmap(file);
  const srcW = bitmap.width, srcH = bitmap.height;
  const type = (await canEncodeWebP()) ? 'image/webp' : 'image/jpeg';
  const ext = type === 'image/webp' ? 'webp' : 'jpg';
  const base = slugName(file.name);
  const out = [];
  for (const w of widths) {
    if (bitmap.width <= w && out.length) continue;          // never upscale; smallest variant still emitted once
    const scale = Math.min(1, w / bitmap.width);
    const cw = Math.round(bitmap.width * scale), ch = Math.round(bitmap.height * scale);
    const canvas = 'OffscreenCanvas' in self ? new OffscreenCanvas(cw, ch) : Object.assign(document.createElement('canvas'), { width: cw, height: ch });
    canvas.getContext('2d').drawImage(bitmap, 0, 0, cw, ch);
    const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type, quality: QUALITY }) : await new Promise((r) => canvas.toBlob(r, type, QUALITY));
    out.push({ name: `${base}${scale < 1 || widths.length > 1 ? `-${cw}w` : ''}.${ext}`, width: cw, height: ch, type, bytes: new Uint8Array(await blob.arrayBuffer()) });
    if (scale === 1) break;                                  // original size reached; smaller variants only if requested below
  }
  // ensure the half-size variant exists when the source was wide enough
  if (widths.length > 1 && bitmap.width > widths[1] && !out.some((o) => o.width === widths[1])) {
    const w = widths[1], scale = w / bitmap.width, cw = w, ch = Math.round(bitmap.height * scale);
    const canvas = 'OffscreenCanvas' in self ? new OffscreenCanvas(cw, ch) : Object.assign(document.createElement('canvas'), { width: cw, height: ch });
    canvas.getContext('2d').drawImage(bitmap, 0, 0, cw, ch);
    const blob = canvas.convertToBlob ? await canvas.convertToBlob({ type, quality: QUALITY }) : await new Promise((r) => canvas.toBlob(r, type, QUALITY));
    out.push({ name: `${base}-${cw}w.${ext}`, width: cw, height: ch, type, bytes: new Uint8Array(await blob.arrayBuffer()) });
  }
  if (keepOriginal) out.push({ name: `${base}-original.${(file.name.split('.').pop() || 'bin').toLowerCase()}`, width: bitmap.width, height: bitmap.height, type: file.type, bytes: new Uint8Array(await file.arrayBuffer()) });
  bitmap.close?.();
  return { base, original: { width: srcW, height: srcH, bytes: file.size, type: file.type }, variants: out.sort((a, b) => b.width - a.width) };
}

let webp = null;
async function canEncodeWebP() {
  if (webp !== null) return webp;
  try { const c = new OffscreenCanvas(2, 2); c.getContext('2d').fillRect(0, 0, 2, 2); const b = await c.convertToBlob({ type: 'image/webp' }); webp = b.type === 'image/webp'; } catch { webp = false; }
  return webp;
}
export function slugName(name) {
  return String(name).replace(/\.[^.]+$/, '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'image';
}
export function uploadPath(year, month, name) { return `wp-content/uploads/${year}/${month}/${name}`; }
// HTML to paste into a post: responsive <img> with srcset when two variants exist
export function snippet(base, variants, alt = '') {
  const [full, half] = variants.filter((v) => !v.name.endsWith('-original.' + v.name.split('.').pop()));
  const src = '/' + full.path;
  const srcset = half ? ` srcset="${'/' + half.path} ${half.width}w, ${src} ${full.width}w" sizes="(max-width: 800px) 100vw, 800px"` : '';
  return `<figure><img src="${src}"${srcset} width="${full.width}" height="${full.height}" alt="${alt.replace(/"/g, '&quot;')}" loading="lazy"></figure>`;
}

// Editor hook: process + commit image files for a given month, return the snippets to insert.
// `api` is a GitHubAPI; the caller decides where the HTML goes.
export async function uploadImages(api, files, year, month, { keepOriginal = false } = {}) {
  const outs = [];
  for (const f of files) {
    if (!f.type.startsWith('image/')) continue;
    const r = await processImage(f, { keepOriginal });
    const vs = r.variants.map((v) => ({ ...v, path: uploadPath(year, month, v.name) }));
    outs.push({ files: vs.map((v) => ({ path: v.path, content: v.bytes })), html: snippet(r.base, vs, f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')) });
  }
  if (!outs.length) return { commit: null, html: [] };
  const commit = await api.commitFiles(outs.flatMap((o) => o.files), `Upload ${outs.length} image(s) via LiC Admin editor`);
  return { commit, html: outs.map((o) => o.html) };
}
