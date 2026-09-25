import type { TouristTaxRateRule, TouristTaxRateVerification } from '@/types/tourist-tax.types';

export type PropertyComplianceStatus = 'Pending' | 'Active' | 'Suspended';

export type ComplianceStepStatus = 'pending' | 'complete' | 'warning';

export interface ComplianceWizardStep {
  id: string;
  label: string;
  status: ComplianceStepStatus;
  blocker: boolean;
  message?: string | null;
  /** External guidance link of the step (CIN: configured on the backend). */
  linkUrl?: string | null;
  /** Only on the `tourist-tax` step. */
  touristTax?: ActivationTouristTax | null;
  /** What keeps this blocking step incomplete, with stable codes (e.g. `safety_gas_detector_missing`). */
  blockers?: ActivationBlocker[];
}

/** One reason why the activation is blocked: stable code, localized message from the API. */
export interface ActivationBlocker {
  step: string;
  code: string;
  message: string;
}

/** Tourist tax of the property's comune in the activation wizard: a warning, never a blocker. */
export interface ActivationTouristTax {
  city: string;
  /** Rate in force today, or null when CasaZen has no rate for the comune. */
  rate: ActivationTouristTaxRate | null;
  /** Slug of the public page `/p/tassa-soggiorno/:comune`, only when it exists. */
  publicPageSlug: string | null;
  /** True when the comune has rates only per accommodation category, unknown for the property (BK-03). */
  categoryRequired?: boolean;
}

export interface ActivationTouristTaxRate extends TouristTaxRateRule {
  effectiveFrom: string;
  effectiveTo: string | null;
  sourceUrl: string | null;
  verificationLevel: TouristTaxRateVerification | null;
}

export interface ComplianceActivationResult {
  complianceStatus: PropertyComplianceStatus;
  steps: ComplianceWizardStep[];
}

/** 200 of `POST .../activation/complete`: the property is active (blocking steps left answer 409). */
export interface ComplianceActivationCompleteResult {
  complianceStatus: PropertyComplianceStatus;
  incompleteBlockers?: string[] | null;
}

/** Body of the 409 `property_activation_blocked` of `POST .../activation/complete` (CO-07). */
export interface ActivationBlockedProblem {
  complianceStatus: PropertyComplianceStatus | null;
  /** Ids of the blocking steps left. */
  incompleteBlockers: string[];
  /** Every blocker with its step and stable code. */
  blockers: ActivationBlocker[];
}

/** The safety checklist is saved on its own endpoint (CO-07), never with the activation. */
export interface CompletePropertyActivationCommand {
  tosAccepted?: boolean;
}

// ─── D.L. 145/2023 art. 13-ter safety checklist (CO-07) ──────────────────────

/** Items in display order; ids of `.claude/context/regulations/sicurezza.md` in the comments. */
export const SAFETY_ITEM_CODES = [
  'FireExtinguishers', // SC-02
  'GasDetector', // SC-04
  'CoDetector', // SC-05
  'SystemsCompliance', // SC-06
  'BdsrDeclaration', // SC-07
  'SmokeDetector', // SC-F1, recommended
  'EmergencyInstructions', // SC-F2, recommended
] as const;
export type SafetyItemCode = (typeof SAFETY_ITEM_CODES)[number];

export const COMBUSTION_APPLIANCES = ['Boiler', 'WaterHeater', 'GasHob', 'Stove', 'Fireplace', 'Other'] as const;
export type CombustionAppliance = (typeof COMBUSTION_APPLIANCES)[number];

export const SAFETY_DETECTOR_TYPES = ['Battery', 'Mains', 'FixedSystem'] as const;
export type SafetyDetectorType = (typeof SAFETY_DETECTOR_TYPES)[number];

/** Stored answer; `ToReview` only comes from the old checklist and is never sent. */
export type SafetyItemAnswer = 'Present' | 'Missing' | 'ToReview';
export type SafetyItemRequirement = 'Required' | 'Optional' | 'NotApplicable' | 'Undetermined';
export type SafetyItemStatus = 'Present' | 'Missing' | 'NotAnswered' | 'ToReview' | 'NotApplicable';
export type SafetyNotApplicableReason = 'NoGasNoCombustion' | 'NotEntrepreneurial';

export interface SafetyChecklistFacts {
  entrepreneurial: boolean | null;
  hasGasSupply: boolean | null;
  /** null = not answered, [] = no combustion appliance. */
  combustionAppliances: CombustionAppliance[] | null;
  floorCount: number | null;
  /** m² of floor of each floor of the unit, in order; null when not given. */
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
  /** yyyy-MM-dd */
  checkedOn: string | null;
  /** yyyy-MM-dd */
  expiresOn: string | null;
  evidenceDocumentId: string | null;
  evidenceFileName: string | null;
  notes: string | null;
}

export interface SafetyChecklistIssue {
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
  /** "Not applicable" is never sent: it follows from the facts. */
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
  /** Final confirmation of these answers by the host (SC-08). */
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
] as const;
export type ComplianceCockpitAction = (typeof COMPLIANCE_COCKPIT_ACTIONS)[number];

export interface ComplianceSummaryItem {
  /** Target of the action: equal to `propertyId` or `bookingId`. */
  id: string;
  label: string;
  action: ComplianceCockpitAction;
  /** Set for `ActivateProperty`, null otherwise. */
  propertyId: string | null;
  /** Set for every action on a booking, null for `ActivateProperty`. */
  bookingId: string | null;
}

export interface ComplianceSummarySection {
  count: number;
  items: ComplianceSummaryItem[];
}

export interface ComplianceSummaryResult {
  propertiesPending: ComplianceSummarySection;
  guestCheckInsIncomplete: ComplianceSummarySection;
  checkoutsDue: ComplianceSummarySection;
  /** Alloggiati communications in error or rejected. */
  alloggiatiFailures: ComplianceSummarySection;
  /** Alloggiati communications the host must send on the Questura portal: CasaZen does not transmit (CO-11). */
  alloggiatiManualRequired: ComplianceSummarySection;
}

export interface CheckoutWizardStep {
  id: string;
  label: string;
  status: ComplianceStepStatus;
}

export interface CheckoutSupplierOption {
  orgId: string;
  legalName: string;
  category?: string | null;
}

export interface CheckoutWizardStartResult {
  steps: CheckoutWizardStep[];
  suppliers?: CheckoutSupplierOption[];
}

export interface CheckoutWizardCompleteResult {
  propertyReady: boolean;
  bookingStatus: string;
}

/** Body of `POST /bookings/:id/checkout-wizard/start` (CO-08). */
export interface CheckoutWizardStartCommand {
  /** The host confirms that the guest arrived: registers the arrival of a confirmed booking first. */
  registerArrival?: boolean;
}

export interface CheckoutWizardCompleteCommand {
  confirmDeparture: boolean;
  supplierOrgId?: string | null;
  serviceNotes?: string | null;
  /** The host confirms that the guest arrived: registers the arrival with the check-out. */
  registerArrival?: boolean;
}
