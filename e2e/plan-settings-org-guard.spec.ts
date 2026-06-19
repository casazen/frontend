import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPlansCatalog } from './helpers/org-api-mock';

test.describe('Plan settings org guard (#283)', () => {
  test('redirects user without org to onboarding', async ({ page }) => {
    await mockPlansCatalog(page);

    await page.goto(demoUrl('/app/short-rent/settings/plan', 'onboarding'), {
      waitUntil: 'networkidle',
    });

    await expect(page).toHaveURL(/\/onboarding/);
    await expect(page.getByText(/Benvenuto|Welcome|CasaZen/i).first()).toBeVisible();
  });
});
