import { describe, expect, it } from 'vitest';
import { getManifestEntry } from '@/config/route-manifest';
import {
  MAX_POLL_MS,
  MIN_POLL_MS,
  PANEL_KIND_SLUGS,
  PANEL_STEP_PATH,
  PANEL_STEP_ROUTE,
  findOpenAssist,
  findPanelStep,
  handoffPhase,
  isHttpsAddress,
  nextPollDelayMs,
  panelKindOfSlug,
  panelStepPath,
  readPanelStepCallback,
  withoutPanelStepCallback,
} from '@/lib/onboarding-panel';
import type { AssistRequest, PanelStep } from '@/types/onboarding.types';

const STEP_ID = '5b0c8b8e-6f1d-4a43-9b62-0f6f7d2f8a11';
const NOW = Date.parse('2026-11-10T10:00:00Z');

function step(overrides: Partial<PanelStep> = {}): PanelStep {
  return {
    id: STEP_ID,
    kind: 'policeConnection',
    status: 'started',
    handoffMode: 'managedWindow',
    propertyId: 'p1',
    channelCode: null,
    instructionsKey: 'panelPolice',
    activityId: 'a1',
    nextCheckAt: null,
    lastVerificationOutcome: null,
    canConfirm: false,
    resume: { wizardType: null, draftEntityId: null, stepCode: null },
    startedAt: '2026-11-10T09:00:00Z',
    completedAt: null,
    ...overrides,
  };
}

const unverifiable = step({ lastVerificationOutcome: 'unverifiable', canConfirm: true });
const away = { launched: true, blocked: false, ended: true };
const onThePanel = { launched: true, blocked: false, ended: false };

describe('the pages of the guided steps in the manifest', () => {
  it('panelStepRoutes_BothAddresses_AreEntriesOfTheManifestThatNeedToWriteTheProperties', () => {
    expect(getManifestEntry(PANEL_STEP_ROUTE)).toMatchObject({ context: 'short-rent', requiredPermissions: ['property.write'], featureFlag: 'octorateOnboarding' });
    expect(getManifestEntry(PANEL_STEP_PATH)).toMatchObject({ context: 'short-rent', requiredPermissions: ['property.write'], featureFlag: 'octorateOnboarding' });
    // In no menu: the plan, the parts and the «Da fare» lead here.
    expect(getManifestEntry(PANEL_STEP_ROUTE)?.navPlacement).toBeUndefined();
    expect(getManifestEntry(PANEL_STEP_ROUTE)?.navParent).toBeUndefined();
  });

  it('panelStepPath_EachKind_CarriesIdsOnlyInTheQueryAndRoundTripsToItsSlug', () => {
    expect(panelStepPath({ kind: 'policeConnection', propertyId: 'p1' })).toBe(`${PANEL_STEP_PATH}/police?propertyId=p1`);
    expect(panelStepPath({ kind: 'channelAccess', propertyId: null, channelCode: 'airbnb_xml' })).toBe(`${PANEL_STEP_PATH}/channel-access?channelCode=airbnb_xml`);
    expect(panelStepPath({ kind: 'istatConnection' })).toBe(`${PANEL_STEP_PATH}/istat`);
    for (const slug of PANEL_KIND_SLUGS) expect(panelKindOfSlug(slug)).toBeDefined();
    expect(panelKindOfSlug('telepathy')).toBeUndefined();
    expect(panelKindOfSlug('toString')).toBeUndefined();
    expect(panelKindOfSlug(undefined)).toBeUndefined();
  });
});

describe('handoffPhase, the state of the screen', () => {
  it('handoffPhase_NoStepYet_IsTheExplanation', () => {
    expect(handoffPhase(undefined, { launched: false, blocked: false, ended: false })).toBe('explain');
  });

  it('handoffPhase_StepStarted_WaitsOnThePanelAndIsStoredNotOpenedWhenTheBrowserBlockedTheWindow', () => {
    expect(handoffPhase(step(), onThePanel)).toBe('waiting');
    expect(handoffPhase(step(), { launched: false, blocked: true, ended: false })).toBe('started');
  });

  it('handoffPhase_DoneOrConfirmed_IsRecoveredAndSupportOnTheStepIsAssist', () => {
    expect(handoffPhase(step({ status: 'verified' }), onThePanel)).toBe('recovered');
    expect(handoffPhase(step({ status: 'confirmed' }), onThePanel)).toBe('recovered');
    expect(handoffPhase(step({ status: 'assistRequested' }), onThePanel)).toBe('assist');
    expect(handoffPhase(step({ status: 'notValid' }), away)).toBe('notValid');
  });

  it('handoffPhase_ResultCasaZenCannotTell_AsksOnlyWhenThePersonIsBackFromThePanel', () => {
    // Still on the panel: nothing to confirm yet, whatever the server says.
    expect(handoffPhase(unverifiable, onThePanel)).toBe('waiting');
    // Back (the window closed, the tab came to the front) or never opened by this page: the question.
    expect(handoffPhase(unverifiable, away)).toBe('unverifiable');
    expect(handoffPhase(unverifiable, { launched: false, blocked: false, ended: false })).toBe('unverifiable');
    // The server did not say it cannot tell: no question, however long the person was away.
    expect(handoffPhase(step({ lastVerificationOutcome: 'unverifiable', canConfirm: false }), away)).toBe('waiting');
    expect(handoffPhase(step({ lastVerificationOutcome: null, canConfirm: true }), away)).toBe('waiting');
  });
});

describe('nextPollDelayMs, the pace of the server', () => {
  it('nextPollDelayMs_CheckDueLater_WaitsUntilThenButNeverLessThanTheMinimum', () => {
    expect(nextPollDelayMs(step({ nextCheckAt: new Date(NOW + 30_000).toISOString() }), NOW)).toBe(30_000);
    expect(nextPollDelayMs(step({ nextCheckAt: new Date(NOW + 500).toISOString() }), NOW)).toBe(MIN_POLL_MS);
    expect(nextPollDelayMs(step({ nextCheckAt: new Date(NOW - 60_000).toISOString() }), NOW)).toBe(MIN_POLL_MS);
    expect(nextPollDelayMs(step({ nextCheckAt: new Date(NOW + 3_600_000).toISOString() }), NOW)).toBe(MAX_POLL_MS);
  });

  it('nextPollDelayMs_StepNotOpenOrWithoutASchedule_DoesNotPollByItselfExceptAStartedOne', () => {
    expect(nextPollDelayMs(undefined, NOW)).toBe(false);
    expect(nextPollDelayMs(step({ status: 'verified' }), NOW)).toBe(false);
    expect(nextPollDelayMs(step({ status: 'confirmed' }), NOW)).toBe(false);
    expect(nextPollDelayMs(step({ status: 'assistRequested', nextCheckAt: new Date(NOW + 10_000).toISOString() }), NOW)).toBe(false);
    expect(nextPollDelayMs(step({ status: 'notValid', nextCheckAt: null }), NOW)).toBe(false);
    expect(nextPollDelayMs(step({ status: 'started', nextCheckAt: null }), NOW)).toBe(15_000);
  });
});

describe('the callback of a panel that sends the person back', () => {
  it('readPanelStepCallback_StepAndState_AreReadAndTakenOutOfTheAddress', () => {
    const params = new URLSearchParams(`propertyId=p1&step=${STEP_ID}&state=abc_DEF-123`);

    expect(readPanelStepCallback(params)).toEqual({ stepId: STEP_ID, state: 'abc_DEF-123' });
    expect(withoutPanelStepCallback(params).toString()).toBe('propertyId=p1');
    // A copy: the address it was given is not changed.
    expect(params.get('state')).toBe('abc_DEF-123');
  });

  it('readPanelStepCallback_NotACallback_IsNull', () => {
    expect(readPanelStepCallback(new URLSearchParams(''))).toBeNull();
    expect(readPanelStepCallback(new URLSearchParams(`step=${STEP_ID}`))).toBeNull();
    expect(readPanelStepCallback(new URLSearchParams('step=wizard-step&state=abc'))).toBeNull();
    expect(readPanelStepCallback(new URLSearchParams(`step=${STEP_ID}&state=${'x'.repeat(129)}`))).toBeNull();
  });
});

describe('what the page opens and what it asks', () => {
  it('isHttpsAddress_OnlyHttps_IsFollowed', () => {
    expect(isHttpsAddress('https://panel.channel-manager.test/')).toBe(true);
    expect(isHttpsAddress('http://panel.channel-manager.test/')).toBe(false);
    expect(isHttpsAddress('javascript:alert(1)')).toBe(false);
    expect(isHttpsAddress('//panel.test')).toBe(false);
    expect(isHttpsAddress(null)).toBe(false);
  });

  it('findPanelStep_OneRowForEachKindPropertyAndChannel', () => {
    const steps = [step({ id: 'a' }), step({ id: 'b', kind: 'channelAccess', propertyId: null, channelCode: 'airbnb_xml' })];

    expect(findPanelStep(steps, { kind: 'policeConnection', propertyId: 'p1' })?.id).toBe('a');
    expect(findPanelStep(steps, { kind: 'policeConnection', propertyId: 'p2' })).toBeUndefined();
    expect(findPanelStep(steps, { kind: 'channelAccess', channelCode: 'airbnb_xml' })?.id).toBe('b');
    expect(findPanelStep(steps, { kind: 'channelAccess', channelCode: 'booking_xml' })).toBeUndefined();
  });

  it('findOpenAssist_OnlyARequestThatIsStillOpenForTheSameStep', () => {
    const request = (overrides: Partial<AssistRequest>): AssistRequest => ({
      id: 'r',
      part: 'compliance',
      propertyId: 'p1',
      context: 'panelPolice',
      status: 'Requested',
      requestedAt: '2026-11-10T09:00:00Z',
      updatedAt: '2026-11-10T09:00:00Z',
      completedAt: null,
      staffNote: null,
      activityId: null,
      ...overrides,
    });

    expect(findOpenAssist([request({})], 'panelPolice', 'p1')?.id).toBe('r');
    expect(findOpenAssist([request({ status: 'InProgress' })], 'panelPolice', 'p1')).toBeDefined();
    expect(findOpenAssist([request({ status: 'Done' })], 'panelPolice', 'p1')).toBeUndefined();
    expect(findOpenAssist([request({ status: 'Cancelled' })], 'panelPolice', 'p1')).toBeUndefined();
    expect(findOpenAssist([request({})], 'panelIstat', 'p1')).toBeUndefined();
    expect(findOpenAssist([request({})], 'panelPolice', 'p2')).toBeUndefined();
    expect(findOpenAssist([request({ propertyId: null })], 'panelPolice', null)).toBeDefined();
  });
});
