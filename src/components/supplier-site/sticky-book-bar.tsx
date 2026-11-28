import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarCheck } from 'lucide-react';
import { buildBookingPath } from '@/lib/supplier-site/booking-params';
import type { SiteModel } from '@/lib/supplier-site/site-model';
import { cn } from '@/lib/utils';
import { useScrolled } from './use-scrolled';

const AFTER_COVER_PX = 520;

export function StickyBookBar({ model }: { model: SiteModel }) {
  const { t } = useTranslation();
  const visible = useScrolled(AFTER_COVER_PX);
  return (
    <div className={cn('vz-stickybar', visible && 'is-on')} data-testid="supplier-site-stickybar">
      <Link className="vz-btn vz-btn--primary" to={buildBookingPath(model.slug)}>
        <CalendarCheck aria-hidden="true" />
        <span>{t('supplierSite.cta.book')}</span>
      </Link>
    </div>
  );
}
