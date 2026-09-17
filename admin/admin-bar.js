// Shared admin bar: one line in every tool —
//   <script src="/admin/admin-bar.js" defer></script>
// Injects a compact switcher across the tools (styled by /admin/admin.css)
// and gates the page: without a credential the tool is replaced by a
// sign-in card that hands off to LiC Admin (Decision 016). This is a
// client-side gate on a static site — the real enforcement is GitHub
// rejecting writes without a valid token — but it keeps the tools from
// opening for anyone who finds the URL.
(function () {
  function hasCredential() {
    try {
      var o = JSON.parse(sessionStorage.getItem('licAdminOAuth') || 'null');
      if (o && o.access_token && Date.now() < o.expires_at) return true;
      if (sessionStorage.getItem('licAdminUnlockedToken')) return true;
      var keys = ['licAdminSettings', 'lic_admin_settings'];
      for (var i = 0; i < keys.length; i++) {
        var s = JSON.parse(localStorage.getItem(keys[i]) || '{}');
        if (s && s.githubToken) return true;
      }
    } catch (e) {}
    return false;
  }
  var herePath = location.pathname.replace(/index\.html$/, '');
  if (herePath !== '/admin/app/' && !hasCredential()) {
    var next = encodeURIComponent(location.pathname + location.search + location.hash);
    document.documentElement.classList.add('lic-gated');
    document.body.innerHTML = '<main class="lic-gate"><section class="lic-gate-card">' +
      '<p class="kicker">Learning is Change · Admin</p>' +
      '<h1>Sign in to continue</h1>' +
      '<p>These tools write to the site as you, so a GitHub credential is required before any of them opens.</p>' +
      '<p><a class="btn primary" href="/admin/app/?next=' + next + '">Sign in with GitHub</a> ' +
      '<a class="btn" href="/admin/app/#/settings">Use a token</a></p>' +
      '<p class="lic-gate-note">Signing in with GitHub unlocks LiC Admin. The legacy tools on this page still need a token saved in Settings until they retire (Decision 015, A5).</p>' +
      '</section></main>';
    document.title = 'Sign in · LiC Admin';
    return;
  }
  var tools = [
    ['/admin/app/', 'LiC Admin'], ['/search/', 'Search'],
  ];
  var here = location.pathname.replace(/index\.html$/, '');
  var bar = document.createElement('div');
  bar.className = 'lic-admin-bar';
  bar.innerHTML = '<span class="brand"><b>BW</b>Admin</span>' +
    tools.map(function (t) { return '<a href="' + t[0] + '"' + (here === t[0] ? ' class="current"' : '') + '>' + t[1] + '</a>'; }).join('') +
    '<span class="spacer"></span><a href="/" target="_blank" rel="noopener">View site ↗</a>';
  document.body.insertBefore(bar, document.body.firstChild);
})();
