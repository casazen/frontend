import type { CrmContactChannel, CrmContactOrigin } from './crm.types';
import type { PagedResult } from './users.types';

/**
 * The merge proposals of the CRM (E07/F01/US03/T02, NF-88), as `GET api/crm/merge-candidates` sends them. The values of the contacts are
 * masked by the server. None of these types has a document, a birth date, a place of birth, a co-guest or any other field of the
 * Alloggiati registration, and none ever will (AC-NF88-6): even the reason "same name and birth date" is only a code, never the date.
 */

interface CrmMergeContact {
  channel: CrmContactChannel;
  origin: CrmContactOrigin;
  valueMasked: string;
}

export interface CrmMergeProfile {
  id: string;
  displayName: string;
  country: string;
  stays: number;
  lastStayAt: string | null;
  propertyNames: string[];
  contacts: CrmMergeContact[];
}

export interface CrmMergeCandidate {
  id: string;
  score: number;
  reasons: string[];
  createdAt: string;
  profileA: CrmMergeProfile;
  profileB: CrmMergeProfile;
}

export type CrmMergeCandidateList = PagedResult<CrmMergeCandidate>;

export interface MergeCrmProfilesRequest {
  survivorProfileId: string;
}
