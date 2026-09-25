import { Link, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Plus } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { LoadingScreen } from '@/components/shared/loading-screen';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useProperties } from '@/queries/use-properties';
import { LoadErrorCard } from './load-error-card';
import { LONG_RENT_PROPERTY_CREATE_PATH, longRentPropertyPath } from './paths';

/** Properties of a long-term landlord (A7-06): the list the lease form picks from, with the way to add one. */
export function LongRentPropertiesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: properties, isLoading, isError, error, refetch, isFetching } = useProperties();

  const goToCreate = () => navigate(LONG_RENT_PROPERTY_CREATE_PATH);

  const header = (
    <PageHeader
      title={t('longRentProperties.list.title')}
      description={t('longRentProperties.list.description')}
      action={
        <Button onClick={goToCreate}>
          <Plus className="mr-2 h-4 w-4" />
          {t('longRentProperties.list.add')}
        </Button>
      }
    />
  );

  if (isLoading) {
    return <LoadingScreen message={t('longRentProperties.list.loading')} />;
  }

  if (isError || !properties) {
    return (
      <div className="space-y-6">
        {header}
        <LoadErrorCard
          error={error}
          fallbackKey="longRentProperties.list.loadError"
          onRetry={() => void refetch()}
          retrying={isFetching}
          testId="long-rent-properties-load-error"
        />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {header}

      {properties.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('longRentProperties.list.emptyTitle')}
          description={t('longRentProperties.list.emptyDescription')}
          action={{ label: t('longRentProperties.list.add'), onClick: goToCreate }}
        />
      ) : (
        <div className="grid gap-4" data-testid="long-rent-properties-list">
          {properties.map((property) => (
            <Card key={property.id}>
              <CardContent className="flex flex-wrap items-center justify-between gap-3 py-4">
                <div className="min-w-0">
                  <p className="font-medium truncate">{property.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[property.address, property.postalCode, property.city].filter(Boolean).join(', ')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t('longRentProperties.roomsValue', { bedrooms: property.bedrooms, bathrooms: property.bathrooms })}
                  </p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link to={longRentPropertyPath(property.id)}>{t('longRentProperties.list.open')}</Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
