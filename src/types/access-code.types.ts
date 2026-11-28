/**
 * One property in `GET api/properties/access-codes`: whether the host has set the lock code of the entrance, and when.
 * The code itself is never in the answer, in any form: it is write-only (ADR-013) and is released to a guest only after a
 * passed identity check.
 */
export interface AccessCodeStatusItem {
  propertyId: string;
  name: string;
  city: string | null;
  accessCodeSet: boolean;
  updatedAt: string | null;
}

export interface AccessCodeStatusPage {
  items: AccessCodeStatusItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

export interface SetAccessCodeRequest {
  code: string;
}
