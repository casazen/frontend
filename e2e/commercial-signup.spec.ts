import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { completeOnboardingConsents } from './helpers/onboarding';
const plans = ['Starter', 'Pro', 'Scale', 'Agency'].map(tier => ({ tier, displayName: tier, priceMonthly: tier === 'Agency' ? 12 : 20, currency: 'EUR', unitAllowance: tier === 'Scale' || tier === 'Agency' ? -1 : 3, features: ['Archivio documenti'], purchasable: true }));
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/plans', route => route.fulfill({ json: plans }));
  await page.route('**/api/billing/commercial-catalog', route => route.fulfill({ json: [
    { code: 'channels', context: 'short-rent', priceMonthly: 3, currency: 'EUR', purchasable: true },
    { code: 'operations', context: 'all', priceMonthly: 2, currency: 'EUR', purchasable: true },
  ] }));
});
test('three profiles, Starter lock and per-room agency summary on desktop and mobile', async ({ page }) => {
  await page.goto(demoUrl('/onboarding', 'onboarding'));
  await expect(page.getByTestId('commercial-signup')).toBeVisible();
  await expect(page.getByTestId(/^signup-profile-/)).toHaveCount(3);
  await page.getByTestId('signup-profile-owner').click();
  await expect(page.getByRole('radio')).toHaveCount(3);
  await expect(page.getByRole('checkbox').first()).toBeDisabled();
  await page.getByRole('button', { name: /Pro/ }).click();
  await expect(page.getByRole('checkbox').first()).toBeEnabled();
  await page.getByRole('button', { name: 'Indietro', exact: true }).click();
  await page.getByTestId('signup-profile-agency').click();
  await page.locator('#signup-agency-name').fill('Demo Agency');
  await page.getByRole('spinbutton').fill('3');
  await page.getByRole('checkbox').first().check();
  await expect(page.getByText('3 camere fatturate')).toBeVisible();
  await expect(page.getByText(/45,00/)).toBeVisible();
  await page.getByRole('button', { name: 'Vai al riepilogo' }).click();
  await expect(page.getByRole('heading', { name: 'La tua configurazione' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});

test('checkout request carries the chosen rooms and modules; a success URL alone never grants access', async ({ page }) => {
  let currentProfile: Record<string, unknown> = { id: 'demo|onboarding', email: 'demo@example.test', firstName: 'Demo', lastName: 'User', role: 'None', rentalType: null, isActive: true, orgId: null, org: null, onboardingCompletedAt: null };
  let selection: unknown;
  await page.route('**/api/users/me', route => route.fulfill({ json: currentProfile }));
  await page.route('**/api/users/onboarding', async route => {
    const body = route.request().postDataJSON(); selection = body.commercialSignup;
    expect(body.rentalType).toBe('Both');
    currentProfile = { ...currentProfile, role: 'PropertyOwner', rentalType: 'Both', orgId: 'org-test', org: { id: 'org-test', name: 'Demo', slug: 'demo', planTier: 'Starter' }, onboardingCompletedAt: '2026-11-16T22:00:00Z', consentsAccepted: true, commercialSetupRequired: true, commercialSignup: selection };
    await route.fulfill({ json: { orgId: 'org-test', orgProvisioned: true, rentalType: 'Both', rolesAssigned: ['PropertyOwner', 'LongTermLandlord'], rolesSynced: true } });
  });
  await page.route('**/api/billing/subscription', route => route.fulfill({ json: { status: 'none', planTier: 'Starter', billingCountry: null, vatId: null, currentPeriodEnd: null, seats: 1 } }));
  await page.route('**/api/billing/checkout-session', async route => {
    expect(route.request().postDataJSON()).toMatchObject({ planTier: 'Agency', billingCountry: 'IT', returnPath: '/onboarding', commercialSignup: { profile: 'agency', rentalArea: 'Both', rooms: 3, addons: ['channels'] } });
    await route.fulfill({ json: { checkoutUrl: 'https://checkout.stripe.com/c/test-commercial' } });
  });
  await page.route('https://checkout.stripe.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Sandbox checkout placeholder</p>' }));
  await page.goto(demoUrl('/onboarding', 'onboarding'));
  await page.getByTestId('signup-profile-agency').click();
  await page.getByRole('radio', { name: 'Affitti brevi e lunghi' }).check();
  await page.locator('#signup-agency-name').fill('Demo Agency');
  await page.getByRole('spinbutton').fill('3');
  await page.getByRole('checkbox').first().check();
  await page.getByRole('button', { name: 'Vai al riepilogo' }).click();
  await page.getByRole('button', { name: 'Continua al pagamento' }).click();
  await completeOnboardingConsents(page);
  await page.locator('#signup-billing-country').selectOption('IT');
  await page.getByRole('button', { name: 'Vai al pagamento sicuro' }).click();
  await expect(page).toHaveURL(/checkout.stripe.com/);
  await page.goto(demoUrl('/onboarding?checkout=success', 'onboarding'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Stiamo verificando il pagamento.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entra e inizia la configurazione' })).toHaveCount(0);
});
