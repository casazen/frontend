import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCurrentUserWithOrg } from './helpers/org-api-mock';
import { buildCreatedProperty, NEW_PROPERTY_ID } from './fixtures/properties.fixtures';
import { pinE2eLocale } from './helpers/locale';

// Real wizard UI; only the external provider's answer is mocked. Artifacts make desktop/phone review reproducible in CI.
for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
  test(`AI price estimate preserves CHF and manual choices at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await pinE2eLocale(page, 'it');
    await mockCurrentUserWithOrg(page);
    await mockPropertiesApi(page, [buildCreatedProperty({ country: 'CH', city: 'Lugano', postalCode: '6900', currency: 'CHF', nightlyRate: 120 })]);
    let calls = 0;
    await page.route('**/api/properties/*/price-suggestion', async route => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ json: { available: true } });
        return;
      }
      calls += 1;
      await route.fulfill({ json: {
        aiUsed: calls > 1, currency: 'CHF', reason: calls === 1 ? 'ai_unavailable' : null,
        nightlyRate: calls > 1 ? 140 : null, rangeMin: calls > 1 ? 120 : null, rangeMax: calls > 1 ? 165 : null,
        cleaningFee: null, weekendSurchargePercent: null, minNights: null,
        rationale: calls > 1 ? 'Stima generale per Lugano: rivedi il prezzo prima di confermarlo.' : null,
        basedOn: { comune: 'Lugano', province: null, region: null, similarListings: 0, amenities: 1, usedFields: ['guests', 'bedrooms', 'amenities'] },
      } });
    });
    await page.goto(demoUrl(`/app/short-rent/properties/create?propertyId=${NEW_PROPERTY_ID}&step=prices`, 'short-stay'));
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'prices');
    const input = page.getByLabel('Prezzo base per notte (CHF)', { exact: true });
    await expect(input).toHaveValue('120');
    await page.getByTestId('property-wizard-ai-price-yes').click();
    await expect(page.getByTestId('property-wizard-ai-price-none')).toBeVisible();
    await expect(input).toHaveValue('120');
    await testInfo.attach(`price-unavailable-${viewport.width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
    await page.getByRole('button', { name: 'Riprova', exact: true }).click();
    await expect(page.getByTestId('property-wizard-ai-price-rate')).toContainText('CHF');
    await expect(input).toHaveValue('120');
    await expect(page.getByTestId('property-wizard-ai-price-based-on')).toContainText('Lugano');
    await page.getByTestId('property-wizard-ai-price-apply').click();
    await expect(input).toHaveValue('140');
    expect(calls).toBe(2);
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(sideways).toBeLessThanOrEqual(1);
    await testInfo.attach(`price-applied-${viewport.width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' });
  });
}
