import { useMemo, useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { CalendarDays, Plus } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AppShell } from '@/components/layout/app-shell';
import { PageHeader } from '@/components/layout/page-header';
import { EmptyState } from '@/components/shared/empty-state';
import { ListView } from '@/components/shared/list-view/list-view';
import { useListState } from '@/components/shared/list-view/use-list-state';
import { useListViewsScope } from '@/hooks/use-list-views-scope';
import { useWorkspace } from '@/hooks/use-workspace';
import { useApproveBookingRequest, useBookingCounts, useBookingList } from '@/queries/use-bookings';
import { useSendCheckInLink } from '@/queries/use-checkin';
import { useProperties } from '@/queries/use-properties';
import type { BookingListItem, Property } from '@/types';
import { useBookingsList, type BookingRowHandlers } from './bookings-list';
import { BookingsSectionTabs } from './components/bookings-section-tabs';
import { CancelBookingDialog } from './components/cancel-booking-dialog';
import { CheckInDialog } from './components/check-in-dialog';
import { DeclineBookingDialog } from './components/decline-booking-dialog';
import { BOOKINGS_PAGE_SIZE, BOOKINGS_PATH, bookingFilterParams, bookingListParams, currentBookingsSearch } from './lib/booking-list-query';

const NO_PROPERTIES: readonly Property[] = [];

/**
 * The bookings of the host (SR-04): the unified list in `server` mode, with the chips, the filters, the views, the order and the
 * actions of a row (accept, register the arrival or the departure, send the check-in link, decline, cancel). The server does the
 * searching, filtering, ordering and paging, so the state and the search reach every booking and not only the ten of a page. All
 * of it is in the address (`?chip=toConfirm&q=rossi&f_channel=Airbnb&page=2`): Back, a refresh and the way back from a booking
 * give the list as it was left.
 */
function BookingsListPage() {
  const { t } = useTranslation();
  const { hasPermission } = useWorkspace();
  const canWrite = hasPermission('short-rent', 'booking.write');
  const viewsScope = useListViewsScope();

  const properties = useProperties({ mode: 'short' });
  const { mutate: acceptBooking } = useApproveBookingRequest();
  const { mutate: sendCheckInLink } = useSendCheckInLink();
  const [arriving, setArriving] = useState<BookingListItem | null>(null);
  const [declining, setDeclining] = useState<BookingListItem | null>(null);
  const [cancelling, setCancelling] = useState<BookingListItem | null>(null);

  const handlers = useMemo<BookingRowHandlers>(
    () => ({
      accept: (booking) => acceptBooking(booking.id),
      arrival: setArriving,
      decline: setDeclining,
      cancel: setCancelling,
      sendLink: (booking) => sendCheckInLink(booking.id),
    }),
    [acceptBooking, sendCheckInLink],
  );

  const list = useBookingsList({ canWrite, properties: Array.isArray(properties.data) ? properties.data : NO_PROPERTIES, handlers });
  const { state } = useListState(list);
  // The property of an old address (`?propertyId=`) is a choice of the filter: the first request waits until the filter knows it.
  const ready = !properties.isLoading;
  const rows = useBookingList(bookingListParams(state), { enabled: ready });
  const counts = useBookingCounts(bookingFilterParams(state), { enabled: ready });

  // The list cannot tell "no booking at all" from "none in this chip" (it starts from "In arrivo", not from its first chip), and
  // its toolbar goes away with it: the page says it from the counters, which count every chip.
  const narrowed = state.q.trim() !== '' || Object.keys(state.filters).length > 0;
  const nothingAtAll = !narrowed && counts.data?.all === 0 && !counts.isPlaceholderData;
  const { icon: emptyIcon, ...empty } = list.empty;
  // A list narrowed to a property offers a booking for that property (the form takes `?propertyId=`).
  const createPath = state.filters.property
    ? `${BOOKINGS_PATH}/create?propertyId=${encodeURIComponent(state.filters.property)}`
    : `${BOOKINGS_PATH}/create`;

  return (
    <AppShell>
      <div className="space-y-6">
        <PageHeader
          title={t('booking.list.title')}
          description={t('booking.list.description')}
          primary={canWrite ? { label: t('booking.list.newBooking'), icon: Plus, to: createPath, testId: 'new-booking' } : undefined}
          mobilePrimary="fab"
        />

        <BookingsSectionTabs />

        {nothingAtAll ? (
          <div className="rounded-lg border bg-card text-card-foreground shadow-sm" data-testid="bookings-empty">
            <EmptyState icon={emptyIcon ?? CalendarDays} {...empty} />
          </div>
        ) : (
          <ListView
            list={list}
            mode="server"
            rows={rows.data?.items ?? []}
            totalCount={rows.data?.totalCount}
            pageSize={BOOKINGS_PAGE_SIZE}
            chipCounts={{ toConfirm: counts.data?.toConfirm }}
            isLoading={!ready || rows.isLoading}
            isRefreshing={rows.isPlaceholderData}
            isError={rows.isError && !rows.isLoading}
            error={rows.error}
            errorTitle={t('booking.list.loadError')}
            onRetry={() => void rows.refetch()}
            viewsScope={viewsScope}
            testId="bookings-list"
          />
        )}
      </div>

      <CheckInDialog
        booking={arriving}
        open={arriving !== null}
        onOpenChange={(open) => {
          if (!open) setArriving(null);
        }}
      />
      <DeclineBookingDialog
        booking={declining}
        open={declining !== null}
        onOpenChange={(open) => {
          if (!open) setDeclining(null);
        }}
      />
      <CancelBookingDialog
        bookingId={cancelling?.id ?? ''}
        open={cancelling !== null}
        onOpenChange={(open) => {
          if (!open) setCancelling(null);
        }}
      />
    </AppShell>
  );
}

/**
 * `/app/short-rent/bookings`. An address of the list as it was before (`?status=Confirmed`, `?propertyId=…`, which the page of a
 * property still links to) becomes the address of this one (`?chip=upcoming`, `?f_property=…`) and the list opens on it.
 */
export function BookingsPage() {
  const [address] = useSearchParams();
  const current = currentBookingsSearch(address);
  if (current) return <Navigate to={{ search: `?${current}` }} replace />;
  return <BookingsListPage />;
}
