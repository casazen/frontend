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

  await page.goto('/profile');
  await expect(page.getByRole('heading', { name: email })).toBeVisible({ timeout: 15_000 });

  await page.context().storageState({ path: e2eEnv.authStoragePath });
});
