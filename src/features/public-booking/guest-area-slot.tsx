import { Fragment, type ReactNode } from 'react';
import type { GuestBookingDetails, GuestSession } from '@/types';
import { GuestCancellationSection } from './guest-cancellation-section';
import { GuestMarketingSection } from './guest-marketing-section';
import { GuestMessagesSection } from './guest-messages-section';

interface GuestAreaContext {
  session: GuestSession;
  booking: GuestBookingDetails;
}

interface GuestAreaSection {
  id: string;
  render: (context: GuestAreaContext) => ReactNode;
}

const guestAreaSections: readonly GuestAreaSection[] = [
  { id: 'messages', render: ({ session, booking }) => <GuestMessagesSection session={session} booking={booking} /> },
  { id: 'marketing', render: ({ session, booking }) => <GuestMarketingSection session={session} booking={booking} /> },
  { id: 'cancellation', render: ({ session, booking }) => <GuestCancellationSection session={session} booking={booking} /> },
];

export function GuestAreaSlot({ session, booking }: GuestAreaContext) {
  return (
    <>
      {guestAreaSections.map((section) => (
        <Fragment key={section.id}>{section.render({ session, booking })}</Fragment>
      ))}
    </>
  );
}
