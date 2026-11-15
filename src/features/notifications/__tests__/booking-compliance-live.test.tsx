import { describe, expect, it, vi } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import { COMPLIANCE_ARCHIVE_KEY } from '@/queries/compliance-archive';
import { ALLOGGIATI_KEY } from '@/queries/use-alloggiati';
import { applyNotificationsChange, refreshAfterGap } from '../use-notifications-realtime';

/** The keys a change makes stale, as the cache is asked to read them again. */
function invalidatedBy(change: () => void, queryClient: QueryClient): unknown[][] {
  const invalidate = vi.spyOn(queryClient, 'invalidateQueries');
  change();
  return invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown[] }).queryKey);
}

// E20/F01/US02: the section of the stay on the booking page (the proofs, the send log and where its guests stand on the channel manager) shows what happens without a reload.
describe('the section of a stay on the booking page, live', () => {
  it('applyNotificationsChange_GuestCheckInCompleted_ReadsAgainTheSectionOfTheStayNotTheListOrTheFilesOfTheArchive', () => {
    const queryClient = new QueryClient();
    const keys = invalidatedBy(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'guest-checkin-completed', entityId: 'b-1' }), queryClient);

    // The guests of the stay go to the channel manager after their check-in: the Alloggiati status and the block of the stay are read again.
    expect(keys).toContainEqual([ALLOGGIATI_KEY]);
    expect(keys).toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'booking']);
    expect(keys).not.toContainEqual([COMPLIANCE_ARCHIVE_KEY]);
    expect(keys).not.toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'list']);
  });

  it.each(['alloggiati-failed', 'receipt-missing', 'alloggiati-overdue', 'guest-data-missing'])(
    'applyNotificationsChange_ComplianceAlert_%s_ReadsAgainTheStatusAndTheSectionOfTheStay',
    (type) => {
      const queryClient = new QueryClient();
      const keys = invalidatedBy(() => applyNotificationsChange(queryClient, { unreadCount: 1, type, entityId: 'b-1' }), queryClient);

      // A write to the channel manager that failed, or a receipt that did not come, is on the open page of the stay at once.
      expect(keys).toContainEqual([ALLOGGIATI_KEY, 'status']);
      expect(keys).toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'booking']);
      expect(keys).not.toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'list']);
    },
  );

  it('refreshAfterGap_EventsMissedWhileTheChannelWasDown_ReadAgainTheSectionOfTheStayToo', () => {
    const queryClient = new QueryClient();
    const keys = invalidatedBy(() => refreshAfterGap(queryClient), queryClient);

    expect(keys).toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'booking']);
  });

  it('applyNotificationsChange_AnEventThatIsNotAboutTheStay_LeavesItsSectionAlone', () => {
    const queryClient = new QueryClient();
    const keys = invalidatedBy(() => applyNotificationsChange(queryClient, { unreadCount: 1, type: 'guest-message', entityId: 'b-1' }), queryClient);

    expect(keys).not.toContainEqual([COMPLIANCE_ARCHIVE_KEY, 'booking']);
  });
});
