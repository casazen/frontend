export type PropertyComplianceStatus = 'Pending' | 'Active' | 'Suspended';

export type ComplianceStepStatus = 'pending' | 'complete' | 'warning';

export interface ComplianceWizardStep {
  id: string;
  label: string;
  status: ComplianceStepStatus;
  blocker: boolean;
  message?: string | null;
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
  alloggiatiFailures: ComplianceSummarySection;
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
