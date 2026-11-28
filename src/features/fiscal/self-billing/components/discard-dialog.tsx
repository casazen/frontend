import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { getProblemMessage } from '@/lib/api-errors';
import { useDiscardSelfBilling } from '@/queries/use-self-billing';

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
