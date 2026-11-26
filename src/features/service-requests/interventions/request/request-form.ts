import { useMemo } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { orderStaysForRequest } from '@/features/service-requests/lib/stays';
import type { Booking } from '@/types';
import { todayInRome } from '@/lib/stay-dates';
import { usePropertyBookings } from '@/queries/use-bookings';
import type { RequestValues } from './request-model';

/** What the steps of the wizard share: how a step changes the answers of the ones that depend on it, and the stays of the property. */

export type SetValue = UseFormSetValue<RequestValues>;

/** The fields that describe the service chosen, empty: nothing chosen. */
export const NO_SERVICE: Partial<RequestValues> = {
  serviceId: '',
  serviceName: '',
  serviceMinutes: null,
  serviceEstimateCents: null,
  serviceRequiresQuote: false,
  servicePriceFromCents: null,
  servicePriceUnit: '',
  startTime: '',
};

/** Nothing of the supplier chosen: the supplier and its services depend on the property and on the kind of job, so a change of either one starts it again. */
export const NO_SUPPLIER: Partial<RequestValues> = { ...NO_SERVICE, supplierOrgId: '', supplierName: '' };

export function assign(setValue: SetValue, values: Partial<RequestValues>) {
  (Object.keys(values) as (keyof RequestValues)[]).forEach((name) => {
    setValue(name, values[name] as never, { shouldDirty: true });
  });
}

/** The stays a request can be linked to: those not over yet (check-out today or later), soonest first. */
export function useUpcomingStays(propertyId: string, linkedStay?: Booking) {
  const bookings = usePropertyBookings(propertyId || undefined);
  const today = todayInRome();
  const stays = useMemo(() => {
    const upcoming = orderStaysForRequest(bookings.data ?? [], today).filter((stay) => stayDateOf(stay.checkOutDate) >= today);
    // A request opened from a specific stay can also refer to a recent departure or a booking beyond the first page.
    if (linkedStay && linkedStay.propertyId === propertyId && linkedStay.status !== 'Cancelled' && !upcoming.some((stay) => stay.id === linkedStay.id)) {
      return [linkedStay, ...upcoming];
    }
    return upcoming;
  }, [bookings.data, today, linkedStay, propertyId]);
  return { stays, all: bookings.data };
}
