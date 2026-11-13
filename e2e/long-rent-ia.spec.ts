import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { resetE2eStorage } from './helpers/locale';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { buildCreatedProperty } from './fixtures/properties.fixtures';

/**
 * Affitti lunghi: Contratti, Spese condominiali and Manutenzione on the property;
 * Canoni only inside a contract; manual condominium payments in settings; Pagamenti in the tenant portal.
 */
const PROPERTY_ID = 'prop-lr-ia';
const LEASE_ID = 'lease-ia-1';

const lease = {
  id: LEASE_ID,
  propertyId: PROPERTY_ID,
  status: 'Registered',
  contractType: 'Libero',
  fiscalRegime: 'CedolareSecca',
  startDate: '2026-01-01',
  endDate: '2029-12-31',
  monthlyRent: 900,
  currency: 'EUR',
  tenantFirstName: 'Giulia',
  tenantLastName: 'Verdi',
  tenantAnonymized: false,
  hasExtraEUTenant: false,
  parties: [{ role: 'Tenant', firstName: 'Giulia', lastName: 'Verdi', isExtraEU: false }],
  property: { id: PROPERTY_ID, name: 'Bilocale Monza' },
  events: [],
};

test.describe('Long-rent information architecture', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test('property sections, canoni on the contract, and manual condominium payments in settings', async ({ page }) => {
    test.setTimeout(90_000);
    await mockPropertiesApi(page, [
      buildCreatedProperty({
        id: PROPERTY_ID,
        name: 'Bilocale Monza',
        city: 'Monza',
        address: 'Via Italia 1',
        postalCode: '20900',
        description: '',
      }),
    ]);
    await page.route('**/api/long-rent/condominiums/properties', route => route.fulfill({
      status: 200, contentType: 'application/json', body: JSON.stringify([{ propertyId: PROPERTY_ID, propertyName: 'Bilocale Monza', books: [] }]),
    }));
    await page.route(`**/api/properties/${PROPERTY_ID}/documents`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route(/\/api\/leases(\?.*)?$/, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([lease]) });
    });
    await page.route(`**/api/leases/${LEASE_ID}`, async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lease) });
    });
    await page.route('**/api/long-rent/rules', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        termMonths: { Libero: 48, Concordato: 36, Transitorio: 18 }, renewalMonths: { Libero: 48, Concordato: 24 },
        noticeMonths: 6, registrationDays: 30, depositMaxRents: 3,
        availableTypes: ['Libero', 'Transitorio'], importedTypes: ['Libero', 'Concordato', 'Transitorio'],
        transitoryTermMonths: { min: 1, max: 18 }, transitoryDocumentationAfterDays: 30, transitoryBandFromInhabitants: 10000,
      }) });
    });
    await page.route(`**/api/leases/${LEASE_ID}/rli/checklist`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        registrationDeadline: null, daysRemaining: null, tosVersion: 'test', attestationText: '', providerFilingAvailable: false,
        items: [{ key: 'rli_registered', done: true }],
      }) });
    });
    await page.route('**/api/long-rent/deadlines**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
        from: '2026-01-01', to: '2029-12-31', items: [], truncated: false,
      }) });
    });
    await page.route(`**/api/leases/${LEASE_ID}/rent`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leaseId: LEASE_ID,
          monthlyRent: 900,
          canConfigure: true,
          onlinePaymentsAvailable: false,
          hasTenantEmail: true,
          schedule: { cadence: 'Monthly', billingDayOfMonth: 5, amount: 900, currency: 'EUR', isActive: true },
          installments: [
            {
              id: 'inst-1',
              periodStart: '2026-11-01',
              periodEnd: '2026-11-30',
              dueDate: '2026-11-05',
              amount: 980,
              currency: 'EUR',
              status: 'Scheduled',
              isOverdue: false,
              paidVia: null,
              paidOn: null,
              offlinePaymentNote: null,
              paymentRequestedAt: null,
              failureCode: null,
              lastFailedAt: null,
              components: [
                { kind: 'Rent', amount: 900 },
                { kind: 'CondominiumAdvance', amount: 80 },
              ],
            },
          ],
          partialFinalPeriod: null,
          manualNotices: [],
        }),
      });
    });
    await page.route(`**/api/leases/${LEASE_ID}/maintenance-requests`, async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });
    await page.route('**/api/long-rent/condominiums/manual-payments**', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
        return;
      }
      await route.fallback();
    });
    await page.route('**/api/long-rent/properties**', async (route) => {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([]) });
    });

    await page.goto(demoUrl(`/app/long-rent/properties/${PROPERTY_ID}`, 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByRole('heading', { level: 1, name: 'Bilocale Monza' })).toBeVisible();

    const sidebar = page.getByRole('complementary');
    await expect(sidebar.getByRole('link', { name: /^(Contratti|Inquilini|Scadenze|Interventi)$/ })).toHaveCount(0);
    await sidebar.getByRole('button', { name: 'Altro', exact: true }).click();
    await expect(sidebar.getByRole('link', { name: /^(Contratti|Inquilini|Scadenze|Interventi)$/ })).toHaveCount(0);
    await expect(sidebar.getByRole('link', { name: 'Report fiscale', exact: true })).toBeVisible();
    await expect(page.getByTestId('long-rent-property-create-contract')).toHaveAttribute('href', `/app/long-rent/leases/new?propertyId=${PROPERTY_ID}`);
    await page.getByTestId('long-rent-property-create-contract').click();
    await expect(page.getByTestId('lease-kind-choice')).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`propertyId=${PROPERTY_ID}`));
    await page.locator('label', { has: page.getByTestId('lease-kind-libero') }).click();
    await page.getByTestId('lease-kind-continue').click();
    await page.locator('label', { has: page.getByTestId('lease-way-casazen') }).click();
    await page.getByTestId('lease-way-continue').click();
    await expect(page.getByTestId('lease-property-select')).toHaveValue(PROPERTY_ID);
    await page.getByRole('link', { name: 'Torna a Immobili', exact: true }).click();
    await expect(page).toHaveURL(new RegExp(`/properties/${PROPERTY_ID}\\?tab=contracts`));
    await page.getByTestId('long-rent-property-tab-requests').click();
    await expect(page.getByTestId('long-rent-service-requests')).toBeVisible();
    await page.getByTestId('long-rent-property-tab-contracts').click();

    const tabs = page.getByRole('tab');
    await expect(tabs.nth(0)).toHaveText('Contratti');
    await expect(tabs.nth(1)).toHaveText('Spese condominiali');
    await expect(tabs.nth(2)).toHaveText('Manutenzione');
    await expect(page.getByRole('tab', { name: 'Canoni' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Canoni', exact: true })).toHaveCount(0);
    await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);

    await page.getByTestId('long-rent-property-tab-maintenance').click();
    await expect(page.getByTestId('long-rent-property-maintenance')).toBeVisible();
    await expect(page.getByTestId('maintenance-landlord')).toContainText('Nessuna richiesta');

    await page.getByTestId('long-rent-property-tab-expenses').click();
    await expect(page.getByTestId('condominium-management')).toBeVisible();
    await expect(page.getByRole('button', { name: /Carica i documenti/ })).toBeVisible();
    await page.getByRole('button', { name: /Imposta manualmente/ }).click();
    await expect(page.getByRole('button', { name: 'Attiva gestione condominiale' })).toBeVisible();
    await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Canoni', exact: true })).toHaveCount(0);

    await page.goto(demoUrl(`/app/long-rent/leases/${LEASE_ID}?tab=pagamenti`, 'long-term'), { waitUntil: 'domcontentloaded' });

    await page.getByTestId('lease-tab-inquilini').click();
    await expect(page.getByTestId('lease-tenants')).toContainText('Giulia Verdi');
    await page.getByTestId('lease-tab-scadenze').click();
    await expect(page.getByTestId('lease-dates')).toBeVisible();
    await page.getByTestId('lease-tab-pagamenti').click();
    await expect(page.getByTestId('lease-tab-pagamenti')).toHaveText('Canoni');
    await expect(page.getByTestId('rent-schedule-panel')).toBeVisible();
    await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);

    await page.getByRole('link', { name: 'Apri le spese condominiali' }).click();
    await expect(page).toHaveURL(/\/app\/long-rent\/payments$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Spese condominiali' })).toBeVisible();
    await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);
    await expect(page.getByTestId('long-rent-payments')).toContainText('home banking');

    await page.goto(demoUrl('/app/long-rent/fiscal', 'long-term'));
    await expect(page.getByRole('heading', { level: 1, name: 'Report fiscale' })).toBeVisible();
    await expect(page.getByRole('tab', { name: /^(Contratti|Inquilini|Scadenze)$/ })).toHaveCount(0);
    await expect(page.getByTestId('nav-section-tabs')).toHaveCount(0);

  });
});
