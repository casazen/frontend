import type { PagedResult } from './users.types';

/**
 * The CRM profiles of the guests (E07/F01, NF-88), as `GET api/crm/guests` and `GET api/crm/guests/{id}` send them. Every enumeration is
 * written by name, as in the rest of the API. None of these types has a document, a birth date, a place of birth, a co-guest or any other
 * field of the Alloggiati registration, and none ever will: the CRM screens never show or ask for them (AC-NF88-6).
 */

/** What a contact may be used for (backend `GuestContactLegalBasis`), from the weakest to the strongest. */
export type CrmLegalBasis = 'None' | 'ServiceOnly' | 'SoftOptIn' | 'Consent';

/** The order of the list: the latest stay first, the highest spend, the most stays, or the name A to Z. */
export type CrmProfileSort = 'lastStay' | 'spend' | 'stays' | 'name';

/** One profile of the list. The e-mail is masked by the server (`m***@example.it`); a profile without one has an empty string. */
export interface CrmProfileListItem {
  id: string;
  /** The name of the guest; for a lead (a person who left an address on the welcome page) the name it gave; empty when there is none. */
  displayName: string;
  country: string;
  language: string;
  /** The stays that happened; for a caller limited to some properties, at those properties only. */
  totalStays: number;
  totalSpend: number;
  firstStayAt: string | null;
  lastStayAt: string | null;
  /** The channels the guest booked on (`Direct`, `Airbnb`, `BookingCom`...), the most used first. */
  channels: string[];
  tags: string[];
  emailMasked: string;
  /** The legal basis of that address. */
  emailBasis: CrmLegalBasis;
  /** At least one e-mail address of the profile may receive marketing. */
  emailReachable: boolean;
  /** The strongest basis of the WhatsApp numbers of the profile. */
  whatsappBasis: CrmLegalBasis;
  /** A merge proposal on this profile waits for a person, and the caller may decide it. */
  hasMergeProposal: boolean;
}

/** What `GET api/crm/guests` takes. The server applies the scope of the caller to every one of them. */
export interface CrmProfileListParams {
  /** A part of a name, or a whole e-mail address or phone number. */
  search?: string;
  country?: string;
  language?: string;
  channel?: string;
  tag?: string;
  minStays?: number;
  /** `true`: with an e-mail address that may receive marketing; `false`: without one. */
  reachableByEmail?: boolean;
  sort?: CrmProfileSort;
  page?: number;
  pageSize?: number;
}

export type CrmProfileList = PagedResult<CrmProfileListItem>;

/** The channel a contact is reached on. */
export type CrmContactChannel = 'Email' | 'Phone' | 'WhatsApp';

/** The double opt-in of a contact: not asked yet, asked and waiting for the answer, or confirmed. */
export type CrmContactConfirmation = 'Unconfirmed' | 'Pending' | 'Confirmed';

/** Where a contact came from: the first thing its legal basis depends on. */
export type CrmContactOrigin = 'OtaForward' | 'CheckIn' | 'DirectBooking' | 'Manual' | 'OctorateContactInfo' | 'WelcomePage' | 'GuestPage';

/** Why a contact cannot be written to for marketing (a code of the backend `CrmContactRules`). */
export type CrmReachabilityReason = 'suppressed' | 'ota_forward' | 'not_confirmed' | 'no_basis' | 'channel_not_available';

/** How a guest usually comes: alone, as a couple, with children, or in a group of three adults or more. */
export type CrmGroupKind = 'Single' | 'Couple' | 'Family' | 'Group';

/** The status of a booking in the history of a profile. */
export type CrmBookingStatus = 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';

/** One booking in the history of a profile. */
export interface CrmProfileStay {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  /** The source of the booking: `Direct`, `Airbnb`, `BookingCom`, `Manual`, `OtherChannel`... */
  channel: string;
  /** The name of the portal for a source that has no value of its own (`OtherChannel`); `null` otherwise. */
  channelLabel: string | null;
  status: CrmBookingStatus;
  total: number;
  adults: number;
  children: number;
  /** Days between the booking and the arrival; `null` when the booking was recorded after the arrival. */
  advanceDays: number | null;
}

/** Stays and spend of a profile on one channel. */
export interface CrmChannelTotal {
  channel: string;
  stays: number;
  spend: number;
}

/** Stays of a profile at one property. */
export interface CrmPropertyTotal {
  propertyId: string;
  propertyName: string;
  stays: number;
}

/** The totals of a profile over its stays that happened. */
export interface CrmProfileTotals {
  stays: number;
  spend: number;
  averageSpend: number;
  /** The booking advance on average, in days; `null` when no stay has a known advance. */
  averageAdvanceDays: number | null;
  byChannel: CrmChannelTotal[];
  byProperty: CrmPropertyTotal[];
  averageAdults: number;
  averageChildren: number;
  /** `null` without a stay. */
  typicalGroup: CrmGroupKind | null;
}

/** A review in the summary: the mark and when it was published. */
export interface CrmReviewEntry {
  rating: number;
  publishedAt: string;
}

/** The reviews of the stays of a profile. */
export interface CrmReviewSummary {
  count: number;
  /** From 1 to 5; `null` without a review. */
  averageRating: number | null;
  /** The latest, at most five. */
  latest: CrmReviewEntry[];
}

/** A contact of a profile, with what the rules of the CRM say of it (NF-89). The value is the address or the number as stored. */
export interface CrmContact {
  id: string;
  channel: CrmContactChannel;
  origin: CrmContactOrigin;
  confirmation: CrmContactConfirmation;
  legalBasis: CrmLegalBasis;
  /** The version of the text the basis rests on; empty when there is none. */
  basisVersion: string;
  basisRecordedAt: string | null;
  isSuppressed: boolean;
  /** The address is one an online travel agency forwards the mail through: never written to for marketing. */
  isOtaForward: boolean;
  value: string;
  marketable: boolean;
  reachabilityReason: CrmReachabilityReason | null;
}

/** A profile in detail: `GET api/crm/guests/{id}`. */
export interface CrmProfileDetail {
  id: string;
  displayName: string;
  /** The guest record the name comes from, so that the screen can open it; `null` when none the caller reaches has a name. */
  primaryGuestId: string | null;
  country: string;
  language: string;
  firstStayAt: string | null;
  lastStayAt: string | null;
  tags: string[];
  /** The bookings the caller reaches, the latest arrival first, at most 200. */
  stays: CrmProfileStay[];
  /** There are more bookings than `stays` holds; the totals count them all. */
  staysTruncated: boolean;
  totals: CrmProfileTotals;
  reviews: CrmReviewSummary;
  contacts: CrmContact[];
  /** The merge proposals on this profile that the caller may decide. */
  mergeProposalCount: number;
}

/** The body of `PUT api/crm/guests/{id}/tags`: the tags the profile has from now on. An empty list clears them. */
export interface SetCrmTagsRequest {
  tags: string[];
}

/** The answer of `POST api/crm/contacts/{id}/send-confirmation`: whether this call queued the e-mail. */
export interface SendConfirmationResult {
  /** `false`: the last request went out less than ten minutes ago, and nothing was sent now. */
  sent: boolean;
}
