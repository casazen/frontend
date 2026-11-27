import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { useCommercialRouteAccess } from '@/hooks/use-commercial-profile';
import { LONG_RENT_REQUESTS_PATH } from '../long-rent/paths';
import { useTranslation } from 'react-i18next';
import { useWorkspace } from '@/hooks/use-workspace';
import { useLongRentServiceRequests } from '@/queries/use-service-requests';
import { ServiceRequestForm } from './service-request-form';
import { ServiceRequestsCard } from './service-requests-card';

/**
 * Supplier requests of a long-term property (D2): for the property, never a booking, through the long-rent endpoints
 * (`/long-rent/service-requests`). The request button needs `property.write` in long-rent.
 */
export function LongRentServiceRequests({ propertyId }: { propertyId: string }) {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const requests = useLongRentServiceRequests(propertyId);
  const canOpenPath = useCommercialRouteAccess();
  const canRequest = hasPermission('long-rent', 'property.write');

  return (
    <ServiceRequestsCard
      plain
      query={requests}
      context="long-rent"
      canManage={canRequest}
      emptyText={t('serviceRequest.emptyForProperty')}
      testId="long-rent-service-requests"
      action={
        <div className="flex flex-wrap gap-2">
          {canOpenPath(LONG_RENT_REQUESTS_PATH) && (
            <Button size="sm" variant="outline" asChild>
              <Link to={LONG_RENT_REQUESTS_PATH}>{t('longRentProperties.detail.viewRequests')}</Link>
            </Button>
          )}
          {canRequest && <ServiceRequestForm propertyId={propertyId} context="long-rent" />}
        </div>
      }
    />
  );
}
