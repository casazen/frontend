import { test as setup, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { loginViaAuth0, waitForAppReady } from './helpers/auth';
import { e2eEnv, requireE2eCredentials } from './helpers/env';

setup.setTimeout(120_000);

setup('authenticate long-term test user', async ({ page }) => {
  mkdirSync(dirname(e2eEnv.authStoragePath), { recursive: true });

  const { email } = requireE2eCredentials();

  await loginViaAuth0(page);
  await waitForAppReady(page);

  const onboarding = page.getByRole('heading', { name: /Come vuoi usare CasaZen/i });
  const landedOnOnboarding =
    page.url().includes('/onboarding') ||
    (await onboarding.isVisible({ timeout: 5_000 }).catch(() => false));
  if (landedOnOnboarding) {
    await expect(onboarding).toBeVisible({ timeout: 10_000 });
  } else {
    await page.goto('/app/short-rent/profile');
    const emailVisible = await page
      .getByText(email, { exact: false })
      .isVisible({ timeout: 10_000 })
      .catch(() => false);
    if (!emailVisible) {
      await expect(onboarding).toBeVisible({ timeout: 10_000 });
    }
  }

  await page.context().storageState({ path: e2eEnv.authStoragePath });
});
