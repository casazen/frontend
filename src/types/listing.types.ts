/**
 * The listing of a property as the channels ask for it (E02/F03/US01): the rooms with their beds, the length-of-stay discounts, the texts
 * in the languages of the channel manager, the reference data of the amenities and, for the publication, the state of each channel. The
 * shapes mirror the backend endpoints (`PropertyListingDataController`, `PropertySiteProfileController`, `PublicAmenityCatalogController`,
 * `ListingPublishController`, `ListingStatusController`): enums travel as member names, dates as UTC ISO strings.
 */

// -- Rooms and beds (`GET|PUT api/properties/{id}/rooms`, NF-34) ----------------------------------------------------------------

/** What a room of the unit is. `Bedroom` is what the counter `bedrooms` of the property counts. */
export const PROPERTY_ROOM_TYPES = ['Bedroom', 'LivingRoom', 'Studio', 'Other'] as const;
export type PropertyRoomType = (typeof PROPERTY_ROOM_TYPES)[number];

/** The kinds of bed of a room. */
export const BED_TYPES = ['Single', 'Double', 'Queen', 'King', 'SofaBed', 'Bunk', 'Crib'] as const;
export type BedType = (typeof BED_TYPES)[number];

/** A kind of bed in a room and how many of them (1 to 10). */
export interface RoomBed {
  type: BedType;
  count: number;
}

/** A room as stored, in the order the host gave. */
export interface PropertyRoom {
  id: string;
  position: number;
  type: PropertyRoomType;
  beds: RoomBed[];
}

/** A room as sent: the `id` of a stored room updates it (its photos keep their room), without it the room is new. */
export interface PropertyRoomInput {
  id?: string | null;
  type: PropertyRoomType;
  beds: RoomBed[];
}

// -- Length-of-stay discounts (`GET|PUT api/properties/{id}/stay-discounts`, NF-35) -----------------------------------------------

/** From `minNights` nights the lodging costs `percentOff` percent less (the cleaning fee and the tourist tax are never reduced). */
export interface StayDiscountTier {
  minNights: number;
  percentOff: number;
}

// -- Texts in the languages of the channel manager (`GET|PUT api/properties/{id}/site-profile`, NF-31) -----------------------------

/** The 14 languages of the channel manager as the backend stores them (lower case): Italian and English are required to publish. */
export const LISTING_LANGUAGES = ['it', 'en', 'fr', 'es', 'de', 'ru', 'pt', 'nl', 'ja', 'el', 'tr', 'zh', 'ca', 'ro'] as const;
export type ListingLanguage = (typeof LISTING_LANGUAGES)[number];

/** Who wrote a text of a language other than Italian: a person, a machine translation, or a person who edited a machine translation. */
export type TextOrigin = 'UserWritten' | 'AutoTranslated' | 'ModifiedAfterTranslation';

/** The texts of the listing in one language (the seven fields of the channel manager); a field that was not written is absent or `null`. */
export interface ListingTexts {
  title?: string | null;
  description?: string | null;
  spaces?: string | null;
  access?: string | null;
  neighborhood?: string | null;
  transport?: string | null;
  rules?: string | null;
}

/** A text of the site profile: Italian, English and, for some texts, the other languages in `others`. */
export interface SiteProfileText {
  it: string;
  en?: string | null;
  others?: Record<string, string | null> | null;
}

/** One of the (at most three) highlights of the property page. */
export interface SiteProfileHighlight {
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

/**
 * Body of `PUT api/properties/{id}/site-profile`: the whole profile, which the save **replaces** (what is left out is cleared), with the
 * `translations` that replace the stored ones as well. Who wrote each text is never sent: the server works it out from what is stored.
 */
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

// -- Photos: caption and room (`GET|PUT api/properties/{id}/site-profile/photos`, NF-32) --------------------------------------------

/** A photo of the gallery with what is known of it: its caption (the alternative text, Italian and English) and its room. */
export interface PropertyPhotoMeta {
  url: string;
  alt: { it: string; en?: string | null } | null;
  width: number | null;
  height: number | null;
  /** The room of the property the photo shows; absent when it has none. */
  roomId?: string | null;
}

/** A photo as sent: the caption and the room of the photos not listed in the body are cleared, so the editor sends them all. */
export interface PropertyPhotoMetaInput {
  url: string;
  alt: { it: string | null; en: string | null } | null;
  roomId: string | null;
}

// -- Reference data of the amenities (`GET api/public/amenities`, NF-33) ---------------------------------------------------------

/** A label in Italian and English. */
export interface AmenityLabel {
  it: string;
  en: string;
}

/** A group of the list of the amenities (`comfort`, `kitchen`, `bedbath`, `outdoor`, `safety`), in the order it is shown. */
export interface AmenityGroup {
  id: string;
  label: AmenityLabel;
}

/** One amenity a property can carry: the name the property DTOs use (`WiFi`, `Pool`...), its group and its label. */
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

// -- Publication and state of each channel (E02/F03/US01/T02, T07; NF-09, NF-27, NF-38) ---------------------------------------------

/** Where the content of a property stands on a channel. */
export type ChannelPublishStatus = 'Draft' | 'Sending' | 'Accepted' | 'Published' | 'ToFix' | 'ManagedOnChannel';

/** The wizard steps that can lack data for a channel: the ids of the steps of «Aggiungi immobile». */
export type ListingMissingStep = 'base' | 'photos' | 'descriptions' | 'amenities' | 'rules' | 'prices';

/** The groups of the content that changed outside CasaZen. */
export type OutsideChangeGroup = 'descriptions' | 'rooms' | 'property';

/**
 * The state of the listing on one channel (`GET api/properties/{id}/channel-status`). `reason` is in simple words, in the language of the
 * request; `completeness` is worked out by the server when it is read.
 */
export interface ListingChannelStatus {
  channel: string;
  status: ChannelPublishStatus;
  /** 0 to 100: how much of what the channel asks for the listing has. */
  completeness: number;
  /** The steps of the wizard that lack data, in the order of the wizard. */
  missing: string[];
  lastSyncedAt: string | null;
  syncLagSeconds: number | null;
  /** The channel was not confirmed for more than 24 hours. */
  syncAlert: boolean;
  errorCode: string | null;
  reason: string | null;
  /** What the channel said when it refused the content, in its own words. */
  reasonDetail: string | null;
  changedOutside: string[];
}

/** `GET api/properties/{id}/channel-status`: one entry for each channel the property was published to, or is managed on. */
export interface ListingStatus {
  propertyId: string;
  channels: ListingChannelStatus[];
  /** The channels the CIN is not sent to: it stays in CasaZen. */
  cinNotSentTo: string[];
}

/** `GET api/properties/channel-status`: the worst state of each property that has a channel, for the list. */
export interface ListingPropertySummary {
  propertyId: string;
  worstStatus: ChannelPublishStatus;
  syncAlert: boolean;
}

/** Body of `POST api/properties/{id}/publish`: at least one channel; `overwrite` is the person's choice to write CasaZen's version over a change made outside. */
export interface ListingPublishRequest {
  channels: string[];
  overwrite: boolean;
}

/** The answer of the publication (202): the channels asked for, now `Sending`. */
export interface ListingPublishResponse {
  propertyId: string;
  channels: Array<{ channel: string; status: ChannelPublishStatus; errorCode: string | null }>;
}

/** The person's choice about a change made outside CasaZen: `keep` publishes CasaZen's version again, `take` adopts the descriptions of the channel manager. */
export type OutsideChangeChoice = 'keep' | 'take';
