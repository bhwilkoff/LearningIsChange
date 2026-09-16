// Shared admin bar: one line in every tool —
//   <script src="/admin/admin-bar.js" defer></script>
// Injects a compact switcher across the tools (styled by /admin/admin.css).
(function () {
  var tools = [
    ['/admin/', 'Dashboard'], ['/admin/app/', 'LiC Admin ✦'], ['/new/', 'New post'], ['/edit/', 'Edit'], ['/remove/', 'Remove'],
    ['/admin/regenerate/', 'Render'], ['/update/', 'Mass update'],
    ['/podcast-rss/', 'Podcast'], ['/links/', 'Links'], ['/search/', 'Search'],
    ['/admin/dedup/', 'Dedup'], ['/admin/db-maintenance/', 'DB'],
  ];
  var here = location.pathname.replace(/index\.html$/, '');
  var bar = document.createElement('div');
  bar.className = 'lic-admin-bar';
  bar.innerHTML = '<span class="brand"><b>BW</b>Admin</span>' +
    tools.map(function (t) { return '<a href="' + t[0] + '"' + (here === t[0] ? ' class="current"' : '') + '>' + t[1] + '</a>'; }).join('') +
    '<span class="spacer"></span><a href="/" target="_blank" rel="noopener">View site ↗</a>';
  document.body.insertBefore(bar, document.body.firstChild);
})();
