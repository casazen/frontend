import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { getActivationPlan } from '@/api/marketplace.api';
import { propertiesApi } from '@/api/properties.api';
import { CHANNELS_PAGE_PATH } from '../../lib/marketplace-paths';
import { readWizardDraft, writeWizardDraft } from '@/lib/wizard-draft';
import { ACTIVATION_PATH, SCOPE, WAIT, WIZARD_DRAFT_ID, axiosError, currentLocation, onStep, plan, primaryButton, property, renderActivation } from './activation-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/marketplace.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/marketplace.api')>()),
  getActivationPlan: vi.fn(),
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'short-rent', roleKey: 'property_owner' }] }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { octorateOnboarding: true } }) }));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const ROSA = property('prop-1', 'Casa Rosa');
const AZZURRA = property('prop-2', 'Casa Azzurra');

/** The host has these properties; `unlinked` have no confirmed listing on the channel manager. */
function givenProperties(properties = [ROSA, AZZURRA], unlinked: string[] = [], overrides: Partial<ReturnType<typeof plan>> = {}) {
  vi.mocked(propertiesApi.getAll).mockResolvedValue(properties);
  vi.mocked(getActivationPlan).mockImplementation(async (_kind, _code, propertyId) =>
    plan({ propertyId, propertyLinked: !unlinked.includes(propertyId), ...overrides }),
  );
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the first step: which properties', () => {
  it('PropertyStep_TwoLinkedProperties_CanBeChosenTogetherAndTheCountSaysHowMany', async () => {
    givenProperties();
    renderActivation(ACTIVATION_PATH);

    fireEvent.click(await screen.findByTestId('activation-property-prop-1', {}, WAIT));
    fireEvent.click(screen.getByTestId('activation-property-prop-2'));

    await waitFor(() => expect(screen.getByTestId('activation-property-count')).toHaveTextContent(i18n.t('marketplace.activation.property.selected', { count: 2 })), WAIT);
  });

  it('PropertyStep_PlanOfOnePropertyThatCouldNotBeRead_IsToldWithRetryAndTheOthersAreStillThere', async () => {
    givenProperties();
    let failing = true;
    vi.mocked(getActivationPlan).mockImplementation(async (_kind, _code, propertyId) => {
      if (propertyId === 'prop-2' && failing) throw axiosError(500, { title: 'Server error' });
      return plan({ propertyId });
    });
    renderActivation(ACTIVATION_PATH);

    // The property whose plan was not read does not vanish: it is named, with the way to read it again; the one that was read is in the list.
    const notice = await screen.findByTestId('activation-unread', {}, WAIT);
    expect(notice).toHaveTextContent(i18n.t('marketplace.activation.property.unread', { names: 'Casa Azzurra' }));
    expect(screen.getByTestId('activation-property-prop-1')).toBeInTheDocument();
    expect(screen.queryByTestId('activation-property-prop-2')).not.toBeInTheDocument();

    failing = false;
    fireEvent.click(screen.getByTestId('activation-unread-retry'));

    expect(await screen.findByTestId('activation-property-prop-2', {}, WAIT)).toBeInTheDocument();
    await waitFor(() => expect(screen.queryByTestId('activation-unread')).not.toBeInTheDocument(), WAIT);
  });

  it('PropertyStep_TheOnlyLinkedProperty_IsChosenForThePerson', async () => {
    givenProperties([ROSA]);
    renderActivation(ACTIVATION_PATH);

    await waitFor(() => expect(screen.getByTestId('activation-property-prop-1')).toBeChecked(), WAIT);
  });

  it('PropertyStep_PropertyOfTheAddress_IsChosenFromTheStart', async () => {
    givenProperties();
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-2`);

    await waitFor(() => expect(screen.getByTestId('activation-property-prop-2')).toBeChecked(), WAIT);
    expect(screen.getByTestId('activation-property-prop-1')).not.toBeChecked();
  });

  it('PropertyStep_DraftOfTheTabThatDoesNotNameThePropertyOfTheAddress_IsDroppedSoTheWizardOpensOnTheOneThePersonCameFor', async () => {
    givenProperties();
    // The draft that an earlier visit left in this tab names another property.
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'property', values: { propertyIds: ['prop-1'], hotelIds: {} } });
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-2`);

    await waitFor(() => expect(screen.getByTestId('activation-property-prop-2')).toBeChecked(), WAIT);
    expect(screen.getByTestId('activation-property-prop-1')).not.toBeChecked();
    expect(screen.getByTestId('activation-property-count')).toHaveTextContent(i18n.t('marketplace.activation.property.selected', { count: 1 }));
  });

  it('PropertyStep_DraftOfTheTabThatNamesThePropertyOfTheAddress_IsKeptWithEverythingItHolds', async () => {
    givenProperties();
    // The person comes back (from the panel of the channel manager, from «Salva ed esci») to the properties they had chosen.
    writeWizardDraft(WIZARD_DRAFT_ID, SCOPE, { step: 'property', values: { propertyIds: ['prop-1', 'prop-2'], hotelIds: {} } });
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-2&step=property`);

    await waitFor(() => expect(screen.getByTestId('activation-property-prop-2')).toBeChecked(), WAIT);
    expect(screen.getByTestId('activation-property-prop-1')).toBeChecked();
  });

  it('PropertyStep_PropertyOfTheAddressThatIsNotLinked_IsTakenOutOfTheChoiceAndNotChosenInSilence', async () => {
    givenProperties([ROSA, AZZURRA, property('prop-3', 'Casa Verde')], ['prop-3']);
    renderActivation(`${ACTIVATION_PATH}?propertyId=prop-3`);

    // The property of the address cannot be chosen: it is not shown as chosen and is not counted, and the step does not go on with it.
    await screen.findByTestId('activation-not-linked-prop-3', {}, WAIT);
    await waitFor(() => expect(screen.getByTestId('activation-property-count')).toHaveTextContent(i18n.t('marketplace.activation.property.selected', { count: 0 })), WAIT);
    // It is also gone from the answers of the wizard (the draft says so), not only from the screen.
    await waitFor(() => expect(readWizardDraft(WIZARD_DRAFT_ID, SCOPE)?.values.propertyIds).toEqual([]), WAIT);
    fireEvent.click(primaryButton());
    expect((await screen.findAllByText(i18n.t('marketplace.activation.errors.noProperty'), {}, WAIT)).length).toBeGreaterThan(0);
    await onStep('property');
  });

  it('PropertyStep_ContinueWithNoPropertyChosen_StaysAndAsksForOne', async () => {
    givenProperties();
    renderActivation(ACTIVATION_PATH);
    await screen.findByTestId('activation-property-prop-1', {}, WAIT);

    fireEvent.click(primaryButton());

    // Said under the choice and in the summary of the problems of the shell.
    expect((await screen.findAllByText(i18n.t('marketplace.activation.errors.noProperty'), {}, WAIT)).length).toBeGreaterThan(0);
    await onStep('property');
  });
});

describe('the first step: a property that cannot be chosen', () => {
  it('PropertyStep_PropertyWithoutAConfirmedListing_IsToldWithOneSentenceAndALinkToTheChannelsPage', async () => {
    givenProperties([ROSA, AZZURRA], ['prop-2']);
    renderActivation(ACTIVATION_PATH);

    const note = await screen.findByTestId('activation-not-linked-prop-2', {}, WAIT);
    expect(note).toHaveTextContent(`Casa Azzurra ${i18n.t('marketplace.activation.property.notLinked.item')}`);
    // It cannot be chosen: there is no choice for it, and the one that is linked is the only one offered.
    expect(screen.queryByTestId('activation-property-prop-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('activation-property-prop-1')).toBeInTheDocument();
    // The one way out of the wizard: the page where the connect and mapping wizard starts.
    expect(screen.getByTestId('activation-link-properties')).toHaveAttribute('href', CHANNELS_PAGE_PATH);
  });

  it('PropertyStep_TheLinkToTheChannelsPage_LeavesTheWizardThere', async () => {
    givenProperties([ROSA, AZZURRA], ['prop-2']);
    renderActivation(ACTIVATION_PATH);

    fireEvent.click(await screen.findByTestId('activation-link-properties', {}, WAIT));

    expect(await screen.findByTestId('channels-marker', {}, WAIT)).toBeInTheDocument();
    expect(currentLocation()).toBe(CHANNELS_PAGE_PATH);
  });

  it('PropertyStep_ChannelManagerNotConnectedAtAll_IsToldInOneSentenceWithTheWayToFixIt', async () => {
    vi.mocked(propertiesApi.getAll).mockResolvedValue([ROSA]);
    vi.mocked(getActivationPlan).mockRejectedValue(axiosError(409, { code: 'marketplace_octorate_not_connected' }));
    renderActivation(ACTIVATION_PATH);

    const notice = await screen.findByTestId('activation-not-connected', {}, WAIT);
    expect(notice).toHaveTextContent(i18n.t('marketplace.activation.property.notConnected.title'));
    expect(screen.getByTestId('activation-connect-link')).toHaveAttribute('href', CHANNELS_PAGE_PATH);
    expect(screen.queryByTestId('activation-property-prop-1')).not.toBeInTheDocument();
    expect(primaryButton()).toBeDisabled();
  });

  it('PropertyStep_PortalThatCannotBeConnectedThroughTheApi_SaysSoAndTheWizardWaits', async () => {
    givenProperties([ROSA], [], { creatable: false });
    renderActivation(ACTIVATION_PATH);

    expect(await screen.findByTestId('activation-not-creatable', {}, WAIT)).toHaveTextContent('Booking.com');
    expect(primaryButton()).toBeDisabled();
  });

  it('PropertyStep_HostWithNoShortRentProperty_IsToldAndNothingIsAsked', async () => {
    givenProperties([]);
    renderActivation(ACTIVATION_PATH);

    expect(await screen.findByTestId('activation-no-properties', {}, WAIT)).toBeInTheDocument();
    expect(getActivationPlan).not.toHaveBeenCalled();
  });
});

describe('the page of the wizard', () => {
  it('ActivationWizardPage_AddressThatNamesNeitherAChannelNorAToolOrCarriesAPath_IsToldNotOpened', async () => {
    givenProperties();
    renderActivation('/app/short-rent/marketplace/activate/partner/142');

    expect(await screen.findByText(i18n.t('marketplace.activation.notFound.title'), {}, WAIT)).toBeInTheDocument();
    expect(screen.queryByTestId('activation-wizard')).not.toBeInTheDocument();
    expect(getActivationPlan).not.toHaveBeenCalled();
  });
});
