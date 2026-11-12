import { ApiClient } from './client';
import axios from '@/lib/axios';
import { getHttpStatus } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  OwnerAccountingEvidence,
  OwnerAccountingPolicy,
  OwnerAccountingPolicyCommand,
  OwnerClosePeriod,
  OwnerCloseReadiness,
  OwnerExternalDocument,
  OwnerFiscalProfile,
  OwnerFiscalProfileCommand,
  OwnerFxRate,
  OwnerLedgerEntry,
  OwnerOnboardingReadiness,
  OwnerPayout,
  OwnerPayoutCommand,
  OwnerPostingResult,
  OwnerStatementVersion,
  OwnerStatementVersionDetail,
  PropertyOwnerSummary,
  TaxF24Record,
  TaxFilingCommand,
  TaxReconciliation,
  TaxReportingDataset,
} from '@/types';

/** The path of a month of an owner: `periods/{year}/{month}/owners/{ownerId}`. */
const ownerMonth = (year: number, month: number, ownerId: string) => `/owner-accounting/periods/${year}/${month}/owners/${ownerId}`;

/** `null` for a 404 (nothing there yet, or the module is off), the error for anything else. */
async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (getHttpStatus(error) === 404) return null;
    throw error;
  }
}

/**
 * The owner accounting of an agency (E06/F05/US02). Paths are relative to the API base URL, which already ends in `/api`. Every write is an
 * explicit call: nothing here posts, regenerates or closes by itself.
 */
export const ownerAccountingApi = {
  /** The owners of the agency's registry (the names the month-end page shows). */
  listOwners: () => ApiClient.get<PropertyOwnerSummary[]>('/owners'),

  /** What is missing on each owner and property for the owner accounting; `null` while the activation module is off (404). */
  getOnboardingReadiness: () => orNull(ApiClient.get<OwnerOnboardingReadiness>('/onboarding/owners/readiness')),

  // ── The month ────────────────────────────────────────────────────────────────────────────────────────────────────

  /** The readiness of the org and of each owner for the month. It reads only. */
  getReadiness: (year: number, month: number) => ApiClient.get<OwnerCloseReadiness>(`/owner-accounting/periods/${year}/${month}/readiness`),

  /** Posts the ledger lines of the month from their sources (idempotent). */
  postPeriod: (year: number, month: number) => ApiClient.post<OwnerPostingResult>(`/owner-accounting/periods/${year}/${month}/post`),

  /** The versions of the owner's month, the newest first. */
  listVersions: (year: number, month: number, ownerId: string) => ApiClient.get<OwnerStatementVersion[]>(`${ownerMonth(year, month, ownerId)}/versions`),

  /** A new version of the owner's statement from the ledger now: the one before is superseded, never changed. */
  generateVersion: (year: number, month: number, ownerId: string) =>
    ApiClient.post<OwnerStatementVersion>(`${ownerMonth(year, month, ownerId)}/versions`),

  /** A version with the ledger lines it is made of. */
  getVersion: (versionId: string) => ApiClient.get<OwnerStatementVersionDetail>(`/owner-accounting/versions/${versionId}`),

  approveVersion: (versionId: string) => ApiClient.post<OwnerStatementVersion>(`/owner-accounting/versions/${versionId}/approve`),

  publishVersion: (versionId: string) => ApiClient.post<OwnerStatementVersion>(`/owner-accounting/versions/${versionId}/publish`),

  /** The published file of a version, as the owner received it. */
  downloadPublishedFile: async (versionId: string): Promise<Blob> => {
    try {
      const response = await axios.get<Blob>(`/owner-accounting/versions/${versionId}/published`, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  /** Closes the owner's month on its approved version; a difference or a negative balance needs the reason of a waiver. */
  closeMonth: (year: number, month: number, ownerId: string, waiverReason?: string) =>
    ApiClient.post<OwnerClosePeriod>(`${ownerMonth(year, month, ownerId)}/close`, { waiverReason: waiverReason ?? null }),

  setLegalHold: (year: number, month: number, ownerId: string, hold: boolean, reason?: string) =>
    ApiClient.post<OwnerClosePeriod>(`${ownerMonth(year, month, ownerId)}/legal-hold`, { hold, reason: reason ?? null }),

  /** The evidence of the owner's month: the close, every version with its published file, the lines. */
  getEvidence: (year: number, month: number, ownerId: string) => ApiClient.get<OwnerAccountingEvidence>(`${ownerMonth(year, month, ownerId)}/evidence`),

  // ── Rates and corrections ───────────────────────────────────────────────────────────────────────────────────────

  listFxRates: () => ApiClient.get<OwnerFxRate[]>('/owner-accounting/fx-rates'),

  addFxRate: (command: { baseCurrency: string; quoteCurrency: string; rateDate: string; rate: number; source: string }) =>
    ApiClient.post<OwnerFxRate>('/owner-accounting/fx-rates', command),

  /** A manual correction with its reason: a line of the ledger, signed (positive is owed to the owner). */
  postCorrection: (command: {
    ownerId: string;
    propertyId?: string;
    amount: number;
    currency: string;
    date: string;
    description: string;
    replacesEntryId?: string;
    attachmentReference?: string;
  }) => ApiClient.post<OwnerLedgerEntry>('/owner-accounting/corrections', command),

  // ── Invoices issued outside CasaZen ─────────────────────────────────────────────────────────────────────────────

  listExternalDocuments: (versionId: string) => ApiClient.get<OwnerExternalDocument[]>(`/owner-accounting/versions/${versionId}/external-documents`),

  addExternalDocument: (
    versionId: string,
    command: { provider: string; externalId: string; externalNumber: string; externalDate: string; documentUrl?: string; documentSha256?: string },
  ) => ApiClient.post<OwnerExternalDocument>(`/owner-accounting/versions/${versionId}/external-documents`, command),

  verifyExternalDocument: (referenceId: string) => ApiClient.post<OwnerExternalDocument>(`/owner-accounting/external-documents/${referenceId}/verify`),

  removeExternalDocument: (referenceId: string, reason: string) =>
    ApiClient.post<OwnerExternalDocument>(`/owner-accounting/external-documents/${referenceId}/remove`, { reason }),

  // ── Payouts ─────────────────────────────────────────────────────────────────────────────────────────────────────

  listPayouts: (ownerId?: string) => ApiClient.get<OwnerPayout[]>('/owner-accounting/payouts', ownerId ? { ownerId } : undefined),

  /** A payout with its withholding evidence. */
  getPayout: (payoutId: string) => ApiClient.get<OwnerPayout>(`/owner-accounting/payouts/${payoutId}`),

  /** Confirms a payout (a retry with the same key answers the same payout). The withholding is decided here, on the approved rule, and nowhere else. */
  confirmPayout: (command: OwnerPayoutCommand) => ApiClient.post<OwnerPayout>('/owner-accounting/payouts', command),

  reversePayout: (payoutId: string, reason: string) => ApiClient.post<OwnerPayout>(`/owner-accounting/payouts/${payoutId}/reverse`, { reason }),

  // ── Fiscal profile and rule sets ────────────────────────────────────────────────────────────────────────────────

  /** The profiles of an owner, the newest first; masked unless the caller manages the owners' finances. */
  listFiscalProfiles: (ownerId: string) => ApiClient.get<OwnerFiscalProfile[]>(`/owners/${ownerId}/fiscal-profiles`),

  saveFiscalProfile: (ownerId: string, command: OwnerFiscalProfileCommand) => ApiClient.post<OwnerFiscalProfile>(`/owners/${ownerId}/fiscal-profiles`, command),

  listPolicies: () => ApiClient.get<OwnerAccountingPolicy[]>('/owner-accounting/policies'),

  createPolicy: (command: OwnerAccountingPolicyCommand) => ApiClient.post<OwnerAccountingPolicy>('/owner-accounting/policies', command),

  /** Records the approval of the qualified accountant: an approved rule set never changes. */
  approvePolicy: (policyId: string, approvedByName: string) =>
    ApiClient.post<OwnerAccountingPolicy>(`/owner-accounting/policies/${policyId}/approve`, { approvedByName }),

  // ── Tax files: F24 and annual data ──────────────────────────────────────────────────────────────────────────────

  /** The obligations of each month of the year against their F24, and of the year against the annual data. It reads only. */
  getTaxReconciliation: (year: number) => ApiClient.get<TaxReconciliation>(`/withholding/reconciliation/${year}`),

  /** The F24 of a month. Call it only for a month the reconciliation says has one: the endpoint builds the record when there is none. */
  getF24: (month: number, year: number) => ApiClient.get<TaxF24Record>('/withholding/f24', { month, year }),

  generateF24: (month: number, year: number) => ApiClient.post<TaxF24Record>(`/withholding/f24/generate?month=${month}&year=${year}`),

  downloadF24Pdf: async (month: number, year: number): Promise<Blob> => {
    try {
      const response = await axios.get<Blob>('/withholding/f24/pdf', { params: { month, year }, responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  setF24FilingState: (f24Id: string, command: TaxFilingCommand) => ApiClient.post<TaxF24Record>(`/withholding/f24/${f24Id}/filing-state`, command),

  /** The annual data of the year; `null` while there is none (404). */
  getAnnualDataset: (year: number) => orNull(ApiClient.get<TaxReportingDataset>(`/withholding/annual/${year}`)),

  generateAnnualDataset: (year: number) => ApiClient.post<TaxReportingDataset>(`/withholding/annual/${year}`),

  setDatasetFilingState: (datasetId: string, command: TaxFilingCommand) =>
    ApiClient.post<TaxReportingDataset>(`/withholding/annual/datasets/${datasetId}/filing-state`, command),
};
