import type { TouristTaxRateVerification } from '@/types/tourist-tax.types';

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
}

/** Tourist tax of the property's comune in the activation wizard: a warning, never a blocker. */
export interface ActivationTouristTax {
  city: string;
  /** Rate in force today, or null when CasaZen has no rate for the comune. */
  rate: ActivationTouristTaxRate | null;
  /** Slug of the public page `/p/tassa-soggiorno/:comune`, only when it exists. */
  publicPageSlug: string | null;
}

export interface ActivationTouristTaxRate {
  ratePerPersonPerNight: number;
  maxNights: number | null;
  minimumAge: number;
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
  incompleteBlockers: string[];
}

export interface PropertySafetyChecklist {
  smokeDetector: boolean;
  fireExtinguisher: boolean;
  gasCompliance: boolean;
  acknowledgedAt?: string | null;
  acknowledgedBy?: string | null;
}

export interface CompletePropertyActivationCommand {
  safetyChecklist?: PropertySafetyChecklist;
  tosAccepted?: boolean;
}

export interface ComplianceSummaryItem {
  id?: string | null;
  label: string;
  routeLink: string;
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

export interface CheckoutWizardCompleteCommand {
  confirmDeparture: boolean;
  supplierOrgId?: string | null;
  serviceNotes?: string | null;
}
