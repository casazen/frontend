import { useMutation, useQuery } from '@tanstack/react-query';
import type { DownloadedFile } from '@/api/file.api';
import { touristTaxSummaryApi } from '@/api/tourist-tax-summary.api';
import { yearEndFallbackName, type YearEndFileRequest } from '@/features/reports/tourist-tax/tourist-tax-year-end-model';
import { TOURIST_TAX_SUMMARY_KEY } from './use-tourist-tax-summary';
import { saveDownload } from './save-download';

/**
 * The figures of a whole calendar year, the ones the year-end declaration is made of (E18/F01/US02/T03): the tourist tax summary of the year, as the server sends it, or `null` when it refuses it to the caller (403). Read
 * again at every visit and soon after (a stay or a payment changes it from other screens), and never kept in place of another year while one loads: a declaration page does not show the figures of 2025 under 2026. It is under
 * the key of the summaries, so what records or deletes a payment reads it again too.
 */
export function useTouristTaxYearSummary(year: number) {
  return useQuery({
    queryKey: [TOURIST_TAX_SUMMARY_KEY, 'year', year],
    queryFn: () => touristTaxSummaryApi.getYear(year),
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
}

function yearEndFileOf(request: YearEndFileRequest): Promise<DownloadedFile> {
  switch (request.kind) {
    case 'declaration':
      return touristTaxSummaryApi.downloadYearEndDeclaration(request.year, request.format);
    case 'agentAccount':
      return touristTaxSummaryApi.downloadYearEndAgentAccount(request.year, request.by, request.format);
    case 'ticino':
      return touristTaxSummaryApi.downloadYearEndTicinoCount(request.year, request.format);
  }
}

/**
 * Saves one of the files of the tourist tax at year end (the declaration to the comuni, the account of the agent, the count of Ticino) under the name the server gave it, or under the one of `yearEndFallbackName` when the
 * page cannot read it. They are made of the stays and the payments of the agency, so nothing is kept: the bytes go to the disk inside the function and are never read, the mutation is dropped as soon as nothing watches it
 * (`gcTime: 0`) and a failure keeps only the answer of the server (`saveDownload`). The refusal of a caller who does not reach the whole organization is a `ReportAccessDeniedError`, not a trip to the page of no access.
 */
export function useDownloadTouristTaxYearEndFile() {
  return useMutation({
    mutationFn: (request: YearEndFileRequest) => saveDownload(yearEndFileOf(request), yearEndFallbackName(request)),
    gcTime: 0,
  });
}
