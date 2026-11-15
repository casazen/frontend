/**
 * The agency summary of a period (E15/F01/US01/T01, E15/F02/US01/T01, NF-101, NF-115): the contract of `GET api/accountant-package/agency-summary` of the backend (`AccountantPackageController`,
 * `payment.read`, behind the flag `AccountantPackage`). It is the very summary the ZIP of the accountant holds in `riepilogo-agenzia/`, so the screen and the package never disagree.
 *
 * The words of the wire are stable codes, never a text to show (the kinds of document, the channels, the states): the screen translates them. The API writes the days as `yyyy-MM-dd` and every
 * amount as a number in the currency named beside it (a credit note is negative; a figure nobody reported is `null`, never zero). The figures of the stays, of the collections, of the costs of the
 * channels, of the Italian tourist tax and of the report by owner carry NO currency: the server adds the properties up as it counts them, so the client shows them without a symbol and says so.
 * The fields of the owner accounting are empty, and `ownerAccountingIncluded` is false, for a caller who may not read it (`agency.statement.view` and the whole organization).
 */

/** A taxable amount, its VAT and their total (a credit note is negative). */
export interface AgencyAmounts {
  taxable: number;
  vat: number;
  total: number;
}

/** Occupancy and revenue of the period as the Home counts them (by accrual, the tourist tax excluded). No currency: see the note of the file. */
export interface AgencyStays {
  occupiedNights: number;
  availableNights: number;
  /** Occupied over available, 0 to 1; `null` when nothing is available. */
  occupancyRate: number | null;
  revenue: number;
  stays: number;
  revenueNights: number;
  adr: number | null;
  revPar: number | null;
}

/** What is still to collect in one currency. */
export interface AgencyBalance {
  currency: string;
  amount: number;
  stays: number;
}

/** What was collected in the period (by cash, net of refunds; no currency) and what is still to collect for each currency. */
export interface AgencyCollections {
  collected: number;
  payments: number;
  toCollect: AgencyBalance[];
}

/** An issuer of fiscal documents. */
export interface AgencyIssuer {
  name: string;
  /** `IT` or `CH`. */
  countryCode: string;
  taxId: string | null;
}

/** The documents an issuer made for the guests, for one kind and currency. */
export interface AgencyGuestDocuments {
  issuer: AgencyIssuer;
  /** `invoice`, `receipt` or `creditNote` (negative amounts). */
  kind: string;
  currency: string;
  documents: number;
  amounts: AgencyAmounts;
}

/** What a channel costs in the period; the row with a `null` `source` is the server's total (it adds the properties up with no conversion). No currency. */
export interface AgencyPortalCost {
  /** The channel (`bookingCom`, `airbnb`, `direct`...); `null` for the total. */
  source: string | null;
  /** `channelCommission`, `paymentFee` or `noCost`; `null` for the total. */
  kind: string | null;
  stays: number;
  gross: number;
  /** The cost the channel manager or the provider reported; `null` when nobody did (never zero). */
  cost: number | null;
  net: number | null;
  /** The cost over the gross of the stays that report it, 0 to 1. */
  costRate: number | null;
}

/** The Italian tourist tax: what the stays record as due, what was remitted and what is left (`null` for a caller who reaches only some properties). No currency. */
export interface AgencyItalianTouristTax {
  owed: number;
  paid: number | null;
  toRemit: number | null;
  /** The stays with no amount recorded: above zero, `owed` may be incomplete. */
  staysWithoutAmount: number;
}

/** The Swiss tourist tax the documents collected for a canton in a currency (an empty canton when the property has no municipality). */
export interface AgencySwissTouristTax {
  canton: string;
  currency: string;
  documents: number;
  collected: number;
}

export interface AgencyTouristTax {
  italy: AgencyItalianTouristTax;
  switzerland: AgencySwissTouristTax[];
}

/** The commission the agency earned from one owner in a currency, as the invoices of the period say it (owner accounting). */
export interface AgencyCommission {
  ownerId: string;
  /** `null` for an owner whose data was anonymized. */
  ownerName: string | null;
  currency: string;
  documents: number;
  commission: AgencyAmounts;
  recharges: AgencyAmounts;
  /** The expenses advanced in the name of the owner, outside the VAT. */
  advancedExpenses: number;
  invoicedTotal: number;
}

/** How many invoices and credit notes were issued to the owners in a currency. */
export interface AgencyOwnerInvoiceCount {
  currency: string;
  invoices: number;
  creditNotes: number;
}

/** One VAT rate of a set of documents. */
export interface AgencyRate {
  currency: string;
  /** The rate in percent; `0` with a nature code for an operation without VAT; `null` when a document does not state it. */
  ratePercent: number | null;
  natureCode: string | null;
  amounts: AgencyAmounts;
}

/** The invoices of the agency to the owners issued in the period (owner accounting). */
export interface AgencyOwnerInvoices {
  counts: AgencyOwnerInvoiceCount[];
  /** The totals for each currency and VAT rate, credit notes taken away. */
  rates: AgencyRate[];
}

/** The payouts to the owners paid on a day of the period, in a currency (owner accounting). */
export interface AgencyPayout {
  currency: string;
  payouts: number;
  gross: number;
  withholding: number;
  net: number;
}

/** The wire batches made in the period in a currency and a state (owner accounting). */
export interface AgencyWire {
  currency: string;
  /** `generated`, `downloaded` or `paid`. */
  status: string;
  batches: number;
  transfers: number;
  total: number;
}

/** The portal commissions of the listings whose account the agency holds, for one channel and currency, for information (owner accounting). */
export interface AgencyPortalCommissionBorne {
  source: string;
  currency: string;
  amount: number;
}

/** The margin of the agency in a currency: commissions and recharges invoiced, less the portal commissions it bears (owner accounting). */
export interface AgencyMargin {
  currency: string;
  commissions: number;
  recharges: number;
  portalCommissionsBorne: number;
  margin: number;
}

/** The performance of the properties of one owner, weighted by the share it holds (owner accounting); `ownerId` is `null` for the properties nobody owns. No currency. */
export interface AgencyOwnerRevenue {
  ownerId: string | null;
  /** `null` for an owner whose data was anonymized and for the row of the properties nobody owns. */
  ownerName: string | null;
  anonymized: boolean;
  properties: number;
  revenue: number;
  occupiedNights: number;
  availableNights: number;
  occupancyRate: number | null;
  stays: number;
}

/** The summary of the agency for a month (`2026-10`) or a year (`2026`). */
export interface AgencySummary {
  /** The period as asked: `2026-10` or `2026`. */
  period: string;
  /** `month` or `year` (the summary of a year is the annual summary of the commissions). */
  periodKind: string;
  from: string;
  to: string;
  /** The day the figures were read (Europe/Rome). */
  generatedOn: string;
  /** False when the caller may not read the owner accounting: the owner fields are empty. */
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

/**
 * The folders of the package the monthly send can hold, by the keys of the contract (backend `AccountantPackageFolderRules.KeyOf`), in the order of the package. They are stable codes, never
 * texts to show: the screen has its own words for each.
 */
export const ACCOUNTANT_PACKAGE_FOLDERS = ['guestDocuments', 'ownerInvoices', 'statements', 'agencySummary', 'vat', 'withholding', 'touristTax', 'collections'] as const;
export type AccountantPackageFolder = (typeof ACCOUNTANT_PACKAGE_FOLDERS)[number];

/** The first and the last day of the month the monthly send can be due on (`AccountantPackageSettings.MinSendDay`, `MaxSendDay`): every month has the 28th. */
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

/**
 * How the package is sent (`GET api/accountant-package/settings`): the address of the accountant (`null` when there is none), whether the package goes every month, the day of the month
 * it is due (1 to 28, Europe/Rome), the folders by their keys, and the last attempt (`null` before the first). An organization that saved nothing has the defaults of the server: no address, the
 * send off, the day 3 and every folder. `contents` are strings and not the union of the folders: the server may be newer than the app.
 */
export interface AccountantPackageSettings {
  enabled: boolean;
  email: string | null;
  sendDay: number;
  contents: string[];
  lastSend: AccountantPackageLastSend | null;
  /** When a person saved the settings last (UTC); `null` for an organization that saved none. */
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

/**
 * What a test send answers (`POST api/accountant-package/send`): the month of the package (the previous one) and the last instant (UTC) its link opens. The e-mail is in the queue of the
 * e-mails, never that it was delivered; no address and no link are in the answer.
 */
export interface AccountantPackageEmailQueued {
  period: string;
  queued: true;
  linkExpiresAt: string;
}
