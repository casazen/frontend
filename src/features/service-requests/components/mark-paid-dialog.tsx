import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function MarkPaidDialog({
  supplierName,
  category,
  isPending,
  onCancel,
  onConfirm,
}: {
  supplierName?: string | null;
  category: string;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Dialog open onOpenChange={(open) => !open && !isPending && onCancel()}>
      <DialogContent data-testid="mark-paid-dialog">
        <DialogHeader>
          <DialogTitle>{t('serviceRequest.markPaidDialog.title')}</DialogTitle>
          <DialogDescription>
            {supplierName
              ? t('serviceRequest.markPaidDialog.description', { supplier: supplierName, category })
              : t('serviceRequest.markPaidDialog.descriptionNoSupplier', { category })}
          </DialogDescription>
        </DialogHeader>
        <p className="text-sm text-muted-foreground" data-testid="mark-paid-warning">
          {t('serviceRequest.markPaidDialog.irreversible')}
        </p>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isPending} data-testid="mark-paid-cancel">
            {t('serviceRequest.markPaidDialog.cancel')}
          </Button>
          <Button onClick={onConfirm} disabled={isPending} data-testid="mark-paid-confirm">
            {t('serviceRequest.markPaidDialog.confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
