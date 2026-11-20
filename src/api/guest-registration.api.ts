import { ApiClient } from './client';
import type { GuestNotificationOverride, GuestRegistration, UpdateGuestRegistrationRequest } from '@/types/guest-registration.types';

const guestRegistrationPath = (propertyId: string) => `/properties/${encodeURIComponent(propertyId)}/guest-registration`;

/**
 * The regime of the registration of the guests of a property and the host's setting (E29/F02/US01/T01, NF-125). Both calls are behind the flag
 * `Features:GuestRegistrationRegimes` (404 `not_found` while it is off) and ask what the property settings ask: `property.read` for the card, `property.write`
 * for the setting. Another org's property is a 404 `property_not_found`, a property the caller does not reach a 403.
 */
export const guestRegistrationApi = {
  /**
   * The card of a property. 422 `guest_registration_country_not_supported` when the catalog has no regime for the country of the property (neither Italy nor
   * Switzerland).
   */
  get: (propertyId: string) => ApiClient.get<GuestRegistration>(guestRegistrationPath(propertyId)),

  /**
   * Saves the host's setting: `Required`, `NotRequired`, or `null` to follow the regime again (reversible, never blocking). The member is always sent: a body
   * without it is a 400. Answers the card as it is after the change. 422 `guest_registration_override_not_applicable` for a property outside Switzerland.
   */
  setOverride: (propertyId: string, override: GuestNotificationOverride | null) => {
    const body: UpdateGuestRegistrationRequest = { override };
    return ApiClient.put<GuestRegistration>(guestRegistrationPath(propertyId), body);
  },
};
