export const title = 'Settings';
export function render(root, ctx) {
  const s = ctx.settings();
  root.innerHTML = `
    <h1>Settings</h1>
    <p class="lead">Stored in this browser only (localStorage). Nothing is sent anywhere except GitHub's API and, for Bluesky, your PDS.</p>
    <div class="grid">
      <section class="card">
        <h2>GitHub</h2>
        <label class="field">Token
          <input type="password" id="s-token" value="${ctx.esc(s.githubToken)}" autocomplete="off" placeholder="github_pat_…">
          <small>Use a <b>fine-grained</b> token scoped to <code>${ctx.esc(s.repoOwner)}/${ctx.esc(s.repoName)}</code> with <em>Contents: read/write</em> and <em>Actions: read/write</em>, with an expiry. Classic PATs still work.</small>
        </label>
        <div class="row">
          <label class="field" style="flex:1">Owner<input id="s-owner" value="${ctx.esc(s.repoOwner)}"></label>
          <label class="field" style="flex:1">Repo<input id="s-repo" value="${ctx.esc(s.repoName)}"></label>
          <label class="field" style="width:110px">Branch<input id="s-branch" value="${ctx.esc(s.branch)}"></label>
        </div>
        <div class="row">
          <label class="field" style="flex:1">Committer name<input id="s-cname" value="${ctx.esc(s.committerName)}"></label>
          <label class="field" style="flex:1">Committer email<input id="s-cemail" value="${ctx.esc(s.committerEmail)}"></label>
        </div>
        <label class="check"><input type="checkbox" id="s-remember" ${s.rememberToken ? 'checked' : ''}> Remember the token and app password in this browser</label>
        <div class="row"><button class="btn primary" id="s-save">Save</button><button class="btn" id="s-test">Test connection</button></div>
        <div id="s-msg"></div>
      </section>
      <section class="card">
        <h2>Bluesky <small style="font-weight:400;color:var(--text-secondary)">(phase A4)</small></h2>
        <label class="field">Handle<input id="s-bsky" value="${ctx.esc(s.blueskyHandle)}" placeholder="laserdiscleftist.bsky.social"></label>
        <label class="field">App password<input type="password" id="s-bskypw" value="${ctx.esc(s.blueskyAppPassword)}" autocomplete="off" placeholder="xxxx-xxxx-xxxx-xxxx"><small>Create one at Settings → App Passwords on Bluesky. Never your main password.</small></label>
      </section>
    </div>`;
  const read = () => ({
    githubToken: root.querySelector('#s-token').value.trim(), repoOwner: root.querySelector('#s-owner').value.trim(), repoName: root.querySelector('#s-repo').value.trim(),
    branch: root.querySelector('#s-branch').value.trim() || 'main', committerName: root.querySelector('#s-cname').value.trim(), committerEmail: root.querySelector('#s-cemail').value.trim(),
    rememberToken: root.querySelector('#s-remember').checked, blueskyHandle: root.querySelector('#s-bsky').value.trim(), blueskyAppPassword: root.querySelector('#s-bskypw').value.trim(),
  });
  const msg = (text, cls = '') => { root.querySelector('#s-msg').innerHTML = `<div class="msg ${cls}">${text}</div>`; };
  root.querySelector('#s-save').onclick = () => { ctx.save(read()); msg('Saved.'); ctx.status(''); };
  root.querySelector('#s-test').onclick = async () => {
    const s2 = read(); ctx.save(s2);
    const api = ctx.api(); if (!api) return msg('Add a token first.', 'warn');
    try {
      const [repo, rl] = await Promise.all([api.request(`/repos/${s2.repoOwner}/${s2.repoName}`), api.getRateLimit()]);
      msg(`✓ ${ctx.esc(repo.full_name)} (${repo.permissions?.push ? 'write' : 'read-only'} access) · rate limit ${rl.resources.core.remaining}/${rl.resources.core.limit}`);
    } catch (e) { msg(`✗ ${ctx.esc(e.message)}`, 'err'); }
  };
}
