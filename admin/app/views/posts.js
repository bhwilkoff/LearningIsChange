// Posts view: list / search / filter. Editing arrives in A2.2.
import { store } from '../store.js';
export const title = 'Posts';
const PAGE = 50;
let state = { q: '', year: '', cat: '', status: 'live', page: 1 };

export async function render(root, ctx) {
  root.innerHTML = `<h1>Posts</h1><p class="lead">Every post in <code>database/posts/*.json</code>. Search matches title, URL and body.</p>
    <div class="card" style="margin-bottom:16px"><div class="row">
      <input id="p-q" type="search" placeholder="Search…" value="${ctx.esc(state.q)}" style="flex:2;min-width:200px;padding:9px 11px">
      <select id="p-year" style="padding:9px"><option value="">All years</option></select>
      <select id="p-cat" style="padding:9px;max-width:260px"><option value="">All categories</option></select>
      <select id="p-status" style="padding:9px"><option value="live">Published</option><option value="draft">Drafts</option><option value="removed">Removed</option><option value="all">All</option></select>
      <a class="btn primary" href="/new/" style="text-decoration:none">New post</a>
    </div></div>
    <div id="p-list" class="card"><div class="empty">Loading posts…</div></div>`;
  let all;
  try { all = await store.posts({ includeRemoved: true }); } catch (e) { root.querySelector('#p-list').innerHTML = `<div class="msg err">${ctx.esc(e.message)}</div>`; return; }
  const tax = await store.taxonomies();
  const years = [...new Set(all.map((p) => String(p.date_published).slice(0, 4)))].sort().reverse();
  root.querySelector('#p-year').innerHTML += years.map((y) => `<option value="${y}" ${state.year === y ? 'selected' : ''}>${y}</option>`).join('');
  root.querySelector('#p-cat').innerHTML += Object.values(tax.categories).sort((a, b) => (b.count || 0) - (a.count || 0)).map((c) => `<option value="${ctx.esc(c.slug)}" ${state.cat === c.slug ? 'selected' : ''}>${ctx.esc(c.name)} (${c.count || 0})</option>`).join('');
  root.querySelector('#p-status').value = state.status;

  const text = (s) => String(s || '').replace(/<[^>]+>/g, ' ').toLowerCase();
  function draw() {
    const q = state.q.trim().toLowerCase();
    const rows = all.filter((p) => {
      if (state.status === 'live' && (p.removed || p.status === 'draft')) return false;
      if (state.status === 'draft' && p.status !== 'draft') return false;
      if (state.status === 'removed' && !p.removed) return false;
      if (state.year && !String(p.date_published).startsWith(state.year)) return false;
      if (state.cat && !(p.categories || []).some((t) => (t.slug || t) === state.cat)) return false;
      if (q && !(text(p.title).includes(q) || p.url.includes(q) || text(p.content).includes(q))) return false;
      return true;
    });
    const start = (state.page - 1) * PAGE, slice = rows.slice(start, start + PAGE);
    const pages = Math.max(1, Math.ceil(rows.length / PAGE));
    root.querySelector('#p-list').innerHTML = `
      <div class="row" style="justify-content:space-between;margin-bottom:8px"><span class="mono">${rows.length.toLocaleString()} post${rows.length === 1 ? '' : 's'}</span>
        <span class="row"><button class="btn" id="p-prev" ${state.page <= 1 ? 'disabled' : ''}>←</button><span class="mono">${state.page} / ${pages}</span><button class="btn" id="p-next" ${state.page >= pages ? 'disabled' : ''}>→</button></span></div>
      <ul class="runs">${slice.map((p) => `<li><span class="dot ${p.removed ? 'failure' : p.status === 'draft' ? 'queued' : 'success'}" title="${p.removed ? 'removed' : p.status || 'publish'}"></span>
        <div><a href="#/posts/edit${p.url}">${ctx.esc(p.title || 'Untitled')}</a><div class="meta">${String(p.date_published).slice(0, 10)} · ${(p.categories || []).map((t) => ctx.esc(t.name || t)).join(', ') || '—'}${p.comments?.length ? ` · ${p.comments.length} comments` : ''}</div></div>
        <a class="meta" href="${p.url}" target="_blank" rel="noopener">view ↗</a></li>`).join('') || '<li class="empty">No posts match.</li>'}</ul>`;
    root.querySelector('#p-prev').onclick = () => { state.page--; draw(); };
    root.querySelector('#p-next').onclick = () => { state.page++; draw(); };
  }
  root.querySelector('#p-q').oninput = (e) => { state.q = e.target.value; state.page = 1; draw(); };
  root.querySelector('#p-year').onchange = (e) => { state.year = e.target.value; state.page = 1; draw(); };
  root.querySelector('#p-cat').onchange = (e) => { state.cat = e.target.value; state.page = 1; draw(); };
  root.querySelector('#p-status').onchange = (e) => { state.status = e.target.value; state.page = 1; draw(); };
  draw();
}
