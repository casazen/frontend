import { useLocation } from 'react-router-dom';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';
import { NotFoundPage } from '@/pages/not-found-page';

/**
 * Unmatched paths stay public (A8-03): `/book/*` shows the "site not found" page of the booking sites, any other path
 * the public 404. Neither needs Auth0 nor sends the visitor to the login.
 */
export function CatchAllRedirect() {
  const { pathname } = useLocation();
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    return <PublicOrgNotFoundPage />;
  }
  return <NotFoundPage />;
}
