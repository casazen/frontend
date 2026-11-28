import { isAxiosError } from 'axios';
import { getProblemCode } from '@/lib/api-errors';
import {
  MARKETPLACE_ACTIVATION_REQUIREMENTS,
  type MarketplaceActivationPlan,
  type MarketplaceActivationRequirement,
  type MarketplaceActivationState,
  type MarketplaceChannelRoom,
  type MarketplaceConnectionKind,
  type MarketplaceRoomChoice,
  type Property,
} from '@/types';
import type { PanelStep } from '@/types/onboarding.types';
import { marketplaceActivationPath, marketplaceHref } from '../lib/marketplace-paths';

export const ACTIVATION_STEP = {
  property: 'property',
  access: 'access',
  connection: 'connection',
  import: 'import',
  mapping: 'mapping',
  activate: 'activate',
} as const;
export type ActivationStepId = (typeof ACTIVATION_STEP)[keyof typeof ACTIVATION_STEP];

export interface ActivationWizardValues {
  propertyIds: string[];
  hotelIds: Record<string, string>;
}

export const ACTIVATION_WIZARD_DEFAULTS: ActivationWizardValues = { propertyIds: [], hotelIds: {} };

export const ACTIVATION_DRAFT_VERSION = 1;

export function activationWizardId(kind: MarketplaceConnectionKind, code: string): string {
  return `marketplace-activation-${kind.toLowerCase()}-${code}`;
}

export function connectionKindOfSlug(slug: string | undefined): MarketplaceConnectionKind | null {
  switch (slug?.toLowerCase()) {
    case 'channel':
      return 'Channel';
    case 'tool':
      return 'Tool';
    default:
      return null;
  }
}

export type PanelAccessStatus = 'given' | 'toDo' | 'notGiven' | 'reading';

export interface PanelAccessEvidence {
  hasActivation: boolean;
  panelAccessDone: boolean | undefined;
  reading: boolean;
  stepDone: boolean;
}

/**
 * The access on the panel for one property. Where the activation exists the channel manager's word is the proof (`panelAccessDone`, which the import and the activation
 * go by: they refuse with `marketplace_panel_access_pending` without it): a guided step that the person confirmed before the connection existed is only their word, and is
 * never shown as given against it. Where there is no activation to ask about (the first pass), or it cannot be read, the guided step is all there is.
 */
export function panelAccessStatus(evidence: PanelAccessEvidence): PanelAccessStatus {
  if (evidence.hasActivation && evidence.reading) return 'reading';
  if (evidence.hasActivation && evidence.panelAccessDone !== undefined) {
    if (evidence.panelAccessDone) return 'given';
    return evidence.stepDone ? 'notGiven' : 'toDo';
  }
  return evidence.stepDone ? 'given' : 'toDo';
}

export type ActivationRequirements = Readonly<Record<MarketplaceActivationRequirement, boolean>>;

export function requirementsOf(codes: readonly string[]): ActivationRequirements {
  return {
    hotelId: codes.includes('hotelId'),
    credentials: codes.includes('credentials'),
    panelAccess: codes.includes('panelAccess'),
  };
}

export function asksForAccess(requirements: ActivationRequirements): boolean {
  return MARKETPLACE_ACTIVATION_REQUIREMENTS.some((requirement) => requirements[requirement]);
}

/**
 * True when the wizard has an access step for the portal: the portal asks the person for something, or what it asks is not known yet (nothing was read: the step
 * stays in the list, so that the list does not lose a step under the person when the answer comes).
 */
export function hasAccessStep(requirements: ActivationRequirements | null): boolean {
  return requirements === null || asksForAccess(requirements);
}

export function activationStepIds(requirements: ActivationRequirements | null): ActivationStepId[] {
  const steps: ActivationStepId[] = [ACTIVATION_STEP.property];
  if (hasAccessStep(requirements)) steps.push(ACTIVATION_STEP.access);
  steps.push(ACTIVATION_STEP.connection, ACTIVATION_STEP.import, ACTIVATION_STEP.mapping, ACTIVATION_STEP.activate);
  return steps;
}

export const HOTEL_ID_MAX_LENGTH = 100;
export const CREDENTIAL_MAX_LENGTH = 200;

export interface PortalCredentials {
  username: string;
  password: string;
}

export const NO_CREDENTIALS: PortalCredentials = { username: '', password: '' };

export interface MissingAccess {
  hotelIdFor: string[];
  username: boolean;
  password: boolean;
}

export function hotelIdsFor(entered: Readonly<Record<string, string>>, plans: ReadonlyMap<string, MarketplaceActivationPlan>) {
  return {
    ...entered,
    ...Object.fromEntries([...plans].flatMap(([id, plan]) => plan.verifiedHotelId ? [[id, plan.verifiedHotelId]] : [])),
  };
}

export function missingAccess(
  requirements: ActivationRequirements,
  propertyIds: readonly string[],
  hotelIds: Readonly<Record<string, string>>,
  credentials: PortalCredentials,
): MissingAccess {
  return {
    hotelIdFor: requirements.hotelId ? propertyIds.filter((id) => (hotelIds[id] ?? '').trim() === '') : [],
    username: requirements.credentials && credentials.username.trim() === '',
    password: requirements.credentials && credentials.password === '',
  };
}

export function isAccessComplete(missing: MissingAccess): boolean {
  return missing.hotelIdFor.length === 0 && !missing.username && !missing.password;
}

export function startRequestFor(
  kind: MarketplaceConnectionKind,
  code: string,
  propertyId: string,
  requirements: ActivationRequirements,
  hotelIds: Readonly<Record<string, string>>,
  credentials: PortalCredentials,
) {
  return {
    kind,
    code,
    propertyId,
    ...(requirements.hotelId ? { hotelId: (hotelIds[propertyId] ?? '').trim() } : {}),
    ...(requirements.credentials ? { username: credentials.username.trim(), password: credentials.password } : {}),
  };
}

export type PropertyAvailability = 'ready' | 'notLinked';

export function propertyAvailability(plan: MarketplaceActivationPlan): PropertyAvailability {
  return plan.propertyLinked ? 'ready' : 'notLinked';
}

export function selectableChoice(chosen: readonly string[], available: ReadonlySet<string>): string[] {
  return [...new Set(chosen)].filter((id) => available.has(id));
}

export function problemCodeOf(error: unknown): string | null {
  return isAxiosError(error) ? (getProblemCode(error.response?.data) ?? null) : null;
}

export function stepToFix(code: string | null | undefined, accessStep = true): ActivationStepId {
  switch (code) {
    case 'octorate_partner_failed':
    case 'd6_channel_failed':
    case 'marketplace_panel_access_pending':
    case 'marketplace_credentials_required':
    case 'connection_not_enabled':
    case 'connection_disabled':
      return accessStep ? ACTIVATION_STEP.access : ACTIVATION_STEP.activate;
    case 'connection_missing':
    case 'marketplace_connection_missing':
    case 'marketplace_connection_exists':
      return ACTIVATION_STEP.connection;
    case 'marketplace_mapping_required':
    case 'marketplace_mapping_invalid':
      return ACTIVATION_STEP.mapping;
    case 'marketplace_property_not_linked':
    case 'marketplace_property_not_found':
    case 'marketplace_portal_not_creatable':
    case 'marketplace_portal_unknown':
    case 'marketplace_octorate_not_connected':
      return ACTIVATION_STEP.property;
    default:
      return ACTIVATION_STEP.activate;
  }
}

export const CHANNEL_REFUSAL_CODE = 'octorate_partner_failed';

export type ImportItemState = 'queued' | 'starting' | 'waiting' | 'done';

export function importRoomState(progress: { starting: boolean; requested: boolean; roomsIn: boolean }): ImportItemState {
  if (progress.roomsIn) return 'done';
  if (progress.requested) return 'waiting';
  return progress.starting ? 'starting' : 'queued';
}

export interface ActivationOutcome {
  propertyId: string;
  status: 'Active' | 'ToFix';
  errorCode: string | null;
}

export function outcomeOfState(propertyId: string, state: MarketplaceActivationState): ActivationOutcome {
  return state.status === 'Active' ? { propertyId, status: 'Active', errorCode: null } : { propertyId, status: 'ToFix', errorCode: state.lastErrorCode };
}

export function outcomeOfFailure(propertyId: string, errorCode: string | null): ActivationOutcome {
  return { propertyId, status: 'ToFix', errorCode };
}

export function resultCounts(outcomes: readonly ActivationOutcome[]): { active: number; toFix: number } {
  const active = outcomes.filter((outcome) => outcome.status === 'Active').length;
  return { active, toFix: outcomes.length - active };
}

export const MAPPING_PAGE_SIZE = 5;

export const SKIP_ROOM = '__skip__';

/**
 * What the person decided for each room of the channel, over what the server proposes. A room the person changed (`overrides`) is as they said; else
 * the product it is mapped to now; else the proposal of CasaZen; else nothing yet (`''`). A room the channel manager cannot manage is left out: it
 * is never mapped. A room that is mapped already is never «skipped»: the save only adds or changes mappings, it removes none, so that choice would be
 * told and then ignored (the screen does not offer it, and a skip that gets here anyway leaves the room as it is).
 */
export function roomChoices(rooms: readonly MarketplaceChannelRoom[], overrides: Readonly<Record<string, string>>): Record<string, string> {
  const choices: Record<string, string> = {};
  for (const room of rooms) {
    if (!room.manageable) continue;
    const override = overrides[room.channelRoomId];
    const decided = override === SKIP_ROOM && room.mappedProductId !== null ? undefined : override;
    choices[room.channelRoomId] = decided ?? room.mappedProductId ?? room.proposedProductId ?? '';
  }
  return choices;
}

export function roomChoicesToSave(choices: Readonly<Record<string, string>>): MarketplaceRoomChoice[] {
  return Object.entries(choices)
    .filter(([, productId]) => productId !== '' && productId !== SKIP_ROOM)
    .map(([channelRoomId, productId]) => ({ channelRoomId, productId }));
}

export function mappingProblem(choices: Readonly<Record<string, string>>): 'noneMapped' | 'undecided' | null {
  const values = Object.values(choices);
  if (values.some((productId) => productId === '')) return 'undecided';
  return roomChoicesToSave(choices).length === 0 ? 'noneMapped' : null;
}

/**
 * What the page reads for the steps (the properties of the host, the plan of the portal for each) and hands to them, so that the steps ask the server
 * for nothing the page has asked already. `plans` holds the plans that were read; a property whose plan is not there has none yet or its read failed.
 */
export interface ActivationContext {
  kind: MarketplaceConnectionKind;
  code: string;
  channelName: string | null;
  requirements: ActivationRequirements | null;
  properties: readonly Property[];
  propertiesStatus: 'pending' | 'error' | 'ready';
  plans: ReadonlyMap<string, MarketplaceActivationPlan>;
  plansPending: boolean;
  planError: unknown;
  unreadProperties: readonly string[];
  onRetry: () => void;
}

export function propertyNameOf(properties: readonly Property[], propertyId: string): string | null {
  return properties.find((property) => property.id === propertyId)?.name ?? null;
}

const RESUME_STEP_CODES: Readonly<Record<MarketplaceConnectionKind, string>> = {
  Channel: 'marketplaceActivationChannel',
  Tool: 'marketplaceActivationTool',
};

export function activationPanelResume(kind: MarketplaceConnectionKind) {
  return { resumeWizardType: 'OnboardingActivation', resumeStepCode: RESUME_STEP_CODES[kind] } as const;
}

export function activationResumePath(step: Pick<PanelStep, 'channelCode' | 'propertyId' | 'resume'> | undefined): string | null {
  if (!step?.channelCode || !step.propertyId || step.resume.wizardType !== 'OnboardingActivation') return null;
  const kind = (Object.keys(RESUME_STEP_CODES) as MarketplaceConnectionKind[]).find((candidate) => RESUME_STEP_CODES[candidate] === step.resume.stepCode);
  if (!kind) return null;

  return marketplaceHref(marketplaceActivationPath(kind, step.channelCode), step.propertyId, { step: ACTIVATION_STEP.access });
}
