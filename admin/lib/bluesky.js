// Bluesky / AT Protocol client for LiC Admin (Decision 015, A4).
// Cross-posts a published post and reads its reply thread. Auth uses an
// app password against the user's PDS (bsky.social); nothing else sees it.
const PDS = 'https://bsky.social';
export const PUBLIC_API = 'https://public.api.bsky.app';

export async function createSession(handle, appPassword) {
  const res = await fetch(`${PDS}/xrpc/com.atproto.server.createSession`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: handle, password: appPassword }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Bluesky login failed (${res.status})`);
  return { did: data.did, handle: data.handle, accessJwt: data.accessJwt };
}

// Grapheme-safe truncation (Bluesky limit is 300 graphemes)
function clip(text, max = 280) {
  const seg = typeof Intl.Segmenter === 'function' ? [...new Intl.Segmenter().segment(text)].map((s) => s.segment) : [...text];
  return seg.length <= max ? text : seg.slice(0, max - 1).join('') + '…';
}

// Post text + an external-link embed card for the article. Returns { uri, cid }.
export async function crossPost(session, { text, url, title, description }) {
  const body = clip(text);
  const encoder = new TextEncoder();
  const facets = [];
  const at = body.indexOf(url);
  if (at >= 0) facets.push({ index: { byteStart: encoder.encode(body.slice(0, at)).length, byteEnd: encoder.encode(body.slice(0, at + url.length)).length }, features: [{ $type: 'app.bsky.richtext.facet#link', uri: url }] });
  const record = {
    $type: 'app.bsky.feed.post', text: body, createdAt: new Date().toISOString(), langs: ['en'],
    ...(facets.length ? { facets } : {}),
    embed: { $type: 'app.bsky.embed.external', external: { uri: url, title: clip(title, 120), description: clip(description || '', 200) } },
  };
  const res = await fetch(`${PDS}/xrpc/com.atproto.repo.createRecord`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` }, body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record }) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `createRecord failed (${res.status})`);
  return { uri: data.uri, cid: data.cid, url: webUrl(session.handle, data.uri) };
}

export const webUrl = (handle, uri) => `https://bsky.app/profile/${handle}/post/${uri.split('/').pop()}`;

// Public, unauthenticated thread read (also used by the Node renderer)
export async function getThread(uri, depth = 6) {
  const res = await fetch(`${PUBLIC_API}/xrpc/app.bsky.feed.getPostThread?uri=${encodeURIComponent(uri)}&depth=${depth}&parentHeight=0`);
  if (!res.ok) throw new Error(`getPostThread ${res.status}`);
  return (await res.json()).thread;
}
