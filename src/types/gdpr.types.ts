/** Categories of guest data with their own retention period (API enum `GuestDataCategory`, CO-15). */
export type GuestDataCategory = 'DocumentScans' | 'AlloggiatiData' | 'Marketing' | 'FiscalData';

/** What a privacy event is about (API enum `GuestConsentPurpose`). */
export type GuestConsentPurpose = 'PrivacyNotice' | 'Marketing';

/** What happened (API enum `GuestConsentAction`): a notice is only presented, never "accepted". */
export type GuestConsentAction = 'NoticePresented' | 'Granted' | 'Withdrawn' | 'Expired';

/** Who recorded the event (API enum `GuestConsentSource`). */
export type GuestConsentSource = 'GuestPortal' | 'HostOnGuestRequest' | 'RetentionPolicy';

export const GUEST_DATA_CATEGORIES: readonly GuestDataCategory[] = ['DocumentScans', 'AlloggiatiData', 'Marketing', 'FiscalData'];

/** Retention of one category for a guest, computed by the API from `Gdpr:Retention` (never a default in code). */
export interface GuestRetentionScheduleItem {
  category: GuestDataCategory;
  /** False when the period or its source is missing: nothing of this category is deleted automatically. */
  configured: boolean;
  years?: number | null;
  months?: number | null;
  days?: number | null;
  source?: string | null;
  referenceDate?: string | null;
  /** Day from which the nightly job applies the period. */
  dueDate?: string | null;
  appliedAt?: string | null;
}

/** A privacy event as the host sees it (no IP address). */
export interface GuestConsentHistoryItem {
  purpose: GuestConsentPurpose;
  action: GuestConsentAction;
  version: string;
  source: GuestConsentSource;
  recordedAt: string;
  note?: string | null;
}

/** `GET /api/gdpr/guests/{id}` (API `GuestPrivacySummary`). */
export interface GuestPrivacySummary {
  guestId: string;
  marketing: { granted: boolean; since?: string | null; version: string };
  privacyNotice: { version: string; presentedAt?: string | null };
  consentHistory: GuestConsentHistoryItem[];
  retention: GuestRetentionScheduleItem[];
  anonymizedAt?: string | null;
  alloggiatiDataErasedAt?: string | null;
  isDeleted: boolean;
  deletedAt?: string | null;
  hasDocumentScan: boolean;
  /** While true, erasure and anonymization answer 409 (the Alloggiati obligation of the stay is still open). */
  hasOpenBookings: boolean;
}

/** `GET /api/gdpr/guests/{id}/export`: versioned JSON (`schemaVersion`) handed to the guest as it is. */
export interface GuestDataExport {
  schemaVersion: string;
  exportedAt: string;
  [section: string]: unknown;
}
