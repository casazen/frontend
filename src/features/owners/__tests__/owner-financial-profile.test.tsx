import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import * as issuerApi from '@/api/owner-issuer-profiles.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import i18n from '@/i18n/config';
import { todayInRome } from '@/lib/stay-dates';
import { expectNoAxeViolations } from '@/test/axe';
import { OWNER_ID, policy, profile } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import { defaultPeriod, maskValue, OWNER_ONBOARDING_PATH, startOfPeriod } from '@/features/owner-accounting/owner-accounting-model';
import type { OwnerMandate } from '@/types';
import { OwnerFinancialProfilePage } from '../owner-financial-profile-page';

const api = vi.hoisted(() => ({
  listOwners: vi.fn(),
  getOnboardingReadiness: vi.fn(),
  listFiscalProfiles: vi.fn(),
  listPolicies: vi.fn(),
  approvePolicy: vi.fn(),
  saveFiscalProfile: vi.fn(),
  createPolicy: vi.fn(),
  listMandates: vi.fn(),
  createMandate: vi.fn(),
  getAddress: vi.fn(),
  saveAddress: vi.fn(),
}));
const env = vi.hoisted(() => ({ flags: {} as Record<string, boolean> }));

vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('@/api/owner-issuer-profiles.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/owner-issuer-profiles.api')>();
  return { ...actual, getOwnerIssuerProfile: vi.fn() };
});
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, ...env.flags }, isLoading: false }),
}));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_admin' }] }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, status, primary }: { title: string; status?: ReactNode; primary?: { label: string; onClick?: () => void; testId?: string } }) =>
    createElement('div', null, createElement('h1', null, title), status ?? null, primary ? createElement('button', { type: 'button', onClick: primary.onClick, 'data-testid': primary.testId }, primary.label) : null),
}));

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

function renderPage(search = '', client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 }, mutations: { retry: false } } })) {
  const view = render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(MemoryRouter, { initialEntries: [`/app/account/owners/${OWNER_ID}/financial${search}`] }, createElement(Routes, null, createElement(Route, { path: '/app/account/owners/:ownerId/financial', element: createElement(OwnerFinancialProfilePage) }))),
    ),
  );
  return { ...view, client };
}

function reviewProfile(dialog: HTMLElement) {
  for (let step = 0; step < 6 && !within(dialog).queryByTestId('profile-review'); step += 1) fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));
  expect(within(dialog).getByTestId('profile-review')).toBeInTheDocument();
}

const problem = (status: number, code: string) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code } } });

const mandate = (overrides: Partial<OwnerMandate> = {}): OwnerMandate => ({
  id: 'c1000000-0000-4000-8000-000000000001',
  ownerId: OWNER_ID,
  ownershipId: null,
  validFrom: '2024-01-01',
  validTo: null,
  commissionPercent: 20,
  commissionBase: 'GrossExclTouristTax',
  commissionIncludesVat: false,
  cleaningFlatRate: 80,
  linenFlatRate: null,
  passthroughPaymentFees: false,
  withholdingTreatment: 'NotDeductible',
  monthlyFrequency: 1,
  hasDocument: false,
  createdAt: '2024-01-01T08:00:00Z',
  createdByUserId: 'auth0|admin',
  ...overrides,
});

beforeEach(async () => {
  vi.resetAllMocks();
  env.flags = {};
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_admin' }];
  await i18n.changeLanguage('it');
  api.listOwners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
  api.getOnboardingReadiness.mockResolvedValue(null);
  api.listFiscalProfiles.mockResolvedValue([profile()]);
  api.listPolicies.mockResolvedValue([policy()]);
  api.listMandates.mockResolvedValue([]);
  api.getAddress.mockResolvedValue(null);
  vi.mocked(issuerApi.getOwnerIssuerProfile).mockResolvedValue(null);
});

afterEach(() => cleanup());

describe('the financial profile of an owner (E06/F05/US02/T01, T04)', () => {
  it('OwnerProfile_UnauthorizedRole_SeesOnlyMaskedData_AndCanNeitherRevealNorEdit', async () => {
    const identity = renderPage('?tab=identity');
    const facts = await screen.findByTestId('profile-facts');

    expect(facts.querySelector('dl')).toHaveAttribute('data-masked', 'true');
    expect(within(facts).getByTestId('profile-value-fiscalCode')).toHaveTextContent('••••••••••••3456');
    expect(within(facts).getByTestId('profile-value-legalName')).toHaveTextContent('•••••••••ossi');
    expect(screen.queryByTestId('profile-reveal')).toBeNull();
    expect(screen.getByTestId('profile-masked-notice')).toHaveTextContent(text('ownerProfile.maskedNotice'));
    expect(screen.queryByTestId('profile-new-version')).toBeNull();
    expect(screen.queryByTestId('profile-edit-0')).toBeNull();
    identity.unmount();

    renderPage('?tab=payments');
    const payments = await screen.findByTestId('profile-payments');
    expect(within(payments).getByTestId('profile-value-bankAccountReference')).toHaveTextContent('•••••••••••••••••••••3456');
    expect(screen.queryByTestId('profile-reveal')).toBeNull();
    expect(screen.queryByTestId('profile-edit-2')).toBeNull();
    cleanup();

    renderPage('?tab=rule');
    await screen.findByTestId('profile-policy-section');
    expect(screen.queryByTestId('policy-new')).toBeNull();
    expect(screen.queryByTestId('profile-edit-4')).toBeNull();
    expect(Object.keys(api)).not.toContain('getOwnerIban');
    for (const write of [api.saveFiscalProfile, api.approvePolicy, api.createPolicy]) expect(write).not.toHaveBeenCalled();
  });

  it('OwnerProfile_AuthorizedRole_SeesTheValuesMaskedUntilTheyAskForThem', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: 'IT60X0542811101000000123456', legalName: 'Marta Rossi' })]);
    const identity = renderPage('?tab=identity');
    const facts = await screen.findByTestId('profile-facts');

    expect(within(facts).getByTestId('profile-value-fiscalCode')).toHaveTextContent(maskValue('RSSMRT80A01H501U') as string);
    expect(within(facts).getByTestId('profile-value-fiscalCode')).not.toHaveTextContent('RSSMRT80A01H501U');

    const reveal = within(facts).getByTestId('profile-reveal');
    expect(reveal).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(reveal);
    expect(within(facts).getByTestId('profile-value-fiscalCode')).toHaveTextContent('RSSMRT80A01H501U');
    expect(within(facts).getByTestId('profile-value-legalName')).toHaveTextContent('Marta Rossi');

    fireEvent.click(within(facts).getByTestId('profile-reveal'));
    expect(within(facts).getByTestId('profile-value-fiscalCode')).not.toHaveTextContent('RSSMRT80A01H501U');
    expect(screen.getByTestId('profile-new-version')).toBeInTheDocument();
    identity.unmount();

    renderPage('?tab=payments');
    const payments = await screen.findByTestId('profile-payments');
    expect(within(payments).getByTestId('profile-value-bankAccountReference')).not.toHaveTextContent('IT60X0542811101000000123456');
    fireEvent.click(within(payments).getByTestId('profile-reveal'));
    expect(within(payments).getByTestId('profile-value-bankAccountReference')).toHaveTextContent('IT60X0542811101000000123456');
  });

  it('OwnerProfile_ARuleNotApprovedYet_BlocksTheOwner_AndTheAccountantApprovalIsRecordedByName', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
    api.listPolicies.mockResolvedValue([policy({ approved: false, approvedAt: null, approvedByName: null })]);
    api.approvePolicy.mockResolvedValue(policy());
    renderPage();

    const focus = await screen.findByTestId('profile-focus');
    expect(focus).toHaveAttribute('data-tone', 'warning');
    expect(focus).toHaveTextContent(text('ownerProfile.focus.blocked.policy_not_approved.title'));
    expect(screen.getByTestId('profile-status')).toHaveTextContent(text('ownerProfile.status.todo'));

    fireEvent.click(screen.getByTestId('profile-focus-approve'));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: text('ownerProfile.approveDialog.confirm') });
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('policy-approver'), { target: { value: 'Dott. Bianchi' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(api.approvePolicy).toHaveBeenCalledWith('b1000000-0000-4000-8000-000000000001', 'Dott. Bianchi'));
  });

  it('OwnerProfile_ThePolicyTab_SaysWhoApprovedTheRuleOrThatItWaits', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
    api.listPolicies.mockResolvedValue([policy({ approved: false, approvedAt: null, approvedByName: null })]);
    const waiting = renderPage('?tab=rule');
    expect(await screen.findByTestId('policy-approval')).toHaveTextContent(text('ownerProfile.policy.waiting'));
    expect(screen.getByTestId('policy-approve')).toBeInTheDocument();
    waiting.unmount();

    api.listPolicies.mockResolvedValue([policy()]);
    renderPage('?tab=rule');
    expect(await screen.findByTestId('policy-approval')).toHaveTextContent('Dott. Bianchi');
    expect(screen.getByTestId('profile-policy-section')).toHaveTextContent(text('ownerProfile.policy.approved'));
    expect(screen.queryByTestId('policy-approve')).toBeNull();
  });

  it('OwnerProfile_AProfileWithAnApprovedRule_IsReady_AndSaysWhoApprovedIt', async () => {
    renderPage();
    const focus = await screen.findByTestId('profile-focus');

    expect(focus).toHaveAttribute('data-tone', 'success');
    expect(focus).toHaveTextContent('Dott. Bianchi');
    expect(screen.getByTestId('profile-status')).toHaveTextContent('Pronto dal');
  });

  it('OwnerProfile_MissingFactsOfTheActivation_LinkBackToIt', async () => {
    api.getOnboardingReadiness.mockResolvedValue({
      asOf: '2026-11-12',
      summary: { financialReady: false },
      owners: [
        {
          ownerId: OWNER_ID,
          displayName: 'Marta Rossi',
          accountingReady: false,
          reasons: [
            { dimension: 'mandate', code: 'mandate_missing', field: null, propertyId: 'p-1' },
            { dimension: 'ownership', code: 'shares_gap', field: null, propertyId: 'p-1' },
            { dimension: 'payment', code: 'something_new', field: null, propertyId: null },
          ],
        },
      ],
      properties: [
        {
          propertyId: 'p-1',
          name: 'Casa Mare',
          ownershipReady: false,
          reasons: [],
          issues: [
            { kind: 'gap', from: '2025-01-01', to: '2025-03-31', totalPercent: 0, ownerId: null },
            { kind: 'shortfall', from: '2025-04-01', to: null, totalPercent: 60, ownerId: null },
          ],
        },
      ],
    });
    renderPage();

    const section = await screen.findByTestId('profile-onboarding');
    await within(section).findByTestId('profile-onboarding-reasons');
    expect(within(section).getByText(text('ownerProfile.reason.mandateMissing'))).toBeInTheDocument();
    expect(section).toHaveTextContent('Casa Mare');
    expect(section).toHaveTextContent(text('ownerProfile.reason.other', { code: 'something_new' }));
    expect(section).toHaveTextContent(text('ownerProfile.onboarding.toFix', { count: 3 }));
    expect(within(section).getByTestId('profile-onboarding-link')).toHaveAttribute('href', OWNER_ONBOARDING_PATH);

    const issues = within(section).getByTestId('profile-ownership-issues');
    const lines = within(issues).getAllByRole('listitem');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toHaveAttribute('data-kind', 'gap');
    expect(lines[0]).toHaveTextContent('Casa Mare');
    expect(lines[0]).toHaveTextContent('2025');
    expect(lines[1]).toHaveTextContent('60%');
    expect(lines[1]).toHaveTextContent(text('ownerProfile.ownership.onward'));
  });

  it('OwnerProfile_WithoutTheActivationModule_SaysSoInsteadOfShowingNothing', async () => {
    renderPage();
    const section = await screen.findByTestId('profile-onboarding');

    expect(section).toHaveTextContent(text('ownerProfile.onboarding.unavailable'));
    expect(within(section).queryByTestId('profile-onboarding-link')).toBeNull();
  });

  it('OwnerProfile_ThePresumedBusinessWarningOfTheActivation_IsToldInWords_AndBlocksNothing', async () => {
    api.getOnboardingReadiness.mockResolvedValue({
      asOf: '2026-11-12',
      summary: { financialReady: true },
      owners: [
        {
          ownerId: OWNER_ID,
          displayName: 'Marta Rossi',
          accountingReady: true,
          reasons: [],
          warnings: [
            { code: 'short_let_business_presumed', managedUnits: 2, externalUnits: 1, maxUnits: 2, suggestion: 'issuer_profile' },
            { code: 'something_new', managedUnits: 0, externalUnits: 0, maxUnits: 0, suggestion: null },
          ],
        },
      ],
      properties: [],
    });
    renderPage();

    const warnings = await screen.findAllByTestId('profile-warning');
    expect(warnings.map((warning) => warning.getAttribute('data-code'))).toEqual(['short_let_business_presumed', 'something_new']);
    expect(warnings[0]).toHaveTextContent(text('ownerProfile.warning.shortLetBusinessPresumed.title'));
    expect(warnings[0]).toHaveTextContent('2 gestiti dall\'agenzia e 1 dichiarati fuori, con un limite di 2');
    expect(warnings[0]).toHaveTextContent(text('ownerProfile.warning.suggestion.issuerProfile'));
    expect(warnings[1]).toHaveTextContent('something_new');
    expect(screen.getByTestId('profile-focus')).toBeInTheDocument();
  });

  it('OwnerProfile_NotTheFinanceAdministrator_IsToldWhoToAsk_AndNothingIsRead', async () => {
    workspace.contexts = [{ contextKey: 'account', roleKey: 'org_manager' }];
    renderPage();

    expect(await screen.findByTestId('finance-admin-required')).toBeInTheDocument();
    for (const call of Object.values(api)) expect(call).not.toHaveBeenCalled();
  });
});

describe('the path of an owner, from the overview to each section', () => {
  const complete = () => api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: 'IT60X0542811101000000123456' })]);

  it('OwnerProfile_TheOverview_ShowsTheStepsOfThePathWithTheirState_AndHowManyAreDone', async () => {
    complete();
    api.listMandates.mockResolvedValue([mandate()]);
    renderPage();

    const path = await screen.findByTestId('owner-path');
    await waitFor(() => expect(within(path).getByTestId('owner-step-mandate')).toHaveAttribute('data-state', 'done'));
    for (const step of ['identity', 'payments', 'mandate', 'rule']) expect(within(path).getByTestId(`owner-step-${step}`)).toHaveAttribute('data-state', 'done');
    expect(within(path).queryByTestId('owner-step-documents')).toBeNull();
    expect(within(path).getByTestId('owner-path-progress')).toHaveTextContent(text('ownerProfile.path.progress', { done: 4, total: 4 }));
    expect(within(path).getByTestId('owner-step-mandate')).toHaveTextContent('20% + IVA');
    expect(within(path).getByTestId('owner-step-payments')).toHaveTextContent('Valuta EUR');
    expect(within(path).getByTestId('owner-step-rule')).toHaveTextContent('Dott. Bianchi');
  });

  it('OwnerProfile_AStepThatMissesSomething_IsToDoInThePathAndInTheTabs', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: null })]);
    api.listMandates.mockResolvedValue([]);
    renderPage();

    const path = await screen.findByTestId('owner-path');
    await waitFor(() => expect(within(path).getByTestId('owner-step-mandate')).toHaveAttribute('data-state', 'todo'));
    expect(within(path).getByTestId('owner-step-payments')).toHaveAttribute('data-state', 'todo');
    expect(within(path).getByTestId('owner-step-payments')).toHaveTextContent(text('ownerProfile.path.ibanMissing'));
    expect(within(path).getByTestId('owner-step-identity')).toHaveAttribute('data-state', 'done');
    expect(within(path).getByTestId('owner-path-progress')).toHaveTextContent(text('ownerProfile.path.progress', { done: 2, total: 4 }));
    expect(screen.getByTestId('owner-tab-payments')).toHaveTextContent(text('ownerProfile.tabs.todo'));
    expect(screen.getByTestId('owner-tab-identity')).toHaveTextContent(text('ownerProfile.tabs.done'));
    expect(screen.getByTestId('owner-tab-overview').textContent).toBe(text('ownerProfile.tabs.overview'));
  });

  it('OwnerProfile_OpeningAStepOfThePath_GoesToItsTab_AndKeepsTheMonthThatSentThePersonHere', async () => {
    complete();
    renderPage('?period=2025-01');

    const step = await screen.findByTestId('owner-step-payments');
    expect(step.getAttribute('href')).toContain('period=2025-01');
    expect(step.getAttribute('href')).toContain('tab=payments');
    fireEvent.click(step);

    const payments = await screen.findByTestId('profile-payments');
    expect(within(payments).getByTestId('profile-value-settlementCurrency')).toHaveTextContent('EUR');
    expect(screen.getByTestId('owner-tab-payments')).toHaveAttribute('aria-selected', 'true');
    expect(screen.queryByTestId('owner-path')).toBeNull();
  });

  it('OwnerProfile_ASectionThatDoesNotExist_OpensTheOverview', async () => {
    const unknown = renderPage('?tab=nonsense');
    expect(await screen.findByTestId('profile-focus')).toBeInTheDocument();
    unknown.unmount();

    renderPage('?tab=documents');
    expect(await screen.findByTestId('profile-focus')).toBeInTheDocument();
    expect(screen.queryByTestId('owner-tab-documents')).toBeNull();
  });

  it('OwnerProfile_TheStayDocumentsTab_ExistsOnlyWhileTheIssuanceIsOn', async () => {
    env.flags = { fiscalDocumentIssuance: true };
    renderPage('?tab=documents');

    expect(await screen.findByTestId('profile-documents')).toBeInTheDocument();
    expect(screen.getByTestId('owner-tab-documents')).toHaveAttribute('aria-selected', 'true');
    expect(await screen.findByTestId('owner-issuer-not-for-you')).toBeInTheDocument();
  });

  it('OwnerProfile_EditingASection_OpensTheWizardAtThatStep', async () => {
    complete();
    renderPage('?tab=payments');

    fireEvent.click(await screen.findByTestId('profile-edit-2'));
    const dialog = await screen.findByTestId('profile-dialog');
    expect(within(dialog).getByTestId('profile-currency')).toBeInTheDocument();
    expect(within(dialog).queryByTestId('profile-legal-name')).toBeNull();
    expect(within(dialog).getByTestId('profile-back')).toBeInTheDocument();
  });

  it('OwnerProfile_AFactTheAccountingNeedsAndIsMissing_IsToldWhereItIsInsteadOfBeingBlank', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: null, workingCapitalRule: null })]);
    renderPage('?tab=payments');

    const payments = await screen.findByTestId('profile-payments');
    expect(within(payments).getByTestId('profile-value-bankAccountReference')).toHaveTextContent(text('ownerProfile.facts.missing'));
    expect(within(payments).getByTestId('profile-value-settlementCurrency')).toHaveTextContent('EUR');
    expect(payments).toHaveTextContent(text('ownerProfile.status.todo'));
  });

  it('OwnerProfile_TheReportsTab_ListsTheVersionsOfTheProfile_AndOffersTheExportOnlyWhileTheIssuanceIsOn', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, validFrom: '2025-06-01' }), profile({ id: 'a1000000-0000-4000-8000-000000000002', masked: false, validFrom: '2024-01-01', validTo: '2025-05-31' })]);
    const withoutExport = renderPage('?tab=reports');

    const history = await screen.findByTestId('profile-history');
    expect(within(history).getAllByRole('listitem')).toHaveLength(2);
    expect(history).toHaveTextContent(text('ownerProfile.history.current'));
    expect(screen.queryByTestId('owner-issued-documents-section')).toBeNull();
    withoutExport.unmount();

    env.flags = { fiscalDocumentIssuance: true };
    renderPage('?tab=reports');
    expect(await screen.findByTestId('owner-issued-documents-section')).toBeInTheDocument();
    expect(await screen.findByTestId('profile-history')).toBeInTheDocument();
  });
});

describe('every section of the page is accessible', () => {
  it.each(['', '?tab=identity', '?tab=payments', '?tab=mandate', '?tab=rule', '?tab=reports'])('OwnerProfile_Section%s_HasNoAxeViolations', async (search) => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: null })]);
    api.listMandates.mockResolvedValue([mandate(), mandate({ id: 'c1000000-0000-4000-8000-000000000002', validFrom: '2023-01-01', validTo: '2023-12-31' })]);
    api.getAddress.mockResolvedValue({ ownerId: OWNER_ID, street: 'Via Nassa', buildingNumber: '5', postalCode: '6900', town: 'Lugano', province: null, country: 'CH' });
    renderPage(search);

    await screen.findByTestId('owner-tab-panel');
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
    await expectNoAxeViolations(document.body);
  });
});

describe('the profile is personal data, and nothing of it outlives the page (E06/F05/US02/T04)', () => {
  const full = () => profile({ masked: false, legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: 'IT60X0542811101000000123456' });
  const appClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  async function openNewVersion() {
    fireEvent.click(await screen.findByTestId('profile-new-version'));
    return screen.findByTestId('profile-dialog');
  }

  it('OwnerProfile_LeavingThePage_LeavesNoProfileInTheCacheOfTheQueries_NorTheFormInTheCacheOfTheMutations', async () => {
    api.listFiscalProfiles.mockResolvedValue([full()]);
    api.saveFiscalProfile.mockResolvedValue(full());
    const { client, unmount } = renderPage('', appClient());
    await screen.findByTestId('profile-focus');
    expect(client.getQueryCache().findAll({ queryKey: ['owner-accounting', 'profiles'] })).toHaveLength(1);

    const dialog = await openNewVersion();
    reviewProfile(dialog);
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));
    await waitFor(() => expect(api.saveFiscalProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('profile-dialog')).toBeNull());
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0));

    unmount();
    await waitFor(() => expect(client.getQueryCache().findAll({ queryKey: ['owner-accounting', 'profiles'] })).toHaveLength(0));
  });

  it('OwnerProfile_ARefusedSave_KeepsTheStatusAndTheCodeOfTheAnswer_AndNotTheBodyThatWasSent', async () => {
    const config = { data: JSON.stringify({ bankAccountReference: 'IT60X0542811101000000123456', fiscalCode: 'RSSMRT80A01H501U' }), headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    api.listFiscalProfiles.mockResolvedValue([full()]);
    api.saveFiscalProfile.mockRejectedValue(
      new AxiosError('Request failed with status code 422', 'ERR_BAD_REQUEST', config, undefined, {
        status: 422,
        statusText: 'Unprocessable Entity',
        headers: {},
        config,
        data: { code: 'owner_fiscal_profile_invalid', field: 'legalName' },
      }),
    );
    const { client } = renderPage('', appClient());

    const dialog = await openNewVersion();
    reviewProfile(dialog);
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));
    expect(await within(dialog).findByTestId('profile-dialog-error')).toHaveTextContent('legalName');

    const kept = client.getMutationCache().getAll()[0]?.state.error as AxiosError;
    expect(kept.response?.status).toBe(422);
    expect(kept.response?.data).toMatchObject({ code: 'owner_fiscal_profile_invalid', field: 'legalName' });
    expect(kept.config?.data).toBeUndefined();
    expect(JSON.stringify(kept.config)).not.toMatch(/IT60X|RSSMRT/);
  });
});

describe('what the page says when it cannot show the owner (E06/F05/US02/T04)', () => {
  it('OwnerProfile_AnOwnerThatDoesNotExist_IsNotFound_WithTheWayBackToTheMonth', async () => {
    api.listFiscalProfiles.mockRejectedValue(problem(404, 'owner_not_found'));
    renderPage('?period=2025-01');

    const notFound = await screen.findByTestId('profile-not-found');
    expect(notFound).toHaveTextContent(text('ownerProfile.notFound'));
    expect(within(notFound).getByRole('link')).toHaveAttribute('href', '/app/account/owner-close?period=2025-01');
    expect(screen.queryByTestId('owner-accounting-error')).toBeNull();
  });

  it('OwnerProfile_AFailureThatIsNotANotFound_IsToldWithTheWayToTryAgain', async () => {
    api.listFiscalProfiles.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }));
    renderPage();

    const failed = await screen.findByTestId('owner-accounting-error');
    expect(screen.queryByTestId('profile-not-found')).toBeNull();
    fireEvent.click(within(failed).getByRole('button', { name: text('shared.errorState.retry') }));
    await screen.findByTestId('profile-focus');
    expect(api.listFiscalProfiles).toHaveBeenCalledTimes(2);
  });

  it('OwnerProfile_TheListOfOwners_IsReadAgainEveryTimeThePageOpens', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60_000 }, mutations: { retry: false } } });
    const first = renderPage('', client);
    await screen.findByTestId('profile-focus');
    await waitFor(() => expect(screen.getAllByText(/Marta Rossi/).length).toBeGreaterThan(0));
    first.unmount();
    expect(api.listOwners).toHaveBeenCalledTimes(1);
    renderPage('', client);
    await screen.findByTestId('profile-focus');
    await waitFor(() => expect(api.listOwners).toHaveBeenCalledTimes(2));
  });
});

describe('the days a profile covers (E06/F05/US02/T04)', () => {
  async function openNewVersion() {
    fireEvent.click(await screen.findByTestId('profile-new-version'));
    return screen.findByTestId('profile-dialog');
  }

  it('OwnerProfile_TheFirstProfile_StartsByDefaultOnTheFirstDayOfTheMonthThatSentThePersonHere_AndWarnsThatItCannotBeMovedBack', async () => {
    api.listFiscalProfiles.mockResolvedValue([]);
    renderPage('?period=2025-01');

    const dialog = await openNewVersion();
    expect(within(dialog).getByTestId('profile-valid-from')).toHaveValue('2025-01-01');
    expect(dialog).toHaveTextContent(text('ownerProfile.dialog.validFromFirst'));
  });

  it('OwnerProfile_TheFirstProfile_WithoutAMonth_StartsOnTheFirstDayOfTheMonthToClose', async () => {
    api.listFiscalProfiles.mockResolvedValue([]);
    renderPage();

    const dialog = await openNewVersion();
    expect(within(dialog).getByTestId('profile-valid-from')).toHaveValue(startOfPeriod(defaultPeriod(todayInRome())));
  });

  it('OwnerProfile_ANewVersion_MustStartAfterTheLastOne_AndTheFormSaysSoBeforeTheServerRefusesIt', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, validFrom: '2025-06-01' })]);
    renderPage();

    const dialog = await openNewVersion();
    const from = within(dialog).getByTestId('profile-valid-from');
    expect(from).toHaveValue(todayInRome());
    expect(within(dialog).getByTestId('profile-dialog-submit')).toBeEnabled();

    fireEvent.change(from, { target: { value: '2025-06-01' } });
    expect(within(dialog).getByTestId('profile-dialog-submit')).toBeDisabled();
    expect(dialog).toHaveTextContent('1 giugno 2025');
    fireEvent.change(from, { target: { value: '2025-06-02' } });
    expect(within(dialog).getByTestId('profile-dialog-submit')).toBeEnabled();
    expect(api.saveFiscalProfile).not.toHaveBeenCalled();
  });

  it('OwnerProfile_DataThatStartAfterTheMonthThatSentThePersonHere_SayWhichMonthIsNotCovered_AndFromWhichDayTheyHold', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, validFrom: '2025-03-01' })]);
    api.listPolicies.mockResolvedValue([policy({ validFrom: '2025-01-01' })]);
    const { unmount } = renderPage('?period=2025-01');

    const focus = await screen.findByTestId('profile-focus');
    expect(focus).toHaveAttribute('data-tone', 'warning');
    expect(focus).toHaveAttribute('data-month-not-covered', 'true');
    expect(focus).toHaveTextContent('gennaio 2025');
    expect(focus).toHaveTextContent('1 marzo 2025');
    expect(screen.getByTestId('profile-status')).toHaveTextContent(text('ownerProfile.status.notCovered'));
    expect(screen.getAllByRole('region').filter((region) => region.getAttribute('data-tone') === 'success')).toHaveLength(0);
    unmount();

    renderPage('?period=2025-04');
    expect(await screen.findByTestId('profile-focus')).toHaveAttribute('data-tone', 'success');
    expect(screen.getByTestId('profile-focus')).not.toHaveAttribute('data-month-not-covered');
  });

  it('OwnerProfile_WithoutAMonth_SaysFromWhichDayTheDataHold_AndWarnsOfNothing', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, validFrom: '2025-03-01' })]);
    api.listPolicies.mockResolvedValue([policy({ validFrom: '2025-01-01' })]);
    renderPage();

    expect(await screen.findByTestId('profile-focus')).toHaveTextContent('1 marzo 2025');
    expect(screen.getByTestId('profile-focus')).toHaveAttribute('data-tone', 'success');
  });
});

describe('what a profile and a rule send to the server (E06/F05/US02/T04)', () => {
  it('OwnerProfile_SavingANewVersion_SendsWhatWasTypedAndStartsAfterTheLastOne', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: 'IT60X0542811101000000123456' })]);
    api.saveFiscalProfile.mockResolvedValue(profile({ masked: false }));
    renderPage();

    fireEvent.click(await screen.findByTestId('profile-new-version'));
    const dialog = await screen.findByTestId('profile-dialog');
    fireEvent.change(within(dialog).getByTestId('profile-legal-name'), { target: { value: ' Marta Rossi Bianchi ' } });
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));
    fireEvent.change(within(dialog).getByTestId('profile-iban'), { target: { value: 'IT60X0542811101000000123457' } });
    reviewProfile(dialog);
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));

    await waitFor(() => expect(api.saveFiscalProfile).toHaveBeenCalledTimes(1));
    expect(api.saveFiscalProfile.mock.calls[0][0]).toBe(OWNER_ID);
    expect(api.saveFiscalProfile.mock.calls[0][1]).toMatchObject({
      validFrom: todayInRome(),
      entityKind: 'NaturalPerson',
      legalName: 'Marta Rossi Bianchi',
      fiscalCode: 'RSSMRT80A01H501U',
      bankAccountReference: 'IT60X0542811101000000123457',
      taxResidenceCountry: 'IT',
      settlementCurrency: 'EUR',
      taxJurisdiction: 'IT',
      accountingPolicyId: policy().id,
    });
  });

  it('OwnerProfile_ANewRule_SendsTheParametersTheAccountantGave_AndTheServerKeepsItNotApproved', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
    api.createPolicy.mockResolvedValue(policy({ approved: false, approvedAt: null, approvedByName: null }));
    renderPage('?tab=rule');

    fireEvent.click(await screen.findByTestId('policy-new'));
    const dialog = await screen.findByTestId('policy-dialog');
    const type = (id: string, value: string) => fireEvent.change(within(dialog).getByTestId(id), { target: { value } });
    type('policy-jurisdiction', 'it');
    type('policy-rule-code', 'IT-X');
    type('policy-version', '2026.1');
    type('policy-source-url', 'https://example.org/rule');
    type('policy-source-sha', 'E'.repeat(64));
    fireEvent.click(within(dialog).getByTestId('policy-withholding'));
    type('policy-rate', '21,5');
    type('policy-tax-code', 'TC-9');
    type('policy-components', 'rent, cleaning');
    type('policy-rounding', 'half_up');
    type('policy-retention', '10');
    fireEvent.click(within(dialog).getByTestId('policy-dialog-submit'));

    await waitFor(() => expect(api.createPolicy).toHaveBeenCalledTimes(1));
    expect(api.createPolicy.mock.calls[0][0]).toEqual({
      jurisdiction: 'IT',
      ruleCode: 'IT-X',
      version: '2026.1',
      validFrom: todayInRome(),
      sourceUrl: 'https://example.org/rule',
      sourceSha256: 'e'.repeat(64),
      parameters: {
        withholdingApplies: true,
        withholdingRatePercent: 21.5,
        withholdingTaxCode: 'TC-9',
        requiresAgencyCollection: true,
        requiresQualifyingShortLet: true,
        grossBaseComponents: ['rent', 'cleaning'],
        rounding: 'half_up',
        retentionYears: 10,
      },
    });
    expect(api.approvePolicy).not.toHaveBeenCalled();
  });

  it('OwnerProfile_ARuleThatIsNotComplete_IsNotSent', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
    renderPage('?tab=rule');

    fireEvent.click(await screen.findByTestId('policy-new'));
    const dialog = await screen.findByTestId('policy-dialog');
    expect(within(dialog).getByTestId('policy-dialog-submit')).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('policy-jurisdiction'), { target: { value: 'IT' } });
    fireEvent.change(within(dialog).getByTestId('policy-rule-code'), { target: { value: 'IT-X' } });
    fireEvent.change(within(dialog).getByTestId('policy-version'), { target: { value: '1' } });
    expect(within(dialog).getByTestId('policy-dialog-submit')).toBeDisabled();
    expect(api.createPolicy).not.toHaveBeenCalled();
  });
});

describe('the owner profile guided journey (#913)', () => {
  it('shows one section at a time, retains edits when going back and saves only after review', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, legalName: 'Marta Rossi' })]);
    api.saveFiscalProfile.mockResolvedValue(profile({ masked: false }));
    renderPage();
    fireEvent.click(await screen.findByTestId('profile-new-version'));
    const dialog = await screen.findByTestId('profile-dialog');
    expect(within(dialog).queryByTestId('profile-iban')).toBeNull();
    fireEvent.change(within(dialog).getByTestId('profile-legal-name'), { target: { value: 'Marta Bianchi' } });
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));
    expect(within(dialog).queryByTestId('profile-legal-name')).toBeNull();
    expect(within(dialog).getByTestId('profile-country')).toBeInTheDocument();
    fireEvent.change(within(dialog).getByTestId('profile-country'), { target: { value: 'I' } });
    expect(within(dialog).getByTestId('profile-dialog-submit')).toBeDisabled();
    expect(dialog).toHaveTextContent(text('ownerProfile.dialog.countryInvalid'));
    fireEvent.change(within(dialog).getByTestId('profile-country'), { target: { value: 'IT' } });
    fireEvent.click(within(dialog).getByTestId('profile-back'));
    expect(within(dialog).getByTestId('profile-legal-name')).toHaveValue('Marta Bianchi');
    reviewProfile(dialog);
    expect(api.saveFiscalProfile).not.toHaveBeenCalled();
    expect(within(dialog).getByTestId('profile-review')).toHaveTextContent('Marta Bianchi');
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));
    await waitFor(() => expect(api.saveFiscalProfile).toHaveBeenCalledTimes(1));
    expect(api.saveFiscalProfile.mock.calls[0][1]).toMatchObject({ legalName: 'Marta Bianchi' });
  });
});
