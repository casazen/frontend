export const PROPERTY_ROOM_TYPES = ['Bedroom', 'LivingRoom', 'Studio', 'Other'] as const;
export type PropertyRoomType = (typeof PROPERTY_ROOM_TYPES)[number];

export const BED_TYPES = ['Single', 'Double', 'Queen', 'King', 'SofaBed', 'Bunk', 'Crib'] as const;
export type BedType = (typeof BED_TYPES)[number];

export interface RoomBed {
  type: BedType;
  count: number;
}

export interface PropertyRoom {
  id: string;
  position: number;
  type: PropertyRoomType;
  beds: RoomBed[];
}

export interface PropertyRoomInput {
  id?: string | null;
  type: PropertyRoomType;
  beds: RoomBed[];
}

export interface StayDiscountTier {
  minNights: number;
  percentOff: number;
}

export const LISTING_LANGUAGES = ['it', 'en', 'fr', 'es', 'de', 'ru', 'pt', 'nl', 'ja', 'el', 'tr', 'zh', 'ca', 'ro'] as const;
export type ListingLanguage = (typeof LISTING_LANGUAGES)[number];

export type TextOrigin = 'UserWritten' | 'AutoTranslated' | 'ModifiedAfterTranslation';

export interface ListingTexts {
  title?: string | null;
  description?: string | null;
  spaces?: string | null;
  access?: string | null;
  neighborhood?: string | null;
  transport?: string | null;
  rules?: string | null;
}

interface SiteProfileText {
  it: string;
  en?: string | null;
  others?: Record<string, string | null> | null;
}

interface SiteProfileHighlight {
  icon: string;
  title: SiteProfileText;
  text?: SiteProfileText | null;
}

/**
 * The site profile of a property as `GET api/properties/{id}/site-profile` gives it and as the save answers. Besides the facts of the
 * booking site it carries, since NF-31, the `translations` of the listing (by language code; Italian only for the transport, its other
 * texts are the columns of the property) and the `origins` of each of them (key `"<language>.<field>"`, `fr.title`).
 */
export interface SiteProfile {
  propertyId: string;
  floorLevel: number | null;
  renovatedYear: number | null;
  energyClass: string | null;
  energyIndex: number | null;
  areaKind: string | null;
  childrenWelcome: boolean | null;
  checkInTo: string | null;
  videoUrl: string | null;
  videoProvider?: string | null;
  tourUrl: string | null;
  zone: SiteProfileText | null;
  near: SiteProfileText | null;
  floorNote: SiteProfileText | null;
  outdoorNote: SiteProfileText | null;
  checkInMethod: SiteProfileText | null;
  rulesNote: SiteProfileText | null;
  highlights: SiteProfileHighlight[];
  safetyNotes: SiteProfileText[];
  tags: string[];
  derivedTags?: string[];
  translations: Record<string, ListingTexts>;
  origins: Record<string, TextOrigin>;
  updatedAt?: string;
}

export interface SiteProfileRequest {
  floorLevel: number | null;
  renovatedYear: number | null;
  energyClass: string | null;
  energyIndex: number | null;
  areaKind: string | null;
  childrenWelcome: boolean | null;
  checkInTo: string | null;
  videoUrl: string | null;
  tourUrl: string | null;
  zone: SiteProfileText | null;
  near: SiteProfileText | null;
  floorNote: SiteProfileText | null;
  outdoorNote: SiteProfileText | null;
  checkInMethod: SiteProfileText | null;
  rulesNote: SiteProfileText | null;
  highlights: SiteProfileHighlight[];
  safetyNotes: SiteProfileText[];
  tags: string[];
  translations: Record<string, ListingTexts>;
}

export interface PropertyPhotoMeta {
  url: string;
  alt: { it: string; en?: string | null } | null;
  width: number | null;
  height: number | null;
  roomId?: string | null;
}

export interface PropertyPhotoMetaInput {
  url: string;
  alt: { it: string | null; en: string | null } | null;
  roomId: string | null;
}

export interface AmenityLabel {
  it: string;
  en: string;
}

export interface AmenityGroup {
  id: string;
  label: AmenityLabel;
}

export interface AmenityCatalogEntry {
  name: string;
  icon: string;
  group: string;
  label: AmenityLabel;
}

export interface AmenityCatalog {
  groups: AmenityGroup[];
  amenities: AmenityCatalogEntry[];
}

export type ChannelPublishStatus = 'Draft' | 'Sending' | 'Accepted' | 'Published' | 'ToFix' | 'ManagedOnChannel';

export interface ListingChannelStatus {
  channel: string;
  status: ChannelPublishStatus;
  completeness: number;
  missing: string[];
  lastSyncedAt: string | null;
  syncLagSeconds: number | null;
  syncAlert: boolean;
  errorCode: string | null;
  reason: string | null;
  reasonDetail: string | null;
  changedOutside: string[];
}

export interface ListingStatus {
  propertyId: string;
  channels: ListingChannelStatus[];
  /** The channels the CIN is not sent to: it stays in CasaZen. */
  cinNotSentTo: string[];
}

export interface ListingPropertySummary {
  propertyId: string;
  worstStatus: ChannelPublishStatus;
  syncAlert: boolean;
}

export interface ListingPublishRequest {
  channels: string[];
  overwrite: boolean;
}

export interface ListingPublishResponse {
  propertyId: string;
  channels: Array<{ channel: string; status: ChannelPublishStatus; errorCode: string | null }>;
}

export type OutsideChangeChoice = 'keep' | 'take';
