import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** Longest reason the API accepts (`RejectServiceRequestRequest.Reason`, SU-10). */
export const REJECT_REASON_MAX_LENGTH = 500;

/**
 * Asks the supplier why it rejects a request (`reject`) or cancels a job it took and has not started (`cancel`, SP-16c-c): the reason is
 * required and shown to the host or the customer. Used by the inbox list, the drawer and the request detail (SU-08).
 */
export function RejectServiceRequestDialog({
  open,
  isPending,
  onCancel,
  onConfirm,
  mode = 'reject',
}: {
  open: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  mode?: 'reject' | 'cancel';
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();
  const cancelling = mode === 'cancel';

  const close = () => {
    setReason('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent data-testid={cancelling ? 'cancel-dialog' : 'reject-dialog'}>
        <DialogHeader>
          <DialogTitle>{cancelling ? t('supplier.requests.cancel.title') : t('serviceRequest.rejectTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor={cancelling ? 'cancel-reason' : 'reject-reason'}>
            {cancelling ? t('supplier.requests.cancel.reason') : t('serviceRequest.rejectReason')}
          </Label>
          <Textarea
            id={cancelling ? 'cancel-reason' : 'reject-reason'}
            value={reason}
            maxLength={REJECT_REASON_MAX_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby="reject-reason-hint"
            data-testid={cancelling ? 'cancel-reason' : 'reject-reason'}
          />
          <p id="reject-reason-hint" className="text-sm text-foreground/70">
            {t('supplier.requests.reject.hint')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {cancelling ? t('supplier.requests.cancel.back') : t('supplier.requests.reject.cancel')}
          </Button>
          <Button
            onClick={() => onConfirm(trimmed)}
            disabled={!trimmed || isPending}
            data-testid={cancelling ? 'cancel-confirm' : 'reject-confirm'}
          >
            {cancelling ? t('supplier.requests.cancel.confirm') : t('serviceRequest.reject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
