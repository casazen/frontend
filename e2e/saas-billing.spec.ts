import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockCurrentUserWithOrg, mockCurrentUserWithRole, mockPlansCatalog } from './helpers/org-api-mock';
import {
  mockBillingCheckoutSession,
  mockBillingPlans,
  mockBillingPortalSession,
  mockBillingSubscription,
} from './helpers/billing-api-mock';

const BILLING_SETTINGS_URL = '/settings/billing';
const BILLING_PLANS_URL = '/settings/billing/plans';
const BILLING_UPGRADE_URL = '/app/billing/upgrade';
const MVP_PLAN_SETTINGS_URL = '/app/short-rent/settings/plan';

const NON_ADMIN_MESSAGE =
  "Per gestire la fatturazione, contatta l'amministratore dell'organizzazione.";

test.describe('SaaS billing (#230)', () => {
  test.beforeEach(async ({ page }) => {
    await mockBillingPlans(page);
  });

  test('AC10: plans page shows tier cards and starts Stripe checkout', async ({ page }) => {
    await mockCurrentUserWithOrg(page, { planTier: 'Starter' });
    const checkout = await mockBillingCheckoutSession(page);

    await page.goto(demoUrl(BILLING_PLANS_URL, 'short-stay'));

    await expect(page.getByRole('heading', { name: 'Fatturazione' })).toBeVisible();
    await expect(page.getByTestId('billing-plans-grid')).toBeVisible();
    await expect(page.getByTestId('billing-plan-card-Pro')).toBeVisible();

    await page.getByTestId('billing-plan-card-Pro').getByRole('button', { name: 'Scegli piano' }).click();
    await expect(page.getByTestId('billing-checkout-dialog')).toBeVisible();
    await page.getByTestId('billing-country-select').selectOption('IT');
    await page.getByTestId('billing-vat-input').fill('12345678901');
    await page.getByRole('button', { name: 'Continua al pagamento' }).click();

    await expect.poll(() => checkout.getLastPayload()?.planTier).toBe('Pro');
    await expect.poll(() => checkout.getLastPayload()?.billingCountry).toBe('IT');
    await expect.poll(() => checkout.getLastPayload()?.vatId).toBe('12345678901');
  });

  test('AC11: billing settings shows subscription and opens Stripe portal', async ({ page }) => {
    await mockCurrentUserWithOrg(page, { planTier: 'Pro' });
    await mockBillingSubscription(page, { planTier: 'Pro', status: 'active' });
    await mockBillingPortalSession(page);

    await page.goto(demoUrl(BILLING_SETTINGS_URL, 'short-stay'));

    await expect(page.getByTestId('billing-subscription-panel')).toBeVisible();
    await expect(page.getByTestId('subscription-status-badge')).toHaveText('Attivo');
    await expect(page.getByTestId('billing-portal-cta')).toHaveText('Gestisci abbonamento');
    await page.getByTestId('billing-portal-cta').click();
  });

  test('AC12: checkout collects country and optional Partita IVA with Italian labels', async ({ page }) => {
    await mockCurrentUserWithOrg(page);
    const checkout = await mockBillingCheckoutSession(page);

    await page.goto(demoUrl(BILLING_PLANS_URL, 'short-stay'));
    await page.getByTestId('billing-plan-card-Starter').getByRole('button', { name: 'Scegli piano' }).click();

    await expect(page.getByLabel('Paese')).toBeVisible();
    await expect(page.getByLabel('Partita IVA')).toBeVisible();
    await page.getByTestId('billing-country-select').selectOption('DE');
    await page.getByTestId('billing-vat-input').fill('DE123456789');
    await page.getByRole('button', { name: 'Continua al pagamento' }).click();

    await expect.poll(() => checkout.getLastPayload()?.billingCountry).toBe('DE');
    await expect.poll(() => checkout.getLastPayload()?.vatId).toBe('DE123456789');
  });

  test('AC13: Staff user sees non-admin message on billing routes', async ({ page }) => {
    await mockCurrentUserWithRole(page, { role: 'Staff' });

    await page.goto(demoUrl(BILLING_PLANS_URL, 'short-stay'));
    await expect(page.getByTestId('billing-admin-denied')).toContainText(NON_ADMIN_MESSAGE);
    await expect(page.getByTestId('billing-plans-grid')).toHaveCount(0);
  });

  test('AC13: Guest user sees non-admin message on billing settings', async ({ page }) => {
    await mockCurrentUserWithRole(page, { role: 'Guest' });

    await page.goto(demoUrl(BILLING_SETTINGS_URL, 'short-stay'));
    await expect(page.getByTestId('billing-admin-denied')).toContainText(NON_ADMIN_MESSAGE);
  });

  test('AC10: subscription badge shows Italian past_due and canceled labels', async ({ page }) => {
    await mockCurrentUserWithOrg(page);

    await mockBillingSubscription(page, { status: 'past_due' });
    await page.goto(demoUrl(BILLING_SETTINGS_URL, 'short-stay'));
    await expect(page.getByTestId('subscription-status-badge')).toHaveText('In ritardo');

    await mockBillingSubscription(page, { status: 'canceled' });
    await page.reload();
    await expect(page.getByTestId('subscription-status-badge')).toHaveText('Scaduto');
  });

  test('AC10: /app/billing/upgrade redirects to billing plans', async ({ page }) => {
    await mockCurrentUserWithOrg(page);

    await page.goto(demoUrl(BILLING_UPGRADE_URL, 'short-stay'));
    await expect(page).toHaveURL(/\/settings\/billing\/plans/);
    await expect(page.getByTestId('billing-plans-grid')).toBeVisible();
  });

  test('AC10: MVP plan settings links to Stripe billing plans', async ({ page }) => {
    await mockCurrentUserWithOrg(page);
    await mockPlansCatalog(page);

    await page.goto(demoUrl(MVP_PLAN_SETTINGS_URL, 'short-stay'));
    await expect(page.getByTestId('stripe-billing-banner')).toBeVisible();
    await page.getByTestId('stripe-billing-banner').getByRole('link', { name: 'piani di fatturazione' }).click();
    await expect(page).toHaveURL(/\/settings\/billing\/plans/);
  });
});
