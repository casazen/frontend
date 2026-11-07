import { UnexpectedApiResponseError } from '@/lib/api-errors';
import { ApiClient } from './client';
import type {
  BankColumnMapping,
  BankImportConfirmation,
  BankImportPreview,
  BankImportSelection,
  ConfigureRentScheduleInput,
  MarkRentPaidInput,
  PublicRentPayment,
  PublicRentPaymentSession,
  RentInstallment,
  RentLedger,
  RentRegisterPage,
  RentRegisterParams,
  RentReminderResult,
  RentWhatsAppReminder,
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

  /** Sends the approved template through the configured WhatsApp Business account. */
  sendWhatsAppReminder: (installmentId: string, note?: string) =>
    ApiClient.post<RentWhatsAppReminder>(`/long-rent/rents/${encodeURIComponent(installmentId)}/reminder/whatsapp`, note ? { note } : undefined),
};

/** Explicit multipart: the client's default JSON content type would serialize the FormData as JSON. */
const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

function statementForm(file: File, mapping?: BankColumnMapping, selections?: BankImportSelection[]): FormData {
  const form = new FormData();
  form.append('file', file);
  if (mapping) form.append('mapping', JSON.stringify(mapping));
  if (selections) form.append('selections', JSON.stringify(selections));
  return form;
}

/**
 * Import of a bank statement on the rents. The file is read twice by the server, to propose and to confirm, and never kept: the
 * confirmation sends it again with the choices, and the server reads amounts, dates and payers from the file itself.
 */
export const rentBankImportApi = {
  /** Reads the file and proposes, for each credit, the installment it pays. Nothing is written. */
  preview: async (file: File, mapping?: BankColumnMapping): Promise<BankImportPreview> => {
    const url = '/long-rent/rents/bank-import/preview';
    const data = await ApiClient.post<unknown>(url, statementForm(file, mapping), MULTIPART);
    const preview = data as Partial<BankImportPreview> | null;
    if (typeof data !== 'object' || preview === null || !Array.isArray(preview.suggestions) || !Array.isArray(preview.unmatched)) {
      throw new UnexpectedApiResponseError(url);
    }
    return data as BankImportPreview;
  },

  /** Declares paid the installments the landlord chose, each with the credit of the file it was matched to. */
  confirm: (file: File, selections: BankImportSelection[], mapping?: BankColumnMapping) =>
    ApiClient.post<BankImportConfirmation>('/long-rent/rents/bank-import/confirm', statementForm(file, mapping, selections), MULTIPART),
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
