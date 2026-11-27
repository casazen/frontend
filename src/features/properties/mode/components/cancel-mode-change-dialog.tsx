import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { useCancelPropertyModeChange } from '@/queries/use-property-mode';
import type { PropertyModeChange } from '@/types/property-mode.types';

interface CancelModeChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  propertyId: string;
  change: PropertyModeChange;
  onCancelled?: () => void;
}

export function CancelModeChangeDialog({ open, onOpenChange, propertyId, change, onCancelled }: CancelModeChangeDialogProps) {
  const { t } = useTranslation();
  const cancel = useCancelPropertyModeChange(propertyId);
  const toLong = change.toMode === 'Long';

  const confirm = async () => {
    try {
      await cancel.mutateAsync(change.id);
    } catch {
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
