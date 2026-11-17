import { Navigate, useLocation } from 'react-router-dom';
import { MARKETPLACE_PATH } from './lib/marketplace-paths';

/**
 * The old page of the categories (`…/marketplace/categories`) is Scopri since the categories are its first group: a link or a bookmark
 * to it still opens Scopri.
 */
export function MarketplaceCategoriesRedirect() {
  const { search } = useLocation();
  return <Navigate to={`${MARKETPLACE_PATH}${search}`} replace />;
}
