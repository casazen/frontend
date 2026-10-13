import { Navigate, useParams } from 'react-router-dom';

/**
 * Compat: /book/:orgSlug/:propertySlugOrId → /book/:orgSlug/property/:propertySlugOrId
 * (mobile and older shared links omitted the `/property/` segment).
 */
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
