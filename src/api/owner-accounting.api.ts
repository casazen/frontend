import { ApiClient } from './client';
import { acceptsRefusal } from './accept-refusal';
import { fileApi, type DownloadedFile } from './file.api';
import axios from '@/lib/axios';
import { UnexpectedApiResponseError, getHttpStatus } from '@/lib/api-errors';
import { withJsonErrorBody } from '@/lib/file-download';
import type {
  OwnerMandateReading,
  OwnerAccountingEvidence,
  OwnerAccountingPolicy,
  OwnerAccountingPolicyCommand,
  OwnerAddress,
  OwnerAddressCommand,
  OwnerBulkCommand,
  OwnerBulkRun,
  OwnerClosePeriod,
  OwnerCloseReadiness,
  OwnerExternalDocument,
  OwnerFiscalProfile,
  OwnerFiscalProfileCommand,
  OwnerFxRate,
  OwnerLedgerEntry,
  OwnerMandate,
  OwnerMandateCommand,
  OwnerOnboardingReadiness,
  OwnerPayout,
  OwnerPayoutCommand,
  OwnerPayoutPreview,
  OwnerPostingResult,
  OwnerStatementVersion,
  OwnerStatementVersionDetail,
  PropertyOwnerSummary,
  TaxF24Record,
  TaxFilingCommand,
  TaxReconciliation,
  TaxReportingDataset,
} from '@/types';

const ownerMonth = (year: number, month: number, ownerId: string) => `/owner-accounting/periods/${year}/${month}/owners/${ownerId}`;

async function orNull<T>(request: Promise<T>): Promise<T | null> {
  try {
    return await request;
  } catch (error) {
    if (getHttpStatus(error) === 404) return null;
    throw error;
  }
}

/** The query of a file in the language of the app: the server writes Italian unless it is asked for English (`lang=en`). */
const fileLanguage = (language: string): { lang: string } | undefined => (language.startsWith('en') ? { lang: 'en' } : undefined);

const bulkPath = (year: number, month: number) => `/owner-accounting/periods/${year}/${month}/bulk`;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function ensureRun(data: unknown, path: string): OwnerBulkRun {
  if (!isRecord(data) || !Array.isArray(data.results) || typeof data.total !== 'number' || typeof data.status !== 'string' || typeof data.action !== 'string') {
    throw new UnexpectedApiResponseError(path);
  }
  for (const row of data.results as unknown[]) {
    if (!isRecord(row) || typeof row.ownerId !== 'string' || typeof row.ok !== 'boolean') throw new UnexpectedApiResponseError(path);
  }
  const goesOn = data.status === 'Queued' || data.status === 'Running';
  if (goesOn && (typeof data.jobId !== 'string' || data.jobId === '')) throw new UnexpectedApiResponseError(path);
  return data as unknown as OwnerBulkRun;
}

export const ownerAccountingApi = {
  listOwners: () => ApiClient.get<PropertyOwnerSummary[]>('/owners'),

  getOnboardingReadiness: () => orNull(ApiClient.get<OwnerOnboardingReadiness>('/onboarding/owners/readiness')),

  listMandates: (ownerId: string) => ApiClient.get<OwnerMandate[]>(`/owners/${ownerId}/mandates`),

  createMandate: (ownerId: string, command: OwnerMandateCommand) => ApiClient.post<OwnerMandate>(`/owners/${ownerId}/mandates`, command),

  readMandateDocument: async (ownerId: string, file: File, signal?: AbortSignal): Promise<OwnerMandateReading> => {
    const data = new FormData();
    data.append('file', file);
    const response = await axios.post<OwnerMandateReading>(`/owners/${ownerId}/mandates/read-document`, data, { headers: { 'Content-Type': 'multipart/form-data' }, timeout: 300_000, signal });
    return response.data;
  },

  createMandateWithDocument: async (ownerId: string, command: OwnerMandateCommand, file: File): Promise<OwnerMandate> => {
    const data = new FormData();
    data.append('file', file);
    data.append('command', JSON.stringify(command));
    const response = await axios.post<OwnerMandate>(`/owners/${ownerId}/mandates/with-document`, data, { headers: { 'Content-Type': 'multipart/form-data' } });
    return response.data;
  },

  downloadMandateDocument: (ownerId: string, mandateId: string): Promise<DownloadedFile> => fileApi.get(`/owners/${ownerId}/mandates/${mandateId}/document`),

  getAddress: async (ownerId: string): Promise<OwnerAddress | null> => {
    const response = await axios.get<OwnerAddress>(`/owners/${ownerId}/address`, { validateStatus: acceptsRefusal });
    return response.status === 403 ? null : response.data;
  },

  saveAddress: (ownerId: string, command: OwnerAddressCommand) => ApiClient.put<OwnerAddress>(`/owners/${ownerId}/address`, command),

  getReadiness: (year: number, month: number) => ApiClient.get<OwnerCloseReadiness>(`/owner-accounting/periods/${year}/${month}/readiness`),

  /** Posts the ledger lines of the month from their sources (idempotent). */
  postPeriod: (year: number, month: number) => ApiClient.post<OwnerPostingResult>(`/owner-accounting/periods/${year}/${month}/post`),

  listVersions: (year: number, month: number, ownerId: string) => ApiClient.get<OwnerStatementVersion[]>(`${ownerMonth(year, month, ownerId)}/versions`),

  generateVersion: (year: number, month: number, ownerId: string) =>
    ApiClient.post<OwnerStatementVersion>(`${ownerMonth(year, month, ownerId)}/versions`),

  getVersion: (versionId: string) => ApiClient.get<OwnerStatementVersionDetail>(`/owner-accounting/versions/${versionId}`),

  approveVersion: (versionId: string) => ApiClient.post<OwnerStatementVersion>(`/owner-accounting/versions/${versionId}/approve`),

  publishVersion: (versionId: string) => ApiClient.post<OwnerStatementVersion>(`/owner-accounting/versions/${versionId}/publish`),

  /**
   * One step of the month-end for every owner of the month, or the ones listed (`agency.statement.manage`; the publication needs `agency.statement.publish`; the whole organization). Each owner
   * is its own transaction and its own row: an owner that fails never stops the others, a flagged version is never approved, the close never waives a difference, and a step run twice changes
   * nothing more. Up to a few owners the answer is the finished run; for more it is a run that is queued (202, `jobId`, no rows yet) and {@link getBulkRun} tells how far it goes.
   * 422 `owner_bulk_action_invalid`, `owner_bulk_owners_empty`, `owner_bulk_too_many_owners`, `owner_period_invalid`; 409 `owner_period_not_ended` (a close of a month that is not over).
   */
  runBulkStep: async (year: number, month: number, command: OwnerBulkCommand): Promise<OwnerBulkRun> => {
    const path = bulkPath(year, month);
    return ensureRun(await ApiClient.post<unknown>(path, command), path);
  },

  getBulkRun: async (year: number, month: number, jobId: string): Promise<OwnerBulkRun> => {
    const path = `${bulkPath(year, month)}/${encodeURIComponent(jobId)}`;
    return ensureRun(await ApiClient.get<unknown>(path), path);
  },

  downloadPublishedFile: async (versionId: string): Promise<Blob> => {
    try {
      const response = await axios.get<Blob>(`/owner-accounting/versions/${versionId}/published`, { responseType: 'blob' });
      return response.data;
    } catch (error) {
      throw await withJsonErrorBody(error);
    }
  },

  downloadVersionPdf: (versionId: string, language: string): Promise<DownloadedFile> => fileApi.get(`/owner-accounting/versions/${versionId}/pdf`, fileLanguage(language)),

  downloadVersionCsv: (versionId: string, language: string): Promise<DownloadedFile> => fileApi.get(`/owner-accounting/versions/${versionId}/csv`, fileLanguage(language)),

  closeMonth: (year: number, month: number, ownerId: string, waiverReason?: string) =>
    ApiClient.post<OwnerClosePeriod>(`${ownerMonth(year, month, ownerId)}/close`, { waiverReason: waiverReason ?? null }),

  setLegalHold: (year: number, month: number, ownerId: string, hold: boolean, reason?: string) =>
    ApiClient.post<OwnerClosePeriod>(`${ownerMonth(year, month, ownerId)}/legal-hold`, { hold, reason: reason ?? null }),

  getEvidence: (year: number, month: number, ownerId: string) => ApiClient.get<OwnerAccountingEvidence>(`${ownerMonth(year, month, ownerId)}/evidence`),

  listFxRates: () => ApiClient.get<OwnerFxRate[]>('/owner-accounting/fx-rates'),

  addFxRate: (command: { baseCurrency: string; quoteCurrency: string; rateDate: string; rate: number; source: string }) =>
    ApiClient.post<OwnerFxRate>('/owner-accounting/fx-rates', command),

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

  listExternalDocuments: (versionId: string) => ApiClient.get<OwnerExternalDocument[]>(`/owner-accounting/versions/${versionId}/external-documents`),

  addExternalDocument: (
    versionId: string,
    command: { provider: string; externalId: string; externalNumber: string; externalDate: string; documentUrl?: string; documentSha256?: string },
  ) => ApiClient.post<OwnerExternalDocument>(`/owner-accounting/versions/${versionId}/external-documents`, command),

  verifyExternalDocument: (referenceId: string) => ApiClient.post<OwnerExternalDocument>(`/owner-accounting/external-documents/${referenceId}/verify`),

  removeExternalDocument: (referenceId: string, reason: string) =>
    ApiClient.post<OwnerExternalDocument>(`/owner-accounting/external-documents/${referenceId}/remove`, { reason }),

  listPayouts: (ownerId?: string) => ApiClient.get<OwnerPayout[]>('/owner-accounting/payouts', ownerId ? { ownerId } : undefined),

  getPayout: (payoutId: string) => ApiClient.get<OwnerPayout>(`/owner-accounting/payouts/${payoutId}`),

  getPayoutPreview: (statementVersionId: string, paidOn: string) => ApiClient.get<OwnerPayoutPreview>('/owner-accounting/payouts/preview', { statementVersionId, paidOn }),

  /**
   * Confirms a payout of the whole balance the version still owes (a retry with the same key answers the same payout). It sends no amount and no fact: the server reads them from the owner ledger. The withholding is
   * decided here, on the approved rule in force on the day, and nowhere else. 422 `owner_payout_exceeds_balance` (with the `balance`: nothing is left to pay), `tax_applicability_unresolved` (with the `field`), `owner_fiscal_*`.
   */
  confirmPayout: (command: OwnerPayoutCommand) => ApiClient.post<OwnerPayout>('/owner-accounting/payouts', command),

  reversePayout: (payoutId: string, reason: string) => ApiClient.post<OwnerPayout>(`/owner-accounting/payouts/${payoutId}/reverse`, { reason }),

  /** The profiles of an owner, the newest first; masked unless the caller manages the owners' finances. */
  listFiscalProfiles: (ownerId: string) => ApiClient.get<OwnerFiscalProfile[]>(`/owners/${ownerId}/fiscal-profiles`),

  saveFiscalProfile: (ownerId: string, command: OwnerFiscalProfileCommand) => ApiClient.post<OwnerFiscalProfile>(`/owners/${ownerId}/fiscal-profiles`, command),

  listPolicies: () => ApiClient.get<OwnerAccountingPolicy[]>('/owner-accounting/policies'),

  createPolicy: (command: OwnerAccountingPolicyCommand) => ApiClient.post<OwnerAccountingPolicy>('/owner-accounting/policies', command),

  approvePolicy: (policyId: string, approvedByName: string) =>
    ApiClient.post<OwnerAccountingPolicy>(`/owner-accounting/policies/${policyId}/approve`, { approvedByName }),

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

  getAnnualDataset: (year: number) => orNull(ApiClient.get<TaxReportingDataset>(`/withholding/annual/${year}`)),

  generateAnnualDataset: (year: number) => ApiClient.post<TaxReportingDataset>(`/withholding/annual/${year}`),

  setDatasetFilingState: (datasetId: string, command: TaxFilingCommand) =>
    ApiClient.post<TaxReportingDataset>(`/withholding/annual/datasets/${datasetId}/filing-state`, command),
};
