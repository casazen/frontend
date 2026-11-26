import { createHash, createHmac, randomUUID } from 'node:crypto';
import { expect, type Page } from '@playwright/test';
import { accessToken, loadStack } from './stack';

async function acceptConsents(page: Page): Promise<void> {
  const consents = page.getByTestId('onboarding-consents-step');
  await expect(consents).toBeVisible({ timeout: 30_000 });
  const checks = consents.getByRole('checkbox');
  await expect(checks.first()).toBeVisible({ timeout: 30_000 });
  for (const checkbox of await checks.all()) await checkbox.check();
  await expect(page.getByTestId('onboarding-consents-continue')).toBeEnabled({ timeout: 10_000 });
}

/**
 * The saved profile can trigger an application redirect before payment is shown. A successful POST is not a
 * navigation barrier: wait for the billing UI instead of competing with the app using page.goto('/onboarding').
 */
export async function provisionLegacyCommercialSignup(page: Page, profile: 'owner' | 'long-rent'): Promise<void> {
  await page.getByRole('button', { name: 'Scegli' }).nth(profile === 'long-rent' ? 1 : 0).click();
  await acceptConsents(page);
  const provisioned = page.waitForResponse(response => response.request().method() === 'POST' && response.url().endsWith('/api/users/onboarding'));
  await page.getByTestId('onboarding-consents-continue').click();
  expect((await provisioned).ok()).toBeTruthy();
  // This assertion follows any redirect initiated by onboarding and its guard; it never initiates another one.
  await expect(page.locator('#signup-billing-country')).toBeVisible({ timeout: 30_000 });
}

/** Drives signup in the UI, then simulates Stripe's signed subscription webhook in the disposable stack. */
export async function completeCommercialSignup(page: Page, profile: 'owner' | 'long-rent'): Promise<void> {
  // Platform administrators can voluntarily create an organization through the existing onboarding.
  const legacyHeading = page.getByRole('heading', { name: /Da dove vuoi iniziare/i });
  const profileCard = page.getByTestId('signup-profile-owner');
  await expect(legacyHeading.or(profileCard)).toBeVisible({ timeout: 30_000 });
  const legacy = await legacyHeading.isVisible();
  if (legacy) {
    await provisionLegacyCommercialSignup(page, profile);
  } else {
    await profileCard.click();
    if (profile === 'long-rent') await page.locator('input[name="rental-area"][value="LongTerm"]').check();
    await page.getByRole('button', { name: /^Pro\b/ }).click();
    if (profile === 'owner') {
      for (const name of ['Prenotazioni dirette', 'Adempimenti automatici', 'Interventi e fornitori']) {
        await expect(page.getByText(name, { exact: true })).toBeVisible();
      }
    }
    await page.getByRole('button', { name: 'Vai al riepilogo' }).click();
    await page.getByRole('button', { name: 'Continua al pagamento' }).click();
    await acceptConsents(page);
    await page.getByTestId('onboarding-consents-continue').click();
  }
  await expect(page.locator('#signup-billing-country')).toBeVisible({ timeout: 30_000 });
  const stack = loadStack();
  const token = await accessToken(page);
  const headers = { Authorization: `Bearer ${token}` };
  const response = await page.request.get(`${stack.apiUrl}/users/me`, { headers });
  expect(response.ok()).toBeTruthy();
  const me = await response.json() as { orgId: string; commercialSignup: { profile: string; planTier: string; rooms: number; agencyName: string | null; addons: string[]; rentalArea?: string } };
  const s = me.commercialSignup;
  const fingerprint = createHash('sha256').update(JSON.stringify({ Profile: s.profile, PlanTier: s.planTier, Rooms: s.rooms, AgencyName: s.agencyName ?? null, Addons: s.addons, RentalArea: s.rentalArea })).digest('hex').toUpperCase();
  const item = (price: string) => ({ id: `si_${randomUUID()}`, object: 'subscription_item', quantity: 1, price: { id: price, object: 'price' } });
  const body = JSON.stringify({ id: `evt_${randomUUID()}`, object: 'event', api_version: '2025-12-15.clover', request: null, created: Math.floor(Date.now() / 1000), livemode: false, pending_webhooks: 1, type: 'customer.subscription.created', data: { object: { id: `sub_${randomUUID()}`, object: 'subscription', status: 'active', customer: `cus_${randomUUID()}`, metadata: { orgId: me.orgId, commercialConfiguration: fingerprint }, items: { object: 'list', data: [item(s.planTier === 'Starter' ? 'price_e2e_starter' : 'price_e2e_pro')] } } } });
  const timestamp = Math.floor(Date.now() / 1000);
  const secret = process.env.STRIPE_TEST_WEBHOOK_SECRET || 'whsec_e2e_commercial_signup_secret';
  const signature = createHmac('sha256', secret).update(`${timestamp}.${body}`).digest('hex');
  const webhook = await page.request.post(`${new URL(stack.apiUrl).origin}/webhooks/stripe`, { data: body, headers: { 'content-type': 'application/json', 'stripe-signature': `t=${timestamp},v1=${signature}` } });
  expect(webhook.status()).toBe(200);
  await expect.poll(async () => {
    const result = await page.request.get(`${stack.apiUrl}/users/me`, { headers });
    return result.ok() && !(await result.json() as { commercialSetupRequired: boolean }).commercialSetupRequired;
  }, { timeout: 60_000 }).toBe(true);
  // An administrator's default home remains the staff console; open its newly configured host area.
  if (legacy) {
    await page.goto(profile === 'long-rent' ? '/app/long-rent/properties/new?first=1' : '/app/short-rent/properties/create?first=1');
    return;
  }
  await page.goto('/onboarding?checkout=success');
  const enter = page.getByRole('button', { name: 'Entra e inizia la configurazione' });
  await expect(enter).toBeVisible({ timeout: 30_000 });
  await enter.click();
}
