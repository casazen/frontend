import type { ComplianceSenderType } from './checkin-wizard.types';
import type { ChannelPublishStatus } from './listing.types';
import type { OctorateConnectionStatus, OctorateEnvironment } from './octorate.types';
import type { WizardType } from './wizard';

/** Legal documents a host accepts (PL-14): `GET /api/legal/{key}`. */
export type LegalDocumentKey = 'tos' | 'privacy' | 'dpa';

export interface LegalDocumentMeta {
  key?: LegalDocumentKey;
  version: string;
  /** Date the version is in force; null while not configured on the backend. */
  effectiveAt: string | null;
  title: string;
  summary: string;
  /** Optional external copy of the official text (https). */
  documentUrl?: string | null;
  /** False while the product owner has not provided the text (D14): the page says "in preparation". */
  available?: boolean;
  /** Sanitized HTML of the text, provided by the product owner. Sanitize again before rendering. */
  contentHtml?: string | null;
  /** Language of `contentHtml`: the requested one, or `it` when no translation exists. */
  contentLanguage?: string | null;
}

export interface SubprocessorItem {
  /** Stable identifier of the provider (e.g. `auth0`). */
  key?: string | null;
  name: string;
  purpose: string;
  /** Localized purpose key (`legal.subprocessors.purposes.*`); null when the purpose is configured text. */
  purposeKey?: string | null;
  region: string;
  website?: string | null;
  /** Legal entity and registered office, as configured by the product owner. */
  entity?: string | null;
  /** Legal basis of a transfer outside the EEA, when there is one. */
  transferMechanism?: string | null;
  /** Legal entity, location or transfer basis still to be completed (never invented). */
  detailsPending?: boolean;
}

export interface SubprocessorsDocument {
  version: string;
  effectiveAt: string | null;
  items: SubprocessorItem[];
}

export interface OnboardingConsentsPayload {
  tosAccepted: boolean;
  tosVersion: string;
  privacyAccepted: boolean;
  privacyVersion: string;
  dpaAccepted: boolean;
  dpaVersion: string;
  subprocessorsAcknowledged: boolean;
  subprocessorsVersion: string;
  marketingOptIn?: boolean;
}

/** Steps of the activation checklist (PL-15): stable keys of `GET /api/onboarding/status`. */
export type ActivationStepKey =
  | 'account'
  | 'organization'
  | 'property'
  | 'cin'
  | 'payments'
  | 'sitePublished'
  | 'firstBooking';

/**
 * `done`: the stored state proves it. `todo`: not started. `inProgress`: started, something is still missing.
 * `blocked`: another step comes first.
 */
export type ActivationStepState = 'done' | 'todo' | 'inProgress' | 'blocked';

/** Why a step is not done: stable codes of the backend (`ActivationStepReasons`), translated by the client. */
export const ACTIVATION_STEP_REASONS = [
  'onboarding_incomplete',
  'org_profile_incomplete',
  'no_property',
  'cin_missing_or_invalid',
  'connect_not_started',
  'connect_requirements_due',
  'connect_pending_verification',
  'org_inactive',
  'properties_paused',
  'compliance_pending',
  'properties_inactive',
  'payments_not_ready',
  'site_not_published',
  'awaiting_first_booking',
] as const;

export type ActivationStepReason = (typeof ACTIVATION_STEP_REASONS)[number];

export interface ActivationStep {
  key: ActivationStepKey;
  state: ActivationStepState;
  /** Null when the step is done. */
  reason?: ActivationStepReason | null;
  /** Properties that satisfy the step (valid CIN, published), for the steps that count them. */
  done?: number | null;
  /** Properties of the org, for the steps that count them. */
  total?: number | null;
}

/** `GET /api/onboarding/status`: the activation of the caller's org, derived from stored state (PL-15). */
export interface OnboardingStatus {
  roleChosen: boolean;
  orgProvisioned: boolean;
  consentsAccepted: boolean;
  propertyCreated: boolean;
  /** True only when a published property can really be booked and paid (Stripe charges enabled). */
  sitePublished: boolean;
  firstBookingTaken: boolean;
  activated: boolean;
  /** Link to share; null until the site is really published or when the public domain is not configured (D3). */
  publicBookingUrl?: string | null;
  steps: ActivationStep[];
  /**
   * The six flows over the properties the caller reaches (NF-106). Optional: an older backend, a response with the flag
   * `octorateOnboarding` off and a caller who may not read the properties send none (or an empty list).
   */
  flows?: FlowSummary[];
}

// ---------------------------------------------------------------------------------------------------------------------
// The activation of CasaZen with Octorate (epic E10): the six flows, the plan of eleven parts, the guided steps of the panel,
// the «Do it for me» requests and the bulk configuration of an agency. They mirror the DTOs of the backend
// (`Casazen.Web/DTOs/Onboarding`) field for field, in camelCase. The server sends codes, counts, ids and instants and never a
// sentence: the client translates the codes (`onboardingPlan.*`). A code this version does not know (the server is newer than
// the app) is possible at run time, whatever the union says: the screens leave it out or fall back to a neutral text, never
// show it as it came.
//
// Casing: the codes the server writes itself (states, reasons, actions, part and step codes) are camelCase or snake_case
// strings; a value of a backend enum travels as the MEMBER NAME (`Listings`, `CheckInCompliance`, `Requested`, `ChannelManager`,
// `Draft`...), as in `octorate.types.ts`, and is read back without regard to case.
// ---------------------------------------------------------------------------------------------------------------------

/** An instant sent by the server: UTC, ISO 8601. */
type Instant = string;

/**
 * The six flows CasaZen runs for a property (backend enum `OnboardingFlow`, NF-106): the content of the property on the channels, the
 * bookings, the check-in and the legal obligations, the messages, the fiscal documents and the reports. The API writes the member
 * name (`flow` of every answer) and reads it in the path (`/onboarding/flows/{flow}/...`) without regard to case.
 */
export const ONBOARDING_FLOW_KEYS = ['Listings', 'Bookings', 'CheckInCompliance', 'Messages', 'Documents', 'Reports'] as const;
export type OnboardingFlowKey = (typeof ONBOARDING_FLOW_KEYS)[number];

/** Where a flow stands on a property: it runs, something is missing, or it does not apply (or CasaZen has nothing to run for it yet). */
export const ONBOARDING_FLOW_STATES = ['active', 'toComplete', 'notAvailable'] as const;
export type OnboardingFlowState = (typeof ONBOARDING_FLOW_STATES)[number];

/** Why a flow is not active on a property (backend `OnboardingFlowReasons`): the first group is something missing, the rest says it does not apply. */
export const ONBOARDING_FLOW_REASONS = [
  'connection_missing',
  'connection_lost',
  'mapping_unconfirmed',
  'mapping_unavailable',
  'sender_missing',
  'channel_content_to_fix',
  'cin_missing_or_invalid',
  'tax_rate_missing',
  'flow_not_activated',
  'property_long_rent',
  'property_inactive',
  'content_managed_on_channel',
  'not_provided',
] as const;
export type OnboardingFlowReason = (typeof ONBOARDING_FLOW_REASONS)[number];

/** What fixes a reason, the «Do now» of the host (backend `OnboardingFlowActions`). A reason may have none. */
export const ONBOARDING_FLOW_ACTIONS = [
  'connect',
  'reconnect',
  'confirmMapping',
  'chooseSender',
  'fixListing',
  'enterCin',
  'enterTaxRate',
  'activate',
] as const;
export type OnboardingFlowAction = (typeof ONBOARDING_FLOW_ACTIONS)[number];

/** What a flow needs on a property (backend `OnboardingPrerequisiteKeys`). */
export const ONBOARDING_PREREQUISITE_KEYS = ['connection', 'mapping', 'singleSender', 'content', 'cin', 'taxRate'] as const;
export type OnboardingPrerequisiteKey = (typeof ONBOARDING_PREREQUISITE_KEYS)[number];

/** How many properties are in each state of one flow (`flows` of `GET /onboarding/status`, NF-106). `total` is the sum of the other three. */
export interface FlowSummary {
  flow: OnboardingFlowKey;
  active: number;
  toComplete: number;
  notAvailable: number;
  total: number;
}

/** A prerequisite of a flow on a property and whether it holds. `reason` is null when it does. */
export interface FlowPrerequisite {
  key: OnboardingPrerequisiteKey;
  met: boolean;
  reason: OnboardingFlowReason | null;
}

/**
 * One flow on one property (`GET /onboarding/flows/{flow}/properties`, NF-106). `reason`: what is missing or why the flow does not apply,
 * null when it is active. `action`: what fixes it, null when nothing the host does does. `prerequisites` is empty when the flow does
 * not apply to the property.
 */
export interface FlowPropertyStatus {
  propertyId: string;
  name: string;
  city: string;
  flow: OnboardingFlowKey;
  state: OnboardingFlowState;
  reason: OnboardingFlowReason | null;
  action: OnboardingFlowAction | null;
  prerequisites: FlowPrerequisite[];
}

/** A page of {@link FlowPropertyStatus}, by name: `page` starts from 1, `pageSize` is 50 when missing and at most 100. */
export interface PagedFlowProperties {
  items: FlowPropertyStatus[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Query of `GET /onboarding/flows/{flow}/properties`. */
export interface FlowPropertiesQuery {
  state?: OnboardingFlowState;
  /** A text found in the name or in the city of the property. */
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * The eleven parts of the plan, in order (backend `OnboardingPartCatalog`, NF-104, ONB-01): the connection to Octorate, the properties,
 * the channels, the check of the listings, prices and rules, compliance, identification and access, messages and AI, fiscal documents,
 * the optional partners, and the summary with the activation. These are the codes the API writes and the `{key}` of
 * `/onboarding/parts/{key}/...` (read without regard to case).
 */
export const ONBOARDING_PART_KEYS = [
  'octorateConnection',
  'properties',
  'channels',
  'listings',
  'pricesRules',
  'compliance',
  'identification',
  'messagesAi',
  'fiscalDocuments',
  'partners',
  'activation',
] as const;
export type OnboardingPartKey = (typeof ONBOARDING_PART_KEYS)[number];

/**
 * Where a part of the plan stands, worked out by the server on every read in this precedence: `notAvailable`, `done`, `deferred` (the host
 * chose «Lo faccio dopo»), `blocked` (a part it requires is not done), `open`.
 */
export const ONBOARDING_PART_STATES = ['done', 'open', 'deferred', 'blocked', 'notAvailable'] as const;
export type OnboardingPartState = (typeof ONBOARDING_PART_STATES)[number];

/** Why a part is not done (backend `OnboardingPartReasons`). Null for a part that is done. */
export const ONBOARDING_PART_REASONS = [
  'inventory_scenario_missing',
  'existing_ota_import_incomplete',
  'connection_missing',
  'connection_lost',
  'mapping_unavailable',
  'mapping_unconfirmed',
  'channels_missing',
  'channel_content_to_fix',
  'price_missing',
  'sender_missing',
  'cin_missing_or_invalid',
  'tax_rate_missing',
  'identification_off',
  'access_code_missing',
  'flows_incomplete',
  'no_property',
  'required_part_not_done',
  'not_provided',
] as const;
export type OnboardingPartReason = (typeof ONBOARDING_PART_REASONS)[number];

/** «What you need» (backend `OnboardingNeedCodes`): what the host should have at hand before a part, in the order the plan shows them. */
export const ONBOARDING_NEED_CODES = ['alloggiatiCredentials', 'istatCredentials', 'fiscalData', 'otaAccess', 'lockCode'] as const;
export type OnboardingNeedCode = (typeof ONBOARDING_NEED_CODES)[number];

/** The wizard that does a part (backend `OnboardingLaunchTargets`): the web maps each code to the launcher of the part. */
export const ONBOARDING_LAUNCH_TARGETS = [
  'connect',
  'mapping',
  'channels',
  'listings',
  'prices',
  'compliance',
  'identification',
  'messages',
  'fiscal',
  'marketplace',
  'summary',
] as const;
export type OnboardingLaunchTarget = (typeof ONBOARDING_LAUNCH_TARGETS)[number];

/** The six steps of the path «Inizia con CasaZen» (code `start-with-casazen`), in order (UX-10): each is made of one or more parts of the plan. */
export const ONBOARDING_PATH_STEP_CODES = [
  'connectChannels',
  'checkListings',
  'pricesCalendar',
  'checkInCompliance',
  'messagesAi',
  'fiscalDocuments',
] as const;
export type OnboardingPathStepCode = (typeof ONBOARDING_PATH_STEP_CODES)[number];

/** Where a «Do it for me» request stands (backend enum `OnboardingAssistStatus`, written as its member name). `Requested` and `InProgress` are the open ones. */
export const ASSIST_REQUEST_STATUSES = ['Requested', 'InProgress', 'Done', 'Cancelled'] as const;
export type AssistRequestStatus = (typeof ASSIST_REQUEST_STATUSES)[number];

/** The open «Do it for me» request of a part, if any (`assist` of a part of the plan): ids and instants only, no person, no note. */
export interface OnboardingPartAssist {
  id: string;
  status: AssistRequestStatus;
  /** What help is asked with: `panelPolice`, `panelIstat`, `panelChannelAccess` or `part`. */
  context: string;
  requestedAt: Instant;
}

/**
 * One part of the plan (`parts` of `GET /onboarding/plan`, NF-104). `done` of `total` is the progress (both 0 for a part nobody provides).
 * `requires`: the codes of the parts that must be done first. `deferrable` is false for a part another part requires. `needs`: the codes
 * of «What you need» of the part. `remindAt`: when the «Da fare» of a deferral or an exit is due, null when there is none.
 */
export interface OnboardingPart {
  code: OnboardingPartKey;
  order: number;
  state: OnboardingPartState;
  reason: OnboardingPartReason | null;
  done: number;
  total: number;
  requires: OnboardingPartKey[];
  deferrable: boolean;
  needs: OnboardingNeedCode[];
  remindAt: Instant | null;
  assist: OnboardingPartAssist | null;
  launchTarget: OnboardingLaunchTarget;
}

/**
 * One step of the connected path (`GET /onboarding/path`, UX-10, NF-10). `state` is `done` when every part is, `notAvailable` when none is
 * provided, otherwise the state of its first part that is neither. `visible` is true only while there is something to do in it.
 */
export interface OnboardingPathStep {
  code: OnboardingPathStepCode;
  order: number;
  parts: OnboardingPartKey[];
  state: OnboardingPartState;
  visible: boolean;
}

/**
 * The connected path (`GET /onboarding/path`, also `path` of the plan). `next` is the first visible step the host did not put off (a step
 * set aside with «Più tardi» stays visible, as `deferred`, and is not proposed again at once); null when there is none.
 */
export interface OnboardingPath {
  code: string;
  steps: OnboardingPathStep[];
  next: OnboardingPathStepCode | null;
}

/** The plan of the activation (`GET /onboarding/plan`, NF-104): the eleven parts, «What you need», the path and whether the org is activated. */
export interface OnboardingPlan {
  parts: OnboardingPart[];
  needs: OnboardingNeedCode[];
  path: OnboardingPath;
  /** True when every property the caller reaches has every flow that applies to it active. */
  activated: boolean;
}

/** What a deferral, an exit or a resume left on a part: `deferred` after a deferral, `open` after an exit or a resume. `todoId` is the «Da fare» that stands for the part, null after a resume. */
export interface OnboardingPartChange {
  code: OnboardingPartKey;
  state: OnboardingPartState;
  remindAt: Instant | null;
  todoId: string | null;
}

/** Body of `POST /onboarding/parts/{key}/defer`: the reminder (UTC), or nothing for tomorrow at 09:00 in Rome. */
export interface DeferPartRequest {
  remindAt?: Instant;
}

/**
 * Where a reopen continues (`POST /onboarding/parts/{key}/reopen`): the wizard that does the part and, for the compliance wizard, `sender`,
 * which opens on the choice of the sender. Reopening changes no data.
 */
export interface OnboardingReopen {
  code: OnboardingPartKey;
  launchTarget: OnboardingLaunchTarget;
  focus: 'sender' | null;
}

/** What the activation of a flow did on one property (`outcome` of `POST /onboarding/flows/{flow}/activate`). */
export const ACTIVATION_OUTCOMES = ['activated', 'alreadyActive', 'prerequisitesNotMet', 'notAvailable', 'notFound'] as const;
export type ActivationOutcome = (typeof ACTIVATION_OUTCOMES)[number];

/** What the deactivation of a flow did on one property (`outcome` of `POST /onboarding/flows/{flow}/deactivate`). */
export const DEACTIVATION_OUTCOMES = ['deactivated', 'alreadyInactive', 'notFound'] as const;
export type DeactivationOutcome = (typeof DEACTIVATION_OUTCOMES)[number];

/** Body of `POST /onboarding/flows/{flow}/activate` and `deactivate`: 1 to 500 distinct properties. An empty list is a 422, never «all». */
export interface FlowActivationRequest {
  propertyIds: string[];
}

/** The outcome for one property, in the order asked. `unmetPrerequisites` and `reason` say why a `prerequisitesNotMet` or `notAvailable` outcome. */
export interface FlowActivationOutcome {
  propertyId: string;
  outcome: ActivationOutcome | DeactivationOutcome;
  unmetPrerequisites: OnboardingPrerequisiteKey[];
  reason: OnboardingFlowReason | null;
}

/** The answer of an activation or a deactivation: the flow and one outcome per property asked about. */
export interface FlowActivationResult {
  flow: OnboardingFlowKey;
  outcomes: FlowActivationOutcome[];
}

/** What the final test found in one flow: it passed, it failed, or it was skipped. */
export const TEST_RUN_OUTCOMES = ['pass', 'fail', 'skipped'] as const;
export type TestRunOutcome = (typeof TEST_RUN_OUTCOMES)[number];

/** One flow of the final test: `reasons` are codes (information on a `pass`, such as `guest_data_missing` before the arrival). */
export interface FlowCheck {
  flow: OnboardingFlowKey;
  outcome: TestRunOutcome;
  reasons: string[];
}

/** The answer of the final read-only test (`POST /onboarding/test-run`): the property, the booking it ran on and one check per flow. Nothing is written or sent. */
export interface TestRunResult {
  propertyId: string;
  bookingId: string;
  checks: FlowCheck[];
}

/** Body of `POST /onboarding/test-run`: without a booking, the most recent one of the property imported from Octorate. */
export interface TestRunRequest {
  propertyId: string;
  bookingId?: string;
}

/** The org's connection to Octorate in this environment (`connection` of the integration overview). `status` is null when the org never connected here. */
export interface ConnectionHealth {
  status: OctorateConnectionStatus | null;
  environment: OctorateEnvironment;
  lastSyncedAt: Instant | null;
  /** True when the status is `Disconnected` or `Error` (a connection never made is a connect, not a reconnect). */
  reconnectRequired: boolean;
}

/** A part of the plan as the plan gives it, plus `reopenable`: false for a part nobody provides, which has no wizard to go back to. */
export interface IntegrationPart extends OnboardingPart {
  reopenable: boolean;
}

/** The properties the caller reaches for each sender of the Alloggiati and ISTAT communications; `notSet`: no stored choice yet. */
export interface SenderCounts {
  channelManager: number;
  casaZen: number;
  manual: number;
  notSet: number;
}

/** How many channel states are in one publication status (every status is listed, with 0 when none). */
export interface ChannelStatusCount {
  status: ChannelPublishStatus;
  count: number;
}

/** The integration settings of the org (`GET /onboarding/integration`, NF-108): the connection, the parts that can be reopened, the senders and the channels. */
export interface IntegrationOverview {
  connection: ConnectionHealth;
  parts: IntegrationPart[];
  senders: SenderCounts;
  channels: ChannelStatusCount[];
}

/** The guided steps of the Octorate panel (backend `PanelStepKind`): the connection of the police and of ISTAT, and the access to a channel. */
export const PANEL_STEP_KINDS = ['policeConnection', 'istatConnection', 'channelAccess'] as const;
export type PanelStepKind = (typeof PANEL_STEP_KINDS)[number];

/** Where a guided step stands. */
export const PANEL_STEP_STATUSES = ['started', 'verified', 'confirmed', 'notValid', 'assistRequested'] as const;
export type PanelStepStatus = (typeof PANEL_STEP_STATUSES)[number];

/** How the person goes to the panel and comes back: the panel sends them back to a page of CasaZen, or CasaZen manages a window. */
export const PANEL_STEP_HANDOFF_MODES = ['redirectCallback', 'managedWindow'] as const;
export type PanelStepHandoffMode = (typeof PANEL_STEP_HANDOFF_MODES)[number];

/** The code of the instructions a step shows. */
export const PANEL_STEP_INSTRUCTIONS = ['panelPolice', 'panelIstat', 'panelChannelAccess'] as const;
export type PanelStepInstructionsKey = (typeof PANEL_STEP_INSTRUCTIONS)[number];

/** What a check of a step found: it holds, it does not, or CasaZen cannot tell (the person may then confirm by hand). */
export const PANEL_STEP_VERIFICATIONS = ['verified', 'notValid', 'unverifiable'] as const;
export type PanelStepVerification = (typeof PANEL_STEP_VERIFICATIONS)[number];

/** The point of a wizard a step comes back to: a reference to the draft, never its content. */
export interface PanelStepResume {
  wizardType: WizardType | null;
  draftEntityId: string | null;
  stepCode: string | null;
}

/**
 * The stored state of a guided step (`/onboarding/panel-steps`, NF-107). `nextCheckAt`: when the server will check next, null when the step
 * is not open. `lastVerificationOutcome`: null before any check. `canConfirm`: a check found that CasaZen cannot tell, so the person may
 * confirm by hand. `activityId`: the «Da fare» that stands for the step while it is open. Codes, ids and instants only.
 */
export interface PanelStep {
  id: string;
  kind: PanelStepKind;
  status: PanelStepStatus;
  handoffMode: PanelStepHandoffMode;
  propertyId: string | null;
  channelCode: string | null;
  instructionsKey: PanelStepInstructionsKey;
  activityId: string | null;
  nextCheckAt: Instant | null;
  lastVerificationOutcome: PanelStepVerification | null;
  canConfirm: boolean;
  resume: PanelStepResume;
  startedAt: Instant;
  completedAt: Instant | null;
}

/** The answer of `POST /onboarding/panel-steps`: the step, `panelUrl` (the panel as configured, no org, property or person in it) and, for `redirectCallback`, `callbackUrl`. */
export interface StartedPanelStep extends PanelStep {
  panelUrl: string;
  callbackUrl: string | null;
}

/** Body of `POST /onboarding/panel-steps`: the step, what it is about and the point of the wizard to come back to (named, never carried). */
export interface StartPanelStepRequest {
  kind: PanelStepKind;
  /** None for the whole org. */
  propertyId?: string;
  /** The channel of a `channelAccess` step. */
  channelCode?: string;
  /** The wizard the host leaves; the activation when the body names a step or a draft and no wizard. */
  resumeWizardType?: WizardType;
  resumeDraftEntityId?: string;
  resumeStepCode?: string;
}

/** What help is asked with in a «Do it for me» request. */
export const ASSIST_REQUEST_CONTEXTS = ['panelPolice', 'panelIstat', 'panelChannelAccess', 'part'] as const;
export type AssistRequestContext = (typeof ASSIST_REQUEST_CONTEXTS)[number];

/** Body of `POST /onboarding/assist-requests`: the part (`compliance`, `channels`...), what help is asked with, the property (none for the whole org) and, for a channel access, the channel. */
export interface CreateAssistRequest {
  part: OnboardingPartKey;
  context: AssistRequestContext;
  propertyId?: string;
  channelCode?: string;
}

/** A «Do it for me» request as the host reads it (`/onboarding/assist-requests`). `staffNote`: the note of CasaZen support, at most 500 characters. */
export interface AssistRequest {
  id: string;
  part: OnboardingPartKey;
  propertyId: string | null;
  context: AssistRequestContext;
  status: AssistRequestStatus;
  requestedAt: Instant;
  updatedAt: Instant;
  completedAt: Instant | null;
  staffNote: string | null;
  /** The «Da fare» that stands for the request while it is open. */
  activityId: string | null;
}

/**
 * A request in the staff queue (`GET /admin/onboarding/assist-requests`): ids, context codes, the property and its comune, who has it and the
 * note. The reference to the draft is the type of the wizard and what it edits: never the draft, never a credential, never the person who asked.
 */
export interface AdminAssistRequest {
  id: string;
  orgId: string;
  part: OnboardingPartKey;
  propertyId: string | null;
  propertyName: string | null;
  comune: string | null;
  context: AssistRequestContext;
  status: AssistRequestStatus;
  requestedAt: Instant;
  updatedAt: Instant;
  completedAt: Instant | null;
  assignedToUserId: string | null;
  staffNote: string | null;
  draftWizardType: WizardType | null;
  draftEntityId: string | null;
}

/** The statuses staff can move a request to (`PUT /admin/onboarding/assist-requests/{id}`). */
export const ASSIST_UPDATE_STATUSES = ['inProgress', 'done', 'cancelled'] as const;
export type AssistUpdateStatus = (typeof ASSIST_UPDATE_STATUSES)[number];

/** Body of `PUT /admin/onboarding/assist-requests/{id}`: the new status and an optional note (at most 500 characters, no e-mail address). */
export interface UpdateAssistRequest {
  status: AssistUpdateStatus;
  note?: string;
}

/** Query of `GET /admin/onboarding/assist-requests`: `status` is one of the four statuses; `page` starts from 1. */
export interface AssistQueueQuery {
  status?: AssistRequestStatus;
  page?: number;
  pageSize?: number;
}

/** A page of {@link AdminAssistRequest}. */
export interface PagedAssistRequests {
  items: AdminAssistRequest[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Which properties a bulk call is about: all of them, a list, or a filter. What the kind does not use must be left out. */
export const BULK_SELECTION_KINDS = ['all', 'ids', 'filter'] as const;
export type BulkSelectionKind = (typeof BULK_SELECTION_KINDS)[number];

/** A flow and one of its states. */
export interface BulkFlowState {
  flow: OnboardingFlowKey;
  state: OnboardingFlowState;
}

/** The criteria of a filtered selection: every criterion given must hold, a list holds when any of its values does; at least one is given. */
export interface BulkFilter {
  /** ISTAT codes (6 digits) of the comune of the property. */
  comuneIstatCodes?: string[];
  /** CasaZen region codes (`LOM`). */
  regionCodes?: string[];
  /** Codes of a channel (`booking_xml`) the property has a channel state for. */
  channelCodes?: string[];
  /** The flow is available for the property and not active yet. */
  missingFlow?: OnboardingFlowKey;
  flowState?: BulkFlowState;
}

/** Body of the selection of a bulk call. `propertyIds` goes with `ids` (1 to 500, never empty) and `filter` with `filter`. */
export interface BulkSelection {
  kind: BulkSelectionKind;
  propertyIds?: string[];
  filter?: BulkFilter;
}

/** One property of the sample of a preview. */
export interface BulkPropertySample {
  propertyId: string;
  name: string;
  city: string;
}

/** The answer of `POST /onboarding/bulk/preview`: the total, a sample of 20 properties and the ids asked that are not properties of the selection. */
export interface BulkPreview {
  total: number;
  sample: BulkPropertySample[];
  notFound: number;
  /** True when the total is more than `maxPropertiesPerCall`: narrow the selection before applying. */
  exceedsLimit: boolean;
  maxPropertiesPerCall: number;
}

/** The choice to apply in bulk: who sends the Alloggiati Web and ISTAT communications. */
export interface BulkChoice {
  complianceSender?: ComplianceSenderType;
}

/** Body of `POST /onboarding/bulk/apply`. Nothing is written unless `dryRun` is false AND `confirmed` is true (both default to false). */
export interface BulkApplyRequest {
  selection: BulkSelection;
  choice: BulkChoice;
  dryRun?: boolean;
  confirmed?: boolean;
}

/** What an apply did (or, only when nothing was written, would do) on one property. */
export const BULK_APPLY_OUTCOMES = ['applied', 'unchanged', 'refused', 'wouldChange'] as const;
export type BulkApplyOutcome = (typeof BULK_APPLY_OUTCOMES)[number];

/** The outcome for one property; `name` and `city` are null for an id that is not a property of the selection. `reason`: the code of the rule that refused it. */
export interface BulkApplyItem {
  propertyId: string;
  name: string | null;
  city: string | null;
  outcome: BulkApplyOutcome;
  reason: string | null;
}

/** How many properties are in each outcome of an apply. */
export interface BulkApplySummary {
  applied: number;
  unchanged: number;
  refused: number;
  wouldChange: number;
}

/** The answer of an apply: one item per property. `dryRun` is true when nothing was written (a dry run, or no confirmation). */
export interface BulkApplyResult {
  dryRun: boolean;
  complianceSender: ComplianceSenderType;
  summary: BulkApplySummary;
  items: BulkApplyItem[];
}

/** One flow over the properties: `active` runs, `ready` has every prerequisite met and waits for the activation, `toComplete` lacks something, `notAvailable` does not apply. */
export interface BulkFlowProgress {
  flow: OnboardingFlowKey;
  active: number;
  ready: number;
  toComplete: number;
  notAvailable: number;
}

/** A property of the pilot group. */
export interface PilotMember {
  propertyId: string;
  name: string;
  city: string;
  addedAt: Instant;
}

/** How one flow has got on the pilot group: how many members it is available for and active on; `isActive` when it has at least one and every one has it active. */
export interface PilotFlow {
  flow: OnboardingFlowKey;
  available: number;
  active: number;
  isActive: boolean;
}

/** The pilot group: its members, the recommended minimum (5) and the maximum, `belowRecommended` when it has fewer than the minimum (not an error). */
export interface PilotGroup {
  members: PilotMember[];
  size: number;
  recommendedMin: number;
  maxSize: number;
  belowRecommended: boolean;
  flows: PilotFlow[];
}

/** «`ready` of `total` ready», the four counts of each flow and the pilot group (`GET /onboarding/bulk/progress`). */
export interface BulkProgress {
  total: number;
  ready: number;
  notReady: number;
  flows: BulkFlowProgress[];
  pilot: PilotGroup;
}

/** The cohort a bulk activation is about: the pilot group, or the rest of the properties. */
export const BULK_COHORTS = ['pilot', 'rest'] as const;
export type BulkCohort = (typeof BULK_COHORTS)[number];

/** Body of `POST /onboarding/bulk/activate`: the cohort and the flows, at least one (an empty list is a 422, never «all the flows»). */
export interface BulkActivateRequest {
  cohort: BulkCohort;
  flows: OnboardingFlowKey[];
}

/** For one flow asked, the outcome of each property as the activation of a flow gives it. */
export interface BulkActivateFlow {
  flow: OnboardingFlowKey;
  outcomes: FlowActivationOutcome[];
}

/** The activation of a cohort. */
export interface BulkActivateResult {
  cohort: BulkCohort;
  flows: BulkActivateFlow[];
}

/** An error of a row of the import: the column (`propertyId`, `cinCode`, `comuneIstatCode`, `regionCode`, `alloggiatiRoomNumbers`, `lockCode`) and the code. */
export interface ImportRowError {
  column: string;
  code: string;
}

/**
 * One row of the file of the import (`POST /onboarding/bulk/import`). `status` is `ok` or the code of its first error
 * (`property_not_found`, `property_ambiguous`, `comune_unknown`, `region_mismatch`, `room_numbers_invalid`, `lock_code_invalid`,
 * `duplicate_row`); `errors` lists every error with its column. `rowNumber` is the row of the sheet (the header is row 1). `applied` is true
 * only when the row changed something (never in a dry run). Never the lock code: a row says only `lockCodeProvided`.
 */
export interface ImportRowResult {
  rowNumber: number;
  propertyRef: string | null;
  propertyId: string | null;
  status: string;
  errors: ImportRowError[];
  lockCodeProvided: boolean;
  applied: boolean;
}

/** How many rows the file has, how many are valid, how many are not and how many changed something. */
export interface ImportSummary {
  rows: number;
  valid: number;
  invalid: number;
  applied: number;
}

/** The answer of the check (`dryRun` true, nothing written) and of the import (only the valid rows written): the same shape. `unknownColumns`: the header cells the import does not know, once each. */
export interface ImportResult {
  dryRun: boolean;
  summary: ImportSummary;
  unknownColumns: string[];
  rows: ImportRowResult[];
}
