// Tourist tax per comune and period (backend `GET /api/tourist-tax/summary`, NF-100, REP-05): what the stays owe, what the host paid and
// the receipts. Every amount is the server's, in euros to the cent and again in whole cents (`*Cents`, exact): the page adds nothing up.

/**
 * Where a comune stands in the period (backend `TouristTaxSummaryStatus`). `NothingOwed` says that no amount is recorded, not that
 * nothing is due: a stay with no recorded tax is counted apart (`staysWithoutAmount`) and is never a tax of zero.
 */
export type TouristTaxSummaryStatus = 'NothingOwed' | 'ToPay' | 'Paid' | 'Overpaid';

/** One payment of the tourist tax to a comune, as the host recorded it. */
export interface TouristTaxRemittance {
  id: string;
  /** The comune as the host typed it. */
  comune: string;
  /** First day of the period the payment pays (`YYYY-MM-DD`, Europe/Rome). */
  periodFrom: string;
  /** Last day of that period, included. */
  periodTo: string;
  amount: number;
  amountCents: number;
  /** The day it was paid (`YYYY-MM-DD`). */
  paidOn: string;
  reference: string | null;
  notes: string | null;
  /** A receipt is stored: `GET /api/tourist-tax/remittances/{id}/receipt` downloads it. */
  hasReceipt: boolean;
}

/**
 * One comune of the summary. `paid`, `balance`, `status` and `remittances` (with their cents) are `null` when the summary hides the
 * payments (`TouristTaxSummary.paymentsHidden`): they belong to the org, so a caller who reaches only some properties sees none.
 */
export interface TouristTaxComuneSummary {
  comune: string;
  stays: number;
  nights: number;
  guests: number;
  /** The tax the engine recorded on the stays of the period. */
  owed: number;
  owedCents: number;
  /** Stays with no tax recorded, counted apart: above zero, `owed` may be incomplete. */
  staysWithoutAmount: number;
  paid: number | null;
  paidCents: number | null;
  /** `owed` minus `paid`; negative when more was paid than is owed. */
  balance: number | null;
  balanceCents: number | null;
  status: TouristTaxSummaryStatus | null;
  remittances: TouristTaxRemittance[] | null;
}

/** The sums of the comuni; `paid`, `balance` and their cents are `null` while the payments are hidden. */
export interface TouristTaxSummaryTotals {
  stays: number;
  nights: number;
  guests: number;
  owed: number;
  owedCents: number;
  staysWithoutAmount: number;
  paid: number | null;
  paidCents: number | null;
  balance: number | null;
  balanceCents: number | null;
}

export interface TouristTaxSummary {
  /** The name of the summary with its base, in Italian: the one of the CSV file. */
  title: string;
  /** Always `recorded`: what the engine recorded on the stays and what the host recorded as paid, nothing estimated. */
  basis: string;
  currency: string;
  /** The caller reaches only some of the properties: the summary is the owed side of those, with no payment at all. */
  paymentsHidden: boolean;
  /** The days it covers (`YYYY-MM-DD`, both included). */
  period: { from: string; to: string };
  comuni: TouristTaxComuneSummary[];
  total: TouristTaxSummaryTotals;
}

// The tourist tax at year end (E18/F01/US02/T03, NF-117): the three reads of `GET /api/tourist-tax/year-end/{year}/declaration|agent-account|ticino?format=json`, the very data of the CSV and Excel files of the same addresses.
// Every amount is a number in the `currency` of the answer, to the cent (the euro of the Italian tax; the currency of the property for the count of Ticino): the page adds nothing up and works no reason out.

/**
 * A reason with the stays, the guests and the nights it counts (backend `TouristTaxReasonCountDto`). `reason` is the server's word, a code that is never renamed: the page tells it in words and never decides one.
 */
export interface TouristTaxReasonCount {
  reason: string;
  stays: number;
  guests: number;
  /** The nights of the stay for each guest, added up. */
  guestNights: number;
}

/** One comune of the declaration of the year. */
export interface TouristTaxDeclarationComune {
  /** The comune in the year as `GET summary` gives it, with the payments always there: the year-end reads need the whole organization. */
  summary: TouristTaxComuneSummary;
  /** Stays with a recorded amount above zero. */
  taxedStays: number;
  /** The stays with no amount, by reason (`exempt`, `collected_by_channel`, `not_calculated`, `no_tax_due`): their sum is `summary.staysWithoutAmount`. */
  staysWithoutAmount: TouristTaxReasonCount[];
  /**
   * The exempt guests by reason, a count and never a guest. The reason can reveal a health condition (art. 9 GDPR), so the server decides who gets it: a caller who holds `guest.read` for the whole organization
   * gets the codes of the catalogue (`resident`, `health_care`...) or `erased`; everybody else gets `minor_age` (the age) and one `restricted` row that counts the other exempt guests.
   */
  exemptions: TouristTaxReasonCount[];
}

/** The annual declaration data of the tourist tax per comune (backend `TouristTaxDeclarationDto`). */
export interface TouristTaxDeclaration {
  year: number;
  /** Always the euro: only the properties in Italy are in the declaration. */
  currency: string;
  comuni: TouristTaxDeclarationComune[];
  total: TouristTaxSummaryTotals;
}

/** How the account of the agent is cut, as the server names it (the `by` of the request is `month` or `quarter`). */
export type TouristTaxAccountPeriod = 'Month' | 'Quarter';

/** One comune in one period of the account of the agent, or in the whole year (`isYear`). */
export interface TouristTaxAgentAccountRow {
  comune: string;
  /** The label of the period: `2026-03`, `2026-Q1`, or the year for the line of the year. */
  period: string;
  /** First day of the period (`YYYY-MM-DD`). */
  from: string;
  /** Last day of the period, included. */
  to: string;
  isYear: boolean;
  stays: number;
  nights: number;
  guests: number;
  /** The tax the stays record as owed to the comune in the period: the tax the agent collects. */
  collected: number;
  /** Stays with no amount, counted apart: above zero, `collected` may be incomplete. */
  staysWithoutAmount: number;
  /** The payments whose declared period lies inside the period. */
  remitted: number;
  /** `collected` less `remitted`. */
  balance: number;
}

/** The account of the agent («conto giudiziale») for the year (backend `TouristTaxAgentAccountDto`). */
export interface TouristTaxAgentAccount {
  year: number;
  by: TouristTaxAccountPeriod;
  /** Always the euro. */
  currency: string;
  /** The comuni, by name, each with its periods in order and, last, the line of the year. */
  rows: TouristTaxAgentAccountRow[];
  /** Every payment of the year, by comune and period. */
  remittances: TouristTaxRemittance[];
  total: TouristTaxSummaryTotals;
}

/** The count of the nights of one property in Ticino (backend `TicinoPropertyCountDto`). */
export interface TicinoPropertyCount {
  propertyId: string;
  propertyName: string;
  address: string;
  city: string;
  /** The Swiss municipality code stored on the property; `null` when there is none. */
  municipalityCode: string | null;
  /** The currency of the property and of `touristTax`: the franc for a house in Switzerland. */
  currency: string;
  stays: number;
  nights: number;
  taxedStays: number;
  taxedNights: number;
  untaxedStays: number;
  untaxedNights: number;
  /** Stays with no document issued yet: told apart, never counted as untaxed. */
  staysWithoutDocument: number;
  nightsWithoutDocument: number;
  /** The tourist tax of the issued documents of those stays, credit notes taken away, in `currency`: never a calculation. */
  touristTax: number;
  /** A property in Switzerland whose canton is not known (no Swiss municipality on it, or one the registry lacks): it may be in Ticino, so it is counted and flagged. */
  cantonUnknown: boolean;
}

/** The yearly count of the nights of the properties in Ticino for the regional tourist organization (backend `TicinoYearlyCountDto`). */
export interface TicinoYearlyCount {
  year: number;
  /** The day the count is due: 5 January of the next year (`YYYY-MM-DD`). */
  dueDate: string;
  /** How many of the properties have a canton that is not known: the server says it, so the screen does not count. */
  cantonUnknownCount: number;
  properties: TicinoPropertyCount[];
}

/** What the host sends to record a payment (`POST /api/tourist-tax/remittances`, `multipart/form-data`). */
export interface RecordTouristTaxRemittanceInput {
  /** One of the comuni of the properties of the org, in Italy. */
  comune: string;
  periodFrom: string;
  periodTo: string;
  /**
   * Euros as text with a dot and at most two decimals (`12.50`), never a number: the server reads a form with the culture of the request,
   * where the Italian dot is a thousands separator and `12.50` would be 1250.
   */
  paidAmount: string;
  paidOn: string;
  reference?: string;
  notes?: string;
  /** A PDF, a JPEG or a PNG of at most 10 MB. */
  receipt?: File | null;
}
