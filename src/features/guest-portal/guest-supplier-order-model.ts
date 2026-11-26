import { supplierOrderState } from './guest-supplier-order-copy';

export interface GuestSupplierOrder {
  id: string;
  serviceName: string;
  supplierName: string;
  state: string;
  requestedFor: string;
  completedAt: string | null;
  supplierPriceCents: number;
  commissionCents: number;
  totalCents: number;
  refundCents: number;
  refundStatus?: 'processing' | 'failed' | 'review' | 'succeeded' | 'not_requested' | null;
  refundRequestedCents?: number;
  bankDisputeStatus?: 'open' | 'lost' | 'closed' | 'recovery_pending' | null;
  hostOrigin: boolean;
  stripeSandbox?: boolean;
  stripeDeferred?: boolean;
  requestNote: string | null;
  complaint: string | null;
  supplierReply: string | null;
  decision: string | null;
}

/** Poll visible order lists while the other party can still change the outcome. */
export const GUEST_ORDER_REFRESH_MS = 15_000;

export function orderNeedsUpdates(order: GuestSupplierOrder): boolean {
  return ['PendingQuote', 'Quoted', 'Authorized', 'CardSaved', 'PaymentActionRequired', 'PaymentFailed', 'PaymentProcessing', 'Accepted', 'Disputed'].includes(order.state);
}

export const orderStatus = (state: string, language = 'it') => supplierOrderState(state, language);
export const orderMoney = (cents: number, language = 'it') =>
  new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(cents / 100);
