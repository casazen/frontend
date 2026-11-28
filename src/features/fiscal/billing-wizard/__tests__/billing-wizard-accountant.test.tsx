import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createElement, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
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
vi.mock('@/hooks/use-agency-plan', () => ({ useAgencyPlan: vi.fn() }));
vi.mock('@/queries/use-properties', () => ({
  useProperties: () => ({ data: [], isPending: false, isError: false, error: null, refetch: vi.fn() }),
}));

vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };

const getSettings = vi.mocked(accountantPackageApi.getSettings);
const updateSettings = vi.mocked(accountantPackageApi.updateSettings);
const sendTest = vi.mocked(accountantPackageApi.sendTest);

const NOTHING_SAVED: AccountantPackageSettings = { enabled: false, email: null, sendDay: 3, contents: [...ACCOUNTANT_PACKAGE_FOLDERS], lastSend: null, updatedAt: null };

const SAVED: AccountantPackageSettings = {
  enabled: true,
  email: 'studio@esempio.it',
  sendDay: 7,
  contents: ['guestDocuments', 'collections'],
  lastSend: { period: '2026-10', at: '2026-11-03T05:00:00Z', result: 'sent', error: null },
  updatedAt: '2026-11-03T09:00:00Z',
};

const ADDRESS = 'studio@esempio.it';

const ADMIN = [{ contextKey: 'account', roleKey: 'org_owner' }];
const COLLABORATOR = [{ contextKey: 'short-rent', roleKey: 'property_manager' }];

function refusal(status: number, data: unknown, sent?: unknown): AxiosError {
  const config = { headers: new AxiosHeaders(), data: sent === undefined ? undefined : JSON.stringify(sent) } as InternalAxiosRequestConfig;
  return new AxiosError('failed', 'ERR_BAD_REQUEST', config, undefined, { status, statusText: '', headers: {}, config, data });
}

/**
 * The address of the page as the router has it. Under a `MemoryRouter` `window.location` never moves, so it proves nothing about the address: the rule «no personal data in the address of the
 * page» is checked against this.
 */
function LocationProbe() {
  const location = useLocation();
  return createElement('div', { 'data-testid': 'router-location' }, `${location.pathname}${location.search}${location.hash}`);
}

const routerAddress = () => decodeURIComponent(screen.getByTestId('router-location').textContent ?? '');

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
        createElement(LocationProbe),
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

async function formOpen() {
  await onStep('accountant');
  await waitFor(() => expect(screen.getByTestId('billing-accountant-email')).toBeInTheDocument(), WAIT);
}

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

    expect(screen.getByRole('heading', { name: text('billingWizard.steps.accountant.title') })).toBeInTheDocument();
    expect(screen.getByText(text('billingWizard.steps.accountant.purpose'))).toBeInTheDocument();
    expect(screen.getByTestId('billing-accountant-email')).toHaveValue(ADDRESS);
    expect(screen.getByTestId('billing-accountant-monthly')).toBeChecked();
    expect(screen.getByTestId('billing-accountant-day')).toHaveValue('7');
    expect(screen.getByTestId('billing-accountant-folder-guestDocuments')).toBeChecked();
    expect(screen.getByTestId('billing-accountant-folder-collections')).toBeChecked();
    expect(screen.getByTestId('billing-accountant-folder-touristTax')).not.toBeChecked();
    expect(screen.getByTestId('billing-accountant-last-send')).toHaveAttribute('data-result', 'sent');
    expect(screen.getByTestId('billing-accountant-last-send')).toHaveTextContent('ottobre 2026');
  });

  it.each<[string, boolean, string, string]>([
    ['TheMonthlySendOn', true, 'billingWizard.accountant.lastSend.retryOn', 'billingWizard.accountant.lastSend.retryOff'],
    ['TheMonthlySendOff', false, 'billingWizard.accountant.lastSend.retryOff', 'billingWizard.accountant.lastSend.retryOn'],
  ])('AccountantStep_ALastSendThatFailedWith%s_PromisesOnlyWhatTheServerDoes', async (_name, enabled, promised, notPromised) => {
    getSettings.mockResolvedValue({ ...SAVED, enabled, lastSend: { period: '2026-10', at: '2026-11-03T05:00:00Z', result: 'failed', error: 'package_failed' } });
    renderWizard();
    await formOpen();

    const last = screen.getByTestId('billing-accountant-last-send');
    expect(last).toHaveAttribute('data-result', 'failed');
    expect(last).toHaveTextContent(text('billingWizard.accountant.lastSend.errors.packageFailed'));
    expect(last).toHaveTextContent(text(promised));
    expect(last).not.toHaveTextContent(text(notPromised));
  });

  it('AccountantStep_NothingTouched_ContinuaSavesNothingAndTheSummaryNeverWritesTheAddress', async () => {
    getSettings.mockResolvedValue(SAVED);
    renderWizard();
    await formOpen();

    await next();
    await onStep('summary');
    expect(updateSettings).not.toHaveBeenCalled();
    expect(sendTest).not.toHaveBeenCalled();
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
    expect(updateSettings.mock.calls[0][0]).toEqual({ enabled: true, email: ADDRESS, sendDay: 10, contents: ['guestDocuments', 'collections'] });
    expect(within(screen.getByTestId('billing-step-summary')).getByText(text('billingWizard.summary.accountant.monthly', { day: 10 }))).toBeInTheDocument();
    expect(api.saveBillingSetupSection).not.toHaveBeenCalledWith('accountant', expect.anything());
    expect(routerAddress()).toContain('step=summary');
    expect(routerAddress()).not.toContain('studio');
  });

  it('AccountantStep_TheMonthlySendWithNoAddress_StopsOnTheFieldAndSendsNothingUntilThereIsOne', async () => {
    renderWizard();
    await formOpen();

    turnMonthlyOn();
    await next();
    await waitFor(() => expect(screen.getAllByText(text('billingWizard.errors.accountantEmailMissing')).length).toBeGreaterThan(0), WAIT);
    expect(wizard()).toHaveAttribute('data-step', 'accountant');
    expect(updateSettings).not.toHaveBeenCalled();

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
    expect(screen.getByTestId('billing-accountant-email')).toHaveValue(ADDRESS);
  });

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
    expect(routerAddress()).toContain('step=accountant');
    expect(routerAddress()).not.toContain('studio');
    expect(routerAddress()).not.toContain(ADDRESS);
    expect(JSON.stringify({ ...localStorage })).not.toContain(ADDRESS);
    expect(JSON.stringify({ ...sessionStorage })).not.toContain(ADDRESS);

    cleanup();
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(0), WAIT);
  });

  it('AccountantStep_SaveAndExit_KeepsWhatHoldsTogetherAndSaysThatTheRestWasLeftOut', async () => {
    getSettings.mockResolvedValue({ ...SAVED, lastSend: null });
    renderWizard();
    await formOpen();

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
    expect(updateSettings.mock.invocationCallOrder[0]).toBeLessThan(sendTest.mock.invocationCallOrder[0]);
    expect(updateSettings.mock.calls[0][0]).toMatchObject({ enabled: true, email: ADDRESS });
    expect(result).toHaveTextContent('ottobre 2026');
    expect(result).toHaveTextContent('14 dicembre 2026');
    expect(result).toHaveTextContent(/in coda/i);
    expect(result).not.toHaveTextContent(/consegnat|recapitat/i);

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

  it('AccountantTest_TheServerFailsWithAnErrorOfItsOwn_AdmitsThatItCannotTellAndSendsThePersonToTheLastSend', async () => {
    getSettings.mockResolvedValue(SAVED);
    sendTest.mockRejectedValue(refusal(500, {}));
    renderWizard();
    await formOpen();

    await pressTest();
    const failure = await screen.findByTestId('billing-accountant-test-failure', undefined, WAIT);
    expect(failure).toHaveTextContent(text('billingWizard.accountant.test.failed'));
    expect(screen.queryByTestId('billing-accountant-test-result')).not.toBeInTheDocument();
  });

  it.each([
    ['TheTenMinutesRanOut', AxiosError.ECONNABORTED, 'timeout of 600000ms exceeded'],
    ['TheConnectionDropped', AxiosError.ERR_NETWORK, 'Network Error'],
  ])('AccountantTest_ACallWithNoAnswerAtAllBecause%s_AdmitsThatItCannotTellAndNeverSaysTheServerCannotBeReached', async (_name, code, message) => {
    getSettings.mockResolvedValue(SAVED);
    sendTest.mockRejectedValue(new AxiosError(message, code, { headers: new AxiosHeaders() } as InternalAxiosRequestConfig));
    renderWizard();
    await formOpen();

    await pressTest();
    const failure = await screen.findByTestId('billing-accountant-test-failure', undefined, WAIT);
    expect(failure).toHaveTextContent(text('billingWizard.accountant.test.failed'));
    expect(failure).not.toHaveTextContent(text('apiErrors.network'));
    expect(screen.queryByTestId('billing-accountant-test-result')).not.toBeInTheDocument();
  });

  it('AccountantTest_TheSaveThatGoesBeforeTheTestHasNoAnswer_SaysTheServerCannotBeReachedForNothingWasSent', async () => {
    updateSettings.mockRejectedValue(new AxiosError('Network Error', AxiosError.ERR_NETWORK, { headers: new AxiosHeaders() } as InternalAxiosRequestConfig));
    renderWizard();
    await formOpen();

    write(ADDRESS);
    await pressTest();
    const failure = await screen.findByTestId('billing-accountant-test-failure', undefined, WAIT);
    expect(failure).toHaveTextContent(text('apiErrors.network'));
    expect(sendTest).not.toHaveBeenCalled();
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
    expect(screen.getByTestId('fiscal-billing-back')).toBeDisabled();
    expect(sendTest).toHaveBeenCalledTimes(1);

    answer({ period: '2026-10', queued: true, linkExpiresAt: '2026-12-14T05:00:00Z' });
    await screen.findByTestId('billing-accountant-test-result', undefined, WAIT);
    await waitFor(() => expect(screen.getByTestId('fiscal-billing-next')).toBeEnabled(), WAIT);
    expect(screen.getByTestId('fiscal-billing-back')).toBeEnabled();
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
    expect(fields.length).toBeGreaterThanOrEqual(7);
    for (const field of fields) expect(field, field.getAttribute('data-testid') ?? field.tagName).toBeDisabled();
    await next();
    await onStep('summary');
    expect(updateSettings).not.toHaveBeenCalled();
    expect(sendTest).not.toHaveBeenCalled();
  });

  it.each<[string, 'send' | 'save']>([
    ['TheTest', 'send'],
    ['TheSaveThatGoesBeforeTheTest', 'save'],
  ])('AccountantTest_A403On%s_TurnsTheWholeWizardReadOnly', async (_name, where) => {
    getSettings.mockResolvedValue(where === 'send' ? SAVED : NOTHING_SAVED);
    if (where === 'send') sendTest.mockRejectedValue(refusal(403, { code: 'forbidden' }));
    else updateSettings.mockRejectedValue(refusal(403, { code: 'forbidden' }, { email: ADDRESS }));
    renderWizard();
    await formOpen();
    if (where === 'save') write(ADDRESS);

    await pressTest();
    await screen.findByTestId('billing-accountant-test-failure', undefined, WAIT);
    expect(await screen.findByTestId('billing-read-only', undefined, WAIT)).toHaveTextContent(text('billingWizard.readOnly.partialScope'));
    const controls = Array.from(screen.getByTestId('billing-step-accountant').querySelectorAll<HTMLElement>('input, select, textarea, button'));
    expect(controls.length).toBeGreaterThanOrEqual(6);
    for (const control of controls) expect(control, control.getAttribute('data-testid') ?? control.tagName).toBeDisabled();
    expect(sendTest).toHaveBeenCalledTimes(where === 'send' ? 1 : 0);
  });

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

describe('the folders of the owner accounting are for who may choose them (E15/F02/US02/T01)', () => {
  const OWNER_FOLDERS = ['ownerInvoices', 'statements', 'agencySummary', 'vat', 'withholding'];
  const OTHER_FOLDERS = ['guestDocuments', 'touristTax', 'collections'];

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
    expect(screen.queryByTestId('billing-accountant-contents-error')).not.toBeInTheDocument();
  });
});
