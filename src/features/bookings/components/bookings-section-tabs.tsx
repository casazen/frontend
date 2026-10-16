import { useContext } from 'react';
import { useTranslation } from 'react-i18next';
import { RouteTabs, type RouteTabItem } from '@/components/ui/route-tabs';
import { WorkspaceContext } from '@/contexts/workspace-context';
import { BOOKINGS_PATH } from '../lib/booking-list-query';

/**
 * The three views of one piece of information under one entry of the menu: Prenotazioni, Ospiti and Pagamenti, each its own
 * page (SR-04). A tab is there only for who may open its page (the manifest asks for `booking.read` for the guests and
 * `payment.read` for the payments: the collaborator has no Pagamenti). Outside the workspace (a page drawn on its own) all
 * three are shown.
 */
export function BookingsSectionTabs() {
  const { t } = useTranslation();
  const workspace = useContext(WorkspaceContext);
  const may = (permission: string) => workspace?.hasPermission('short-rent', permission) ?? true;

  const items: RouteTabItem[] = [
    { label: t('booking.sections.bookings'), href: BOOKINGS_PATH, testId: 'bookings-section-bookings' },
    ...(may('booking.read') ? [{ label: t('booking.sections.guests'), href: '/app/short-rent/guests', testId: 'bookings-section-guests' }] : []),
    ...(may('payment.read') ? [{ label: t('booking.sections.payments'), href: '/app/short-rent/payments', testId: 'bookings-section-payments' }] : []),
  ];

  return <RouteTabs label={t('booking.sections.label')} items={items} selectTestId="bookings-section-select" />;
}
