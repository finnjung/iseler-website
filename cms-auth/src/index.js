/**
 * Login und GitHub-Proxy für den Website-Editor (Sveltia CMS) von Autoteile Iseler.
 *
 * Warum: Leon soll ohne eigenes GitHub-Konto bearbeiten können. Er meldet sich hier mit
 * Benutzername + Passwort an und bekommt ein eigenes, signiertes Sitzungs-Token (kein GitHub-Token).
 * Der Editor schickt alle API-Aufrufe an diesen Worker (`api_root`), der Worker prüft das Token und
 * leitet nur Aufrufe für das eine Repo an GitHub weiter, mit einem kurzlebigen Installations-Token der
 * GitHub App „Iseler Website Editor“ (Rechte: nur Contents lesen/schreiben, nur dieses Repo).
 *
 * Secrets (wrangler secret put):
 *   APP_PRIVATE_KEY  Privater Schlüssel der GitHub App, PKCS#8-PEM ("BEGIN PRIVATE KEY")
 *   SESSION_SECRET   Zufallswert zum Signieren der Sitzungen (ändern = alle abmelden)
 *   USERS            JSON: {"leon":{"name":"Leon Iseler","salt":"…","hash":"…","v":1}}
 * Vars (wrangler.toml): APP_ID, INSTALLATION_ID, REPO, ALLOWED_ORIGINS
 */

const PROVIDER = 'github';
const SESSION_DAYS = 30;
const PBKDF2_ITERATIONS = 100000;
const GITHUB_API = 'https://api.github.com';

const enc = new TextEncoder();

// ---------- Hilfsfunktionen ----------

const b64url = (buf) =>
  btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64url = (s) => {
  const b = atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4));
  return Uint8Array.from(b, (c) => c.charCodeAt(0));
};
const fromB64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const safeEqual = (a, b) => {
  if (a.byteLength !== b.byteLength) return false;
  return crypto.subtle.timingSafeEqual(a, b);
};

const allowedOrigins = (env) => (env.ALLOWED_ORIGINS || '').split(',').map((s) => s.trim()).filter(Boolean);
const isAllowedOrigin = (origin, env) => !!origin && allowedOrigins(env).includes(origin);

const users = (env) => {
  try {
    return JSON.parse(env.USERS || '{}');
  } catch {
    return {};
  }
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// ---------- Passwort & Sitzung ----------

async function hashPassword(password, saltB64) {
  const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: fromB64(saltB64), iterations: PBKDF2_ITERATIONS },
    key,
    256,
  );
  return new Uint8Array(bits);
}

async function checkLogin(env, username, password) {
  const u = users(env)[String(username || '').trim().toLowerCase()];
  // Auch bei unbekanntem Namen einmal hashen, damit die Antwortzeit nichts verrät
  const salt = u?.salt || 'AAAAAAAAAAAAAAAAAAAAAA==';
  const got = await hashPassword(String(password || ''), salt);
  if (!u) return null;
  return safeEqual(got, fromB64(u.hash)) ? u : null;
}

async function hmacKey(env) {
  return crypto.subtle.importKey('raw', enc.encode(env.SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
    'verify',
  ]);
}

async function createSession(env, username, user) {
  const payload = b64url(enc.encode(JSON.stringify({ u: username, v: user.v || 1, exp: Date.now() + SESSION_DAYS * 864e5 })));
  const sig = await crypto.subtle.sign('HMAC', await hmacKey(env), enc.encode(payload));
  return `isl1.${payload}.${b64url(sig)}`;
}

async function readSession(env, token) {
  const parts = String(token || '').split('.');
  if (parts.length !== 3 || parts[0] !== 'isl1') return null;
  const ok = await crypto.subtle.verify('HMAC', await hmacKey(env), fromB64url(parts[2]), enc.encode(parts[1]));
  if (!ok) return null;
  let p;
  try {
    p = JSON.parse(new TextDecoder().decode(fromB64url(parts[1])));
  } catch {
    return null;
  }
  const user = users(env)[p.u];
  if (!user || (user.v || 1) !== p.v || Date.now() > p.exp) return null;
  return { username: p.u, user };
}

// ---------- GitHub-App-Token ----------

let cachedToken = null; // { token, exp }

async function appJwt(env) {
  const pem = env.APP_PRIVATE_KEY.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const key = await crypto.subtle.importKey('pkcs8', fromB64(pem), { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(enc.encode(JSON.stringify({ alg: 'RS256', typ: 'JWT' })));
  const body = b64url(enc.encode(JSON.stringify({ iat: now - 60, exp: now + 540, iss: env.APP_ID })));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, enc.encode(`${head}.${body}`));
  return `${head}.${body}.${b64url(sig)}`;
}

async function installationToken(env) {
  if (cachedToken && cachedToken.exp - Date.now() > 5 * 60e3) return cachedToken.token;
  const [, repo] = env.REPO.split('/');
  const res = await fetch(`${GITHUB_API}/app/installations/${env.INSTALLATION_ID}/access_tokens`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${await appJwt(env)}`,
      Accept: 'application/vnd.github+json',
      'User-Agent': 'iseler-cms-auth',
      'Content-Type': 'application/json',
    },
    // Token zusätzlich auf dieses eine Repo und Contents beschränken
    body: JSON.stringify({ repositories: [repo], permissions: { contents: 'write', metadata: 'read' } }),
  });
  if (!res.ok) throw new Error(`GitHub-App-Token fehlgeschlagen: ${res.status}`);
  const j = await res.json();
  cachedToken = { token: j.token, exp: Date.parse(j.expires_at) };
  return j.token;
}

// ---------- Login-Popup ----------

const PAGE_CSS = `
:root{color-scheme:dark;--bg:#0a111e;--card:#121c2e;--line:#24324a;--text:#eef0f3;--muted:#9aa6b8;--red:#e00018}
*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:var(--bg);color:var(--text);font:16px/1.45 system-ui,-apple-system,Segoe UI,sans-serif;padding:16px}
form{width:100%;max-width:360px;background:var(--card);border:1px solid var(--line);border-radius:14px;padding:28px}
h1{font-size:20px;margin:0 0 4px}p{margin:0 0 20px;color:var(--muted);font-size:14px}
label{display:block;font-size:14px;margin:14px 0 6px}input{width:100%;font:inherit;padding:12px;border-radius:9px;border:1px solid var(--line);background:#0d1626;color:var(--text)}
input:focus{outline:2px solid #3b82f6;outline-offset:1px}button{margin-top:22px;width:100%;font:inherit;font-weight:700;padding:12px;border:0;border-radius:9px;background:var(--red);color:#fff;cursor:pointer}
.err{background:#3a1218;border:1px solid #7a1f2b;color:#ffb4bd;padding:10px 12px;border-radius:9px;font-size:14px;margin:0 0 6px}`;

const loginPage = (env, { error = '', username = '', siteId = '' } = {}) =>
  new Response(
    `<!doctype html><html lang="de"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>Anmelden | Autoteile Iseler</title><style>${PAGE_CSS}</style></head><body>
<form method="post" action="/login">
<h1>Website bearbeiten</h1><p>Autoteile Iseler</p>
${error ? `<div class="err" role="alert">${esc(error)}</div>` : ''}
<input type="hidden" name="site_id" value="${esc(siteId)}">
<label for="u">Benutzername</label><input id="u" name="username" autocomplete="username" autocapitalize="none" required value="${esc(username)}">
<label for="p">Passwort</label><input id="p" name="password" type="password" autocomplete="current-password" required>
<button type="submit">Anmelden</button>
</form></body></html>`,
    {
      status: error ? 401 : 200,
      headers: {
        'Content-Type': 'text/html;charset=UTF-8',
        'Cache-Control': 'no-store',
        'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
        'X-Frame-Options': 'DENY',
        'Referrer-Policy': 'no-referrer',
      },
    },
  );

/** Übergibt das Sitzungs-Token per postMessage an das Editor-Fenster (Protokoll von Sveltia/Decap). */
const outputToken = (env, token) => {
  const origins = JSON.stringify(allowedOrigins(env)).replaceAll('<', '\\u003c');
  const message = JSON.stringify(`authorization:${PROVIDER}:success:${JSON.stringify({ provider: PROVIDER, token })}`).replaceAll('<', '\\u003c');
  const handshake = JSON.stringify(`authorizing:${PROVIDER}`);
  return new Response(
    `<!doctype html><html lang="de"><body><p style="font-family:system-ui;color:#888">Angemeldet. Dieses Fenster schließt sich gleich.</p><script>
(() => {
  const origins = ${origins};
  window.addEventListener('message', ({ data, origin }) => {
    if (data !== ${handshake} || !origins.includes(origin)) return;
    window.opener?.postMessage(${message}, origin);
  });
  window.opener?.postMessage(${handshake}, '*');
})();
</script></body></html>`,
    { headers: { 'Content-Type': 'text/html;charset=UTF-8', 'Cache-Control': 'no-store', 'X-Frame-Options': 'DENY' } },
  );
};

async function handleLogin(request, env) {
  // Formular darf nur von dieser Login-Seite selbst kommen
  const self = new URL(request.url).origin;
  if (request.headers.get('Origin') !== self) return new Response('Forbidden', { status: 403 });

  const form = await request.formData();
  const username = String(form.get('username') || '').trim().toLowerCase();
  const siteId = String(form.get('site_id') || '');
  const ip = request.headers.get('CF-Connecting-IP') || 'unbekannt';

  if (env.LOGIN_LIMIT) {
    const { success } = await env.LOGIN_LIMIT.limit({ key: `login:${ip}` });
    if (!success) return loginPage(env, { error: 'Zu viele Versuche. Bitte eine Minute warten.', username, siteId });
  }

  const user = await checkLogin(env, username, form.get('password'));
  if (!user) return loginPage(env, { error: 'Benutzername oder Passwort stimmt nicht.', username, siteId });
  return outputToken(env, await createSession(env, username, user));
}

// ---------- API-Proxy ----------

const corsHeaders = (request, env) => {
  const origin = request.headers.get('Origin');
  if (!isAllowedOrigin(origin, env)) return {};
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': request.headers.get('Access-Control-Request-Headers') || 'Authorization, Content-Type, Accept',
    'Access-Control-Expose-Headers': 'ETag, Link, Retry-After, X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset, X-GitHub-Request-Id',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  };
};

const json = (data, status, extra) =>
  new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...extra } });

async function handleApi(request, env, apiPath) {
  const cors = corsHeaders(request, env);
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });

  const auth = request.headers.get('Authorization') || '';
  const session = await readSession(env, auth.replace(/^(token|bearer)\s+/i, ''));
  if (!session) return json({ message: 'Bad credentials' }, 401, cors);

  const url = new URL(request.url);
  const repoPath = `/repos/${env.REPO}`;
  let upstream;

  if (apiPath === '/graphql') {
    if (request.method !== 'POST') return json({ message: 'Not Found' }, 404, cors);
    upstream = `${GITHUB_API}/graphql`;
  } else if (apiPath === '/user' && request.method === 'GET') {
    // Kein echter GitHub-Nutzer: Profil aus der eigenen Benutzerliste
    const { username, user } = session;
    return json(
      { login: username, id: 900000 + [...username].reduce((a, c) => a + c.charCodeAt(0), 0), name: user.name || username, email: null, avatar_url: '', html_url: 'https://www.iseler.de/', type: 'User', bot: false },
      200,
      cors,
    );
  } else if (apiPath === '/user/repository_invitations') {
    return json([], 200, cors);
  } else if (apiPath === repoPath || apiPath.startsWith(`${repoPath}/`)) {
    upstream = `${GITHUB_API}${apiPath}${url.search}`;
  } else {
    return json({ message: 'Nicht erlaubt' }, 403, cors);
  }

  const headers = new Headers();
  for (const h of ['Accept', 'Content-Type', 'If-None-Match', 'X-GitHub-Api-Version']) {
    const v = request.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('Authorization', `Bearer ${await installationToken(env)}`);
  headers.set('User-Agent', 'iseler-cms-auth');

  const res = await fetch(upstream, {
    method: request.method,
    headers,
    body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body,
  });

  const out = new Headers();
  for (const h of ['Content-Type', 'ETag', 'Link', 'Retry-After', 'X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'X-GitHub-Request-Id']) {
    const v = res.headers.get(h);
    if (v) out.set(h, v);
  }
  out.set('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(cors)) out.set(k, v);

  // Installations-Tokens bekommen keine "permissions" im Repo-Objekt; der Editor braucht sie für die Schreibprüfung
  if (apiPath === repoPath && request.method === 'GET' && res.ok) {
    const data = await res.json();
    data.permissions = { admin: false, maintain: false, push: true, triage: false, pull: true };
    out.delete('ETag');
    return new Response(JSON.stringify(data), { status: 200, headers: out });
  }

  return new Response(res.body, { status: res.status, headers: out });
}

// ---------- Einstieg ----------

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const { pathname } = url;

    try {
      if (request.method === 'GET' && (pathname === '/auth' || pathname === '/oauth/authorize')) {
        return loginPage(env, { siteId: url.searchParams.get('site_id') || '' });
      }
      if (request.method === 'POST' && pathname === '/login') return await handleLogin(request, env);
      // Kein Refresh: abgelaufene Sitzung = neu anmelden
      if (pathname === '/auth' || pathname === '/oauth/access_token') {
        if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders(request, env) });
        return json({ error: 'invalid_grant' }, 400, corsHeaders(request, env));
      }
      if (pathname === '/api/graphql') return await handleApi(request, env, '/graphql');
      if (pathname.startsWith('/api/v3/')) return await handleApi(request, env, pathname.slice('/api/v3'.length));
      return new Response('', { status: 404 });
    } catch (e) {
      console.error(e);
      return json({ message: 'Interner Fehler' }, 502, corsHeaders(request, env));
    }
  },
};
