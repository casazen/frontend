import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { mockCurrentUserWithOrg } from './helpers/org-api-mock';
import type { ConnectStatus } from '../src/types/connect.types';

const PAYMENTS_SETTINGS_URL = '/app/short-rent/settings/payments';

function mockConnectStatus(page: import('@playwright/test').Page, status: ConnectStatus) {
  return page.route('**/api/connect/status**', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(status),
    });
  });
}

test.describe('Stripe Connect onboarding (#222)', () => {
  test.beforeEach(async ({ page }) => {
    await mockCurrentUserWithOrg(page, { name: 'Acme Stays', slug: 'acme-stays' });
  });

  test('shows disconnected state and checkout gate banner', async ({ page }) => {
    await mockConnectStatus(page, {
      connectedAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirementsDue: [],
    });

    await page.goto(demoUrl(PAYMENTS_SETTINGS_URL, 'short-stay'));

    await expect(page.getByTestId('connect-status-badge')).toHaveText('Non collegato');
    await expect(page.getByTestId('connect-checkout-gate-banner')).toBeVisible();
    await expect(page.getByTestId('connect-stripe-cta')).toHaveText('Collega Stripe');
  });

  test('shows pending state with requirements prompt', async ({ page }) => {
    await mockConnectStatus(page, {
      connectedAccountId: 'acct_test_1',
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirementsDue: ['individual.verification.document'],
    });

    await page.goto(demoUrl(PAYMENTS_SETTINGS_URL, 'short-stay'));

    await expect(page.getByTestId('connect-status-badge')).toHaveText('In verifica');
    await expect(page.getByTestId('connect-requirements-alert')).toBeVisible();
    await expect(page.getByTestId('connect-stripe-cta')).toHaveText('Completa la verifica');
  });

  test('shows active state without gate banner', async ({ page }) => {
    await mockConnectStatus(page, {
      connectedAccountId: 'acct_test_1',
      chargesEnabled: true,
      payoutsEnabled: true,
      detailsSubmitted: true,
      requirementsDue: [],
    });

    await page.goto(demoUrl(PAYMENTS_SETTINGS_URL, 'short-stay'));

    await expect(page.getByTestId('connect-status-badge')).toHaveText('Attivo');
    await expect(page.getByTestId('connect-checkout-gate-banner')).toHaveCount(0);
    await expect(page.getByTestId('connect-stripe-cta')).toHaveCount(0);
  });

  test('Collega Stripe mints onboarding link and redirects', async ({ page }) => {
    await mockConnectStatus(page, {
      connectedAccountId: null,
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      requirementsDue: [],
    });

    let onboardingUrl = '';
    await page.route('**/api/connect/onboarding-link', async (route) => {
      if (route.request().method() !== 'POST') {
        await route.fallback();
        return;
      }

      // BK-09 (A3-42): the API builds the return and refresh pages; the client sends no URL.
      expect(route.request().postData() ?? '').not.toContain('returnUrl');
      onboardingUrl = 'https://connect.stripe.test/onboard/acct_test_new';

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ url: onboardingUrl }),
      });
    });

    await page.goto(demoUrl(PAYMENTS_SETTINGS_URL, 'short-stay'));
    await page.getByTestId('connect-stripe-cta').click();
    await expect.poll(() => onboardingUrl).not.toBe('');
  });

  test('Stripe unavailable shows the error with Riprova, never "Non collegato"', async ({ page }) => {
    await page.route('**/api/connect/status**', async (route) => {
      await route.fulfill({
        status: 503,
        contentType: 'application/problem+json',
        headers: { 'Retry-After': '10' },
        body: JSON.stringify({ status: 503, code: 'stripe_connect_unavailable', detail: 'Stripe non risponde' }),
      });
    });

    await page.goto(demoUrl(PAYMENTS_SETTINGS_URL, 'short-stay'));

    // The query retries a 5xx twice (1 s, 2 s) before showing the error.
    await expect(page.getByTestId('connect-status-error')).toBeVisible({ timeout: 10_000 });
    await expect(page.getByTestId('connect-status-error').getByRole('button', { name: 'Riprova' })).toBeVisible();
    await expect(page.getByTestId('connect-status-badge')).toHaveCount(0);
    await expect(page.getByTestId('connect-checkout-gate-banner')).toHaveCount(0);
  });
});
