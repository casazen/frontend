import { expect, type Page, type Route } from '@playwright/test';
import { buildCreatedProperty } from './fixtures/properties.fixtures';
import { demoUrl } from './helpers/demo-profile';
import { mockPropertiesApi } from './helpers/properties-api-mock';
import { test } from './test';

/**
 * The contract a host creates, from the first question to the saved sheet, for every type the wizard lists.
 * Demo API (the L2 stack). The Railway test API needs Auth0, which this environment does not have.
 */
const PROPERTY = buildCreatedProperty({
  id: 'prop-contract-e2e',
  name: 'Casa Trastevere',
  city: 'Roma',
  rentalMode: 'Long',
});

const LANDLORD_CODE = 'RSSMRA80A01H501U';
const TENANT_CODE = 'VRDGLI85B02F205A';

const RULES = {
  termMonths: { Libero: 48, Concordato: 36, Transitorio: 18 },
  renewalMonths: { Libero: 48, Concordato: 24 },
  noticeMonths: 6,
  registrationDays: 30,
  depositMaxRents: 3,
  availableTypes: ['Libero', 'Transitorio'],
  importedTypes: ['Libero', 'Concordato', 'Transitorio'],
  transitoryTermMonths: { min: 1, max: 18 },
  transitoryDocumentationAfterDays: 30,
  transitoryBandFromInhabitants: 10000,
};

type Origin = 'Created' | 'Imported';

interface Draft {
  id: string;
  version: number;
  origin: Origin;
  propertyId: string;
  maxStep: number;
  values: Record<string, unknown>;
}

interface ContractApi {
  drafts: Draft[];
  saves: { id: string; step: number; values: Record<string, unknown> }[];
  condoPosts: unknown[];
  documentDeletes: string[];
}

function flow() {
  return {
    steps: [1, 2, 3, 4, 5, 6, 7, 8].map((step) => ({
      step,
      state: step === 5 ? 'NotApplicable' : 'Todo',
      needs: [],
    })),
  };
}

function json(route: Route, body: unknown, status = 200) {
  return route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
}

async function mockContractApi(page: Page): Promise<ContractApi> {
  const api: ContractApi = { drafts: [], saves: [], condoPosts: [], documentDeletes: [] };
  const documents = new Map<string, { id: string; leaseId: string; fileName: string; kind: string; sizeBytes: number; uploadedAt: string }[]>();
  let sequence = 0;

  await page.route('**/api/public/features', (route) =>
    json(route, { concordatoFacile: true, otaPartnerApi: false }),
  );
  await page.route('**/api/long-rent/rules', (route) => json(route, RULES));
  await page.route('**/api/long-rent/landlord-defaults', (route) => json(route, {}));
  await page.route('**/api/long-rent/condominiums/manual-payments**', (route) => json(route, []));
  await page.route('**/api/properties/*/documents**', (route) => json(route, []));

  await page.route(/\/api\/leases(\/.*)?(\?.*)?$/, async (route) => {
    const request = route.request();
    const method = request.method();
    const path = new URL(request.url()).pathname.replace(/^.*\/api/, '');

    if (path === '/leases/drafts' && method === 'POST') {
      const body = request.postDataJSON() as { propertyId: string; origin?: Origin };
      sequence += 1;
      const draft: Draft = {
        id: `00000000-0000-4000-8000-${String(sequence).padStart(12, '0')}`,
        version: 1,
        origin: body.origin ?? 'Created',
        propertyId: body.propertyId,
        maxStep: 1,
        values: { propertyId: body.propertyId, landlords: [], tenants: [] },
      };
      api.drafts.push(draft);
      documents.set(draft.id, []);
      return json(route, { id: draft.id, version: draft.version, flow: flow() });
    }

    const condo = /\/leases\/([^/]+)\/draft\/condominium-expense$/.exec(path);
    if (condo && method === 'POST') {
      const body = (request.postDataJSON() ?? {}) as { manualAmount?: number; preventivo?: number };
      api.condoPosts.push(body);
      const amount = body.manualAmount ?? body.preventivo ?? 80;
      return json(route, {
        source: body.manualAmount !== undefined ? 'Manual' : 'Statements',
        installmentAmount: amount,
        lastInstallmentAmount: amount,
        installments: 12,
        annualAmount: Math.round(amount * 12 * 100) / 100,
        previousConsuntivo: null,
        preventivo: body.preventivo ?? null,
        settledAtConsuntivo: true,
        periodId: null,
        periodLabel: null,
      });
    }

    const draftPath = /\/leases\/([^/]+)\/draft$/.exec(path);
    if (draftPath && method === 'PATCH') {
      const draft = api.drafts.find((item) => item.id === draftPath[1]);
      if (!draft) return json(route, { status: 404, code: 'lease_not_found' }, 404);
      const body = request.postDataJSON() as { step: number; values: Record<string, unknown> };
      draft.version += 1;
      draft.maxStep = Math.max(draft.maxStep, body.step);
      draft.values = { ...draft.values, ...body.values };
      api.saves.push({ id: draft.id, step: body.step, values: body.values });
      const landlords = Array.isArray(body.values.landlords) ? body.values.landlords.length : 0;
      const tenants = Array.isArray(body.values.tenants) ? body.values.tenants.length : 0;
      return json(route, {
        version: draft.version,
        flow: flow(),
        landlordIds: Array.from({ length: landlords }, (_, index) => `landlord-${index + 1}`),
        tenantIds: Array.from({ length: tenants }, (_, index) => `tenant-${index + 1}`),
      });
    }
    if (draftPath && method === 'GET') {
      const draft = api.drafts.find((item) => item.id === draftPath[1]);
      if (!draft) return json(route, { status: 404, code: 'lease_not_found' }, 404);
      return json(route, {
        id: draft.id,
        version: draft.version,
        origin: draft.origin,
        wizardMaxStep: draft.maxStep,
        reviewConfirmedAt: null,
        sentForSignatureAt: null,
        updatedAt: '2026-11-08T10:00:00Z',
        values: draft.values,
        flow: flow(),
      });
    }

    const reading = /\/leases\/([^/]+)\/draft\/reading$/.exec(path);
    if (reading && method === 'GET') return json(route, { state: 'None', documents: [], fields: [] });

    const docs = /\/leases\/([^/]+)\/documents$/.exec(path);
    if (docs && method === 'GET') return json(route, documents.get(docs[1]) ?? []);
    if (docs && method === 'POST') {
      const fileName = /filename="([^"]+)"/.exec(request.postData() ?? '')?.[1] ?? 'documento.pdf';
      const document = {
        id: `doc-${docs[1]}`,
        leaseId: docs[1],
        fileName,
        kind: 'Contract',
        sizeBytes: 120,
        uploadedAt: '2026-11-08T10:00:00Z',
      };
      documents.set(docs[1], [document]);
      return json(route, document);
    }
    const remove = /\/leases\/([^/]+)\/documents\/([^/]+)$/.exec(path);
    if (remove && method === 'DELETE') {
      api.documentDeletes.push(remove[2]);
      documents.set(remove[1], []);
      return route.fulfill({ status: 204, body: '' });
    }

    const rent = /\/leases\/([^/]+)\/rent$/.exec(path);
    if (rent && method === 'GET') {
      return json(route, {
        leaseId: rent[1],
        monthlyRent: 95.5,
        canConfigure: false,
        onlinePaymentsAvailable: false,
        hasTenantEmail: true,
        schedule: null,
        installments: [],
        partialFinalPeriod: null,
      });
    }

    if (path === '/leases' && method === 'GET') {
      return json(
        route,
        api.drafts.map((draft) => ({
          id: draft.id,
          propertyId: draft.propertyId,
          property: { id: PROPERTY.id, name: PROPERTY.name, city: PROPERTY.city },
          status: 'Draft',
          fiscalRegime: 'CedolareSecca',
          contractType: draft.values.contractType ?? 'Libero',
          taxRegime: draft.values.taxRegime ?? 'CedolareSecca',
          startDate: draft.values.startDate ?? '2027-01-01',
          endDate: draft.values.endDate ?? '2031-01-01',
          monthlyRent: draft.values.monthlyRent ?? 95.5,
          stipulaDate: null,
          registrationDeadline: null,
          partyCount: 2,
          hasExtraEUTenant: false,
          tenantFirstName: 'Giulia',
          tenantLastName: 'Verdi',
          stage: 'Draft',
          createdAt: '2026-11-08T10:00:00Z',
          updatedAt: '2026-11-08T10:00:00Z',
        })),
      );
    }

    const one = /\/leases\/([^/]+)$/.exec(path);
    if (one && method === 'GET') {
      const draft = api.drafts.find((item) => item.id === one[1]);
      if (!draft) return json(route, { status: 404, code: 'lease_not_found' }, 404);
      return json(route, {
        id: draft.id,
        propertyId: draft.propertyId,
        property: { id: PROPERTY.id, name: PROPERTY.name, city: PROPERTY.city },
        status: 'Draft',
        fiscalRegime: 'CedolareSecca',
        contractType: draft.values.contractType ?? 'Libero',
        taxRegime: draft.values.taxRegime ?? 'CedolareSecca',
        startDate: draft.values.startDate ?? '2027-01-01',
        endDate: draft.values.endDate ?? '2031-01-01',
        monthlyRent: typeof draft.values.monthlyRent === 'number' ? draft.values.monthlyRent : 95.5,
        securityDeposit: draft.values.securityDeposit ?? 0,
        concordatoAssessment: null,
        stipulaDate: null,
        registrationDeadline: '2027-01-31',
        hasSignedPdf: false,
        hasExtraEUTenant: false,
        origin: draft.origin,
        parties: [
          { id: 'landlord-1', role: 'Landlord', firstName: 'Mario', lastName: 'Rossi', fiscalCodeMasked: 'RSS***********U', isExtraEU: false },
          { id: 'tenant-1', role: 'Tenant', firstName: 'Giulia', lastName: 'Verdi', fiscalCodeMasked: 'VRD***********A', isExtraEU: false },
        ],
        registration: null,
        events: [{ eventType: 'Created', occurredAt: '2026-11-08T10:00:00Z' }],
        createdAt: '2026-11-08T10:00:00Z',
        updatedAt: '2026-11-08T10:00:00Z',
      });
    }

    return json(route, { status: 404, code: 'not_mocked' }, 404);
  });

  return api;
}

async function choose(page: Page, testId: string) {
  const input = page.getByTestId(testId);
  await page.locator('label', { has: input }).click();
  await expect(input).toBeChecked();
}

async function fillParties(page: Page) {
  await page.locator('#lw-landlords-0-firstName').fill('Mario');
  await page.locator('#lw-landlords-0-lastName').fill('Rossi');
  await page.locator('#lw-landlords-0-fiscalCode').fill(LANDLORD_CODE);
  await page.locator('#lw-landlords-0-citizenship').selectOption('IT');
  await page.locator('#lw-landlords-0-residence').fill('Via Torino 20, Roma');
  await page.locator('#lw-tenants-0-firstName').fill('Giulia');
  await page.locator('#lw-tenants-0-lastName').fill('Verdi');
  await page.locator('#lw-tenants-0-fiscalCode').fill(TENANT_CODE);
  await page.locator('#lw-tenants-0-citizenship').selectOption('IT');
  await page.locator('#lw-tenants-0-residence').fill('Via Nazionale 4, Roma');
}

async function openSheet(page: Page, leaseId: string) {
  if (page.url().includes('step=7')) {
    // Use the wizard's return link; Contracts is no longer a sidebar destination.
    await page.getByRole('link', { name: 'Torna a Contratti', exact: true }).click();
  } else {
    await page.getByTestId('lease-wizard-save').click();
  }
  await expect(page).toHaveURL(/\/app\/long-rent\/leases\/?$/, { timeout: 20_000 });
  await page.locator(`a[href$="/leases/${leaseId}"]`).first().click();
  await expect(page.getByTestId('lease-sheet')).toBeVisible({ timeout: 20_000 });
}

test.describe('Contract creation, every type', () => {
  test.setTimeout(180_000);

  test('libero, transitorio and concordato reach a saved contract; studenti stays closed', async ({ page }) => {
    await mockPropertiesApi(page, [PROPERTY]);
    const api = await mockContractApi(page);
    const condoRequests: string[] = [];
    page.on('request', (request) => {
      if (request.method() === 'POST' && request.url().includes('/draft/condominium-expense')) {
        condoRequests.push(request.postData() ?? '');
      }
    });

    await page.goto(demoUrl('/app/long-rent/leases/new', 'long-term'));
    await expect(page.getByTestId('lease-kind-choice')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByTestId('lease-kind-libero')).toBeVisible();
    await expect(page.getByTestId('lease-kind-transitorio')).toBeVisible();
    await expect(page.getByTestId('lease-kind-concordato')).toBeVisible();

    await choose(page, 'lease-kind-libero');
    await page.getByTestId('lease-kind-continue').click();
    await choose(page, 'lease-way-casazen');
    await page.getByTestId('lease-way-continue').click();
    await page.getByTestId('lease-property-select').selectOption(PROPERTY.id);
    await page.getByTestId('lease-wizard-next').click();
    await expect(page).toHaveURL(/\/edit\?step=2/, { timeout: 20_000 });
    expect(api.drafts.filter((draft) => draft.values.contractType === 'Libero' || draft.origin === 'Created')).toHaveLength(1);

    await fillParties(page);
    await page.getByTestId('lease-wizard-next').click();
    await expect(page).toHaveURL(/step=3/);
    await expect(page.getByTestId('lease-type-chosen')).toContainText('Canone libero');
    await page.locator('#lw-monthlyRent').fill('95,50');
    await page.locator('#lw-securityDeposit').fill('95,50');
    await choose(page, 'lease-regime-CedolareSecca');

    const expenses = page.getByTestId('lease-condominium-expenses');
    await expect(expenses).toBeVisible();
    await expect.poll(() => condoRequests.length).toBe(0);
    await expenses.getByLabel('Importo a mano (€ al mese)').fill('95,50');
    await expenses.getByTestId('lease-condominium-manual').click();
    await expect(expenses.getByTestId('lease-condominium-saved')).toContainText('95,50');
    expect(condoRequests.some((body) => body === '{}' || body === '')).toBe(false);
    expect(api.condoPosts).toEqual([{ cadence: 'Monthly', manualAmount: 95.5 }]);

    await page.getByTestId('lease-wizard-next').click();
    await expect(page).toHaveURL(/step=4/);
    await expect(page.locator('#lw-startDate')).toBeVisible();
    await page.getByTestId('lease-wizard-back').click();
    await expect(page).toHaveURL(/step=3/);
    await expect(expenses.getByTestId('lease-condominium-saved')).toContainText('95,50');
    await expect(expenses).toContainText('Si conguaglia al consuntivo');
    expect(api.condoPosts).toHaveLength(1);
    await expect(page.locator('#lw-monthlyRent')).toHaveValue('95,50');

    await page.getByTestId('lease-wizard-next').click();
    await page.locator('#lw-startDate').fill('2027-01-01');
    await page.getByTestId('lease-wizard-next').click();
    await page.getByTestId('lease-wizard-back').click();
    const liberoRentSaves = () => api.saves.filter((save) => save.step === 3 && save.values.monthlyRent === 95.5);
    await expect.poll(() => liberoRentSaves().length).toBeGreaterThan(0);
    for (const save of liberoRentSaves()) {
      expect(save.values.contractType).toBe('Libero');
      expect(save.values.securityDeposit).toBe(95.5);
    }

    const liberoId = api.drafts[0].id;
    await openSheet(page, liberoId);
    await expect(page.getByTestId('lease-sheet')).toContainText('Canone libero');
    await expect(page.getByTestId('lease-sheet')).toContainText('95,50');

    await page.getByTestId('lease-tab-pagamenti').click();
    await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);
    await page.getByRole('link', { name: 'Apri le spese condominiali' }).click();
    await expect(page).toHaveURL(/\/app\/long-rent\/payments$/);
    await expect(page.getByTestId('long-rent-payments')).toContainText('home banking');
    await expect(page.getByTestId('condominium-bank-link')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Collega il conto' })).toHaveCount(0);
    await page.getByTestId('long-rent-payments-contracts').click();
    await expect(page).toHaveURL(/\/app\/long-rent\/leases/);

    await page.goto(demoUrl(`/app/long-rent/leases/${liberoId}?tab=documenti`, 'long-term'));
    await page.getByRole('link', { name: 'Carica i documenti in CasaZen' }).click();
    await expect(page.getByTestId('lease-documents-panel')).toBeVisible();
    await page.locator('input[type="file"]').first().setInputFiles({
      name: 'prova-contratto.pdf',
      mimeType: 'application/pdf',
      buffer: Buffer.from('%PDF-1.1\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF'),
    });
    await page.getByRole('button', { name: 'Carica documento' }).click();
    await expect(page.getByText('prova-contratto.pdf')).toBeVisible({ timeout: 20_000 });
    await page.getByRole('button', { name: /Elimina / }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog).toContainText('Eliminare questo documento?');
    await dialog.getByRole('button', { name: 'Annulla' }).click();
    await expect(page.getByText('prova-contratto.pdf')).toBeVisible();
    await page.getByRole('button', { name: /Elimina / }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Elimina' }).click();
    await expect(page.getByText('prova-contratto.pdf')).toHaveCount(0);
    expect(api.documentDeletes).toHaveLength(1);

    await page.goto(demoUrl('/app/long-rent/leases/new', 'long-term'));
    await choose(page, 'lease-kind-transitorio');
    await page.getByTestId('lease-kind-continue').click();
    await choose(page, 'lease-way-casazen');
    await page.getByTestId('lease-way-continue').click();
    await page.getByTestId('lease-property-select').selectOption(PROPERTY.id);
    await page.getByTestId('lease-wizard-next').dblclick();
    await expect(page).toHaveURL(/\/edit\?step=2/);
    expect(api.drafts.filter((draft) => draft.origin === 'Created' && draft.values.contractType === 'Transitorio')).toHaveLength(1);

    await fillParties(page);
    await page.getByTestId('lease-wizard-next').click();
    await expect(page.getByTestId('lease-type-chosen')).toContainText('Transitorio');
    await choose(page, 'lease-transitory-party-Tenant');
    await page.locator('#lw-transitoryNeed').fill('Lavoro a tempo determinato a Roma');
    await page.locator('#lw-monthlyRent').fill('1.234,50');
    await page.locator('#lw-securityDeposit').fill('0');
    await choose(page, 'lease-regime-CedolareSecca');
    await page.getByTestId('lease-wizard-next').click();
    await page.locator('#lw-startDate').fill('2027-03-01');
    await page.locator('#lw-endDate').fill('2027-08-31');
    await page.locator('#lw-transitoryDocumentation').fill('Lettera di assunzione');
    await page.getByTestId('lease-wizard-next').click();
    await page.getByTestId('lease-wizard-back').click();
    await page.getByTestId('lease-wizard-next').click();

    const transitory = api.drafts.find((draft) => draft.values.contractType === 'Transitorio');
    expect(transitory).toBeTruthy();
    const transitorySaves = api.saves.filter((save) => save.id === transitory?.id && save.step === 3 && save.values.transitoryNeed);
    expect(transitorySaves.length).toBeGreaterThan(0);
    for (const save of transitorySaves) {
      expect(save.values.contractType).toBe('Transitorio');
      expect(save.values.transitoryParty).toBe('Tenant');
      expect(save.values.transitoryNeed).toBe('Lavoro a tempo determinato a Roma');
      expect(save.values.monthlyRent).toBe(1234.5);
    }
    const dateSaves = api.saves.filter((save) => save.id === transitory?.id && save.step === 4 && save.values.transitoryDocumentation);
    expect(dateSaves.length).toBeGreaterThan(0);
    for (const save of dateSaves) {
      expect(save.values.endDate).toBe('2027-08-31');
      expect(save.values.transitoryDocumentation).toBe('Lettera di assunzione');
    }
    await openSheet(page, transitory!.id);
    await expect(page.getByTestId('lease-sheet')).toContainText('Transitorio');

    await page.goto(demoUrl('/app/long-rent/leases/new?tipo=concordato&come=documenti', 'long-term'));
    await page.getByTestId('lease-documents-manual').click();
    await page.getByTestId('lease-property-select').selectOption(PROPERTY.id);
    await page.getByTestId('lease-wizard-next').click();
    await expect(page).toHaveURL(/\/edit\?step=2/);
    const concordato = api.drafts.find((draft) => draft.values.contractType === 'Concordato');
    expect(concordato?.origin).toBe('Imported');

    await fillParties(page);
    await page.getByTestId('lease-wizard-next').click();
    await expect(page.getByTestId('lease-type-Concordato')).toBeChecked();
    const students = page.getByTestId('lease-type-Studenti');
    await expect(students).toBeDisabled();
    await expect(page.locator('label', { has: students })).toContainText('Non ancora disponibile');
    await page.locator('label', { has: students }).click({ force: true });
    await expect(page.getByTestId('lease-type-Concordato')).toBeChecked();
    await choose(page, 'lease-type-Concordato');
    await page.locator('#lw-monthlyRent').fill('95,50');
    await page.locator('#lw-securityDeposit').fill('0');
    await choose(page, 'lease-regime-CedolareSecca');
    await page.getByTestId('lease-wizard-next').click();
    await expect(page).toHaveURL(/step=4/);
    await page.getByTestId('lease-wizard-back').click();
    await expect(page).toHaveURL(/step=3/);
    await choose(page, 'lease-type-Concordato');
    await page.getByTestId('lease-wizard-next').click();
    await page.locator('#lw-startDate').fill('2027-02-01');
    await page.locator('#lw-endDate').fill('2030-01-31');
    await page.getByTestId('lease-wizard-next').click();
    await expect(page).toHaveURL(/step=7/);

    const concordatoSaves = api.saves.filter((save) => save.id === concordato?.id && save.step === 3 && save.values.monthlyRent === 95.5);
    expect(concordatoSaves.length).toBeGreaterThan(0);
    for (const save of concordatoSaves) {
      expect(save.values.contractType).toBe('Concordato');
      expect(save.values.contractType).not.toBe('Studenti');
    }
    expect(api.saves.some((save) => save.values.contractType === 'Studenti')).toBe(false);
    await openSheet(page, concordato!.id);
    await expect(page.getByTestId('lease-sheet')).toContainText('Canone concordato');
    expect(api.condoPosts.every((body) => JSON.stringify(body) !== '{}')).toBe(true);
  });
});
