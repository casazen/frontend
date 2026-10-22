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

/** One import feed of `GET /api/properties/calendar-overview` (SR-10b): the state `ical-feeds` gives, never the URL. */
export interface CalendarOverviewFeed {
  feedId: string;
  channel: PropertyIcalFeedChannel;
  label?: string | null;
  lastImportAt?: string | null;
  lastImportStatus?: PropertyIcalImportStatus | null;
  /** Stable code of the last sync error (`ical_unreachable`, ...), translated by the frontend. */
  lastErrorCode?: string | null;
  /** Backend-localized text of `lastErrorCode`, used only when the frontend has no translation for the code. */
  lastError?: string | null;
  /** A sync of the feed is queued or running. */
  syncing: boolean;
}

/**
 * One active short-rent property of the overview. `exportUrl` is the link the host pastes on the portals, a secret in practice
 * (whoever has it sees the dates taken); it is null until the link was first asked for (`GET .../ical/export-url` creates it).
 */
export interface CalendarOverviewProperty {
  propertyId: string;
  propertyName: string;
  exportUrl?: string | null;
  feeds: CalendarOverviewFeed[];
}

/** The calendars of all the host's properties in one read, with what the page may say about the sync (it promises nothing of its own). */
export interface CalendarOverview {
  /** Minutes between two rounds of the job that syncs every feed. */
  syncEveryMinutes: number;
  /** A feed whose last try is older than this many minutes has not been synced for a while: "Da ricontrollare". */
  staleAfterMinutes: number;
  properties: CalendarOverviewProperty[];
}
