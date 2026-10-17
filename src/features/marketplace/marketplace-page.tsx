import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Building2, Loader2, MapPin } from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ErrorState } from '@/components/shared/error-state';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import { PROPERTY_CREATE_PATH, propertyEditPath } from '@/features/properties/properties-paths';
import { RequestsSection } from './components/requests-section';
import { SuppliersSection } from './components/suppliers-section';
import { MARKETPLACE_PROPERTY_PARAM, useMarketplaceProperty } from './lib/marketplace-property';

/**
 * Marketplace dei servizi (SR-09a, spec #466): the one page where a host finds the suppliers that work in the comune of a
 * property and asks one of them for a job. The property is in the address (`?propertyId=`), the first active one by default.
 * «Fornitori CasaZen» is the section of the suppliers; the other sections of the marketplace go under it, and «Le tue richieste»
 * closes the page.
 */
export function MarketplacePage() {
  const { t } = useTranslation();
  const [, setSearchParams] = useSearchParams();
  const { properties, property, isLoading, isError, error, refetch } = useMarketplaceProperty();

  const changeProperty = (id: string) =>
    setSearchParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        next.set(MARKETPLACE_PROPERTY_PARAM, id);
        return next;
      },
      { replace: true },
    );

  return (
    <div className="min-w-0 space-y-6" data-testid="marketplace-page">
      <PageHeader title={t('marketplace.title')} description={t('marketplace.description')} />

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
          <Loader2 aria-hidden="true" className="size-5 animate-spin" />
          {t('marketplace.loading')}
        </div>
      ) : isError && !properties ? (
        <ErrorState title={t('marketplace.propertiesLoadError')} error={error} onRetry={() => void refetch()} />
      ) : !property || !properties ? (
        <EmptyState
          icon={Building2}
          title={t('marketplace.noProperties')}
          description={t('marketplace.noPropertiesHint')}
          action={{ label: t('marketplace.addProperty'), href: PROPERTY_CREATE_PATH }}
        />
      ) : (
        <>
          <div className="max-w-md space-y-1.5">
            <Label htmlFor="marketplace-property">{t('marketplace.propertyLabel')}</Label>
            <Select
              id="marketplace-property"
              value={property.id}
              onChange={(event) => changeProperty(event.target.value)}
              data-testid="marketplace-property-select"
            >
              {properties.map((candidate) => (
                <option key={candidate.id} value={candidate.id}>
                  {candidate.name}
                </option>
              ))}
            </Select>
          </div>

          {property.comuneIstatCode ? (
            <SuppliersSection propertyId={property.id} />
          ) : (
            <EmptyState
              icon={MapPin}
              title={t('marketplace.addComune')}
              description={t('marketplace.addComuneHint')}
              action={{ label: t('marketplace.editProperty'), href: propertyEditPath(property.id) }}
              className="py-8"
            />
          )}

          <RequestsSection propertyId={property.id} />
        </>
      )}
    </div>
  );
}
