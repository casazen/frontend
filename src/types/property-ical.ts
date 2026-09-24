/** Channel of an iCal import feed (backend `ICalFeedChannel`). */
export type PropertyIcalFeedChannel = 'Airbnb' | 'BookingCom' | 'Other';

/** Sync state of a feed (backend `PropertyICalImportStatus`). */
export type PropertyIcalImportStatus = 'Success' | 'PartialFailure' | 'Failure' | 'Syncing';

/**
 * One iCal import feed of a property (PC-11): a property links as many as the host has (Airbnb, Booking.com, ...).
 * The URL is never returned, only `maskedImportUrl` (host and last characters).
 */
export interface PropertyIcalFeed {
  id: string;
  channel: PropertyIcalFeedChannel;
  label?: string | null;
  maskedImportUrl?: string | null;
  createdAt: string;
  lastImportAt?: string | null;
  lastImportStatus?: PropertyIcalImportStatus | null;
  /** Stable code of the last sync error (`ical_unreachable`, ...), translated by the frontend. */
  lastErrorCode?: string | null;
  /** Backend-localized text of `lastErrorCode`, used only when the frontend has no translation for the code. */
  lastError?: string | null;
  blockCount: number;
}

export interface PropertyIcalStatus {
  exportUrl: string;
  blockCount: number;
  feeds: PropertyIcalFeed[];
}

export interface PropertyIcalExportUrl {
  exportUrl: string;
}

export interface PropertyIcalFeedCreateRequest {
  channel: PropertyIcalFeedChannel;
  label?: string;
  importUrl: string;
}
