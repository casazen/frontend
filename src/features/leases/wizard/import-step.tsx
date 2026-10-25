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
import { useImportSignedLease } from '@/queries/use-lease-draft';
import { WIZARD_BUTTON } from './lease-wizard-frame';
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
 */
export function ImportStep({ leaseId, contractType, flush, uploaded = null, stipulaRead = null }: ImportStepProps) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const importLease = useImportSignedLease(leaseId);
  const today = todayInRome();
  const [file, setFile] = useState<File | null>(null);
  const [replacing, setReplacing] = useState(false);
  // The day read from the contract until the person types another.
  const [typedDate, setTypedDate] = useState<string | null>(null);
  const stipulaDate = typedDate ?? stipulaRead ?? '';
  const dateRead = typedDate === null && stipulaRead !== null && stipulaDate !== '';
  const kept = uploaded !== null && !replacing ? uploaded : null;
  const [registered, setRegistered] = useState<Registered | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [failure, setFailure] = useState<unknown>(null);
  const sending = useRef(false);

  const fileOk = kept !== null || isPdfFile(file, LEASE_MAX_SIGNED_CONTRACT_BYTES);
  const dateOk = isStayDate(stipulaDate) && stipulaDate <= today;
  const day = formatStayDate(stipulaDate, i18n.language);

  const focus = (id: string) => document.getElementById(id)?.focus();

  const submit = async () => {
    setSubmitted(true);
    setFailure(null);
    if (!fileOk) return focus('lw-signedFile');
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
      {dateRead ? (
        <p className="-mt-4 flex items-start gap-1.5 text-xs text-muted-foreground" data-testid="lease-import-date-read">
          <FileSearch aria-hidden="true" className="mt-0.5 size-3.5 shrink-0" />
          {t('leaseWizard.documents.read.mark')}
        </p>
      ) : null}

      <div className="space-y-2">
        <ChoiceGroup legend={t('leaseWizard.import.registered.legend')} legendVisible minCardWidth={14}>
          <ChoiceCard
            id="lw-registered"
            name="lease-registered"
            value="yes"
            checked={registered === 'yes'}
            onChange={() => setRegistered('yes')}
            title={t('leaseWizard.import.registered.yes.title')}
            description={t('leaseWizard.import.registered.yes.description')}
            data-testid="lease-registered-yes"
          />
          <ChoiceCard
            name="lease-registered"
            value="no"
            checked={registered === 'no'}
            onChange={() => setRegistered('no')}
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
          t(registered === 'yes' ? 'leaseWizard.import.confirm.yes' : 'leaseWizard.import.confirm.no'),
        ]}
        confirmLabel={t('leaseWizard.import.confirm.submit')}
        onConfirm={confirm}
        isLoading={importLease.isPending}
      />
    </div>
  );
}
