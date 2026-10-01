import { expect, type Page } from '@playwright/test';

/** Accept required onboarding consents and continue to the plan step. */
export async function completeOnboardingConsents(page: Page): Promise<void> {
  const consents = page.getByTestId('onboarding-consents-step');
  await expect(consents).toBeVisible({ timeout: 20_000 });
  const checkboxes = consents.getByRole('checkbox');
  const count = await checkboxes.count();
  for (let i = 0; i < count; i++) {
    await checkboxes.nth(i).check();
  }
  const continueButton = page.getByTestId('onboarding-consents-continue');
  await expect(continueButton).toBeEnabled({ timeout: 10_000 });
  await continueButton.click();
}

export async function completeOnboardingFromRentalChoice(
  page: Page,
  rentalButtonIndex: number,
): Promise<void> {
  await page.getByRole('button', { name: /Scegli|Choose/i }).nth(rentalButtonIndex).click();
  await completeOnboardingConsents(page);
  await expect(page.getByTestId('plan-selection-grid')).toBeVisible();
  await page.getByTestId('onboarding-plan-confirm').click();
}

/** Host booking create now requires guest contact (PC-07). */
export async function fillHostBookingGuestContact(page: Page): Promise<void> {
  await page.locator('[id="guest.firstName"]').fill('Mario');
  await page.locator('[id="guest.lastName"]').fill('Rossi');
  await page.locator('[id="guest.email"]').fill('mario.rossi@example.com');
  await page.locator('[id="guest.phone"]').fill('+393331234567');
  await page.locator('[id="guest.country"]').fill('IT');
}
