import { test, expect } from '@playwright/test';

for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`owner profile guided editing and summaries on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
    await page.goto('/e2e/fixtures/owner-profile.html');
    await expect(page.getByTestId('profile-facts')).toBeVisible();
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const capture = async (name: string) => {
      const path = testInfo.outputPath(`owner-profile-${viewport.name}-${name}.png`);
      await page.screenshot({ path, fullPage: name === 'summary' });
      await testInfo.attach(name, { path, contentType: 'image/png' });
    };
    await fits();
    await expect(page.getByTestId('owner-address-form')).toHaveCount(0);
    await expect(page.getByTestId('owner-issuer-form')).toHaveCount(0);
    await expect(page.getByTestId('owner-address-summary')).toContainText('Via Roma');
    await expect(page.getByTestId('owner-issuer-facts')).toContainText('Marta Rossi');
    await capture('summary');

    await page.getByTestId('profile-new-version').click();
    await expect(page.getByTestId('profile-legal-name')).toBeVisible();
    await expect(page.getByTestId('profile-iban')).toHaveCount(0);
    await page.getByTestId('profile-legal-name').fill('Marta Bianchi');
    await capture('identity');
    await page.getByTestId('profile-dialog-submit').click();
    await expect(page.getByRole('dialog').locator('h3')).toBeFocused();
    await page.getByTestId('profile-country').fill('I');
    await expect(page.getByTestId('profile-dialog-submit')).toBeDisabled();
    await page.getByTestId('profile-country').fill('IT');
    await page.getByTestId('profile-back').click();
    await expect(page.getByTestId('profile-legal-name')).toHaveValue('Marta Bianchi');
    for (let step = 0; step < 6; step += 1) {
      await fits();
      await page.getByTestId('profile-dialog-submit').click();
      await expect(page.getByRole('dialog').locator('h3')).toBeFocused();
    }
    await expect(page.getByTestId('profile-review')).toContainText('Marta Bianchi');
    await expect(page.getByTestId('profile-review')).toContainText('IT-RULE');
    await page.getByTestId('profile-dialog-submit').scrollIntoViewIfNeeded();
    const submit = await page.getByTestId('profile-dialog-submit').boundingBox();
    expect(submit).not.toBeNull();
    expect(submit!.y + submit!.height).toBeLessThanOrEqual(viewport.height);
    await capture('review');
    await page.getByRole('button', { name: 'Annulla', exact: true }).click();
    await expect(page.getByTestId('profile-new-version')).toBeFocused();

    await page.getByTestId('owner-address-edit').click();
    await expect(page.getByTestId('owner-address-form')).toBeVisible();
    await fits();
    await capture('address');
    await page.getByRole('dialog').getByRole('button', { name: 'Chiudi', exact: true }).click();
    await page.getByTestId('owner-issuer-edit').click();
    await expect(page.getByTestId('owner-issuer-form')).toBeVisible();
    await fits();
    await page.getByTestId('owner-issuer-save').scrollIntoViewIfNeeded();
    await capture('issuer');
  });
}
