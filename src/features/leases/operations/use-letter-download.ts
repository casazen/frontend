import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';
import { saveBlobAs, withJsonErrorBody } from '@/lib/file-download';

/**
 * Downloads the draft of a letter (LR-OPS-1): asks the server for the PDF, saves it with the name given and tells why in a sentence when
 * the server refuses (a day that is not valid, a letter that is not available). One download at a time: a second click while the first
 * runs does nothing. The letter carries the residences of the parties, so nothing of it is kept here.
 */
export function useLetterDownload() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  async function download(fetchPdf: () => Promise<Blob>, fileName: string) {
    if (busy) return;
    setBusy(true);
    try {
      saveBlobAs(await fetchPdf(), fileName);
    } catch (error) {
      toast.error(getProblemMessage(await withJsonErrorBody(error), t) ?? t('leaseOperations.download.failed'));
    } finally {
      setBusy(false);
    }
  }

  return { busy, download };
}
