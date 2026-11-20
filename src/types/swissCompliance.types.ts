/** The formats of the file for the Ticino police portal: the official CSV model (default) or the official XML. */
export type TicinoFileFormat = 'csv' | 'xml';

/** Body of `POST /properties/{id}/swiss/ticino-notification` (casazen/backend#979): the arrival day and the format of the file. */
export interface TicinoNotificationRequest {
  reportDate: string;
  format: TicinoFileFormat;
}

/** A person in the file, with the accompanying minors counted on them (14 to 17, under 14). */
interface TicinoNotificationRow {
  bookingId: string;
  guestName: string;
  personsOver14: number;
  personsUnder14: number;
}

/**
 * A guest (or a whole stay, `position` null) left out of the file, with the codes of what they miss: `firstName`, `lastName`,
 * `birthDate`, `nationality`, `documentType`, `guests` (fewer guests recorded than the booking counts).
 */
export interface TicinoNotificationIssue {
  bookingId: string;
  position: number | null;
  guestName: string;
  missing: string[];
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
}

export interface UploadSwissReceiptForm {
  type: string;
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
