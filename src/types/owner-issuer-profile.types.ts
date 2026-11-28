/**
 * The issuer profile of an owner (E17/F01/US01/T01, NF-116, D12): the data with which CasaZen issues the documents of the owner's stays in the owner's name (the receipt of a private owner, the
 * FatturaPA of a company), with the owner's own series, the sezionale. The contract of `GET` and `PUT api/owners/{ownerId}/issuer-profile` of the backend (`OwnerIssuerProfilesController`).
 *
 * The personal data of the profile (the legal name, the fiscal code, the VAT number, the street, the house number, the postal code and the PEC) are in clear only for a caller who may change the
 * profile (the whole organization and `agency.owner.financial.manage`): any other caller gets them masked (`••••1234`) and `masked: true`. The client reduces the answer to the members below.
 */

/** The regimes an Italian owner issues with: a private person (a receipt), a company or a professional in the ordinary VAT regime, or in the flat-rate one (backend `DocumentRegime`). */
export const OWNER_ISSUER_REGIMES = ['PrivatePerson', 'VatOrdinary', 'VatFlatRate'] as const;
export type OwnerIssuerRegime = (typeof OWNER_ISSUER_REGIMES)[number];

export interface OwnerIssuerProfile {
  ownerId: string;
  exists: boolean;
  canIssue: boolean;
  masked: boolean;
  regime: string | null;
  legalName: string | null;
  fiscalCode: string | null;
  vatNumber: string | null;
  addressStreet: string | null;
  addressCivic: string | null;
  postalCode: string | null;
  city: string | null;
  province: string | null;
  countryCode: string;
  /** The regime code of FatturaPA the owner gave; `null` = the one of the rule in force. */
  fatturaPaRegimeCode: string | null;
  effectiveRegimeCode: string | null;
  stayVatTreatment: string;
  guestDocumentSeries: string | null;
  defaultGuestDocumentSeries: string;
  stampDutyReference: string | null;
  issuerSdiRecipientCode: string | null;
  issuerPec: string | null;
  missingFields: string[];
  /** The VAT of the stay in the rule in force today, in percent, when the server says it. */
  stayRatePercent: number | null;
}

export interface OwnerIssuerProfileRequest {
  regime?: OwnerIssuerRegime;
  legalName?: string;
  fiscalCode?: string;
  vatNumber?: string;
  fatturaPaRegimeCode?: string;
  addressStreet?: string;
  addressCivic?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  countryCode: string;
  stayVatTreatment?: string;
  guestDocumentSeries?: string;
  stampDutyReference?: string;
  issuerSdiRecipientCode?: string;
  issuerPec?: string;
}
