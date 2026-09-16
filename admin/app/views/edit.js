// Post editor (A2.2): edit the JSON record, preview with the site's own
// renderer (scripts/lib/core.js + templates fetched from the live site),
// save via a Git Data commit, dispatch a render of that URL.
import { store } from '../store.js';
import { RichEditor } from '/admin/lib/editor.js';
import { TagPicker, CategoryPicker } from '/admin/lib/pickers.js';
import { CONFIG } from '/admin/lib/config.js';
import * as bsky from '/admin/lib/bluesky.js';

export const title = 'Edit post';
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

export async function render(root, ctx, params) {
  const url = '/' + (params || '').replace(/^\/+/, '');
  root.innerHTML = `<div class="empty">Loading ${ctx.esc(url)}…</div>`;
  let post;
  try { post = await store.post(url); } catch (e) { root.innerHTML = `<div class="msg err">${ctx.esc(e.message)}</div>`; return; }
  if (!post) { root.innerHTML = `<div class="msg err">No post at <code>${ctx.esc(url)}</code>. <a href="#/posts">Back to posts</a></div>`; return; }
  const tax = await store.taxonomies();
  const draft = { ...post };

  root.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:baseline"><h1 style="margin:0">Edit post</h1><span class="mono"><a href="${ctx.esc(url)}" target="_blank" rel="noopener">${ctx.esc(url)}</a></span></div>
    <p class="lead">Changes are saved to <code>database/posts/${ctx.esc(post._year)}.json</code>; the page, archives, feeds and search re-render from it.</p>
    <div class="edit-grid">
      <section>
        <label class="field">Title<input id="e-title" value="${ctx.esc(post.title || '')}"></label>
        <div class="row">
          <label class="field" style="width:200px">Published<input id="e-date" type="date" value="${ctx.esc(String(post.date_published).slice(0, 10))}"></label>
          <label class="field" style="width:160px">Status<select id="e-status"><option value="publish" ${post.status !== 'draft' ? 'selected' : ''}>Published</option><option value="draft" ${post.status === 'draft' ? 'selected' : ''}>Draft</option></select></label>
        </div>
        <p class="meta" id="e-when" style="margin:-6px 0 12px;font-size:0.8rem;color:var(--text-secondary)"></p>
        <div class="field">Category<div id="e-cat"></div></div>
        <div class="field">Tags<div id="e-tags"></div></div>
        <div class="field">Body
          <div class="tabs-mini"><button class="tab-mini active" data-pane="visual">Visual</button><button class="tab-mini" data-pane="source">HTML</button></div>
          <div id="e-body" class="editor-surface"></div>
          <textarea id="e-source" class="editor-source" hidden spellcheck="false"></textarea>
        </div>
        <label class="field">Excerpt <small class="inline">(optional; used for descriptions and feeds)</small><textarea id="e-excerpt" rows="2">${ctx.esc(post.excerpt || '')}</textarea></label>
        <div class="row"><button class="btn primary" id="e-save">Save &amp; render</button><button class="btn" id="e-preview">Refresh preview</button><label class="check" style="margin:0"><input type="checkbox" id="e-render" checked> dispatch render after save</label></div>
        <div id="e-msg"></div>
        <div class="card" style="margin-top:14px"><h2>Bluesky</h2><div id="e-bsky">${post.bluesky?.url ? `<div class="msg">✓ Cross-posted: <a href="${ctx.esc(post.bluesky.url)}" target="_blank" rel="noopener">${ctx.esc(post.bluesky.url)}</a><br><small>Replies render under the post at each daily render (or on the next render of this URL).</small></div>` : `<label class="field">Text <small class="inline">(the link card is added automatically)</small><textarea id="e-bsky-text" rows="3">${ctx.esc((post.title || '') + '\n\n' + CONFIG.site.base + url)}</textarea></label><div class="row"><button class="btn" id="e-bsky-post">Post to Bluesky</button><small style="color:var(--text-secondary)">Uses the handle + app password from <a href="#/settings">Settings</a>. Saves the post URI on this record.</small></div>`}</div></div>
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
    return { ...draft, title: root.querySelector('#e-title').value.trim(), date_published: root.querySelector('#e-date').value || draft.date_published,
      status: root.querySelector('#e-status').value, content: body, excerpt: root.querySelector('#e-excerpt').value.trim(),
      categories: cat ? [cat] : [], tags: tagPicker.getTags() };
  }
  let t = null;
  function schedulePreview() { clearTimeout(t); t = setTimeout(preview, 400); }
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
  root.querySelector('#e-save').onclick = async () => {
    if (!(await ctx.ensureUnlocked())) return msg('Sign in or unlock a token in <a href="#/settings">Settings</a> first.', 'warn');
    const api = ctx.api(); const rec = current();
    if (!rec.title) return msg('Title is required.', 'warn');
    root.querySelector('#e-save').disabled = true; msg('Saving…');
    try {
      const r = await store.savePost(api, rec, `Edit: ${rec.title}`);
      let note = `✓ Saved (${String(r.commitSha || r.sha || '').slice(0, 7)}).`;
      if (root.querySelector('#e-render').checked) {
        try { await api.dispatchWorkflow('render-site.yml', { scope: 'posts', year: '', url: rec.url, dry_run: 'false' }); note += ' Render dispatched — <a href="#/render">watch it</a>.'; }
        catch (e) { note += ` Render dispatch failed: ${ctx.esc(e.message)}`; }
      }
      msg(note);
    } catch (e) { msg(`✗ ${ctx.esc(e.message)}`, 'err'); }
    root.querySelector('#e-save').disabled = false;
  };
  preview();
}
