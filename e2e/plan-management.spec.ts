import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import {
  mockAdminUpdateOrgPlan,
  mockCurrentUserWithOrg,
  mockEntitlement,
  mockPlansCatalog,
} from './helpers/org-api-mock';

const PLAN_SETTINGS_URL = '/app/short-rent/settings/plan';
const ONBOARDING_URL = '/onboarding';
const ADMIN_USERS_URL = '/app/admin/users';

const PLAN_TIERS = ['Starter', 'Pro', 'Scale'] as const;

test.describe('Plan management (#202 extension)', () => {
  test.beforeEach(async ({ page }) => {
    await mockPlansCatalog(page);
  });

  for (const tier of PLAN_TIERS) {
    test(`onboarding wizard allows selecting ${tier} plan`, async ({ page }) => {
      await page.goto(demoUrl(ONBOARDING_URL, 'onboarding'));

      await page.getByRole('button', { name: 'Scegli' }).first().click();
      await expect(page.getByTestId('plan-selection-grid')).toBeVisible();

      await page.getByTestId(`plan-card-${tier}`).getByRole('button', { name: 'Seleziona' }).click();
      await page.getByTestId('onboarding-plan-confirm').click();

      await expect(page).not.toHaveURL(/\/onboarding/);
    });
  }

  for (const tier of PLAN_TIERS) {
    test(`owner can switch plan to ${tier} from settings`, async ({ page }) => {
      await mockCurrentUserWithOrg(page, { name: 'Acme Stays', planTier: 'Starter' });
      await mockEntitlement(page, { planTier: 'Starter', maxProperties: 3, properties: 1 });

      let updatedTier = '';
      await page.route('**/api/orgs/me/plan', async (route) => {
        if (route.request().method() !== 'PUT') {
          await route.fallback();
          return;
        }
        updatedTier = (route.request().postDataJSON() as { planTier?: string }).planTier ?? '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: 'org-e2e-0001',
            planTier: updatedTier,
            limits: { maxProperties: updatedTier === 'Pro' ? 50 : updatedTier === 'Scale' ? 999999 : 3 },
            usage: { properties: 1 },
            canAddProperty: true,
          }),
        });
      });

      await page.goto(demoUrl(PLAN_SETTINGS_URL, 'short-stay'));

      await expect(page.getByTestId('plan-usage-summary')).toBeVisible();
      const card = page.getByTestId(`plan-card-${tier}`);
      if (tier === 'Starter') {
        await expect(card.getByRole('button', { name: 'Piano attuale' })).toBeVisible();
        return;
      }

      await card.getByRole('button', { name: 'Passa a questo piano' }).click();
      await expect.poll(() => updatedTier).toBe(tier);
    });
  }

  test('org badge links to plan settings page', async ({ page }) => {
    await mockCurrentUserWithOrg(page, { name: 'Acme Stays', planTier: 'Pro' });
    await mockPropertiesApi(page);

    await page.goto(demoUrl('/app/short-rent/properties', 'short-stay'));
    await page.getByTestId('org-badge').click();
    await expect(page).toHaveURL(/\/settings\/plan/);
  });

  for (const tier of PLAN_TIERS) {
    test(`admin can set org plan to ${tier}`, async ({ page }) => {
      await mockAdminUpdateOrgPlan(page);

      let patchedTier = '';
      await page.route('**/api/admin/orgs/**/plan', async (route) => {
        if (route.request().method() !== 'PATCH') {
          await route.fallback();
          return;
        }
        patchedTier = (route.request().postDataJSON() as { planTier?: string }).planTier ?? '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            orgId: 'org-target',
            planTier: patchedTier,
            limits: { maxProperties: 50 },
            usage: { properties: 0 },
            canAddProperty: true,
          }),
        });
      });

      await page.route(/\/api\/users(\?.*)?$/, async (route) => {
        if (route.request().method() !== 'GET') {
          await route.continue();
          return;
        }

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            items: [
              {
                id: 'auth0|target-user',
                email: 'owner@example.com',
                firstName: 'Mario',
                lastName: 'Rossi',
                role: 'PropertyOwner',
                rentalType: 'ShortTerm',
                isActive: true,
                createdAt: '2026-01-01T00:00:00Z',
                orgId: 'org-target',
                orgName: 'Target Org',
                planTier: 'Starter',
              },
            ],
            totalCount: 1,
            page: 1,
            pageSize: 20,
          }),
        });
      });

      await page.goto(demoUrl(ADMIN_USERS_URL, 'admin'));

      await expect(page.getByRole('heading', { name: 'Gestione Utenti' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: 'Piano' }).click();
      await expect(page.getByRole('dialog')).toBeVisible();
      const card = page.getByTestId(`plan-card-${tier}`);
      if (tier === 'Starter') {
        await expect(card.getByRole('button', { name: 'Piano attuale' })).toBeDisabled();
        await page.keyboard.press('Escape');
        return;
      }

      await card.getByRole('button', { name: 'Imposta piano' }).click();
      await expect.poll(() => patchedTier).toBe(tier);
      await expect(page.getByRole('dialog')).toBeHidden();
    });
  }

  test('Starter plan limit blocks property create (regression AC12)', async ({ page }) => {
    await mockCurrentUserWithOrg(page, { name: 'Acme Stays', planTier: 'Starter' });
    await mockEntitlement(page, {
      planTier: 'Starter',
      maxProperties: 3,
      properties: 3,
      canAddProperty: false,
    });

    await page.goto(demoUrl('/app/short-rent/properties/create', 'short-stay'));

    await expect(page.getByTestId('plan-limit-alert')).toBeVisible();
    await expect(page.getByTestId('plan-limit-alert')).toContainText('Hai raggiunto il limite del tuo piano');
    await expect(page.getByRole('link', { name: 'Passa a un piano superiore' })).toHaveAttribute(
      'href',
      PLAN_SETTINGS_URL,
    );
  });
});
