import { Navigate, useSearchParams } from 'react-router-dom';
import { LONG_RENT_PROPERTIES_PATH, longRentPropertyPath } from '@/features/properties/long-rent/paths';

export function LegacyLeasesRedirect() {
  const [params] = useSearchParams();
  const propertyId = params.get('propertyId');
  return <Navigate replace to={propertyId ? `${longRentPropertyPath(encodeURIComponent(propertyId))}?tab=contracts` : LONG_RENT_PROPERTIES_PATH} />;
}
