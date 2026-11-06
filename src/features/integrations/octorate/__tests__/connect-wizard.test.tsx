import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { octorateApi } from '@/api/octorate.api';
import { propertiesApi } from '@/api/properties.api';
import { propertyIcalApi } from '@/api/property-ical.api';
import { expectNoAxeViolations } from '@/test/axe';
import { writeWizardDraft } from '@/lib/wizard-draft';
import { OCTORATE_CONNECT_PATH } from '../octorate-callback';
import {
  CONSENT_URL,
  SCOPE,
  WAIT,
  WIZARD_DRAFT_ID,
  axiosError,
  connection,
  currentLocation,
  onStep,
  renderWizard,
} from './octorate-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/octorate.api', () => ({
  octorateApi: {
    getConnectionStatus: vi.fn(),
    startConnect: vi.fn(),
    completeConnect: vi.fn(),
    disconnect: vi.fn(),
    getFoundListings: vi.fn(),
    refreshListings: vi.fn(),
    confirmMapping: vi.fn(),
    setMappingRoom: vi.fn(),
    rejectMapping: vi.fn(),
    importListing: vi.fn(),
  },
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/property-ical.api', () => ({ propertyIcalApi: { getFeeds: vi.fn() } }));

// A whole wizard is rendered in these tests (and checked with axe): the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const CODE = 'code-of-the-callback';
const STATE = 'state-of-the-callback';
const CALLBACK_URL = `${OCTORATE_CONNECT_PATH}?code=${CODE}&state=${STATE}`;
/** The consent step, opened as the host does after the first two steps. */
const CONSENT_STEP_URL = `${OCTORATE_CONNECT_PATH}?step=consent`;

/** The main button of every step but the last: on the consent it sends the host to the channel manager, or on to the listings. */
const nextButton = () => screen.getByTestId('octorate-connect-next');
/** The main button of the last step, the summary. */
const finishButton = () => screen.getByTestId('octorate-connect-finish');
const wizardText = () => screen.getByTestId('octorate-connect-wizard');

/** Opens the wizard on the consent step with the first answer in the draft, as the host leaves it at the second step. */
function renderOnTheConsent() {
  writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'consent', values: { scenario: 'onOctorate' } });
  return renderWizard(CONSENT_STEP_URL);
}

/** The button of the consent step can be pressed: the state of the connection has been read. */
async function readyToPress() {
  await onStep('consent');
  await waitFor(() => expect(nextButton()).toBeEnabled(), WAIT);
}

/** From the consent of a connected channel manager to the summary, pressing "Continue" on each step. */
async function toTheSummary() {
  fireEvent.click(nextButton());
  await onStep('channels');
  fireEvent.click(nextButton());
  await onStep('mapping');
  fireEvent.click(nextButton());
  await onStep('summary');
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
  vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection());
  vi.mocked(octorateApi.startConnect).mockResolvedValue({ authorizationUrl: CONSENT_URL });
  vi.mocked(octorateApi.completeConnect).mockResolvedValue({ status: 'Connected', environment: 'Test', propertyCount: 3 });
  vi.mocked(octorateApi.getFoundListings).mockResolvedValue([]);
  vi.mocked(octorateApi.refreshListings).mockResolvedValue([]);
  vi.mocked(propertiesApi.getAll).mockResolvedValue([]);
  vi.mocked(propertyIcalApi.getFeeds).mockResolvedValue([]);
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

describe('the consent: from CasaZen to the channel manager', () => {
  it('OctorateConnectWizard_Consent_SaysWhatWillHappenBeforeAnythingHappens', async () => {
    renderOnTheConsent();

    await readyToPress();

    expect(screen.getByRole('heading', { level: 2, name: i18n.t('octorate.connect.steps.consent.title') })).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.consentExplanation'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.consent.steps.open'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.consent.steps.signIn'))).toBeInTheDocument();
    expect(screen.getByText(i18n.t('octorate.connect.consent.steps.comeBack'))).toBeInTheDocument();
    expect(nextButton()).toHaveTextContent(i18n.t('octorate.connect.consent.next.start'));
    // Looking at the consent starts nothing.
    expect(octorateApi.startConnect).not.toHaveBeenCalled();
    expect(octorateApi.completeConnect).not.toHaveBeenCalled();
  });

  it('OctorateConnectWizard_WhyAndConsentSteps_NameNoChannelManager', async () => {
    renderWizard();
    await onStep('scenario');
    fireEvent.click(screen.getByTestId('octorate-scenario-onOctorate'));
    fireEvent.click(screen.getByTestId('octorate-connect-next'));
    await onStep('why');
    expect(wizardText().textContent).not.toMatch(/octorate/i);

    fireEvent.click(screen.getByTestId('octorate-connect-next'));
    await onStep('consent');
    await readyToPress();
    // "Your channel manager", never its name (NF-12): it is named in the first question only.
    expect(wizardText().textContent).not.toMatch(/octorate/i);
    expect(wizardText()).toHaveTextContent(/channel manager/i);
  });

  it('OctorateConnectWizard_Consent_OpensTheConsentPageInTheSameTabAndGoesNoFurther', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    renderOnTheConsent();
    await readyToPress();

    fireEvent.click(nextButton());

    await waitFor(() => expect(assign).toHaveBeenCalledWith(CONSENT_URL), WAIT);
    expect(octorateApi.startConnect).toHaveBeenCalledTimes(1);
    expect(octorateApi.completeConnect).not.toHaveBeenCalled();
    // The page is being left: the wizard stays on the step, busy, and does not go on to the listings.
    expect(nextButton()).toHaveAttribute('aria-busy', 'true');
    expect(wizardText()).toHaveAttribute('data-step', 'consent');
  });

  it('OctorateConnectWizard_ConsentAddressThatIsNotHttps_IsNeverFollowed', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    vi.mocked(octorateApi.startConnect).mockResolvedValue({ authorizationUrl: 'javascript:void(0)' });
    renderOnTheConsent();
    await readyToPress();

    fireEvent.click(nextButton());

    expect(await screen.findByTestId('octorate-connect-finish-error', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.finishFailed'));
    expect(assign).not.toHaveBeenCalled();
  });

  it('OctorateConnectWizard_ConsentRefusedByTheServer_ShowsTheReasonInTheWordsOfTheApp', async () => {
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    vi.mocked(octorateApi.startConnect).mockRejectedValue(axiosError(403, { code: 'octorate_connection_needs_whole_org' }));
    renderOnTheConsent();
    await readyToPress();

    fireEvent.click(nextButton());

    expect(await screen.findByTestId('octorate-connect-finish-error', undefined, WAIT)).toHaveTextContent(
      i18n.t('apiErrors.codes.octorateConnectionNeedsWholeOrg'),
    );
    expect(assign).not.toHaveBeenCalled();
  });
});

describe('the return from the channel manager: the same page, the same step', () => {
  it('OctorateConnectWizard_BackWithTheConsent_ExchangesTheCodeOnceAndRemovesItFromTheAddress', async () => {
    renderWizard(CALLBACK_URL);

    // It comes back to the step it left from, and says what it is doing.
    await onStep('consent');
    const connected = await screen.findByTestId('octorate-consent-connected', undefined, WAIT);

    expect(octorateApi.completeConnect).toHaveBeenCalledTimes(1);
    expect(octorateApi.completeConnect).toHaveBeenCalledWith(CODE, STATE);
    expect(connected).toHaveTextContent(i18n.t('octorate.connect.consent.connected.title'));
    expect(connected).toHaveTextContent(i18n.t('octorate.connect.consent.connected.found', { count: 3 }));
    // The code and the state are single-use secrets: not in the address bar, not in the history, not in a reload.
    expect(currentLocation()).toBe(`${OCTORATE_CONNECT_PATH}?step=consent`);
    expect(currentLocation()).not.toContain(CODE);
    expect(currentLocation()).not.toContain(STATE);
    // The consent is done: the main button leads on to the listings that were found.
    expect(nextButton()).toHaveTextContent(i18n.t('octorate.connect.consent.next.listings'));
    // Back from the consent the exchange answers; the state of the connection is not read a second time.
    expect(octorateApi.getConnectionStatus).not.toHaveBeenCalled();
    expect(octorateApi.startConnect).not.toHaveBeenCalled();
  });

  it('OctorateConnectWizard_BackWithTheConsent_GoesOnToTheListingsInTheSameWizardAndFinishesInTheResult', async () => {
    renderWizard(CALLBACK_URL);
    await screen.findByTestId('octorate-consent-connected', undefined, WAIT);
    await waitFor(() => expect(nextButton()).toBeEnabled(), WAIT);

    await toTheSummary();
    fireEvent.click(finishButton());

    expect(await screen.findByRole('heading', { level: 2, name: i18n.t('octorate.connect.done.title') }, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('wizard-done-primary')).toHaveTextContent(i18n.t('octorate.connect.done.checkImported'));
    expect(currentLocation()).toContain('step=fatto');
    // Done once: the exchange of the code is not asked again, and the host never left the wizard.
    expect(octorateApi.completeConnect).toHaveBeenCalledTimes(1);
    expect(octorateApi.startConnect).not.toHaveBeenCalled();
  });

  it('OctorateConnectWizard_BackWithTheConsentAndNoDraft_StillKnowsTheAnswerToTheFirstQuestion', async () => {
    // The draft is gone (another tab, a cleared session): the consent proves the answer, so the wizard can finish.
    renderWizard(CALLBACK_URL);
    await screen.findByTestId('octorate-consent-connected', undefined, WAIT);
    await waitFor(() => expect(nextButton()).toBeEnabled(), WAIT);

    await toTheSummary();
    fireEvent.click(finishButton());

    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-error-summary')).not.toBeInTheDocument();
  });

  it('OctorateConnectWizard_BackWithTheConsentAndADraftWithoutTheAnswer_DropsTheDraftAndStillFinishes', async () => {
    // A draft that does not say "already on the channel manager" cannot take the answer away from the consent that just happened.
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'consent', values: { scenario: null } });
    renderWizard(CALLBACK_URL);
    await screen.findByTestId('octorate-consent-connected', undefined, WAIT);
    await waitFor(() => expect(nextButton()).toBeEnabled(), WAIT);

    await toTheSummary();
    fireEvent.click(finishButton());

    expect(await screen.findByTestId('wizard-done-primary', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-error-summary')).not.toBeInTheDocument();
  });

  it('OctorateConnectWizard_BackWithADraftWhoseDecisionsAreNotDecisions_DropsTheDraft', async () => {
    // A draft is just data in the tab: decisions that are not a list of decisions are never used.
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'mapping', values: { scenario: 'onOctorate', decisions: 'not-a-list' } });
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=mapping`);

    await onStep('mapping');

    expect(await screen.findByTestId('octorate-mapping-step', undefined, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('wizard-error-summary')).not.toBeInTheDocument();
  });

  it('OctorateConnectWizard_BackWithAnExchangeThatFails_ShowsWhyAndOffersToStartAgain', async () => {
    vi.mocked(octorateApi.completeConnect).mockRejectedValue(axiosError(400, { code: 'octorate_state_invalid' }));
    renderWizard(CALLBACK_URL);

    const failed = await screen.findByTestId('octorate-consent-failed', undefined, WAIT);

    expect(failed).toHaveTextContent(i18n.t('apiErrors.codes.octorateStateInvalid'));
    expect(currentLocation()).toBe(`${OCTORATE_CONNECT_PATH}?step=consent`);
    // The code is used once and the state is spent: the way on is a new consent, with the same button.
    expect(nextButton()).toHaveTextContent(i18n.t('octorate.connect.consent.next.retry'));
    const assign = vi.fn();
    vi.stubGlobal('location', { ...window.location, assign });
    fireEvent.click(nextButton());
    await waitFor(() => expect(assign).toHaveBeenCalledWith(CONSENT_URL), WAIT);
    expect(octorateApi.completeConnect).toHaveBeenCalledTimes(1);
  });

  it('OctorateConnectWizard_BackWithCredentialsOfAnotherEnvironment_DoesNotSayItIsConnected', async () => {
    vi.mocked(octorateApi.completeConnect).mockRejectedValue(axiosError(409, { code: 'octorate_wrong_environment' }));
    renderWizard(CALLBACK_URL);

    const failed = await screen.findByTestId('octorate-consent-failed', undefined, WAIT);

    expect(failed).toHaveTextContent(i18n.t('apiErrors.codes.octorateWrongEnvironment'));
    expect(screen.queryByTestId('octorate-consent-connected')).not.toBeInTheDocument();
  });

  it('OctorateConnectWizard_BackWithoutTheConsent_ConnectsNothingAndSendsNoCode', async () => {
    renderWizard(`${OCTORATE_CONNECT_PATH}?error=access_denied&state=${STATE}`);

    expect(await screen.findByTestId('octorate-consent-denied', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.consent.denied.text'));

    expect(octorateApi.completeConnect).not.toHaveBeenCalled();
    expect(currentLocation()).toBe(`${OCTORATE_CONNECT_PATH}?step=consent`);
    expect(nextButton()).toHaveTextContent(i18n.t('octorate.connect.consent.next.retry'));
  });

  it('OctorateConnectWizard_BackWithACodeAndNoState_IsNotCompleted', async () => {
    renderWizard(`${OCTORATE_CONNECT_PATH}?code=${CODE}`);

    expect(await screen.findByTestId('octorate-consent-denied', undefined, WAIT)).toBeInTheDocument();

    // The state is what binds the consent to the org and the person: without it nothing is sent.
    expect(octorateApi.completeConnect).not.toHaveBeenCalled();
    expect(currentLocation()).not.toContain(CODE);
  });
});

describe('the state of the connection', () => {
  it('OctorateConnectWizard_AlreadyConnected_SaysSoAndGoesOnToTheListingsWithoutAskingTheConsentAgain', async () => {
    vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection({ status: 'Connected' }));
    renderOnTheConsent();
    await onStep('consent');

    const connected = await screen.findByTestId('octorate-consent-connected', undefined, WAIT);

    expect(connected).toHaveTextContent(i18n.t('octorate.connect.consent.connected.already'));
    expect(nextButton()).toHaveTextContent(i18n.t('octorate.connect.consent.next.listings'));
    fireEvent.click(nextButton());
    await onStep('channels');
    expect(octorateApi.startConnect).not.toHaveBeenCalled();
    expect(octorateApi.completeConnect).not.toHaveBeenCalled();
  });

  it('OctorateConnectWizard_ConnectionInError_AsksToConnectAgain', async () => {
    vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection({ status: 'Error' }));
    renderOnTheConsent();
    await onStep('consent');

    expect(await screen.findByTestId('octorate-consent-attention', undefined, WAIT)).toHaveTextContent(i18n.t('octorate.connect.consent.attention.text'));

    expect(nextButton()).toHaveTextContent(i18n.t('octorate.connect.consent.next.retry'));
    expect(nextButton()).toBeEnabled();
  });

  it('OctorateConnectWizard_ConfirmationOpenedAgainWithoutAConnection_GoesBackToTheBeginning', async () => {
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=fatto`);

    // The server says nothing is connected: the confirmation would be false.
    await onStep('scenario');

    expect(screen.queryByTestId('wizard-done-primary')).not.toBeInTheDocument();
  });

  it('OctorateConnectWizard_ConfirmationOpenedAgainWithAConnection_ShowsTheResultAsTheServerHasIt', async () => {
    vi.mocked(octorateApi.getConnectionStatus).mockResolvedValue(connection({ status: 'Connected' }));
    renderWizard(`${OCTORATE_CONNECT_PATH}?step=fatto`);

    expect(await screen.findByRole('heading', { level: 2, name: i18n.t('octorate.connect.done.title') }, WAIT)).toBeInTheDocument();
    expect(screen.getByTestId('wizard-done-primary')).toBeInTheDocument();
    expect(octorateApi.getFoundListings).toHaveBeenCalled();
  });
});

describe('accessibility of the consent step (NF-14)', () => {
  it('OctorateConnectWizard_ConsentStep_HasNoViolationThatAxeCanFindWithoutABrowser', async () => {
    const { container } = renderOnTheConsent();
    await readyToPress();
    await expectNoAxeViolations(container);
  });

  it('OctorateConnectWizard_ReturnStates_HaveNoViolationThatAxeCanFindWithoutABrowser', async () => {
    const view = renderWizard(CALLBACK_URL);
    await screen.findByTestId('octorate-consent-connected', undefined, WAIT);
    await expectNoAxeViolations(view.container);
    view.unmount();

    vi.mocked(octorateApi.completeConnect).mockRejectedValue(axiosError(502, { code: 'octorate_exchange_failed' }));
    const failedView = renderWizard(CALLBACK_URL);
    await screen.findByTestId('octorate-consent-failed', undefined, WAIT);
    await expectNoAxeViolations(failedView.container);
  });
});
