import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';
import { toastUndo } from '@/lib/toast-undo';
import { usePublishShowcase, useUndoPublishShowcase } from '@/queries/supplier/use-showcase';
import type { ShowcaseContent } from '@/types/supplier-showcase';
import { bookingsReasonKey } from './showcase-model';

/**
 * Publishes the draft and tells how it went (the overview and the last step of the editor do it the same way): a toast whose "Annulla"
 * really takes the publication back on the server (`publish/undo`, open for a few minutes), saying whether the bookings opened and,
 * if not, why; a refusal is said in the words of the server (what is missing, a version that is no longer the current one).
 *
 * `onContent` hears of the document the server answered with after the publication and after its undo: the editor needs the new version.
 */
export function useShowcasePublish(onContent?: (content: ShowcaseContent) => void) {
  const { t } = useTranslation();
  const publish = usePublishShowcase();
  const undo = useUndoPublishShowcase();

  const run = (version: number) =>
    publish.mutate(version, {
      onSuccess: (updated) => {
        onContent?.(updated);
        const reasonKey = bookingsReasonKey(updated.bookings.blockedBy);
        toastUndo(t('supplier.showcase.toast.published'), {
          description: updated.bookings.open ? t('supplier.showcase.toast.bookingsOpen') : reasonKey ? t(reasonKey) : undefined,
          // The server keeps the version published before for a few minutes: this really puts it back.
          undo: async () => {
            // Awaited first: `onContent?.(await ...)` does not evaluate its argument when nobody listens (the overview), and the
            // Annulla would then say it undid the publication without asking the server.
            const restored = await undo.mutateAsync();
            onContent?.(restored);
          },
        });
      },
      onError: (error) => toast.error(getProblemMessage(error, t) ?? t('supplier.showcase.toast.publishFailed')),
    });

  return { run, isPending: publish.isPending };
}
