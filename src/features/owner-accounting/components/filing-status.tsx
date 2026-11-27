import { useTranslation } from 'react-i18next';
import { Badge, type BadgeProps } from '@/components/ui/badge';
import { filingLabelOf, type FilingEvidence, type FilingLabel } from '../owner-accounting-model';

const VARIANTS: Record<FilingLabel, NonNullable<BadgeProps['variant']>> = {
  calculated: 'outline',
  generated: 'secondary',
  reviewed: 'secondary',
  submitted: 'warning',
  submittedWithoutProof: 'destructive',
  accepted: 'success',
  acceptedWithoutProof: 'destructive',
  rejected: 'destructive',
};

interface FilingStatusProps {
  /** The tax file; `null` for obligations that are only calculated (no file yet). */
  file: FilingEvidence | null;
}

/**
 * Where a tax file is, in the word the proof allows (E06/F05/US02/T04, AC-NF110-4, AC-NF110-5): calculated, generated, reviewed, submitted,
 * accepted or rejected, with the evidence the person recorded (the handoff, the receipt, the reason). A file that was only generated is never
 * called «inviato», and a state the server sent without its proof says that the proof is missing instead of taking the word.
 */
export function FilingStatus({ file }: FilingStatusProps) {
  const { t } = useTranslation();
  const label = filingLabelOf(file);

  return (
    <div className="min-w-0 space-y-1 text-sm" data-testid="filing-status" data-label={label}>
      <Badge variant={VARIANTS[label]}>{t(`ownerAccounting.filing.label.${label}`)}</Badge>
      {label === 'submitted' || label === 'accepted' ? (
        <p className="break-words text-foreground/70" data-testid="filing-handoff">
          {t('ownerAccounting.filing.handoff', { reference: file?.handoffReference ?? '' })}
        </p>
      ) : null}
      {label === 'accepted' ? (
        <p className="break-words text-foreground/70" data-testid="filing-receipt">
          {t('ownerAccounting.filing.receipt', { reference: file?.receiptReference ?? '' })}
        </p>
      ) : null}
      {label === 'rejected' ? (
        <p className="break-words text-foreground/70" data-testid="filing-rejection">
          {t('ownerAccounting.filing.rejection', { reason: file?.rejectionReason ?? '' })}
        </p>
      ) : null}
      {label === 'submittedWithoutProof' || label === 'acceptedWithoutProof' ? (
        <p className="break-words text-foreground/70" data-testid="filing-missing-proof">
          {t('ownerAccounting.filing.missingProof')}
        </p>
      ) : null}
    </div>
  );
}
