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
  const canRequest = hasPermission('long-rent', 'property.write');

  return (
    <ServiceRequestsCard
      query={requests}
      context="long-rent"
      emptyText={t('serviceRequest.emptyForProperty')}
      testId="long-rent-service-requests"
      action={canRequest ? <ServiceRequestForm propertyId={propertyId} context="long-rent" /> : undefined}
    />
  );
}
