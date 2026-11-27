import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { InvoiceDataSubstep } from '@/components/shared/invoice-data-substep';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { useDocumentSdi, useDocumentsBusy, useFiscalDocument, useRefreshFiscalDocument, useStartDocumentCorrection } from '@/queries/use-fiscal-documents';
import { IssueDocumentDialog } from './document-dialogs';
import { documentKindWords, formatDocumentAmount } from './document-model';

/** The steps of the correction, in order: what will happen, the data of who receives the invoice, the issue, and the result. */
type Phase = 'explain' | 'data' | 'issue' | 'done';

const PHASES: readonly Phase[] = ['explain', 'data', 'issue', 'done'];

interface DocumentCorrectionStepProps {
  /** The document the step is about: the invoice the SDI rejected (the correction starts from it), or the draft that a correction already made of it (the correction goes on from there). */
  documentId: string;
  mode: 'rejected' | 'replacement';
  /** The person goes back to the document without leaving the page: what was done stays on the server (a draft that replaces a rejected invoice is found again in the list). */
  onClose: () => void;
  /** Opens another document in the same detail: the corrected invoice the step issued. */
  onOpenDocument: (id: string) => void;
}

/**
 * The guided correction of an invoice the SDI rejected (E17/F03/US01/T02, NF-86, ADR-026): a step of the detail of the document that never leaves the page. The rejected invoice never reached its recipient, so it is
 * NOT credited: CasaZen replaces it with a draft that keeps its number, the person checks the data of who receives it (the same sub-step of the booking, which returns to this step) and issues it again. Each
 * step says what will happen before it and what happened after it. «Chiudi e riprendi dopo» is always there: what was done stays on the server (the draft that replaces the invoice keeps its number, and the detail of
 * that draft opens the step again at its data). Nothing is claimed that the server did not say: the number is the one of the rejected invoice, the corrected invoice is «emessa» only when the issue answered, and
 * every button of the step waits while any write on its documents is on its way.
 */
export function DocumentCorrectionStep({ documentId, mode, onClose, onOpenDocument }: DocumentCorrectionStepProps) {
  const { t, i18n } = useTranslation();
  const [phase, setPhase] = useState<Phase>(mode === 'replacement' ? 'data' : 'explain');
  const [replacementId, setReplacementId] = useState<string | null>(mode === 'replacement' ? documentId : null);
  const [checkingData, setCheckingData] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const rejected = useFiscalDocument(mode === 'rejected' ? documentId : null);
  const sdi = useDocumentSdi(mode === 'rejected' ? documentId : null, 'guest');
  const replacement = useFiscalDocument(replacementId);
  const start = useStartDocumentCorrection();
  const refresh = useRefreshFiscalDocument();
  const busy = useDocumentsBusy({ documentIds: replacementId ? [documentId, replacementId] : [documentId] });

  const draft = replacement.data;
  const bookingId = draft?.bookingId ?? rejected.data?.bookingId ?? null;
  // The number the corrected invoice keeps: the one of the draft when the server gives it one, else the one of the rejected invoice (it keeps it for the history).
  const keptNumber = draft?.number ?? rejected.data?.number ?? null;
  const step = PHASES.indexOf(phase) + 1;

  const begin = async () => {
    setProblem(null);
    try {
      const change = await start.mutateAsync({ documentId });
      if (change === null) {
        // The correction was made and its answer could not be read: the draft is in the list of the documents.
        setProblem(t('fiscalDocuments.correction.startUnreadable'));
        return;
      }
      setReplacementId(change.id);
      setPhase('data');
    } catch (error) {
      setProblem(getProblemMessage(error, t) ?? t('fiscalDocuments.correction.startFailed'));
    }
  };

  // The data of the invoice were checked: the draft is made again from them, then it is issued. A refusal (what is still missing) is told here and the step stays where it is.
  const afterData = async () => {
    setCheckingData(false);
    if (replacementId === null) return;
    setProblem(null);
    try {
      await refresh.mutateAsync({ documentId: replacementId });
      setPhase('issue');
    } catch (error) {
      setProblem(getProblemMessage(error, t) ?? t('fiscalDocuments.refresh.failed'));
    }
  };

  let body;
  if (phase === 'explain') {
    const state = sdi.data;
    if (sdi.isPending || rejected.isPending) {
      body = (
        <p role="status" className="text-sm text-foreground/70" data-testid="fiscal-correction-loading">
          {t('fiscalDocuments.correction.loading')}
        </p>
      );
    } else if (sdi.isError || getHttpStatus(sdi.error) === 404 || state === undefined) {
      body = (
        <Alert variant="warning" data-testid="fiscal-correction-unavailable">
          {t(getHttpStatus(sdi.error) === 404 ? 'fiscalDocuments.sdi.gone' : 'fiscalDocuments.sdi.loadError')}
        </Alert>
      );
    } else if (!state.canCorrect) {
      body = (
        <Alert variant="info" data-testid="fiscal-correction-not-correctable">
          {t(state.status === 'delivered' ? 'fiscalDocuments.correction.delivered' : 'fiscalDocuments.correction.notCorrectable')}
        </Alert>
      );
    } else {
      body = (
        <div className="space-y-4">
          <Alert variant="danger" title={t('fiscalDocuments.sdi.reason.rejectedTitle')} data-testid="fiscal-correction-reason">
            <span className="block break-words">{state.reason ?? t('fiscalDocuments.sdi.reason.unknown')}</span>
          </Alert>
          <div className="space-y-2 text-sm">
            <p className="font-medium">{t('fiscalDocuments.correction.explain.title')}</p>
            <ul role="list" className="list-disc space-y-1 pl-5 text-foreground/80">
              <li>{rejected.data?.number ? t('fiscalDocuments.correction.explain.same', { number: rejected.data.number }) : t('fiscalDocuments.correction.explain.sameUnknown')}</li>
              <li>{t('fiscalDocuments.correction.explain.noCredit')}</li>
              <li>{t('fiscalDocuments.correction.explain.data')}</li>
            </ul>
          </div>
          <Button type="button" size="sm" disabled={busy} loading={start.isPending} onClick={() => void begin()} data-testid="fiscal-correction-start">
            {t('fiscalDocuments.correction.explain.start')}
          </Button>
        </div>
      );
    }
  } else if (phase === 'data') {
    body = (
      <div className="space-y-4">
        <p className="text-sm text-foreground/80" data-testid="fiscal-correction-draft-note">
          {keptNumber ? t('fiscalDocuments.correction.data.draftKeeps', { number: keptNumber }) : t('fiscalDocuments.correction.data.draftKeepsUnknown')}
        </p>
        {bookingId === null ? (
          <p className="text-sm text-foreground/70" data-testid="fiscal-correction-no-booking">
            {t('fiscalDocuments.correction.data.noBooking')}
          </p>
        ) : checkingData ? (
          <InvoiceDataSubstep bookingId={bookingId} onDone={() => void afterData()} onCancel={() => setCheckingData(false)} />
        ) : (
          <p className="text-sm text-foreground/80">{t('fiscalDocuments.correction.data.body')}</p>
        )}
        {!checkingData ? (
          <div className="flex flex-wrap items-center gap-2">
            {bookingId !== null ? (
              <Button type="button" size="sm" disabled={busy} loading={refresh.isPending} onClick={() => setCheckingData(true)} data-testid="fiscal-correction-check-data">
                {t('fiscalDocuments.correction.data.check')}
              </Button>
            ) : null}
            <Button type="button" size="sm" variant={bookingId === null ? 'default' : 'outline'} disabled={busy} onClick={() => setPhase('issue')} data-testid="fiscal-correction-skip-data">
              {t(bookingId === null ? 'fiscalDocuments.correction.data.next' : 'fiscalDocuments.correction.data.right')}
            </Button>
          </div>
        ) : null}
      </div>
    );
  } else if (phase === 'issue') {
    body = (
      <div className="space-y-4">
        {draft ? (
          <dl className="grid gap-2 text-sm" data-testid="fiscal-correction-summary">
            <div className="flex min-w-0 items-baseline justify-between gap-4">
              <dt className="text-foreground/70">{t('fiscalDocuments.issue.document')}</dt>
              <dd className="font-medium">{documentKindWords(t, draft.kind)}</dd>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-4">
              <dt className="text-foreground/70">{t('fiscalDocuments.issue.number')}</dt>
              <dd className="font-medium" data-testid="fiscal-correction-number">
                {keptNumber ?? t('fiscalDocuments.issue.numberKeptUnknown')}
              </dd>
            </div>
            <div className="flex min-w-0 items-baseline justify-between gap-4">
              <dt className="text-foreground/70">{t('fiscalDocuments.issue.total')}</dt>
              <dd className="font-medium tabular-nums">{formatDocumentAmount(draft.total, draft.currency, i18n.language)}</dd>
            </div>
          </dl>
        ) : (
          <p role="status" className="text-sm text-foreground/70">
            {t('fiscalDocuments.correction.loading')}
          </p>
        )}
        <p className="text-sm text-foreground/80">{t('fiscalDocuments.correction.issue.body')}</p>
        <Button type="button" size="sm" disabled={busy || !draft} onClick={() => setConfirming(true)} data-testid="fiscal-correction-issue">
          {t('fiscalDocuments.correction.issue.button')}
        </Button>
        {confirming && draft && replacementId ? (
          <IssueDocumentDialog
            document={{ id: replacementId, kind: draft.kind, number: draft.number, total: draft.total, currency: draft.currency }}
            replaces={{ number: keptNumber }}
            onClose={() => setConfirming(false)}
            onIssued={() => setPhase('done')}
          />
        ) : null}
      </div>
    );
  } else {
    body = (
      <div className="space-y-4" data-testid="fiscal-correction-done">
        <Alert variant="success" title={t('fiscalDocuments.correction.done.title')}>
          {keptNumber ? t('fiscalDocuments.correction.done.body', { number: keptNumber }) : t('fiscalDocuments.correction.done.bodyUnknown')}
        </Alert>
        <p className="text-sm text-foreground/80">{t('fiscalDocuments.correction.done.next')}</p>
        {replacementId ? (
          <Button type="button" size="sm" onClick={() => onOpenDocument(replacementId)} data-testid="fiscal-correction-open">
            {t('fiscalDocuments.correction.done.open')}
          </Button>
        ) : null}
      </div>
    );
  }

  return (
    <section className="space-y-4 rounded-md border p-4" aria-labelledby="fiscal-correction-title" data-testid="fiscal-correction-step" data-phase={phase}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-foreground/70" data-testid="fiscal-correction-progress">
            {t('fiscalDocuments.correction.progress', { step, total: PHASES.length })}
          </p>
          <h3 id="fiscal-correction-title" className="text-base font-semibold">
            {t(`fiscalDocuments.correction.phase.${phase}`)}
          </h3>
        </div>
        <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={onClose} data-testid="fiscal-correction-close">
          {t(phase === 'done' ? 'fiscalDocuments.correction.close' : 'fiscalDocuments.correction.exit')}
        </Button>
      </div>
      <details className="text-sm text-foreground/70" data-testid="fiscal-correction-help">
        <summary className="cursor-pointer font-medium text-foreground">{t('fiscalDocuments.correction.help.title')}</summary>
        <p className="mt-1 break-words">{t('fiscalDocuments.correction.help.body')}</p>
      </details>
      {problem ? (
        <Alert variant="danger" data-testid="fiscal-correction-problem">
          {problem}
        </Alert>
      ) : null}
      {body}
    </section>
  );
}
