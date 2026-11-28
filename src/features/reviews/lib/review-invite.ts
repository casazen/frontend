import type { ReviewInviteStatus } from '@/types';

export type ReviewInviteView = 'reviewed' | 'sent' | 'canInvite' | 'blocked';

export function reviewInviteViewOf(status: ReviewInviteStatus | undefined): ReviewInviteView | null {
  if (!status) return null;
  if (status.reviewed) return 'reviewed';
  if (status.inviteSentAt) return 'sent';
  if (status.canInvite) return 'canInvite';
  return status.reason === 'window_closed' || status.reason === 'no_guest_address' ? 'blocked' : null;
}
