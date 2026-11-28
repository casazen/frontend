import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { COMPLIANCE_ARCHIVE_ERROR, complianceArchiveErrorCode } from '@/api/compliance-archive.api';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Dropzone } from '@/components/ui/dropzone';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { useFeatureFlagsReadAgain } from '@/hooks/use-feature-flags-read-again';
import { getHttpStatus, getProblemMessage } from '@/lib/api-errors';
import { formatStayDate, todayInRome } from '@/lib/stay-dates';
import { useReceiptCoverage, useUploadProof } from '@/queries/compliance-archive';
import type { ComplianceProofKind } from '@/types';
import { MAX_RECEIPT_FLATS, formatPeriod, isMonthKind, listedMonths } from '../lib/archive-model';
import { ReceiptRecoverySteps } from './receipt-recovery-steps';

export interface ProofUploadPrefill {
  propertyId?: string;
  kind?: ComplianceProofKind;
  day?: string;
  period?: string;
}

export interface ProofUploadProperty {
  id: string;
  name: string;
  /** `Long` = let long-term: the Alloggiati communication is for short stays, so such a flat is never offered, neither to file a receipt under nor to cover. */
  rentalMode?: 'Short' | 'Long';
}

const MONTH = /^\d{4}-\d{2}$/;
const FIRST_DAY = '2000-01-01';
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const FILE_ACCEPT = ['.pdf', '.jpg', '.jpeg', '.png', ...ACCEPTED_TYPES];

interface ProofUploadDialogProps {
  open: boolean;
  onClose: () => void;
  properties: ReadonlyArray<ProofUploadProperty>;
  kinds: readonly ComplianceProofKind[];
  prefill?: ProofUploadPrefill;
  /** The portal of Alloggiati Web the archive sends (https): the guide «Recupera la ricevuta» opens it. */
  alloggiatiPortalUrl?: string;
}

/**
 * «Carica una prova» (NF-43, NF-47): the receipt of an Alloggiati communication, the proof of an ISTAT one or a tax receipt, as a PDF, a JPEG or a PNG.
 * The dialog exists only while it is open, and so does its upload: the mutation (with the file, the answer or the refusal) lives in the part that is mounted
 * for that time. Closing the dialog (the button, the cross, Escape, the file stored) unmounts it, nobody watches the mutation any more and `gcTime: 0` drops
 * it; a hook that stayed mounted with the page would keep watching it, and would show the refusal of an older upload again on reopening.
 *
 * The receipt of an Alloggiati communication is one for each day and for each account of the portal, whatever the number of flats (E20/F02/US02/T01, decision O3): after the
 * day the dialog asks which flats the receipt is for (the one it is filed under, always, and the others the host ticks one by one), says before saving how many stays
 * become in order with it («Diventano in regola: N soggiorni», UX-05) and tells the outcome after, in this same layer. It guides the host who has no receipt yet through
 * «Recupera la ricevuta» (the portal, the day, the file dragged here) without leaving the page.
 *
 * The list of the API carries no country, so the dialog cannot tell which flats are in Italy: it says that a receipt covers several flats only when they all are, and the server's
 * refusal (422 `compliance_proof_coverage_invalid`, on the summary and on the upload) is told in plain words with how to take the flat off the receipt.
 */
export function ProofUploadDialog({ open, ...dialog }: ProofUploadDialogProps) {
  return open ? <OpenProofUploadDialog {...dialog} /> : null;
}

function OpenProofUploadDialog({ onClose, properties, kinds, prefill, alloggiatiPortalUrl }: Omit<ProofUploadDialogProps, 'open'>) {
  const upload = useUploadProof();
  const pending = upload.isPending;

  return (
    <Dialog
      open
      onOpenChange={(next) => {
        if (!next && !pending) onClose();
      }}
    >
      <UploadForm onClose={onClose} properties={properties} kinds={kinds} prefill={prefill} alloggiatiPortalUrl={alloggiatiPortalUrl} upload={upload} />
    </Dialog>
  );
}

interface UploadFormProps extends Omit<ProofUploadDialogProps, 'open'> {
  upload: ReturnType<typeof useUploadProof>;
}

function UploadForm({ onClose, properties: listed, kinds, prefill, alloggiatiPortalUrl, upload }: UploadFormProps) {
  const { t, i18n } = useTranslation();
  const { flags, settled: flagsRead } = useFeatureFlagsReadAgain();
  const properties = listed.filter((flat) => flat.rentalMode !== 'Long');
  const today = todayInRome();
  const pending = upload.isPending;
  const purgeOn = flags.purgeDocumentsAfterReceipt;

  const startKind = kinds.find((candidate) => candidate === prefill?.kind) ?? kinds[0];
  const [propertyId, setPropertyId] = useState(prefill?.propertyId ?? (properties.length === 1 ? properties[0].id : ''));
  const [kind, setKind] = useState<ComplianceProofKind | ''>(startKind ?? '');
  const [day, setDay] = useState(prefill?.day ?? '');
  const [month, setMonth] = useState(prefill?.period && MONTH.test(prefill.period) ? prefill.period : '');
  const [others, setOthers] = useState<readonly string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState(false);

  const isReceipt = kind === 'AlloggiatiReceipt';
  const monthKind = kind !== '' && isMonthKind(kind);
  const months = listedMonths(today).concat(month && !listedMonths(today).includes(month) ? [month] : []);
  const when = monthKind ? month : day;
  const dayProblem = !monthKind && day !== '' && (day > today || day < FIRST_DAY);

  const primaryFlat = properties.find((flat) => flat.id === propertyId);
  const flatsOffered = isReceipt && primaryFlat !== undefined && properties.length > 1;
  const addedFlats = flatsOffered ? properties.filter((flat) => flat.id !== propertyId && others.includes(flat.id)).slice(0, MAX_RECEIPT_FLATS - 1) : [];
  const covered = propertyId === '' ? [] : [propertyId, ...addedFlats.map((flat) => flat.id)];

  const outcome = upload.isSuccess && typeof upload.data.coveredStays === 'number' ? upload.data : undefined;
  const coverageAsked = isReceipt && covered.length > 0 && day !== '' && !dayProblem && outcome === undefined;
  const coverage = useReceiptCoverage(day, covered, coverageAsked);
  const summaryRequired = purgeOn && isReceipt;
  const question = `${day}|${covered.join(',')}`;
  const [confirmedFor, setConfirmedFor] = useState<string | null>(null);
  const mayGoOnWithoutSummary = summaryRequired && coverageAsked && coverage.isError && summaryRefusal(coverage.error) === undefined;
  const goesOnWithoutSummary = mayGoOnWithoutSummary && confirmedFor === question;
  const ready =
    flagsRead && propertyId !== '' && kind !== '' && when !== '' && !dayProblem && file !== null && !fileProblem && (!summaryRequired || coverage.isSuccess || goesOnWithoutSummary);

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!ready || pending) return;
    upload.mutate(
      {
        propertyId,
        kind,
        day: monthKind ? `${month}-01` : day,
        file,
        ...(isReceipt && covered.length > 1 ? { propertyIds: covered } : {}),
      },
      {
        onSuccess: (saved) => {
          if (typeof saved.coveredStays !== 'number') onClose();
        },
      },
    );
  };

  const chooseFile = (files: File[]) => {
    const chosen = files[0] ?? null;
    upload.reset();
    setFile(chosen);
    setFileProblem(chosen !== null && chosen.type !== '' && !ACCEPTED_TYPES.includes(chosen.type));
  };

  const toggleFlat = (id: string, covers: boolean) => {
    upload.reset();
    setOthers((current) => (covers ? [...current.filter((other) => other !== id), id] : current.filter((other) => other !== id)));
  };

  if (outcome) {
    const flats = outcome.coveredProperties ?? covered.map((id) => ({ id, name: properties.find((flat) => flat.id === id)?.name ?? '' }));
    const stays = outcome.coveredStays ?? 0;

    return (
      <DialogContent data-testid="proof-upload-dialog" className="sm:max-h-[90dvh] sm:max-w-xl sm:overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('complianceArchive.upload.outcome.title')}</DialogTitle>
          <DialogDescription>{t('complianceArchive.upload.outcome.description', { day: formatStayDate(outcome.day, i18n.language) })}</DialogDescription>
        </DialogHeader>

        <div role="status" className="space-y-3 text-sm" data-testid="proof-upload-outcome">
          {flats.length > 0 ? (
            <div className="space-y-1">
              <p className="font-medium">{t('complianceArchive.upload.outcome.flats')}</p>
              <ul className="list-disc space-y-0.5 pl-5" data-testid="proof-upload-outcome-flats">
                {flats.map((flat) => (
                  <li key={flat.id} className="break-words">
                    {flat.name}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <p className="font-medium" data-testid="proof-upload-outcome-stays">
            {stays > 0 ? t('complianceArchive.upload.outcome.stays', { count: stays }) : t('complianceArchive.upload.outcome.staysNone')}
          </p>
          {purgeOn && stays > 0 ? (
            <>
              <p className="text-muted-foreground" data-testid="proof-upload-outcome-purge">
                {t('complianceArchive.upload.outcome.purge')}
              </p>
              <p className="text-muted-foreground" data-testid="proof-upload-outcome-purge-log">
                {t('complianceArchive.upload.outcome.purgeLog')}
              </p>
            </>
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" onClick={onClose} data-testid="proof-upload-outcome-close">
            {t('complianceArchive.upload.outcome.close')}
          </Button>
        </DialogFooter>
      </DialogContent>
    );
  }

  const fileArea = (
    <div className="space-y-1.5" data-testid="proof-upload-file-area">
      <Dropzone
        accept={FILE_ACCEPT}
        multiple={false}
        onFiles={chooseFile}
        disabled={pending}
        title={file ? t('complianceArchive.upload.fileChosen', { name: file.name }) : t('complianceArchive.upload.fileDrop')}
        buttonLabel={t(file ? 'complianceArchive.upload.fileChooseAnother' : 'complianceArchive.upload.fileChoose')}
        hint={t('complianceArchive.upload.fileHint')}
        className="bg-background py-5"
        data-testid="proof-upload-drop"
        inputTestId="proof-upload-file"
      />
      {fileProblem ? (
        <p role="alert" className="break-words text-sm text-[color:var(--color-danger-foreground,#b4232a)]" data-testid="proof-upload-file-problem">
          {t('complianceArchive.upload.fileInvalid')}
        </p>
      ) : null}
    </div>
  );

  return (
    <DialogContent data-testid="proof-upload-dialog" className="sm:max-h-[90dvh] sm:max-w-xl sm:overflow-y-auto">
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <DialogHeader>
          <DialogTitle>{t('complianceArchive.upload.title')}</DialogTitle>
          <DialogDescription>{t('complianceArchive.upload.description')}</DialogDescription>
        </DialogHeader>

        <Field label={t('complianceArchive.upload.property')}>
          <Select
            value={propertyId}
            onChange={(event) => {
              upload.reset();
              setPropertyId(event.target.value);
            }}
            disabled={pending}
            data-testid="proof-upload-property"
          >
            <option value="">{t('complianceArchive.upload.chooseProperty')}</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>

        {kinds.length > 1 ? (
          <Field label={t('complianceArchive.upload.kind')}>
            <Select
              value={kind}
              onChange={(event) => {
                upload.reset();
                setKind(event.target.value as ComplianceProofKind);
              }}
              disabled={pending}
              data-testid="proof-upload-kind"
            >
              {kinds.map((candidate) => (
                <option key={candidate} value={candidate}>
                  {t(`complianceArchive.kind.${candidate}`)}
                </option>
              ))}
            </Select>
          </Field>
        ) : null}

        {monthKind ? (
          <Field label={t('complianceArchive.upload.month')}>
            <Select
              value={month}
              onChange={(event) => {
                upload.reset();
                setMonth(event.target.value);
              }}
              disabled={pending}
              data-testid="proof-upload-month"
            >
              <option value="">{t('complianceArchive.upload.chooseMonth')}</option>
              {months.map((value) => (
                <option key={value} value={value}>
                  {formatPeriod(value, i18n.language)}
                </option>
              ))}
            </Select>
          </Field>
        ) : (
          <Field label={t('complianceArchive.upload.day')} hint={t('complianceArchive.upload.dayHint')} error={dayProblem ? t('complianceArchive.upload.dayInvalid') : undefined}>
            <Input
              type="date"
              value={day}
              min={FIRST_DAY}
              max={today}
              onChange={(event) => {
                upload.reset();
                setDay(event.target.value);
              }}
              disabled={pending}
              data-testid="proof-upload-day"
            />
          </Field>
        )}

        {flatsOffered ? (
          <FlatsChoice
            flats={[...properties.filter((flat) => flat.id === propertyId), ...properties.filter((flat) => flat.id !== propertyId)]}
            primaryId={propertyId}
            added={others}
            full={covered.length >= MAX_RECEIPT_FLATS}
            disabled={pending}
            onToggle={toggleFlat}
          />
        ) : null}

        {isReceipt ? (
          <ReceiptRecoverySteps portalUrl={alloggiatiPortalUrl} day={day !== '' && !dayProblem ? day : undefined}>
            {fileArea}
          </ReceiptRecoverySteps>
        ) : (
          fileArea
        )}

        {isReceipt && coverageAsked ? (
          <CoverageSummary
            coverage={coverage}
            purge={purgeOn}
            busy={pending}
            goOn={mayGoOnWithoutSummary ? { confirmed: goesOnWithoutSummary, onConfirm: (confirmed) => setConfirmedFor(confirmed ? question : null) } : undefined}
          />
        ) : null}

        {upload.isError ? (
          <Alert variant="danger" role="alert" data-testid="proof-upload-error">
            {getProblemMessage(upload.error, t) ?? t('complianceArchive.upload.failed')}
          </Alert>
        ) : null}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={onClose} disabled={pending} data-testid="proof-upload-cancel">
            {t('complianceArchive.upload.cancel')}
          </Button>
          <Button type="submit" loading={pending} disabled={!ready} data-testid="proof-upload-submit">
            {t('complianceArchive.upload.submit')}
          </Button>
        </DialogFooter>
      </form>
    </DialogContent>
  );
}

interface FlatsChoiceProps {
  flats: readonly ProofUploadProperty[];
  primaryId: string;
  added: readonly string[];
  full: boolean;
  disabled: boolean;
  onToggle: (id: string, covers: boolean) => void;
}

/**
 * «Questa ricevuta vale per»: the flats of the organization the receipt of the day covers, the one it is filed under first (the default, always covered). An agency with one
 * account on the police portal gets one receipt a day for all of its flats, so the others are ticked here, one by one. Nothing is ticked for the host: with no other flat ticked the
 * receipt covers the one it is filed under alone, never every flat. The list of the API does not say which flats are in Italy, so the text says that a receipt covers several flats only
 * when they all are.
 */
function FlatsChoice({ flats, primaryId, added, full, disabled, onToggle }: FlatsChoiceProps) {
  const { t } = useTranslation();

  return (
    <fieldset className="min-w-0 space-y-1" disabled={disabled} data-testid="proof-upload-flats">
      <legend className="text-sm font-medium leading-snug">{t('complianceArchive.upload.flats.legend')}</legend>
      <p className="break-words text-sm text-muted-foreground">{t('complianceArchive.upload.flats.hint', { max: MAX_RECEIPT_FLATS })}</p>
      <div className="max-h-48 overflow-y-auto">
        {flats.map((flat) => {
          const isPrimary = flat.id === primaryId;
          const covers = isPrimary || added.includes(flat.id);
          return (
            <label key={flat.id} className="flex min-h-11 cursor-pointer items-center gap-3 text-sm">
              <Checkbox
                checked={covers}
                disabled={isPrimary || (full && !covers)}
                onCheckedChange={(checked) => onToggle(flat.id, checked === true)}
                data-testid={`proof-upload-flat-${flat.id}`}
              />
              <span className="min-w-0 break-words">{isPrimary ? t('complianceArchive.upload.flats.current', { name: flat.name }) : flat.name}</span>
            </label>
          );
        })}
      </div>
      {full ? (
        <p className="break-words text-sm text-muted-foreground" data-testid="proof-upload-flats-limit">
          {t('complianceArchive.upload.flats.limit', { max: MAX_RECEIPT_FLATS })}
        </p>
      ) : null}
    </fieldset>
  );
}

function summaryRefusal(error: unknown): 'notFound' | 'coverageInvalid' | undefined {
  if (getHttpStatus(error) === 404) return 'notFound';
  return complianceArchiveErrorCode(error) === COMPLIANCE_ARCHIVE_ERROR.proofCoverageInvalid ? 'coverageInvalid' : undefined;
}

interface CoverageSummaryProps {
  coverage: ReturnType<typeof useReceiptCoverage>;
  purge: boolean;
  busy: boolean;
  goOn?: { confirmed: boolean; onConfirm: (confirmed: boolean) => void };
}

/**
 * «Diventano in regola: N soggiorni» (UX-05, riepilogo prima): what the receipt would prove for the days and flats chosen now, from the server (the count of the traffic light: a stay
 * whose communication failed or was only partly accepted is not in it). A read that fails is told as a failure, never as a count, and never with the number of an older choice or an
 * older read: the error comes before the data, and a flat the server does not find (404) is told as such whatever the cache still holds. With the deletion of the documents on, the summary
 * also says that the photos of the documents of those stays will be deleted, and that this cannot be undone; and a failure says why the save waits and how to go on (try again, or confirm).
 */
function CoverageSummary({ coverage, purge, busy, goOn }: CoverageSummaryProps) {
  const { t } = useTranslation();

  if (coverage.isError) {
    const refusal = summaryRefusal(coverage.error);
    const reason = getProblemMessage(coverage.error, t);
    const failed = purge ? t('complianceArchive.upload.coverage.failedPurge') : (reason ?? t('complianceArchive.upload.coverage.failed'));
    return (
      <div className="space-y-3" data-testid="proof-upload-coverage-failure">
        <Alert
          variant="warning"
          data-testid="proof-upload-coverage-error"
          action={
            refusal ? undefined : (
              <Button type="button" variant="outline" size="sm" className="min-h-11" disabled={busy} onClick={() => void coverage.refetch()} data-testid="proof-upload-coverage-retry">
                {t('complianceArchive.upload.coverage.retry')}
              </Button>
            )
          }
        >
          {refusal === 'notFound' ? t('complianceArchive.upload.coverage.notFound') : refusal === 'coverageInvalid' ? reason : purge && reason ? `${reason} ${failed}` : failed}
        </Alert>
        {goOn ? (
          <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm">
            <Checkbox
              checked={goOn.confirmed}
              disabled={busy}
              onCheckedChange={(checked) => goOn.onConfirm(checked === true)}
              className="mt-0.5"
              data-testid="proof-upload-coverage-go-on"
            />
            <span className="min-w-0 break-words">{t('complianceArchive.upload.coverage.goOn')}</span>
          </label>
        ) : null}
      </div>
    );
  }

  if (!coverage.data) {
    return (
      <p role="status" aria-busy="true" className="text-sm text-muted-foreground" data-testid="proof-upload-coverage-loading">
        {t('complianceArchive.upload.coverage.loading')}
      </p>
    );
  }

  const { stays, properties } = coverage.data;
  return (
    <div className="space-y-2 rounded-lg border border-border p-3 text-sm" data-testid="proof-upload-coverage">
      <p role="status" className="font-medium" data-testid="proof-upload-coverage-total">
        {stays > 0 ? t('complianceArchive.upload.coverage.summary', { count: stays }) : t('complianceArchive.upload.coverage.none')}
      </p>
      {stays === 0 ? <p className="text-muted-foreground">{t('complianceArchive.upload.coverage.noneHint')}</p> : null}
      {properties.length > 1 ? (
        <ul className="space-y-0.5 text-muted-foreground" aria-label={t('complianceArchive.upload.coverage.perFlat')} data-testid="proof-upload-coverage-flats">
          {properties.map((flat) => (
            <li key={flat.propertyId} className="break-words">
              {t('complianceArchive.upload.coverage.flatLine', { name: flat.propertyName, count: flat.stays })}
            </li>
          ))}
        </ul>
      ) : null}
      {purge && stays > 0 ? (
        <Alert variant="warning" data-testid="proof-upload-purge-warning">
          {t('complianceArchive.upload.coverage.purge')}
        </Alert>
      ) : null}
    </div>
  );
}
