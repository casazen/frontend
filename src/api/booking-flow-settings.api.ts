import { ApiClient } from './client';
import type { BookingFlowSettings, UpdateBookingFlowSettingsRequest } from '@/types/booking-flow.types';

/**
 * The steps of the stays of the caller's organization (casazen/backend#978), no organization in the route. Whoever reads the bookings reads them (the booking page says what
 * CasaZen will do by itself); only the organization administrator changes them (`OrgBillingAdmin`, 403 otherwise). The read keeps a 403 on the page that asked it
 * (`localAuthRecovery`): a booking page never turns into «no access» because of it.
 */
export const bookingFlowSettingsApi = {
  /** The settings in force: the row of the organization, or the defaults (`isDefault`, every step automatic) while it has none. */
  get: () => ApiClient.get<BookingFlowSettings>('/settings/booking-flow', undefined, { localAuthRecovery: true }),

  /** Saves the settings: days 0 to `maxCheckInLinkDaysBefore`, or 422 `booking_flow_days_out_of_range` and nothing is saved. */
  update: (request: UpdateBookingFlowSettingsRequest) => ApiClient.put<BookingFlowSettings>('/settings/booking-flow', request),
};
