// Pages view: list + edit static pages (database/pages.json) with exact preview.
import { store } from '../store.js';
import { RichEditor } from '/admin/lib/editor.js';
import { CONFIG } from '/admin/lib/config.js';

export const title = 'Pages';
const SITE = /^(127\.0\.0\.1|localhost)$/.test(location.hostname) ? location.origin : CONFIG.site.base;
const norm = (u) => String(u || '').replace(/^https?:\/\/[^/]+/, '').replace(/\/?$/, '/');
let core = null, tpl = null, rules = null;
async function loadRenderer() {
  if (core) return;
  const [mod, page, ...parts] = await Promise.all([import(`${SITE}/scripts/lib/core.js`), fetch(`${SITE}/templates/page.html`).then((r) => r.text()),
    ...['head', 'nav', 'rail', 'footer'].map((n) => fetch(`${SITE}/templates/partials/${n}.html`).then((r) => r.text()))]);
  core = mod; tpl = { page, head: parts[0], nav: parts[1], rail: parts[2].replace(/\{\{(recent|topics|years)\}\}/g, ''), footer: parts[3] };
  rules = await fetch(`${CONFIG.site.base}/database/page-rules.json`).then((r) => r.json()).catch(() => ({ redirects: {}, noindex: [] }));
}

export async function render(root, ctx, sub) {
  if (sub) return editPage(root, ctx, '/' + sub.replace(/^\/+/, ''));
  root.innerHTML = `<h1>Pages</h1><p class="lead">Static pages in <code>database/pages.json</code>. Routing (redirects, noindex) lives in <code>database/page-rules.json</code>.</p><div class="card" id="pg-list"><div class="empty">Loading…</div></div>`;
  try {
    const [pages, r] = await Promise.all([store.pages(), fetch(`${CONFIG.site.base}/database/page-rules.json`).then((x) => x.json())]);
    const tools = new Set(['/archive-sync/', '/database/', '/makedatabase/', '/new/', '/rss-creator/', '/update/']);
    const rows = pages.map((p) => ({ ...p, url: norm(p.url || ('/' + String(p.path || '').replace(/index\.html$/, ''))) })).filter((p) => !tools.has(p.url)).sort((a, b) => a.url.localeCompare(b.url));
    root.querySelector('#pg-list').innerHTML = `<ul class="runs">${rows.map((p) => {
      const redir = r.redirects?.[p.url], noidx = (r.noindex || []).includes(p.url);
      return `<li><span class="dot ${redir ? 'failure' : noidx ? 'queued' : 'success'}" title="${redir ? 'redirect' : noidx ? 'noindex' : 'published'}"></span><div>${redir ? `<span>${ctx.esc(p.title)}</span>` : `<a href="#/pages/edit${p.url}">${ctx.esc(p.title)}</a>`}<div class="meta">${ctx.esc(p.url)}${redir ? ` → redirects to ${ctx.esc(redir)}` : noidx ? ' · noindex' : ''}${p.date_modified && p.date_modified !== 'None' ? ' · updated ' + String(p.date_modified).slice(0, 10) : ''}</div></div><a class="meta" href="${p.url}" target="_blank" rel="noopener">view ↗</a></li>`; }).join('')}</ul>`;
  } catch (e) { root.querySelector('#pg-list').innerHTML = `<div class="msg err">${ctx.esc(e.message)}</div>`; }
}

async function editPage(root, ctx, url) {
  root.innerHTML = `<div class="empty">Loading ${ctx.esc(url)}…</div>`;
  const pages = await store.pages();
  const page = pages.find((p) => norm(p.url || ('/' + String(p.path || '').replace(/index\.html$/, ''))) === url);
  if (!page) { root.innerHTML = `<div class="msg err">No page at <code>${ctx.esc(url)}</code>. <a href="#/pages">Back</a></div>`; return; }
  root.innerHTML = `
    <div class="row" style="justify-content:space-between;align-items:baseline"><h1 style="margin:0">Edit page</h1><span class="mono"><a href="${ctx.esc(url)}" target="_blank" rel="noopener">${ctx.esc(url)}</a></span></div>
    <p class="lead">Saved to <code>database/pages.json</code>; the page re-renders from it.</p>
    <div class="edit-grid">
      <section>
        <label class="field">Title<input id="e-title" value="${ctx.esc(page.title || '')}"></label>
        <div class="field">Body<div class="tabs-mini"><button class="tab-mini active" data-pane="visual">Visual</button><button class="tab-mini" data-pane="source">HTML</button></div>
          <div id="e-body" class="editor-surface"></div><textarea id="e-source" class="editor-source" hidden spellcheck="false"></textarea></div>
        <label class="field">Excerpt<textarea id="e-excerpt" rows="2">${ctx.esc(page.excerpt || '')}</textarea></label>
        <div class="row"><button class="btn primary" id="e-save">Save &amp; render</button><label class="check" style="margin:0"><input type="checkbox" id="e-render" checked> dispatch render after save</label></div>
        <div id="e-msg"></div>
      </section>
      <section class="preview-col"><div class="preview-head"><span>Preview — rendered with the site's page template</span><span class="mono" id="e-pstat"></span></div><iframe id="e-frame" class="preview-frame" title="Preview" sandbox="allow-same-origin"></iframe></section>
    </div>`;
  const editor = new RichEditor({ element: root.querySelector('#e-body'), onChange: () => schedule() }); editor.setHTML(page.content || '');
  const src = root.querySelector('#e-source'); src.oninput = schedule;
  root.querySelectorAll('.tab-mini').forEach((b) => b.onclick = () => { root.querySelectorAll('.tab-mini').forEach((x) => x.classList.toggle('active', x === b)); const v = b.dataset.pane === 'visual'; if (v) editor.setHTML(src.value); else src.value = editor.getHTML(); root.querySelector('#e-body').hidden = !v; src.hidden = v; });
  const current = () => ({ ...page, url, title: root.querySelector('#e-title').value.trim(), content: src.hidden ? editor.getHTML() : src.value, excerpt: root.querySelector('#e-excerpt').value.trim() });
  let t; function schedule() { clearTimeout(t); t = setTimeout(preview, 400); }
  async function preview() {
    const stat = root.querySelector('#e-pstat'); stat.textContent = 'rendering…';
    try { await loadRenderer(); const rec = current();
      const html = core.renderStaticPage(tpl.page, rec, { url, content: rec.content, noindex: (rules.noindex || []).includes(url), shell: { nav: tpl.nav, rail: tpl.rail, footer: tpl.footer, head_common: tpl.head } }).replace(/(href|src)="\/(?!\/)/g, `$1="${SITE}/`);
      root.querySelector('#e-frame').srcdoc = html; stat.textContent = `${core.wordCount(rec.content)} words`;
    } catch (e) { stat.textContent = 'preview failed: ' + e.message; }
  }
  root.querySelector('#e-title').oninput = schedule;
  const msg = (text, cls = '') => { root.querySelector('#e-msg').innerHTML = `<div class="msg ${cls}">${text}</div>`; };
  root.querySelector('#e-save').onclick = async () => {
    if (!(await ctx.ensureUnlocked())) return msg('Sign in or unlock a token in <a href="#/settings">Settings</a> first.', 'warn');
    const api = ctx.api(); const rec = current(); root.querySelector('#e-save').disabled = true; msg('Saving…');
    try { const r = await store.savePage(api, rec, `Edit page: ${rec.title}`); let note = `✓ Saved (${String(r.commitSha || r.sha || '').slice(0, 7)}).`;
      if (root.querySelector('#e-render').checked) { try { await api.dispatchWorkflow('render-site.yml', { scope: 'pages', year: '', url: '', dry_run: 'false' }); note += ' Render dispatched — <a href="#/render">watch it</a>.'; } catch (e) { note += ` Render dispatch failed: ${ctx.esc(e.message)}`; } }
      msg(note); } catch (e) { msg(`✗ ${ctx.esc(e.message)}`, 'err'); }
    root.querySelector('#e-save').disabled = false;
  };
  preview();
}
