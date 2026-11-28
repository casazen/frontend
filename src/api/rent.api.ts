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

  sendPaymentRequest: (leaseId: string, installmentId: string) =>
    ApiClient.post<RentInstallment>(
      `/leases/${encodeURIComponent(leaseId)}/rent/installments/${encodeURIComponent(installmentId)}/payment-request`,
    ),

  sendCondominiumNotice: (leaseId: string, noticeId: string, channels: Array<'Email' | 'WhatsApp'>) =>
    ApiClient.post<void>(
      `/leases/${encodeURIComponent(leaseId)}/condominium-notices/${encodeURIComponent(noticeId)}/send`,
      { channels },
    ),
};

export const rentRegisterApi = {
  getRegister: async (params: RentRegisterParams = {}): Promise<RentRegisterPage> => {
    const { status, ...rest } = params;
    const data = await ApiClient.get<unknown>('/long-rent/rents', { ...rest, status: status === 'All' ? undefined : status });
    if (typeof data !== 'object' || data === null || !Array.isArray((data as { items?: unknown }).items)) {
      throw new UnexpectedApiResponseError('/long-rent/rents');
    }
    return data as RentRegisterPage;
  },

  sendReminder: (installmentId: string, note?: string) =>
    ApiClient.post<RentReminderResult>(`/long-rent/rents/${encodeURIComponent(installmentId)}/reminder`, note ? { note } : undefined),

  sendWhatsAppReminder: (installmentId: string, note?: string) =>
    ApiClient.post<RentWhatsAppReminder>(`/long-rent/rents/${encodeURIComponent(installmentId)}/reminder/whatsapp`, note ? { note } : undefined),
};

const MULTIPART = { headers: { 'Content-Type': 'multipart/form-data' } };

function statementForm(file: File, mapping?: BankColumnMapping, selections?: BankImportSelection[]): FormData {
  const form = new FormData();
  form.append('file', file);
  if (mapping) form.append('mapping', JSON.stringify(mapping));
  if (selections) form.append('selections', JSON.stringify(selections));
  return form;
}

export const rentBankImportApi = {
  preview: async (file: File, mapping?: BankColumnMapping): Promise<BankImportPreview> => {
    const url = '/long-rent/rents/bank-import/preview';
    const data = await ApiClient.post<unknown>(url, statementForm(file, mapping), MULTIPART);
    const preview = data as Partial<BankImportPreview> | null;
    if (typeof data !== 'object' || preview === null || !Array.isArray(preview.suggestions) || !Array.isArray(preview.unmatched)) {
      throw new UnexpectedApiResponseError(url);
    }
    return data as BankImportPreview;
  },

  confirm: (file: File, selections: BankImportSelection[], mapping?: BankColumnMapping) =>
    ApiClient.post<BankImportConfirmation>('/long-rent/rents/bank-import/confirm', statementForm(file, mapping, selections), MULTIPART),
};

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
