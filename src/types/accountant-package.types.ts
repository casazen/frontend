/**
 * The agency summary of a period (E15/F01/US01/T01, E15/F02/US01/T01, NF-101, NF-115): the contract of `GET api/accountant-package/agency-summary` of the backend (`AccountantPackageController`,
 * `payment.read`, behind the flag `AccountantPackage`). It is the very summary the ZIP of the accountant holds in `riepilogo-agenzia/`, so the screen and the package never disagree.
 *
 * The words of the wire are stable codes, never a text to show (the kinds of document, the channels, the states): the screen translates them. The API writes the days as `yyyy-MM-dd` and every
 * amount as a number in the currency named beside it (a credit note is negative; a figure nobody reported is `null`, never zero). The figures of the stays, of the collections, of the costs of the
 * channels, of the Italian tourist tax and of the report by owner carry NO currency: the server adds the properties up as it counts them, so the client shows them without a symbol and says so.
 * The fields of the owner accounting are empty, and `ownerAccountingIncluded` is false, for a caller who may not read it (`agency.statement.view` and the whole organization).
 */

export interface AgencyAmounts {
  taxable: number;
  vat: number;
  total: number;
}

interface AgencyStays {
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number | null;
  revenue: number;
  stays: number;
  revenueNights: number;
  adr: number | null;
  revPar: number | null;
}

export interface AgencyBalance {
  currency: string;
  amount: number;
  stays: number;
}

interface AgencyCollections {
  collected: number;
  payments: number;
  toCollect: AgencyBalance[];
}

interface AgencyIssuer {
  name: string;
  countryCode: string;
  taxId: string | null;
}

export interface AgencyGuestDocuments {
  issuer: AgencyIssuer;
  kind: string;
  currency: string;
  documents: number;
  amounts: AgencyAmounts;
}

export interface AgencyPortalCost {
  source: string | null;
  kind: string | null;
  stays: number;
  gross: number;
  cost: number | null;
  net: number | null;
  costRate: number | null;
}

interface AgencyItalianTouristTax {
  owed: number;
  paid: number | null;
  toRemit: number | null;
  staysWithoutAmount: number;
}

export interface AgencySwissTouristTax {
  canton: string;
  currency: string;
  documents: number;
  collected: number;
}

interface AgencyTouristTax {
  italy: AgencyItalianTouristTax;
  switzerland: AgencySwissTouristTax[];
}

export interface AgencyCommission {
  ownerId: string;
  ownerName: string | null;
  currency: string;
  documents: number;
  commission: AgencyAmounts;
  recharges: AgencyAmounts;
  /** The expenses advanced in the name of the owner, outside the VAT. */
  advancedExpenses: number;
  invoicedTotal: number;
}

export interface AgencyOwnerInvoiceCount {
  currency: string;
  invoices: number;
  creditNotes: number;
}

export interface AgencyRate {
  currency: string;
  /** The rate in percent; `0` with a nature code for an operation without VAT; `null` when a document does not state it. */
  ratePercent: number | null;
  natureCode: string | null;
  amounts: AgencyAmounts;
}

interface AgencyOwnerInvoices {
  counts: AgencyOwnerInvoiceCount[];
  /** The totals for each currency and VAT rate, credit notes taken away. */
  rates: AgencyRate[];
}

export interface AgencyPayout {
  currency: string;
  payouts: number;
  gross: number;
  withholding: number;
  net: number;
}

export interface AgencyWire {
  currency: string;
  status: string;
  batches: number;
  transfers: number;
  total: number;
}

export interface AgencyPortalCommissionBorne {
  source: string;
  currency: string;
  amount: number;
}

export interface AgencyMargin {
  currency: string;
  commissions: number;
  recharges: number;
  portalCommissionsBorne: number;
  margin: number;
}

export interface AgencyOwnerRevenue {
  ownerId: string | null;
  ownerName: string | null;
  anonymized: boolean;
  properties: number;
  revenue: number;
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number | null;
  stays: number;
}

export interface AgencySummary {
  period: string;
  periodKind: string;
  from: string;
  to: string;
  generatedOn: string;
  ownerAccountingIncluded: boolean;
  stays: AgencyStays;
  collections: AgencyCollections;
  guestDocuments: AgencyGuestDocuments[];
  portalCosts: AgencyPortalCost[];
  touristTax: AgencyTouristTax;
  commissions: AgencyCommission[];
  ownerInvoices: AgencyOwnerInvoices;
  payouts: AgencyPayout[];
  wires: AgencyWire[];
  portalCommissionsBorne: AgencyPortalCommissionBorne[];
  margin: AgencyMargin[];
  owners: AgencyOwnerRevenue[];
}

// ---------------------------------------------------------------------------------------------------------------------
// How the package is sent to the accountant (E15/F01/US02/T01 and T02, E15/F02/US02/T01, NF-101, decision of 2026-11-14): `GET` and `PUT api/accountant-package/settings` and
// `POST api/accountant-package/send` of the backend (`AccountantPackageController`, behind the flag `AccountantPackage`). The accountant only receives; the address is personal data of
// a third party: read only by a caller whose reach is the whole organization, never put in an address, a log or the browser's storage.
// ---------------------------------------------------------------------------------------------------------------------

export const ACCOUNTANT_PACKAGE_FOLDERS = ['guestDocuments', 'ownerInvoices', 'statements', 'agencySummary', 'vat', 'withholding', 'touristTax', 'collections'] as const;
export type AccountantPackageFolder = (typeof ACCOUNTANT_PACKAGE_FOLDERS)[number];

/**
 * The folders that carry the owner accounting (backend `AccountantPackageFolderRules.OwnerAccountingCarriers`): the invoices to the owners, the statements, the agency summary, the VAT and the
 * withholding. On an organization on the agency plan the backend lets only a caller who holds `agency.statement.view` choose them (422 `accountant_package_owner_accounting_required` for anyone
 * else, and the save replaces the folders as a whole), so the screen offers them only to that caller.
 */
export const ACCOUNTANT_OWNER_FOLDERS: readonly AccountantPackageFolder[] = ['ownerInvoices', 'statements', 'agencySummary', 'vat', 'withholding'];

export const ACCOUNTANT_SEND_DAYS = { min: 1, max: 28 } as const;

/**
 * What the last attempt to send ended in: the month the package was of (`yyyy-MM`), when (UTC), `sent` (the e-mail with the link is in the queue of the e-mails, which delivers it and
 * retries: it says nothing about its delivery) or `failed` (nothing went out; the next run tries again) and, for a failure, the stable code of why (`package_too_large`,
 * `package_failed`, `storage_failed`, `link_not_configured`, `email_not_configured`, `email_not_queued`), never a text, an address or a name.
 */
export interface AccountantPackageLastSend {
  period: string;
  at: string;
  result: 'sent' | 'failed';
  error: string | null;
}

export interface AccountantPackageSettings {
  enabled: boolean;
  email: string | null;
  sendDay: number;
  contents: string[];
  lastSend: AccountantPackageLastSend | null;
  updatedAt: string | null;
}

/**
 * What a save takes (`PUT api/accountant-package/settings`): every setting, as a whole. A field that is missing is refused (422 `accountant_package_settings_invalid`), never taken for a
 * value; an empty list of folders never means «all of them» (422 `accountant_package_contents_invalid`); `email` empty or `null` clears the address, and the monthly send cannot stay on
 * without one (422 `accountant_package_recipient_missing`).
 */
export interface SaveAccountantPackageSettingsRequest {
  enabled: boolean;
  email: string | null;
  sendDay: number;
  contents: string[];
}

export interface AccountantPackageEmailQueued {
  period: string;
  queued: true;
  linkExpiresAt: string;
}
