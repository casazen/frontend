import { describe, expect, it } from 'vitest';
import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import type { MarketplaceActivationState, MarketplaceChannelRoom } from '@/types';
import {
  ACTIVATION_STEP,
  NO_CREDENTIALS,
  SKIP_ROOM,
  activationPanelResume,
  activationResumePath,
  activationStepIds,
  activationWizardId,
  asksForAccess,
  connectionKindOfSlug,
  isAccessComplete,
  mappingProblem,
  missingAccess,
  outcomeOfFailure,
  outcomeOfState,
  problemCodeOf,
  propertyAvailability,
  requirementsOf,
  resultCounts,
  roomChoices,
  roomChoicesToSave,
  selectableChoice,
  startRequestFor,
  stepToFix,
} from '../activation-wizard-model';

function refusal(status: number, data: unknown): AxiosError {
  const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
  return new AxiosError('Request failed', AxiosError.ERR_BAD_REQUEST, config, {}, { status, data, statusText: '', headers: {}, config });
}

function room(overrides: Partial<MarketplaceChannelRoom> = {}): MarketplaceChannelRoom {
  return { channelRoomId: 'r1', name: 'Doppia', rateName: null, manageable: true, mappedProductId: null, proposedProductId: null, ...overrides };
}

function state(overrides: Partial<MarketplaceActivationState> = {}): MarketplaceActivationState {
  return {
    activationId: 'act-1',
    kind: 'Channel',
    code: '142',
    propertyId: 'prop-1',
    status: 'Active',
    connectionFound: true,
    connectionStatus: 'ENABLED',
    panelAccessDone: true,
    lastSyncedAt: null,
    lastErrorCode: null,
    connectionLastUpdate: null,
    ...overrides,
  };
}

describe('the kind of the address', () => {
  it('connectionKindOfSlug_ChannelAndTool_AreTheKindsOfTheServerWhateverTheCase', () => {
    expect(connectionKindOfSlug('channel')).toBe('Channel');
    expect(connectionKindOfSlug('Channel')).toBe('Channel');
    expect(connectionKindOfSlug('TOOL')).toBe('Tool');
  });

  it('connectionKindOfSlug_AnythingElse_IsNotAKindOfThisWizard', () => {
    // A function of the license and a partner have wizards of their own.
    expect(connectionKindOfSlug('licensedfunction')).toBeNull();
    expect(connectionKindOfSlug('partner')).toBeNull();
    expect(connectionKindOfSlug('')).toBeNull();
    expect(connectionKindOfSlug(undefined)).toBeNull();
  });

  it('activationWizardId_TwoPortals_KeepTheirDraftsApart', () => {
    expect(activationWizardId('Channel', '142')).not.toBe(activationWizardId('Channel', '274'));
    expect(activationWizardId('Channel', '142')).not.toBe(activationWizardId('Tool', '142'));
  });
});

describe('the steps the portal needs', () => {
  it('activationStepIds_PortalThatAsksForNothing_HasNoAccessStep', () => {
    const steps = activationStepIds(requirementsOf([]));

    expect(steps).toEqual(['property', 'connection', 'import', 'mapping', 'activate']);
    expect(steps).not.toContain(ACTIVATION_STEP.access);
  });

  it.each([['hotelId'], ['credentials'], ['panelAccess']])('activationStepIds_PortalThatAsksFor_%s_HasTheAccessStepAfterTheProperties', (code) => {
    expect(activationStepIds(requirementsOf([code]))).toEqual(['property', 'access', 'connection', 'import', 'mapping', 'activate']);
  });

  it('activationStepIds_NothingReadYet_KeepsTheAccessStepSoTheListDoesNotLoseOne', () => {
    expect(activationStepIds(null)).toContain(ACTIVATION_STEP.access);
  });

  it('requirementsOf_CodesTheServerSends_AreTheThreeThingsAPortalAsks', () => {
    expect(requirementsOf(['hotelId', 'panelAccess'])).toEqual({ hotelId: true, credentials: false, panelAccess: true });
    // A code this version does not know asks nothing.
    expect(requirementsOf(['somethingNew'])).toEqual({ hotelId: false, credentials: false, panelAccess: false });
    expect(asksForAccess(requirementsOf(['somethingNew']))).toBe(false);
  });
});

describe('the access data', () => {
  const both = requirementsOf(['hotelId', 'credentials']);

  it('missingAccess_PortalAsksForHotelIdAndCredentials_NamesWhatIsEmpty', () => {
    const missing = missingAccess(both, ['p1', 'p2'], { p1: '12345', p2: '  ' }, { username: '', password: '' });

    expect(missing).toEqual({ hotelIdFor: ['p2'], username: true, password: true });
    expect(isAccessComplete(missing)).toBe(false);
  });

  it('missingAccess_PortalAsksForNothing_NothingIsMissing', () => {
    expect(isAccessComplete(missingAccess(requirementsOf([]), ['p1'], {}, NO_CREDENTIALS))).toBe(true);
    // The panel access is not asked here: it is a step of its own, read from the server.
    expect(isAccessComplete(missingAccess(requirementsOf(['panelAccess']), ['p1'], {}, NO_CREDENTIALS))).toBe(true);
  });

  it('missingAccess_PasswordWithSpaces_IsNotTrimmedAndOnlyAnEmptyOneIsMissing', () => {
    expect(missingAccess(both, ['p1'], { p1: '1' }, { username: 'ana', password: ' ' }).password).toBe(false);
    expect(missingAccess(both, ['p1'], { p1: '1' }, { username: ' ', password: 'x' }).username).toBe(true);
  });

  it('startRequestFor_CredentialsRequired_CarriesOnlyWhatThePortalAsksFor', () => {
    const request = startRequestFor('Channel', '142', 'p1', both, { p1: ' 12345 ' }, { username: ' ana ', password: ' pa ss ' });

    expect(request).toEqual({ kind: 'Channel', code: '142', propertyId: 'p1', hotelId: '12345', username: 'ana', password: ' pa ss ' });
  });

  it('startRequestFor_PortalAsksForNothing_CarriesNoAccessDataEvenIfTheStateHoldsSome', () => {
    const request = startRequestFor('Tool', '99', 'p1', requirementsOf([]), { p1: 'left-over' }, { username: 'ana', password: 'secret' });

    expect(request).toEqual({ kind: 'Tool', code: '99', propertyId: 'p1' });
    expect(JSON.stringify(request)).not.toContain('secret');
  });
});

describe('the properties', () => {
  it('propertyAvailability_OnlyAConfirmedListingCanBeChosen', () => {
    expect(propertyAvailability({ propertyLinked: true } as never)).toBe('ready');
    expect(propertyAvailability({ propertyLinked: false } as never)).toBe('notLinked');
  });

  it('selectableChoice_APropertyThatLeftTheList_IsDroppedAndTheOrderIsKept', () => {
    expect(selectableChoice(['b', 'gone', 'a', 'b'], new Set(['a', 'b']))).toEqual(['b', 'a']);
  });
});

describe('a problem and the step it leads back to', () => {
  it.each([
    ['octorate_partner_failed', 'access'],
    ['marketplace_panel_access_pending', 'access'],
    ['connection_not_enabled', 'access'],
    ['connection_missing', 'connection'],
    ['marketplace_connection_missing', 'connection'],
    ['marketplace_mapping_required', 'mapping'],
    ['marketplace_mapping_invalid', 'mapping'],
    ['d6_operation_unverified', 'activate'],
    [null, 'activate'],
  ])('stepToFix_%s_OpensTheStep_%s', (code, step) => {
    expect(stepToFix(code)).toBe(step);
  });

  it('problemCodeOf_AnswerOfTheServer_IsItsCode', () => {
    expect(problemCodeOf(refusal(409, { code: 'marketplace_panel_access_pending' }))).toBe('marketplace_panel_access_pending');
    expect(problemCodeOf(refusal(502, 'a page of a proxy'))).toBeNull();
    expect(problemCodeOf(new Error('no answer'))).toBeNull();
  });

  it('outcomeOfState_OnlyWhatTheServerSaysIsActiveIsActive', () => {
    expect(outcomeOfState('p1', state({ status: 'Active' }))).toEqual({ propertyId: 'p1', status: 'Active', errorCode: null });
    expect(outcomeOfState('p1', state({ status: 'ToFix', lastErrorCode: 'connection_not_enabled' }))).toEqual({
      propertyId: 'p1',
      status: 'ToFix',
      errorCode: 'connection_not_enabled',
    });
    // Still Pending is not Active: the result never says more than the server did.
    expect(outcomeOfState('p1', state({ status: 'Pending' })).status).toBe('ToFix');
  });

  it('resultCounts_ActiveAndToFix_AreCountedApart', () => {
    const outcomes = [outcomeOfState('a', state()), outcomeOfFailure('b', 'octorate_partner_failed'), outcomeOfFailure('c', null)];

    expect(resultCounts(outcomes)).toEqual({ active: 1, toFix: 2 });
  });
});

describe('the mapping of the rooms', () => {
  it('roomChoices_ProposalOfTheServer_IsAlreadyChosenAndAChangeWins', () => {
    const rooms = [room({ channelRoomId: 'r1', proposedProductId: 'p-doppia' }), room({ channelRoomId: 'r2', mappedProductId: 'p-suite', proposedProductId: 'p-other' }), room({ channelRoomId: 'r3' })];

    expect(roomChoices(rooms, {})).toEqual({ r1: 'p-doppia', r2: 'p-suite', r3: '' });
    expect(roomChoices(rooms, { r1: 'p-suite', r3: SKIP_ROOM })).toEqual({ r1: 'p-suite', r2: 'p-suite', r3: SKIP_ROOM });
  });

  it('roomChoices_RoomTheChannelManagerCannotManage_IsNeverMapped', () => {
    expect(roomChoices([room({ channelRoomId: 'r1', manageable: false, proposedProductId: 'p1' })], { r1: 'p1' })).toEqual({});
  });

  it('roomChoicesToSave_SkippedAndUndecidedRooms_AreNotInTheBody', () => {
    expect(roomChoicesToSave({ r1: 'p1', r2: SKIP_ROOM, r3: '' })).toEqual([{ channelRoomId: 'r1', productId: 'p1' }]);
  });

  it('mappingProblem_NoRoomMapped_IsNeverAnEmptyListSent', () => {
    expect(mappingProblem({ r1: SKIP_ROOM })).toBe('noneMapped');
    expect(mappingProblem({})).toBe('noneMapped');
  });

  it('mappingProblem_ARoomWithoutADecision_StopsTheSave', () => {
    expect(mappingProblem({ r1: 'p1', r2: '' })).toBe('undecided');
    expect(mappingProblem({ r1: 'p1', r2: SKIP_ROOM })).toBeNull();
  });
});

describe('the way back from the panel of the channel manager', () => {
  const started = (resume: { wizardType: string | null; stepCode: string | null }) => ({
    channelCode: '142',
    propertyId: 'prop-1',
    resume: { wizardType: resume.wizardType as never, draftEntityId: null, stepCode: resume.stepCode },
  });

  it('activationResumePath_StepStartedByThisWizard_LeadsBackToItsAccessStepForThePropertyAndTheChannel', () => {
    const resume = activationPanelResume('Channel');

    expect(resume).toEqual({ resumeWizardType: 'OnboardingActivation', resumeStepCode: 'marketplaceActivationChannel' });
    expect(activationResumePath(started({ wizardType: 'OnboardingActivation', stepCode: resume.resumeStepCode }))).toBe(
      '/app/short-rent/marketplace/activate/channel/142?propertyId=prop-1&step=access',
    );
    expect(activationResumePath(started({ wizardType: 'OnboardingActivation', stepCode: activationPanelResume('Tool').resumeStepCode }))).toBe(
      '/app/short-rent/marketplace/activate/tool/142?propertyId=prop-1&step=access',
    );
  });

  it('activationResumePath_StepOfAnotherWizard_IsNotOurs', () => {
    // The connect wizard of the existing listings stores its own point, which the page of the step already knows.
    expect(activationResumePath(started({ wizardType: 'OnboardingActivation', stepCode: 'existingInventoryAccess' }))).toBeNull();
    expect(activationResumePath(started({ wizardType: null, stepCode: null }))).toBeNull();
    expect(activationResumePath(undefined)).toBeNull();
  });

  it('activationResumePath_StepWithoutAPropertyOrAChannel_HasNothingToComeBackTo', () => {
    const base = started({ wizardType: 'OnboardingActivation', stepCode: 'marketplaceActivationChannel' });

    expect(activationResumePath({ ...base, propertyId: null })).toBeNull();
    expect(activationResumePath({ ...base, channelCode: null })).toBeNull();
  });
});
