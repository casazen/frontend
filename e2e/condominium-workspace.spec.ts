import { expect, test } from './test';
import { resetE2eStorage } from './helpers/locale';
import { demoUrl } from './helpers/demo-profile';

test.setTimeout(90_000);
const period = { id: 'y1', label: '2027', startDate: '2027-01-01', endDate: '2027-12-31', status: 'BudgetApproved' };
const book = { id: 'b1', name: 'Condominio Navigli', fiscalStartMonth: 1, periods: [period] };
const report = { condominiumName: 'Condominio Navigli', periodLabel: '2027', periodStart: '2027-01-01', periodEnd: '2027-12-31', ordinary: 1800, extraordinary: 300, prior: 0, finalAmount: null, paid: 150, stillToPay: 1950, settlement: null, installments: [{ id: 'r1', label: 'Rata 1', dueDate: '2027-01-31', ordinary: 150, extraordinary: 25, prior: 0, due: 175, paid: 150, remaining: 25 }], payments: [{ id: 'p1', paidOn: '2027-01-20', amount: 150, method: 'Bonifico', covers: 'Rata 1' }] };
test.beforeEach(async ({ page }) => {
  await resetE2eStorage(page, 'it');
  await page.route('**/api/long-rent/condominiums/manual-payments', r => r.fulfill({ json: [] }));
});

test('asks documents or manual setup first and activates a vacant apartment without uploads', async ({ page }) => {
  let active = false;
  let createdYear = false;
  await page.route('**/api/long-rent/condominiums/properties', r => r.fulfill({ json: [{ propertyId: 'a1', propertyName: 'Appartamento sfitto', books: active ? [{ ...book, periods: createdYear ? [period] : [] }] : [] }] }));
  await page.route('**/api/long-rent/condominiums/properties/a1', async r => { expect(r.request().postDataJSON()).toEqual({ name: 'Appartamento sfitto', fiscalStartMonth: 1 }); active = true; await r.fulfill({ json: book }); });
  await page.route('**/api/long-rent/condominiums/b1/periods', async r => { expect(r.request().postDataJSON()).toEqual({ label: '2027' }); createdYear = true; await r.fulfill({ json: period }); });
  await page.route('**/api/long-rent/condominiums/b1/periods/y1/report', r => r.fulfill({ json: report }));
  await page.goto(demoUrl('/app/long-rent/payments', 'long-term'), { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Appartamento', { exact: true }).selectOption('a1');
  await expect(page.getByRole('button', { name: /Carica i documenti/ })).toBeVisible();
  await expect(page.getByLabel('Nome del condominio')).toHaveCount(0);
  await page.getByRole('button', { name: /Imposta manualmente/ }).click();
  await expect(page.locator('input[type=file]')).toHaveCount(0);
  await page.getByRole('button', { name: 'Attiva gestione condominiale' }).click();
  await expect(page.getByRole('heading', { name: 'Preventivo e piano rate', exact: true })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Come vuoi iniziare?' })).toHaveCount(0);
  await page.getByLabel('Nuovo esercizio').fill('2027');
  await page.getByRole('button', { name: 'Crea esercizio' }).click();
  await expect(page.getByLabel('Quota ordinaria annuale (€)')).toBeVisible();
});

for (const width of [1440, 390]) test(`overview, payments and document review at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  await page.route('**/api/long-rent/condominiums/properties', r => r.fulfill({ json: [{ propertyId: 'a1', propertyName: 'Bilocale Navigli', books: [book] }] }));
  await page.route('**/api/long-rent/condominiums/b1/periods/y1/report', r => r.fulfill({ json: report }));
  let posted = false;
  await page.route('**/api/long-rent/condominiums/b1/installments/read', r => r.fulfill({ json: { installments: [{ dueDate: '2027-01-31', ordinary: 800, extraordinary: 0 }, { dueDate: '2027-06-30', ordinary: 1000, extraordinary: 0 }], excerpt: 'Ripartizione rate appartamento', notExtracted: [] } }));
  await page.route('**/api/long-rent/condominiums/b1/periods/y1/budget', async r => { expect(r.request().postDataJSON()).toMatchObject({ ordinaryAmount: 1800, cadence: 'Custom', customInstallments: [{ dueDate: '2027-01-31', ordinary: 800, extraordinary: 0 }, { dueDate: '2027-06-30', ordinary: 1000, extraordinary: 0 }] }); posted = true; await r.fulfill({ json: { installmentsLeftAsIssued: true } }); });
  await page.goto(demoUrl('/app/long-rent/payments', 'long-term'), { waitUntil: 'domcontentloaded' });
  await page.getByLabel('Appartamento', { exact: true }).selectOption('a1');
  await expect(page.getByRole('heading', { name: 'Ultimi pagamenti' })).toBeVisible();
  await page.getByRole('button', { name: 'Pagamenti', exact: true }).click();
  await page.getByRole('tab', { name: /Pagati/ }).click();
  await expect(page.getByRole('tabpanel')).toContainText('Bonifico');
  await page.getByRole('button', { name: 'Resoconti', exact: true }).click();
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Metti le rate in calendario' }).click();
  expect((await download).suggestedFilename()).toBe('rate-2027.ics');
  await page.getByRole('button', { name: 'Carica i documenti', exact: true }).click();
  await page.getByRole('button', { name: /Ripartizione rate/ }).click();
  await page.getByLabel('Documento PDF').setInputFiles({ name: 'rate.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await expect(page.getByLabel('Ordinario 1', { exact: true })).toHaveValue('800');
  expect(posted).toBe(false);
  await page.getByRole('button', { name: 'Conferma piano rate' }).click();
  await expect(page.getByRole('status')).toContainText('rate già emesse');
  expect(posted).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
