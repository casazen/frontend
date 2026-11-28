import type { ReactNode } from 'react';
import { BookingContext } from '@/features/public-booking/booking/booking-context';
import { useBookingModel } from '@/features/public-booking/booking/use-booking-model';
import type { PublicPropertyDetailDto } from '@/types';

interface BookingProviderProps {
  property: PublicPropertyDetailDto;
  orgSlug: string;
  hostLabel: string;
  contactEmail: string | null;
  childrenAges?: readonly (number | null)[];
  children: ReactNode;
}

export function BookingProvider({ property, orgSlug, hostLabel, contactEmail, childrenAges, children }: BookingProviderProps) {
  const model = useBookingModel({ property, orgSlug, hostLabel, contactEmail, childrenAges });
  return <BookingContext.Provider value={model}>{children}</BookingContext.Provider>;
}
