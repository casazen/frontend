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
  hostOrigin: boolean;
  requestNote: string | null;
  complaint: string | null;
  supplierReply: string | null;
  decision: string | null;
}

export const orderStatus = (state: string, language = 'it') => supplierOrderState(state, language);
export const orderMoney = (cents: number, language = 'it') =>
  new Intl.NumberFormat(language, { style: 'currency', currency: 'EUR' }).format(cents / 100);
