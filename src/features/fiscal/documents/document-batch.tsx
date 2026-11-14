import { useState } from 'react';
import { ListChecks } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { getProblemMessage } from '@/lib/api-errors';
import { BATCH_MAX, batchReasonOf, type BatchOutcome } from './document-model';

/** What the search for the drafts of the period found, as the page says it. */
export type SelectNote = { kind: 'selected'; count: number; more: boolean } | { kind: 'none' } | { kind: 'failed' };

interface BatchControlsProps {
  /** The drafts ticked, on this page and on the others. */
  count: number;
  /** «Seleziona tutte le bozze del periodo» can be asked: the filters do not exclude drafts and the period has no problem. */
  canSelectPeriod: boolean;
  /** The search for the drafts of the period is running. */
  searching: boolean;
  /** A bulk issue is running. */
  issuing: boolean;
  /** A write is running on one of the ticked drafts (one made again, one issued from its detail...): the bulk issue waits for it, as the buttons of that draft do. */
  waiting: boolean;
  note: SelectNote | null;
  onSelectPeriod: () => void;
  onIssue: () => void;
  onClear: () => void;
}

/**
 * What a bulk issue is started from (E12/F02/US01/T01): «Seleziona tutte le bozze del periodo», which ticks the drafts of the stays that the filters of the list show (at most the 200 a bulk issue takes,
 * and it says when there are more), and, while some are ticked, the bar with their count, «Emetti selezionate» and a way to untick them all. Nothing is issued by ticking: the bulk issue asks for its
 * confirmation first. The buttons wait while the search or the issue runs, and while any other write runs on one of the ticked drafts (a second write on the same document never starts).
 */
export function DocumentBatchControls({ count, canSelectPeriod, searching, issuing, waiting, note, onSelectPeriod, onIssue, onClear }: BatchControlsProps) {
  const { t } = useTranslation();
  const busy = searching || issuing || waiting;
  const tooMany = count > BATCH_MAX;

  return (
    <div className="space-y-3" data-testid="fiscal-documents-batch">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={!canSelectPeriod || busy}
          loading={searching}
          onClick={onSelectPeriod}
          data-testid="fiscal-documents-select-period"
        >
          <ListChecks className="size-4" aria-hidden="true" />
          {t('fiscalDocuments.batch.selectPeriod')}
        </Button>
        {note ? (
          <p className="text-sm text-foreground/70" role="status" data-testid="fiscal-documents-select-note" data-kind={note.kind}>
            {note.kind === 'selected'
              ? note.more
                ? t('fiscalDocuments.batch.selectCapped', { count: note.count })
                : t('fiscalDocuments.batch.selectDone', { count: note.count })
              : note.kind === 'none'
                ? t('fiscalDocuments.batch.selectNone')
                : t('fiscalDocuments.batch.selectFailed')}
          </p>
        ) : null}
      </div>

      {count > 0 ? (
        <div
          role="region"
          aria-label={t('fiscalDocuments.batch.bar')}
          data-testid="fiscal-documents-batch-bar"
          className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-muted px-4 py-2 text-sm shadow-sm ring-1 ring-primary/30"
        >
          <strong aria-live="polite" data-testid="fiscal-documents-batch-count">
            {t('fiscalDocuments.batch.selected', { count })}
          </strong>
          <Button type="button" size="sm" disabled={busy || tooMany} loading={issuing} onClick={onIssue} data-testid="fiscal-documents-issue-selected">
            {t('fiscalDocuments.batch.issue')}
          </Button>
          <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onClear} data-testid="fiscal-documents-clear-selection">
            {t('fiscalDocuments.batch.clear')}
          </Button>
          {tooMany ? (
            <p className="basis-full text-foreground/70" data-testid="fiscal-documents-batch-too-many">
              {t('fiscalDocuments.batch.tooMany', { max: BATCH_MAX })}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

interface BatchConfirmProps {
  count: number;
  /** The bulk issue is running: the confirmation cannot be given a second time. */
  busy: boolean;
  /** A write is running on one of the documents (one made again...): the confirmation waits for it. */
  waiting: boolean;
  onClose: () => void;
  /** Issues them. A rejection keeps the dialog open and is told in it, in the words of its code. */
  onConfirm: () => Promise<void>;
}

/**
 * The confirmation of a bulk issue: how many documents, that each one gets its number in order and can no longer be changed, and that one that cannot be issued does not stop the others (the
 * answer says which and why). A refusal of the whole request (more than the limit, a network error) is told here and the dialog stays open.
 */
export function BatchConfirmDialog({ count, busy, waiting, onClose, onConfirm }: BatchConfirmProps) {
  const { t } = useTranslation();
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        // While the bulk issue is on its way the dialog stays: closed, a failure of the call would have nowhere to be told, and the person would not know what was issued.
        if (!open && !busy) onClose();
      }}
      title={t('fiscalDocuments.batch.confirm.title', { count })}
      description={t('fiscalDocuments.batch.confirm.description')}
      confirmLabel={t('fiscalDocuments.batch.confirm.confirm', { count })}
      consequences={[t('fiscalDocuments.batch.confirm.consequence')]}
      isLoading={busy}
      confirmDisabled={waiting}
      onConfirm={async () => {
        setProblem(null);
        try {
          await onConfirm();
        } catch (error) {
          setProblem(getProblemMessage(error, t) ?? t('fiscalDocuments.batch.confirm.failed'));
          throw error;
        }
      }}
    >
      {problem ? (
        <Alert variant="danger" data-testid="fiscal-documents-batch-problem">
          {problem}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}

interface BatchResultProps {
  outcome: BatchOutcome;
  /** What names a document of the answer (its kind, number and recipient), from what the page knows of it. */
  labelOf: (id: string) => string;
  onClose: () => void;
}

/**
 * What a bulk issue came to (E12/F02/US01/T01): one line that says it, and, for every document that was not issued, its name and why in plain words. Everything issued is said only when every row was
 * issued and nothing is left over; one failed row is always told (how many were issued out of how many, and the documents that were not), never hidden under a sentence that says it all went well.
 */
export function BatchResultDialog({ outcome, labelOf, onClose }: BatchResultProps) {
  const { t } = useTranslation();
  const failed = outcome.failures.length;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent data-testid="fiscal-documents-batch-result" data-verdict={outcome.verdict}>
        <DialogHeader>
          <DialogTitle>{t('fiscalDocuments.batch.result.title')}</DialogTitle>
          <DialogDescription data-testid="fiscal-documents-batch-summary">
            {outcome.verdict === 'all'
              ? t('fiscalDocuments.batch.result.all', { count: outcome.issued })
              : outcome.verdict === 'none'
                ? t('fiscalDocuments.batch.result.none')
                : failed > 0
                  ? t('fiscalDocuments.batch.result.some', { issued: outcome.issued, asked: outcome.asked, failed })
                  : t('fiscalDocuments.batch.result.issuedOnly', { count: outcome.issued })}
          </DialogDescription>
        </DialogHeader>

        {outcome.remaining > 0 ? (
          <Alert variant="warning" data-testid="fiscal-documents-batch-remaining">
            {t('fiscalDocuments.batch.result.remaining', { count: outcome.remaining })}
          </Alert>
        ) : null}

        {failed > 0 ? (
          <section aria-labelledby="batch-failures-title" className="space-y-2">
            <h3 id="batch-failures-title" className="text-sm font-semibold">
              {t('fiscalDocuments.batch.result.failures', { count: failed })}
            </h3>
            <ul role="list" className="max-h-72 space-y-2 overflow-y-auto" data-testid="fiscal-documents-batch-failures">
              {outcome.failures.map((failure) => (
                <li key={failure.id} className="rounded-md border border-border p-3 text-sm" data-testid="fiscal-documents-batch-failure">
                  <p className="break-words font-medium">{labelOf(failure.id)}</p>
                  <p className="mt-0.5 break-words text-foreground/70" data-testid="fiscal-documents-batch-failure-reason">
                    {batchReasonOf(failure.code, t)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        ) : null}

        <DialogFooter>
          <Button type="button" onClick={onClose} data-testid="fiscal-documents-batch-close">
            {t('fiscalDocuments.batch.result.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
