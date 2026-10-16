/**
 * Values of `?tab=` on the booking page. The page has three tabs: Soggiorno (`details`), Documenti (`guest`: the online check-in
 * and Alloggiati Web) and Pagamento (`payment`). The values stay what they were, because emails and links point at them.
 * `alloggiati` was the fourth tab of the old page; the links of the arrival, of the cockpit and of the emails still use it
 * (CO-08, CO-04), and it opens Documenti, scrolled to the Alloggiati Web section.
 */
export const BOOKING_TABS = ['details', 'guest', 'payment', 'alloggiati'] as const;
export type BookingTab = (typeof BOOKING_TABS)[number];

/** The tabs the page shows. */
export type BookingPanel = Exclude<BookingTab, 'alloggiati'>;

/** The tab a `?tab=` opens: an old or unknown value opens the first one, `alloggiati` opens Documenti. */
export function bookingPanelOf(value: string | null): BookingPanel {
  if (value === 'alloggiati') return 'guest';
  return value === 'guest' || value === 'payment' ? value : 'details';
}
