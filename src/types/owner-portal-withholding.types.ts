import type { TaxFilingState } from './owner-accounting.types';

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

export interface OwnerPortalWithholding {
  year: number;
  currency: string;
  totalWithheld: number;
  details: OwnerPortalWithholdingDetail[];
  cuStatements: OwnerPortalCu[];
}
