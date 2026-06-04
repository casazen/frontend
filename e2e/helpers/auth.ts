import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { requireE2eCredentials, e2eEnv } from './env';

export async function loginViaAuth0(page: Page): Promise<void> {
  const { email, password } = requireE2eCredentials();

  await page.goto('/login');
  await page.getByRole('button', { name: /sign in with auth0/i }).click();

  await page.waitForURL(/auth0\.com/, { timeout: 30_000 });

  const usernameField = page
    .locator('input[name="username"], input[name="email"], input[type="email"]')
    .first();
  await usernameField.waitFor({ state: 'visible', timeout: 15_000 });
  await usernameField.fill(email);

  const passwordField = page.locator('input[name="password"], input[type="password"]').first();
  const passwordVisible = await passwordField.isVisible().catch(() => false);

  if (!passwordVisible) {
    await page
      .locator(
        'button[type="submit"], button[name="action"], button[data-action-button-primary="true"]'
      )
      .first()
      .click();
    await passwordField.waitFor({ state: 'visible', timeout: 15_000 });
  }

  await passwordField.fill(password);

  await page
    .locator(
      'button[type="submit"], button[name="action"], button[data-action-button-primary="true"]'
    )
    .first()
    .click();

  await page.waitForURL((url) => !url.hostname.includes('auth0.com'), { timeout: 60_000 });
}

export async function readAuth0Sub(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const decodeSub = (token: string): string | null => {
      try {
        const segment = token.split('.')[1];
        if (!segment) return null;
        const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(
          normalized.length + ((4 - (normalized.length % 4)) % 4),
          '='
        );
        const payload = JSON.parse(atob(padded)) as { sub?: string };
        return payload.sub ?? null;
      } catch {
        return null;
      }
    };

    for (const key of Object.keys(localStorage)) {
      if (!key.includes('auth0spajs')) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as {
          body?: {
            id_token?: string;
            decodedToken?: { user?: { sub?: string } };
          };
        };

        const fromDecoded = parsed.body?.decodedToken?.user?.sub;
        if (fromDecoded) return fromDecoded;

        const idToken = parsed.body?.id_token;
        if (typeof idToken === 'string') {
          const sub = decodeSub(idToken);
          if (sub) return sub;
        }
      } catch {
        // try next cache entry
      }
    }

    return null;
  });
}

export async function readAuth0Roles(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const decodeRoles = (token: string): string[] => {
      try {
        const segment = token.split('.')[1];
        if (!segment) return [];
        const normalized = segment.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(
          normalized.length + ((4 - (normalized.length % 4)) % 4),
          '='
        );
        const payload = JSON.parse(atob(padded)) as Record<string, unknown>;
        const roles = payload['https://casazen.app/roles'];
        return Array.isArray(roles)
          ? roles.filter((role): role is string => typeof role === 'string')
          : [];
      } catch {
        return [];
      }
    };

    for (const key of Object.keys(localStorage)) {
      if (!key.includes('auth0spajs')) continue;
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as {
          body?: { access_token?: string; id_token?: string };
        };

        const accessToken = parsed.body?.access_token;
        if (typeof accessToken === 'string') {
          const roles = decodeRoles(accessToken);
          if (roles.length > 0) return roles;
        }

        const idToken = parsed.body?.id_token;
        if (typeof idToken === 'string') {
          const roles = decodeRoles(idToken);
          if (roles.length > 0) return roles;
        }
      } catch {
        // try next cache entry
      }
    }

    return [];
  });
}

export async function assertAuthenticatedUser(page: Page): Promise<void> {
  const sub = await readAuth0Sub(page);
  expect(sub, 'Auth0 sub missing after login').toBeTruthy();

  if (e2eEnv.auth0UserId) {
    expect(sub, `Expected Auth0 sub ${e2eEnv.auth0UserId}`).toBe(e2eEnv.auth0UserId);
  }

  const roles = await readAuth0Roles(page);
  expect(
    roles,
    'LongTermLandlord role missing in JWT — assign it in Auth0 for this user and update the Login Action to set roles on access + ID tokens'
  ).toContain('LongTermLandlord');
}

export async function waitForAppReady(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const text = document.body.innerText;
      if (text.includes('Authenticating...')) return false;
      if (text.includes('Sign in with Auth0')) return false;

      return (
        text.includes('Long-term leases') ||
        text.includes('Long-Term Rental') ||
        text.includes('Property Manager') ||
        text.includes('Dashboard') ||
        text.includes('No leases yet')
      );
    },
    undefined,
    { timeout: 90_000 }
  );
}
