import type {
  GuestRegistrationCertainty,
  GuestRegistrationChannel,
  GuestRegistrationDeadlineKind,
  GuestRegistrationDuty,
} from './guest-registration.types';

/** The formats of the file for the Ticino police portal: the official CSV model (default) or the official XML. */
export type TicinoFileFormat = 'csv' | 'xml';

/**
 * Body of `POST /properties/{id}/swiss/ticino-notification` (casazen/backend#979): the arrival day and the format of the file.
 * `confirmRegenerate` is the person's «yes» to a file of a day that is declared uploaded (or has a receipt) already, which the portal may take as
 * duplicates (E30/F02/US02/T01): without it such a day answers 409 `ticino_day_already_declared`.
 */
export interface TicinoNotificationRequest {
  reportDate: string;
  format: TicinoFileFormat;
  confirmRegenerate?: boolean;
}

/** What a row of the file stands for: one notified person, or the leader of a group of six or more with the others counted on the row (decision D11). */
type TicinoRowKind = 'guest' | 'group';

/** A person in the file, with the accompanying minors counted on them (14 to 17, under 14); the leader of a group counts the other members. */
export interface TicinoNotificationRow {
  bookingId: string;
  guestName: string;
  personsOver14: number;
  personsUnder14: number;
  kind: TicinoRowKind;
  /** The persons of the group, the leader included; 0 for a guest. */
  groupSize: number;
}

/**
 * A guest (or a whole stay, `position` null) left out of the file, with the codes of what they miss: `firstName`, `lastName`,
 * `birthDate`, `nationality`, `documentType`, `guests` (fewer guests recorded than the booking counts).
 */
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

/** An arrival day still to notify. */
interface TicinoPendingDay {
  day: string;
  stayCount: number;
  dueAt: string;
}

/** `GET /properties/{id}/swiss/ticino-notification?date=` (casazen/backend#979): one arrival day of a Ticino property. */
export interface TicinoNotificationDay {
  propertyId: string;
  day: string;
  /** The «Numero identificativo LEAR / NO-LEAR» of the property; null until entered (no file without it). */
  structureId: string | null;
  stayCount: number;
  rows: TicinoNotificationRow[];
  issues: TicinoNotificationIssue[];
  /** The XML can be written too; the CSV always can. */
  xmlAvailable: boolean;
  /** Receipts of the portal recorded for the day: one or more means the day is notified. */
  receiptCount: number;
  dueAt: string;
  /** The reference of the file of the day, recorded with its receipt. */
  reference: string;
  portalUrl: string;
  pendingDays: TicinoPendingDay[];
  warnings: TicinoStayWarning[];
  /** The character set of the CSV (`windows-1252` or `utf-8`). */
  csvCharset: string;
  /** The characters of the names that the character set cannot hold: the CSV writes them without their accent (E30/F01/US01/T01, NF-126). */
  transliteratedCount: number;
  /** When a person declared the day uploaded to the portal (UTC); null while nobody did. */
  declaredAt: string | null;
  /** Who declared it (first and last name); null while nobody did, and when the account no longer exists. */
  declaredBy: string | null;
  /** When the file of the day was generated last (UTC); null when it never was. */
  fileGeneratedAt: string | null;
  /** How many times the file of the day was generated: more than one is the risk of duplicates on the portal. */
  fileGeneratedCount: number;
  /** The day is closed: it is declared, or has a receipt. A new file of it needs `confirmRegenerate`. */
  alreadyDeclared: boolean;
}

/** Body of `POST /properties/{id}/swiss/ticino-notification/declare` (E30/F02/US02/T01): the arrival day and, when there is one, the `Police` receipt recorded for it. */
export interface DeclareTicinoDayRequest {
  arrivalDay: string;
  receiptId?: string | null;
}

/** The declaration of an arrival day, as the API answers every repeat of the call: it holds no guest data. */
export interface TicinoDeclaration {
  propertyId: string;
  arrivalDay: string;
  declaredAt: string;
  declaredBy: string | null;
  receiptId: string | null;
  /** True when this call recorded the declaration; false when the day was declared already (by this person or a co-host). */
  created: boolean;
}

/**
 * What a document of the Swiss archive is (`SwissComplianceFileType` of the backend): the page the portal gives back for the file of a day (`Police`), the written
 * authorization of the parents of minors without an adult and the sheet of a group of six or more, the last two kept five years (decision D11).
 */
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

/**
 * The assisted notification of a canton other than Ticino (E31/F02/US02/T02, NF-131, casazen/backend#979): CasaZen prepares the data of the guests of an arrival day as data ready to copy
 * onto the official portal and says when it is due; the host notifies and declares the day. Nothing is transmitted (decision D1). The enums are the names of the regime catalog, as in
 * `guest-registration.types.ts`; a value this version does not know is possible at run time and reads as a neutral line.
 */

/** The kind of document of a guest as the day sends it: `passport`, `identityCard` or `other`. */
export type SwissDocumentKind = 'passport' | 'identityCard' | 'other';

/**
 * A guest of the day as the host copies it onto the portal: what the check-in recorded and nothing else (no exemption, no photograph of the document, no contact of the booker).
 * A field that is not there is `null`. It holds personal data: it comes with `guest.read` and is never cached for long.
 */
export interface SwissNotificationGuest {
  bookingId: string;
  /** The code of the booking as hosts read it (`XXXXX-XXXXX`). */
  bookingCode: string | null;
  /** The order of the guest in the stay, from 0. */
  position: number;
  /** The arrival and the departure day of the stay (`yyyy-MM-dd`). */
  arrival: string;
  departure: string;
  firstName: string | null;
  lastName: string | null;
  /** `yyyy-MM-dd`. */
  birthDate: string | null;
  /** The comune of birth (born in Italy) or the country of birth (born abroad), as entered. */
  placeOfBirth: string | null;
  /** The nationality as the guest entered it, and as ISO 3166-1 alpha-3 where CasaZen can tell it. */
  nationality: string | null;
  nationalityCode: string | null;
  documentType: string | null;
  documentNumber: string | null;
  street: string | null;
  postalCode: string | null;
  city: string | null;
  /** The country of the home as ISO alpha-3. */
  residenceCountryCode: string | null;
  /** The plate of the car of the stay. */
  plate: string | null;
}

/**
 * A guest (or a whole stay, `position` null) that still lacks something, with the codes of what it lacks: `firstName`, `lastName`, `birthDate`, `nationality`, `documentType`,
 * `guests` (fewer guests recorded than the booking counts).
 */
interface SwissNotificationIssue {
  bookingId: string;
  position: number | null;
  guestName: string;
  missing: string[];
}

/** An arrival day still to notify; `dueAt` is `null` where the canton has no deadline in the sources. */
interface SwissPendingDay {
  day: string;
  stayCount: number;
  dueAt: string | null;
}

/**
 * `GET /properties/{id}/swiss/notification-day?date=` (`Features:GuestRegistrationRegimes`): one arrival day of a property in a canton other than Ticino whose authority asks for an
 * electronic notification, with the regime in short (where, how, how sure the source is) and the deadline.
 */
export interface SwissNotificationDay {
  propertyId: string;
  day: string;
  /** The regime of the place of the property (`CH-SH`). */
  regimeCode: string;
  cantonCode: string | null;
  /** The official portal where the host notifies; `null` where the canton has none (a paper form, an e-mailed file). */
  portalUrl: string | null;
  channel: GuestRegistrationChannel;
  deadlineKind: GuestRegistrationDeadlineKind;
  /** The sentence (in the language of the request) that says what the deadline is when its kind alone does not. */
  deadlineNote: string | null;
  certainty: GuestRegistrationCertainty;
  /** The duty CasaZen treats as in effect: only `Required` raises the day in the cockpit and in the alerts. */
  effectiveDuty: GuestRegistrationDuty;
  /** The stays that arrive on the day and owe a notification. */
  stayCount: number;
  guests: SwissNotificationGuest[];
  issues: SwissNotificationIssue[];
  /** The deadline (UTC); `null` where the canton has none: a deadline is never guessed, the screen says it is not known. */
  dueAt: string | null;
  /** When a person of the org declared the day notified (UTC); `null` while nobody did. */
  declaredAt: string | null;
  /** Who declared it (first and last name); `null` while nobody did, and when the account no longer exists. */
  declaredBy: string | null;
  /** The day is closed: it is declared, so the cockpit and the alerts no longer list it. */
  alreadyDeclared: boolean;
  /** The days of the property still to notify (of the last 14), oldest first; empty unless the duty is `Required`. */
  pendingDays: SwissPendingDay[];
}

/** Body of `POST /properties/{id}/swiss/notification-declare`: the arrival day the host notified to the authority. */
export interface DeclareSwissDayRequest {
  arrivalDay: string;
}

/** The declaration of an arrival day, as the API answers every repeat of the call: it holds no guest data. */
export interface SwissDeclaration {
  propertyId: string;
  arrivalDay: string;
  regimeCode: string;
  declaredAt: string;
  declaredBy: string | null;
  /** True when this call recorded the declaration; false when the day was declared already (by this person or a co-host). */
  created: boolean;
}
