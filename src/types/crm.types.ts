import type { PagedResult } from './users.types';

/**
 * The CRM profiles of the guests (E07/F01, NF-88), as `GET api/crm/guests` and `GET api/crm/guests/{id}` send them. Every enumeration is
 * written by name, as in the rest of the API. None of these types has a document, a birth date, a place of birth, a co-guest or any other
 * field of the Alloggiati registration, and none ever will: the CRM screens never show or ask for them (AC-NF88-6).
 */

export type CrmLegalBasis = 'None' | 'ServiceOnly' | 'SoftOptIn' | 'Consent';

export type CrmProfileSort = 'lastStay' | 'spend' | 'stays' | 'name';

export interface CrmProfileListItem {
  id: string;
  displayName: string;
  country: string;
  language: string;
  totalStays: number;
  totalSpend: number;
  firstStayAt: string | null;
  lastStayAt: string | null;
  channels: string[];
  tags: string[];
  emailMasked: string;
  emailBasis: CrmLegalBasis;
  emailReachable: boolean;
  whatsappBasis: CrmLegalBasis;
  hasMergeProposal: boolean;
}

export interface CrmProfileListParams {
  search?: string;
  country?: string;
  language?: string;
  channel?: string;
  tag?: string;
  minStays?: number;
  reachableByEmail?: boolean;
  sort?: CrmProfileSort;
  page?: number;
  pageSize?: number;
}

export type CrmProfileList = PagedResult<CrmProfileListItem>;

export type CrmContactChannel = 'Email' | 'Phone' | 'WhatsApp';

type CrmContactConfirmation = 'Unconfirmed' | 'Pending' | 'Confirmed';

export type CrmContactOrigin = 'OtaForward' | 'CheckIn' | 'DirectBooking' | 'Manual' | 'OctorateContactInfo' | 'WelcomePage' | 'GuestPage';

type CrmReachabilityReason = 'suppressed' | 'ota_forward' | 'not_confirmed' | 'no_basis' | 'channel_not_available';

export type CrmGroupKind = 'Single' | 'Couple' | 'Family' | 'Group';

type CrmBookingStatus = 'Pending' | 'Confirmed' | 'CheckedIn' | 'CheckedOut' | 'Cancelled';

export interface CrmProfileStay {
  bookingId: string;
  propertyId: string;
  propertyName: string;
  checkInDate: string;
  checkOutDate: string;
  nights: number;
  channel: string;
  /** The name of the portal for a source that has no value of its own (`OtherChannel`); `null` otherwise. */
  channelLabel: string | null;
  status: CrmBookingStatus;
  total: number;
  adults: number;
  children: number;
  advanceDays: number | null;
}

interface CrmChannelTotal {
  channel: string;
  stays: number;
  spend: number;
}

interface CrmPropertyTotal {
  propertyId: string;
  propertyName: string;
  stays: number;
}

interface CrmProfileTotals {
  stays: number;
  spend: number;
  averageSpend: number;
  averageAdvanceDays: number | null;
  byChannel: CrmChannelTotal[];
  byProperty: CrmPropertyTotal[];
  averageAdults: number;
  averageChildren: number;
  typicalGroup: CrmGroupKind | null;
}

interface CrmReviewEntry {
  rating: number;
  publishedAt: string;
}

interface CrmReviewSummary {
  count: number;
  averageRating: number | null;
  latest: CrmReviewEntry[];
}

export interface CrmContact {
  id: string;
  channel: CrmContactChannel;
  origin: CrmContactOrigin;
  confirmation: CrmContactConfirmation;
  legalBasis: CrmLegalBasis;
  basisVersion: string;
  basisRecordedAt: string | null;
  isSuppressed: boolean;
  isOtaForward: boolean;
  value: string;
  marketable: boolean;
  reachabilityReason: CrmReachabilityReason | null;
}

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
  stays: CrmProfileStay[];
  staysTruncated: boolean;
  totals: CrmProfileTotals;
  reviews: CrmReviewSummary;
  contacts: CrmContact[];
  mergeProposalCount: number;
}

export interface SetCrmTagsRequest {
  tags: string[];
}

export interface SendConfirmationResult {
  sent: boolean;
}
