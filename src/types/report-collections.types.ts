import type { ReportPeriodInfo } from './report.types';

/**
 * The collections report of the host (NF-97): `GET /api/reports/collections` and `GET /api/reports/balances-to-collect`. Field for field the
 * JSON of the backend (`HostCollectionsReportDtos.cs`). Every amount is given twice by the server, in euros to the cent and in cents
 * (exact): the page shows the cents and works out nothing, adds nothing up and never rounds. A figure the server does not have is null
 * (or `available: false`): the page says "not available", never zero.
 */

export interface CollectionsTotal {
  amount: number;
  amountCents: number;
  paymentCount: number;
}

export interface CollectionsBucket {
  unit: 'day' | 'month';
  label: string;
  from: string;
  to: string;
  amount: number;
  amountCents: number;
  paymentCount: number;
}

interface CollectionsMethodRow {
  method: string;
  amount: number;
  amountCents: number;
  paymentCount: number;
  share: number | null;
}

interface CollectionsChannelRow {
  source: string;
  amount: number;
  amountCents: number;
  paymentCount: number;
  share: number | null;
}

type StripeCreditStatus = 'Credited' | 'Expected';

interface StripeCreditRow {
  arrivalDate: string;
  currency: string;
  amount: number;
  amountCents: number;
  paymentCount: number;
  status: StripeCreditStatus;
}

export interface StripeCredits {
  available: boolean;
  payouts: StripeCreditRow[];
  cardPaymentCount: number;
  paymentsWithoutFigures: number;
}

interface ChannelCreditRow {
  source: string;
  currency: string;
  amount: number;
  amountCents: number;
  stayCount: number;
}

export interface ChannelCredits {
  available: boolean;
  reportedBy: string;
  rows: ChannelCreditRow[];
  staysWithoutNet: number;
}

export interface CollectionsCredits {
  stripe: StripeCredits;
  channels: ChannelCredits;
}

export interface CollectionsReport {
  title: string;
  basis: string;
  period: ReportPeriodInfo;
  total: CollectionsTotal;
  byDate: CollectionsBucket[];
  byMethod: CollectionsMethodRow[];
  byChannel: CollectionsChannelRow[];
  credits: CollectionsCredits;
}

type BalanceBasis = 'Payments' | 'ChannelManager';

export interface BalanceRow {
  bookingId: string;
  bookingCode: string;
  propertyId: string;
  propertyName: string;
  source: string;
  checkIn: string;
  checkOut: string;
  currency: string;
  total: number | null;
  totalCents: number | null;
  collected: number | null;
  collectedCents: number | null;
  toCollect: number;
  toCollectCents: number;
  overdue: boolean;
  basis: BalanceBasis;
}

export interface BalanceTotal {
  currency: string;
  amount: number;
  amountCents: number;
  stayCount: number;
}

export interface BalancesToCollectReport {
  title: string;
  basis: string;
  asOf: string;
  since: string | null;
  rows: BalanceRow[];
  totals: BalanceTotal[];
}
