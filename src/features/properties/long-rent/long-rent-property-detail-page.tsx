import { Link, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CheckCircle2, Edit, FilePlus2, TriangleAlert } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useProperty, usePropertyDocuments } from '@/queries/use-properties';
import { PropertyDocumentsSection } from '../components/property-documents-section';
import { PropertyCadastralCard } from '../components/property-cadastral-card';
import { LoadErrorCard } from './load-error-card';
import { longRentPropertyEditPath, newLeaseForPropertyPath } from './paths';

/**
 * A long-term property with its APE (A7-06): the documents live in the private bucket and download through the
 * authenticated API (FD-07). The lease form requires an APE on file.
 */
export function LongRentPropertyDetailPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const { data: property, isLoading, isError, error, refetch, isFetching } = useProperty(id);
  const documents = usePropertyDocuments(id);

  if (isLoading) {
    return <LoadingScreen message={t('longRentProperties.detail.loading')} />;
  }

  if (isError || !property) {
    return (
      <LoadErrorCard
        error={error}
        fallbackKey="longRentProperties.detail.loadError"
        onRetry={() => void refetch()}
        retrying={isFetching}
      />
    );
  }

  const hasApe = documents.data?.some((doc) => doc.documentType === 'Ape') ?? false;

  return (
    <div className="space-y-6">
      <PageHeader
        title={property.name}
        description={property.city}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link to={longRentPropertyEditPath(property.id)}>
                <Edit className="mr-2 h-4 w-4" />
                {t('longRentProperties.detail.edit')}
              </Link>
            </Button>
            <Button asChild>
              <Link to={newLeaseForPropertyPath(property.id)}>
                <FilePlus2 className="mr-2 h-4 w-4" />
                {t('longRentProperties.detail.newLease')}
              </Link>
            </Button>
          </div>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>{t('longRentProperties.detail.infoTitle')}</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <p className="text-muted-foreground">{t('longRentProperties.detail.address')}</p>
            <p className="font-medium">
              {[property.address, property.postalCode, property.city].filter(Boolean).join(', ')}
            </p>
          </div>
          <div>
            <p className="text-muted-foreground">{t('longRentProperties.detail.rooms')}</p>
            <p className="font-medium">
              {t('longRentProperties.roomsValue', { bedrooms: property.bedrooms, bathrooms: property.bathrooms })}
            </p>
          </div>
          {property.description && <p className="text-muted-foreground sm:col-span-2">{property.description}</p>}
        </CardContent>
      </Card>

      <PropertyCadastralCard key={property.updatedAt} property={property} />

      {documents.isLoading ? (
        <LoadingScreen message={t('longRentProperties.detail.documentsLoading')} />
      ) : documents.isError || !documents.data ? (
        <LoadErrorCard
          error={documents.error}
          fallbackKey="longRentProperties.detail.documentsLoadError"
          onRetry={() => void documents.refetch()}
          retrying={documents.isFetching}
          testId="long-rent-documents-load-error"
        />
      ) : (
        <>
          <div
            role="status"
            data-testid="long-rent-ape-status"
            className={`flex gap-2 rounded-md border p-3 text-sm ${
              hasApe ? 'border-green-600/40 bg-green-600/10' : 'border-amber-500/50 bg-amber-500/10'
            }`}
          >
            {hasApe ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-green-700" />
            ) : (
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
            )}
            <span>{t(hasApe ? 'longRentProperties.detail.apePresent' : 'longRentProperties.detail.apeMissing')}</span>
          </div>
          <PropertyDocumentsSection propertyId={property.id} documents={documents.data} defaultUploadType="Ape" />
        </>
      )}
    </div>
  );
}
