/**
 * The two checks of the Italian short-let withholding that look at the owner and at the tenant (E18/F01/US03/T01, NF-117, ⚖ I7 and I8): the contract of `GET` and `POST api/owner-tax-decisions`,
 * `GET api/owners/{id}/tax-checks` and `PUT api/owners/{id}/external-short-let-units`. They exist behind the flag `taxReportingExports`: the backend answers 404 while it is off.
 *
 * The API writes the enums by name and the days as `yyyy-MM-dd`; the instants are UTC ISO strings. NO type here carries the tenant of a stay or its invoice data: a stay is told by the code of its booking,
 * its property and its days (E18/F01/US03/T01: «never the tenant»).
 */

export type ShortLetTaxRegime = 'ShortLet' | 'NotShortLet';

export type CompanyTenantCaseState = 'Pending' | 'Decided';

export interface CompanyTenantCase {
  bookingId: string;
  bookingCode: string;
  propertyId: string;
  propertyName: string;
  checkIn: string;
  checkOut: string;
  decision: ShortLetTaxRegime | null;
  decidedAt: string | null;
  decidedByUserId: string | null;
}

export interface DecideShortLetTaxCommand {
  bookingId: string;
  regime: ShortLetTaxRegime;
  reason: string;
}

export interface ShortLetTaxDecision {
  id: string;
  bookingId: string;
  regime: ShortLetTaxRegime;
  reason: string;
  decidedAt: string;
  decidedByUserId: string;
}

/**
 * The limit of units of an owner today (`GET api/owners/{id}/tax-checks`, ⚖ I8): the apartments the agency manages for it, the ones it declared outside the agency, the limit of a private person and whether it is past
 * it (presumed to run a business). `applies` is false for an owner that is a business already (a company, or a holder of a VAT number): the limit is about natural persons.
 */
export interface OwnerUnitsCheck {
  ownerId: string;
  applies: boolean;
  managedUnits: number;
  externalUnits: number;
  totalUnits: number;
  maxUnits: number;
  presumedBusiness: boolean;
}
