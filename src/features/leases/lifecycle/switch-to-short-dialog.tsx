import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { propertyModePath } from '@/features/properties/mode/paths';
import { addDays, parseStayDate } from '@/lib/stay-dates';
import type { LeaseDetail } from '@/types';
import { leaseTermEnd, longDay, type LeaseSubject } from './lifecycle-format';

interface SwitchToShortDialogProps {
  open: boolean;
  lease: LeaseDetail;
  subject: LeaseSubject;
  onClose: () => void;
}

/**
 * «Passa ad affitto breve» (LR-10): the change of mode of the property is its own page (PM-03), and this window only says what it needs
 * before the person goes there. The first day the property can be let short is the day after the end of the period the lease is in,
 * and a lease that renews by itself has to have its notice recorded first: without it the change that was set for that day fails at
 * midnight, because the lease goes on (LR-14-FU4). Nothing is decided here.
 */
export function SwitchToShortDialog({ open, lease, subject, onClose }: SwitchToShortDialogProps) {
  const { t, i18n } = useTranslation();
  const firstDay = longDay(addDays(parseStayDate(leaseTermEnd(lease)), 1), i18n.language);
  const endIsSettled = Boolean(lease.noticeOn || lease.terminatedOn);

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent data-testid="lease-switch-to-short-dialog">
        <DialogHeader>
          <DialogTitle>{t('leaseLifecycle.switchToShort.title')}</DialogTitle>
          <DialogDescription>{t('leaseLifecycle.switchToShort.description', subject)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-2 text-sm">
          <p>{t('leaseLifecycle.switchToShort.firstDay', { date: firstDay })}</p>
          {endIsSettled ? null : <p>{t('leaseLifecycle.switchToShort.needsNotice')}</p>}
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose}>
            {t('shared.cancel')}
          </Button>
          <Button asChild>
            <Link to={propertyModePath('long-rent', lease.propertyId)}>{t('leaseLifecycle.switchToShort.go')}</Link>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
