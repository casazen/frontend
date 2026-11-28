import type { DownloadedFile } from '@/api/file.api';
import { contentDispositionFileName } from '@/features/document-archive/document-file';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { saveBlobAs } from '@/lib/file-download';

export async function saveDownload(request: Promise<DownloadedFile>, fallbackName: string): Promise<void> {
  try {
    const { blob, contentDisposition } = await request;
    saveBlobAs(blob, contentDispositionFileName(contentDisposition) ?? fallbackName);
  } catch (error) {
    throw withoutRequest(error);
  }
}
