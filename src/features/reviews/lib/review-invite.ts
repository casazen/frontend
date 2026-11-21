import type { ReviewInviteStatus } from '@/types';

/** What the state of the invitation has to say: the guest reviewed, the invitation went, the host may send it, or it cannot be sent and why. */
export type ReviewInviteView = 'reviewed' | 'sent' | 'canInvite' | 'blocked';

/**
 * What the state of the invitation of a booking says (DB-12b), or `null` when there is nothing to say (the state could not be read, or the booking is not reviewable after all): then the
 * section of the reviews of the booking draws nothing for it.
 */
export function reviewInviteViewOf(status: ReviewInviteStatus | undefined): ReviewInviteView | null {
  if (!status) return null;
  if (status.reviewed) return 'reviewed';
  if (status.inviteSentAt) return 'sent';
  if (status.canInvite) return 'canInvite';
  return status.reason === 'window_closed' || status.reason === 'no_guest_address' ? 'blocked' : null;
}
