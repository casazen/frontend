import { CheckCircle2 } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { PlainSection } from '@/components/shared/calm';
import { ErrorState } from '@/components/shared/error-state';
import { Alert } from '@/components/ui/alert';
import { SkeletonLine } from '@/components/ui/skeleton';
import { Fact, Facts } from '@/features/bookings/components/booking-facts';
import type { usePropertyDocuments } from '@/queries/use-properties';
import type { LeaseSummary, Property } from '@/types';
import { PropertyCadastralCard } from '../components/property-cadastral-card';
import { PropertyDocumentsSection } from '../components/property-documents-section';
import { formatPropertyLocation } from '../property-location';
import { LongRentPropertyLeases } from './long-rent-property-leases';

/**
 * The panels of the tabs of the page of a long-term property (LR-07d), each one made of sections without a box. The fourth tab,
 * Interventi, is the list of requests to suppliers that the page already had (`LongRentServiceRequests`).
 */

/** Whether the APE is on file, in a line when it is and in a notice when it is not (the lease cannot be made without it). */
function ApeStatus({ hasApe }: { hasApe: boolean }) {
  const { t } = useTranslation();

  if (!hasApe) {
    return (
      <Alert variant="warning" data-testid="long-rent-ape-status">
        {t('longRentProperties.detail.apeMissing')}
      </Alert>
    );
  }

  return (
    <p role="status" data-testid="long-rent-ape-status" className="flex items-start gap-2 text-sm text-foreground/70">
      <CheckCircle2 aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-success-foreground" />
      <span className="min-w-0 break-words">{t('longRentProperties.detail.apePresent')}</span>
    </p>
  );
}

/**
 * Contratti: the leases of the property, the last started first. Not loaded yet, or failed: nothing here, the note above the tabs
 * says it (a property is never "without contracts" because a list failed).
 */
export function ContractsPanel({ leases }: { leases: readonly LeaseSummary[] | undefined }) {
  const { t } = useTranslation();
  if (!leases) return null;
  if (leases.length === 0) {
    return (
      <p className="text-sm text-foreground/70" data-testid="long-rent-property-leases-empty">
        {t('longRentProperties.detail.contractsEmpty')}
      </p>
    );
  }
  return <LongRentPropertyLeases leases={leases} />;
}

/** Documenti: whether the APE is there and the documents of the property, with the upload that opens on the APE. */
export function DocumentsPanel({ propertyId, documents }: { propertyId: string; documents: ReturnType<typeof usePropertyDocuments> }) {
  const { t } = useTranslation();

  if (documents.isLoading) return <SkeletonLine lines={3} label={t('longRentProperties.detail.documentsLoading')} />;
  if (documents.isError || !documents.data) {
    return (
      <ErrorState
        testId="long-rent-documents-load-error"
        title={t('longRentProperties.detail.documentsLoadError')}
        error={documents.error}
        onRetry={() => void documents.refetch()}
      />
    );
  }

  const hasApe = documents.data.some((doc) => doc.documentType === 'Ape');
  return (
    <div className="space-y-3">
      <ApeStatus hasApe={hasApe} />
      <PropertyDocumentsSection plain propertyId={propertyId} documents={documents.data} defaultUploadType="Ape" />
    </div>
  );
}

/** Dati: where the property is and how big, and the cadastral identification the contract prints. */
export function DataPanel({ property }: { property: Property }) {
  const { t } = useTranslation();

  return (
    <PlainSection title={t('longRentProperties.detail.infoTitle')}>
      <div className="space-y-6">
        <Facts>
          <Fact label={t('longRentProperties.detail.address')}>{formatPropertyLocation(property)}</Fact>
          <Fact label={t('longRentProperties.detail.rooms')}>
            {[t('property.table.bedroomsCount', { count: property.bedrooms }), t('property.table.bathroomsCount', { count: property.bathrooms })].join(' · ')}
          </Fact>
          {property.description ? <Fact label={t('longRentProperties.detail.description')}>{property.description}</Fact> : null}
        </Facts>
        <PropertyCadastralCard key={property.updatedAt} property={property} />
      </div>
    </PlainSection>
  );
}
