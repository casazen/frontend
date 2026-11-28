import { useId, useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SwissReceiptType, TicinoNotificationDay } from '@/types/swissCompliance.types';
import { groupRowsOf, PARENTAL_AUTHORIZATION_NEEDED, warnedStaysOf } from './ticino-day-model';

const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;

const ACCEPTED_DOCUMENTS = 'application/pdf,image/*,text/csv,.csv';

interface DocumentUploadProps {
  testId: string;
  fileLabel: string;
  buttonLabel: string;
  hint?: string;
  busy: boolean;
  onUpload: (file: File) => Promise<boolean>;
}

function DocumentUpload({ testId, fileLabel, buttonLabel, hint, busy, onUpload }: DocumentUploadProps) {
  const { t } = useTranslation();
  const inputId = useId();
  const hintId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const tooBig = file !== null && file.size > MAX_DOCUMENT_BYTES;

  const upload = async () => {
    if (!file || tooBig) return;
    setUploading(true);
    const filed = await onUpload(file);
    setUploading(false);
    if (filed) {
      setFile(null);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-2" data-testid={testId}>
      <Label htmlFor={inputId}>{fileLabel}</Label>
      <Input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ACCEPTED_DOCUMENTS}
        disabled={busy}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
        aria-describedby={hint ? hintId : undefined}
        data-testid={`${testId}-file`}
      />
      {hint ? (
        <p id={hintId} className="text-sm text-foreground/70">
          {hint}
        </p>
      ) : null}
      {tooBig ? (
        <p role="alert" className="text-sm text-destructive" data-testid={`${testId}-too-big`}>
          {t('swiss.receipt.tooBig')}
        </p>
      ) : null}
      <Button type="button" variant="outline" disabled={!file || tooBig || busy} onClick={() => void upload()} data-testid={`${testId}-upload`}>
        <Upload aria-hidden="true" className="size-4" />
        {uploading ? t('swiss.receipt.uploading') : buttonLabel}
      </Button>
    </div>
  );
}

interface TicinoReceiptStepProps {
  day: TicinoNotificationDay;
  /** The person may file documents of the police communication of the property (`alloggiati.submit`, what the endpoint asks). */
  canSubmit: boolean;
  busy: boolean;
  onRecord: (type: SwissReceiptType, reference: string, file: File) => Promise<boolean>;
}

export function TicinoReceiptStep({ day, canSubmit, busy, onRecord }: TicinoReceiptStepProps) {
  const { t } = useTranslation();
  const parentalStays = warnedStaysOf(day, PARENTAL_AUTHORIZATION_NEEDED);
  const groups = groupRowsOf(day);

  if (!canSubmit) {
    return (
      <p className="text-sm text-foreground/70" data-testid="ticino-receipt-needs-submit">
        {t('swiss.receipt.needsSubmit')}
      </p>
    );
  }

  return (
    <div className="space-y-5" data-testid="ticino-receipt">
      <div className="space-y-3">
        <p className="text-sm text-foreground/70">{t('swiss.receipt.body')}</p>
        {day.receiptCount > 0 ? (
          <p className="text-sm font-medium" data-testid="ticino-receipt-count">
            {t('swiss.receipt.have', { count: day.receiptCount })}
          </p>
        ) : null}
        <DocumentUpload
          testId="ticino-receipt-police"
          fileLabel={t('swiss.receipt.file')}
          buttonLabel={t('swiss.receipt.upload')}
          busy={busy}
          onUpload={(file) => onRecord('Police', day.reference, file)}
        />
      </div>

      {parentalStays.map((bookingId) => (
        <div key={bookingId} className="space-y-2" data-testid="ticino-receipt-parental">
          <h4 className="text-sm font-semibold">{t('swiss.receipt.parental.title')}</h4>
          <DocumentUpload
            testId={`ticino-receipt-parental-${bookingId}`}
            fileLabel={t('swiss.receipt.parental.file')}
            buttonLabel={t('swiss.receipt.parental.upload')}
            hint={t('swiss.receipt.parental.body')}
            busy={busy}
            onUpload={(file) => onRecord('ParentalAuthorization', `${day.reference}-${bookingId}`, file)}
          />
        </div>
      ))}

      {groups.map((group, index) => (
        <div key={`${group.bookingId}-${index}`} className="space-y-2" data-testid="ticino-receipt-group">
          <h4 className="text-sm font-semibold">{t('swiss.receipt.group.title', { name: group.guestName })}</h4>
          <DocumentUpload
            testId={`ticino-receipt-group-${group.bookingId}`}
            fileLabel={t('swiss.receipt.group.file')}
            buttonLabel={t('swiss.receipt.group.upload')}
            hint={t('swiss.receipt.group.body')}
            busy={busy}
            onUpload={(file) => onRecord('GroupSheet', `${day.reference}-${group.bookingId}`, file)}
          />
        </div>
      ))}
    </div>
  );
}
