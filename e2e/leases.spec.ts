import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { FLOW_LEASE_ID, FLOW_PROPERTY, mockLeaseFlowApi } from './helpers/lease-flow-mock';
import { resetE2eStorage } from './helpers/locale';

/**
 * LT-15 (A7-29): the lease flow of the long-term landlord in the browser, against a stateful API mock that answers as the
 * real one does with the providers off (manual signature, manual RLI): the spec asserts the requests the UI sent and the
 * state it shows after the API answered, never that an element is merely visible.
 */
const PDF = Buffer.from('%PDF-1.4\n% e2e\n%%EOF\n', 'ascii');

test.describe('Lease flow (long-term landlord)', () => {
  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test('a fiscal code with a wrong check character is refused in the form and nothing is sent', async ({ page }) => {
    const calls = await mockLeaseFlowApi(page);
    await page.goto(demoUrl('/leases/new', 'long-term'), { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Immobile/).selectOption(FLOW_PROPERTY.id);

    await fillParty(page, 'landlords', 0, { first: 'Mario', last: 'Rossi', cf: 'RSSMRA80A01H501Z', email: 'mario@example.com' });
    await fillParty(page, 'tenants', 0, { first: 'Giulia', last: 'Verdi', cf: 'VRDGLI85B02F205A', email: 'giulia@example.com' });
    await fillTerms(page);
    await page.getByRole('button', { name: 'Crea bozza contratto' }).click();

    await expect(page.getByTestId('lease-landlords-0').getByText(/Codice fiscale non valido/)).toBeVisible();
    expect(calls.created).toHaveLength(0);
    await expect(page).toHaveURL(/\/leases\/new/);
  });

  test('create with two landlords and two tenants, sign offline, declare the RLI, set up the rent and mark one paid', async ({
    page,
  }) => {
    const calls = await mockLeaseFlowApi(page);
    await page.goto(demoUrl('/leases/new', 'long-term'), { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Immobile/).selectOption(FLOW_PROPERTY.id);

    // LT-14: more parties per role; the codes are validated (a company has 11 digits) and sent normalized.
    await page.getByRole('button', { name: 'Aggiungi locatore' }).click();
    await page.getByRole('button', { name: 'Aggiungi conduttore' }).click();
    await fillParty(page, 'landlords', 0, { first: 'Mario', last: 'Rossi', cf: 'rssmra80a01h501u', email: 'mario@example.com' });
    await fillParty(page, 'landlords', 1, { first: 'Anna', last: 'Bianchi', cf: 'BNCNNA82A41F205W', email: 'anna@example.com' });
    await fillParty(page, 'tenants', 0, { first: 'Giulia', last: 'Verdi', cf: 'VRDGLI85B02F205A', email: 'giulia@example.com' });
    await fillParty(page, 'tenants', 1, { first: 'Acme', last: 'Srl', cf: '00123456782', email: 'acme@example.com' });
    await fillTerms(page);
    await page.getByRole('button', { name: 'Crea bozza contratto' }).click();

    await expect(page).toHaveURL(new RegExp(`/leases/${FLOW_LEASE_ID}$`));
    expect(calls.created).toHaveLength(1);
    expect(calls.created[0].parties.map((p) => `${p.role}:${p.fiscalCode}`)).toEqual([
      'Landlord:RSSMRA80A01H501U',
      'Landlord:BNCNNA82A41F205W',
      'Tenant:VRDGLI85B02F205A',
      'Tenant:00123456782',
    ]);
    expect(calls.created[0]).toMatchObject({ propertyId: FLOW_PROPERTY.id, monthlyRent: 1200, contractType: 'Libero' });

    // Before the signature: every party is to sign, the rent has nothing to schedule and the RLI is not yet possible.
    const signing = page.getByTestId('lease-signing-panel');
    await expect(signing.getByTestId('lease-signer')).toHaveCount(4);
    await expect(signing.getByTestId('lease-signer-status')).toHaveText(['Da firmare', 'Da firmare', 'Da firmare', 'Da firmare']);
    await expect(page.getByTestId('rent-not-signed')).toBeVisible();

    // The contract to sign is requested from the API.
    const downloadPromise = page.waitForEvent('download');
    await signing.getByRole('button', { name: 'Scarica contratto da firmare' }).click();
    await downloadPromise;
    expect(calls.contractDownloads).toBe(1);

    // Manual signature: the submit stays disabled until the file and the declaration are there.
    await signing.getByRole('button', { name: 'Carica contratto firmato' }).click();
    const dialog = page.getByTestId('signed-contract-dialog');
    const submit = dialog.getByRole('button', { name: 'Salva la firma' });
    await expect(submit).toBeDisabled();
    await dialog.locator('input[type="file"]').setInputFiles({ name: 'contratto-firmato.pdf', mimeType: 'application/pdf', buffer: PDF });
    await dialog.locator('input[type="date"]').fill('2026-08-20');
    await expect(submit).toBeDisabled();
    await dialog.getByRole('checkbox', { name: /Dichiaro che il file/ }).check();
    await expect(submit).toBeEnabled();
    await submit.click();

    await expect(page.getByTestId('lease-signing-state')).toHaveText('Firmato');
    expect(calls.signedUploads).toEqual([{ stipulaDate: '2026-08-20', hasPdf: true }]);
    await expect(page.getByTestId('rli-registration-deadline')).toContainText('19/09/2026');

    // Manual RLI: the receipt number and date come from the landlord; the registration is shown only after the API saved it.
    await expect(page.getByTestId('rli-registration-state')).toHaveText('Da registrare');
    await page.getByRole('button', { name: 'Inserisci estremi di registrazione' }).click();
    const rli = page.getByTestId('rli-manual-dialog');
    await rli.getByLabel('Numero o protocollo di registrazione').fill('24091234567890123-000001');
    await rli.getByLabel('Data di registrazione').fill('2026-09-18');
    await rli.locator('input[type="file"]').setInputFiles({ name: 'ricevuta.pdf', mimeType: 'application/pdf', buffer: PDF });
    await rli.getByRole('checkbox', { name: /Dichiaro che il contratto è stato registrato/ }).check();
    await rli.getByRole('button', { name: 'Salva registrazione' }).click();

    await expect(page.getByTestId('rli-registration-state')).toHaveText('Registrato');
    expect(calls.manualRegistrations).toEqual([
      { registrationCode: '24091234567890123-000001', registrationDate: '2026-09-18', hasReceipt: true },
    ]);
    await expect(page.getByTestId('rli-registration-panel')).toContainText('24091234567890123-000001');

    // Rent: the schedule is generated from the lease (48 monthly installments), all to collect.
    const rent = page.getByTestId('rent-schedule-panel');
    await expect(page.getByTestId('rent-not-signed')).toHaveCount(0);
    await rent.getByLabel('Giorno di scadenza (1-28)').fill('5');
    await rent.getByRole('button', { name: 'Genera lo scadenziario' }).click();
    await expect(rent.getByTestId('rent-installment')).toHaveCount(48);
    expect(calls.rentSchedules).toEqual([{ cadence: 'Monthly', billingDayOfMonth: 5 }]);
    await expect(rent.getByTestId('rent-installment-status').first()).toHaveText('Da incassare');

    // Offline payment of the first installment: only that one becomes paid.
    await rent.getByRole('button', { name: 'Segna come pagata' }).first().click();
    const paidDialog = page.getByTestId('mark-rent-paid-dialog');
    await paidDialog.getByLabel('Data del pagamento').fill('2026-09-05');
    await paidDialog.getByRole('button', { name: 'Registra il pagamento' }).click();

    await expect(rent.getByTestId('rent-installment-paid')).toHaveCount(1);
    expect(calls.markPaid).toEqual([{ installmentId: 'inst-01', paidOn: '2026-09-05' }]);
    await expect(rent.getByTestId('rent-installment').first().getByTestId('rent-installment-status')).toHaveText('Pagata');
    await expect(rent.getByTestId('rent-installment').nth(1).getByTestId('rent-installment-status')).toHaveText('Da incassare');
  });

  test('an API error on the lease detail is a load error with retry, not "not found"', async ({ page }) => {
    await mockLeaseFlowApi(page);
    await page.route(`**/api/leases/${FLOW_LEASE_ID}`, (route) =>
      route.fulfill({ status: 500, contentType: 'application/problem+json', body: JSON.stringify({ status: 500, code: 'internal_error' }) }),
    );
    await page.goto(demoUrl(`/leases/${FLOW_LEASE_ID}`, 'long-term'), { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('lease-load-error')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('lease-not-found')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Riprova' })).toBeEnabled();
  });
});

async function fillTerms(page: import('@playwright/test').Page): Promise<void> {
  await page.getByLabel(/Data inizio/).fill('2026-09-01');
  await page.getByLabel(/Data fine/).fill('2030-08-31');
  await page.getByLabel(/Canone mensile/).fill('1200');
}

async function fillParty(
  page: import('@playwright/test').Page,
  list: 'landlords' | 'tenants',
  index: number,
  party: { first: string; last: string; cf: string; email: string },
): Promise<void> {
  const card = page.getByTestId(`lease-${list}-${index}`);
  await card.getByLabel(/^Nome/).fill(party.first);
  await card.getByLabel(/^Cognome/).fill(party.last);
  await card.getByLabel(/^Codice fiscale/).fill(party.cf);
  await card.getByLabel(/^Cittadinanza/).fill('IT');
  await card.getByLabel(/^Email/).fill(party.email);
}
