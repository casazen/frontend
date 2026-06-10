import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { demoCinCompliance, mockCinComplianceApi } from './helpers/cin-mock';
import { mockPropertiesApi } from './helpers/properties-api-mock';

test.describe('CIN Management MVP (#2)', () => {
  test.beforeEach(async ({ page }) => {
    await mockCinComplianceApi(page);
    await mockPropertiesApi(page);
  });

  test.describe('AC5 deadline banner', () => {
    test('properties list shows CIN deadline banner when non-compliant', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'));

      await expect(page.getByTestId('cin-deadline-banner')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText(/Conformità CIN richiesta/i)).toBeVisible();
    });
  });

  test.describe('AC7 owner compliance dashboard', () => {
    test('dashboard shows summary and property rows', async ({ page }) => {
      await page.goto(demoUrl('/app/short-rent/cin', 'short-stay'));

      await expect(page.getByTestId('cin-compliance-page')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByTestId('cin-summary-cards')).toBeVisible();
      await expect(page.getByTestId('cin-days-until-deadline')).toHaveText(
        String(demoCinCompliance.summary.daysUntilDeadline),
      );
      await expect(page.getByTestId('cin-compliance-table')).toBeVisible();
      await expect(page.getByTestId('cin-row-eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee')).toContainText('Mancante');
      await expect(page.getByTestId('cin-row-ffffffff-ffff-ffff-ffff-ffffffffffff')).toContainText('Valido');
    });
  });
});
