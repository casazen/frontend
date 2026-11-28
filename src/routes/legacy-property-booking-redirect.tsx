import { Navigate, useParams } from 'react-router-dom';

export function LegacyPropertyBookingRedirect() {
  const { orgSlug, propertySlugOrId } = useParams<{
    orgSlug: string;
    propertySlugOrId: string;
  }>();

  if (!orgSlug || !propertySlugOrId) {
    return <Navigate to="/search" replace />;
  }

  return <Navigate to={`/book/${orgSlug}/property/${propertySlugOrId}`} replace />;
}
