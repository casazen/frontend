import { useMutation, useQuery } from '@tanstack/react-query';
import { pdfFileNameOf, publicFiscalDocumentsApi, type PublicFiscalDocument } from '@/api/public-fiscal-documents.api';
import { saveDownload } from '@/queries/save-download';

const PUBLIC_FISCAL_DOCUMENT_KEY = 'public-fiscal-document';

const SUMMARY_STALE_MS = 30_000;

/**
 * The summary of the document of the link the guest got by e-mail (E12/F02/US02/T01). The token is read once by the page and passed in: it is not part of the
 * key, so no cache entry, no devtools row and no log of a key holds it. The reading is dropped as soon as no page shows it (`gcTime: 0`, the app keeps unobserved
 * data for ten minutes otherwise), so a link opened later in the same tab never meets the summary of another one. It is read again whenever the page opens
 * (`refetchOnMount: 'always'`) and never on a focus: the same two public endpoints answer every guest of a network, and a document that was issued is the same.
 */
export function usePublicFiscalDocument(documentId: string, token: string) {
  return useQuery<PublicFiscalDocument>({
    queryKey: [PUBLIC_FISCAL_DOCUMENT_KEY, documentId],
    queryFn: () => publicFiscalDocumentsApi.getDocument(documentId, token),
    enabled: documentId !== '' && token !== '',
    gcTime: 0,
    staleTime: SUMMARY_STALE_MS,
    refetchOnMount: 'always',
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
}

interface DownloadInput {
  language: string;
  number: string;
}

/**
 * The guest saves the PDF of the document. Sent once per click: a mutation never retries by itself (`queryClient`). The token is only in the memory of the open page:
 * no key and no variable hold it, a failure is kept without the request that carried it, the bytes go to the file and are not kept, and the mutation is dropped from
 * the cache as soon as the page is closed (`gcTime: 0`).
 */
export function useDownloadPublicFiscalDocument(documentId: string, token: string) {
  return useMutation<void, unknown, DownloadInput>({
    mutationFn: ({ language, number }) => saveDownload(publicFiscalDocumentsApi.downloadPdf(documentId, token, language), pdfFileNameOf(number)),
    gcTime: 0,
  });
}
