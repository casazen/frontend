import { Fragment, type ReactNode } from 'react';
import type { GuestBookingDetails, GuestSession } from '@/types';

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
 * The sections of the guest area that come after the booking on "Le mie prenotazioni" (DB-06c). It is empty today. The messages with
 * the host (DB-14b) hook in here: one entry, `{ id: 'messages', render: ({ session, booking }) => … }`, shown only when the backend
 * answers the booking with the block of that feature. Reviews and the other features of the area follow the same way.
 */
const guestAreaSections: readonly GuestAreaSection[] = [];

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
