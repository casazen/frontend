import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { I18nextProvider } from 'react-i18next';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import i18n from '@/i18n/config';
import { onboardingApi } from '@/api/onboarding.api';
import { ownerOnboardingApi } from '@/api/owner-onboarding.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { FeatureFlagsContext } from '@/contexts/feature-flags-context';
import { getVisibleNavEntries, ROUTE_MANIFEST } from '@/config/route-manifest';
import { OWNER_STEP_PATH, ownerManualCsv } from '@/lib/owner-onboarding';
import { ownerOnboardingKeys } from '@/queries/use-owner-onboarding';
import type {
  OwnerImportResult,
  OwnerInvitationPreview,
  OwnerInvitationStatus,
  OwnerPortalState,
  OwnerReadinessOwner,
  OwnerReadinessReport,
} from '@/types/owner-onboarding.types';
import { expectNoAxeViolations } from '@/test/axe';
import { OnboardingPlanPage } from '../onboarding-plan-page';
import { OwnerOnboardingPage } from '../owner-onboarding-page';
import { COLLABORATOR, OWNER, plan, problemError } from './onboarding-fixtures';

vi.mock('@/api/onboarding.api', () => ({
  onboardingApi: { getPlan: vi.fn(), deferPart: vi.fn(), exitPart: vi.fn(), resumePart: vi.fn(), getStatus: vi.fn(), getPath: vi.fn() },
}));
vi.mock('@/api/owner-onboarding.api', () => ({
  ownerOnboardingApi: {
    getReadiness: vi.fn(),
    importOwners: vi.fn(),
    listInvitations: vi.fn(),
    previewInvitations: vi.fn(),
    confirmInvitations: vi.fn(),
    resendInvitation: vi.fn(),
    revokeInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
  },
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, description, action }: { title: string; description?: string; action?: React.ReactNode }) =>
    createElement('div', null, createElement('h1', null, title), description ? createElement('p', { 'data-testid': 'page-description' }, description) : null, action),
}));

const workspace = vi.hoisted(() => ({
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  getDefaultRoute: (contextKey: string) => `/app/${contextKey}`,
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => workspace }));

/** The plan of the org (`isAgency` of its entitlement): the server's agency policies ask for it, so nothing is read for another plan. */
const org = vi.hoisted(() => ({ isAgency: true, isLoading: false }));
vi.mock('@/hooks/useOrg', () => ({ useOrg: () => org }));
vi.mock('@/config/support.config', () => ({ supportConfig: { email: 'aiuto@casazen.test' } }));

const PROPERTY_ID = '11111111-1111-4111-8111-111111111111';
const OWNER_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const OWNER_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
const OWNER_C = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';

function owner(ownerId: string, displayName: string, overrides: Partial<OwnerReadinessOwner> = {}): OwnerReadinessOwner {
  return {
    ownerId,
    externalKey: null,
    displayName,
    entityKind: 'person',
    ready: { registry: true, ownership: true, mandate: true, fiscalProfile: true, payment: true, portal: true },
    accountingReady: true,
    portalState: 'ready',
    reasons: [],
    ...overrides,
  };
}

/** A readiness with one property whose shares are wrong and two owners, one of them missing the IBAN: the agency has work to do. */
function readiness(overrides: Partial<OwnerReadinessReport> = {}): OwnerReadinessReport {
  const count = (toComplete: number, total = 2) => ({ ready: total - toComplete, toComplete });
  return {
    asOf: '2026-11-13',
    summary: {
      owners: 2,
      properties: 3,
      registry: count(0),
      ownership: count(0),
      mandate: count(0),
      fiscalProfile: count(0),
      payment: count(1),
      portal: count(0),
      accountingReadyOwners: 1,
      propertiesWithoutOwner: 0,
      propertiesToComplete: 1,
      financialReady: false,
    },
    owners: [
      owner(OWNER_A, 'Marta Esposito'),
      owner(OWNER_B, 'Luca Bianchi', {
        accountingReady: false,
        ready: { registry: true, ownership: true, mandate: true, fiscalProfile: true, payment: false, portal: true },
        reasons: [{ dimension: 'payment', code: 'iban_missing', field: 'iban', propertyId: null }],
      }),
    ],
    properties: [
      {
        propertyId: PROPERTY_ID,
        name: 'Casa del Faro',
        ownershipReady: false,
        reasons: [],
        issues: [{ kind: 'shortfall', from: '2026-01-01', to: null, totalPercent: 80, ownerId: null }],
      },
    ],
    truncated: false,
    ...overrides,
  };
}

const ready100 = (): OwnerReadinessReport =>
  readiness({
    summary: { ...readiness().summary, payment: { ready: 2, toComplete: 0 }, accountingReadyOwners: 2, propertiesToComplete: 0, financialReady: true },
    owners: [owner(OWNER_A, 'Marta Esposito'), owner(OWNER_B, 'Luca Bianchi')],
    properties: [],
  });

function invitation(ownerId: string, displayName: string, state: OwnerPortalState, overrides: Partial<OwnerInvitationStatus> = {}): OwnerInvitationStatus {
  return { ownerId, displayName, state, invitationId: null, sentAt: null, expiresAt: null, acceptedAt: null, closedAt: null, ...overrides };
}

const INVITATIONS: OwnerInvitationStatus[] = [
  invitation(OWNER_A, 'Marta Esposito', 'ready'),
  invitation(OWNER_B, 'Luca Bianchi', 'invited', { invitationId: 'inv-b', sentAt: '2026-11-10T09:00:00Z', expiresAt: '2026-11-17T09:00:00Z' }),
  invitation(OWNER_C, 'Anna Neri', 'notReady'),
];

function previewOf(): OwnerInvitationPreview {
  return {
    fingerprint: 'fp-1',
    recipients: [{ ownerId: OWNER_A, displayName: 'Marta Esposito', email: 'marta@example.com', portalState: 'ready' }],
    exclusions: [{ ownerId: OWNER_C, displayName: 'Anna Neri', reasons: ['email_missing'] }],
    quota: { limit: 100, used: 3, remaining: 97 },
  };
}

function importResult(dryRun: boolean): OwnerImportResult {
  return {
    dryRun,
    fingerprint: 'file-fp',
    summary: { rows: 2, valid: 1, invalid: 1, applied: dryRun ? 0 : 1, ownersToCreate: 1, ownersMatched: 0, ownershipsToCreate: 1, periodsToUpdate: 0 },
    unknownColumns: ['colonnaStrana'],
    rows: [
      { rowNumber: 2, propertyRef: 'IT-CIN-1', propertyId: PROPERTY_ID, ownerKey: 'P-1', ownerId: null, matchedBy: null, status: 'ok', errors: [], ownerAction: 'create_owner', ownershipAction: 'create_ownership', candidates: [], applied: !dryRun },
      {
        rowNumber: 3,
        propertyRef: 'IT-CIN-2',
        propertyId: null,
        ownerKey: null,
        ownerId: null,
        matchedBy: null,
        status: 'property_not_found',
        errors: [{ column: 'cinCode', code: 'property_not_found' }],
        ownerAction: null,
        ownershipAction: null,
        candidates: [],
        applied: false,
      },
    ],
    propertyIssues: [],
  };
}

function Arrived() {
  return <p data-testid="arrived">{useLocation().pathname}</p>;
}

function renderAt(path: string, element: ReactNode, { agencyTier = true, client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } }) } = {}) {
  const flags = { ...DEFAULT_FEATURE_FLAGS, octorateOnboarding: true, agencyTier };
  const view = render(
    <I18nextProvider i18n={i18n}>
      <FeatureFlagsContext.Provider value={{ flags, isLoading: false }}>
        <QueryClientProvider client={client}>
          <MemoryRouter initialEntries={[path]}>
            <Routes>
              <Route path={path} element={element} />
              <Route path="*" element={<Arrived />} />
            </Routes>
          </MemoryRouter>
        </QueryClientProvider>
      </FeatureFlagsContext.Provider>
    </I18nextProvider>,
  );
  return { ...view, client };
}

const renderPage = (options?: Parameters<typeof renderAt>[2]) => renderAt(OWNER_STEP_PATH, <OwnerOnboardingPage />, options);

/** The invitation methods that SEND or change something: the import must never reach any of them. */
const INVITATION_WRITES = ['previewInvitations', 'confirmInvitations', 'resendInvitation', 'revokeInvitation', 'acceptInvitation'] as const;

describe('OwnerOnboardingPage, the owner step of «Inizia con CasaZen» (NF-109)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    workspace.contexts = OWNER;
    org.isAgency = true;
    org.isLoading = false;
    vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(plan());
    for (const method of Object.keys(ownerOnboardingApi) as (keyof typeof ownerOnboardingApi)[]) vi.mocked(ownerOnboardingApi[method]).mockReset();
    vi.mocked(ownerOnboardingApi.getReadiness).mockResolvedValue(readiness());
    vi.mocked(ownerOnboardingApi.listInvitations).mockResolvedValue(INVITATIONS);
  });

  afterEach(() => {
    cleanup();
  });

  describe('who sees it', () => {
    it('OwnerOnboarding_AgencyFlagOff_LeadsBackToThePlanAndReadsNothing', async () => {
      renderPage({ agencyTier: false });

      expect(await screen.findByTestId('arrived')).toHaveTextContent('/app/short-rent/onboarding');
      expect(ownerOnboardingApi.getReadiness).not.toHaveBeenCalled();
      expect(ownerOnboardingApi.listInvitations).not.toHaveBeenCalled();
      expect(onboardingApi.getPlan).not.toHaveBeenCalled();
    });

    it('OwnerOnboarding_OrgNotOnTheAgencyPlan_LeadsBackToThePlanAndReadsNothing', async () => {
      org.isAgency = false;
      renderPage();

      expect(await screen.findByTestId('arrived')).toHaveTextContent('/app/short-rent/onboarding');
      expect(ownerOnboardingApi.getReadiness).not.toHaveBeenCalled();
      expect(ownerOnboardingApi.listInvitations).not.toHaveBeenCalled();
    });

    it('OwnerOnboarding_PlanOfTheOrgNotKnownYet_WaitsAndReadsNothing', async () => {
      org.isAgency = false;
      org.isLoading = true;
      renderPage();

      expect(await screen.findByTestId('owner-onboarding-loading')).toBeInTheDocument();
      expect(screen.queryByTestId('arrived')).not.toBeInTheDocument();
      expect(ownerOnboardingApi.getReadiness).not.toHaveBeenCalled();
    });

    it('OwnerOnboarding_NotTheAdministrator_SaysWhoManagesItAndSendsNoRequest', async () => {
      workspace.contexts = COLLABORATOR;
      renderPage();

      expect(await screen.findByTestId('owner-onboarding-admin-only')).toHaveTextContent(i18n.t('ownerOnboarding.adminOnly'));
      expect(screen.queryByTestId('owner-phases')).not.toBeInTheDocument();
      expect(ownerOnboardingApi.getReadiness).not.toHaveBeenCalled();
      expect(ownerOnboardingApi.listInvitations).not.toHaveBeenCalled();
    });
  });

  describe('what it shows', () => {
    it('OwnerOnboarding_Readiness_ShowsTheFourPhasesInOrderAndTheFirstToCompleteIsTheHighlightedBlock', async () => {
      renderPage();

      const list = await screen.findByTestId('owner-phases');
      expect(Array.from(list.children).map((item) => (item as HTMLElement).dataset.testid)).toEqual(['owner-phase-owners', 'owner-phase-shares', 'owner-phase-accounting', 'owner-phase-portal']);
      expect(within(list).getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent)).toEqual([
        `1. ${i18n.t('ownerOnboarding.phases.owners.title')}`,
        `2. ${i18n.t('ownerOnboarding.phases.shares.title')}`,
        `3. ${i18n.t('ownerOnboarding.phases.accounting.title')}`,
        `4. ${i18n.t('ownerOnboarding.phases.portal.title')}`,
      ]);
      // The registry is complete, so the shares (a property at 80%) are the one block to do now: one highlighted block.
      expect(screen.getByTestId('owner-phase-owners')).toHaveAttribute('data-state', 'done');
      expect(screen.getByTestId('owner-phase-shares')).toHaveAttribute('data-highlighted', 'true');
      expect(list.querySelectorAll('[data-highlighted="true"]')).toHaveLength(1);
      // The states are in words as well as in color.
      expect(within(screen.getByTestId('owner-phase-shares')).getByTestId('owner-phase-shares-state')).toHaveTextContent(i18n.t('ownerOnboarding.states.toComplete'));
    });

    it('OwnerOnboarding_MissingOwnerData_KeepsTheStatementsToCompleteWithTheExactFactsAndNeverBlocksTheProperties', async () => {
      vi.mocked(onboardingApi.getPlan).mockResolvedValue({ ...plan(), activated: true });
      renderPage();

      const operational = await screen.findByTestId('owner-outcome-operational');
      const accounting = screen.getByTestId('owner-outcome-accounting');
      // Two outcomes, told apart: the properties work, the statements for the owners are still to complete.
      await waitFor(() => expect(within(operational).getByTestId('owner-outcome-operational-state')).toHaveTextContent(i18n.t('ownerOnboarding.ready')));
      expect(within(accounting).getByTestId('owner-outcome-accounting-state')).toHaveTextContent(i18n.t('ownerOnboarding.toComplete'));
      // The exact property and the exact field.
      expect(within(accounting).getByText('Casa del Faro')).toBeInTheDocument();
      expect(within(accounting).getByText(/Luca Bianchi/)).toHaveTextContent(i18n.t('ownerOnboarding.reasons.ibanMissing'));
      expect(within(accounting).getByText(/Luca Bianchi/)).toHaveTextContent(i18n.t('ownerOnboarding.fields.iban'));
      expect(within(accounting).getByTestId('owner-outcome-missing')).toHaveTextContent(i18n.t('ownerOnboarding.outcomes.accounting.notBlocking'));
    });

    it('OwnerOnboarding_AccountingTable_LinksEachOwnerToWhereItIsCompletedByHand', async () => {
      renderPage();

      const table = await screen.findByTestId('owner-accounting-table');
      const link = within(table).getByTestId('owner-accounting-table-complete');
      expect(link).toHaveAttribute('href', `/app/account/owners/${OWNER_B}/financial`);
      expect(within(table).queryByText('Marta Esposito')).not.toBeInTheDocument();
    });

    it('OwnerOnboarding_EveryoneReady_SaysSoOncePerPhaseAndMarksTheStatementsReady', async () => {
      vi.mocked(ownerOnboardingApi.getReadiness).mockResolvedValue(ready100());
      renderPage();

      expect(await screen.findByTestId('owner-accounting-table-all-ready')).toHaveTextContent(i18n.t('ownerOnboarding.table.accountingAllReady'));
      expect(screen.getByTestId('owner-outcome-accounting-state')).toHaveTextContent(i18n.t('ownerOnboarding.ready'));
      expect(screen.queryByTestId('owner-outcome-missing')).not.toBeInTheDocument();
    });

    it('OwnerOnboarding_Page_HasNoAccessibilityViolation', async () => {
      const { container } = renderPage();
      await screen.findByTestId('owner-phases');
      await screen.findByTestId('owner-invitations-list');

      await expectNoAxeViolations(container);
    });
  });

  describe('when it cannot read', () => {
    it('OwnerOnboarding_ReadFails_IsToldWithARetryAndNeverSaysAllInOrder', async () => {
      vi.mocked(ownerOnboardingApi.getReadiness).mockRejectedValue(problemError(500, { code: 'server_error' }));
      renderPage();

      expect(await screen.findByTestId('owner-onboarding-error')).toBeInTheDocument();
      expect(screen.queryByTestId('owner-phases')).not.toBeInTheDocument();
      expect(screen.queryByTestId('owner-outcomes')).not.toBeInTheDocument();
    });

    it('OwnerOnboarding_NotFoundEvenWithAnOlderAnswerInMemory_ShowsNotFoundAndNotTheOldData', async () => {
      const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
      // An older answer that says everything is ready: the 404 of the next read must win over it.
      client.setQueryData(ownerOnboardingKeys.readiness, ready100());
      vi.mocked(ownerOnboardingApi.getReadiness).mockRejectedValue(problemError(404, { code: 'not_found' }));
      renderPage({ client });

      expect(await screen.findByTestId('owner-onboarding-not-found')).toBeInTheDocument();
      expect(screen.queryByTestId('owner-phases')).not.toBeInTheDocument();
      expect(screen.queryByTestId('owner-outcome-accounting-state')).not.toBeInTheDocument();
    });
  });

  describe('what it never shows', () => {
    it('OwnerReadiness_NeverShowsGuestPii_Test', async () => {
      // An answer that carries more than the contract says (a guest, a fiscal code, an IBAN): the page draws a fixed list of fields and nothing else.
      const leaking = readiness();
      const dirty = {
        ...leaking,
        guestName: 'Giulia Ospite',
        guestEmail: 'giulia.ospite@example.com',
        owners: leaking.owners.map((entry) => ({
          ...entry,
          fiscalCode: 'BNCLCU80A01H501X',
          iban: 'IT60X0542811101000000123456',
          guestPhone: '+39 333 1234567',
          reasons: entry.reasons.map((reason) => ({ ...reason, value: 'IT60X0542811101000000123456', guestName: 'Giulia Ospite' })),
        })),
        properties: leaking.properties.map((entry) => ({ ...entry, guests: [{ name: 'Giulia Ospite', email: 'giulia.ospite@example.com' }] })),
      } as unknown as OwnerReadinessReport;
      vi.mocked(ownerOnboardingApi.getReadiness).mockResolvedValue(dirty);
      const { container } = renderPage();
      await screen.findByTestId('owner-phases');
      await screen.findByTestId('owner-invitations-list');

      const text = container.textContent ?? '';
      for (const secret of ['Giulia Ospite', 'giulia.ospite@example.com', '+39 333 1234567', 'IT60X0542811101000000123456', 'BNCLCU80A01H501X']) {
        expect(text).not.toContain(secret);
      }
      // What it does show: the owners' names in the agency's registry and the facts that are missing, in words.
      expect(text).toContain('Luca Bianchi');
      expect(text).toContain(i18n.t('ownerOnboarding.reasons.ibanMissing'));
    });
  });

  describe('the import of the owners', () => {
    const file = () => new File(['propertyId,legalName\r\n'], 'proprietari.csv', { type: 'text/csv' });

    async function chooseFile(chosen: File) {
      const input = await screen.findByTestId('owner-import-dropzone-input');
      fireEvent.change(input, { target: { files: [chosen] } });
      await screen.findByText(i18n.t('ownerOnboarding.import.chosen', { name: chosen.name }));
    }

    it('OwnerOnboarding_ImportNeverCallsInvite_Test', async () => {
      vi.mocked(ownerOnboardingApi.importOwners).mockImplementation((_file, dryRun) => Promise.resolve(importResult(dryRun)));
      renderPage();
      const chosen = file();
      await chooseFile(chosen);

      // The import is off until THIS file was checked.
      expect(screen.getByTestId('owner-import-apply')).toBeDisabled();
      fireEvent.click(screen.getByTestId('owner-import-check'));
      await screen.findByTestId('owner-import-result');
      expect(ownerOnboardingApi.importOwners).toHaveBeenCalledTimes(1);
      expect(ownerOnboardingApi.importOwners).toHaveBeenLastCalledWith(chosen, true);

      // Then a separate act, confirmed with its exact effect, writes only the valid rows.
      fireEvent.click(screen.getByTestId('owner-import-apply'));
      expect(ownerOnboardingApi.importOwners).toHaveBeenCalledTimes(1);
      const dialog = await screen.findByRole('dialog');
      expect(within(dialog).getByText(i18n.t('ownerOnboarding.import.confirm.noInvitation'))).toBeInTheDocument();
      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('ownerOnboarding.import.confirm.action') }));

      await waitFor(() => expect(ownerOnboardingApi.importOwners).toHaveBeenCalledTimes(2));
      expect(ownerOnboardingApi.importOwners).toHaveBeenLastCalledWith(chosen, false);
      await waitFor(() => expect(screen.getByTestId('owner-import-result')).toHaveAttribute('data-dry-run', 'false'));

      // From the first check to the end of the import not one invitation was previewed, sent, sent again, withdrawn or accepted.
      for (const method of INVITATION_WRITES) expect(ownerOnboardingApi[method]).not.toHaveBeenCalled();
    });

    it('OwnerOnboarding_ImportCheck_ShowsEveryRowWithItsErrorInWordsAndTheProposedActionBeforeAnythingChanges', async () => {
      vi.mocked(ownerOnboardingApi.importOwners).mockResolvedValue(importResult(true));
      renderPage();
      await chooseFile(file());
      fireEvent.click(screen.getByTestId('owner-import-check'));

      const rows = await screen.findAllByTestId('owner-import-row');
      expect(rows).toHaveLength(2);
      expect(within(rows[0]).getByText(i18n.t('ownerOnboarding.import.rowOk'))).toBeInTheDocument();
      expect(within(rows[0]).getByText(new RegExp(i18n.t('ownerOnboarding.import.ownerActions.create_owner')))).toBeInTheDocument();
      // The error is in words, with the column it is about; never the bare code.
      expect(within(rows[1]).getByText(new RegExp(i18n.t('ownerOnboarding.rowCodes.propertyNotFound')))).toBeInTheDocument();
      expect(rows[1]).not.toHaveTextContent('property_not_found');
      expect(screen.getByTestId('owner-import-summary')).toHaveTextContent(i18n.t('ownerOnboarding.import.checkSummary', { valid: 1, invalid: 1 }));
      expect(screen.getByTestId('owner-import-unknown-columns')).toHaveTextContent('colonnaStrana');
    });

    it('OwnerOnboarding_ImportCheck_SaysHowAnOwnerAlreadyInTheRegistryWasMatchedBeforeAnythingIsWritten', async () => {
      const checked = importResult(true);
      checked.rows = [{ ...checked.rows[0], ownerAction: 'match_owner', matchedBy: 'fiscal_identifier', ownerId: OWNER_A, ownershipAction: 'update_future_period' }];
      vi.mocked(ownerOnboardingApi.importOwners).mockResolvedValue(checked);
      renderPage();
      await chooseFile(file());
      fireEvent.click(screen.getByTestId('owner-import-check'));

      const row = await screen.findByTestId('owner-import-row');
      expect(row).toHaveTextContent(i18n.t('ownerOnboarding.import.ownerActions.match_owner'));
      expect(row).toHaveTextContent(i18n.t('ownerOnboarding.import.matchedBy.fiscal_identifier'));
      // An owner is never found by e-mail, and no fiscal identifier is shown: only how it was found.
      expect(row).not.toHaveTextContent(/@/);
    });

    it('OwnerOnboarding_ImportThatWroteNothing_IsToldAsNotDoneAndNeverAsASuccess', async () => {
      vi.mocked(ownerOnboardingApi.importOwners).mockImplementation((_file, dryRun) => Promise.resolve(dryRun ? importResult(true) : { ...importResult(false), summary: { ...importResult(false).summary, applied: 0 } }));
      renderPage();
      await chooseFile(file());
      fireEvent.click(screen.getByTestId('owner-import-check'));
      await screen.findByTestId('owner-import-result');
      fireEvent.click(screen.getByTestId('owner-import-apply'));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('ownerOnboarding.import.confirm.action') }));

      expect(await screen.findByTestId('owner-import-nothing')).toHaveTextContent(i18n.t('ownerOnboarding.import.nothingApplied'));
    });

    it('OwnerOnboarding_ImportRefused_ShowsTheRefusalAndKeepsTheFileOutOfTheCacheOfTheMutations', async () => {
      vi.mocked(ownerOnboardingApi.importOwners).mockRejectedValue(problemError(422, { code: 'import_columns_unrecognized' }));
      const { client } = renderPage();
      await chooseFile(file());
      fireEvent.click(screen.getByTestId('owner-import-check'));

      expect(await screen.findByTestId('owner-import-error')).toBeInTheDocument();
      expect(screen.getByTestId('owner-import-apply')).toBeDisabled();
      cleanup();
      // Nothing of the file or of the answer is left in the cache of the mutations once the panel is closed.
      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));
    });

    it('OwnerOnboarding_ImportFile_RefusesWhatIsNotACsvOrAnXlsxAndWhatIsTooBigBeforeSendingIt', async () => {
      renderPage();
      const input = await screen.findByTestId('owner-import-dropzone-input');

      fireEvent.change(input, { target: { files: [new File(['x'], 'proprietari.pdf', { type: 'application/pdf' })] } });
      expect(await screen.findByTestId('owner-import-file-problem')).toHaveTextContent(i18n.t('ownerOnboarding.import.fileType'));

      const huge = new File(['x'], 'grande.csv', { type: 'text/csv' });
      Object.defineProperty(huge, 'size', { value: 3 * 1024 * 1024 });
      fireEvent.change(input, { target: { files: [huge] } });
      expect(await screen.findByTestId('owner-import-file-problem')).toHaveTextContent(i18n.t('ownerOnboarding.import.fileSize'));
      expect(screen.getByTestId('owner-import-check')).toBeDisabled();
      expect(ownerOnboardingApi.importOwners).not.toHaveBeenCalled();
    });

    it('OwnerOnboarding_Template_IsOnlyTheHeaderOfTheColumnsTheServerReads', async () => {
      const urls: Blob[] = [];
      const createObjectURL = vi.fn((blob: Blob) => {
        urls.push(blob);
        return 'blob:modello';
      });
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
      renderPage();

      fireEvent.click(await screen.findByTestId('owner-import-template'));

      expect(urls).toHaveLength(1);
      const text = await urls[0].text();
      expect(text.trim().split(/\r?\n/)).toHaveLength(1);
      expect(text.startsWith('propertyId,cinCode,ownerKey,legalName,email,entityKind,taxResidence,fiscalCode')).toBe(true);
    });
  });

  describe('the invitations to the portal', () => {
    async function selectMarta() {
      fireEvent.click(await screen.findByRole('checkbox', { name: i18n.t('ownerOnboarding.invitations.select', { name: 'Marta Esposito' }) }));
    }

    it('OwnerInvitation_ConfirmRequiresPreviewAndExplicitConfirmation_Test', async () => {
      vi.mocked(ownerOnboardingApi.previewInvitations).mockResolvedValue(previewOf());
      vi.mocked(ownerOnboardingApi.confirmInvitations).mockResolvedValue({ sent: 1, invitations: [{ invitationId: 'inv-a', ownerId: OWNER_A, expiresAt: '2026-11-20T09:00:00Z' }], failed: [] });
      renderPage();

      // Nothing to preview before an owner is chosen, and choosing sends nothing.
      expect(await screen.findByTestId('owner-invitations-preview')).toBeDisabled();
      await selectMarta();
      expect(ownerOnboardingApi.previewInvitations).not.toHaveBeenCalled();

      fireEvent.click(screen.getByTestId('owner-invitations-preview'));
      const dialog = await screen.findByRole('dialog');
      expect(ownerOnboardingApi.previewInvitations).toHaveBeenCalledWith([OWNER_A]);
      expect(ownerOnboardingApi.confirmInvitations).not.toHaveBeenCalled();

      // The exact effect: to whom (with the address), for which properties and with which permissions, and who is left out.
      expect(within(dialog).getByTestId('owner-invitation-recipients')).toHaveTextContent('Marta Esposito - marta@example.com');
      expect(within(dialog).getByTestId('owner-invitation-exclusions')).toHaveTextContent(`Anna Neri: ${i18n.t('ownerOnboarding.reasons.emailMissing')}`);
      expect(dialog).toHaveTextContent(i18n.t('ownerOnboarding.invitations.confirm.permissions'));
      expect(dialog).toHaveTextContent(i18n.t('ownerOnboarding.invitations.confirm.scope', { properties: 3 }));

      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('ownerOnboarding.invitations.confirm.action', { count: 1 }) }));

      await waitFor(() => expect(ownerOnboardingApi.confirmInvitations).toHaveBeenCalledTimes(1));
      // The confirmation carries the fingerprint of the preview and the same owners.
      expect(ownerOnboardingApi.confirmInvitations).toHaveBeenCalledWith([OWNER_A], 'fp-1');
      expect(await screen.findByTestId('owner-invitations-outcome')).toHaveTextContent(i18n.t('ownerOnboarding.invitations.sent', { count: 1 }));
    });

    it('OwnerInvitation_PreviewThatChangedBeforeTheConfirmation_SendsNothingAndSaysSo', async () => {
      vi.mocked(ownerOnboardingApi.previewInvitations).mockResolvedValue(previewOf());
      vi.mocked(ownerOnboardingApi.confirmInvitations).mockRejectedValue(problemError(409, { code: 'owner_invitation_preview_stale' }));
      renderPage();
      await selectMarta();
      fireEvent.click(screen.getByTestId('owner-invitations-preview'));
      const dialog = await screen.findByRole('dialog');
      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('ownerOnboarding.invitations.confirm.action', { count: 1 }) }));

      expect(await screen.findByTestId('owner-invitation-confirm-error')).toHaveTextContent(i18n.t('ownerOnboarding.invitations.confirm.stale'));
      expect(screen.queryByTestId('owner-invitations-outcome')).not.toBeInTheDocument();
    });

    it('OwnerInvitation_MailThatCouldNotBeQueued_IsToldAsNotSentNeverAsAFullSuccess', async () => {
      vi.mocked(ownerOnboardingApi.previewInvitations).mockResolvedValue(previewOf());
      vi.mocked(ownerOnboardingApi.confirmInvitations).mockResolvedValue({ sent: 0, invitations: [], failed: [{ ownerId: OWNER_A, code: 'owner_invitation_email_not_queued' }] });
      renderPage();
      await selectMarta();
      fireEvent.click(screen.getByTestId('owner-invitations-preview'));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('ownerOnboarding.invitations.confirm.action', { count: 1 }) }));

      const outcome = await screen.findByTestId('owner-invitations-outcome');
      expect(outcome).toHaveTextContent('Marta Esposito');
      expect(outcome).not.toHaveTextContent(i18n.t('ownerOnboarding.invitations.sent', { count: 0 }));
    });

    it('OwnerInvitation_ResendAndRevoke_AreTwoDistinctActsEachWithItsOwnConfirmation', async () => {
      vi.mocked(ownerOnboardingApi.resendInvitation).mockResolvedValue(invitation(OWNER_B, 'Luca Bianchi', 'invited', { invitationId: 'inv-b2' }));
      vi.mocked(ownerOnboardingApi.revokeInvitation).mockResolvedValue(invitation(OWNER_B, 'Luca Bianchi', 'revoked', { invitationId: 'inv-b' }));
      renderPage();

      fireEvent.click(await screen.findByTestId('owner-invitation-revoke'));
      let dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent(i18n.t('ownerOnboarding.invitations.revokeConfirm.effect'));
      // Asking is not doing: nothing is withdrawn, and nothing is sent again, until the confirmation.
      expect(ownerOnboardingApi.revokeInvitation).not.toHaveBeenCalled();
      expect(ownerOnboardingApi.resendInvitation).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('ownerOnboarding.invitations.revokeConfirm.action') }));
      await waitFor(() => expect(ownerOnboardingApi.revokeInvitation).toHaveBeenCalledWith('inv-b'));
      expect(ownerOnboardingApi.resendInvitation).not.toHaveBeenCalled();
      await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

      fireEvent.click(await screen.findByTestId('owner-invitation-resend'));
      dialog = await screen.findByRole('dialog');
      expect(dialog).toHaveTextContent(i18n.t('ownerOnboarding.invitations.resendConfirm.effect'));
      expect(ownerOnboardingApi.resendInvitation).not.toHaveBeenCalled();
      fireEvent.click(within(dialog).getByRole('button', { name: i18n.t('ownerOnboarding.invitations.resendConfirm.action') }));
      await waitFor(() => expect(ownerOnboardingApi.resendInvitation).toHaveBeenCalledWith('inv-b'));
      expect(ownerOnboardingApi.revokeInvitation).toHaveBeenCalledTimes(1);
    });

    it('OwnerInvitation_RequestInFlight_KeepsEveryButtonOfTheCardOff', async () => {
      let release: (value: OwnerInvitationPreview) => void = () => undefined;
      vi.mocked(ownerOnboardingApi.previewInvitations).mockReturnValue(new Promise<OwnerInvitationPreview>((resolve) => (release = resolve)));
      renderPage();
      await selectMarta();
      fireEvent.click(screen.getByTestId('owner-invitations-preview'));

      await waitFor(() => expect(screen.getByTestId('owner-invitations-preview')).toBeDisabled());
      expect(screen.getByTestId('owner-invitation-resend')).toBeDisabled();
      expect(screen.getByTestId('owner-invitation-revoke')).toBeDisabled();
      expect(screen.getByRole('checkbox', { name: i18n.t('ownerOnboarding.invitations.select', { name: 'Marta Esposito' }) })).toBeDisabled();
      release(previewOf());
      await screen.findByRole('dialog');
    });

    it('OwnerInvitation_ReadFails_IsToldAndNeverLooksLikeNobodyToInvite', async () => {
      vi.mocked(ownerOnboardingApi.listInvitations).mockRejectedValue(problemError(500, { code: 'server_error' }));
      renderPage();

      expect(await screen.findByTestId('owner-invitations-error')).toBeInTheDocument();
      expect(screen.queryByTestId('owner-invitations-empty')).not.toBeInTheDocument();
      expect(screen.queryByTestId('owner-invitations-preview')).not.toBeInTheDocument();
    });

    it('OwnerInvitation_NoLinkAndNoTokenIsEverShownOrKept', async () => {
      vi.mocked(ownerOnboardingApi.previewInvitations).mockResolvedValue(previewOf());
      vi.mocked(ownerOnboardingApi.confirmInvitations).mockResolvedValue({ sent: 1, invitations: [{ invitationId: 'inv-a', ownerId: OWNER_A, expiresAt: '2026-11-20T09:00:00Z' }], failed: [] });
      const { container } = renderPage();
      await selectMarta();
      fireEvent.click(screen.getByTestId('owner-invitations-preview'));
      fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('ownerOnboarding.invitations.confirm.action', { count: 1 }) }));
      await screen.findByTestId('owner-invitations-outcome');

      expect(container.textContent ?? '').not.toMatch(/portale-proprietari\/invito|token=/);
      expect(Object.keys(localStorage)).toHaveLength(0);
      expect(Object.keys(sessionStorage)).toHaveLength(0);
    });
  });
});

describe('OnboardingPlanPage, the owner step in the plan (NF-109)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    workspace.contexts = OWNER;
    org.isAgency = true;
    org.isLoading = false;
    vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(plan());
    for (const method of Object.keys(ownerOnboardingApi) as (keyof typeof ownerOnboardingApi)[]) vi.mocked(ownerOnboardingApi[method]).mockReset();
    vi.mocked(ownerOnboardingApi.getReadiness).mockResolvedValue(readiness());
  });

  afterEach(() => {
    cleanup();
  });

  const renderPlan = (options?: Parameters<typeof renderAt>[2]) => renderAt('/app/short-rent/onboarding', <OnboardingPlanPage />, options);

  it('OwnerStep_AgencyAdministrator_IsARowAfterTheProperties_NeverTheHighlightedBlock', async () => {
    renderPlan();

    const row = await screen.findByTestId('onboarding-owners-step');
    const list = screen.getByTestId('onboarding-plan-parts');
    const ids = Array.from(list.children).map((item) => (item as HTMLElement).dataset.testid);
    expect(ids.indexOf('onboarding-owners-step')).toBe(ids.indexOf('onboarding-part-properties') + 1);
    expect(row).not.toHaveAttribute('data-highlighted');
    await waitFor(() => expect(row).toHaveAttribute('data-state', 'toComplete'));
    expect(within(row).getByTestId('onboarding-owners-step-open')).toHaveAttribute('href', OWNER_STEP_PATH);
  });

  it('OwnerStep_AgencyFlagOff_ChangesNothingAndReadsNothing', async () => {
    renderPlan({ agencyTier: false });

    await screen.findByTestId('onboarding-plan-parts');
    expect(screen.queryByTestId('onboarding-owners-step')).not.toBeInTheDocument();
    expect(ownerOnboardingApi.getReadiness).not.toHaveBeenCalled();
  });

  it('OwnerStep_OrgNotOnTheAgencyPlan_IsNotDrawnAndAsksNothing', async () => {
    org.isAgency = false;
    renderPlan();

    await screen.findByTestId('onboarding-plan-parts');
    expect(screen.queryByTestId('onboarding-owners-step')).not.toBeInTheDocument();
    expect(ownerOnboardingApi.getReadiness).not.toHaveBeenCalled();
  });

  it('OwnerStep_NotTheAdministrator_IsNotDrawnAndAsksNothing', async () => {
    workspace.contexts = COLLABORATOR;
    renderPlan();

    await screen.findByTestId('onboarding-plan-parts');
    expect(screen.queryByTestId('onboarding-owners-step')).not.toBeInTheDocument();
    expect(ownerOnboardingApi.getReadiness).not.toHaveBeenCalled();
  });

  it('OwnerStep_ReadFails_SaysItCouldNotReadAndNeverReady', async () => {
    vi.mocked(ownerOnboardingApi.getReadiness).mockRejectedValue(problemError(500, { code: 'server_error' }));
    renderPlan();

    const row = await screen.findByTestId('onboarding-owners-step');
    await waitFor(() => expect(within(row).getByTestId('onboarding-owners-step-line')).toHaveTextContent(i18n.t('ownerOnboarding.step.readError')));
    expect(within(row).queryByTestId('onboarding-owners-step-state')).not.toBeInTheDocument();
  });

  it('OwnerStep_ModuleOffOnTheServer_LeavesNoRowAtAll', async () => {
    vi.mocked(ownerOnboardingApi.getReadiness).mockRejectedValue(problemError(404, { code: 'not_found' }));
    renderPlan();

    await screen.findByTestId('onboarding-plan-parts');
    await waitFor(() => expect(ownerOnboardingApi.getReadiness).toHaveBeenCalled());
    await waitFor(() => expect(screen.queryByTestId('onboarding-owners-step')).not.toBeInTheDocument());
  });
});

describe('the owner entered by hand (NF-109, manual completion)', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('it');
    workspace.contexts = OWNER;
    org.isAgency = true;
    org.isLoading = false;
    vi.mocked(onboardingApi.getPlan).mockReset().mockResolvedValue(plan());
    for (const method of Object.keys(ownerOnboardingApi) as (keyof typeof ownerOnboardingApi)[]) vi.mocked(ownerOnboardingApi[method]).mockReset();
    vi.mocked(ownerOnboardingApi.getReadiness).mockResolvedValue(readiness());
    vi.mocked(ownerOnboardingApi.listInvitations).mockResolvedValue(INVITATIONS);
  });

  afterEach(() => {
    cleanup();
  });

  function type(testId: string, value: string) {
    fireEvent.change(screen.getByTestId(testId), { target: { value } });
  }

  async function openForm() {
    fireEvent.click(await screen.findByTestId('owner-import-manual-toggle'));
    await screen.findByTestId('owner-manual-form');
  }

  function fillRow() {
    type('owner-manual-property', 'IT-CIN-9');
    type('owner-manual-name', 'Maria Verdi');
    type('owner-manual-key', 'P-9');
    type('owner-manual-email', 'maria@example.com');
    type('owner-manual-fiscal', 'VRDMRA80A41H501Z');
    type('owner-manual-share', '100');
    type('owner-manual-start', '2026-01-01');
  }

  it('OwnerOnboarding_ManualOwner_IsCheckedAsAOneRowFileThroughTheSameImportAndNeverInvites', async () => {
    vi.mocked(ownerOnboardingApi.importOwners).mockImplementation((_file, dryRun) => Promise.resolve(importResult(dryRun)));
    renderPage();
    await openForm();
    fillRow();
    fireEvent.click(screen.getByTestId('owner-manual-submit'));

    await screen.findByTestId('owner-import-result');
    expect(ownerOnboardingApi.importOwners).toHaveBeenCalledTimes(1);
    const [sent, dryRun] = vi.mocked(ownerOnboardingApi.importOwners).mock.calls[0];
    expect(dryRun).toBe(true);
    // The row goes to the server as a file, with the columns the server reads; the server is the only judge of it.
    expect((await sent.text()).split(/\r?\n/).slice(0, 2)).toEqual([
      'cinCode,ownerKey,legalName,email,entityKind,fiscalCode,sharePercent,ownershipStart',
      'IT-CIN-9,P-9,Maria Verdi,maria@example.com,person,VRDMRA80A41H501Z,100,2026-01-01',
    ]);
    // Then the same separate, confirmed import writes it; the form is emptied once something was written.
    await waitFor(() => expect(screen.getByTestId('owner-import-apply')).toBeEnabled());
    fireEvent.click(screen.getByTestId('owner-import-apply'));
    fireEvent.click(within(await screen.findByRole('dialog')).getByRole('button', { name: i18n.t('ownerOnboarding.import.confirm.action') }));
    await waitFor(() => expect(ownerOnboardingApi.importOwners).toHaveBeenCalledTimes(2));
    expect(vi.mocked(ownerOnboardingApi.importOwners).mock.calls[1][1]).toBe(false);
    await waitFor(() => expect((screen.getByTestId('owner-manual-name') as HTMLInputElement).value).toBe(''));
    for (const method of INVITATION_WRITES) expect(ownerOnboardingApi[method]).not.toHaveBeenCalled();
  });

  it('OwnerOnboarding_ManualOwner_WithoutWhatTheServerNeedsIsNotSentAndSaysWhy', async () => {
    renderPage();
    await openForm();

    fireEvent.click(screen.getByTestId('owner-manual-submit'));
    expect(await screen.findByTestId('owner-manual-problem')).toHaveTextContent(i18n.t('ownerOnboarding.manual.property'));

    // An e-mail alone identifies nobody: a key or a tax code is needed.
    type('owner-manual-property', 'IT-CIN-9');
    type('owner-manual-name', 'Maria Verdi');
    type('owner-manual-email', 'maria@example.com');
    type('owner-manual-share', '100');
    type('owner-manual-start', '2026-01-01');
    fireEvent.click(screen.getByTestId('owner-manual-submit'));
    expect(await screen.findByTestId('owner-manual-problem')).toHaveTextContent(i18n.t('ownerOnboarding.manual.needsIdentity'));
    expect(ownerOnboardingApi.importOwners).not.toHaveBeenCalled();
  });

  it('OwnerOnboarding_ManualOwner_PersonalDataIsInNoStorageAndNoAddress', async () => {
    vi.mocked(ownerOnboardingApi.importOwners).mockResolvedValue(importResult(true));
    renderPage();
    await openForm();
    fillRow();
    fireEvent.click(screen.getByTestId('owner-manual-submit'));
    await screen.findByTestId('owner-import-result');

    for (const secret of ['Maria Verdi', 'VRDMRA80A41H501Z', 'maria@example.com']) {
      expect(JSON.stringify({ ...localStorage, ...sessionStorage })).not.toContain(secret);
      expect(window.location.href).not.toContain(secret);
    }
  });

  it('OwnerManualCsv_CommaInTheShareAndInTheName_IsReadAsTheDecimalPointAndQuoted', () => {
    const csv = ownerManualCsv({
      property: '11111111-1111-4111-8111-111111111111',
      ownerKey: 'P-1',
      legalName: 'Rossi, Mario "Gigi"',
      email: '',
      entityKind: 'company',
      fiscalCode: '',
      sharePercent: '33,33',
      ownershipStart: '2026-02-01',
    });

    expect(csv.split(/\r?\n/)[0]).toBe('propertyId,ownerKey,legalName,email,entityKind,fiscalCode,sharePercent,ownershipStart');
    expect(csv.split(/\r?\n/)[1]).toBe('11111111-1111-4111-8111-111111111111,P-1,"Rossi, Mario ""Gigi""",,company,,33.33,2026-02-01');
  });
});

describe('route manifest: the owner step (E10/F03/US05/T01)', () => {
  const entry = ROUTE_MANIFEST.find((candidate) => candidate.path === OWNER_STEP_PATH);

  it('RouteManifest_OwnersStep_IsOnItsRouteOfShortRentBehindTheFlagAndInNoMenu', () => {
    expect(entry).toBeDefined();
    expect(entry?.context).toBe('short-rent');
    expect(entry?.featureFlag).toBe('octorateOnboarding');
    expect(entry?.requiredPermissions).toEqual(['property.read']);
    expect(entry?.orgBillingAdmin).toBe(true);
    expect(entry?.navPlacement).toBeUndefined();
    expect(entry?.navParent).toBeUndefined();
    const flagOn = { ...DEFAULT_FEATURE_FLAGS, octorateOnboarding: true, agencyTier: true };
    for (const features of [undefined, {}, DEFAULT_FEATURE_FLAGS, flagOn]) {
      expect(getVisibleNavEntries('short-rent', () => true, features).map((page) => page.path)).not.toContain(OWNER_STEP_PATH);
    }
  });

  it('RouteManifest_OwnersStep_LoadsAPageThatIsAComponent', { timeout: 60_000 }, async () => {
    const page = await entry?.component();

    expect(typeof page?.default).toBe('function');
  });
});
