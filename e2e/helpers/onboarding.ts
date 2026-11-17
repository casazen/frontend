import { expect, type Page } from '@playwright/test';

/** Completes the new host signup with a simulated payment on the demo-only browser suite. */
export async function completeOnboardingFromRentalChoice(page: Page, rentalButtonIndex: number): Promise<void> {
  const rentalType = rentalButtonIndex === 1 ? 'LongTerm' : 'ShortTerm';
  const profile = rentalType === 'LongTerm' ? 'long-rent' : 'owner';
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
  let paid = false;
  await page.route('**/api/billing/subscription', route => route.fulfill({ json: { status: paid ? 'active' : 'none', planTier: 'Starter', billingCountry: null, vatId: null, currentPeriodEnd: null, seats: 1 } }));
  await page.route('**/api/billing/checkout-session', route => {
    expect(route.request().postDataJSON()).toMatchObject({ planTier: 'Starter', billingCountry: 'IT', commercialSignup: { profile } });
    return route.fulfill({ json: { checkoutUrl: 'https://checkout.stripe.com/c/test-commercial' } });
  });
  await page.route('https://checkout.stripe.com/**', route => route.fulfill({ contentType: 'text/html', body: '<p>Stripe test checkout</p>' }));
  await page.getByTestId(`signup-profile-${profile}`).click();
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
  await page.getByRole('button', { name: 'Entra e inizia la configurazione' }).click();
}

export async function completeOnboardingConsents(page: Page): Promise<void> {
  const consents = page.getByTestId('onboarding-consents-step');
  await expect(consents).toBeVisible({ timeout: 20_000 });
  for (const checkbox of await consents.getByRole('checkbox').all()) await checkbox.check();
  const continueButton = page.getByTestId('onboarding-consents-continue');
  await expect(continueButton).toBeEnabled({ timeout: 10_000 });
  await continueButton.click();
}

export async function fillHostBookingGuestContact(page: Page): Promise<void> {
  await page.locator('[id="guest.name"]').fill('Mario Rossi');
  await page.locator('[id="guest.email"]').fill('mario.rossi@example.com');
}
