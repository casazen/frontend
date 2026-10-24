import { useMutation, useQuery } from '@tanstack/react-query';
import { longRentFiscalApi } from '@/api/long-rent-fiscal.api';

const LONG_RENT_FISCAL_KEY = 'long-rent-fiscal';

/**
 * The fiscal report of a year (LR-11b). It is money that other screens change (a rent paid, a lease renewed), so it asks again
 * every time the page is opened (`refetchOnMount`) and does not keep an answer from before.
 */
export function useLongRentFiscalReport(year: number) {
  return useQuery({
    queryKey: [LONG_RENT_FISCAL_KEY, year],
    queryFn: () => longRentFiscalApi.getReport(year),
    refetchOnMount: 'always',
  });
}

/** Downloads the CSV of the report of a year (the caller saves the blob and shows the error). */
export function useDownloadLongRentFiscal() {
  return useMutation({ mutationFn: (year: number) => longRentFiscalApi.downloadCsv(year) });
}
