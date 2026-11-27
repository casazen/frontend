import type { DownloadedFile } from '@/api/file.api';
import { contentDispositionFileName } from '@/features/document-archive/document-file';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { saveBlobAs } from '@/lib/file-download';

/**
 * Saves the file the server answered under the name it gave it (`Content-Disposition`), or under `fallbackName` when the page cannot read the header or it holds
 * no name, and lets the bytes go: the caller's mutation returns nothing, so the blob is not kept by the cache, and `saveBlobAs` releases its address. A
 * refusal keeps only the answer of the server, without the request that was sent.
 */
export async function saveDownload(request: Promise<DownloadedFile>, fallbackName: string): Promise<void> {
  try {
    const { blob, contentDisposition } = await request;
    saveBlobAs(blob, contentDispositionFileName(contentDisposition) ?? fallbackName);
  } catch (error) {
    throw withoutRequest(error);
  }
}
