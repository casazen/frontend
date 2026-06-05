import type { RentalType } from '@/types';

const DEMO_PROFILE_STORAGE_KEY = 'casazen:demo-profile';

const RENTAL_TO_DEMO_PROFILE: Record<RentalType, string> = {
  ShortTerm: 'short-stay',
  LongTerm: 'long-term',
  Both: 'dual',
};

export function applyDemoOnboardingProfile(rentalType: RentalType): void {
  sessionStorage.setItem(DEMO_PROFILE_STORAGE_KEY, RENTAL_TO_DEMO_PROFILE[rentalType]);
}
