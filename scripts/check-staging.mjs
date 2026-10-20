import { pathToFileURL } from 'node:url';

const REQUIRED = ['E2E_STAGING_API_URL', 'VITE_AUTH0_DOMAIN', 'VITE_AUTH0_CLIENT_ID', 'VITE_AUTH0_AUDIENCE', 'E2E_AUTH0_EMAIL', 'E2E_AUTH0_PASSWORD'];

export function stagingHealthUrl(env) {
  const missing = REQUIRED.filter(name => !env[name]?.trim());
  if (missing.length) throw new Error(`Missing staging configuration: ${missing.join(', ')}. Set repository variables and Actions secrets; no login was attempted.`);
  const base = new URL(env.E2E_STAGING_API_URL);
  if (!['http:', 'https:'].includes(base.protocol) || base.username || base.password || base.search || base.hash) {
    throw new Error('E2E_STAGING_API_URL must be an HTTP(S) API base URL without credentials, query or fragment.');
  }
  return new URL(`${base.href.replace(/\/$/, '')}/health/ready`);
}

export async function checkStaging(env = process.env, request = fetch) {
  const url = stagingHealthUrl(env);
  const response = await request(url, { signal: AbortSignal.timeout(15_000), redirect: 'error' });
  if (!response.ok || !response.headers.get('content-type')?.includes('application/json')) {
    throw new Error(`Staging API readiness failed (HTTP ${response.status}); verify the API URL and deployment before retrying browser login.`);
  }
  await response.json();
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  checkStaging().catch(error => {
    // Never print env values or response bodies: this check runs before authentication.
    console.error(error.message.startsWith('Missing staging') || error.message.startsWith('Staging API')
      ? error.message : 'Staging preflight failed: verify API URL, reachability and TLS configuration.');
    process.exitCode = 1;
  });
}
