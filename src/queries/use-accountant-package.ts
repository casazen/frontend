import { useMutation, useQuery } from '@tanstack/react-query';
import { accountantPackageApi, accountantPackageFileName } from '@/api/accountant-package.api';
import { saveDownload } from './save-download';

/** Root of the query keys of the accountant package: the summary of every period lives under it. */
export const ACCOUNTANT_PACKAGE_KEY = 'accountant-package';

export const accountantPackageKeys = {
  summary: (period: string) => [ACCOUNTANT_PACKAGE_KEY, 'agency-summary', period] as const,
};

/**
 * The summary of the agency for a month (`2026-10`) or a year (`2026`). Its figures change on other screens and by other hands (a document issued, a payment recorded, an invoice made out to
 * an owner), none of which knows this page, and the query client does not read again on mount: so every visit reads again (`'always'`), a read more than half a minute old is stale, and an
 * issued document told by the notification channel reads it again at once (`use-notifications-realtime.ts`). The summary of one period is never shown for another: nothing of the last
 * period is kept while the next one comes. `null` when the server refuses it to the caller (403); a 404 is the module being off at the server, whatever the cache still holds.
 */
export function useAgencySummary(period: string, enabled = true) {
  return useQuery({
    queryKey: accountantPackageKeys.summary(period),
    queryFn: () => accountantPackageApi.getAgencySummary(period),
    enabled,
    refetchOnMount: 'always' as const,
    staleTime: 30_000,
  });
}

/** What the download needs besides the period: a way to stop it, and to hear how many bytes of the ZIP came so far. */
interface DownloadRequest {
  period: string;
  signal?: AbortSignal;
  onProgress?: (bytes: number) => void;
}

/**
 * Downloads the package of a period and saves it under the name the server gave it, or `casazen-commercialista-<period>.zip` when the page cannot read the header. The package holds money and
 * personal data, so nothing of it is kept: the mutation is dropped as soon as nothing watches it (`gcTime: 0`), the file goes to the disk inside its function (never into the cache of the
 * mutations) and a failure keeps only the answer of the server, without the request that carried the access token (`saveDownload`). It says nothing itself: the page tells the refusals (422
 * `accountant_package_too_large` with the number of files, 403, 404) next to the button, and a call the person stopped is not a failure.
 */
export function useDownloadAccountantPackage() {
  return useMutation({
    mutationFn: ({ period, signal, onProgress }: DownloadRequest): Promise<void> =>
      saveDownload(accountantPackageApi.download(period, { signal, onProgress }), accountantPackageFileName(period)),
    gcTime: 0,
  });
}
