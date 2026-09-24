import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Loader2 } from 'lucide-react';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useDeclareStipula } from '@/queries/use-leases';
import { formatDate } from '@/lib/utils';
import { isStayDate, todayInRome } from '@/lib/stay-dates';

interface StipulaDeclarationDialogProps {
  leaseId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Stipula date of a lease already signed whose signing day CasaZen never recorded (older leases, LT-02): once declared
 * the RLI deadline is fixed (LT-04). The date can be declared only once.
 */
export function StipulaDeclarationDialog({ leaseId, open, onOpenChange }: StipulaDeclarationDialogProps) {
  const { t } = useTranslation();
  const declare = useDeclareStipula();
  const today = todayInRome();
  const [stipulaDate, setStipulaDate] = useState('');
  const [confirmed, setConfirmed] = useState(false);

  const dateValid = isStayDate(stipulaDate) && stipulaDate <= today;
  const canSubmit = dateValid && confirmed && !declare.isPending;

  function handleOpenChange(next: boolean) {
    if (!next) {
      setStipulaDate('');
      setConfirmed(false);
    }
    onOpenChange(next);
  }

  function handleSubmit() {
    if (!canSubmit) return;
    declare.mutate({ id: leaseId, stipulaDate }, { onSuccess: () => handleOpenChange(false) });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent data-testid="stipula-declaration-dialog">
        <DialogHeader>
          <DialogTitle>{t('leases.signature.stipulaDialog.title')}</DialogTitle>
          <DialogDescription>{t('leases.signature.stipulaDialog.description')}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`declared-stipula-${leaseId}`}>{t('leases.signature.stipulaDateLabel')}</Label>
            <Input
              id={`declared-stipula-${leaseId}`}
              type="date"
              value={stipulaDate}
              max={today}
              onChange={(e) => setStipulaDate(e.target.value)}
              aria-describedby={`declared-stipula-hint-${leaseId}`}
            />
            <p id={`declared-stipula-hint-${leaseId}`} className="text-xs text-muted-foreground">
              {t('leases.signature.stipulaDateHint')}
            </p>
            {stipulaDate !== '' && !dateValid && (
              <p className="text-sm text-destructive" role="alert">
                {t('leases.signature.stipulaDateInvalid', { today: formatDate(today) })}
              </p>
            )}
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id={`declared-stipula-confirm-${leaseId}`}
              checked={confirmed}
              onCheckedChange={(value) => setConfirmed(value === true)}
            />
            <Label htmlFor={`declared-stipula-confirm-${leaseId}`} className="text-sm font-normal leading-snug">
              {t('leases.signature.stipulaDialog.confirmation')}
            </Label>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
            {t('leases.signature.cancel')}
          </Button>
          <Button type="button" onClick={handleSubmit} disabled={!canSubmit}>
            {declare.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {t('leases.signature.saving')}
              </>
            ) : (
              t('leases.signature.stipulaDialog.submit')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
