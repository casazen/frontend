import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface DelegaCaptureDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tosVersion: string;
  attestationText: string;
  isSubmitting?: boolean;
  onConfirm: (payload: { tosVersion: string; attestationAccepted: boolean }) => void;
}

export function DelegaCaptureDialog({
  open,
  onOpenChange,
  tosVersion,
  attestationText,
  isSubmitting,
  onConfirm,
}: DelegaCaptureDialogProps) {
  const { t } = useTranslation();
  const [accepted, setAccepted] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('leases.rli.delegaTitle')}</DialogTitle>
          <DialogDescription>{t('leases.rli.delegaIntro')}</DialogDescription>
        </DialogHeader>
        <p className="text-sm whitespace-pre-wrap">{attestationText}</p>
        <p className="text-xs text-muted-foreground">
          {t('leases.rli.tosVersionLabel')}: {tosVersion}
        </p>
        <label className="flex items-start gap-2 text-sm">
          <Checkbox
            checked={accepted}
            onCheckedChange={(value) => setAccepted(value === true)}
            aria-label={t('leases.rli.attestationCheckbox')}
          />
          <span>{t('leases.rli.attestationCheckbox')}</span>
        </label>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('leases.rli.cancel')}
          </Button>
          <Button
            type="button"
            disabled={!accepted || isSubmitting}
            onClick={() => onConfirm({ tosVersion, attestationAccepted: true })}
          >
            {t('leases.rli.confirmSubmit')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
