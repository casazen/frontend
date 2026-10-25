import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pickComune } from './host-steps';
import type { StackEnv } from './stack';

/**
 * The steps of the round of the guided contract of a canone concordato (CF-L3), one function for each thing a person does on a screen. They
 * drive the interface the way a person does; the API is only asked to prove what the screens say (see the spec) and, once, to stand in for
 * what has no screen (`grantGiftPractice`).
 */

/** One line of the log of the run: where the long journey is (the CI log is what is read first when it fails). */
export function log(message: string): void {
  console.log(`[cf-round] ${new Date().toISOString()} ${message}`);
}

/** An answer of the API that was not a success, as one actor of the journey saw it. */
export type ApiTrouble = { status: number; line: string };

export type Actor = { name: string; context: BrowserContext; page: Page };

/** A person with a browser of their own (a desktop one), who writes down what the API answered wrongly. */
export async function newActor(browser: Browser, name: string, trouble: ApiTrouble[]): Promise<Actor> {
  const context = await browser.newContext({
    ignoreHTTPSErrors: true,
    locale: 'it-IT',
    timezoneId: 'Europe/Rome',
    viewport: { width: 1280, height: 900 },
    acceptDownloads: true,
  });
  const page = await context.newPage();
  page.on('response', (res) => {
    if (!res.url().includes('/api/') || res.status() < 400) return;
    const line = `${name}: ${res.status()} ${res.request().method()} ${new URL(res.url()).pathname}`;
    trouble.push({ status: res.status(), line });
    log(`API ${line}`);
  });
  page.on('pageerror', (error) => log(`PAGE ERROR (${name}): ${error.message}`));
  // Leaving a page with a change not saved yet asks the person (beforeunload): a person who leaves answers «leave».
  page.on('dialog', (dialog) => void dialog.accept());
  await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
  return { name, context, page };
}

/** What no text of the app may name: the service that prepares the contract, and «partner». The legal pages (`/legale/*`) are not visited. */
const SUPPLIER_NAME = /concordato\s*facile|concordatofacile|partner/i;

/**
 * The text a person can read on the screen now names neither the supplier of the guided contract nor «partner». A soft check: the round
 * goes on, so that one run lists every screen that names it, and the test fails at the end.
 */
export async function expectNoSupplierName(page: Page, where: string): Promise<void> {
  const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ');
  const found = SUPPLIER_NAME.exec(text);
  const around = found ? text.slice(Math.max(0, found.index - 70), found.index + 90) : '';
  expect.soft(found, `the text of "${where}" names the supplier or says "partner": «…${around}…»`).toBeNull();
}

/**
 * A picture of the screen, kept with the files of the test (the CI uploads them): it is how a person who was not there sees the round. A
 * picture that cannot be taken is no reason to fail.
 */
export async function shot(page: Page, name: string): Promise<void> {
  await page
    .screenshot({ path: test.info().outputPath(`${name}.jpg`), type: 'jpeg', quality: 60, fullPage: true, timeout: 15_000 })
    .catch((error: unknown) => log(`no picture of ${name}: ${String(error)}`));
}

/** A card of a `ChoiceCard`: the radio under it is not drawn, so the person clicks the card (its label). */
export async function chooseCard(page: Page, testId: string): Promise<void> {
  const input = page.getByTestId(testId);
  await page.locator('label', { has: input }).click();
  await expect(input).toBeChecked();
}

const LEASE_PATH = /\/app\/long-rent\/leases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

/** The id of the lease whose sheet (or page) the address names. */
export function leaseIdOf(page: Page): string {
  const found = LEASE_PATH.exec(new URL(page.url()).pathname);
  expect(found, `the address ${page.url()} names a lease`).not.toBeNull();
  return (found as RegExpExecArray)[1];
}

// ---- the landlord ------------------------------------------------------------------------------------------------------------------

/**
 * A new account that chooses «Locazioni di lungo periodo», accepts the consents and enters its first house with the quick form, as the
 * onboarding of a landlord does (the account was just created at the login of the mock IdP, or is a platform administrator who opened
 * `/onboarding` to set up an organization of its own). It ends on the list of the contracts, with the guide that asks for the first one.
 */
export async function becomeLongTermLandlord(page: Page, propertyName: string): Promise<void> {
  await expect(page.getByRole('heading', { name: /Da dove vuoi iniziare/i })).toBeVisible({ timeout: 30_000 });
  await page.getByRole('button', { name: 'Scegli' }).nth(1).click(); // "Locazioni di lungo periodo"
  const consents = page.getByTestId('onboarding-consents-step');
  await expect(consents).toBeVisible({ timeout: 20_000 });
  for (const checkbox of await consents.getByRole('checkbox').all()) {
    if ((await checkbox.getAttribute('id')) !== 'marketing') await checkbox.click();
  }
  await page.getByTestId('onboarding-consents-continue').click();

  await expect(page).toHaveURL(/\/app\/long-rent\/properties\/new\?first=1/, { timeout: 30_000 });
  await expect(page.getByTestId('quick-property-form')).toBeVisible();
  await page.locator('#name').fill(propertyName);
  await pickComune(page, '#comune', 'Milano');
  await page.locator('#address').fill('Via Torino 20');
  await page.locator('#postalCode').fill('20123');
  await page.getByTestId('quick-property-submit').click();
  await expect(page).toHaveURL(/\/app\/long-rent\/leases$/, { timeout: 30_000 });
}

/**
 * «Nuovo contratto» → «Canone concordato» → «Parto da zero» → the house → the draft is saved and the person lands on the SHEET of the contract.
 * Returns the id of the lease (the reference the guided form is linked to).
 */
export async function startConcordatoFromZero(
  page: Page,
  propertyName: string,
  /** Called on each of the three screens of the new contract (a picture of it). */
  onScreen?: (name: string) => Promise<void>,
): Promise<string> {
  const guide = page.getByTestId('long-rent-guide');
  await expect(guide).toBeVisible({ timeout: 20_000 });
  await guide.getByRole('link', { name: 'Crea contratto' }).click();
  await expect(page).toHaveURL(/\/app\/long-rent\/leases\/new/, { timeout: 20_000 });

  await expect(page.getByTestId('lease-kind-choice')).toBeVisible({ timeout: 20_000 });
  await expectNoSupplierName(page, 'the first question of the new contract');
  await onScreen?.('new-contract-which');
  await chooseCard(page, 'lease-kind-concordato');
  await page.getByTestId('lease-kind-continue').click();

  await expect(page.getByTestId('lease-way-choice')).toBeVisible({ timeout: 20_000 });
  // Open only while the guided service is on: the flags are read first (the card is closed, not hidden, until they are).
  await expect(page.getByTestId('lease-way-zero')).toBeEnabled({ timeout: 20_000 });
  await expectNoSupplierName(page, 'the second question of the new contract');
  await onScreen?.('new-contract-how');
  await chooseCard(page, 'lease-way-zero');
  await page.getByTestId('lease-way-continue').click();

  const form = page.getByTestId('concordato-draft-start');
  await expect(form).toBeVisible({ timeout: 20_000 });
  const option = form.locator('select option', { hasText: propertyName });
  await expect(option).toHaveCount(1, { timeout: 20_000 });
  await form.locator('select').selectOption((await option.getAttribute('value')) as string);
  await expectNoSupplierName(page, 'the choice of the house');
  await onScreen?.('new-contract-house');
  await page.getByTestId('concordato-draft-create').click();

  await expect(page.getByTestId('lease-partner-draft')).toBeVisible({ timeout: 30_000 });
  return leaseIdOf(page);
}

/**
 * «Leggi l'informativa» of the sheet opens the privacy notice in another tab: the page is there and does not fail. Its text is the legal one
 * and is not read here (the pages `/legale/*` are the one place that may name the service); where the notice is not published yet the page
 * says it is being prepared. Returns what the page shows: the notice, «in preparation», or the error.
 */
export async function readThePrivacyNotice(page: Page): Promise<'notice' | 'in-preparation' | 'error'> {
  const link = page.getByTestId('lease-partner-privacy').getByRole('link', { name: /Leggi l.informativa/ });
  await expect(link).toBeVisible({ timeout: 20_000 });
  const [tab] = await Promise.all([page.context().waitForEvent('page', { timeout: 20_000 }), link.click()]);
  try {
    await expect(tab).toHaveURL(/\/legale\/privacy/, { timeout: 20_000 });
    await expect(tab.locator('[data-testid="legal-document-privacy"], [data-testid="legal-document-error"]').first()).toBeVisible({ timeout: 30_000 });
    if ((await tab.getByTestId('legal-document-error').count()) > 0) return 'error';
    return (await tab.getByTestId('legal-document-in-preparation').count()) > 0 ? 'in-preparation' : 'notice';
  } finally {
    await tab.close();
  }
}

/**
 * The block of the sheet that waits for the form: the main button is closed until the privacy notice is ticked, then the person goes on.
 * With the access (platform administrator, payment, gift) the click opens the guided form in this same tab; without it, the page of payment.
 */
export async function acceptPrivacyAndProceed(page: Page, onScreen?: (name: string) => Promise<void>): Promise<void> {
  const privacy = page.getByTestId('lease-partner-privacy');
  const proceed = page.getByTestId('lease-partner-proceed');
  await expect(privacy).toBeVisible({ timeout: 20_000 });
  await expect(proceed).toBeDisabled();
  await onScreen?.('sheet-privacy-not-ticked');
  await privacy.getByRole('checkbox').check();
  await expect(proceed).toBeEnabled();
  await onScreen?.('sheet-privacy-ticked');
  await proceed.click();
}

// ---- the guided form (the simulated one of the test environments) --------------------------------------------------------------------

/** The form is open with a good link, the person sends the practice and the module says its number. */
export async function sendThePractice(page: Page): Promise<{ practiceId: string; controlToken: string }> {
  await expect(page.getByTestId('guided-form-link-valid')).toBeVisible({ timeout: 30_000 });
  const created = page.waitForResponse(
    (res) => res.request().method() === 'POST' && new URL(res.url()).pathname.endsWith('/cf-simulator/practices'),
    { timeout: 30_000 },
  );
  await page.getByTestId('guided-form-submit').click();
  const body = (await (await created).json()) as { practiceId: string; controlToken: string };
  await expect(page.getByTestId('guided-form-submitted')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('guided-form-practice-id')).toHaveText(body.practiceId);
  return body;
}

/**
 * The test panel: whoever tries the round does what the service would do, and moves the practice to another state (with the reason, when
 * the practice is closed without an attestation).
 */
export async function movePracticeTo(page: Page, status: string, closeReason?: string): Promise<void> {
  await page.getByTestId('guided-form-status').selectOption(status);
  if (closeReason) await page.getByTestId('guided-form-close-reason').selectOption(closeReason);
  await page.getByTestId('guided-form-apply').click();
  await expect(page.getByText('Stato aggiornato.')).toBeVisible({ timeout: 15_000 });
}

/** One of the three sample documents of the panel, downloaded as a person does it (a click); returns where the file was saved. */
export async function downloadSample(page: Page, kind: 'contract' | 'attestation' | 'receipt', folder: string): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByTestId(`guided-form-download-${kind}`).click(),
  ]);
  const saved = join(folder, download.suggestedFilename());
  await download.saveAs(saved);
  expect((await readFile(saved)).subarray(0, 5).toString('latin1'), `${kind} is a PDF`).toBe('%PDF-');
  return saved;
}

// ---- the documents -----------------------------------------------------------------------------------------------------------------

/** On the page that takes the documents in: the kind, the file chosen with the field, «Carica documento», and the document is in the list. */
export async function uploadDocument(page: Page, file: string, kindLabel: 'Contratto' | 'Attestazione' | 'Registrazione'): Promise<void> {
  const panel = page.getByTestId('lease-documents-panel');
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await panel.getByLabel('Tipo di documento').selectOption({ label: kindLabel });
  await panel.getByLabel('Scegli PDF o foto delle pagine').setInputFiles(file);
  await panel.getByRole('button', { name: 'Carica documento', exact: true }).click();
  await expect(panel.getByText('Documento salvato e allegato al contratto.')).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText(file.split(/[\\/]/).pop() as string, { exact: true })).toBeVisible({ timeout: 20_000 });
}

// ---- the wizard that imports the contract ---------------------------------------------------------------------------------------------

/**
 * The step the wizard SHOWS now, read from its list of steps (the one marked as the current): the address changes before the screen does,
 * so the address is not a safe way to know on which step the fields are. 0 while the list is not there.
 */
async function wizardStepOnScreen(page: Page): Promise<number> {
  const item = page.getByTestId('lease-wizard-stepper').locator('li:has([aria-current="step"])').first();
  if ((await item.count()) === 0) return 0;
  const id = (await item.getAttribute('data-testid')) ?? '';
  return Number(id.replace('lease-wizard-step-', '')) || 0;
}

/** Fills a field only if it is empty (what the reading of the contract wrote is not touched); says what it filled. */
async function fillIfEmpty(page: Page, selector: string, value: string, what: string): Promise<void> {
  const field = page.locator(selector);
  if ((await field.inputValue()).trim() !== '') return;
  await field.fill(value);
  log(`wizard: ${what} was missing, typed «${value}»`);
}

/** What the wizard asks that the contract does not say: the citizenship of the parties, the regime when it was not read. Only what is empty. */
async function completeWhatIsMissing(page: Page, step: number): Promise<void> {
  if (step === 2) {
    for (const list of ['landlords', 'tenants'] as const) {
      await fillIfEmpty(page, `#lw-${list}-0-residence`, 'Roma (RM), Via dei Mille 5', `the residence of the first of the ${list}`);
      const citizenship = page.locator(`#lw-${list}-0-citizenship`);
      if ((await citizenship.inputValue()) === '') {
        await citizenship.selectOption('IT');
        log(`wizard: the citizenship of the first of the ${list} was missing, chose Italy`);
      }
    }
  }
  if (step === 3) {
    const chosen = await page.locator('input[name="lease-regime"]:checked').count();
    if (chosen === 0) {
      await chooseCard(page, 'lease-regime-Ordinario');
      log('wizard: the tax regime was missing, chose the ordinary one');
    }
  }
}

/**
 * «Completa e importa il contratto» has opened the wizard on the first step with something missing: each step is walked through with the
 * button that goes on, completing only what is empty, until the step of the signed contract. Returns the steps it went through.
 */
export async function walkTheWizardToTheImport(page: Page): Promise<number[]> {
  await expect(page.getByTestId('lease-wizard-page')).toBeVisible({ timeout: 30_000 });
  const seen: number[] = [];
  for (let guard = 0; guard < 8; guard += 1) {
    await expect.poll(() => wizardStepOnScreen(page), { message: 'the wizard shows a step', timeout: 30_000 }).toBeGreaterThan(0);
    const step = await wizardStepOnScreen(page);
    if (step === 7) return seen;
    seen.push(step);
    const remaining = (await page.getByTestId('lease-wizard-remaining').innerText()).replace(/\s+/g, ' ');
    log(`wizard step ${step}: ${remaining}`);
    await expectNoSupplierName(page, `the step ${step} of the wizard`);
    await shot(page, `wizard-step-${step}`);
    await completeWhatIsMissing(page, step);
    await page.getByTestId('lease-wizard-next').click();
    await expect
      .poll(() => wizardStepOnScreen(page), { message: `the wizard goes on from the step ${step}`, timeout: 30_000 })
      .not.toBe(step);
  }
  throw new Error(`the wizard did not reach the step of the signed contract: it went through ${seen.join(', ')}`);
}

/**
 * The step of the signed contract: the PDF already uploaded is the one that is imported, the day of the signature is the one the contract
 * states; the person says it is not registered yet (the service registers it afterwards), and confirms.
 */
export async function importTheSignedContract(page: Page): Promise<void> {
  await expect(page.getByTestId('lease-import-step')).toBeVisible({ timeout: 20_000 });
  await expect(page.getByTestId('lease-import-uploaded')).toBeVisible();
  await expect(page.getByTestId('lease-import-date')).not.toHaveValue('');
  await chooseCard(page, 'lease-registered-no');
  await expectNoSupplierName(page, 'the step of the signed contract');
  await page.getByTestId('lease-import-submit').click();
  const dialog = page.getByRole('dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await dialog.getByRole('button', { name: 'Inserisci il contratto' }).click();
  await expect(page.getByTestId('lease-after-step')).toBeVisible({ timeout: 30_000 });
}

// ---- the registration ------------------------------------------------------------------------------------------------------------------

/**
 * The registration made by the service is declared on the sheet: the receipt already uploaded among the documents is the one used (not sent
 * twice), the number and the day are typed from it, the person confirms.
 */
export async function declareTheRegistration(
  page: Page,
  leaseId: string,
  code: string,
  day: string,
  /** Called with the window filled in and not yet sent (a picture of it). */
  beforeSaving?: () => Promise<void>,
): Promise<void> {
  const panel = page.getByTestId('rli-registration-panel');
  await expect(panel).toBeVisible({ timeout: 30_000 });
  await panel.getByRole('button', { name: 'Dichiara la registrazione' }).click();

  const dialog = page.getByTestId('rli-manual-dialog');
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByTestId('rli-receipt-uploaded')).toBeChecked();
  await dialog.locator(`#rli-code-${leaseId}`).fill(code);
  await dialog.locator(`#rli-date-${leaseId}`).fill(day);
  await dialog.getByRole('checkbox', { name: /Dichiaro che il contratto è stato registrato/ }).check();
  await beforeSaving?.();
  await dialog.getByRole('button', { name: 'Salva registrazione' }).click();
  await expect(dialog).toHaveCount(0, { timeout: 30_000 });
}

// ---- the access without Stripe ------------------------------------------------------------------------------------------------------

/**
 * FIXTURE, not part of the journey: the organization receives the gift practice that stands in for the payment. Granting it is an act of
 * the platform administrator that has no screen in the app (only the API: `POST api/admin/orgs/{orgId}/concordatofacile/grant-gift`), and
 * the real payment needs Stripe, whose test keys the CI does not have. The person then USES the gift on the page of payment, from the screen.
 */
export async function grantGiftPractice(
  request: APIRequestContext,
  stack: StackEnv,
  adminToken: string,
  orgId: string,
  run: string,
): Promise<void> {
  const res = await request.post(`${stack.apiUrl}/admin/orgs/${orgId}/concordatofacile/grant-gift`, {
    headers: { Authorization: `Bearer ${adminToken}` },
    data: { subscriptionId: `sub_e2e_${run}`, reason: 'E2E of the guided contract: the gift practice stands in for the payment' },
  });
  expect(res.status(), `grant-gift answered: ${await res.text()}`).toBe(201);
}
