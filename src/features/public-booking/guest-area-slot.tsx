import { Fragment, type ReactNode } from 'react';
import type { GuestBookingDetails, GuestSession } from '@/types';
import { GuestCancellationSection } from './guest-cancellation-section';
import { GuestMessagesSection } from './guest-messages-section';

/** What a section of the guest area works with: the session (its token goes in `guestSessionHeaders`) and the booking it reads. */
interface GuestAreaContext {
  session: GuestSession;
  booking: GuestBookingDetails;
}

interface GuestAreaSection {
  id: string;
  /** The section for this booking, or `null` when the feature does not apply to it (nothing is shown, not even a placeholder). */
  render: (context: GuestAreaContext) => ReactNode;
}

/**
 * The sections of the guest area that come after the booking on "Le mie prenotazioni" (DB-06c). The messages with the host (DB-14b)
 * are the first: they show only for a confirmed booking that has a thread. The cancellation (DB-08b) comes last, as the least used: the
 * refund the guest would get today and the button to cancel. Reviews and the other features of the area follow the same way, one entry each.
 */
const guestAreaSections: readonly GuestAreaSection[] = [
  { id: 'messages', render: ({ session, booking }) => <GuestMessagesSection session={session} booking={booking} /> },
  { id: 'cancellation', render: ({ session, booking }) => <GuestCancellationSection session={session} booking={booking} /> },
];

/** Renders the sections of the guest area under the booking; with none registered it renders nothing. */
export function GuestAreaSlot({ session, booking }: GuestAreaContext) {
  return (
    <>
      {guestAreaSections.map((section) => (
        <Fragment key={section.id}>{section.render({ session, booking })}</Fragment>
      ))}
    </>
  );
}
