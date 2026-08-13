import { Navigate, useLocation } from 'react-router-dom';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';

/**
 * Unmatched /book/* stays public (no Auth0). Other unknown paths go to workspace entry.
 */
export function CatchAllRedirect() {
  const { pathname } = useLocation();
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    return <PublicOrgNotFoundPage />;
  }
  return <Navigate to="/" replace />;
}
