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
import { FormFieldError } from '@/components/shared/form-field-error';
import { CIN_FORMAT_MESSAGE_KEY, isEmptyOrValidCin, normalizeCin } from '@/lib/cin-format';

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
  const [formatError, setFormatError] = useState(false);

  const handleOpenChange = (next: boolean) => {
    if (next) {
      setValue(cinCode ?? '');
      setFormatError(false);
    }
    onOpenChange(next);
  };

  const handleSave = async () => {
    if (!isEmptyOrValidCin(value)) {
      setFormatError(true);
      return;
    }
    await onSave(normalizeCin(value));
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
            onChange={(e) => {
              setValue(e.target.value.toUpperCase());
              setFormatError(false);
            }}
            placeholder={t('property.cin.dialog.placeholder')}
            aria-invalid={formatError || cinStatus === 'Invalid'}
            aria-describedby={formatError ? 'cin-code-error' : undefined}
          />
          {formatError && <FormFieldError id="cin-code-error" message={CIN_FORMAT_MESSAGE_KEY} />}
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
