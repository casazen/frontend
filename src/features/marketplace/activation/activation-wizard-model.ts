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

/**
 * The model of the activation wizard of a channel or a tool (E09/F02/US04, NF-56, MKT-03): the steps the portal needs, what it asks of the person,
 * which properties can be chosen, which step a problem leads back to and what the result says. No React in it: the page and the steps read it.
 */

/** The steps of the wizard in their order; the result is the done screen of the shell (`WIZARD_DONE_STEP`, `?step=fatto`). */
export const ACTIVATION_STEP = {
  property: 'property',
  access: 'access',
  connection: 'connection',
  import: 'import',
  mapping: 'mapping',
  activate: 'activate',
} as const;
export type ActivationStepId = (typeof ACTIVATION_STEP)[keyof typeof ACTIVATION_STEP];

/** What the wizard asks of the person and keeps for the draft: the properties chosen and the identifier of each on the channel (not a secret). */
export interface ActivationWizardValues {
  propertyIds: string[];
  /** The identifier of each property on the portal, by property id, for a portal that asks for it. */
  hotelIds: Record<string, string>;
}

export const ACTIVATION_WIZARD_DEFAULTS: ActivationWizardValues = { propertyIds: [], hotelIds: {} };

/** Raise it when the shape of the values changes: a draft written for the old shape is ignored. */
export const ACTIVATION_DRAFT_VERSION = 1;

/** The name the draft of the wizard is kept under: one for each portal, so a draft of one channel never opens another one. */
export function activationWizardId(kind: MarketplaceConnectionKind, code: string): string {
  return `marketplace-activation-${kind.toLowerCase()}-${code}`;
}

/** The kind the address says (`channel`, `tool`, whatever the case) as the server names it; `null` for anything else (a function and a partner have their own wizards). */
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

/**
 * Where the access on the panel of the channel manager stands for one property. `given`: it is. `toDo`: the guided step is still to do. `notGiven`: the person said the
 * guided step was done, and the channel manager does not show the access (the step cannot be done again: it is told, with a new check and help). `reading`: the
 * channel manager is being asked.
 */
export type PanelAccessStatus = 'given' | 'toDo' | 'notGiven' | 'reading';

/** What is known of the access on the panel for one property. */
export interface PanelAccessEvidence {
  /** The activation of the property exists: there is a connection the channel manager can be asked about. */
  hasActivation: boolean;
  /** What the channel manager says of the access (`panelAccessDone` of the state of the activation); `undefined` when it was not read or could not be. */
  panelAccessDone: boolean | undefined;
  /** The activation is being read (or its read has not begun). */
  reading: boolean;
  /** The guided step of the panel is done (seen by CasaZen, or confirmed by the person). */
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

/** What the portal asks of the person, one flag for each thing (the plan sends them as codes, in the order of the wizard). */
export type ActivationRequirements = Readonly<Record<MarketplaceActivationRequirement, boolean>>;

/** The requirements the codes name; a code this version does not know asks nothing. */
export function requirementsOf(codes: readonly string[]): ActivationRequirements {
  return {
    hotelId: codes.includes('hotelId'),
    credentials: codes.includes('credentials'),
    panelAccess: codes.includes('panelAccess'),
  };
}

/** True when the portal asks the person for something before the connection: the access step exists only then. */
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

/** The steps the portal needs, in order. A portal that asks for nothing skips the access step. */
export function activationStepIds(requirements: ActivationRequirements | null): ActivationStepId[] {
  const steps: ActivationStepId[] = [ACTIVATION_STEP.property];
  if (hasAccessStep(requirements)) steps.push(ACTIVATION_STEP.access);
  steps.push(ACTIVATION_STEP.connection, ACTIVATION_STEP.import, ACTIVATION_STEP.mapping, ACTIVATION_STEP.activate);
  return steps;
}

/** The longest identifier of the property on a portal, and the longest username and password, as the server takes them. */
export const HOTEL_ID_MAX_LENGTH = 100;
export const CREDENTIAL_MAX_LENGTH = 200;

/** The username and the password of the portal. They live in the state of the page and nowhere else: never in the values of the wizard, so never in its draft. */
export interface PortalCredentials {
  username: string;
  password: string;
}

export const NO_CREDENTIALS: PortalCredentials = { username: '', password: '' };

/** What is missing of the access data the portal asks for: the properties that lack their identifier on the channel, and whether the username or the password is empty. */
export interface MissingAccess {
  hotelIdFor: string[];
  username: boolean;
  password: boolean;
}

/** The access data the portal asks for that is not there yet. Nothing is asked that the portal does not ask for. */
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

/** True when nothing is missing. */
export function isAccessComplete(missing: MissingAccess): boolean {
  return missing.hotelIdFor.length === 0 && !missing.username && !missing.password;
}

/** The body of the start for one property: only what the portal asks for, trimmed (the password as it is), never more. */
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

/** What the plan says about a property for this wizard: it can be chosen only when it has a confirmed listing on the channel manager. */
export type PropertyAvailability = 'ready' | 'notLinked';

export function propertyAvailability(plan: MarketplaceActivationPlan): PropertyAvailability {
  return plan.propertyLinked ? 'ready' : 'notLinked';
}

/** The properties that stay chosen: a property that left the list (a draft that is older than the properties) or cannot be chosen is dropped, the order is the chosen one. */
export function selectableChoice(chosen: readonly string[], available: ReadonlySet<string>): string[] {
  return [...new Set(chosen)].filter((id) => available.has(id));
}

/** The code of the answer of the server that refused a call (`marketplace_panel_access_pending`, `octorate_partner_failed`, ...), or `null` when there is none. */
export function problemCodeOf(error: unknown): string | null {
  return isAxiosError(error) ? (getProblemCode(error.response?.data) ?? null) : null;
}

/**
 * The step a problem leads back to, by its code: the one where the person can change what is wrong. A refusal of the channel, an access that is not
 * given and a connection that is not enabled are about the access (a portal that asks for nothing has no access step to go back to: there is nothing to correct,
 * and the step says «try again», as for any other problem); a connection that is gone starts again; a mapping that is empty or wrong is the mapping; anything
 * else is tried again from the last step.
 */
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

/** The refusal of the channel itself (the channel manager's 550): told as «the channel refused the connection», never as an error of CasaZen. */
export const CHANNEL_REFUSAL_CODE = 'octorate_partner_failed';

/** The three imports the channel manager makes for a channel, in the order they are asked. */
export const IMPORT_ITEMS = ['rooms', 'reservations', 'calendar'] as const;
export type ImportItem = (typeof IMPORT_ITEMS)[number];

/** Where one import stands for the screen: not asked yet, being asked, asked (and done by the channel manager on its own), the rooms awaited, the rooms arrived. */
export type ImportItemState = 'queued' | 'starting' | 'requested' | 'waiting' | 'done';

/**
 * What CasaZen can say of one import. Only the rooms can be seen to arrive (the mapping read gives them), so only the rooms are ever `done`; the reservations and the
 * calendar are `requested` once asked, and never shown as finished: the server cannot be asked how far they are.
 */
export function importItemState(item: ImportItem, progress: { starting: boolean; requested: boolean; roomsIn: boolean }): ImportItemState {
  if (item === 'rooms' && progress.roomsIn) return 'done';
  if (progress.requested) return item === 'rooms' ? 'waiting' : 'requested';
  return progress.starting ? 'starting' : 'queued';
}

/** How an activation ended for a property in the last step: Active, or To fix with the code of what is wrong. */
export interface ActivationOutcome {
  propertyId: string;
  status: 'Active' | 'ToFix';
  /** The code of the problem (the one the server kept on the activation, or the one of the answer that refused the step); `null` when none was given. */
  errorCode: string | null;
}

/** The outcome the state of the activation says after «activate»: Active only when the server says so. */
export function outcomeOfState(propertyId: string, state: MarketplaceActivationState): ActivationOutcome {
  return state.status === 'Active' ? { propertyId, status: 'Active', errorCode: null } : { propertyId, status: 'ToFix', errorCode: state.lastErrorCode };
}

/** The outcome when the step was refused (or failed): To fix, with the code of the answer. Never Active. */
export function outcomeOfFailure(propertyId: string, errorCode: string | null): ActivationOutcome {
  return { propertyId, status: 'ToFix', errorCode };
}

/** What a property of the result says in the first line: how many are Active and how many are to fix. */
export function resultCounts(outcomes: readonly ActivationOutcome[]): { active: number; toFix: number } {
  const active = outcomes.filter((outcome) => outcome.status === 'Active').length;
  return { active, toFix: outcomes.length - active };
}

/** How many rooms are shown at a time in the mapping (UX-04: one topic, about five things on screen). */
export const MAPPING_PAGE_SIZE = 5;

/** The choice of a channel room that says it is not one of the property's: it is left out of the mapping. */
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

/** The body of `PUT .../mapping`: the rooms that were given a product. A room left out or skipped is not in it, and an empty list is never sent (see {@link mappingProblem}). */
export function roomChoicesToSave(choices: Readonly<Record<string, string>>): MarketplaceRoomChoice[] {
  return Object.entries(choices)
    .filter(([, productId]) => productId !== '' && productId !== SKIP_ROOM)
    .map(([channelRoomId, productId]) => ({ channelRoomId, productId }));
}

/** What stops a mapping from being saved: no room is mapped (an empty choice is never «all the rooms»), or a room still has no decision. `null` when it can be saved. */
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
  /** The name of the portal as the catalog has it, from the plan; `null` until a plan was read. */
  channelName: string | null;
  /** What the portal asks of the person; `null` until a plan was read. */
  requirements: ActivationRequirements | null;
  /** The short-rent properties of the host the caller reaches. */
  properties: readonly Property[];
  propertiesStatus: 'pending' | 'error' | 'ready';
  plans: ReadonlyMap<string, MarketplaceActivationPlan>;
  /** A plan is still being read. */
  plansPending: boolean;
  /** The first error of a read of a plan (the connection to the channel manager is missing, the portal is unknown...), or `null`. */
  planError: unknown;
  /** The properties whose plan could not be read (a read that failed, not one that is still going on) while the plans of others were: they are told, never dropped. */
  unreadProperties: readonly string[];
  /** Reads the properties and the plans again. */
  onRetry: () => void;
}

/** The name of a property as the host knows it; a property that is not in the list (a draft that is older than the list) is named by what it is. */
export function propertyNameOf(properties: readonly Property[], propertyId: string): string | null {
  return properties.find((property) => property.id === propertyId)?.name ?? null;
}

/**
 * The point of this wizard that a guided step of the panel comes back to: the server stores it with the step (named, never carried) and the page of
 * the step reads it when the person is back from the panel. The wizard is the activation of CasaZen; the step code says which flow and which kind.
 */
const RESUME_STEP_CODES: Readonly<Record<MarketplaceConnectionKind, string>> = {
  Channel: 'marketplaceActivationChannel',
  Tool: 'marketplaceActivationTool',
};

export function activationPanelResume(kind: MarketplaceConnectionKind) {
  return { resumeWizardType: 'OnboardingActivation', resumeStepCode: RESUME_STEP_CODES[kind] } as const;
}

/**
 * The address of the wizard a guided step of the panel was started from, at its access step and for the property and the channel of the step:
 * where the person goes when the step is done (the panel sends them back to CasaZen, which leads them on). `null` for a step that this wizard did not start.
 */
export function activationResumePath(step: Pick<PanelStep, 'channelCode' | 'propertyId' | 'resume'> | undefined): string | null {
  if (!step?.channelCode || !step.propertyId || step.resume.wizardType !== 'OnboardingActivation') return null;
  const kind = (Object.keys(RESUME_STEP_CODES) as MarketplaceConnectionKind[]).find((candidate) => RESUME_STEP_CODES[candidate] === step.resume.stepCode);
  if (!kind) return null;

  return marketplaceHref(marketplaceActivationPath(kind, step.channelCode), step.propertyId, { step: ACTIVATION_STEP.access });
}
