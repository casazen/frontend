import type { Page } from '@playwright/test';
import { test, expect } from './test';
import { demoUrl } from './helpers/demo-profile';
import { createPropertyWithWizard, mockPropertiesApi } from './helpers/properties-api-mock';
import { mockCurrentUserWithOrg, mockEntitlement } from './helpers/org-api-mock';
import { NEW_PROPERTY_ID, buildCreatedProperty } from './fixtures/properties.fixtures';
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
}

const step = (id: string, status: ComplianceStepStatus, blocker = true) => ({ id, label: id, status, blocker });

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

/** Creates the property with the first step, leaves the optional ones, gives the rate and arrives at the last step. */
async function goToLastStep(page: Page): Promise<void> {
  await page.goto(demoUrl('/app/short-rent/properties/create', 'short-stay'));
  const created = await createPropertyWithWizard(page, { name: 'Casa Procedura', address: 'Via Garibaldi 42', comune: 'Milano', postalCode: '20100' });
  expect(created.status()).toBe(201);
  for (const stepId of ['photos', 'amenities', 'rules']) {
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', stepId);
    await page.getByTestId('wizard-skip').click();
  }
  await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'prices');
  await page.getByLabel('Prezzo base per notte').fill('135');
  await page.getByTestId('property-wizard-next').click();
  await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'finish');
}

test.describe('Add property wizard', () => {
  let state: ServerState;

  test.beforeEach(async ({ page }) => {
    state = { cin: false, active: false, completeCalls: 0, completeAnswer: 'ok' };
    await mockPropertiesApi(page);
    await mockCurrentUserWithOrg(page);
    await mockEntitlement(page, { properties: 0 });
    await mockActivation(page, state);
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

    expect(state.completeCalls).toBe(1);
    await expect(page.getByRole('heading', { name: /Casa Procedura.*è pronto/ })).toBeVisible();
    await expect(page.getByTestId('wizard-done-primary')).toContainText('Apri il calendario');

    // «Aggiungi un altro immobile» is a new wizard: its first step is empty and its first «Continua» creates, it does not save over this one.
    await page.getByTestId('wizard-done-secondary').click();
    await expect(page.getByTestId('property-wizard')).toHaveAttribute('data-step', 'base');
    await expect(page.getByLabel("Nome dell'immobile", { exact: true })).toHaveValue('');
    await expect(page).not.toHaveURL(/propertyId=/);
  });

  test('«Finisci dopo» saves what there is and activates nothing: the property stays to be completed', async ({ page }) => {
    await goToLastStep(page);

    await page.getByTestId('property-wizard-finish').click();

    await expect(page.getByRole('heading', { name: /Casa Procedura.*è salvato/ })).toBeVisible();
    expect(state.completeCalls).toBe(0);
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
