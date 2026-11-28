import type { Page } from '@playwright/test';
import { expect } from '@playwright/test';
import type { StackEnv } from './stack';
import { pickComune } from './host-steps';

export async function registerAndActivateSupplier(
  page: Page,
  stack: StackEnv,
  inviteLink: string,
  email: string,
  legalName: string,
): Promise<void> {
  await page.goto(inviteLink);
  await expect(page.locator('#email')).toBeVisible({ timeout: 30_000 });
  await page.locator('#email').fill(email);
  await pickComune(page, '#comune', 'Roma');
  await page.locator('#legalName').fill(legalName);
  await page.locator('#phone').fill('+390612345678');
  await page.getByRole('button', { name: 'Completa la registrazione' }).click();
  await page.getByRole('button', { name: 'Crea il tuo account' }).click();
  await page.waitForURL(/\/authorize/);
  await page.locator('input#username').fill(email);
  await page.locator('input#password').fill(stack.password);
  await page.locator('button[type="submit"]').click();
  await expect(page).toHaveURL(/\/app\/supplier\/activation/, { timeout: 60_000 });
  await page.getByTestId('service-category-cleaning').click();
  await expect(page.getByTestId('supplier-comuni-chosen')).toContainText('Roma');
  await page.getByRole('button', { name: 'Salva e continua' }).click();
  await expect(page.locator('#bio')).toBeVisible({ timeout: 20_000 });
  await page.locator('#bio').fill(`Pulizie professionali di appartamenti turistici a Roma (${legalName}).`);
  await page.getByRole('button', { name: 'Salva e continua' }).click();
  await page.locator('#tos').click();
  await page.getByRole('button', { name: 'Attiva profilo' }).click();
  await expect(page).toHaveURL(/\/app\/supplier\/dashboard/, { timeout: 30_000 });
}
