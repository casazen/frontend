import { ApiClient } from './client';
import type { GuestNotificationOverride, GuestRegistration, UpdateGuestRegistrationRequest } from '@/types/guest-registration.types';

const guestRegistrationPath = (propertyId: string) => `/properties/${encodeURIComponent(propertyId)}/guest-registration`;

export const guestRegistrationApi = {
  get: (propertyId: string) => ApiClient.get<GuestRegistration>(guestRegistrationPath(propertyId)),

  setOverride: (propertyId: string, override: GuestNotificationOverride | null) => {
    const body: UpdateGuestRegistrationRequest = { override };
    return ApiClient.put<GuestRegistration>(guestRegistrationPath(propertyId), body);
  },
};
