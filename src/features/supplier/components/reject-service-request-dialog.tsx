import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';

/** Longest reason the API accepts (`RejectServiceRequestRequest.Reason`, SU-10). */
export const REJECT_REASON_MAX_LENGTH = 500;

/**
 * Asks the supplier why it rejects a request: the reason is required and shown to the host. Used by the inbox list and
 * the request detail (SU-08).
 */
export function RejectServiceRequestDialog({
  open,
  isPending,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  isPending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const trimmed = reason.trim();

  const close = () => {
    setReason('');
    onCancel();
  };

  return (
    <Dialog open={open} onOpenChange={(value) => !value && close()}>
      <DialogContent data-testid="reject-dialog">
        <DialogHeader>
          <DialogTitle>{t('serviceRequest.rejectTitle')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="reject-reason">{t('serviceRequest.rejectReason')}</Label>
          <Textarea
            id="reject-reason"
            value={reason}
            maxLength={REJECT_REASON_MAX_LENGTH}
            onChange={(e) => setReason(e.target.value)}
            aria-describedby="reject-reason-hint"
            data-testid="reject-reason"
          />
          <p id="reject-reason-hint" className="text-xs text-muted-foreground">
            {t('supplier.request.rejectReasonHint')}
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={close}>
            {t('supplier.request.cancel')}
          </Button>
          <Button
            onClick={() => onConfirm(trimmed)}
            disabled={!trimmed || isPending}
            data-testid="reject-confirm"
          >
            {t('serviceRequest.reject')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
