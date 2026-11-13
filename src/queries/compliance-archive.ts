import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { COMPLIANCE_ARCHIVE_ERROR, complianceArchiveApi, complianceArchiveErrorCode } from '@/api/compliance-archive.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { exportFileName, proofFileName } from '@/features/compliance/lib/proof-file';
import i18n from '@/i18n/config';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs } from '@/lib/file-download';
import type {
  ComplianceArchiveEntry,
  ComplianceArchiveFilters,
  ComplianceReportFilters,
  ComplianceReportFormat,
  UploadComplianceProofInput,
} from '@/types';

/** Root of every query key of the archive of the proofs. */
export const COMPLIANCE_ARCHIVE_KEY = 'compliance-archive';

/**
 * The proofs CasaZen holds, one page of them (NF-47). The archive changes on other screens and from other people (a proof is uploaded, one is
 * downloaded by CasaZen), none of which this page watches: the query client does not read again on mount and a read less than five minutes old
 * would still be taken for fresh, so every visit reads again (`'always'`) and so does a return to the tab. The rows of the last page stay on the
 * screen, dimmed, until those of the next one arrive. `enabled` is false for who may not read bookings: nothing is asked then.
 */
export function useComplianceEvidence(filters: ComplianceArchiveFilters, enabled = true) {
  return useQuery({
    queryKey: [COMPLIANCE_ARCHIVE_KEY, 'list', filters],
    queryFn: () => complianceArchiveApi.listEvidence(filters),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/**
 * The coverage report of a period: what is expected, with the proof CasaZen holds for each obligation. Behind the traffic light (the server answers
 * 404 while it is off), so the page asks only when its flag is on (`enabled`). Read again like the list: a proof is uploaded, a stay arrives.
 */
export function useCoverageReport(filters: ComplianceReportFilters, enabled = true) {
  return useQuery({
    queryKey: [COMPLIANCE_ARCHIVE_KEY, 'report', filters],
    queryFn: () => complianceArchiveApi.getCoverageReport(filters),
    enabled,
    placeholderData: keepPreviousData,
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/** The proofs of one stay and the log of what was sent for it, by whom (CasaZen, the channel manager, the host). */
export function useBookingCompliance(bookingId: string, enabled = true) {
  return useQuery({
    queryKey: [COMPLIANCE_ARCHIVE_KEY, 'booking', bookingId],
    queryFn: () => complianceArchiveApi.getBookingCompliance(bookingId),
    enabled: enabled && bookingId !== '',
    refetchOnMount: 'always',
    staleTime: 0,
  });
}

/**
 * Downloads one proof and saves it. A proof is the receipt of a communication about guests or of a tax: the mutation keeps nothing of it once
 * nobody watches it (`gcTime: 0`), what its function hands back is nothing (the file goes to the disk inside it, never into the cache of the
 * mutations) and a failure is kept without its request, which holds the access token of the caller (`withoutRequest`). A proof that is not
 * found any more (404: deleted, or out of the reach of the caller) is told as such, whatever the list still shows, and the list is read again,
 * so the row goes away.
 */
export function useDownloadProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (entry: ComplianceArchiveEntry): Promise<void> => {
      try {
        const { blob, contentDisposition } = await complianceArchiveApi.downloadProof(entry);
        saveBlobAs(blob, proofFileName(entry, blob.type, contentDisposition));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => {
      toast.success(i18n.t('complianceArchive.download.done'));
    },
    onError: (error) => {
      toast.error(getProblemMessage(error, i18n.t) ?? i18n.t('complianceArchive.download.failed'));
      if (complianceArchiveErrorCode(error) === COMPLIANCE_ARCHIVE_ERROR.proofNotFound) {
        void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY] });
      }
    },
  });
}

interface ExportProofsRequest {
  from: string;
  to: string;
  propertyId?: string;
}

/**
 * Downloads the ZIP of the proofs of a period and saves it. Like a single proof it keeps nothing once nobody watches it (`gcTime: 0`), saves inside
 * its function and keeps a failure without its request. The page tells the refusals (a period too large, one the server does not accept) next to the
 * button.
 */
export function useExportProofs() {
  return useMutation({
    mutationFn: async ({ from, to, propertyId }: ExportProofsRequest): Promise<void> => {
      try {
        const { blob, contentDisposition } = await complianceArchiveApi.exportProofs(from, to, propertyId);
        saveBlobAs(blob, exportFileName(contentDisposition, `casazen-prove-${from}-${to}.zip`));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
  });
}

interface ExportReportRequest {
  format: ComplianceReportFormat;
  filters: ComplianceReportFilters;
}

/** Downloads the coverage report of a period as a PDF or a CSV and saves it. Same rules as the ZIP of the proofs. */
export function useExportCoverageReport() {
  return useMutation({
    mutationFn: async ({ format, filters }: ExportReportRequest): Promise<void> => {
      try {
        const { blob, contentDisposition } = await complianceArchiveApi.exportCoverageReport(format, filters);
        saveBlobAs(blob, exportFileName(contentDisposition, `casazen-rapporto-copertura-${filters.from}-${filters.to}.${format}`));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
  });
}

/**
 * Uploads a proof. The file is a receipt about guests or a tax: the variables go with the mutation, so it keeps nothing once the dialog that
 * asked is closed (`gcTime: 0`), and a failure is kept without its request. The dialog tells the refusals (a file that is not a PDF, a JPEG or a
 * PNG, one that is too large, a day that is not acceptable) next to the button. When it is done, the archive, the report and the compliance
 * cockpit (whose lights this proof may change) are read again.
 */
export function useUploadProof() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UploadComplianceProofInput) => {
      try {
        return await complianceArchiveApi.uploadProof(input);
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: [COMPLIANCE_ARCHIVE_KEY] });
      void queryClient.invalidateQueries({ queryKey: ['compliance'] });
      toast.success(i18n.t('complianceArchive.upload.done'));
    },
  });
}
