import axios from '@/lib/axios';
import { withJsonErrorBody } from '@/lib/file-download';
import {
  parseTenantContractArea,
  parseTenantContractList,
  parseTenantDeclaration,
  parseTenantMaintenance,
  parseTenantMaintenanceList,
} from '@/features/tenant-area/lib/parse-tenant-area';
import type { TenantContractArea, TenantContractSummary, TenantMaintenanceRequest, TenantPaymentDeclaration, TenantPaymentDeclarationInput } from '@/types';
import { ApiClient } from './client';

/**
 * The tenant area (CondoLedger phase 1B). Every call is scoped by the signed-in user on the backend: the response is one
 * contract and its property, never the organisation. A payment declaration is not an offline collection (`mark-paid`).
 */
function leasePath(leaseId: string): string {
  return `/tenant-area/contracts/${encodeURIComponent(leaseId)}`;
}

export const tenantAreaApi = {
  /** Contracts the signed-in tenant may open. */
  listContracts: async (): Promise<TenantContractSummary[]> => parseTenantContractList(await ApiClient.get<unknown>('/tenant-area')),

  /** One contract, its property, dues, shared documents and the emergency contacts the manager configured. */
  getContract: async (leaseId: string): Promise<TenantContractArea> =>
    parseTenantContractArea(await ApiClient.get<unknown>(leasePath(leaseId))),

  /**
   * Records “I made the transfer”. `POST .../declarations` only: the installment stays unpaid until the manager or a
   * bank match confirms it.
   */
  declareTransfer: async (leaseId: string, dueId: string, input: TenantPaymentDeclarationInput): Promise<TenantPaymentDeclaration> => {
    const url = `${leasePath(leaseId)}/dues/${encodeURIComponent(dueId)}/declarations`;
    const body = input.receipt
      ? declarationForm(input)
      : {
          amount: input.amount,
          transferDate: input.transferDate,
          bankReference: input.bankReference || undefined,
          note: input.note || undefined,
        };
    const data = input.receipt
      ? await ApiClient.post<unknown>(url, body, { headers: { 'Content-Type': 'multipart/form-data' } })
      : await ApiClient.post<unknown>(url, body);
    return parseTenantDeclaration(data);
  },

  downloadDocument: async (leaseId: string, documentId: string): Promise<Blob> => {
    try {
      const response = await axios.get<Blob>(`${leasePath(leaseId)}/documents/${encodeURIComponent(documentId)}`, {
        responseType: 'blob',
      });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  listMaintenance: async (leaseId: string): Promise<TenantMaintenanceRequest[]> =>
    parseTenantMaintenanceList(await ApiClient.get<unknown>(`${leasePath(leaseId)}/maintenance`)),

  getMaintenance: async (leaseId: string, requestId: string): Promise<TenantMaintenanceRequest> =>
    parseTenantMaintenance(await ApiClient.get<unknown>(`${leasePath(leaseId)}/maintenance/${encodeURIComponent(requestId)}`)),

  /** Sent to the manager of the contract. The tenant does not choose a supplier. */
  createMaintenance: async (
    leaseId: string,
    input: { category: string; urgency: string; description: string; attachments: File[] },
  ): Promise<TenantMaintenanceRequest> => {
    const form = new FormData();
    form.append('category', input.category);
    form.append('urgency', input.urgency);
    form.append('description', input.description);
    for (const file of input.attachments) form.append('attachments', file);
    const data = await ApiClient.post<unknown>(`${leasePath(leaseId)}/maintenance`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return parseTenantMaintenance(data);
  },
};

function declarationForm(input: TenantPaymentDeclarationInput): FormData {
  const form = new FormData();
  form.append('amount', String(input.amount));
  form.append('transferDate', input.transferDate);
  if (input.bankReference) form.append('bankReference', input.bankReference);
  if (input.note) form.append('note', input.note);
  if (input.receipt) form.append('receipt', input.receipt);
  return form;
}
