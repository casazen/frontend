import { ApiClient } from './client';
import type { BookingFlowSettings, UpdateBookingFlowSettingsRequest } from '@/types/booking-flow.types';

/**
 * The steps of the stays of the caller's organization (casazen/backend#978), no organization in the route. Whoever reads the bookings reads them (the booking page says what
 * CasaZen will do by itself); only the organization administrator changes them (`OrgBillingAdmin`, 403 otherwise). The read keeps a 403 on the page that asked it
 * (`localAuthRecovery`): a booking page never turns into «no access» because of it.
 */
export const bookingFlowSettingsApi = {
  get: () => ApiClient.get<BookingFlowSettings>('/settings/booking-flow', undefined, { localAuthRecovery: true }),

  update: (request: UpdateBookingFlowSettingsRequest) => ApiClient.put<BookingFlowSettings>('/settings/booking-flow', request),
};
