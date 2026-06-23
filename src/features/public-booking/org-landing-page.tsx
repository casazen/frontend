import { useNavigate, useOutletContext, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useOrgProperties } from '@/queries/use-public-org';
import { PropertySearchCard } from '@/features/search/components/property-search-card';
import type { PublicOrgDto, PublicPropertyDto } from '@/types';
import { Loader2 } from 'lucide-react';

interface PublicBookingContext {
  org: PublicOrgDto;
}

export function OrgLandingPage() {
  const { t } = useTranslation();
  const { orgSlug } = useParams<{ orgSlug: string }>();
  const { org } = useOutletContext<PublicBookingContext>();
  const navigate = useNavigate();
  const { data: properties = [], isLoading } = useOrgProperties(orgSlug);

  const handleViewDetails = (property: PublicPropertyDto) => {
    navigate(`/book/${orgSlug}/property/${property.id}`);
  };

  return (
    <div className="space-y-8">
      <section className="space-y-2">
        <h2 className="text-3xl font-bold">{t('publicBooking.welcomeToOrg', { orgName: org.displayName })}</h2>
        <p className="text-muted-foreground">
          {t('publicBooking.welcomeDescription')}
        </p>
      </section>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : properties.length === 0 ? (
        <p className="text-muted-foreground">{t('publicBooking.noPropertiesPublished')}</p>
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <PropertySearchCard key={property.id} property={property} onViewDetails={handleViewDetails} />
          ))}
        </div>
      )}
    </div>
  );
}
