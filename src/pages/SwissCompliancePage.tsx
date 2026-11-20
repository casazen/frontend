import { Navigate, useSearchParams } from 'react-router-dom';
import { ticinoLayerPath } from '@/features/compliance/ticino/ticino-layer-address';

/**
 * The old address of the guided notification of the guests of a Ticino property to the cantonal police (`/app/short-rent/compliance/ticino?property=<id>&date=yyyy-MM-dd`,
 * casazen/backend#979): the page it was is gone (E30/F02/US03/T02), absorbed by the layer of the cockpit (`features/compliance/ticino/ticino-notification-layer.tsx`), which has the
 * same steps (guests, file, portal, declaration, receipt) and is opened by the cockpit, the bell and the page of the property. The address stays only so that no link breaks
 * (notifications, e-mails, bookmarks): it opens the cockpit with the layer of that property and day over it (without a day, on the first one to notify), and shows nothing of its own.
 */
export function SwissCompliancePage() {
  const [params] = useSearchParams();
  return <Navigate to={ticinoLayerPath(params.get('property'), params.get('date'))} replace />;
}
