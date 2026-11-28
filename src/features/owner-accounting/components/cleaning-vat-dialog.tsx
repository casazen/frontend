import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { SkeletonCard } from '@/components/ui/skeleton';
import { useWorkspace } from '@/hooks/use-workspace';
import { getHttpStatus } from '@/lib/api-errors';
import { useAnswerCleaningVat, useCleaningVatQuestion } from '@/queries/use-cleaning-vat';
import type { CleaningVatAnswer, CleaningVatAnswerCommand, CleaningVatQuestion } from '@/types';
import {
  CLEANING_VAT_ANSWERS,
  CLEANING_VAT_AREA,
  CLEANING_VAT_PARAM,
  CLEANING_VAT_PERMISSION,
  cleaningVatProblemOf,
  isFinalProblem,
  yesRateOf,
  type CleaningVatProblem,
} from '../cleaning-vat-model';
import { useOwnerFormat } from '../use-owner-format';

type SaveAnswer = ReturnType<typeof useAnswerCleaningVat>;

interface QuestionFormProps {
  question: CleaningVatQuestion;
  save: SaveAnswer;
  onClose: () => void;
}

/**
 * The three answers of the question, a button each, and «Ricorda per questa ditta». A button answers at once with `{ answer, remember }`; «Ricorda» starts unticked (the person ticks it, nothing is remembered by default) and is
 * there only when the server says the caller may (`canRemember`: the whole organization, the answer decides the cleanings of every property). «Sì» carries the rate of the server and is not offered when the server has none.
 * «Non lo so» is never remembered: it is sent with `remember: false` whatever the box says. Every button waits while an answer is on its way, and a refusal or a failure is told in its own words and never as done.
 */
function QuestionForm({ question, save, onClose }: QuestionFormProps) {
  const { t, i18n } = useTranslation();
  const { date, percent } = useOwnerFormat();
  const rememberId = useId();
  const [remember, setRemember] = useState(false);
  const [rememberRefused, setRememberRefused] = useState(false);
  const [problem, setProblem] = useState<CleaningVatProblem | null>(null);
  const [attempt, setAttempt] = useState<CleaningVatAnswerCommand | null>(null);
  // A request is on its way: the state of the mutation says it a moment later than the click, so a second click in between is stopped here.
  const sending = useRef(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const yesRate = yesRateOf(question.standardRatePercent);
  const mayRemember = question.canRemember && !rememberRefused;
  const busy = save.isPending;
  const refused = problem !== null && isFinalProblem(problem);
  const yesOff = yesRate === null || problem === 'rateUnknown';

  const answerLabel = (answer: CleaningVatAnswer, rate: number | null): string =>
    answer === 'Applied' && rate === null
      ? t('ownerAccounting.cleaningVat.answer.AppliedNoRate')
      : t(`ownerAccounting.cleaningVat.answer.${answer}`, { rate: rate === null ? '' : percent(rate) });

  const submit = async (command: CleaningVatAnswerCommand) => {
    if (save.isPending || sending.current) return;
    sending.current = true;
    setAttempt(command);
    setProblem(null);
    try {
      const saved = await save.mutateAsync(command);
      const rate = saved.answer === 'Applied' ? (saved.answerRatePercent ?? yesRate) : null;
      toast.success(t('ownerAccounting.cleaningVat.saved', { answer: answerLabel(command.answer, rate) }));
      if (mounted.current) onClose();
    } catch (error) {
      const kind = cleaningVatProblemOf(error);
      setProblem(kind);
      if (kind === 'rememberForbidden') setRememberRefused(true);
      if (kind === 'rememberForbidden' || kind === 'rememberUnknown') setRemember(false);
    } finally {
      sending.current = false;
    }
  };

  const choose = (answer: CleaningVatAnswer) => void submit({ answer, remember: mayRemember && remember && answer !== 'Unknown' });

  const stated = question.statedAnswer;
  const country = i18n.exists(`ownerAccounting.cleaningVat.country.${question.country}`) ? t(`ownerAccounting.cleaningVat.country.${question.country}`) : question.country;

  return (
    <div className="grid gap-4" data-testid="cleaning-vat-form">
      <div className="space-y-1 text-sm" data-testid="cleaning-vat-facts">
        {question.supplierName ? (
          <p className="break-words font-medium" data-testid="cleaning-vat-company">
            {t('ownerAccounting.cleaningVat.company', { name: question.supplierName })}
          </p>
        ) : null}
        <p className="break-words text-foreground/70" data-testid="cleaning-vat-when">
          {t('ownerAccounting.cleaningVat.when', { date: date(question.cleaningDate), country })}
        </p>
        {stated !== null ? (
          <p className="break-words" data-testid="cleaning-vat-current" data-answer={stated}>
            {t(question.statedByCompany ? 'ownerAccounting.cleaningVat.currentByCompany' : 'ownerAccounting.cleaningVat.current', {
              answer: answerLabel(stated, stated === 'Applied' ? (question.statedRatePercent ?? question.answerRatePercent ?? yesRate) : null),
            })}
          </p>
        ) : null}
      </div>

      {mayRemember ? (
        <div className="space-y-1" data-testid="cleaning-vat-remember">
          <div className="flex min-h-11 items-start gap-2 pt-1">
            <Checkbox
              id={rememberId}
              checked={remember}
              disabled={busy}
              onCheckedChange={(next) => setRemember(next === true)}
              aria-describedby={`${rememberId}-hint`}
              data-testid="cleaning-vat-remember-box"
            />
            <Label htmlFor={rememberId} className="text-sm font-medium leading-snug">
              {t('ownerAccounting.cleaningVat.remember')}
            </Label>
          </div>
          <p id={`${rememberId}-hint`} className="break-words pl-6 text-sm text-foreground/70">
            {t('ownerAccounting.cleaningVat.rememberHint')}
          </p>
        </div>
      ) : null}

      <div className="grid gap-3" data-testid="cleaning-vat-answers">
        {CLEANING_VAT_ANSWERS.map((choice) => {
          const unavailable = choice === 'Applied' && yesOff;
          const hint = choice === 'Unknown' ? t('ownerAccounting.cleaningVat.unknownHint') : unavailable ? t('ownerAccounting.cleaningVat.yesUnavailable') : null;
          const hintId = `${rememberId}-${choice}`;
          return (
            <div key={choice} className="space-y-1">
              <Button
                type="button"
                variant="outline"
                className="min-h-11 w-full justify-start"
                disabled={busy || refused || unavailable}
                loading={busy && attempt?.answer === choice}
                aria-describedby={hint ? hintId : undefined}
                onClick={() => choose(choice)}
                data-testid={`cleaning-vat-answer-${choice}`}
              >
                {answerLabel(choice, choice === 'Applied' ? yesRate : null)}
              </Button>
              {hint ? (
                <p id={hintId} className="break-words px-1 text-sm text-foreground/70" data-testid={`cleaning-vat-hint-${choice}`}>
                  {hint}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      {busy ? (
        <p role="status" className="sr-only">
          {t('ownerAccounting.cleaningVat.sending')}
        </p>
      ) : null}

      {problem ? (
        <Alert
          variant={problem === 'changed' ? 'warning' : 'danger'}
          role="alert"
          action={
            problem === 'failed' && attempt ? (
              <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => void submit(attempt)} data-testid="cleaning-vat-retry">
                {t('shared.errorState.retry')}
              </Button>
            ) : undefined
          }
          data-testid="cleaning-vat-problem"
          data-problem={problem}
        >
          {t(`ownerAccounting.cleaningVat.problem.${problem}`)}
        </Alert>
      ) : null}

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose} disabled={busy} data-testid="cleaning-vat-close">
          {t('shared.close')}
        </Button>
      </DialogFooter>
    </div>
  );
}

function Refusal({ problem, onClose }: { problem: CleaningVatProblem; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-4">
      <Alert variant="warning" data-testid="cleaning-vat-problem" data-problem={problem}>
        {t(`ownerAccounting.cleaningVat.problem.${problem}`)}
      </Alert>
      <DialogFooter>
        <Button type="button" onClick={onClose} data-testid="cleaning-vat-close">
          {t('shared.close')}
        </Button>
      </DialogFooter>
    </div>
  );
}

interface QuestionDialogProps {
  requestId: string;
  onClose: () => void;
}

/**
 * The dialog of the question «La ditta di pulizie ha applicato l'IVA su questa fattura?» for a cleaning request (FIX/FE-CLEANING-VAT-QUESTION, backend FIX/BE-CLEANING-VAT): who the company is, the day and the country of the
 * cleaning, and the three answers. The question is read when the dialog opens; one that cannot be read is told, never answered with a form: a 404 is «not found» whatever an earlier read left in the cache, a 403 says the
 * access is not there (the app is not sent to the page of no access), any other failure has its «Riprova». While an answer is on its way the dialog stays (Esc, the cross and a click outside included): closed, it would leave
 * a refusal with nowhere to be told.
 */
export function CleaningVatQuestionDialog({ requestId, onClose }: QuestionDialogProps) {
  const { t } = useTranslation();
  const query = useCleaningVatQuestion(requestId);
  const save = useAnswerCleaningVat(requestId);
  const question = query.isError ? undefined : query.data;

  let body: ReactNode;
  if (query.isPending) {
    body = <SkeletonCard lines={3} label={t('ownerAccounting.cleaningVat.loading')} />;
  } else if (query.isError) {
    body =
      getHttpStatus(query.error) === 404 ? (
        <Refusal problem="notFound" onClose={onClose} />
      ) : (
        <Alert
          variant="danger"
          action={
            <Button type="button" size="sm" variant="outline" onClick={() => void query.refetch()} data-testid="cleaning-vat-load-retry">
              {t('shared.errorState.retry')}
            </Button>
          }
          data-testid="cleaning-vat-load-error"
        >
          {t('ownerAccounting.cleaningVat.loadError')}
        </Alert>
      );
  } else if (question === null || question === undefined) {
    body = <Refusal problem="forbidden" onClose={onClose} />;
  } else {
    body = <QuestionForm question={question} save={save} onClose={onClose} />;
  }

  return (
    <Dialog open onOpenChange={(next) => !next && !save.isPending && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto" data-testid="cleaning-vat-dialog">
        <DialogHeader>
          <DialogTitle>{t('ownerAccounting.cleaningVat.title')}</DialogTitle>
          <DialogDescription>{t('ownerAccounting.cleaningVat.description')}</DialogDescription>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

/**
 * The question of the VAT of a cleaning, open on the page of the request while the address says so (`?cleaningVat=<request>`): the «Da fare» `StateCleaningVat` leads there with it, and closing the dialog takes it off
 * (the page behind is not changed, and the back button does not reopen the question). Answering is writing the properties (`property.write`, what the endpoint asks): to who may only read them the address opens
 * nothing and nothing is asked of the server. The dialog does not depend on the page behind it: the question is read by its own endpoint, which answers for a request of Affitti brevi and of Affitti lunghi alike.
 */
export function CleaningVatQuestionHost() {
  const [params, setParams] = useSearchParams();
  const { hasPermission } = useWorkspace();
  const requestId = params.get(CLEANING_VAT_PARAM);

  if (!requestId || !hasPermission(CLEANING_VAT_AREA, CLEANING_VAT_PERMISSION)) return null;

  const close = () => {
    const next = new URLSearchParams(params);
    next.delete(CLEANING_VAT_PARAM);
    setParams(next, { replace: true });
  };
  return <CleaningVatQuestionDialog key={requestId} requestId={requestId} onClose={close} />;
}
