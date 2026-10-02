import { test, expect, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import {
  accessToken,
  createStripeTestConnectedAccount,
  linkConnectedAccount,
  loadStack,
  loginAs,
  oracleFor,
  romeDay,
  waitForMail,
  linkIn,
  type Oracle,
  type StackEnv,
} from './stack';
import { activateProperty, completeHostOnboarding, createProperty, PROPERTY } from './host-steps';
import { inviteSupplier, registerAndActivateSupplier } from './supplier-steps';
import { guestBooksStay, guestCompletesCheckIn, guestConfirmsEmail, type PaymentMode } from './guest-steps';

/**
 * Golden Journey L3 from the UI (FN-03, audit A6-04, A6-23, A6-24, A3-23).
 *
 * Four DISTINCT browser contexts against an ephemeral stack (real backend, throw-away PostgreSQL, mock IdP and mail,
 * see e2e/stack/): platform admin (invites the supplier), host, supplier (phone viewport: F1-F2) and anonymous guest.
 * Every action goes through the UI; the API is only an oracle for assertions (read-only, on behalf of the actor).
 * Dates are relative to today in Europe/Rome; accounts, slugs and emails are unique per run (no reuse, no cleanup).
 *
 * Two payment variants of the same journey:
 *  - "pay at the property" (D5): always runs; the host accepts the request.
 *  - Stripe test card: needs the CI secrets (STRIPE_TEST_*); without them it is SKIPPED with an explicit reason
 *    (and the workflow prints a warning), never silently passed.
 */

const SUPPLIER_PHONE_VIEWPORT = { width: 375, height: 812 };
const NIGHTS = 2;
const NIGHTLY_RATE = PROPERTY.nightlyRate;

/** A named step that also prints its start (CI logs show where a long journey is). */
const step = <T>(title: string, body: () => Promise<T>): Promise<T> => {
  console.log(`[gj-l3] ${new Date().toISOString()} ${title}`);
  return test.step(title, body);
};

type Actors = { admin: Page; host: Page; supplier: Page; guest: Page };

async function newActors(browser: Browser, errors5xx: string[]): Promise<{ actors: Actors; contexts: BrowserContext[] }> {
  const base = { ignoreHTTPSErrors: true, locale: 'it-IT', timezoneId: 'Europe/Rome' };
  const contexts = [
    await browser.newContext(base),
    await browser.newContext(base),
    await browser.newContext({ ...base, viewport: SUPPLIER_PHONE_VIEWPORT, isMobile: true, hasTouch: true }),
    await browser.newContext(base),
  ];
  const [admin, host, supplier, guest] = await Promise.all(contexts.map((c) => c.newPage()));
  for (const [name, page] of Object.entries({ admin, host, supplier, guest })) {
    page.on('response', (res) => {
      if (res.url().includes('/api/') && res.status() >= 500) errors5xx.push(`${name}: ${res.status()} ${res.url()}`);
    });
    // The cookie banner is not under test: the guest consents to essentials only.
    await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
  }
  return { actors: { admin, host, supplier, guest }, contexts };
}

type Booking = { id: string; status: string; checkInDate: string; checkOutDate: string; totalPrice?: number; totalAmount?: number };
type ServiceRequest = { id: string; status: string };

async function runGoldenJourney(browser: Browser, stack: StackEnv, request: import('@playwright/test').APIRequestContext, payment: PaymentMode): Promise<void> {
  const run = Date.now().toString(36);
  const emails = { admin: `gj-admin-${run}@example.test`, host: `gj-host-${run}@example.test`, supplier: `gj-supplier-${run}@example.test` };
  const guest = { firstName: 'Giulia', lastName: 'Bianchi', email: `gj-guest-${run}@example.test`, phone: '+393331234567' };
  const supplierName = `Pulizie Rapide GJ ${run}`;
  const propertySlug = `casa-gj-${run}`;
  const checkIn = romeDay(0);
  const checkOut = romeDay(NIGHTS);
  const errors5xx: string[] = [];
  const { actors, contexts } = await newActors(browser, errors5xx);
  const { admin, host, supplier, guest: guestPage } = actors;
  let hostApi!: Oracle;
  let supplierApi!: Oracle;
  const ids: Record<string, string> = {};

  try {
    await step('Platform admin invites the supplier by email', async () => {
      await loginAs(admin, stack, emails.admin);
      await inviteSupplier(admin, emails.supplier, 'Roma');
    });

    await step('Supplier accepts the invite, registers and activates the profile (phone viewport)', async () => {
      const invite = await waitForMail(request, stack, emails.supplier, /Invito/i);
      await registerAndActivateSupplier(supplier, stack, linkIn(invite, '/register'), emails.supplier, supplierName);
      supplierApi = oracleFor(request, stack, await accessToken(supplier));
      const profile = await supplierApi.get<{ status: string; orgId: string }>('/supplier/profile');
      expect(profile.status, 'supplier profile is Active').toBe('Active');
      ids.supplierOrgId = profile.orgId;
    });

    await step('Host onboards, creates the property and completes the activation wizard (publication)', async () => {
      await loginAs(host, stack, emails.host);
      await completeHostOnboarding(host);
      hostApi = oracleFor(request, stack, await accessToken(host));
      ids.propertyId = await createProperty(host, propertySlug);
      await activateProperty(host, ids.propertyId);
      await host.goto('/app/short-rent/settings/organization');
      await expect(host.locator('#org-slug')).not.toHaveValue('', { timeout: 20_000 });
      ids.orgSlug = await host.locator('#org-slug').inputValue();
    });

    await step('Host payments are ready (Stripe Connect account linked)', async () => {
      const accountId =
        payment === 'card'
          ? await createStripeTestConnectedAccount(process.env.STRIPE_TEST_SECRET_KEY ?? '')
          : 'acct_e2e_onsite_only';
      linkConnectedAccount(stack, ids.orgSlug, accountId);
      await host.goto('/app/short-rent/vetrina');
      await expect(host.getByText('Pubblicata', { exact: true })).toBeVisible({ timeout: 20_000 });
      const publicProperty = await request.get(`${stack.apiUrl}/public/orgs/${ids.orgSlug}/properties`);
      expect(publicProperty.status(), 'public site lists the published property').toBe(200);
      expect(JSON.stringify(await publicProperty.json())).toContain(propertySlug);
    });

    await step(`Guest books ${NIGHTS} nights on the public site and pays (${payment})`, async () => {
      ids.bookingId = await guestBooksStay(guestPage, {
        orgSlug: ids.orgSlug,
        propertySlug,
        checkIn,
        checkOut,
        guest,
        payment,
        nights: NIGHTS,
        nightlyRate: NIGHTLY_RATE,
      });
    });

    if (payment === 'onsite') {
      await step('Guest confirms the email, the host accepts the request in the console', async () => {
        const mail = await waitForMail(request, stack, guest.email, /Conferma la tua richiesta/i);
        await guestConfirmsEmail(guestPage, linkIn(mail, '/book/'));
        await host.goto('/app/short-rent/bookings?view=requests');
        await expect(host.getByText(`${guest.firstName} ${guest.lastName}`).first()).toBeVisible({ timeout: 30_000 });
        await host.getByRole('button', { name: 'Accetta' }).click();
      });
    }

    await step('Booking is Confirmed with the requested dates and the expected total', async () => {
      await expect
        .poll(async () => (await hostApi.get<Booking>(`/bookings/${ids.bookingId}`)).status, {
          message: 'booking Confirmed',
          timeout: 60_000,
        })
        .toBe('Confirmed');
      const booking = await hostApi.get<Booking>(`/bookings/${ids.bookingId}`);
      expect(booking.checkInDate.slice(0, 10)).toBe(checkIn);
      expect(booking.checkOutDate.slice(0, 10)).toBe(checkOut);
      expect(booking.totalPrice ?? booking.totalAmount, 'total = nights x nightly rate').toBe(NIGHTS * NIGHTLY_RATE);
      await waitForMail(request, stack, guest.email, /Prenotazione confermata/i);
    });

    await step('Host sees the booking in the calendar and sends the check-in link; guest completes the check-in', async () => {
      await host.goto('/app/short-rent/bookings/calendar');
      await host.locator('#calendar-property').selectOption(ids.propertyId);
      await expect(host.getByText(`${guest.firstName} ${guest.lastName}`).first()).toBeVisible({ timeout: 20_000 });

      const resentAt = new Date().toISOString();
      await host.goto(`/app/short-rent/bookings/${ids.bookingId}`);
      await host.getByTestId('booking-tab-guest').click();
      await host.getByTestId('checkin-resend-button').click();
      const mail = await waitForMail(request, stack, guest.email, /check-in/i, resentAt);
      await guestCompletesCheckIn(guestPage, linkIn(mail, '/checkin/'));
      await expect
        .poll(async () => JSON.stringify(await hostApi.get(`/bookings/${ids.bookingId}/checkin-session`)), {
          message: 'check-in session completed by the guest',
          timeout: 30_000,
        })
        .toMatch(/Completed|Completato/i);
    });

    await step('Host registers the arrival (booking CheckedIn)', async () => {
      await host.goto(`/app/short-rent/bookings/${ids.bookingId}`);
      await host.getByTestId('open-register-arrival').click();
      await host.getByTestId('register-arrival-submit').click();
      await expect
        .poll(async () => (await hostApi.get<Booking>(`/bookings/${ids.bookingId}`)).status, { timeout: 30_000 })
        .toBe('CheckedIn');
    });

    await step('Host asks the supplier for a cleaning of the stay', async () => {
      await host.goto(`/app/short-rent/bookings/${ids.bookingId}`);
      await host.getByTestId('request-supplier-btn').click();
      await host.locator('#sr-supplier').selectOption({ label: supplierName });
      await host.locator('#sr-notes').fill(`Pulizia di fine soggiorno ${run}`);
      await host.getByTestId('submit-service-request').click();
      await expect(host.getByText('In attesa che il fornitore accetti o rifiuti.')).toBeVisible({ timeout: 20_000 });
      const requests = await hostApi.get<ServiceRequest[] | { items: ServiceRequest[] }>(
        `/service-requests?bookingId=${ids.bookingId}`,
      );
      const list = Array.isArray(requests) ? requests : requests.items;
      expect(list, 'one service request for the stay').toHaveLength(1);
      expect(list[0].status).toBe('Richiesto');
      ids.serviceRequestId = list[0].id;
    });

    await step('F1: supplier (phone) takes the request in charge from the inbox', async () => {
      await supplier.goto('/app/supplier/inbox');
      await expect(supplier.getByTestId('supplier-inbox-page')).toBeVisible({ timeout: 20_000 });
      await supplier.getByTestId(`take-${ids.serviceRequestId}`).click();
      await expect(supplier.getByTestId(`complete-${ids.serviceRequestId}`)).toBeVisible({ timeout: 15_000 });
      expect((await supplierApi.get<ServiceRequest>(`/service-requests/${ids.serviceRequestId}`)).status).toBe('PresoInCarico');
    });

    await step('F2: supplier completes; the host console shows Completato within 30 s', async () => {
      await host.goto(`/app/short-rent/bookings/${ids.bookingId}`); // the host's session was already open on this stay
      await supplier.getByTestId(`complete-${ids.serviceRequestId}`).click();
      await expect(supplier.getByTestId(`complete-${ids.serviceRequestId}`)).toHaveCount(0, { timeout: 15_000 });
      await expect(async () => {
        await host.reload();
        await expect(host.getByText('Lavoro completato: segna pagato quando hai pagato il fornitore.')).toBeVisible({
          timeout: 4_000,
        });
      }).toPass({ timeout: 30_000, intervals: [1_000, 2_000, 3_000] });
    });

    await step('Host marks the supplier as paid', async () => {
      await host.getByRole('button', { name: 'Segna pagato' }).click();
      await host.getByTestId('mark-paid-confirm').click();
      await expect
        .poll(async () => (await hostApi.get<ServiceRequest>(`/service-requests/${ids.serviceRequestId}`)).status, {
          message: 'service request Pagato',
          timeout: 30_000,
        })
        .toBe('Pagato');
      expect((await hostApi.get<Booking>(`/bookings/${ids.bookingId}`)).status, 'stay still CheckedIn').toBe('CheckedIn');
    });

    await step('Host completes the check-out wizard; the compliance cockpit has nothing pending for the stay', async () => {
      await host.goto(`/app/short-rent/bookings/${ids.bookingId}/checkout`);
      await expect(host.getByTestId('checkout-wizard-page')).toBeVisible({ timeout: 20_000 });
      // CO-17: the 5 steps. The supplier request of the stay already covers the cleaning, so it is skipped.
      await host.getByTestId('checkout-confirm-departure').click();
      await host.getByTestId('checkout-step-next').click();
      await expect(host.getByTestId('checkout-step-panel-alloggiati')).toBeVisible({ timeout: 15_000 });
      await host.getByTestId('checkout-step-next').click();
      await host.getByTestId('checkout-cleaning-skip').click();
      await host.getByTestId('checkout-step-next').click();
      await host.getByTestId('checkout-tourist-tax-CollectedAtProperty').click();
      await host.getByTestId('checkout-step-next').click();
      await host.getByTestId('checkout-property-ready-yes').click();
      await host.getByTestId('checkout-complete-button').click();
      await expect(host.getByText(/Check-out completato/i)).toBeVisible({ timeout: 20_000 });
      await expect
        .poll(async () => (await hostApi.get<Booking>(`/bookings/${ids.bookingId}`)).status, { timeout: 30_000 })
        .toBe('CheckedOut');

      await host.goto('/app/short-rent');
      await expect(host.getByTestId('compliance-summary-widget')).toBeVisible({ timeout: 20_000 });
      const summary = await hostApi.get<{
        checkoutsDue?: { items?: { id?: string }[] };
        turnoversPending?: { items?: { id?: string }[] };
      }>('/compliance/summary');
      expect((summary.checkoutsDue?.items ?? []).map((i) => i.id)).not.toContain(ids.bookingId);
      expect((summary.turnoversPending?.items ?? []).map((i) => i.id)).not.toContain(ids.bookingId);
    });

    expect(errors5xx, 'no API 5xx during the whole journey').toEqual([]);

    // Seed for the app suite of FN-04 (Maestro) and for debugging: written as a CI artifact, never committed.
    mkdirSync('e2e/.auth', { recursive: true });
    writeFileSync(
      'e2e/.auth/gj-seed.json',
      JSON.stringify({ ...ids, ...emails, guestEmail: guest.email, supplierName, payment, stack: stack.apiUrl }, null, 2),
    );
  } finally {
    await Promise.all(contexts.map((c) => c.close()));
  }
}

test.describe('Golden Journey L3 from the UI (admin, host, supplier, guest)', () => {
  test.setTimeout(10 * 60_000);

  test('pay at the property (D5): host publishes, guest books, supplier works, host pays', async ({ browser, request }) => {
    await runGoldenJourney(browser, loadStack(), request, 'onsite');
  });

  test('Stripe test card: guest pays online and the webhook confirms the booking', async ({ browser, request }) => {
    const stack = loadStack();
    test.skip(
      !stack.stripe || !process.env.STRIPE_TEST_SECRET_KEY,
      'SKIPPED: Stripe test keys (STRIPE_TEST_SECRET_KEY / _PUBLISHABLE_KEY / _WEBHOOK_SECRET) are not available in this run: the online-payment journey did NOT run.',
    );
    await runGoldenJourney(browser, stack, request, 'card');
  });
});
