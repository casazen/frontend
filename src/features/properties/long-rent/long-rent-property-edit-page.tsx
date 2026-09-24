import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { PageHeader } from '@/components/layout/page-header';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { useProperty, useUpdateProperty } from '@/queries/use-properties';
import { PropertyForm } from '../components/property-form';
import type { CreatePropertyDto } from '@/types';
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
    } catch {
      // The mutation's toast shows the server's reason; the form stays filled in.
    }
  };

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

  return (
    <div className="mx-auto max-w-4xl space-y-6">
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
