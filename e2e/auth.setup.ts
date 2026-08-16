import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loginViaAuth0, readAccessToken, readAuth0Roles, readAuth0Sub, waitForAppReady } from './helpers/auth';
import { e2eEnv, requireE2eCredentials } from './helpers/env';

setup.setTimeout(180_000);

async function waitForSession(page: import('@playwright/test').Page): Promise<void> {
  await page.waitForFunction(
    () => {
      for (const store of [localStorage, sessionStorage]) {
        for (const key of Object.keys(store)) {
          const raw = store.getItem(key) ?? '';
          if (raw.includes('access_token')) return true;
        }
      }
      const text = document.body.innerText;
      if (text.includes('Cruscotto') || text.includes('Il mio profilo')) return true;
      return /auth0\|[a-zA-Z0-9]+/.test(text);
    },
    undefined,
    { timeout: 90_000 },
  );
}

async function completeOnboardingIfNeeded(
  page: import('@playwright/test').Page,
): Promise<void> {
  await page.goto('/app/short-rent');
  await page.waitForLoadState('domcontentloaded');

  const wizard = page.getByRole('heading', { name: /Come vuoi usare CasaZen/i });
  if (!(await wizard.isVisible({ timeout: 10_000 }).catch(() => false))) {
    return;
  }

  const bothCard = page.locator('div').filter({ hasText: /^Entrambi/ }).getByRole('button', { name: 'Scegli' });
  if (await bothCard.isVisible({ timeout: 2_000 }).catch(() => false)) {
    await bothCard.click();
  } else {
    await page.getByRole('button', { name: 'Scegli' }).first().click();
  }

  const consents = page.getByTestId('onboarding-consents-step');
  if (await consents.isVisible({ timeout: 10_000 }).catch(() => false)) {
    const checkboxes = consents.getByRole('checkbox');
    const count = await checkboxes.count();
    for (let i = 0; i < Math.min(count, 4); i++) {
      await checkboxes.nth(i).check();
    }
    await page.getByTestId('onboarding-consents-continue').click();
  }

  await expect(page.getByTestId('plan-selection-grid')).toBeVisible({ timeout: 30_000 });
  await page.getByTestId('onboarding-plan-confirm').click();
  await page.waitForURL((url) => !url.pathname.includes('/onboarding'), { timeout: 60_000 });
  await waitForSession(page);
}

setup('authenticate long-term test user', async ({ page }) => {
  mkdirSync(dirname(e2eEnv.authStoragePath), { recursive: true });
  requireE2eCredentials();

  await loginViaAuth0(page);
  await waitForSession(page);
  await waitForAppReady(page);

  const token = await readAccessToken(page);
  const sub = await readAuth0Sub(page);
  if (!sub && !token) {
    const chrome = page
      .getByRole('heading', { name: /Cruscotto|Dashboard|Il mio profilo/i })
      .or(page.getByRole('button', { name: /@/ }))
      .or(page.getByRole('link', { name: /auth0\|/i }))
      .first();
    await expect(chrome, 'Auth0 session missing (no token cache and no authenticated chrome)').toBeVisible({
      timeout: 15_000,
    });
  } else if (sub && e2eEnv.auth0UserId) {
    expect(sub).toBe(e2eEnv.auth0UserId);
  }

  const roles = await readAuth0Roles(page);
  if (roles.length > 0) {
    expect(
      roles,
      'LongTermLandlord role missing in JWT — assign it in Auth0 for this user',
    ).toContain('LongTermLandlord');
  }

  await completeOnboardingIfNeeded(page);

  await page.goto('/app/short-rent');
  await expect(page.getByRole('heading').first()).toBeVisible({ timeout: 60_000 });

  await page.context().storageState({ path: e2eEnv.authStoragePath });
});
