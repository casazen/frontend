import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvFile(relativePath: string): void {
  const absolutePath = resolve(process.cwd(), relativePath);
  if (!existsSync(absolutePath)) return;

  const content = readFileSync(absolutePath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex === -1) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim().replace(/^["']|["']$/g, '');
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvFile('.env');
loadEnvFile('.env.e2e');

export const e2eEnv = {
  baseUrl: process.env.E2E_BASE_URL ?? 'http://localhost:5173',
  auth0Email: process.env.E2E_AUTH0_EMAIL ?? '',
  auth0Password: process.env.E2E_AUTH0_PASSWORD ?? '',
  /** Optional: assert JWT `sub` after login (e.g. auth0|6a209c92984357dfe61c45ac) */
  auth0UserId: process.env.E2E_AUTH0_USER_ID ?? '',
  authStoragePath: 'e2e/.auth/long-term-user.json',
} as const;

export function requireE2eCredentials(): { email: string; password: string } {
  const { auth0Email, auth0Password } = e2eEnv;
  if (!auth0Email || !auth0Password) {
    throw new Error(
      'E2E_AUTH0_EMAIL and E2E_AUTH0_PASSWORD are required. Copy e2e/.env.example to .env.e2e and set a dedicated Auth0 database user with LongTermLandlord role.',
    );
  }

  return { email: auth0Email, password: auth0Password };
}
