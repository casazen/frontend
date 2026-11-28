export type SupplierEarningsTab = 'tutti' | 'da-incassare' | 'pagati' | 'in-ritardo' | 'da-verificare';

export type SupplierEarningState = 'to_collect' | 'paid' | 'late' | 'in_review' | 'refunded' | 'partially_refunded';

export interface SupplierEarningsParams {
  tab?: SupplierEarningsTab;
  from?: string;
  to?: string;
  clientId?: string;
  page?: number;
  pageSize?: number;
}

export interface SupplierEarning {
  requestId: string;
  serviceName?: string | null;
  category: string;
  clientId: string;
  clientLabel?: string | null;
  clientAnonymized: boolean;
  completedAt?: string | null;
  state: string;
  paymentMode: string;
  grossCents?: number | null;
  commissionPercent?: number | null;
  commissionCents?: number | null;
  netCents?: number | null;
  paidAt?: string | null;
  paidVia?: string | null;
  refundedCents: number;
  lateSince?: string | null;
}

interface SupplierEarningsMonth {
  month: string;
  netCents: number;
}

interface SupplierEarningsSummary {
  toCollectNetCents: number;
  toCollectJobs: number;
  paidThisMonthNetCents: number;
  commissionThisMonthCents: number;
  lateCount: number;
  series: SupplierEarningsMonth[];
  commission: { percent: number; freeUntil?: string | null };
  onlinePayments: boolean;
}

export interface SupplierEarningsResponse {
  items: SupplierEarning[];
  total: number;
  page: number;
  pageSize: number;
  timeZone: string;
  summary: SupplierEarningsSummary;
}
