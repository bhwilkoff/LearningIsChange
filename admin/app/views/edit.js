// Post editor (A2.2): edit the JSON record, preview with the site's own
// renderer (scripts/lib/core.js + templates fetched from the live site),
// save via a Git Data commit, dispatch a render of that URL.
import { store } from '../store.js';
import { RichEditor } from '/admin/lib/editor.js';
import { TagPicker, CategoryPicker } from '/admin/lib/pickers.js';
import { CONFIG } from '/admin/lib/config.js';

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
  root.querySelector('#e-title').oninput = schedulePreview;
  root.querySelector('#e-date').onchange = schedulePreview;

  const msg = (text, cls = '') => { root.querySelector('#e-msg').innerHTML = `<div class="msg ${cls}">${text}</div>`; };
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
