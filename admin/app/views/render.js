// Render view: dispatch render-site.yml and watch it run.
const WORKFLOW = 'render-site.yml';
let timer = null;
export const title = 'Render';
export function destroy() { clearInterval(timer); timer = null; }

export async function render(root, ctx) {
  await ctx.ensureUnlocked();
  root.innerHTML = `
    <h1>Render</h1>
    <p class="lead">Everything under a public URL is derived from <code>database/</code>. This runs the whole pipeline in GitHub Actions: validate → posts → archives → pages → feeds → stats → permalink guarantee → commit.</p>
    <div class="grid">
      <section class="card">
        <h2>Dispatch</h2>
        <label class="field">Scope
          <select id="r-scope"><option value="all">all — posts, archives, pages, feeds</option><option value="posts">posts only</option><option value="archives">archives only</option><option value="pages">pages only</option><option value="feeds">feeds only</option></select>
        </label>
        <div class="row">
          <label class="field" style="width:140px">Year <small class="inline">(posts only)</small><input id="r-year" placeholder="2026"></label>
          <label class="field" style="flex:1">Single post URL <small class="inline">(overrides scope)</small><input id="r-url" placeholder="/2026/03/26/foo/"></label>
        </div>
        <label class="check"><input type="checkbox" id="r-dry"> Dry run (report only; nothing written or committed)</label>
        <div class="row"><button class="btn primary" id="r-go">Render</button><span class="mono" id="r-note"></span></div>
        <div id="r-msg"></div>
      </section>
      <section class="card">
        <h2>Recent runs <button class="btn" id="r-refresh" style="float:right;padding:4px 10px;font-size:0.8rem">Refresh</button></h2>
        <ul class="runs" id="r-runs"><li class="empty">Loading…</li></ul>
      </section>
    </div>`;
  const msg = (t, cls = '') => { root.querySelector('#r-msg').innerHTML = t ? `<div class="msg ${cls}">${t}</div>` : ''; };
  const api = ctx.api();
  if (!api) { msg('Add a GitHub token in <a href="#/settings">Settings</a> to dispatch and watch runs.', 'warn'); root.querySelector('#r-runs').innerHTML = '<li class="empty">No token.</li>'; return; }

  const fmtDur = (a, b) => { const s = Math.round((new Date(b || Date.now()) - new Date(a)) / 1000); return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${s % 60}s`; };
  async function loadRuns() {
    try {
      const data = await api.listWorkflowRuns(WORKFLOW, 8);
      const runs = data.workflow_runs || [];
      const ul = root.querySelector('#r-runs');
      if (!runs.length) { ul.innerHTML = '<li class="empty">No runs yet.</li>'; return; }
      ul.innerHTML = runs.map((r) => `<li data-run="${r.id}"><span class="dot ${r.conclusion || r.status}"></span><div><a href="${r.html_url}" target="_blank" rel="noopener">${ctx.esc(r.display_title || r.name)}</a><div class="meta">${r.status}${r.conclusion ? ' · ' + r.conclusion : ''} · ${new Date(r.created_at).toLocaleString()} · ${fmtDur(r.created_at, r.updated_at)}</div><ul class="steps" id="steps-${r.id}"></ul></div><span class="meta">#${r.run_number}</span></li>`).join('');
      const live = runs.find((r) => r.status !== 'completed');
      ctx.status(live ? `render #${live.run_number} ${live.status}…` : '');
      if (live) {
        const jobs = await api.getRunJobs(live.id);
        const steps = (jobs.jobs?.[0]?.steps || []).filter((st) => !/Set up|Complete|Post /.test(st.name));
        root.querySelector(`#steps-${live.id}`).innerHTML = steps.map((st) => `<li><span class="dot ${st.conclusion || st.status}"></span>${ctx.esc(st.name)}</li>`).join('');
      } else if (timer) { clearInterval(timer); timer = null; }
    } catch (e) { msg(`✗ ${ctx.esc(e.message)}`, 'err'); }
  }
  root.querySelector('#r-refresh').onclick = loadRuns;
  root.querySelector('#r-go').onclick = async () => {
    const scope = root.querySelector('#r-scope').value, year = root.querySelector('#r-year').value.trim(), url = root.querySelector('#r-url').value.trim(), dry = root.querySelector('#r-dry').checked;
    if (!dry && !confirm(`Render ${url ? 'url=' + url : scope + (year ? ' ' + year : '')} and commit the result?`)) return;
    root.querySelector('#r-go').disabled = true;
    try {
      await api.dispatchWorkflow(WORKFLOW, { scope: url ? 'posts' : scope, year, url, dry_run: dry ? 'true' : 'false' });
      msg('✓ Dispatched. The run appears below in a few seconds; the site updates after it commits and Pages rebuilds (a few minutes).');
      clearInterval(timer); timer = setInterval(loadRuns, 6000); setTimeout(loadRuns, 3000);
    } catch (e) { msg(`✗ ${ctx.esc(e.message)}`, 'err'); }
    root.querySelector('#r-go').disabled = false;
  };
  loadRuns();
  timer = setInterval(loadRuns, 15000);
}
