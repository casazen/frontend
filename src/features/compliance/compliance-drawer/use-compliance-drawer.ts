import { useMutation } from '@tanstack/react-query';
import { bookingsApi } from '@/api/bookings.api';
import { octorateComplianceHandoffApi } from '@/api/octorate-compliance-handoff.api';
import { withoutRequest } from '@/features/marketplace/activation/use-sequential-run';
import { useFeatureFlags } from '@/hooks/use-feature-flags';
import { useWorkspace } from '@/hooks/use-workspace';
import { UnknownPropertyError, handoffRequestOf, type ComplianceDrawerTarget } from './compliance-drawer-model';

/**
 * Whether the host is offered «Verifica nel tuo Cassetto Compliance»: the same two conditions as the server (the endpoint answers 404 while
 * `Features:OctorateConnector` is off, and asks `booking.read`). The flags fail closed: while they load, or cannot be read, nothing is offered.
 * Without both, the button is not on the page, so nothing is asked and nothing changes.
 */
export function useComplianceDrawerAvailable(): boolean {
  const { flags } = useFeatureFlags();
  const { hasPermission } = useWorkspace();
  return flags.octorateConnector && hasPermission('short-rent', 'booking.read');
}

export interface ComplianceHandoffStart {
  target: ComplianceDrawerTarget;
  returnRoute: { route: string; filters: string };
}

async function propertyOf(target: ComplianceDrawerTarget): Promise<string> {
  if (target.propertyId) return target.propertyId;
  if (!target.bookingId) throw new UnknownPropertyError();
  const booking = await bookingsApi.getById(target.bookingId);
  if (!booking.propertyId) throw new UnknownPropertyError();
  return booking.propertyId;
}

export function useStartComplianceHandoff() {
  return useMutation({
    mutationKey: ['compliance', 'octorate-handoff'],
    mutationFn: async ({ target, returnRoute }: ComplianceHandoffStart) => {
      try {
        const propertyId = await propertyOf(target);
        return await octorateComplianceHandoffApi.start(handoffRequestOf({ ...target, propertyId }, returnRoute));
      } catch (error) {
        throw withoutRequest(error);
      }
    },
    gcTime: 0,
    retry: false,
  });
}
