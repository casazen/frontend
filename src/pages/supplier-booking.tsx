import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarX } from 'lucide-react';
import { ShowcaseBookingGate } from '@/components/supplier-site/booking-gate';
import { BookingWizard } from '@/components/supplier-site/booking/booking-wizard';
import { useSupplierSite } from '@/components/supplier-site/site-context';
import { supplierSitePaths } from '@/lib/supplier-site/site-paths';
import '@/styles/supplier-site-booking.css';

function BookingsClosed({ slug }: { slug: string }) {
  const { t } = useTranslation();
  return (
    <div className="vz-container" data-testid="supplier-booking-closed">
      <section className="vz-state">
        <span className="vz-state__icon" aria-hidden="true">
          <CalendarX />
        </span>
        <h1 tabIndex={-1}>{t('supplierSite.booking.closed.title')}</h1>
        <p>{t('supplierSite.hero.closed')}</p>
        <div className="vz-state__actions">
          <Link className="vz-btn vz-btn--secondary vz-btn--lg" to={supplierSitePaths.services(slug)}>
            {t('supplierSite.hero.seeServices')}
          </Link>
        </div>
      </section>
    </div>
  );
}

export function SupplierBookingPage() {
  const { model } = useSupplierSite();
  return <ShowcaseBookingGate>{model.bookingsOpen ? <BookingWizard /> : <BookingsClosed slug={model.slug} />}</ShowcaseBookingGate>;
}
