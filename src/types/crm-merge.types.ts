import type { CrmContactChannel, CrmContactOrigin } from './crm.types';
import type { PagedResult } from './users.types';

/**
 * The merge proposals of the CRM (E07/F01/US03/T02, NF-88), as `GET api/crm/merge-candidates` sends them. The values of the contacts are
 * masked by the server. None of these types has a document, a birth date, a place of birth, a co-guest or any other field of the
 * Alloggiati registration, and none ever will (AC-NF88-6): even the reason "same name and birth date" is only a code, never the date.
 */

/** Why the matching proposed a pair, as the codes of the backend (`GuestMatchRules`): never what matched. */
export type CrmMergeReason = 'same_email' | 'same_name_birth' | 'same_phone' | 'same_name_same_property';

/** A contact of a profile in a proposal: the channel, where it came from, and the value with most of it hidden (`m***@example.it`). */
export interface CrmMergeContact {
  channel: CrmContactChannel;
  origin: CrmContactOrigin;
  valueMasked: string;
}

/** One of the two profiles of a proposal, as much as a person needs to tell whether it is the same guest. */
export interface CrmMergeProfile {
  id: string;
  displayName: string;
  country: string;
  /** The stays that happened at the properties the caller reaches. */
  stays: number;
  lastStayAt: string | null;
  /** The properties the caller reaches where the guest has a booking that is not cancelled, A to Z. */
  propertyNames: string[];
  contacts: CrmMergeContact[];
}

/** A proposal to decide: how sure the matching is, why, and the two profiles side by side. */
export interface CrmMergeCandidate {
  id: string;
  /** From 0 to 100. */
  score: number;
  /** The reasons as codes (see {@link CrmMergeReason}); a code the app does not know yet is possible. */
  reasons: string[];
  createdAt: string;
  /** The profile with the smaller id, as the pair is stored. */
  profileA: CrmMergeProfile;
  profileB: CrmMergeProfile;
}

export type CrmMergeCandidateList = PagedResult<CrmMergeCandidate>;

/** The body of `POST api/crm/merge-candidates/{id}/merge`: the profile that stays. */
export interface MergeCrmProfilesRequest {
  survivorProfileId: string;
}
