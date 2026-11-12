import type { PagedResult } from './users.types';

/**
 * The CRM profiles of the guests (E07/F01, NF-88), as `GET api/crm/guests` sends them. Every enumeration is written by name, as in the
 * rest of the API. None of these types has a document, a birth date, a place of birth or any other field of the Alloggiati
 * registration, and none ever will: the CRM screens never show or ask for them (AC-NF88-6).
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

/**
 * The profile as the first list (NF-23) had it, with a confirmed e-mail and two consent switches. It stays until the detail page is
 * rebuilt on its own endpoint (E07/F01/US04/T02), which is the last that reads it.
 */
export interface GuestCrmProfile {
  id: string;
  confirmedMarketingEmail: string;
  marketingConsentEmail: boolean;
  marketingConsentWhatsApp: boolean;
  language: string;
  country: string;
  totalStays: number;
  totalSpend: number;
  propertyIds: string[];
  tags: string[];
  firstStayAt: string;
  lastStayAt: string;
}
