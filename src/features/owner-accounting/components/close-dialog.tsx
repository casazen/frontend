import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Field } from '@/components/ui/field';
import { Textarea } from '@/components/ui/textarea';
import { useCloseMonth, useOwnerPayouts } from '@/queries/use-owner-accounting';
import {
  camelCode,
  isKnownIssue,
  messageOf,
  previewReconciliation,
  problemFacts,
  toCents,
  type ActionContext,
} from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';
import { PayoutReconciliationPanel } from './payout-reconciliation-panel';

interface CloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ctx: ActionContext;
}

/**
 * Closes the owner's month (E06/F05/US02/T04): the reconciliation of the approved balance with the payouts first, then the word the person types
 * to say they mean it, because nothing is posted in a closed month any more. A month that does not reconcile, or whose balance is negative,
 * needs a reason, and the server lets only who manages the owners' finances waive it (403 otherwise: the dialog says so, it does not hide it).
 * The close reads the readiness again on the server: its refusal (`owner_close_not_ready`, `owner_close_unreconciled`) is shown here with what to do.
 */
export function CloseDialog({ open, onOpenChange, ctx }: CloseDialogProps) {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const payoutsQuery = useOwnerPayouts(ctx.ownerId, open);
  const close = useCloseMonth();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [blocking, setBlocking] = useState<string[]>([]);
  const [figures, setFigures] = useState<{ due: number; paid: number; difference: number } | null>(null);

  const { version } = ctx;
  const payouts = (payoutsQuery.data ?? []).filter((payout) => ctx.versionIds.includes(payout.statementVersionId));
  const preview = version ? previewReconciliation(version, payouts, ctx.versionIds) : null;
  const needsReason = figures ? toCents(figures.difference) !== 0 || toCents(figures.due) < 0 : (preview?.needsWaiver ?? false);
  const loadingPayouts = payoutsQuery.isPending;

  const onConfirm = async () => {
    if (!version) return;
    setError(null);
    setBlocking([]);
    try {
      await close.mutateAsync({ year: ctx.period.year, month: ctx.period.month, ownerId: ctx.ownerId, waiverReason: needsReason ? reason.trim() : undefined });
      toast.success(t('ownerAccounting.close.done', { owner: ctx.ownerName, period: month(ctx.period.year, ctx.period.month) }));
    } catch (failure) {
      const facts = problemFacts(failure);
      if (facts.code === 'owner_close_unreconciled' && facts.figures) setFigures(facts.figures);
      if (facts.code === 'owner_close_not_ready') setBlocking(facts.issues);
      setError(messageOf(failure, t));
      // The dialog stays open: the person reads why, fixes it and asks again.
      throw failure;
    }
  };

  return (
    <ConfirmationDialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('ownerAccounting.close.title', { period: month(ctx.period.year, ctx.period.month) })}
      description={t('ownerAccounting.close.description', { owner: ctx.ownerName })}
      confirmLabel={t('ownerAccounting.close.confirm')}
      requireText={t('ownerAccounting.close.word')}
      consequences={[t('ownerAccounting.close.consequences.nothingPosted'), t('ownerAccounting.close.consequences.evidence')]}
      isLoading={close.isPending}
      confirmDisabled={!version || loadingPayouts || (needsReason && reason.trim().length === 0)}
      onConfirm={onConfirm}
    >
      <div className="space-y-4" data-testid="close-dialog">
        {version && preview ? (
          <PayoutReconciliationPanel currency={version.currency} preview={preview} payouts={payouts} serverFigures={figures} loading={loadingPayouts} />
        ) : null}

        {needsReason ? (
          <div className="space-y-2">
            <Alert variant="warning" data-testid="close-waiver-notice">
              {t('ownerAccounting.close.waiverNotice')}
            </Alert>
            <Field label={t('ownerAccounting.close.waiverReason')} hint={t('ownerAccounting.close.waiverHint')}>
              <Textarea value={reason} onChange={(event) => setReason(event.target.value)} maxLength={500} rows={3} data-testid="close-waiver-reason" />
            </Field>
          </div>
        ) : null}

        {blocking.length > 0 ? (
          <Alert variant="danger" title={t('ownerAccounting.close.notReady')} data-testid="close-not-ready">
            <ul role="list" className="list-disc space-y-1 pl-5">
              {blocking.map((code) => (
                <li key={code}>{isKnownIssue(code) ? t(`ownerAccounting.issue.${camelCode(code)}.title`) : t('ownerAccounting.issue.unknown.title', { code })}</li>
              ))}
            </ul>
          </Alert>
        ) : error ? (
          <Alert variant="danger" data-testid="close-error">
            {error}
          </Alert>
        ) : null}
      </div>
    </ConfirmationDialog>
  );
}
