import { test, expect } from './test';
import { demoUrl, setDemoProfile } from './helpers/demo-profile';

const regimeMock = {
  taxYear: 2026,
  strPropertyCount: 1,
  requiresPartitaIva: false,
  hasPartitaIva: false,
  disclaimer:
    'Raccomandazione informativa, non consulenza fiscale. CasaZen non presenta dichiarazioni e non sostituisce un commercialista. Riferimenti: L. 199/2025, D.L. 50/2017.',
  properties: [
    {
      propertyId: '11111111-1111-1111-1111-111111111111',
      name: 'Casa Test',
      recommendedRegime: 'CedolareSecca21',
      assignedRegime: 'CedolareSecca21',
      isPrimaryForCedolare: true,
      shortStayInTaxYear: true,
      taxpayerIndex: 0,
      cedolareRate: 0.21,
      taxNote: null,
      availableRegimes: ['CedolareSecca21', 'CedolareSecca26', 'IrpefOrdinaria'],
    },
  ],
  maxShortStayApartmentsPerTaxpayer: 2,
  thresholdSource: 'art. 1 c. 595 L. 178/2020',
  taxpayers: [
    {
      index: 0,
      fiscalCodeMasked: null,
      isOrgTaxProfile: true,
      shortStayApartmentCount: 1,
      thresholdExceeded: false,
      reducedRatePropertyId: '11111111-1111-1111-1111-111111111111',
    },
  ],
};

const rules = {
  cedolareRate: 0.26,
  cedolareReducedRate: 0.21,
  cedolareSource: 'art. 1 c. 63 L. 213/2023',
  otaWithholdingRate: 0.21,
  otaWithholdingSource: 'art. 4 c. 5 D.L. 50/2017',
  maxApartmentsPerTaxpayer: 2,
  thresholdSource: 'art. 1 c. 595 L. 178/2020',
};
const period = { from: '2026-01-01', to: '2026-12-31' };
const packLabel = 'Pacchetto dati per il commercialista — non è una dichiarazione, F24 o Certificazione Unica ufficiale';
const reportMocks: Record<string, unknown> = {
  annual: {
    taxYear: 2026,
    packLabel,
    disclaimer: regimeMock.disclaimer,
    properties: [],
    totals: {
      grossIncome: 0,
      withholding: 0,
      net: 0,
      touristTax: 0,
      rentalIncome: 0,
      taxableIncome: 0,
      estimatedTax: 0,
      linesWithoutEstimate: 0,
    },
    period,
    orgName: 'Demo',
    generatedOn: '2026-09-25',
    taxpayers: [],
    rules,
  },
  withholding: {
    taxYear: 2026,
    packLabel,
    byOta: [{ source: 'Airbnb', gross: 100, withholding: 21, net: 79, payoutCount: 1 }],
    lines: [],
    period,
    disclaimer: regimeMock.disclaimer,
    orgName: 'Demo',
    generatedOn: '2026-09-25',
    totals: { gross: 100, withholding: 21, net: 79, payoutCount: 1 },
    rules,
  },
  'tourist-tax': {
    period,
    disclaimer: 'Riepilogo per il versamento',
    orgName: 'Demo',
    generatedOn: '2026-09-25',
    rows: [],
    byComune: [],
    stays: [],
    totals: { stays: 0, nights: 0, guests: 0, amount: 0, staysWithoutAmount: 0 },
  },
};

test.describe('Fiscal regime 2026 (#3)', () => {
  test.describe.configure({ timeout: 60_000 });

  test.beforeEach(async ({ page }) => {
    await setDemoProfile(page, 'short-stay');
    await page.route('**/api/fiscal/regime**', async (route) => {
      if (route.request().method() !== 'GET') {
        await route.fallback();
        return;
      }
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(regimeMock),
      });
    });
    await page.route('**/api/fiscal/reports/**', async (route) => {
      const kind = new URL(route.request().url()).pathname.split('/')[4] ?? '';
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(reportMocks[kind] ?? {}),
      });
    });
    await page.route('**/api/fiscal/tax-profile**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          hasPartitaIva: false,
          partitaIvaNumber: null,
          fiscalCode: null,
          fiscalDataRetentionUntil: null,
        }),
      });
    });
  });

  test('AC1: dashboard recommends cedolare 21% and shows disclaimer', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/fiscal', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('fiscal-dashboard-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('fiscal-disclaimer')).toContainText(/informativa|commercialista/i);
    await expect(page.getByTestId('fiscal-str-count')).toBeVisible();
    await expect(page.getByTestId('fiscal-property-card-11111111-1111-1111-1111-111111111111')).toContainText(
      'Cedolare secca 21%',
    );
    await expect(page.getByTestId('fiscal-regime-select-11111111-1111-1111-1111-111111111111')).toBeVisible();
  });

  test('AC4: three-property mock shows P.IVA alert', async ({ page }) => {
    await page.route('**/api/fiscal/regime**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ...regimeMock, strPropertyCount: 3, requiresPartitaIva: true }),
      });
    });
    await page.goto(demoUrl('/app/short-rent/fiscal', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('fiscal-piva-alert')).toBeVisible({ timeout: 20_000 });
  });

  test('AC8-AC10 AC13: reports page shows pack label and export buttons', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/fiscal/reports', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('fiscal-reports-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('fiscal-pack-label')).toContainText(/commercialista/i);
    await expect(page.getByTestId('fiscal-export-csv')).toBeVisible();
    await expect(page.getByTestId('fiscal-export-pdf')).toBeVisible();
    await expect(page.getByTestId('fiscal-withholding-by-ota')).toContainText('Airbnb');
    await expect(page.getByTestId('fiscal-tourist-tax-export-pdf')).toBeVisible();
    await expect(page.getByTestId('fiscal-disclaimer')).toContainText(/L\. 199\/2025|D\.L\. 50\/2017/i);
  });

  test('AC5: wizard is prefilled and exposes P.IVA fields', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/fiscal/wizard', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('fiscal-wizard-page')).toBeVisible({ timeout: 20_000 });
    // Prefilled from the saved profile (no partita IVA): the number appears once the box is ticked.
    await expect(page.getByTestId('fiscal-has-piva')).not.toBeChecked();
    await page.getByTestId('fiscal-has-piva').check();
    await expect(page.getByTestId('fiscal-piva-input')).toBeVisible();
  });
});
