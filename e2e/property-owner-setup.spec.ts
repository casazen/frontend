import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockCurrentUserWithOrg } from './helpers/org-api-mock';
import { createPropertyWithWizard, mockPropertiesApi } from './helpers/properties-api-mock';
import { NEW_PROPERTY_ID } from './fixtures/properties.fixtures';
import { expectNothingSticksOut } from './helpers/ui-checks';

for (const viewport of [{ width: 390, height: 844 }, { width: 1280, height: 900 }]) {
  test(`agency owner setup is required and stays readable at ${viewport.width}px`, async ({ page }, testInfo) => {
    await page.setViewportSize(viewport);
    await mockPropertiesApi(page);
    await mockCurrentUserWithOrg(page);
    await page.route('**/api/orgs/me/entitlement', route => route.fulfill({ json: {
      orgId: 'org-e2e-0001', planTier: 'Pro', limits: { maxProperties: 250 }, usage: { properties: 0 }, canAddProperty: true, isAgency: true,
    } }));
    await page.route('**/api/onboarding/owners/readiness**', route => {
      expect(new URL(route.request().url()).searchParams.get('propertyId')).toBe(NEW_PROPERTY_ID);
      return route.fulfill({ json: { asOf: '2026-11-17', summary: { owners: 0, properties: 1 }, owners: [], properties: [{ propertyId: NEW_PROPERTY_ID, ownershipReady: false }], truncated: false } });
    });
    await page.goto(demoUrl('/app/short-rent/properties/create', 'short-stay'));
    await createPropertyWithWizard(page, { name: 'Casa dei Mandorli', address: 'Via Roma 12', comune: 'Milano', postalCode: '20100' });
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'owner');
    await expect(page.getByRole('heading', { name: 'Di chi è questa casa?' })).toBeVisible();
    await expectNothingSticksOut(page, 'owner step');
    await page.screenshot({ path: testInfo.outputPath(`owner-onboarding-step-${viewport.width}.png`), fullPage: true, animations: 'disabled' });
    await page.getByTestId('property-wizard-next').click();
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'owner');
    await page.getByRole('button', { name: 'Assegna proprietario', exact: true }).click();
    await expect(page.getByTestId('owner-manual-name')).toBeInViewport();
    await expect(page.getByTestId('owner-manual-name')).toBeFocused();
    await expect(page.getByTestId('owner-import-dropzone')).toHaveCount(0);
    await expect(page.getByTestId('owner-manual-property')).toHaveValue(NEW_PROPERTY_ID);
    await expect(page.getByTestId('owner-manual-property')).toHaveAttribute('readonly');
    await expectNothingSticksOut(page, 'owner assignment dialog');
    await page.screenshot({ path: testInfo.outputPath(`owner-onboarding-assignment-${viewport.width}.png`), animations: 'disabled' });
  });
}
