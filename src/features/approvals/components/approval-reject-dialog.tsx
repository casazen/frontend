import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { REJECTION_REASON_MAX_LENGTH, itemIsGone } from '@/features/approvals/lib/approval-model';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import type { useRejectItem } from '@/queries/approvalQueue';
import type { ApprovalQueueItem } from '@/types/approval-queue.types';

interface ApprovalRejectDialogProps {
  /** The item to reject; `null` while the dialog is closed. */
  item: ApprovalQueueItem | null;
  /**
   * The mutation belongs to the page, not to the dialog: the host may close the dialog (the X, Esc, a tap outside) while the request goes on, and the rejection
   * must still be written below with its reason, and the page must keep its buttons waiting until it is over.
   */
  reject: ReturnType<typeof useRejectItem>;
  onClose: () => void;
  /** The item was rejected: it as the API answered it, with the reason it saved. */
  onRejected: (item: ApprovalQueueItem) => void;
}

/**
 * Reject an item (AC-NF68-3): the reason is mandatory (at most 500 characters), is saved on the item and is shown on the page afterwards. An empty reason
 * is not sent: the field says so. The API stays the judge (422 `approval_rejection_reason_required`).
 */
export function ApprovalRejectDialog({ item, reject, onClose, onRejected }: ApprovalRejectDialogProps) {
  return (
    <Dialog
      open={item !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      {item ? <RejectDialogBody key={item.id} item={item} reject={reject} onClose={onClose} onRejected={onRejected} /> : null}
    </Dialog>
  );
}

function RejectDialogBody({ item, reject, onClose, onRejected }: Omit<ApprovalRejectDialogProps, 'item'> & { item: ApprovalQueueItem }) {
  const { t } = useTranslation();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const length = reason.trim().length;

  const confirm = () => {
    if (length === 0) {
      setError(t('approval.reject.reasonRequired'));
      return;
    }
    if (length > REJECTION_REASON_MAX_LENGTH) {
      setError(t('approval.reject.reasonTooLong', { max: REJECTION_REASON_MAX_LENGTH }));
      return;
    }

    reject.mutate(
      { id: item.id, data: { reason: reason.trim() } },
      {
        onSuccess: (rejected) => {
          onRejected(rejected);
          onClose();
        },
        onError: (failure) => {
          // The toast of the hook says why. An item that is not there any more is not kept open in a dialog; a reason the API refuses stays on the form.
          if (itemIsGone(failure)) onClose();
          else if (getHttpStatus(failure) === 422) setError(getProblemMessage(failure, t) ?? t('approval.reject.reasonRequired'));
        },
      },
    );
  };

  return (
    <DialogContent data-testid="approval-reject-dialog">
      <DialogHeader>
        <DialogTitle>{t('approval.dialog.rejectTitle')}</DialogTitle>
        <DialogDescription>{t('approval.dialog.rejectDescription')}</DialogDescription>
      </DialogHeader>
      <Field
        label={t('approval.dialog.reasonLabel')}
        counter={`${length}/${REJECTION_REASON_MAX_LENGTH}`}
        error={error ?? undefined}
      >
        <Textarea
          placeholder={t('approval.dialog.reasonPlaceholder')}
          value={reason}
          onChange={(event) => {
            setReason(event.target.value);
            setError(null);
          }}
          rows={4}
          disabled={reject.isPending}
        />
      </Field>
      <DialogFooter className="gap-2 sm:gap-0">
        <Button type="button" variant="outline" onClick={onClose} disabled={reject.isPending}>
          {t('shared.cancel')}
        </Button>
        <Button type="button" variant="destructive" onClick={confirm} loading={reject.isPending}>
          {t('approval.action.reject')}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}
