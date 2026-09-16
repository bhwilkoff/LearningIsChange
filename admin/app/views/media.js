// Media view: upload images (WebP, resized client-side) into wp-content/uploads/YYYY/MM/ and get the HTML to paste.
import { processImage, uploadPath, snippet } from '../media.js';
export const title = 'Media';
export async function render(root, ctx) {
  const now = new Date(); const y = String(now.getFullYear()), m = String(now.getMonth() + 1).padStart(2, '0');
  root.innerHTML = `<h1>Media</h1><p class="lead">Images are resized and encoded to WebP in your browser, then committed to <code>wp-content/uploads/${y}/${m}/</code>. No CDN, no server.</p>
    <div class="grid">
      <section class="card"><h2>Upload</h2>
        <div id="m-drop" class="drop">Drop images here or <label class="linklike"><input id="m-file" type="file" accept="image/*" multiple hidden>choose files</label></div>
        <div class="row" style="margin-top:10px"><label class="field" style="width:120px;margin:0">Year<input id="m-year" value="${y}"></label><label class="field" style="width:90px;margin:0">Month<input id="m-month" value="${m}"></label><label class="check" style="margin:0 0 0 8px"><input type="checkbox" id="m-orig"> also keep the original file</label></div>
        <div id="m-queue"></div>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="m-commit" disabled>Commit uploads</button><span class="mono" id="m-stat"></span></div>
        <div id="m-msg"></div>
      </section>
      <section class="card"><h2>Ready to paste</h2><div id="m-out" class="empty">Upload something to get the HTML snippet.</div></section>
    </div>`;
  const queue = [];
  const drop = root.querySelector('#m-drop');
  const addFiles = async (files) => {
    for (const f of files) {
      if (!f.type.startsWith('image/')) continue;
      const item = { file: f, status: 'processing…' }; queue.push(item); drawQueue();
      try { item.result = await processImage(f, { keepOriginal: root.querySelector('#m-orig').checked }); item.status = 'ready'; }
      catch (e) { item.status = 'failed: ' + e.message; }
      drawQueue();
    }
  };
  const kb = (n) => `${Math.round(n / 1024)} KB`;
  function drawQueue() {
    root.querySelector('#m-queue').innerHTML = queue.length ? `<ul class="runs">${queue.map((q, i) => `<li><span class="dot ${q.status === 'ready' ? 'success' : q.status.startsWith('failed') ? 'failure' : 'queued'}"></span><div>${ctx.esc(q.file.name)} <span class="meta">${kb(q.file.size)}${q.result ? ` → ${q.result.variants.map((v) => `${v.width}×${v.height} ${kb(v.bytes.length)}`).join(', ')}` : ''}</span><div class="meta">${ctx.esc(q.status)}</div></div><button class="btn" data-rm="${i}" style="padding:3px 8px;font-size:0.75rem">✕</button></li>`).join('')}</ul>` : '';
    root.querySelector('#m-commit').disabled = !queue.some((q) => q.status === 'ready');
    root.querySelectorAll('[data-rm]').forEach((b) => b.onclick = () => { queue.splice(Number(b.dataset.rm), 1); drawQueue(); });
  }
  root.querySelector('#m-file').onchange = (e) => addFiles([...e.target.files]);
  ['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', (e) => addFiles([...e.dataTransfer.files]));
  const msg = (t, cls = '') => { root.querySelector('#m-msg').innerHTML = `<div class="msg ${cls}">${t}</div>`; };
  root.querySelector('#m-commit').onclick = async () => {
    if (!(await ctx.ensureUnlocked())) return msg('Sign in or unlock a token in <a href="#/settings">Settings</a> first.', 'warn');
    const api = ctx.api(); const yy = root.querySelector('#m-year').value.trim(), mm = root.querySelector('#m-month').value.trim().padStart(2, '0');
    const ready = queue.filter((q) => q.status === 'ready');
    const files = []; const outs = [];
    for (const q of ready) { const vs = q.result.variants.map((v) => ({ ...v, path: uploadPath(yy, mm, v.name) })); vs.forEach((v) => files.push({ path: v.path, content: v.bytes })); outs.push({ base: q.result.base, variants: vs, alt: q.file.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ') }); }
    root.querySelector('#m-commit').disabled = true; root.querySelector('#m-stat').textContent = `committing ${files.length} file(s)…`;
    try {
      const r = await api.commitFiles(files, `Upload ${ready.length} image(s) via LiC Admin`);
      root.querySelector('#m-stat').textContent = `✓ ${String(r.commitSha || r.sha || '').slice(0, 7)}`;
      root.querySelector('#m-out').innerHTML = outs.map((o) => `<div style="margin-bottom:14px"><div class="meta">${ctx.esc(o.variants[0].path)}</div><textarea class="editor-source" rows="3" readonly onclick="this.select()">${ctx.esc(snippet(o.base, o.variants, o.alt))}</textarea></div>`).join('');
      msg('✓ Committed. The files are live once Pages rebuilds (a couple of minutes); the snippet works immediately in the editor preview after that.');
      queue.length = 0; drawQueue();
    } catch (e) { msg(`✗ ${ctx.esc(e.message)}`, 'err'); root.querySelector('#m-commit').disabled = false; }
  };
}
