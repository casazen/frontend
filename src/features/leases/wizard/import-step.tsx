import { useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { isAxiosError } from 'axios';
import { useTranslation } from 'react-i18next';
import { FileSearch, FileText } from 'lucide-react';
import { ConfirmationDialog } from '@/components/shared/confirmation-dialog';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { ChoiceCard, ChoiceGroup } from '@/components/ui/choice-card';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { getProblemCode, getProblemMessage } from '@/lib/api-errors';
import { isPdfFile, LEASE_MAX_SIGNED_CONTRACT_BYTES } from '@/lib/lease-signing';
import { formatStayDate, isStayDate, todayInRome } from '@/lib/stay-dates';
import { useLeaseDocuments, useReceiptReading } from '@/queries/use-lease-documents';
import { useImportSignedLease } from '@/queries/use-lease-draft';
import { WIZARD_BUTTON } from './lease-wizard-frame';
import { conflictingLeasePath, periodConflictOf } from './period-conflict';
import { AFTER_STEP, leaseEditPath } from './wizard-model';

type Registered = 'yes' | 'no';

interface ImportStepProps {
  leaseId: string;
  /** The type typed in the conditions: a concordato brought in has no check of the rent band, and the step says so. */
  contractType: string;
  /** Sends what is still waiting to be saved; false when something could not be saved. */
  flush: () => Promise<boolean>;
  /** The signed contract the person gave to be read (NL-DOCS): it is imported as it is, and not asked for a second time. */
  uploaded?: { id: string; name: string } | null;
  /** The day of the signature the contract states, when it does (`YYYY-MM-DD`). */
  stipulaRead?: string | null;
}

/** `lease_not_draft` is the answer to an import that already happened (another tab, a second try): the lease is Signed. */
function isNotDraft(error: unknown): boolean {
  return isAxiosError(error) && getProblemCode(error.response?.data) === 'lease_not_draft';
}

/**
 * Step ⑦ «Contratto firmato» of a contract that was signed elsewhere (LR-06b, LR-13): the PDF, the day it was signed, and whether it is
 * already registered. The import cannot be taken back, so it is not done until the person confirms what follows from it, and it is sent
 * once. The registration is declared afterwards, with the declaration that already exists (step ⑧ opens it when the answer was yes).
 *
 * A receipt of the registration already uploaded to the draft answers the question: a receipt the Agenzia accepted means the contract is
 * registered, and its day and number fill the declaration; a discarded request means it is not. The person is not asked again. The question
 * stays hidden until the list of documents is known, and a choice made before that does not replace what the receipt says.
 */
export function ImportStep({ leaseId, contractType, flush, uploaded = null, stipulaRead = null }: ImportStepProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const importLease = useImportSignedLease(leaseId);
  const today = todayInRome();
  const [file, setFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  // The day read from the contract (or from the receipt) until the person types another.
  const [typedDate, setTypedDate] = useState<string | null>(null);
  const kept = uploaded !== null && !replacing ? uploaded : null;
  const [chosen, setChosen] = useState<Registered | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const sending = useRef(false);

  // The receipt already among the documents of the draft, the latest one: it says whether the contract is registered.
  // While the list is still loading there is no receipt to read, so the question is not asked and the import waits.
  const documents = useLeaseDocuments(leaseId);
  const documentsPending = documents.isPending;
  const receiptDoc = [...(documents.data ?? [])].reverse().find((document) => document.kind === 'Registration') ?? null;
  const reading = useReceiptReading(leaseId, receiptDoc?.id ?? '');
  const read = reading.data?.state === 'Read' ? reading.data.receipt : null;
  const registeredByReceipt = read?.outcome === 'Registered';
  const rejectedByReceipt = read?.outcome === 'Rejected';
  const receiptUnreadable = receiptDoc !== null && reading.isSuccess && !registeredByReceipt && !rejectedByReceipt;
  const awaitingReceipt = receiptDoc !== null && !reading.data && !reading.isError && (reading.isLoading || reading.isFetching);
  const decidedByReceipt = registeredByReceipt || rejectedByReceipt || receiptUnreadable;
  // A receipt that has been read answers the question. A Yes or No chosen before that does not replace it.
  const registered: Registered | null = decidedByReceipt ? (rejectedByReceipt ? 'no' : 'yes') : chosen;

  const stipulaFromReceipt = registeredByReceipt && read?.stipulationDate ? read.stipulationDate : null;
  const stipulaDate = typedDate ?? (stipulaRead || null) ?? stipulaFromReceipt ?? '';
  const dateFromReceipt = typedDate === null && !stipulaRead && stipulaFromReceipt !== null && stipulaDate !== '';
  const dateRead = typedDate === null && !dateFromReceipt && !!stipulaRead && stipulaDate !== '';
  const readCode = registeredByReceipt && read ? (read.code ?? [read.number, read.series].filter(Boolean).join(' ')) : '';
  const readRegistrationDate = registeredByReceipt && read?.registrationDate ? formatStayDate(read.registrationDate, i18n.language) : '';
  const receiptDetail = readRegistrationDate && readCode
    ? t('leaseWizard.import.registered.fromReceiptDetail', { date: readRegistrationDate, code: readCode })
    : readRegistrationDate
      ? t('leaseWizard.import.registered.fromReceiptDate', { date: readRegistrationDate })
      : readCode
        ? t('leaseWizard.import.registered.fromReceiptCode', { code: readCode })
        : '';

  const fileOk = kept !== null || isPdfFile(file, LEASE_MAX_SIGNED_CONTRACT_BYTES);
  const dateOk = isStayDate(stipulaDate) && stipulaDate <= today;
  const day = formatStayDate(stipulaDate, i18n.language);

  const focus = (id: string) => document.getElementById(id)?.focus();
  // Another lease on the same days refused the import (409): the message has the days, the link opens that lease.
  const conflict = periodConflictOf(failure);

  const submit = async () => {
    setSubmitted(true);
    setFailure(null);
    if (!fileOk) return focus('lw-signedFile');
    if (documentsPending || awaitingReceipt) return;
    if (!dateOk) return focus('lw-stipulaDate');
    if (registered === null) return focus('lw-registered');
    if (!(await flush())) return;
    setConfirmOpen(true);
  };

  const confirm = async () => {
    if (sending.current || (kept === null && !file) || registered === null) return;
    sending.current = true;
    try {
      await importLease.mutateAsync(kept !== null ? { stipulaDate, contractDocumentId: kept.id } : { stipulaDate, signedContract: file! });
      navigate(leaseEditPath(leaseId, AFTER_STEP), { replace: true, state: { declareRegistration: registered === 'yes' } });
    } catch (error) {
      setFailure(error);
    } finally {
      sending.current = false;
    }
  };

  return (
    <div className="space-y-6" data-testid="lease-import-step">
      {kept !== null ? (
        <div className="space-y-2" data-testid="lease-import-uploaded">
          <p className="text-sm font-medium">{t('leaseWizard.import.fileLabel')}</p>
          <div className="flex min-w-0 flex-wrap items-center gap-3 rounded-md border bg-muted/30 p-3 text-sm">
            <FileText aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1 break-all">{t('leaseWizard.documents.import.uploaded', { name: kept.name })}</span>
            <Button type="button" variant="ghost" size="sm" className="max-sm:min-h-11" onClick={() => setReplacing(true)} data-testid="lease-import-other">
              {t('leaseWizard.documents.import.other')}
            </Button>
          </div>
        </div>
      ) : (
        <Field
          label={t('leaseWizard.import.fileLabel')}
          hint={t('leaseWizard.import.fileHint')}
          error={submitted && !fileOk ? t('leaseWizard.import.fileInvalid') : undefined}
        >
          <Input
            id="lw-signedFile"
            type="file"
            accept="application/pdf,.pdf"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            data-testid="lease-import-file"
          />
        </Field>
      )}

      <Field
        label={t('leaseWizard.import.dateLabel')}
        hint={t('leaseWizard.import.dateHint')}
        error={submitted && !dateOk ? t('leaseWizard.import.dateInvalid') : undefined}
        className="sm:max-w-xs"
      >
        <Input
          id="lw-stipulaDate"
          type="date"
          value={stipulaDate}
          max={today}
          onChange={(event) => setTypedDate(event.target.value)}
          data-testid="lease-import-date"
        />
      </Field>
      {dateRead || dateFromReceipt ? (
        <p className="-mt-4 flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="lease-import-date-read">
          <FileSearch aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {t(dateFromReceipt ? 'leaseDocs.receipt.check' : 'leaseWizard.documents.read.mark')}
        </p>
      ) : null}

      {decidedByReceipt && receiptDoc ? (
        <Alert variant={rejectedByReceipt ? 'danger' : 'info'} data-testid="lease-import-registered-read">
          {rejectedByReceipt
            ? t('leaseDocs.receipt.rejected')
            : registeredByReceipt
              ? t('leaseWizard.import.registered.fromReceipt', { name: receiptDoc.fileName, detail: receiptDetail })
              : t('leaseWizard.import.registered.fromReceiptUnread', { name: receiptDoc.fileName })}
        </Alert>
      ) : documentsPending ? (
        <p role="status" className="text-sm text-muted-foreground" data-testid="lease-import-documents-loading">
          {t('cfDocuments.loading')}
        </p>
      ) : awaitingReceipt ? (
        <p role="status" className="text-sm text-muted-foreground" data-testid="lease-import-receipt-reading">
          {t('leaseDocs.receipt.reading')}
        </p>
      ) : (
        <div className="space-y-2">
          <ChoiceGroup legend={t('leaseWizard.import.registered.legend')} legendVisible minCardWidth={14}>
            <ChoiceCard
              id="lw-registered"
              name="lease-registered"
              value="yes"
              checked={registered === 'yes'}
              onChange={() => setChosen('yes')}
              title={t('leaseWizard.import.registered.yes.title')}
              description={t('leaseWizard.import.registered.yes.description')}
              data-testid="lease-registered-yes"
            />
            <ChoiceCard
              name="lease-registered"
              value="no"
              checked={registered === 'no'}
              onChange={() => setChosen('no')}
              title={t('leaseWizard.import.registered.no.title')}
              description={t('leaseWizard.import.registered.no.description')}
              data-testid="lease-registered-no"
            />
          </ChoiceGroup>
          {submitted && registered === null ? (
            <p role="alert" className="text-sm text-[color:var(--color-danger-foreground,#b4232a)]">
              {t('leaseWizard.import.registered.required')}
            </p>
          ) : null}
          {registered === 'no' ? <p className="text-sm text-muted-foreground">{t('leaseWizard.import.reminderNotice')}</p> : null}
        </div>
      )}
      {decidedByReceipt && registered === 'no' ? (
        <p className="text-sm text-muted-foreground">{t('leaseWizard.import.reminderNotice')}</p>
      ) : null}

      {contractType === 'Concordato' ? (
        <Alert variant="info" data-testid="lease-import-concordato">
          {t('leaseWizard.import.concordatoNotice')}
        </Alert>
      ) : null}

      {failure ? (
        <Alert variant="danger" data-testid="lease-import-error">
          {getProblemMessage(failure, t) ?? t('leaseWizard.import.failed')}
          {isNotDraft(failure) ? (
            <>
              {' '}
              <Link to={`/app/long-rent/leases/${leaseId}`} className="font-semibold underline underline-offset-2">
                {t('leaseWizard.goToLease')}
              </Link>
            </>
          ) : null}
          {conflict ? (
            <>
              {' '}
              <Link to={conflictingLeasePath(conflict.conflictingLeaseId)} className="font-semibold underline underline-offset-2">
                {t('leaseWizard.periodConflict.open')}
              </Link>
            </>
          ) : null}
        </Alert>
      ) : null}

      <Button
        type="button"
        loading={importLease.isPending}
        onClick={() => void submit()}
        className={`${WIZARD_BUTTON} w-full sm:w-auto`}
        data-testid="lease-import-submit"
      >
        {t('leaseWizard.import.submit')}
      </Button>

      <ConfirmationDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={t('leaseWizard.import.confirm.title')}
        description={t('leaseWizard.import.confirm.description', { date: day })}
        consequences={[
          t('leaseWizard.import.confirm.signed'),
          t('leaseWizard.import.confirm.fixed'),
          t(registeredByReceipt ? 'leaseWizard.import.confirm.fromReceipt' : registered === 'yes' ? 'leaseWizard.import.confirm.yes' : 'leaseWizard.import.confirm.no'),
        ]}
        confirmLabel={t('leaseWizard.import.confirm.submit')}
        onConfirm={confirm}
        isLoading={importLease.isPending}
      />
    </div>
  );
}
