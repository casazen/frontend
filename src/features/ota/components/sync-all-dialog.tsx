import { useTranslation } from 'react-i18next';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';

interface SyncAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void | Promise<void>;
  isLoading?: boolean;
  platformCount?: number;
}

export function SyncAllDialog({
  open,
  onOpenChange,
  onConfirm,
  isLoading,
  platformCount = 0,
}: SyncAllDialogProps) {
  const { t } = useTranslation();

  const handleConfirm = async () => {
    await onConfirm();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('ota.syncAll.title')}</DialogTitle>
          <DialogDescription>
            {t('ota.syncAll.description', { count: platformCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          <div className="rounded-lg bg-muted p-4">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="font-medium">{t('ota.syncAll.whatHappens')}</p>
                <ul className="text-sm text-muted-foreground mt-2 space-y-1">
                  <li>• {t('ota.syncAll.step1')}</li>
                  <li>• {t('ota.syncAll.step2')}</li>
                  <li>• {t('ota.syncAll.step3')}</li>
                  <li>• {t('ota.syncAll.step4')}</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isLoading}>
            {t('ota.syncAll.cancel')}
          </Button>
          <Button onClick={handleConfirm} disabled={isLoading}>
            {isLoading ? t('ota.syncAll.syncing') : t('ota.syncAll.startSync')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
