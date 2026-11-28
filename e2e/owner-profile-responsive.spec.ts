import { test, expect, type Page } from '@playwright/test';

// Real owner page and dialogs, with test-only API data. No authentication or production data is involved.
for (const viewport of [{ name: 'desktop', width: 1280, height: 900 }, { name: 'mobile', width: 390, height: 844 }]) {
  test(`owner profile path, sections and guided editing on ${viewport.name}`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
    await page.goto('/e2e/fixtures/owner-profile.html');
    await expect(page.getByTestId('owner-path')).toBeVisible();
    const fits = async () => expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    const capture = async (name: string) => {
      const path = testInfo.outputPath(`owner-profile-${viewport.name}-${name}.png`);
      await page.screenshot({ path, fullPage: true });
      await testInfo.attach(name, { path, contentType: 'image/png' });
    };
    const openTab = async (name: string) => {
      if (viewport.width < 768) await page.getByTestId('owner-tabs-select').selectOption(name);
      else await page.getByTestId(`owner-tab-${name}`).click();
      await expect(page.getByTestId('owner-tab-panel')).toBeVisible();
      await fits();
    };

    await fits();
    await expect(page.getByTestId('owner-address-form')).toHaveCount(0);
    await expect(page.getByTestId('owner-issuer-form')).toHaveCount(0);
    await expect(page.getByTestId('owner-path-progress')).toContainText('5 di 5');
    await expect(page.getByTestId('profile-onboarding')).toBeVisible();
    await capture('overview');

    await page.getByTestId('owner-step-identity').click();
    await expect(page.getByTestId('profile-facts')).toBeVisible();
    await expect(page.getByTestId('profile-value-fiscalCode')).not.toContainText('RSSMRT80A41F205X');
    await page.getByTestId('profile-reveal').click();
    await expect(page.getByTestId('profile-value-fiscalCode')).toContainText('RSSMRT80A41F205X');
    await capture('identity');

    await openTab('payments');
    await expect(page.getByTestId('owner-address-summary')).toContainText('Via Roma');
    await capture('payments');

    await openTab('mandate');
    await expect(page.getByTestId('owner-mandate-terms')).toContainText('20%');
    await capture('mandate');

    await openTab('documents');
    await expect(page.getByTestId('owner-issuer-facts')).toContainText('Marta Rossi');
    await capture('documents');

    await openTab('rule');
    await expect(page.getByTestId('profile-policy-section')).toContainText('IT-RULE');
    await expect(page.getByTestId('owner-units-section')).toBeVisible();
    await capture('rule');

    await openTab('reports');
    await expect(page.getByTestId('profile-history')).toBeVisible();
    await expect(page.getByTestId('owner-issued-documents-section')).toBeVisible();
    await capture('reports');

    await page.getByTestId('profile-new-version').click();
    await expect(page.getByTestId('profile-legal-name')).toBeVisible();
    await expect(page.getByTestId('profile-iban')).toHaveCount(0);
    await page.getByTestId('profile-legal-name').fill('Marta Bianchi');
    await capture('wizard-identity');
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
    await capture('wizard-review');
    await page.getByRole('button', { name: 'Annulla', exact: true }).click();
    await expect(page.getByTestId('profile-new-version')).toBeFocused();

    await openTab('payments');
    await page.getByTestId('profile-edit-2').click();
    await expect(page.getByTestId('profile-currency')).toBeVisible();
    await expect(page.getByTestId('profile-legal-name')).toHaveCount(0);
    await page.getByRole('button', { name: 'Annulla', exact: true }).click();

    await page.getByTestId('owner-address-edit').click();
    await expect(page.getByTestId('owner-address-form')).toBeVisible();
    await fits();
    await capture('address');
    await page.getByRole('dialog').getByRole('button', { name: 'Chiudi', exact: true }).click();

    await openTab('documents');
    await page.getByTestId('owner-issuer-edit').click();
    await expect(page.getByTestId('owner-issuer-form')).toBeVisible();
    await fits();
    await page.getByTestId('owner-issuer-save').scrollIntoViewIfNeeded();
    await capture('issuer');
  });
}

test('owner profile that is not ready tells what is missing in the path', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
  await page.goto('/e2e/fixtures/owner-profile.html?scenario=blocked');
  await expect(page.getByTestId('profile-focus')).toHaveAttribute('data-tone', 'warning');
  await expect(page.getByTestId('profile-status')).toContainText('Da completare');
  await expect(page.getByTestId('owner-path-progress')).toContainText('1 di 5');
  for (const step of ['payments', 'mandate', 'documents', 'rule']) await expect(page.getByTestId(`owner-step-${step}`)).toHaveAttribute('data-state', 'todo');
  await expect(page.getByTestId('profile-onboarding-reasons')).toBeVisible();
  await page.getByTestId('owner-step-payments').click();
  await expect(page.getByTestId('profile-value-bankAccountReference')).toContainText('Da indicare');
});

async function tabsByKeyboard(page: Page) {
  const tabs = page.getByRole('tablist').getByRole('tab');
  await tabs.first().focus();
  await page.keyboard.press('ArrowDown');
  await expect(tabs.nth(1)).toBeFocused();
}

test('owner profile sections are reachable by keyboard', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
  await page.goto('/e2e/fixtures/owner-profile.html');
  await expect(page.getByTestId('owner-path')).toBeVisible();
  await tabsByKeyboard(page);
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('profile-facts')).toBeVisible();
});
