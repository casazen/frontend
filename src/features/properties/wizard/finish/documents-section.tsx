import { useTranslation } from 'react-i18next';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { StepBlockers } from '@/features/compliance/components/activation-progress';
import { DocumentUploadDialog } from '@/features/properties/components/document-upload-dialog';
import { getPropertyDocumentTypeLabel } from '@/lib/i18n-labels';
import { usePropertyDetail } from '@/queries/use-properties';
import type { ComplianceWizardStep } from '@/types/compliance.types';

interface DocumentsSectionProps {
  propertyId: string;
  /** The `documents` step of the activation: what the region of the property asks for and is still missing. */
  step: ComplianceWizardStep | undefined;
}

/**
 * The documents the region asks for, as the server lists what is still missing (`documents` step of the activation), with the dialog
 * that already exists to upload one and the ones on file. Uploading reads the activation again (the mutation does it).
 */
export function DocumentsSection({ propertyId, step }: DocumentsSectionProps) {
  const { t } = useTranslation();
  const detail = usePropertyDetail(propertyId, { fresh: true });
  const documents = detail.data?.documents ?? [];

  return (
    <section id="property-wizard-section-documents" tabIndex={-1} aria-labelledby="property-wizard-documents-title" className="min-w-0 space-y-3 outline-none">
      <h3 id="property-wizard-documents-title" className="text-base font-semibold">
        {t('propertyWizard.last.documents.title')}
      </h3>
      <p className="text-sm text-foreground/70">{t('compliance.activation.documentsHint')}</p>
      {step ? <StepBlockers step={step} /> : null}
      <DocumentUploadDialog propertyId={propertyId} />
      {detail.isLoading ? (
        <p className="flex items-center gap-2 text-sm text-foreground/70">
          <Loader2 aria-hidden="true" className="size-4 animate-spin" />
          {t('compliance.activation.documentsLoading')}
        </p>
      ) : detail.isError ? (
        <div className="space-y-2" role="alert" data-testid="property-wizard-documents-error">
          <p className="text-sm text-destructive">{t('compliance.activation.documentsLoadFailed')}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void detail.refetch()}>
            {t('compliance.activation.retry')}
          </Button>
        </div>
      ) : documents.length === 0 ? (
        <p className="text-sm text-foreground/70">{t('compliance.activation.documentsEmpty')}</p>
      ) : (
        <ul className="space-y-1 text-sm" data-testid="property-wizard-documents">
          {documents.map((document) => (
            <li key={document.id} className="flex min-w-0 items-center gap-2">
              <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-success-foreground" />
              <span className="font-medium">{getPropertyDocumentTypeLabel(document.documentType, t)}</span>
              <span className="min-w-0 break-words text-foreground/70">{document.fileName}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
