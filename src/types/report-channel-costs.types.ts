import type { ReportPeriodInfo } from './report.types';

/**
 * The channel costs report of the host (NF-98): `GET /api/reports/channel-costs`. Field for field the JSON of the backend
 * (`ChannelCostsReportDtos.cs`). By accrual, like the revenue of the Home. A cost nobody reported is null, never zero: the page says
 * "not available", and the stays without a reported cost are counted apart. Amounts come in euros to the cent and in cents (exact): the
 * page shows the cents and works out nothing.
 */

/** What the cost of a row is: the commission of a channel, the card fees of the direct stays (a line of their own), or nothing at all. */
export type ChannelCostKind = 'ChannelCommission' | 'PaymentFee' | 'NoCost';

/** How the commission of a channel is settled, from the settings of its portal; `Unknown` claims nothing. */
export type ChannelCommissionMode = 'DeductedFromPayout' | 'InvoicedSeparately' | 'Unknown';

/** What one channel costs (or, for the total, every channel together: its `source`, `kind` and `commissionMode` are null). */
export interface ChannelCostRow {
  /** The channel, the name of the booking source (`Direct`, `Manual`, `Airbnb`, `BookingCom`, ...); null for the total. */
  source: string | null;
  kind: ChannelCostKind | null;
  /** The confirmed stays with a night in the period. */
  stayCount: number;
  /** The Home's revenue of those stays, pro rata per night. */
  gross: number;
  grossCents: number;
  /** What the stays that report a cost cost, pro rata; null (not available) when none of them does. */
  commission: number | null;
  commissionCents: number | null;
  /** What is left of the stays whose cost is known; null when no stay has either. */
  net: number | null;
  netCents: number | null;
  /** The cost over the gross of the stays that report it, from 0 to 1 to four decimals; null when no stay reports a cost. */
  costRate: number | null;
  /** Null where it does not apply (not a channel, and the total). */
  commissionMode: ChannelCommissionMode | null;
  /** The stays whose cost was not reported: counted apart, never taken as free. */
  staysWithoutCommission: number;
  /** True for the row with the highest cost rate (at most one, never a rate of zero). */
  mostExpensive: boolean;
}

/** `GET /api/reports/channel-costs`. */
export interface ChannelCostsReport {
  title: string;
  /** Always `accrual`. */
  basis: string;
  period: ReportPeriodInfo;
  /** The channels with a stay in the period, by cost rate, the highest first (the ones without a rate last). */
  rows: ChannelCostRow[];
  /** Every channel together: the Home's revenue of the same days as its gross and the costs that are known as its commission. */
  total: ChannelCostRow;
}
