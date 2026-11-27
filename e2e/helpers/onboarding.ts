import { expect, type Page } from '@playwright/test';

export async function completeOnboardingFromRentalChoice(page: Page, rentalButtonIndex: number): Promise<void> {
  const rentalType = rentalButtonIndex === 1 ? 'LongTerm' : 'ShortTerm';
  const profile = 'owner';
  let created = false;
  let confirmed = false;
  let selection: unknown;
  await page.route('**/api/billing/plans', route => route.fulfill({ json: [{ tier: 'Starter', displayName: 'Starter', priceMonthly: 20, currency: 'EUR', unitAllowance: 3, features: [], purchasable: true }] }));
  await page.route('**/api/billing/commercial-catalog', route => route.fulfill({ json: [] }));
  await page.route('**/api/users/me', route => route.fulfill({ json: {
    id: 'demo|onboarding', email: 'host@example.test', firstName: 'Demo', lastName: 'Host', role: 'PropertyOwner',
    isActive: true, orgId: created ? 'org-test' : null, org: created ? { id: 'org-test', name: 'Demo', slug: 'demo', planTier: 'Starter' } : null,
    rentalType: created ? rentalType : null, onboardingCompletedAt: created ? '2026-11-01T00:00:00Z' : null,
    consentsAccepted: created, hasProperties: false, commercialSetupRequired: created && !confirmed, commercialSignup: selection,
  } }));
  await page.route('**/api/users/onboarding', route => {
    const body = route.request().postDataJSON();
    expect(body.rentalType).toBe(rentalType);
    selection = body.commercialSignup;
    created = true;
    return route.fulfill({ json: { orgId: 'org-test', orgProvisioned: true, rentalType, rolesAssigned: ['PropertyOwner'], rolesSynced: true } });
  });
  await page.route('**/api/me/contexts', route => {
    if (!created || !confirmed) return route.fulfill({ status: 403, json: { code: 'commercial_setup_required' } });
    return route.fulfill({ json: {
      userId: 'demo|onboarding',
      contexts: [{ contextKey: rentalType === 'LongTerm' ? 'long-rent' : 'short-rent', displayName: 'Host', roleKey: rentalType === 'LongTerm' ? 'long_term_landlord' : 'property_owner', permissions: ['property.read', 'property.write'], defaultRoute: rentalType === 'LongTerm' ? '/app/long-rent' : '/app/short-rent' }],
    } });
  });
  let paid = false;
  await page.route('**/api/billing/subscription', route => route.fulfill({ json: { status: paid ? 'active' : 'none', planTier: 'Starter', billingCountry: null, vatId: null, currentPeriodEnd: null, seats: 1 } }));
  await page.route('**/api/billing/checkout-session', route => {
    expect(route.request().postDataJSON()).toMatchObject({ planTier: 'Starter', billingCountry: 'IT', commercialSignup: { profile, rentalArea: rentalType } });
    return route.fulfill({ json: { checkoutUrl: 'https://checkout.stripe.com/c/test-commercial' } });
  });
  await page.route('https://checkout.stripe.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Stripe test checkout</p>' }));
  await page.getByTestId('signup-profile-owner').click();
  await page.locator(`input[name="rental-area"][value="${rentalType}"]`).check();
  await page.getByRole('button', { name: 'Vai al riepilogo' }).click();
  await page.getByRole('button', { name: 'Continua al pagamento' }).click();
  await completeOnboardingConsents(page);
  await page.locator('#signup-billing-country').selectOption('IT');
  await page.getByRole('button', { name: 'Vai al pagamento sicuro' }).click();
  await expect(page).toHaveURL(/checkout\.stripe\.com/);
  paid = true;
  await page.goto('/onboarding?checkout=success&demoProfile=onboarding');
  await expect(page.getByRole('button', { name: 'Entra e inizia la configurazione' })).toBeVisible();
  confirmed = true;
  await page.evaluate(next => sessionStorage.setItem('casazen:demo-profile', next), rentalType === 'LongTerm' ? 'long-term' : 'short-stay');
  await page.getByRole('button', { name: 'Entra e inizia la configurazione' }).click();
}

export async function completeOnboardingConsents(page: Page): Promise<void> {
  const consents = page.getByTestId('onboarding-consents-step');
  await expect(consents).toBeVisible({ timeout: 20_000 });
  const checks = consents.getByRole('checkbox');
  await expect(checks.first()).toBeVisible({ timeout: 20_000 });
  for (const checkbox of await checks.all()) await checkbox.check();
  const continueButton = page.getByTestId('onboarding-consents-continue');
  await expect(continueButton).toBeEnabled({ timeout: 10_000 });
  await continueButton.click();
}

export async function fillHostBookingGuestContact(page: Page): Promise<void> {
  await page.locator('[id="guest.name"]').fill('Mario Rossi');
  await page.locator('[id="guest.email"]').fill('mario.rossi@example.com');
}
