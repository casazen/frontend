export type PropertyIcalFeedChannel = 'Airbnb' | 'BookingCom' | 'Other';

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
  lastErrorCode?: string | null;
  lastError?: string | null;
  blockCount: number;
  deprecated?: boolean;
  deprecatedAt?: string | null;
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

export interface CalendarOverviewFeed {
  feedId: string;
  channel: PropertyIcalFeedChannel;
  label?: string | null;
  lastImportAt?: string | null;
  lastImportStatus?: PropertyIcalImportStatus | null;
  lastErrorCode?: string | null;
  lastError?: string | null;
  syncing: boolean;
}

interface CalendarOverviewProperty {
  propertyId: string;
  propertyName: string;
  exportUrl?: string | null;
  feeds: CalendarOverviewFeed[];
}

export interface CalendarOverview {
  syncEveryMinutes: number;
  staleAfterMinutes: number;
  properties: CalendarOverviewProperty[];
}
