type GuestDataCategory = 'DocumentScans' | 'AlloggiatiData' | 'Marketing' | 'FiscalData';

type GuestConsentPurpose = 'PrivacyNotice' | 'Marketing';

type GuestConsentAction = 'NoticePresented' | 'NoticeAcknowledged' | 'Granted' | 'Withdrawn' | 'Expired';

type GuestConsentSource = 'GuestPortal' | 'HostOnGuestRequest' | 'RetentionPolicy';

/** Retention of one category for a guest, computed by the API from `Gdpr:Retention` (never a default in code). */
export interface GuestRetentionScheduleItem {
  category: GuestDataCategory;
  configured: boolean;
  years?: number | null;
  months?: number | null;
  days?: number | null;
  source?: string | null;
  referenceDate?: string | null;
  dueDate?: string | null;
  appliedAt?: string | null;
}

export interface GuestConsentHistoryItem {
  purpose: GuestConsentPurpose;
  action: GuestConsentAction;
  version: string;
  source: GuestConsentSource;
  recordedAt: string;
  note?: string | null;
}

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
