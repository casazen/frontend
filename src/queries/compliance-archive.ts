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
 * What a receipt of the Alloggiati communication of a day would prove for the flats it would cover (E20/F02/US02/T01): the stays that become proven, in all and for each flat. The
 * host reads it before saving, so it never shows an older answer as the one of the days and flats now chosen: the key holds both, nothing of the last choice is kept while the
 * next one is read (no `placeholderData`), it is read again on every mount and a read less than a moment old is never fresh, and a read that fails is an error whatever the cache
 * still holds of the same choice (the dialog looks at the error before it looks at the data). `enabled` is false until there is a day and at least one flat: asking with none is a
 * mistake the server answers with a 422, never «every flat».
 */
export function useReceiptCoverage(day: string, propertyIds: readonly string[], enabled = true) {
  return useQuery({
    queryKey: [COMPLIANCE_ARCHIVE_KEY, 'receipt-coverage', day, propertyIds],
    queryFn: ({ signal }) => complianceArchiveApi.getReceiptCoverage(day, propertyIds, signal),
    enabled: enabled && day !== '' && propertyIds.length > 0,
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
 * PNG, one that is too large, a day that is not acceptable, flats a receipt cannot cover) next to the button. When it is done, the archive (the
 * proofs of a stay and the answers of the summary before saving included), the report, the compliance cockpit (whose lights this proof may
 * change) and the Alloggiati status of the stays (a stay the receipt covers is no longer waiting for it: the page of a booking that is open shows
 * it without a reload) are read again.
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
      // `ALLOGGIATI_KEY` of `use-alloggiati`, which imports this file: the key is written out here so the two do not import each other.
      void queryClient.invalidateQueries({ queryKey: ['alloggiati'] });
      toast.success(i18n.t('complianceArchive.upload.done'));
    },
  });
}
