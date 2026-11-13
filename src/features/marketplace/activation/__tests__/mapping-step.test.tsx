import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, screen, waitFor } from '@testing-library/react';
import i18n from '@/i18n/config';
import { getActivation, getActivationMapping, getActivationPlan, saveActivationMapping } from '@/api/marketplace.api';
import { propertiesApi } from '@/api/properties.api';
import { ACTIVATION_PATH, WAIT, axiosError, channelRoom, mapping, onStep, plan, primaryButton, property, renderActivation, state } from './activation-fixtures';

vi.mock('sonner', () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }));
vi.mock('@/queries/use-users', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-users')>()),
  useCurrentUser: () => ({ user: { id: 'user-1' }, org: { id: 'org-1' } }),
}));
vi.mock('@/api/properties.api', () => ({ propertiesApi: { getAll: vi.fn() } }));
vi.mock('@/api/marketplace.api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/api/marketplace.api')>()),
  getActivationPlan: vi.fn(),
  getActivation: vi.fn(),
  getActivationMapping: vi.fn(),
  saveActivationMapping: vi.fn(),
}));
vi.mock('@/hooks/use-workspace', () => ({ useWorkspace: () => ({ contexts: [{ contextKey: 'short-rent', roleKey: 'property_owner' }] }) }));
vi.mock('@/hooks/use-feature-flags', () => ({ useFeatureFlags: () => ({ flags: { octorateOnboarding: true } }) }));

// A whole wizard is rendered in these tests: the 5 s of the default are not enough on a loaded CI runner.
vi.setConfig({ testTimeout: 30_000 });

const MAPPING_URL = `${ACTIVATION_PATH}?propertyId=prop-1&step=mapping`;
const select = (roomId: string) => screen.getByTestId(`activation-room-prop-1-${roomId}`) as HTMLSelectElement;

/** The host has one property, connected and imported: the channel manager gives these rooms. */
function givenTheRoomsOfTheChannel(rooms = [channelRoom()]) {
  vi.mocked(propertiesApi.getAll).mockResolvedValue([property()]);
  vi.mocked(getActivationPlan).mockImplementation(async (_kind, _code, propertyId) =>
    plan({ propertyId, requirements: [], activationId: 'act-1', activationStatus: 'Pending' }),
  );
  vi.mocked(getActivation).mockResolvedValue(state());
  vi.mocked(getActivationMapping).mockResolvedValue(mapping(rooms));
  vi.mocked(saveActivationMapping).mockResolvedValue(state());
}

beforeEach(async () => {
  vi.clearAllMocks();
  sessionStorage.clear();
  await i18n.changeLanguage('it');
});

afterEach(() => {
  cleanup();
});

describe('the mapping step: the rooms of the channel', () => {
  it('MappingStep_RoomsOfTheChannel_ShowTheRoomCasaZenProposesAlreadyChosen', async () => {
    givenTheRoomsOfTheChannel([
      channelRoom({ channelRoomId: 'room-1', name: 'Camera doppia', proposedProductId: 'prod-1' }),
      channelRoom({ channelRoomId: 'room-2', name: 'Suite', proposedProductId: 'prod-2' }),
    ]);
    renderActivation(MAPPING_URL);

    await screen.findByTestId('activation-room-prop-1-room-1', {}, WAIT);
    expect(select('room-1')).toHaveValue('prod-1');
    expect(select('room-2')).toHaveValue('prod-2');
    // Where the server proposes, the screen says so: the person confirms instead of choosing.
    expect(screen.getAllByText(i18n.t('marketplace.activation.mapping.proposed'))).toHaveLength(2);
    // The options are the products of the listing and the explicit «do not link».
    expect(Array.from(select('room-1').options).map((option) => option.value)).toEqual(['', 'prod-1', 'prod-2', '__skip__']);
  });

  it('MappingStep_ChangeOneRoomAndLeaveAnotherOut_SavesThroughTheBackendOnlyTheRoomsThatAreMapped', async () => {
    givenTheRoomsOfTheChannel([
      channelRoom({ channelRoomId: 'room-1', proposedProductId: 'prod-1' }),
      channelRoom({ channelRoomId: 'room-2', name: 'Suite', proposedProductId: 'prod-2' }),
    ]);
    renderActivation(MAPPING_URL);
    await screen.findByTestId('activation-room-prop-1-room-1', {}, WAIT);

    fireEvent.change(select('room-1'), { target: { value: 'prod-2' } });
    fireEvent.change(select('room-2'), { target: { value: '__skip__' } });
    fireEvent.click(primaryButton());

    await onStep('activate');
    expect(saveActivationMapping).toHaveBeenCalledTimes(1);
    // The room that was left out is not in the body: «not on this channel» is never sent as a product.
    expect(saveActivationMapping).toHaveBeenCalledWith('act-1', [{ channelRoomId: 'room-1', productId: 'prod-2' }]);
  });

  it('MappingStep_ProposalsAccepted_AreSavedAsTheyAre', async () => {
    givenTheRoomsOfTheChannel([channelRoom({ channelRoomId: 'room-1', proposedProductId: 'prod-1' })]);
    renderActivation(MAPPING_URL);
    await screen.findByTestId('activation-room-prop-1-room-1', {}, WAIT);

    fireEvent.click(primaryButton());

    await onStep('activate');
    expect(saveActivationMapping).toHaveBeenCalledWith('act-1', [{ channelRoomId: 'room-1', productId: 'prod-1' }]);
  });

  it('MappingStep_RoomMappedAlreadyOnTheChannelManager_HasNoDoNotLinkChoiceAndSaysItCanOnlyBeChanged', async () => {
    givenTheRoomsOfTheChannel([
      channelRoom({ channelRoomId: 'room-1', name: 'Camera doppia', mappedProductId: 'prod-2', proposedProductId: 'prod-1' }),
      channelRoom({ channelRoomId: 'room-2', name: 'Suite', mappedProductId: null, proposedProductId: 'prod-2' }),
    ]);
    renderActivation(MAPPING_URL);
    await screen.findByTestId('activation-room-prop-1-room-1', {}, WAIT);

    // The mapping that exists is the choice, and the save cannot remove one: «do not link» is offered only for the room that is not mapped.
    expect(select('room-1')).toHaveValue('prod-2');
    expect(Array.from(select('room-1').options).map((option) => option.value)).toEqual(['', 'prod-1', 'prod-2']);
    expect(Array.from(select('room-2').options).map((option) => option.value)).toEqual(['', 'prod-1', 'prod-2', '__skip__']);
    expect(screen.getAllByText(i18n.t('marketplace.activation.mapping.alreadyLinked'))).toHaveLength(1);

    fireEvent.click(primaryButton());

    await onStep('activate');
    expect(saveActivationMapping).toHaveBeenCalledWith('act-1', [
      { channelRoomId: 'room-1', productId: 'prod-2' },
      { channelRoomId: 'room-2', productId: 'prod-2' },
    ]);
  });

  it('MappingStep_MoreThanFiveRooms_ShowsFiveAtATimeWithShowMoreForTheRest', async () => {
    const rooms = Array.from({ length: 7 }, (_, index) => channelRoom({ channelRoomId: `room-${index + 1}`, name: `Camera ${index + 1}`, proposedProductId: 'prod-1' }));
    givenTheRoomsOfTheChannel(rooms);
    renderActivation(MAPPING_URL);

    await screen.findByTestId('activation-room-prop-1-room-1', {}, WAIT);
    expect(screen.getAllByRole('combobox')).toHaveLength(5);

    fireEvent.click(screen.getByTestId('activation-mapping-prop-1-more'));

    expect(screen.getAllByRole('combobox')).toHaveLength(7);
    expect(screen.queryByTestId('activation-mapping-prop-1-more')).not.toBeInTheDocument();
  });
});

describe('the mapping step: what is never saved', () => {
  it('MappingStep_NoRoomMapped_IsNeverSavedAsAnEmptyListAndSaysAtLeastOneIsNeeded', async () => {
    givenTheRoomsOfTheChannel([channelRoom({ channelRoomId: 'room-1' })]);
    renderActivation(MAPPING_URL);
    await screen.findByTestId('activation-room-prop-1-room-1', {}, WAIT);

    fireEvent.change(select('room-1'), { target: { value: '__skip__' } });
    fireEvent.click(primaryButton());

    expect(await screen.findByTestId('activation-mapping-prop-1-none', {}, WAIT)).toHaveTextContent(i18n.t('marketplace.activation.mapping.noneMapped'));
    expect(screen.getByTestId('activation-finish-error')).toHaveTextContent(i18n.t('marketplace.activation.errors.mappingNone'));
    // An empty choice is never «all the rooms»: nothing leaves.
    expect(saveActivationMapping).not.toHaveBeenCalled();
    await onStep('mapping');
  });

  it('MappingStep_RoomWithNoDecision_StopsTheSaveAndMarksTheRoom', async () => {
    givenTheRoomsOfTheChannel([
      channelRoom({ channelRoomId: 'room-1', proposedProductId: 'prod-1' }),
      // No proposal and not mapped: the person has to say what it is.
      channelRoom({ channelRoomId: 'room-2', name: 'Attico', proposedProductId: null }),
    ]);
    renderActivation(MAPPING_URL);
    await screen.findByTestId('activation-room-prop-1-room-2', {}, WAIT);

    expect(select('room-2')).toHaveValue('');
    fireEvent.click(primaryButton());

    await waitFor(() => expect(select('room-2')).toHaveAttribute('aria-invalid', 'true'), WAIT);
    expect(select('room-1')).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByTestId('activation-finish-error')).toHaveTextContent(i18n.t('marketplace.activation.errors.mappingUndecided'));
    expect(saveActivationMapping).not.toHaveBeenCalled();
  });

  it('MappingStep_RoomTheChannelManagerCannotManage_IsToldAndNeverSent', async () => {
    givenTheRoomsOfTheChannel([
      channelRoom({ channelRoomId: 'room-1', proposedProductId: 'prod-1' }),
      channelRoom({ channelRoomId: 'room-2', name: 'Dormitorio', manageable: false, proposedProductId: 'prod-2' }),
    ]);
    renderActivation(MAPPING_URL);
    await screen.findByTestId('activation-room-prop-1-room-1', {}, WAIT);

    expect(screen.queryByTestId('activation-room-prop-1-room-2')).not.toBeInTheDocument();
    expect(screen.getByTestId('activation-mapping-prop-1-left-out')).toHaveTextContent(i18n.t('marketplace.activation.mapping.leftOut', { count: 1 }));
    fireEvent.click(primaryButton());

    await onStep('activate');
    expect(saveActivationMapping).toHaveBeenCalledWith('act-1', [{ channelRoomId: 'room-1', productId: 'prod-1' }]);
  });

  it('MappingStep_ServerRefusesTheMapping_IsToldInSimpleWordsAndTheStepStays', async () => {
    givenTheRoomsOfTheChannel([channelRoom({ channelRoomId: 'room-1', proposedProductId: 'prod-1' })]);
    vi.mocked(saveActivationMapping).mockRejectedValue(axiosError(422, { code: 'marketplace_mapping_invalid' }));
    renderActivation(MAPPING_URL);
    await screen.findByTestId('activation-room-prop-1-room-1', {}, WAIT);

    fireEvent.click(primaryButton());

    expect(await screen.findByTestId('activation-finish-error', {}, WAIT)).toHaveTextContent(i18n.t('apiErrors.codes.marketplaceMappingInvalid'));
    await onStep('mapping');
  });
});

describe('the mapping step: a property that has no connection yet', () => {
  it('MappingStep_PropertyWithNoActivation_SendsThePersonBackToTheConnectionInsideTheWizard', async () => {
    givenTheRoomsOfTheChannel();
    vi.mocked(getActivationPlan).mockImplementation(async (_kind, _code, propertyId) => plan({ propertyId, requirements: [], activationId: null }));
    renderActivation(MAPPING_URL);

    fireEvent.click(await screen.findByText(i18n.t('marketplace.activation.mapping.fixConnection'), {}, WAIT));

    await onStep('connection');
    expect(getActivationMapping).not.toHaveBeenCalled();
  });
});
