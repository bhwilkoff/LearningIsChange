// Post editor (A2.2): create or edit the JSON record, preview with the
// site's own renderer (scripts/lib/core.js + templates fetched from the live
// site), save via a Git Data commit, dispatch a full render (listings, feeds
// and search all change when a post does). Unsaved work is autosaved to
// localStorage per URL and offered back on return; images are inserted
// through the Media pipeline (WebP 1600/800 + srcset).
import { store } from '../store.js';
import { RichEditor } from '/admin/lib/editor.js';
import { TagPicker, CategoryPicker } from '/admin/lib/pickers.js';
import { CONFIG } from '/admin/lib/config.js';
import * as bsky from '/admin/lib/bluesky.js';
import { slugify } from '/admin/lib/slug.js';
import { processImage, uploadPath, snippet } from '../media.js';

export const title = 'Edit post';
// The fields a person edits — what autosave stores and compares.
const pick = (r) => ({ title: r.title || '', slug: r.slug || '', date_published: String(r.date_published || '').slice(0, 10), status: r.status || 'publish', content: r.content || '', excerpt: r.excerpt || '', categories: r.categories || [], tags: r.tags || [], podcast: r.podcast || null });
// Renderer + templates come from the same origin as the admin (so a local checkout previews its own code)
const SITE = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? location.origin : CONFIG.site.base;
let core = null, tpl = null; // cached renderer + templates

async function loadRenderer() {
  if (core && tpl) return;
  const [mod, post, ...parts] = await Promise.all([
    import(`${SITE}/scripts/lib/core.js`),
    fetch(`${SITE}/templates/post.html`).then((r) => r.text()),
    ...['head', 'nav', 'rail', 'footer'].map((n) => fetch(`${SITE}/templates/partials/${n}.html`).then((r) => r.text())),
  ]);
  core = mod;
  tpl = { post, head: parts[0], nav: parts[1], rail: parts[2].replace(/\{\{(recent|topics|years)\}\}/g, ''), footer: parts[3] };
}

const DRAFT_PREFIX = 'licAdminDraft:';
const today = () => new Date().toISOString().slice(0, 10);
const urlFor = (date, slug) => { const [y, m, d] = String(date).slice(0, 10).split('-'); return `/${y}/${m}/${d}/${slug}/`; };

export async function render(root, ctx, params) {
  const isNew = !params || params === 'new' || params === '/new';
  const url = isNew ? '' : '/' + (params || '').replace(/^\/+/, '');
  root.innerHTML = `<div class="empty">Loading ${ctx.esc(url || 'new post')}…</div>`;
  let post;
  if (isNew) post = { title: '', url: '', date_published: today(), status: 'publish', content: '', excerpt: '', categories: [], tags: [] };
  else {
    try { post = await store.post(url); } catch (e) { root.innerHTML = `<div class="msg err">${ctx.esc(e.message)}</div>`; return; }
    if (!post) { root.innerHTML = `<div class="msg err">No post at <code>${ctx.esc(url)}</code>. <a href="#/posts">Back to posts</a></div>`; return; }
  }
  const tax = await store.taxonomies();
  const draft = { ...post };
  const draftKey = DRAFT_PREFIX + (isNew ? 'new' : url);
  let saved = null; try { saved = JSON.parse(localStorage.getItem(draftKey) || 'null'); } catch { saved = null; }
  const restorable = saved && saved.at && JSON.stringify(saved.rec) !== JSON.stringify(pick(post));
  if (restorable) { const { slug, ...rest } = saved.rec; Object.assign(post, isNew ? saved.rec : rest); } // prefill from the autosave; the banner offers to discard
  let slugTouched = isNew && !!post.slug;

  root.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:baseline"><h1 style="margin:0">${isNew ? 'New post' : 'Edit post'}</h1><span class="mono" id="e-url">${isNew ? '' : `<a href="${ctx.esc(url)}" target="_blank" rel="noopener">${ctx.esc(url)}</a>`}</span></div>
    <p class="lead">${isNew ? 'Saved into <code>database/posts/&lt;year&gt;.json</code>; the page, homepage, archives, feeds and search render from it.' : `Changes are saved to <code>database/posts/${ctx.esc(post._year)}.json</code>; the page, archives, feeds and search re-render from it.`}</p>
    ${restorable ? `<div class="msg warn" id="e-restore">Restored unsaved changes from ${ctx.esc(new Date(saved.at).toLocaleString())}. <button class="btn" id="e-discard" style="margin-left:8px;padding:3px 10px">Discard them</button></div>` : ''}
    <div class="edit-grid">
      <section>
        <label class="field">Title<input id="e-title" value="${ctx.esc(post.title || '')}"></label>
        ${isNew ? `<label class="field">Slug <small class="inline">(URL: <span class="mono" id="e-urlprev"></span>)</small><input id="e-slug" value="${ctx.esc(post.slug || '')}" placeholder="from the title"></label>` : ''}
        <div class="row">
          <label class="field" style="width:200px">Published<input id="e-date" type="date" value="${ctx.esc(String(post.date_published).slice(0, 10))}"></label>
          <label class="field" style="width:160px">Status<select id="e-status"><option value="publish" ${post.status !== 'draft' ? 'selected' : ''}>Published</option><option value="draft" ${post.status === 'draft' ? 'selected' : ''}>Draft</option></select></label>
        </div>
        <p class="meta" id="e-when" style="margin:-6px 0 12px;font-size:0.8rem;color:var(--text-secondary)"></p>
        <div class="field">Category<div id="e-cat"></div></div>
        <div class="field">Tags<div id="e-tags"></div></div>
        <div class="field">Body
          <div class="tabs-mini"><button class="tab-mini active" data-pane="visual">Visual</button><button class="tab-mini" data-pane="source">HTML</button><span class="spacer"></span><label class="btn" style="padding:4px 10px;font-size:0.78rem;cursor:pointer"><input id="e-img" type="file" accept="image/*" multiple hidden>Insert image…</label></div>
          <div id="e-body" class="editor-surface"></div>
          <textarea id="e-source" class="editor-source" hidden spellcheck="false"></textarea>
        </div>
        <label class="field">Excerpt <small class="inline">(optional; used for descriptions and feeds)</small><textarea id="e-excerpt" rows="2">${ctx.esc(post.excerpt || '')}</textarea></label>
        <div class="row"><button class="btn primary" id="e-save">${isNew ? 'Publish' : 'Save'} &amp; render</button><button class="btn" id="e-preview">Refresh preview</button><label class="check" style="margin:0"><input type="checkbox" id="e-render" checked> dispatch render after save</label><span class="mono" id="e-autosave" style="color:var(--text-secondary);font-size:0.75rem"></span>${isNew ? '' : `<span class="spacer"></span><button class="btn" id="e-remove" title="${post.removed ? 'Put the post back' : 'Tombstone: the URL redirects to the year archive; listings, feeds and search drop it; nothing is deleted'}">${post.removed ? 'Restore post' : 'Remove post…'}</button>`}</div>
        ${post.removed ? `<div class="msg warn">This post is removed (tombstoned ${ctx.esc(String(post.removed_at || '').slice(0, 10))}). Its URL redirects to the year archive.</div>` : ''}
        <div id="e-msg"></div>
        <div class="card" style="margin-top:14px"><h2>Podcast</h2>
          <p class="meta" style="margin:0 0 10px;font-size:0.8rem;color:var(--text-secondary)">A post with an audio file is an episode in <a href="/feed/podcast/" target="_blank" rel="noopener">the podcast feed</a>. Channel settings live in <a href="#/settings">Settings</a>.</p>
          <div class="row"><label class="field" style="flex:1;margin:0">Audio file <small class="inline">(site path)</small><input id="e-pc-audio" value="${ctx.esc(post.podcast?.audio || '')}" placeholder="/wp-content/uploads/YYYY/MM/episode.mp3"></label><label class="btn" style="padding:8px 12px;cursor:pointer;align-self:flex-end"><input id="e-pc-file" type="file" accept="audio/*" hidden>Upload audio…</label></div>
          <div class="row" style="margin-top:8px">
            <label class="field" style="width:140px;margin:0">Duration <small class="inline">(H:MM:SS)</small><input id="e-pc-duration" value="${ctx.esc(post.podcast?.duration || '')}" placeholder="0:42:10"></label>
            <label class="field" style="width:110px;margin:0">Episode №<input id="e-pc-episode" type="number" min="1" value="${ctx.esc(post.podcast?.episode || '')}"></label>
            <label class="field" style="width:130px;margin:0">Type<select id="e-pc-type">${['full', 'trailer', 'bonus'].map((t) => `<option ${(post.podcast?.episode_type || 'full') === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
            <label class="check" style="margin:0;align-self:flex-end"><input type="checkbox" id="e-pc-explicit" ${post.podcast?.explicit ? 'checked' : ''}> explicit</label>
          </div>
          <label class="field" style="margin-top:8px">Episode summary <small class="inline">(optional; defaults to the excerpt)</small><textarea id="e-pc-summary" rows="2">${ctx.esc(post.podcast?.summary || '')}</textarea></label>
          <div class="row"><span class="mono" id="e-pc-stat" style="color:var(--text-secondary);font-size:0.75rem">${post.podcast?.length ? `${(post.podcast.length / 1048576).toFixed(1)} MB · ${ctx.esc(post.podcast.type || '')}` : 'not an episode'}</span><span class="spacer"></span>${post.podcast?.audio ? '<button class="btn" id="e-pc-clear" style="padding:4px 10px;font-size:0.78rem">Remove from podcast</button>' : ''}</div>
        </div>
        ${isNew ? '' : `<div class="card" style="margin-top:14px"><h2>Bluesky</h2><div id="e-bsky">${post.bluesky?.url ? `<div class="msg">✓ Cross-posted: <a href="${ctx.esc(post.bluesky.url)}" target="_blank" rel="noopener">${ctx.esc(post.bluesky.url)}</a><br><small>Replies render under the post at each daily render (or on the next render of this URL).</small></div>` : `<label class="field">Text <small class="inline">(the link card is added automatically)</small><textarea id="e-bsky-text" rows="3">${ctx.esc((post.title || '') + '\n\n' + CONFIG.site.base + url)}</textarea></label><div class="row"><button class="btn" id="e-bsky-post">Post to Bluesky</button><small style="color:var(--text-secondary)">Uses the handle + app password from <a href="#/settings">Settings</a>. Saves the post URI on this record.</small></div>`}</div></div>`}
      </section>
      <section class="preview-col"><div class="preview-head"><span>Preview — rendered with the site's own template</span><span class="mono" id="e-pstat"></span></div><iframe id="e-frame" class="preview-frame" title="Preview" sandbox="allow-same-origin"></iframe></section>
    </div>`;

  const editor = new RichEditor({ element: root.querySelector('#e-body'), onChange: () => schedulePreview() });
  editor.setHTML(post.content || '');
  const src = root.querySelector('#e-source');
  root.querySelectorAll('.tab-mini').forEach((b) => b.onclick = () => {
    root.querySelectorAll('.tab-mini').forEach((x) => x.classList.toggle('active', x === b));
    const visual = b.dataset.pane === 'visual';
    if (visual) { editor.setHTML(src.value); } else { src.value = editor.getHTML(); }
    root.querySelector('#e-body').hidden = !visual; src.hidden = visual;
  });
  src.oninput = () => schedulePreview();
  const cat0 = (post.categories || []).find((c) => c && c.slug && !['ben-wilkoff', 'uncategorized', 'blog-2'].includes(c.slug)) || (post.categories || [])[0] || null;
  const catPicker = new CategoryPicker({ container: root.querySelector('#e-cat'), categories: tax.categories, initial: cat0, onChange: schedulePreview });
  const tagPicker = new TagPicker({ container: root.querySelector('#e-tags'), suggestions: tax.tags, initial: (post.tags || []).filter((t) => t && t.slug !== 'ben-wilkoff'), onChange: schedulePreview });

  function current() {
    const body = src.hidden ? editor.getHTML() : src.value;
    const cat = catPicker.getCategory();
    const rec = { ...draft, title: root.querySelector('#e-title').value.trim(), date_published: root.querySelector('#e-date').value || draft.date_published,
      status: root.querySelector('#e-status').value, content: body, excerpt: root.querySelector('#e-excerpt').value.trim(),
      categories: cat ? [cat] : [], tags: tagPicker.getTags() };
    if (isNew) { rec.slug = slugify(root.querySelector('#e-slug').value.trim() || rec.title) || ''; rec.url = rec.slug ? urlFor(rec.date_published, rec.slug) : ''; rec._year = String(rec.date_published).slice(0, 4); }
    const audio = root.querySelector('#e-pc-audio').value.trim();
    if (audio) {
      const prev = draft.podcast || {};
      rec.podcast = { ...prev, audio, episode_type: root.querySelector('#e-pc-type').value, explicit: root.querySelector('#e-pc-explicit').checked };
      const dur = root.querySelector('#e-pc-duration').value.trim(), ep = root.querySelector('#e-pc-episode').value, sum = root.querySelector('#e-pc-summary').value.trim();
      if (dur) rec.podcast.duration = dur; else delete rec.podcast.duration;
      if (ep) rec.podcast.episode = Number(ep); else delete rec.podcast.episode;
      if (sum) rec.podcast.summary = sum; else delete rec.podcast.summary;
      if (audio !== prev.audio) { delete rec.podcast.length; delete rec.podcast.type; } // the renderer sizes the file from disk
    } else { rec.podcast = undefined; }
    return rec;
  }
  let t = null, at = null;
  function schedulePreview() { clearTimeout(t); t = setTimeout(preview, 400); clearTimeout(at); at = setTimeout(autosave, 600); }
  function autosave() {
    try { localStorage.setItem(draftKey, JSON.stringify({ at: Date.now(), rec: pick(current()) })); root.querySelector('#e-autosave').textContent = `autosaved ${new Date().toLocaleTimeString()}`; } catch { /* storage full or blocked */ }
  }
  const clearDraft = () => { localStorage.removeItem(draftKey); root.querySelector('#e-autosave').textContent = ''; };
  root.querySelector('#e-discard')?.addEventListener('click', () => { clearDraft(); location.reload(); });
  if (isNew) {
    const slugEl = root.querySelector('#e-slug'), urlPrev = root.querySelector('#e-urlprev');
    const showUrl = () => { const r = current(); urlPrev.textContent = r.url || '/YYYY/MM/DD/slug/'; };
    slugEl.oninput = () => { slugTouched = !!slugEl.value.trim(); showUrl(); schedulePreview(); };
    root.querySelector('#e-title').addEventListener('input', () => { if (!slugTouched) slugEl.value = slugify(root.querySelector('#e-title').value); showUrl(); });
    root.querySelector('#e-date').addEventListener('change', showUrl);
    showUrl();
  }
  // Podcast: upload an audio file to wp-content/uploads/YYYY/MM/, read its duration, fill the fields
  ['#e-pc-audio', '#e-pc-duration', '#e-pc-episode', '#e-pc-type', '#e-pc-explicit', '#e-pc-summary'].forEach((sel) => root.querySelector(sel).addEventListener('input', schedulePreview));
  root.querySelector('#e-pc-clear')?.addEventListener('click', () => { root.querySelector('#e-pc-audio').value = ''; draft.podcast = undefined; root.querySelector('#e-pc-stat').textContent = 'not an episode (save to apply)'; schedulePreview(); });
  root.querySelector('#e-pc-file').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    if (!(await ctx.ensureUnlocked())) return msg('Sign in or unlock a token in <a href="#/settings">Settings</a> first — the audio needs a commit.', 'warn');
    const [y, m] = String(current().date_published || today()).split('-');
    const ext = (f.name.split('.').pop() || 'mp3').toLowerCase();
    const name = f.name.replace(/\.[^.]+$/, '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 80) || 'episode';
    const pathRel = `wp-content/uploads/${y}/${m}/${name}.${ext}`;
    const stat = root.querySelector('#e-pc-stat'); stat.textContent = `uploading ${(f.size / 1048576).toFixed(1)} MB…`;
    try {
      const duration = await new Promise((res) => { const a = document.createElement('audio'); const u = URL.createObjectURL(f); a.preload = 'metadata'; a.onloadedmetadata = () => { URL.revokeObjectURL(u); const t = Math.round(a.duration || 0); res(t ? `${Math.floor(t / 3600)}:${String(Math.floor(t % 3600 / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}` : ''); }; a.onerror = () => res(''); a.src = u; });
      const r = await ctx.api().commitFiles([{ path: pathRel, content: new Uint8Array(await f.arrayBuffer()) }], `Upload podcast audio: ${f.name}`);
      root.querySelector('#e-pc-audio').value = '/' + pathRel;
      if (duration && !root.querySelector('#e-pc-duration').value) root.querySelector('#e-pc-duration').value = duration;
      draft.podcast = { ...(draft.podcast || {}), audio: '/' + pathRel, length: f.size, type: f.type || undefined };
      stat.textContent = `${(f.size / 1048576).toFixed(1)} MB · ${f.type || ext} · committed ${String(r.commitSha || r.sha || '').slice(0, 7)}`;
      schedulePreview();
    } catch (err) { stat.textContent = ''; msg(`✗ ${ctx.esc(err.message)}`, 'err'); }
  };
  // Insert image: resize/encode in the browser, commit to wp-content/uploads/YYYY/MM/, insert the responsive snippet
  root.querySelector('#e-img').onchange = async (e) => {
    const files = [...e.target.files].filter((f) => f.type.startsWith('image/')); e.target.value = '';
    if (!files.length) return;
    if (!(await ctx.ensureUnlocked())) return msg('Sign in or unlock a token in <a href="#/settings">Settings</a> first — the image needs a commit.', 'warn');
    const [y, m] = String(current().date_published || today()).split('-');
    msg(`Processing ${files.length} image(s)…`);
    try {
      const outs = [];
      for (const f of files) {
        const r = await processImage(f, { keepOriginal: false });
        const vs = r.variants.map((v) => ({ ...v, path: uploadPath(y, m, v.name) }));
        outs.push({ files: vs.map((v) => ({ path: v.path, content: v.bytes })), html: snippet(r.base, vs, f.name.replace(/\.[^.]+$/, '').replace(/[-_]+/g, ' ')) });
      }
      const all = outs.flatMap((o) => o.files);
      const r = await ctx.api().commitFiles(all, `Upload ${all.length} image file(s) via LiC Admin editor`);
      for (const o of outs) { if (src.hidden) editor.insertHTML(o.html); else src.value += '\n' + o.html + '\n'; }
      schedulePreview();
      msg(`✓ ${files.length} image(s) committed (${String(r.commitSha || r.sha || '').slice(0, 7)}) and inserted. They show in the preview once Pages deploys (a couple of minutes).`);
    } catch (err) { msg(`✗ ${ctx.esc(err.message)}`, 'err'); }
  };
  async function preview() {
    const stat = root.querySelector('#e-pstat'); stat.textContent = 'rendering…';
    try {
      await loadRenderer();
      const html = core.renderPostPage(tpl.post, current(), { shell: { nav: tpl.nav, rail: tpl.rail, footer: tpl.footer, head_common: tpl.head } })
        .replace(/(href|src)="\/(?!\/)/g, `$1="${SITE}/`); // absolute assets inside the sandboxed frame
      root.querySelector('#e-frame').srcdoc = html;
      stat.textContent = `${core.wordCount(current().content)} words`;
    } catch (e) { stat.textContent = 'preview failed: ' + e.message; }
  }
  root.querySelector('#e-preview').onclick = preview;
  const when = () => { const d = root.querySelector('#e-date').value, st = root.querySelector('#e-status').value, today = new Date().toISOString().slice(0, 10);
    root.querySelector('#e-when').textContent = st === 'draft' ? 'Draft — not rendered; if the URL was ever public it redirects to the year archive.' : d > today ? `Scheduled — goes live on ${d} (the daily render at 06:17 UTC publishes it).` : 'Published.'; };
  when(); root.querySelector('#e-status').onchange = () => { when(); schedulePreview(); }; root.querySelector('#e-date').addEventListener('change', when);
  root.querySelector('#e-title').oninput = schedulePreview;
  root.querySelector('#e-date').onchange = schedulePreview;

  const msg = (text, cls = '') => { root.querySelector('#e-msg').innerHTML = `<div class="msg ${cls}">${text}</div>`; };
  root.querySelector('#e-bsky-post')?.addEventListener('click', async () => {
    const s = ctx.settings(); const out = root.querySelector('#e-bsky');
    if (!s.blueskyHandle || !s.blueskyAppPassword) return out.insertAdjacentHTML('beforeend', '<div class="msg warn">Add your Bluesky handle and app password in Settings first.</div>');
    if (!(await ctx.ensureUnlocked())) return out.insertAdjacentHTML('beforeend', '<div class="msg warn">A GitHub token is needed to save the post URI.</div>');
    if (!confirm('Post to Bluesky now?')) return;
    try {
      const session = await bsky.createSession(s.blueskyHandle, s.blueskyAppPassword);
      const rec = current();
      const r = await bsky.crossPost(session, { text: root.querySelector('#e-bsky-text').value, url: CONFIG.site.base + url, title: rec.title, description: core ? core.describe(rec) : rec.excerpt || '' });
      draft.bluesky = { uri: r.uri, cid: r.cid, url: r.url, posted_at: new Date().toISOString() };
      await store.savePost(ctx.api(), { ...current(), bluesky: draft.bluesky }, `Bluesky cross-post: ${rec.title}`);
      await ctx.api().dispatchWorkflow('render-site.yml', { scope: 'posts', year: '', url, dry_run: 'false' }).catch(() => {});
      out.innerHTML = `<div class="msg">✓ Posted: <a href="${ctx.esc(r.url)}" target="_blank" rel="noopener">${ctx.esc(r.url)}</a> — URI saved and a render dispatched.</div>`;
    } catch (e) { out.insertAdjacentHTML('beforeend', `<div class="msg err">✗ ${ctx.esc(e.message)}</div>`); }
  });
  root.querySelector('#e-remove')?.addEventListener('click', async () => {
    const restoring = !!post.removed;
    if (!restoring && !confirm('Remove this post? The URL keeps resolving (it redirects to the year archive) and the record stays in the shard as a tombstone, so this is reversible.')) return;
    if (!(await ctx.ensureUnlocked())) return msg('Sign in or unlock a token in <a href="#/settings">Settings</a> first.', 'warn');
    const api = ctx.api(); const rec = current();
    if (restoring) { delete rec.removed; delete rec.removed_at; } else { rec.removed = true; rec.removed_at = new Date().toISOString(); }
    root.querySelector('#e-remove').disabled = true; msg(restoring ? 'Restoring…' : 'Removing…');
    try {
      const r = await store.savePost(api, restoring ? { ...rec, removed: undefined, removed_at: undefined } : rec, `${restoring ? 'Restore' : 'Remove'} post: ${rec.title}`);
      clearDraft();
      let note = `✓ ${restoring ? 'Restored' : 'Removed'} (${String(r.commitSha || r.sha || '').slice(0, 7)}).`;
      try { await api.dispatchWorkflow('render-site.yml', { scope: 'all', year: '', url: '', dry_run: 'false' }); note += ' Render dispatched — <a href="#/render">watch it</a>.'; } catch (e) { note += ` Render dispatch failed: ${ctx.esc(e.message)}`; }
      msg(note); setTimeout(() => location.reload(), 1200);
    } catch (e) { msg(`✗ ${ctx.esc(e.message)}`, 'err'); root.querySelector('#e-remove').disabled = false; }
  });
  root.querySelector('#e-save').onclick = async () => {
    autosave(); // whatever happens next, the work is on disk
    if (!(await ctx.ensureUnlocked())) return msg('Sign in or unlock a token in <a href="#/settings">Settings</a> first — your draft is autosaved in this browser.', 'warn');
    const api = ctx.api(); const rec = current();
    if (!rec.title) return msg('Title is required.', 'warn');
    if (isNew) {
      if (!rec.url) return msg('A slug is required.', 'warn');
      if (await store.post(rec.url)) return msg(`A post already exists at <code>${ctx.esc(rec.url)}</code> — change the slug or the date.`, 'warn');
    }
    root.querySelector('#e-save').disabled = true; msg('Saving…');
    try {
      const r = await store.savePost(api, rec, isNew ? `New post: ${rec.title}` : `Edit: ${rec.title}`);
      clearDraft();
      let note = `✓ ${isNew ? 'Published' : 'Saved'} (${String(r.commitSha || r.sha || '').slice(0, 7)}).`;
      if (root.querySelector('#e-render').checked) {
        // whole site: the post page plus homepage, archives, feeds, search and the media index all depend on it
        try { await api.dispatchWorkflow('render-site.yml', { scope: 'all', year: '', url: '', dry_run: 'false' }); note += ' Render dispatched — <a href="#/render">watch it</a>.'; }
        catch (e) { note += ` Render dispatch failed: ${ctx.esc(e.message)}`; }
      }
      msg(note);
      if (isNew) { location.replace(`#/posts/edit${rec.url}`); return; }
    } catch (e) { msg(`✗ ${ctx.esc(e.message)}`, 'err'); }
    root.querySelector('#e-save').disabled = false;
  };
  preview();
}
