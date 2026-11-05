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
  /** When the code was last set or changed (UTC); `null` while there is none. */
  updatedAt: string | null;
}

/** One page of the properties the caller reaches (`pageSize` is at most 100 on the server). */
export interface AccessCodeStatusPage {
  items: AccessCodeStatusItem[];
  totalCount: number;
  page: number;
  pageSize: number;
}

/** Body of `POST api/properties/{id}/access-code`: the only place the code travels, and only in this direction. */
export interface SetAccessCodeRequest {
  code: string;
}
