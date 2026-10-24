import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type {
  ConfigureRentScheduleInput,
  MarkRentPaidInput,
  PublicRentPayment,
  PublicRentPaymentSession,
  RentInstallment,
  RentLedger,
  RentRegisterPage,
  RentRegisterParams,
  RentReminderResult,
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

/**
 * The rent register of the long-term area (LR-01): the installments of every lease the landlord reaches, month by month, with
 * the numbers of the month, and the reminder the landlord sends by hand.
 */
export const rentRegisterApi = {
  /** A page of the month. `status` `All` is the plain register (no parameter). */
  getRegister: async (params: RentRegisterParams = {}): Promise<RentRegisterPage> => {
    const { status, ...rest } = params;
    const data = await ApiClient.get<unknown>('/long-rent/rents', { ...rest, status: status === 'All' ? undefined : status });
    if (typeof data !== 'object' || data === null || !Array.isArray((data as { items?: unknown }).items)) {
      throw new UnexpectedApiResponseError('/long-rent/rents');
    }
    return data as RentRegisterPage;
  },

  /** Emails the tenants of one installment now, with the optional short note of the landlord. Never automatic: only when this is called. */
  sendReminder: (installmentId: string, note?: string) =>
    ApiClient.post<RentReminderResult>(`/long-rent/rents/${encodeURIComponent(installmentId)}/reminder`, note ? { note } : undefined),
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
