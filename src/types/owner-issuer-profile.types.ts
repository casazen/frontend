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

/** What the profile of an owner holds, as the page reads it. A member the server leaves out when it is empty is `null` here. */
export interface OwnerIssuerProfile {
  ownerId: string;
  /** The owner has a profile (`false`: the answer is the empty one an owner without a profile gets). */
  exists: boolean;
  /** The profile is complete: CasaZen can issue the documents of the owner's stays on it. */
  canIssue: boolean;
  /** The personal data are masked for this caller: the profile is read, not changed. */
  masked: boolean;
  /** The regime by the name of the backend enum; `null` until it is said. */
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
  /** The regime code that would be used (the profile's own, else the rule's). */
  effectiveRegimeCode: string | null;
  /** `Standard` (10%) or `ExemptArt10` (⚖ I1). */
  stayVatTreatment: string;
  /** The series pattern of the owner's documents (its sezionale); `null` = the default, the year. */
  guestDocumentSeries: string | null;
  defaultGuestDocumentSeries: string;
  /** The authorization of the virtual stamp duty or the number of the physical stamp of the owner (⚖ I4). */
  stampDutyReference: string | null;
  issuerSdiRecipientCode: string | null;
  issuerPec: string | null;
  /** What is still missing before a document is issued on the profile, by the names of the fields of the request. */
  missingFields: string[];
  /** The VAT of the stay in the rule in force today, in percent, when the server says it. */
  stayRatePercent: number | null;
}

/** `PUT api/owners/{ownerId}/issuer-profile`: the whole profile; a text that is left out is cleared, and an incomplete profile is saved and says what is missing. */
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
