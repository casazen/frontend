import { test, expect } from '@playwright/test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCurrentUserWithOrg, mockEntitlement } from './helpers/org-api-mock';

const PROPERTIES_URL = '/app/short-rent/properties';
const PROPERTY_CREATE_URL = '/app/short-rent/properties/create';

test.describe('Multi-tenant Org boundary (#202)', () => {
  test('AC11 header surfaces the caller org name and plan badge', async ({ page }) => {
    await mockCurrentUserWithOrg(page, { name: 'Acme Stays', planTier: 'Pro' });
    await mockPropertiesApi(page);

    await page.goto(demoUrl(PROPERTIES_URL, 'short-stay'));

    const badge = page.getByTestId('org-badge');
    await expect(badge).toBeVisible();
    await expect(badge).toContainText('Acme Stays');
    await expect(page.getByTestId('plan-badge')).toContainText('Pro');
  });

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

    // Server stays the source of truth, but the client pre-disables submit while over the limit.
    await expect(page.getByRole('button', { name: 'Create Property' })).toBeDisabled();
  });
});
