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

/** What starts a handoff: what the button is about, and the page and filters the host comes from (the route to come back to). */
export interface ComplianceHandoffStart {
  target: ComplianceDrawerTarget;
  returnRoute: { route: string; filters: string };
}

/**
 * The property the server is asked about. The row says it when it knows it; the item of a stay in the summary names only the booking, so the
 * property is read from the booking (`GET bookings/:id`: the same `booking.read` the handoff asks, and the same reach of the caller's scope: a booking
 * that is not theirs answers 404). Only the property is kept of that answer: no guest, no amount.
 */
async function propertyOf(target: ComplianceDrawerTarget): Promise<string> {
  if (target.propertyId) return target.propertyId;
  if (!target.bookingId) throw new UnknownPropertyError();
  const booking = await bookingsApi.getById(target.bookingId);
  if (!booking.propertyId) throw new UnknownPropertyError();
  return booking.propertyId;
}

/**
 * Prepares the handoff (one request per click: the server writes one line in the activity log; a stay whose property the row does not say is read
 * first, and the button stays busy through both). The request holds the property, the stay and the route the host comes from, and the answer holds
 * the address to open: neither stays once nobody watches the mutation (`gcTime: 0`), and what it keeps of a failure, of the reading of the booking
 * or of the handoff, is the failure without its request (`withoutRequest`): the status and the body of the answer, not the route. It is not a query,
 * so nothing reads it again by itself, and it changes no list: starting a handoff creates no proof and changes no light.
 */
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
