import { useEffect, useState, type FormEvent } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Trans, useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select } from '@/components/ui/select';
import { getHttpStatus } from '@/lib/api-errors';
import { useBulkRun, useRefreshOwnerAccounting, useStartBulkStep } from '@/queries/use-owner-accounting';
import { OWNER_BULK_ACTIONS, type OwnerBulkAction, type OwnerBulkRun, type OwnerCloseReadiness } from '@/types';
import { isBulkAction, isRunOver, progressPercent, suggestedBulkAction } from '../bulk-close-model';
import { messageOf, type CloseSummary, type Period } from '../owner-accounting-model';
import { useOwnerFormat } from '../use-owner-format';
import { BulkCloseResult } from './bulk-close-result';

interface BulkCloseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  period: Period;
  /** The month as the page reads it: the owners it lists are the ones the step runs for. */
  readiness: OwnerCloseReadiness;
  summary: CloseSummary;
  /** The month is over: only then can it be closed. */
  monthOver: boolean;
  nameOf: (ownerId: string) => string;
  /** How often a queued run is asked how far it goes, in milliseconds. */
  pollMs?: number;
}

/**
 * «Esegui per tutti» (E13/F02/US03/T01, NF-110): one step of the month-end (post, generate, approve, publish, close) for every owner of the month in one go, for an agency with about 250 flats.
 * First the question, with what the step does and what it will not allow afterwards, in proportion to the risk (closing a month asks for the word, as the close of one owner does); then, for
 * a long run, the progress (a queued run is read every few seconds until it ends); then the result owner by owner: a failure is listed with its reason, never folded into «fatto».
 * The dialog does nothing by itself: the run starts at the person's click, and the pages behind it read the month again when it ends. No run is started for a month the server says is not over.
 */
export function BulkCloseDialog({ open, onOpenChange, period, readiness, summary, monthOver, nameOf, pollMs }: BulkCloseDialogProps) {
  const { t } = useTranslation();
  const { month } = useOwnerFormat();
  const start = useStartBulkStep();
  const refresh = useRefreshOwnerAccounting();
  const suggested = suggestedBulkAction(readiness, summary, monthOver);
  const [action, setAction] = useState<OwnerBulkAction>(suggested);
  const [typed, setTyped] = useState('');
  const [started, setStarted] = useState<OwnerBulkRun | null>(null);

  // A run that is queued is followed until it ends; one that answered in the request (a few owners) has nothing to follow.
  const following = started !== null && started.jobId !== null && !isRunOver(started) ? started : null;
  const polled = useBulkRun(following?.year ?? period.year, following?.month ?? period.month, following?.jobId ?? null, pollMs);
  // A read that failed is never shown as progress: the last answer of a failed read is old, whatever the cache still holds.
  const readFailed = following !== null && polled.isError;
  const current = polled.data ?? started;
  const running = start.isPending || (current !== null && !isRunOver(current));

  // The run that was followed has ended: the month is read again where it is open.
  const endedWhileFollowed = polled.data !== undefined && isRunOver(polled.data);
  useEffect(() => {
    if (endedWhileFollowed) refresh();
  }, [endedWhileFollowed, refresh]);

  const word = t('ownerAccounting.close.word');
  const wordOk = action !== 'Close' || typed.trim().toLocaleLowerCase() === word.toLocaleLowerCase();

  const handleOpenChange = (next: boolean) => {
    // Leaving while the step goes on does not stop it: the person is told, and the page reads the month again when it ends.
    if (!next && running) toast.warning(t('ownerAccounting.bulk.leftRunning'));
    onOpenChange(next);
  };

  const onStart = async () => {
    try {
      setStarted(await start.mutateAsync({ year: period.year, month: period.month, command: { action } }));
    } catch {
      // The dialog stays on the question, with the reason (`start.error`).
    }
  };

  const onAnother = () => {
    start.reset();
    setStarted(null);
    setTyped('');
    setAction(suggested);
  };

  const readError = readFailed ? (getHttpStatus(polled.error) === 404 ? t('ownerAccounting.bulk.progress.notFound') : t('ownerAccounting.bulk.progress.readError')) : null;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" data-testid="bulk-dialog">
        <DialogHeader>
          <DialogTitle>{t('ownerAccounting.bulk.title', { period: month(period.year, period.month) })}</DialogTitle>
          <DialogDescription>
            {current === null ? t('ownerAccounting.bulk.description') : t('ownerAccounting.bulk.runDescription', { step: t(`ownerAccounting.bulk.step.${current.action}.label`) })}
          </DialogDescription>
        </DialogHeader>

        {current === null ? (
          <BulkStartForm
            action={action}
            onAction={setAction}
            typed={typed}
            onTyped={setTyped}
            word={word}
            wordOk={wordOk}
            monthOver={monthOver}
            suggested={suggested}
            owners={readiness.owners.length}
            pending={start.isPending}
            error={start.isError ? messageOf(start.error, t) : null}
            onStart={() => void onStart()}
            onCancel={() => handleOpenChange(false)}
          />
        ) : (
          <div className="grid gap-4" data-testid="bulk-run">
            {readError ? (
              <Alert
                variant="danger"
                data-testid="bulk-read-error"
                action={
                  getHttpStatus(polled.error) === 404 ? undefined : (
                    <Button type="button" size="sm" variant="outline" loading={polled.isFetching} onClick={() => void polled.refetch()} data-testid="bulk-read-retry">
                      {t('shared.errorState.retry')}
                    </Button>
                  )
                }
              >
                {readError}
              </Alert>
            ) : null}
            {/* A read that failed says so and nothing else: the progress it had read before is old, and a run the server has forgotten (404) is not «at 1 of 3». */}
            {readFailed ? null : isRunOver(current) ? <BulkCloseResult run={current} period={period} nameOf={nameOf} /> : <BulkProgress run={current} />}
            <DialogFooter>
              {isRunOver(current) && !readFailed ? (
                <Button type="button" variant="outline" onClick={onAnother} data-testid="bulk-another">
                  {t('ownerAccounting.bulk.result.another')}
                </Button>
              ) : null}
              <Button type="button" variant={isRunOver(current) && !readFailed ? 'default' : 'outline'} onClick={() => handleOpenChange(false)} data-testid="bulk-close">
                {t('shared.close')}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

interface BulkStartFormProps {
  action: OwnerBulkAction;
  onAction: (action: OwnerBulkAction) => void;
  typed: string;
  onTyped: (typed: string) => void;
  /** The word the person types to close the months of everybody. */
  word: string;
  wordOk: boolean;
  monthOver: boolean;
  suggested: OwnerBulkAction;
  owners: number;
  pending: boolean;
  /** Why the server refused to start, in words: the form stays open with it. */
  error: string | null;
  onStart: () => void;
  onCancel: () => void;
}

/** The question: which step, what it does, what it will not allow afterwards, and the confirmation. The form is not sent from the page around it (a dialog drawn in a portal still bubbles to it). */
function BulkStartForm({ action, onAction, typed, onTyped, word, wordOk, monthOver, suggested, owners, pending, error, onStart, onCancel }: BulkStartFormProps) {
  const { t } = useTranslation();
  const consequences = [1, 2].map((n) => t(`ownerAccounting.bulk.step.${action}.consequence${n}`));

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (!pending && wordOk && owners > 0) onStart();
  };

  const optionLabel = (option: OwnerBulkAction): string => {
    const label = t(`ownerAccounting.bulk.step.${option}.label`);
    if (option === 'Close' && !monthOver) return t('ownerAccounting.bulk.choose.closedLater', { label });
    return option === suggested ? t('ownerAccounting.bulk.choose.suggested', { label }) : label;
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="grid gap-4" data-testid="bulk-start">
      <Field label={t('ownerAccounting.bulk.choose.label')}>
        <Select
          value={action}
          onChange={(event) => {
            if (isBulkAction(event.target.value)) onAction(event.target.value);
          }}
          disabled={pending}
          data-testid="bulk-step"
        >
          {OWNER_BULK_ACTIONS.map((option) => (
            <option key={option} value={option} disabled={option === 'Close' && !monthOver}>
              {optionLabel(option)}
            </option>
          ))}
        </Select>
      </Field>

      <p className="break-words text-sm text-foreground/70" data-testid="bulk-summary">
        {t(`ownerAccounting.bulk.step.${action}.summary`)}
      </p>
      <p className="text-sm font-medium" data-testid="bulk-count">
        {t('ownerAccounting.bulk.count', { count: owners })}
      </p>

      <ul role="list" aria-label={t('shared.confirmationDialog.consequences')} className="grid gap-2" data-testid="bulk-consequences">
        {consequences.map((consequence, index) => (
          <li key={`${index}-${consequence}`} className="flex items-start gap-2 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span className="min-w-0 break-words">{consequence}</span>
          </li>
        ))}
      </ul>

      {action === 'Close' ? (
        <div className="grid gap-2">
          <Label htmlFor="bulk-word" className="leading-snug">
            <Trans i18nKey="shared.confirmationDialog.requireText" values={{ text: word }} components={{ strong: <strong className="font-semibold" /> }} />
          </Label>
          <Input
            id="bulk-word"
            value={typed}
            onChange={(event) => onTyped(event.target.value)}
            disabled={pending}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            data-testid="bulk-word"
          />
        </div>
      ) : null}

      {error ? (
        <Alert variant="danger" data-testid="bulk-error">
          {error}
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {t('shared.cancel')}
        </Button>
        <Button type="submit" loading={pending} disabled={!wordOk || owners === 0} data-testid="bulk-confirm">
          {t('ownerAccounting.bulk.confirm')}
        </Button>
      </DialogFooter>
    </form>
  );
}

/** A run that is on its way: the owners answered out of the owners asked for, as a number and a bar. Nothing here says «fatto»: that is the result's, and only for a run that is over. */
function BulkProgress({ run }: { run: OwnerBulkRun }) {
  const { t } = useTranslation();
  const answered = run.results.length;
  const text = t('ownerAccounting.bulk.progress.text', { count: answered, total: run.total });

  return (
    <div className="space-y-2" role="status" aria-live="polite" data-testid="bulk-progress" data-status={run.status}>
      <Progress value={progressPercent(run)} label={t('ownerAccounting.bulk.progress.label')} valueText={text} data-testid="bulk-progress-bar" />
      <p className="text-sm font-medium tabular-nums" data-testid="bulk-progress-text">
        {answered === 0 && run.status === 'Queued' ? t('ownerAccounting.bulk.progress.queued') : text}
      </p>
      <p className="text-sm text-foreground/70">{t('ownerAccounting.bulk.progress.stay')}</p>
    </div>
  );
}
