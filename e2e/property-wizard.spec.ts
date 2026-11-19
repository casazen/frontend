import type { Page } from '@playwright/test';
import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { createPropertyWithWizard, mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCurrentUserWithOrg, mockEntitlement } from './helpers/org-api-mock';
import { NEW_PROPERTY_ID, buildCreatedProperty } from './fixtures/properties.fixtures';
import type { PropertySender } from '../src/types/property-sender.types';
import type { ComplianceActivationResult, ComplianceStepStatus } from '../src/types/compliance.types';

/**
 * «Aggiungi immobile» from the first step to the activation (SR-07b, SR-07c), with the server mocked (L2). What the last step says is
 * what the activation answers: here only the CIN is missing until it is saved.
 */
interface ServerState {
  cin: boolean;
  active: boolean;
  completeCalls: number;
  completeAnswer: 'ok' | 'blocked';
  senderSaved: boolean;
}

const step = (id: string, status: ComplianceStepStatus, blocker = true) => ({ id, label: id, status, blocker });

async function mockReportingSetup(page: Page, state: ServerState): Promise<void> {
  await page.route('**/api/properties/*/sender', async route => {
    if (route.request().method() === 'PUT') {
      expect(route.request().postDataJSON().sender).toBe('Manual');
      state.senderSaved = true;
    }
    const sender: PropertySender = {
      propertyId: NEW_PROPERTY_ID, sender: 'Manual', istatSender: 'Manual', applies: true,
      source: state.senderSaved ? 'Stored' : 'DefaultNotConnected', state: 'NotConfigured', verification: 'NotApplicable',
      reason: null, guidance: null, policeAccountValid: null, policeAutorun: null, policeLastCron: null,
      questuraCredentialsConfigured: false, channelManagerAvailable: false, availableSenders: ['Manual'],
      delegationAccepted: false, delegationTextVersion: '', declaredAt: null,
      lastChangedAt: state.senderSaved ? '2026-11-17T10:00:00Z' : null,
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(sender) });
  });
  await page.route('**/api/wizards/ComplianceSender/draft**', async route => {
    if (route.request().method() === 'GET') { await route.fulfill({ status: 404 }); return; }
    if (route.request().method() === 'DELETE') { await route.fulfill({ status: 204 }); return; }
    const request = route.request().postDataJSON();
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      type: 'ComplianceSender', entityId: NEW_PROPERTY_ID, version: request.clientVersion + 1,
      lastSavedAt: '2026-11-17T10:00:00Z', data: request.data,
    }) });
  });
}

async function mockActivation(page: Page, state: ServerState): Promise<void> {
  await page.route('**/api/properties/*/compliance/activation', async (route) => {
    if (route.request().method() !== 'GET') {
      await route.fallback();
      return;
    }
    const body: ComplianceActivationResult = {
      complianceStatus: state.active ? 'Active' : 'Pending',
      steps: [
        step('base-data', 'complete'),
        step('cin', state.cin ? 'complete' : 'pending'),
        step('documents', 'complete'),
        step('safety', 'complete'),
        step('tourist-tax', 'pending', false),
      ],
    };
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
  });

  await page.route('**/api/properties/*/cin', async (route) => {
    if (route.request().method() !== 'PUT') {
      await route.fallback();
      return;
    }
    state.cin = true;
    await route.fulfill({ status: 204 });
  });

  await page.route('**/api/properties/*/compliance/activation/complete', async (route) => {
    state.completeCalls += 1;
    if (state.completeAnswer === 'blocked') {
      await route.fulfill({
        status: 409,
        contentType: 'application/json',
        body: JSON.stringify({
          code: 'property_activation_blocked',
          complianceStatus: 'Pending',
          incompleteBlockers: ['documents'],
          blockers: [{ step: 'documents', code: '', message: 'Manca il documento richiesto dalla tua regione.' }],
        }),
      });
      return;
    }
    state.active = true;
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ complianceStatus: 'Active' }) });
  });
}

/**
 * Creates the property with the first step, leaves the optional ones, gives the rate and arrives at the last step. The channel manager is
 * off here (the flag `octorateConnector` is, in the e2e, as in production): the texts of the listing are optional, as they always were, so
 * the Italian headline is written and the English texts are left empty — «Continua» asks for nothing more.
 */
async function goToComplianceStep(page: Page): Promise<void> {
  await page.goto(demoUrl('/app/short-rent/properties/create', 'short-stay'));
  const created = await createPropertyWithWizard(page, { name: 'Casa Procedura', address: 'Via Garibaldi 42', comune: 'Milano', postalCode: '20100' });
  expect(created.status()).toBe(201);
  for (const stepId of ['photos', 'amenities']) {
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', stepId);
    await page.getByTestId('wizard-skip').click();
  }
  await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'descriptions');
  await page.getByLabel('Titolo', { exact: true }).fill('Casa Procedura');
  await page.getByTestId('property-wizard-next').click();
  await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'rules');
  await page.getByTestId('wizard-skip').click();
  await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'prices');
  await page.getByLabel('Prezzo base per notte').fill('135');
  await page.getByTestId('property-wizard-next').click();
  await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'compliance');
}

async function goToLastStep(page: Page): Promise<void> {
  await goToComplianceStep(page);
  await expect(page.getByTestId('property-setup-compliance')).toContainText('La scelta del mittente è salvata');
  await page.getByTestId('property-wizard-next').click();
  await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'finish');
}

test.describe('Add property wizard', () => {
  let state: ServerState;

  test.beforeEach(async ({ page }) => {
    state = { cin: false, active: false, completeCalls: 0, completeAnswer: 'ok', senderSaved: true };
    await mockPropertiesApi(page);
    await mockCurrentUserWithOrg(page);
    await mockEntitlement(page, { properties: 0 });
    await mockActivation(page, state);
    await mockReportingSetup(page, state);
  });

  test('saving and closing restores the named property and step from the list after reload', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(demoUrl('/app/short-rent/properties/create', 'short-stay'));
    const created = await createPropertyWithWizard(page, {
      name: 'Casa Glicine', address: 'Via Garibaldi 42', comune: 'Milano', postalCode: '20100',
    });
    expect(created.status()).toBe(201);
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'photos');
    await page.getByTestId('property-wizard-save-close').click();
    await expect(page).toHaveURL(/\/app\/short-rent\/properties(?:\?|$)/);
    await page.reload();
    const resume = page.getByTestId('property-setup-resume');
    await expect(resume).toBeVisible();
    await expect(resume).toHaveAttribute('href', new RegExp('propertyId=' + NEW_PROPERTY_ID + '&step=photos'));
    await resume.click();
    await expect(page.getByRole('heading', { name: 'Configura Casa Glicine' })).toBeVisible();
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'photos');
  });

  test('the manual default must be explicitly saved through the reporting wizard before property setup continues', async ({ page }) => {
    state.senderSaved = false;
    await goToComplianceStep(page);
    await expect(page.getByTestId('property-setup-compliance')).toContainText('Devi ancora confermare');
    await page.getByTestId('property-wizard-next').click();
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'compliance');
    await expect(page.getByTestId('wizard-finish-error')).toContainText('Configura e salva il mittente degli invii');
    expect(state.completeCalls).toBe(0);

    await page.getByTestId('property-setup-open-sender').click();
    await expect(page).toHaveURL(new RegExp(`returnPropertyId=${NEW_PROPERTY_ID}`));
    await expect(page.getByTestId('sender-option-Manual')).toBeChecked();
    await page.getByTestId('sender-next').click();
    await expect(page.getByTestId('sender-summary-step')).toBeVisible();
    const save = page.waitForRequest(request => request.method() === 'PUT' && request.url().endsWith(`/properties/${NEW_PROPERTY_ID}/sender`));
    await page.getByTestId('sender-finish').click();
    await save;
    await expect(page.getByTestId('sender-done-primary')).toHaveText('Continua con l’immobile');
    expect(state.senderSaved).toBe(true);
    await page.getByTestId('sender-done-primary').click();
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'compliance');
    await expect(page.getByTestId('property-setup-compliance')).toContainText('La scelta del mittente è salvata');
    await page.getByTestId('property-wizard-next').click();
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'finish');
    expect(state.completeCalls).toBe(0);
  });

  test('the last step is read from the server: with the CIN missing nothing activates, once it is saved the property can go live', async ({ page }) => {
    await goToLastStep(page);

    // The CIN is missing: it is listed, with its way to fix it; the switch waits and the button says «Finisci dopo».
    await expect(page.getByTestId('property-wizard-missing-list').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('property-wizard-fix-cin')).toBeVisible();
    await expect(page.getByTestId('property-wizard-show-on-site')).toBeDisabled();
    await expect(page.getByTestId('property-wizard-finish')).toHaveText(/Finisci dopo/);

    // Saved on its own, what is missing is read again: nothing blocks, the terms appear and the button changes.
    await page.locator('#property-wizard-cin').fill('IT-058091-C2-7G5FFZDZ');
    await page.getByTestId('property-wizard-cin-save').click();
    await expect(page.getByTestId('property-wizard-missing-none')).toBeVisible();
    await expect(page.getByTestId('property-wizard-show-on-site')).toBeEnabled();
    await expect(page.getByTestId('property-wizard-finish')).toHaveText(/Attiva l'immobile/);
    await expect(page.getByTestId('property-wizard-finish')).toBeDisabled();

    await page.getByTestId('property-wizard-tos').click();
    await page.getByTestId('property-wizard-finish').click();

    await expect(page.getByRole('heading', { name: /Casa Procedura.*è pronto/ })).toBeVisible();
    expect(state.completeCalls).toBe(1);
    await expect(page.getByTestId('wizard-done-primary')).toContainText('Apri il calendario');

    // «Aggiungi un altro immobile» is a new wizard: its first step is empty and its first «Continua» creates, it does not save over this one.
    await page.getByTestId('wizard-done-secondary').click();
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'base');
    await expect(page.getByLabel("Nome dell'immobile", { exact: true })).toHaveValue('');
    await expect(page).not.toHaveURL(/propertyId=/);
  });

  test('«Finisci dopo» leaves a property as a draft even if reporting was never configured', async ({ page }) => {
    state.senderSaved = false;
    await mockPropertiesApi(page, [buildCreatedProperty({
      name: 'Casa Procedura', comuneIstatCode: '058091', nightlyRate: 135, isActive: false,
    })]);
    await mockActivation(page, state);
    await page.goto(demoUrl(`/app/short-rent/properties/create?propertyId=${NEW_PROPERTY_ID}&step=finish`, 'short-stay'));
    await expect(page.getByTestId('property-wizard-finish')).toHaveText(/Finisci dopo/);

    await page.getByTestId('property-wizard-finish').click();

    await expect(page.getByRole('heading', { name: /Casa Procedura.*è salvato/ })).toBeVisible();
    expect(state.completeCalls).toBe(0);
    expect(state.senderSaved).toBe(false);
    // What is missing is listed with the button that goes where it is fixed.
    await page.getByTestId('property-wizard-done-fix-cin').click();
    await expect(page).toHaveURL(/step=finish/);
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'finish');
  });

  test('«Completa» reopens the wizard on the first thing that is missing, read from the server', async ({ page }) => {
    // The property exists already (the list, the drawer and the page of the property lead here): the rate is there, the CIN is not.
    await mockPropertiesApi(page, [buildCreatedProperty({ name: 'Casa Esistente', nightlyRate: 135 })]);
    await mockActivation(page, state);

    await page.goto(demoUrl(`/app/short-rent/properties/create?propertyId=${NEW_PROPERTY_ID}`, 'short-stay'));

    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'finish');
    await expect(page.getByTestId('property-wizard-missing-list').locator('li')).toHaveCount(1);
    await expect(page.getByTestId('property-wizard-summary-base')).toContainText('Casa Esistente');
  });

  test('a refusal of the server to activate shows its blockers and keeps the host on the last step', async ({ page }) => {
    state.completeAnswer = 'blocked';
    await goToLastStep(page);
    await page.locator('#property-wizard-cin').fill('IT-058091-C2-7G5FFZDZ');
    await page.getByTestId('property-wizard-cin-save').click();
    await expect(page.getByTestId('property-wizard-missing-none')).toBeVisible();

    await page.getByTestId('property-wizard-tos').click();
    await page.getByTestId('property-wizard-finish').click();

    await expect(page.getByTestId('property-wizard-refused')).toContainText('Manca il documento richiesto dalla tua regione.');
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'finish');
  });
});
