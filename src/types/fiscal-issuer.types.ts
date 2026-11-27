/**
 * The issuer of the fiscal documents (FIS-02, NF-82, E11/F01/US01): CasaZen is the only issuer since 2026-11-14, so there is no mode to choose and no accountant
 * mode. What the wizard «Fatturazione» still needs of the issuer: its regime (Italian or Swiss), the treatments of the stay and of the cleaning, and the tax rule in
 * force that `GET api/fiscal/documents/issuer-preview` sends for its summary. The API writes the enums by name and leaves out what is empty.
 */

/**
 * The fiscal regime of whoever issues, by the member name of the backend enum `DocumentRegime`. Italy: a private person with no VAT number, a VAT number in the
 * ordinary regime, a VAT number in the flat-rate regime. Switzerland: registered for the VAT (with its UID) or not. The country of the issuer decides which ones are valid
 * (a regime of the other country is 422 `issuer_regime_country_mismatch`).
 */
export const DOCUMENT_REGIMES = ['PrivatePerson', 'VatOrdinary', 'VatFlatRate', 'SwissVatRegistered', 'SwissNotRegistered'] as const;

export type DocumentRegime = (typeof DOCUMENT_REGIMES)[number];

/** The VAT of the stay of an Italian issuer (⚖ I1): the standard one (10%) or exempt under art. 10 n. 8. */
export const STAY_VAT_TREATMENTS = ['Standard', 'ExemptArt10'] as const;

export type StayVatTreatment = (typeof STAY_VAT_TREATMENTS)[number];

/** The cleaning fee as part of the stay, which follows its VAT (⚖ C2, the default), or as a service with its own. */
export const CLEANING_FEE_TREATMENTS = ['FollowsStay', 'Service'] as const;

export type CleaningFeeTreatment = (typeof CLEANING_FEE_TREATMENTS)[number];

/** The VAT of one type of line of a document, in percent, with the nature code of an Italian 0% (`lineType`: `Accommodation`, `Cleaning`, `ExtraService`...). */
export interface FiscalTaxRuleRate {
  lineType: string;
  percent: number;
  natureCode?: string;
}

/** The stamp duty of the documents without VAT: due above `threshold` of amounts without VAT, of `amount`, added to the total when `chargedToRecipient`. */
export interface FiscalTaxRuleStampDuty {
  threshold: number;
  amount: number;
  chargedToRecipient: boolean;
}

/** The tax rule in force today for the profile of the issuer (`FiscalDocuments:TaxRules`): its version and dates, the kind of document and the VAT of every line type. */
export interface FiscalTaxRule {
  /** `IT` or `CH`. */
  jurisdiction: string;
  regime: string;
  /** The version stored on the documents made with the rule. */
  version: string;
  validFrom: string;
  validTo?: string;
  sourceUrl?: string;
  /** `Receipt` or `Invoice`. */
  documentKind: string;
  fatturaPaRegimeCode?: string;
  rates: FiscalTaxRuleRate[];
  stampDuty?: FiscalTaxRuleStampDuty;
}

/** The preview of the issuer of the organization (`GET api/fiscal/documents/issuer-preview` without a booking): CasaZen, and the rule in force when there is one. */
export interface FiscalIssuerPreview {
  /** `CasaZen`, or `None` while the issuance is off. */
  issuer: string;
  /** `issuer_casazen` or `issuance_off`. */
  reason: string;
  /** Absent while the profile has no regime or no rule of the catalog covers it. */
  rule?: FiscalTaxRule;
}
