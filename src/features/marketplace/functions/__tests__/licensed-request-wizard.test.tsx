import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { getLicensedFunctions, getMarketplaceEntry, refreshLicensedFunctions, requestLicensedFunction } from '@/api/marketplace.api';
import { propertiesApi } from '@/api/properties.api';
import type { MarketplaceEntryDetail, MarketplaceFunction, MarketplaceFunctionList, Property } from '@/types';
import { CHANNELS_PAGE_PATH, MARKETPLACE_MINE_PATH, MARKETPLACE_PATH } from '../../lib/marketplace-paths';
import { LicensedRequestWizardPage } from '../licensed-request-wizard-page';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/marketplace.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/marketplace.api')>()),
  getMarketplaceEntry: vi.fn(),
  getLicensedFunctions: vi.fn(),
  requestLicensedFunction: vi.fn(),
  refreshLicensedFunctions: vi.fn(),
}));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };
const PATH = '/app/short-rent/marketplace/request/chat';
const RETURN_TO = '/app/short-rent/somewhere-else';
const GUIDANCE = 'Buongiorno, vorrei attivare la funzione «Chat con gli ospiti» sulla struttura «Casa Rosa». Potete aggiungerla alla licenza? Grazie.';

const ROSA = { id: 'prop-1', name: 'Casa Rosa', address: 'Via Roma 12', city: 'Milano' } as Property;
const AZZURRA = { id: 'prop-2', name: 'Casa Azzurra', address: 'Via Po 3', city: 'Torino' } as Property;

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function card(overrides: Partial<MarketplaceEntryDetail> = {}): MarketplaceEntryDetail {
  return {
    kind: 'LicensedFunction',
    code: 'chat',
    name: 'Chat con gli ospiti',
    logoUrl: null,
    status: 'NotActive',
    whatItDoes: 'Riunisce in un\'unica casella i messaggi degli ospiti dei tuoi canali.',
    audience: 'Per chi vuole aggiungere questa funzione alla licenza del proprio channel manager.',
    activation: { type: 'licenseRequest', requirements: [], needsOctoratePanel: false },
    cost: { text: null, invoicedBy: 'Unknown' },
    dataShared: [],
    deactivation: { text: '', guided: true },
    faq: [],
    actions: { canActivate: true, reason: null },
    ...overrides,
  };
}

function entry(overrides: Partial<MarketplaceFunction> = {}): MarketplaceFunction {
  return {
    code: 'chat',
    name: 'Chat con gli ospiti',
    status: 'NotActive',
    activationId: null,
    isDeclared: false,
    requestedAt: null,
    verifiedAt: null,
    lastSyncedAt: null,
    lastErrorCode: null,
    changeRequestedAt: null,
    requestGuidance: GUIDANCE,
    ...overrides,
  };
}

function licenseOf(chat: MarketplaceFunction, overrides: Partial<MarketplaceFunctionList> = {}): MarketplaceFunctionList {
  return { propertyId: 'prop-1', tier: null, roomsLimit: null, noRoomLicense: false, licenseReadAt: null, functions: [chat], ...overrides };
}

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location">{`${location.pathname}${location.search}`}</div>;
}

function renderWizard(url: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={client}>
        <MemoryRouter initialEntries={[url]}>
          <LocationProbe />
          <Routes>
            <Route path="/app/short-rent/marketplace/request/:moduleCode" element={<LicensedRequestWizardPage />} />
            <Route path={MARKETPLACE_PATH} element={<div data-testid="marketplace-marker" />} />
            <Route path={MARKETPLACE_MINE_PATH} element={<div data-testid="mine-marker" />} />
            <Route path={CHANNELS_PAGE_PATH} element={<div data-testid="channels-marker" />} />
            <Route path="/app/short-rent/somewhere-else" element={<div data-testid="somewhere-else-marker" />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  );
}

async function onStep(step: string) {
  await waitFor(() => expect(screen.getByTestId('licensed-wizard')).toHaveAttribute('data-step', step), WAIT);
}

const primaryButton = () => screen.queryByTestId('licensed-next') ?? screen.getByTestId('licensed-finish');

/** The host has these properties; the license of each is what `licenses` says (a refusal is an error the read throws). */
function givenTheHost(options: { properties?: Property[]; license?: MarketplaceFunctionList | AxiosError; card?: MarketplaceEntryDetail } = {}) {
  const { properties = [ROSA], license = licenseOf(entry()), card: detail = card() } = options;
  vi.mocked(propertiesApi.getAll).mockResolvedValue(properties);
  vi.mocked(getMarketplaceEntry).mockResolvedValue(detail);
  vi.mocked(getLicensedFunctions).mockImplementation(async (propertyId) => {
    if (license instanceof AxiosError) throw license;
    return { ...license, propertyId };
  });
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
  Object.defineProperty(navigator, 'clipboard', { value: { writeText: vi.fn().mockResolvedValue(undefined) }, configurable: true });
});

afterEach(() => {
  cleanup();
});

describe('the first step: the function', () => {
  it('FunctionStep_Opens_ExplainsWhatTheFunctionDoesAndForWhomAndSaysTheCostIsNotSpecified', async () => {
    givenTheHost();
    renderWizard(`${PATH}?propertyId=prop-1`);

    expect(await screen.findByTestId('licensed-what-it-does', {}, WAIT)).toHaveTextContent('Riunisce');
    // No cost sent: «not specified», never a price made up.
    expect(screen.getByTestId('licensed-cost')).toHaveTextContent(i18n.t('marketplace.licensed.function.costUnknown'));
    await onStep('function');
  });

  it('FunctionStep_CostSentByTheBackend_IsShownWithWhoInvoices', async () => {
    givenTheHost({ card: card({ cost: { text: '9 euro al mese', invoicedBy: 'ChannelManager' } }) });
    renderWizard(`${PATH}?propertyId=prop-1`);

    expect(await screen.findByTestId('licensed-cost', {}, WAIT)).toHaveTextContent(`9 euro al mese (${i18n.t('marketplace.card.invoicedBy.ChannelManager')})`);
  });

  it('FunctionStep_LicenseOfTheProperty_ShowsThePlanAndTheLimitOfRoomsOfTheLastRead', async () => {
    givenTheHost({ license: licenseOf(entry(), { tier: 'Standard', roomsLimit: 12, licenseReadAt: '2026-11-10T08:00:00Z' }) });
    renderWizard(`${PATH}?propertyId=prop-1`);

    expect(await screen.findByTestId('licensed-plan', {}, WAIT)).toHaveTextContent('Standard');
    expect(screen.getByTestId('licensed-rooms-limit')).toHaveTextContent('12');
    expect(getLicensedFunctions).toHaveBeenCalledWith('prop-1', 'it');
  });

  it('FunctionStep_NoReadOfTheLicenseYet_SaysThePlanAndTheLimitAreNotReadInsteadOfInventingThem', async () => {
    givenTheHost();
    renderWizard(`${PATH}?propertyId=prop-1`);

    expect(await screen.findByTestId('licensed-plan', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.licensed.function.notRead'));
    expect(screen.getByTestId('licensed-rooms-limit')).toHaveTextContent(i18n.t('marketplace.licensed.function.notRead'));
  });

  it('FunctionStep_FunctionThatIsOnAlready_IsToldInSimpleWordsWithTheWayBackToTheMarketplace', async () => {
    givenTheHost({ license: licenseOf(entry({ status: 'Active', requestGuidance: null })) });
    renderWizard(`${PATH}?propertyId=prop-1`);

    const notice = await screen.findByTestId('licensed-already-active', {}, WAIT);
    expect(notice).toHaveTextContent(i18n.t('marketplace.licensed.function.alreadyActive'));
    fireEvent.click(screen.getByText(i18n.t('marketplace.licensed.backToMarketplace')));
    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });

  it('FunctionStep_CardTheOrganizationMayNotSee_IsToldAsNotAvailableForThem', async () => {
    givenTheHost();
    vi.mocked(getMarketplaceEntry).mockRejectedValue(axiosError(404, { code: 'marketplace_entry_not_found' }));
    renderWizard(PATH);

    expect(await screen.findByTestId('licensed-function-unavailable', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.detail.notFoundDescription'));
  });
});

describe('the property and the request', () => {
  it('PropertyStep_PropertyWithNoConfirmedListing_IsToldInOneSentenceWithTheWayToFixItAndTheStepDoesNotGoOn', async () => {
    givenTheHost({ properties: [ROSA, AZZURRA] });
    vi.mocked(getLicensedFunctions).mockImplementation(async (propertyId) => {
      if (propertyId === 'prop-2') throw axiosError(422, { code: 'marketplace_property_not_linked' });
      return licenseOf(entry(), { propertyId });
    });
    renderWizard(`${PATH}?step=property`);

    fireEvent.click(await screen.findByTestId('licensed-property-prop-2', {}, WAIT));

    // Told as soon as it is chosen, never as a raw error, and the one way out is the page where the connect wizard starts.
    expect(await screen.findByTestId('licensed-not-linked', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.licensed.problem.notLinked'));
    expect(screen.getByTestId('licensed-channels-link')).toHaveAttribute('href', CHANNELS_PAGE_PATH);
    fireEvent.click(primaryButton());
    expect(await screen.findByTestId('licensed-finish-error', {}, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.marketplacePropertyNotLinked'));
    await onStep('property');
    expect(requestLicensedFunction).not.toHaveBeenCalled();
  });

  it('PropertyStep_TheOnlyProperty_IsChosenForThePerson', async () => {
    givenTheHost();
    renderWizard(`${PATH}?step=property`);

    await waitFor(() => expect(screen.getByTestId('licensed-property-prop-1')).toBeChecked(), WAIT);
  });

  it('AskStep_ServerText_IsTheRequestToCopyAndTheCopyButtonCopiesIt', async () => {
    givenTheHost();
    renderWizard(`${PATH}?propertyId=prop-1&step=ask`);

    const text = await screen.findByTestId('licensed-guidance', {}, WAIT);
    expect(text).toHaveValue(GUIDANCE);
    fireEvent.click(screen.getByTestId('licensed-copy'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith(GUIDANCE), WAIT);
    // The channel manager has no name in the texts of the wizard.
    expect(screen.getByTestId('licensed-ask-step')).not.toHaveTextContent(/octorate/i);
  });

  it('AskStep_IMadeTheRequest_RecordsItOnceForThePropertyAndShowsTheResultWithItsStatus', async () => {
    givenTheHost();
    vi.mocked(requestLicensedFunction).mockResolvedValue(entry({ status: 'Requested', isDeclared: true, requestedAt: '2026-11-12T10:00:00Z' }));
    renderWizard(`${PATH}?propertyId=prop-1&step=ask`);
    await screen.findByTestId('licensed-guidance', {}, WAIT);

    fireEvent.click(primaryButton());

    await onStep('fatto');
    expect(requestLicensedFunction).toHaveBeenCalledTimes(1);
    expect(requestLicensedFunction).toHaveBeenCalledWith('chat', 'prop-1', 'it');
    expect(screen.getByTestId('licensed-requested')).toHaveTextContent(i18n.t('marketplace.licensed.requested.title.requested'));
    // What CasaZen does by itself, and when.
    expect(screen.getByText(i18n.t('marketplace.licensed.requested.whatNext.daily'))).toBeInTheDocument();
  });

  it('AskStep_LicenseShowsTheModuleOnAlready_NothingIsRecordedAndThePersonIsLedBackToTheMarketplace', async () => {
    givenTheHost({ license: licenseOf(entry({ status: 'Active', requestGuidance: null })) });
    renderWizard(`${PATH}?propertyId=prop-1&step=ask`);

    expect(await screen.findByTestId('licensed-ask-already-active', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.licensed.function.alreadyActive'));
    fireEvent.click(primaryButton());

    expect(await screen.findByTestId('licensed-finish-error', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.licensed.ask.alreadyOn'));
    expect(requestLicensedFunction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('licensed-back-to-marketplace'));
    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });

  it('AskStep_ServerSaysTheFunctionIsOnAlready_IsToldInSimpleWordsAndTheListIsReadAgainSoTheWayBackIsThere', async () => {
    givenTheHost();
    // The license showed the module off when the step was read; the server then says (409) that it is on.
    vi.mocked(getLicensedFunctions)
      .mockResolvedValueOnce(licenseOf(entry()))
      .mockResolvedValueOnce(licenseOf(entry()))
      .mockResolvedValue(licenseOf(entry({ status: 'Active', requestGuidance: null })));
    vi.mocked(requestLicensedFunction).mockRejectedValue(axiosError(409, { code: 'marketplace_function_already_active' }));
    renderWizard(`${PATH}?propertyId=prop-1&step=ask`);
    await screen.findByTestId('licensed-guidance', {}, WAIT);

    fireEvent.click(primaryButton());

    expect(await screen.findByTestId('licensed-ask-already-active', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('licensed-finish-error')).toHaveTextContent(i18n.t('apiErrors.codes.marketplaceFunctionAlreadyActive'));
    await onStep('ask');
  });
});

describe('the result', () => {
  it('RequestedStep_CheckNow_ReadsTheLicenseAndUpdatesTheStatusWhenTheModuleIsThere', async () => {
    givenTheHost({ license: licenseOf(entry({ status: 'Requested', isDeclared: true })) });
    vi.mocked(refreshLicensedFunctions).mockResolvedValue(licenseOf(entry({ status: 'Active', requestGuidance: null })));
    renderWizard(`${PATH}?step=fatto&propertyId=prop-1`);

    // Opened again (a reload): it says what the server says now.
    await waitFor(() => expect(screen.getByTestId('licensed-requested-badge')).toHaveAttribute('data-phase', 'requested'), WAIT);
    fireEvent.click(screen.getByTestId('licensed-check-now'));

    expect(await screen.findByTestId('licensed-check-active', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('licensed-requested-badge')).toHaveAttribute('data-phase', 'active');
    expect(refreshLicensedFunctions).toHaveBeenCalledWith('prop-1', 'it');
  });

  it('RequestedStep_CheckNowAndTheModuleIsNotThereYet_SaysSoAndKeepsTheRequest', async () => {
    givenTheHost({ license: licenseOf(entry({ status: 'Requested', isDeclared: true })) });
    vi.mocked(refreshLicensedFunctions).mockResolvedValue(licenseOf(entry({ status: 'Requested', isDeclared: true })));
    renderWizard(`${PATH}?step=fatto&propertyId=prop-1`);
    await waitFor(() => expect(screen.getByTestId('licensed-requested-badge')).toHaveAttribute('data-phase', 'requested'), WAIT);

    fireEvent.click(screen.getByTestId('licensed-check-now'));

    expect(await screen.findByTestId('licensed-check-not-yet', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('licensed-requested-badge')).toHaveAttribute('data-phase', 'requested');
  });

  it('RequestedStep_CheckNowThatTheChannelManagerCannotAnswer_IsToldInSimpleWords', async () => {
    givenTheHost({ license: licenseOf(entry({ status: 'Requested', isDeclared: true })) });
    vi.mocked(refreshLicensedFunctions).mockRejectedValue(axiosError(502, { code: 'octorate_unavailable' }));
    renderWizard(`${PATH}?step=fatto&propertyId=prop-1`);
    await waitFor(() => expect(screen.getByTestId('licensed-requested-badge')).toHaveAttribute('data-phase', 'requested'), WAIT);

    fireEvent.click(screen.getByTestId('licensed-check-now'));

    expect(await screen.findByTestId('licensed-check-error', {}, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.octorateUnavailable'));
  });

  it('RequestedStep_DoneAndLater_BothGoBackToTheValidReturnTo', async () => {
    givenTheHost({ license: licenseOf(entry({ status: 'Requested', isDeclared: true })) });
    renderWizard(`${PATH}?step=fatto&propertyId=prop-1&returnTo=${encodeURIComponent(RETURN_TO)}`);

    fireEvent.click(await screen.findByTestId('wizard-done-primary', {}, WAIT));
    expect(await screen.findByTestId('somewhere-else-marker', {}, WAIT)).toBeInTheDocument();

    cleanup();
    renderWizard(`${PATH}?step=fatto&propertyId=prop-1&returnTo=${encodeURIComponent(RETURN_TO)}`);
    fireEvent.click(await screen.findByTestId('wizard-done-secondary', {}, WAIT));
    expect(await screen.findByTestId('somewhere-else-marker', {}, WAIT)).toBeInTheDocument();
  });

  it.each([[''], ['https://evil.example/app/'], ['//evil.example/x'], ['/login']])('RequestedStep_ClosingButtonsWithReturnTo_%s_GoToTheMarketplace', async (returnTo) => {
    givenTheHost({ license: licenseOf(entry({ status: 'Requested', isDeclared: true })) });
    renderWizard(`${PATH}?step=fatto&propertyId=prop-1${returnTo ? `&returnTo=${encodeURIComponent(returnTo)}` : ''}`);

    fireEvent.click(await screen.findByTestId('wizard-done-primary', {}, WAIT));

    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });
});

describe('the way out', () => {
  it('SaveAndExit_WithAReturnTo_GoesBackThere_AndWithoutOneToTheMarketplace', async () => {
    givenTheHost();
    renderWizard(`${PATH}?propertyId=prop-1&returnTo=${encodeURIComponent(RETURN_TO)}`);
    fireEvent.click(await screen.findByTestId('licensed-save-exit', {}, WAIT));
    expect(await screen.findByTestId('somewhere-else-marker', {}, WAIT)).toBeInTheDocument();

    cleanup();
    renderWizard(`${PATH}?propertyId=prop-1`);
    fireEvent.click(await screen.findByTestId('licensed-save-exit', {}, WAIT));
    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });

  it('LicensedRequestWizardPage_CodeThatCouldCarryAPath_IsToldNotOpenedAndNothingIsRead', async () => {
    givenTheHost();
    renderWizard('/app/short-rent/marketplace/request/bad%20code');

    expect(await screen.findByText(i18n.t('marketplace.licensed.notFound.title'), {}, WAIT)).toBeInTheDocument();
    expect(getMarketplaceEntry).not.toHaveBeenCalled();
    expect(getLicensedFunctions).not.toHaveBeenCalled();
  });
});
