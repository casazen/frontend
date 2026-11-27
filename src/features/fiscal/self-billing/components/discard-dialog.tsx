import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { getProblemMessage } from '@/lib/api-errors';
import { useDiscardSelfBilling } from '@/queries/use-self-billing';

/**
 * The confirmation of the discard of a draft (no number is consumed). A refusal or a call that gets no answer is told in the dialog, in the words of its code (else a sentence that says the draft is still there), and the dialog
 * stays open: the confirmation lets the dialog stay open on a failure and says nothing itself, so a failure that is not told here would be a silent one.
 */
export function DiscardDialog({ id, onClose, onDiscarded }: { id: string; onClose: () => void; onDiscarded: () => void }) {
  const { t } = useTranslation();
  const discard = useDiscardSelfBilling();
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        // While the call is on its way the dialog stays, so that a failure is told in it.
        if (!open && !discard.isPending) onClose();
      }}
      title={t('selfBilling.detail.discard.title')}
      description={t('selfBilling.detail.discard.description')}
      confirmLabel={t('selfBilling.detail.discard.confirm')}
      variant="destructive"
      isLoading={discard.isPending}
      onConfirm={async () => {
        setProblem(null);
        try {
          await discard.mutateAsync({ documentId: id });
        } catch (error) {
          setProblem(getProblemMessage(error, t) ?? t('selfBilling.detail.discard.failed'));
          throw error;
        }
        toast.success(t('selfBilling.detail.discard.done'));
        onDiscarded();
      }}
    >
      {problem ? (
        <Alert variant="danger" data-testid="self-billing-discard-problem">
          {problem}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}
