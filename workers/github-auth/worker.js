// LiC Admin — GitHub App sign-in exchange (Decision 016).
// The only server-side piece in the architecture. Two endpoints:
//   POST /token    { code }          → { access_token, expires_in, refresh_token, refresh_token_expires_in }
//   POST /refresh  { refresh_token } → same shape
// Secrets (Cloudflare → Worker → Settings → Variables): GITHUB_CLIENT_ID,
// GITHUB_CLIENT_SECRET. Plain var: ALLOWED_ORIGINS (comma-separated).
// Nothing is stored; the Worker just forwards the exchange with the secret.

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = (env.ALLOWED_ORIGINS || 'https://learningischange.com').split(',').map((s) => s.trim());
    const cors = {
      'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Vary': 'Origin',
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    const url = new URL(request.url);
    if (request.method !== 'POST' || !['/token', '/refresh'].includes(url.pathname)) {
      return new Response('LiC Admin GitHub auth exchange. POST /token or /refresh.', { status: 404, headers: cors });
    }
    if (!allowed.includes(origin)) return json({ error: 'origin not allowed' }, 403, cors);
    let body; try { body = await request.json(); } catch { return json({ error: 'bad json' }, 400, cors); }
    const params = { client_id: env.GITHUB_CLIENT_ID, client_secret: env.GITHUB_CLIENT_SECRET };
    if (url.pathname === '/token') { if (!body.code) return json({ error: 'code required' }, 400, cors); params.code = body.code; }
    else { if (!body.refresh_token) return json({ error: 'refresh_token required' }, 400, cors); params.grant_type = 'refresh_token'; params.refresh_token = body.refresh_token; }
    const gh = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST', headers: { 'Accept': 'application/json', 'Content-Type': 'application/json', 'User-Agent': 'lic-admin-auth' },
      body: JSON.stringify(params),
    });
    const data = await gh.json().catch(() => ({}));
    if (!gh.ok || data.error) return json({ error: data.error_description || data.error || `github ${gh.status}` }, 400, cors);
    const { access_token, token_type, expires_in, refresh_token, refresh_token_expires_in } = data;
    return json({ access_token, token_type, expires_in, refresh_token, refresh_token_expires_in }, 200, cors);
  },
};
const json = (obj, status, cors) => new Response(JSON.stringify(obj), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cors } });
