import { completeCommercialSignup } from './commercial-signup';
import { expect, test, type APIRequestContext, type Browser, type BrowserContext, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pickComune } from './host-steps';
import type { StackEnv } from './stack';

export function log(message: string): void {
  console.log(`[cf-round] ${new Date().toISOString()} ${message}`);
}

export type ApiTrouble = { status: number; line: string };

export type Actor = { name: string; context: BrowserContext; page: Page };

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
  page.on('dialog', (dialog) => void dialog.accept());
  await page.addInitScript(() => localStorage.setItem('casazen.locale', 'it'));
  return { name, context, page };
}

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

export async function shot(page: Page, name: string): Promise<void> {
  await page
    .screenshot({ path: test.info().outputPath(`${name}.jpg`), type: 'jpeg', quality: 60, fullPage: true, timeout: 15_000 })
    .catch((error: unknown) => log(`no picture of ${name}: ${String(error)}`));
}

export async function chooseCard(page: Page, testId: string): Promise<void> {
  const input = page.getByTestId(testId);
  await page.locator('label', { has: input }).click();
  await expect(input).toBeChecked();
}

const LEASE_PATH = /\/app\/long-rent\/leases\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})(?:[/?#]|$)/i;

export function leaseIdOf(page: Page): string {
  const found = LEASE_PATH.exec(new URL(page.url()).pathname);
  expect(found, `the address ${page.url()} names a lease`).not.toBeNull();
  return (found as RegExpExecArray)[1];
}

export async function becomeLongTermLandlord(page: Page, propertyName: string): Promise<void> {
  await completeCommercialSignup(page, 'long-rent');

  await expect(page).toHaveURL(/\/app\/long-rent\/properties\/new\?first=1/, { timeout: 30_000 });
  await expect(page.getByTestId('quick-property-form')).toBeVisible();
  await page.locator('#name').fill(propertyName);
  await pickComune(page, '#comune', 'Milano');
  await page.locator('#address').fill('Via Torino 20');
  await page.locator('#postalCode').fill('20123');
  await page.getByTestId('quick-property-submit').click();
  await expect(page).toHaveURL(/\/app\/long-rent\/properties$/, { timeout: 30_000 });
}

export async function startConcordatoFromZero(
  page: Page,
  propertyName: string,
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

export async function movePracticeTo(page: Page, status: string, closeReason?: string): Promise<void> {
  await page.getByTestId('guided-form-status').selectOption(status);
  if (closeReason) await page.getByTestId('guided-form-close-reason').selectOption(closeReason);
  await page.getByTestId('guided-form-apply').click();
  await expect(page.getByText('Stato aggiornato.')).toBeVisible({ timeout: 15_000 });
}

/**
 * One of the two sample documents of the panel (CF-DOCS-REAL: the contract with its attestation and its calculation sheet in one scan, and the
 * receipt of the Agenzia delle Entrate), downloaded as a person does it (a click); returns where the file was saved.
 */
export async function downloadSample(page: Page, kind: 'contract' | 'receipt', folder: string): Promise<string> {
  const [download] = await Promise.all([
    page.waitForEvent('download', { timeout: 30_000 }),
    page.getByTestId(`guided-form-download-${kind}`).click(),
  ]);
  const saved = join(folder, download.suggestedFilename());
  await download.saveAs(saved);
  expect((await readFile(saved)).subarray(0, 5).toString('latin1'), `${kind} is a PDF`).toBe('%PDF-');
  return saved;
}

export async function uploadDocument(
  page: Page,
  file: string,
  kindLabel: 'Contratto firmato e attestazione' | 'Ricevuta di registrazione',
): Promise<void> {
  const panel = page.getByTestId('lease-documents-panel');
  await expect(panel).toBeVisible({ timeout: 20_000 });
  await panel.getByLabel('Tipo di documento').selectOption({ label: kindLabel });
  await panel.getByLabel('Scegli PDF o foto delle pagine').setInputFiles(file);
  await panel.getByRole('button', { name: 'Carica documento', exact: true }).click();
  await expect(panel.getByText('Documento salvato e allegato al contratto.')).toBeVisible({ timeout: 30_000 });
  await expect(panel.getByText(file.split(/[\\/]/).pop() as string, { exact: true })).toBeVisible({ timeout: 20_000 });
}

async function wizardStepOnScreen(page: Page): Promise<number> {
  const item = page.getByTestId('lease-wizard-stepper').locator('li:has([aria-current="step"])').first();
  if ((await item.count()) === 0) return 0;
  const id = (await item.getAttribute('data-testid')) ?? '';
  return Number(id.replace('lease-wizard-step-', '')) || 0;
}

async function fillIfEmpty(page: Page, selector: string, value: string, what: string): Promise<void> {
  const field = page.locator(selector);
  if ((await field.inputValue()).trim() !== '') return;
  await field.fill(value);
  log(`wizard: ${what} was missing, typed «${value}»`);
}

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
