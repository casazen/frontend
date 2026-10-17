import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useProperty, useUpdateProperty } from '@/queries/use-properties';
import { PropertyForm } from '../components/property-form';
import type { CreatePropertyDto } from '@/types';
import { isDuplicateAddressError } from '../property-errors';
import { LoadErrorCard } from './load-error-card';
import { longRentPropertyPath } from './paths';

/** Edit a long-term property without its short-stay fields (A7-06). */
export function LongRentPropertyEditPage() {
  const { t } = useTranslation();
  const { id = '' } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: property, isLoading, isError, error, refetch, isFetching } = useProperty(id);
  const updateProperty = useUpdateProperty();

  const handleSubmit = async (data: CreatePropertyDto) => {
    try {
      await updateProperty.mutateAsync({ id, data });
      navigate(longRentPropertyPath(id));
    } catch (error) {
      // The mutation's toast shows the server's reason; the form stays filled in. A duplicate address goes back to the
      // form, which shows it under the unit field (PC-06).
      if (isDuplicateAddressError(error)) throw error;
    }
  };

  if (isLoading) {
    return <LoadingScreen message={t('longRentProperties.detail.loading')} className="h-auto flex-1" />;
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

  // A short-rent property is edited in the short-rent section only.
  if (property.rentalMode === 'Short') return <Navigate to={`/app/short-rent/properties/${property.id}/edit`} replace />;

  return (
    <div className="space-y-6">
      <PageHeader
        title={t('longRentProperties.edit.title')}
        description={t('longRentProperties.edit.description', { name: property.name })}
      />
      <PropertyForm
        variant="long-rent"
        property={property}
        onSubmit={handleSubmit}
        onCancel={() => navigate(longRentPropertyPath(id))}
        isLoading={updateProperty.isPending}
      />
    </div>
  );
}
