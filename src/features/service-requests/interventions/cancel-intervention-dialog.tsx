import { useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useCancelIntervention } from '@/queries/use-service-requests';
import type { ServiceRequest } from '@/types/service-request';
import { supplierRef } from '../long-rent/long-rent-request-model';

/** Longest reason the API accepts (`CancelServiceRequestRequest.Reason`, SP-04). */
const CANCEL_REASON_MAX_LENGTH = 500;

interface CancelInterventionDialogProps {
  request: ServiceRequest;
  onClose: () => void;
}

/**
 * «Annulla intervento» (SR-08): the host cancels a request up to the work in progress. The window says what follows (the supplier is
 * told at once, with the reason; it cannot be reopened; **cancelling is always free**, decision D6) and asks why: the reason is required
 * by the API and the supplier reads it. The supplier is written to only when the host confirms here.
 */
export function CancelInterventionDialog({ request, onClose }: CancelInterventionDialogProps) {
  const { t } = useTranslation();
  const cancel = useCancelIntervention();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const { supplierStart } = supplierRef(request, t);
  const consequences = [
    t('interventions.cancel.consequences.free'),
    t('interventions.cancel.consequences.told', { supplierStart }),
    t('interventions.cancel.consequences.final'),
    ...(request.status === 'InCorso' ? [t('interventions.cancel.consequences.inProgress')] : []),
  ];

  const submit = (event: FormEvent) => {
    event.preventDefault();
    // The window is drawn outside the page but sits inside it for React, which hands an event to the parents of a portal.
    event.stopPropagation();
    if (trimmed && !cancel.isPending) cancel.mutate({ id: request.id, reason: trimmed }, { onSuccess: onClose });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !cancel.isPending && onClose()}>
      <DialogContent data-testid="intervention-cancel-dialog">
        <form onSubmit={submit} className="grid gap-4" noValidate>
          <DialogHeader>
            <DialogTitle>{t('interventions.cancel.title')}</DialogTitle>
            <DialogDescription>{t('interventions.cancel.description')}</DialogDescription>
          </DialogHeader>

          <ul role="list" aria-label={t('interventions.cancel.consequences.label')} className="grid gap-2" data-testid="intervention-cancel-consequences">
            {consequences.map((consequence) => (
              <li key={consequence} className="flex items-start gap-2 text-sm">
                <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <span className="min-w-0 break-words">{consequence}</span>
              </li>
            ))}
          </ul>

          <div className="space-y-2">
            <Label htmlFor="intervention-cancel-reason">{t('interventions.cancel.reason')}</Label>
            <Textarea
              id="intervention-cancel-reason"
              value={reason}
              maxLength={CANCEL_REASON_MAX_LENGTH}
              rows={3}
              onChange={(event) => setReason(event.target.value)}
              aria-describedby="intervention-cancel-reason-hint"
              data-testid="intervention-cancel-reason"
            />
            <p id="intervention-cancel-reason-hint" className="text-sm text-foreground/70">
              {t('interventions.cancel.reasonHint', { max: CANCEL_REASON_MAX_LENGTH })}
            </p>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={cancel.isPending}>
              {t('interventions.cancel.back')}
            </Button>
            <Button type="submit" variant="destructive" disabled={!trimmed} loading={cancel.isPending} data-testid="intervention-cancel-confirm">
              {t('interventions.cancel.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
