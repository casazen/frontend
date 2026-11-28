import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { sdiScopeOf } from '@/features/fiscal/documents/document-model';
import { getProblemMessage } from '@/lib/api-errors';
import { useDocumentSdi } from '@/queries/use-fiscal-documents';
import { useCorrectSelfBilling, useSelfBillingBusy } from '@/queries/use-self-billing';
import type { SelfBillingDetail, SelfBillingListItem } from '@/types';
import { correctionProblemOf, type CorrectionProblem } from '../self-billing-model';

/**
 * The confirmation of «Correggi e rimanda» of a TD17 the SDI rejected: for the tax office it was never issued, so it counts as not issued and stays in the history, a draft with the same number replaces it, and the person fixes
 * what the SDI refused and issues the draft (nothing goes to the SDI by itself). It says why the SDI refused it when the page can read that (the same read as the panel of the SDI of the detail; left out when it cannot, since
 * the correction does not depend on it). Every refusal has its own words and the dialog stays open, with no way to ask again what the server refused (not found, not correctable, no access, not open); a call that failed
 * can be asked again with «Riprova». On a 201 the dialog closes and the replacement is shown; nothing is told as done before the server answers.
 */
export function CorrectDialog({ item, onClose, onCorrected }: { item: SelfBillingListItem; onClose: () => void; onCorrected: (replacement: SelfBillingDetail | null) => void }) {
  const { t } = useTranslation();
  const correct = useCorrectSelfBilling();
  const busy = useSelfBillingBusy([item.id]);
  const sdi = useDocumentSdi(item.id, sdiScopeOf({ purpose: 'SelfBilling' }));
  const [problem, setProblem] = useState<{ kind: CorrectionProblem; words: string } | null>(null);
  // The reason of the refusal in plain words, only while the read worked and says the SDI rejected it: a 404 or a 403 of that read leaves it out (a query keeps its old answer on an error: not shown then).
  const reason = !sdi.isError && sdi.data?.status === 'rejected' ? sdi.data.reason : null;
  const refused = problem !== null && problem.kind !== 'failed';

  const wordsOf = (kind: CorrectionProblem, error: unknown): string => {
    switch (kind) {
      case 'forbidden':
        return t('selfBilling.correct.problem.forbidden');
      case 'notFound':
        return t('selfBilling.correct.problem.notFound');
      case 'notCorrectable':
        return t('selfBilling.correct.problem.notCorrectable');
      case 'unavailable':
        return t('selfBilling.correct.problem.unavailable');
      default:
        return getProblemMessage(error, t) ?? t('selfBilling.correct.problem.failed');
    }
  };

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        if (!open && !correct.isPending) onClose();
      }}
      title={t('selfBilling.correct.title')}
      description={item.number ? t('selfBilling.correct.description', { number: item.number }) : t('selfBilling.correct.descriptionUnknown')}
      confirmLabel={problem?.kind === 'failed' ? t('shared.errorState.retry') : t('selfBilling.correct.confirm')}
      consequences={[t('selfBilling.correct.consequenceDiscarded'), t('selfBilling.correct.consequenceDraft'), t('selfBilling.correct.consequenceIssue')]}
      confirmDisabled={refused || busy}
      isLoading={correct.isPending}
      onConfirm={async () => {
        setProblem(null);
        let replacement: SelfBillingDetail | null;
        try {
          replacement = await correct.mutateAsync({ documentId: item.id });
        } catch (error) {
          const kind = correctionProblemOf(error);
          setProblem({ kind, words: wordsOf(kind, error) });
          throw error;
        }
        if (replacement === null) toast.warning(t('selfBilling.correct.unreadable'));
        else toast.success(replacement.invoice.number ? t('selfBilling.correct.done', { number: replacement.invoice.number }) : t('selfBilling.correct.doneUnknown'));
        onCorrected(replacement);
      }}
    >
      {reason ? (
        <Alert variant="warning" title={t('selfBilling.correct.reasonTitle')} data-testid="self-billing-correct-reason">
          <span className="block break-words">{reason}</span>
        </Alert>
      ) : null}
      {problem ? (
        <Alert variant="danger" data-testid="self-billing-correct-problem" data-problem={problem.kind}>
          {problem.words}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}
