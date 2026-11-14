import { useState, type FormEvent, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { useWorkspace } from '@/hooks/use-workspace';
import { getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import {
  useCreateFiscalCreditNote,
  useDiscardFiscalDocument,
  useFiscalDocumentsContext,
  useIssueFiscalDocument,
  useIssuedNumbers,
} from '@/queries/use-fiscal-documents';
import {
  CREDIT_REASON_MAX,
  creditProblemOf,
  creditRequestOf,
  documentKindWords,
  documentNameOf,
  formatDocumentAmount,
  numberingOf,
  seriesOf,
  type CreditForm,
  type CreditProblem,
} from './document-model';

/** What a dialog needs to know of the document it is about: its kind and number for its name, and its total in its own currency. */
export interface DialogDocument {
  id: string;
  kind: string;
  number: string | null;
  total: number;
  currency: string;
}

interface DialogProps {
  document: DialogDocument;
  onClose: () => void;
}

/** One line of the summary of a dialog: what it is and what it says. */
function SummaryRow({ label, children, testId }: { label: string; children: ReactNode; testId?: string }) {
  return (
    <div className="flex min-w-0 items-baseline justify-between gap-4">
      <dt className="text-foreground/70">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium" data-testid={testId}>
        {children}
      </dd>
    </div>
  );
}

/**
 * The confirmation of the issue of a draft (E12/F02/US01/T01): what the document is, the series and the number it is expected to get, and its total in its own currency (a document in francs
 * is confirmed in francs). Issuing gives the document its number and it can no longer be changed, so the host confirms it here; the server gives the number when it issues, in order and
 * with no gaps, and the number told here is an expectation and says so: the series comes from the setting of the issuer and the number from the newest documents issued. While either could
 * not be read nothing is expected, and the dialog says that CasaZen gives the number when it issues. A refusal (the draft was made with rules or data that changed, the data of the invoice
 * missing...) is told in the dialog, in the words of its code, and the dialog stays open.
 */
export function IssueDocumentDialog({ document, onClose, onIssued }: DialogProps & { onIssued?: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useWorkspace();
  const issue = useIssueFiscalDocument();
  const [problem, setProblem] = useState<string | null>(null);
  // The setting that holds the series is read by who may read payments and properties, like the page of the documents.
  const canReadSetting = hasPermission('short-rent', 'payment.read') && hasPermission('short-rent', 'property.read');
  const context = useFiscalDocumentsContext(canReadSetting);
  const issued = useIssuedNumbers(true);
  const numbering = numberingOf(seriesOf(context.data?.guestDocumentSeries, todayInRome()), issued.data);

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('fiscalDocuments.issue.title')}
      description={t('fiscalDocuments.issue.description')}
      confirmLabel={t('fiscalDocuments.issue.confirm')}
      consequences={[t('fiscalDocuments.issue.consequence')]}
      isLoading={issue.isPending}
      onConfirm={async () => {
        setProblem(null);
        try {
          await issue.mutateAsync({ documentId: document.id });
        } catch (error) {
          // The dialog stays open (the confirmation does not close on a rejection) and says why.
          setProblem(getProblemMessage(error, t) ?? t('fiscalDocuments.issue.failed'));
          throw error;
        }
        onIssued?.(document.id);
      }}
    >
      <dl className="grid gap-2 text-sm" data-testid="fiscal-document-issue-summary">
        <SummaryRow label={t('fiscalDocuments.issue.document')}>{documentKindWords(t, document.kind)}</SummaryRow>
        <SummaryRow label={t('fiscalDocuments.issue.series')} testId="fiscal-document-issue-series">
          {numbering.series ?? t('fiscalDocuments.issue.seriesUnknown')}
        </SummaryRow>
        <SummaryRow label={t('fiscalDocuments.issue.number')} testId="fiscal-document-issue-number">
          {numbering.next ? t('fiscalDocuments.issue.numberExpected', { number: numbering.next }) : t('fiscalDocuments.issue.numberUnknown')}
        </SummaryRow>
        <SummaryRow label={t('fiscalDocuments.issue.total')} testId="fiscal-document-issue-total">
          <span className="tabular-nums">{formatDocumentAmount(document.total, document.currency, i18n.language)}</span>
        </SummaryRow>
      </dl>
      {numbering.last ? (
        <p className="text-sm text-foreground/70" data-testid="fiscal-document-issue-last">
          {t('fiscalDocuments.issue.lastNumber', { number: numbering.last })}
        </p>
      ) : null}
      {problem ? (
        <Alert variant="danger" data-testid="fiscal-document-issue-problem">
          {problem}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}

/** What a draft that is dropped says: it consumed no number, and the booking may have a new draft. */
export function DiscardDraftDialog({ document, onClose, onDiscarded }: DialogProps & { onDiscarded?: (id: string) => void }) {
  const { t } = useTranslation();
  const discard = useDiscardFiscalDocument();
  const [problem, setProblem] = useState<string | null>(null);

  return (
    <ConfirmationDialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      title={t('fiscalDocuments.discard.title')}
      description={t('fiscalDocuments.discard.description', { document: documentNameOf(t, document) })}
      confirmLabel={t('fiscalDocuments.discard.confirm')}
      variant="destructive"
      isLoading={discard.isPending}
      onConfirm={async () => {
        setProblem(null);
        try {
          await discard.mutateAsync({ documentId: document.id });
        } catch (error) {
          setProblem(getProblemMessage(error, t) ?? t('fiscalDocuments.discard.failed'));
          throw error;
        }
        onDiscarded?.(document.id);
      }}
    >
      {problem ? (
        <Alert variant="danger" data-testid="fiscal-document-discard-problem">
          {problem}
        </Alert>
      ) : null}
    </ConfirmationDialog>
  );
}

/**
 * The credit note of an issued document (E12/F02/US01/T01): the whole document or a part of it, and why. The amount is typed in the currency of the document and the dialog says which; before it is
 * asked of the server it must be above zero and not above the total of the document, and the reason is required (the server cuts it at 200 characters). What is left to credit is the server's:
 * other credit notes may exist, so the cap is checked there and its refusal is told here, in words, with the dialog still open. The credit note is issued at once, so pressing the button is the
 * confirmation.
 */
export function CreditNoteDialog({ document, onClose, onCredited }: DialogProps & { onCredited?: (id: string) => void }) {
  const { t, i18n } = useTranslation();
  const credit = useCreateFiscalCreditNote();
  const [form, setForm] = useState<CreditForm>({ scope: 'whole', amount: '', reason: '' });
  const [asked, setAsked] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  // What is wrong is told once the person has pressed the button, not while they are still typing.
  const check: CreditProblem | null = asked ? creditProblemOf(form, document.total) : null;
  const total = formatDocumentAmount(document.total, document.currency, i18n.language);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The dialog is drawn outside the page but sits inside it for React: its submit must not reach a form around it.
    event.stopPropagation();
    setAsked(true);
    if (creditProblemOf(form, document.total) !== null || credit.isPending) return;
    setProblem(null);
    try {
      await credit.mutateAsync({ documentId: document.id, request: creditRequestOf(form) });
    } catch (error) {
      setProblem(getProblemMessage(error, t) ?? t('fiscalDocuments.credit.failed'));
      return;
    }
    onCredited?.(document.id);
    onClose();
  };

  const amountError =
    check === 'amountInvalid' ? t('fiscalDocuments.credit.errors.amountInvalid') : check === 'amountTooHigh' ? t('fiscalDocuments.credit.errors.amountTooHigh') : undefined;
  const reasonError = check === 'reasonRequired' ? t('fiscalDocuments.credit.errors.reasonRequired') : undefined;

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent data-testid="fiscal-credit-note-dialog">
        <form onSubmit={(event) => void submit(event)} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{t('fiscalDocuments.credit.title')}</DialogTitle>
            <DialogDescription>{t('fiscalDocuments.credit.description', { document: documentNameOf(t, document) })}</DialogDescription>
          </DialogHeader>

          <fieldset className="grid gap-1">
            <legend className="mb-1 text-sm font-medium">{t('fiscalDocuments.credit.scope.legend')}</legend>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="credit-scope"
                className="size-4 accent-primary"
                checked={form.scope === 'whole'}
                onChange={() => setForm({ ...form, scope: 'whole' })}
                data-testid="fiscal-credit-whole"
              />
              <span>{t('fiscalDocuments.credit.scope.whole', { amount: total })}</span>
            </label>
            <label className="flex min-h-11 cursor-pointer items-center gap-2 text-sm">
              <input
                type="radio"
                name="credit-scope"
                className="size-4 accent-primary"
                checked={form.scope === 'part'}
                onChange={() => setForm({ ...form, scope: 'part' })}
                data-testid="fiscal-credit-part"
              />
              <span>{t('fiscalDocuments.credit.scope.part')}</span>
            </label>
          </fieldset>

          {form.scope === 'part' ? (
            <Field label={t('fiscalDocuments.credit.amount.label', { currency: document.currency })} hint={t('fiscalDocuments.credit.amount.hint')} error={amountError}>
              <Input
                inputMode="decimal"
                autoComplete="off"
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                data-testid="fiscal-credit-amount"
              />
            </Field>
          ) : null}

          <Field
            label={t('fiscalDocuments.credit.reason.label')}
            hint={t('fiscalDocuments.credit.reason.hint')}
            counter={`${form.reason.length}/${CREDIT_REASON_MAX}`}
            error={reasonError}
          >
            <Textarea
              rows={3}
              maxLength={CREDIT_REASON_MAX}
              value={form.reason}
              onChange={(event) => setForm({ ...form, reason: event.target.value })}
              data-testid="fiscal-credit-reason"
            />
          </Field>

          {problem ? (
            <Alert variant="danger" data-testid="fiscal-credit-problem">
              {problem}
            </Alert>
          ) : null}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose} disabled={credit.isPending}>
              {t('shared.cancel')}
            </Button>
            <Button type="submit" loading={credit.isPending} data-testid="fiscal-credit-submit">
              {t('fiscalDocuments.credit.confirm')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
