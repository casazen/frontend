import type { BillingSetupItemKey } from './billing-setup.types';
import type { ComplianceSenderType } from './checkin-wizard.types';
import type { ChannelPublishStatus } from './listing.types';
import type { OctorateConnectionStatus, OctorateEnvironment } from './octorate.types';
import type { WizardType } from './wizard';

export type LegalDocumentKey = 'tos' | 'privacy' | 'dpa';

export interface LegalDocumentMeta {
  key?: LegalDocumentKey;
  version: string;
  effectiveAt: string | null;
  title: string;
  summary: string;
  documentUrl?: string | null;
  available?: boolean;
  contentHtml?: string | null;
  contentLanguage?: string | null;
}

export interface SubprocessorItem {
  key?: string | null;
  name: string;
  purpose: string;
  purposeKey?: string | null;
  region: string;
  website?: string | null;
  entity?: string | null;
  transferMechanism?: string | null;
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

export type ActivationStepKey =
  | 'account'
  | 'organization'
  | 'property'
  | 'cin'
  | 'payments'
  | 'sitePublished'
  | 'firstBooking';

export type ActivationStepState = 'done' | 'todo' | 'inProgress' | 'blocked';

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

type ActivationStepReason = (typeof ACTIVATION_STEP_REASONS)[number];

export interface ActivationStep {
  key: ActivationStepKey;
  state: ActivationStepState;
  reason?: ActivationStepReason | null;
  /** Properties that satisfy the step (valid CIN, published), for the steps that count them. */
  done?: number | null;
  total?: number | null;
}

export interface OnboardingStatus {
  roleChosen: boolean;
  orgProvisioned: boolean;
  consentsAccepted: boolean;
  propertyCreated: boolean;
  sitePublished: boolean;
  firstBookingTaken: boolean;
  activated: boolean;
  publicBookingUrl?: string | null;
  steps: ActivationStep[];
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

type Instant = string;

export const ONBOARDING_FLOW_KEYS = ['Listings', 'Bookings', 'CheckInCompliance', 'Messages', 'Documents', 'Reports'] as const;
export type OnboardingFlowKey = (typeof ONBOARDING_FLOW_KEYS)[number];

export const ONBOARDING_FLOW_STATES = ['active', 'toComplete', 'notAvailable'] as const;
export type OnboardingFlowState = (typeof ONBOARDING_FLOW_STATES)[number];

export const ONBOARDING_FLOW_REASONS = [
  'connection_missing',
  'connection_lost',
  'mapping_unconfirmed',
  'mapping_unavailable',
  'sender_missing',
  'channel_content_to_fix',
  'cin_missing_or_invalid',
  'tax_rate_missing',
  'message_sync_not_ready',
  'issuer_missing',
  'no_bookings_yet',
  'flow_not_activated',
  'property_long_rent',
  'property_inactive',
  'content_managed_on_channel',
  'chat_not_licensed',
  'not_provided',
] as const;
type OnboardingFlowReason = (typeof ONBOARDING_FLOW_REASONS)[number];

export const ONBOARDING_FLOW_ACTIONS = [
  'connect',
  'reconnect',
  'confirmMapping',
  'chooseSender',
  'fixListing',
  'enterCin',
  'enterTaxRate',
  'activate',
  'chooseIssuer',
] as const;
export type OnboardingFlowAction = (typeof ONBOARDING_FLOW_ACTIONS)[number];

export const ONBOARDING_PREREQUISITE_KEYS = ['connection', 'mapping', 'singleSender', 'content', 'cin', 'taxRate', 'messageSync', 'issuer', 'bookings'] as const;
export type OnboardingPrerequisiteKey = (typeof ONBOARDING_PREREQUISITE_KEYS)[number];

export interface FlowSummary {
  flow: OnboardingFlowKey;
  active: number;
  toComplete: number;
  notAvailable: number;
  total: number;
}

interface FlowPrerequisite {
  key: OnboardingPrerequisiteKey;
  met: boolean;
  reason: OnboardingFlowReason | null;
}

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

export interface PagedFlowProperties {
  items: FlowPropertyStatus[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface FlowPropertiesQuery {
  state?: OnboardingFlowState;
  search?: string;
  page?: number;
  pageSize?: number;
}

/**
 * The twelve parts of the plan, in order (backend `OnboardingPartCatalog`, NF-104, ONB-01): the connection to Octorate, the properties,
 * the channels, the check of the listings, prices and rules, compliance, identification and access, messages and AI, fiscal documents,
 * the optional partners, the notification of the guests in Switzerland (E29/F02/US01/T02: only for an organization with an active property
 * there, otherwise `notAvailable`), and the summary with the activation. These are the codes the API writes and the `{key}` of
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
  'guestRegistration',
  'activation',
] as const;
export type OnboardingPartKey = (typeof ONBOARDING_PART_KEYS)[number];

export const ONBOARDING_PART_STATES = ['done', 'open', 'deferred', 'blocked', 'notAvailable'] as const;
export type OnboardingPartState = (typeof ONBOARDING_PART_STATES)[number];

/**
 * Why a part is not done (backend `OnboardingPartReasons`). Null for a part that is done. The code `accountant_handles` is not here any more: the accountant only receives exports since
 * 2026-11-14 and the backend never produces it again (the constant stays there for old rows); a row that still carries it reads as a reason this version has no text for.
 */
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
  'notification_preferences_missing',
  'assistant_situation_missing',
  'issuer_missing',
  'partner_integration_missing',
  'connector_off',
  'swiss_municipality_missing',
  'ticino_structure_id_missing',
  'no_swiss_property',
  'no_property',
  'required_part_not_done',
  'not_provided',
] as const;
export type OnboardingPartReason = (typeof ONBOARDING_PART_REASONS)[number];

export const ONBOARDING_NEED_CODES = ['alloggiatiCredentials', 'istatCredentials', 'fiscalData', 'otaAccess', 'lockCode'] as const;
export type OnboardingNeedCode = (typeof ONBOARDING_NEED_CODES)[number];

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
  'guestRegistration',
] as const;
export type OnboardingLaunchTarget = (typeof ONBOARDING_LAUNCH_TARGETS)[number];

export const ONBOARDING_PATH_STEP_CODES = [
  'connectChannels',
  'checkListings',
  'pricesCalendar',
  'checkInCompliance',
  'messagesAi',
  'fiscalDocuments',
] as const;
export type OnboardingPathStepCode = (typeof ONBOARDING_PATH_STEP_CODES)[number];

export const ASSIST_REQUEST_STATUSES = ['Requested', 'InProgress', 'Done', 'Cancelled'] as const;
export type AssistRequestStatus = (typeof ASSIST_REQUEST_STATUSES)[number];

interface OnboardingPartAssist {
  id: string;
  status: AssistRequestStatus;
  context: string;
  requestedAt: Instant;
}

export interface OnboardingPartMissing {
  propertyId: string;
  reason: string;
  code: string;
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
  /**
   * Why the part is not done. For the part «Fatturazione» (`fiscalDocuments`) it is the key of the first missing item of the billing setup (`BillingSetupItemKey`, in the order of
   * the wizard): the guide opens the wizard at the step the key belongs to. `issuer_missing` there means the issuance of fiscal documents is off.
   */
  reason: OnboardingPartReason | BillingSetupItemKey | null;
  done: number;
  total: number;
  requires: OnboardingPartKey[];
  deferrable: boolean;
  needs: OnboardingNeedCode[];
  remindAt: Instant | null;
  assist: OnboardingPartAssist | null;
  launchTarget: OnboardingLaunchTarget;
  missing?: OnboardingPartMissing[];
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

export interface OnboardingPath {
  code: string;
  steps: OnboardingPathStep[];
  next: OnboardingPathStepCode | null;
}

export interface OnboardingPlan {
  parts: OnboardingPart[];
  needs: OnboardingNeedCode[];
  path: OnboardingPath;
  activated: boolean;
}

export interface OnboardingPartChange {
  code: OnboardingPartKey;
  state: OnboardingPartState;
  remindAt: Instant | null;
  todoId: string | null;
}

export interface DeferPartRequest {
  remindAt?: Instant;
}

export interface OnboardingReopen {
  code: OnboardingPartKey;
  launchTarget: OnboardingLaunchTarget;
  focus: 'sender' | null;
}

export const ACTIVATION_OUTCOMES = ['activated', 'alreadyActive', 'prerequisitesNotMet', 'notAvailable', 'notFound'] as const;
export type ActivationOutcome = (typeof ACTIVATION_OUTCOMES)[number];

export const DEACTIVATION_OUTCOMES = ['deactivated', 'alreadyInactive', 'notFound'] as const;
type DeactivationOutcome = (typeof DEACTIVATION_OUTCOMES)[number];

export interface FlowActivationOutcome {
  propertyId: string;
  outcome: ActivationOutcome | DeactivationOutcome;
  unmetPrerequisites: OnboardingPrerequisiteKey[];
  reason: OnboardingFlowReason | null;
}

export interface FlowActivationResult {
  flow: OnboardingFlowKey;
  outcomes: FlowActivationOutcome[];
}

export const TEST_RUN_OUTCOMES = ['pass', 'fail', 'skipped'] as const;
export type TestRunOutcome = (typeof TEST_RUN_OUTCOMES)[number];

export interface FlowCheck {
  flow: OnboardingFlowKey;
  outcome: TestRunOutcome;
  reasons: string[];
}

export interface TestRunResult {
  propertyId: string;
  bookingId: string;
  checks: FlowCheck[];
}

export interface TestRunRequest {
  propertyId: string;
  bookingId?: string;
}

/** The org's connection to Octorate in this environment (`connection` of the integration overview). `status` is null when the org never connected here. */
export interface ConnectionHealth {
  status: OctorateConnectionStatus | null;
  environment: OctorateEnvironment;
  lastSyncedAt: Instant | null;
  reconnectRequired: boolean;
}

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

export interface ChannelStatusCount {
  status: ChannelPublishStatus;
  count: number;
}

export interface IntegrationOverview {
  connection: ConnectionHealth;
  parts: IntegrationPart[];
  senders: SenderCounts;
  channels: ChannelStatusCount[];
}

/** The guided steps of the Octorate panel (backend `PanelStepKind`): the connection of the police and of ISTAT, and the access to a channel. */
export const PANEL_STEP_KINDS = ['policeConnection', 'istatConnection', 'channelAccess'] as const;
export type PanelStepKind = (typeof PANEL_STEP_KINDS)[number];

export const PANEL_STEP_STATUSES = ['started', 'verified', 'confirmed', 'notValid', 'assistRequested'] as const;
type PanelStepStatus = (typeof PANEL_STEP_STATUSES)[number];

export const PANEL_STEP_HANDOFF_MODES = ['redirectCallback', 'managedWindow'] as const;
export type PanelStepHandoffMode = (typeof PANEL_STEP_HANDOFF_MODES)[number];

export const PANEL_STEP_INSTRUCTIONS = ['panelPolice', 'panelIstat', 'panelChannelAccess'] as const;
type PanelStepInstructionsKey = (typeof PANEL_STEP_INSTRUCTIONS)[number];

export const PANEL_STEP_VERIFICATIONS = ['verified', 'notValid', 'unverifiable'] as const;
type PanelStepVerification = (typeof PANEL_STEP_VERIFICATIONS)[number];

interface PanelStepResume {
  wizardType: WizardType | null;
  draftEntityId: string | null;
  stepCode: string | null;
}

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

export interface StartedPanelStep extends PanelStep {
  panelUrl: string;
  callbackUrl: string | null;
}

export interface StartPanelStepRequest {
  kind: PanelStepKind;
  propertyId?: string;
  channelCode?: string;
  resumeWizardType?: WizardType;
  resumeDraftEntityId?: string;
  resumeStepCode?: string;
}

export const ASSIST_REQUEST_CONTEXTS = ['panelPolice', 'panelIstat', 'panelChannelAccess', 'part'] as const;
export type AssistRequestContext = (typeof ASSIST_REQUEST_CONTEXTS)[number];

export interface CreateAssistRequest {
  part: OnboardingPartKey;
  context: AssistRequestContext;
  propertyId?: string;
  channelCode?: string;
}

export type AssistOutcome = 'verified' | 'declared';

export interface AssistRequest {
  id: string;
  part: OnboardingPartKey;
  propertyId: string | null;
  channelCode?: string | null;
  context: AssistRequestContext;
  status: AssistRequestStatus;
  requestedAt: Instant;
  updatedAt: Instant;
  completedAt: Instant | null;
  staffNote: string | null;
  activityId: string | null;
  outcome?: AssistOutcome | null;
  hostNote?: string | null;
  reopenedAt?: Instant | null;
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
  outcome?: AssistOutcome | null;
  hostNote?: string | null;
  reopenedAt?: Instant | null;
}

export const ASSIST_UPDATE_STATUSES = ['inProgress', 'done', 'cancelled'] as const;
export type AssistUpdateStatus = (typeof ASSIST_UPDATE_STATUSES)[number];

export interface UpdateAssistRequest {
  status: AssistUpdateStatus;
  note?: string;
}

export interface AssistQueueQuery {
  status?: AssistRequestStatus;
  page?: number;
  pageSize?: number;
}

export interface PagedAssistRequests {
  items: AdminAssistRequest[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export const ASSIST_NOTE_MAX_LENGTH = 500;

export interface ReopenAssistRequest {
  note: string;
}

/** Whether a credential is there and since when (`null` when it is not). Never a value. */
export interface AssistPresence {
  present: boolean;
  updatedAt: Instant | null;
}

/** Whether the region of a property needs ISTAT credentials: `required`, `notRequired` (outside Italy) or `toVerify` (the table of the regions is not there yet). */
type AssistIstatRequirement = 'required' | 'notRequired' | 'toVerify';

/** The ISTAT credentials of a property: whether they are there, since when, and whether the region needs them. */
export interface AssistIstatPresence extends AssistPresence {
  requirement: AssistIstatRequirement;
}

/** Who sends the police and ISTAT communications of a property, since when, and whether the host declared it active after that change. */
interface AssistSender {
  sender: ComplianceSenderType;
  changedAt: Instant;
  activationDeclared: boolean;
}

export type AssistChecklistStepState = 'notStarted' | PanelStepStatus;

export interface AssistChecklistStep {
  kind: PanelStepKind;
  channelCode: string | null;
  instructionsKey: PanelStepInstructionsKey;
  state: AssistChecklistStepState;
  lastVerificationOutcome: PanelStepVerification | null;
  completedAt: Instant | null;
}

/**
 * What support needs for one property of a request, or for the org itself (`propertyId` null, E20/F03/US01/T02): `panelUser` is the user of the panel of the structure in the
 * support vault; the police credentials, the ISTAT ones and the sender are `null` for the org itself (the sender also when nothing is stored: the default applies). Presence
 * and dates only: never a credential.
 */
export interface AssistChecklistProperty {
  country?: string | null;
  propertyId: string | null;
  propertyName: string | null;
  comune: string | null;
  panelUser: AssistPresence;
  policeCredentials: AssistPresence | null;
  istatCredentials: AssistIstatPresence | null;
  sender: AssistSender | null;
  steps: AssistChecklistStep[];
}

export interface AdminAssistRequestDetail {
  request: AdminAssistRequest;
  checklist: AssistChecklistProperty[];
}

/** What a controlled opening of the support vault opens (backend `SupportVaultCredentialKind`, E20/F03/US01/T01): the user of the panel, the police or the ISTAT credentials. */
export type SupportVaultCredentialKind = 'OctoratePanel' | 'Police' | 'RegionalIstat';

export const SUPPORT_VAULT_REASON_LENGTH = { min: 10, max: 300 } as const;

/** Body of `POST /admin/onboarding/assist-requests/{id}/reveal`: which credential and why. The reason stays in the audit and is never shown to the host. */
export interface RevealSupportVaultRequest {
  kind: SupportVaultCredentialKind;
  reason: string;
}

export interface SupportVaultReveal {
  kind: SupportVaultCredentialKind;
  username: string;
  password: string;
  /** The further code (the web service key of the police credentials, the code of the structure of the ISTAT ones); `null` when there is none. */
  extraCode: string | null;
  unitCode?: string | null;
  openedAt: Instant;
  visibleUntil: Instant;
}

/** What staff can store in the support vault (backend `SupportVaultSecretKind`): the user of the panel of a structure, or ISTAT credentials the host handed to support. */
type SupportVaultSecretKind = 'OctoratePanel' | 'RegionalIstat';

export const SUPPORT_VAULT_VALUE_MAX_LENGTH = { username: 200, password: 200, extraCode: 100 } as const;

export interface StoreSupportVaultSecretRequest {
  orgId: string;
  propertyId?: string;
  kind: SupportVaultSecretKind;
  username: string;
  password: string;
  extraCode?: string;
}

/** A credential of the vault as anybody reads it: that it is there, for what, since when and who stored it last. Never a value. */
export interface SupportVaultSecret {
  id: string;
  orgId: string;
  propertyId: string | null;
  kind: SupportVaultSecretKind;
  createdAt: Instant;
  updatedAt: Instant;
  updatedByUserId: string;
}

/**
 * The regional ISTAT credentials of a property (`/properties/{id}/istat-credentials`, E20/F03/US01/T01): write-only, like the police ones. The API never returns a value, only
 * whether they are configured and since when.
 */
export interface IstatCredentialsStatus {
  configured: boolean;
  configuredAt: Instant | null;
}

/** Body of `PUT /properties/{id}/istat-credentials`: the user name and the password every time, the code of the structure when the portal asks for one (empty when it does not). */
export interface SetIstatCredentialsRequest {
  username: string;
  password: string;
  structureCode: string;
}

export const ISTAT_CREDENTIALS_MAX_LENGTH = { username: 100, password: 200, structureCode: 50 } as const;

export const BULK_SELECTION_KINDS = ['all', 'ids', 'filter'] as const;
type BulkSelectionKind = (typeof BULK_SELECTION_KINDS)[number];

interface BulkFlowState {
  flow: OnboardingFlowKey;
  state: OnboardingFlowState;
}

export interface BulkFilter {
  comuneIstatCodes?: string[];
  regionCodes?: string[];
  channelCodes?: string[];
  missingFlow?: OnboardingFlowKey;
  flowState?: BulkFlowState;
}

export interface BulkSelection {
  kind: BulkSelectionKind;
  propertyIds?: string[];
  filter?: BulkFilter;
}

interface BulkPropertySample {
  propertyId: string;
  name: string;
  city: string;
}

export interface BulkPreview {
  total: number;
  sample: BulkPropertySample[];
  notFound: number;
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

export const BULK_APPLY_OUTCOMES = ['applied', 'unchanged', 'refused', 'wouldChange'] as const;
type BulkApplyOutcome = (typeof BULK_APPLY_OUTCOMES)[number];

export interface BulkApplyItem {
  propertyId: string;
  name: string | null;
  city: string | null;
  outcome: BulkApplyOutcome;
  reason: string | null;
}

interface BulkApplySummary {
  applied: number;
  unchanged: number;
  refused: number;
  wouldChange: number;
}

export interface BulkApplyResult {
  dryRun: boolean;
  complianceSender: ComplianceSenderType;
  summary: BulkApplySummary;
  items: BulkApplyItem[];
}

export interface BulkFlowProgress {
  flow: OnboardingFlowKey;
  active: number;
  ready: number;
  toComplete: number;
  notAvailable: number;
}

interface PilotMember {
  propertyId: string;
  name: string;
  city: string;
  addedAt: Instant;
}

interface PilotFlow {
  flow: OnboardingFlowKey;
  available: number;
  active: number;
  isActive: boolean;
}

export interface PilotGroup {
  members: PilotMember[];
  size: number;
  recommendedMin: number;
  maxSize: number;
  belowRecommended: boolean;
  flows: PilotFlow[];
}

export interface BulkProgress {
  total: number;
  ready: number;
  notReady: number;
  flows: BulkFlowProgress[];
  pilot: PilotGroup;
}

export const BULK_COHORTS = ['pilot', 'rest'] as const;
export type BulkCohort = (typeof BULK_COHORTS)[number];

export interface BulkActivateRequest {
  cohort: BulkCohort;
  flows: OnboardingFlowKey[];
}

interface BulkActivateFlow {
  flow: OnboardingFlowKey;
  outcomes: FlowActivationOutcome[];
}

export interface BulkActivateResult {
  cohort: BulkCohort;
  flows: BulkActivateFlow[];
}

interface ImportRowError {
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

interface ImportSummary {
  rows: number;
  valid: number;
  invalid: number;
  applied: number;
}

export interface ImportResult {
  dryRun: boolean;
  summary: ImportSummary;
  unknownColumns: string[];
  rows: ImportRowResult[];
}
