/** The tabs of `GET /supplier/earnings`: they may overlap (a late payment is also to collect). */
export type SupplierEarningsTab = 'tutti' | 'da-incassare' | 'pagati' | 'in-ritardo' | 'da-verificare';

/** The filters of `GET /supplier/earnings` and of its export: `from` and `to` are Europe/Rome days (`YYYY-MM-DD`, both included). */
export interface SupplierEarningsParams {
  tab?: SupplierEarningsTab;
  from?: string;
  to?: string;
  /** Only the jobs of one customer: the `id` of `GET /supplier/clients` and the `clientId` of the inbox. */
  clientId?: string;
  page?: number;
  pageSize?: number;
}

/** One completed or paid job with its money. Every amount is in cents and made by the server: no screen computes a commission or a net. */
export interface SupplierEarning {
  /** The request: the same id as `GET /supplier/inbox/{id}`. */
  requestId: string;
  serviceName?: string | null;
  category: string;
  clientId: string;
  /** The customer as the supplier sees it for a taken job; `null` when the customer was removed (`clientAnonymized`). */
  clientLabel?: string | null;
  clientAnonymized: boolean;
  /** UTC instant. */
  completedAt?: string | null;
  /**
   * `to_collect`, `paid`, `late`, `in_review`, `refunded` or `partially_refunded`: an open set. The held payments will add values
   * (blocked, held, released, in dispute): a value this version does not know is shown with a generic word.
   */
  state: string;
  /** `Online` (paid inside CasaZen, with the commission) or `Manual` (paid outside, no commission). */
  paymentMode: string;
  /** What the payer pays; empty while the supplier declared nothing: never 0. */
  grossCents?: number | null;
  /** The percentage the payment was created with; 0 for a `Manual` job; empty while an `Online` job has no payment. */
  commissionPercent?: number | null;
  /** What CasaZen keeps (0 when none is charged); empty where the percentage is. */
  commissionCents?: number | null;
  /** What the supplier receives before Stripe's own fees (gross minus commission); empty where the commission is. */
  netCents?: number | null;
  paidAt?: string | null;
  /** `Stripe`, or `Offline` (paid outside CasaZen); empty until it is paid. */
  paidVia?: string | null;
  /** What was given back to the payer so far; the net is not rewritten. */
  refundedCents: number;
  /** When the payment was flagged late; only on a `late` row. */
  lateSince?: string | null;
}

export interface SupplierEarningsMonth {
  /** `yyyy-MM` (Europe/Rome). */
  month: string;
  netCents: number;
}

/** The figures above the list, independent of the tab, the period and the customer of the list. */
export interface SupplierEarningsSummary {
  /** What is still to be collected, in net, and how many jobs: the same figure as the home. */
  toCollectNetCents: number;
  toCollectJobs: number;
  /** The net of the payments paid with a payment date in the current month (Europe/Rome), and the commission CasaZen kept on them. */
  paidThisMonthNetCents: number;
  commissionThisMonthCents: number;
  /** Payments asked for that are late and still owed. */
  lateCount: number;
  /** The net paid in each of the last eight months, the current one last. */
  series: SupplierEarningsMonth[];
  /** The commission that applies to a payment created now; `freeUntil` ends a free period (empty when there is none). */
  commission: { percent: number; freeUntil?: string | null };
  /** The flag is on and the supplier has at least one payment. */
  onlinePayments: boolean;
}

/** A page of `GET /supplier/earnings`: the completed and paid jobs with their money, the newest first, and the figures above them. */
export interface SupplierEarningsResponse {
  items: SupplierEarning[];
  total: number;
  page: number;
  pageSize: number;
  timeZone: string;
  summary: SupplierEarningsSummary;
}
