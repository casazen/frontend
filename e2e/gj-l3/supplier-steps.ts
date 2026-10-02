import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { StackEnv } from './stack';
import { pickComune } from './host-steps';

/** Platform admin invites a supplier for a comune (self-serve registration is off: invite only). */
export async function inviteSupplier(admin: Page, email: string, comuneName: string): Promise<void> {
  await admin.goto('/app/admin/suppliers/invite');
  await admin.getByTestId('invite-email-input').fill(email);
  await pickComune(admin, '#comune-picker', comuneName);
  await admin.getByTestId('service-category-cleaning').click();
  await admin.getByTestId('invite-submit-btn').click();
}

/**
 * The invited supplier opens the email link, signs in with the invited account, registers the business and
 * completes the two-step activation wizard (as on a phone). Leaves the page on the supplier dashboard.
 */
export async function registerAndActivateSupplier(
  page: Page,
  stack: StackEnv,
  inviteLink: string,
  email: string,
  legalName: string,
): Promise<void> {
  await page.goto(inviteLink);
  await page.getByRole('button', { name: /Ho già un account/ }).click();
  await page.waitForURL(/\/authorize/);
  await page.locator('input#username').fill(email);
  await page.locator('input#password').fill(stack.password);
  await page.locator('button[type="submit"]').click();
  await page.waitForURL((url) => url.origin === new URL(stack.feUrl).origin);

  await expect(page.locator('#legalName')).toBeVisible({ timeout: 30_000 });
  // Email and comune come from the invite and are locked.
  await expect(page.locator('#email')).toHaveValue(email);
  await page.locator('#legalName').fill(legalName);
  await page.locator('#phone').fill('+390612345678');
  await page.getByRole('button', { name: 'Completa la registrazione' }).click();
  await page.getByRole('button', { name: /Completa il profilo/ }).click();

  // Step 1: the invite pre-selects its categories and comune (chip); the supplier confirms them.
  await expect(page.getByTestId('service-category-cleaning')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
  await expect(page.getByTestId('supplier-comuni-chosen')).toContainText('Roma');
  await page.getByRole('button', { name: 'Continua' }).click();
  // Step 2: availability can wait; accept the terms and activate.
  await page.locator('#tos').click();
  await page.getByRole('button', { name: 'Attiva profilo' }).click();
  await expect(page).toHaveURL(/\/app\/supplier\/dashboard/, { timeout: 30_000 });
}
