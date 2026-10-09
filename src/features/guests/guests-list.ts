import { useMemo } from 'react';
import { Users } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { defineList } from '@/components/shared/list-view/define-list';
import { formatDate } from '@/lib/utils';
import type { GuestSummary } from '@/types';

/** The guest's page: the row opens it, from the name and from the action. */
const guestPath = (guest: GuestSummary) => `/app/short-rent/guests/${guest.id}`;
const fullName = (guest: GuestSummary) => `${guest.firstName} ${guest.lastName}`.trim();

/**
 * The list of guests (UI-14, the pilot of the unified list) in the words of the person. A server pages it and searches it
 * (`GET /api/guests?search=&page=`), so the list is used in `server` mode and has no column to sort by (sorting the 20 rows of
 * a page would sort a fragment).
 *
 * The columns of the design (docs, section 8) are guest, last stay, stays, documents and marketing. The summary the API gives
 * for the list (`GuestSummaryDto`) holds the name, e-mail, phone, city, country and the day the guest was created, and on
 * purpose "never documents or consent data": there is no last stay, no count of stays, no documents and no marketing consent
 * to show, and none of them is made up. They come, as columns, the day the API sends them (a last stay and a count of stays
 * from the bookings, documents from the check-in, consent from the GDPR record); the list is ready for them: a column more
 * here, a `chip` for "in casa ora" or "con consenso".
 */
export function useGuestsList() {
  const { t } = useTranslation();

  return useMemo(
    () =>
      defineList<GuestSummary>({
        key: 'guests',
        title: t('guests.title'),
        rowKey: (guest) => guest.id,
        rowLabel: fullName,
        columns: [
          { id: 'name', label: t('guests.anagrafica'), default: true, always: true, rowHeader: true, priority: 1, render: fullName },
          { id: 'email', label: t('guests.email'), default: true, priority: 2, render: (guest) => guest.email },
          { id: 'city', label: t('guests.city'), default: true, priority: 3, render: (guest) => guest.city || '—', csv: (guest) => guest.city },
          { id: 'createdAt', label: t('guests.createdAt'), default: true, priority: 4, render: (guest) => formatDate(guest.createdAt) },
          { id: 'phone', label: t('guests.phone'), render: (guest) => guest.phoneNumber || '—', csv: (guest) => guest.phoneNumber },
          { id: 'country', label: t('guests.country'), render: (guest) => guest.country || '—', csv: (guest) => guest.country },
        ],
        search: { label: t('guests.search'), placeholder: t('guests.search') },
        primaryAction: (guest) => ({ id: 'details', label: t('guests.viewDetails'), href: guestPath(guest) }),
        rowHref: guestPath,
        bulk: ['export'],
        // With the sidebar open (from `lg`) the table of five columns is not seen whole under 1280 px: cards until then.
        cardsUntil: 'xl',
        csv: { fileName: 'ospiti' },
        empty: { icon: Users, title: t('guests.title'), description: t('guests.empty') },
      }),
    [t],
  );
}
