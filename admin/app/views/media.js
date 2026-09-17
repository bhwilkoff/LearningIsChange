// Media view: the library (every file under wp-content/uploads/ and where the
// site uses it, from database/media.json — written by scripts/index-media.js
// on every render) plus the uploader (WebP, resized client-side) with the HTML
// snippet to paste.
import { processImage, uploadPath, snippet } from '../media.js';
import { store } from '../store.js';
export const title = 'Media';
export async function render(root, ctx) {
  const now = new Date(); const y = String(now.getFullYear()), m = String(now.getMonth() + 1).padStart(2, '0');
  root.innerHTML = `<h1>Media</h1><p class="lead">Drop images here. They get resized and encoded to WebP in your browser, then committed to <code>wp-content/uploads/${y}/${m}/</code>. No CDN, no server.</p>
    <div class="grid">
      <section class="card"><h2>Upload</h2>
        <div id="m-drop" class="drop">Drop images here or <label class="linklike"><input id="m-file" type="file" accept="image/*" multiple hidden>choose files</label></div>
        <div class="row" style="margin-top:10px"><label class="field" style="width:120px;margin:0">Year<input id="m-year" value="${y}"></label><label class="field" style="width:90px;margin:0">Month<input id="m-month" value="${m}"></label><label class="check" style="margin:0 0 0 8px"><input type="checkbox" id="m-orig"> also keep the original file</label></div>
        <div id="m-queue"></div>
        <div class="row" style="margin-top:10px"><button class="btn primary" id="m-commit" disabled>Commit uploads</button><span class="mono" id="m-stat"></span></div>
        <div id="m-msg"></div>
      </section>
      <section class="card"><h2>Ready to paste</h2><div id="m-out" class="empty">Upload something to get the HTML snippet.</div></section>
    </div>
    <section class="card" id="m-lib" style="margin-top:16px"><h2>Library</h2><div class="empty">Loading <code>database/media.json</code>…</div></section>`;
  library(root.querySelector('#m-lib'), ctx).catch((e) => { root.querySelector('#m-lib').innerHTML = `<h2>Library</h2><div class="msg err">${ctx.esc(e.message)}</div>`; });
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


// ---- Library ---------------------------------------------------------------
const PER_PAGE = 48;
const fmtBytes = (n) => n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`;
const ICON = { audio: '♪', video: '▶', doc: '▤', other: '·' };
async function library(el, ctx) {
  const data = await store.media();
  const S = data.summary; const base = ctx.CONFIG.site.base;
  const years = [...new Set(data.files.map((f) => f.year).filter(Boolean))].sort().reverse();
  const state = { q: '', kind: '', year: '', use: '', sort: 'newest', page: 1, open: new Set() };
  const hash = new URLSearchParams(location.hash.split('?')[1] || ''); if (hash.get('use')) state.use = hash.get('use');
  el.innerHTML = `<h2>Library <small class="mono" style="font-weight:400;color:var(--text-secondary)">indexed ${ctx.esc(String(data.generated).slice(0, 10))}</small></h2>
    <p class="lead" style="margin-top:0">${S.files.toLocaleString()} files · ${fmtBytes(S.bytes)} in <code>${ctx.esc(data.root)}/</code>. A file is <em>used</em> when a post, a page, the podcast, or the site shell points at it. <em>Unreferenced</em> means nothing on the site does; something elsewhere still might. Nothing here deletes anything.</p>
    <div class="lib-stats">
      <button class="lib-stat" data-use="">${S.originals.toLocaleString()}<span>originals</span></button>
      <button class="lib-stat" data-use="used">${S.used.toLocaleString()}<span>used</span></button>
      <button class="lib-stat" data-use="unused">${S.unused.toLocaleString()}<span>unreferenced</span></button>
      <button class="lib-stat warn" data-use="missing">${S.missing.toLocaleString()}<span>broken references</span></button>
      ${Object.entries(S.by_kind).filter(([, n]) => n).map(([k, n]) => `<button class="lib-stat" data-kind="${k}">${n.toLocaleString()}<span>${k}</span></button>`).join('')}
    </div>
    <div class="row lib-controls">
      <input id="l-q" type="search" placeholder="Search file names and referring titles…" style="flex:1;min-width:220px">
      <select id="l-kind"><option value="">All kinds</option>${['image', 'audio', 'video', 'doc'].map((k) => `<option value="${k}">${k}</option>`).join('')}</select>
      <select id="l-year"><option value="">All years</option>${years.map((y) => `<option>${y}</option>`).join('')}</select>
      <select id="l-use"><option value="">Used + unreferenced</option><option value="used">Used</option><option value="unused">Unreferenced</option><option value="missing">Broken references</option></select>
      <select id="l-sort"><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="largest">Largest first</option><option value="most">Most used</option><option value="name">By name</option></select>
    </div>
    <div id="l-list"></div>
    <div class="row" id="l-pager" style="justify-content:space-between;margin-top:12px"></div>`;
  const $ = (sel) => el.querySelector(sel);
  const sync = () => { $('#l-kind').value = state.kind; $('#l-year').value = state.year; $('#l-use').value = state.use; $('#l-sort').value = state.sort; el.querySelectorAll('.lib-stat').forEach((b) => b.classList.toggle('active', b.dataset.use !== undefined ? b.dataset.use === state.use && !state.kind : b.dataset.kind === state.kind)); };
  const refLink = (u) => {
    const view = u.url ? `<a href="${ctx.esc(base + u.url)}" target="_blank" rel="noopener">view ↗</a>` : '';
    const edit = u.type === 'post' ? `<a href="#/posts/edit${ctx.esc(u.url)}">edit</a>` : u.type === 'page' ? `<a href="#/pages/edit${ctx.esc(u.url)}">edit</a>` : '';
    return `<li><span class="lib-type">${u.type}</span>${ctx.esc(u.title)}${u.status && u.status !== 'published' ? ` <span class="lib-type">${u.status}</span>` : ''} <span class="lib-links">${edit} ${view}</span></li>`;
  };
  function items() {
    const q = state.q.trim().toLowerCase();
    if (state.use === 'missing') return data.missing.filter((m) => !q || m.path.toLowerCase().includes(q) || m.used_by.some((u) => u.title.toLowerCase().includes(q)));
    let list = data.files.filter((f) => (!state.kind || f.kind === state.kind) && (!state.year || f.year === state.year)
      && (state.use !== 'used' || f.used_by.length) && (state.use !== 'unused' || !f.used_by.length)
      && (!q || f.path.toLowerCase().includes(q) || f.used_by.some((u) => u.title.toLowerCase().includes(q))));
    const key = { newest: (a, b) => (b.year + b.month).localeCompare(a.year + a.month) || a.path.localeCompare(b.path), oldest: (a, b) => (a.year + a.month).localeCompare(b.year + b.month) || a.path.localeCompare(b.path),
      largest: (a, b) => b.bytes - a.bytes, most: (a, b) => b.used_by.length - a.used_by.length || a.path.localeCompare(b.path), name: (a, b) => a.path.split('/').pop().localeCompare(b.path.split('/').pop()) }[state.sort];
    return list.sort(key);
  }
  function draw() {
    sync();
    const all = items(); const pages = Math.max(1, Math.ceil(all.length / PER_PAGE)); state.page = Math.min(state.page, pages);
    const slice = all.slice((state.page - 1) * PER_PAGE, state.page * PER_PAGE);
    if (state.use === 'missing') {
      $('#l-list').innerHTML = slice.length ? `<p class="empty">Paths the content links to with no file behind them, mostly 2007 attachments and 2014 audio that never left WordPress. Fix the post, upload the file again, or let it be.</p><ul class="runs">${slice.map((m) => `<li class="lib-missing"><span class="dot failure"></span><div><div class="mono">${ctx.esc(m.path.replace(data.root + '/', ''))}</div><ul class="lib-refs">${m.used_by.map(refLink).join('')}</ul></div><span></span></li>`).join('')}</ul>` : '<div class="empty">No broken references match.</div>';
    } else {
      $('#l-list').innerHTML = slice.length ? `<div class="lib-grid">${slice.map((f) => {
        const name = f.path.split('/').pop(); const toUrl = (p) => base + '/' + p.split('/').map(encodeURIComponent).join('/'); const url = toUrl(f.path);
        // thumbnail: the smallest resize variant when WordPress left one, else the original (lazy)
        const small = (f.variants || []).map((v) => [v, Number((/-(\d+)x\d+\.\w+$/.exec(v) || [])[1] || 1e9)]).sort((a, b) => a[1] - b[1])[0];
        const thumb = f.kind === 'image' ? `<img loading="lazy" decoding="async" src="${ctx.esc(small ? toUrl(small[0]) : url)}" alt="">` : `<span class="lib-icon">${ICON[f.kind] || '·'}<small>${ctx.esc(f.ext)}</small></span>`;
        const n = f.used_by.length; const open = state.open.has(f.path);
        return `<figure class="lib-item ${n ? '' : 'unused'}">
          <a class="lib-thumb" href="${ctx.esc(url)}" target="_blank" rel="noopener" title="Open file">${thumb}</a>
          <figcaption>
            <div class="lib-name" title="${ctx.esc(f.path)}">${ctx.esc(name)}</div>
            <div class="meta">${f.year ? `${f.year}/${f.month} · ` : ''}${f.w ? `${f.w}×${f.h} · ` : ''}${fmtBytes(f.bytes)}${f.variants ? ` · +${f.variants.length} size${f.variants.length > 1 ? 's' : ''}` : ''}</div>
            <div class="row lib-actions"><button class="btn lib-use" data-path="${ctx.esc(f.path)}" ${n ? '' : 'disabled'}>${n ? `Used in ${n} ${open ? '▾' : '▸'}` : 'Unreferenced'}</button><button class="btn lib-copy" data-url="${ctx.esc(url)}" title="Copy URL">Copy URL</button></div>
            ${open ? `<ul class="lib-refs">${f.used_by.map(refLink).join('')}</ul>` : ''}
          </figcaption></figure>`; }).join('')}</div>` : '<div class="empty">Nothing matches.</div>';
    }
    $('#l-pager').innerHTML = `<span class="mono">${all.length.toLocaleString()} ${state.use === 'missing' ? 'broken reference' : 'file'}${all.length === 1 ? '' : 's'}</span><span class="row"><button class="btn" id="l-prev" ${state.page <= 1 ? 'disabled' : ''}>←</button><span class="mono">${state.page} / ${pages}</span><button class="btn" id="l-next" ${state.page >= pages ? 'disabled' : ''}>→</button></span>`;
    $('#l-prev').onclick = () => { state.page--; draw(); el.scrollIntoView({ block: 'start' }); };
    $('#l-next').onclick = () => { state.page++; draw(); el.scrollIntoView({ block: 'start' }); };
    el.querySelectorAll('.lib-use').forEach((b) => b.onclick = () => { const p = b.dataset.path; state.open.has(p) ? state.open.delete(p) : state.open.add(p); draw(); });
    el.querySelectorAll('.lib-copy').forEach((b) => b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.url); b.textContent = 'Copied'; setTimeout(() => { b.textContent = 'Copy URL'; }, 1200); } catch { prompt('Copy this URL:', b.dataset.url); } });
  }
  let t; $('#l-q').oninput = (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; state.page = 1; draw(); }, 150); };
  $('#l-kind').onchange = (e) => { state.kind = e.target.value; state.page = 1; draw(); };
  $('#l-year').onchange = (e) => { state.year = e.target.value; state.page = 1; draw(); };
  $('#l-use').onchange = (e) => { state.use = e.target.value; state.page = 1; draw(); };
  $('#l-sort').onchange = (e) => { state.sort = e.target.value; state.page = 1; draw(); };
  el.querySelectorAll('.lib-stat').forEach((b) => b.onclick = () => { if (b.dataset.use !== undefined) { state.use = b.dataset.use; state.kind = ''; } else { state.kind = b.dataset.kind; if (state.use === 'missing') state.use = ''; } state.page = 1; draw(); });
  draw();
}
