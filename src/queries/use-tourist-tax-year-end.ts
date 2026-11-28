import { useMutation, useQuery } from '@tanstack/react-query';
import type { DownloadedFile } from '@/api/file.api';
import { touristTaxSummaryApi, type YearEndAccountCut } from '@/api/tourist-tax-summary.api';
import { yearEndFallbackName, type YearEndFileRequest } from '@/features/reports/tourist-tax/tourist-tax-year-end-model';
import { TOURIST_TAX_SUMMARY_KEY } from './use-tourist-tax-summary';
import { saveDownload } from './save-download';

const YEAR_END_KEY = [TOURIST_TAX_SUMMARY_KEY, 'year-end'] as const;

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

/**
 * The declaration of the year per comune, as the data of the file for a screen (E18/F01/US02/T03): the comuni with their figures, the stays with no amount and the exempt guests, each by reason. It is read again at every
 * visit and soon after (a stay or a payment changes it from other screens), and the answer of a year is never kept in place of another. For a caller that holds `guest.read` it carries the reasons of the exemptions
 * (art. 9 GDPR): it is dropped as soon as no page shows it (`gcTime: 0`; the app keeps unobserved data for ten minutes otherwise).
 */
export function useTouristTaxYearDeclaration(year: number) {
  return useQuery({
    queryKey: [...YEAR_END_KEY, 'declaration', year],
    queryFn: () => touristTaxSummaryApi.getYearEndDeclaration(year),
    gcTime: 0,
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
}

export function useTouristTaxYearAgentAccount(year: number, by: YearEndAccountCut) {
  return useQuery({
    queryKey: [...YEAR_END_KEY, 'agent-account', year, by],
    queryFn: () => touristTaxSummaryApi.getYearEndAgentAccount(year, by),
    refetchOnMount: 'always',
    staleTime: 30_000,
  });
}

export function useTouristTaxYearTicinoCount(year: number) {
  return useQuery({
    queryKey: [...YEAR_END_KEY, 'ticino', year],
    queryFn: () => touristTaxSummaryApi.getYearEndTicinoCount(year),
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
