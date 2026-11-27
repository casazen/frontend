import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockCurrentUserWithOrg, mockEntitlement } from './helpers/org-api-mock';

const PROPERTY_CREATE_URL = '/app/short-rent/properties/create';

test.describe('Multi-tenant Org boundary (#202)', () => {
  test('AC12 property create is blocked with an Italian plan-limit message and upgrade CTA', async ({ page }) => {
    await mockCurrentUserWithOrg(page, { name: 'Acme Stays', planTier: 'Starter' });
    await mockEntitlement(page, {
      planTier: 'Starter',
      maxProperties: 3,
      properties: 3,
      canAddProperty: false,
    });

    await page.goto(demoUrl(PROPERTY_CREATE_URL, 'short-stay'));

    const alert = page.getByTestId('plan-limit-alert');
    await expect(alert).toBeVisible();
    await expect(alert).toContainText('Hai raggiunto il limite del tuo piano');
    await expect(page.getByRole('link', { name: 'Passa a un piano superiore' })).toBeVisible();

    await expect(page.getByTestId('property-wizard-next')).toBeDisabled();
  });
});
