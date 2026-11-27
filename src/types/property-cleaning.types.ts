// The cleaner of a property at the check-out of its stays (E24/F01/US01, NF-120, decision O11): mirrors `PropertyCleaningSetupDtos.cs` and
// `PropertyCleaningSetupController` of the backend (`GET` and `PUT api/properties/{id}/cleaning-setup`, `PUT api/properties/cleaning-setup/bulk`).
// Enums travel as member names; a price is a number of cents of the currency of the property, and never travels without it.

/** Who cleans (`PropertyCleanerKind`): a supplier of the marketplace, or a member of the staff of the org. */
export type PropertyCleanerKind = 'Supplier' | 'Staff';

/** The default cleaner of a property as the API answers it; a property that has none answers `configured: false` with the defaults. */
export interface PropertyCleaningSetup {
  propertyId: string;
  /** The property has a setup (switched on or off): when `false` only the defaults are filled. */
  configured: boolean;
  cleanerKind: PropertyCleanerKind | null;
  supplierOrgId: string | null;
  /** The legal name of the supplier. */
  supplierName: string | null;
  /** The supplier is one of the org's trusted suppliers for this property: a preference, not a rule. */
  supplierIsTrusted: boolean;
  /** The member of the staff: the `userId` of the members' list. */
  staffUserId: string | null;
  /** The price agreed for one cleaning, in cents of `currency`, gross as the cleaner asks it. */
  priceCents: number | null;
  /** ISO 4217 code of the currency of the property, the one of the price. */
  currency: string;
  /** `HH:mm:ss` on the clock of the property; `null` = the check-out time of the property. */
  startTime: string | null;
  /** The time the cleaning really starts (`HH:mm:ss`): the setup's, else the check-out time of the property, else 10:00. */
  effectiveStartTime: string;
  /** Minutes; `null` = the default (two hours). */
  durationMinutes: number | null;
  effectiveDurationMinutes: number;
  /** Whether the automation uses the setup; `false` keeps it without using it. */
  active: boolean;
  /** UTC; `null` while the property has no setup. */
  updatedAt: string | null;
}

/** The body of `PUT api/properties/{id}/cleaning-setup`: the whole setup, what it leaves out is cleared. */
export interface SaveCleaningSetupDto {
  cleanerKind: PropertyCleanerKind;
  supplierOrgId?: string | null;
  staffUserId?: string | null;
  /** From 1 cent for a supplier; optional for staff. It always comes with its `currency`. */
  priceCents?: number | null;
  /** The currency of the property; required with a price. */
  currency?: string | null;
  /** `HH:mm:ss`, whole minutes; left out = the check-out time of the property. */
  startTime?: string | null;
  /** 5 to 1,440; left out = two hours. */
  durationMinutes?: number | null;
  active: boolean;
}

/** The body of `PUT api/properties/cleaning-setup/bulk`: one setup for the properties named (200 at most; none is a 422, never «every property»). */
export interface BulkSaveCleaningSetupDto extends SaveCleaningSetupDto {
  propertyIds: string[];
}

/** What the bulk save did for one property: saved, or the code and the words of the rule that stopped it. */
interface CleaningSetupBulkResult {
  propertyId: string;
  saved: boolean;
  /** The stable code of the rule that stopped the property; `null` when it was saved. */
  code: string | null;
  /** The text of the code in the language of the caller; `null` when it was saved. */
  message: string | null;
}

/** The answer of the bulk save: 200 even when some failed, one result for each property in the order received, and the counts. */
export interface CleaningSetupBulkResponse {
  results: CleaningSetupBulkResult[];
  saved: number;
  failed: number;
}
