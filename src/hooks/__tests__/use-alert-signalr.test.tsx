import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { useNotificationsRealtime } from '@/features/notifications/use-notifications-realtime';
import { INTERNAL_ACTIVITIES_KEY } from '@/lib/query-client';
import { PENDING_ALERTS_KEY } from '@/queries/use-alerts';
import type { PendingAlert } from '@/types/alert';
import { useAlertSignalr } from '../use-alert-signalr';

vi.mock('@/features/notifications/use-notifications-realtime', () => ({ useNotificationsRealtime: vi.fn(() => 'connected') }));
vi.mock('@/queries/use-alerts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/queries/use-alerts')>()),
  usePendingAlerts: () => ({ data: [], refetch: vi.fn() }),
  useDismissAlert: () => ({ isPending: false, mutate: vi.fn() }),
  useRemindAlert: () => ({ isPending: false, mutate: vi.fn() }),
}));

describe('useAlertSignalr: what an alert that arrives makes stale', () => {
  let client: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;

  const alert = (alertType: string): PendingAlert => ({ alertId: 'a-1', alertType, entityType: 'Booking', entityId: 'b-1', urgency: 'High' });

  function arrives(alertToSend: PendingAlert) {
    const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    renderHook(() => useAlertSignalr({ userId: 'u1', getAccessToken: async () => 'token' }), { wrapper });
    const options = vi.mocked(useNotificationsRealtime).mock.calls[0][0];
    act(() => options.onAlert?.(alertToSend));
  }

  beforeEach(() => {
    vi.clearAllMocks();
    client = new QueryClient();
    invalidate = vi.spyOn(client, 'invalidateQueries');
  });

  it('useAlertSignalr_BookingNeedsReview_ReadsTheListOfWhatIsToDoAgain', () => {
    arrives(alert('BookingNeedsReview'));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
    expect(invalidate).toHaveBeenCalledWith({ queryKey: PENDING_ALERTS_KEY });
  });

  it('useAlertSignalr_AnyOtherAlert_LeavesTheListOfWhatIsToDoAlone', () => {
    arrives(alert('ChannelSyncError'));

    expect(invalidate).toHaveBeenCalledWith({ queryKey: PENDING_ALERTS_KEY });
    expect(invalidate).not.toHaveBeenCalledWith({ queryKey: [INTERNAL_ACTIVITIES_KEY] });
  });
});
