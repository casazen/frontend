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
    },
  ],
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
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          taxYear: 2026,
          packLabel:
            'Pacchetto dati per il commercialista — non è una dichiarazione, F24 o Certificazione Unica ufficiale',
          disclaimer: regimeMock.disclaimer,
          properties: [],
          totals: { grossIncome: 0, withholding: 0, net: 0 },
          byOta: [{ source: 'Airbnb', gross: 100, withholding: 21, net: 79, payoutCount: 1 }],
          lines: [],
        }),
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
      'CedolareSecca21',
    );
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
    await expect(page.getByTestId('fiscal-disclaimer')).toContainText(/L\. 199\/2025|D\.L\. 50\/2017/i);
  });

  test('AC5: wizard exposes P.IVA fields', async ({ page }) => {
    await page.goto(demoUrl('/app/short-rent/fiscal/wizard', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('fiscal-wizard-page')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('fiscal-piva-input')).toBeVisible();
  });
});
