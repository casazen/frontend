import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { getProblemMessage } from '@/lib/api-errors';
import { toastUndo } from '@/lib/toast-undo';
import { usePublishShowcase, useUndoPublishShowcase } from '@/queries/supplier/use-showcase';
import type { ShowcaseContent } from '@/types/supplier-showcase';
import { bookingsReasonKey } from './showcase-model';

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
          undo: async () => {
            const restored = await undo.mutateAsync();
            onContent?.(restored);
          },
        });
      },
      onError: (error) => toast.error(getProblemMessage(error, t) ?? t('supplier.showcase.toast.publishFailed')),
    });

  return { run, isPending: publish.isPending };
}
