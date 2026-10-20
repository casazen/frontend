import { test } from '@playwright/test';
import { waitForAppReady } from './helpers/auth';

test('consent-only onboarding is a valid post-login destination', async ({ page }) => {
  await page.setContent('<main><div data-testid="onboarding-consents-step">Documenti da riaccettare</div></main>');
  await waitForAppReady(page);
});
