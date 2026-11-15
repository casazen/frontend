import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { toast } from 'sonner';
import i18n from '@/i18n/config';
import * as api from '@/api/billing-setup.api';
import { accountantPackageApi } from '@/api/accountant-package.api';
import { DEFAULT_FEATURE_FLAGS } from '@/config/feature-flags';
import { useAgencyPlan } from '@/hooks/use-agency-plan';
import { ACCOUNTANT_PACKAGE_FOLDERS, type AccountantPackageEmailQueued, type AccountantPackageSettings } from '@/types';
import { BILLING_SETUP_PATH, FISCAL_PATH } from '../billing-wizard-ids';
import { BillingWizardPage } from '../billing-wizard-page';
import { previewOf, section, swissSetup } from './billing-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/api/billing-setup.api', () => ({
  getBillingSetup: vi.fn(),
  saveBillingSetupSection: vi.fn(),
  canChangeBillingSetup: vi.fn(),
  savePortalAccountSettings: vi.fn(),
  getChannelAccountHolders: vi.fn(),
  saveChannelAccountHolders: vi.fn(),
  getChannelCommissionRules: vi.fn(),
  saveChannelCommissionRules: vi.fn(),
  applyMandateTemplate: vi.fn(),
  getBillingPreview: vi.fn(),
}));
// The three calls of the settings of the send to the accountant are replaced; the rest of the module (the reader of the 422 «too large») is the real one.
vi.mock('@/api/accountant-package.api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/api/accountant-package.api')>();
  return { ...actual, accountantPackageApi: { ...actual.accountantPackageApi, getSettings: vi.fn(), updateSettings: vi.fn(), sendTest: vi.fn() } };
});
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1', name: 'Casa Lugano SA' } }),
}));
vi.mock('@/components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: ReactNode }) => createElement('div', null, children),
}));
vi.mock('@/components/layout/page-header', () => ({
  PageHeader: ({ title }: { title: string }) => createElement('h1', null, title),
}));

const env = vi.hoisted(() => ({
  flags: {} as Record<string, boolean>,
  contexts: [] as Array<{ contextKey: string; roleKey: string }>,
  hasPermission: (() => true) as (context: string, permission: string) => boolean,
}));
vi.mock('@/hooks/use-workspace', () => ({
  useWorkspace: () => ({ contexts: env.contexts, getDefaultRoute: (contextKey: string) => `/app/${contextKey}`, hasPermission: env.hasPermission }),
}));
vi.mock('@/hooks/use-feature-flags', () => ({
  useFeatureFlags: () => ({ flags: { ...DEFAULT_FEATURE_FLAGS, fiscalDocumentIssuance: true, ...env.flags }, isLoading: false }),
}));
// The plan and the listings are only asked for the administrator of an organization (the agency's steps): the plan is whatever the test says, and there are no listings.
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: vi.fn() }));
vi.mock('@/queries/use-properties', () => ({
  useProperties: () => ({ data: [], isPending: false, isError: false, error: null, refetch: vi.fn() }),
}));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };

const getSettings = vi.mocked(accountantPackageApi.getSettings);
const updateSettings = vi.mocked(accountantPackageApi.updateSettings);
const sendTest = vi.mocked(accountantPackageApi.sendTest);

/** What the server answers for an organization that saved nothing: no address, the send off, the day 3 and every folder. */
const NOTHING_SAVED: AccountantPackageSettings = { enabled: false, email: null, sendDay: 3, contents: [...ACCOUNTANT_PACKAGE_FOLDERS], lastSend: null, updatedAt: null };

/** An organization that sends every month, from the 7th, two folders, to an address, and whose last send went out on 3 November for October. */
const SAVED: AccountantPackageSettings = {
  enabled: true,
  email: 'studio@esempio.it',
  sendDay: 7,
  contents: ['guestDocuments', 'collections'],
  lastSend: { period: '2026-10', at: '2026-11-03T05:00:00Z', result: 'sent', error: null },
  updatedAt: '2026-11-03T09:00:00Z',
};

const ADDRESS = 'studio@esempio.it';

/** The administrator of the organization (the owner of the account context) and a collaborator who writes the setup but does not administer the organization. */
const ADMIN = [{ contextKey: 'account', roleKey: 'org_owner' }];
const COLLABORATOR = [{ contextKey: 'short-rent', roleKey: 'property_manager' }];

/** A refusal of the server, with the body that was sent (an error of axios holds it in its `config`). */
function refusal(status: number, data: unknown, sent?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), data: sent === undefined ? undefined : JSON.stringify(sent) } as InternalAxiosRequestConfig;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, undefined, { status, statusText: '', headers: {}, config, data });
}

function renderWizard(step = 'accountant') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  render(
    createElement(
      QueryClientProvider,
      { client },
      createElement(
        MemoryRouter,
        { initialEntries: [`${BILLING_SETUP_PATH}?step=${step}`] },
        createElement(
          Routes,
          null,
          createElement(Route, { path: BILLING_SETUP_PATH, element: createElement(BillingWizardPage) }),
          createElement(Route, { path: FISCAL_PATH, element: createElement('div', { 'data-testid': 'fiscal-home' }) }),
        ),
      ),
    ),
  );
  return { client };
}

const wizard = () => screen.getByTestId('fiscal-billing-wizard');
const text = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

async function onStep(step: string) {
  await waitFor(() => expect(wizard()).toHaveAttribute('data-step', step), WAIT);
}

/** The step with its form on screen: the settings are read. */
async function formOpen() {
  await onStep('accountant');
  await waitFor(() => expect(screen.getByTestId('billing-accountant-email')).toBeInTheDocument(), WAIT);
}

/** «Continua», once the button is enabled: a click on a button that is still switched off does nothing, and the test would then wait for a step that never comes. */
async function next() {
  await waitFor(() => expect(screen.getByTestId('fiscal-billing-next')).toBeEnabled(), WAIT);
  fireEvent.click(screen.getByTestId('fiscal-billing-next'));
}

async function pressTest() {
  await waitFor(() => expect(screen.getByTestId('billing-accountant-test-button')).toBeEnabled(), WAIT);
  fireEvent.click(screen.getByTestId('billing-accountant-test-button'));
}

const write = (value: string) => fireEvent.change(screen.getByTestId('billing-accountant-email'), { target: { value } });
const turnMonthlyOn = () => fireEvent.click(screen.getByTestId('billing-accountant-monthly'));

beforeEach(async () => {
  vi.resetAllMocks();
  await i18n.changeLanguage('it');
  env.flags = { accountantPackage: true };
  env.contexts = COLLABORATOR;
  env.hasPermission = () => true;
  vi.mocked(useAgencyPlan).mockReturnValue({ isAgency: false, isLoading: false, failed: false, retry: vi.fn() });
  vi.mocked(api.getChannelCommissionRules).mockResolvedValue({ rules: [], channels: [] });
  vi.mocked(api.getChannelAccountHolders).mockResolvedValue([]);
  vi.mocked(api.getBillingSetup).mockResolvedValue(swissSetup());
  vi.mocked(api.getBillingPreview).mockResolvedValue(previewOf(undefined));
  vi.mocked(api.canChangeBillingSetup).mockResolvedValue(true);
  vi.mocked(api.saveBillingSetupSection).mockImplementation(async (name) => section(name, {}));
  getSettings.mockResolvedValue(NOTHING_SAVED);
  updateSettings.mockImplementation(async (body) => ({ ...body, lastSend: null, updatedAt: '2026-11-15T10:00:00Z' }));
  sendTest.mockResolvedValue({ period: '2026-10', queued: true, linkExpiresAt: '2026-12-14T05:00:00Z' });
});

afterEach(() => {
  cleanup();
});

describe('the step «Commercialista» of the wizard «Fatturazione» (E15/F02/US02/T01)', () => {
  it('AccountantStep_FlagOn_IsInTheListOfTheStepsAndShowsWhatTheServerHas', async () => {
    getSettings.mockResolvedValue(SAVED);
    renderWizard();
    await formOpen();

    // The step has its own title, and the wizard says it is optional.
    expect(screen.getByRole('heading', { name: text('billingWizard.steps.accountant.title') })).toBeInTheDocument();
    expect(screen.getByText(text('billingWizard.steps.accountant.purpose'))).toBeInTheDocument();
    expect(screen.getByTestId('billing-accountant-email')).toHaveValue(ADDRESS);
    expect(screen.getByTestId('billing-accountant-monthly')).toBeChecked();
    expect(screen.getByTestId('billing-accountant-day')).toHaveValue('7');
    expect(screen.getByTestId('billing-accountant-folder-guestDocuments')).toBeChecked();
    expect(screen.getByTestId('billing-accountant-folder-collections')).toBeChecked();
    expect(screen.getByTestId('billing-accountant-folder-touristTax')).not.toBeChecked();
    // The last send is told with its month and its day; the answer of the queue is not a delivery, and the page does not say it was.
    expect(screen.getByTestId('billing-accountant-last-send')).toHaveAttribute('data-result', 'sent');
    expect(screen.getByTestId('billing-accountant-last-send')).toHaveTextContent('ottobre 2026');
  });

  it('AccountantStep_NothingTouched_ContinuaSavesNothingAndTheSummaryNeverWritesTheAddress', async () => {
    getSettings.mockResolvedValue(SAVED);
    renderWizard();
    await formOpen();

    await next();
    await onStep('summary');
    expect(updateSettings).not.toHaveBeenCalled();
    expect(sendTest).not.toHaveBeenCalled();
    // The row of the summary says what is saved, without the address of a third party.
    const summary = within(screen.getByTestId('billing-step-summary'));
    expect(summary.getByText(text('billingWizard.summary.items.accountant'))).toBeInTheDocument();
    expect(summary.getByText(text('billingWizard.summary.accountant.monthly', { day: 7 }))).toBeInTheDocument();
    expect(document.body.textContent).not.toContain(ADDRESS);
  });

  it('AccountantStep_AnAddressAndTheMonthlySend_ContinuaSendsOneWholeSaveAndMovesOn', async () => {
    renderWizard();
    await formOpen();

    write(`  ${ADDRESS} `);
    turnMonthlyOn();
    await waitFor(() => expect(screen.getByTestId('billing-accountant-day')).toBeInTheDocument(), WAIT);
    fireEvent.change(screen.getByTestId('billing-accountant-day'), { target: { value: '10' } });
    fireEvent.click(screen.getByTestId('billing-accountant-folder-touristTax'));
    await next();
    await onStep('summary');

    expect(updateSettings).toHaveBeenCalledTimes(1);
    // The settings go together, as a whole: the address cut at its ends, the day and the folders as they are now (the folder that was ticked is out; this person may not choose the owner folders).
    expect(updateSettings.mock.calls[0][0]).toEqual({ enabled: true, email: ADDRESS, sendDay: 10, contents: ['guestDocuments', 'collections'] });
    expect(within(screen.getByTestId('billing-step-summary')).getByText(text('billingWizard.summary.accountant.monthly', { day: 10 }))).toBeInTheDocument();
    // Nothing of the settings of the send is saved as a section of the billing setup.
    expect(api.saveBillingSetupSection).not.toHaveBeenCalledWith('accountant', expect.anything());
  });

  it('AccountantStep_TheMonthlySendWithNoAddress_StopsOnTheFieldAndSendsNothingUntilThereIsOne', async () => {
    renderWizard();
    await formOpen();

    turnMonthlyOn();
    await next();
    // The message is on the field, and the summary of the problems of the step says it too.
    await waitFor(() => expect(screen.getAllByText(text('billingWizard.errors.accountantEmailMissing')).length).toBeGreaterThan(0), WAIT);
    expect(wizard()).toHaveAttribute('data-step', 'accountant');
    expect(updateSettings).not.toHaveBeenCalled();

    // The address is written: the problem goes and the step is saved.
    write(ADDRESS);
    await waitFor(() => expect(screen.queryAllByText(text('billingWizard.errors.accountantEmailMissing'))).toHaveLength(0), WAIT);
    await next();
    await onStep('summary');
    expect(updateSettings).toHaveBeenCalledTimes(1);
  });

  it('AccountantStep_NoFolderAtAll_IsAProblemOfTheFoldersAndNothingIsSent', async () => {
    getSettings.mockResolvedValue({ ...SAVED, contents: ['touristTax'] });
    renderWizard();
    await formOpen();

    fireEvent.click(screen.getByTestId('billing-accountant-folder-touristTax'));
    await next();
    await waitFor(() => expect(screen.getByTestId('billing-accountant-contents-error')).toHaveTextContent(text('billingWizard.errors.accountantContents')), WAIT);
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('AccountantStep_ARefusalThatNamesAField_IsShownOnThatFieldAndTheStepStays', async () => {
    updateSettings.mockRejectedValue(refusal(422, { code: 'accountant_package_recipient_invalid' }, { email: ADDRESS }));
    renderWizard();
    await formOpen();

    write(ADDRESS);
    await next();
    await waitFor(() => expect(screen.getAllByText(text('billingWizard.errors.accountantEmail')).length).toBeGreaterThan(0), WAIT);
    expect(wizard()).toHaveAttribute('data-step', 'accountant');
    // What was typed is still there.
    expect(screen.getByTestId('billing-accountant-email')).toHaveValue(ADDRESS);
  });

  // Privacy rule: the address of the accountant is the personal data of a third party. A refused save keeps the answer of the server and not the request that carried the address, and nothing
  // of the mutation outlives the page (`gcTime: 0`).
  it('AccountantStep_ARefusedSave_KeepsNeitherTheAddressNorTheRequestAndNothingOutlivesThePage', async () => {
    updateSettings.mockRejectedValue(refusal(422, { code: 'accountant_package_recipient_invalid' }, { email: ADDRESS }));
    const { client } = renderWizard();
    await formOpen();

    write(ADDRESS);
    await next();
    await waitFor(() => expect(screen.getAllByText(text('billingWizard.errors.accountantEmail')).length).toBeGreaterThan(0), WAIT);

    const errors = client.getMutationCache().getAll().flatMap((mutation) => (mutation.state.error ? [mutation.state.error] : []));
    expect(errors.length).toBeGreaterThan(0);
    for (const error of errors) {
      expect(error).toBeInstanceOf(AxiosError);
      expect((error as AxiosError).config?.data).toBeUndefined();
      expect((error as AxiosError).response?.status).toBe(422);
      expect(JSON.stringify(error)).not.toContain(ADDRESS);
    }
    // The address is in the form of the page and nowhere else: not in the address of the page, not in the browser's storage.
    expect(window.location.href).not.toContain('studio');
    expect(JSON.stringify({ ...localStorage })).not.toContain(ADDRESS);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(ADDRESS);

    cleanup();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0), WAIT);
  });

  it('AccountantStep_SaveAndExit_KeepsWhatHoldsTogetherAndSaysThatTheRestWasLeftOut', async () => {
    getSettings.mockResolvedValue({ ...SAVED, lastSend: null });
    renderWizard();
    await formOpen();

    // The address is not a plain one: it is not kept. The day is.
    write('non-un-indirizzo');
    fireEvent.change(screen.getByTestId('billing-accountant-day'), { target: { value: '12' } });
    await waitFor(() => expect(screen.getByTestId('billing-save-exit')).toBeEnabled(), WAIT);
    fireEvent.click(screen.getByTestId('billing-save-exit'));
    await screen.findByTestId('fiscal-home', undefined, WAIT);

    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0][0]).toEqual({ enabled: true, email: ADDRESS, sendDay: 12, contents: ['guestDocuments', 'collections'] });
    expect(toast.warning).toHaveBeenCalledWith(text('billingWizard.exit.savedPartly'));
    expect(toast.success).not.toHaveBeenCalled();
  });
});

describe('«Invia una prova» (E15/F02/US02/T01)', () => {
  it('AccountantTest_WhatIsOnScreenIsSavedFirstAndThenTheTestIsAsked_AndTheAnswerIsToldAsQueuedNeverAsDelivered', async () => {
    renderWizard();
    await formOpen();

    write(ADDRESS);
    turnMonthlyOn();
    await pressTest();

    const result = await screen.findByTestId('billing-accountant-test-result', undefined, WAIT);
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(sendTest).toHaveBeenCalledTimes(1);
    // The test goes to the address that is SAVED: the address of the screen is saved first, so the e-mail never goes to an older one.
    expect(updateSettings.mock.invocationCallOrder[0]).toBeLessThan(sendTest.mock.invocationCallOrder[0]);
    expect(updateSettings.mock.calls[0][0]).toMatchObject({ enabled: true, email: ADDRESS });
    expect(result).toHaveTextContent('ottobre 2026');
    expect(result).toHaveTextContent('14 dicembre 2026');
    expect(result).toHaveTextContent(/in coda/i);
    expect(result).not.toHaveTextContent(/consegnat|recapitat/i);

    // The settings are read again (the month sent is recorded), and what the person typed is still what they typed.
    await waitFor(() => expect(getSettings.mock.calls.length).toBeGreaterThan(1), WAIT);
    expect(screen.getByTestId('billing-accountant-email')).toHaveValue(ADDRESS);
  });

  it('AccountantTest_ASavedAddressAndNothingChanged_AsksTheTestWithNoSave', async () => {
    getSettings.mockResolvedValue(SAVED);
    renderWizard();
    await formOpen();

    await pressTest();
    await screen.findByTestId('billing-accountant-test-result', undefined, WAIT);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(sendTest).toHaveBeenCalledTimes(1);
  });

  it('AccountantTest_NoAddress_SaysSoOnTheFieldAndSendsNothing', async () => {
    renderWizard();
    await formOpen();

    await pressTest();
    await waitFor(() => expect(screen.getAllByText(text('billingWizard.errors.accountantEmailNeeded')).length).toBeGreaterThan(0), WAIT);
    expect(updateSettings).not.toHaveBeenCalled();
    expect(sendTest).not.toHaveBeenCalled();
    expect(screen.queryByTestId('billing-accountant-test-result')).not.toBeInTheDocument();
  });

  it('AccountantTest_TheServerSaysNothingWentOut_IsAFailureWithItsWordsAndNeverASuccess', async () => {
    getSettings.mockResolvedValue(SAVED);
    sendTest.mockRejectedValue(refusal(422, { code: 'accountant_package_not_sent' }));
    renderWizard();
    await formOpen();

    await pressTest();
    const failure = await screen.findByTestId('billing-accountant-test-failure', undefined, WAIT);
    expect(failure).toHaveTextContent(text('apiErrors.codes.accountantPackageNotSent'));
    expect(screen.queryByTestId('billing-accountant-test-result')).not.toBeInTheDocument();
  });

  it('AccountantTest_ACallThatEndedWithNoAnswerFromTheServer_AdmitsThatItCannotTellAndSendsThePersonToTheLastSend', async () => {
    getSettings.mockResolvedValue(SAVED);
    sendTest.mockRejectedValue(refusal(500, {}));
    renderWizard();
    await formOpen();

    await pressTest();
    const failure = await screen.findByTestId('billing-accountant-test-failure', undefined, WAIT);
    expect(failure).toHaveTextContent(text('billingWizard.accountant.test.failed'));
    expect(screen.queryByTestId('billing-accountant-test-result')).not.toBeInTheDocument();
  });

  it('AccountantTest_ThePackageIsTooLarge_SaysHowManyFilesItWouldHoldAndHowManyOneAllows', async () => {
    getSettings.mockResolvedValue(SAVED);
    sendTest.mockRejectedValue(refusal(422, { code: 'accountant_package_too_large', fileCount: 5200, maxFiles: 5000 }));
    renderWizard();
    await formOpen();

    await pressTest();
    const failure = await screen.findByTestId('billing-accountant-test-failure', undefined, WAIT);
    expect(failure).toHaveTextContent(text('billingWizard.accountant.test.tooLargeCount', { files: 5200, max: 5000 }));
  });

  // Defect class «a button is pressed while another request of the card is on its way»: while the test is on its way nothing else of the wizard can start a request.
  it('AccountantTest_WhileItIsOnItsWay_TheTestTheWayOnAndTheWayOutTakeNoSecondPress', async () => {
    getSettings.mockResolvedValue(SAVED);
    let answer: (queued: AccountantPackageEmailQueued) => void = () => undefined;
    sendTest.mockReturnValue(
      new Promise<AccountantPackageEmailQueued>((resolve) => {
        answer = resolve;
      }),
    );
    renderWizard();
    await formOpen();

    await pressTest();
    await waitFor(() => expect(screen.getByTestId('billing-accountant-test-preparing')).toBeInTheDocument(), WAIT);
    expect(screen.getByTestId('billing-accountant-test-button')).toBeDisabled();
    expect(screen.getByTestId('fiscal-billing-next')).toBeDisabled();
    expect(screen.getByTestId('billing-save-exit')).toBeDisabled();
    expect(sendTest).toHaveBeenCalledTimes(1);

    answer({ period: '2026-10', queued: true, linkExpiresAt: '2026-12-14T05:00:00Z' });
    await screen.findByTestId('billing-accountant-test-result', undefined, WAIT);
    await waitFor(() => expect(screen.getByTestId('fiscal-billing-next')).toBeEnabled(), WAIT);
    expect(sendTest).toHaveBeenCalledTimes(1);
  });
});

describe('who sees the step, and when (E15/F02/US02/T01)', () => {
  // Permission rule: the settings are the whole organization's. A person who reaches only some of the properties is refused by the server (403, answered as «no settings» so that the whole app does
  // not go to the page of no access): the step says why and has no field to fill.
  it('AccountantStep_APersonWhoReachesOnlySomeOfThePropertiesSeesWhyAndHasNoFieldToFill', async () => {
    getSettings.mockResolvedValue(null);
    renderWizard();
    await onStep('accountant');
    await screen.findByTestId('billing-accountant-no-access', undefined, WAIT);

    expect(screen.queryByTestId('billing-accountant-email')).not.toBeInTheDocument();
    expect(screen.queryByTestId('billing-accountant-test-button')).not.toBeInTheDocument();
    // The step is optional: «Continua» moves on, nothing is sent, and the summary does not pretend to know the answer.
    await next();
    await onStep('summary');
    expect(updateSettings).not.toHaveBeenCalled();
    expect(sendTest).not.toHaveBeenCalled();
  });

  it('AccountantStep_APersonWhoMayNotChangeTheSetup_ReadsTheStepWithEveryControlSwitchedOffAndSendsNothing', async () => {
    env.hasPermission = (_context, permission) => permission !== 'property.write';
    getSettings.mockResolvedValue(SAVED);
    renderWizard();
    await formOpen();

    expect(screen.getByTestId('billing-read-only')).toHaveTextContent(text('billingWizard.readOnly.noPermission'));
    const fields = Array.from(screen.getByTestId('billing-step-accountant').querySelectorAll<HTMLElement>('input, select, textarea, button'));
    // The address, the monthly send, the day, the three folders this person may choose and the test.
    expect(fields.length).toBeGreaterThanOrEqual(7);
    for (const field of fields) expect(field, field.getAttribute('data-testid') ?? field.tagName).toBeDisabled();
    await next();
    await onStep('summary');
    expect(updateSettings).not.toHaveBeenCalled();
    expect(sendTest).not.toHaveBeenCalled();
  });

  // Flag rule: with the package of the accountant off the wizard is the one it was, and nothing of the settings is asked of the server.
  it('AccountantStep_FlagOff_HasNoStepNoLabelAndAsksNothingOfTheServer', async () => {
    env.flags = {};
    renderWizard();

    await onStep('tourist-tax');
    expect(screen.queryByText(text('billingWizard.steps.accountant.label'))).not.toBeInTheDocument();
    expect(getSettings).not.toHaveBeenCalled();
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('AccountantStep_TheModuleIsOffAtTheServer_SaysSoAndHasNoForm', async () => {
    getSettings.mockRejectedValue(refusal(404, {}));
    renderWizard();
    await onStep('accountant');

    await screen.findByTestId('billing-accountant-unavailable', undefined, WAIT);
    expect(screen.queryByTestId('billing-accountant-email')).not.toBeInTheDocument();
  });

  it('AccountantStep_AReadThatFailed_IsAFailedReadWithARetryAndNeverAnEmptyForm', async () => {
    getSettings.mockRejectedValueOnce(refusal(500, {})).mockResolvedValue(SAVED);
    renderWizard();
    await onStep('accountant');

    await screen.findByTestId('billing-accountant-error', undefined, WAIT);
    expect(screen.queryByTestId('billing-accountant-email')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: text('shared.errorState.retry') }));
    await waitFor(() => expect(screen.getByTestId('billing-accountant-email')).toHaveValue(ADDRESS), WAIT);
  });
});

// Permission rule (backend `AccountantPackageSettingsService`): on an agency's organization only a caller who holds `agency.statement.view` may choose the folders that carry the owner accounting; for
// anyone else the save is refused (422 `accountant_package_owner_accounting_required`). The wizard's `agency` is the administrator of an organization on the agency plan: the folders are offered and sent
// only to that person.
describe('the folders of the owner accounting are for who may choose them (E15/F02/US02/T01)', () => {
  const OWNER_FOLDERS = ['ownerInvoices', 'statements', 'agencySummary', 'vat', 'withholding'];
  const OTHER_FOLDERS = ['guestDocuments', 'touristTax', 'collections'];

  /** Who looks at the step: the administrator of an organization on the agency plan, the administrator of one that is not an agency, or a collaborator (of an organization on the agency plan: the plan alone decides nothing). */
  function lookingAs(who: 'agencyAdministrator' | 'administrator' | 'collaborator') {
    env.contexts = who === 'collaborator' ? COLLABORATOR : ADMIN;
    env.flags = { accountantPackage: true, agencyTier: true };
    vi.mocked(useAgencyPlan).mockReturnValue({ isAgency: who !== 'administrator', isLoading: false, failed: false, retry: vi.fn() });
  }

  it('AccountantStep_TheAdministratorOfAnAgency_IsOfferedEveryFolderAndTheSaveHoldsThemAll', async () => {
    lookingAs('agencyAdministrator');
    renderWizard();
    await formOpen();

    for (const folder of ACCOUNTANT_PACKAGE_FOLDERS) expect(screen.getByTestId(`billing-accountant-folder-${folder}`), folder).toBeChecked();
    expect(screen.getByText(text('billingWizard.accountant.contents.hint'))).toBeInTheDocument();

    write(ADDRESS);
    await next();
    await onStep('summary');
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0][0].contents).toEqual([...ACCOUNTANT_PACKAGE_FOLDERS]);
  });

  it.each<[string, 'collaborator' | 'administrator']>([
    ['ACollaboratorOfAnAgency', 'collaborator'],
    ['TheAdministratorOfAnOrganizationThatIsNotAnAgency', 'administrator'],
  ])('AccountantStep_%s_IsNotOfferedTheOwnerFoldersAndTheSaveNeverHoldsThem', async (_name, who) => {
    lookingAs(who);
    renderWizard();
    await formOpen();

    for (const folder of OWNER_FOLDERS) expect(screen.queryByTestId(`billing-accountant-folder-${folder}`), folder).not.toBeInTheDocument();
    for (const folder of OTHER_FOLDERS) expect(screen.getByTestId(`billing-accountant-folder-${folder}`), folder).toBeChecked();
    expect(screen.getByText(text('billingWizard.accountant.contents.hintNoOwnerFolders'))).toBeInTheDocument();

    // The server holds every folder (its default for an organization that saved none): what this person saves holds none of the five, which the backend would refuse on an agency's organization.
    write(ADDRESS);
    await next();
    await onStep('summary');
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0][0].contents).toEqual(OTHER_FOLDERS);
  });

  it('AccountantStep_ACollaboratorWhoseSettingsHoldOnlyOwnerFolders_HasNoFolderChosenUntilTheyChooseOne', async () => {
    lookingAs('collaborator');
    getSettings.mockResolvedValue({ ...SAVED, contents: ['statements', 'vat'] });
    renderWizard();
    await formOpen();

    // What they cannot see is not ticked and does not count as a folder chosen: the save would be refused for it.
    for (const folder of OTHER_FOLDERS) expect(screen.getByTestId(`billing-accountant-folder-${folder}`), folder).not.toBeChecked();
    fireEvent.change(screen.getByTestId('billing-accountant-day'), { target: { value: '12' } });
    await next();
    await waitFor(() => expect(screen.getByTestId('billing-accountant-contents-error')).toHaveTextContent(text('billingWizard.errors.accountantContents')), WAIT);
    expect(updateSettings).not.toHaveBeenCalled();

    fireEvent.click(screen.getByTestId('billing-accountant-folder-guestDocuments'));
    await next();
    await onStep('summary');
    expect(updateSettings).toHaveBeenCalledTimes(1);
    expect(updateSettings.mock.calls[0][0]).toEqual({ enabled: true, email: ADDRESS, sendDay: 12, contents: ['guestDocuments'] });
  });

  it('AccountantStep_ACollaboratorWhoChangesNothing_SavesNothingEvenWhenTheServerHoldsOwnerFolders', async () => {
    lookingAs('collaborator');
    getSettings.mockResolvedValue({ ...SAVED, contents: ['statements', 'vat', 'collections'] });
    renderWizard();
    await formOpen();

    await next();
    await onStep('summary');
    // The owner folders an administrator chose stay as they are: only a change of what this person sees is saved.
    expect(updateSettings).not.toHaveBeenCalled();
  });

  it('AccountantTest_ACollaboratorOnAnAgency_IsToldTheTestIsForWhoMaySeeTheOwnerAccounting_AndNoFolderIsBlamed', async () => {
    lookingAs('collaborator');
    getSettings.mockResolvedValue(SAVED);
    sendTest.mockRejectedValue(refusal(422, { code: 'accountant_package_owner_accounting_required' }));
    renderWizard();
    await formOpen();

    await pressTest();
    const failure = await screen.findByTestId('billing-accountant-test-failure', undefined, WAIT);
    expect(failure).toHaveTextContent(text('billingWizard.accountant.test.ownerAccounting'));
    // The refusal is about the test: the person has no owner folder to take out, so none of the folders is blamed.
    expect(screen.queryByTestId('billing-accountant-contents-error')).not.toBeInTheDocument();
  });
});
