import { ApiClient } from '@/api/client';
import type { SupplierPaymentsAccount, SupplierPaymentsLink } from '@/types/supplier-payments';

const BASE = '/supplier/payments';

/**
 * The state of the supplier's Stripe account (SP-14). Without `refresh` the server answers from what it has; with it, it reads
 * the account from Stripe first, which is what the page Stripe sends the supplier back to asks for. 404 while online payments
 * are not active on the server (the endpoints are behind `SupplierOnlinePayments`, which answers like a missing route).
 */
export async function fetchSupplierPaymentsAccount(refresh: boolean): Promise<SupplierPaymentsAccount> {
  return ApiClient.get<SupplierPaymentsAccount>(`${BASE}/account`, refresh ? { refresh: true } : undefined);
}

/**
 * The Stripe address of the onboarding (the account is created on the way when missing). The return and refresh pages are the
 * ones the server builds: the client never says where Stripe sends the supplier back.
 */
export async function createSupplierOnboardingLink(): Promise<SupplierPaymentsLink> {
  return ApiClient.post<SupplierPaymentsLink>(`${BASE}/onboarding-link`);
}

/** The single-use address of the supplier's Express Dashboard on Stripe; 422 `supplier_payments_not_ready` without a ready account. */
export async function createSupplierDashboardLink(): Promise<SupplierPaymentsLink> {
  return ApiClient.post<SupplierPaymentsLink>(`${BASE}/dashboard-link`);
}
