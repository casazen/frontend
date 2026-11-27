import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { getProblemMessage } from '@/lib/api-errors';
import { useIssueSelfBilling } from '@/queries/use-self-billing';
import type { SelfBillingDetail } from '@/types';
import { isDraftOutdated } from '../self-billing-model';
import { money } from '../self-billing-words';

/**
 * The confirmation of the issue (the TD17 is numbered in the series of its holder, and from then on it does not change): the total in its own currency and, when part of the amount is an estimate (a rule of the
 * agency or the default of the channel, not the figure of the portal), the box the person ticks to accept it, without which the button stays off and the server would refuse. A refusal is told in the dialog, in the words of
 * its code, and the dialog stays open. A draft refused as outdated (409 `document_draft_outdated`: it was made with data that changed since) is told as «rifai le bozze del mese», with the action that makes them
 * again (the same as the button of the page, for the month of this draft); until then the issue is not offered again, since it would be refused in the same way.
 */
export function IssueDialog({ detail, onClose, onRedoDrafts }: { detail: SelfBillingDetail; onClose: () => void; onRedoDrafts: (year: number, month: number) => void }) {
  const { t, i18n } = useTranslation();
  const issue = useIssueSelfBilling();
  const [accepted, setAccepted] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [outdated, setOutdated] = useState(false);
  const estimate = detail.estimatedAmount > 0;
  const redo = outdated ? (
    <Button type="button" size="sm" variant="outline" onClick={() => onRedoDrafts(detail.invoice.periodYear, detail.invoice.periodMonth)} data-testid="self-billing-redo-drafts">
      {t('selfBilling.detail.issue.redo')}
    </Button>
  ) : undefined;

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        // While the call is on its way the dialog stays (Esc, the cross and a click outside included): closed, it would leave a failure with nowhere to be told.
        if (!open && !issue.isPending) onClose();
      }}
      title={t('selfBilling.detail.issue.title')}
      description={t('selfBilling.detail.issue.description', { total: money(detail.invoice.total, detail.invoice.currency, i18n.language) })}
      confirmLabel={t('selfBilling.detail.issue.confirm')}
      consequences={[t('selfBilling.detail.issue.consequence')]}
      confirmDisabled={(estimate && !accepted) || outdated}
      isLoading={issue.isPending}
      onConfirm={async () => {
        setProblem(null);
        setOutdated(false);
        try {
          const issued = await issue.mutateAsync({ documentId: detail.invoice.id, request: { acceptEstimate: estimate && accepted } });
          toast.success(issued.invoice.number ? t('selfBilling.detail.issue.doneNumbered', { number: issued.invoice.number }) : t('selfBilling.detail.issue.done'));
        } catch (error) {
          const refusedAsOutdated = isDraftOutdated(error);
          setOutdated(refusedAsOutdated);
          setProblem(refusedAsOutdated ? t('selfBilling.detail.issue.outdated') : (getProblemMessage(error, t) ?? t('selfBilling.detail.issue.failed')));
          throw error;
        }
      }}
    >
      {estimate ? (
        <label className="flex min-h-11 cursor-pointer items-start gap-2 text-sm" data-testid="self-billing-accept-estimate">
          <input type="checkbox" className="mt-0.5 size-4 shrink-0 accent-primary" checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />
          <span>{t('selfBilling.detail.issue.accept', { amount: money(detail.estimatedAmount, detail.invoice.currency, i18n.language) })}</span>
        </label>
      ) : null}
      {problem ? (
        <Alert variant="danger" data-testid="self-billing-issue-problem" action={redo}>
          {problem}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}
