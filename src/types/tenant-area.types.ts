import type { RentLedgerComponent } from './rent.types';

type TenantAccessRole = 'TenantPrimary' | 'Tenant';

type TenantDeclarationStatus = 'Submitted' | 'Verified' | 'Rejected' | 'Superseded';

export type TenantMaintenanceStatus =
  | 'Sent'
  | 'InReview'
  | 'NeedsInfo'
  | 'Accepted'
  | 'InProgress'
  | 'Closed'
  | 'Rejected';

export type TenantMaintenanceUrgency = 'Normal' | 'High' | 'Emergency';

export interface TenantContractSummary {
  id: string;
  label: string;
  propertyName: string;
  role: TenantAccessRole;
  status: string;
}

export interface TenantProperty {
  id: string;
  name: string;
  address: string | null;
}

export interface TenantContract {
  id: string;
  label: string;
  status: string;
  startDate: string | null;
  endDate: string | null;
  role: TenantAccessRole;
}

export interface TenantBankDetails {
  accountHolder: string;
  iban: string;
  amount: number;
  dueDate: string;
  reference: string;
}

export interface TenantPaymentDeclaration {
  id: string;
  status: TenantDeclarationStatus;
  amount: number;
  transferDate: string;
  submittedAt: string;
  bankReference: string | null;
}

export interface TenantDue {
  id: string;
  periodStart: string;
  periodEnd: string;
  dueDate: string;
  currency: string;
  amount: number;
  amountPaid: number | null;
  residual: number | null;
  status: string;
  isOverdue: boolean;
  components: RentLedgerComponent[] | null;
  bank: TenantBankDetails | null;
  declaration: TenantPaymentDeclaration | null;
}

type TenantDocumentKind = 'Budget' | 'Settlement' | 'Statement' | 'Report' | 'Other';

export interface TenantDocument {
  id: string;
  name: string;
  kind: TenantDocumentKind | string;
  sharedAt: string | null;
  accepted?: boolean;
}

interface TenantEmergencyContact {
  name: string;
  phone: string;
}

export interface TenantEmergency {
  instructions: string | null;
  contacts: TenantEmergencyContact[];
}

interface TenantCondominiumReport {
  id: string; periodLabel: string; periodEnd: string; recoverable: number; advances: number; prior: number; balance: number;
}
export interface TenantContractArea {
  condominiumReports?: TenantCondominiumReport[];
  contract: TenantContract;
  property: TenantProperty;
  dues: TenantDue[];
  documents: TenantDocument[];
  emergency: TenantEmergency | null;
  maintenanceCategories: string[];
}

export interface TenantMaintenanceUpdate {
  id: string;
  at: string;
  text: string;
}

interface TenantMaintenanceAttachment {
  id: string;
  name: string;
}

export interface TenantMaintenanceRequest {
  id: string;
  category: string;
  urgency: TenantMaintenanceUrgency | string;
  description: string;
  submittedAt: string;
  status: TenantMaintenanceStatus;
  updates: TenantMaintenanceUpdate[];
  attachments: TenantMaintenanceAttachment[];
}

export interface TenantPaymentDeclarationInput {
  amount: number;
  transferDate: string;
  bankReference?: string;
  note?: string;
  receipt?: File | null;
}
