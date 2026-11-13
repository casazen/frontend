import type { ReportPeriodInfo } from './report.types';

/**
 * The collections report of the host (NF-97): `GET /api/reports/collections` and `GET /api/reports/balances-to-collect`. Field for field the
 * JSON of the backend (`HostCollectionsReportDtos.cs`). Every amount is given twice by the server, in euros to the cent and in cents
 * (exact): the page shows the cents and works out nothing, adds nothing up and never rounds. A figure the server does not have is null
 * (or `available: false`): the page says "not available", never zero.
 */

/** The money that came in over the whole period: the Home's "incassato" for the same days (cash, net of refunds). */
export interface CollectionsTotal {
  amount: number;
  amountCents: number;
  paymentCount: number;
}

/** One day (periods of up to 92 days) or one month (longer) of the money collected: a day without payments is a real zero. */
export interface CollectionsBucket {
  unit: 'day' | 'month';
  /** A stable key, never text to show: `2026-10-09` or `2026-10`. */
  label: string;
  /** First day of the bucket, a Europe/Rome calendar date (`yyyy-MM-dd`). */
  from: string;
  /** Last day of the bucket, included. */
  to: string;
  amount: number;
  amountCents: number;
  paymentCount: number;
}

/** The money collected with one payment method (`CreditCard`, `BankTransfer`, `PayPal`, `ApplePay`, `GooglePay`, `CashOnArrival`). */
export interface CollectionsMethodRow {
  method: string;
  amount: number;
  amountCents: number;
  paymentCount: number;
  /** The part of the total, from 0 to 1 to four decimals; null when the total is zero. */
  share: number | null;
}

/** The money collected for the stays of one channel (the booking source: `Direct`, `Manual`, `Airbnb`, `BookingCom`, ...). */
export interface CollectionsChannelRow {
  source: string;
  amount: number;
  amountCents: number;
  paymentCount: number;
  /** The part of the total, from 0 to 1 to four decimals; null when the total is zero. */
  share: number | null;
}

/** `Credited` when the arrival day has come, `Expected` while it is still ahead. */
export type StripeCreditStatus = 'Credited' | 'Expected';

/** The card payments credited on one day, in one currency: the day's credits, not a bank payout (the provider's payout id is not stored). */
export interface StripeCreditRow {
  /** The day the funds are credited (`yyyy-MM-dd`). */
  arrivalDate: string;
  currency: string;
  amount: number;
  amountCents: number;
  paymentCount: number;
  status: StripeCreditStatus;
}

export interface StripeCredits {
  /** False when no payment has stored figures to show for the period. */
  available: boolean;
  payouts: StripeCreditRow[];
  /** The card payments collected in the period. */
  cardPaymentCount: number;
  /** Of them, the payments whose figures were not stored (yet): they are in no row. */
  paymentsWithoutFigures: number;
}

/** What the channel manager reports as the net amount of the stays one channel collected itself: reported, never a bank credit, with no date. */
export interface ChannelCreditRow {
  source: string;
  currency: string;
  amount: number;
  amountCents: number;
  stayCount: number;
}

export interface ChannelCredits {
  /** False when no stay has a reported net amount. */
  available: boolean;
  /** Always `channelManager`: where the figures come from. */
  reportedBy: string;
  rows: ChannelCreditRow[];
  /** The stays the channel collected for which the channel manager reported no net amount. */
  staysWithoutNet: number;
}

export interface CollectionsCredits {
  stripe: StripeCredits;
  channels: ChannelCredits;
}

/** `GET /api/reports/collections`: the money that came in by date, by payment method and by channel, and what reached the account. */
export interface CollectionsReport {
  title: string;
  /** Always `cash`: the day the money came in, not the nights of the stay it pays. */
  basis: string;
  period: ReportPeriodInfo;
  total: CollectionsTotal;
  byDate: CollectionsBucket[];
  byMethod: CollectionsMethodRow[];
  byChannel: CollectionsChannelRow[];
  credits: CollectionsCredits;
}

/** Where the figures of a balance come from: CasaZen's own payments, or the balance the channel manager reported. */
export type BalanceBasis = 'Payments' | 'ChannelManager';

/** A stay with something still to collect. A money report never carries a guest: no name, no contact. */
export interface BalanceRow {
  bookingId: string;
  /** The booking code as the host reads it (`XXXXX-XXXXX`). */
  bookingCode: string;
  propertyId: string;
  propertyName: string;
  /** The channel, the name of the booking source. */
  source: string;
  checkIn: string;
  checkOut: string;
  /** The currency of the property: every amount of the row is in it. */
  currency: string;
  /** What the stay costs; null for a channel reservation that gave no price (not available). */
  total: number | null;
  totalCents: number | null;
  /** What came in; null for a channel reservation that did not report the paid amount (not available, never derived). */
  collected: number | null;
  collectedCents: number | null;
  /** What is still to collect: always above zero. */
  toCollect: number;
  toCollectCents: number;
  /** The check-out day is already past (Europe/Rome). */
  overdue: boolean;
  basis: BalanceBasis;
}

/** What is to collect in one currency: the amounts of two currencies are never added. */
export interface BalanceTotal {
  currency: string;
  amount: number;
  amountCents: number;
  stayCount: number;
}

/** `GET /api/reports/balances-to-collect`: the stays that still have something to collect, as of today. */
export interface BalancesToCollectReport {
  title: string;
  /** Always `balances`. */
  basis: string;
  /** The day the balances are read (today in Europe/Rome): what `overdue` is judged on. */
  asOf: string;
  /** The first check-out day listed (24 months before `asOf`): a stay that ended before it is out of the horizon of the report. */
  since: string | null;
  /** By check-in. */
  rows: BalanceRow[];
  /** One entry for each currency of the rows. */
  totals: BalanceTotal[];
}
