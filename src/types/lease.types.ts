export type LeaseStatus =
  | 'Draft'
  | 'AwaitingSignature'
  | 'PartiallySigned'
  | 'Signed'
  | 'RegistrationPending'
  | 'SentToProvider'
  | 'Registered'
  | 'Rejected';

export type FiscalRegime = 'CedolareSecca' | 'RegimeOrdinario' | 'CanoneConcordato';

export type PartyRole = 'Landlord' | 'Tenant';

export type RegistrationStatus = 'Pending' | 'SentToProvider' | 'Registered' | 'Failed';

export interface LeaseParty {
  id: string;
  role: PartyRole;
  firstName: string;
  lastName: string;
  fiscalCode: string;
  citizenship: string;
  contactEmail: string;
  isExtraEU: boolean;
}

export interface LeaseEvent {
  eventType: string;
  occurredAt: string;
}

export interface LeaseRegistration {
  id: string;
  leaseContractId: string;
  status: RegistrationStatus;
  externalRegistrationId?: string | null;
  registrationCode?: string | null;
  submittedAt?: string | null;
  confirmedAt?: string | null;
}

export interface LeasePropertySummary {
  id: string;
  name: string;
  city?: string;
}

export interface LeaseContract {
  id: string;
  propertyId: string;
  status: LeaseStatus;
  fiscalRegime: FiscalRegime;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  registrationDeadline: string;
  signedPdfStoragePath?: string | null;
  parties: LeaseParty[];
  registration?: LeaseRegistration | null;
  events?: LeaseEvent[];
  hasExtraEUTenant?: boolean;
  property?: LeasePropertySummary | null;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLeasePartyDto {
  role: PartyRole;
  firstName: string;
  lastName: string;
  fiscalCode: string;
  citizenship: string;
  contactEmail: string;
}

export interface CreateLeaseDto {
  propertyId: string;
  fiscalRegime: FiscalRegime;
  startDate: string;
  endDate: string;
  monthlyRent: number;
  parties: CreateLeasePartyDto[];
}

export interface SignerInfo {
  partyId: string;
  role: PartyRole;
  name: string;
  signingUrl: string;
  expiresAt: string;
}

export interface SigningInitiatedResult {
  leaseId: string;
  status: LeaseStatus;
  signers: SignerInfo[];
}

export interface TriggerRegistrationResult {
  leaseId: string;
  registrationStatus: RegistrationStatus;
  message: string;
}
