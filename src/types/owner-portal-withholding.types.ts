import type { TaxFilingState } from './owner-accounting.types';

/**
 * The withholding of the owner in a year and its Certificazione Unica as the owner portal reads them (E18/F01/US02/T01, E18/F02/US01/T01): the contract of `GET api/owner-portal/withholding?year=`, which the
 * backend answers for the owner profiles of the claim only, and, for a contact the owner invited, only with the permission `accounting.read` (403 `owner_portal_permission_missing`). With `taxReportingExports` or the
 * agency plan off it answers an empty summary.
 *
 * Every amount is in `currency` (euro, the currency of the withholding) and to the cent. NO type here carries what belongs to the agency: the recipient of the CU (name, fiscal code, address), the stays it is made of and
 * the co-owners. There is no member for them and none may be added: the page keeps only the members below, whatever the answer carries.
 */

/** What the agency withheld for one property in one month (a reversal taking its decision away). A payout made before the facts were read from the ledger names no property: its line has an empty id and name. */
export interface OwnerPortalWithholdingDetail {
  agencyId: string;
  agencyName: string;
  propertyId: string;
  propertyName: string;
  month: number;
  grossBase: number;
  amountWithheld: number;
}

/** The Certificazione Unica data of the owner for a year as the agency stored it: its state, the base and the withholding in euro, the tax code of the F24 and how the record was made. The owner sees it once the agency reviewed it. */
export interface OwnerPortalCu {
  agencyId: string;
  agencyName: string;
  year: number;
  state: TaxFilingState;
  generatedAt: string;
  grossBase: number;
  withheld: number;
  taxCode: string | null;
  attribution: string;
}

/** The withholding of the owner in a year: the total, the lines by agency, month and property, and the CU of each agency that has reviewed it. */
export interface OwnerPortalWithholding {
  year: number;
  /** The currency of every amount: the API says it (it is the euro), the page never assumes it. */
  currency: string;
  totalWithheld: number;
  details: OwnerPortalWithholdingDetail[];
  cuStatements: OwnerPortalCu[];
}
