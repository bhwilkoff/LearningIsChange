// Terms view: categories and tags with counts; rename display names.
import { store } from '../store.js';
export const title = 'Terms';
export async function render(root, ctx) {
  root.innerHTML = `<h1>Terms</h1><p class="lead">From <code>database/taxonomies.json</code>. Counts are recomputed from the posts at every render. Renaming changes the display name only — slugs and URLs stay (permalink guarantee).</p>
    <div class="row" style="margin-bottom:12px"><input id="t-q" type="search" placeholder="Filter…" style="flex:1;padding:9px 11px"></div>
    <div class="grid"><section class="card"><h2>Categories</h2><ul class="runs" id="t-cats"></ul></section><section class="card"><h2>Tags</h2><ul class="runs" id="t-tags"></ul></section></div><div id="t-msg"></div>`;
  const tax = await store.taxonomies();
  const li = (t, kind) => `<li data-kind="${kind}" data-slug="${ctx.esc(t.slug)}"><span class="dot ${t.count ? 'success' : ''}"></span><div><a href="${ctx.esc(t.url)}" target="_blank" rel="noopener">${ctx.esc(t.name)}</a><div class="meta">${ctx.esc(t.url)}${t.hierarchical ? ' · parent' : ''}</div></div><span class="row"><span class="meta">${t.count ?? 0}</span><button class="btn" style="padding:3px 8px;font-size:0.75rem" data-rename>rename</button></span></li>`;
  const draw = (q = '') => {
    const f = (o) => Object.values(o).filter((t) => t && t.slug && (!q || t.name.toLowerCase().includes(q) || t.slug.includes(q))).sort((a, b) => (b.count || 0) - (a.count || 0));
    root.querySelector('#t-cats').innerHTML = f(tax.categories).map((t) => li(t, 'categories')).join('') || '<li class="empty">None</li>';
    root.querySelector('#t-tags').innerHTML = f(tax.tags).slice(0, 300).map((t) => li(t, 'tags')).join('') || '<li class="empty">None</li>';
  };
  draw();
  root.querySelector('#t-q').oninput = (e) => draw(e.target.value.trim().toLowerCase());
  root.addEventListener('click', async (e) => {
    const btn = e.target.closest('[data-rename]'); if (!btn) return;
    const li = btn.closest('li'); const kind = li.dataset.kind, slug = li.dataset.slug; const term = tax[kind][slug];
    const name = prompt(`Display name for ${slug}:`, term.name); if (!name || name === term.name) return;
    if (!(await ctx.ensureUnlocked())) return;
    const api = ctx.api();
    try {
      const raw = await fetch(`${ctx.CONFIG.site.base}/database/taxonomies.json?t=${Date.now()}`).then((r) => r.json());
      raw[kind].items[slug].name = name;
      // propagate to post term entries so rendered links use the new name
      const years = await store.years(); const files = [{ path: 'database/taxonomies.json', content: JSON.stringify(raw, null, 2) + '\n' }];
      for (const y of years) { const s = await store.shard(y, { fresh: true }); let ch = false; for (const p of s.posts || []) for (const t of p[kind === 'categories' ? 'categories' : 'tags'] || []) if (t && t.slug === slug && t.name !== name) { t.name = name; ch = true; } if (ch) files.push({ path: `database/posts/${y}.json`, content: JSON.stringify(s, null, 2) + '\n' }); }
      await api.commitFiles(files, `Rename ${kind.slice(0, -1)} ${slug} → ${name}`);
      term.name = name; store.invalidate(); draw(root.querySelector('#t-q').value.trim().toLowerCase());
      await api.dispatchWorkflow('render-site.yml', { scope: 'all', year: '', url: '', dry_run: 'false' }).catch(() => {});
      root.querySelector('#t-msg').innerHTML = `<div class="msg">✓ Renamed in ${files.length} file(s); render dispatched.</div>`;
    } catch (err) { root.querySelector('#t-msg').innerHTML = `<div class="msg err">${ctx.esc(err.message)}</div>`; }
  });
}
