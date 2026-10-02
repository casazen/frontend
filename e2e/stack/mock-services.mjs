/**
 * Hermetic stand-ins for the two external services the Golden Journey L3 needs, so the ephemeral stack depends on
 * nothing outside the runner but Stripe test mode (FN-03):
 *
 *  - mock IdP ("Auth0"): HTTPS, OIDC code + PKCE, refresh token, JWKS. The backend validates its RS256 tokens with the
 *    SAME production JwtBearer code (issuer https://<domain>/, audience, signature): it trusts the throw-away
 *    certificate through SSL_CERT_FILE. No test-only auth path exists in the backend.
 *  - mock Resend: `POST /emails` stores the message, `GET /__outbox` lets the test read it (links of the emails
 *    the guest / supplier would receive).
 *
 * Test-only: refuses to start unless E2E_STACK=1. Nothing here ships (e2e/ is not bundled).
 */
import { createServer as createHttpsServer } from 'node:https';
import { createServer as createHttpServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { createHash, createSign, generateKeyPairSync, randomBytes } from 'node:crypto';

if (process.env.E2E_STACK !== '1') {
  console.error('mock-services: set E2E_STACK=1 (test-only server).');
  process.exit(2);
}

const IDP_PORT = Number(process.env.E2E_IDP_PORT ?? 9443);
const MAIL_PORT = Number(process.env.E2E_MAIL_PORT ?? 9444);
const ISSUER = `https://localhost:${IDP_PORT}/`;
const AUDIENCE = process.env.E2E_AUTH0_AUDIENCE ?? 'https://casazen-api';
const ROLE_IDS = Object.fromEntries(
  ['Admin', 'PropertyOwner', 'LongTermLandlord', 'Supplier', 'Guest', 'Staff', 'PropertyManager'].map((n) => [n, `rol_${n}`]),
);
const ROLES_CLAIM = 'https://casazen.app/roles';
const PASSWORD = process.env.E2E_USER_PASSWORD ?? 'E2e-test-password-1';

/**
 * Accounts are created on first login: any `<name>@example.test` with the shared password. Every run uses fresh
 * addresses (so a fresh organization, no cleanup endpoint needed). Roles start empty and are granted through the
 * mock Management API exactly as the backend does it in production (onboarding, supplier registration), then appear
 * in the next token. The guest is anonymous: it never logs in.
 */
const USERS = {};
const userFor = (email) => {
  if (!/^[a-z0-9._+-]+@example\.test$/.test(email)) return undefined;
  return (USERS[email] ??= { email, sub: `auth0|${email.split('@')[0]}`, name: email.split('@')[0], roles: [] });
};

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 });
const jwk = { ...publicKey.export({ format: 'jwk' }), kid: 'e2e-1', alg: 'RS256', use: 'sig' };
const b64u = (b) => Buffer.from(b).toString('base64url');

function sign(payload) {
  const head = b64u(JSON.stringify({ alg: 'RS256', typ: 'JWT', kid: 'e2e-1' }));
  const body = b64u(JSON.stringify(payload));
  const sig = createSign('RSA-SHA256').update(`${head}.${body}`).sign(privateKey);
  return `${head}.${body}.${b64u(sig)}`;
}

const codes = new Map(); // code -> { email, clientId, redirectUri, challenge, nonce, scope }
const refreshTokens = new Map(); // token -> { email, clientId, scope }

function tokensFor(email, clientId, nonce, scope) {
  const user = userFor(email);
  const now = Math.floor(Date.now() / 1000);
  const base = { iss: ISSUER, sub: user.sub, iat: now, exp: now + 3600 };
  const access = sign({
    ...base,
    aud: [AUDIENCE, `${ISSUER}userinfo`],
    azp: clientId,
    scope,
    [ROLES_CLAIM]: [...user.roles],
    'https://casazen.app/email': email,
    'https://casazen.app/email_verified': true,
    email,
  });
  const id = sign({ ...base, aud: clientId, email, email_verified: true, name: user.name, nonce, [ROLES_CLAIM]: [...user.roles] });
  const refresh = `rt-${randomBytes(16).toString('hex')}`;
  refreshTokens.set(refresh, { email, clientId, scope });
  return { access_token: access, id_token: id, refresh_token: refresh, token_type: 'Bearer', expires_in: 3600, scope };
}

function cors(res, req) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin ?? '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Auth0-Client', '');
}

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString('utf8');
  if ((req.headers['content-type'] ?? '').includes('json')) return raw ? JSON.parse(raw) : {};
  return Object.fromEntries(new URLSearchParams(raw));
}

const json = (res, status, obj) => {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(obj));
};

const loginPage = (query, error) => `<!doctype html><html><head><meta charset="utf-8"><title>Mock IdP</title></head>
<body><h1>Mock Universal Login (E2E)</h1>${error ? `<p role="alert">${error}</p>` : ''}
<form method="post" action="/authorize?${new URLSearchParams(query)}">
<label>Email <input id="username" name="username" type="email" autocomplete="username"></label>
<label>Password <input id="password" name="password" type="password" autocomplete="current-password"></label>
<button type="submit" name="action" value="default">Continue</button></form></body></html>`;

async function idpHandler(req, res) {
  cors(res, req);
  const url = new URL(req.url, ISSUER);
  if (req.method === 'OPTIONS') return res.writeHead(204).end();

  if (url.pathname === '/.well-known/openid-configuration') {
    return json(res, 200, {
      issuer: ISSUER,
      authorization_endpoint: `${ISSUER}authorize`,
      token_endpoint: `${ISSUER}oauth/token`,
      userinfo_endpoint: `${ISSUER}userinfo`,
      jwks_uri: `${ISSUER}.well-known/jwks.json`,
      end_session_endpoint: `${ISSUER}v2/logout`,
      response_types_supported: ['code'],
      subject_types_supported: ['public'],
      id_token_signing_alg_values_supported: ['RS256'],
    });
  }
  if (url.pathname === '/.well-known/jwks.json') return json(res, 200, { keys: [jwk] });

  if (url.pathname === '/authorize') {
    const q = Object.fromEntries(url.searchParams);
    if (req.method === 'GET') {
      res.writeHead(200, { 'content-type': 'text/html' });
      return res.end(loginPage(q));
    }
    const form = await readBody(req);
    const email = String(form.username ?? '').trim().toLowerCase();
    if (!userFor(email) || form.password !== PASSWORD) {
      res.writeHead(401, { 'content-type': 'text/html' });
      return res.end(loginPage(q, 'Wrong email or password'));
    }
    const code = `code-${randomBytes(12).toString('hex')}`;
    codes.set(code, {
      email, clientId: q.client_id, redirectUri: q.redirect_uri, challenge: q.code_challenge,
      nonce: q.nonce, scope: q.scope ?? 'openid profile email',
    });
    const back = new URL(q.redirect_uri);
    back.searchParams.set('code', code);
    back.searchParams.set('state', q.state);
    res.writeHead(302, { location: back.toString() });
    return res.end();
  }

  if (url.pathname === '/oauth/token' && req.method === 'POST') {
    const body = await readBody(req);
    if (body.grant_type === 'authorization_code') {
      const entry = codes.get(body.code);
      codes.delete(body.code);
      const verifier = createHash('sha256').update(String(body.code_verifier ?? '')).digest('base64url');
      if (!entry || entry.challenge !== verifier || entry.redirectUri !== body.redirect_uri) {
        return json(res, 400, { error: 'invalid_grant', error_description: 'bad code or PKCE verifier' });
      }
      return json(res, 200, tokensFor(entry.email, entry.clientId, entry.nonce, entry.scope));
    }
    if (body.grant_type === 'refresh_token') {
      const entry = refreshTokens.get(body.refresh_token);
      if (!entry) return json(res, 403, { error: 'invalid_grant', error_description: 'unknown refresh token' });
      return json(res, 200, tokensFor(entry.email, entry.clientId, undefined, entry.scope));
    }
    if (body.grant_type === 'client_credentials') {
      return json(res, 200, { access_token: `m2m-${randomBytes(8).toString('hex')}`, token_type: 'Bearer', expires_in: 86400 });
    }
    return json(res, 400, { error: 'unsupported_grant_type' });
  }

  // Management API (M2M): the role assignment the backend does at onboarding and supplier registration.
  if (url.pathname.startsWith('/api/v2/')) {
    const rest = url.pathname.slice('/api/v2/'.length);
    if (rest === 'roles' && req.method === 'GET') {
      return json(res, 200, Object.entries(ROLE_IDS).map(([name, id]) => ({ id, name })));
    }
    const m = rest.match(/^users\/([^/]+)(\/roles)?$/);
    if (m) {
      const sub = decodeURIComponent(m[1]);
      const user = Object.values(USERS).find((u) => u.sub === sub);
      if (!user) return json(res, 404, { statusCode: 404, error: 'Not Found', message: 'The user does not exist.' });
      if (!m[2]) return json(res, 200, { user_id: sub, name: user.name, blocked: false });
      if (req.method === 'GET') {
        return json(res, 200, user.roles.map((name) => ({ id: ROLE_IDS[name], name })));
      }
      const body = await readBody(req);
      const names = (body.roles ?? []).map((id) => Object.keys(ROLE_IDS).find((n) => ROLE_IDS[n] === id)).filter(Boolean);
      if (req.method === 'POST') for (const n of names) if (!user.roles.includes(n)) user.roles.push(n);
      if (req.method === 'DELETE') user.roles = user.roles.filter((n) => !names.includes(n));
      res.writeHead(204);
      return res.end();
    }
    return json(res, 404, { error: 'not_found' });
  }

  if (url.pathname === '/v2/logout') {
    const target = url.searchParams.get('returnTo');
    res.writeHead(target ? 302 : 200, target ? { location: target } : {});
    return res.end();
  }
  return json(res, 404, { error: 'not_found' });
}

const outbox = [];
async function mailHandler(req, res) {
  const url = new URL(req.url, `http://localhost:${MAIL_PORT}`);
  if (req.method === 'POST' && url.pathname === '/emails') {
    const body = await readBody(req);
    outbox.push({ at: new Date().toISOString(), to: [].concat(body.to ?? []), subject: body.subject, html: body.html });
    return json(res, 200, { id: `mock-${outbox.length}` });
  }
  if (req.method === 'GET' && url.pathname === '/__outbox') return json(res, 200, outbox);
  if (req.method === 'DELETE' && url.pathname === '/__outbox') {
    outbox.length = 0;
    return json(res, 200, {});
  }
  if (req.method === 'GET' && url.pathname === '/__health') return json(res, 200, { ok: true });
  return json(res, 404, { error: 'not_found' });
}

const tls = { key: readFileSync(process.env.E2E_TLS_KEY), cert: readFileSync(process.env.E2E_TLS_CERT) };
createHttpsServer(tls, (req, res) => idpHandler(req, res).catch((e) => json(res, 500, { error: String(e) })))
  .listen(IDP_PORT, () => console.log(`mock IdP on ${ISSUER}`));
createHttpServer((req, res) => mailHandler(req, res).catch((e) => json(res, 500, { error: String(e) })))
  .listen(MAIL_PORT, () => console.log(`mock mail on http://localhost:${MAIL_PORT}`));
