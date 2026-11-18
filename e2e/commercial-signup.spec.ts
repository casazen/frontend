import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { completeOnboardingConsents } from './helpers/onboarding';
const plans = ['Starter', 'Pro', 'Scale', 'Agency'].map(tier => ({ tier, displayName: tier, priceMonthly: tier === 'Agency' ? 11 : 20, agencyTariff: tier === 'Agency' ? { purchasable: true, minimum: 100, quoteFrom: 400, bands: [{ upTo: 49, unitPrice: 11 }, { upTo: 149, unitPrice: 9.9 }, { upTo: 399, unitPrice: 8.8 }] } : null, currency: 'EUR', unitAllowance: tier === 'Scale' || tier === 'Agency' ? -1 : 3, features: ['Archivio documenti'], purchasable: true }));
test.setTimeout(120_000);
test.beforeEach(async ({ page }) => {
  await page.route('**/api/billing/plans', route => route.fulfill({ json: plans }));
  await page.route('**/api/billing/commercial-catalog', route => route.fulfill({ json: [
    { code: 'channels', context: 'short-rent', priceMonthly: 3, currency: 'EUR', purchasable: true, agencyIncluded: true, agencyPurchasable: true },
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
  await expect(page.getByText('3 camere ipotizzate')).toBeVisible();
  await expect(page.getByText(/100,00/, { exact: false }).last()).toBeVisible();
  await page.getByRole('button', { name: 'Vai al riepilogo' }).click();
  await expect(page.getByRole('heading', { name: 'La tua configurazione' })).toBeVisible();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 390);
});

test('checkout request carries the chosen modules independently of the room estimate; a success URL alone never grants access', async ({ page }) => {
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
    expect(route.request().postDataJSON()).toMatchObject({ planTier: 'Agency', billingCountry: 'IT', returnPath: '/onboarding', commercialSignup: { profile: 'agency', rentalArea: 'Both', rooms: 1, addons: ['channels'] } });
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
  await page.getByRole('button', { name: 'Continua all’attivazione' }).click();
  await completeOnboardingConsents(page);
  await page.locator('#signup-billing-country').selectOption('IT');
  await page.getByRole('button', { name: 'Configura la fatturazione su Stripe' }).click();
  await expect(page).toHaveURL(/checkout.stripe.com/);
  await page.goto(demoUrl('/onboarding?checkout=success', 'onboarding'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: 'Stiamo verificando l’attivazione.' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Entra e inizia la configurazione' })).toHaveCount(0);
});

test('pause and resume agency setup on a phone without accepting legal documents or starting checkout', async ({ page }) => {
  let writes = 0;
  await page.route('**/api/users/onboarding', route => { writes++; return route.abort(); });
  await page.route('**/api/billing/checkout-session', route => { writes++; return route.abort(); });
  await page.setViewportSize({ width: 320, height: 780 });
  await page.goto(demoUrl('/onboarding', 'onboarding'));
  await page.getByTestId('signup-profile-agency').click();
  await page.getByRole('button', { name: 'Vai al riepilogo' }).click();
  const name = page.getByLabel('Nome dell’agenzia');
  await expect(name).toBeFocused();
  await expect(name).toHaveAttribute('aria-invalid', 'true');
  await name.fill('Agenzia Campione');
  await page.getByRole('radio', { name: 'Affitti brevi e lunghi' }).check();
  await page.getByRole('button', { name: 'Vai al riepilogo' }).click();
  await page.getByRole('button', { name: 'Metti in pausa' }).click();
  await expect(page.getByRole('heading', { name: 'Configurazione in pausa' })).toBeFocused();
  await page.reload();
  await expect(page.getByRole('heading', { name: 'La tua configurazione' })).toBeVisible();
  await expect(page.getByText('Agenzia Campione', { exact: true })).toBeVisible();
  await expect(page.locator('body')).toHaveJSProperty('scrollWidth', 320);
  await page.getByRole('button', { name: 'Continua all’attivazione' }).click();
  const consents = page.getByTestId('onboarding-consents-step');
  await consents.getByRole('checkbox').first().check();
  await expect(consents.getByRole('status')).toContainText('1 su 4');
  await page.reload();
  await page.getByRole('button', { name: 'Continua all’attivazione' }).click();
  await expect(consents.getByRole('checkbox').first()).not.toBeChecked();
  await expect(consents.getByRole('status')).toContainText('0 su 4');
  expect(writes).toBe(0);
});
