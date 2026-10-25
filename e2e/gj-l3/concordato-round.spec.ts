import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { mkdirSync } from 'node:fs';
import { accessToken, loadStack, loginAs, oracleFor, romeDay, type Oracle, type StackEnv } from './stack';
import {
  acceptPrivacyAndProceed,
  becomeLongTermLandlord,
  declareFromTheReceipt,
  downloadSample,
  expectNoSupplierName,
  grantGiftPractice,
  importTheSignedContract,
  leaseIdOf,
  log,
  movePracticeTo,
  newActor,
  readThePrivacyNotice,
  sendThePractice,
  shot,
  startConcordatoFromZero,
  uploadDocument,
  walkTheWizardToTheImport,
  type Actor,
  type ApiTrouble,
} from './cf-steps';

/**
 * The round of the guided contract of a canone concordato, from the UI, on the ephemeral stack (CF-L3): the pieces of the round were built
 * one by one (new contract, sheet, privacy, payment, simulated form, status, reading of the contract, import, registration) and this is the
 * only place where they run TOGETHER, against the real backend, the real database and the real frontend.
 *
 *   «Nuovo contratto» → «Canone concordato» → «Parto da zero» → the sheet → privacy → access → the form (the simulated one of the test
 *   environments) → «Invia la pratica» → back to the sheet (it shows the STATE, not the form) → the test panel moves the practice → the
 *   two sample documents the service delivers (CF-DOCS-REAL: the contract with its attestation and its calculation sheet in ONE scan, and the
 *   receipt of the Agenzia delle Entrate) → «Carica i documenti» (the one file) → it is read by OCR and its three sections are recognized →
 *   «Completa e importa il contratto» → the wizard asks only what the contract does not say → the contract is imported (same lease, now
 *   Signed) → the receipt uploaded as a file of its own → the registration declared with the receipt already uploaded, whose number and
 *   day were read and proposed for the person to check.
 *
 * ACCESS WITHOUT STRIPE. The real payment needs Stripe, and the CI has no Stripe test keys (the online-payment variant of the Golden Journey
 * is skipped for the same reason), so the round gets the access in the two ways the product has that need no payment:
 *   - `admin`: the person is a platform administrator (a `gj-admin-*` account of the mock IdP) who also set up an organization of its own: the
 *     access is `admin`, no page of payment is shown, the form opens from the sheet. This is how the product owner tries the round.
 *   - `gift`: the organization has the gift practice. FIXTURE: it is granted with the admin API (no screen exists for that act, see
 *     `grantGiftPractice`) and then USED from the page of payment, from the screen.
 * What is NOT covered: the payment with a real card, the webhook of Stripe that records it, and the real form of the service (the form is the
 * simulated page `/guided-form`; its look is not the supplier's).
 *
 * Three tests: the whole round with each of the two accesses, and (admin access) the way of a practice that the service closes without an
 * attestation: the sheet says why, offers «Riprendi la compilazione» with no privacy notice asked again, and the second form makes a second
 * practice.
 *
 * Every action goes through the UI; the API is only an oracle for the assertions (read-only, on behalf of the landlord), except the move of
 * a practice by the module (`status`, the call the test panel itself makes) and the gift of the fixture. On every key screen the visible text
 * must not name the supplier of the guided contract nor say «partner». Pictures of the screens are kept with the files of the test.
 */

const stack: StackEnv = loadStack();

/** A named step that also prints its start (the CI log shows where the long journey is). */
const step = <T>(title: string, body: () => Promise<T>): Promise<T> => {
  log(title);
  return test.step(title, body);
};

type Access = 'admin' | 'gift';

type AccessView = {
  hasAccess: boolean;
  source: string | null;
  giftConsumed: boolean;
  privacyAccepted?: boolean;
  linkOpenedAt?: string | null;
};
type StatusView = {
  practices: Array<{ practiceId: string; status: string; comuneDiffersFromLink: boolean; closeReason?: string | null }>;
  available?: boolean;
};
type RegistrationView = { status: string; channel: string; registrationCode?: string | null; registrationDate?: string | null; hasReceipt: boolean };
type LeaseView = {
  id: string;
  status: string;
  origin?: string;
  isConcordatoFacileSource?: boolean;
  contractType: string;
  hasSignedPdf: boolean;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  securityDeposit: number | null;
  stipulaDate: string | null;
  registration?: RegistrationView | null;
  events?: Array<{ eventType: string }>;
};
type DraftParty = { firstName?: string | null; lastName?: string | null; fiscalCode?: string | null };
type DraftView = {
  origin: string;
  /** What follows from the values: the end of the first period and its months (null while the start is not valid). */
  computed: { endDate: string | null; termMonths: number | null };
  values: {
    landlords: DraftParty[];
    tenants: DraftParty[];
    contractType?: string | null;
    monthlyRent?: number | null;
    securityDeposit?: number | null;
    startDate?: string | null;
    endDate?: string | null;
  };
  flow: { steps: Array<{ step: number; state: string; needs: Array<{ code: string }> }> };
};
type SectionView = { kind: string; firstPage: number; lastPage: number };
type ReadingView = {
  state: string;
  documents: Array<{
    id: string;
    status: string;
    error: string | null;
    /** CF-DOCS-REAL: the sections the reading recognized in the file, the attestation among them, and what it found worth a look. */
    sections?: SectionView[] | null;
    containsAttestation?: boolean;
    containsCalculationSheet?: boolean;
    warnings?: Array<{ code: string }> | null;
  }>;
  fields: Array<{ field: string; role: string | null; state: string; derived: boolean }>;
  contractDocumentId: string | null;
};
type DocumentView = { id: string; kind: string; fileName: string; sections?: SectionView[] | null; containsAttestation?: boolean };

/** The last day of a period of three years that starts on `start` (`YYYY-MM-01`): the first period of a 3+2 contract. */
function threeYearsFrom(start: string): string {
  const [year, month] = start.split('-').map(Number);
  return new Date(Date.UTC(year + 3, month - 1, 1) - 86_400_000).toISOString().slice(0, 10);
}

/** What the page shows when the round fails: where each person is, what is written on the screen, and a picture of it. */
async function describeFailure(actors: Actor[], trouble: ApiTrouble[]): Promise<void> {
  for (const { name, page } of actors) {
    try {
      const text = (await page.locator('body').innerText({ timeout: 5_000 })).replace(/\s+/g, ' ').slice(0, 1_500);
      log(`FAILED, ${name} is at ${page.url()} and reads: ${text}`);
      await page.screenshot({ path: test.info().outputPath(`failed-${name}.png`), fullPage: true, timeout: 10_000 });
    } catch (error) {
      log(`FAILED, ${name} could not be described: ${String(error)}`);
    }
  }
  log(`FAILED, answers of the API that were not a success: ${JSON.stringify(trouble.map((entry) => entry.line))}`);
}

/** `whole`: the round to the registration; `closed-then-again`: a practice closed without an attestation, and the form filled in again. */
type Scenario = 'whole' | 'closed-then-again';

async function runRound(browser: Browser, request: APIRequestContext, access: Access, scenario: Scenario): Promise<void> {
  const run = Date.now().toString(36);
  const trouble: ApiTrouble[] = [];
  const email = access === 'admin' ? `gj-admin-cf-${run}@example.test` : `cf-host-${run}@example.test`;
  const adminEmail = `gj-admin-cfgift-${run}@example.test`;
  const propertyName = `Casa Concordato ${run}`;
  const samples = test.info().outputPath('samples');
  mkdirSync(samples, { recursive: true });

  const host = await newActor(browser, 'host', trouble);
  const actors: Actor[] = [host];
  const page: Page = host.page;
  let hostApi!: Oracle;
  let leaseId = '';
  let practiceId = '';
  let controlToken = '';
  let pictures = 0;
  const t0 = Date.now();

  /** A picture of the screen, numbered in the order of the round. */
  const snap = (name: string) => shot(page, `${access}-${String((pictures += 1)).padStart(2, '0')}-${name}`);
  /** The types of the events of the lease, as the API lists them. */
  const eventsOfTheLease = async () => ((await hostApi.get<LeaseView>(`/leases/${leaseId}`)).events ?? []).map((event) => event.eventType);
  const count = (events: string[], type: string) => events.filter((candidate) => candidate === type).length;

  try {
    await step('The stack has the guided contract on: the flag, and the simulated module', async () => {
      const features = await request.get(`${stack.apiUrl}/public/features`);
      expect(features.status(), 'GET /public/features').toBe(200);
      expect(((await features.json()) as Record<string, unknown>).concordatoFacile, 'flag concordatoFacile of the stack').toBe(true);
      const module = await request.get(`${stack.apiUrl}/cf-simulator/link`);
      expect(module.status(), 'GET /cf-simulator/link (ConcordatoFacile__FormMode=Simulated)').toBe(200);
    });

    await step(
      access === 'admin'
        ? 'A platform administrator opens the onboarding, sets up a landlord organization and enters the first house'
        : 'A new landlord chooses the long term, accepts the consents and enters the first house',
      async () => {
        await loginAs(page, stack, email);
        // A platform administrator is not sent through the onboarding (it has no organization and does not need one): it opens it.
        if (access === 'admin') await page.goto('/onboarding');
        await becomeLongTermLandlord(page, propertyName);
        await snap('leases-with-the-guide');
        hostApi = oracleFor(request, stack, await accessToken(page));
        const me = await hostApi.get<{ orgId?: string | null; rentalType?: string }>('/users/me');
        expect(me.orgId, 'the landlord has an organization').toBeTruthy();
        expect(me.rentalType).toBe('LongTerm');

        if (access === 'gift') {
          // FIXTURE (declared in the header of this file): the gift practice the platform administrator grants to the organization.
          const admin = await newActor(browser, 'admin', trouble);
          try {
            await loginAs(admin.page, stack, adminEmail);
            await grantGiftPractice(request, stack, await accessToken(admin.page), me.orgId as string, run);
          } finally {
            await admin.context.close();
          }
        }
      },
    );

    await step('«Nuovo contratto» · «Canone concordato» · «Parto da zero» · the house: the draft is saved and the sheet opens', async () => {
      leaseId = await startConcordatoFromZero(page, propertyName, snap);
      log(`lease ${leaseId}`);
      const lease = await hostApi.get<LeaseView>(`/leases/${leaseId}`);
      expect(lease).toMatchObject({ id: leaseId, status: 'Draft', origin: 'Imported', isConcordatoFacileSource: true, contractType: 'Concordato' });
      await expect(page.getByTestId('lease-partner-upload')).toBeVisible();
      await expectNoSupplierName(page, 'the sheet of the draft');
      await snap('sheet-of-the-draft');
    });

    await step('The main button waits for the privacy notice; with it ticked the person goes on to the access', async () => {
      const notice = await readThePrivacyNotice(page);
      log(`the privacy notice of the sheet opens in another tab and shows: ${notice}`);
      expect.soft(notice, 'the notice linked from the sheet opens').not.toBe('error');
      await acceptPrivacyAndProceed(page, snap);
      if (access === 'gift') {
        // Without the access the sheet sends the person to the page of payment, where the gift practice stands in for the payment.
        await expect(page).toHaveURL(new RegExp(`/app/long-rent/leases/${leaseId}/guided-contract`), { timeout: 20_000 });
        await expect(page.getByTestId('cf-offer-price')).toContainText('119', { timeout: 20_000 });
        await expect(page.getByTestId('cf-offer-taxes')).toBeVisible();
        await expect(page.getByTestId('cf-pay-button')).toHaveCount(0);
        await expectNoSupplierName(page, 'the page of payment');
        await snap('page-of-payment');
        await page.getByTestId('cf-gift-button').click();
      }
      await page.waitForURL(/\/guided-form/, { timeout: 60_000 });
    });

    await step('The guided form opens in the same tab with a good link; the person sends the practice', async () => {
      await expect(page.getByTestId('guided-form-comune')).toContainText('Milano', { timeout: 30_000 });
      await expectNoSupplierName(page, 'the guided form');
      await snap('guided-form');
      const practice = await sendThePractice(page);
      log(`practice ${practice.practiceId}`);
      await expect(page.getByTestId('guided-form-linked')).toHaveText('La pratica è collegata al contratto.');
      await expectNoSupplierName(page, 'the guided form after the sending');
      await snap('guided-form-sent');

      practiceId = practice.practiceId;
      controlToken = practice.controlToken;

      const seen = await hostApi.get<AccessView>(`/leases/${leaseId}/concordatofacile/access`);
      expect(seen, `the access of this round comes from the ${access}`).toMatchObject({ hasAccess: true, source: access, privacyAccepted: true });
      expect(seen.linkOpenedAt, 'the form was opened').toBeTruthy();
      await expect
        .poll(async () => (await hostApi.get<StatusView>(`/leases/${leaseId}/concordatofacile/status`)).practices.map((p) => `${p.practiceId}:${p.status}`), {
          message: 'the status lists the practice just sent',
          timeout: 30_000,
          intervals: [500, 1_000, 2_000],
        })
        .toContain(`${practiceId}:Received`);

      // One gesture, one link: the dev server runs the effects twice, and the link is worth 15 minutes and is recorded at every call.
      const events = await eventsOfTheLease();
      expect.soft(count(events, 'ConcordatoFacilePrivacyAccepted'), 'the privacy notice was accepted once').toBe(1);
      expect.soft(count(events, 'ConcordatoFacileLinkGenerated'), 'the signed link was made once, by one click').toBe(1);
      if (access === 'gift') expect.soft(count(events, 'ConcordatoFacileGiftConsumed'), 'the gift practice was used once').toBe(1);
      else expect.soft(count(events, 'ConcordatoFacileAdminAccess'), 'the access of the administrator was recorded').toBeGreaterThanOrEqual(1);
    });

    if (scenario === 'closed-then-again') {
      await step('The service closes the practice without an attestation: the sheet says why and offers the form again; the second practice arrives', async () => {
        await movePracticeTo(page, 'ClosedWithoutAttestation', 'not_compliant');
        await page.getByTestId('guided-form-back').click();

        const closed = page.getByTestId('lease-partner-closed');
        await expect(closed).toBeVisible({ timeout: 30_000 });
        await expect(closed).toContainText(practiceId);
        await expect(closed).toContainText('non è attestabile');
        await expect(page.getByTestId('lease-partner-status'), 'a closed practice is not a practice under way').toHaveCount(0);
        await expect(page.getByTestId('lease-partner-privacy'), 'the privacy notice is accepted once for the contract').toHaveCount(0);
        await expectNoSupplierName(page, 'the sheet with a practice closed without an attestation');
        await snap('sheet-with-the-closed-practice');

        const again = page.getByTestId('lease-partner-proceed');
        await expect(again).toHaveText('Riprendi la compilazione');
        await expect(again).toBeEnabled();
        await again.click();
        await page.waitForURL(/\/guided-form/, { timeout: 60_000 });
        const first = practiceId;
        const second = await sendThePractice(page);
        log(`second practice ${second.practiceId}`);
        expect(second.practiceId, 'the second form makes a practice of its own').not.toBe(first);
        await snap('second-practice-sent');

        // A reload of the module does not lose the practice that was sent (the tab remembers it, with its control token).
        await page.reload();
        await expect(page.getByTestId('guided-form-practice-id')).toHaveText(second.practiceId, { timeout: 30_000 });

        await expect
          .poll(
            async () =>
              (await hostApi.get<StatusView>(`/leases/${leaseId}/concordatofacile/status`)).practices
                .map((p) => `${p.practiceId}:${p.status}:${p.closeReason ?? ''}`)
                .sort(),
            { message: 'the status lists the closed practice and the new one', timeout: 30_000, intervals: [500, 1_000, 2_000] },
          )
          .toEqual([`${first}:ClosedWithoutAttestation:not_compliant`, `${second.practiceId}:Received:`].sort());
        const events = await eventsOfTheLease();
        expect.soft(count(events, 'ConcordatoFacilePrivacyAccepted'), 'the privacy notice was not asked again').toBe(1);
        expect.soft(count(events, 'ConcordatoFacileLinkGenerated'), 'one link for each opening of the form').toBe(2);

        // «Indietro» of the browser, and not the link of the module: the sheet it comes back to shows the practice, not the button that opens the form.
        await page.goBack();
        await expect(page.getByTestId('lease-partner-status')).toContainText('Ricevuto', { timeout: 30_000 });
        await expect.soft(page.getByTestId('lease-partner-practice'), 'the sheet says the number of the new practice').toContainText(second.practiceId);
        await expect(page.getByTestId('lease-partner-closed')).toHaveCount(0);
        await expect(page.getByTestId('lease-partner-proceed')).toHaveCount(0);
        await expectNoSupplierName(page, 'the sheet with the second practice');
      });
      expect(trouble.filter((entry) => entry.status >= 500).map((entry) => entry.line), 'no API 5xx during the round').toEqual([]);
      return;
    }

    await step('«Torna al contratto»: the sheet shows the STATE of the practice, offers no way to open the form again, and follows the service', async () => {
      await page.getByTestId('guided-form-back').click();
      const status = page.getByTestId('lease-partner-status');
      await expect(status).toBeVisible({ timeout: 30_000 });
      await expect(status).toContainText('Ricevuto');
      await expect.soft(page.getByTestId('lease-partner-practice'), 'the sheet says the number of the practice').toContainText(practiceId, { timeout: 10_000 });
      await expect(page.getByTestId('lease-partner-proceed')).toHaveCount(0);
      await expect(page.getByTestId('lease-partner-upload')).toBeVisible();
      await expectNoSupplierName(page, 'the sheet with the status of the practice');
      await snap('sheet-with-the-status');

      // The service moves the practice on its own (here with the call the test panel makes): the sheet shows it, with no reload.
      const moved = await request.post(`${stack.apiUrl}/cf-simulator/practices/${practiceId}/status`, { data: { controlToken, status: 'InProgress' } });
      expect(moved.status(), 'the module moves the practice').toBe(200);
      await expect(status, 'the sheet follows the status of the practice by itself').toContainText('In lavorazione', { timeout: 30_000 });
    });

    const files = { contract: '', receipt: '' };
    await step('The test panel moves the practice to «Firmato ricevuto» and «Attestato»; the two sample documents are downloaded', async () => {
      await page.goBack();
      await expect(page.getByTestId('guided-form-panel')).toBeVisible({ timeout: 30_000 });
      await expectNoSupplierName(page, 'the test panel of the form');
      await snap('test-panel');
      for (const next of ['SignedReceived', 'Attested']) {
        await movePracticeTo(page, next);
        await expect
          .poll(async () => (await hostApi.get<StatusView>(`/leases/${leaseId}/concordatofacile/status`)).practices.find((p) => p.practiceId === practiceId)?.status, {
            message: `the status says ${next}`,
            timeout: 30_000,
            intervals: [500, 1_000, 2_000],
          })
          .toBe(next);
      }
      // One file for the contract and its attestation (a scan), and the receipt of the Agenzia as a file of its own.
      files.contract = await downloadSample(page, 'contract', samples);
      files.receipt = await downloadSample(page, 'receipt', samples);

      // The documents of the module answer only to the control token that the sending of the practice returned (the panel sends it for the
      // person): the right one gives the PDF, another one finds nothing, as if the practice did not exist.
      const documentUrl = `${stack.apiUrl}/cf-simulator/practices/${practiceId}/documents/contract`;
      const withToken = await request.get(documentUrl, { params: { controlToken } });
      expect.soft(withToken.status(), 'the sample contract with the control token of the practice').toBe(200);
      expect.soft(withToken.headers()['content-type'], 'the sample contract is a PDF').toContain('application/pdf');
      const withOtherToken = await request.get(documentUrl, { params: { controlToken: `${controlToken}x` } });
      expect.soft(withOtherToken.status(), 'the sample contract with another token').toBe(404);
    });

    await step('Back on the sheet (Attestato) the person uploads the contract with «Carica i documenti»', async () => {
      await page.getByTestId('guided-form-back').click();
      await expect(page.getByTestId('lease-partner-status')).toContainText('Attestato', { timeout: 30_000 });
      await expect(page.getByTestId('lease-partner-proceed')).toHaveCount(0);

      // The page of payment is not a place to go back to once the form is open: it sends the person to the sheet and makes no new link.
      await page.goto(`/app/long-rent/leases/${leaseId}/guided-contract`);
      await expect(page).toHaveURL(new RegExp(`/app/long-rent/leases/${leaseId}$`), { timeout: 20_000 });
      await expect(page.getByTestId('lease-partner-status')).toBeVisible({ timeout: 30_000 });
      expect.soft(count(await eventsOfTheLease(), 'ConcordatoFacileLinkGenerated'), 'the page of payment, seen again, made no new link').toBe(1);

      await page.getByTestId('lease-partner-upload').click();
      await expect(page).toHaveURL(/\/app\/long-rent\/documents\/upload\?leaseId=/, { timeout: 20_000 });
      // The address changes before the screen does: the screen is waited for before it is read.
      await expect(page.getByTestId('lease-documents-panel')).toBeVisible({ timeout: 30_000 });
      await expectNoSupplierName(page, 'the page that takes the documents in');
      await uploadDocument(page, files.contract, 'Contratto firmato e attestazione');
    });

    await step('The contract is read on the server; «Completa e importa il contratto» is offered', async () => {
      await expect(page.getByTestId('cf-import-panel')).toBeVisible({ timeout: 30_000 });
      await expectNoSupplierName(page, 'the panel of the contract that arrived');
      await expect
        .poll(async () => (await hostApi.get<ReadingView>(`/leases/${leaseId}/draft/reading`)).state, {
          message: 'the reading of the contract is done',
          timeout: 120_000,
          intervals: [1_000, 2_000, 3_000],
        })
        .toBe('Done');
      const documents = await hostApi.get<DocumentView[]>(`/leases/${leaseId}/documents`);
      const reading = await hostApi.get<ReadingView>(`/leases/${leaseId}/draft/reading`);
      expect.soft(documents.filter((d) => d.kind === 'Contract')).toHaveLength(1);
      expect.soft(reading.contractDocumentId, 'the import can use the contract already uploaded').toBe(documents.find((d) => d.kind === 'Contract')?.id);

      // CF-DOCS-REAL: the file is the one the real service delivers, a scan with the contract, its attestation and its calculation sheet. The
      // reading told them apart (by OCR), and the three agree with each other and with the property: nothing to check.
      const delivered = reading.documents.find((d) => d.id === reading.contractDocumentId);
      expect.soft(delivered?.sections?.map((s) => s.kind), 'the file is told apart in its three sections').toEqual(['contract', 'attestation', 'calculationSheet']);
      expect.soft(delivered?.containsAttestation, 'the attestation is in the file').toBe(true);
      expect.soft(delivered?.containsCalculationSheet, 'the calculation sheet is in the file').toBe(true);
      expect.soft(delivered?.warnings ?? [], 'the sections agree with each other and with the property').toEqual([]);
      expect.soft(documents.find((d) => d.kind === 'Contract')?.containsAttestation, 'the list of the documents says the attestation is in the file').toBe(true);
      await expect(page.getByTestId('lease-reading-recognized'), 'the page says what the file holds').toContainText('attestazione', { timeout: 30_000 });

      // The proof that the sample contract (a real PDF written by the simulator) was READ: what the draft holds now is what it says. Soft:
      // the round goes on, so that one run says everything that is wrong.
      const draft = await hostApi.get<DraftView>(`/leases/${leaseId}/draft`);
      const { values } = draft;
      const missing = draft.flow.steps.flatMap((s) => s.needs.map((need) => `${s.step}:${need.code}`));
      log(`the draft after the reading: ${JSON.stringify({ values, computed: draft.computed, fields: reading.fields })}`);
      log(`what the contract did not say (the wizard will ask): ${missing.join(', ') || 'nothing'}`);
      expect.soft(values.landlords[0], 'the landlord read from the contract').toMatchObject({ firstName: 'Mario', lastName: 'Rossi', fiscalCode: 'RSSMRA80A01H501U' });
      expect.soft(values.tenants[0], 'the tenant read from the contract').toMatchObject({ firstName: 'Giulia', lastName: 'Verdi', fiscalCode: 'VRDGLI85B42F205E' });
      expect.soft(values, 'type, rent and deposit read from the contract').toMatchObject({ contractType: 'Concordato', monthlyRent: 650, securityDeposit: 1300 });
      expect.soft(values.startDate?.slice(8, 10), 'the contract starts on the first day of a month').toBe('01');
      // A term that follows its type is not written in the draft (the draft computes it): the end is the one of three years from the start.
      expect.soft(draft.computed, 'the first period of a 3+2 lasts three years').toMatchObject({
        endDate: threeYearsFrom(values.startDate ?? ''),
        termMonths: 36,
      });

      await expect(page.getByTestId('cf-import-open')).toBeEnabled({ timeout: 30_000 });
      await snap('contract-arrived');
      await page.getByTestId('cf-import-open').click();
    });

    await step('The wizard asks only what the contract does not say, and goes on to the step of the signed contract', async () => {
      await expect(page).toHaveURL(/\/app\/long-rent\/leases\/[0-9a-f-]{36}\/edit\?step=\d/, { timeout: 30_000 });
      const seen = await walkTheWizardToTheImport(page);
      log(`the wizard went through the steps ${seen.join(', ')}`);
      await snap('step-of-the-signed-contract');
    });

    await step('The contract is imported: the same lease is now Signed, with its PDF', async () => {
      await importTheSignedContract(page);
      await snap('after-the-signature');
      const lease = await hostApi.get<LeaseView>(`/leases/${leaseId}`);
      log(`the lease after the import: ${JSON.stringify(lease)}`);
      expect.soft(lease, 'the contract imported').toMatchObject({
        id: leaseId,
        status: 'Signed',
        origin: 'Imported',
        isConcordatoFacileSource: true,
        contractType: 'Concordato',
        hasSignedPdf: true,
        monthlyRent: 650,
        securityDeposit: 1300,
      });
      expect.soft(lease.stipulaDate, 'the day of the signature').toBeTruthy();
      expect.soft(leaseIdOf(page), 'the lease is the same as the draft').toBe(leaseId);
    });

    await step('The receipt is uploaded from the module («Carica i dati in CasaZen») as a document of its own kind; the attestation is already in the contract', async () => {
      await page.goto('/guided-form');
      await expect(page.getByTestId('guided-form-submitted')).toBeVisible({ timeout: 30_000 });
      await page.getByTestId('guided-form-upload').click();
      // The link comes from outside the app: the page asks which contract it is before anything is uploaded.
      await expect(page.getByTestId('cf-documents-confirm')).toContainText(practiceId, { timeout: 30_000 });
      await expect(page.getByTestId('cf-documents-confirm')).toContainText(propertyName);
      await snap('which-contract');
      await page.getByTestId('cf-documents-confirm-button').click();
      await expect(page.getByTestId('lease-documents-panel')).toBeVisible({ timeout: 30_000 });
      await expectNoSupplierName(page, 'the page that takes the documents in, for the practice');
      await uploadDocument(page, files.receipt, 'Ricevuta di registrazione');
      await snap('documents-of-the-contract');
      const documents = await hostApi.get<DocumentView[]>(`/leases/${leaseId}/documents`);
      expect.soft(documents.map((d) => d.kind).sort(), 'the two documents of the practice: the contract with its attestation, and the receipt').toEqual(['Contract', 'Registration']);
    });

    await step('The registration made by the service is declared with the receipt already uploaded; the lease is Registered', async () => {
      await page.getByTestId('cf-documents-page').getByRole('link', { name: 'Apri il contratto' }).click();
      await expect(page).toHaveURL(new RegExp(`/app/long-rent/leases/${leaseId}`), { timeout: 20_000 });
      await expect(page.getByTestId('lease-sheet')).toBeVisible({ timeout: 30_000 });
      await expectNoSupplierName(page, 'the sheet of the signed contract');
      await snap('sheet-of-the-signed-contract');
      // The number and the day are not typed: the receipt of the Agenzia was read and they are proposed, marked «Letto dalla ricevuta — controlla».
      // The person checks them (the test reads what the window shows) and confirms: nothing is declared before.
      const declared = await declareFromTheReceipt(page, leaseId, () => snap('declaration-of-the-registration'));
      expect.soft(declared.code, 'the identification code the receipt of the Agenzia carries').toMatch(/^SIM\d{2}T\d{6}000AB$/);
      expect.soft(declared.day, 'the day the receipt says the contract was registered').toBe(romeDay(0));
      await expect
        .poll(async () => (await hostApi.get<LeaseView>(`/leases/${leaseId}`)).status, { message: 'the lease is Registered', timeout: 30_000 })
        .toBe('Registered');
      const lease = await hostApi.get<LeaseView>(`/leases/${leaseId}`);
      log(`the lease after the declaration: ${JSON.stringify(lease.registration)}`);
      expect.soft(lease.registration, 'the registration declared').toMatchObject({ status: 'Registered', channel: 'Manual', registrationCode: declared.code, hasReceipt: true });
      expect.soft(lease.registration?.registrationDate?.slice(0, 10), 'the day of the registration').toBe(declared.day);
    });

    await step('The history of the contract tells the round in words, with no name of the supplier', async () => {
      await page.getByRole('button', { name: 'Mostra tutta la cronologia' }).click();
      const timeline = page.getByTestId('lease-timeline');
      const told = [
        'Informativa privacy accettata',
        'Modulo guidato aperto',
        access === 'gift' ? 'Pratica omaggio usata' : 'Accesso amministratore al modulo guidato',
        'Contratto già firmato importato',
        'Contratto registrato (RLI)',
      ];
      for (const sentence of told) await expect.soft(timeline, `the history says «${sentence}»`).toContainText(sentence, { timeout: 10_000 });
      await expectNoSupplierName(page, 'the sheet of the registered contract, with its whole history');
      await snap('sheet-of-the-registered-contract');
    });

    expect(trouble.filter((entry) => entry.status >= 500).map((entry) => entry.line), 'no API 5xx during the whole round').toEqual([]);
    log(`the whole round (${access}) took ${Math.round((Date.now() - t0) / 1000)} s`);
  } catch (error) {
    await describeFailure(actors, trouble);
    throw error;
  } finally {
    await Promise.all(actors.map(({ context }) => context.close()));
  }
}

test.describe('Guided contract of a canone concordato, the whole round (CF-L3)', () => {
  // As the other tests of the project: the retries of the CI are the ones of `playwright.config.ts` (a retry starts again from a new
  // account, nothing is shared between the attempts).
  test.setTimeout(10 * 60_000);

  test('the whole round, with the access of a platform administrator', async ({ browser, request }) => {
    await runRound(browser, request, 'admin', 'whole');
  });

  test('the whole round, with the gift practice used from the page of payment', async ({ browser, request }) => {
    await runRound(browser, request, 'gift', 'whole');
  });

  test('a practice closed without an attestation: the sheet says why and the form is filled in again', async ({ browser, request }) => {
    await runRound(browser, request, 'admin', 'closed-then-again');
  });
});
