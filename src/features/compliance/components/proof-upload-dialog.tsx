import { useState, type FormEvent } from 'react';
import { ExternalLink } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Alert } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { getProblemMessage } from '@/lib/api-errors';
import { todayInRome } from '@/lib/stay-dates';
import { useUploadProof } from '@/queries/compliance-archive';
import type { ComplianceProofKind } from '@/types';
import { formatPeriod, isMonthKind, listedMonths } from '../lib/archive-model';

/** What a dialog starts from: the property and the day or month the page is filtered to, or the row of the report it was opened from. */
export interface ProofUploadPrefill {
  propertyId?: string;
  kind?: ComplianceProofKind;
  /** `yyyy-MM-dd`, for a receipt of an Alloggiati communication. */
  day?: string;
  /** `yyyy-MM`, for the proof of a month (ISTAT, tourist tax). */
  period?: string;
}

const MONTH = /^\d{4}-\d{2}$/;
const FIRST_DAY = '2000-01-01';
/** What a proof may be: the server judges it on its content, this only spares a round trip for a file that is plainly something else. */
const ACCEPTED_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

interface ProofUploadDialogProps {
  open: boolean;
  onClose: () => void;
  /** The properties of the caller, for the choice of one (the server decides which ones the caller reaches). */
  properties: ReadonlyArray<{ id: string; name: string }>;
  /** The kinds the person may upload: the tax kinds only with the permission that records a payment. */
  kinds: readonly ComplianceProofKind[];
  prefill?: ProofUploadPrefill;
  /** The portal of Alloggiati Web the archive sends (https): the step «Prendi la ricevuta» opens it. */
  alloggiatiPortalUrl?: string;
}

/** «Carica una prova» (NF-43, NF-47): the receipt of an Alloggiati communication, the proof of an ISTAT one or a tax receipt, as a PDF, a JPEG or a PNG. */
export function ProofUploadDialog({ open, onClose, properties, kinds, prefill, alloggiatiPortalUrl }: ProofUploadDialogProps) {
  const upload = useUploadProof();
  const pending = upload.isPending;

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        // While the file is on its way the dialog stays: closing it would hide an answer that is still to come.
        if (!next && !pending) onClose();
      }}
    >
      {open ? <UploadForm onClose={onClose} properties={properties} kinds={kinds} prefill={prefill} alloggiatiPortalUrl={alloggiatiPortalUrl} upload={upload} /> : null}
    </Dialog>
  );
}

interface UploadFormProps extends Omit<ProofUploadDialogProps, 'open'> {
  upload: ReturnType<typeof useUploadProof>;
}

function UploadForm({ onClose, properties, kinds, prefill, alloggiatiPortalUrl, upload }: UploadFormProps) {
  const { t, i18n } = useTranslation();
  const today = todayInRome();
  const pending = upload.isPending;

  const startKind = kinds.find((candidate) => candidate === prefill?.kind) ?? kinds[0];
  const [propertyId, setPropertyId] = useState(prefill?.propertyId ?? (properties.length === 1 ? properties[0].id : ''));
  const [kind, setKind] = useState<ComplianceProofKind | ''>(startKind ?? '');
  const [day, setDay] = useState(prefill?.day ?? '');
  const [month, setMonth] = useState(prefill?.period && MONTH.test(prefill.period) ? prefill.period : '');
  const [file, setFile] = useState<File | null>(null);
  const [fileProblem, setFileProblem] = useState(false);

  const monthKind = kind !== '' && isMonthKind(kind);
  // The months offered are the recent ones, and the one the form starts from when it is older.
  const months = listedMonths(today).concat(month && !listedMonths(today).includes(month) ? [month] : []);
  const when = monthKind ? month : day;
  const dayProblem = !monthKind && day !== '' && (day > today || day < FIRST_DAY);
  const ready = propertyId !== '' && kind !== '' && when !== '' && !dayProblem && file !== null && !fileProblem;
  const showPortalStep = kind === 'AlloggiatiReceipt' && alloggiatiPortalUrl !== undefined && alloggiatiPortalUrl.startsWith('https://');

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    // `ready` says a property, a kind, a day or month and a good file are there: the types follow from it.
    if (!ready || pending) return;
    upload.mutate({ propertyId, kind, day: monthKind ? `${month}-01` : day, file }, { onSuccess: onClose });
  };

  const chooseFile = (chosen: File | null) => {
    upload.reset();
    setFile(chosen);
    // A file that plainly is not a PDF, a JPEG or a PNG is told at once; one with no type the browser knows is left to the server, which reads its content.
    setFileProblem(chosen !== null && chosen.type !== '' && !ACCEPTED_TYPES.includes(chosen.type));
  };

  return (
    <DialogContent data-testid="proof-upload-dialog" className="max-w-lg">
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

        {showPortalStep ? (
          <div className="space-y-2 rounded-lg bg-muted p-3 text-sm" data-testid="proof-upload-portal-step">
            <p className="font-medium">{t('complianceArchive.upload.portalTitle')}</p>
            <p>{t('complianceArchive.upload.portalBody')}</p>
            <Button asChild variant="outline" size="sm" className="min-h-11">
              <a href={alloggiatiPortalUrl} target="_blank" rel="noopener noreferrer" data-testid="proof-upload-portal-link">
                <ExternalLink className="size-4" aria-hidden="true" />
                {t('complianceArchive.upload.portalLink')}
              </a>
            </Button>
          </div>
        ) : null}

        <Field label={t('complianceArchive.upload.file')} hint={t('complianceArchive.upload.fileHint')} error={fileProblem ? t('complianceArchive.upload.fileInvalid') : undefined}>
          <Input
            type="file"
            accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
            onChange={(event) => chooseFile(event.target.files?.[0] ?? null)}
            disabled={pending}
            data-testid="proof-upload-file"
          />
        </Field>

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
