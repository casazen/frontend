import { useLocation } from 'react-router-dom';
import { PublicOrgNotFoundPage } from '@/features/public-booking/public-org-not-found-page';
import { NotFoundPage } from '@/pages/not-found-page';

export function CatchAllRedirect() {
  const { pathname } = useLocation();
  if (pathname === '/book' || pathname.startsWith('/book/')) {
    return <PublicOrgNotFoundPage />;
  }
  return <NotFoundPage />;
}
