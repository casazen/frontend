import type { ReportPeriodInfo } from './report.types';

/**
 * The channel costs report of the host (NF-98): `GET /api/reports/channel-costs`. Field for field the JSON of the backend
 * (`ChannelCostsReportDtos.cs`). By accrual, like the revenue of the Home. A cost nobody reported is null, never zero: the page says
 * "not available", and the stays without a reported cost are counted apart. Amounts come in euros to the cent and in cents (exact): the
 * page shows the cents and works out nothing.
 */

type ChannelCostKind = 'ChannelCommission' | 'PaymentFee' | 'NoCost';

export type ChannelCommissionMode = 'DeductedFromPayout' | 'InvoicedSeparately' | 'Unknown';

export interface ChannelCostRow {
  source: string | null;
  kind: ChannelCostKind | null;
  stayCount: number;
  gross: number;
  grossCents: number;
  commission: number | null;
  commissionCents: number | null;
  net: number | null;
  netCents: number | null;
  costRate: number | null;
  commissionMode: ChannelCommissionMode | null;
  staysWithoutCommission: number;
  mostExpensive: boolean;
}

export interface ChannelCostsReport {
  title: string;
  basis: string;
  period: ReportPeriodInfo;
  rows: ChannelCostRow[];
  total: ChannelCostRow;
}
