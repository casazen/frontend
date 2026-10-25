import { useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCancelLongRentServiceRequest } from '@/queries/use-service-requests';
import type { ServiceRequest } from '@/types/service-request';
import { supplierRef } from './long-rent-request-model';

/** Longest reason the API accepts (`CancelServiceRequestRequest.Reason`, SP-04). */
const CANCEL_REASON_MAX_LENGTH = 500;

interface CancelLongRentRequestDialogProps {
  request: ServiceRequest;
  onClose: () => void;
}

/**
 * «Annulla intervento» (LR-08b): the landlord cancels a request up to the work in progress. The window says what follows (the
 * supplier is told, at once, with the reason; it cannot be reopened) and asks why: the reason is required by the API and the
 * supplier reads it. It is the layout of `ConfirmationDialog` with the one field that dialog does not have. The supplier is written
 * to only when the landlord confirms here.
 */
export function CancelLongRentRequestDialog({ request, onClose }: CancelLongRentRequestDialogProps) {
  const { t } = useTranslation();
  const cancel = useCancelLongRentServiceRequest();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const { supplierStart } = supplierRef(request, t);
  const consequences = [
    t('longRentRequests.cancel.consequences.told', { supplierStart }),
    t('longRentRequests.cancel.consequences.final'),
    ...(request.status === 'InCorso' ? [t('longRentRequests.cancel.consequences.inProgress')] : []),
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The window is drawn outside the page but sits inside it for React, which hands an event to the parents of a portal.
    event.stopPropagation();
    if (trimmed && !cancel.isPending) cancel.mutate({ id: request.id, reason: trimmed }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !cancel.isPending && onClose()}>
      <DialogContent data-testid="long-rent-request-cancel-dialog">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('longRentRequests.cancel.title')}</DialogTitle>
            <DialogDescription>{t('longRentRequests.cancel.description')}</DialogDescription>
          </DialogHeader>

          <ul role="list" aria-label={t('longRentRequests.cancel.consequences.label')} className="grid gap-2" data-testid="long-rent-request-cancel-consequences">
            {consequences.map((consequence) => (
              <li key={consequence} className="flex items-start gap-2 text-sm">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span className="min-w-0 break-words">{consequence}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <Label htmlFor="long-rent-request-cancel-reason">{t('longRentRequests.cancel.reason')}</Label>
            <Textarea
              id="long-rent-request-cancel-reason"
              value={reason}
              maxLength={CANCEL_REASON_MAX_LENGTH}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby="long-rent-request-cancel-reason-hint"
              data-testid="long-rent-request-cancel-reason"
            />
            <p id="long-rent-request-cancel-reason-hint" className="text-sm text-foreground/70">
              {t('longRentRequests.cancel.reasonHint', { max: CANCEL_REASON_MAX_LENGTH })}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={cancel.isPending}>
              {t('longRentRequests.cancel.back')}
            </Button>
            <Button type="submit" variant="destructive" disabled={!trimmed} loading={cancel.isPending} data-testid="long-rent-request-cancel-confirm">
              {t('longRentRequests.cancel.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
