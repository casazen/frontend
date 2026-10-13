import { ApiClient } from './client';
import type {
  ConfigureRentScheduleInput,
  MarkRentPaidInput,
  PublicRentPayment,
  PublicRentPaymentSession,
  RentInstallment,
  RentLedger,
} from '@/types';

/** Recurring rent of a lease (LT-06): schedule, installments, payment requests and offline payments. */
export const rentApi = {
  getLedger: (leaseId: string) => ApiClient.get<RentLedger>(`/leases/${encodeURIComponent(leaseId)}/rent`),

  configureSchedule: (leaseId: string, input: ConfigureRentScheduleInput) =>
    ApiClient.put<RentLedger>(`/leases/${encodeURIComponent(leaseId)}/rent/schedule`, input),

  disableSchedule: (leaseId: string) =>
    ApiClient.post<RentLedger>(`/leases/${encodeURIComponent(leaseId)}/rent/schedule/disable`),

  markPaid: (leaseId: string, installmentId: string, input: MarkRentPaidInput) =>
    ApiClient.post<RentInstallment>(
      `/leases/${encodeURIComponent(leaseId)}/rent/installments/${encodeURIComponent(installmentId)}/mark-paid`,
      input,
    ),

  /** Emails the payment link to the tenants now; the previous link stops working. */
  sendPaymentRequest: (leaseId: string, installmentId: string) =>
    ApiClient.post<RentInstallment>(
      `/leases/${encodeURIComponent(leaseId)}/rent/installments/${encodeURIComponent(installmentId)}/payment-request`,
    ),
};

/** The tenant's payment page (anonymous): the token of the link goes in the body, never in the URL of the API call. */
export const publicRentApi = {
  getPayment: (installmentId: string, token: string) =>
    ApiClient.post<PublicRentPayment>(
      `/public/rent-payments/${encodeURIComponent(installmentId)}`,
      { token },
      { public: true },
    ),

  createPaymentSession: (installmentId: string, token: string) =>
    ApiClient.post<PublicRentPaymentSession>(
      `/public/rent-payments/${encodeURIComponent(installmentId)}/payment-session`,
      { token },
      { public: true },
    ),
};
