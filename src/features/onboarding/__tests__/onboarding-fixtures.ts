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

/**
 * The connected path with the state of each step (open when not given). `next` is what the server names: by default the first step that is
 * visible and not put off, as the backend works it out; pass `null` or a code to say otherwise.
 */
export function path(states: Partial<Record<OnboardingPathStepCode, OnboardingPartState>> = {}, next?: OnboardingPathStepCode | null): OnboardingPath {
  const steps = ONBOARDING_PATH_STEP_CODES.map((code) => pathStep(code, states[code] ?? 'open'));
  const named = next === undefined ? (steps.find((step) => step.visible && step.state !== 'deferred')?.code ?? null) : next;
  return { code: 'start-with-casazen', steps, next: named };
}

/**
 * A host a little way in: Octorate is connected, the properties are half matched (the part to do now, one another part needs), what hangs from
 * them waits, and the three parts nobody provides yet are not available. `overrides` changes parts by code.
 */
export function plan(overrides: Partial<Record<OnboardingPartKey, Partial<OnboardingPart>>> = {}, pathOverride: OnboardingPath = path()): OnboardingPlan {
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
  return {
    parts: ONBOARDING_PART_KEYS.map((code) => ({ ...base[code], ...overrides[code] })),
    needs: ['alloggiatiCredentials', 'istatCredentials', 'fiscalData', 'otaAccess', 'lockCode'],
    path: pathOverride,
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
