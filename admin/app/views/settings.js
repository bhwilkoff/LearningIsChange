export const title = 'Settings';
function oauthHtml(ctx) {
  const o = ctx.oauth;
  if (!o.configured()) return `<div class="msg warn">Sign in with GitHub is not configured yet (Decision 016: GitHub App + Worker). Use a token below.</div>`;
  if (o.signedIn()) { const s = o.session(); return `<div class="msg">✓ Signed in with GitHub — token expires ${new Date(s.expires_at).toLocaleTimeString()}${s.refresh_token ? ', refreshes automatically' : ''}. <button class="btn" id="s-signout" style="margin-left:8px;padding:4px 10px">Sign out</button></div>`; }
  return `<div class="row" style="margin-bottom:12px"><button class="btn primary" id="s-signin">Sign in with GitHub</button><small style="color:var(--text-secondary)">Short-lived token, this repo only. No token to paste.</small></div>`;
}
function vaultHtml(ctx) {
  if (!ctx.vault.hasVault()) return '';
  return `<div class="msg">🔐 A token is stored <b>encrypted</b> in this browser (${ctx.vault.isUnlocked() ? 'unlocked for this tab' : 'locked'}). Saving a new token + passphrase replaces it.</div>`;
}
export function render(root, ctx) {
  const s = ctx.settings();
  root.innerHTML = `
    <h1>Settings</h1>
    <p class="lead">Stored in this browser only (localStorage). Nothing is sent anywhere except GitHub's API and, for Bluesky, your PDS.</p>
    <div class="grid">
      <section class="card">
        <h2>GitHub</h2>
        <div id="s-oauth">${oauthHtml(ctx)}</div>
        <div id="s-vault">${vaultHtml(ctx)}</div>
        <label class="field">Token
          <input type="password" id="s-token" value="${ctx.esc(s.githubToken)}" autocomplete="off" placeholder="github_pat_…">
          <small>Use a <b>fine-grained</b> token scoped to <code>${ctx.esc(s.repoOwner)}/${ctx.esc(s.repoName)}</code> with <em>Contents: read/write</em> and <em>Actions: read/write</em>, with an expiry. Classic PATs still work.</small>
        </label>
        <label class="field">Passphrase <small class="inline">(to store the token encrypted)</small>
          <input type="password" id="s-pass" autocomplete="new-password" placeholder="a sentence you'll remember">
          <small>Recommended. The token is encrypted with AES-GCM (key from your passphrase, PBKDF2 310k) and only decrypted into this tab's session. Leave empty to store it in plain localStorage (legacy tools need that).</small>
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
        <div class="row"><button class="btn primary" id="s-save">Save</button><button class="btn" id="s-test">Test connection</button><button class="btn" id="s-forget">Forget token</button></div>
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
  root.querySelector('#s-save').onclick = async () => {
    const s2 = read(); const pass = root.querySelector('#s-pass').value;
    if (s2.githubToken && pass) {
      try { await ctx.vault.store(s2.githubToken, pass); } catch (e) { return msg(`✗ ${ctx.esc(e.message)}`, 'err'); }
      s2.githubToken = ''; s2.rememberToken = false; // plaintext never persisted
      ctx.save(s2); root.querySelector('#s-token').value = ''; root.querySelector('#s-pass').value = '';
      root.querySelector('#s-vault').innerHTML = vaultHtml(ctx); ctx.refreshLock();
      return msg('✓ Token stored encrypted and unlocked for this tab.');
    }
    ctx.save(s2); msg(s2.githubToken && !s2.rememberToken ? 'Saved for this session (not remembered).' : 'Saved.');
  };
  root.querySelector('#s-signin')?.addEventListener('click', () => ctx.oauth.signIn());
  root.querySelector('#s-signout')?.addEventListener('click', () => { ctx.oauth.signOut(); root.querySelector('#s-oauth').innerHTML = oauthHtml(ctx); ctx.status(''); });
  root.querySelector('#s-forget').onclick = () => { if (!confirm('Forget the stored token (vault and plaintext)?')) return; ctx.vault.forget(); const s2 = read(); s2.githubToken = ''; ctx.save(s2); root.querySelector('#s-token').value = ''; root.querySelector('#s-vault').innerHTML = vaultHtml(ctx); ctx.refreshLock(); msg('Token forgotten.'); };
  root.querySelector('#s-test').onclick = async () => {
    const s2 = read(); ctx.save(s2);
    const api = ctx.api(); if (!api) return msg('Add a token first.', 'warn');
    try {
      const [repo, rl] = await Promise.all([api.request(`/repos/${s2.repoOwner}/${s2.repoName}`), api.getRateLimit()]);
      msg(`✓ ${ctx.esc(repo.full_name)} (${repo.permissions?.push ? 'write' : 'read-only'} access) · rate limit ${rl.resources.core.remaining}/${rl.resources.core.limit}`);
    } catch (e) { msg(`✗ ${ctx.esc(e.message)}`, 'err'); }
  };
}
