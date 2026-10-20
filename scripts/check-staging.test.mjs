// @vitest-environment node
import { test } from 'vitest';
import assert from 'node:assert/strict';
import { checkStaging, stagingHealthUrl } from './check-staging.mjs';
const env = { E2E_STAGING_API_URL: 'https://api.example.test/api/', VITE_AUTH0_DOMAIN: 'example.test', VITE_AUTH0_CLIENT_ID: 'client', VITE_AUTH0_AUDIENCE: 'audience', E2E_AUTH0_EMAIL: 'test@example.test', E2E_AUTH0_PASSWORD: 'never-print-this' };
test('missing configuration fails before a request and never prints credentials', async () => {
  let requested = false;
  await assert.rejects(checkStaging({ ...env, E2E_STAGING_API_URL: '' }, () => { requested = true; }), /Missing staging configuration: E2E_STAGING_API_URL/);
  assert.equal(requested, false);
});
test('the API prefix is preserved', () => assert.equal(stagingHealthUrl(env).href, 'https://api.example.test/api/health/ready'));
test('an HTML fallback and an unavailable database are rejected', async () => {
  await assert.rejects(checkStaging(env, async () => new Response('<html/>', { headers: { 'content-type': 'text/html' } })), /readiness failed/);
  await assert.rejects(checkStaging(env, async () => new Response('{}', { status: 503, headers: { 'content-type': 'application/json' } })), /HTTP 503/);
});
test('a reachable JSON health response permits the login phase', async () => {
  await checkStaging(env, async () => new Response('{"status":"Healthy"}', { headers: { 'content-type': 'application/json' } }));
});
