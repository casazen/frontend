/**
 * Who issues the fiscal documents of the organization (FIS-02, NF-82, E06/F02/US02): the contract of `GET` and `PUT api/fiscal/documents/settings`
 * and of `GET api/fiscal/documents/issuer-preview`. The API writes the enums by name and leaves out what is empty (a member that is `null` on the
 * server is not in the answer), so every optional member below is `undefined` when it is not there.
 */

/**
 * Who issues the documents, by the member name of the backend enum `DocumentIssuerMode`: the channel manager (CasaZen reads what it issues),
 * CasaZen (the direct bookings only, never an OTA booking) or nobody here, because the accountant takes care of it.
 */
export const DOCUMENT_ISSUER_MODES = ['Octorate', 'CasaZenDirectOnly', 'Accountant'] as const;

export type DocumentIssuerMode = (typeof DOCUMENT_ISSUER_MODES)[number];

/**
 * The fiscal regime of whoever issues, by the member name of the backend enum `DocumentRegime`: a private person with no VAT number, a VAT number
 * in the ordinary regime, a VAT number in the flat-rate regime. There is no regime for the invoice of an agency to its owners: CasaZen does not
 * issue it.
 */
export const DOCUMENT_REGIMES = ['PrivatePerson', 'VatOrdinary', 'VatFlatRate'] as const;

export type DocumentRegime = (typeof DOCUMENT_REGIMES)[number];

/** The kind of document a rule gives to the guest (`None`: not decided yet, so nothing is issued). */
export type FiscalDocumentKind = 'None' | 'Receipt' | 'Invoice' | 'DualHeadingInvoice';

/**
 * The data of the issuer. The VAT number and the fiscal code are those of the organization (its tax profile): they are read here and never sent
 * back by the save.
 */
export interface FiscalIssuerData {
  legalName?: string;
  addressStreet?: string;
  addressCivic?: string;
  postalCode?: string;
  city?: string;
  /** The two letters of the Italian province. */
  province?: string;
  /** ISO 3166-1 alpha-2, `IT` by default. */
  countryCode: string;
  /** The regime code the accountant chose; absent when the one of the rule is used. */
  fatturaPaRegimeCode?: string;
  /** The regime code that would be used: the one above, else the rule's. */
  effectiveRegimeCode?: string;
  issuerSdiRecipientCode?: string;
  issuerPec?: string;
  defaultSeries?: string;
  vatNumber?: string;
  fiscalCode?: string;
}

/** The e-invoice channel CasaZen has to the SDI in this environment. */
export interface FiscalSdiProvider {
  providerConfigured: boolean;
  providerName?: string;
}

/** The rule of the documents of the regime of the issuer, as configured on the server. */
export interface FiscalDocumentRule {
  documentKind: FiscalDocumentKind;
  /** The rule is complete enough to issue with; false means that issuing is refused (`document_rule_not_configured`). */
  configured: boolean;
  fatturaPaRegimeCode?: string;
  vatRatePercent?: number;
  vatNatureCode?: string;
  invoiceTypeCode: string;
  creditNoteTypeCode: string;
  touristTaxNatureCode?: string;
  seriesPattern: string;
}

/** The setting of the organization (`GET`, and the answer of the `PUT`). */
export interface FiscalDocumentSettings {
  /** Absent while the organization has not chosen. */
  mode?: DocumentIssuerMode;
  regime?: DocumentRegime;
  issuer: FiscalIssuerData;
  /** When the wizard was completed (ISO 8601). */
  confirmedAt?: string;
  /** The flag `Features:FiscalDocumentIssuance`: the choice «CasaZen issues» exists only while it is on. */
  casazenIssuanceEnabled: boolean;
  /** The answer to D34: the channel manager is the recommended issuer only while it is true. */
  octorateIssuesAllBookings: boolean;
  /** The organization has an active connection with the channel manager in this environment (the choice «the channel manager issues» needs it). */
  octorateConnected: boolean;
  sdi: FiscalSdiProvider;
  /** What the choice «CasaZen issues» would still need, by the names of the fields (`IssuerFields` of the server); empty when the profile is complete. */
  missingFields: string[];
  /** The rule of the regime as configured; absent while there is no regime or no rule for it. */
  rule?: FiscalDocumentRule;
}

/** The issuer's data of a save. A save replaces the setting as a whole: a text that is left out is cleared. */
export interface SaveFiscalIssuerDataRequest {
  legalName?: string;
  addressStreet?: string;
  addressCivic?: string;
  postalCode?: string;
  city?: string;
  province?: string;
  countryCode?: string;
  fatturaPaRegimeCode?: string;
  issuerSdiRecipientCode?: string;
  issuerPec?: string;
  defaultSeries?: string;
}

/** The answers of the wizard «Come emetti i documenti?» (`PUT`). The VAT number and the fiscal code are not sent: they live in the tax profile. */
export interface SaveFiscalDocumentSettingsRequest {
  mode: DocumentIssuerMode;
  regime?: DocumentRegime;
  issuer?: SaveFiscalIssuerDataRequest;
  /** The wizard was completed: it sets the time of the confirmation. */
  confirmed: boolean;
}

/** Who would issue the documents of a booking (`GET issuer-preview`). */
export type FiscalIssuerKind = 'None' | 'Octorate' | 'CasaZen';

/** The stable reason of the answer of the preview. */
export type FiscalIssuerReason =
  | 'issuer_octorate'
  | 'issuer_casazen'
  | 'issuer_nobody'
  | 'booking_not_direct'
  | 'issuer_locked_octorate'
  | 'issuance_off';

export interface FiscalIssuerPreview {
  bookingId: string;
  issuer: FiscalIssuerKind;
  reason: FiscalIssuerReason;
}

/** The names of the fields of the issuer setting as the API says them (`issuer_profile_incomplete` and `issuer_field_invalid` name them). */
export const FISCAL_ISSUER_FIELDS = [
  'mode',
  'regime',
  'legalName',
  'addressStreet',
  'addressCivic',
  'postalCode',
  'city',
  'province',
  'countryCode',
  'fatturaPaRegimeCode',
  'issuerSdiRecipientCode',
  'issuerPec',
  'defaultSeries',
  'vatNumber',
  'fiscalCode',
] as const;

export type FiscalIssuerField = (typeof FISCAL_ISSUER_FIELDS)[number];
