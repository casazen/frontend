import { useMemo } from 'react';
import type { UseFormSetValue } from 'react-hook-form';
import { stayDateOf } from '@/features/bookings/lib/booking-price';
import { orderStaysForRequest } from '@/features/service-requests/lib/stays';
import type { Booking } from '@/types';
import { todayInRome } from '@/lib/stay-dates';
import { usePropertyBookings } from '@/queries/use-bookings';
import type { RequestValues } from './request-model';

export type SetValue = UseFormSetValue<RequestValues>;

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

export const NO_SUPPLIER: Partial<RequestValues> = { ...NO_SERVICE, supplierOrgId: '', supplierName: '' };

export function assign(setValue: SetValue, values: Partial<RequestValues>) {
  (Object.keys(values) as (keyof RequestValues)[]).forEach((name) => {
    setValue(name, values[name] as never, { shouldDirty: true });
  });
}

export function useUpcomingStays(propertyId: string, linkedStay?: Booking) {
  const bookings = usePropertyBookings(propertyId || undefined);
  const today = todayInRome();
  const stays = useMemo(() => {
    const upcoming = orderStaysForRequest(bookings.data ?? [], today).filter((stay) => stayDateOf(stay.checkOutDate) >= today);
    if (linkedStay && linkedStay.propertyId === propertyId && linkedStay.status !== 'Cancelled' && !upcoming.some((stay) => stay.id === linkedStay.id)) {
      return [linkedStay, ...upcoming];
    }
    return upcoming;
  }, [bookings.data, today, linkedStay, propertyId]);
  return { stays, all: bookings.data };
}
