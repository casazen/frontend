import { useState } from 'react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { CinStatus } from '@/types';

interface PropertyCinDialogProps {
  propertyId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cinStatus: CinStatus;
  cinCode?: string | null;
  onSave: (cinCode: string | null) => Promise<void>;
  isSaving?: boolean;
}

export function PropertyCinDialog({
  open,
  onOpenChange,
  cinStatus,
  cinCode,
  onSave,
  isSaving,
}: PropertyCinDialogProps) {
  const { t } = useTranslation();
  const [value, setValue] = useState(cinCode ?? '');

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setValue(cinCode ?? '');
    }
    onOpenChange(next);
  };

  const handleSave = async () => {
    const trimmed = value.trim();
    await onSave(trimmed.length > 0 ? trimmed : null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('property.cin.dialog.title')}</DialogTitle>
          <DialogDescription>
            {t('property.cin.dialog.description')}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2">
          <Label htmlFor="cin-code">{t('property.cin.dialog.label')}</Label>
          <Input
            id="cin-code"
            value={value}
            onChange={(e) => setValue(e.target.value.toUpperCase())}
            placeholder={t('property.cin.dialog.placeholder')}
            aria-invalid={cinStatus === 'Invalid'}
          />
          <p className="text-xs text-muted-foreground">
            {t('property.cin.dialog.hint')}
          </p>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('property.cin.dialog.cancel')}
          </Button>
          <Button type="button" onClick={handleSave} disabled={isSaving}>
            {isSaving ? t('property.cin.dialog.saving') : t('property.cin.dialog.save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
