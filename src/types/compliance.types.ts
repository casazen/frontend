import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import type { ComplianceHandoffTopic } from '@/types/compliance-handoff.types';
import type { DashboardMissing } from '@/types/dashboard.types';
import type { TouristTaxRateRule, TouristTaxRateVerification } from '@/types/tourist-tax.types';

export type PropertyComplianceStatus = 'Pending' | 'Active' | 'Suspended';

export type ComplianceStepStatus = 'pending' | 'complete' | 'warning';

export interface ComplianceWizardStep {
  id: string;
  label: string;
  status: ComplianceStepStatus;
  blocker: boolean;
  message?: string | null;
  linkUrl?: string | null;
  touristTax?: ActivationTouristTax | null;
  /**
   * What keeps this step incomplete, with stable codes (e.g. `safety_gas_detector_missing`). On a step that does not block (the
   * documents and the safety sheet since 2026-11-01) they are the points of the reminder still open.
   */
  blockers?: ActivationBlocker[];
  warnings?: ActivationWarning[];
}

/**
 * A note that never blocks the activation: stable code and the message localized by the API (it names the comuni
 * involved), e.g. `cin_istat_comune_mismatch` (the comune inside the CIN is not the property's) or `comune_istat_missing`.
 */
interface ActivationWarning {
  step: string;
  code: string;
  message: string;
}

export interface ActivationBlocker {
  step: string;
  code: string;
  message: string;
}

/** Tourist tax of the property's comune in the activation wizard: a warning, never a blocker. */
export interface ActivationTouristTax {
  city: string;
  rate: ActivationTouristTaxRate | null;
  publicPageSlug: string | null;
  categoryRequired?: boolean;
}

interface ActivationTouristTaxRate extends TouristTaxRateRule {
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string | null;
  verificationLevel: TouristTaxRateVerification | null;
}

export interface ComplianceActivationResult {
  complianceStatus: PropertyComplianceStatus;
  steps: ComplianceWizardStep[];
}

export interface ComplianceActivationCompleteResult {
  complianceStatus: PropertyComplianceStatus;
  incompleteBlockers?: string[] | null;
}

export interface ActivationBlockedProblem {
  complianceStatus: PropertyComplianceStatus | null;
  incompleteBlockers: string[];
  blockers: ActivationBlocker[];
}

export interface CompletePropertyActivationCommand {
  tosAccepted?: boolean;
  /**
   * The host knows that the reminders still open (the documents, the safety sheet) are their own obligations and will complete
   * them: needed only when some are open (409 `activation_reminders_ack_required` otherwise). Recorded in the activity log.
   */
  remindersAcknowledged?: boolean;
}

export const SAFETY_ITEM_CODES = [
  'FireExtinguishers',
  'GasDetector',
  'CoDetector',
  'SystemsCompliance',
  'BdsrDeclaration',
  'SmokeDetector',
  'EmergencyInstructions',
] as const;
export type SafetyItemCode = (typeof SAFETY_ITEM_CODES)[number];

export const COMBUSTION_APPLIANCES = ['Boiler', 'WaterHeater', 'GasHob', 'Stove', 'Fireplace', 'Other'] as const;
export type CombustionAppliance = (typeof COMBUSTION_APPLIANCES)[number];

export const SAFETY_DETECTOR_TYPES = ['Battery', 'Mains', 'FixedSystem'] as const;
export type SafetyDetectorType = (typeof SAFETY_DETECTOR_TYPES)[number];

type SafetyItemAnswer = 'Present' | 'Missing' | 'ToReview';
export type SafetyItemRequirement = 'Required' | 'Optional' | 'NotApplicable' | 'Undetermined';
type SafetyItemStatus = 'Present' | 'Missing' | 'NotAnswered' | 'ToReview' | 'NotApplicable';
export type SafetyNotApplicableReason = 'NoGasNoCombustion' | 'NotEntrepreneurial';

export interface SafetyChecklistFacts {
  entrepreneurial: boolean | null;
  hasGasSupply: boolean | null;
  combustionAppliances: CombustionAppliance[] | null;
  floorCount: number | null;
  floorAreasSqm: number[] | null;
}

export interface SafetyChecklistItem {
  code: SafetyItemCode;
  requirement: SafetyItemRequirement;
  status: SafetyItemStatus;
  notApplicableReason: SafetyNotApplicableReason | null;
  answer: SafetyItemAnswer | null;
  quantity: number | null;
  location: string | null;
  detectorType: SafetyDetectorType | null;
  checkedOn: string | null;
  expiresOn: string | null;
  evidenceDocumentId: string | null;
  evidenceFileName: string | null;
  notes: string | null;
}

interface SafetyChecklistIssue {
  code: string;
  message: string;
}

export interface SafetyChecklist {
  schemaVersion: number;
  legalBasis: string;
  declarationTextVersion: string;
  saved: boolean;
  importedFromLegacy: boolean;
  facts: SafetyChecklistFacts;
  items: SafetyChecklistItem[];
  minimumExtinguishers: number | null;
  isComplete: boolean;
  blockers: SafetyChecklistIssue[];
  warnings: SafetyChecklistIssue[];
  confirmedAt: string | null;
  confirmedTextVersion: string | null;
  updatedAt: string | null;
}

export interface SaveSafetyChecklistItem {
  code: SafetyItemCode;
  answer: 'Present' | 'Missing' | null;
  quantity: number | null;
  location: string | null;
  detectorType: SafetyDetectorType | null;
  checkedOn: string | null;
  expiresOn: string | null;
  evidenceDocumentId: string | null;
  notes: string | null;
}

export interface SaveSafetyChecklistCommand {
  facts: SafetyChecklistFacts;
  items: SaveSafetyChecklistItem[];
  confirm: boolean;
}

/**
 * What the host must do for a cockpit item: backend enum `ComplianceCockpitAction`, serialized by name (CO-04, A5-09).
 * The API sends the action and its target, never a path: the route comes from the ROUTE_MANIFEST
 * (`src/lib/compliance-routes.ts`).
 */
export const COMPLIANCE_COCKPIT_ACTIONS = [
  'ActivateProperty',
  'CompleteGuestCheckIn',
  'CheckOut',
  'SendAlloggiati',
  'ResolveAlloggiatiFailure',
  'ConfirmPropertyReady',
  'VerifyIdentity',
  'UploadAlloggiatiReceipt',
  'ActivateOctorateSend',
  'SendAlloggiatiManually',
  'UploadIstatProof',
  'EnterMunicipalityTaxRate',
  'DeclareTouristTax',
  'RenewPoliceCredentials',
  'NotifyTicinoPolice',
  'NotifyGuestsAuthority',
] as const;
export type ComplianceCockpitAction = (typeof COMPLIANCE_COCKPIT_ACTIONS)[number];

export const COMPLIANCE_LIGHTS = ['Green', 'Yellow', 'Red'] as const;
export type ComplianceLightName = (typeof COMPLIANCE_LIGHTS)[number];

export const COMPLIANCE_REASON_CODES = [
  'receipt_archived',
  'identity_verified',
  'cin_valid',
  'awaiting_receipt',
  'entrusted_to_channel_manager',
  'external_verification_required',
  'alloggiati_sending',
  'selfie_awaited',
  'period_open',
  'connection_unverified',
  'evidence_missing',
  'deadline_overdue',
  'receipt_missing',
  'alloggiati_not_sent',
  'alloggiati_failed',
  'alloggiati_incomplete',
  'over_thirty_nights_not_sent',
  'short_stay_at_risk',
  'connection_inactive',
  'identity_missing',
  'operator_decision_required',
  'municipality_rate_missing',
  'credentials_refused',
  'cin_missing',
  'cin_invalid',
  'activation_incomplete',
  'guest_data_missing',
  'checkout_due',
  'property_ready_not_confirmed',
  'action_required',
] as const;

export interface ComplianceSummaryItem {
  id: string;
  label: string;
  action: ComplianceCockpitAction;
  /** Set for `ActivateProperty`, null otherwise. */
  propertyId: string | null;
  bookingId: string | null;
  /**
   * What the item still lacks, with stable codes (SR-03): the blockers of a property to activate (`field` is the step of the
   * wizard), the fields of the Alloggiati record that the guests of a stay lack, the single thing left for the others.
   * Absent on an API that does not send it yet.
   */
  missing?: DashboardMissing[];
  /**
   * When the item has to be done by (UTC), if the stay fixes it: the legal term of the Alloggiati communication, the day the
   * guest arrives (their data are needed by then), the day the guest leaves. Null for the others; absent on an API that does
   * not send it yet (the page then reads it from the Home's "Da fare", where it can).
   */
  dueAt?: string | null;
  light?: ComplianceLightName | null;
  reason?: string | null;
  /** The month (`yyyy-MM`) of an ISTAT or tourist tax item; null or absent for the others. */
  period?: string | null;
  /**
   * `Alloggiati` or `Istat` when the outcome is held only by the connected area and CasaZen has no proof of it (`HandoffTopic` of the backend, E03/F05):
   * the one signal that offers «Verifica nel tuo Cassetto Compliance» on the row, with this topic. Null or absent when none applies (a communication that
   * was never sent, a failure CasaZen knows, a month the host sends by hand): no action is offered. A server that does not send it offers none.
   */
  handoffTopic?: ComplianceHandoffTopic | null;
}

export interface ComplianceSummarySection {
  count: number;
  items: ComplianceSummaryItem[];
}

export interface ComplianceSummaryResult {
  propertiesPending: ComplianceSummarySection;
  guestCheckInsIncomplete: ComplianceSummarySection;
  checkoutsDue: ComplianceSummarySection;
  alloggiatiFailures: ComplianceSummarySection;
  /** Alloggiati communications the host must send on the Questura portal: CasaZen does not transmit (CO-11). */
  alloggiatiManualRequired: ComplianceSummarySection;
  turnoversPending: ComplianceSummarySection;
  identityPending?: ComplianceSummarySection;
  receiptsToUpload?: ComplianceSummarySection;
  manualSendsRequired?: ComplianceSummarySection;
  connectionsToFix?: ComplianceSummarySection;
  /** The ISTAT (`UploadIstatProof`) and tourist tax (`DeclareTouristTax`) of the closed months, with their `period`, and the rates that are not known (`EnterMunicipalityTaxRate`). */
  periodItems?: ComplianceSummarySection;
  ticinoNotifications?: ComplianceSummarySection;
  /**
   * The arrival days of the properties in the other cantons with an electronic duty (`Required`) whose guests are not notified to the cantonal authority yet (`NotifyGuestsAuthority`, the day
   * in `period`, yyyy-MM-dd; the deadline of the canton in `dueAt`, `null` where the sources give none: the screen says «scadenza non nota» and never a date of its own). Empty while
   * `Features:GuestRegistrationRegimes` is off.
   */
  swissNotifications?: ComplianceSummarySection;
}

export const CHECKOUT_WIZARD_STEPS = ['stay-summary', 'alloggiati', 'cleaning', 'tourist-tax', 'property-ready'] as const;
export type CheckoutWizardStepId = (typeof CHECKOUT_WIZARD_STEPS)[number];

interface CheckoutWizardStep {
  id: string;
  label: string;
  status: ComplianceStepStatus;
  blocker?: boolean;
  message?: string | null;
}

export type CheckoutCleaningChoice = 'Request' | 'Skip';

export const TOURIST_TAX_COLLECTIONS = ['CollectedOnline', 'CollectedAtProperty', 'NotCollected', 'NotDue'] as const;
export type TouristTaxCollection = (typeof TOURIST_TAX_COLLECTIONS)[number];

export interface CheckoutWizardState {
  bookingId: string;
  bookingStatus: string;
  currentStep: string;
  startedAt: string | null;
  completedAt: string | null;
  steps: CheckoutWizardStep[];
  stay: {
    guestName: string;
    propertyId: string;
    propertyName: string;
    propertyCity: string;
    checkInDate: string;
    checkOutDate: string;
    nights: number;
    numberOfGuests: number;
    numberOfAdults: number;
    numberOfChildren: number;
    arrivedAt: string | null;
    source: string;
    departureConfirmed: boolean;
  };
  alloggiati: {
    status: AlloggiatiWebStatus;
    sent: boolean;
    deadlineAt: string;
    isOverdue: boolean;
    dataComplete: boolean;
  };
  cleaning: {
    choice: CheckoutCleaningChoice | null;
    supplierOrgId: string | null;
    category: string | null;
    notes: string | null;
    requestId: string | null;
  };
  touristTax: {
    recordedAmount: number | null;
    currency: string;
    collectedWithOnlinePayment: boolean;
    collection: TouristTaxCollection | null;
  };
  propertyReady: {
    ready: boolean | null;
    readyAt: string | null;
    notes: string | null;
  };
}

export interface CheckoutWizardCompleteResult {
  propertyReady: boolean;
  bookingStatus: string;
  serviceRequestId: string | null;
  wizard: CheckoutWizardState;
}

type CheckoutResultElementId = 'departure' | 'channelManager' | 'alloggiati' | 'cleaning' | 'touristTax' | 'propertyReady';

export type CheckoutResultTone = 'done' | 'attention' | 'problem';

export interface CheckoutResultLine {
  element: CheckoutResultElementId;
  tone: CheckoutResultTone;
  text: string;
}

export interface CheckoutWizardStartCommand {
  registerArrival?: boolean;
}

export interface CheckoutWizardProgressCommand {
  currentStep: CheckoutWizardStepId;
  departureConfirmed: boolean;
  cleaningChoice: CheckoutCleaningChoice | null;
  supplierOrgId: string | null;
  serviceCategory: string | null;
  serviceNotes: string | null;
  touristTaxCollection: TouristTaxCollection | null;
  propertyReady: boolean | null;
  propertyNotes: string | null;
}

export interface CheckoutWizardCompleteCommand {
  confirmDeparture: boolean;
  supplierOrgId?: string | null;
  serviceNotes?: string | null;
  serviceCategory?: string | null;
  registerArrival?: boolean;
  cleaningChoice?: CheckoutCleaningChoice | null;
  touristTaxCollection?: TouristTaxCollection | null;
  /** True only when the host confirms the property is ready; otherwise it stays a turnover in the cockpit. */
  propertyReady?: boolean | null;
  propertyNotes?: string | null;
}
