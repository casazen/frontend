import {test, expect} from '@playwright/test';

// Real mandate component/dialog, synthetic contract response. Attachments are test bytes and are never sent externally.
for (const viewport of [{name: 'desktop', width: 1280, height: 900}, {name: 'mobile', width: 390, height: 844}]) {
  test(`owner mandate contract and reviewed terms on ${viewport.name}`, async ({page}, testInfo) => {
    await page.setViewportSize(viewport);
    await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
    await page.goto('/e2e/fixtures/owner-mandate.html');
    await page.getByTestId('mandate-new-version').click();
    const dialog = page.getByRole('dialog');
    const fits = async () => {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const bounds = await dialog.boundingBox();
      expect(bounds).not.toBeNull();
      expect(bounds!.width).toBeLessThanOrEqual(viewport.width);
    };
    const capture = async (name: string) => {
      const path = testInfo.outputPath(`owner-mandate-${viewport.name}-${name}.png`);
      await page.screenshot({path});
      await testInfo.attach(name, {path, contentType: 'image/png'});
    };
    await expect(page.getByTestId('mandate-upload')).toBeVisible();
    await expect(page.getByTestId('mandate-percent')).toHaveCount(0);
    await fits();
    await capture('contract');
    await page.getByTestId('mandate-upload-input').setInputFiles({name: 'mandato-firmato.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.7 synthetic test bytes')});
    await page.getByTestId('mandate-dialog-submit').click();
    await expect(page.getByTestId('mandate-percent')).toHaveValue('20,00');
    await expect(dialog.locator('h3')).toBeFocused();
    await page.getByTestId('mandate-percent').fill('22');
    await fits();
    await capture('commission');
    await page.getByTestId('mandate-dialog-submit').click();
    await expect(page.getByTestId('mandate-cleaning')).toHaveValue('70,00');
    await fits();
    await capture('fees');
    await page.getByTestId('mandate-back').click();
    await expect(page.getByTestId('mandate-percent')).toHaveValue('22');
    await page.getByTestId('mandate-dialog-submit').click();
    await page.getByTestId('mandate-dialog-submit').click();
    await expect(page.getByTestId('mandate-review')).toContainText('22%');
    await expect(page.getByTestId('mandate-review')).toContainText('mandato-firmato.pdf');
    await fits();
    await page.getByTestId('mandate-dialog-submit').scrollIntoViewIfNeeded();
    const submit = await page.getByTestId('mandate-dialog-submit').boundingBox();
    expect(submit!.y + submit!.height).toBeLessThanOrEqual(viewport.height);
    await capture('review');
    await page.getByRole('button', {name: 'Annulla', exact: true}).click();
    await expect(page.getByTestId('mandate-new-version')).toBeFocused();
  });
}
