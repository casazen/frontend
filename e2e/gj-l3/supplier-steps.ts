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

  // SU-05: five steps saved by the server; the wizard opens at the first incomplete one. Registration and the invite
  // already completed the identity (business name, phone) and the services (the invite's category and comune).
  await expect(page.locator('#bio')).toBeVisible({ timeout: 20_000 });
  await page.getByTestId('supplier-activation-nav-identity').click();
  await expect(page.locator('#legal-name')).toHaveValue(legalName);
  await page.getByTestId('supplier-activation-nav-services').click();
  await expect(page.getByTestId('service-category-cleaning')).toHaveAttribute('aria-pressed', 'true', { timeout: 20_000 });
  await expect(page.getByTestId('supplier-comuni-chosen')).toContainText('Roma');
  // Step 4: professional description; step 5: terms of the version in force, then activate.
  await page.getByTestId('supplier-activation-nav-profile').click();
  await page.locator('#bio').fill(`Pulizie professionali di appartamenti turistici a Roma (${legalName}).`);
  await page.getByRole('button', { name: 'Salva e continua' }).click();
  await page.locator('#tos').click();
  await page.getByRole('button', { name: 'Attiva profilo' }).click();
  await expect(page).toHaveURL(/\/app\/supplier\/dashboard/, { timeout: 30_000 });
}
