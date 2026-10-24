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
  test.setTimeout(90_000);
  test.beforeEach(async ({ page }) => {
    await resetE2eStorage(page, 'it');
  });

  test('sign offline a draft with two landlords and two tenants, declare the RLI, set up the rent and mark one paid', async ({
    page,
  }) => {
    const calls = await mockLeaseFlowApi(page);
    // The draft is already on the server (the wizard of its creation is LR-06a's own): the flow starts from its sheet.
    await page.goto(demoUrl(`/app/long-rent/leases/${FLOW_LEASE_ID}`, 'long-term'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('lease-continue-draft')).toBeVisible();

    // Before the signature (the draft opens on the tab of the signature): every party is to sign and the rent has nothing to schedule.
    const signing = page.getByTestId('lease-signing-panel');
    await expect(signing.getByTestId('lease-signer')).toHaveCount(4);
    await expect(signing.getByTestId('lease-signer-status')).toHaveText(['Da firmare', 'Da firmare', 'Da firmare', 'Da firmare']);
    await page.getByTestId('lease-tab-pagamenti').click();
    await expect(page.getByTestId('rent-not-signed')).toBeVisible();
    await page.getByTestId('lease-tab-documenti').click();

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
    // The registration and its deadline are in the tab of the deadlines.
    await page.getByTestId('lease-tab-scadenze').click();
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
    const receiptPromise = page.waitForEvent('download');
    await page.getByTestId('rli-registration-panel').getByRole('button', { name: /Scarica ricevuta/ }).click();
    const receipt = await receiptPromise;
    expect(receipt.suggestedFilename()).toBe(`ricevuta-rli-${FLOW_LEASE_ID}.pdf`);
    expect(calls.receiptDownloads).toBe(1);


    // Rent: the schedule is generated from the lease (48 monthly installments), all to collect.
    await page.getByTestId('lease-tab-pagamenti').click();
    const rent = page.getByTestId('rent-schedule-panel');
    await expect(page.getByTestId('rent-not-signed')).toHaveCount(0);
    await rent.getByLabel('Giorno di scadenza (1-28)').fill('5');
    await rent.getByRole('button', { name: 'Genera lo scadenziario' }).click();
    await expect(rent.getByTestId('rent-installment')).toHaveCount(48);
    // LR-04a: the lease started on 1 September 2026, so from a later month the plan is tracked from the first of this month and no past
    // period is born late; the payment requests to the tenants stay off (nothing about them is sent unless the landlord turns them on).
    expect(calls.rentSchedules).toHaveLength(1);
    expect(calls.rentSchedules[0]).toMatchObject({ cadence: 'Monthly', billingDayOfMonth: 5 });
    expect(calls.rentSchedules[0]).not.toHaveProperty('onlineRequests');
    const trackFrom = (calls.rentSchedules[0] as { trackFrom?: string }).trackFrom;
    if (trackFrom !== undefined) expect(trackFrom).toMatch(/^\d{4}-\d{2}-01$/);
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

  test('missing APE is told in the first step of the wizard and uploaded in a window over it', async ({ page }) => {
    await mockLeaseFlowApi(page);
    await page.route(`**/api/properties/${FLOW_PROPERTY.id}/documents`, (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
    );
    await page.goto(demoUrl('/app/long-rent/leases/new?tipo=altro', 'long-term'), { waitUntil: 'domcontentloaded' });
    await page.getByLabel(/Immobile/).selectOption(FLOW_PROPERTY.id);
    await expect(page.getByText(/Per creare il contratto serve l’APE/)).toBeVisible();
    // The APE is uploaded in a window over the page, which stays where it is (it used to open the property page).
    await page.getByRole('button', { name: "Carica l'APE" }).click();
    await expect(page.getByRole('dialog').getByTestId('document-drop-zone')).toBeVisible();
    await expect(page).toHaveURL(/\/leases\/new\?tipo=altro/);
  });

  test('a short-stay-only host cannot open the lease creation page', async ({ page }) => {
    await mockLeaseFlowApi(page);
    await page.goto(demoUrl('/app/long-rent/leases/new', 'short-stay'), { waitUntil: 'domcontentloaded' });
    await expect(page.getByTestId('app-ready')).toBeVisible();
    await expect(page.getByTestId('lease-kind-choice')).toHaveCount(0);
    await expect(page).not.toHaveURL(/\/long-rent\/leases\/new/);
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
