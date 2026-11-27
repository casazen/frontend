import type {
  GuestRegistrationCertainty,
  GuestRegistrationChannel,
  GuestRegistrationDeadlineKind,
  GuestRegistrationDuty,
} from './guest-registration.types';

export type TicinoFileFormat = 'csv' | 'xml';

export interface TicinoNotificationRequest {
  reportDate: string;
  format: TicinoFileFormat;
  confirmRegenerate?: boolean;
}

type TicinoRowKind = 'guest' | 'group';

export interface TicinoNotificationRow {
  bookingId: string;
  guestName: string;
  personsOver14: number;
  personsUnder14: number;
  kind: TicinoRowKind;
  groupSize: number;
}

interface TicinoNotificationIssue {
  bookingId: string;
  position: number | null;
  guestName: string;
  missing: string[];
}

/**
 * What the file alone does not settle for a stay (decision D11): `parental_authorization_needed` (minors without an adult: the written authorization of
 * the parents, filed as the receipt type `ParentalAuthorization`) and `group_sheet_incomplete` (a member of a group misses a name or a nationality). A
 * stay may be in the file and still have a warning.
 */
interface TicinoStayWarning {
  bookingId: string;
  code: string;
}

interface TicinoPendingDay {
  day: string;
  stayCount: number;
  dueAt: string;
}

export interface TicinoNotificationDay {
  propertyId: string;
  day: string;
  structureId: string | null;
  stayCount: number;
  rows: TicinoNotificationRow[];
  issues: TicinoNotificationIssue[];
  xmlAvailable: boolean;
  receiptCount: number;
  dueAt: string;
  reference: string;
  portalUrl: string;
  pendingDays: TicinoPendingDay[];
  warnings: TicinoStayWarning[];
  csvCharset: string;
  transliteratedCount: number;
  declaredAt: string | null;
  declaredBy: string | null;
  fileGeneratedAt: string | null;
  fileGeneratedCount: number;
  alreadyDeclared: boolean;
}

export interface DeclareTicinoDayRequest {
  arrivalDay: string;
  receiptId?: string | null;
}

export interface TicinoDeclaration {
  propertyId: string;
  arrivalDay: string;
  declaredAt: string;
  declaredBy: string | null;
  receiptId: string | null;
  created: boolean;
}

export type SwissReceiptType = 'Police' | 'ParentalAuthorization' | 'GroupSheet';

export interface UploadSwissReceiptForm {
  type: SwissReceiptType;
  reportDate: string;
  reference: string;
  file: File;
}

export interface SwissReceiptResponse {
  id: string;
  propertyId: string;
  type: string;
  reportDate: string;
  reference: string;
  fileHash: string;
  uploadedAt: string;
}

export type SwissDocumentKind = 'passport' | 'identityCard' | 'other';

/**
 * A guest of the day as the host copies it onto the portal: what the check-in recorded and nothing else (no exemption, no photograph of the document, no contact of the booker).
 * A field that is not there is `null`. It holds personal data: it comes with `guest.read` and is never cached for long.
 */
export interface SwissNotificationGuest {
  bookingId: string;
  bookingCode: string | null;
  position: number;
  arrival: string;
  departure: string;
  firstName: string | null;
  lastName: string | null;
  birthDate: string | null;
  placeOfBirth: string | null;
  nationality: string | null;
  nationalityCode: string | null;
  documentType: string | null;
  documentNumber: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  residenceCountryCode: string | null;
  plate: string | null;
}

interface SwissNotificationIssue {
  bookingId: string;
  position: number | null;
  guestName: string;
  missing: string[];
}

interface SwissPendingDay {
  day: string;
  stayCount: number;
  dueAt: string | null;
}

export interface SwissNotificationDay {
  propertyId: string;
  day: string;
  regimeCode: string;
  cantonCode: string | null;
  portalUrl: string | null;
  channel: GuestRegistrationChannel;
  deadlineKind: GuestRegistrationDeadlineKind;
  deadlineNote: string | null;
  certainty: GuestRegistrationCertainty;
  effectiveDuty: GuestRegistrationDuty;
  stayCount: number;
  guests: SwissNotificationGuest[];
  issues: SwissNotificationIssue[];
  dueAt: string | null;
  declaredAt: string | null;
  declaredBy: string | null;
  alreadyDeclared: boolean;
  /** The days of the property still to notify (of the last 14), oldest first; empty unless the duty is `Required`. */
  pendingDays: SwissPendingDay[];
}

export interface DeclareSwissDayRequest {
  arrivalDay: string;
}

export interface SwissDeclaration {
  propertyId: string;
  arrivalDay: string;
  regimeCode: string;
  declaredAt: string;
  declaredBy: string | null;
  created: boolean;
}
