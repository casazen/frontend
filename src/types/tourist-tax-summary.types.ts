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
