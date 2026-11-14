import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import i18n from '@/i18n/config';
import { todayInRome } from '@/lib/stay-dates';
import { OWNER_ID, policy, profile } from '@/features/owner-accounting/__tests__/owner-accounting-fixtures';
import { defaultPeriod, maskValue, OWNER_ONBOARDING_PATH, startOfPeriod } from '@/features/owner-accounting/owner-accounting-model';
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

vi.mock('@/api/owner-accounting.api', () => ({ ownerAccountingApi: api }));
vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
const workspace = vi.hoisted(() => ({ contexts: [{ contextKey: 'account', roleKey: 'org_admin' }] }));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: workspace.contexts }) }));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title, primary }: { title: string; primary?: { label: string; onClick?: () => void; testId?: string } }) =>
    createElement('div', null, createElement('h1', null, title), primary ? createElement('button', { type: 'button', onClick: primary.onClick, 'data-testid': primary.testId }, primary.label) : null),
}));

vi.setConfig({ testTimeout: 30_000 });

const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

/** `search` is the query of the address (`?period=2025-01`, from the month-end close); `client` is the one of the app unless a test wants its own. */
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

/** What the server answers to a refusal: the status and the problem with its code. */
const problem = (status: number, code: string) => Object.assign(new Error(code), { isAxiosError: true, response: { status, data: { code } } });

beforeEach(async () => {
  vi.resetAllMocks();
  workspace.contexts = [{ contextKey: 'account', roleKey: 'org_admin' }];
  await i18n.changeLanguage('it');
  api.listOwners.mockResolvedValue([{ id: OWNER_ID, firstName: 'Marta', lastName: 'Rossi' }]);
  api.getOnboardingReadiness.mockResolvedValue(null);
  api.listFiscalProfiles.mockResolvedValue([profile()]);
  api.listPolicies.mockResolvedValue([policy()]);
  // The mandate and the address of the owner (E13/F02/US01/T01) are read by the page too: none here.
  api.listMandates.mockResolvedValue([]);
  api.getAddress.mockResolvedValue(null);
});

afterEach(() => cleanup());

describe('the financial profile of an owner (E06/F05/US02/T01, T04)', () => {
  it('OwnerProfile_UnauthorizedRole_SeesOnlyMaskedData_AndCanNeitherRevealNorEdit', async () => {
    renderPage();
    const facts = await screen.findByTestId('profile-facts');

    // The identifiers, the address and the account are exactly what the server answered: masked. There is no control that asks for more.
    expect(facts.querySelector('dl')).toHaveAttribute('data-masked', 'true');
    expect(within(facts).getByTestId('profile-value-fiscalCode')).toHaveTextContent('••••••••••••3456');
    expect(within(facts).getByTestId('profile-value-bankAccountReference')).toHaveTextContent('•••••••••••••••••••••3456');
    expect(within(facts).getByTestId('profile-value-legalName')).toHaveTextContent('•••••••••ossi');
    expect(screen.queryByTestId('profile-reveal')).toBeNull();
    expect(screen.getByTestId('profile-masked-notice')).toHaveTextContent(text('ownerProfile.maskedNotice'));
    // Who sees masked values may not change the profile either: no way to save a new version.
    expect(screen.queryByTestId('profile-new-version')).toBeNull();
    expect(screen.queryByTestId('policy-new')).toBeNull();
    // The page never asks for more: nothing here reads the full IBAN of the registry or writes anything.
    expect(Object.keys(api)).not.toContain('getOwnerIban');
    for (const write of [api.saveFiscalProfile, api.approvePolicy, api.createPolicy]) expect(write).not.toHaveBeenCalled();
  });

  it('OwnerProfile_AuthorizedRole_SeesTheValuesMaskedUntilTheyAskForThem', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: 'IT60X0542811101000000123456', legalName: 'Marta Rossi' })]);
    renderPage();
    const facts = await screen.findByTestId('profile-facts');

    // Received in full, shown masked: a screen left open does not show the IBAN of the owner.
    expect(within(facts).getByTestId('profile-value-fiscalCode')).toHaveTextContent(maskValue('RSSMRT80A01H501U') as string);
    expect(within(facts).getByTestId('profile-value-fiscalCode')).not.toHaveTextContent('RSSMRT80A01H501U');
    expect(within(facts).getByTestId('profile-value-bankAccountReference')).not.toHaveTextContent('IT60X0542811101000000123456');

    const reveal = within(facts).getByTestId('profile-reveal');
    expect(reveal).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(reveal);
    expect(within(facts).getByTestId('profile-value-bankAccountReference')).toHaveTextContent('IT60X0542811101000000123456');
    expect(within(facts).getByTestId('profile-value-fiscalCode')).toHaveTextContent('RSSMRT80A01H501U');

    fireEvent.click(within(facts).getByTestId('profile-reveal'));
    expect(within(facts).getByTestId('profile-value-bankAccountReference')).not.toHaveTextContent('IT60X0542811101000000123456');
    expect(screen.getByTestId('profile-new-version')).toBeInTheDocument();
  });

  it('OwnerProfile_ARuleNotApprovedYet_BlocksTheOwner_AndTheAccountantApprovalIsRecordedByName', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false })]);
    api.listPolicies.mockResolvedValue([policy({ approved: false, approvedAt: null, approvedByName: null })]);
    api.approvePolicy.mockResolvedValue(policy());
    renderPage();

    const focus = await screen.findByTestId('profile-focus');
    expect(focus).toHaveAttribute('data-tone', 'warning');
    expect(focus).toHaveTextContent(text('ownerProfile.focus.blocked.policy_not_approved.title'));
    expect(screen.getByTestId('policy-approval')).toHaveTextContent(text('ownerProfile.policy.waiting'));

    fireEvent.click(screen.getByTestId('profile-focus-approve'));
    const dialog = await screen.findByRole('dialog');
    const confirm = within(dialog).getByRole('button', { name: text('ownerProfile.approveDialog.confirm') });
    // CasaZen does not approve a rule: it records who did. Without a name nothing is sent.
    expect(confirm).toBeDisabled();
    fireEvent.change(within(dialog).getByTestId('policy-approver'), { target: { value: 'Dott. Bianchi' } });
    fireEvent.click(confirm);

    await waitFor(() => expect(api.approvePolicy).toHaveBeenCalledWith('b1000000-0000-4000-8000-000000000001', 'Dott. Bianchi'));
  });

  it('OwnerProfile_AProfileWithAnApprovedRule_IsReady_AndSaysWhoApprovedIt', async () => {
    renderPage();
    const focus = await screen.findByTestId('profile-focus');

    expect(focus).toHaveAttribute('data-tone', 'success');
    expect(focus).toHaveTextContent('Dott. Bianchi');
    expect(screen.getByTestId('profile-policy-section')).toHaveTextContent(text('ownerProfile.policy.approved'));
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
    // A reason of a later version is told by its code, never dropped.
    expect(section).toHaveTextContent(text('ownerProfile.reason.other', { code: 'something_new' }));
    expect(within(section).getByTestId('profile-onboarding-link')).toHaveAttribute('href', OWNER_ONBOARDING_PATH);

    // The periods where the shares of the property are wrong, with what they add up to.
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

  it('OwnerProfile_NotTheFinanceAdministrator_IsToldWhoToAsk_AndNothingIsRead', async () => {
    // The protection of the page is the role, checked before anything is read: a refused read is taken by the global handler of the app, never by the page.
    workspace.contexts = [{ contextKey: 'account', roleKey: 'org_manager' }];
    renderPage();

    expect(await screen.findByTestId('finance-admin-required')).toBeInTheDocument();
    for (const call of Object.values(api)) expect(call).not.toHaveBeenCalled();
  });
});

describe('the profile is personal data, and nothing of it outlives the page (E06/F05/US02/T04)', () => {
  const full = () => profile({ masked: false, legalName: 'Marta Rossi', fiscalCode: 'RSSMRT80A01H501U', bankAccountReference: 'IT60X0542811101000000123456' });
  /** The cache of the app: minutes for a query, minutes for a mutation. A query or a mutation that wants less says so itself. */
  const appClient = () => new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });

  async function openNewVersion() {
    fireEvent.click(await screen.findByTestId('profile-new-version'));
    return screen.findByTestId('profile-dialog');
  }

  it('OwnerProfile_LeavingThePage_LeavesNoProfileInTheCacheOfTheQueries_NorTheFormInTheCacheOfTheMutations', async () => {
    api.listFiscalProfiles.mockResolvedValue([full()]);
    api.saveFiscalProfile.mockResolvedValue(full());
    const { client, unmount } = renderPage('', appClient());
    await screen.findByTestId('profile-facts');
    // While the page is open the profile is there: it is what the page shows.
    expect(client.getQueryCache().findAll({ queryKey: ['owner-accounting', 'profiles'] })).toHaveLength(1);

    const dialog = await openNewVersion();
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));
    await waitFor(() => expect(api.saveFiscalProfile).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.queryByTestId('profile-dialog')).toBeNull());
    // The form is closed: the command with the identifiers, the address and the bank account is not kept by the mutations.
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
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));
    // The form still says what the server said (the field it names)...
    expect(await within(dialog).findByTestId('profile-dialog-error')).toHaveTextContent('legalName');

    // ...and what the cache of the mutations keeps of the failure is the answer, never the request: no identifier, no bank account.
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
    // It is not a failure to try again: no retry is offered for what does not exist.
    expect(screen.queryByTestId('owner-accounting-error')).toBeNull();
  });

  it('OwnerProfile_AFailureThatIsNotANotFound_IsToldWithTheWayToTryAgain', async () => {
    api.listFiscalProfiles.mockRejectedValueOnce(Object.assign(new Error('Network Error'), { isAxiosError: true, code: 'ERR_NETWORK' }));
    renderPage();

    const failed = await screen.findByTestId('owner-accounting-error');
    expect(screen.queryByTestId('profile-not-found')).toBeNull();
    fireEvent.click(within(failed).getByRole('button', { name: text('shared.errorState.retry') }));
    await screen.findByTestId('profile-facts');
    expect(api.listFiscalProfiles).toHaveBeenCalledTimes(2);
  });

  it('OwnerProfile_TheListOfOwners_IsReadAgainEveryTimeThePageOpens', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 5 * 60_000 }, mutations: { retry: false } } });
    const first = renderPage('', client);
    await screen.findByTestId('profile-facts');
    await waitFor(() => expect(screen.getAllByText(/Marta Rossi/).length).toBeGreaterThan(0));
    first.unmount();
    expect(api.listOwners).toHaveBeenCalledTimes(1);
    renderPage('', client);
    await screen.findByTestId('profile-facts');
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
    // Not today: a profile that starts today leaves the month that is over without a profile, and it cannot be moved back later.
    expect(within(dialog).getByTestId('profile-valid-from')).toHaveValue(startOfPeriod(defaultPeriod(todayInRome())));
  });

  it('OwnerProfile_ANewVersion_MustStartAfterTheLastOne_AndTheFormSaysSoBeforeTheServerRefusesIt', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, validFrom: '2025-06-01' })]);
    renderPage();

    const dialog = await openNewVersion();
    const from = within(dialog).getByTestId('profile-valid-from');
    expect(from).toHaveValue(todayInRome());
    expect(within(dialog).getByTestId('profile-dialog-submit')).toBeEnabled();

    // The day of the profile in force, or an earlier one: the server answers 409 (a profile cannot start on a day that is not later), and the form does not send it.
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

    // «Ready» is judged on today and says from which day it holds; the month that sent the person here, before that day, is said to be left out.
    expect(await screen.findByTestId('profile-focus')).toHaveTextContent('1 marzo 2025');
    const warning = await screen.findByTestId('profile-month-not-covered');
    expect(warning).toHaveTextContent('gennaio 2025');
    expect(warning).toHaveTextContent('1 marzo 2025');
    unmount();

    // A month the data cover, or no month at all (the page opened on its own): nothing to warn about.
    renderPage('?period=2025-04');
    await screen.findByTestId('profile-focus');
    expect(screen.queryByTestId('profile-month-not-covered')).toBeNull();
  });

  it('OwnerProfile_WithoutAMonth_SaysFromWhichDayTheDataHold_AndWarnsOfNothing', async () => {
    api.listFiscalProfiles.mockResolvedValue([profile({ masked: false, validFrom: '2025-03-01' })]);
    api.listPolicies.mockResolvedValue([policy({ validFrom: '2025-01-01' })]);
    renderPage();

    expect(await screen.findByTestId('profile-focus')).toHaveTextContent('1 marzo 2025');
    expect(screen.queryByTestId('profile-month-not-covered')).toBeNull();
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
    fireEvent.change(within(dialog).getByTestId('profile-iban'), { target: { value: 'IT60X0542811101000000123457' } });
    fireEvent.click(within(dialog).getByTestId('profile-dialog-submit'));

    // The form starts from the profile in force, and a new version starts today: the one in force ends the day before.
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
    renderPage();

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

    // Nothing is proposed by CasaZen: the rate, the code, the source and its fingerprint are the ones typed, and the rule goes with no approval.
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
    renderPage();

    fireEvent.click(await screen.findByTestId('policy-new'));
    const dialog = await screen.findByTestId('policy-dialog');
    expect(within(dialog).getByTestId('policy-dialog-submit')).toBeDisabled();
    // No source, no fingerprint, no rounding: the rule has nothing the accountant gave.
    fireEvent.change(within(dialog).getByTestId('policy-jurisdiction'), { target: { value: 'IT' } });
    fireEvent.change(within(dialog).getByTestId('policy-rule-code'), { target: { value: 'IT-X' } });
    fireEvent.change(within(dialog).getByTestId('policy-version'), { target: { value: '1' } });
    expect(within(dialog).getByTestId('policy-dialog-submit')).toBeDisabled();
    expect(api.createPolicy).not.toHaveBeenCalled();
  });
});
