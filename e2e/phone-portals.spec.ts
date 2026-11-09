import type { Page } from '@playwright/test';
import { expect, test } from './test';
import { demoUrl } from './helpers/demo-profile';
import { pinE2eLocale } from './helpers/locale';

/**
 * Tenant portal and landlord payments on a phone (390×844) and at a desktop width.
 * The API is the demo stack: page.route stands in for the backend. Stripe.js is stubbed
 * only when a test needs a sandbox session. Without that session the click stops before any charge.
 */

const LEASE = 'lease-phone-1';
const DUE = 'due-open';
const PAID = 'due-paid';
const VIEWPORTS = [
  { name: 'phone', width: 390, height: 844 },
  { name: 'desktop', width: 1280, height: 800 },
] as const;

const openDue = {
  id: DUE,
  periodStart: '2026-11-01',
  periodEnd: '2026-11-30',
  dueDate: '2026-11-05',
  currency: 'EUR',
  amount: 970,
  amountPaid: 0,
  residual: 970,
  status: 'Scheduled',
  isOverdue: true,
  components: [
    { kind: 'Rent', amount: 900 },
    { kind: 'CondominiumAdvance', amount: 150 },
    { kind: 'CondominiumSettlement', amount: -80 },
    { kind: 'Extraordinary', amount: 400, accepted: false, description: 'Facciata non confermata' },
  ],
  bank: {
    accountHolder: 'Maria Bianchi',
    iban: 'IT60X0542811101000000123456',
    amount: 970,
    dueDate: '2026-11-05',
    reference: 'CZ-2026-11-ABC',
  },
  declaration: null,
};

const paidDue = {
  ...openDue,
  id: PAID,
  dueDate: '2026-10-05',
  periodStart: '2026-10-01',
  periodEnd: '2026-10-31',
  status: 'Paid',
  isOverdue: false,
  amount: 900,
  amountPaid: 900,
  residual: 0,
  components: [{ kind: 'Rent', amount: 900 }],
  bank: null,
  declaration: null,
};

const acceptedExtraordinary = {
  ...openDue,
  id: 'due-extra',
  amount: 1040,
  residual: 1040,
  components: [
    { kind: 'Rent', amount: 900 },
    { kind: 'Extraordinary', amount: 140, accepted: true, description: 'Facciata accettata' },
  ],
};

function area(dues: unknown[], documents: unknown[] = []) {
  return {
    contract: {
      id: LEASE,
      label: 'Contratto Via Roma',
      status: 'Active',
      startDate: '2026-01-01',
      endDate: '2027-12-31',
      role: 'TenantPrimary',
    },
    property: { id: 'prop-1', name: 'Via Roma 12', address: 'Via Roma 12, Roma' },
    dues,
    documents,
    emergency: null,
    maintenanceCategories: ['plumbing'],
  };
}

const documents = [
  { id: 'doc-budget', name: 'Preventivo 2026', kind: 'Budget', sharedAt: '2026-01-15' },
  { id: 'doc-settlement', name: 'Conguaglio 2025', kind: 'Settlement', sharedAt: '2026-02-01' },
  { id: 'doc-extra', name: 'Spesa facciata', kind: 'Extraordinary', accepted: false, sharedAt: '2026-03-01' },
  { id: 'doc-extra-ok', name: 'Ascensore accettato', kind: 'Extraordinary', accepted: true, sharedAt: '2026-03-02' },
];

async function fits(page: Page, testId: string) {
  const box = await page.getByTestId(testId).boundingBox();
  expect(box, testId).not.toBeNull();
  const viewport = page.viewportSize();
  expect(viewport).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(viewport!.width + 1);
  const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(scroll).toBeLessThanOrEqual(1);
}

async function mockTenant(
  page: Page,
  dues: unknown[],
  docs = documents,
  bank?: (route: import('@playwright/test').Route) => Promise<void>,
) {
  await page.route((url) => url.pathname.startsWith('/api/tenant-area/contracts/'), async (route) => {
    const url = route.request().url();
    if (url.includes('/bank-link')) {
      if (bank) {
        await bank(route);
        return;
      }
      await route.fallback();
      return;
    }
    if (route.request().method() === 'POST' && url.includes('/declarations')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'decl-1',
          status: 'Submitted',
          amount: 970,
          transferDate: '2026-11-04',
          submittedAt: '2026-11-04T10:00:00Z',
          bankReference: null,
        }),
      });
      return;
    }
    if (url.includes('/maintenance')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ items: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(area(dues, docs)) });
  });
  await page.route((url) => url.pathname === '/api/tenant-area', async (route) => {
    if (route.request().url().includes('/contracts/')) {
      await route.fallback();
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        contracts: [{ id: LEASE, label: 'Contratto Via Roma', propertyName: 'Via Roma 12', role: 'TenantPrimary', status: 'Active' }],
      }),
    });
  });
}

function stripeStub() {
  return `window.Stripe = function () {
    return {
      collectFinancialConnectionsAccounts: async function () {
        return { financialConnectionsSession: { accounts: [{ id: 'fca_demo' }] } };
      },
      _registerWrapper: function () {},
    };
  };`;
}

test.describe('Phone portals: tenant and landlord', () => {
  test.beforeEach(async ({ page }) => {
    await pinE2eLocale(page, 'it');
  });

  for (const viewport of VIEWPORTS) {
    test(`tenant pays, reports and documents on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockTenant(page, [openDue, paidDue]);

      await page.goto('/portale-conduttore');
      await page.getByRole('link', { name: 'Apri il contratto' }).click();
      await expect(page.getByTestId('tenant-contract')).toBeVisible();
      await expect(page.getByTestId('tenant-bank')).toHaveCount(0);
      const pay = page.getByRole('link', { name: 'Paga la scadenza' });
      await expect(pay).toBeVisible();
      await fits(page, 'tenant-contract-next');
      await pay.click();

      await expect(page.getByRole('heading', { name: 'Pagamenti', exact: true })).toBeVisible();
      await expect(page.getByTestId('tenant-report-open')).toContainText('970,00');
      await expect(page.getByTestId('tenant-report-paid')).toContainText('900,00');
      await expect(page.getByTestId('tenant-advance-note')).toContainText('acconto condominiale');
      await expect(page.getByTestId('tenant-settlement-note')).toContainText('credito');
      await expect(page.getByText('Facciata non confermata')).toHaveCount(0);
      await expect(page.getByText('400,00')).toHaveCount(0);
      await expect(page.getByTestId('stripe-link-account')).toHaveText('Collega il conto');
      await fits(page, 'stripe-link-account');

      await page.getByTestId('tenant-declare-transfer').click();
      await expect(page.getByTestId('tenant-declaration-status')).toContainText('Inviata');
      await expect(page.getByText('La rata non è ancora segnata come pagata.')).toBeVisible();
      await expect(page.getByTestId('tenant-due-status')).toContainText('Da pagare');
      await expect(page.getByTestId('tenant-due-status')).not.toContainText('Pagata');

      await page.getByRole('link', { name: 'Documenti' }).click();
      await expect(page.getByTestId('tenant-document-Budget')).toContainText('Preventivo');
      await expect(page.getByTestId('tenant-document-Settlement')).toContainText('Conguaglio');
      await expect(page.getByText('Spesa facciata')).toHaveCount(0);
      await expect(page.getByTestId('tenant-document-Extraordinary')).toContainText('Ascensore accettato');
      await page.getByRole('link', { name: 'Manutenzione' }).click();
      await expect(page.getByText('Nessuna richiesta.')).toBeVisible();
      await fits(page, 'tenant-maintenance');
    });

    test(`tenant SEPA stops without a sandbox session on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const payments: string[] = [];
      await mockTenant(page, [openDue], documents, async (route) => {
        payments.push(`${route.request().method()} ${route.request().url()}`);
        if (route.request().url().endsWith('/session')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ sessionId: 'fcsess_1', clientSecret: 'secret', publishableKey: null }),
          });
          return;
        }
        await route.fulfill({ status: 500, contentType: 'application/json', body: '{}' });
      });

      await page.goto(`/portale-conduttore/contratti/${LEASE}/scadenze/${DUE}`);
      await page.getByTestId('stripe-link-account').click();
      await expect(page.getByTestId('stripe-transfer-error')).toContainText('Stripe non è disponibile');
      expect(payments.some((call) => call.includes('/payment'))).toBe(false);
      await expect(page.getByTestId('tenant-due-status')).toContainText('Da pagare');
    });

    test(`a failed SEPA debit retries with a new idempotency key on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      const keys: string[] = [];
      await page.route('https://js.stripe.com/**', async (route) => {
        await route.fulfill({ status: 200, contentType: 'application/javascript', body: stripeStub() });
      });
      await mockTenant(page, [{ ...openDue, status: 'Failed', isOverdue: true }], documents, async (route) => {
        const url = route.request().url();
        if (url.endsWith('/session')) {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ sessionId: 'fcsess_1', clientSecret: 'secret', publishableKey: 'pk_test_demo' }),
          });
          return;
        }
        if (url.endsWith('/payment')) {
          keys.push(route.request().headers()['idempotency-key'] ?? '');
          const failed = keys.length === 1;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              paymentId: failed ? 'pay-1' : 'pay-2',
              paymentIntentId: failed ? 'pi_1' : 'pi_2',
              clientSecret: null,
              stripeStatus: failed ? 'requires_payment_method' : 'processing',
              paymentMethodType: 'sepa_debit',
              dueSettled: false,
            }),
          });
          return;
        }
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ linked: true, accountId: 'fca_demo', displayName: 'Banca Demo', last4: '1234' }),
        });
      });

      await page.goto(`/portale-conduttore/contratti/${LEASE}/scadenze/${DUE}`);
      await expect(page.getByTestId('tenant-due-failed')).toContainText('non è andato a buon fine');
      await page.getByTestId('stripe-link-account').click();
      await page.getByTestId('stripe-start-transfer').click();
      await expect(page.getByTestId('stripe-transfer-error')).toBeVisible();
      await page.getByTestId('stripe-start-transfer').click();
      await expect(page.getByTestId('stripe-transfer-pending')).toContainText('non è segnata come pagata');
      expect(keys).toHaveLength(2);
      expect(keys[0]).not.toBe('');
      expect(keys[1]).not.toBe(keys[0]);
      await expect(page.getByTestId('tenant-due-status')).not.toContainText('Pagata');
    });
  }

  test('empty dues and a load error stay in Italian', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    let ready = false;
    await page.route((url) => url.pathname.startsWith('/api/tenant-area/contracts/'), async (route) => {
      if (!ready) {
        await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ title: 'Errore' }) });
        return;
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(area([])) });
    });
    await page.goto(`/portale-conduttore/contratti/${LEASE}/scadenze`);
    await expect(page.getByTestId('tenant-error')).toContainText('Non riesco a caricare');
    ready = true;
    await page.getByRole('button', { name: 'Riprova' }).click();
    await expect(page.getByTestId('tenant-dues-empty')).toContainText('Nessuna scadenza');
  });

  test('an accepted extraordinary line is visible', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockTenant(page, [acceptedExtraordinary], []);
    await page.goto(`/portale-conduttore/contratti/${LEASE}/scadenze/due-extra`);
    await expect(page.getByTestId('rent-composition-other')).toContainText('140,00');
    await expect(page.getByTestId('tenant-due-amount')).toContainText('1040,00');
  });

  for (const viewport of VIEWPORTS) {
    test(`landlord opens the contract, Pagamenti, Canoni and the reminder on ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await mockLandlord(page);

      await page.goto(demoUrl(`/app/long-rent/leases/${LEASE}`, 'long-term'));
      await expect(page.getByTestId('lease-sheet')).toBeVisible();
      await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);

      if (viewport.name === 'phone') await page.getByTestId('lease-sheet-tabs').selectOption({ label: 'Canoni' });
      else await page.getByTestId('lease-tab-pagamenti').click();

      await expect(page.getByTestId('rent-not-on-contract')).toContainText('conto SEPA');
      await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);
      const markPaid = page.getByRole('button', { name: 'Segna come pagata' }).first();
      await markPaid.scrollIntoViewIfNeeded();
      await expect(markPaid).toBeVisible();
      const box = await markPaid.boundingBox();
      expect(box).not.toBeNull();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(viewport.width + 1);
      const scroll = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      expect(scroll).toBeLessThanOrEqual(1);

      await page.getByRole('link', { name: 'Apri il conto SEPA' }).click();
      await expect(page.getByTestId('long-rent-payments')).toBeVisible();
      await expect(page.getByTestId('condominium-bank-link')).toContainText('euro');
      await expect(page.getByTestId('stripe-link-account')).toBeVisible();
      const linkBox = await page.getByTestId('stripe-link-account').boundingBox();
      expect(linkBox).not.toBeNull();
      expect(linkBox!.x + linkBox!.width).toBeLessThanOrEqual(viewport.width + 1);

      await page.getByTestId('long-rent-payments-contracts').click();
      await expect(page).toHaveURL(/\/app\/long-rent\/leases/);

      // Canoni are no longer linked from Conto SEPA. The reminder still lives on the rent register.
      await page.goto(demoUrl('/app/long-rent/rents', 'long-term'));
      await expect(page.getByTestId('rents-page')).toBeVisible();
      await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);
      if (viewport.name === 'phone') await page.getByTestId('rent-remind-card-inst-1').click();
      else {
        await page.getByRole('button', { name: 'Altre azioni: Giulia Verdi · Via Roma 12' }).click();
        await page.getByRole('menuitem', { name: 'Invia sollecito' }).click();
      }
      await expect(page.getByTestId('rent-reminder-dialog')).toBeVisible();
      await page.getByTestId('rent-reminder-send').click();
      await expect(page.getByText(/Sollecito per Giulia Verdi/)).toBeVisible();
    });
  }
});

async function mockLandlord(page: Page) {
  const lease = {
    id: LEASE,
    propertyId: 'prop-1',
    property: { id: 'prop-1', name: 'Via Roma 12', city: 'Roma' },
    status: 'Active',
    fiscalRegime: 'CedolareSecca',
    contractType: 'Libero',
    taxRegime: 'CedolareSecca',
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    monthlyRent: 900,
    securityDeposit: 1800,
    concordatoAssessment: null,
    stipulaDate: '2026-01-01',
    registrationDeadline: null,
    hasSignedPdf: true,
    hasExtraEUTenant: false,
    parties: [
      {
        id: 'party-1',
        role: 'Tenant',
        firstName: 'Giulia',
        lastName: 'Verdi',
        fiscalCodeMasked: 'VRD***********1A',
        contactEmailMasked: 'g***@example.com',
        isExtraEU: false,
      },
    ],
    events: [],
    version: 1,
  };
  const installment = {
    id: 'inst-1',
    periodStart: '2026-11-01',
    periodEnd: '2026-11-30',
    dueDate: '2026-11-05',
    amount: 970,
    currency: 'EUR',
    status: 'Scheduled',
    isOverdue: true,
    paidVia: null,
    paidOn: null,
    offlinePaymentNote: null,
    paymentRequestedAt: null,
    failureCode: null,
    lastFailedAt: null,
    components: [
      { kind: 'Rent', amount: 900 },
      { kind: 'CondominiumAdvance', amount: 70 },
    ],
  };
  await page.route((url) => url.pathname === '/api/leases' || url.pathname.startsWith('/api/leases/'), async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace(/\/api/, '');
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    if (path === '/leases') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([{ id: LEASE, status: 'Active', propertyName: 'Via Roma 12', stage: 'Active' }]),
      });
      return;
    }
    if (path === `/leases/${LEASE}`) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(lease) });
      return;
    }
    if (path === `/leases/${LEASE}/rent`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          leaseId: LEASE,
          monthlyRent: 900,
          canConfigure: true,
          onlinePaymentsAvailable: false,
          hasTenantEmail: true,
          schedule: { cadence: 'Monthly', billingDayOfMonth: 5, amount: 900, currency: 'EUR', isActive: true },
          installments: [installment],
          partialFinalPeriod: null,
          manualNotices: [
            { id: 'notice-1', kind: 'Budget', title: 'Preventivo 2026', summary: 'Proposta di acconto' },
            { id: 'notice-2', kind: 'Settlement', title: 'Conguaglio 2025', summary: 'Proposta di conguaglio' },
          ],
        }),
      });
      return;
    }
    await route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ status: 404, title: 'Non trovato' }) });
  });
  await page.route((url) => url.pathname === '/api/long-rent/rules', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        termMonths: { Libero: 48, Concordato: 36 },
        renewalMonths: { Libero: 48, Concordato: 24 },
        noticeMonths: 6,
        registrationDays: 30,
        depositMaxRents: 3,
        availableTypes: ['Libero', 'Concordato', 'Transitorio'],
        importedTypes: ['Libero', 'Concordato', 'Transitorio'],
        transitoryTermMonths: { min: 1, max: 18 },
        transitoryDocumentationAfterDays: 30,
        transitoryBandFromInhabitants: 10000,
      }),
    });
  });
  await page.route((url) => url.pathname.startsWith('/api/orgs/me/bank-links'), async (route) => {
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ linked: false }) });
      return;
    }
    await route.fallback();
  });
  await page.route((url) => url.pathname.startsWith('/api/long-rent/rents'), async (route) => {
    const url = route.request().url();
    if (url.includes('/reminder')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ installmentId: 'inst-1', recipientCount: 1, reminderCount: 1 }),
      });
      return;
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        month: '2026-11',
        counters: {
          expected: { count: 1, amount: 970 },
          collected: { count: 0, amount: 0 },
          pending: { count: 0, amount: 0 },
          overdue: { count: 1, amount: 970 },
        },
        items: [
          {
            id: 'inst-1',
            leaseId: LEASE,
            propertyId: 'prop-1',
            propertyName: 'Via Roma 12',
            tenantFirstName: 'Giulia',
            tenantLastName: 'Verdi',
            tenantAnonymized: false,
            periodStart: '2026-11-01',
            periodEnd: '2026-11-30',
            dueDate: '2026-11-05',
            amount: 970,
            currency: 'EUR',
            status: 'Scheduled',
            isOverdue: true,
            daysOverdue: 3,
            paidVia: null,
            paidOn: null,
            paymentRequestedAt: null,
            lastReminderAt: null,
            reminderCount: 0,
            canRemind: true,
            components: installment.components,
          },
        ],
        total: 1,
        page: 1,
        pageSize: 25,
        onlinePaymentsAvailable: false,
        reminderIntervalHours: 24,
      }),
    });
  });
}
