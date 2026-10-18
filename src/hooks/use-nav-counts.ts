import type { NavCountKey, RouteManifestEntry } from '@/config/route-manifest';
import { useBookingApprovalRequests } from '@/queries/use-bookings';
import { useSupplierKpis } from '@/queries/use-supplier';

export type NavCounts = Partial<Record<NavCountKey, number>>;

/**
 * The counters of the menu entries (`navCount`, UI-04a), read from queries the app already makes: the "pay at the
 * property" requests waiting for the host (the requests panel of "Prenotazioni") and `awaitingAcceptance` of the KPIs
 * of the supplier dashboard (current month; the number does not depend on the period). No new API.
 *
 * A query runs only when the menu has the entry that shows it, and shares its cache with the page of that entry. While it
 * loads, or when it fails, the entry has no counter: a counter is a hint and never blocks or reports an error.
 */
export function useNavCounts(entries: readonly RouteManifestEntry[]): NavCounts {
  const wantsBookingRequests = entries.some((entry) => entry.navCount === 'bookingRequests');
  const wantsSupplierRequests = entries.some((entry) => entry.navCount === 'supplierRequests');

  const bookingRequests = useBookingApprovalRequests({ enabled: wantsBookingRequests });
  const supplierKpis = useSupplierKpis('CurrentMonth', { enabled: wantsSupplierRequests });

  const counts: NavCounts = {};
  // The shape is checked: a server or a proxy that answers something else than the API (an HTML page) is not a number.
  if (wantsBookingRequests && Array.isArray(bookingRequests.data)) {
    counts.bookingRequests = bookingRequests.data.length;
  }
  const awaitingAcceptance = supplierKpis.data?.awaitingAcceptance;
  if (wantsSupplierRequests && typeof awaitingAcceptance === 'number') {
    counts.supplierRequests = awaitingAcceptance;
  }
  return counts;
}
