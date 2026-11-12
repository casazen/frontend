import { AxiosError, AxiosHeaders } from 'axios';
import {
  ONBOARDING_PART_KEYS,
  ONBOARDING_PATH_STEP_CODES,
  type OnboardingPart,
  type OnboardingPartKey,
  type OnboardingPartState,
  type OnboardingPath,
  type OnboardingPathStep,
  type OnboardingPathStepCode,
  type OnboardingPlan,
} from '@/types/onboarding.types';

/** A part of the plan with the values of one that has nothing special; a test changes what it is about. */
export function part(code: OnboardingPartKey, overrides: Partial<OnboardingPart> = {}): OnboardingPart {
  return {
    code,
    order: ONBOARDING_PART_KEYS.indexOf(code) + 1,
    state: 'open',
    reason: null,
    done: 0,
    total: 0,
    requires: [],
    deferrable: true,
    needs: [],
    remindAt: null,
    assist: null,
    launchTarget: 'connect',
    ...overrides,
  };
}

/** The parts each step of the path is made of, as the backend catalog maps them. */
export const STEP_PARTS: Record<OnboardingPathStepCode, OnboardingPartKey[]> = {
  connectChannels: ['octorateConnection', 'properties', 'channels'],
  checkListings: ['listings'],
  pricesCalendar: ['pricesRules'],
  checkInCompliance: ['compliance'],
  messagesAi: ['messagesAi'],
  fiscalDocuments: ['fiscalDocuments'],
};

/** A step of the path: visible while it is neither done nor not available, as the server says it. */
export function pathStep(code: OnboardingPathStepCode, state: OnboardingPartState = 'open', overrides: Partial<OnboardingPathStep> = {}): OnboardingPathStep {
  return {
    code,
    order: ONBOARDING_PATH_STEP_CODES.indexOf(code) + 1,
    parts: STEP_PARTS[code],
    state,
    visible: state !== 'done' && state !== 'notAvailable',
    ...overrides,
  };
}

/** The steps that hang from the connection and the properties (the first step): the parts they are made of require the properties. */
const STEPS_THAT_WAIT_FOR_THE_CONNECTION: readonly OnboardingPathStepCode[] = ['checkListings', 'pricesCalendar', 'checkInCompliance'];

/**
 * The connected path with the state of each step. A step not given is `open`, except the listings, the prices and the compliance while the
 * first step (connection, properties, channels) is not done: they wait for the properties, so they are `blocked`, as the plan of `plan()` says
 * and as the server derives it. `next` is what the server names: by default the first step that is visible and not put off, as the backend
 * works it out; pass `null` or a code to say otherwise.
 */
export function path(states: Partial<Record<OnboardingPathStepCode, OnboardingPartState>> = {}, next?: OnboardingPathStepCode | null): OnboardingPath {
  const connected = states.connectChannels === 'done';
  const steps = ONBOARDING_PATH_STEP_CODES.map((code) => {
    const waits = !connected && STEPS_THAT_WAIT_FOR_THE_CONNECTION.includes(code);
    return pathStep(code, states[code] ?? (waits ? 'blocked' : 'open'));
  });
  const named = next === undefined ? (steps.find((step) => step.visible && step.state !== 'deferred')?.code ?? null) : next;
  return { code: 'start-with-casazen', steps, next: named };
}

/**
 * The path the server derives from the parts of a plan (`OnboardingPlanService.PathOf`): a step is not available when none of its parts is
 * provided, done when every part is done or not available, otherwise it has the state of its first part that is neither; it is visible while
 * there is something to do in it; `next` is the first visible step that was not put off.
 */
export function pathOfParts(parts: readonly OnboardingPart[]): OnboardingPath {
  const stateOf = new Map(parts.map((candidate) => [candidate.code, candidate.state] as const));
  const steps = ONBOARDING_PATH_STEP_CODES.map((code) => {
    const states = STEP_PARTS[code].map((key) => stateOf.get(key) ?? 'notAvailable');
    const toDo = states.find((state) => state !== 'done' && state !== 'notAvailable');
    return pathStep(code, states.every((state) => state === 'notAvailable') ? 'notAvailable' : (toDo ?? 'done'));
  });
  return { code: 'start-with-casazen', steps, next: steps.find((step) => step.visible && step.state !== 'deferred')?.code ?? null };
}

/**
 * A host a little way in: Octorate is connected, the properties are half matched (the part to do now, one another part needs), what hangs from
 * them waits, and the three parts nobody provides yet are not available. `overrides` changes parts by code. The path is the one the server
 * derives from the parts (`pathOfParts`), so the two agree; a test that wants another one passes it.
 */
export function plan(overrides: Partial<Record<OnboardingPartKey, Partial<OnboardingPart>>> = {}, pathOverride?: OnboardingPath): OnboardingPlan {
  const base: Record<OnboardingPartKey, OnboardingPart> = {
    octorateConnection: part('octorateConnection', { state: 'done', done: 1, total: 1, deferrable: false }),
    properties: part('properties', { reason: 'mapping_unconfirmed', done: 1, total: 3, requires: ['octorateConnection'], deferrable: false }),
    channels: part('channels', { state: 'blocked', reason: 'required_part_not_done', requires: ['properties'], deferrable: false }),
    listings: part('listings', { state: 'blocked', reason: 'required_part_not_done', requires: ['channels'] }),
    pricesRules: part('pricesRules', { state: 'blocked', reason: 'required_part_not_done', requires: ['properties'] }),
    compliance: part('compliance', { state: 'blocked', reason: 'required_part_not_done', requires: ['properties'] }),
    identification: part('identification', { reason: 'access_code_missing', done: 0, total: 2 }),
    messagesAi: part('messagesAi', { state: 'notAvailable', reason: 'not_provided' }),
    fiscalDocuments: part('fiscalDocuments', { state: 'notAvailable', reason: 'not_provided' }),
    partners: part('partners', { state: 'notAvailable', reason: 'not_provided' }),
    activation: part('activation', { state: 'blocked', reason: 'required_part_not_done', requires: ['octorateConnection', 'properties'] }),
  };
  const parts = ONBOARDING_PART_KEYS.map((code) => ({ ...base[code], ...overrides[code] }));
  return {
    parts,
    needs: ['alloggiatiCredentials', 'istatCredentials', 'fiscalData', 'otaAccess', 'lockCode'],
    path: pathOverride ?? pathOfParts(parts),
    activated: false,
  };
}

/** A failed call as the API client raises it: the status and a ProblemDetails body. */
export function problemError(status: number, body: Record<string, unknown>): AxiosError {
  const config = { headers: new AxiosHeaders() };
  return new AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, { status, statusText: '', headers: {}, config, data: { status, ...body } });
}

/** The roles of the membership of the host in Affitti brevi: the owner is the organization administrator, a collaborator is not (`isOrgBillingAdmin`). */
export const OWNER = [{ contextKey: 'short-rent', roleKey: 'property_owner' }];
export const COLLABORATOR = [{ contextKey: 'short-rent', roleKey: 'collaborator' }];
