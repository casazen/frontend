/** Tabs of the booking detail, opened from the URL (`?tab=`): links from the arrival and the cockpit (CO-08, CO-04). */
export const BOOKING_TABS = ['details', 'guest', 'payment', 'alloggiati'] as const;
export type BookingTab = (typeof BOOKING_TABS)[number];

export function isBookingTab(value: string | null): value is BookingTab {
  return BOOKING_TABS.includes(value as BookingTab);
}
