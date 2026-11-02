import type { NavCountKey, RouteManifestEntry } from '@/config/route-manifest';
import { useComplianceFineCount } from '@/features/compliance/use-compliance';
import { useBookingApprovalRequests } from '@/queries/use-bookings';
import { useSupplierInboxCounts } from '@/queries/supplier/use-inbox';

export type NavCounts = Partial<Record<NavCountKey, number>>;

/**
 * The counters of the menu entries (`navCount`, UI-04a), read from queries the app already makes: the "pay at the
 * property" requests waiting for the host (the requests panel of "Prenotazioni"), `toAnswer` of the counters of the
 * supplier's requests (SP-08b): only what still waits for the supplier's answer, never a request that waits for the customer,
 * and the things that carry a risk of a sanction (the cockpit of «Adempimenti»: the Alloggiati Web communications and the guest
 * data they need). It is the number on the chip "Da rispondere" of the list, from the same query. No new API.
 *
 * A query runs only when the menu has the entry that shows it, and shares its cache with the page of that entry. While it
 * loads, or when it fails, the entry has no counter: a counter is a hint and never blocks or reports an error.
 */
export function useNavCounts(entries: readonly RouteManifestEntry[]): NavCounts {
  const wantsBookingRequests = entries.some((entry) => entry.navCount === 'bookingRequests');
  const wantsSupplierRequests = entries.some((entry) => entry.navCount === 'supplierRequests');
  const wantsCompliance = entries.some((entry) => entry.navCount === 'compliance');

  const bookingRequests = useBookingApprovalRequests({ enabled: wantsBookingRequests });
  const supplierCounts = useSupplierInboxCounts({ enabled: wantsSupplierRequests, refetchOnMount: true });
  const complianceFines = useComplianceFineCount(wantsCompliance);

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
  return counts;
}
