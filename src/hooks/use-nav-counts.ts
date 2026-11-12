import type { NavCountKey, RouteManifestEntry } from '@/config/route-manifest';
import { useComplianceFineCount } from '@/features/compliance/use-compliance';
import { useActivityCount } from '@/queries/internalActivities';
import { totalUnread, useMessageHubUnread } from '@/queries/use-message-hub';
import { useBookingApprovalRequests } from '@/queries/use-bookings';
import { useSupplierInboxCounts } from '@/queries/supplier/use-inbox';

export type NavCounts = Partial<Record<NavCountKey, number>>;

/**
 * The counters of the menu entries (`navCount`, UI-04a), read from queries the app already makes: the "pay at the
 * property" requests waiting for the host (the requests panel of "Prenotazioni"), `toAnswer` of the counters of the
 * supplier's requests (SP-08b): only what still waits for the supplier's answer, never a request that waits for the customer,
 * and the things that carry a risk of a sanction (the cockpit of «Adempimenti»: the Alloggiati Web communications and the guest
 * data they need). It is the number on the chip "Da rispondere" of the list, from the same query. The urgent items of the "To do"
 * list (`GET api/me/activities/count`, ADR-026-R12) are the one counter with a query of its own: the number is worked out by the
 * server, which is also where the scope of the user (HostScope) is applied. The messages of the guests not read yet (the tab «Messaggi»
 * of Prenotazioni, NF-61) are the other one: `GET api/messages/unread?includeOta=true`, counters only, kept fresh by the hub.
 *
 * A query runs only when the menu has the entry that shows it, and shares its cache with the page of that entry. While it
 * loads, or when it fails, the entry has no counter: a counter is a hint and never blocks or reports an error.
 */
export function useNavCounts(entries: readonly RouteManifestEntry[]): NavCounts {
  const wantsBookingRequests = entries.some((entry) => entry.navCount === 'bookingRequests');
  const wantsSupplierRequests = entries.some((entry) => entry.navCount === 'supplierRequests');
  const wantsCompliance = entries.some((entry) => entry.navCount === 'compliance');
  const wantsActivities = entries.some((entry) => entry.navCount === 'activities');
  const wantsMessages = entries.some((entry) => entry.navCount === 'messages');

  const bookingRequests = useBookingApprovalRequests({ enabled: wantsBookingRequests });
  const supplierCounts = useSupplierInboxCounts({ enabled: wantsSupplierRequests, refetchOnMount: true });
  const complianceFines = useComplianceFineCount(wantsCompliance);
  const activityCount = useActivityCount({ enabled: wantsActivities });
  const unreadMessages = useMessageHubUnread(wantsMessages);

  const counts: NavCounts = {};
  // The shape is checked: a server or a proxy that answers something else than the API (an HTML page) is not a number.
  if (wantsBookingRequests && Array.isArray(bookingRequests.data)) {
    counts.bookingRequests = bookingRequests.data.length;
  }
  const toAnswer = supplierCounts.data?.toAnswer;
  if (wantsSupplierRequests && typeof toAnswer === 'number') {
    counts.supplierRequests = toAnswer;
  }
  if (wantsCompliance && typeof complianceFines === 'number') {
    counts.compliance = complianceFines;
  }
  const urgentActivities = activityCount.data?.count;
  if (wantsActivities && typeof urgentActivities === 'number') {
    counts.activities = urgentActivities;
  }
  const unreadCount = totalUnread(unreadMessages.data);
  if (wantsMessages && typeof unreadCount === 'number') {
    counts.messages = unreadCount;
  }
  return counts;
}
