import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import { requireE2eCredentials, e2eEnv } from './env';

export async function loginViaAuth0(page: Page): Promise<void> {
  const { email, password } = requireE2eCredentials();

  // Capture browser console for debugging blank page issues
  const consoleLogs: string[] = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error' || msg.text().includes('[DEBUG]') || msg.text().includes('Error')) {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    }
  });
  page.on('pageerror', (err) => {
    consoleLogs.push(`[PAGE_ERROR] ${err.message}`);
  });

  await page.goto('/login', { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(3000);

  const loginButton = page.locator('button').filter({ hasText: /sign in|accedi|log in|login|auth0/i }).first();
  try {
    await loginButton.waitFor({ state: 'visible', timeout: 10_000 });
  } catch {
    await page.screenshot({ path: 'test-results/login-debug.png' });
    const bodyText = await page.locator('body').innerText().catch(() => '(body not found)');
    const title = await page.title().catch(() => '(no title)');
    const consoleDump = consoleLogs.length > 0 ? ` Console errors: ${consoleLogs.join(' | ')}` : '';
    throw new Error(`Login button not found. Page title: "${title}". Body text preview: "${bodyText.slice(0, 300)}".${consoleDump}`);
  }
  await loginButton.click();

  await page.waitForURL(/auth0\.com/, { timeout: 30_000 });
  await page.waitForLoadState('domcontentloaded');

  // New Universal Login sometimes shows a database-connection picker first.
  // Avoid "Forgot password" / generic Email links — those divert into reset flows.
  const preIdentifier = page
    .getByRole('button', { name: /continue with (email|password)|accedi con email/i })
    .or(page.locator('button[data-provider="auth0"]'))
    .first();
  if (await preIdentifier.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await preIdentifier.click();
  }

  // Auth0 Universal Login — username/email field (classic + New UL + identifier-first)
  const usernameSelectors = [
    'input#username',
    'input[name="username"]',
    'input[name="email"]',
    'input[type="email"]',
    'input[inputmode="email"]',
    'input[autocomplete="username"]',
    'input[autocomplete="email"]',
  ].join(', ');

  const usernameField = page.locator(usernameSelectors).first();
  try {
    await usernameField.waitFor({ state: 'visible', timeout: 20_000 });
  } catch {
    await page.screenshot({ path: 'test-results/auth0-username-debug.png', fullPage: true }).catch(() => undefined);
    const url = page.url();
    const title = await page.title().catch(() => '(no title)');
    const bodyText = await page.locator('body').innerText().catch(() => '(body not found)');
    const consoleDump = consoleLogs.length > 0 ? ` Console errors: ${consoleLogs.join(' | ')}` : '';
    throw new Error(
      `Auth0 username field not visible. URL: "${url}". Title: "${title}". Body preview: "${bodyText.slice(0, 500)}".${consoleDump}`,
    );
  }
  await usernameField.fill(email);

  const passwordField = page
    .locator('input#password, input[name="password"], input[type="password"], input[autocomplete="current-password"]')
    .first();
  const passwordVisible = await passwordField.isVisible({ timeout: 3_000 }).catch(() => false);

  if (!passwordVisible) {
    // Identifier-first: only the primary Continue action — never Forgot/Reset.
    const continueBtn = page
      .getByRole('button', { name: /^(continue|continua|next|avanti|log in|login|accedi)$/i })
      .or(page.locator('button[data-action-button-primary="true"]'))
      .or(page.locator('button[type="submit"][name="action"][value="default"]'))
      .first();
    await continueBtn.click();

    const resetHeading = page.getByRole('heading', { name: /check your email|controlla la tua email|reset/i });
    if (await resetHeading.isVisible({ timeout: 2_000 }).catch(() => false)) {
      throw new Error(
        'Auth0 entered password-reset flow instead of password login. Fix E2E user password in Auth0 (or avoid Forgot password) and retry.',
      );
    }

    try {
      await passwordField.waitFor({ state: 'visible', timeout: 15_000 });
    } catch {
      await page.screenshot({ path: 'test-results/auth0-password-debug.png', fullPage: true }).catch(() => undefined);
      const bodyText = await page.locator('body').innerText().catch(() => '(body not found)');
      throw new Error(`Auth0 password field not visible after Continue. Body preview: "${bodyText.slice(0, 500)}"`);
    }
  }

  await passwordField.fill(password);

  const finalSubmit = page
    .getByRole('button', { name: /^(continue|continua|log in|login|accedi|sign in)$/i })
    .or(page.locator('button[data-action-button-primary="true"]'))
    .or(page.locator('button[type="submit"][name="action"][value="default"]'))
    .first();
  await finalSubmit.click();

  await page.waitForURL((url) => !url.hostname.includes('auth0.com'), { timeout: 60_000 });
}

export async function readAccessToken(page: Page): Promise<string | null> {
  return page.evaluate(() => {
    const stores: Storage[] = [localStorage, sessionStorage];
    for (const store of stores) {
      for (const key of Object.keys(store)) {
        const raw = store.getItem(key);
        if (!raw?.includes('access_token')) continue;
        try {
          const parsed = JSON.parse(raw) as unknown;
          const walk = (value: unknown): string | null => {
            if (!value || typeof value !== 'object') return null;
            const record = value as Record<string, unknown>;
            const direct = record.access_token ?? (record.body as { access_token?: string } | undefined)?.access_token;
            if (typeof direct === 'string' && direct.length > 20) return direct;
            for (const nested of Object.values(record)) {
              const found = walk(nested);
              if (found) return found;
            }
            return null;
          };
          const token = walk(parsed);
          if (token) return token;
        } catch {
          const match = raw.match(/"access_token"\s*:\s*"([^"]+)"/);
          if (match?.[1]) return match[1];
        }
      }
    }
    return null;
  });
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

    const stores: Storage[] = [localStorage, sessionStorage];
    for (const store of stores) {
      for (const key of Object.keys(store)) {
        const raw = store.getItem(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw) as {
            body?: {
              id_token?: string;
              access_token?: string;
              decodedToken?: { user?: { sub?: string } };
            };
            id_token?: string;
            access_token?: string;
          };

          const fromDecoded = parsed.body?.decodedToken?.user?.sub;
          if (fromDecoded) return fromDecoded;

          const idToken = parsed.body?.id_token ?? parsed.id_token;
          if (typeof idToken === 'string') {
            const sub = decodeSub(idToken);
            if (sub) return sub;
          }

          const accessToken = parsed.body?.access_token ?? parsed.access_token;
          if (typeof accessToken === 'string') {
            const sub = decodeSub(accessToken);
            if (sub) return sub;
          }
        } catch {
          /* try next */
        }
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

    const stores: Storage[] = [localStorage, sessionStorage];
    for (const store of stores) {
    for (const key of Object.keys(store)) {
      if (!key.toLowerCase().includes('auth0') && !store.getItem(key)?.includes('access_token')) continue;
      try {
        const raw = store.getItem(key);
        if (!raw) continue;
        const parsed = JSON.parse(raw) as {
          body?: { access_token?: string; id_token?: string };
          access_token?: string;
          id_token?: string;
        };

        const accessToken = parsed.body?.access_token ?? parsed.access_token;
        if (typeof accessToken === 'string') {
          const roles = decodeRoles(accessToken);
          if (roles.length > 0) return roles;
        }

        const idToken = parsed.body?.id_token ?? parsed.id_token;
        if (typeof idToken === 'string') {
          const roles = decodeRoles(idToken);
          if (roles.length > 0) return roles;
        }
      } catch {
        // try next cache entry
      }
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
      if (text.includes('Caricamento...')) return false;
      if (text.includes('Sign in with Auth0')) return false;
      if (text.includes('Accedi con Auth0')) return false;

      // Token cache (any Auth0/storage key) or authenticated Italian chrome.
      let hasToken = false;
      for (const store of [localStorage, sessionStorage]) {
        for (const key of Object.keys(store)) {
          const raw = store.getItem(key);
          if (raw?.includes('access_token')) {
            hasToken = true;
            break;
          }
        }
        if (hasToken) break;
      }
      if (!hasToken && !text.includes('Cruscotto') && !text.includes('Il mio profilo')) {
        return false;
      }

      if (text.includes('Come vuoi usare CasaZen')) return true;

      const knownContent = [
        'Dashboard', 'Long-term leases', 'No leases yet',
        'Short-term rentals', 'Property Manager', 'Long-Term Rental',
        'Cruscotto', 'Immobili', 'Prenotazioni', 'Calendario',
        'Affitti brevi', 'Affitti lungo termine',
        'properties', 'bookings', 'calendar',
      ];
      return knownContent.some((fragment) => text.includes(fragment));
    },
    undefined,
    { timeout: 90_000 }
  );
}
