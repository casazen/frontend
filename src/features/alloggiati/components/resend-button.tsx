import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, ClipboardCheck, Loader2 } from 'lucide-react';
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
import { useMarkAlloggiatiSentManually } from '@/queries/use-alloggiati';
import type { AlloggiatiWebStatus } from '@/types/alloggiati.types';
import {
  canMarkAlloggiatiSentManually,
  formatRecordDate,
  isAlloggiatiSent,
  isoDatePart,
  todayInRomeIso,
} from '../alloggiati-status.utils';

interface MarkSentManuallyButtonProps {
  bookingId: string;
  status: AlloggiatiWebStatus;
  /** Check-in date (date-only): the earliest sending date the portal accepts. */
  checkInDate: string;
  /** Date declared by the host or receipt date, shown once sent. */
  reportedAt?: string | null;
}

/**
 * Former "Resend" button (CO-11). The button transmits nothing, so there is nothing to resend: the host sends the schedina on the
 * Questura portal (the direct send of CasaZen, on activation, is a process of its own and does not use it) and declares it here, with
 * confirmation and date. Disabled once sent (receipt) or declared sent, and before the arrival day. The declaration stops the alerts and
 * closes the guest's online check-in (the link is no longer sent), and it cannot be undone from here: the dialog says so before it is confirmed.
 */
export function MarkSentManuallyButton({ bookingId, status, checkInDate, reportedAt }: MarkSentManuallyButtonProps) {
  const { t } = useTranslation();
  const mark = useMarkAlloggiatiSentManually();
  const [open, setOpen] = useState(false);
  const today = todayInRomeIso();
  const minDate = isoDatePart(checkInDate);
  const [sentOn, setSentOn] = useState(today);
  const [confirmed, setConfirmed] = useState(false);

  if (isAlloggiatiSent(status)) {
    return (
      <Button variant="outline" size="sm" disabled data-testid="alloggiati-resend-button">
        <CheckCircle2 className="mr-2 h-4 w-4" />
        {reportedAt
          ? t(status === 'Inviato' ? 'alloggiati.sentOn' : 'alloggiati.markedSentOn', { date: formatRecordDate(reportedAt) })
          : t(`alloggiati.statusLabel.${status}`)}
      </Button>
    );
  }

  const enabled = canMarkAlloggiatiSentManually(status);
  const dateValid = sentOn >= minDate && sentOn <= today;

  function openDialog() {
    setSentOn(today);
    setConfirmed(false);
    setOpen(true);
  }

  function handleConfirm() {
    mark.mutate({ bookingId, sentOn }, { onSuccess: () => setOpen(false) });
  }

  return (
    <>
      <span className="inline-flex flex-col items-start gap-1">
        <Button
          variant="outline"
          size="sm"
          onClick={openDialog}
          disabled={!enabled}
          data-testid="alloggiati-resend-button"
        >
          <ClipboardCheck className="mr-2 h-4 w-4" />
          {t('alloggiati.markSentManually')}
        </Button>
        {!enabled && (
          <span className="text-xs text-muted-foreground">{t('alloggiati.markSentAvailableFromArrival')}</span>
        )}
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent data-testid="alloggiati-mark-sent-dialog">
          <DialogHeader>
            <DialogTitle>{t('alloggiati.markSentDialog.title')}</DialogTitle>
            <DialogDescription>{t('alloggiati.markSentDialog.description')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm" data-testid="alloggiati-mark-sent-consequences">
              {t('alloggiati.markSentDialog.consequences')}
            </p>
            <div className="space-y-2">
              <Label htmlFor={`alloggiati-sent-on-${bookingId}`}>{t('alloggiati.markSentDialog.dateLabel')}</Label>
              <Input
                id={`alloggiati-sent-on-${bookingId}`}
                type="date"
                value={sentOn}
                min={minDate}
                max={today}
                onChange={(e) => setSentOn(e.target.value)}
                data-testid="alloggiati-sent-on"
              />
              {!dateValid && (
                <p className="text-sm text-destructive">
                  {t('alloggiati.markSentDialog.dateRange', { from: formatRecordDate(minDate), to: formatRecordDate(today) })}
                </p>
              )}
            </div>
            <div className="flex items-start gap-2">
              <Checkbox
                id={`alloggiati-sent-confirm-${bookingId}`}
                checked={confirmed}
                onCheckedChange={(value) => setConfirmed(value === true)}
                data-testid="alloggiati-sent-confirm"
              />
              <Label htmlFor={`alloggiati-sent-confirm-${bookingId}`} className="text-sm font-normal leading-snug">
                {t('alloggiati.markSentDialog.confirmation')}
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t('alloggiati.markSentDialog.cancel')}
            </Button>
            <Button
              onClick={handleConfirm}
              disabled={!confirmed || !dateValid || mark.isPending}
              data-testid="alloggiati-mark-sent-confirm"
            >
              {mark.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('alloggiati.markSentDialog.submit')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
