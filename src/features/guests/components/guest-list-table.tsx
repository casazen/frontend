import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { DataView, type DataColumn } from '@/components/ui/data-view';
import { formatDate } from '@/lib/utils';
import type { GuestSummary } from '@/types';

interface GuestListTableProps {
  guests: GuestSummary[];
}

const guestPath = (guest: GuestSummary) => `/app/short-rent/guests/${guest.id}`;

/**
 * The guests of the list (UI-07: the pilot of `DataView`): a table with room for it, a list of cards on a phone, where the
 * old table scrolled sideways. Cards until `xl`: with the sidebar open (from `lg`) the table of five columns is not seen whole
 * under 1280 px. The server pages and searches the list, so the columns are not sortable here (sorting the 20 rows of one
 * page would be sorting a fragment).
 */
export function GuestListTable({ guests }: GuestListTableProps) {
  const { t } = useTranslation();

  const columns: DataColumn<GuestSummary>[] = [
    { key: 'name', header: t('guests.anagrafica'), rowHeader: true, cell: (guest) => `${guest.firstName} ${guest.lastName}` },
    { key: 'email', header: t('guests.email'), cell: (guest) => guest.email },
    { key: 'city', header: t('guests.city'), cell: (guest) => guest.city || '—' },
    { key: 'createdAt', header: t('guests.createdAt'), cell: (guest) => formatDate(guest.createdAt) },
  ];

  return (
    <DataView
      label={t('guests.title')}
      rows={guests}
      columns={columns}
      rowKey={(guest) => guest.id}
      testId="guest-list"
      cardsUntil="xl"
      rowActions={(guest) => (
        <Link to={guestPath(guest)} className="text-primary hover:underline text-sm font-medium">
          {t('guests.viewDetails')}
        </Link>
      )}
      renderCard={(guest) => (
        // The whole card is the link to the guest: a finger needs no small "details" link.
        <Link
          to={guestPath(guest)}
          className="block min-w-0 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="block break-words font-semibold">
            {guest.firstName} {guest.lastName}
          </span>
          <span className="block break-words text-sm text-foreground/70">{guest.email}</span>
          <span className="mt-1 block break-words text-sm text-foreground/70">
            {[guest.city, formatDate(guest.createdAt)].filter(Boolean).join(' · ')}
          </span>
        </Link>
      )}
    />
  );
}
