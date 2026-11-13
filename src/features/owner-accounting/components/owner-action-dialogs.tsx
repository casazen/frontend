import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { useApproveVersion, usePublishVersion } from '@/queries/use-owner-accounting';
import type { OwnerStatementVersion } from '@/types';
import { messageOf, type ActionContext, type ActionKey } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';
import { CloseDialog } from './close-dialog';
import { PayoutDialog } from './payout-dialog';

interface OwnerActionDialogsProps {
  ctx: ActionContext;
  asked: ActionKey | null;
  onDismiss: () => void;
  /** Makes a new version (it throws when the server refuses). */
  generate: () => Promise<OwnerStatementVersion>;
  /** A new version is being made. */
  generating?: boolean;
}

type StepAction = 'approve' | 'publish' | 'regenerate';

/**
 * The dialogs of the actions that ask for a confirmation: each says what will happen and what will not be possible afterwards, in proportion
 * to the risk (E06/F05/US02/T04). Approving and publishing are different steps with different permissions on the server (it answers 403 to who
 * lacks them, and the dialog shows it); paying and closing have a dialog of their own because they move money and shut the month.
 */
export function OwnerActionDialogs({ ctx, asked, onDismiss, generate, generating = false }: OwnerActionDialogsProps) {
  if (!asked || asked === 'prepare') return null;
  const onOpenChange = (open: boolean) => {
    if (!open) onDismiss();
  };
  if (asked === 'payout') return <PayoutDialog open onOpenChange={onOpenChange} ctx={ctx} />;
  if (asked === 'close') return <CloseDialog open onOpenChange={onOpenChange} ctx={ctx} />;
  return <StepDialog action={asked} ctx={ctx} onOpenChange={onOpenChange} generate={generate} generating={generating} />;
}

interface StepDialogProps {
  action: StepAction;
  ctx: ActionContext;
  onOpenChange: (open: boolean) => void;
  generate: () => Promise<OwnerStatementVersion>;
  generating: boolean;
}

function StepDialog({ action, ctx, onOpenChange, generate, generating }: StepDialogProps) {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const approve = useApproveVersion();
  const publish = usePublishVersion();
  const [error, setError] = useState<string | null>(null);
  const { version } = ctx;
  const values = { owner: ctx.ownerName, period: month(ctx.period.year, ctx.period.month), version: version?.version ?? 0 };

  const run = async () => {
    setError(null);
    try {
      if (action === 'regenerate') await generate();
      else if (!version) return;
      else if (action === 'approve') await approve.mutateAsync(version.id);
      else await publish.mutateAsync(version.id);
      if (action !== 'regenerate') toast.success(t(`ownerAccounting.step.${action}.done`, values));
    } catch (failure) {
      setError(messageOf(failure, t));
      // The dialog stays open with the reason: the person fixes it and asks again.
      throw failure;
    }
  };

  const consequences = [1, 2].map((n) => t(`ownerAccounting.step.${action}.consequence${n}`, values));
  return (
    <ConfirmationDialog
      open
      onOpenChange={onOpenChange}
      title={t(`ownerAccounting.step.${action}.title`, values)}
      description={t(`ownerAccounting.step.${action}.description`, values)}
      confirmLabel={t(`ownerAccounting.step.${action}.confirm`)}
      consequences={consequences}
      isLoading={approve.isPending || publish.isPending || generating}
      onConfirm={run}
    >
      {error ? (
        <Alert variant="danger" data-testid="step-error">
          {error}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}
