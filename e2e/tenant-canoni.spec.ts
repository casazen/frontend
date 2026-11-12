import { expect, test } from './test';

test.beforeEach(async ({ page }) => {
  await page.route('https://js.stripe.com/**', async route => route.fulfill({ status: 200, contentType: 'application/javascript', body: 'window.Stripe = function () { return { _registerWrapper: function () {} }; };' }));
});

const LEASE = 'lease-1';
const DUE = 'due-1';

const area = {
  contract: {
    id: LEASE,
    label: 'Contratto Via Roma',
    status: 'Active',
    startDate: '2026-01-01',
    endDate: '2027-12-31',
    role: 'TenantPrimary',
  },
  property: { id: 'prop-1', name: 'Via Roma 12', address: 'Via Roma 12, Roma' },
  dues: [
    {
      id: DUE,
      periodStart: '2026-11-01',
      periodEnd: '2026-11-30',
      dueDate: '2026-11-05',
      currency: 'EUR',
      amount: 970,
      residual: 970,
      status: 'Scheduled',
      isOverdue: true,
      components: [
        { kind: 'Rent', amount: 900 },
        { kind: 'CondominiumAdvance', amount: 150 },
        { kind: 'CondominiumSettlement', amount: -80 },
      ],
      bank: {
        accountHolder: 'Maria Bianchi',
        iban: 'IT60X0542811101000000123456',
        amount: 970,
        dueDate: '2026-11-05',
        reference: 'CZ-2026-11-ABC',
      },
      declaration: null,
    },
  ],
  documents: [],
  emergency: null,
  maintenanceCategories: [],
};

test('the tenant pays the due, with the advance and the settlement, from Canoni', async ({ page }) => {
  await page.route('**/api/tenant-area/contracts/**', async (route) => {
    if (route.request().method() === 'POST' && route.request().url().includes('/declarations')) {
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
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(area) });
  });
  await page.route('**/api/tenant-area', async (route) => {
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

  await page.goto('/portale-conduttore');
  await page.getByRole('link', { name: 'Apri il contratto' }).click();

  await expect(page.getByTestId('tenant-contract')).toBeVisible();
  await expect(page.getByTestId('tenant-bank')).toHaveCount(0);
  await expect(page.getByText('IT60X0542811101000000123456')).toHaveCount(0);
  await page.getByRole('link', { name: 'Paga la scadenza' }).click();

  await expect(page.getByRole('heading', { name: 'Pagamenti', exact: true })).toBeVisible();
  await expect(page.getByTestId('tenant-due-detail')).toBeVisible();
  await expect(page.getByTestId('tenant-advance-note')).toContainText('acconto condominiale');
  await expect(page.getByTestId('tenant-settlement-note')).toContainText('credito');
  await expect(page.getByTestId('tenant-due-overdue')).toContainText('In ritardo');
  await expect(page.getByTestId('tenant-sepa')).toContainText('IBAN');
  await expect(page.getByTestId('tenant-sepa-payment')).toContainText('971,00');
  await expect(page.getByRole('button', { name: 'Paga con SEPA' })).toBeVisible();
  await expect(page.getByTestId('tenant-manual')).toBeVisible();
  await expect(page.getByTestId('tenant-bank-reference')).toContainText('CZ-2026-11-ABC');

  await page.getByTestId('tenant-declare-transfer').click();
  await expect(page.getByTestId('tenant-declaration-status')).toContainText('Inviata');
  await expect(page.getByTestId('tenant-due-status')).toContainText('Da pagare');
  await expect(page.getByTestId('tenant-due-status')).not.toContainText('Pagata');

  await page.getByRole('link', { name: 'Documenti' }).click();
  await expect(page.getByTestId('tenant-documents-empty')).toContainText('conguaglio');
  await page.getByRole('link', { name: 'Vai ai pagamenti' }).click();
  await expect(page.getByRole('heading', { name: 'Pagamenti', exact: true })).toBeVisible();
});

test('a due with nothing left to pay does not open SEPA or the manual transfer', async ({ page }) => {
  const settled = {
    ...area,
    dues: [
      {
        ...area.dues[0],
        amount: 0,
        residual: 0,
        isOverdue: false,
        components: [
          { kind: 'Rent', amount: 100 },
          { kind: 'CondominiumSettlement', amount: -100 },
        ],
      },
    ],
  };
  await page.route('**/api/tenant-area/contracts/**', async (route) => {
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(settled) });
  });

  await page.goto(`/portale-conduttore/contratti/${LEASE}/scadenze/${DUE}`);
  await expect(page.getByTestId('tenant-due-settled')).toContainText('Sei in pari');
  await expect(page.getByTestId('tenant-sepa')).toHaveCount(0);
  await expect(page.getByTestId('tenant-declare-transfer')).toHaveCount(0);
});

test('the tenant area shows the load error and retries', async ({ page }) => {
  let ready = false;
  await page.route('**/api/tenant-area/contracts/**', async (route) => {
    if (!ready) {
      await route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ title: 'Errore' }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(area) });
  });

  await page.goto(`/portale-conduttore/contratti/${LEASE}/scadenze/${DUE}`);
  await expect(page.getByTestId('tenant-error')).toContainText('Non riesco a caricare', { timeout: 15_000 });
  ready = true;
  await page.getByRole('button', { name: 'Riprova' }).click();
  await expect(page.getByRole('heading', { name: 'Pagamenti', exact: true })).toBeVisible();
});
