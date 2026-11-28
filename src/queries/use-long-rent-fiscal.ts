import { useMutation, useQuery } from '@tanstack/react-query';
import { longRentFiscalApi } from '@/api/long-rent-fiscal.api';

const LONG_RENT_FISCAL_KEY = 'long-rent-fiscal';

export function useLongRentFiscalReport(year: number) {
  return useQuery({
    queryKey: [LONG_RENT_FISCAL_KEY, year],
    queryFn: () => longRentFiscalApi.getReport(year),
    refetchOnMount: 'always',
  });
}

export function useDownloadLongRentFiscal() {
  return useMutation({ mutationFn: (year: number) => longRentFiscalApi.downloadCsv(year) });
}
