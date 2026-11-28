import { expect, test } from './test';
import { mockArrivalJourney, bookingId, guestName, property } from './helpers/arrival-journey';
import { expectNothingSticksOut, expectNoAxeViolations } from './helpers/ui-checks';
import { demoUrl } from './helpers/demo-profile';
import { todayInRome, addDays } from '../src/lib/stay-dates';
import type { CheckInWizardState } from '../src/types/checkin-wizard.types';
import type { Page } from '@playwright/test';
import { mockLeaseFlowApi, FLOW_LEASE_ID, FLOW_PROPERTY } from './helpers/lease-flow-mock';
import type { RentLedger } from '../src/types';

async function mockActiveLease(page: Page) {
  await mockLeaseFlowApi(page);
  const lease = {
    id: FLOW_LEASE_ID, propertyId: FLOW_PROPERTY.id, property: FLOW_PROPERTY, stage: 'Active',
    status: 'Registered', contractType: 'Libero', monthlyRent: 900, fiscalRegime: 'CedolareSecca',
    startDate: '2026-01-01', endDate: '2029-12-31', tenantFirstName: 'Giulia', tenantLastName: 'Verdi',
    parties: [{ id: 'tenant', role: 'Tenant', firstName: 'Giulia', lastName: 'Verdi', isExtraEU: false }],
    events: [], hasExtraEUTenant: false, currency: 'EUR', hasSignedPdf: true, overdueRentCount: 1, overdueRentAmount: 900,
  };
  const row = {
    id: 'affitto-novembre', periodStart: '2026-11-01', periodEnd: '2026-11-30', dueDate: '2026-11-05',
    amount: 900, currency: 'EUR', status: 'Scheduled', isOverdue: true, paidVia: null, paidOn: null,
    offlinePaymentNote: null, paymentRequestedAt: null, failureCode: null, lastFailedAt: null,
  } as const;
  const ledger: RentLedger = {
    leaseId: FLOW_LEASE_ID, monthlyRent: 900, canConfigure: true, onlinePaymentsAvailable: false, hasTenantEmail: true,
    schedule: { cadence: 'Monthly', billingDayOfMonth: 5, amount: 900, currency: 'EUR', isActive: true },
    installments: [row, { ...row, id: 'affitto-dicembre', periodStart: '2026-12-01', periodEnd: '2026-12-31', dueDate: '2026-12-05', isOverdue: false }],
    partialFinalPeriod: null, manualNotices: [],
  };
  await page.route(`**/api/leases/${FLOW_LEASE_ID}`, route => route.fulfill({ json: lease }));
  await page.route(`**/api/leases/${FLOW_LEASE_ID}/rent`, route => route.fulfill({ json: ledger }));
}

const invite = {
  orgName: 'Casa del Porto Demo', name: 'Giulia Verdi', email: 'giulia@example.test',
  role: 'Collaborator', areas: ['short-rent'], expiresAt: '2027-03-01T12:00:00Z',
};
const inviteToken = 'a'.repeat(64);

test.describe.configure({ timeout: 90_000 });

test('invito aperto con un altro account · compare il cambio account prima dei consensi', async ({ page }) => {
  await page.route('**/api/org-invitations/lookup', route => route.fulfill({ json: invite }));
  let accepted = 0;
  await page.route('**/api/org-invitations/accept', async route => {
    accepted += 1;
    await route.fulfill({ status: 409, json: {} });
  });
  await page.goto(demoUrl('/invite/accept?token=' + inviteToken, 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByTestId('invite-accept-switch')).toBeVisible();
  await expect(page.getByTestId('onboarding-consents-step')).toHaveCount(0);
  expect(accepted).toBe(0);
});

test('menu mobile · ricerca vuota, azzeramento e destinazione anche da tastiera', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockArrivalJourney(page);
  await page.route(/\/api\/guests(?:\?.*)?$/, route => route.fulfill({ json: { items: [], page: 1, pageSize: 20, totalCount: 0 } }));
  await page.goto(demoUrl('/app/short-rent', 'short-stay'), { waitUntil: 'domcontentloaded' });
  await page.locator('[data-more-trigger]').focus();
  await page.keyboard.press('Enter');
  const dialog = page.getByRole('dialog', { name: 'Altro' });
  const search = dialog.getByRole('searchbox', { name: 'Cerca nel menu' });
  await search.fill('zzz');
  await expect(dialog.getByRole('status')).toContainText(/Nessuna pagina/);
  await dialog.getByRole('button', { name: 'Azzera la ricerca nel menu' }).click();
  await expect(search).toBeFocused();
  await search.fill('Ospiti');
  const result = dialog.getByRole('link').filter({ hasText: 'Ospiti' }).first();
  await expect(result).toHaveAttribute('href', '/app/short-rent/guests');
  await expectNoAxeViolations(page, { include: '[role="dialog"]' });
  await result.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('heading', { level: 1, name: 'Ospiti' })).toBeFocused();
});

test('scheda prenotazione · correggere un documento e riprendere dal check-in', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await mockArrivalJourney(page);
  const checkIn = todayInRome();
  const state: CheckInWizardState = {
    booking: { bookingId, propertyId: property.id, propertyName: property.name, checkIn, checkOut: addDays(checkIn, 3),
      nights: 3, source: 'Manual', declaredGuests: 2, status: 'Confirmed' },
    attendance: 'Expected', requiredGuestFields: [], tax: null,
    guests: [{ position: 0, saved: false, type: 'SingleGuest', firstName: 'Piet', lastName: 'Jansen',
      birthComuneName: '', birthCountryName: '', citizenshipName: '', documentIssuePlaceName: '', dataSource: 'NotRecorded' }],
    issues: [
      { position: 0, code: 'guest_field_missing', field: 'documentNumber', blocking: true },
      { position: null, code: 'guests_count_mismatch', field: 'guestCount', blocking: false },
    ],
    sender: { alloggiatiSender: 'Manual', source: 'Stored', applies: true },
    octorate: { mirrored: false, guests: [], states: [] },
    alloggiati: { status: 'DaInviareManualmente', dataComplete: false, deadlineAt: addDays(checkIn, 1) + 'T09:00:00Z', isOverdue: false },
    capabilities: { documentReading: false, canRegisterArrival: false, canMarkNoShow: false, octorateTaxValues: false },
    suggestedStep: 'checks',
  };
  await page.route(`**/api/bookings/${bookingId}/checkin-wizard`, route => route.fulfill({ json: state }));
  const booking = '/app/short-rent/bookings/' + bookingId;
  await page.goto(demoUrl(booking, 'short-stay'), { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { level: 1, name: guestName })).toBeVisible();
  const details = page.getByTestId('booking-stay-reference');
  await expect(details).not.toHaveAttribute('open', '');
  await details.locator('summary').press('Enter');
  await expect(details).toHaveAttribute('open', '');
  await page.getByTestId('booking-review-checkin').click();
  await page.getByTestId('booking-open-checkin-wizard').click();
  await expect(page.getByTestId('checkin-wizard-issues-blocking')).toBeVisible();
  await expect(page.getByTestId('checkin-wizard-issues-warning')).toBeVisible();
  await page.getByTestId('checkin-wizard-issues-blocking').getByTestId('checkin-wizard-issue-fix').click();
  await expect(page.locator('#guest-0-documentNumber')).toBeFocused();
  await page.getByTestId('checkin-wizard-save-exit').click();
  await expect(page).toHaveURL(new RegExp(booking + '\\?tab=guest'));
  await expect(page.getByTestId('checkin-session-badge')).toBeVisible();
});

for (const [width, height] of [[320, 568], [768, 1024], [1440, 900]]) {
  test(`canone insoluto · dal riepilogo alla rata corretta a ${width} px`, async ({ page }) => {
    await mockActiveLease(page);
    await page.setViewportSize({ width, height });
    await page.goto(demoUrl(`/app/long-rent/leases/${FLOW_LEASE_ID}?tab=pagamenti`, 'long-term'), { waitUntil: 'domcontentloaded' });
    const summary = page.getByTestId('rent-focus');
    await expect(summary).toContainText('900');
    const action = summary.getByTestId('rent-focus-link');
    await action.focus();
    await page.keyboard.press('Enter');
    const target = page.getByTestId('rent-installment').filter({ has: page.getByTestId('rent-installment-overdue') });
    await expect(target).toBeFocused();
    await expectNothingSticksOut(page, 'Contratto e canoni');
    if (width === 320) await expectNoAxeViolations(page, { include: '[data-testid="rent-focus"]' });
  });
}

test('primo accesso anonimo · riprovare il login e aprire un invito senza esporre il token all’IdP', async ({ page }) => {
  test.setTimeout(180_000);
  const { createServer } = await import('vite');
  const server = await createServer({
    logLevel: 'error',
    cacheDir: 'node_modules/.vite-guided-entry-e2e',
    server: { host: '127.0.0.1', port: 0, strictPort: false, hmr: false },
    define: {
      'import.meta.env.VITE_DEMO_MODE': '"false"',
      'import.meta.env.VITE_AUTH0_DOMAIN': '"idp.example.test"',
      'import.meta.env.VITE_AUTH0_CLIENT_ID': '"casazen-first-access-test"',
      'import.meta.env.VITE_AUTH0_AUDIENCE': '"https://api.example.test"',
      'import.meta.env.VITE_API_BASE_URL': '"/api"',
    },
  });
  try {
    await server.listen();
    const address = server.httpServer?.address();
    if (!address || typeof address === 'string') throw new Error('Expected a loopback TCP server');
    const origin = `http://127.0.0.1:${address.port}`;
    await page.clock.setFixedTime(new Date());
    await page.setViewportSize({ width: 390, height: 844 });
    await page.route('https://idp.example.test/**', route => route.fulfill({
      contentType: 'text/html',
      body: '<!doctype html><html lang="it"><title>Accesso di prova</title><main>Provider di identità di prova</main></html>',
    }));
    // A fresh tab enters the provider automatically. Returning from it must leave an operable retry.
    await page.goto(origin + '/login?returnTo=%2Fapp%2Fshort-rent', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/^https:\/\/idp\.example\.test\/authorize\?/, { timeout: 30_000 });
    await page.goto(origin + '/login?returnTo=%2Fapp%2Fshort-rent', { waitUntil: 'domcontentloaded' });
    const retry = page.getByRole('button', { name: /Accedi|accesso|Riprova/i }).first();
    await expect(retry).toBeVisible();
    await retry.focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/^https:\/\/idp\.example\.test\/authorize\?/);

    let lookups = 0;
    await page.route('**/api/org-invitations/lookup', async route => {
      expect(route.request().postDataJSON()).toEqual({ token: inviteToken });
      lookups += 1;
      if (lookups === 1) {
        await route.fulfill({ status: 503, json: { title: 'Servizio temporaneamente indisponibile' } });
        return;
      }
      await route.fulfill({ json: invite });
    });
    await page.goto(origin + '/invite/accept?token=' + inviteToken, { waitUntil: 'domcontentloaded' });
    await page.getByTestId('invite-accept-retry').click();
    await expect(page.getByTestId('invite-accept-details')).toContainText(/Collaboratore/);
    await expect(page).toHaveURL(origin + '/invite/accept');
    await expectNothingSticksOut(page, 'Invito senza sessione');
    await page.getByTestId('invite-accept-signup').click();
    await expect(page).toHaveURL(/^https:\/\/idp\.example\.test\/authorize\?/);
    expect(new URL(page.url()).searchParams.get('screen_hint')).toBe('signup');
    expect(page.url()).not.toContain(inviteToken);
    expect(lookups).toBe(2);

    const ticket = { organization: 'org_demo123', invitation: 'inv_ticket_demo', flow: 'team', token: inviteToken };
    await page.goto(origin + '/attiva-invito#' + new URLSearchParams(ticket), { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/^https:\/\/idp\.example\.test\/authorize\?/);
    const authorize = new URL(page.url());
    expect(authorize.searchParams.get('organization')).toBe(ticket.organization);
    expect(authorize.searchParams.get('invitation')).toBe(ticket.invitation);
    expect(authorize.href).not.toContain(inviteToken);

    await page.goto(origin + '/attiva-invito#token=incompleto', { waitUntil: 'domcontentloaded' });
    const recovery = page.getByRole('main').getByRole('link', { name: /CasaZen|home/i });
    await expect(recovery).toHaveAttribute('href', '/');
    await expect(page).toHaveURL(origin + '/attiva-invito');
    await recovery.press('Enter');
    await expect(page).toHaveURL(origin + '/login?returnTo=%2F');
    await expect(page.getByRole('button', { name: 'Continua con l’accesso' })).toBeVisible();
  } finally {
    await server.close();
  }
});
