import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { isFeatureEnabled } from '@/config/feature-flags';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import { useSupplierSite } from './site-context';

/**
 * The pages of the booking (`/prenota`, `/conferma`, `/richiesta`) exist only while the booking from the public sites is on
 * (`supplierShowcaseBooking`, which also is what makes the API give the list of services): with it off their addresses lead back to
 * the home of the site, like the other pages that need the list. While the flags load nothing is decided yet.
 */
export function ShowcaseBookingGate({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const { model } = useSupplierSite();
  const { flags, isLoading } = useFeatureFlags();

  if (isLoading) {
    return (
      <div className="vz-container vz-loading" role="status" aria-busy="true" data-testid="supplier-booking-loading">
        <span className="sr-only">{t('supplierShowcase.loading')}</span>
        <div aria-hidden="true">
          <span className="vz-skel vz-skel-line vz-skel-line--title" />
          <span className="vz-skel vz-skel-hero" />
        </div>
      </div>
    );
  }
  if (!isFeatureEnabled(flags, 'supplierShowcaseBooking') || model.services === null) {
    return <Navigate to={supplierSitePaths.home(model.slug)} replace />;
  }
  return <>{children}</>;
}
