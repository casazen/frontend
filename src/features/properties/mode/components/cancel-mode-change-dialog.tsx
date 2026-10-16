import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { useCancelPropertyModeChange } from '@/queries/use-property-mode';
import type { PropertyModeChange } from '@/types/property-mode.types';

interface CancelModeChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  /** The change that waits for its day. */
  change: PropertyModeChange;
  /** Runs once the change is withdrawn (the dialog closes by itself). */
  onCancelled?: () => void;
}

/**
 * "Annulla il passaggio": withdraws the change that waits for its day, after saying what it leads to. There is no "Undo" in the
 * toast that follows: programming it again is not the same thing (a stay may have come in the meantime). The mutation says why
 * when it fails (toast); the dialog closes either way, and the page shows the state as the server has it.
 */
export function CancelModeChangeDialog({ open, onOpenChange, propertyId, change, onCancelled }: CancelModeChangeDialogProps) {
  const { t } = useTranslation();
  const cancel = useCancelPropertyModeChange(propertyId);
  const toLong = change.toMode === 'Long';

  const confirm = async () => {
    try {
      await cancel.mutateAsync(change.id);
    } catch {
      // The toast of the mutation already says why; the page refreshes to the state the server has.
      return;
    }
    onCancelled?.();
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t(toLong ? 'propertyMode.cancel.toLong.title' : 'propertyMode.cancel.toShort.title')}
      description={t('propertyMode.cancel.description')}
      consequences={
        toLong
          ? [t('propertyMode.cancel.toLong.stays'), t('propertyMode.cancel.toLong.calendar')]
          : [t('propertyMode.cancel.toShort.stays'), t('propertyMode.cancel.toShort.again')]
      }
      confirmLabel={t('propertyMode.cancel.action')}
      cancelLabel={t('propertyMode.cancel.keep')}
      isLoading={cancel.isPending}
      onConfirm={confirm}
    />
  );
}
