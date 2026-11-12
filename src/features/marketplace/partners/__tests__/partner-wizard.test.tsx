import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { I18nextProvider } from 'react-i18next';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import i18n from '@/i18n/config';
import { declarePartner, getPartnerBrief } from '@/api/marketplace.api';
import { readWizardDraft } from '@/lib/wizard-draft';
import { addDays, todayInRome } from '@/lib/stay-dates';
import type { MarketplacePartnerActivation, MarketplacePartnerBrief } from '@/types';
import { CHANNELS_PAGE_PATH, MARKETPLACE_MINE_PATH, MARKETPLACE_PATH } from '../../lib/marketplace-paths';
import { openPartnerSite } from '../partner-site';
import { PartnerWizardPage } from '../partner-wizard-page';
import { partnerWizardId } from '../partner-wizard-model';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/marketplace.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/marketplace.api')>()),
  getPartnerBrief: vi.fn(),
  declarePartner: vi.fn(),
}));
vi.mock('../partner-site', () => ({ openPartnerSite: vi.fn() }));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const WAIT = { timeout: 5000 };
const CODE = 'beds24';
const PATH = `/app/short-rent/marketplace/partners/${CODE}/activate`;
const SITE = 'https://www.partner.example/connect';
const RETURN_TO = '/app/short-rent/somewhere-else';
const SCOPE = { userId: 'user-1', orgId: 'org-1' };

function brief(overrides: Partial<MarketplacePartnerBrief> = {}): MarketplacePartnerBrief {
  return {
    code: CODE,
    name: 'Beds24',
    websiteUrl: SITE,
    checklist: ['Scegli il piano che ti serve', 'Autorizza la lettura delle prenotazioni'],
    propertyData: { name: 'Casa Rosa', address: 'Via Roma 12', city: 'Milano', postalCode: '20100', bedrooms: 2, bathrooms: 1, maxGuests: 4, cinCode: null },
    ...overrides,
  };
}

function activation(overrides: Partial<MarketplacePartnerActivation> = {}): MarketplacePartnerActivation {
  return {
    activationId: 'act-1',
    code: CODE,
    propertyId: 'prop-1',
    status: 'Active',
    isDeclared: true,
    declaredAt: '2026-11-10T00:00:00Z',
    verifiedAt: null,
    ...overrides,
  };
}

function axiosError(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
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
            <Route path="/app/short-rent/marketplace/partners/:code/activate" element={<PartnerWizardPage />} />
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

const currentLocation = () => screen.getByTestId('location').textContent ?? '';

async function onStep(step: string) {
  await waitFor(() => expect(screen.getByTestId('partner-wizard')).toHaveAttribute('data-step', step), WAIT);
}

const primaryButton = () => screen.queryByTestId('partner-next') ?? screen.getByTestId('partner-finish');

function givenThePartner(overrides: Partial<MarketplacePartnerBrief> = {}) {
  vi.mocked(getPartnerBrief).mockResolvedValue(brief(overrides));
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

describe('the first step: what to prepare', () => {
  it('PrepareStep_Opens_ShowsThePropertyDataWithACopyButtonForEachFieldAndTheChecklist', async () => {
    givenThePartner();
    renderWizard(`${PATH}?propertyId=prop-1`);

    expect(await screen.findByTestId('partner-property-data', {}, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('partner-field-address-value')).toHaveTextContent('Via Roma 12');
    expect(screen.getByTestId('partner-field-bedrooms-value')).toHaveTextContent('2');
    // The CIN is not valid: no value, so nothing to copy.
    expect(screen.getByTestId('partner-field-cinCode-value')).toHaveTextContent(i18n.t('marketplace.partnerFlow.prepare.noValue'));
    expect(screen.queryByTestId('partner-copy-cinCode')).not.toBeInTheDocument();
    expect(screen.getByTestId('partner-checklist')).toHaveTextContent('Autorizza la lettura delle prenotazioni');
    expect(getPartnerBrief).toHaveBeenCalledWith(CODE, 'prop-1', 'it');

    fireEvent.click(screen.getByTestId('partner-copy-address'));
    await waitFor(() => expect(navigator.clipboard.writeText).toHaveBeenCalledWith('Via Roma 12'), WAIT);
  });

  it('PrepareStep_NoPropertyInTheAddress_AsksTheBriefWithoutOneAndSaysThePartnerWillAskTheDataItself', async () => {
    givenThePartner({ propertyData: null });
    renderWizard(PATH);

    expect(await screen.findByTestId('partner-no-property-data', {}, WAIT)).toBeInTheDocument();
    expect(getPartnerBrief).toHaveBeenCalledWith(CODE, undefined, 'it');
  });

  it('PrepareStep_PartnerTheOrganizationMayNotSee_IsToldAsNotAvailableWithTheWayBackToTheMarketplace', async () => {
    vi.mocked(getPartnerBrief).mockRejectedValue(axiosError(404, { code: 'marketplace_entry_not_found' }));
    renderWizard(PATH);

    expect(await screen.findByTestId('partner-not-available', {}, WAIT)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('partner-back-to-marketplace'));
    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });

  it('PartnerWizardPage_CodeThatCouldCarryAPath_IsToldNotOpenedAndNothingIsRead', async () => {
    renderWizard('/app/short-rent/marketplace/partners/bad%20code/activate');

    expect(await screen.findByText(i18n.t('marketplace.partnerFlow.notFound.title'), {}, WAIT)).toBeInTheDocument();
    expect(getPartnerBrief).not.toHaveBeenCalled();
  });
});

describe('the hand-off to the partner', () => {
  it('HandoffStep_TheButton_OpensThePartnersSiteAsItIsAndReplacesItsOwnEntryWithTheAddressOfWelcomeBackWithThePropertyAndTheReturnTo', async () => {
    givenThePartner();
    renderWizard(`${PATH}?propertyId=prop-1&returnTo=${encodeURIComponent(RETURN_TO)}&step=handoff`);
    await screen.findByTestId('partner-handoff-step', {}, WAIT);

    fireEvent.click(primaryButton());

    await waitFor(() => expect(openPartnerSite).toHaveBeenCalledTimes(1), WAIT);
    // The address of the partner as it is: nothing of the host or of the guests added to it.
    expect(openPartnerSite).toHaveBeenCalledWith(SITE);
    // The entry of the history the browser's Back button returns to is the one of the step the person comes back to, with its returnTo.
    await onStep('welcome-back');
    const params = new URLSearchParams(currentLocation().slice(currentLocation().indexOf('?')));
    expect(params.get('step')).toBe('welcome-back');
    expect(params.get('propertyId')).toBe('prop-1');
    expect(params.get('returnTo')).toBe(RETURN_TO);
    // Nothing is sent to the partner and nothing is declared yet.
    expect(declarePartner).not.toHaveBeenCalled();
  });

  it('HandoffStep_TheButton_SavesTheDraftOnWelcomeBackSoAResumeLandsThere', async () => {
    givenThePartner();
    renderWizard(`${PATH}?propertyId=prop-1&step=handoff`);
    await screen.findByTestId('partner-handoff-step', {}, WAIT);

    fireEvent.click(primaryButton());
    await waitFor(() => expect(openPartnerSite).toHaveBeenCalled(), WAIT);

    expect(readWizardDraft(partnerWizardId(CODE), SCOPE)?.step).toBe('welcome-back');
    // The person opens the wizard again (from the Marketplace, with no step in the address): the draft offers to go on from where they were.
    cleanup();
    renderWizard(`${PATH}?propertyId=prop-1`);
    fireEvent.click(await screen.findByTestId('wizard-draft-resume', {}, WAIT));
    await onStep('welcome-back');
  });

  it('HandoffStep_AddressThatIsNotHttps_IsNeverOpened', async () => {
    givenThePartner({ websiteUrl: 'http://www.partner.example/connect' });
    renderWizard(`${PATH}?propertyId=prop-1&step=handoff`);
    await screen.findByTestId('partner-handoff-step', {}, WAIT);

    fireEvent.click(primaryButton());

    expect(await screen.findByTestId('partner-finish-error', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.partnerFlow.errors.siteAddress'));
    expect(openPartnerSite).not.toHaveBeenCalled();
    await onStep('handoff');
  });

  it('HandoffStep_ExplainsTheTripAndThatNothingIsSentToThePartner', async () => {
    givenThePartner();
    renderWizard(`${PATH}?propertyId=prop-1&step=handoff`);

    expect(await screen.findByTestId('partner-handoff-nothing-sent', {}, WAIT)).toHaveTextContent('Beds24');
    expect(screen.getByTestId('partner-handoff-go')).toHaveTextContent('Beds24');
  });
});

describe('the step the person comes back to', () => {
  it('WelcomeBack_Opens_AsksIfTheActivationIsCompleteWithTodayAsTheDayAndNoFutureDay', async () => {
    givenThePartner();
    renderWizard(`${PATH}?propertyId=prop-1&step=welcome-back`);

    const day = await screen.findByTestId('partner-declared-on', {}, WAIT);
    expect(day).toHaveValue(todayInRome());
    expect(day).toHaveAttribute('max', todayInRome());
    expect(screen.getByTestId('partner-finish')).toHaveTextContent(i18n.t('marketplace.partnerFlow.welcomeBack.yes'));
  });

  it('WelcomeBack_DayInTheFuture_IsNotAcceptedAndNothingIsDeclared', async () => {
    givenThePartner();
    renderWizard(`${PATH}?propertyId=prop-1&step=welcome-back`);

    fireEvent.change(await screen.findByTestId('partner-declared-on', {}, WAIT), { target: { value: addDays(todayInRome(), 1) } });
    fireEvent.click(primaryButton());

    expect((await screen.findAllByText(i18n.t('marketplace.partnerFlow.errors.dayFuture'), {}, WAIT)).length).toBeGreaterThan(0);
    expect(declarePartner).not.toHaveBeenCalled();
    await onStep('welcome-back');
  });

  it('WelcomeBack_YesWithAPastDay_DeclaresThePartnerForThePropertyOnThatDayAndShowsTheResult', async () => {
    givenThePartner();
    vi.mocked(declarePartner).mockResolvedValue(activation());
    renderWizard(`${PATH}?propertyId=prop-1&step=welcome-back`);

    fireEvent.change(await screen.findByTestId('partner-declared-on', {}, WAIT), { target: { value: '2026-11-10' } });
    fireEvent.click(primaryButton());

    await onStep('fatto');
    expect(declarePartner).toHaveBeenCalledTimes(1);
    expect(declarePartner).toHaveBeenCalledWith(CODE, 'prop-1', '2026-11-10');
    expect(screen.getByTestId('partner-result-badge')).toHaveTextContent(i18n.t('marketplace.status.Active'));
    // «Declared by you», with the day: never «verified» when only the host's word backs it.
    expect(screen.getByTestId('partner-result')).toHaveTextContent(i18n.t('marketplace.partnerFlow.result.declared', { date: '10 novembre 2026' }));
    expect(screen.getByTestId('partner-result')).not.toHaveTextContent(/verificat/i);
  });

  it('WelcomeBack_BackendRecordedAVerification_IsTheOnlyTimeTheResultSaysVerified', async () => {
    givenThePartner();
    vi.mocked(declarePartner).mockResolvedValue(activation({ isDeclared: false, verifiedAt: '2026-11-11T08:00:00Z' }));
    renderWizard(`${PATH}?propertyId=prop-1&step=welcome-back`);
    await screen.findByTestId('partner-declared-on', {}, WAIT);

    fireEvent.click(primaryButton());

    await onStep('fatto');
    expect(screen.getByTestId('partner-result')).toHaveTextContent(i18n.t('marketplace.partnerFlow.result.verified', { date: '10 novembre 2026' }));
  });

  it('WelcomeBack_DeclarationForTheWholeOrganizationByAPersonWhoSeesSomeProperties_IsToldInSimpleWords', async () => {
    givenThePartner();
    vi.mocked(declarePartner).mockRejectedValue(axiosError(403, { code: 'marketplace_partner_needs_whole_org' }));
    renderWizard(`${PATH}?step=welcome-back`);
    await screen.findByTestId('partner-declared-on', {}, WAIT);

    fireEvent.click(primaryButton());

    expect(await screen.findByTestId('partner-finish-error', {}, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.marketplacePartnerNeedsWholeOrg'));
    expect(declarePartner).toHaveBeenCalledWith(CODE, undefined, todayInRome());
    await onStep('welcome-back');
  });

  it('WelcomeBack_NotYet_IsTheWayOutThatKeepsTheDraftAndGoesBackToTheReturnToWithoutDeclaring', async () => {
    givenThePartner();
    renderWizard(`${PATH}?propertyId=prop-1&step=welcome-back&returnTo=${encodeURIComponent(RETURN_TO)}`);
    await screen.findByTestId('partner-declared-on', {}, WAIT);

    expect(screen.getByTestId('partner-save-exit')).toHaveTextContent(i18n.t('marketplace.partnerFlow.welcomeBack.notYet'));
    fireEvent.click(screen.getByTestId('partner-save-exit'));

    expect(await screen.findByTestId('somewhere-else-marker', {}, WAIT)).toBeInTheDocument();
    expect(declarePartner).not.toHaveBeenCalled();
  });
});

describe('the way out', () => {
  it('PartnerResult_ClosingButtonWithAValidReturnTo_GoesBackThere_AndWithoutOneToTheMarketplace', async () => {
    givenThePartner();
    vi.mocked(declarePartner).mockResolvedValue(activation());
    renderWizard(`${PATH}?propertyId=prop-1&step=welcome-back&returnTo=${encodeURIComponent(RETURN_TO)}`);
    await screen.findByTestId('partner-declared-on', {}, WAIT);
    fireEvent.click(primaryButton());
    await onStep('fatto');

    fireEvent.click(screen.getByTestId('wizard-done-primary'));
    expect(await screen.findByTestId('somewhere-else-marker', {}, WAIT)).toBeInTheDocument();

    cleanup();
    renderWizard(`${PATH}?propertyId=prop-1&step=welcome-back`);
    await screen.findByTestId('partner-declared-on', {}, WAIT);
    fireEvent.click(primaryButton());
    await onStep('fatto');
    fireEvent.click(screen.getByTestId('wizard-done-primary'));
    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });

  it.each([['https://evil.example/app/'], ['//evil.example/x'], ['/login']])('PartnerResult_ReturnToThatIsNotAPageOfTheApp_%s_GoesToTheMarketplace', async (returnTo) => {
    givenThePartner();
    vi.mocked(declarePartner).mockResolvedValue(activation());
    renderWizard(`${PATH}?propertyId=prop-1&step=welcome-back&returnTo=${encodeURIComponent(returnTo)}`);
    await screen.findByTestId('partner-declared-on', {}, WAIT);
    fireEvent.click(primaryButton());
    await onStep('fatto');

    fireEvent.click(screen.getByTestId('wizard-done-primary'));

    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });

  it('PartnerResult_AddressOfTheResultOpenedAgain_SaysTheActivationIsRecordedAndLeadsOn', async () => {
    givenThePartner();
    renderWizard(`${PATH}?propertyId=prop-1&step=fatto`);

    expect(await screen.findByTestId('partner-result', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.partnerFlow.result.over'));
    expect(screen.queryByTestId('partner-result-badge')).not.toBeInTheDocument();
  });

  it('SaveAndExit_OnEveryStepButTheQuestion_GoesBackToTheMarketplaceWithoutAReturnTo', async () => {
    givenThePartner();
    renderWizard(`${PATH}?propertyId=prop-1`);
    await screen.findByTestId('partner-prepare-step', {}, WAIT);

    expect(screen.getByTestId('partner-save-exit')).toHaveTextContent(i18n.t('marketplace.partnerFlow.exit.saveAndExit'));
    fireEvent.click(screen.getByTestId('partner-save-exit'));

    expect(await screen.findByTestId('marketplace-marker', {}, WAIT)).toBeInTheDocument();
  });
});
